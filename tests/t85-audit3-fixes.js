// 第三轮检查修的（2026-11-23）：通勤模式一次失败只换一个地址、按卡片数记账；断签保护卡等云端拉完才用；里程碑 XSS / 日期校验；
//   家庭排行「本周」从周一算；AI 额度面板过了重置不会一直重读；每日一练后台加载练习课不弹错；推送按人按语言分开；
//   例句库取不到时沿用旧的；插件网页学习模式原样还原、只拦上色的词、断开插件不报错；vlevel 整批判断只数一次标记表
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  // ---- 通勤模式：play() 被拒和 onerror 同时来，只换一个地址 ----
  const ctx = { console, Date, Math, JSON, String, Array, Object, Promise, setTimeout, Uint8Array, DataView, Blob: function () {}, URL: { createObjectURL: () => "blob:x" },
    U: { esc: s => s, LG: (k, d) => d, LS() {}, day: () => "2026-11-23" }, document: { createElement: () => ({}), head: { append() {} }, body: { append() {} }, documentElement: { style: {} }, hidden: true }, navigator: {} };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(W("web/commute.js"), ctx);
  const err = n => Object.assign(new Error(n), { name: n });
  for (const mode of ["reject-then-error", "error-then-reject", "reject-only"]) {
    const tried = [], au = { set src(v) { this._s = v; tried.push(v); }, get src() { return this._s; }, pause() {},
      play() { const s = this._s; if (s === "bad") { if (mode === "error-then-reject") { this.onerror(); return Promise.reject(err("NotSupportedError")); } if (mode === "reject-then-error") setTimeout(() => this.onerror && this.onerror(), 0); return Promise.reject(err("NotSupportedError")); } setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve(); } };
    ctx.COMMUTE._au(au);
    const r = await ctx.COMMUTE.playSrc(["bad", "good", "never"], 1, 0);
    await new Promise(res => setTimeout(res, mode === "reject-only" ? 1700 : 40));
    ok(r === true && tried.join() === "bad,good", mode + ": one failure → exactly one fallback: " + tried.join());
  }
  const C = W("web/commute.js");
  ok(/MEDIA\.solo\(au\)/.test(C) && /MEDIA\.reg\(au\)/.test(C), "commute uses MEDIA solo / reg");
  ok(/function unbindMS\(\)/.test(C) && /pause\(\); unbindMS\(\);/.test(C) && !/^\s*bindMS\(\);\s*$/m.test(C), "lock-screen handlers only while open");
  // ---- 断签保护：服务器记录、云端 daily 没拉完不用卡 ----
  const S = require(path.join(__dirname, "..", "web", "stats.js")), now = Date.parse("2026-11-28T12:00:00+08:00"), D = {};
  ["2026-11-24", "2026-11-26", "2026-11-27", "2026-11-28"].forEach(d => (D[d] = { n: 5 }));
  ok(S.streakOf(D, now, { set: new Set(), add: null }) === 3, "no auto-freeze until cloud data is in");
  const T = W("web/stats.js");
  ok(/add: !\(srvOK && dailyOK\) \? null :/.test(T) && /SRV = m; srvOK = true;/.test(T), "freeze only after server stats + cloud daily");
  ok(/Promise\.all\(\[loadServer\(\), pullDaily\(\)\]\)/.test(T), "cloud daily pulled when stats opens");
  ok(/"到达：" \+ esc\(M\[m\]\)/.test(T) && /MS\.includes\(\+a\)/.test(T) && /DAY_RE\.test\(String\(x\.v\)\)/.test(T), "milestone values escaped + validated");
  ok(/remind:push\|/.test(W("web/boot.js")), "push flag per user / language");
  ok(/pushPost\(\{ sub: sub\.toJSON\(\), off: 1 \}\)/.test(T) && !/sub\.unsubscribe\(\); \} \} catch/.test(T), "off: only this combo, device stays subscribed");
  ok(/sameKey\(sub, k\.key\)/.test(T) && /renew: \{ old, sub: sub\.toJSON\(\) \}/.test(T) && /setTimeout\(pushSync, 9e3\)/.test(T), "re-sync on load, key change → resubscribe + renew");
  ok(/pushsubscriptionchange/.test(W("web/sw.js")) && /renew: \{ old: old\.endpoint/.test(W("web/sw.js")), "SW handles pushsubscriptionchange");
  ok(/LGN\(\) \+ "练习"/.test(T) && /"该练" \+ LGN\(\) \+ "了 🔊"/.test(T), "German reminder texts");
  // ---- 家庭排行：本周从周一算 ----
  const DY = W("web/daily.js");
  ok(/wd = \(new Date\(today \+ "T12:00:00Z"\)\.getUTCDay\(\) \+ 6\) % 7/.test(DY), "board weekday from the date itself");
  for (const [d, w] of [["2026-11-23", 0], ["2026-11-29", 6], ["2026-11-25", 2]]) ok((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7 === w, d + " → weekday " + w);
  ok(/LAZY\.need\("drill", true\)/.test(DY) && /Date\.now\(\) - drillTry > 60e3/.test(DY), "daily: drill preload quiet + cooldown");
  // ---- AI 额度面板：同一个重置时间只强制读一次 ----
  const qa = W("web/quota.js");
  const qctx = { console, Date, Math, JSON, String, Array, Object, Promise, setTimeout, clearTimeout, setInterval() {}, document: { addEventListener() {}, getElementById: () => ({ innerHTML: "" }), createElement: () => ({}), head: { append() {} }, documentElement: { classList: { contains: () => false } }, hidden: false } };
  let calls = 0; qctx.U = { esc: s => s, json: async () => { calls++; return { ok: true, reset: Date.now() - 1000, days: {}, today: "2026-11-23" }; }, day: () => "2026-11-23" };
  qctx.window = qctx; vm.createContext(qctx);
  try { vm.runInContext(qa, qctx); for (let i = 0; i < 5; i++) { try { qctx.quotaHtml(); } catch (e) {} await new Promise(res => setTimeout(res, 5)); } ok(calls <= 2, "quota: past-reset data doesn't refetch on every paint (" + calls + " fetches)"); }
  catch (e) { ok(/forcedFor !== J\.reset/.test(qa), "quota guard (static): " + e.message); }
  // ---- 录音地址放掉 ----
  ok(/else if \(y && y\.url\) try \{ URL\.revokeObjectURL\(y\.url\)/.test(W("web/speak.js")) && /done: x => \{ if \(x && x\.url\) try \{ URL\.revokeObjectURL/.test(W("web/de-basic.js")), "object URLs revoked");
  ok(/dict\.cc/.test(W("web/word.js")), "German word card links a German dictionary");
  // ---- 例句库：取不到沿用旧的；少一半不写 ----
  const BC = W("tools/build-corpus.mjs");
  ok(/AbortSignal\.timeout\(20000\)/.test(BC) && /oldSeries\(old, ser\)/.test(BC) && /nb\(old\) \* 0\.5/.test(BC), "corpus: timeout, reuse old series, refuse big drop");
  ok(/timeout-minutes: 30/.test(W(".github/workflows/backup-vocab.yml")) && /cron: "7,37 \* \* \* \*"/.test(W(".github/workflows/push.yml")), "workflows: backup timeout, push cron off the hour");
  ok(/getUTCHours\(\) < 20\) \{ stop =/.test(W("tools/gen-tts.mjs")), "gen-tts stops if it runs past 00:00 UTC");
  // ---- 插件网页 ----
  const P = W("extension/page.js");
  ok(/ORIG\.set\(sp, n\)/.test(P) && /sp\.replaceWith\(o \|\| document\.createTextNode/.test(P) && !/body\.normalize\(\)/.test(P), "learning mode restores the original text nodes");
  ok(/COLORED\.test\(w\.className\)/.test(P) && /span\.vsp,label,summary,\[role=button\]/.test(P), "only colored words intercept clicks; more UI skipped");
  ok(/mode: "closed"/.test(P) && /e\.isTrusted/.test(P) && /chrome\.runtime && chrome\.runtime\.id/.test(P), "closed shadow, trusted clicks, extension-reload safe");
  ok(/queueOnly: \/\\s\/\.test\(w\)/.test(P) && /tag: "网页" \}\)/.test(P) && /r\.cloud === false \? "✓ 已存本机/.test(P), "add: phrases to queue, ctx tagged, offline message");
  ok(/tag: c && c\.tag/.test(W("extension/background.js")), "syncAll keeps the 网页 tag");
  const M = JSON.parse(W("extension/manifest.json")), cs = M.content_scripts.find(c => (c.js || []).includes("page.js"));
  ok(cs.exclude_matches.includes("https://music.youtube.com/*") && cs.exclude_matches.includes("https://*.ruilearning-my.pages.dev/*"), "manifest excludes music.youtube + preview deploys");
  ok(W("extension/vlevel.js") === W("web/vs/vlevel.js"), "web/vs/vlevel.js synced");
  // vlevel：整批判断时标记表只数一次，单个调用照常是最新的
  const v = { console, Date, Math, JSON, String, Array, Object, Set }; v.window = v; vm.createContext(v);
  vm.runInContext(W("extension/freq.js") + ";" + W("extension/vlevel.js") + ";this.vsMarkOf=vsMarkOf;this.vsBatch=vsBatch;this.setM=m=>{VS_MARKS=m};this.getM=()=>VS_MARKS;", v);
  v.setM({ write: "known" }); ok(v.vsMarkOf("wrote") === "known", "derived mark");
  delete v.getM().write; ok(v.vsMarkOf("wrote") === "", "in-place delete seen immediately");
  const big = {}; for (let i = 0; i < 5000; i++) big["w" + i] = "known"; v.setM(big); const t0 = Date.now(); v.vsBatch(() => { for (let i = 0; i < 30000; i++) v.vsMarkOf("hello" + (i % 50)); });
  ok(Date.now() - t0 < 400, "batch of 30k lookups with 5k marks fast (" + (Date.now() - t0) + " ms)");
  console.log(fail ? fail + " FAILED" : "t85 audit3 fixes: all ok"); process.exit(fail ? 1 : 0);
})();
