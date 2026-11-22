// ❌ 错题本（errbook.js）的收题 / 去重 / 复习间隔；🎓 模考（exam.js）的分段、估分、判分；🎯 逐句精听（listen.js）的对时间
// 在 Node 的 vm 里用假的 window / document / localStorage 跑页面脚本（不联网，不碰线上数据）
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
function env() {
  const store = new Map(), posts = [];
  const el = () => ({ style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, addEventListener() {}, append() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null, getClientRects: () => [], pause() {}, play: () => Promise.resolve() });
  const document = { readyState: "complete", head: el(), body: el(), documentElement: el(), createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const win = { document, localStorage, navigator: {}, addEventListener() {}, dispatchEvent() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: async (u, o) => { posts.push([u, o && o.body]); return { ok: true, json: async () => ({ ok: true, items: {} }) }; }, Event: class {}, MutationObserver: class { observe() {} }, Blob: class {}, Audio: class { constructor() { return el(); } } };
  win.window = win; Object.assign(win, { console, Math, Date, JSON, Object, Array, String, Number, Set, Map, RegExp, Uint16Array, Promise, isFinite, encodeURIComponent });
  const ctx = vm.createContext(win); return { ctx, store, posts };
}
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

// ---- 错题本 ----
{
  const { ctx, store, posts } = env();
  vm.runInContext(W("errbook.js"), ctx);
  const E = ctx.ERR;
  let n = E.add([{ src: "write", kind: "fix", ctx: "He go to school.", wrong: "go", right: "goes", why: "三单" }, { src: "read", kind: "mcq", q: "Why?", opts: ["a", "b", "c"], ans: 1, wrong: "a" }, { src: "x", kind: "fix" }], true);
  ok(n === 2, "add 2 (one invalid) " + n);
  ok(E.add([{ src: "write", kind: "fix", ctx: "He go to school.", wrong: "go", right: "goes" }], true) === 0, "dedup");
  ok(E.due().length === 2, "both due now");
  const id = E.all().find(x => x.kind === "fix").id;
  // 答对 → 1 天后；再答对 → 3 天后（复习间隔）
  const o = JSON.parse(store.get("err:items"));
  ok(o[id].lv === 0 && o[id].src === "write", "stored");
  ok(posts.length === 0, "sync debounced (setTimeout stubbed)");
  // 直接调内部 grade：用 errShow 之外的公开接口没有 grade，这里通过再收一次 + 删除测
  E.remove(id); ok(!E.all().some(x => x.id === id), "removed");
  ok(JSON.parse(store.get("err:items"))[id].del === 1, "delete marker kept for sync");
  ok(E.add([{ src: "write", kind: "fix", ctx: "He go to school.", wrong: "go", right: "goes" }], true) === 1, "re-add after delete");
  ok(E.add([{ src: "listen", kind: "say", ctx: "Hello there.", right: "Hello there." }], true) === 1 && E.all().some(x => x.src === "listen"), "listen source");
}
// ---- 模考 ----
{
  const { ctx } = env();
  vm.runInContext(W("exam.js"), ctx);
  const B = ctx.examBand;
  ok(B("listening", 10, 10).band === 9 && B("listening", 0, 10).band === 0, "band ends");
  ok(B("listening", 7, 10).raw === 28 && B("listening", 7, 10).band === 6.5, "listening 7/10 → 28 → 6.5 " + JSON.stringify(B("listening", 7, 10)));
  ok(B("reading", 10, 13).raw === 31 && B("reading", 10, 13).band === 7, "reading 10/13 → 31 → 7 " + JSON.stringify(B("reading", 10, 13)));
  ok(B("reading", 8, 13).band === 6, "reading 8/13 → 25 → 6 " + JSON.stringify(B("reading", 8, 13)));
  const para = i => "Paragraph " + i + " " + "word ".repeat(60).trim() + ".";
  const S = ctx.examSections(Array.from({ length: 12 }, (_, i) => para(i)).join("\n\n"));
  ok(S.length >= 4 && S.length <= 8 && S[0].L === "A" && S.every((s, i) => s.L === "ABCDEFGH"[i]), "sections " + S.length);
  ok(ctx.examSections("short.").length < 4, "too short");
  const R = ctx.examRight;
  ok(R({ type: "gap", a: "canopy cover" }, "Canopy  cover") && R({ type: "gap", a: "the council" }, "council") && !R({ type: "gap", a: "Oslo" }, "Osl"), "gap check");
  ok(R({ type: "gap", a: "twenty seventeen" }, "2017") && R({ type: "gap", a: "nine am" }, "9am") && R({ type: "gap", a: "fifteenth of March" }, "15th March") && R({ type: "gap", a: "ten thousand" }, "10,000") && R({ type: "gap", a: "$30" }, "thirty dollars") && !R({ type: "gap", a: "nineteen" }, "9") && !R({ type: "gap", a: "2017" }, "2018"), "numbers as words");
  ok(R({ type: "tfng", a: "NOT GIVEN" }, "NOT GIVEN") && !R({ type: "tfng", a: "TRUE" }, "FALSE") && R({ type: "mcq", a: 2 }, 2) && !R({ type: "mcq", a: 2 }, 0), "tfng / mcq");
}
// ---- 逐句精听对时间 ----
{
  const { ctx } = env();
  vm.runInContext(W("listen.js"), ctx);
  const sents = ctx.smeSplitSents([{ who: "Neil", t: "Hello. I'm Neil. Today we talk about sleep!" }, { who: "Beth", t: "And I'm Beth. Sleep is important, isn't it?" }]);
  ok(sents.length === 4 && sents[0].t === "Hello. I'm Neil." && sents[1].t === "Today we talk about sleep!" && sents[2].who === "Beth", "split " + JSON.stringify(sents.map(s => s.t)));
  // 假的 Whisper 结果：每个词 0.4 秒，中间漏了一个词、多了一个词
  const words = "hello i'm neil today we talk about sleep and uh i'm beth sleep is important isn't it".split(" ").filter(w => w !== "about");
  const Wt = words.map((w, i) => [w, i * 0.4 + 2, i * 0.4 + 2.35]);
  const T = ctx.smeAlignTimes(sents, Wt);
  ok(Math.abs(T[0].s - 1.85) < 0.01, "first start " + T[0].s);
  ok(Math.abs(T[1].s - (3 * 0.4 + 2 - 0.15)) < 0.01, "second start " + T[1].s);
  ok(T[2].s > T[1].s && T[3].s > T[2].s && T[1].e <= T[2].s + 0.15 && T[3].e > T[3].s, "monotonic " + JSON.stringify(T.map(x => [x.s, x.e])));
  const T2 = ctx.smeAlignTimes(sents.concat([{ who: "", t: "Zzz qqq.", li: 2 }, { who: "", t: "It is.", li: 2 }]), Wt.concat([["it", 9, 9.3], ["is", 9.4, 9.6]]));
  ok(T2[4].s > T2[3].s && T2[4].s < T2[5].s, "unmatched sentence interpolated " + JSON.stringify(T2.map(x => x.s)));
  // 每个词的时间：对上的词有时间，漏掉的（about）是 null
  ok(T[0].w.length === 3 && T[0].w.every(v => typeof v === "number") && T[1].w.length === 5 && T[1].w[3] === null && T[1].w[4] != null, "word times " + JSON.stringify(T.slice(0, 2).map(x => x.w)));
  const H = ctx.smeWordsHtml("Hello, I'm Neil — well-known!", [1, 1.5, 2, 2.4, 2.6], w => (w === "Neil" ? "lr" : ""));
  ok(/data-w="Hello" data-t="1">Hello,<\/i>/.test(H) && /data-w="I'm" data-t="1.5"/.test(H) && /class="wd lr" data-w="Neil"/.test(H) && /data-w="well-known" data-t="2.4">well-known!/.test(H) && / — /.test(H), "words html " + H);
  // 🎵 文稿跟着语音：现在放到第几句
  const I = ctx.smeIdxAt;
  ok(I(T, 0) === -1 && I(T, T[0].s) === 0 && I(T, T[1].s + 0.1) === 1 && I(T, T[3].s + 100) === 3, "idxAt " + [I(T, 0), I(T, T[0].s), I(T, T[1].s + 0.1), I(T, 999)]);
}
console.log(fail ? fail + " FAILED" : "t50 errbook + exam + 精听: all passed");
process.exit(fail ? 1 : 0);
