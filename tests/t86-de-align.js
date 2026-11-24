// 🇩🇪 德语和英语对齐（2026-11-23）：说（speak-data-de.js，同结构）、读（tagesschau / 德语示例）、写（歌德 B1/B2、100 分制）、
//   📻 DW 慢速新闻（/api/sme?s=dw）、查词（/api/dict?lang=de：性、原形、音标）、例句（/api/sent?lang=de）、AI 提示词按 lang 切德语；英语不受影响
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  // ---- 口语内容：德语和英语结构完全一样 ----
  const load = f => { const c = { window: {} }; vm.createContext(c); vm.runInContext(W("web/" + f), c); return c.window.SPEAK_DATA; };
  const E = load("speak-data.js"), D = load("speak-data-de.js");
  const shape = x => Array.isArray(x) ? "[" + (x.length ? shape(x[0]) : "") + "]" : x && typeof x === "object" ? "{" + Object.keys(x).sort().map(k => k + ":" + shape(x[k])).join(",") + "}" : typeof x;
  for (const k of Object.keys(E)) ok(D[k] && shape(D[k]) === shape(E[k]), "speak-data-de section " + k + " same shape");
  ok(D.dialogs.length >= 30 && D.functions.length >= 20 && D.drills.length >= 25 && D.pron.pairs.length >= 12 && D.pron.shadow.reduce((a, g) => a + g.items.length, 0) >= 120 && D.topics.length >= 40 && D.quick.length >= 60 && D.starter.rescue.length >= 40, "German content as big as English");
  const CATS = ["日常", "工作", "生活在马来西亚", "旅行", "兴趣", "观点"]; ok(D.topics.every(t => CATS.includes(t.cat)), "topic cats valid");
  ok(D.stress.every(x => x.variants.every(v => x.en.includes(v.stress))), "stress words in sentence");
  const ids = D.dialogs.map(d => d.id); ok(new Set(ids).size === ids.length, "dialog ids unique");
  ok(/[äöüß]/.test(JSON.stringify(D.dialogs)) && !/\b(Strasse|fuer|schoen|Gruesse)\b/.test(JSON.stringify(D)), "real umlauts, no ae/oe/ue substitutes");
  // ---- 页面开关 ----
  const sp = W("web/speak.js");
  ok(/s\.src = DE \? "speak-data-de\.js\?v=[0-9a-f]{8}" : "speak-data\.js\?v=/.test(sp) && /const MOVED = DE \? \[\] :/.test(sp) && /REC\.toggle\(key, \{ lang: LC/.test(sp), "speak: German data, German rec");
  ok(["chat", "chatsum", "speak", "coach", "howto", "useword", "judge"].every(t => new RegExp('AI\\.ask\\("' + t + '", \\{ lang: LC').test(sp)), "speak: every AI call sends lang");
  ok(/refSrc = t => \{ try \{ if \(DE \|\|/.test(sp), "speak: no English AI audio for pitch in German");
  const wr = W("web/write.js"); ok(/AI\.ask\("write", \{ lang: DEW \? "de" : "en"/.test(wr) && /const TYPES = DEW \? TYPES_DE : TYPES_EN/.test(wr), "write: German tasks + lang");
  { const c = { window: { VL: "de" }, module: { exports: {} } }; c.module.exports = {}; vm.createContext(c); vm.runInContext(W("web/write.js"), c); const X = c.module.exports;
    ok(Object.keys(X.TYPES).join() === "b1mail,b1forum,b1formal,b2forum,b2letter,free" && X.BANK.b1mail.length >= 5, "write: Goethe types + bank");
    const t = "Ich bin umgezogen, weil die Wohnung zu klein war. Außerdem ist die Küche schön. Das Haus wurde 2010 gebaut. Trotzdem gefällt es mir.";
    ok(X.countWords("Bücher für Grüße") === 3, "write: umlaut words counted once");
    ok(X.connectives(t, "b1mail").total >= 3 && X.complexSentences(X.sentences(t)).n === 1 && X.passives(t).n === 1 && X.estimate({ words: 99 }, {}, true) === null, "write: German analysis"); }
  { const c = { window: { VL: "en" }, module: { exports: {} } }; vm.createContext(c); vm.runInContext(W("web/write.js"), c); ok(Object.keys(c.module.exports.TYPES).join() === "task2,task1,email,free", "write: English unchanged"); }
  const rd = W("web/read.js"); ok(/"\/api\/news\?d=" \+ nday\(\) \+ \(DE \? "&lang=de" : ""\)/.test(rd) && /SAMPLE_LIST = DE \? SAMPLES_DE : SAMPLES/.test(rd) && /AI\.ask\("newsimp", \{ lang: LGC/.test(rd) && /TTS\.sys\(P\.sents\[i\], \{ lang: LGC/.test(rd), "read: German news, samples, simplify, TTS");
  ok(/reading:news\|reading:newsq/.test(W("web/boot.js")), "read: today's news cached per language");
  const ls = W("web/listen.js");
  ok(/OFF = \(\) => \{ const A = OFF_ALL\(\), o = \{\}; for \(const id in A\) if \(SM\[/.test(ls) && /if \(!ok\(id\)\) \{ openId = null; view = "home"/.test(ls) && /x\.ser !== ser && SM\[x\.ser\]\) \{/.test(ls), "listen: other language's downloads / last episode don't break the page"); ok(/const SER = \(DE \? SER_DE :/.test(ls) && /\["dw", "📰 慢速新闻"/.test(ls) && /AI\.ask\("lquiz", \{ lang: RL\(\)/.test(ls) && !/lang: "en"/.test(ls), "listen: DW series, German scoring");
  ok(/sl = o\.sl \|\| VLS\(\)/.test(W("web/tr.js")), "tr: source language follows VL");
  ok(!/if\(DE\)SECS\.listen=/.test(W("web/tabs.js")) && /DE_OFF=\{\}/.test(W("web/tabs.js")), "tabs: speak/read/write/sme/video/exam in German");
  { const X = W("web/exam.js"); ok(/AI\.ask\("exam", \{ lang: LGC/.test(X) && /TFL = DE \? \{ TRUE: "Richtig"/.test(X) && /\["dw"\] : \["sme", "ree"\]/.test(X) && /pc \+ "%"/.test(X), "exam: Goethe mock (German questions, DW, tagesschau, %)"); }
  { const src = W("web/_worker.js"); ok(/de \? EXAM_READ_SYS_DE : EXAM_READ_SYS/.test(src) && /de \? EXAM_LISTEN_SYS_DE : EXAM_LISTEN_SYS/.test(src) && /examClean\(o, mode, text, de\)/.test(src), "exam prompts German"); }
  ok(/langOk = x => \(DE \? \/\^de\/i/.test(W("web/watch.js")) && /lang: String\(d\.lang \|\| "en"\)\.slice\(0, 8\)/.test(W("web/_worker.js")), "video: list split by language");
  ok(/DE \? "\/corpus-de\.json" : "\/corpus\.json"/.test(W("web/corpus.js")) && fs.existsSync(path.join(__dirname, "..", "web", "corpus-de.json")), "corpus: German file");
  // ---- 后台：提示词按 lang；DW 走 /api/sme；查词、例句（假网络）----
  const Wk = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default, kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => kv.set(k, String(v)), delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) };
  const seen = [], of = globalThis.fetch;
  globalThis.fetch = async (u, o) => { u = String(u); seen.push(u);
    if (/learngerman\.dw\.com\/de\/langsam/.test(u)) return new Response('<a href="/de/23112026-langsam-gesprochene-nachrichten/a-80017572">x</a>');
    if (/learngerman\.dw\.com\/de\/x\/a-80017572/.test(u)) return new Response('<title>23.11.2026 – Langsam | DW</title><source src="https://radiodownloaddw-a.akamaihd.net/x/langsamenachrichten/a.mp3"><div data-testid="richtext-content-container"><h2>Titel</h2><p>Die Regierung macht etwas.</p></article>');
    if (/tatoeba\.org.*from=deu/.test(u)) return new Response(JSON.stringify({ results: [{ text: "Das Haus ist groß.", translations: [[{ lang: "cmn", script: "Hans", text: "房子很大。" }]] }, { text: "Hau ab!", translations: [[{ lang: "cmn", text: "滚。" }]] }] }));
    if (/wiktionary\.org\/api\/rest_v1\/page\/definition\/Haus/.test(u)) return new Response(JSON.stringify({ de: [{ partOfSpeech: "Noun", definitions: [{ definition: "house" }] }] }));
    if (/wiktionary\.org\/w\/api\.php/.test(u)) return new Response(JSON.stringify({ parse: { wikitext: "==German==\n{{IPA|de|[haʊ̯s]}}\n{{de-noun|n,,^er}}\n==Dutch==" } }));
    if (/wiktionary/.test(u)) return new Response("{}", { status: 404 });
    if (/translate|mymemory/.test(u)) return new Response(JSON.stringify({ sentences: [{ trans: "房子" }], dict: [] }));
    return new Response("{}", { status: 404 }); };
  const env = { CAPTIONS: KV }, call = async p => { const r = await Wk.fetch(new Request("https://x.test" + p), env, { waitUntil() {} }); return [r.status, await r.json()]; };
  let [st, j] = await call("/api/sme?s=dw"); ok(st === 200 && j.list[0].id === "dw/80017572" && j.list[0].p === "", "sme?s=dw lists DW with dw/ ids");
  [st, j] = await call("/api/sme?ep=dw/80017572"); ok(j.ok && j.s === "dw" && j.mp3.includes("langsamenachrichten") && j.lines[0].t === "Die Regierung macht etwas.", "sme?ep=dw/… opens DW episode");
  [st, j] = await call("/api/sme?zh=1&co=1&ep=dw/80017572"); ok(j.ok === false && j.error === "not cached", "DW translation cache-only");
  [st, j] = await call("/api/sent?lang=de&w=haus"); ok(j.ok && j.items.length === 1 && j.items[0].en === "Das Haus ist groß." && kv.has("s/de/haus"), "sent?lang=de: German, filtered, own cache key");
  [st, j] = await call("/api/dict?lang=de&w=Haus"); ok(j.ok && j.gender === "das" && j.phon === "[haʊ̯s]" && j.en[0].def === "house" && kv.has("d/de/haus"), "dict?lang=de: gender, IPA, definition");
  [st, j] = await call("/api/dict?lang=de&w=" + encodeURIComponent("schön")); ok(st !== 400, "dict?lang=de accepts umlauts");
  globalThis.fetch = of;
  const src = W("web/_worker.js");
  for (const k of ["WRITE_SYS_DE", "CHAT_SYS_DE", "CHATSUM_SYS_DE", "SPEAKRATE_SYS_DE", "HOWTO_SYS_DE", "USEWORD_SYS_DE", "JUDGE_SYS_DE", "COACH_SYS_DE", "NEWSIMP_SYS_DE", "LQUIZ_SYS_DE", "WHYMISS_SYS_DE"]) ok(new RegExp("isDe\\(b\\) \\? " + k.replace("_DE", "_DE") + "\\b|de \\? " + k + "\\b|\\(isDe\\(b\\) \\? " + k).test(src), "AI " + k + " used when lang=de");
  ok(/NEWS_FEEDS_DE = \[\["tagesschau"/.test(src) && /key = "news\/" \+ \(de \? "de\/" : ""\)/.test(src), "news?lang=de: tagesschau, own cache key");
  // 🧪 德语词汇量测试：vt-de.js 每段 ≥ 25 个原形词、排名在段内、假词 40 个；出题 9 段 × 5 + 8 假词
  { const c = { window: {} }; vm.createContext(c); vm.runInContext(W("web/vt-de.js"), c); const V = c.window.VT_DE, St = require(path.join(__dirname, "..", "web", "stats.js"));
    ok(V && V.pool.length === 9 && V.pool.every((b, i) => b.length >= 25 && b.every(([w, r]) => r >= St.VT_BANDS[i][0] && r <= St.VT_BANDS[i][1] && /^\p{L}+$/u.test(w))) && V.fake.length >= 40, "vt-de pool valid");
    const qs = St.vtBuildPool(Math.random, V.pool, V.fake); ok(qs.length === 53 && qs.filter(q => q.b < 0).length === 8, "German test: 53 questions incl. 8 fakes");
    ok(St.vtLevel(3000, true).cefr === "B1" && St.vtLevel(3000, true).ielts === "" && St.vtLevel(3000).ielts !== "", "German level without IELTS"); }
  console.log(fail ? fail + " FAILED" : "t86 de align: all ok"); process.exit(fail ? 1 : 0);
})();
