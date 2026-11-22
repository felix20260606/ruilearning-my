// 第三批全站共用：🎨 单词上色 WORD.html（阅读、视频字幕、听力文稿、背单词卡片同一套颜色 + 一份颜色 CSS）、📋 U.copy、⬇️ U.download、✂️ U.sents
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const PAGES = fs.readdirSync(path.join(__dirname, "..", "web")).filter(f => /\.js$/.test(f) && !/^(_worker|util|speak-data|sw)\.js$/.test(f));

// ---------- 源码 ----------
for (const f of PAGES) {
  const s = W(f);
  ok(!/clipboard\.writeText/.test(s), f + ": 复制用 U.copy");
  ok(!/\.download = /.test(s), f + ": 存文件用 U.download");
  ok(!/match\(\/\[\^\.!\?/.test(s), f + ": 分句用 U.sents");
  ok(f === "word.js" || !/\.vs-w\.vs-k\{/.test(s), f + ": 单词颜色 CSS 只在 word.js 一份");
}
ok(/const sentHtml = t => WORD\.html\(/.test(W("read.js")), "read uses WORD.html");
ok(/const markup = t => WORD\.html\(t\)/.test(W("watch.js")) && !/const WORD = \//.test(W("watch.js")), "watch uses WORD.html, no local WORD shadowing the module");
ok(/const h = WORD\.html\(t\)/.test(W("listen.js")), "listen transcript uses WORD.html (level colours)");
ok(/WORD\.html\(plain\(c\.s\.en\)\)/.test(W("pump.js")), "pump cards use WORD.html");
for (const f of PAGES.concat(["util.js"])) ok(!/(const|let|var) (U|AI|TR|CLOUD|MEDIA|KEYS|WORD|TTS|REC|NAV) =/.test(W(f).replace(/window\.\w+ = /g, "")), f + ": no local variable shadows a shared module");
const h = require("./lib/page").html();
ok(/function download\(name,text,type\)\{U\.download\(/.test(h), "index download() → U.download");

// ---------- util：分句、复制、下载 ----------
function utilCtx(extra) {
  const made = [], body = { append: el => made.push(el) };
  const document = Object.assign({ body, head: { append() {} }, createElement: tag => ({ tag, style: {}, setAttribute() {}, select() {}, click() { this.clicked = true; }, remove() {} }), execCommand: () => false, addEventListener() {} }, extra && extra.document);
  const c = vm.createContext(Object.assign({ document, console: Object.assign({}, console, { table() {} }), JSON, Math, Promise, String, Object, Array, Date, setTimeout, clearTimeout, Blob, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, navigator: {} }, extra && extra.win));
  c.window = c; c.toast = m => (c.__t = c.__t || []).push(m); vm.runInContext(W("util.js"), c); return { c, made };
}
(async () => {
  {
    const { c } = utilCtx(); const S = c.U.sents;
    ok(JSON.stringify(S("Mr. Lee paid $3.5 for it. Really? \"Yes,\" she said. J. K. Rowling wrote it.")) === JSON.stringify(["Mr. Lee paid $3.5 for it.", "Really?", "\"Yes,\" she said.", "J. K. Rowling wrote it."]), "sents: abbreviations, decimals, initials " + JSON.stringify(S("Mr. Lee paid $3.5 for it. Really?")));
    ok(S("Line one\nLine two. Three").join("|") === "Line one|Line two.|Three", "sents: newline splits");
    ok(S("No. 5 is here. Then e.g. this one. Done!").join("|") === "No. 5 is here.|Then e.g. this one.|Done!", "sents: No. 5 / e.g.");
  }
  {
    let wrote = null; const { c } = utilCtx({ win: { navigator: { clipboard: { writeText: async t => { wrote = t; } } } } });
    ok((await c.U.copy("hi")) === true && wrote === "hi" && c.__t.pop() === "已复制", "copy via clipboard + tip");
    ok((await c.U.copy("x", { ok: false })) === true && !(c.__t || []).length, "ok:false → no tip");
  }
  {
    const { c } = utilCtx({ win: { navigator: { clipboard: { writeText: async () => { throw new Error("no"); } } } } });
    ok((await c.U.copy("y", { manual: false })) === false && c.U.logs("copy").length === 1, "copy fails → false + logged, no dialog when manual:false");
  }
  {
    const { c, made } = utilCtx();
    c.U.download("a.csv", "x,y"); const a = made.find(x => x.tag === "a");
    ok(a && a.download === "a.csv" && a.clicked && c.U.logs("download").length === 1, "download clicks a link + logs");
  }
  // ---------- 🎨 WORD.html ----------
  {
    const st = { head: [] };
    const document = { head: { append: x => st.head.push(x) }, documentElement: { append() {} }, body: { append() {} }, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, append() {}, setAttribute() {} }), addEventListener() {}, dispatchEvent: e => (c.__ev = (c.__ev || []).concat(e.detail)), readyState: "complete", getElementById: () => null, querySelector: () => null };
    const c = vm.createContext({ document, console: Object.assign({}, console, { table() {} }), JSON, Math, Promise, String, Object, Array, Date, Set, Map, setTimeout, clearTimeout, CustomEvent: function (t, o) { this.type = t; this.detail = o.detail; } });
    c.window = c; vm.runInContext(W("util.js"), c);
    c.words = [{ word: "apple", status: "learning" }, { word: "cat", status: "known" }];
    let loaded = 0; c.__vs = { ready: () => false, load: () => { loaded++; return Promise.resolve(); } };
    vm.runInContext(W("word.js"), c);
    ok(st.head.some(x => /\.vs-w\.vs-k\{/.test(x.textContent || "")), "colour CSS injected as soon as word.js loads");
    let H = c.WORD.html("An apple & a cat.");
    ok(/<span class="vs-w wd-lr" data-w="apple">apple<\/span> &amp; /.test(H) && /data-w="cat">cat<\/span>/.test(H) && loaded === 1, "no vs yet: plain clickable words, & escaped, book learning → wd-lr, starts loading " + H);
    await new Promise(r => setTimeout(r, 5));
    ok((c.__ev || []).some(d => d.m === "ready"), "word-change ready fired after loading");
    c.vsMark = (t, S) => t.replace(/[A-Za-z]+/g, w => '<span class="vs-w ' + (w.length > 3 ? "vs-u1" : "vs-k") + '" data-w="' + w + '">' + w + "</span>");
    c.__vs.ready = () => true; c.__vs.html = t => c.vsMark(t, {});
    H = c.WORD.html("An apple & a cat.");
    ok(/class="vs-w wd-lr" data-w="apple"/.test(H) && /class="vs-w" data-w="cat"/.test(H) && /class="vs-w vs-k" data-w="An"/.test(H), "vs colours; known word loses colour, learning → wd-lr " + H);
    let seen = null; c.vsMark = (t, S) => { seen = S; return t; };
    c.WORD.html("Hi there", { level: 2000, settings: { colKnown: "#fff" } });
    ok(seen && seen.level === 2000 && seen.colKnown === "#fff" && seen.fadeRare === true, "custom level / settings go to vsMark");
  }
  console.log(fail ? fail + " FAILED" : "t68 colour + copy + sents: all ok"); process.exit(fail ? 1 : 0);
})();
