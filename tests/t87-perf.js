// 📱 手机切标签卡（2026-11-24）：生词本列表一次只画 40 张卡（滚到底附近再画）、卡片详情点开才画；阅读页的分词是线性的（以前平方级）
const fs = require("fs"), path = require("path");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const V = W("vocab.js");
ok(/const LIST_PAGE=40;/.test(V) && /function appendCards\(n\)/.test(V) && /IntersectionObserver/.test(V) && /<div class="body"><\/div>/.test(V), "vocab list: paged + lazy card body");
ok(/body\.innerHTML=cardBodyHtml\(w0\)/.test(V) && /const L=LIST_ARR\.filter\(w=>w\.type==="sentence"\|\|w\.type==="pattern"\)/.test(V), "vocab list: body on first open, reader uses full filtered list");
ok(/key===listKey\?Math\.max\(LIST_PAGE,listShown\):LIST_PAGE/.test(V), "vocab list: re-render keeps how many were shown");
ok(/#list \.card\{content-visibility:auto/.test(W("base.css")), "off-screen cards skip layout");
global.U = { sents: t => String(t).split(/(?<=[.!?])\s+/) };
const R = require(path.join(__dirname, "..", "web", "read.js"));
const big = R.SAMPLES.map(x => x.text).join("\n\n").repeat(40), t0 = Date.now(), n = R.wordCount(big);
ok(n > 40000 && Date.now() - t0 < 500, "reading word count is linear (" + n + " words in " + (Date.now() - t0) + " ms)");
const tk = R.tokens('Hi there. "Quoted" word; Ärger über Öl? Yes!');
ok(tk.map(x => x.first ? 1 : 0).join("") === "10111001", "sentence-start flags unchanged: " + tk.map(x => x.w + ":" + x.first).join(" "));
console.log(fail ? fail + " FAILED" : "t87 perf: all ok"); process.exit(fail ? 1 : 0);
