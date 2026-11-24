// 🙈 插件「上班模式」（2026-11-24）：字幕小窗 / 伪装阅读 / 老板键 / 任意网页生词卡，皮肤可切换
const fs = require("fs"), path = require("path");
const X = p => fs.readFileSync(path.join(__dirname, "..", "extension", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const M = JSON.parse(X("manifest.json")), W = X("work.js"), C = X("content.js"), P = X("page.js"), H = X("popup.html"), PJ = X("popup.js");
ok(/^1\.(2[7-9]|[3-9]\d)\./.test(M.version), "manifest version >= 1.27");
const cs = M.content_scripts.find(c => c.js.includes("content.js"));
ok(cs && cs.js.indexOf("work.js") === cs.js.indexOf("content.js") + 1, "work.js loads right after content.js (same isolated world)");
ok(/window\.VS_WORK = \{/.test(C) && /cues: \(\) => cues/.test(C) && /video: \(\) => video\(\)/.test(C), "content.js exposes VS_WORK");
try { new Function(W); } catch (e) { ok(false, "work.js parses: " + e.message); }
try { new Function(P); } catch (e) { ok(false, "page.js parses: " + e.message); }
for (const s of ["chat", "term", "note"]) ok(W.includes(s), "pip skin " + s);
for (const s of ["code", "doc", "sheet"]) ok(W.includes('"' + s + '"') || W.includes(s + ":"), "skin " + s);
ok(/documentPictureInPicture/.test(W) && /function bossToggle/.test(W) && /function readOpen/.test(W), "pip + boss key + reading mode");
ok(/window\.addEventListener\("keydown", onKey, true\)/.test(W) && /d\.addEventListener\("keydown", onKey, true\)/.test(W), "boss key: capture listener on page and inside the PiP window");
for (const k of ["workBtn", "workKey", "workBoss", "workPip", "workRead", "workCard"]) {
  ok(H.includes('data-k="' + k + '"'), "popup has " + k); ok(new RegExp("\\b" + k + ":").test(PJ), "popup default " + k);
}
ok(/function wcTick/.test(P) && /workCardOff/.test(P) && /bottom:60px/.test(P) && /document\.documentElement\.append\(wcHost\)/.test(P), "review card: ticks, off-for-today, sits above the 学习模式 pill, actually appended");
ok(/<span class="wk" data-a="wk"[^>]*>🙈<\/span><span class="gr" data-a="set"/.test(C) && /else if \(a === "wk"\) \{ if \(window\.VS_WK\) window\.VS_WK\.menu\(e\.target\); \}/.test(C), "🙈 sits in the BAN pill, left of the gear, and opens the menu");
ok(/window\.VS_WK = \{ menu:/.test(W) && /classList\.toggle\("vs-wk-on", show\)/.test(W) && !/vs-wk-btn/.test(W) && /html\.vs-wk-on #vs-pill \.wk\{display:inline-flex\}/.test(X("content.css")), "no floating corner button; pill icon shown via html.vs-wk-on");
ok(!/\/\/[^\n]*document\.documentElement\.append\(wcHost\)/.test(P), "card append not swallowed by a // comment");
console.log(fail ? fail + " FAILED" : "t88 work mode: all ok"); process.exit(fail ? 1 : 0);
