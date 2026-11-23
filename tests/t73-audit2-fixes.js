// 第二次全局检查查出的问题修好了没有（node 里用假的 fetch / document 跑，不联网、不碰线上）：
//   ① cloud.js：发失败越等越久再发（不再每 1.5 秒一直打后台）；读不到 reject（不是空的 {}）
//   ② lazy.js：依赖的页面加载失败一次，下次还能重新加载；后台预加载失败不弹提示
//   ③ keys.js：上面的弹层不管的键往下传；modal 的不往下传
//   ④ util.js：存储满了清缓存不会清到 reading:trOn 这种设置
//   ⑤ tr.js：同一个词同时查只发一次、查不到 1 分钟内不再查；查词不请后台 AI 代翻；德语按德语查
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function env(fetchImpl, extra) {
  const store = new Map(), calls = [], L = {};
  const win = Object.assign({
    console, JSON, Math, Promise, Date, Set, Map, String, Array, Object, setTimeout, clearTimeout, encodeURIComponent, URL, Blob: function () {},
    localStorage: { length: 0, key: () => null, getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch: async (u, o) => { calls.push({ u: String(u), o }); return fetchImpl(String(u), o, calls.length); },
    navigator: { sendBeacon: () => true, userAgent: "node" },
    document: { readyState: "complete", visibilityState: "visible", querySelector: () => null, querySelectorAll: () => [], addEventListener: (k, f) => (L["d:" + k] = L["d:" + k] || []).push(f), dispatchEvent() {}, head: { append() {} } },
    addEventListener: (k, f) => (L[k] = L[k] || []).push(f), CustomEvent: function (t) { this.type = t; }, __L: L,
  }, extra || {});
  win.window = win; win.toast = () => {};
  vm.createContext(win);
  return { win, calls, store, L };
}
const res = (j, st) => ({ ok: (st || 200) < 400, status: st || 200, json: async () => j });

(async () => {
  // ---- ① cloud.js ----
  {
    const E = env(async () => res({ ok: false }, 500)); vm.runInContext(W("util.js") + W("cloud.js"), E.win);
    const C = E.win.CLOUD.chan("err", { delay: 20 }); C.put("a", 1);
    await sleep(700);
    ok(E.calls.length >= 2 && E.calls.length <= 6, "backoff: 500s do not retry every 20ms (" + E.calls.length + " posts in 0.7s, was ~35)");
    const E2 = env(async () => res({ ok: false, error: "net" }, 503)); vm.runInContext(W("util.js") + W("cloud.js"), E2.win);
    let rej = false; await E2.win.CLOUD.chan("ext").get().catch(() => { rej = true; }); ok(rej, "get() rejects when the server can't be read");
  }
  // ---- ② lazy.js ----
  {
    const scripts = []; let failNext = true;
    const E = env(async () => res({})); E.win.document.createElement = () => ({ remove() {}, set src(v) { this._s = v; } });
    E.win.document.head.append = s => { scripts.push(s._s); setTimeout(() => { if (/listen/.test(s._s) && failNext) { failNext = false; s.onerror(); } else s.onload(); }, 1); };
    E.win.document.readyState = "complete"; E.win.U = { log() {}, tip: m => (E.win.__tips = (E.win.__tips || []).concat(m)) };
    vm.runInContext(W("lazy.js"), E.win);
    let e1 = null; await E.win.LAZY.need("drill").catch(e => { e1 = e; });
    ok(e1 && !E.win.LAZY.loaded("drill"), "drill fails when listen fails");
    let e2 = null; await E.win.LAZY.need("drill").catch(e => { e2 = e; });
    ok(!e2 && E.win.LAZY.loaded("drill") && E.win.LAZY.loaded("listen"), "second try reloads listen and drill");
    ok((E.win.__tips || []).length === 1, "user-triggered failure shows one tip");
    failNext = true; delete E.win.__tips; const E3 = E; // 后台预加载失败：不弹
    await E3.win.LAZY.need("speak", true).catch(() => {}); ok(!(E3.win.__tips || []).length, "background preload: no tip");
  }
  // ---- ③ keys.js ----
  {
    const E = env(async () => res({})); vm.runInContext(W("keys.js"), E.win);
    const K = E.win.KEYS, hit = [];
    K.on("page", { when: () => true }, k => { hit.push("page:" + k); return true; });
    K.on("pop", { when: () => true, prio: 5 }, k => { if (k === "esc") { hit.push("pop:esc"); return true; } return false; });
    const fire = key => E.L["d:keydown"].forEach(f => f({ key, target: { tagName: "BODY" }, preventDefault() {}, stopPropagation() {} }));
    fire(" "); fire("Escape");
    ok(hit.join() === "page:space,pop:esc", "keys pass through a popup that doesn't handle them: " + hit.join());
    K.on("reader", { when: () => true, prio: 10, modal: true }, () => false); hit.length = 0; fire(" ");
    ok(!hit.length, "modal overlay swallows keys");
  }
  // ---- ④ util.js：清缓存 ----
  {
    const E = env(async () => res({})); const S = new Map([["reading:tr", "x".repeat(10)], ["reading:trOn", "1"], ["wt:doc:abc", "y"], ["vocab_state_v1", "{}"]]);
    let full = true;
    function Storage() {} Storage.prototype.getItem = k => (S.has(k) ? S.get(k) : null);
    Storage.prototype.setItem = function (k, v) { if (full && k === "big") { full = S.has("reading:tr") || S.has("wt:doc:abc"); const e = new Error("q"); e.name = "QuotaExceededError"; throw e; } S.set(k, String(v)); };
    Storage.prototype.removeItem = k => S.delete(k); Storage.prototype.key = i => [...S.keys()][i]; Object.defineProperty(Storage.prototype, "length", { get: () => S.size });
    const ls = new Storage(); E.win.Storage = Storage; E.win.localStorage = ls;
    vm.runInContext(W("util.js"), E.win);
    try { ls.setItem("big", "z"); } catch (e) {}
    ok(S.has("reading:trOn") && S.has("vocab_state_v1"), "settings / user data not cleared");
    ok(!S.has("wt:doc:abc") || !S.has("reading:tr"), "a disposable cache was cleared");
  }
  // ---- ⑤ tr.js ----
  {
    let n = 0; const E = env(async u => { n++; await sleep(20); return res([[["苹果", "apple"]], [["noun", ["苹果"]]]]); });
    E.win.U = { log() {}, sents: s => [s] };
    let noAI = []; E.win.NET = { g: (u, o) => { noAI.push(!!(o && o.noAI)); return E.win.fetch(u); } };
    vm.runInContext(W("tr.js"), E.win);
    const [a, b] = await Promise.all([E.win.TR.word("apple"), E.win.TR.word("apple")]);
    ok(n === 1 && a.zh[0] === "苹果" && b.zh[0] === "苹果", "same word looked up once");
    ok(noAI.every(Boolean), "word lookups never ask the backend AI");
    E.win.VL = "de"; await E.win.TR.word("Haus"); ok(/sl=de/.test(E.calls[E.calls.length - 1].u), "German words looked up as German");
    const E2 = env(async () => res({}, 500)); E2.win.U = { log() {}, sents: s => [s] }; vm.runInContext(W("tr.js"), E2.win);
    await E2.win.TR.word("zzz"); await E2.win.TR.word("zzz"); ok(E2.calls.length === 1, "failed lookup not repeated within a minute");
    // 逐行兜底：一行出错不影响后面的
    let k = 0; const E3 = env(async u => { k++; const q = new URL(u).searchParams.get("q"); if (q.includes("\n")) return res([[["只有一行", ""]]]); if (q === "bad") return res({}, 500); return res([[["译" + q, q]]]); });
    E3.win.U = { log() {}, sents: s => [s] }; vm.runInContext(W("tr.js"), E3.win);
    const out = await E3.win.TR.lines(["one", "bad", "three"], { ai: false });
    ok(out[0] === "译one" && out[1] === "" && out[2] === "译three", "row-by-row fallback continues after a bad row: " + JSON.stringify(out));
  }
  // ---- 源码检查：几处修法还在 ----
  const word = W("word.js"), watch = W("watch.js"), daily = W("daily.js"), rec = W("rec.js"), net = W("net.js");
  ok(/ok === true \|\| status\(lw\) !== "kn"/.test(word), "WORD.add does not downgrade known words");
  ok(/cur === "known" \? "learning"/.test(watch), "un-marking a known word writes learning");
  ok(/typeof window\.drillToday !== "function"/.test(daily), "daily waits for drill before lowering today's count");
  ok(/rec !== ph/.test(rec), "recording start can be cancelled while waiting for the mic");
  ok(/noAI\)\|\|!\/\^\(en\|auto\)\$\/\.test\(sl\)/.test(net), "NET.g backend fallback only for en→zh");
  console.log(fail ? fail + " FAILED" : "t73 audit2 fixes: all ok"); process.exit(fail ? 1 : 0);
})();
