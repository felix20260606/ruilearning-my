// ⚡ 按需加载（web/lazy.js）：口语、入门、阅读、听力、练习课、考试、写作、语法点进去才加载；看不见时先等；依赖先加载；quiet 入口不加载
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const LAZY_MODS = ["speak", "basic", "read", "listen", "drill", "exam", "write", "grammar"];

// ---------- 源码 ----------
const h = W("index.html"), lz = W("lazy.js");
for (const m of LAZY_MODS) {
  ok(!new RegExp('<script src="' + m + '\\.js').test(h), m + ".js not loaded up front");
  ok(new RegExp(m + ': \\{ src: "' + m + '\\.js\\?v=[0-9a-f]{8}"').test(lz), m + " registered in lazy.js with a content-hash version");
}
ok(/<script src="keys\.js\?v=\w+"><\/script>\n<script src="lazy\.js\?v=\w+">/.test(h), "lazy.js loads early (stubs exist before tabs.js restores the last tab)");
ok(/if \(window\.basicShow && !window\.basicShow\.__lazy\) return;/.test(W("basic.js")) && /if \(window\.drillShow && !window\.drillShow\.__lazy\) return;/.test(W("drill.js")), "modules don't mistake the stub for themselves");
const css = W("index.css");
ok(/#view-speak,#view-basic\{display:none\}/.test(css) && /#reading,#sme,#drill,#grammar\{display:none\}/.test(css), "containers hidden before their CSS arrives");
ok(/addEventListener\("lazy-loaded"/.test(W("daily.js")), "daily redraws when drill / read arrive");

// ---------- 跑起来 ----------
function env() {
  const els = {}, L = {}, scripts = [];
  const mk = (id, vis) => (els[id] = { id, vis, isConnected: true, getClientRects() { return this.vis ? [1] : []; } });
  ["#view-speak", "#view-basic", "#reading", "#sme", "#drill", "#grammar"].forEach(s => mk(s, false));
  const document = {
    readyState: "complete", head: { append: s => scripts.push(s) }, documentElement: {},
    createElement: () => ({}), querySelector: s => els[s] || null, addEventListener: (k, f) => { (L["d:" + k] = L["d:" + k] || []).push(f); }, dispatchEvent: e => (L["d:" + e.type] || []).forEach(f => f(e)),
  };
  const win = { document, console, Promise, setTimeout, clearTimeout, Object, Array, String, Map, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, addEventListener: (k, f) => { (L["w:" + k] = L["w:" + k] || []).push(f); } };
  win.window = win; win.U = { log: () => {}, tip: () => {} };
  vm.createContext(win); vm.runInContext(lz, win);
  const loadScripts = () => { while (scripts.length) { const s = scripts.shift(), name = s.src.split(".")[0], calls = (win.__calls = win.__calls || []); win.__order = (win.__order || []).concat(name);
    ({ speak: ["speakShow"], basic: ["basicShow"], read: ["readingShow", "readingNews"], listen: ["smeShow"], drill: ["drillShow"], exam: ["examShow"], write: ["writingShow"], grammar: ["grammarShow"] })[name].forEach(fn => { win[fn] = function () { calls.push(fn + ":" + [...arguments].map(a => (a && a.id) || a).join(",")); }; });
    s.onload(); } };
  return { win, els, L, loadScripts };
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 0));
(async () => {
  const { win, els, L, loadScripts } = env();
  ok(win.speakShow.__lazy && win.speakHide.__lazy && typeof win.drillHide === "function", "stubs in place");
  win.speakHide(); win.readingRefresh(); await tick(); ok(!win.LAZY.loaded("speak") && !win.LAZY.loaded("read"), "quiet entries don't load anything");
  // 看得见 → 马上加载、转给真的
  els["#view-speak"].vis = true; win.speakShow("pron"); await tick(); loadScripts(); await tick(5);
  ok(win.__calls.includes("speakShow:pron") && !win.speakShow.__lazy, "visible → load, forward args, real replaces stub");
  // 看不见 → 先等；显示出来以后才加载
  win.readingShow(); await tick(10); ok(!win.LAZY.loaded("read"), "hidden → waits");
  els["#reading"].vis = true; (L["w:load"] || []).forEach(f => f()); await tick(80); loadScripts(); await tick(10);
  ok(win.__calls.includes("readingShow:"), "shown → loads and draws " + win.__calls);
  // 依赖：练习课先加载听力
  els["#drill"].vis = true; win.drillShow(); await tick(); loadScripts(); await tick(); loadScripts(); await tick(5);
  ok(win.__order.indexOf("listen") >= 0 && win.__order.indexOf("listen") < win.__order.indexOf("drill") && win.__calls.includes("drillShow:"), "drill loads listen first " + win.__order);
  // 参数里给容器（写作 / 模考）
  const wv = { id: "wv", isConnected: true, vis: false, getClientRects() { return this.vis ? [1] : []; } };
  win.writingShow(wv); await tick(60); ok(!win.LAZY.loaded("write"), "container passed as argument: hidden → waits");
  let ev = 0; win.document.addEventListener("lazy-loaded", e => { if (e.detail.name === "write") ev++; });
  console.log(fail ? fail + " FAILED" : "t72 lazy: all ok"); process.exit(fail ? 1 : 0);
})();
