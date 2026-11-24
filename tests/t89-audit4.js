// 第四轮检查修的（2026-11-24）：插件同步重发的删除不再删两遍媒体（KV 每天 1000 次删除额度）；/api/mine 写成空值 / 一次改写很多也要口令；
//   雅思听力题库清单在内存留 6 小时（少用 list 额度）；判断题核对后不到 2 道的卷子只存 1 天；Commons 原本就是 mp3 的发音不走转码地址
const path = require("path"), fs = require("fs");
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default, SRC = fs.readFileSync(path.join(__dirname, "..", "web", "_worker.js"), "utf8");
  const kv = new Map(); let dels = 0;
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { dels++; if (process.env.DBG) console.log("del", k); kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix || "")).map(name => ({ name })), list_complete: true }) };
  const env = { CAPTIONS: KV };
  const call = async (p, body, key) => { const h = { "content-type": "application/json" }; if (key) h["x-key"] = key; const r = await W.fetch(new Request("https://x.test" + p, body ? { method: "POST", headers: h, body: JSON.stringify(body) } : {}), env); return { status: r.status, j: await r.json() }; };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  // ext：媒体删除只删一次（时间要用真的：120 天前的删除记号会被清掉）
  const T0 = Date.now() - 60000;
  let r = await call("/api/ext", { changes: { "med|med:a1": { v: { t: "x" }, at: T0 } } }); ok(r.j.ok, "ext add " + JSON.stringify(r.j));
  r = await call("/api/ext", { changes: { "med|med:a1": { del: 1, at: T0 + 20 } } }); const d1 = dels;
  r = await call("/api/ext", { changes: { "med|med:a1": { del: 1, at: T0 + 20 } } }); r = await call("/api/ext", { changes: { "med|med:a1": { del: 1, at: T0 + 30 } } });
  ok(d1 === 1 && dels === 1, "re-sent media delete doesn't delete again (dels " + d1 + "→" + dels + ")");
  // mine：设了口令以后，没口令把 40 项写成 null = 删除，要口令；改写 301 项也要口令；少量正常改写照常
  r = await call("/api/auth", { set: "correct horse 42" }); ok(r.j.ok, "auth set");
  const many = {}; for (let i = 0; i < 400; i++) many["e" + i] = { v: { w: "w" + i }, at: 100 };
  r = await call("/api/mine", { k: "err", changes: many }, "correct horse 42"); ok(r.j.ok && Object.keys(r.j.items).length === 400, "seed 400 with key");
  const nul = {}; for (let i = 0; i < 40; i++) nul["e" + i] = { v: null, at: Date.now() };
  r = await call("/api/mine", { k: "err", changes: nul }); ok(!r.j.ok && r.status !== 200, "40 null overwrites need key " + r.status);
  const rw = {}; for (let i = 0; i < 301; i++) rw["e" + i] = { v: { w: "changed" }, at: Date.now() };
  r = await call("/api/mine", { k: "err", changes: rw }); ok(!r.j.ok, "301 rewrites need key");
  r = await call("/api/mine", { k: "err", changes: { e1: { v: { w: "fixed" }, at: Date.now() } } }); ok(r.j.ok && r.j.items.e1.v.w === "fixed", "small edit still fine");
  r = await call("/api/mine?k=err"); ok(r.j.items.e5.v.w === "w5", "data intact");
  // 源码检查
  ok(/IX_LIST\[pre\]/.test(SRC) && /6 \* 3600e3/.test(SRC), "ielts script list cached in memory");
  ok(/\(got\.tfng \|\| \[\]\)\.length < 2 \? 1 : 60/.test(SRC), "short quiz cached 1 day");
  ok(/\/\\\.mp3\$\/i\.test\(name\) \? "" : "transcoded\/"/.test(SRC), "mp3 originals use the plain Commons path");
  // 前端
  const F = n => fs.readFileSync(path.join(__dirname, "..", "web", n), "utf8"), V = F("vocab.js"), SP = F("speak.js");
  ok(/Math\.min\(185, o\.max \|\| 20\)/.test(F("rec.js")) && /max: 180, prep: 60/.test(SP), "German Teil 2 can record the full 3 minutes");
  ok(/lang: cur\.lang \|\| LANG_NOW\(\) \} \}\), "", location\.href\)/.test(F("nav.js")), "late-registered pages keep the language tag in history");
  ok(/function hl\(t\)\{return H\(t\)/.test(V) && /<span class="word">\$\{H\(w\.word\)\}/.test(V) && /<div class="zh-full">\$\{H\(w\.zh\)\}/.test(V) && /<div class="t">\$\{H\(e\[1\]\)\}/.test(V) && !/\$\{w\.(zh|en|tip|phon)\}/.test(V), "vocab card text escaped");
  ok(/replace\(\/<\[\^>\]\+>\/g, ""\)\.replace\(\/&amp;\/g, "&"\)/.test(SRC), "worker strips decoded tags, decodes &amp; last");
  ok(/for \(const k in RES\) if \(k\.indexOf\("mock:"\) === 0\) delete RES\[k\]/.test(SP) && /dWords\(a\)\.replace\(\/eins\$\/, "ein"\) \+ " Euro"/.test(SP), "new mock clears old answers; 'ein Euro'");
  ok(/window\.VL==="de"\?String\(w\.word\)\.normalize\("NFC"\)===word/.test(V) && /收了 Morgen（早晨）不等于收了 morgen（明天）/.test(F("word.js")), "German Morgen / morgen are separate words");
  ok(/ROW_NONE_AT\[k\]\|\|\(ROW_NONE_AT\[k\]=now\)/.test(V) && /String\(w\.zh\|\|""\)\.includes\(query\)/.test(V), "row 'no picture' keeps its time; search guards");
  ok(/\(\^\|\[\^\\\\p\{L\}\]\)" \+ w\.split/.test(F("listen.js")), "listen vocab sentence finder works for Ä Ö Ü");
  global.window = { VL: "de" }; global.localStorage = { getItem() { return null; }, setItem() {} }; global.document = { documentElement: { lang: "de" }, addEventListener() {} };
  require(path.join(__dirname, "..", "web", "util.js")); const Us = global.U || window.U;
  ok(Us.sents("Das Gesetz gilt seit 2019. Kritiker sind dagegen.").length === 2 && Us.sents("Das gilt ab 1. Januar für alle.").length === 1 && Us.sents("Er bleibt bis 12. Mai. Dann geht er.").length === 2, "German split after 'seit 2019.' but not 'ab 1. Januar'");
  console.log(fail ? fail + " failed" : "t89 audit4 ok"); process.exit(fail ? 1 : 0);
})();
