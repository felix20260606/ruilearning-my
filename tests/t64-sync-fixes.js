// 🔒 同步 / 保护的几处修补（全局检查查出来的），用假的 KV 跑后台（不碰线上数据）：
//   1. 删过的词再加回来换新 id（别的设备缓存里的旧删除记录不会再删它一次）
//   2. 掌握状态带时间 progAt：插件标的「已掌握」不会被别的标签页的旧缓存改回去；旧版网页（不带 progAt）照旧
//   3. 待整理队列「清空」带时间 pendDel：旧缓存并不回来；之后再加同一个词（pendAdd 更新）还能加
//   4. 设备时钟快：改动时间按服务器现在算（ext / mine / srs）
//   5. /api/mine：当天第一次改动前存档、能按日期取回；不带口令一天删太多要口令；过期的删除记号不再收
//   6. 删家人：有错题本等个人资料也不能删；编号不重复用
//   7. 用少得多的字幕盖掉已有字幕要口令；?fresh=1 不带口令不跳缓存
//   8. 缓存写不进去（KV 额度用完）不让请求失败
const path = require("path");
(async () => {
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map(), meta = new Map(); let putFail = false;
  const KV = {
    get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
    getWithMetadata: async k => (kv.has(k) ? { value: kv.get(k), metadata: meta.get(k) || null } : { value: null, metadata: null }),
    put: async (k, v, o) => { if (putFail && !/^(vocab|ext|users|auth|guard)/.test(k)) throw new Error("KV put() limit exceeded for the day."); kv.set(k, String(v)); meta.set(k, o && o.metadata); },
    delete: async k => { kv.delete(k); },
    list: async ({ prefix, limit }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).slice(0, limit || 1000).map(name => ({ name })), list_complete: true }),
  };
  const env = { CAPTIONS: KV };
  let KEY = "";
  const call = async (p, body, method) => { const h = { "content-type": "application/json" }; if (KEY) h["x-key"] = KEY; const r = await W.fetch(new Request("https://x.test" + p, body || method ? { method: method || "POST", headers: h, body: body ? JSON.stringify(body) : undefined } : { headers: h }), env); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  const V = () => JSON.parse(kv.get("vocab"));

  // ---- 1. 删过的词再加回来 ----
  await call("/api/vocab", { add: [{ id: "v_apple", word: "apple" }, { id: "v_pear", word: "pear" }] });
  let r = await call("/api/vocab", { patch: { deleted: ["v_apple"] } }); ok(!V().custom.some(e => e.word === "apple") && V().deleted.includes("v_apple"), "apple deleted");
  r = await call("/api/vocab", { add: [{ id: "v_apple", word: "apple" }] });
  const re = V().custom.find(e => e.word === "apple");
  ok(r.j.added === 1 && re && re.id !== "v_apple" && /^v_apple_/.test(re.id), "re-added with new id " + (re && re.id));
  ok(V().deleted.includes("v_apple") && r.j.ids && r.j.ids[0][0] === "v_apple", "old id stays deleted, mapping returned");
  // 别的设备（网页旧缓存）带着旧删除记录整份同步：新 id 不受影响
  r = await call("/api/vocab", { v: 2, state: { custom: [{ id: "v_pear", word: "pear" }], deleted: ["v_apple"], progress: {}, pending: [], srs: {} } });
  ok(V().custom.some(e => e.word === "apple"), "stale device does not delete the re-added word again");

  // ---- 2. 掌握状态带时间 ----
  await call("/api/vocab", { patch: { progress: { v_pear: "known" } } });
  ok(V().progress.v_pear === "known" && V().progAt.v_pear > 0, "patch stamps progAt");
  r = await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: { v_pear: "learning" }, progAt: { v_pear: 1 }, pending: [], srs: {} } });
  ok(V().progress.v_pear === "known", "stale tab (older progAt) cannot revert known");
  r = await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: { v_pear: "learning" }, progAt: { v_pear: Date.now() + 5000 }, pending: [], srs: {} } });
  ok(V().progress.v_pear === "learning", "newer progAt wins");
  r = await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: { v_pear: "known" }, pending: [], srs: {} } });
  ok(V().progress.v_pear === "known", "old page without progAt: pushed value wins as before");
  r = await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: {}, progAt: { v_pear: Date.now() + 9e9 }, pending: [], srs: {} } });
  ok(V().progAt.v_pear <= Date.now() + 6000, "far-future progAt clamped");

  // ---- 3. 待整理队列清空 ----
  await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: V().progress, pending: ["foo", "bar"], srs: {} } });
  ok(V().pending.length === 2, "pending added");
  const t0 = Date.now();
  await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: V().progress, pending: [], pendDel: { foo: t0, bar: t0 }, srs: {} } });
  ok(V().pending.length === 0, "cleared");
  await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: V().progress, pending: ["foo", "bar"], srs: {} } });
  ok(V().pending.length === 0, "stale cache cannot bring cleared words back");
  await call("/api/vocab", { v: 2, state: { custom: V().custom, deleted: V().deleted, progress: V().progress, pending: ["foo"], pendAdd: { foo: t0 + 10 }, srs: {} } });
  ok(V().pending.join() === "foo", "re-queued later (pendAdd newer) comes back");

  // ---- 4. 时钟快的设备 ----
  await call("/api/ext", { changes: { "saved|x": { v: "x", at: Date.now() + 365 * 86400e3 } } });
  let E = JSON.parse(kv.get("ext")); ok(E.items["saved|x"].at <= Date.now() + 6000, "ext at clamped");
  await call("/api/ext", { changes: { "saved|x": { del: 1, at: Date.now() + 6000 } } });
  E = JSON.parse(kv.get("ext")); ok(E.items["saved|x"].del, "later delete applies (not frozen)");
  await call("/api/vocab", { patch: { srs: { v_pear: { b: 1, at: Date.now() + 365 * 86400e3 } } } });
  ok(V().srs.v_pear.at <= Date.now() + 6000, "srs at clamped");

  // ---- 5. /api/mine ----
  await call("/api/auth", { set: "secret-123" }); // 设了口令：下面不带口令
  const ch = {}; for (let i = 0; i < 100; i++) ch["e" + i] = { v: { q: "q" + i }, at: Date.now() - 1000 };
  r = await call("/api/mine", { k: "err", changes: ch }); ok(r.j.ok && Object.keys(r.j.items).length === 100, "mine add 100");
  r = await call("/api/mine", { k: "err", changes: { e0: { v: { q: "changed" }, at: Date.now() } } });
  const bj = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  ok(kv.has("mine:err@" + bj) && JSON.parse(kv.get("mine:err@" + bj)).items.e0.v.q === "q0", "first change of the day archived");
  r = await call("/api/mine?k=err&history=1"); ok(r.j.days && r.j.days[0] === bj, "history lists days");
  r = await call("/api/mine?k=err&at=" + bj); ok(r.j.ok && r.j.items.e5, "archive readable");
  let delOk = 0, blocked = 0;
  for (let n = 0; n < 4; n++) { const d = {}; for (let i = n * 25; i < n * 25 + 25; i++) d["e" + i] = { del: 1, at: Date.now() }; r = await call("/api/mine", { k: "err", changes: d }); if (r.j.ok) delOk++; else if (r.status === 403) blocked++; }
  ok(delOk === 3 && blocked === 1, "no key: 80 deletes/day then needkey (" + delOk + "/" + blocked + ")");
  r = await call("/api/mine", { k: "err", changes: { old: { del: 1, at: Date.now() - 70 * 86400e3 } } }); ok(!("old" in r.j.items), "expired tombstone not taken");
  KEY = "secret-123"; const d4 = {}; for (let i = 75; i < 100; i++) d4["e" + i] = { del: 1, at: Date.now() }; r = await call("/api/mine", { k: "err", changes: d4 }); ok(r.j.ok, "with key: delete ok"); KEY = "";

  // ---- 6. 删家人 ----
  KEY = "secret-123";
  r = await call("/api/users", { add: "妈妈" }); const u2 = r.j.user.id;
  await call("/api/mine?u=" + u2, { k: "err", changes: { a: { v: 1, at: Date.now() } } });
  r = await call("/api/users", { remove: u2 }); ok(r.status === 409, "user with errbook data not removable");
  r = await call("/api/users", { add: "Lily" }); const u3 = r.j.user.id;
  await call("/api/ext?u=" + u3, { changes: { "set|x": { v: 1, at: Date.now() } } }); // 只有设置：可以删，但后台还留着数据的话编号不再用
  r = await call("/api/users", { remove: u3 }); ok(r.j.ok, "empty user removed");
  kv.set("u/" + u3 + "/leftover", "1"); // 模拟 KV 列表延迟留下的
  r = await call("/api/users", { add: "Tom" }); ok(r.j.user.id !== u3, "id not reused while leftovers exist (" + r.j.user.id + ")");
  KEY = "";

  // ---- 7. 字幕、fresh ----
  const cues = n => Array.from({ length: n }, (_, i) => ({ s: i, e: i + 1, t: "line " + i }));
  KEY = "secret-123"; r = await call("/api/cap", { v: "abcdefghijk", cues: cues(100) }); ok(r.j.ok, "cap stored"); KEY = "";
  r = await call("/api/cap", { v: "abcdefghijk", cues: cues(1) }); ok(r.status === 403, "overwrite 100 cues with 1 needs key");
  r = await call("/api/cap", { v: "abcdefghijk", cues: cues(98) }); ok(r.j.ok, "normal re-upload ok");
  let fetched = 0; const of = globalThis.fetch; globalThis.fetch = async () => { fetched++; return new Response("", { status: 500 }); };
  kv.set("d/apple", JSON.stringify({ word: "apple", zh: "苹果", en: [] }));
  r = await call("/api/dict?w=apple&fresh=1"); ok(r.j.cached && fetched === 0, "fresh ignored without key");
  KEY = "secret-123"; r = await call("/api/dict?w=apple&fresh=1"); ok(fetched > 0, "fresh works with key"); KEY = "";

  // ---- 8. 缓存写不进去 ----
  globalThis.fetch = async u => { u = String(u); if (u.includes("translate") || u.includes("mymemory")) return new Response(JSON.stringify({ responseData: { translatedText: "香蕉" }, sentences: [{ trans: "香蕉" }] }), { status: 200 }); if (u.includes("NEVER")) return new Response(JSON.stringify({ sentences: [{ trans: "香蕉" }] }), { status: 200 }); if (u.includes("dictionaryapi")) return !u.includes("banana") ? new Response("", { status: 404 }) : dictUp ? new Response(JSON.stringify([{ phonetic: "/bəˈnɑːnə/", meanings: [{ partOfSpeech: "noun", definitions: [{ definition: "a long curved fruit" }] }] }]), { status: 200 }) : new Response("[]", { status: 429 }); return new Response(JSON.stringify({ results: [] }), { status: 200 }); };
  let dictUp = false; putFail = true; r = await call("/api/dict?w=banana"); putFail = false; dictUp = true;
  ok(r.j.ok && r.j.zh === "香蕉", "dict still answers when cache put fails " + JSON.stringify(r.j).slice(0, 120));
  ok(!kv.has("d/banana"), "not cached while quota out");
  r = await call("/api/dict?w=zzqxv"); ok(!kv.has("d/zzqxv"), "made-up word (no definitions / examples) not cached");
  r = await call("/api/dict?w=banana"); ok(kv.has("d/banana") && meta.get("d/banana") === undefined, "dict cached after quota back");
  globalThis.fetch = of;

  // ---- 9. AI 语音：别的网站来的不给；短时间现做太多字母 → 429 ----
  let aiRuns = 0; env.AI = { run: async () => { aiRuns++; return new Uint8Array(500); } };
  const tts = async (t, og) => { const r = await W.fetch(new Request("https://x.test/api/tts?t=" + encodeURIComponent(t), og ? { headers: { origin: og } } : {}), env); return r.status; };
  ok(await tts("hello there", "https://evil.example") === 403 && aiRuns === 0, "foreign origin refused");
  ok(await tts("hello there", "https://ruilearning-my.pages.dev") === 200 && await tts("hello again") === 200, "own site / curl ok");
  const big = "a".repeat(1400); let st = 200, n = 0; while (st === 200 && n < 40) { st = await tts(big + " " + n); n++; }
  ok(st === 429 && n >= 2 && n <= 4, "too many letters in 10 min (4000) → 429 after " + n);
  delete env.AI;
  console.log(fail ? fail + " FAILED" : "t64 sync fixes: all ok"); process.exit(fail ? 1 : 0);
})();
