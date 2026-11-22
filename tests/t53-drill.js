// 🧩 练习课（drill.js）的拆节 / 出题 / 挖空，🌐 学习语言（lang.js）的切换和判分（英语、德语）
// 在 Node 的 vm 里用假的 window / document / localStorage 跑页面脚本（不联网，不碰线上数据）
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
function env() {
  const store = new Map(), events = [];
  const el = () => ({ style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false }, addEventListener() {}, append() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null, pause() {}, play: () => Promise.resolve() });
  const document = { readyState: "complete", head: el(), body: el(), documentElement: Object.assign(el(), { setAttribute(k, v) { this["_" + k] = v; } }), createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const win = { document, localStorage, navigator: {}, addEventListener() {}, dispatchEvent: e => events.push(e), setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    fetch: async () => ({ json: async () => ({ ok: false }) }), CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, Audio: class { constructor() { return el(); } } };
  win.window = win; Object.assign(win, { console, Math, Date, JSON, Object, Array, String, Number, Set, Map, RegExp, Promise, isFinite, encodeURIComponent });
  const ctx = vm.createContext(win); return { ctx, store, events };
}
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

// ---- 🌐 lang.js ----
(async () => {
{
  const { ctx, store, events } = env(); ctx.__langNoReload = true; // 真的切换会整页重新加载
  vm.runInContext(W("lang.js"), ctx);
  const L = ctx.LANG;
  ok(ctx.document.documentElement["_data-lang"] === "en", "html data-lang");
  ok(L.cur() === "en", "default en");
  ok(L.list().map(x => x.code).join() === "en,de", "en + de listed");
  // 英语：不分大小写、忽略标点
  ok(L.check("Embarrassed", "embarrassed").ok, "en case-insensitive");
  ok(L.check(" embarrassed. ", "embarrassed").ok, "en punctuation");
  ok(!L.check("embarased", "embarrassed").ok, "en typo wrong");
  ok(!L.check("", "x").ok, "empty wrong");
  ok(L.check("embarrased", "embarrassed").note === "差一个字母", "near miss note");
  ok(L.words("Don't stop—it's well-known.").join("|") === "Don't|stop|it's|well-known", "words en " + L.words("Don't stop—it's well-known.").join("|"));
  // 德语：变音字母可以用 ae/oe/ue/ss，名词小写算对但提醒
  await L.set("de");
  ok(L.cur() === "de" && store.get("lang") === "de", "switch stored per user key");
  ok(events.some(e => e.type === "lang-change" && e.detail === "de"), "lang-change event");
  ok(L.check("Mädchen", "Mädchen").ok && L.check("Maedchen", "Mädchen").ok, "de umlaut alt");
  ok(L.check("Maedchen", "Mädchen").note.indexOf("Mädchen") >= 0, "de alt note");
  ok(L.check("strasse", "Straße").ok, "de ß → ss");
  const c = L.check("mädchen", "Mädchen"); ok(c.ok && /大小写/.test(c.note), "de case note");
  ok(!L.check("Madchen", "Mädchen").ok, "de dropped umlaut is wrong (near miss)");
  ok(L.words("Das Mädchen heißt Jürgen.").join("|") === "Das|Mädchen|heißt|Jürgen", "words de");
  await L.set("xx"); ok(L.cur() === "de", "unknown lang ignored");
  // 下次打开记得上次选的
  const e2 = env(); e2.store.set("lang", "de"); vm.runInContext(W("lang.js"), e2.ctx); ok(e2.ctx.LANG.cur() === "de", "remembered");
}

// ---- 🧩 drill.js ----
{
  const { ctx } = env();
  vm.runInContext(W("lang.js"), ctx);
  vm.runInContext(W("drill.js"), ctx);
  const D = ctx.DRILL;
  ok(typeof ctx.drillShow === "function" && D, "exports");
  // 拆节：约 8 句一节，平均分，首尾相接
  const chk = n => { const L = D.lessons(n); let p = 0; for (const r of L) { if (r[0] !== p || r[1] <= r[0]) return false; p = r[1]; } return p === n; };
  ok([1, 5, 8, 12, 57, 100].every(chk), "lessons cover all");
  ok(D.lessons(57).length === 7 && D.lessons(5).length === 1, "lesson count " + D.lessons(57).length);
  ok(Math.max(...D.lessons(57).map(r => r[1] - r[0])) <= 9, "≈8 per lesson");
  // 拆句（listen.js 没加载时的备用）
  const S = D.split([{ who: "Neil", t: "Hi Becca. How are you today?" }, { who: "Becca", t: "I'm fine, thanks!" }]);
  ok(S.length === 3 && S[0].li === 0 && S[2].who === "Becca", "split " + S.length);
  // 挖空：优先本期重点词、不挖小词
  const r = D.rng(1), stop = ctx.LANG.stop("en");
  const g = D.blankOf("I felt really embarrassed when I fell over.", ["embarrassed"], stop, r);
  ok(g && g.word === "embarrassed" && g.shown === "I felt really \u0000 when I fell over.", "blank vocab word");
  const g2 = D.blankOf("It is what it is.", [], stop, r); ok(g2 === null, "no content word → null");
  const g3 = D.blankOf("The children played outside yesterday.", [], stop, r); ok(g3 && ["children", "played", "outside", "yesterday"].includes(g3.word) && g3.word.length >= 8, "longest-ish word " + (g3 && g3.word));
  ok(D.blankOf("Das Mädchen spielt draußen.", [], ctx.LANG.stop("de"), r).word.length >= 6, "de blank works with umlauts");
  // 出一节的卡片
  const lines = Array.from({ length: 20 }, (_, i) => ({ who: i % 2 ? "Becca" : "Neil", t: "This is sentence number " + i + " about embarrassing moments in public places." }));
  const sents = D.split(lines).map(x => Object.assign(x, { zh: "中文", s: x.li * 3, e: x.li * 3 + 2.5 }));
  sents[3].t = "I went completely red in front of everyone.";
  const M = { id: "real-easy-english/261120", title: "T", sents, vocab: [{ w: "embarrassing", def: "d", zh: "", ex: "" }, { w: "go red", def: "d", zh: "", ex: "" }] };
  const b0 = D.build(M, 0), b1 = D.build(M, 1);
  ok(b0.acts[0].name.indexOf("重点词") >= 0 && b0.cards[0].k === "voc", "lesson 1 starts with vocab");
  ok(!b1.cards.some(c => c.k === "voc"), "later lessons no vocab");
  ok(b0.cards[b0.cards.length - 1].k === "end", "ends with summary");
  const picks = b0.cards.filter(c => c.k === "pick"), gaps = b0.cards.filter(c => c.k === "gap"), says = b0.cards.filter(c => c.k === "say");
  ok(says.length === b0.range[1] - b0.range[0], "one say card per sentence");
  ok(picks.length >= 1 && picks.every(c => c.opts[c.ans] === M.sents[c.s].t && new Set(c.opts).size === c.opts.length && c.opts.length === 4), "pick answer + 4 distinct options");
  ok(gaps.length >= 1 && gaps.every(c => M.sents[c.s].t.replace(c.word, "\u0000") === c.shown || c.shown.indexOf("\u0000") >= 0), "gap shown has blank");
  ok(gaps.every(c => c.s >= b0.range[0] && c.s < b0.range[1]) && picks.every(c => c.s >= b0.range[0] && c.s < b0.range[1]), "questions from this lesson");
  ok(JSON.stringify(D.build(M, 0).cards) === JSON.stringify(b0.cards), "same lesson → same questions");
  ok(D.PROV.en && !D.PROV.de, "en source; de not yet");
  // 句子够多时，选择题和填空不用同一句（选完再填就是送答案）
  const lines2 = Array.from({ length: 16 }, (_, i) => ({ who: "A", t: "Number " + i + " people traveled across beautiful mountains yesterday." }));
  const M2 = { id: "x", title: "T", sents: D.split(lines2).map(x => Object.assign(x, { zh: "", s: 0, e: 1 })), vocab: [] };
  const b2 = D.build(M2, 0), ps = b2.cards.filter(c => c.k === "pick").map(c => c.s), gs = b2.cards.filter(c => c.k === "gap").map(c => c.s);
  ok(ps.length === 4 && gs.length === 4 && !gs.some(s => ps.includes(s)), "pick and gap use different sentences " + ps + " / " + gs);
}

// ---- index.html 接好了 ----
{
  const h = W("index.html");
  ok(/<script src="lang\.js\?v=\d+"><\/script>[\s\S]*<script src="listen\.js[^"]*"><\/script>\s*<script src="drill\.js\?v=\d+">/.test(h), "script order: lang before, drill after listen");
  ok(/\|lang\|drill:\[\\w:\]\+\|/.test(h), "per-user keys");
  ok(/data-mode="drill"/.test(h) && /<div id="drill">/.test(h) && /\['drill','🧩 练习课'\],\['sme'/.test(h), "drill tab first under 听");
}
console.log(fail ? fail + " FAILED" : "t53 drill: all ok"); process.exit(fail ? 1 : 0);
})();
