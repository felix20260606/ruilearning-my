// 🔋 AI 额度记账：env.AI.run 每次按官方价格折成 neurons，攒一会儿写 KV「use/日期/…」（数字在 metadata），GET /api/usage 汇总最近 7 天
// 假的 KV（带 metadata 的 list）、假的 AI 直接跑 web/_worker.js；不联网
const path = require("path");
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map(), puts = [];
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v.v) : v.v; }, put: async (k, v, o) => { puts.push(k); kv.set(k, { v: String(v), md: o && o.metadata }); }, delete: async k => { kv.delete(k); },
    list: async o => ({ keys: [...kv.keys()].filter(k => k.startsWith(o.prefix || "")).map(k => ({ name: k, metadata: kv.get(k).md })), list_complete: true }) };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  const env = { CAPTIONS: KV, ASSETS: { fetch: async () => new Response("x") }, AI: { run: async (m, o) => {
    if (/aura/.test(m)) { if (o.text === "boom") throw new Error("quota"); return new Uint8Array(10); }
    if (/whisper/.test(m)) return { text: "hi", transcription_info: { duration: 60 }, segments: [] };
    if (/m2m100/.test(m)) return { translated_text: "你好" };
    return { response: '{"reply":"Hello there!","fix":null}', usage: { prompt_tokens: 1000, completion_tokens: 100 } };
  } } };
  const waits = []; const ctx = { waitUntil: p => waits.push(p) };
  const st = global.setTimeout; global.setTimeout = (f, ms) => st(f, 0); // 不等 15 秒
  const call = (p, init) => W.fetch(new Request("https://x.test" + p, init), env, ctx);
  await call("/api/tts?v=asteria&t=" + encodeURIComponent("a".repeat(1000))); // aura 1000 字母 ≈ 1363.64
  await call("/api/stt", { method: "POST", body: new Uint8Array(100) }); // whisper turbo 60 秒 ≈ 46.63
  await call("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "chat", scene: "cafe", history: [{ role: "user", content: "hi" }] }) }); // 70B：1000 进 100 出 ≈ 26.67 + 20.48
  await call("/api/tts?v=asteria&t=boom");
  await Promise.all(waits); global.setTimeout = st;
  ok(puts.filter(k => k.startsWith("use/")).length === 1, "one batched write " + puts);
  const r = await (await call("/api/usage")).json(), d = r.days[r.today];
  ok(r.ok && r.limit === 10000 && r.reset > Date.now(), "head " + JSON.stringify(r).slice(0, 120));
  ok(d && d.m["aura-1"][0] === 1 && Math.abs(d.m["aura-1"][1] - 1364) <= 1, "aura " + JSON.stringify(d && d.m));
  ok(d.m["whisper-large-v3-turbo"] && d.m["whisper-large-v3-turbo"][1] === 47, "whisper by duration");
  ok(d.m["llama-3.3-70b-instruct-fp8-fast"] && d.m["llama-3.3-70b-instruct-fp8-fast"][1] === 47, "llm by usage tokens " + JSON.stringify(d.m));
  ok(d.f.tts && d.f.stt && d.f["ai:chat"] && d.f["ai:chat"][0] === 1, "per feature " + JSON.stringify(d.f));
  ok(d.e === 1, "failed call counted as error");
  ok(r.src === "est" && r.why === "notset", "no token → estimate " + r.src + " " + r.why);
  // 配了 CF_API_TOKEN + CF_ACCOUNT_ID：模型用量换成 Cloudflare GraphQL 的数字，估算留在 est
  let gq = null; const of = global.fetch;
  global.fetch = async (u, o) => { if (String(u) === "https://api.cloudflare.com/client/v4/graphql") { gq = { h: o.headers, b: JSON.parse(o.body) }; return new Response(JSON.stringify({ data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: [{ count: 5, sum: { totalNeurons: 1234.4 }, dimensions: { date: r.today, modelId: "@cf/deepgram/aura-1" } }, { count: 2, sum: { totalNeurons: 300 }, dimensions: { date: r.today, modelId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" } }] }] } } })); } return of(u, o); };
  env.CF_API_TOKEN = "t0k"; env.CF_ACCOUNT_ID = "acc123";
  let r2 = await (await call("/api/usage")).json(); // node 里没有 caches.default，每次都是新算的
  ok(r2.src === "cf" && r2.days[r2.today].m["aura-1"][1] === 1234 && r2.days[r2.today].m["aura-1"][0] === 5 && r2.days[r2.today].est["aura-1"][1] === 1364, "cf numbers + est kept " + JSON.stringify(r2).slice(0, 300));
  ok(gq && gq.h.Authorization === "Bearer t0k" && gq.b.variables.a === "acc123" && /aiInferenceAdaptiveGroups/.test(gq.b.query) && /totalNeurons/.test(gq.b.query) && /modelId/.test(gq.b.query), "graphql request");
  ok(r2.days[r2.today].f.tts, "feature split still from own log");
  global.fetch = async (u, o) => String(u).includes("api.cloudflare.com") ? new Response(JSON.stringify({ errors: [{ message: "Authentication error" }] })) : of(u, o);
  r2 = await (await W.fetch(new Request("https://x.test/api/usage"), env, ctx)).json();
  ok(r2.src === "est" && /Authentication/.test(r2.why) && r2.days[r2.today].m["aura-1"][1] === 1364, "cf error → estimate with reason");
  global.fetch = of; delete env.CF_API_TOKEN; delete env.CF_ACCOUNT_ID;
  // 「📅 每日」最上面的额度面板
  const fs = require("fs"), R = f => fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8"), h = R("index.html"), dj = R("daily.js"), q = R("quota.js");
  ok(/<script src="quota\.js\?v=\w+"><\/script>\s*<script src="daily\.js/.test(h), "quota.js loaded before daily.js");
  ok(/'<div class="dy">' \+\s*'<div id="dy-quota">' \+ \(window\.quotaHtml/.test(dj), "panel is first thing on the daily page");
  ok(/let opened = false; const isOpen = \(\) => opened;/.test(q) && !/quota:open/.test(q), "panel always starts collapsed (not remembered)");
  ok(["ai:write", "ai:newsimp", "ai:chat", "ai:chatsum", "ai:speak", "ai:judge", "ai:howto", "ai:useword", "ai:coach", "ai:exam", "ai:ieltsscript", "ai:lquiz", "ai:whymiss", "sme:al", "dw:al", "tts", "stt"].every(k => q.includes('["' + k + '"')), "every AI feature has an entry card");
  ok(/data-qgo="/.test(q) && /function goTo\(g\)/.test(q), "cards jump to the feature");
  ok(["llama-3.3-70b-instruct-fp8-fast", "llama-4-scout-17b-16e-instruct", "aura-1", "whisper-large-v3-turbo", "whisper", "m2m100-1.2b"].every(m => q.includes('"' + m + '"')), "panel lists every model the worker uses");
  console.log(fail ? fail + " FAILED" : "t60 usage: all ok"); process.exit(fail ? 1 : 0);
})();
