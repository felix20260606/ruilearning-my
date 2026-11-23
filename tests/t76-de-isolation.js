// 🇩🇪 学德语时和英语完全分开：英语专用的页面藏起来、不再请求英语的词典 / 例句库、每日只排德语有的两项（只看源码，不联网）
const fs = require("fs"), path = require("path");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const tabs = W("tabs.js"), css = W("index.css"), vocab = W("vocab.js"), pump = W("pump.js"), daily = W("daily.js"), stats = W("stats.js"), lang = W("lang.js");
ok(/DE_OFF=\{speak:1,read:1,write:1,ielts:1\}/.test(tabs) && /\(DE&&DE_OFF\[which\]\)\)which='notebook'/.test(tabs), "tabs: English-only tabs redirect to notebook");
ok(/SECS\.listen=SECS\.listen\.filter\(function\(x\)\{return x\[0\]==='drill'\|\|x\[0\]==='practice';\}\)/.test(tabs), "tabs: listen keeps 练习课 + 听力练习 only");
for (const sel of ["#tab-speak", "#tab-read", "#tab-write", "#tab-ielts", '[data-mode="reading"]', '[data-mode="saved"]', '[data-mode="grammar"]', '[data-mode="writing"]', '[data-mode="sme"]'])
  ok(css.includes('html[data-lang="de"] ' + (sel[0] === "#" ? sel : ".modes button" + sel)), "css hides " + sel);
ok(/if\(window\.VL==="en"\|\|!window\.VL\)try\{const r=await fetch\("\/api\/dict/.test(vocab), "dictGet: no English dictionary in German");
ok(/langpair="\+sl\+"\|zh-CN"/.test(vocab), "enrich: translation from German");
ok(/window\.VL !== "en"\) return Promise\.resolve\(SENT\[k\] = \[\]\)/.test(pump) && /p\.pump && \(!window\.VL \|\| window\.VL === "en"\)/.test(pump), "pump: no English Tatoeba sentences in German");
ok(/DE_ON = \{ word: 1, listen: 1 \}/.test(daily), "daily: only 词 + 听 in German");
ok(/window\.VL !== "en" \? "" : vtHtml\(\)/.test(stats), "stats: no English vocabulary test in German");
ok(/cfg\(\)\.name \+ "生词本"/.test(lang), "title follows language");
// 🌱 德语入门（de-basic.js）：学德语时入门换成德语的 5 个小标签；内容能在 node 里跑出来
ok(/if\(DE\)SECS\.basic=\[\['start'/.test(tabs) && /if\(DE\)\{root\.classList\.add\('show-basic-home'\);if\(window\.deBasicShow\)deBasicShow\(sub\);\}/.test(tabs), "tabs: German basics");
ok(/debasic: \{ src: "de-basic\.js/.test(W("lazy.js")), "lazy: de-basic registered");
{
  const vm = require("vm"), ctx = { window: {}, U: { esc: s => String(s).replace(/[&<>"]/g, c => "&#" + c.charCodeAt(0) + ";"), LG: (k, d) => d, LS() {} }, document: { getElementById: () => null }, localStorage: { getItem: () => null }, console };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(W("de-basic.js"), ctx);
  const B = ctx.DE_BASIC; ok(B && B.SOUNDS.length >= 15 && B.PHR.length >= 6 && B.GRAM.length >= 8, "de-basic content");
  for (const k of ["start", "laut", "satz", "gram", "zahl"]) { const h = B.VIEWS[k](); ok(h.length > 500 && !/undefined/.test(h), "view " + k + " renders"); }
  ok(B.PHR.every(g => g[3].every(p => p[0] && p[1])), "every phrase has German + Chinese");
}
{ const q = W("quota.js"); ok(/const acts = \(DE\(\) \? GROUPS_DE : GROUPS\)/.test(q) && !/GROUPS_DE = \[[\s\S]*?(写作批改|AI 陪练|雅思)[\s\S]*?\];\n  function goTo/.test(q), "quota panel: German shows only German features"); }
console.log(fail ? fail + " FAILED" : "t76 de isolation: all ok"); process.exit(fail ? 1 : 0);
