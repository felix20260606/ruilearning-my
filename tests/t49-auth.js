// 写入保护 /api/auth + 大改动要口令；雅思模考出题的检查（examClean 通过 /api/ai task:exam，用假 AI）；/api/mine 的 err / exam
// 用假的 KV、假的 AI 直接跑 web/_worker.js（Node 18+，不联网，不碰线上数据）
const path = require("path");
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  let aiOut = null, aiCalls = 0;
  const env = { CAPTIONS: KV, AI: { run: async () => { aiCalls++; return { response: JSON.stringify(aiOut) }; } } };
  const call = async (p, method = "GET", body, key) => {
    const h = { "content-type": "application/json" }; if (key) h["x-key"] = key;
    const r = await W.fetch(new Request("https://x.test" + p, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) }), env, {});
    return { status: r.status, j: await r.json() };
  };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  const ent = (i, extra) => Object.assign({ id: "v_w" + i, word: "w" + i, zh: "词" + i }, extra || {});

  // ---- 没设口令：一切照旧 ----
  let r = await call("/api/auth"); ok(r.j.ok && r.j.set === false, "auth get " + JSON.stringify(r.j));
  r = await call("/api/vocab", "POST", { add: Array.from({ length: 30 }, (_, i) => ent(i)) }); ok(r.j.ok && r.j.added === 30, "add 30");
  r = await call("/api/vocab", "POST", { patch: { deleted: ["v_w0", "v_w1", "v_w2", "v_w3", "v_w4", "v_w5", "v_w6", "v_w7", "v_w8", "v_w9", "v_w10", "v_w11", "v_w12", "v_w13", "v_w14", "v_w15", "v_w16", "v_w17", "v_w18", "v_w19", "v_w20", "v_w21"] } });
  ok(r.j.ok && r.j.changed, "no key set: big delete allowed");
  r = await call("/api/vocab", "POST", { add: Array.from({ length: 30 }, (_, i) => ent(100 + i)) });

  // ---- 设口令 ----
  r = await call("/api/auth", "POST", { set: "short" }); ok(r.status === 400, "too short");
  r = await call("/api/auth", "POST", { set: "correct horse 42" }); ok(r.j.ok && r.j.set, "set " + JSON.stringify(r.j));
  ok(!JSON.stringify(kv.get("auth")).includes("correct horse"), "stored hashed");
  r = await call("/api/auth", "POST", { set: "another key 99" }); ok(r.status === 403 && r.j.error === "needkey", "change without key refused");
  r = await call("/api/auth", "GET", null, "correct horse 42"); ok(r.j.set && r.j.valid, "valid key");
  r = await call("/api/auth", "GET", null, "wrong key 000"); ok(r.j.set && !r.j.valid, "wrong key");

  // ---- 平时的写入不用口令 ----
  r = await call("/api/vocab", "POST", { add: [ent(500)] }); ok(r.j.ok && r.j.added === 1, "add without key ok");
  r = await call("/api/vocab", "POST", { patch: { srs: { v_w500: { b: 1, at: Date.now() } }, deleted: ["v_w100"] } }); ok(r.j.ok && r.j.changed, "patch small delete ok");
  const cur = (await call("/api/vocab")).j;
  r = await call("/api/vocab", "POST", { v: 2, state: Object.assign({}, cur, { custom: cur.custom.map((e, i) => i < 3 ? Object.assign({}, e, { zh: "改" + i, u: Date.now() }) : e) }) }); ok(r.j.ok && r.j.changed, "state rewrite 3 ok " + JSON.stringify(r.j).slice(0, 120));

  // ---- 大改动要口令 ----
  const many = Array.from({ length: 25 }, (_, i) => "v_w" + (101 + i));
  r = await call("/api/vocab", "POST", { patch: { deleted: many } }); ok(r.status === 403 && r.j.why === "big", "big delete refused " + JSON.stringify(r.j));
  ok((await call("/api/vocab")).j.custom.some(e => e.id === "v_w110"), "not deleted");
  r = await call("/api/vocab", "POST", { patch: { deleted: many } }, "correct horse 42"); ok(r.j.ok && r.j.changed, "big delete with key ok");
  const cur2 = (await call("/api/vocab")).j;
  r = await call("/api/vocab", "POST", { replace: cur2 }); ok(r.status === 403 || (r.j.ok && !r.j.changed), "replace (no change) " + r.status);
  r = await call("/api/vocab", "POST", { replace: { custom: [] } }); ok(r.status === 403 && r.j.why === "replace", "replace refused");
  r = await call("/api/vocab", "POST", { v: 2, state: Object.assign({}, cur2, { custom: cur2.custom.map(e => Object.assign({}, e, { zh: "乱改" })) }) });
  ok(r.status === 403 || cur2.custom.length <= 60, "mass rewrite refused (" + cur2.custom.length + " entries) " + r.status);
  // 当天累计：分几次删，每次 ≤ 20，超过 40 就要口令
  const left = (await call("/api/vocab")).j.custom.map(e => e.id);
  let blocked = false;
  for (let k = 0; k < 5 && !blocked; k++) { const d = left.slice(k * 12, k * 12 + 12); if (!d.length) break; r = await call("/api/vocab", "POST", { patch: { deleted: d } }); if (r.status === 403) { blocked = r.j.why === "day"; } }
  ok(blocked || left.length < 48, "daily cap " + left.length);

  // ---- 插件数据、个人资料、字幕、家人 ----
  const ch = {}; for (let i = 0; i < 40; i++) ch["sav|w" + i] = { v: { t: i }, at: Date.now() };
  r = await call("/api/ext", "POST", { changes: ch }); ok(r.j.ok && r.j.changed, "ext add 40");
  const dl = {}; for (let i = 0; i < 35; i++) dl["sav|w" + i] = { del: 1, at: Date.now() + 1 };
  r = await call("/api/ext", "POST", { changes: dl }); ok(r.status === 403, "ext big delete refused");
  r = await call("/api/ext", "POST", { changes: { "sav|w1": { del: 1, at: Date.now() + 2 } } }); ok(r.j.ok && r.j.changed, "ext small delete ok");
  r = await call("/api/ext", "POST", { replace: { items: {} } }); ok(r.status === 403, "ext replace refused");
  r = await call("/api/mine", "POST", { k: "err", changes: { e1: { v: { right: "x" }, at: 1 } } }); ok(r.j.ok && r.j.items.e1, "mine err");
  r = await call("/api/mine", "POST", { k: "exam", changes: { x1: { v: { band: 6 }, at: 1 } } }); ok(r.j.ok && r.j.items.x1, "mine exam");
  r = await call("/api/cap?v=abcdefghijk", "DELETE"); ok(r.status === 403, "cap delete refused");
  r = await call("/api/cap?v=abcdefghijk", "DELETE", null, "correct horse 42"); ok(r.j.ok, "cap delete with key");
  r = await call("/api/users", "POST", { add: "Kid" }); ok(r.j.ok, "users add ok");
  r = await call("/api/users", "POST", { rename: { id: r.j.user.id, name: "K2" } }); ok(r.status === 403, "users rename refused");
  r = await call("/api/auth", "POST", { set: "another key 99" }, "correct horse 42"); ok(r.j.ok, "change key with key");
  r = await call("/api/auth", "GET", null, "another key 99"); ok(r.j.valid, "new key valid");

  // ---- 模考出题：不合格的题扔掉 ----
  const passage = ["A Cities around the world are planting more trees to cool their streets during summer heatwaves.", "B In Melbourne, the council has set a goal of forty percent canopy cover by 2040.", "C Scientists say shade from trees can lower surface temperatures by up to twenty degrees.", "D However, some residents complain that roots damage pavements and drains.", "E The cost of maintaining urban forests is also rising quickly."].map(p => p + " " + "Officials in many places believe that the benefits clearly outweigh the costs over the long term for public health and comfort. ".repeat(4)).join("\n\n");
  aiOut = { tfng: [{ s: "Melbourne wants 40% canopy.", a: "TRUE", p: "B", why_zh: "B段" }, { s: "Trees raise temperatures.", a: "FALSE", p: "C" }, { s: "Tokyo plants trees.", a: "NOT GIVEN" }, { s: "bad", a: "MAYBE" }, { s: "Roots cause damage.", a: "true", p: "d" }],
    match: [{ s: "a cost problem", a: "E" }, { s: "a complaint", a: "D" }, { s: "bad letter", a: "Z" }],
    gaps: [{ s: "Melbourne aims for ____ cover.", a: "canopy" }, { s: "Shade lowers ____.", a: "surface temperatures" }, { s: "Not in text ____", a: "solar panels" }],
    mcq: [{ q: "Why plant trees?", opts: ["cool streets", "sell wood", "attract birds", "block wind"], ans: 0 }, { q: "bad", opts: ["a", "b"], ans: 0 }] };
  r = await call("/api/ai", "POST", { task: "exam", mode: "reading", text: passage, title: "Trees" });
  ok(r.j.ok && r.j.tfng.length === 4 && r.j.match.length === 2 && r.j.gaps.length === 2 && r.j.mcq.length === 1, "exam clean " + JSON.stringify(r.j).slice(0, 300));
  ok(r.j.tfng[3] && r.j.tfng[3].a === "TRUE" && r.j.tfng[3].p === "D", "tfng normalised");
  ok(r.j.letters.join("") === "ABCDE", "letters");
  const n0 = aiCalls; r = await call("/api/ai", "POST", { task: "exam", mode: "reading", text: passage }); ok(r.j.ok && r.j.cached && aiCalls === n0, "exam cached");
  aiOut = { tfng: [], match: [], gaps: [], mcq: [] }; r = await call("/api/ai", "POST", { task: "exam", mode: "reading", text: passage + " extra words here" }); ok(r.status === 502, "too few questions → error");
  const tr = Array.from({ length: 40 }, (_, i) => (i % 2 ? "Neil: " : "Beth: ") + "Today we talk about sleep and the number " + (i + 7) + " because scientists in Oslo found something interesting.").join("\n");
  aiOut = { notes: [{ s: "Scientists were based in ____.", a: "Oslo" }, { s: "Topic: ____", a: "sleep" }, { s: "Number ____", a: "12" }, { s: "Bad ____", a: "Paris" }, { s: "They found something ____.", a: "interesting" }], mcq: [{ q: "Who?", opts: ["Neil", "Beth", "Both"], ans: 2 }, { q: "x", opts: ["a", "b", "c"], ans: 1 }, { q: "y", opts: ["a", "b", "c"], ans: 0 }, { q: "z", opts: ["a", "b", "c", "d"], ans: 0 }] };
  r = await call("/api/ai", "POST", { task: "exam", mode: "listening", text: tr });
  ok(r.j.ok && r.j.notes.length === 4 && r.j.mcq.length === 4, "listening clean " + JSON.stringify(r.j).slice(0, 200));

  // ---- 雅思对话（Section 1 / 3）：检查、存题库、先给没做过的 ----
  const turn = (w, i) => ({ who: i % 2 ? "B" : "A", name: i % 2 ? "Sarah" : "Tom", t: "Well I would like to book a room for " + (i + 2) + " nights please and my surname is Thompson, T-H-O-M-P-S-O-N, okay." });
  aiOut = { title: "Hotel booking", scene_zh: "订酒店", lines: Array.from({ length: 16 }, turn).concat([{ who: "C", t: "bad speaker" }]) };
  let calls0 = aiCalls;
  r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 1 });
  ok(r.j.ok && r.j.lines.length === 16 && r.j.lines[0].name === "Tom" && r.j.id && r.j.sec === 1 && aiCalls === calls0 + 1, "script " + JSON.stringify(r.j).slice(0, 200));
  const sid = r.j.id; ok(kv.has("ix/1/" + sid), "stored in bank");
  r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 1 }); ok(r.j.ok && r.j.cached && r.j.id === sid && aiCalls === calls0 + 1, "bank reused");
  await new Promise(res => setTimeout(res, 5));
  r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 1, done: [sid] }); ok(r.j.ok && !r.j.cached && r.j.id !== sid, "done → new one");
  r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 3 }); ok(r.j.ok && r.j.sec === 3 && kv.has("ix/3/" + r.j.id), "section 3 separate bank");
  aiOut = { title: "x", lines: [{ who: "A", t: "too short" }] }; r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 1, fresh: true }); ok(r.status === 502, "short script rejected");

  // ---- 答案就写在题目里的填空不要 ----
  aiOut = { notes: [{ s: "Oslo scientists were based in ____.", a: "Oslo" }, { s: "Topic: ____", a: "sleep" }, { s: "Number ____", a: "12" }, { s: "They found something ____.", a: "interesting" }, { s: "Speakers talk about ____.", a: "sleep" }, { s: "From ____ to ____", a: "sleep" }], mcq: [{ q: "Who?", opts: ["Neil", "Beth", "Both"], ans: 2 }, { q: "Where?", opts: ["Oslo", "Paris", "Rome"], ans: 0 }, { q: "What?", opts: ["sleep", "food", "work"], ans: 0 }, { q: "How many?", opts: ["7", "8", "9"], ans: 0 }] };
  r = await call("/api/ai", "POST", { task: "exam", mode: "listening", text: tr, kind: "s2" });
  ok(r.j.ok && r.j.notes.length === 4 && !r.j.notes.some(x => x.a === "Oslo"), "self-answer gap dropped " + JSON.stringify(r.j.notes || r.j));

  // ---- Section 2 / 4 独白：只有一个人，段落少一些也行 ----
  const para = i => ({ who: i % 2 ? "B" : "A", name: "Linda", t: "OK so now let me tell you about the museum, which opens at 9.30 every day except Monday, and the ticket costs £12 for adults, which includes the guided tour of the old library and the garden behind it." });
  aiOut = { title: "Museum talk", scene_zh: "博物馆介绍", lines: Array.from({ length: 9 }, (_, i) => para(i)) };
  r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 2, fresh: true });
  ok(r.j.ok && r.j.sec === 2 && r.j.lines.length === 9 && r.j.lines.every(l => l.who === "A") && kv.has("ix/2/" + r.j.id), "section 2 monologue " + JSON.stringify(r.j).slice(0, 160));
  r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 4, fresh: true }); ok(r.j.ok && r.j.sec === 4, "section 4");
  aiOut = { title: "x", lines: Array.from({ length: 3 }, (_, i) => para(i)) }; r = await call("/api/ai", "POST", { task: "ieltsscript", sec: 4, fresh: true }); ok(r.status === 502, "too short monologue rejected");

  // ---- 🤔 为什么没听出来 ----
  const sent = "I wanted to get a bit of fresh air, you know.";
  aiOut = { items: [{ chunk: "wanted to", sounds: "wan-ta", kind_zh: "连读", why_zh: "t 被吞掉" }, { chunk: "not in sentence", sounds: "x", why_zh: "x" }, { chunk: "a bit of", sounds: "ə-bi-də", kind_zh: "弱读", why_zh: "of 弱读" }], tip_zh: "多跟读" };
  calls0 = aiCalls; r = await call("/api/ai", "POST", { task: "whymiss", sent, typed: "I want to get fresh air", missed: ["wanted", "a", "bit", "of"] });
  ok(r.j.ok && r.j.items.length === 2 && r.j.items[0].chunk === "wanted to" && r.j.tip_zh, "whymiss " + JSON.stringify(r.j).slice(0, 200));
  r = await call("/api/ai", "POST", { task: "whymiss", sent, typed: "other", missed: ["wanted", "a", "bit", "of"] }); ok(r.j.ok && r.j.cached && aiCalls === calls0 + 1, "whymiss cached");
  r = await call("/api/ai", "POST", { task: "whymiss", sent, missed: [] }); ok(r.status === 400, "whymiss needs missed words");

  // ---- 🧩 听后小测 ----
  const q4 = (q, ans) => ({ q, opts: ["a", "b", "c", "d"], ans, why_zh: "原文…" });
  aiOut = { quiz: [q4("Main topic?", 0), q4("Detail?", 3), q4("Bad?", 7), q4("Attitude?", 1), q4("Meaning?", 2), { q: "three opts", opts: ["a", "b", "c"], ans: 0 }] };
  calls0 = aiCalls; r = await call("/api/ai", "POST", { task: "lquiz", title: "Sleep", text: tr });
  ok(r.j.ok && r.j.quiz.length === 4 && r.j.quiz[1].ans === 3, "lquiz " + JSON.stringify(r.j).slice(0, 200));
  r = await call("/api/ai", "POST", { task: "lquiz", title: "Sleep", text: tr }); ok(r.j.ok && r.j.cached && aiCalls === calls0 + 1, "lquiz cached");
  r = await call("/api/ai", "POST", { task: "lquiz", text: "too short" }); ok(r.status === 400, "lquiz too short");
  // ---- 📥 离线下载转 mp3：只转打开过（KV 里有）的那期 ----
  r = await call("/api/sme?mp3=" + encodeURIComponent("6-minute-english_2026/ep-999999")); ok(r.status === 409, "mp3 proxy needs a known episode");

  // ---- 🀄 翻译兜底：谷歌（和 MyMemory）全拦了 → Workers AI 翻译模型；它也翻不出的 → 大模型成批翻；谷歌拦了以后 10 分钟内不再去问 ----
  {
    const realFetch = globalThis.fetch, realRun = env.AI.run; let gCalls = 0;
    globalThis.fetch = async (u, o) => { const s = String((u && u.url) || u); if (/google|mymemory/.test(s)) { if (/google/.test(s)) gCalls++; return new Response("blocked", { status: 429 }); } return realFetch(u, o); };
    env.AI.run = async (m, o) => m.includes("m2m100") ? (/FAILM2M/.test(o.text) ? Promise.reject(new Error("x")) : { translated_text: "译:" + o.text }) : realRun(m, o);
    aiOut = { zh: ["你好。", "第二句"] };
    r = await call("/api/ai", "POST", { task: "tr", texts: ["Hello there.", "Second line.", ""] });
    ok(r.j.ok && r.j.zh[0] === "你好。" && r.j.zh[1] === "第二句" && r.j.zh[2] === "", "tr via big model " + JSON.stringify(r.j));
    const g1 = gCalls; aiOut = { nope: 1 }; r = await call("/api/ai", "POST", { task: "tr", texts: ["Good morning."] });
    ok(r.j.zh[0] === "译:Good morning." && gCalls === g1, "m2m100 fills, google skipped while down " + gCalls + " " + g1 + JSON.stringify(r.j));
    r = await call("/api/ai", "POST", { task: "tr", texts: ["FAILM2M line"] }); ok(!r.j.ok && r.j.zh[0] === "", "all failed → ok false");
    r = await call("/api/ai", "POST", { task: "tr", texts: [] }); ok(r.status === 400, "tr empty");
    globalThis.fetch = realFetch; env.AI.run = realRun;
  }

  // ---- 🇨🇳 /api/px 中转：只转名单里的网站和路径 ----
  r = await call("/api/px?u=" + encodeURIComponent("https://evil.example.com/x")); ok(r.status === 403, "px not allowed host");
  r = await call("/api/px?u=" + encodeURIComponent("https://en.wikipedia.org/wiki/Cat")); ok(r.status === 403, "px wikipedia only api.php");
  r = await call("/api/px?u=" + encodeURIComponent("http://ichef.bbci.co.uk/x.jpg")); ok(r.status === 403, "px https only");
  r = await call("/api/px?u=" + encodeURIComponent("https://ichef.bbci.co.uk/x.jpg"), "POST", {}); ok(r.status === 405, "px post only for languagetool");
  r = await call("/api/px?u=notaurl"); ok(r.status === 400, "px bad url");

  console.log(fail ? fail + " FAILED" : "t49 auth + exam: all passed");
  process.exit(fail ? 1 : 0);
})();
