// 全站共用的模块：util.js（U 小工具 + 排查日志）、ai.js（AI.ask）、tr.js（TR 翻译）、cloud.js（CLOUD 同步）、media.js（MEDIA 放音）、word.js 的 WORD.add（加生词本）
// ① 页面源码里不再各写一份 ② 每个模块在 node 里用假的 fetch / Audio 跑一遍（不联网）
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const PAGES = fs.readdirSync(path.join(__dirname, "..", "web")).filter(f => /\.js$/.test(f) && !/^(_worker|util|ai|tr|cloud|media|tts|rec|nav|speak-data|sw)\.js$/.test(f));

// ---------- ① 源码 ----------
for (const f of PAGES) {
  const s = W(f);
  ok(!/fetch\("\/api\/ai"/.test(s), f + ": 调 AI 走 AI.ask");
  ok(!/fetch\("\/api\/mine"/.test(s) && !/fetch\("\/api\/mine\?k=/.test(s), f + ": 同步走 CLOUD");
  ok(!/fetch\("\/api\/ext", \{ method: "POST"/.test(s), f + ": 插件同步走 CLOUD.chan(\"ext\")");
  ok(!/translate\.googleapis\.com/.test(s), f + ": 翻译走 TR");
  ok(!/window\.vocabAddWord\(/.test(s), f + ": 加词走 WORD.add");
  ok(!/const esc = s => String\(s == null/.test(s), f + ": esc 用 U.esc");
  ok(!/const LG = \(k, d\) => \{ try \{ const v = localStorage/.test(s), f + ": LG 用 U.LG");
  ok(!/sendBeacon\("\/api\/mine"/.test(s), f + ": 关页面发送在 cloud.js");
}
const h = W("index.html");
ok(/<script src="util\.js\?v=\d+"><\/script>\s*<script src="nav\.js\?v=\d+"><\/script>\s*<script src="word\.js\?v=\d+"><\/script>\s*<script src="ai\.js\?v=\d+"><\/script>\s*<script src="tr\.js\?v=\d+"><\/script>\s*<script src="cloud\.js\?v=\d+"><\/script>\s*<script src="media\.js\?v=\d+"><\/script>/.test(h), "shared modules load first, in order");
ok(/const g=await TR\.word\(word\)/.test(h), "index dictGet uses TR.word");

// ---------- ② 跑起来 ----------
function env(fetchImpl) {
  const store = new Map(), calls = [], beacons = [], events = [];
  function Audio(src) { this.src = src || ""; this.paused = true; this.playbackRate = 1; this.currentTime = 0; this.readyState = 4; this.L = {}; }
  Audio.prototype.play = function () { this.paused = false; return Promise.resolve(); };
  Audio.prototype.pause = function () { this.paused = true; (this.L.pause || []).forEach(f => f()); };
  Audio.prototype.addEventListener = function (k, f) { (this.L[k] = this.L[k] || []).push(f); };
  Audio.prototype.removeEventListener = function (k, f) { this.L[k] = (this.L[k] || []).filter(x => x !== f); };
  const win = {
    console: Object.assign({}, console, { table() {} }), JSON, Math, Promise, Date, Set, Map, WeakMap, String, Array, Object, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, encodeURIComponent, Blob,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { if (k === "full") throw new Error("QuotaExceeded"); store.set(k, String(v)); } },
    fetch: async (u, o) => { calls.push({ u, o }); return fetchImpl(u, o, calls.length); },
    navigator: { sendBeacon: (u, b) => { beacons.push(u); return true; } },
    document: { querySelectorAll: () => [], dispatchEvent: e => events.push(e.type) }, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    addEventListener: (k, f) => { (win.__L[k] = win.__L[k] || []).push(f); }, __L: {}, Audio,
  };
  win.window = win; win.toast = m => (win.__tips = win.__tips || []).push(m);
  const ctx = vm.createContext(win);
  for (const f of ["util.js", "ai.js", "tr.js", "cloud.js", "media.js"]) vm.runInContext(W(f), ctx);
  return { ctx, calls, beacons, events, store };
}
const res = (j, st) => ({ ok: (st || 200) < 400, status: st || 200, json: async () => j });
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // U
  {
    const { ctx, store } = env(async () => res({}));
    const U = ctx.U;
    ok(U.esc('<a href="x">&') === "&lt;a href=&quot;x&quot;&gt;&amp;", "esc");
    ok(U.LS("a", { x: 1 }) === true && U.LG("a", 0).x === 1 && U.LG("nope", 7) === 7, "LG / LS");
    ok(U.LS("full", 1) === false && U.logs("store").length === 1, "LS full → false + logged");
    U.tip("hi"); ok(ctx.__tips[0] === "hi", "tip → toast");
  }
  // AI
  {
    const { ctx, calls, events } = env(async (u, o, n) => {
      const b = JSON.parse(o.body);
      if (b.task === "a") return res({ ok: true, x: 1 });
      if (b.task === "noai") return res({ ok: false, error: "noai" });
      if (b.task === "quota") return res({ ok: false, error: "4006: you have used up your daily free allocation of 10,000 neurons" }, 502);
      throw new TypeError("Failed to fetch");
    });
    const A = ctx.AI;
    const j = await A.ask("a", { t: 1 });
    ok(j.ok && j.x === 1 && JSON.parse(calls[0].o.body).task === "a" && JSON.parse(calls[0].o.body).t === 1, "ask posts {task, ...body}");
    ok(events.includes("ai-used"), "ai-used event");
    const n = await A.ask("noai"); ok(!n.ok && n.error === "noai" && /Workers AI/.test(n.msg), "noai msg " + n.msg);
    const q = await A.ask("quota"); ok(q.error === "quota" && /额度用完/.test(q.msg), "quota msg " + q.msg);
    const x = await A.ask("net", {}, { tip: true }); ok(x.error === "net" && /网络/.test(x.msg) && ctx.__tips.some(t => /网络/.test(t)), "net error tips");
    ok(A.msg({ ok: false, error: "whatever" }, "默认") === "默认", "msg fallback");
    ok(ctx.U.logs("ai").length === 4, "ai calls logged");
  }
  // TR
  {
    const { ctx, calls } = env(async u => {
      if (/mymemory/.test(u)) return res({ responseData: { translatedText: "备用" } });
      const q = decodeURIComponent(u.split("&q=")[1]);
      if (/dt=bd/.test(u)) return res([[["跑", q]], [["verb", ["跑", "运行"]], ["noun", ["跑步"]]]]);
      if (q.includes("BAD")) return res([[["一行"]]]); // 行数对不上
      return res([q.split("\n").map((l, i, a) => ["中" + l + (i < a.length - 1 ? "\n" : ""), l])]);
    });
    const T = ctx.TR;
    const L = await T.lines(["a", "", "b"]); ok(L.join("|") === "中a||中b" && calls.length === 1, "lines batched " + L);
    const L2 = await T.lines(["a", "c"]); ok(L2.join("|") === "中a|中c" && calls.length === 2, "lines cached a, fetched c only");
    const L3 = await T.lines(["BAD x", "y"], { ai: false }); ok(L3.length === 2 && L3[1] === "中y", "mismatch → line by line " + L3);
    ok((await T.text("Hello.")) === "中Hello.", "text");
    const w = await T.word("Run"); ok(w.zh.join() === "跑,运行,跑步" && w.pos[0].p === "verb" && w.pos[0].w.join() === "跑,运行", "word " + JSON.stringify(w));
    ok(/sl=de/.test((await (async () => { await T.lines(["Hallo"], { sl: "de" }); return calls[calls.length - 1].u; })())), "sl passed");
  }
  // CLOUD
  {
    let mode = "ok";
    const { ctx, calls, beacons } = env(async (u, o) => {
      if (!o || !o.method) return res({ ok: true, items: { a: { v: 1, at: 5 } } });
      if (mode === "down") throw new TypeError("Failed to fetch");
      if (mode === "500") return res({ ok: false }, 500);
      if (mode === "400") return res({ ok: false }, 400);
      return res({ ok: true });
    });
    const C = ctx.CLOUD.chan("t");
    ok(ctx.CLOUD.chan("t") === C, "same channel");
    C.put("x", 1, 10); C.put("y", 2, 11); C.del("z", 12);
    await wait(1600);
    const p = calls.find(c => c.o && c.o.method === "POST"); const b = p && JSON.parse(p.o.body);
    ok(p && p.u === "/api/mine" && b.k === "t" && b.changes.x.v === 1 && b.changes.y.at === 11 && b.changes.z.del === 1, "batched post " + JSON.stringify(b));
    mode = "down"; C.put("x", 3, 20); ok((await C.flush()) === false && C.pending() === 1, "network down → requeued");
    mode = "500"; ok((await C.flush()) === false && C.pending() === 1, "5xx → requeued");
    mode = "400"; ok((await C.flush()) === false && C.pending() === 0, "4xx → dropped");
    mode = "down"; C.put("w", 1, 30); ctx.__L.pagehide.forEach(f => f()); ok(beacons[0] === "/api/mine" && C.pending() === 0, "pagehide → sendBeacon");
    mode = "ok";
    const it = await C.pull(); ok(it && it.a.v === 1, "pull items");
    ok((await C.pull()) === null, "pull throttled");
    ok((await C.pull({ force: true })).a.at === 5, "pull force");
    const E = ctx.CLOUD.chan("ext"); await E.send({ "marks|go": { v: "known", at: 1 } });
    const pe = calls.filter(c => c.u === "/api/ext" && c.o && c.o.method === "POST").pop(); ok(pe && !JSON.parse(pe.o.body).k && JSON.parse(pe.o.body).changes["marks|go"].v === "known", "ext channel posts {changes}");
    const n0 = calls.length; const [g1, g2] = await Promise.all([E.get(), E.get()]); ok(g1 === g2 && calls.length === n0 + 1, "get shared");
  }
  // MEDIA
  {
    const { ctx } = env(async () => res({}));
    const M = ctx.MEDIA, a = new ctx.Audio("x.mp3"), b = M.reg(new ctx.Audio("y.mp3"));
    b.paused = false; let ended = 0, cut = 0;
    M.seg(a, 2, 3, { rate: 0.75, end: () => ended++, cut: () => cut++ });
    await wait(5);
    ok(a.currentTime === 2 && a.playbackRate === 0.75 && !a.paused, "seg seeks + rate");
    a.currentTime = 3.01; await wait(80);
    ok(ended === 1 && a.paused && a.playbackRate === 1, "seg stops at end, restores rate");
    M.seg(a, 0, 5, { end: () => ended++, cut: () => cut++ }); await wait(5); a.pause(); await wait(5);
    ok(cut === 1 && ended === 1, "paused mid-seg → cut");
    M.solo(a); ok(b.paused, "solo pauses registered players");
    const one = M.play("blob:1", { rate: 1.5 }); await wait(5); ok(one.src === "blob:1" && one.playbackRate === 1.5 && !one.paused, "play one-shot");
    const two = M.play("blob:2"); ok(two === one && two.src === "blob:2", "one shared player");
  }
  // WORD.add（word.js 用 index.html 的 quickAdd）
  {
    const { ctx } = env(async () => res({}));
    const added = [], marks = [];
    ctx.quickAdd = async (w, s) => { if (w === "boom") throw new Error("x"); added.push([w, s]); return w !== "dup"; };
    ctx.document = Object.assign(ctx.document, { head: { append() {} }, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, append() {} }), body: { append() {} }, addEventListener() {}, readyState: "complete", getElementById: () => null });
    ctx.__vs = { ready: () => true, markOf: () => "", setMark: (w, m) => marks.push(w + ":" + m), load: () => Promise.resolve() };
    ctx.words = [];
    vm.runInContext(W("word.js"), ctx);
    ok((await ctx.WORD.add("Hello", { sent: "Hello there" })) === true && added[0].join() === "Hello,Hello there" && marks[0] === "hello:learn" && ctx.__tips.pop() === "已加入生词本：Hello", "add → quickAdd + learn mark + tip");
    ok((await ctx.WORD.add("dup", { silent: true, learn: false })) === false && marks.length === 1, "silent / no mark");
    ok((await ctx.WORD.add("boom")) === null && /加入失败/.test(ctx.__tips.pop()), "failure → null");
  }
  console.log(fail ? fail + " FAILED" : "t66 shared modules: all ok"); process.exit(fail ? 1 : 0);
})();
