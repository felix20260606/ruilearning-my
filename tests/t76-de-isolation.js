// 🇩🇪 学德语时和英语完全分开：英语专用的页面藏起来、不再请求英语的词典 / 例句库、每日只排德语有的两项（只看源码，不联网）
const fs = require("fs"), path = require("path");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const tabs = W("tabs.js"), css = W("index.css"), vocab = W("vocab.js"), pump = W("pump.js"), daily = W("daily.js"), stats = W("stats.js"), lang = W("lang.js");
// 2026-11-23 起：说、读、写、📻 听力节目都有德语版（对齐英语）；只藏没有德语内容的雅思、插件存的英语词句、英语语法速查
ok(/DE_OFF=\{\}/.test(tabs) && /ti\.textContent='🎓 歌德'/.test(tabs), "tabs: exam tab becomes 🎓 歌德 in German");
ok(!/if\(DE\)SECS\.listen=/.test(tabs), "tabs: listen has all four in German (video list is filtered to German in watch.js)");
for (const sel of ["#ielts-t-notes", '[data-mode="grammar"]'])
  ok(css.includes('html[data-lang="de"] ' + (sel[0] === "#" ? sel : ".modes button" + sel)), "css hides " + sel);
for (const sel of ["#tab-speak", "#tab-read", "#tab-write", "#tab-ielts", "#ielts-t-basics", '[data-mode="saved"]', '[data-mode="reading"]', '[data-mode="writing"]', '[data-mode="sme"]'])
  ok(!css.includes('html[data-lang="de"] ' + (sel[0] === "#" ? sel : ".modes button" + sel)), "css shows " + sel + " in German");
ok(/fetch\("\/api\/dict\?"\+\(window\.VL==="de"\?"lang=de&":""\)/.test(vocab), "dictGet: German dictionary (lang=de)");
ok(/langpair="\+sl\+"\|zh-CN"/.test(vocab), "enrich: translation from German");
ok(/"\/api\/sent\?" \+ \(de \? "lang=de&" : ""\)/.test(pump) && /&lang=de/.test(pump), "pump: German Tatoeba sentences");
ok(/DE_ON = \{ word: 1, listen: 1, speak: 1, read: 1, write: 1 \}/.test(daily), "daily: all five in German");
ok(/window\.VL !== "en" && !VTDE\(\) \? "" : vtHtml\(\)/.test(stats) && /VTDE\(\) \? "vt-de\.js\?v=[0-9a-f]{8}" : "vs\/freq\.js"/.test(stats), "stats: German vocabulary test uses vt-de.js, not the English list");
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
{ const q = W("quota.js"); ok(/const acts = \(DE\(\) \? GROUPS_DE : GROUPS\)/.test(q) && !/GROUPS_DE = \[[\s\S]*?(雅思|BBC|ieltsscript)[\s\S]*?\];\n  function goTo/.test(q) && /GROUPS_DE = \[[\s\S]*?写作批改[\s\S]*?AI 陪练|GROUPS_DE = \[[\s\S]*?AI 陪练[\s\S]*?写作批改/.test(q), "quota panel: German shows German features (no IELTS / BBC)"); }
console.log(fail ? fail + " FAILED" : "t76 de isolation: all ok"); process.exit(fail ? 1 : 0);
