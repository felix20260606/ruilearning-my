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
  // 「📅 每日」最上面的额度面板
  const fs = require("fs"), R = f => fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8"), h = R("index.html"), dj = R("daily.js"), q = R("quota.js");
  ok(/<script src="quota\.js\?v=\d+"><\/script>\s*<script src="daily\.js/.test(h), "quota.js loaded before daily.js");
  ok(/'<div class="dy">' \+\s*'<div id="dy-quota">' \+ \(window\.quotaHtml/.test(dj), "panel is first thing on the daily page");
  ok(["llama-3.3-70b-instruct-fp8-fast", "llama-4-scout-17b-16e-instruct", "aura-1", "whisper-large-v3-turbo", "whisper", "m2m100-1.2b"].every(m => q.includes('"' + m + '"')), "panel lists every model the worker uses");
  console.log(fail ? fail + " FAILED" : "t60 usage: all ok"); process.exit(fail ? 1 : 0);
})();
