// 第二批全站共用：📅 日期（U.day 等，全站按 UTC+8）、⌨️ 快捷键（keys.js 的 KEYS）、✅ 弹窗（U.ask / U.input 代替 confirm / prompt）、剩下的读数据走 U.json / CLOUD.media
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const PAGES = fs.readdirSync(path.join(__dirname, "..", "web")).filter(f => /\.js$/.test(f) && !/^(_worker|util|ai|tr|cloud|media|keys|tts|rec|nav|speak-data|sw)\.js$/.test(f));

// ---------- 源码 ----------
for (const f of PAGES) {
  const s = W(f);
  ok(!/[^.\w]confirm\(|[^.\w]prompt\(/.test(s.replace(/BM_SRC = "[^\n]*/, "")), f + ": 弹窗用 U.ask / U.input");
  ok(!/getTimezoneOffset|8 \* 3600e3\)\.toISOString|toDateString\(\) ===/.test(s), f + ": 日期用 U.day");
  ok(f === "word.js" || !/document\.addEventListener\("keydown"/.test(s), f + ": 快捷键用 KEYS.on");
  ok(!/fetch\("\/api\/[^"]*"[^)]*\)\.then\(r => r\.(ok \? r\.)?json\(\)/.test(s), f + ": 读后台用 U.json / CLOUD");
  ok(!/fetch\("\/api\/media\?/.test(s), f + ": 读配图 / 原声用 CLOUD.media");
}
const h = W("index.html");
ok(/<script src="media\.js\?v=\w+"><\/script>\s*<script src="keys\.js\?v=\w+"><\/script>/.test(h), "keys.js loaded after media.js");
ok(/const ymdLocal=\(\)=>U\.day\(\)/.test(h), "vocab entry dates use U.day");
ok(!/[^.\w]confirm\(|[^.\w]prompt\(|[^.\w]alert\("没/.test(h.slice(h.indexOf("<script src=\"util.js"))), "index.html after util.js: no confirm / prompt");

// ---------- 📅 日期 ----------
const ctx = vm.createContext({ console, JSON, Math, Promise, Date, String, Array, Object, setTimeout, clearTimeout });
ctx.window = ctx; vm.runInContext(W("util.js"), ctx); const U = ctx.U;
ok(U.day(Date.parse("2026-11-22T15:59:00Z")) === "2026-11-22" && U.day(Date.parse("2026-11-22T16:00:00Z")) === "2026-11-23", "day switches at 00:00 UTC+8");
ok(U.dayAgo("2026-03-01", 1) === "2026-02-28" && U.dayAgo("2026-12-31", -1) === "2027-01-01", "dayAgo across month / year");
ok(U.daysBetween("2026-11-20", "2026-11-22") === 2 && U.daysBetween("2026-11-22", "2026-11-20") === -2, "daysBetween");
ok(new Date(U.dayStart(Date.parse("2026-11-22T20:00:00Z"))).toISOString() === "2026-11-22T16:00:00.000Z", "dayStart = 00:00 UTC+8");
const S = { "2026-11-22": 1, "2026-11-21": 1, "2026-11-19": 1 };
ok(U.streak(k => S[k], "2026-11-22") === 2 && U.streak(k => S[k], "2026-11-23") === 2 && U.streak(k => S[k], "2026-11-24") === 0, "streak: today not done yet doesn't break it");
{ const st = require(path.join(__dirname, "..", "web", "stats.js")); ok(st.dayKey(Date.parse("2026-11-22T16:30:00Z")) === "2026-11-23", "stats.js (node, no U) uses the same UTC+8 day"); }

// ---------- ⌨️ 快捷键 ----------
{
  const L = {}, sel = new Set();
  const document = { addEventListener: (k, f) => { (L[k] = L[k] || []).push(f); }, querySelector: q => (q.split(",").some(x => sel.has(x.trim())) ? {} : null) };
  const kc = vm.createContext({ document, console, JSON, Math, String, Object, Array }); kc.window = kc;
  vm.runInContext(W("keys.js"), kc);
  const K = kc.KEYS, got = [];
  let aOn = true, bOn = true;
  K.on("a", { when: () => aOn }, k => { got.push("a:" + k); return k !== "x"; });
  K.on("b", { when: () => bOn, prio: 5 }, k => { got.push("b:" + k); return k === "esc"; });
  const press = (key, o) => { const e = Object.assign({ key, target: { tagName: "BODY" }, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} }, o || {}); L.keydown.forEach(f => f(e)); return e; };
  let e = press("Escape"); ok(got.pop() === "b:esc" && e.prevented, "higher prio page gets the key; esc normalised");
  bOn = false; e = press(" "); ok(got.pop() === "a:space" && e.prevented, "space normalised, handled → preventDefault");
  e = press("ArrowLeft"); ok(got.pop() === "a:left", "arrow normalised");
  e = press("x"); ok(got.pop() === "a:x" && !e.prevented, "not handled → no preventDefault");
  const n = got.length;
  press("a", { target: { tagName: "INPUT" } }); press("a", { ctrlKey: true }); press("a", { isComposing: true });
  sel.add("#wd-pop.on"); press("a"); sel.clear(); sel.add("#u-ask.on"); press("a"); sel.clear();
  aOn = false; press("a");
  ok(got.length === n, "typing / modifier / IME / popup / dialog / page hidden → nothing fires");
}

// ---------- ✅ 弹窗 ----------
{
  const els = [];
  const mk = tag => { const el = { tagName: tag.toUpperCase(), children: [], dataset: {}, attrs: {}, cls: new Set(), L: {}, value: "", setAttribute(k, v) { this.attrs[k] = v; }, append(c) { this.children.push(c); }, addEventListener(k, f) { (this.L[k] = this.L[k] || []).push(f); },
    classList: null, focus() {}, select() {}, set innerHTML(h) { this._h = h; const m = h.match(/<input[^>]*value="([^"]*)"/); this._in = m ? { value: m[1].replace(/&quot;/g, '"'), focus() {}, select() {} } : null; }, get innerHTML() { return this._h || ""; },
    querySelector(q) { if (q === "input") return this._in; if (/data-r="1"/.test(q)) return { focus() {} }; return null; } };
    el.classList = { add: c => el.cls.add(c), remove: c => el.cls.delete(c), contains: c => el.cls.has(c) }; els.push(el); return el; };
  const DL = {};
  const document = { head: { append() {} }, body: { append() {} }, createElement: mk, addEventListener: (k, f, cap) => { (DL[k] = DL[k] || []).push(f); }, activeElement: null };
  const c = vm.createContext({ document, console, JSON, Math, Promise, String, Object, Array, setTimeout, clearTimeout }); c.window = c;
  vm.runInContext(W("util.js"), c);
  (async () => {
    const box = () => els.find(x => x.attrs.role === "dialog");
    const key = k => DL.keydown.forEach(f => f({ key: k, target: { tagName: "BODY" }, preventDefault() {}, stopPropagation() {} }));
    let p = c.U.ask("删除？", { ok: "删除", danger: true });
    ok(box().cls.has("on") && /删除？/.test(box().innerHTML) && /dg/.test(box().innerHTML), "ask shows themed dialog with danger button");
    key("Escape"); ok((await p) === false && !box().cls.has("on"), "Esc → false, closed");
    p = c.U.ask("好吗？"); key("Enter"); ok((await p) === true, "Enter → true");
    p = c.U.input("名字？", "Lily"); ok(box()._in.value === "Lily", "input default"); box()._in.value = "Mom"; key("Enter"); ok((await p) === "Mom", "input → typed text");
    p = c.U.input("名字？"); key("Escape"); ok((await p) === null, "input cancel → null");
    p = c.U.ask("一"); const p2 = c.U.ask("二"); ok((await p) === false, "new dialog cancels the old one"); key("Enter"); ok((await p2) === true, "second dialog works");
    console.log(fail ? fail + " FAILED" : "t67 day + keys + ask: all ok"); process.exit(fail ? 1 : 0);
  })();
}
