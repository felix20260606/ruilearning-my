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
  ok(D.PROV.en && D.PROV.de && D.PROV.en.dialog && !D.PROV.de.dialog, "en + de sources");
  // 英语栏目和 📻 听力节目一样（新闻英语没文稿不放）；「🆕 本周更新」= 一直在更新的栏目最近 7 天的合起来
  const ks = D.PROV.en.series.map(x => x[0]);
  ok(["new", "bn1", "bn3", "bn5", "bn6", "nup", "nsw", "npm", "vst", "vwd", "vgr", "vnw", "drama", "eau", "ree", "tews", "sme"].every(k => ks.includes(k)) && !ks.includes("news") && ks[0] === "new", "en series " + ks);
  ok(D.PROV.en.series.every(x => x[2]), "every series has a row");
  {
    const day = n => new Date(Date.now() - n * 864e5).toUTCString().slice(5, 16), asked = [];
    ctx.fetch = async u => { asked.push(u); const s = decodeURIComponent(u.split("s=")[1] || ""); return { json: async () => s === "nup" ? { ok: true, list: [{ id: "nup/a", t: "Up today", d: day(0) }, { id: "nup/b", t: "Up old", d: day(12) }] } : s === "ree" ? { ok: true, list: [{ id: "real-easy-english/x", t: "Ree", d: day(3) }] } : s === "bn1" ? { ok: false } : { ok: true, list: [] } }; };
    const L = await D.PROV.en.list("new");
    ok(L.map(x => x.id).join() === "nup/a,real-easy-english/x", "week list " + L.map(x => x.id));
    ok(/🗞 每日新闻$/.test(L[0].d) && /🐢 慢速对话$/.test(L[1].d), "week list labels " + L.map(x => x.d));
    ok(!asked.some(u => /s=(vst|vwd|vgr|vnw|drama|eau|news|new)\b/.test(u)), "week list skips VOA / story / news " + asked);
    ctx.fetch = async () => ({ json: async () => ({ ok: false }) });
    let e = ""; try { await D.PROV.en.list("new"); } catch (x) { e = x.message; } ok(e === "列表没拿到", "week list all failed → error");
    ctx.fetch = async () => ({ json: async () => ({ ok: false, error: "no transcript yet" }) });
    e = ""; try { await D.PROV.en.load("nup/a", () => {}); } catch (x) { e = x.message; } ok(/还没放文稿/.test(e), "npr no transcript message " + e);
  }
  // 新题型：排词成句、整句听写、看中文说、角色扮演（对话类）
  const Md = Object.assign({}, M, { dialog: true });
  const bd = D.build(Md, 0), kinds = bd.cards.map(c => c.k);
  ok(["voc", "say", "pick", "ord", "gap", "dict", "zh", "role", "end"].every(k => kinds.includes(k)), "all card kinds " + [...new Set(kinds)]);
  const seq = kinds.filter((k, i) => k !== kinds[i - 1]).join(); ok(seq === "voc,say,pick,ord,gap,dict,zh,role,end", "activity order " + seq);
  const od = bd.cards.find(c => c.k === "ord");
  ok(od.ch.join(" ") === Md.sents[od.s].t && od.ch.length <= 8 && od.sh.length === od.ch.length && od.sh.some((x, i) => x !== i), "ord chunks shuffled");
  const role = bd.cards.find(c => c.k === "role"); ok(role.who.length === 2 && role.list.length === bd.range[1] - bd.range[0], "role play both speakers");
  ok(!D.build(M, 0).cards.some(c => c.k === "role"), "no role play without dialog");
  ok(bd.cards.filter(c => c.k === "zh").every(c => Md.sents[c.s].zh && !Md.sents[c.s].zhAll), "zh cards only with own translation");
  // 拆块：太短不出、长句最多 8 块
  ok(D.chunksOf("Hi there you") === null && D.chunksOf("one two three four five six seven eight nine ten eleven twelve thirteen").length <= 8, "chunksOf");
  const sh = D.shufIdx(5, D.rng(3)); ok(sh.slice().sort().join() === "0,1,2,3,4" && sh.join() !== "0,1,2,3,4", "shufIdx");
  // 难度：简单 3 个选项、没有整句听写；难：更多填空和整句听写
  const e1 = D.build(Md, 1, 0, 1), e3 = D.build(Md, 1, 0, 3);
  ok(e1.cards.filter(c => c.k === "pick").every(c => c.opts.length === 3) && !e1.cards.some(c => c.k === "dict"), "easy: 3 options, no dictation");
  ok(e3.cards.filter(c => c.k === "dict").length === 2 && e3.cards.filter(c => c.k === "gap").length >= e1.cards.filter(c => c.k === "gap").length, "hard: 2 dictations, more gaps");
  // 换一套题：同一节、不同的题；同一套还是一样
  const v1 = D.build(M, 1, 1), v1b = D.build(M, 1, 1), v0 = D.build(M, 1);
  const qs = b => b.cards.filter(c => c.k === "pick" || c.k === "gap").map(c => c.k + c.s + (c.word || "")).join();
  ok(qs(v1) === qs(v1b) && qs(v1) !== qs(v0) && v1.v === 1, "variant changes questions, stays stable");
  ok(v1.cards.every(c => c.k === "end" || c.k === "voc" || (c.s == null ? c.list : c.s >= v1.range[0] && c.s < v1.range[1])), "variant stays in lesson");
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
