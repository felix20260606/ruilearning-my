// 🌐 插件在任意英文网页上（extension/page.js）：manifest 登记对、排除自己管的网站；查词 / 收词 / 学习模式的几条规则（只看源码 + manifest）
const fs = require("fs"), path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const E = p => fs.readFileSync(path.join(__dirname, "..", "extension", p), "utf8");
const M = JSON.parse(E("manifest.json")), cs = M.content_scripts.find(c => (c.js || []).includes("page.js"));
ok(cs && cs.matches.includes("https://*/*") && cs.js.join() === "freq.js,vlevel.js,page.js" && cs.run_at === "document_idle", "page.js on all sites, after the page loads");
ok(cs && ["https://www.youtube.com/*", "https://www.bilibili.com/*", "https://ruilearning-my.pages.dev/*"].every(x => cs.exclude_matches.includes(x)), "not on YouTube / Bilibili / our own site");
const P = E("page.js");
ok(/attachShadow/.test(P), "card in Shadow DOM (site styles can't break it)");
ok(/type: "add", word: w,[\s\S]{0,120}tag: "网页"/.test(P) && /tag: m\.tag \|\| "视频"/.test(E("background.js")), "saved words tagged 网页 with the sentence as example");
ok(/const SKIP = "a,button,input,textarea,select,code,pre,script,style/.test(P), "learning mode leaves links, inputs, code alone");
ok(/pageOn/.test(P) && /pageHide/.test(P), "per-site on / hide");
ok(/en < 150\) return;/.test(P), "button only on pages with enough English");
console.log(fail ? fail + " FAILED" : "t82 page ext: all ok"); process.exit(fail ? 1 : 0);
