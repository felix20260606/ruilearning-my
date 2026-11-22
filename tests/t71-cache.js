// 💾 本机缓存统一管理（util.js）：U.keep / kept / keepKeys / cacheable；localStorage 存满了先清可丢的缓存再存
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

function env(limit) { // 假的 localStorage：总字数超过 limit 就抛 QuotaExceededError
  const store = new Map(); function Storage() {}
  const size = () => [...store].reduce((n, [k, v]) => n + k.length + v.length, 0);
  Storage.prototype.getItem = function (k) { return store.has(k) ? store.get(k) : null; };
  Storage.prototype.setItem = function (k, v) { const old = store.get(k); store.set(k, String(v)); if (limit && size() > limit) { if (old == null) store.delete(k); else store.set(k, old); const e = new Error("full"); e.name = "QuotaExceededError"; throw e; } };
  Storage.prototype.removeItem = function (k) { store.delete(k); };
  Storage.prototype.key = function (i) { return [...store.keys()][i]; };
  Object.defineProperty(Storage.prototype, "length", { get() { return store.size; } });
  const ls = new Storage(), tips = [];
  const c = vm.createContext({ console: Object.assign({}, console, { table() {} }), JSON, Math, Promise, String, Object, Array, Date, setTimeout, clearTimeout, Storage, localStorage: ls, addEventListener() {}, toast: m => tips.push(m) });
  c.window = c; vm.runInContext(W("util.js"), c); return { U: c.U, ls, store, tips };
}
{
  const { U } = env();
  U.keep("k", "a", 1, { max: 2 }); U.keep("k", "b", 2, { max: 2 }); U.keep("k", "c", { x: 3 }, { max: 2 });
  ok(U.kept("k", "a") === undefined && U.kept("k", "b") === 2 && U.kept("k", "c").x === 3, "keep: newest max entries, even within the same millisecond");
}
{
  const { U, ls, store } = env();
  ls.setItem("wt:doc:old", "x"); ls.setItem("wt:tr:old", "y");
  U.keepKeys("wt:recent", "v1", 2, ["wt:doc:", "wt:tr:"]); ok(!store.has("wt:doc:old") && !store.has("wt:tr:old"), "keepKeys: first use clears older leftovers");
  ls.setItem("wt:doc:v1", "1"); U.keepKeys("wt:recent", "v2", 2, ["wt:doc:"]); ls.setItem("wt:doc:v2", "2"); U.keepKeys("wt:recent", "v3", 2, ["wt:doc:"]); ls.setItem("wt:doc:v3", "3");
  ok(!store.has("wt:doc:v1") && store.has("wt:doc:v2") && store.has("wt:doc:v3") && JSON.parse(store.get("wt:recent")).join() === "v3,v2", "keepKeys: drops the oldest with its keys");
}
{
  const { U, ls, store, tips } = env(200);
  ls.setItem("wt:doc:a", "x".repeat(80)); ls.setItem("sme:zhc", "y".repeat(60));
  ls.setItem("vocab_state_v1", "z".repeat(90)); // 放不下 → 先清最不心疼的「视频字幕」
  ok(store.get("vocab_state_v1") === "z".repeat(90) && !store.has("wt:doc:a") && store.has("sme:zhc"), "storage full → clear caches one group at a time, then save");
  ok(tips.length === 1 && U.logs("store").length === 1, "tells once + logs");
  let threw = false; try { ls.setItem("drill:log", "q".repeat(500)); } catch (e) { threw = e.name === "QuotaExceededError"; }
  ok(threw && store.get("vocab_state_v1"), "still too big → throws as before (data never cleared)");
  U.cacheable("my:cache", "测试缓存"); ls.removeItem("drill:log");
}
// 页面改用了它
ok(/const wtKeep = \(key, v, n, pre\) => U\.keepKeys\(/.test(W("watch.js")), "watch uses U.keepKeys");
ok(/const zhKeep = \(id, j\) => U\.keep\("sme:zhc"/.test(W("listen.js")) && /U\.kept\("sme:zhc", id\)/.test(W("listen.js")), "listen uses U.keep / kept");
ok(/U\.keep\("reading:newsq", id,/.test(W("read.js")), "read uses U.keep");
console.log(fail ? fail + " FAILED" : "t71 cache: all ok"); process.exit(fail ? 1 : 0);
