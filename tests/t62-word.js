// 🔤 全站共用的单词操作（web/word.js）：各页面都用 WORD.bind / WORD.open；右键按插件规则循环标记；旧接口 readPop / readBook 还在
const fs = require("fs"), path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const W = f => fs.readFileSync(path.join(__dirname, "..", "web", f), "utf8");
const w = W("word.js"), h = W("index.html");
ok(/<script src="nav\.js\?v=\d+"><\/script>\s*<script src="word\.js\?v=\d+"><\/script>/.test(h), "word.js loads early (before every page module)");
ok(/window\.WORD = \{ html, bind, open, close, mark, cycle, status, loadBook, dict/.test(w) && /window\.readPop = /.test(w) && /window\.readBook = /.test(w), "API + old aliases");
ok(/data-m="learn"|sheetExtra/.test(w) && /V\(\)\.next\(w\)/.test(w) && /"contextmenu"/.test(w), "card has the plugin mark buttons; right-click cycles like the plugin");
ok(/word-change/.test(w), "pages are told to recolor");
for (const f of ["read.js", "listen.js", "pump.js"]) ok(/WORD\.bind\(root/.test(W(f)) && /word-change/.test(W(f)), f + " uses the shared word handling");
const wt = W("watch.js"); ok(/WORD\.open\(w, el/.test(wt) && /WORD\.cycle\(/.test(wt) && /word-change/.test(wt), "video subtitles use the shared card + right-click");
ok(!/#ra-pop/.test(W("read.js")) && !/function openPop\(/.test(W("read.js")), "read.js no longer has its own popup");
// watch.js 给 word.js 的标记接口
ok(/markOf: w =>/.test(wt) && /setMark: \(w, m\) =>/.test(wt) && /next: w => vsNextMark\(w\)/.test(wt), "watch.js exposes mark functions");
console.log(fail ? fail + " FAILED" : "t62 word: all ok"); process.exit(fail ? 1 : 0);
