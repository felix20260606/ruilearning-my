// 🔙 页面历史（web/nav.js）：模块 NAV.reg 登记 get/set，换页 NAV.mark() → pushState；后退 popstate → set 恢复；NAV.back() 有上一页就 history.back()
// 用假的 history / window 跑，不联网
const fs = require("fs"), path = require("path"), vm = require("vm");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const W = f => fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8");
const timers = []; const fakeTimeout = (f, ms) => { timers.push(f); return timers.length; };
const flush = () => { while (timers.length) timers.shift()(); };
const stack = [{ state: null, url: "https://x.test/" }]; let idx = 0; const L = {};
const history = {
  get state() { return stack[idx].state; }, get length() { return stack.length; },
  pushState(s, _, u) { stack.splice(idx + 1); stack.push({ state: JSON.parse(JSON.stringify(s)), url: u }); idx++; },
  replaceState(s, _, u) { stack[idx] = { state: JSON.parse(JSON.stringify(s)), url: u }; },
  back() { if (idx > 0) { idx--; L.popstate({ state: stack[idx].state }); } }, forward() { if (idx < stack.length - 1) { idx++; L.popstate({ state: stack[idx].state }); } },
};
const win = { history, location: { href: "https://x.test/" }, setTimeout: fakeTimeout, clearTimeout: () => {}, addEventListener: (e, f) => { L[e] = f; }, console, JSON, Object, Math };
win.window = win; vm.createContext(win); vm.runInContext(W("nav.js"), win);
const NAV = win.NAV;
let page = { tab: "daily" }, view = null;
NAV.reg("tab", () => page, s => { page = s; });
NAV.reg("speak", () => (page.tab === "speak" ? { v: view } : undefined), s => { view = s.v; });
flush();
ok(stack.length === 1 && history.state.nav.s.tab.tab === "daily", "first record replaces (no extra entry)");
page = { tab: "speak" }; NAV.mark(); flush();
view = "d1"; NAV.mark(); NAV.mark(); flush();
ok(stack.length === 3 && history.state.nav.s.speak.v === "d1", "two page changes → two entries, repeated marks merged " + stack.length);
NAV.mark(); flush(); ok(stack.length === 3, "no change → no entry");
// 页面里的「← 返回」：有上一页 → history.back()，模块被 set 回去
let fb = 0; NAV.back(() => fb++); flush();
ok(view === null && page.tab === "speak" && fb === 0 && idx === 1, "in-page back goes to previous page");
history.back(); flush(); ok(page.tab === "daily", "browser back to daily");
NAV.back(() => fb++); ok(fb === 1, "no previous page → fallback");
history.forward(); history.forward(); flush(); ok(page.tab === "speak" && view === "d1", "forward restores");
// 恢复期间模块重画调 mark 不会多记
const n = stack.length; history.back(); NAV.mark(); flush(); ok(stack.length === n, "marks while restoring are ignored");
// 别人的 pushState（state 不是我们的）不处理
let before = JSON.stringify(page); L.popstate({ state: null }); ok(JSON.stringify(page) === before, "foreign popstate ignored");
// 接进各模块：index.html 的标签、口语 / 听力 / 练习课 / 阅读 / 写作 / 视频 / 背单词
const h = W("index.html");
ok(/<script src="util\.js\?v=\d+"><\/script>\s*<script src="nav\.js\?v=\d+"><\/script>\s*<script src="word\.js\?v=\d+"><\/script>/.test(h), "util.js + nav.js load before everything else");
ok(/NAV\.reg\('tab'/.test(h) && /NAV\.reg\('ielts'/.test(h) && /NAV\.reg\('life'/.test(h), "tabs registered");
for (const [f, k] of [["speak.js", "speak"], ["listen.js", "sme"], ["drill.js", "drill"], ["read.js", "read"], ["write.js", "write"], ["watch.js", "video"], ["pump.js", "pump"]]) {
  const s = W(f); ok(s.includes('NAV.reg("' + k + '"') && /NAV\.mark\(\)/.test(s) && /NAV\.back\(/.test(s), f + " wired (reg + mark + back button)");
}
ok(/history\.replaceState\(history\.state/.test(W("read.js")), "read.js keeps history state when changing #article");
console.log(fail ? fail + " FAILED" : "t61 nav: all ok"); process.exit(fail ? 1 : 0);
