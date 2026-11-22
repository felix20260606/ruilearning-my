// 🌐 每种学习语言的数据分开存：
//   后台：/api/vocab、ext、mine 带 ?lang=de 存到「l/de/」下（家人再在前面加 u/<id>/）；英语不带参数，和以前一样；不支持的语言 404
//   网页：index.html 最上面那段把本机缓存键加 "@<id>~de"、接口自动带 ?u=&lang=；"lang" 自己只按人分开
// 用假的 KV / 假的 window 跑（不需要浏览器，不碰线上数据）
const path = require("path"), fs = require("fs"), vm = require("vm");
(async () => {
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  // ---- 后台 ----
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map();
  const KV = {
    get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
    put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); },
    list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
  const env = { CAPTIONS: KV };
  const call = async (p, body) => { const r = await W.fetch(new Request("https://x.test" + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}), env); return { status: r.status, j: await r.json() }; };
  let r = await call("/api/vocab", { add: [{ id: "v_apple", word: "apple" }] }); ok(r.j.ok, "add en");
  r = await call("/api/vocab?lang=de", { add: [{ id: "v_apfel", word: "Apfel" }] }); ok(r.j.ok, "add de");
  ok(JSON.parse(kv.get("vocab")).custom.map(x => x.word).join() === "apple", "en notebook only apple");
  ok(JSON.parse(kv.get("l/de/vocab")).custom.map(x => x.word).join() === "Apfel", "de notebook at l/de/vocab");
  r = await call("/api/vocab?lang=de"); ok(r.j.custom.length === 1 && r.j.custom[0].word === "Apfel", "read de");
  r = await call("/api/vocab?lang=en"); ok(r.j.custom.length === 1 && r.j.custom[0].word === "apple", "lang=en same as default");
  r = await call("/api/vocab?lang=xx"); ok(r.status === 404, "unknown lang 404");
  r = await call("/api/vocab?lang=de%2F..%2F"); ok(r.status === 404, "no path tricks");
  // 家人 + 语言
  r = await call("/api/users", { add: "妈妈" }); const u2 = r.j.user.id;
  r = await call("/api/vocab?u=" + u2 + "&lang=de", { add: [{ id: "v_haus", word: "Haus" }] }); ok(r.j.ok, "add u2 de");
  ok(JSON.parse(kv.get("u/" + u2 + "/l/de/vocab")).custom[0].word === "Haus", "stored u/u2/l/de/vocab");
  r = await call("/api/vocab?u=" + u2); ok(r.j.custom.length === 0, "u2 en untouched");
  // 错题本等个人资料（/api/mine）
  r = await call("/api/mine?lang=de", { k: "err", changes: { e1: { v: { q: "Mädchen" }, at: 1 } } }); ok(r.j.ok, "mine de post " + JSON.stringify(r.j));
  r = await call("/api/mine?k=err"); ok(!Object.keys(r.j.items).length, "en errbook empty");
  r = await call("/api/mine?k=err&lang=de"); ok(r.j.items.e1 && r.j.items.e1.v.q === "Mädchen", "de errbook has it");
  // 插件数据
  r = await call("/api/ext?lang=de", { set: { "saved|Haus": { v: "Haus", at: 1 } } }); r = await call("/api/ext?lang=de"); const deExt = r.j.items || {};
  r = await call("/api/ext"); ok(!Object.keys(r.j.items || {}).some(k => k.includes("Haus")), "en ext untouched");
  // 只有德语数据的家人也不能删
  r = await call("/api/users", { add: "Lily" }); const u3 = r.j.user.id;
  await call("/api/vocab?u=" + u3 + "&lang=de", { add: [{ id: "v_x", word: "Katze" }] });
  r = await call("/api/users", { remove: u3 }); ok(r.status === 409, "user with only German data not removable");

  // ---- 网页：index.html 最上面那段 ----
  const html = require("./lib/page").html();
  const head = html.match(/<script>\s*(\/\* 家人（多用户[\s\S]*?\}\)\(\);)/)[1];
  function page(init) {
    const store = new Map(Object.entries(init)), calls = [];
    function Storage() {} Storage.prototype.getItem = function (k) { return store.has(k) ? store.get(k) : null; }; Storage.prototype.setItem = function (k, v) { store.set(k, String(v)); }; Storage.prototype.removeItem = function (k) { store.delete(k); };
    const localStorage = new Storage();
    const win = { localStorage, Storage, location: new URL("https://x.test/"), navigator: {}, URL, fetch: (u) => { calls.push(String(u)); return Promise.resolve(); } };
    win.window = win; vm.createContext(win); vm.runInContext(head, win); return { win, store, calls };
  }
  { // 主人、英语：什么都不改
    const { win, store, calls } = page({});
    win.localStorage.setItem("err:items", "{}"); win.fetch("/api/vocab");
    ok(store.has("err:items") && calls[0] === "/api/vocab" && win.VL === "en", "owner en unchanged");
  }
  { // 主人、德语
    const { win, store, calls } = page({ lang: "de" });
    win.localStorage.setItem("err:items", "{}"); win.localStorage.setItem("vocab_mode", "list"); win.fetch("/api/vocab"); win.fetch("/api/mine?k=err"); win.fetch("/api/sme?s=ree");
    ok(store.has("err:items~de") && !store.has("err:items"), "owner de errbook key");
    ok(store.has("vocab_mode"), "UI prefs shared");
    ok(win.localStorage.getItem("lang") === "de" && store.get("lang") === "de", "lang key not suffixed");
    ok(calls[0] === "/api/vocab?lang=de" && calls[1] === "/api/mine?k=err&lang=de" && calls[2] === "/api/sme?s=ree", "owner de api " + calls);
    win.localStorage.setItem("drill:prog", "{}"); win.localStorage.setItem("drill:new:thing", "1"); ok(store.has("drill:prog~de") && store.has("drill:new:thing~de"), "drill:* keys split");
  }
  { // 家人、德语
    const { win, store, calls } = page({ vu: "u2", "lang@u2": "de" });
    win.localStorage.setItem("vocab_state_v1", "{}"); win.fetch("/api/vocab");
    ok(store.has("vocab_state_v1@u2~de"), "u2 de notebook cache key");
    ok(calls[0] === "/api/vocab?u=u2&lang=de", "u2 de api " + calls[0]);
    win.localStorage.setItem("lang", "en"); ok(store.get("lang@u2") === "en", "u2 switches back via lang@u2");
  }
  { // 家人、英语：和以前一样
    const { win, store, calls } = page({ vu: "u2" });
    win.localStorage.setItem("err:items", "{}"); win.fetch("/api/vocab");
    ok(store.has("err:items@u2") && calls[0] === "/api/vocab?u=u2", "u2 en unchanged");
  }
  { // 乱写的语言：当英语
    const { win, calls } = page({ lang: "../x" }); win.fetch("/api/vocab"); ok(calls[0] === "/api/vocab" && win.VL === "en", "bad lang ignored");
  }
  console.log(fail ? fail + " FAILED" : "t54 lang split: all ok"); process.exit(fail ? 1 : 0);
})();
