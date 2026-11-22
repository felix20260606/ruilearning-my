// 网页里的个人资料同步（index.html 里那段 mineSyncPull / 本机存储钩子）：两台「设备」各自的 localStorage，共用一个假后台
// 设备 A 存了文章 → 传到后台；设备 B 打开时拉下来；B 删掉 → A 再拉时也没了；家人的数据不混（假 KV，不碰线上）
const path = require("path"), fs = require("fs");
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map(); let nPut = 0; const kvPuts = () => nPut;
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, String(v)); nPut++; }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  const html = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("mineSyncPull"));
  let pending = [];
  function device() { // 一台设备：自己的 Storage 类、localStorage、fetch（直接调假后台）
    class Storage { constructor() { this.m = {}; } getItem(k) { return k in this.m ? this.m[k] : null; } setItem(k, v) { this.m[k] = String(v); } removeItem(k) { delete this.m[k]; } }
    const ls = new Storage(), win = { localStorage: ls, addEventListener() {} };
    const fetch = (u, o) => { const p = W.fetch(new Request("https://x.test" + u, o), { CAPTIONS: KV }).then(r => ({ json: () => r.json() })); pending.push(p); return p; };
    const doc = { addEventListener() {}, visibilityState: "visible", getElementById: () => null };
    new Function("window", "Storage", "localStorage", "fetch", "document", code)(win, Storage, ls, fetch, doc);
    return { ls, pull: k => win.mineSyncPull(k) };
  }
  const settle = async () => { while (pending.length) { const p = pending; pending = []; await Promise.all(p); } };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  const A = device(), B = device();
  A.ls.setItem("reading:docs", JSON.stringify([{ id: "d1", title: "T1", text: "Hello world.", at: 1, pos: 0 }])); await settle();
  ok(JSON.parse(kv.get("mine:reading")).items.d1.v.title === "T1", "A pushed d1");
  await B.pull("reading:docs"); await settle();
  ok(JSON.parse(B.ls.getItem("reading:docs"))[0].id === "d1", "B got d1");
  B.ls.setItem("reading:docs", JSON.stringify([])); await settle(); // B 删掉
  await A.pull("reading:docs"); await settle();
  ok(JSON.parse(A.ls.getItem("reading:docs")).length === 0, "A sees delete");
  // A 本机已有、从没传过的（同步上线前存的）：拉的时候补传
  const C = device(); C.ls.m["vocab:test"] = JSON.stringify([{ at: 5, size: 3000 }]);
  await C.pull("vocab:test"); await settle();
  ok(JSON.parse(kv.get("mine:vtest")).items["5"].v.size === 3000, "old local item uploaded");
  // 改一条（读到的位置）也会传
  A.ls.setItem("reading:docs", JSON.stringify([{ id: "d2", title: "T2", text: "x", at: 2, pos: 0 }])); await settle();
  A.ls.setItem("reading:docs", JSON.stringify([{ id: "d2", title: "T2", text: "x", at: 2, pos: 3 }])); await new Promise(r => setTimeout(r, 20)); await settle();
  // 位置单独传一小项「pos:d2」，不再把整篇文章重传
  const R1 = JSON.parse(kv.get("mine:reading")).items; ok(R1["pos:d2"] && R1["pos:d2"].v === 3 && R1.d2.v.pos === 0, "pos sent as its own small item");
  const w0 = kvPuts(); A.ls.setItem("reading:docs", JSON.stringify([{ id: "d2", title: "T2", text: "x", at: 2, pos: 7 }])); await new Promise(r => setTimeout(r, 20)); await settle();
  ok(kvPuts() === w0, "second pos change within 2 minutes is not sent right away");
  await B.pull("reading:docs"); await settle();
  ok(JSON.parse(B.ls.getItem("reading:docs"))[0].pos === 3, "B gets updated pos");
  console.log(fail ? fail + " failed" : "t45 ok"); process.exit(fail ? 1 : 0);
})();
