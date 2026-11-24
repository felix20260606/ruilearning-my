/* 🎓 雅思「🎧 听力模考」「📄 阅读模考」（雅思页的前两个小标签）
   - 📄 阅读：材料 = 今日新闻（/api/news，同「📰 读」那篇；也能换当天别的头条 /api/readurl），自动分成 A–H 段；
     AI 按雅思 Academic Reading 出 13 题：5 道 TRUE / FALSE / NOT GIVEN、3 道「哪一段讲了…」、3 道摘要填空（原文里 1–3 个词）、2 道四选一；限时 20 分钟（真考 3 篇 60 分钟）
   - 🎧 听力：材料 = BBC Learning English 的节目原声和文稿（/api/sme：6 分钟英语、慢速对话）；AI 出 10 题：6 道笔记填空、4 道三选一，按听到的顺序；
     先给 30 秒看题，然后原声只放一遍（「练习模式」可以拖动、重放）；放完或点「交卷」打分
   - 🎙 雅思对话 / 独白（听力的另外四种材料）：AI 写的 Section 1 生活对话（订房、报名…：拼名字、电话、日期、价格、地址）/ Section 2 生活独白（导游、活动介绍）/ Section 3 学术讨论 / Section 4 学术讲座，
     POST /api/ai {task:"ieltsscript", sec, done}（后台存成题库，先给没做过的）；A 男声 orion、B 女声 luna，逐句用 /api/tts 读（看题的 30 秒里先把每句的声音预取好）
     选哪种材料记在本机「exam:lsrc」（bbc | s1 | s2 | s3 | s4；Section 2 生活独白 = 女声 luna，Section 4 学术讲座 = 男声 orion）
   - 出题：POST /api/ai {task:"exam", mode, text, title}（后台检查每道题、填空答案确实在原文里；同一篇出过的题存 KV，再做不花额度）
   - 打分：按答对比例换算成 40 题的原始分，再按雅思官方的原始分 → 分数对照表给一个估分（只有一篇 / 一段，仅供参考）
   - 做错的题收进「❌ 错题本」（errbook.js 的 window.ERR）；成绩存本机「exam:hist」（最多 50 次），同步到后台 /api/mine k=exam
   入口：window.examShow(el, "listening" | "reading")
   依赖 index.html 的全局（有才用）：toast、speak；listen.js 播放器、watch.js 的 videoCore（开始放原声前先停掉别的声音） */
(function () {
  "use strict";
  const { esc, LG, LS, tip } = U; // 全站共用的小工具（util.js）
  const nday = () => U.day(); // 📅 全站共用的「今天」（util.js），和后台的新闻日期一致
  // 🇩🇪 学德语（window.VL === "de"）：这一页是「🎓 歌德」模考——听力材料 DW 慢速新闻、阅读材料 tagesschau 今日新闻，AI 用德语按歌德题型出题
  //   （判断题 Richtig / Falsch / Steht nicht im Text、段落信息、填空、选择）；按答对比例打分，60% 及格（同歌德证书）；雅思的 AI 对话 / 独白（英语 AI 声）不出现
  const DE = window.VL === "de", LGC = DE ? "de" : "en";
  const norm = DE ? s => String(s || "").normalize("NFC").replace(/(\d)\.(?=\d{3}(\D|$))/g, "$1").toLowerCase().replace(/ß/g, "ss").replace(/[’']/g, "'").replace(/[^\p{L}0-9' ]+/gu, " ").replace(/\s+/g, " ").trim() : s => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  const noArt = s => norm(s).replace(DE ? /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines) / : /^(the|a|an) /, "");
  const words = s => (String(s).match(DE ? /[\p{L}0-9'’-]+/gu : /[A-Za-z0-9'’-]+/g) || []).length;
  const TFL = DE ? { TRUE: "Richtig", FALSE: "Falsch", "NOT GIVEN": "Steht nicht im Text" } : { TRUE: "TRUE", FALSE: "FALSE", "NOT GIVEN": "NOT GIVEN" }; // 判断题按钮上显示的字（存的还是 TRUE / FALSE / NOT GIVEN）
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  // 雅思官方：40 题原始分 → 分数
  const BAND_L = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]];
  const BAND_R = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]];
  const bandOf = (mode, got, n) => { if (DE) { const pc = n ? Math.round(got / n * 100) : 0; return { raw: pc, band: pc + "%", pass: pc >= 60 }; } const raw = n ? Math.round(got / n * 40) : 0, T = mode === "listening" ? BAND_L : BAND_R; return { raw, band: (T.find(x => raw >= x[0]) || [0, 0])[1] }; }; // 德语：百分比，60% 及格
  window.examBand = bandOf; // 测试用

  /* ---------- 成绩：本机 exam:hist + 后台 /api/mine k=exam ---------- */
  const hist = () => { const h = LG("exam:hist", []); return Array.isArray(h) ? h : []; };
  function saveHist(r) {
    const h = hist().filter(x => x.id !== r.id); h.unshift(r); LS("exam:hist", h.slice(0, 50));
    CL.put(r.id, r, r.at);
  }
  const CL = CLOUD.chan("exam"); // 全站共用的同步（cloud.js）
  function pull() {
    return CL.pull().then(items => {
      if (!items) return; const j = { items }, h = hist(), have = new Set(h.map(x => x.id)); let ch = false;
      for (const id in j.items || {}) { const x = j.items[id]; if (x && !x.del && x.v && !have.has(id)) { h.push(x.v); ch = true; } }
      if (ch) { h.sort((a, b) => b.at - a.at); LS("exam:hist", h.slice(0, 50)); if (root && S.view === "home") draw(); }
    });
  }

  /* ---------- 材料 ---------- */
  // 新闻分段：按空行 / 换行分，太短的并到前一段，分成 4–8 段，每段前面加 A B C …；最多取约 1000 词
  function sections(text) {
    let ps = String(text || "").split(/\n\s*\n|\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(p => words(p) >= 4);
    const out = []; let n = 0;
    for (const p of ps) { if (n > 1000) break; n += words(p); out.push(p); }
    const want = Math.max(4, Math.min(8, Math.round(n / 120)));
    const per = n / want, S = []; let cur = "", cw = 0;
    for (const p of out) { cur = cur ? cur + " " + p : p; cw += words(p); if (cw >= per * 0.85 && S.length < want - 1) { S.push(cur); cur = ""; cw = 0; } }
    if (cur) { if (S.length && cw < per * 0.35) S[S.length - 1] += " " + cur; else S.push(cur); }
    return S.slice(0, 8).map((p, i) => ({ L: "ABCDEFGH"[i], t: p }));
  }
  window.examSections = sections; // 测试用

  /* ---------- 状态 ---------- */
  const LSRC = DE ? { bbc: "📰 DW 慢速新闻" } : { bbc: "📻 BBC 节目", s1: "🎙 S1 生活对话", s2: "🎙 S2 生活独白", s3: "🎙 S3 学术讨论", s4: "🎙 S4 学术讲座" };
  const secOf = () => +String(S.lsrc).slice(1) || 1;
  const VOICE = { A: "orion", B: "luna" };
  const ttsUrl = l => "/api/tts?v=" + (S.src && S.src.sec === 2 ? "luna" : VOICE[l.who] || "asteria") + "&t=" + encodeURIComponent(String(l.t).replace(/[{}]/g, "").replace(/\s+/g, " ").trim());
  const S = { lsrc: LG("exam:lsrc", "bbc") in LSRC ? LG("exam:lsrc", "bbc") : "bbc", mode: "reading", view: "home", src: null, busy: "", err: "", Q: null, ans: {}, t0: 0, left: 0, res: null, practice: false, phase: "" };
  let root = null, timer = 0, audio = null;
  const CSS = `
  #exam{max-width:860px;margin:0 auto;color:var(--ui-ink);font-family:var(--ui-font);overflow-wrap:anywhere}
  #exam h2{margin:4px 0 6px;font-size:21px}#exam .ex-sub{color:var(--ui-muted);font-size:13.5px;line-height:1.65;margin:0 0 12px}
  #exam .ex-box{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:16px;padding:14px 16px;margin:0 0 12px}
  #exam .ex-box h3{margin:0 0 8px;font-size:15.5px}
  #exam .ex-src b{display:block;font-size:17px;margin:2px 0 4px}#exam .ex-src small{color:var(--ui-muted)}
  #exam .ex-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}#exam .ex-row .sp{flex:1}
  #exam .ex-bar{position:sticky;top:138px;z-index:5;display:flex;gap:10px;align-items:center;background:var(--ui-surface-2);border:1px solid var(--ui-line-2);border-radius:12px;padding:8px 12px;margin:0 0 12px}
  @media(min-width:1024px){#exam .ex-bar{top:96px}}
  #exam .ex-bar .tm{font-variant-numeric:tabular-nums;font-weight:800;font-size:17px}#exam .ex-bar .tm.low{color:var(--ui-red)}#exam .ex-bar .sp{flex:1}
  #exam .ex-pass p{margin:0 0 12px;line-height:1.75;font-size:16px}#exam .ex-pass p b{display:inline-block;min-width:22px;color:var(--ui-pur-text)}
  #exam .ex-grid{display:grid;gap:12px}@media(min-width:1024px){#exam .ex-grid.two{grid-template-columns:1fr 1fr;align-items:start}#exam .ex-grid.two .ex-pass{max-height:calc(100vh - 220px);overflow:auto;position:sticky;top:150px}}
  #exam .ex-q{padding:10px 0;border-bottom:1px solid var(--ui-line)}#exam .ex-q:last-child{border-bottom:0}
  #exam .ex-q .qt{font-size:15px;line-height:1.6;margin-bottom:6px}#exam .ex-q .qt i{color:var(--ui-muted);font-style:normal;margin-right:6px}
  #exam .ex-ch{display:flex;flex-wrap:wrap;gap:6px}#exam .ex-ch button{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;padding:6px 11px;font:inherit;font-size:14px;cursor:pointer;text-align:left}
  #exam .ex-ch button.on{border-color:var(--ui-pur);background:var(--ui-pur-soft);color:var(--ui-pur-text);font-weight:700}
  #exam .ex-ch.col{flex-direction:column}
  #exam input.ex-in{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;padding:7px 10px;font:inherit;font-size:15px;width:200px;max-width:100%}
  #exam .ex-r{margin-top:6px;font-size:14px;line-height:1.65}#exam .ex-r .ok{color:var(--ui-green);font-weight:800}#exam .ex-r .no{color:var(--ui-red);font-weight:800}#exam .ex-r .why{color:var(--ui-ink-2)}
  #exam .ex-band{display:flex;gap:16px;align-items:center;flex-wrap:wrap}#exam .ex-band .b{font-size:44px;font-weight:900;color:var(--ui-pur-text);line-height:1}#exam .ex-band small{color:var(--ui-muted);display:block}
  #exam .ex-h{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--ui-line);font-size:14px}#exam .ex-h:last-child{border-bottom:0}#exam .ex-h b{min-width:38px;color:var(--ui-pur-text)}#exam .ex-h span{flex:1;min-width:0}#exam .ex-h small{color:var(--ui-muted)}
  #exam .ex-pick{display:grid;gap:8px}#exam .ex-pick button{display:flex;gap:10px;text-align:left;align-items:center;border:1px solid var(--ui-line);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:12px;padding:8px 10px;font:inherit;font-size:14px;cursor:pointer}#exam .ex-pick button:hover{border-color:var(--ui-pur)}#exam .ex-pick button small{color:var(--ui-muted);display:block}
  #exam .ex-pick img{width:72px;height:41px;border-radius:6px;object-fit:cover;flex:0 0 auto}
  #exam .ex-tr{font-size:14px;line-height:1.7;color:var(--ui-ink-2)}#exam .ex-tr div{margin:0 0 4px}#exam .ex-tr mark{background:var(--ui-green-soft);color:inherit;border-radius:3px;padding:0 2px}
  #exam .ex-err{color:var(--ui-red);font-size:14px;margin:8px 0}
  `;
  function css() { if (document.getElementById("exam-css")) return; const s = document.createElement("style"); s.id = "exam-css"; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- 题目列表（统一编号） ---------- */
  function qlist(Q) {
    if (!Q) return [];
    if (Q.mode === "reading") return [].concat(
      (Q.tfng || []).map((x, i) => ({ k: "t" + i, type: "tfng", grp: DE ? "Richtig / Falsch / Steht nicht im Text：这句话和文章说的一致、相反，还是文章没说？" : "TRUE / FALSE / NOT GIVEN：这句话和文章说的一致（TRUE）、相反（FALSE），还是文章没说（NOT GIVEN）？", s: x.s, a: x.a, why: x.why_zh, p: x.p })),
      (Q.match || []).map((x, i) => ({ k: "m" + i, type: "match", grp: "下面的信息在哪一段？（字母 " + (Q.letters || []).join(" ") + "）", s: x.s, a: x.a, why: x.why_zh, p: x.a })),
      (Q.gaps || []).map((x, i) => ({ k: "g" + i, type: "gap", grp: DE ? "摘要填空：每空不超过三个词，照原文写（名词大写、带变音）" : "摘要填空：每空不超过三个词，词必须来自原文", s: x.s, a: x.a, why: x.why_zh })),
      (Q.mcq || []).map((x, i) => ({ k: "c" + i, type: "mcq", grp: "选择题：选一个正确答案", s: x.q, opts: x.opts, a: x.ans, why: x.why_zh })));
    return [].concat(
      (Q.notes || []).map((x, i) => ({ k: "n" + i, type: "gap", grp: "笔记填空：每空不超过三个词和 / 或一个数字", s: x.s, a: x.a, why: x.why_zh })),
      (Q.mcq || []).map((x, i) => ({ k: "c" + i, type: "mcq", grp: "选择题：选一个正确答案", s: x.q, opts: x.opts, a: x.ans, why: x.why_zh })));
  }
  // 数字写成词也算对：twenty seventeen = 2017、nine am = 9am、fifteenth = 15th、thirty dollars = $30、twenty five percent = 25%
  const NW = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    first: 1, second: 2, third: 3, fifth: 5, eighth: 8, ninth: 9, twelfth: 12, twentieth: 20, thirtieth: 30 };
  const nw = w => w in NW ? NW[w] : /^(\w+?)(th)$/.test(w) && (w.slice(0, -2) in NW) ? NW[w.slice(0, -2)] : null;
  function numNorm(s) {
    const T = norm(String(s || "").replace(/(\d),(?=\d{3})/g, "$1")).replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/(\d)([a-z])/g, "$1 $2").split(" ").filter(w => w && !/^(the|a|an|dollars?|pounds?|euros?|percent|per|cent|o'clock|of)$/.test(w));
    const out = []; let run = [];
    const flush = () => {
      if (!run.length) return;
      if (run.some(w => w === "hundred" || w === "thousand" || w === "million")) { let tot = 0, cur = 0; run.forEach(w => { if (w === "hundred") cur = (cur || 1) * 100; else if (w === "thousand" || w === "million") { tot += (cur || 1) * (w === "thousand" ? 1e3 : 1e6); cur = 0; } else if (w !== "and") cur += nw(w); }); out.push(String(tot + cur)); }
      else { const ch = []; run.filter(w => w !== "and").forEach(w => { const n = nw(w), p = ch.length - 1; if (p >= 0 && ch[p] >= 20 && ch[p] % 10 === 0 && n < 10) ch[p] += n; else ch.push(n); }); out.push(ch.length === 2 && ch[0] >= 10 && ch[1] >= 10 ? String(ch[0] * 100 + ch[1]) : ch.join(" ")); }
      run = [];
    };
    T.forEach(w => { if (nw(w) != null || ((w === "hundred" || w === "thousand" || w === "million" || w === "and") && run.length)) run.push(w); else { flush(); out.push(w); } });
    flush(); return out.join(" ");
  }
  window.examNum = numNorm; // 测试用
  const right = (q, v) => q.type === "gap" ? !!v && (noArt(v) === noArt(q.a) || norm(v) === norm(q.a) || numNorm(v) === numNorm(q.a)) : q.type === "mcq" ? v === q.a : !!v && String(v).toUpperCase() === String(q.a).toUpperCase();
  window.examRight = right; // 测试用
  const shown = (q, v) => q.type === "mcq" ? (v == null ? "（没选）" : String.fromCharCode(65 + v) + ". " + q.opts[v]) : v ? String(q.type === "tfng" ? TFL[v] || v : v) : "（没答）";
  const answer = q => q.type === "mcq" ? String.fromCharCode(65 + q.a) + ". " + q.opts[q.a] : q.type === "tfng" ? TFL[q.a] || q.a : q.a;

  /* ---------- 准备材料、出题 ---------- */
  const getJson = (u, o) => U.json(u, o); // util.js：网络不通也不抛错，给 { ok:false }
  async function loadNews(url) {
    S.busy = "取新闻…"; S.err = ""; draw();
    try {
      let j;
      if (url) { j = await getJson("/api/readurl?url=" + encodeURIComponent(url)); if (j && j.ok) j = Object.assign({}, S.src && S.src.list ? { list: S.src.list } : {}, j, { url }); }
      else { const c = LG("reading:news", null); j = c && c.date === nday() && c.text ? c : await getJson("/api/news?d=" + nday() + (DE ? "&lang=de" : "")); } // reading:news 按语言分开存（boot.js）
      if (!j || !j.ok || !j.text) throw new Error((j && j.error) || "没取到");
      const secs = sections(j.text); if (secs.length < 4) throw new Error("这篇太短，换一篇试试");
      S.src = { kind: "news", id: "r:" + (j.url || j.title), title: j.title || "", url: j.url || "", from: j.src || "", list: j.list || (S.src && S.src.list) || [], secs, words: secs.reduce((n, s) => n + words(s.t), 0) };
    } catch (e) { S.err = "新闻没取到：" + (e.message || e) + "。过一会儿再试，或点「换一篇」"; }
    S.busy = ""; draw();
  }
  let EPL = null;
  async function loadEpList() {
    if (EPL) return EPL;
    const out = [];
    for (const s of DE ? ["dw"] : ["sme", "ree"]) { try { const j = await getJson("/api/sme?s=" + s); if (j && j.ok) (j.list || []).slice(0, 12).forEach(x => out.push(Object.assign({ s }, x))); } catch (e) {} }
    EPL = out; return out;
  }
  async function loadEp(id) {
    S.busy = "取节目…"; S.err = ""; draw();
    try {
      const j = await getJson("/api/sme?ep=" + encodeURIComponent(id));
      if (!j || !j.ok || !j.mp3 || !(j.lines || []).length) throw new Error((j && j.error) || "这期没有文稿");
      S.src = { kind: "sme", id: "l:" + id, ep: id, title: j.title || "", mp3: j.mp3, lines: j.lines, words: j.lines.reduce((n, l) => n + words(l.t), 0) };
    } catch (e) { S.err = "节目没取到：" + (e.message || e); }
    S.busy = ""; draw();
  }
  async function loadScript(fresh) {
    const sec = secOf();
    S.busy = fresh ? "AI 在写一段新的雅思" + (sec % 2 ? "对话" : "独白") + "（半分钟左右）…" : "取一段雅思" + (sec % 2 ? "对话" : "独白") + "…"; S.err = ""; draw();
    try {
      const done = hist().filter(x => /^i:/.test(x.src || "")).map(x => x.src.slice(2));
      const j = await AI.ask("ieltsscript", { sec, done, fresh: !!fresh });
      if (!j.ok || !(j.lines || []).length) throw new Error(AI.msg(j, "AI 没写好，再试一次"));
      S.src = { kind: "ai", sec, id: "i:" + j.id, title: "Section " + sec + " · " + j.title, scene: j.scene_zh || "", lines: j.lines.map(l => ({ who: l.who, name: l.name, t: l.t })), left: j.left || 0, words: j.lines.reduce((n, l) => n + words(l.t), 0) };
    } catch (e) { S.err = e.message || String(e); }
    S.busy = ""; draw();
  }
  async function gen(again) {
    if (!S.src) return;
    S.busy = "AI 在出题（第一次要半分钟左右）…"; S.err = ""; draw();
    const text = S.mode === "reading" ? S.src.secs.map(s => s.L + " " + s.t).join("\n\n") : S.src.lines.map(l => (l.name || l.who || "Speaker") + ": " + l.t).join("\n");
    try {
      const j = await AI.ask("exam", { lang: LGC, mode: S.mode, text, title: S.src.title, again: !!again, kind: S.src.kind === "ai" ? "s" + S.src.sec : "" });
      if (!j.ok) throw new Error(j.error === "too short" ? "材料太短" : AI.msg(j, "AI 没出好题，再点一次试试"));
      S.Q = j; S.ans = {}; S.res = null; S.view = "do"; S.t0 = Date.now();
      if (S.mode === "reading") { S.left = 20 * 60; tick(); }
      else { S.phase = "read"; S.left = 30; tick(); prefetch(); }
    } catch (e) { S.err = e.message || String(e); }
    S.busy = ""; draw();
  }

  /* ---------- 计时、放音 ---------- */
  function stopAll() { clearInterval(timer); timer = 0; pre++; if (audio) { try { audio.onended = null; audio.onerror = null; audio.pause(); } catch (e) {} } }
  function tick() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!root || !root.isConnected || root.offsetParent === null) { if (S.mode === "reading" || S.phase === "read") return; } // 切走时阅读计时暂停（听力原声照放）
      if (S.mode === "reading" || S.phase === "read") {
        S.left--; paintTime();
        if (S.left <= 0) { if (S.mode === "reading") submit(true); else startAudio(); }
      } else paintTime();
    }, 1000);
  }
  function paintTime() {
    const el = root && root.querySelector(".ex-bar .tm"); if (!el) return;
    if (S.mode === "listening" && S.phase === "play" && audio) { el.textContent = S.src.kind === "ai" ? "🔊 第 " + Math.min(li + 1, S.src.lines.length) + " / " + S.src.lines.length + " 句" : "🔊 " + mmss(audio.currentTime || 0) + " / " + mmss(audio.duration || 0); el.classList.remove("low"); return; }
    el.textContent = (S.phase === "read" ? "看题 " : "⏱ ") + mmss(S.left); el.classList.toggle("low", S.left <= (S.phase === "read" ? 5 : 120));
  }
  // AI 对话：看题时先把每句的声音生成好（同一句后台有缓存，浏览器也会缓存），开放时就不卡
  let pre = 0;
  function prefetch() {
    if (!S.src || S.src.kind !== "ai") return; const my = ++pre, L = S.src.lines.slice(); let i = 0;
    const next = () => { if (my !== pre || i >= L.length) return; fetch(ttsUrl(L[i++])).then(r => r.blob()).catch(() => {}).then(next); };
    next(); next(); next();
  }
  let li = 0;
  function playLine() {
    if (!audio || S.view !== "do") return;
    const L = S.src.lines; if (li >= L.length) { S.phase = "end"; draw(); return; }
    audio.src = ttsUrl(L[li]); audio.playbackRate = 1; audio.play().catch(() => tip("点一下「▶ 开始放」"));
    paintTime();
  }
  function startAudio() {
    S.phase = "play";
    if (!audio) { audio = MEDIA.reg(new Audio()); audio.preload = "auto"; if (window.NET) NET.audio(audio); }
    MEDIA.solo(audio); // 全站共用的放音（media.js）：别的声音都停掉
    if (S.src.kind === "ai") {
      li = 0; audio.onended = () => { li++; setTimeout(playLine, 450); }; audio.onerror = () => { li++; setTimeout(playLine, 200); };
      audio.onplaying = () => { if (S.view === "do" && !S.practice && root && root.querySelector('[data-a="resume"]')) { collect(); draw(); } };
      playLine(); draw(); return;
    }
    audio.onerror = null;
    audio.src = window.NET ? NET.src(S.src.mp3) : S.src.mp3; audio.currentTime = 0; audio.onplaying = () => { if (S.view === "do" && !S.practice && root && root.querySelector('[data-a="resume"]')) { collect(); draw(); } };
    audio.onended = () => { if (S.view === "do" && S.mode === "listening") { S.phase = "end"; draw(); } };
    audio.play().catch(() => tip("点一下页面上的「▶ 开始放」"));
    draw();
  }

  /* ---------- 交卷、打分 ---------- */
  function collect() { root && root.querySelectorAll("input.ex-in").forEach(i => { S.ans[i.dataset.k] = i.value.trim(); }); }
  async function submit(auto) {
    collect(); const L = qlist(S.Q);
    if (!auto && L.some(q => S.ans[q.k] == null || S.ans[q.k] === "") && !(await U.ask("还有题没答，确定交卷吗？", { ok: "交卷" }))) return; // ✅ 全站共用的弹窗（util.js）
    if (S.res) return; // 等回答的时候时间到了、已经自动交卷了
    stopAll();
    const got = L.filter(q => right(q, S.ans[q.k])).length, B = bandOf(S.mode, got, L.length);
    S.res = { got, n: L.length, raw: B.raw, band: B.band, secs: Math.round((Date.now() - S.t0) / 1000) };
    S.view = "res";
    const id = "x" + Date.now().toString(36);
    saveHist({ id, at: Date.now(), mode: S.mode, title: S.src.title, src: S.src.id, got, n: L.length, band: B.band, secs: S.res.secs });
    if (window.ERR) {
      const ctxOf = q => S.mode === "reading" ? (q.p ? "原文 " + q.p + " 段：" + ((S.src.secs.find(s => s.L === q.p) || {}).t || "").slice(0, 300) : "出自：" + S.src.title) : lineOf(q) || "出自：" + S.src.title;
      window.ERR.add(L.filter(q => !right(q, S.ans[q.k])).map(q => q.type === "mcq" ? { src: "exam", kind: "mcq", q: q.s, opts: q.opts, ans: q.a, ctx: ctxOf(q), why: q.why }
        : q.type === "gap" ? { src: "exam", kind: "gap", q: q.s, right: q.a, wrong: S.ans[q.k] || "", ctx: ctxOf(q), why: q.why }
        : { src: "exam", kind: "mcq", q: q.type === "tfng" ? (DE ? "Richtig / Falsch / Steht nicht im Text：" : "TRUE / FALSE / NOT GIVEN：") + q.s : "哪一段？" + q.s, opts: q.type === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"].map(o => TFL[o]) : S.Q.letters || [], ans: (q.type === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : S.Q.letters || []).indexOf(q.a), ctx: ctxOf(q), why: q.why }).filter(x => x.kind !== "mcq" || x.ans >= 0));
    }
    draw(); window.scrollTo(0, 0);
  }
  // 听力：答案在文稿哪一句
  function lineOf(q) { if (S.mode !== "listening" || q.type !== "gap") return ""; const a = norm(q.a); const l = (S.src.lines || []).find(x => (" " + norm(x.t) + " ").includes(" " + a + " ")); return l ? (l.name || l.who ? (l.name || l.who) + "：" : "") + l.t : ""; }

  /* ---------- 画界面 ---------- */
  function homeHtml() {
    const H = hist().filter(x => x.mode === S.mode), isR = S.mode === "reading"; let s0 = "";
    if (DE) s0 = "<h2>" + (isR ? "📄 歌德阅读模考" : "🎧 歌德听力模考") + '</h2><div class="ex-sub">' + (isR
      ? "用今天的 tagesschau 新闻当文章，AI 按歌德考试的题型用德语出题（Richtig / Falsch / Steht nicht im Text、哪一段讲了…、摘要填空、选择），限时 20 分钟。按答对比例打分，60% 及格（同歌德证书），做错的自动进「❌ 错题本」。"
      : "材料是 DW 慢速新闻（真人原声）。AI 用德语出 10 题（笔记填空 / 选择），先给 30 秒看题，只放一遍（「练习模式」可以暂停、重放）。按答对比例打分，60% 及格，做错的自动进「❌ 错题本」。") + "</div>";
    let s = DE ? s0 : "<h2>" + (isR ? "📄 雅思阅读模考" : "🎧 雅思听力模考") + "</h2><div class=\"ex-sub\">" + (isR
      ? "用今天的真实新闻当文章，AI 按雅思 Academic Reading 出 13 题（判断对错 / 段落信息 / 摘要填空 / 选择），限时 20 分钟。交卷后按雅思原始分对照表估分，做错的自动进「❌ 错题本」。"
      : "材料五选一：BBC 节目原声，或者 AI 写的雅思四个 Section：S1 生活对话（拼名字、电话、日期、地址——最容易丢分）/ S2 生活独白（导游、活动介绍）/ S3 学术讨论 / S4 学术讲座，AI 真人声来读。出 10 题（填空 / 选择），先给 30 秒看题，只放一遍，和真考一样。做错的自动进「❌ 错题本」。") + "</div>";
    if (!isR && !DE) s += '<div class="ex-ch" style="margin:0 0 12px">' + Object.keys(LSRC).map(k => '<button data-lsrc="' + k + '" class="' + (S.lsrc === k ? "on" : "") + '">' + LSRC[k] + "</button>").join("") + "</div>";
    if (S.err) s += '<div class="ex-err">' + esc(S.err) + "</div>";
    if (S.busy) s += '<div class="ex-box">' + esc(S.busy) + "</div>";
    else if (S.src && S.src.kind === (isR ? "news" : S.lsrc === "bbc" ? "sme" : "ai") && (S.src.kind !== "ai" || S.src.sec === secOf())) {
      const ai = S.src.kind === "ai";
      s += '<div class="ex-box ex-src"><small>' + (isR ? "今天的文章" + (S.src.from ? " · " + esc(S.src.from) : "") : ai ? "雅思" + (S.src.sec % 2 ? "对话" : "独白") + " · " + esc(S.src.scene) : "这期节目") + "</small><b>" + esc(S.src.title) + "</b><small>" + S.src.words + " 词" + (isR ? " · 分成 " + S.src.secs.length + " 段" : ai ? " · 约 " + Math.max(2, Math.round(S.src.words / 150)) + " 分钟 · 题库里还有 " + S.src.left + " 套没做过" : " · 约 6 分钟") + "</small>" +
        '<div class="ex-row"><button class="ui-btn pri" data-a="start">开始' + (isR ? "（20 分钟）" : "") + "</button>" + (isR ? "" : '<label style="font-size:13.5px;color:var(--ui-ink-2)"><input type="checkbox" data-a="prac"' + (S.practice ? " checked" : "") + "> 练习模式（可以暂停、重放）</label>") + '<span class="sp"></span>' + (S.src.kind === "ai" ? '<button class="ui-btn" data-a="fresh" title="让 AI 现写一段（每段约 3,000 neurons 的朗读额度）">✨ 写一段新的</button>' : '<button class="ui-btn" data-a="other">🎲 换一' + (isR ? "篇" : "期") + "</button>") + "</div></div>";
    } else s += '<div class="ex-box">准备材料…</div>';
    if (S.pick) s += S.pick;
    if (H.length) s += '<div class="ex-box"><h3>📈 我的成绩（最近 ' + Math.min(H.length, 20) + " 次）</h3>" + H.slice(0, 20).map(x => '<div class="ex-h"><b>' + x.band + "</b><span>" + esc(x.title || "") + "<small><br>" + new Date(x.at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " · 答对 " + x.got + " / " + x.n + " · 用时 " + mmss(x.secs || 0) + "</small></span></div>").join("") + "</div>";
    return s;
  }
  function qHtml(q, i, done) {
    const v = S.ans[q.k]; let s = '<div class="ex-q"><div class="qt"><i>' + (i + 1) + ".</i>" + esc(q.s).replace(/_{2,}/, "<b>________</b>") + "</div>";
    if (!done) {
      if (q.type === "gap") s += '<input class="ex-in" data-k="' + q.k + '" value="' + esc(v || "") + '" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="答案">';
      else if (q.type === "tfng") s += '<div class="ex-ch">' + ["TRUE", "FALSE", "NOT GIVEN"].map(o => '<button data-k="' + q.k + '" data-v="' + o + '" class="' + (v === o ? "on" : "") + '">' + TFL[o] + "</button>").join("") + "</div>";
      else if (q.type === "match") s += '<div class="ex-ch">' + (S.Q.letters || []).map(o => '<button data-k="' + q.k + '" data-v="' + o + '" class="' + (v === o ? "on" : "") + '">' + o + "</button>").join("") + "</div>";
      else s += '<div class="ex-ch col">' + q.opts.map((o, oi) => '<button data-k="' + q.k + '" data-n="' + oi + '" class="' + (v === oi ? "on" : "") + '">' + String.fromCharCode(65 + oi) + ". " + esc(o) + "</button>").join("") + "</div>";
    } else {
      const ok = right(q, v);
      s += '<div class="ex-r">' + (ok ? '<span class="ok">✅ 对</span>　' + esc(answer(q)) : '<span class="no">❌ 错</span>　你答：' + esc(shown(q, v)) + "　正确：<b>" + esc(answer(q)) + "</b>") + (q.p && S.mode === "reading" ? "　（" + q.p + " 段）" : "") + (q.why ? '<div class="why">' + esc(q.why) + "</div>" : "") + (S.mode === "listening" && lineOf(q) ? '<div class="why">🎧 原话：' + esc(lineOf(q)) + "</div>" : "") + "</div>";
    }
    return s + "</div>";
  }
  function qsHtml(done) {
    const L = qlist(S.Q); let s = "", g = "";
    L.forEach((q, i) => { if (q.grp !== g) { if (g) s += "</div>"; g = q.grp; s += '<div class="ex-box"><h3>' + esc(g) + "</h3>"; } s += qHtml(q, i, done); });
    return s + (g ? "</div>" : "");
  }
  function passHtml() { return '<div class="ex-box ex-pass"><h3>' + esc(S.src.title) + "</h3>" + S.src.secs.map(s => "<p><b>" + s.L + "</b> " + esc(s.t) + "</p>").join("") + "</div>"; }
  function doHtml() {
    const isR = S.mode === "reading";
    let bar = '<div class="ex-bar"><span class="tm"></span><span class="sp"></span>';
    if (!isR && S.phase === "read") bar += '<button class="ui-btn" data-a="play">▶ 现在就放</button>';
    if (!isR && S.phase === "play" && S.practice) bar += '<button class="ui-btn" data-a="back5">' + (S.src.kind === "ai" ? "⏪ 这句再听" : "⏪ 5 秒") + '</button><button class="ui-btn" data-a="pause">⏯</button>';
    if (!isR && S.phase === "play" && audio && audio.paused && !S.practice) bar += '<button class="ui-btn" data-a="resume">▶ 开始放</button>';
    bar += '<button class="ui-btn pri" data-a="submit">交卷</button><button class="ui-btn" data-a="quit" title="不交卷，回到开头">✕</button></div>';
    if (isR) return bar + '<div class="ex-grid two">' + passHtml() + "<div>" + qsHtml(false) + "</div></div>";
    return bar + (S.phase === "read" ? '<div class="ex-sub">先花 30 秒看题，时间到了自动开始放（只放一遍）。</div>' : S.phase === "end" ? '<div class="ex-sub">放完了，检查一下答案再交卷。</div>' : "") + qsHtml(false);
  }
  function resHtml() {
    const R = S.res, isR = S.mode === "reading";
    let s = '<div class="ex-box"><div class="ex-band"><div><small>' + (DE ? "得分" : "估分") + '</small><span class="b">' + R.band + "</span></div><div>答对 <b>" + R.got + " / " + R.n + "</b>" + (DE ? "（" + (R.raw >= 60 ? "✅ 达到 60% 及格线" : "还差一点：60% 及格") + "）" : "（换算成 40 题约 " + R.raw + " 题）") + "<small>用时 " + mmss(R.secs) + "。只有" + (isR ? "一篇文章" : "一段录音") + "，分数仅供参考；做错的 " + (R.n - R.got) + " 题已收进「❌ 错题本」。</small></div></div>" +
      '<div class="ex-row"><button class="ui-btn pri" data-a="home">再做一套</button>' + (R.n - R.got ? '<button class="ui-btn" data-a="errbook">去错题本复习</button>' : "") + '<button class="ui-btn" data-a="redo">同一篇重做</button></div></div>';
    s += qsHtml(true);
    if (isR) s += passHtml();
    else s += '<div class="ex-box"><h3>📜 文稿（绿色是答案）</h3><div class="ex-tr">' + S.src.lines.map(l => { let t = esc(l.t); qlist(S.Q).filter(q => q.type === "gap").forEach(q => { const qa = esc(q.a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); t = DE ? t.replace(new RegExp("(^|[^\\p{L}])(" + qa + ")(?![\\p{L}])", "iu"), "$1<mark>$2</mark>") : t.replace(new RegExp("\\b(" + qa + ")\\b", "i"), "<mark>$1</mark>"); /* 德语：\\b 认不出 ä ö ü ß */ }); return "<div>" + (l.name || l.who ? "<b>" + esc(l.name || l.who) + "</b>：" : "") + t + "</div>"; }).join("") + "</div></div>";
    return s;
  }
  function draw() {
    if (!root) return; css();
    root.innerHTML = '<div id="exam">' + (S.view === "do" && S.Q ? doHtml() : S.view === "res" && S.res ? resHtml() : homeHtml()) + "</div>";
    paintTime();
  }
  async function pickOther() {
    if (S.mode === "reading") {
      const L = (S.src && S.src.list) || [];
      if (!L.length) { tip("今天没有别的头条"); return; }
      S.pick = '<div class="ex-box"><h3>选一篇</h3><div class="ex-pick">' + L.slice(0, 15).map((x, i) => '<button data-pk="' + i + '">' + esc(x.t) + "<small>" + esc(x.s || "") + "</small></button>").join("") + "</div></div>";
    } else {
      S.pick = '<div class="ex-box">取节目列表…</div>'; draw();
      const L = await loadEpList(), done = new Set(hist().map(x => x.src));
      S.pick = '<div class="ex-box"><h3>选一期（' + (DE ? "DW 慢速新闻" : "6 分钟英语 / 慢速对话") + '）</h3><div class="ex-pick">' + L.map((x, i) => '<button data-ep="' + i + '">' + (x.img ? '<img src="' + esc(x.img) + '" alt="">' : "") + "<span>" + esc(x.t) + "<small>" + (x.s === "dw" ? "📰 DW 慢速新闻" : x.s === "ree" ? "🐢 慢速对话" : "📻 6 分钟英语") + " · " + esc(x.d || "") + (done.has("l:" + x.id) ? " · ✓ 做过" : "") + "</small></span></button>").join("") + "</div></div>";
    }
    draw();
  }
  async function firstSource() {
    if (S.mode === "reading") { if (!S.src || S.src.kind !== "news") await loadNews(); return; }
    if (S.lsrc !== "bbc") { if (!(S.src && S.src.kind === "ai" && S.src.sec === secOf())) await loadScript(false); return; }
    if (S.src && S.src.kind === "sme") return;
    S.busy = "取节目…"; draw();
    const L = await loadEpList(), done = new Set(hist().map(x => x.src)), x = L.find(e => e.s === (DE ? "dw" : "sme") && !done.has("l:" + e.id)) || L[0];
    S.busy = ""; if (!x) { S.err = "节目列表没取到，过一会儿再试"; draw(); return; }
    await loadEp(x.id);
  }
  function onClick(e) {
    const b = e.target.closest("button,input[type=checkbox]"); if (!b || !root.contains(b)) return;
    const a = b.dataset.a;
    if (a === "prac") { S.practice = b.checked; return; }
    if (b.dataset.k && S.view === "do") { collect(); const q = qlist(S.Q).find(x => x.k === b.dataset.k); if (!q) return; S.ans[q.k] = b.dataset.n != null ? +b.dataset.n : b.dataset.v; b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); return; } // 不整页重画：免得左边文章滚动位置、输入框焦点丢掉
    if (b.dataset.pk != null) { const x = S.src.list[+b.dataset.pk]; S.pick = ""; loadNews(x.u); return; }
    if (b.dataset.ep != null) { const x = EPL[+b.dataset.ep]; S.pick = ""; loadEp(x.id); return; }
    if (b.dataset.lsrc) { if (S.busy) return; S.lsrc = b.dataset.lsrc; LS("exam:lsrc", S.lsrc); S.pick = ""; S.err = ""; draw(); return firstSource(); }
    if (a === "fresh") return loadScript(true);
    if (a === "start") return gen(false);
    if (a === "other") return pickOther();
    if (a === "play") { clearInterval(timer); timer = 0; startAudio(); tick(); return; }
    if (a === "resume" && audio) { audio.play().catch(() => {}); return draw(); }
    if (a === "pause" && audio) { audio.paused ? audio.play() : audio.pause(); return; }
    if (a === "back5" && audio) { if (S.src.kind === "ai") { li = Math.max(0, li - (audio.currentTime < 1.5 ? 1 : 0)); playLine(); } else audio.currentTime = Math.max(0, audio.currentTime - 5); return; }
    if (a === "submit") return submit(false);
    if (a === "quit") { U.ask("不交卷了？这次的答案不保存。", { ok: "不交了", danger: true }).then(ok => { if (!ok) return; stopAll(); S.view = "home"; S.Q = null; draw(); }); return; }
    if (a === "home") { S.view = "home"; S.Q = null; S.res = null; S.src = null; draw(); return firstSource(); }
    if (a === "redo") { S.ans = {}; S.res = null; S.view = "do"; S.t0 = Date.now(); if (S.mode === "reading") { S.left = 20 * 60; } else { S.phase = "read"; S.left = 30; } tick(); return draw(); }
    if (a === "errbook") { if (window.enShow) window.enShow("notebook"); setTimeout(() => { const m = document.querySelector('.modes button[data-mode="err"]'); if (m) m.click(); }, 50); return; }
  }
  window.examShow = function (el, mode) {
    if (!el) return;
    if (root !== el) { root = el; el.addEventListener("click", onClick); el.addEventListener("input", e => { if (e.target.matches("input.ex-in")) S.ans[e.target.dataset.k] = e.target.value; }); }
    mode = mode === "listening" ? "listening" : "reading";
    if (S.mode !== mode) {
      if (S.view === "do") { // 正在做的这套还没交卷：先回到那一页，问清楚再切（✅ 全站共用的弹窗，util.js）
        const back = S.mode === "listening" ? "lexam" : "rexam", to = mode === "listening" ? "lexam" : "rexam";
        if (window.ieltsSub) window.ieltsSub(back);
        U.ask("正在做的这套还没交卷，切过去就作废了。确定吗？", { ok: "作废，切过去", danger: true }).then(ok => { if (!ok) return; stopAll(); S.view = "home"; S.Q = null; if (window.ieltsSub) window.ieltsSub(to); else window.examShow(el, mode); });
        return;
      }
      stopAll(); S.mode = mode; S.view = "home"; S.src = null; S.Q = null; S.res = null; S.pick = ""; S.err = ""; }
    draw(); pull();
    if (S.view === "home") firstSource();
  };
  // 打开网页时雅思页已经停在模考（index.html 先恢复了标签，这个文件后加载）：补画一次
  const v = document.getElementById("ielts-exam-view");
  if (v && v.style.display === "block") { let s = ""; try { s = localStorage.getItem("ielts_sub") || ""; } catch (e) {} window.examShow(v, s === "lexam" ? "listening" : "reading"); }
})();
