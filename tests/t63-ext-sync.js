// 插件同步的几处修补（全局检查查出来的）：插件后台 background.js 跑在 vm 里，网站后台用真的 _worker.js + 假的 KV（不联网、不碰线上数据）
//   1. 「已保存」页删除生词本词条：删除真的传到后台（以前 vocabPatch 把 deleted 丢了）
//   2. 录音截图一次最多传 60 条：没传上去的不会被当成「别的设备删了」而在本机删掉；别的设备真删了的照样删
//   3. 同步进行中本机又保存了词：不会被同步结果盖掉，下次传上去
//   4. 非英文的词 id 不再撞成同一个
//   5. 插件里取消标记过的词：生词本同步不再把它标回来；生词本之后又改了状态就照生词本
//   6. 网站上删掉的词：插件本机在删除之前保存的，跟着删掉、不再传上去加回来；删除之后又在插件里保存的照常加
const fs = require("fs"), vm = require("vm"), path = require("path");
(async () => {
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  const env = { CAPTIONS: KV };
  let mediaHook = null, mediaPosts = 0;
  const fakeFetch = async (u, o) => {
    u = String(u); const h = new URL(u).hostname;
    if (h !== "ruilearning-my.pages.dev") throw new TypeError("offline");
    if (/\/api\/media/.test(u) && o && o.method === "POST") { mediaPosts++; if (mediaHook) await mediaHook(); }
    const r = await W.fetch(new Request(u, o ? { method: o.method, headers: o.headers, body: o.body } : {}), env);
    const t = await r.text(); return { ok: r.ok, status: r.status, json: async () => JSON.parse(t), text: async () => t };
  };
  const local = {}, sync = {}, session = {};
  const cp = x => JSON.parse(JSON.stringify(x));
  const pick = (o, k) => { if (k == null) return cp(o); if (typeof k === "string") return k in o ? { [k]: cp(o[k]) } : {}; if (Array.isArray(k)) { const r = {}; k.forEach(x => { if (x in o) r[x] = cp(o[x]); }); return r; } const r = {}; for (const x in k) r[x] = x in o ? cp(o[x]) : k[x]; return r; };
  const area = o => ({ get: (k, cb) => { const r = pick(o, k); if (cb) cb(r); return Promise.resolve(r); }, set: async v => { for (const x in v) o[x] = cp(v[x]); }, remove: async ks => { [].concat(ks).forEach(x => delete o[x]); }, getKeys: async () => Object.keys(o) });
  const ctx = { console, setTimeout: (f, ms) => 0, clearTimeout() {}, URL, URLSearchParams, encodeURIComponent, Promise, JSON, AbortController, Uint8Array, String, btoa, importScripts() {},
    chrome: { storage: { local: area(local), sync: area(sync), session: area(session), onChanged: { addListener() {} } },
      runtime: { onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, getURL: x => x, id: "x" },
      alarms: { create() {}, get: async () => ({}), onAlarm: { addListener() {} } }, tabs: { create() {} } },
    fetch: fakeFetch };
  ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8") + "\n;globalThis.__t={vocabPatch,extSync,nbApply,syncAll,entryId,cloudAdd};", ctx);
  const T = ctx.__t, V = () => JSON.parse(kv.get("vocab") || '{"custom":[]}');
  const ent = w => ({ id: T.entryId(w), type: "word", word: w, zh: "x", date: "2026-11-22" });

  // ---- 1. 删除传到后台 ----
  await T.cloudAdd([ent("apple"), ent("pear")]);
  let r = await T.vocabPatch({ deleted: ["v_apple"] });
  ok(r.ok && !V().custom.some(e => e.word === "apple") && V().deleted.includes("v_apple"), "vocabPatch sends deleted");
  ok(!(local.srsQueue && (local.srsQueue.deleted || []).length), "queue emptied after send");

  // ---- 4. 非英文的 id ----
  ok(T.entryId("apple") === "v_apple", "plain id unchanged");
  ok(T.entryId("ありがとう") !== T.entryId("こんにちは") && T.entryId("año") !== T.entryId("ano"), "non-latin ids distinct");

  // ---- 2. 录音截图 ----
  for (let i = 0; i < 70; i++) local["med:w:w" + i] = { at: 1000 + i, aud: "data:audio/webm;base64,AAAA", img: "" };
  local.saved = ["pear"];
  r = await T.extSync(true);
  const n1 = Object.keys(local).filter(k => k.startsWith("med:")).length;
  ok(r.ok && r.up === 60 && n1 === 70, "first sync uploads 60, keeps all 70 locally (" + r.up + "/" + n1 + ")");
  r = await T.extSync(true);
  ok(r.ok && r.up === 10 && Object.keys(local).filter(k => k.startsWith("med:")).length === 70, "second sync uploads the rest");
  // 别的设备删了 w0：云端记 del
  await W.fetch(new Request("https://ruilearning-my.pages.dev/api/ext", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes: { "med|med:w:w0": { del: 1, at: Date.now() + 1000 } } }) }), env);
  r = await T.extSync(true);
  ok(!local["med:w:w0"] && local["med:w:w1"], "media deleted elsewhere is removed locally, others kept");

  // ---- 3. 同步中本机又保存了词 ----
  local["med:w:new"] = { at: 5000, aud: "data:audio/webm;base64,BBBB", img: "" };
  mediaHook = async () => { mediaHook = null; local.saved = local.saved.concat(["beta"]); local.marks = Object.assign({}, local.marks, { gamma: "known" }); };
  r = await T.extSync(true);
  ok(local.saved.includes("beta") && local.marks && local.marks.gamma === "known", "edits made during sync survive " + JSON.stringify(local.saved));
  r = await T.extSync(true);
  const E = JSON.parse(kv.get("ext")).items;
  ok(E["saved|beta"] && !E["saved|beta"].del && E["marks|gamma"], "and are uploaded next sync");

  // ---- 5. 取消标记 ----
  await T.cloudAdd([ent("delta")]);
  local.saved = local.saved.filter(w => w !== "delta"); local.unmk = { delta: Date.now() };
  await T.nbApply();
  ok(!local.saved.includes("delta"), "unmarked word not re-added by notebook");
  await new Promise(res => setTimeout(res, 5));
  await W.fetch(new Request("https://ruilearning-my.pages.dev/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ patch: { progress: { v_delta: "known" } } }) }), env);
  await T.nbApply();
  ok(local.marks.delta === "known", "notebook changed later → follows notebook");

  // ---- 6. 网站上删掉的词 ----
  await T.cloudAdd([ent("kiwi"), ent("plum")]);
  local.saved = local.saved.concat(["kiwi", "plum"]); local.savedCtx = { kiwi: { at: Date.now() - 60000 } };
  const st = V(); st.deleted = st.deleted.concat(["v_kiwi", "v_plum"]);
  await W.fetch(new Request("https://ruilearning-my.pages.dev/api/vocab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ v: 2, state: st }) }), env); // 网站上删了 kiwi、plum
  local.savedCtx.plum = { at: Date.now() + 1000 }; // plum 是删了之后又在插件里保存的
  r = await T.syncAll("zh-CN");
  ok(!V().custom.some(e => e.word === "kiwi"), "website-deleted word not pushed back");
  ok(!local.saved.includes("kiwi"), "and removed from plugin saved");
  ok(V().custom.some(e => e.word === "plum") && local.saved.includes("plum"), "re-saved after delete is added (new id)");

  console.log(fail ? fail + " FAILED" : "t63 ext sync: all ok"); process.exit(fail ? 1 : 0);
})();
