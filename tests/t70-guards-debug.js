// 防 bug 的几样：🔢 版本号按文件内容（tools/bump-versions.js）、🛡 代码检查（tools/eslint.config.mjs）、🐞 问题记录（util.js 记报错、存进设备、设置里能看能复制）
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync } = require("child_process");
const R = (...p) => path.join(__dirname, "..", ...p), W = p => fs.readFileSync(R("web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

// ---------- 🔢 版本号 ----------
let out = ""; try { out = execFileSync(process.execPath, [R("tools", "bump-versions.js"), "--check"], { encoding: "utf8" }); } catch (e) { out = String(e.stdout || e.message); }
ok(/✓/.test(out), "every ?v= equals the file's content hash: " + out.slice(0, 300));
ok(/src="util\.js\?v=[0-9a-f]{8}"/.test(W("index.html")) && /"speak-data\.js\?v=[0-9a-f]{8}"/.test(W("speak.js")) && /"pron-real\.json\?v=[0-9a-f]{8}"/.test(W("tts.js")), "versions are content hashes (html + js string literals)");

// ---------- 🛡 自动测试的步骤 ----------
const wf = fs.readFileSync(R(".github", "workflows", "test.yml"), "utf8");
ok(/sh tools\/lint\.sh/.test(wf) && /node tools\/bump-versions\.js --check/.test(wf) && /node tools\/check-syntax\.js/.test(wf), "CI runs syntax + lint + version check");
const cfg = fs.readFileSync(R("tools", "eslint.config.mjs"), "utf8");
ok(/"no-undef": "error"/.test(cfg) && /no-restricted-syntax/.test(cfg) && /const SHARED = \["U", "AI", "TR", "CLOUD", "MEDIA", "KEYS", "WORD", "TTS", "REC", "NAV"\]/.test(cfg), "lint: undefined vars + shadowing shared modules");
ok(fs.existsSync(R("tests", "old", "README.md")) && !fs.existsSync(R("tests", "t7.js")) && fs.existsSync(R("tests", "t69-bg-sync.js")), "old browser tests archived, t38 → t69 runs in CI");

// ---------- 🐞 问题记录 ----------
function env(store) {
  const L = {}, win = { console: Object.assign({}, console, { table() {} }), JSON, Math, Promise, String, Object, Array, Date, setTimeout, clearTimeout,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    addEventListener: (k, f) => { (L[k] = L[k] || []).push(f); }, location: { pathname: "/", search: "" }, navigator: { userAgent: "test" },
    document: { head: { append() {} }, body: { append() {} }, createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, classList: { add() {}, remove() {}, contains: () => false }, querySelector: () => null }), addEventListener() {} } };
  win.window = win; win.toast = () => {}; vm.createContext(win); vm.runInContext(W("util.js"), win); return { U: win.U, L };
}
(async () => {
  const store = new Map();
  { const { U, L } = env(store);
    L.error.forEach(f => f({ message: "x is not defined", filename: "https://a/b/daily.js?v=1", lineno: 12, colno: 3 }));
    L.error.forEach(f => f({ message: "ResizeObserver loop limit exceeded" }));
    L.unhandledrejection.forEach(f => f({ reason: new TypeError("boom") }));
    L.unhandledrejection.forEach(f => f({ reason: { name: "AbortError" } }));
    const E = U.logs("error");
    ok(E.length === 2 && E[0].msg === "x is not defined" && E[0].data === "daily.js:12:3" && /boom/.test(E[1].msg), "page errors captured, noise skipped " + JSON.stringify(E));
    L.pagehide.forEach(f => f());
    ok(JSON.parse(store.get("debug:log")).length === 2, "saved to the device");
    const r = U.report(); ok(/问题记录/.test(r) && r.indexOf("boom") < r.indexOf("x is not defined"), "report: newest first"); }
  { const { U } = env(store); // 刷新以后
    const L = U.logs(); ok(L.length === 2 && L.every(x => x.old) && /^· /m.test(U.report()), "kept after reload, marked as earlier");
    U.clearLogs(); ok(!store.has("debug:log") && !U.logs().length, "clear"); }
  const h = W("index.html");
  ok(/id="dbg-open"/.test(h) && /U\.showLogs\(\)/.test(h) && /\[\?&\]debug/.test(h), "settings entry + ?debug");
  console.log(fail ? fail + " FAILED" : "t70 guards + debug: all ok"); process.exit(fail ? 1 : 0);
})();
