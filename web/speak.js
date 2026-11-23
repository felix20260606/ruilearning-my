/* 英语「🗣 口语」：拿来就能练的口语课（内容在 speak-data.js 的 window.SPEAK_DATA，第一次打开才加载）
   八栏（新加的排前面）：
   - 📅 每日一练：每天自动排 1 段对话（角色扮演）+ 5 句跟读 + 1 个话题，三样做完算打卡，连续天数；练习次数记进「📊 统计」（本机 speak:log）
   - 🤖 AI 陪练：选场景或自由聊，你开口说（转文字）→ AI 回一句并朗读，顺手纠正你上一句的错；「结束并总结」给错误、地道说法（后台 /api/ai task=chat / chatsum）
   - 🎬 原声跟读：插件保存词句时录下的 YouTube 原声（/api/ext 的 med| 索引 + /api/media），听原声 → 跟读打分 → 回放对比
   - 🎭 情景对话：16 个场景，听全文（A、B 两个声音）、每句跟读打分、「角色扮演」你说 B 的台词（先看中文，说完对答案）
   - 💬 常用表达：20 类功能表达（打招呼、澄清、委婉不同意……），每条可听、可跟读、可加进生词本
   - 🔊 发音：12 组最小对立词（听音辨词小测 + 跟读）、30 条连读弱读
   - 🎯 跟读：120 句高频句，单句跟读打分，或「连续跟读」（每句播完留出时间跟着说）
   - 🗣 话题：40 张话题卡（日常、工作、生活在马来西亚、旅行、兴趣、观点），计时开口说、录音回放、看样例回答
   跟读打分：录音 → 后台 /api/stt（Workers AI 转文字）→ 没开时用浏览器自带的语音识别（Chrome / Edge / Safari；Brave 不行）→ 逐词对比
   本机存：speak:done（练过的标记，按家人分开）、speak:opt（语速、显示中文）、speak:sec（上次看的栏）
   依赖 index.html 的全局：toast、chosenVoice（「⚙ 设置」里选的朗读声音）、加词用 word.js 的 WORD.add */
(function () {
  "use strict";
  const { esc, LG, LS, tip } = U; // 全站共用的小工具（util.js）
  const SECS = [["start", "🌱 入门"], ["daily", "📅 每日一练"], ["chat", "🤖 AI 陪练"], ["tools", "🧰 AI 工具"], ["dialog", "🎭 情景对话"], ["func", "💬 表达和俚语"], ["drill", "🔁 句型操练"], ["pron", "🔊 发音"], ["shadow", "🎯 跟读"], ["clip", "🎬 原声跟读"], ["quick", "⚡ 快问快答"], ["topic", "🗣 话题"], ["mine", "📼 我的录音"]];

  const CSS = `
  #view-speak{display:none;padding-top:98px;background:var(--ui-bg,var(--bg));color:var(--ui-ink);min-height:100vh}
  html.show-speak #view-en{display:none}html.show-speak #view-speak{display:block}
  @media(min-width:1024px){#view-speak{padding-top:56px}}
  #speak{max-width:1100px;margin:0 auto;padding:18px 16px 80px;overflow-wrap:anywhere}#speak *{box-sizing:border-box}
  .sk-hd{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 16px;margin:6px 0 14px}.sk-hd h1{margin:0;font-size:26px;font-weight:900;color:var(--ui-ink)}
  .sk-hd p{margin:0;color:var(--ui-muted);font-size:13.5px;flex:1 1 260px}.sk-hd .sp{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .sk-seg{display:inline-flex;border:1px solid var(--ui-line-2);border-radius:10px;overflow:hidden}.sk-seg button{border:0;background:var(--ui-surface-2);color:var(--ui-ink-2);font:inherit;font-size:13px;padding:6px 11px;cursor:pointer}.sk-seg button.on{background:var(--ui-pur);color:#fff}
  .sk-chips{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;scrollbar-width:none}.sk-chips::-webkit-scrollbar{display:none}
  .sk-chips button{flex:0 0 auto;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer}
  .sk-chips button b{margin-left:5px;font-weight:600;color:var(--ui-muted);font-size:12.5px}.sk-chips button.on{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}.sk-chips button.on b{color:#fff}
  .sk-intro{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;margin-bottom:14px;color:var(--ui-ink-2);font-size:14px;line-height:1.6}
  .sk-intro b{color:var(--ui-ink)}
  .sk-grid{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:720px){.sk-grid{grid-template-columns:1fr 1fr}}@media(min-width:1024px){.sk-grid.three{grid-template-columns:1fr 1fr 1fr}}
  .sk-card{display:flex;align-items:center;gap:12px;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:13px 15px;cursor:pointer;transition:border-color .15s,background .15s;min-width:0;text-align:left;font:inherit;color:inherit;width:100%}
  .sk-card:hover{border-color:var(--ui-pur);background:var(--ui-surface-2)}.sk-card .t{flex:1 1 auto;min-width:0}
  .sk-card b{display:block;color:var(--ui-ink);font-size:15.5px;line-height:1.35}.sk-card span{display:block;color:var(--ui-muted);font-size:12.5px;margin-top:3px}
  .sk-card .pv{color:var(--ui-ink-2);font-size:13px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sk-card .ok{flex:0 0 auto;font-size:12px;color:var(--ui-green,#7CE3B8);border:1px solid currentColor;border-radius:999px;padding:1px 8px}
  .sk-card>i{font-style:normal;font-size:22px;color:var(--ui-muted)}
  .sk-tag{display:inline-block;font-size:11.5px;line-height:19px;padding:0 7px;border-radius:6px;background:var(--ui-pur-soft,rgba(156,63,208,.18));color:var(--ui-pur-text);margin-right:6px;vertical-align:1px}
  .sk-sub{margin:20px 0 10px;font-size:16px;font-weight:800;color:var(--ui-ink)}.sk-sub small{margin-left:8px;font-weight:500;color:var(--ui-muted);font-size:12.5px}
  .sk-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}.sk-bar .gap{flex:1 1 auto}
  .sk-title{margin:6px 0 4px;font-size:24px;line-height:1.3;color:var(--ui-ink)}.sk-title small{display:block;font-size:14px;color:var(--ui-muted);font-weight:500;margin-top:4px}
  .sk-scene{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:12px;padding:10px 13px;margin:10px 0 14px;font-size:14px;color:var(--ui-ink-2);line-height:1.6}
  .sk-lines{display:flex;flex-direction:column;gap:10px}
  .sk-ln{display:flex;gap:10px;align-items:flex-start;max-width:92%}.sk-ln.B{margin-left:auto;flex-direction:row-reverse}
  .sk-av{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:var(--ui-surface-3,#3a3d44);color:var(--ui-ink-2)}
  .sk-ln.B .sk-av{background:var(--ui-pur);color:#fff}
  .sk-bub{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:10px 13px;min-width:0;transition:box-shadow .2s,border-color .2s}
  .sk-ln.B .sk-bub{background:var(--ui-surface-2);border-color:var(--ui-line-2)}
  .sk-ln.cur .sk-bub{border-color:var(--ui-pur);box-shadow:0 0 0 3px rgba(156,63,208,.25)}
  .sk-en{font-size:17px;line-height:1.55;color:var(--ui-ink)}.sk-zh{font-size:13.5px;color:var(--ui-muted);margin-top:3px;line-height:1.5}
  .sk-hide .sk-zh{display:none}
  .sk-mask{color:var(--ui-muted);font-style:italic;font-size:14.5px}
  .sk-ops{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
  .sk-ib{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:9px;height:32px;min-width:34px;padding:0 9px;font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
  .sk-ib:hover{border-color:var(--ui-pur);color:var(--ui-ink)}.sk-ib.rec{border-color:var(--ui-red-line,#a44);color:var(--ui-red,#ff8080)}.sk-ib.rec.on{background:var(--ui-red,#e5484d);color:#fff;animation:skp 1s infinite}
  @keyframes skp{50%{opacity:.6}}
  .sk-res{margin-top:8px;font-size:14.5px;line-height:1.7}.sk-res .ok{color:var(--ui-green,#7CE3B8)}.sk-res .no{color:var(--ui-red,#ff8080);text-decoration:underline wavy;text-underline-offset:4px}
  .sk-res .x{color:var(--ui-muted);font-size:12.5px}.sk-res .sc{font-weight:800;margin-right:8px}.sk-res .said{color:var(--ui-muted);font-size:13px}
  .sk-res audio{height:32px;vertical-align:middle;max-width:100%}
  .sk-box{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:13px 15px;margin-top:14px}
  .sk-box h3{margin:0 0 8px;font-size:15px;color:var(--ui-ink)}
  .sk-ph{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--ui-line)}.sk-ph:first-of-type{border-top:0}
  .sk-ph .e{font-weight:700;color:var(--ui-ink);font-size:15px}.sk-ph .z{color:var(--ui-muted);font-size:13px;margin-top:2px}.sk-ph .t{flex:1 1 auto;min-width:0}
  .sk-tip{margin-top:12px;font-size:13.5px;color:var(--ui-ink-2);background:rgba(255,184,107,.08);border:1px solid rgba(255,184,107,.25);border-radius:10px;padding:9px 12px}
  .sk-item{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px}
  .sk-item .e{font-size:17px;font-weight:700;color:var(--ui-ink)}.sk-item .z{color:var(--ui-ink-2);font-size:14px;margin-top:3px}
  .sk-item .ex{margin-top:8px;padding:8px 10px;background:var(--ui-surface-2);border-radius:10px;font-size:14px;color:var(--ui-ink-2);line-height:1.6}.sk-item .ex small{display:block;color:var(--ui-muted);font-size:12.5px}
  .sk-reg{font-size:11px;border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:2px;font-weight:600}
  .sk-reg.r0{background:rgba(124,227,184,.14);color:#7CE3B8}.sk-reg.r1{background:rgba(111,211,255,.14);color:#6FD3FF}.sk-reg.r2{background:rgba(255,184,107,.14);color:#FFB86B}
  .sk-pairs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .sk-pair{display:flex;gap:6px}.sk-pair button{flex:1 1 0;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;min-height:44px;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
  .sk-pair button:hover{border-color:var(--ui-pur)}
  .sk-pair .sk-ai{margin-left:5px;font-size:10.5px;font-weight:800;color:var(--ui-muted);border:1px solid var(--ui-line-2);border-radius:999px;padding:0 5px;vertical-align:2px}
  .sk-h3n{margin-left:8px;font-size:12px;font-weight:600;color:var(--ui-muted)}
  .sk-cred{margin-top:10px;font-size:12px;color:var(--ui-muted);line-height:1.9}.sk-cred summary{cursor:pointer}.sk-cred a{color:var(--ui-pur-text)}.sk-cred small{margin-left:3px;opacity:.75}
  .sk-quiz{text-align:center;padding:16px}.sk-quiz .q{font-size:15px;color:var(--ui-ink-2);margin-bottom:12px}.sk-quiz .ch{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .sk-quiz .ch button{min-width:120px;min-height:52px;font-size:19px;font-weight:800;border-radius:12px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);cursor:pointer;font-family:inherit}
  .sk-quiz .ch button.r{background:rgba(124,227,184,.18);border-color:#7CE3B8}.sk-quiz .ch button.w{background:rgba(255,128,128,.16);border-color:#ff8080}
  .sk-quiz .sc{margin-top:10px;color:var(--ui-muted);font-size:13.5px}
  .sk-big{font-size:21px;line-height:1.5;color:var(--ui-ink);font-weight:700}
  .sk-timer{font-size:40px;font-weight:900;font-variant-numeric:tabular-nums;color:var(--ui-ink);text-align:center;margin:6px 0}.sk-timer.prep{color:var(--ui-orange,#FFB86B)}.sk-timer.go{color:var(--ui-red,#ff8080)}
  .sk-center{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px}
  .sk-sample{margin-top:10px;font-size:15.5px;line-height:1.75;color:var(--ui-ink)}
  .sk-empty{color:var(--ui-muted);text-align:center;padding:40px 0}
  .sk-note{color:var(--ui-muted);font-size:12.5px;margin-top:10px;line-height:1.6}
  .sk-stat{display:grid;grid-template-columns:1fr auto;gap:10px 18px;align-items:end;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;margin:0 0 14px}
  .sk-stat .tl[data-sec],.sk-stat .bars{cursor:pointer}.sk-stat .tls{display:flex;flex-wrap:wrap;gap:6px 18px}.sk-stat .tl b{display:block;font-size:20px;font-weight:900;color:var(--ui-ink);line-height:1.2}.sk-stat .tl span{font-size:12px;color:var(--ui-muted)}
  .sk-stat .bars{display:flex;gap:5px;height:58px;align-items:flex-end}.sk-stat .bars i{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;width:18px;height:100%;font-style:normal}
  .sk-stat .bars u{display:block;width:100%;min-height:3px;border-radius:4px 4px 2px 2px;background:var(--ui-pur);opacity:.55}.sk-stat .bars i.td u{opacity:1}.sk-stat .bars em{font-style:normal;font-size:11px;color:var(--ui-muted);margin-top:3px}
  .sk-stat .by{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12.5px;color:var(--ui-muted);border-top:1px solid var(--ui-line);padding-top:8px}.sk-stat .by b{color:var(--ui-ink)}
  @media(max-width:640px){.sk-stat{grid-template-columns:1fr}.sk-stat .tls{display:grid;grid-template-columns:repeat(3,1fr)}.sk-stat .bars{justify-content:space-between}.sk-stat .bars i{width:auto;flex:1}}
  @media(max-width:640px){.sk-hd h1{font-size:22px}.sk-title{font-size:21px}.sk-ln{max-width:100%}.sk-en{font-size:16px}.sk-ib{height:36px}}`;

  let root = null, D = null, loading = null;
  // 「🌱 入门」「🔊 发音」挪到了英语「🌱 入门」标签（index.html 的 SECS.basic，basic.js）：那边用 speakShow("start" / "pron") 只显示这一栏；「🗣 说」里不再列
  const MOVED = ["start", "pron"];
  let only = null; // 嵌在「🌱 入门」里时 = "start" / "pron"
  let sec = LG("speak:sec", ""); if (!SECS.some(s => s[0] === sec)) sec = "";
  let opt = Object.assign({ rate: 1, zh: true }, LG("speak:opt", {}));
  if (opt.voice) { if (opt.voice === "sys" && window.TTS) TTS.setMode("sys"); delete opt.voice; } // 声音开关搬到全站共用的 tts:mode
  let done = LG("speak:done", {});
  if (!sec || MOVED.includes(sec)) sec = "daily"; // 新手入门在「🌱 入门」标签
  let view = null; // 打开的条目：{t:"dialog"|"func"|"pair"|"conn"|"topic"|"sgrp", id}
  let shadowGroup = 0;
  const today = () => U.day(); // 📅 全站共用的「今天」（util.js，吉隆坡 / 北京时间）
  const dayStart = () => Date.parse(today() + "T00:00:00+08:00");
  // 练过：记时间（每日一练按「今天练过」算）；每次练习也记进 speak:log（📊 统计的热力日历、连续天数用）
  const markDone = k => { const now = Date.now(), again = done[k] && done[k] >= dayStart(); done[k] = now; LS("speak:done", done); syPut("done:" + k, now); if (!again) { const L = LG("speak:log", {}); L[today()] = (L[today()] || 0) + 1; LS("speak:log", L); syPut("log:" + today(), L[today()]); } };
  const doneToday = k => (done[k] || 0) >= dayStart();
  const isDone = k => !!done[k];

  function loadData() {
    if (window.SPEAK_DATA) { D = window.SPEAK_DATA; return Promise.resolve(); }
    if (!loading) loading = new Promise(res => { const s = document.createElement("script"); s.src = "speak-data.js?v=f592f75f"; /* ?v= 由 tools/bump-versions.js 按文件内容自动改 */ s.onload = s.onerror = res; document.head.append(s); }).then(() => { D = window.SPEAK_DATA || null; });
    return loading;
  }

  /* ---------- 朗读：全站共用的 tts.js（TTS.say 先 AI 真人声、不行系统语音；TTS.word 单词先放真人录音；A 用另一个声音） ---------- */
  const rateOf = o => (o.rate || opt.rate) * (o.slow ? 0.75 : 1);
  function say(text, o) { o = o || {}; if (window.TTS) TTS.say(text, { who: o.who, rate: rateOf(o), base: 1, lang: "en", end: o.end }); else if (o.end) o.end(true); }
  function hush() { if (window.TTS) TTS.hush(); }
  /* 「🔊 发音」最小对立词的真人录音：web/pron-real.json（tools/gen-pron.mjs 从维基词典找的 Wikimedia Commons 录音，CC BY-SA 等授权），播放在 tts.js 的 TTS.word */
  let REAL = null;
  function realLoad() { return TTS.realLoad().then(j => { if (!REAL) { REAL = j; if (view && view.t === "pair") draw(); } }); }
  const realOf = w => (window.TTS && TTS.realOf(w)) || null;
  function sayWord(w, o) { o = o || {}; TTS.word(w, { rate: rateOf(o), base: 1, lang: "en" }); }

  /* ---------- 录音和打分：全站共用的 rec.js（REC），同「🔊 练习」的跟读卡 ---------- */
  const toks = t => REC.toks(t, "en"), align = (target, said) => REC.score(target, said, { lang: "en" });
  const SR = REC.SR;
  const RES = {}; // key → {url, said, res, best, busy, noai, on}
  let myRec = null; // 口语页自己录的那条（离开口语页只停它，别的页面正在录的不管）
  const recOn = () => REC.cur() != null && REC.cur() === myRec;
  function recStop(cancel) { if (recOn()) REC.stop(cancel); }
  // key：这条的编号；target：要读的句子（话题卡没有目标句，只录音、转文字）；max：最长秒数；after：录完以后要做的事
  function recStart(key, target, max, after) {
    const x = () => (RES[key] = RES[key] || {}); myRec = key;
    // 每次录都换一个号：放弃 / 重录以后，上一次晚到的识别结果不会再盖上来
    const cur = x(), tok = REC.cur() === key ? cur.tok : (cur.tok = (cur.tok || 0) + 1), mine = () => x().tok === tok;
    if (REC.cur() !== key) { cur.err = ""; cur.busy = false; }
    REC.toggle(key, { lang: "en", max: max || 20, before: hush,
      start: () => { if (!mine()) return; x().on = true; x().err = ""; paintRec(key); },
      cancel: () => { if (!mine()) return; x().on = false; x().busy = false; paintRec(key); },
      fail: m => { if (!mine()) return; x().on = false; x().busy = false; x().err = m; paintRec(key); },
      busy: () => { if (!mine()) return; x().on = false; x().busy = true; paintRec(key); },
      done: y => { if (mine()) recDone({ key, target, after }, y); } });
  }
  // 放弃这一次（正在录 / 正在识别都行）：不打分、不存；again = 马上再录一次
  function recAbort(key, again) {
    const x = RES[key] = RES[key] || {};
    if (REC.cur() === key) REC.stop(true);
    x.tok = (x.tok || 0) + 1; x.on = false; x.busy = false; x.err = ""; paintRec(key);
    if (again) setTimeout(() => { const b = root && root.querySelector('[data-rec="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]'); if (b) b.click(); }, 400); // 等上一次的麦克风关掉
  }
  // 没识别出来的原因 → 给人看的话
  const recErrText = e => !e ? "" : e === "empty" ? "没录到声音：靠近一点、说大声一点再试；还不行就刷新页面（麦克风可能被别的程序占着）"
    : e === "timeout" ? "识别太慢没等到结果（网络慢？），点「🎙 再读」再试一次" : e === "net" ? "网络断了，识别没发出去：连上网再试"
    : /neuron|quota|limit|4006|exceeded/i.test(e) ? "今天的 AI 识别额度用完了（北京时间早上 8 点恢复）；录音还能回放" : "识别出错：" + e;
  function recDone(r, y) {
    const x = RES[r.key] = RES[r.key] || {}, blob = y.blob, text = y.text; x.on = false; x.err = text ? "" : y.err || "";
    if (y.url) { try { if (x.url) URL.revokeObjectURL(x.url); } catch (e) {} x.url = y.url; }
    if (y.noai) x.noai = true;
    x.busy = false; x.said = text;
    if (r.target) { x.res = text ? align(r.target, text) : null; if (x.res) x.best = Math.max(x.best || 0, x.res.score); }
    if (blob && (r.target || r.key.indexOf("t:") === 0)) archive(r.key, x, r.target, blob); // 存进「📼 我的录音」
    paintRec(r.key);
    if (r.after) r.after(x);
    // 跟读没读出来的词（一句里漏了 1–3 个、整体读对一半以上，才算「这个词读不准」）收进「❌ 错题本」
    if (r.target && x.res && window.ERR && x.res.score >= .5) { const miss = x.res.a.filter((w, i) => !x.res.hit[i] && w.length > 2); if (miss.length && miss.length <= 3) window.ERR.add([{ src: "pron", kind: "say", q: "听一遍，再大声读出来", ctx: r.target, right: r.target, why: "上次没读出来的词：" + miss.join(", ") }], true); }
  }
  // AI 点评里「可以说得更好」的句子收进「❌ 错题本」（原话 → 更好的说法）
  function fixesToErr(F, q) {
    if (!window.ERR || !Array.isArray(F)) return;
    window.ERR.add(F.filter(f => f && f.bad && f.good && String(f.bad).trim() !== String(f.good).trim()).slice(0, 8).map(f => ({ src: "speak", kind: "fix", q: "这句怎么说更地道？" + (q ? "（" + String(q).slice(0, 80) + "）" : ""), wrong: String(f.bad), right: String(f.good), why: f.why_zh || "" })));
  }
  const pct = v => Math.round((v || 0) * 100);
  function recBtn(key, target, max, label) { const x = RES[key] || {}; return '<button class="sk-ib rec' + (x.on ? " on" : "") + '" data-rec="' + esc(key) + '" data-t="' + esc(target || "") + '" data-max="' + (max || 20) + '">' + (x.on ? "⏹ 停止" : "🎙 " + (label || (x.url ? "再读" : "跟读"))) + "</button>"; }
  function resHtml(key) {
    const x = RES[key]; if (!x) return "";
    const k = esc(key);
    if (x.on) return '<div class="sk-res"><span class="said">正在录音……说完点「⏹ 停止」</span> <button class="sk-ib" data-rec-x="' + k + '">✕ 放弃</button> <button class="sk-ib" data-rec-re="' + k + '">↺ 重录</button></div>';
    if (x.busy) return '<div class="sk-res"><span class="said">正在识别……</span> <button class="sk-ib" data-rec-x="' + k + '">✕ 不等了</button></div>';
    let h = "";
    if (x.err && !x.said) h += '<div class="said" style="color:var(--ui-orange,#FFB86B)">⚠️ ' + esc(recErrText(x.err)) + "</div>";
    if (x.res) h += '<div><span class="sc" style="color:' + (x.res.score >= .85 ? "var(--ui-green,#7CE3B8)" : x.res.score >= .6 ? "var(--ui-orange,#FFB86B)" : "var(--ui-red,#ff8080)") + '">读对 ' + pct(x.res.score) + "%" + (x.best > x.res.score ? "（最好 " + pct(x.best) + "%）" : "") + "</span>" + x.res.a.map((w, i) => '<span class="' + (x.res.hit[i] ? "ok" : "no") + '">' + esc(w) + "</span>").join(" ") + (x.res.extra.length ? '<div class="x">多说了：' + x.res.extra.map(esc).join(" ") + "</div>" : "") + "</div>";
    else if (x.said) h += '<div class="said">识别到：' + esc(x.said) + "</div>";
    else if (x.url && !x.err) h += '<div class="said">' + (SR || !x.noai ? "没识别出文字，可以回放听听自己读得怎么样" : "这个浏览器转不了文字（Brave 不行；换 Chrome / Safari，或在 Cloudflare 打开 Workers AI），可以回放和原声对比") + "</div>";
    if (x.url) h += '<div style="margin-top:6px"><audio controls src="' + x.url + '"></audio></div>';
    return '<div class="sk-res">' + h + "</div>";
  }
  function paintRec(key) {
    if (!root) return;
    root.querySelectorAll('[data-res="' + window.CSS.escape(key) + '"]').forEach(el => { el.innerHTML = resHtml(key); });
    root.querySelectorAll('[data-rec="' + window.CSS.escape(key) + '"]').forEach(b => { const x = RES[key] || {}; b.classList.toggle("on", !!x.on); b.textContent = x.on ? "⏹ 停止" : "🎙 " + (b.dataset.label || (x.url ? "再读" : "跟读")); });
  }
  // 一句话的操作行：🔊 听、🐢 慢速、🎙 跟读 + 结果
  function ops(key, en, who, extra) {
    return '<div class="sk-ops"><button class="sk-ib" data-say="' + esc(en) + '"' + (who ? ' data-who="' + who + '"' : "") + ' title="听">🔊</button><button class="sk-ib" data-say="' + esc(en) + '" data-slow="1" title="慢速">🐢</button>' + recBtn(key, en) + (extra || "") + '</div><div data-res="' + esc(key) + '">' + resHtml(key) + "</div>";
  }

  /* ---------- 页面 ---------- */
  function counts() {
    if (!D) return {};
    return { start: "", tools: 3, drill: (D.drills || []).length, quick: (D.quick || []).length, mine: items("rec:").length, daily: 3, chat: (D.dialogs || []).length + 1, clip: CLIPS ? CLIPS.length : "…", dialog: (D.dialogs || []).length, func: (D.functions || []).length + (D.slang || []).length, pron: ((D.pron && D.pron.pairs) || []).length + 4, shadow: ((D.pron && D.pron.shadow) || []).reduce((a, g) => a + g.items.length, 0), topic: (D.topics || []).length };
  }
  function doneCount(prefix) { return Object.keys(done).filter(k => k.indexOf(prefix) === 0).length; }
  // 最上边的统计条：今天 / 连续天数 / 近 7 天柱图 / 练习天数 / 各栏练过多少（数据：speak:log 每天练习次数、speak:days 打卡、speak:done 练过的条目）
  const dayAgo = U.dayAgo;
  function statBar() {
    const L = LG("speak:log", {}), K = LG("speak:days", {}), t = today(), v = k => +L[k] || 0;
    const run = U.streak(k => v(k) > 0);
    const wk = Array.from({ length: 7 }, (_, i) => dayAgo(t, 6 - i)), mx = Math.max(1, ...wk.map(v)), w7 = wk.reduce((a, d) => a + v(d), 0);
    const days = Object.keys(L).filter(d => v(d) > 0).length, total = Object.keys(L).reduce((a, d) => a + v(d), 0), punch = Object.keys(K).filter(d => K[d]).length;
    const WD = "日一二三四五六", bars = wk.map(d => '<i title="' + d + "：" + v(d) + ' 次" class="' + (d === t ? "td" : "") + '"><u style="height:' + Math.round(v(d) / mx * 40) + 'px"></u><em>' + WD[new Date(d + "T12:00:00Z").getUTCDay()] + "</em></i>").join("");
    // 点了跳到对应的栏目（data-sec，下面的点击处理认）：今天 / 打卡 → 每日一练；天数、次数、柱图 → 我的录音（有分数曲线）；各栏练过多少 → 那一栏
    const tile = (n, l, sc) => '<div class="tl" data-sec="' + sc + '" title="去看看"><b>' + n + "</b><span>" + l + "</span></div>";
    const sub = [["d:", "对话", (D && D.dialogs || []).length, 'data-sec="dialog"'], ["s:", "跟读句", 0, 'data-sec="shadow"'], ["t:", "话题", (D && D.topics || []).length, 'data-sec="topic"'], ["f:", "表达", (D && D.functions || []).length + (D && D.slang || []).length, 'data-sec="func"'], ["p:", "发音", (D && D.pron && D.pron.pairs || []).length, 'data-basic="pron"']];
    return '<div class="sk-stat"><div class="tls">' + tile(v(t), "今天练习", "daily") + tile("🔥 " + run, "连续天数", "mine") + tile(w7, "近 7 天", "mine") + tile(days, "练习天数", "mine") + tile(punch, "每日一练打卡", "daily") + tile(total, "累计次数", "mine") + '</div><div class="bars" data-sec="mine" title="看我的录音和分数曲线">' + bars + "</div>" +
      '<div class="by">' + sub.map(([p, l, n, at]) => "<span " + at + ' style="cursor:pointer">' + l + " <b>" + doneCount(p) + "</b>" + (n ? " / " + n : "") + "</span>").join("") + "</div></div>";
  }
  function head() {
    const n = counts();
    const H = only === "start" ? ["🗣 口语入门", "第一次练口语从这里开始：先学救命句、把自我介绍说顺，再照新手 7 天计划每天练一点。"] : only === "pron" ? ["🔊 发音", "中国人最容易混的音（最小对立词）、连读弱读、重音、数字：先听、再跟读，会标出读对、读漏的词。"] : ["🗣 口语", "每天 15 分钟：听 → 跟读 → 角色扮演 → 自己说。点 🔊 听，点 🎙 录音跟读，会标出读对、读漏的词。"];
    return '<div class="sk-hd"><h1>' + H[0] + "</h1><p>" + H[1] + '</p><div class="sp">' +
      '<span class="sk-seg" title="朗读速度"><button data-rate="0.8" class="' + (opt.rate < .95 ? "on" : "") + '">慢</button><button data-rate="1" class="' + (opt.rate >= .95 && opt.rate < 1.1 ? "on" : "") + '">正常</button><button data-rate="1.15" class="' + (opt.rate >= 1.1 ? "on" : "") + '">快</button></span>' +
      '<span class="sk-seg" title="朗读声音：AI 真人语音（Workers AI）或这台设备自带的语音"><button data-voice="ai" class="' + (!window.TTS || TTS.mode() !== "sys" ? "on" : "") + '">AI 真人声</button><button data-voice="sys" class="' + (window.TTS && TTS.mode() === "sys" ? "on" : "") + '">系统声</button></span>' +
      '<span class="sk-seg" title="显示中文"><button data-zh="1" class="' + (opt.zh ? "on" : "") + '">中文</button><button data-zh="0" class="' + (!opt.zh ? "on" : "") + '">隐藏</button></span></div></div>' +
      (only ? "" : '<div class="sk-chips"><button data-basic="speak" title="救命句、自我介绍、发音在「🌱 入门」标签">🌱 新手入门 ›</button>' + SECS.filter(x => !MOVED.includes(x[0])).map(([k, t]) => '<button data-sec="' + k + '" class="' + (sec === k && !view ? "on" : sec === k ? "on" : "") + '">' + t + (n[k] === "" ? "" : "<b>" + (n[k] || 0) + "</b>") + "</button>").join("") + "</div>") + (view || only ? "" : statBar());
  }
  function draw() {
    if (!root) return;
    if (!D) { root.innerHTML = head() + '<div class="sk-empty">' + (loading ? "正在加载口语内容…" : "口语内容没加载出来，刷新一下") + "</div>"; return; }
    let body = "";
    if (view) body = ({ dialog: dialogView, func: funcView, pair: pairView, conn: connView, topic: topicView, rescue: rescueView, intro: introView, howto: howtoView, useword: usewordView, mock: mockView, drill: drillView, stress: stressView, twist: twistView, num: numView })[view.t]();
    else body = ({ start: startView, daily: dailyView, chat: chatView, tools: toolsView, clip: clipList, dialog: dialogList, func: funcList, drill: drillList, pron: pronList, shadow: shadowList, quick: quickView, topic: topicList, mine: mineView })[only || sec]();
    root.innerHTML = head() + '<div class="' + (opt.zh ? "" : "sk-hide") + '">' + body + "</div>";
    if (view && view.t === "pair") quizPaint();
    if (view && view.t === "topic") timerPaint();
    if (window.NAV) NAV.mark(); // 🔙 换了栏目 / 打开了条目：记一条页面历史（nav.js）
  }
  const back = '<button class="ui-btn" data-act="back">← 返回</button>';
  const card = (act, id, title, sub, pv, ok, tags) => '<button class="sk-card" data-act="' + act + '" data-id="' + esc(id) + '"><div class="t"><b>' + (tags || "") + esc(title) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + (pv ? '<div class="pv">' + esc(pv) + "</div>" : "") + "</div>" + (ok ? '<span class="ok">✓ 练过</span>' : "") + "<i>›</i></button>";

  // ===== 🎭 情景对话 =====
  const LV = ["入门", "基础", "进阶"];
  function dialogList() {
    const L = D.dialogs || [];
    return '<div class="sk-intro"><b>怎么练：</b>① 先点「▶ 听全文」听两遍；② 每句点 🎙 跟读，读到 85% 以上；③ 点「🎭 角色扮演」，你演 B：只看中文说英文，说完对答案。已练 ' + doneCount("d:") + " / " + L.length + " 个场景。</div>" +
      '<div class="sk-grid">' + L.slice().sort((a, b) => LV.indexOf(a.level) - LV.indexOf(b.level)).map(d => card("dialog", d.id, d.title, d.en_title + " · " + (d.lines || []).length + " 句", d.scene, isDone("d:" + d.id), '<span class="sk-tag">' + esc(d.level || "") + "</span>")).join("") + "</div>";
  }
  let RP = null; // 角色扮演 / 听全文的进度：{id, i, mode:"play"|"rp", wait}
  function dialogView() {
    const d = (D.dialogs || []).find(x => x.id === view.id); if (!d) { view = null; return dialogList(); }
    const rp = RP && RP.id === d.id ? RP : null;
    const lines = d.lines.map((l, i) => {
      const key = "d:" + d.id + ":" + i, cur = rp && rp.i === i, hideEn = rp && rp.mode === "rp" && l.who === "B" && i >= rp.i && !(rp.shown || {})[i];
      return '<div class="sk-ln ' + l.who + (cur ? " cur" : "") + '" data-li="' + i + '"><div class="sk-av">' + esc(l.who === "B" ? "我" : "A") + '</div><div class="sk-bub">' +
        (hideEn ? '<div class="sk-mask">（' + esc(d.roles && d.roles.B || "你") + "：用英语说）</div>" + '<div class="sk-zh" style="display:block">' + esc(l.zh) + "</div>" : '<div class="sk-en">' + esc(l.en) + '</div><div class="sk-zh">' + esc(l.zh) + "</div>") +
        (hideEn ? (cur ? '<div class="sk-ops">' + recBtn(key, l.en, 25, "说出来") + '<button class="sk-ib" data-act="rp-show" data-i="' + i + '">看答案</button></div><div data-res="' + esc(key) + '">' + resHtml(key) + "</div>" : "") : ops(key, l.en, l.who === "A" ? "A" : "")) +
        (rp && rp.mode === "rp" && cur && (rp.shown || {})[i] ? '<div class="sk-ops"><button class="ui-btn pri" data-act="rp-next">继续 ▶</button></div>' : "") +
        "</div></div>";
    }).join("");
    const playing = rp && rp.mode === "play", rping = rp && rp.mode === "rp";
    return '<div class="sk-bar">' + back + '<span class="gap"></span>' +
      '<button class="ui-btn' + (playing ? " pri" : "") + '" data-act="play">' + (playing ? "⏹ 停止" : "▶ 听全文") + "</button>" +
      '<button class="ui-btn' + (rping ? " pri" : "") + '" data-act="rp">' + (rping ? "⏹ 结束角色扮演" : "🎭 角色扮演（我说 B）") + "</button></div>" +
      '<h2 class="sk-title">' + esc(d.title) + "<small>" + esc(d.en_title) + " · " + esc(d.level || "") + "</small></h2>" +
      '<div class="sk-scene">📍 ' + esc(d.scene) + "<br>A：" + esc(d.roles && d.roles.A || "") + "　·　我（B）：" + esc(d.roles && d.roles.B || "") + "</div>" +
      '<div class="sk-lines">' + lines + "</div>" +
      '<div class="sk-box"><h3>📌 这段要记住的表达</h3>' + (d.phrases || []).map(p => '<div class="sk-ph"><div class="t"><div class="e">' + esc(p[0]) + '</div><div class="z">' + esc(p[1]) + '</div></div><button class="sk-ib" data-say="' + esc(p[0]) + '">🔊</button><button class="sk-ib" data-add="' + esc(p[0]) + '" title="加进生词本">＋</button></div>').join("") +
      (d.tip ? '<div class="sk-tip">💡 ' + esc(d.tip) + "</div>" : "") + "</div>" +
      '<div class="sk-center" style="margin-top:16px">' + (isDone("d:" + d.id) ? '<span class="sk-note">✓ 这个场景练过了</span>' : '<button class="ui-btn" data-act="mark" data-k="d:' + esc(d.id) + '">✓ 标记为练过</button>') + "</div>";
  }
  function scrollLine(i) { const el = root && root.querySelector('.sk-ln[data-li="' + i + '"]'); if (el) { const r = el.getBoundingClientRect(); if (r.top < 110 || r.bottom > innerHeight - 40) el.scrollIntoView({ block: "center", behavior: "smooth" }); } }
  function rpStep() {
    const d = (D.dialogs || []).find(x => RP && x.id === RP.id); if (!d || !RP) return;
    if (RP.i >= d.lines.length) { const m = RP.mode; RP = null; if (m === "rp") { markDone("d:" + d.id); tip("角色扮演完成 🎉"); } draw(); return; }
    const l = d.lines[RP.i]; draw(); scrollLine(RP.i);
    if (RP.mode === "play" || l.who === "A") { const my = RP; say(l.en, { who: l.who === "A" ? "A" : "", end: err => { if (RP !== my) return; RP.i++; setTimeout(rpStep, err ? 0 : 350); } }); }
    // 角色扮演轮到 B：等你录音或点「看答案」
  }

  // ===== 💬 常用表达 =====
  const FUNCS = () => (D.functions || []).concat(D.slang || []);
  function funcList() {
    const L = FUNCS();
    return '<div class="sk-intro"><b>怎么练：</b>每类先听一遍、跟读，再挑 2–3 个自己最想用的，点「＋」加进生词本，在「🔊 练习」里复习。<span class="sk-reg r0">随意</span><span class="sk-reg r1">中性</span><span class="sk-reg r2">正式</span> 标的是场合。已练 ' + doneCount("f:") + " / " + L.length + " 类。</div>" +
      '<div class="sk-grid three">' + L.map(g => card("func", g.id, g.title, (g.items || []).length + " 个表达", (g.items || []).slice(0, 4).map(x => x.en).join(" · "), isDone("f:" + g.id))).join("") + "</div>";
  }
  const regCls = r => (r === "随意" ? "r0" : r === "正式" ? "r2" : "r1");
  function funcView() {
    const g = FUNCS().find(x => x.id === view.id); if (!g) { view = null; return funcList(); }
    return '<div class="sk-bar">' + back + "</div>" + '<h2 class="sk-title">' + esc(g.title) + "</h2>" + (g.note ? '<div class="sk-scene">💡 ' + esc(g.note) + "</div>" : "") +
      '<div class="sk-grid">' + g.items.map((x, i) => { const key = "f:" + g.id + ":" + i; return '<div class="sk-item"><div class="e">' + esc(x.en) + '<span class="sk-reg ' + regCls(x.reg) + '">' + esc(x.reg || "") + '</span></div><div class="z sk-zh" style="font-size:14px">' + esc(x.zh) + "</div>" +
        ops(key, x.en, "", '<button class="sk-ib" data-add="' + esc(x.en) + '" data-sent="' + esc(x.ex || "") + '" title="加进生词本">＋ 生词本</button>') +
        (x.ex ? '<div class="ex">' + esc(x.ex) + ' <button class="sk-ib" data-say="' + esc(String(x.ex).replace(/\b[AB]:\s*/g, "")) + '" style="height:26px">🔊</button><small class="sk-zh">' + esc(x.exzh || "") + "</small></div>" : "") + "</div>"; }).join("") + "</div>" +
      '<div class="sk-center" style="margin-top:16px">' + (isDone("f:" + g.id) ? '<span class="sk-note">✓ 这类练过了</span>' : '<button class="ui-btn" data-act="mark" data-k="f:' + esc(g.id) + '">✓ 标记为练过</button>') + "</div>";
  }

  // ===== 🔊 发音 =====
  function pronList() {
    const P = D.pron || {}, L = P.pairs || [];
    return '<div class="sk-intro"><b>怎么练：</b>中国人最容易混的音，一组一组练：先看嘴型说明，点两个词对比着听（单词都是<b>真人录音</b>，来自维基词典），再做「听音辨词」小测（听到哪个点哪个），最后跟读例句。已练 ' + doneCount("p:") + " / " + L.length + " 组。</div>" +
      '<div class="sk-grid three">' + L.map(p => card("pair", p.id, p.title, p.a + " vs " + p.b, (p.words || []).slice(0, 4).map(w => w[0] + "/" + w[1]).join(" · "), isDone("p:" + p.id))).join("") + "</div>" +
      '<div class="sk-sub">连读、弱读、吞音<small>母语者说快了为什么听不懂</small></div><div class="sk-grid">' + card("conn", "all", "连读和弱读 " + ((P.connected || []).length) + " 条", "gonna、wanna、didja、pick it up……", "听慢速和正常速度对比，跟读", isDone("p:conn")) +
      card("stress", "all", "重音和语调 " + (D.stress || []).length + " 句", "重读不同的词，意思就变了", "I didn't say he stole it.", false) +
      card("twist", "all", "绕口令 " + (D.twisters || []).length + " 条", "th、r/l、v/w、s/sh", "She sells seashells…", false) +
      card("num", "all", "数字和价格", "电话、价格、时间、年份、大数、日期", "听写 + 说出来", false) + "</div>";
  }
  function realNote(p) {
    if (!REAL) { realLoad(); return '<small class="sk-h3n">载入真人录音…</small>'; }
    const W = (p.words || []).flat(), n = W.filter(realOf).length;
    return '<small class="sk-h3n">' + (n === W.length ? "🎙 全部是真人录音" : n ? "🎙 真人录音（标 AI 的 " + (W.length - n) + " 个词没找到真人录音）" : "AI 声音") + "</small>";
  }
  function realCredit(p) {
    if (!REAL) return ""; const L = (p.words || []).flat().map(w => [w, realOf(w)]).filter(x => x[1]); if (!L.length) return "";
    const acc = { us: "美音", uk: "英音", au: "澳音", ll: "Lingua Libre 志愿者" };
    return '<details class="sk-cred"><summary>录音来源：维基词典 / Wikimedia Commons（志愿者录制，CC BY-SA 等自由授权）</summary>' + L.map(x => '<a href="https://commons.wikimedia.org/wiki/' + esc(encodeURI(x[1].f.replace(/ /g, "_"))) + '" target="_blank" rel="noopener">' + esc(x[0]) + "</a>" + '<small>' + esc(acc[x[1].a] || "") + "</small>").join(" · ") + "</details>";
  }
  let QZ = null; // 听音辨词：{id, n, ok, cur:[a,b,ans], picked}
  function pairView() {
    const p = ((D.pron || {}).pairs || []).find(x => x.id === view.id); if (!p) { view = null; return pronList(); }
    return '<div class="sk-bar">' + back + "</div>" + '<h2 class="sk-title">' + esc(p.title) + "<small>" + esc(p.a) + " vs " + esc(p.b) + "</small></h2>" +
      '<div class="sk-scene">👄 ' + esc(p.how) + "</div>" +
      '<div class="sk-box"><h3>🎧 听音辨词</h3><div class="sk-quiz" id="sk-quiz"></div></div>' +
      '<div class="sk-box"><h3>对比着听（点词就读）' + realNote(p) + '</h3><div class="sk-pairs">' + (p.words || []).map(w => '<div class="sk-pair">' + w.map(x => '<button data-word="' + esc(x) + '">' + esc(x) + (REAL && !realOf(x) ? '<small class="sk-ai">AI</small>' : "") + "</button>").join("") + "</div>").join("") + "</div>" + realCredit(p) + "</div>" +
      '<div class="sk-box"><h3>例句跟读<small class="sk-h3n">句子是 AI 声音（这些句子没有能用的真人录音）</small></h3>' + (p.sent || []).flat().map((s, i) => '<div class="sk-ph" style="display:block"><div class="e">' + esc(s) + "</div>" + ops("p:" + p.id + ":" + i, s) + "</div>").join("") + "</div>";
  }
  function quizNew() {
    const p = ((D.pron || {}).pairs || []).find(x => view && x.id === view.id); if (!p) return;
    if (!QZ || QZ.id !== p.id) QZ = { id: p.id, n: 0, ok: 0 };
    const both = p.words.filter(w => realOf(w[0]) && realOf(w[1])), L = both.length >= 3 ? both : p.words; // 一个真人一个 AI 的话，听声音就知道答案了：有足够多两个都是真人录音的就只出这些
    const w = L[Math.floor(Math.random() * L.length)], ans = Math.random() < .5 ? 0 : 1;
    QZ.cur = [w[0], w[1], ans]; QZ.picked = null; quizPaint(); setTimeout(() => sayWord(w[ans], { rate: Math.min(opt.rate, 1) }), 150);
  }
  function quizPaint() {
    const el = root && root.querySelector("#sk-quiz"); if (!el) return;
    if (!QZ || QZ.id !== (view && view.id) || !QZ.cur) { el.innerHTML = '<div class="q">听一个词，选出你听到的是哪一个（10 题）</div><button class="ui-btn pri" data-act="qz-go">开始</button>'; return; }
    const [a, b, ans] = QZ.cur, pk = QZ.picked;
    el.innerHTML = '<div class="q">第 ' + (QZ.n + (pk == null ? 1 : 0)) + ' / 10 题：听到的是哪个？<button class="sk-ib" data-act="qz-again" style="margin-left:6px">🔊 再听</button></div><div class="ch">' +
      [a, b].map((w, i) => '<button data-qz="' + i + '" class="' + (pk == null ? "" : i === ans ? "r" : i === pk ? "w" : "") + '">' + esc(w) + "</button>").join("") + "</div>" +
      '<div class="sc">答对 ' + QZ.ok + " / " + QZ.n + (pk != null ? (QZ.n >= 10 ? '　<button class="ui-btn pri" data-act="qz-go">再来 10 题</button>' : '　<button class="ui-btn pri" data-act="qz-next">下一题 ▶</button>') : "") + "</div>";
  }
  function connView() {
    const L = (D.pron || {}).connected || [];
    return '<div class="sk-bar">' + back + "</div>" + '<h2 class="sk-title">连读、弱读、吞音<small>先听 🐢 慢速，再听 🔊 正常速度，注意说快了以后的变化</small></h2>' +
      '<div class="sk-grid">' + L.map((x, i) => '<div class="sk-item"><div class="e"><span class="sk-tag">' + esc(x.type) + "</span>" + esc(x.en) + '</div><div class="z">听起来像 <b style="color:var(--ui-pur-text)">' + esc(x.sounds) + '</b></div><div class="z sk-zh">' + esc(x.zh) + "</div>" + ops("c:" + i, x.en) + "</div>").join("") + "</div>" +
      '<div class="sk-center" style="margin-top:16px">' + (isDone("p:conn") ? '<span class="sk-note">✓ 练过了</span>' : '<button class="ui-btn" data-act="mark" data-k="p:conn">✓ 标记为练过</button>') + "</div>";
  }

  // ===== 🎯 跟读 =====
  let SH = null; // 连续跟读：{g, i}
  function shadowList() {
    const G = (D.pron || {}).shadow || []; if (shadowGroup >= G.length) shadowGroup = 0; const g = G[shadowGroup]; if (!g) return '<div class="sk-empty">没有句子</div>';
    const on = SH && SH.g === shadowGroup;
    return '<div class="sk-intro"><b>怎么练：</b>「连续跟读」会一句一句播，每句后面留出时间，你跟着大声说（影子跟读，不打分，练语调和节奏）；想看自己读得准不准，单句点 🎙。已跟读 ' + doneCount("s:") + " 句。</div>" +
      '<div class="sk-bar"><span class="sk-seg">' + G.map((x, i) => '<button data-sg="' + i + '" class="' + (i === shadowGroup ? "on" : "") + '">' + esc(x.group) + "</button>").join("") + '</span><span class="gap"></span><button class="ui-btn' + (on ? " pri" : "") + '" data-act="sh">' + (on ? "⏹ 停止" : "▶ 连续跟读") + "</button></div>" +
      '<div class="sk-lines">' + g.items.map((x, i) => { const key = "s:" + shadowGroup + ":" + i; return '<div class="sk-ln' + (on && SH.i === i ? " cur" : "") + '" data-li="' + i + '" style="max-width:100%"><div class="sk-av">' + (isDone(key) ? "✓" : i + 1) + '</div><div class="sk-bub" style="flex:1 1 auto"><div class="sk-en">' + esc(x.en) + '</div><div class="sk-zh">' + esc(x.zh) + "</div>" + ops(key, x.en) + "</div></div>"; }).join("") + "</div>";
  }
  function shStep() {
    const G = (D.pron || {}).shadow || [], g = G[SH && SH.g]; if (!g || !SH) return;
    if (SH.i >= g.items.length) { SH = null; tip("这一组跟读完了 👏"); draw(); return; }
    draw(); scrollLine(SH.i);
    const my = SH, x = g.items[SH.i], t0 = Date.now();
    say(x.en, { end: () => { if (SH !== my) return; const gap = Math.max(1500, (Date.now() - t0) * 1.2 + 600); markDone("s:" + SH.g + ":" + SH.i); setTimeout(() => { if (SH !== my) return; SH.i++; shStep(); }, gap); } });
  }

  // ===== 🗣 话题 =====
  const CATS = ["日常", "工作", "生活在马来西亚", "旅行", "兴趣", "观点"];
  function topicList() {
    const L = D.topics || [];
    return '<div class="sk-intro"><b>怎么练：</b>选一张卡，看问题和要点，准备 15 秒，然后录音说 1–2 分钟（说不下去就看「好用的表达」）。说完回放听自己，再看样例回答，挑一两句换成自己的话再说一遍。已说 ' + doneCount("t:") + " / " + L.length + " 个话题。</div>" +
      CATS.map(c => { const T = L.filter(t => t.cat === c); return T.length ? '<div class="sk-sub">' + esc(c) + "<small>" + T.length + " 个</small></div>" + '<div class="sk-grid three">' + T.map(t => card("topic", t.id, t.q, t.qzh, "", isDone("t:" + t.id), '<span class="sk-tag">' + esc(t.level || "") + "</span>")).join("") + "</div>" : ""; }).join("");
  }
  let TM = null; // 计时：{id, phase:"prep"|"talk", left, t}
  function timerPaint() {
    const el = root && root.querySelector("#sk-timer"); if (!el) return;
    const t = TM && TM.id === (view && view.id) ? TM : null, key = "t:" + (view && view.id);
    if (!t) { el.innerHTML = '<div class="sk-center"><button class="ui-btn pri" data-act="tm" data-s="60">⏱ 准备 15 秒 + 说 1 分钟</button><button class="ui-btn" data-act="tm" data-s="120">说 2 分钟</button>' + recBtn(key, "", 180, "直接录音") + "</div>"; return; }
    const m = Math.floor(t.left / 60), s = t.left % 60;
    el.innerHTML = '<div class="sk-timer ' + t.phase + '">' + m + ":" + String(s).padStart(2, "0") + '</div><div class="sk-center"><span class="sk-note">' + (t.phase === "prep" ? "准备：看要点，想想先说什么" : "正在录音，开口说！") + '</span><button class="ui-btn" data-act="tm-stop">' + (t.phase === "prep" ? "跳过准备" : "⏹ 说完了") + "</button></div>";
  }
  function tmTick() {
    if (!TM) return; TM.left--;
    if (TM.left <= 0) {
      if (TM.phase === "prep") { TM.phase = "talk"; TM.left = TM.total; recStart("t:" + TM.id, "", TM.total + 5, () => { TM = null; markDone("t:" + view.id); timerPaint(); }); }
      else { clearInterval(TM.t); recStop(false); return; }
    }
    timerPaint();
  }
  function topicView() {
    const t = (D.topics || []).find(x => x.id === view.id); if (!t) { view = null; return topicList(); }
    const key = "t:" + t.id, x = RES[key] || {}, words = x.said ? toks(x.said).length : 0;
    return '<div class="sk-bar">' + back + "</div>" +
      '<div class="sk-box" style="margin-top:0"><div class="sk-big">' + esc(t.q) + ' <button class="sk-ib" data-say="' + esc(t.q) + '">🔊</button></div><div class="sk-zh" style="font-size:14.5px">' + esc(t.qzh) + "</div>" +
      '<div style="margin-top:10px;font-size:14.5px;color:var(--ui-ink-2);line-height:1.7">' + (t.points || []).map(p => "• " + esc(p)).join("<br>") + "</div></div>" +
      '<div class="sk-box"><div id="sk-timer"></div><div data-res="' + esc(key) + '">' + resHtml(key) + "</div>" + (words ? '<div class="sk-note">这次说了 ' + words + " 个词" + (words < 60 ? "，试着再多说几句：举个例子、讲个经历、说说原因" : "，不错！") + "</div>" : "") + aiRateHtml(key) + "</div>" +
      '<div class="sk-box"><h3>🧰 好用的表达</h3>' + (t.phrases || []).map(p => '<div class="sk-ph"><div class="t"><div class="e">' + esc(p[0]) + '</div><div class="z">' + esc(p[1]) + '</div></div><button class="sk-ib" data-say="' + esc(p[0]) + '">🔊</button><button class="sk-ib" data-add="' + esc(p[0]) + '" title="加进生词本">＋</button></div>').join("") + "</div>" +
      '<details class="sk-box"><summary style="cursor:pointer;font-weight:800;color:var(--ui-ink)">📝 看样例回答（自己先说完再看）</summary><div class="sk-ops" style="margin-top:10px"><button class="sk-ib" data-say="' + esc(t.sample) + '">🔊 听样例</button><button class="sk-ib" data-say="' + esc(t.sample) + '" data-slow="1">🐢 慢速</button></div><div class="sk-sample">' + esc(t.sample) + '</div><div class="sk-zh" style="margin-top:8px;font-size:14px;line-height:1.7">' + esc(t.samplezh) + "</div></details>" +
      '<div class="sk-center" style="margin-top:16px">' + (isDone(key) ? '<span class="sk-note">✓ 这个话题说过了</span>' : '<button class="ui-btn" data-act="mark" data-k="' + esc(key) + '">✓ 标记为说过</button>') + "</div>";
  }

  // ===== 📅 每日一练 =====
  const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function dailyPlan() { // 按日期定：今天固定是这几样；优先挑还没练过的
    const day = today(), h = hashOf(day), pick = (L, keyOf) => { if (!L.length) return null; const fresh = L.filter(x => !done[keyOf(x)]), P = fresh.length ? fresh : L; return P[h % P.length]; };
    const d = pick(D.dialogs || [], x => "d:" + x.id), t = pick(D.topics || [], x => "t:" + x.id);
    const all = []; ((D.pron || {}).shadow || []).forEach((g, gi) => g.items.forEach((x, i) => all.push({ key: "s:" + gi + ":" + i, en: x.en, zh: x.zh })));
    const fresh = all.filter(x => !done[x.key] || doneToday(x.key)), P = fresh.length >= 5 ? fresh : all, st = h % Math.max(1, P.length - 4);
    return { d, t, s: P.slice(st, st + 5) };
  }
  function streak() {
    const D0 = LG("speak:days", {}); return U.streak(k => !!D0[k]); // 今天还没做完：从昨天往前数
  }
  function dailyView() {
    const p = dailyPlan(), dOk = p.d && doneToday("d:" + p.d.id), sN = p.s.filter(x => doneToday(x.key)).length, tOk = p.t && doneToday("t:" + p.t.id), all = !!(dOk && sN >= 5 && tOk);
    if (all) { const D0 = LG("speak:days", {}); if (!D0[today()]) { D0[today()] = 1; LS("speak:days", D0); syPut("days:" + today(), 1); tip("今天的口语练完了 🎉"); } }
    const n = (dOk ? 1 : 0) + (sN >= 5 ? 1 : 0) + (tOk ? 1 : 0), st = streak();
    const box = (ok, title, sub, body) => '<div class="sk-box"><h3>' + (ok ? "✅ " : "⬜ ") + title + '<small style="margin-left:8px;font-weight:500;color:var(--ui-muted);font-size:12.5px">' + sub + "</small></h3>" + body + "</div>";
    return '<div class="sk-intro"><b>🔥 连续 ' + st + " 天</b>　今天完成 <b>" + n + " / 3</b>" + (all ? "　🎉 今天的练完了，想多练就去「🤖 AI 陪练」聊几句" : "　大约 15 分钟：对话 → 跟读 → 话题") + "</div>" +
      (p.d ? box(dOk, "① 情景对话：" + esc(p.d.title), "先听全文，再角色扮演一遍（演完自动打勾）", '<div class="sk-scene" style="margin:4px 0 10px">📍 ' + esc(p.d.scene) + '</div><button class="ui-btn pri" data-act="dialog" data-id="' + esc(p.d.id) + '">' + (dOk ? "再练一次" : "去练 ▶") + "</button>") : "") +
      box(sN >= 5, "② 跟读 5 句", "每句点 🎙 读一遍（" + sN + " / 5）", '<div class="sk-lines">' + p.s.map((x, i) => '<div class="sk-ln" style="max-width:100%"><div class="sk-av">' + (doneToday(x.key) ? "✓" : i + 1) + '</div><div class="sk-bub" style="flex:1 1 auto"><div class="sk-en">' + esc(x.en) + '</div><div class="sk-zh">' + esc(x.zh) + "</div>" + ops(x.key, x.en) + "</div></div>").join("") + "</div>") +
      (p.t ? box(tOk, "③ 话题：" + esc(p.t.q), esc(p.t.qzh), '<button class="ui-btn pri" data-act="topic" data-id="' + esc(p.t.id) + '">' + (tOk ? "再说一次" : "去说 ▶") + '</button><span class="sk-note" style="margin-left:8px">录完可以让 AI 点评</span>') : "") +
      '<div class="sk-note">每天的内容按日期自动换，优先排还没练过的。三样都做完算打卡；练习次数也会算进「📊 统计」的热力日历和连续天数。</div>';
  }

  // ===== 🤖 AI 陪练 =====
  let CH = null; // {scene, title, msgs:[{role, content, fix}], busy, sum, sumBusy}
  let chatAuto = LG("speak:chatAuto", true);
  const FREE = { id: "free", title: "自由聊天", scene: "casual small talk between two friends: daily life, work, weekend plans, food, hobbies, living in Kuala Lumpur" };
  function chatScenes() { return [FREE].concat((D.dialogs || []).map(d => ({ id: d.id, title: d.title, scene: d.en_title + ". " + "You play: " + (d.roles && d.roles.A || "the other person") + ". The learner plays: " + (d.roles && d.roles.B || "themselves") + ". Context (Chinese): " + d.scene }))); }
  function chatView() {
    if (!CH) return '<div class="sk-intro"><b>怎么聊：</b>选一个场景，AI 先开口；你点 🎙 用英语回答（说完自动发出去），也可以打字。AI 会接着聊、追问，还会顺手纠正你上一句的错。聊 6 句以上点「结束并总结」，看看哪些地方可以说得更好。</div>' +
      '<div class="sk-grid three">' + chatScenes().map(c => '<button class="sk-card" data-act="chat-go" data-id="' + esc(c.id) + '"><div class="t"><b>' + (c.id === "free" ? "💬 " : "🎭 ") + esc(c.title) + "</b><span>" + (c.id === "free" ? "想到哪聊到哪" : "AI 演对方，你演自己") + "</span></div><i>›</i></button>").join("") + "</div>" + chatHistHtml();
    const msgs = CH.msgs.map((m, i) => m.role === "assistant"
      ? '<div class="sk-ln"><div class="sk-av">AI</div><div class="sk-bub"><div class="sk-en">' + esc(m.content) + '</div><div class="sk-ops"><button class="sk-ib" data-say="' + esc(m.content) + '" data-who="A">🔊</button><button class="sk-ib" data-say="' + esc(m.content) + '" data-who="A" data-slow="1">🐢</button><button class="sk-ib" data-act="chat-zh" data-i="' + i + '">译</button></div>' + (m.zh ? '<div class="sk-zh" style="display:block">' + esc(m.zh) + "</div>" : "") + "</div></div>"
      : '<div class="sk-ln B"><div class="sk-av">我</div><div class="sk-bub"><div class="sk-en">' + esc(m.content) + "</div>" + (m.fix ? '<div class="sk-res"><span class="no">' + esc(m.fix.bad) + '</span> → <span class="ok">' + esc(m.fix.good) + '</span> <button class="sk-ib" data-say="' + esc(m.fix.good) + '" style="height:26px">🔊</button><div class="x">' + esc(m.fix.why_zh || "") + "</div></div>" : "") + "</div></div>").join("");
    const x = RES.chat || {}, users = CH.msgs.filter(m => m.role === "user").length;
    let sum = "";
    if (CH.sumBusy) sum = '<div class="sk-box"><span class="sk-note">AI 正在看你们的对话……</span></div>';
    else if (CH.sum) { const S = CH.sum; sum = '<div class="sk-box"><h3>📋 这次聊天的小结</h3><div style="font-size:14.5px;line-height:1.7;color:var(--ui-ink-2)">' + esc(S.summary_zh || "") + "</div>" +
      ((S.good_zh || []).length ? '<div style="margin-top:8px;font-size:14px;color:var(--ui-green,#7CE3B8)">' + S.good_zh.map(g => "👍 " + esc(g)).join("<br>") + "</div>" : "") +
      ((S.fixes || []).length ? '<h3 style="margin-top:12px">✏️ 可以说得更好</h3>' + S.fixes.map(f => '<div class="sk-ph"><div class="t"><div class="z"><span style="color:var(--ui-red,#ff8080)">' + esc(f.bad) + '</span></div><div class="e">' + esc(f.good) + '</div><div class="z">' + esc(f.why_zh || "") + '</div></div><button class="sk-ib" data-say="' + esc(f.good) + '">🔊</button></div>').join("") : "") +
      ((S.phrases || []).length ? '<h3 style="margin-top:12px">🧰 下次可以用</h3>' + S.phrases.map(f => '<div class="sk-ph"><div class="t"><div class="e">' + esc(f.en) + '</div><div class="z">' + esc(f.zh || "") + '</div></div><button class="sk-ib" data-say="' + esc(f.en) + '">🔊</button><button class="sk-ib" data-add="' + esc(f.en) + '" title="加进生词本">＋</button></div>').join("") : "") + "</div>"; }
    return '<div class="sk-bar"><button class="ui-btn" data-act="chat-end">← 换个场景</button><span class="gap"></span><label class="sk-note" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="sk-auto"' + (chatAuto ? " checked" : "") + '>自动朗读 AI 的话</label>' +
      ((CH.msgs.some(m => m.fix) || (CH.sum && (CH.sum.fixes || []).length)) ? '<button class="ui-btn" data-act="chat-book" title="把改过的正确说法加进生词本">＋ 改过的句子进生词本</button>' : "") +
      '<button class="ui-btn" data-act="chat-sum"' + (users >= 2 && !CH.busy && !CH.sumBusy ? "" : " disabled") + ">结束并总结</button></div>" +
      '<h2 class="sk-title">' + esc(CH.title) + "<small>AI 演对方，你用英语回答</small></h2>" +
      '<div class="sk-lines" id="sk-chat">' + msgs + (CH.busy ? '<div class="sk-ln"><div class="sk-av">AI</div><div class="sk-bub"><span class="sk-note">正在想……</span></div></div>' : "") + "</div>" +
      (CH.err ? '<div class="sk-tip">' + esc(CH.err) + ' <button class="sk-ib" data-act="chat-retry">重试</button></div>' : "") +
      '<div class="sk-box"><div class="sk-ops" style="margin-top:0">' + '<button class="ui-btn ' + (x.on ? "" : "pri") + '" data-rec="chat" data-t="" data-max="40" data-label="说一句" style="min-width:120px">' + (x.on ? "⏹ 说完了" : "🎙 说一句") + '</button><input id="sk-say" placeholder="或者打字，回车发送" style="flex:1 1 200px;min-width:0;height:38px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 12px;font:inherit;font-size:15px"><button class="ui-btn" data-act="chat-send">发送</button></div>' +
      (x.busy ? '<div class="sk-note">正在识别……</div>' : "") + '<div class="sk-note">卡住了？说 "Sorry, could you say that again?" 或 "How do you say … in English?" 也算练习。</div></div>' + sum;
  }
  async function chatAsk() {
    if (!CH || CH.busy) return; CH.busy = true; CH.err = ""; draw(); chatScroll();
    const my = CH;
    try {
      const j = await AI.ask("chat", { scene: CH.scene, history: CH.msgs.map(m => ({ role: m.role, content: m.content })) });
      if (CH !== my) return;
      if (!j.ok) throw new Error(AI.msg(j, "AI 没回上来，点重试"));
      const last = [...CH.msgs].reverse().find(m => m.role === "user"); if (last && j.fix) last.fix = j.fix;
      CH.msgs.push({ role: "assistant", content: j.reply }); CH.busy = false; chatSave(); draw(); chatScroll();
      if (chatAuto) say(j.reply, { who: "A" });
    } catch (e) { if (CH === my) { CH.busy = false; CH.err = e.message || "出错了"; draw(); } }
  }
  function chatSend(text) {
    text = String(text || "").trim(); if (!CH || !text || CH.busy) return;
    CH.msgs.push({ role: "user", content: text }); CH.sum = null;
    if (CH.msgs.filter(m => m.role === "user").length === 3) markDone("c:" + today()); // 聊上 3 句算今天用过 AI 陪练
    chatAsk();
  }
  function chatScroll() { const el = root && root.querySelector("#sk-chat"); if (el && el.lastElementChild) el.lastElementChild.scrollIntoView({ block: "center", behavior: "smooth" }); }
  async function chatSum() {
    if (!CH || CH.sumBusy) return; CH.sumBusy = true; draw(); const my = CH;
    try {
      const j = await AI.ask("chatsum", { scene: CH.scene, history: CH.msgs.map(m => ({ role: m.role, content: m.content })) });
      if (CH !== my) return; CH.sumBusy = false; if (j.ok) { CH.sum = j; chatSave(); fixesToErr(j.fixes); } else tip(AI.msg(j, "总结没出来，再点一次")); draw();
      const b = root.querySelector(".sk-box:last-child"); if (b) b.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch (e) { if (CH === my) { CH.sumBusy = false; tip("总结没出来，再点一次"); draw(); } }
  }
  const zhOf = en => TR.text(en).catch(() => ""); // 全站共用的翻译（tr.js）

  // ===== 🎬 原声跟读 =====
  let CLIPS = null, clipN = 40; const CLIPREC = {};
  function loadClips() {
    if (CLIPS) return Promise.resolve();
    return CLOUD.chan("ext").get().then(it => { // 全站共用的同步（cloud.js）
      const L = [];
      for (const k in it) {
        if (!k.startsWith("med|med:")) continue; const mk = k.slice(4), at = it[k].at || 0;
        if (mk.startsWith("med:w:")) { const w = mk.slice(6), c = it["savedCtx|" + w]; L.push({ mk, word: w, t: c && c.v && c.v.t ? String(c.v.t) : "", at }); }
        else { const sk = mk.slice(6), s = Object.keys(it).find(x => x.startsWith("savedSents|") && it[x].v && it[x].v.k === sk), v = s && it[s].v; L.push({ mk, t: v ? String(v.t || "") : "", tr: v ? String(v.tr || "") : "", at }); }
      }
      CLIPS = L.sort((a, b) => b.at - a.at);
    }).catch(() => { CLIPS = []; });
  }
  function clipGet(mk) { return CLIPREC[mk] ? Promise.resolve(CLIPREC[mk]) : CLOUD.media(mk).then(rec => (rec ? (CLIPREC[mk] = rec) : {})); } // 全站共用（cloud.js）
  let clipAudio = null;
  function clipPlay(mk, slow) { clipGet(mk).then(r => { if (!r || !r.aud) { tip("这条没有原声"); return; } hush(); clipAudio = MEDIA.play(r.aud, { rate: slow ? 0.75 : 1 }); }); } // 全站共用的放音（media.js）
  function clipList() {
    if (!CLIPS) { loadClips().then(draw); return '<div class="sk-empty">正在取你保存的原声……</div>'; }
    if (!CLIPS.length) return '<div class="sk-intro">还没有原声：在电脑上用插件看 YouTube 时保存单词或句子（设置里开着「保存时存下原声和画面」），这里就会出现那一句的真人原声。</div>';
    const L = CLIPS.slice(0, clipN);
    return '<div class="sk-intro"><b>怎么练：</b>这些是你看 YouTube 时保存下来的真人原声（共 ' + CLIPS.length + " 条，最新的在前）。点 ▶ 听原声，跟着读，点 🎙 录音打分，再回放和原声对比。点「🖼」看当时的画面。已练 " + doneCount("v:") + " 条。</div>" +
      '<div class="sk-lines">' + L.map(c => { const r = CLIPREC[c.mk], t = (r && r.t) || c.t, key = "v:" + c.mk; return '<div class="sk-ln" style="max-width:100%"><div class="sk-av">' + (isDone(key) ? "✓" : "🎬") + '</div><div class="sk-bub" style="flex:1 1 auto">' +
        (r && r.img && c.showImg ? '<img src="' + r.img + '" alt="" style="width:100%;max-width:420px;border-radius:10px;display:block;margin-bottom:8px">' : "") +
        '<div class="sk-en">' + (t ? esc(t) : '<span class="sk-mask">（点 ▶ 取原句）</span>') + (c.word ? ' <span class="sk-tag">' + esc(c.word) + "</span>" : "") + '</div><div class="sk-zh">' + esc((r && r.tr) || c.tr || "") + (r && r.title ? '　· <span style="opacity:.8">' + esc(r.title) + "</span>" : "") + "</div>" +
        '<div class="sk-ops"><button class="sk-ib" data-clip="' + esc(c.mk) + '">▶ 原声</button><button class="sk-ib" data-clip="' + esc(c.mk) + '" data-slow="1">🐢 慢放</button><button class="sk-ib" data-clipimg="' + esc(c.mk) + '">🖼</button>' + (t ? recBtn(key, t, 25) : "") + "</div>" +
        '<div data-res="' + esc(key) + '">' + resHtml(key) + "</div></div></div>"; }).join("") + "</div>" +
      (CLIPS.length > clipN ? '<div class="sk-center" style="margin-top:12px"><button class="ui-btn" data-act="clip-more">再显示 40 条</button></div>' : "");
  }

  // ===== 🗣 话题：AI 点评 =====
  const AIR = {}; // key → {busy, r, err}
  function aiRateHtml(key) {
    const a = AIR[key], x = RES[key] || {}, words = x.said ? toks(x.said).length : 0;
    if (!a) return words >= 8 ? '<div class="sk-center"><button class="ui-btn pri" data-act="ai-rate">🤖 AI 点评这次回答</button></div>' : "";
    if (a.busy) return '<div class="sk-note" style="text-align:center">AI 正在听你的回答（按雅思口语标准）……</div>';
    if (a.err) return '<div class="sk-tip">' + esc(a.err) + ' <button class="sk-ib" data-act="ai-rate">重试</button></div>';
    const r = a.r, B = r.band || {}, bk = "tb:" + key;
    return '<div style="margin-top:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline"><span style="font-size:30px;font-weight:900;color:var(--ui-pur-text)">' + esc(B.overall) + '</span><span class="sk-note" style="margin:0">流利连贯 ' + esc(B.FC) + " · 词汇 " + esc(B.LR) + " · 语法 " + esc(B.GRA) + "（发音没算：AI 只看文字）</span></div>" +
      '<div style="margin-top:6px;font-size:14.5px;line-height:1.7;color:var(--ui-ink-2)">' + esc(r.summary_zh || "") + "</div>" +
      ((r.strengths_zh || []).length ? '<div style="margin-top:6px;font-size:14px;color:var(--ui-green,#7CE3B8)">' + r.strengths_zh.map(g => "👍 " + esc(g)).join("<br>") + "</div>" : "") +
      ((r.fixes || []).length ? '<h3 style="margin-top:12px">✏️ 改一改</h3>' + r.fixes.map(f => '<div class="sk-ph"><div class="t"><div class="z"><span style="color:var(--ui-red,#ff8080)">' + esc(f.bad) + '</span></div><div class="e">' + esc(f.good) + '</div><div class="z">' + esc(f.why_zh || "") + '</div></div><button class="sk-ib" data-say="' + esc(f.good) + '">🔊</button></div>').join("") : "") +
      (r.better ? '<h3 style="margin-top:12px">⭐ 升级版回答（照着再说一遍）</h3><div class="sk-sample">' + esc(r.better) + '</div><div class="sk-zh" style="font-size:14px;line-height:1.7;margin-top:6px">' + esc(r.better_zh || "") + '</div>' + ops(bk, r.better) : "") + "</div>";
  }
  async function aiRate(key, q) {
    const x = RES[key] || {}; if (!x.said) return;
    AIR[key] = { busy: true }; draw();
    try {
      const j = await AI.ask("speak", { prompt: q, text: x.said });
      if (j.ok) fixesToErr(j.fixes, q);
      AIR[key] = j.ok ? { r: j } : { err: j.error === "too short" ? "说得太短了，至少说几句再点评" : AI.msg(j, "AI 没回上来") };
    } catch (e) { AIR[key] = { err: "网络问题，没连上 AI" }; }
    draw();
  }

  /* ---------- 同步：练习记录、打卡、聊天记录、录音存档、教练计划 → 后台 /api/mine?k=speak（按家人分开，换设备也在） ---------- */
  let SY = {}; const CL = CLOUD.chan("speak"); // 全站共用的同步（cloud.js）：排队、1.5 秒合并发、失败重发、关页面发完
  function syPut(id, v) { const at = Date.now(); SY[id] = { v, at }; CL.put(id, v, at); }
  function syDel(id) { const at = Date.now(); delete SY[id]; CL.del(id, at); }
  let syPulled = null;
  function syPull() {
    if (syPulled) return syPulled;
    syPulled = CL.pull({ force: true }).then(items => {
      if (!items) { syPulled = null; return false; } // 拉不下来（断网）：下次再拉，别把本机的全部重传一遍
      const R = items; let ch = false; const L = LG("speak:log", {}), DD = LG("speak:days", {}), up = {};
      for (const id in R) { const x = R[id]; if (x.del) continue; SY[id] = x;
        if (id.startsWith("done:")) { const k = id.slice(5); if (!(done[k] >= x.v)) { done[k] = x.v; ch = true; } }
        else if (id.startsWith("log:")) { const k = id.slice(4); if (!(L[k] >= x.v)) { L[k] = x.v; ch = true; } }
        else if (id.startsWith("days:")) { const k = id.slice(5); if (!DD[k]) { DD[k] = 1; ch = true; } } }
      // 这台设备上有、后台没有的：补传
      for (const k in done) if (!R["done:" + k] || R["done:" + k].v < done[k]) up["done:" + k] = { v: done[k], at: Date.now() };
      for (const k in L) if (!R["log:" + k] || R["log:" + k].v < L[k]) up["log:" + k] = { v: L[k], at: Date.now() };
      for (const k in DD) if (!R["days:" + k]) up["days:" + k] = { v: 1, at: Date.now() };
      if (ch) { LS("speak:done", done); LS("speak:log", L); LS("speak:days", DD); }
      for (const k in up) CL.put(k, up[k].v, up[k].at); if (Object.keys(up).length) CL.flush();
      return ch;
    }).catch(() => false);
    return syPulled;
  }
  const items = p => Object.keys(SY).filter(k => k.startsWith(p)).map(k => Object.assign({ id: k.slice(p.length) }, SY[k].v)).sort((a, b) => (b.at || 0) - (a.at || 0));

  /* ---------- 📼 录音存档：每次跟读录音（带目标句的、话题）存到后台，看进步 ---------- */
  function archive(key, x, target, blob) {
    if (!blob || blob.size > 1500000 || key === "chat" || key.indexOf("mock:") === 0) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at = Date.now();
    const fr = new FileReader();
    fr.onload = () => {
      fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: "med:sp:" + id, rec: { aud: fr.result, t: target || "", at } }) }).then(r => {
        if (!r.ok) return; syPut("rec:" + id, { key, t: target || (topicOf(key) || {}).q || "", said: String(x.said || "").slice(0, 600), score: x.res ? Math.round(x.res.score * 100) : null, at });
        const L = items("rec:"); if (L.length > 300) L.slice(300).forEach(o => syDel("rec:" + o.id)); // 最多留 300 条
      }).catch(() => {});
    };
    fr.readAsDataURL(blob);
  }
  const topicOf = key => key.indexOf("t:") === 0 ? (D.topics || []).find(x => "t:" + x.id === key) : null;
  const MREC = {};
  function playArchived(id) { (MREC[id] ? Promise.resolve(MREC[id]) : CLOUD.media("med:sp:" + id).then(rec => (MREC[id] = rec))).then(r => { if (!r || !r.aud) return tip("这条录音没取到"); hush(); clipAudio = MEDIA.play(r.aud); }); }
  function curveSvg(pts) { // 每天跟读的平均分
    if (pts.length < 2) return '<div class="sk-note">练满两天就能看到分数曲线。</div>';
    const W = 640, H = 160, L = 34, B = 22, T = 10, xs = i => L + (W - L - 10) * (i / (pts.length - 1)), ys = v => T + (H - T - B) * (1 - v / 100);
    let s = [0, 50, 100].map(v => '<line x1="' + L + '" x2="' + (W - 10) + '" y1="' + ys(v) + '" y2="' + ys(v) + '" stroke="var(--ui-line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (ys(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--ui-muted)">' + v + "</text>").join("");
    s += '<polyline fill="none" stroke="var(--ui-pur-text)" stroke-width="2.5" points="' + pts.map((p, i) => xs(i) + "," + ys(p.v)).join(" ") + '"/>';
    s += pts.map((p, i) => '<circle cx="' + xs(i) + '" cy="' + ys(p.v) + '" r="3.5" fill="var(--ui-pur-text)"><title>' + p.k + "：平均 " + p.v + " 分，" + p.n + " 次</title></circle>").join("");
    s += '<text x="' + L + '" y="' + (H - 4) + '" font-size="11" fill="var(--ui-muted)">' + pts[0].k.slice(5) + '</text><text x="' + (W - 10) + '" y="' + (H - 4) + '" text-anchor="end" font-size="11" fill="var(--ui-muted)">' + pts[pts.length - 1].k.slice(5) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:auto;display:block">' + s + "</svg>";
  }
  function mineView() {
    const R = items("rec:");
    if (!R.length) return '<div class="sk-intro">这里会存下你每次跟读、说话题的录音（存在云端，换设备也能听，按家人分开），还有每天的平均分曲线。去「🎯 跟读」或「📅 每日一练」录一句试试。</div>';
    const day = {}; R.forEach(r => { if (r.score == null) return; const k = U.day(r.at); (day[k] = day[k] || []).push(r.score); });
    const pts = Object.keys(day).sort().slice(-30).map(k => ({ k, n: day[k].length, v: Math.round(day[k].reduce((a, b) => a + b, 0) / day[k].length) }));
    const by = {}; R.forEach(r => { const k = r.t || r.key; (by[k] = by[k] || []).push(r); });
    const groups = Object.keys(by).map(k => ({ t: k, L: by[k] })).sort((a, b) => b.L[0].at - a.L[0].at);
    return '<div class="sk-intro">共 ' + R.length + " 条录音、" + groups.length + " 句。同一句多录几次，对比第一次和最近一次，听得出进步。</div>" +
      '<div class="sk-box"><h3>📈 跟读平均分（最近 30 天）</h3>' + curveSvg(pts) + "</div>" +
      groups.slice(0, 80).map(g => { const sc = g.L.filter(r => r.score != null).map(r => r.score), best = sc.length ? Math.max(...sc) : null, first = g.L[g.L.length - 1];
        return '<div class="sk-box"><div class="sk-en">' + esc(g.t) + ' <button class="sk-ib" data-say="' + esc(g.t) + '" style="height:26px">🔊</button></div><div class="sk-note" style="margin-top:4px">' + g.L.length + " 次" + (best != null ? " · 最好 " + best + " 分" : "") + (sc.length > 1 ? " · 第一次 " + (first.score != null ? first.score : "—") + " → 最近 " + (g.L[0].score != null ? g.L[0].score : "—") : "") + "</div>" +
          '<div class="sk-ops">' + g.L.slice(0, 6).map(r => '<button class="sk-ib" data-arch="' + esc(r.id) + '" title="' + esc(r.said || "") + '">▶ ' + new Date(r.at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + (r.score != null ? " · " + r.score : "") + "</button>").join("") + "</div></div>"; }).join("");
  }

  /* ---------- 🌱 入门：新手从这里开始 ---------- */
  const SECINFO = { rescue: ["🆘 救命句", "听不懂、想不起词时的 40 句"], intro: ["🙋 自我介绍", "12 句，先把自己介绍顺"], daily: ["📅 每日一练", "每天自动安排，15 分钟"], dialog: ["🎭 情景对话", "听全文 → 跟读 → 角色扮演"], func: ["💬 表达和俚语", "按功能分类的地道说法"], drill: ["🔁 句型操练", "一个句型换着说，练到脱口而出"], pron: ["🔊 发音", "易混音、连读、重音、绕口令、数字"], shadow: ["🎯 跟读", "120 句高频句"], clip: ["🎬 原声跟读", "你保存的 YouTube 真人原声"], quick: ["⚡ 快问快答", "听到问题 3 秒内开口，AI 判断"], chat: ["🤖 AI 陪练", "和 AI 用英语聊天，顺手纠错"], howto: ["🧰 这句话怎么说", "中文 → 地道英语三种说法"], topic: ["🗣 话题", "说 1–2 分钟，AI 按雅思点评"], mock: ["🎓 模拟考", "雅思口语三部分完整走一遍"], useword: ["📘 用生词说一句", "生词本里的词，开口用一次"] };
  function goSec(k) { // 入门里的「去练」：有的是一栏，有的是 AI 工具或入门里的小页
    if (k === "rescue" || k === "intro") return open(k, k);
    if (only && k === "pron") { stopAll(); view = null; if (window.enShow) window.enShow("basic", "pron"); return; }
    if (only) { only = null; if (SECS.some(s => s[0] === k) && !MOVED.includes(k)) { sec = k; view = null; LS("speak:sec", sec); } else if (k === "howto" || k === "mock" || k === "useword") { sec = "tools"; LS("speak:sec", sec); open(k, k); } if (window.enShow) window.enShow("speak"); window.scrollTo(0, 0); return; } // 嵌在「🌱 入门」里：别的栏在「🗣 说」
    if (k === "howto" || k === "mock" || k === "useword") { sec = "tools"; LS("speak:sec", sec); return open(k, k); }
    if (SECS.some(s => s[0] === k)) { stopAll(); sec = k; view = null; LS("speak:sec", sec); draw(); window.scrollTo(0, 0); }
  }
  let COACH = null; // {busy, err, r}
  const COACH_Q = [["feel", "现在开口说英语的感觉", ["完全不敢开口", "能说几个词", "能简单对话", "能聊但不流利"]], ["use", "主要想用在哪", ["日常生活", "工作开会", "雅思考试", "出国旅行"]], ["time", "每天能练多久", ["10 分钟", "20 分钟", "30 分钟以上"]], ["hard", "最难的是", ["听不懂对方", "想不起单词", "发音不准", "不敢说、怕错"]]];
  let coachAns = LG("speak:coachAns", {});
  function startView() {
    const W = (D.starter && D.starter.week) || [], plan = (SY.plan && SY.plan.v) || null;
    const wk = W.map(d => ({ d, n: d.steps.filter((s, i) => done["w:" + d.day + ":" + i]).length })), curDay = (wk.find(x => x.n < x.d.steps.length) || wk[wk.length - 1] || {}).d;
    const step = (key, s) => '<div class="sk-ph"><div class="t"><div class="e" style="font-weight:600">' + (done[key] ? "✅ " : "⬜ ") + esc(s.do_zh) + '</div><div class="z">' + esc((SECINFO[s.sec] || [s.sec])[0]) + '</div></div><button class="sk-ib" data-go="' + esc(s.sec) + '" data-wk="' + esc(key) + '">去练</button><button class="sk-ib" data-act="wk-ok" data-k="' + esc(key) + '">' + (done[key] ? "撤销" : "✓") + "</button></div>";
    return '<div class="sk-intro" style="font-size:15px"><b>第一次练口语？</b>不用想太多，照这三步来：<br>① 先学 <b>🆘 救命句</b>（听不懂、卡住时怎么说），心里就不慌了；② 把 <b>🙋 自我介绍</b> 练顺；③ 之后每天打开 <b>📅 每日一练</b>，15 分钟就够。<br>每句都是：点 🔊 听 → 点 🐢 慢速再听 → 点 🎙 跟着读，看哪些词读对了。</div>' +
      '<div class="sk-grid three">' + ["rescue", "intro", "daily"].map((k, i) => '<button class="sk-card" data-go="' + k + '"><div class="t"><b>' + (i + 1) + ". " + SECINFO[k][0] + "</b><span>" + SECINFO[k][1] + "</span></div><i>›</i></button>").join("") + "</div>" +
      (curDay ? '<div class="sk-sub">🧭 新手 7 天计划<small>今天做第 ' + curDay.day + " 天；做完点 ✓（点「去练」也会自动打勾）</small></div>" + '<div class="sk-box" style="margin-top:0"><h3>第 ' + curDay.day + " 天：" + esc(curDay.title) + '</h3><div class="sk-note" style="margin:0 0 6px">🎯 ' + esc(curDay.goal_zh || "") + "</div>" + curDay.steps.map((s, i) => step("w:" + curDay.day + ":" + i, s)).join("") + "</div>" +
        '<details class="sk-box"><summary style="cursor:pointer;font-weight:700;color:var(--ui-ink)">看全部 7 天</summary>' + wk.map(x => '<div style="margin-top:10px"><b>第 ' + x.d.day + " 天 · " + esc(x.d.title) + '</b> <span class="sk-note">' + x.n + " / " + x.d.steps.length + "</span>" + x.d.steps.map((s, i) => step("w:" + x.d.day + ":" + i, s)).join("") + "</div>").join("") + "</details>" : "") +
      '<div class="sk-sub">🤖 让 AI 教练给你定计划<small>回答 4 个问题，按你的情况排 7 天</small></div><div class="sk-box" style="margin-top:0">' +
      COACH_Q.map(([k, q, opts]) => '<div style="margin:6px 0 10px"><div style="font-weight:700;color:var(--ui-ink);margin-bottom:6px">' + q + '</div><span class="sk-seg" style="flex-wrap:wrap;display:inline-flex">' + opts.map(o => '<button data-coach="' + k + '" data-v="' + esc(o) + '" class="' + (coachAns[k] === o ? "on" : "") + '">' + esc(o) + "</button>").join("") + "</span></div>").join("") +
      '<button class="ui-btn pri" data-act="coach"' + (COACH && COACH.busy ? " disabled" : "") + ">" + (COACH && COACH.busy ? "AI 正在排计划……" : plan ? "重新定计划" : "🤖 生成我的计划") + "</button>" + (COACH && COACH.err ? '<div class="sk-tip">' + esc(COACH.err) + "</div>" : "") + "</div>" +
      (plan ? '<div class="sk-box"><h3>📋 AI 给你的计划</h3><div style="font-size:14.5px;line-height:1.7;color:var(--ui-ink-2)"><b>' + esc(plan.level_zh || "") + "</b><br>" + esc(plan.advice_zh || "") + "</div>" +
        (plan.days || []).map(d => '<div style="margin-top:10px"><b>第 ' + esc(d.day) + " 天 · " + esc(d.title || "") + "</b>" + (d.steps || []).map((s, i) => step("cp:" + d.day + ":" + i, s)).join("") + "</div>").join("") + (plan.encourage_zh ? '<div class="sk-tip">💪 ' + esc(plan.encourage_zh) + "</div>" : "") + "</div>" : "") +
      '<div class="sk-sub">📚 每一栏是干嘛的</div><div class="sk-grid three">' + Object.keys(SECINFO).map(k => '<button class="sk-card" data-go="' + k + '"><div class="t"><b>' + SECINFO[k][0] + "</b><span>" + SECINFO[k][1] + "</span></div><i>›</i></button>").join("") + "</div>";
  }
  async function coachRun() {
    if (COACH && COACH.busy) return; COACH = { busy: true }; draw();
    const recent = items("rec:").slice(0, 50), avg = recent.filter(r => r.score != null), hist = { 练过的情景对话: doneCount("d:"), 跟读句子: doneCount("s:"), 说过的话题: doneCount("t:"), 原声跟读: doneCount("v:"), 最近跟读平均分: avg.length ? Math.round(avg.reduce((a, r) => a + r.score, 0) / avg.length) : "还没有", 连续打卡天数: streak() };
    const text = "自我评估：" + COACH_Q.map(([k, q]) => q + "：" + (coachAns[k] || "没选")).join("；") + "\n练习记录：" + JSON.stringify(hist);
    try { const j = await AI.ask("coach", { text }); if (j.ok) { syPut("plan", { level_zh: j.level_zh, advice_zh: j.advice_zh, days: j.days, encourage_zh: j.encourage_zh, at: Date.now() }); COACH = null; } else COACH = { err: AI.msg(j, "AI 没排出来，再点一次") }; }
    catch (e) { COACH = { err: "网络问题，没连上 AI" }; }
    draw();
  }
  function listView(title, sub, L, prefix) { // 救命句 / 自我介绍：一句一句听、跟读
    let last = "";
    return '<div class="sk-bar">' + back + "</div>" + '<h2 class="sk-title">' + title + "<small>" + sub + "</small></h2>" + '<div class="sk-lines">' + L.map((x, i) => { const key = prefix + i, h = x.when && x.when !== last ? '<div class="sk-sub" style="margin:10px 0 0">' + esc(x.when) + "</div>" : ""; last = x.when || last;
      return h + '<div class="sk-ln" style="max-width:100%"><div class="sk-av">' + (isDone(key) ? "✓" : i + 1) + '</div><div class="sk-bub" style="flex:1 1 auto"><div class="sk-en">' + esc(x.en) + '</div><div class="sk-zh">' + esc(x.zh) + "</div>" + ops(key, x.en) + "</div></div>"; }).join("") + "</div>";
  }
  const rescueView = () => listView("🆘 救命句", "卡住了也能接着聊：先会说这些，开口就不慌", (D.starter && D.starter.rescue) || [], "r:");
  const introView = () => listView("🙋 自我介绍", "把这 12 句练顺，再换成你自己的信息", (D.starter && D.starter.intro) || [], "i:");

  /* ---------- 🧰 AI 工具 ---------- */
  function toolsView() {
    return '<div class="sk-intro">用 AI 帮你开口：不知道怎么说的先查「这句话怎么说」；背过的生词用「用生词说一句」练会用；想知道自己什么水平就做一次「模拟考」。</div><div class="sk-grid three">' +
      ["howto", "useword", "mock"].map(k => '<button class="sk-card" data-act="' + k + '" data-id="' + k + '"><div class="t"><b>' + SECINFO[k][0] + "</b><span>" + SECINFO[k][1] + "</span></div><i>›</i></button>").join("") + "</div>";
  }
  let HOW = { q: "", busy: false, r: null, err: "" }, HOWHIST = LG("speak:howto", []);
  function howtoView() {
    return '<div class="sk-bar">' + back + "</div>" + '<h2 class="sk-title">🧰 这句话英语怎么说<small>输入中文（或中英混着），AI 给随意 / 中性 / 正式三种说法</small></h2>' +
      '<div class="sk-box" style="margin-top:0"><textarea id="sk-how" rows="2" placeholder="比如：这个 bug 我明天再看一下 / 不好意思，能帮我打包吗" style="width:100%;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:10px 12px;font:inherit;font-size:15.5px;resize:vertical">' + esc(HOW.q) + '</textarea><div class="sk-ops"><button class="ui-btn pri" data-act="how-go"' + (HOW.busy ? " disabled" : "") + ">" + (HOW.busy ? "AI 在想……" : "怎么说") + "</button></div>" + (HOW.err ? '<div class="sk-tip">' + esc(HOW.err) + "</div>" : "") + "</div>" +
      (HOW.r ? '<div class="sk-box">' + (HOW.r.items || []).map((x, i) => '<div class="sk-item" style="margin-top:8px"><div class="e">' + esc(x.en) + '<span class="sk-reg ' + regCls(x.reg) + '">' + esc(x.reg || "") + '</span></div><div class="z">' + esc(x.note_zh || "") + "</div>" + ops("h:" + hashOf(x.en), x.en, "", '<button class="sk-ib" data-add="' + esc(x.en) + '">＋ 生词本</button>') + "</div>").join("") +
        ((HOW.r.words || []).length ? '<div class="sk-note" style="margin-top:10px">' + HOW.r.words.map(w => esc(w.en) + "（" + esc(w.zh) + "）").join("　") + "</div>" : "") + "</div>" : "") +
      (HOWHIST.length ? '<div class="sk-sub">最近查过</div><div class="sk-chips" style="flex-wrap:wrap">' + HOWHIST.slice(0, 12).map(h => '<button data-howq="' + esc(h) + '">' + esc(h) + "</button>").join("") + "</div>" : "");
  }
  async function howGo(q) {
    q = String(q || "").trim(); if (!q || HOW.busy) return; HOW = { q, busy: true, r: null, err: "" }; draw();
    HOWHIST = [q].concat(HOWHIST.filter(x => x !== q)).slice(0, 30); LS("speak:howto", HOWHIST);
    try { const j = await AI.ask("howto", { text: q }); HOW = j.ok ? { q, r: j } : { q, err: AI.msg(j, "AI 没回上来，再点一次") }; }
    catch (e) { HOW = { q, err: "网络问题，没连上 AI" }; }
    draw();
  }
  let UW = null; // 用生词说一句：{list:[w], res:{id:{busy, r, err, text}}}
  function uwPick() {
    const W = (typeof words !== "undefined" ? words : []).filter(w => (w.type || "word") !== "pattern" && w.status !== "known" && /[a-z]/i.test(w.word || ""));
    const S = (typeof state !== "undefined" && state.srs) || {}, L = W.filter(w => S[w.id]).concat(W.filter(w => !S[w.id]));
    const pool = L.slice(0, 40); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    UW = { list: pool.slice(0, 5), res: {} };
  }
  function usewordView() {
    if (!UW) uwPick();
    if (!UW.list.length) return '<div class="sk-bar">' + back + '</div><div class="sk-intro">生词本里还没有在学的词。先去生词本收几个词再来。</div>';
    return '<div class="sk-bar">' + back + '<span class="gap"></span><button class="ui-btn" data-act="uw-new">换 5 个词</button></div><h2 class="sk-title">📘 用生词说一句<small>从生词本「学习中」的词里挑 5 个：每个词用它说一句话（🎙 说或打字），AI 看你用得对不对</small></h2>' +
      UW.list.map(w => { const x = UW.res[w.id] || {}, key = "uw:" + w.id, r = RES[key] || {}; return '<div class="sk-box"><div class="sk-big" style="font-size:19px">' + esc(w.word) + ' <button class="sk-ib" data-say="' + esc(w.word) + '">🔊</button></div><div class="sk-zh" style="display:block">' + esc(w.zh || "") + "</div>" +
        '<div class="sk-ops"><button class="sk-ib rec' + (r.on ? " on" : "") + '" data-rec="' + esc(key) + '" data-t="" data-max="25" data-label="说一句">' + (r.on ? "⏹ 停止" : "🎙 说一句") + '</button><input data-uwin="' + esc(w.id) + '" placeholder="或者打字，回车提交" value="' + esc(x.text || "") + '" style="flex:1 1 200px;min-width:0;height:34px;border-radius:9px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 10px;font:inherit;font-size:14.5px"></div>' +
        (x.busy ? '<div class="sk-note">AI 在看……</div>' : x.err ? '<div class="sk-tip">' + esc(x.err) + "</div>" : x.r ? '<div class="sk-res"><div>' + (x.r.correct ? '<span class="ok">✅ 用对了</span>' : '<span class="no">❌ 还不太对</span>') + "　" + esc(x.text) + "</div>" + (x.r.fixed && x.r.fixed !== x.text ? '<div>改成：<b>' + esc(x.r.fixed) + '</b> <button class="sk-ib" data-say="' + esc(x.r.fixed) + '" style="height:26px">🔊</button></div>' : "") + '<div class="x">' + esc(x.r.why_zh || "") + '</div><div style="margin-top:4px">例句：' + esc(x.r.better || "") + ' <button class="sk-ib" data-say="' + esc(x.r.better || "") + '" style="height:26px">🔊</button><div class="x">' + esc(x.r.better_zh || "") + "</div></div></div>" : "") + "</div>"; }).join("");
  }
  async function uwCheck(id, text) {
    const w = UW && UW.list.find(x => x.id === id); text = String(text || "").trim(); if (!w || !text) return;
    UW.res[id] = { busy: true, text }; draw();
    try { const j = await AI.ask("useword", { word: w.word, zh: w.zh || "", text }); UW.res[id] = j.ok ? { r: j, text } : { err: AI.msg(j, "AI 没回上来，再试一次"), text }; if (j.ok && j.correct) markDone("uw:" + id); }
    catch (e) { UW.res[id] = { err: "网络问题", text }; }
    draw();
  }
  // 🎓 雅思口语模拟考：Part 1 四题、Part 2 一张卡（准备 1 分钟、说 2 分钟）、Part 3 两题；全部录完一起交给 AI 打分
  let MK = null;
  function mockNew() {
    const T = (D.topics || []), sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const p1 = sh(T.filter(t => t.cat === "日常" || t.cat === "兴趣")).slice(0, 4), p2 = sh(T.filter(t => (t.points || []).length >= 3 && t.cat !== "观点"))[0], p3 = sh(T.filter(t => t.cat === "观点")).slice(0, 2);
    MK = { i: -1, qs: p1.map(t => ({ part: 1, q: t.q, qzh: t.qzh, max: 40 })).concat(p2 ? [{ part: 2, q: p2.q, qzh: p2.qzh, points: p2.points, max: 130, prep: 60 }] : [], p3.map(t => ({ part: 3, q: t.q, qzh: t.qzh, max: 60 }))), ans: [], r: null };
  }
  function mockView() {
    if (!MK) mockNew();
    const q = MK.qs[MK.i], x = q ? RES["mock:" + MK.i] || {} : {};
    let body;
    if (MK.i < 0) body = '<div class="sk-box" style="margin-top:0"><div style="font-size:14.5px;line-height:1.8;color:var(--ui-ink-2)">共 ' + MK.qs.length + " 题、约 11 分钟，和真考一样：<br>• <b>Part 1</b>：4 个日常问题，每题说 2–4 句<br>• <b>Part 2</b>：一张话题卡，准备 1 分钟，说 1–2 分钟<br>• <b>Part 3</b>：2 个讨论问题，说出理由和例子<br>每题考官会读出来，你点 🎙 回答，说完点停止，下一题。全部做完 AI 按雅思标准打分（发音不算）。</div><div class=\"sk-center\"><button class=\"ui-btn pri\" data-act=\"mk-next\">开始考试</button></div></div>";
    else if (MK.i >= MK.qs.length) {
      body = MK.busy ? '<div class="sk-box"><span class="sk-note">AI 考官在打分……</span></div>' : MK.err ? '<div class="sk-tip">' + esc(MK.err) + ' <button class="sk-ib" data-act="mk-rate">重试</button></div>' : MK.r ? (() => { const r = MK.r, B = r.band || {}; return '<div class="sk-box"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline"><span style="font-size:36px;font-weight:900;color:var(--ui-pur-text)">' + esc(B.overall) + '</span><span class="sk-note" style="margin:0">流利连贯 ' + esc(B.FC) + " · 词汇 " + esc(B.LR) + " · 语法 " + esc(B.GRA) + "（发音没算）</span></div>" + '<div style="margin-top:6px;font-size:14.5px;line-height:1.7;color:var(--ui-ink-2)">' + esc(r.summary_zh || "") + "</div>" + ((r.strengths_zh || []).length ? '<div style="margin-top:6px;color:var(--ui-green,#7CE3B8);font-size:14px">' + r.strengths_zh.map(g => "👍 " + esc(g)).join("<br>") + "</div>" : "") + ((r.fixes || []).length ? '<h3 style="margin-top:12px">✏️ 改一改</h3>' + r.fixes.map(f => '<div class="sk-ph"><div class="t"><div class="z"><span style="color:var(--ui-red,#ff8080)">' + esc(f.bad) + '</span></div><div class="e">' + esc(f.good) + '</div><div class="z">' + esc(f.why_zh || "") + '</div></div><button class="sk-ib" data-say="' + esc(f.good) + '">🔊</button></div>').join("") : "") + "</div>"; })() : "";
      body += '<div class="sk-box"><h3>你的回答（转成的文字）</h3>' + MK.qs.map((q2, i) => '<div class="sk-ph" style="display:block"><div class="z">Part ' + q2.part + " · " + esc(q2.q) + '</div><div class="e" style="font-weight:500">' + esc(MK.ans[i] || "（没录到）") + "</div></div>").join("") + '</div><div class="sk-center"><button class="ui-btn" data-act="mk-again">再考一次（换题）</button></div>';
    } else body = '<div class="sk-box" style="margin-top:0"><div class="sk-note" style="margin:0">第 ' + (MK.i + 1) + " / " + MK.qs.length + " 题 · Part " + q.part + '</div><div class="sk-big" style="margin-top:6px">' + esc(q.q) + ' <button class="sk-ib" data-say="' + esc(q.q) + '">🔊</button></div><div class="sk-zh" style="display:block">' + esc(q.qzh || "") + "</div>" + (q.points ? '<div style="margin-top:8px;font-size:14.5px;color:var(--ui-ink-2);line-height:1.7">You should say:<br>' + q.points.map(p => "• " + esc(p)).join("<br>") + "</div>" : "") +
      '<div class="sk-center" style="margin-top:12px">' + recBtn("mock:" + MK.i, "", q.max, q.part === 2 ? "开始说（最长 2 分钟）" : "回答") + '<button class="ui-btn" data-act="mk-next"' + (x.busy || x.on ? " disabled" : "") + ">" + (MK.i + 1 >= MK.qs.length ? "交卷打分" : "下一题 ▶") + '</button></div><div data-res="mock:' + MK.i + '">' + resHtml("mock:" + MK.i) + "</div></div>";
    return '<div class="sk-bar">' + back + '</div><h2 class="sk-title">🎓 雅思口语模拟考<small>Part 1 → Part 2 → Part 3，AI 考官打分</small></h2>' + body;
  }
  async function mockRate() {
    MK.busy = true; MK.err = ""; draw();
    const text = MK.qs.map((q, i) => "[Part " + q.part + "] Q: " + q.q + "\nA: " + (MK.ans[i] || "(no answer)")).join("\n\n");
    try { const j = await AI.ask("speak", { prompt: "IELTS Speaking mock test, Parts 1-3 (judge all answers together)", text }); MK.busy = false; if (j.ok) { MK.r = j; markDone("mk:" + today()); fixesToErr(j.fixes, "雅思口语模拟考"); } else MK.err = j.error === "too short" ? "说得太少了，没法打分" : AI.msg(j, "AI 没打出分，点重试"); }
    catch (e) { MK.busy = false; MK.err = "网络问题"; }
    draw();
  }

  /* ---------- 🔁 句型操练 ---------- */
  function drillList() {
    const L = D.drills || [];
    return '<div class="sk-intro"><b>怎么练：</b>每个句型 6 句：看中文提示，<b>先自己用句型说出整句</b>（点 🎙），再点「看答案」对照。说顺了这个句型就是你的了。已练 ' + doneCount("dr:") + " / " + L.length + " 个。</div>" +
      '<div class="sk-grid three">' + L.map(d => card("drill", d.id, d.pat, d.zh, (d.items || []).slice(0, 2).map(x => x.en).join(" · "), isDone("dr:" + d.id))).join("") + "</div>";
  }
  const SHOWN = {};
  function drillView() {
    const d = (D.drills || []).find(x => x.id === view.id); if (!d) { view = null; return drillList(); }
    return '<div class="sk-bar">' + back + "</div>" + '<h2 class="sk-title">' + esc(d.pat) + "<small>" + esc(d.zh) + "</small></h2>" +
      '<div class="sk-lines">' + d.items.map((x, i) => { const key = "dr:" + d.id + ":" + i, sh = SHOWN[key]; return '<div class="sk-ln" style="max-width:100%"><div class="sk-av">' + (i + 1) + '</div><div class="sk-bub" style="flex:1 1 auto"><div class="sk-en" style="font-size:16px">💭 ' + esc(x.cue) + "</div>" +
        (sh ? '<div class="sk-en" style="color:var(--ui-pur-text);margin-top:4px">' + esc(x.en) + "</div>" : "") + '<div class="sk-ops">' + recBtn(key, x.en, 20, "说") + (sh ? '<button class="sk-ib" data-say="' + esc(x.en) + '">🔊</button><button class="sk-ib" data-say="' + esc(x.en) + '" data-slow="1">🐢</button>' : '<button class="sk-ib" data-act="dr-show" data-k="' + esc(key) + '">看答案</button>') + '</div><div data-res="' + esc(key) + '">' + resHtml(key) + "</div></div></div>"; }).join("") + "</div>" +
      '<div class="sk-center" style="margin-top:16px">' + (isDone("dr:" + d.id) ? '<span class="sk-note">✓ 练过了</span>' : '<button class="ui-btn" data-act="mark" data-k="dr:' + esc(d.id) + '">✓ 标记为练过</button>') + "</div>";
  }

  /* ---------- 🔊 发音：重音语调、绕口令、数字 ---------- */
  function stressView() {
    const L = D.stress || [];
    return '<div class="sk-bar">' + back + '</div><h2 class="sk-title">重音和语调<small>同一句话，重读的词不同、句尾升降不同，意思就不一样。读的时候把<b style="color:var(--ui-pur-text)">紫色</b>的词读得更重、更长、更高</small></h2>' +
      L.map((x, i) => '<div class="sk-box"><div class="sk-en">' + esc(x.en) + ' <button class="sk-ib" data-say="' + esc(x.en) + '" style="height:26px">🔊</button></div>' + (x.variants || []).map((v, j) => { const key = "st:" + i + ":" + j, re = new RegExp("\\b(" + String(v.stress || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i"); const hl = /↗|↘|rising|falling/i.test(v.stress) ? esc(x.en) + " <b style=\"color:var(--ui-pur-text)\">" + esc(v.stress) + "</b>" : esc(x.en).replace(re, '<b style="color:var(--ui-pur-text);text-transform:uppercase">$1</b>');
        return '<div class="sk-ph" style="display:block"><div class="e" style="font-weight:500">' + hl + '</div><div class="z">' + esc(v.meaning_zh) + '</div><div class="sk-ops">' + recBtn(key, x.en, 10, "读") + '</div><div data-res="' + esc(key) + '">' + resHtml(key) + "</div></div>"; }).join("") + (x.tip_zh ? '<div class="sk-note">💡 ' + esc(x.tip_zh) + "</div>" : "") + "</div>").join("") +
      '<div class="sk-note">提示：浏览器朗读不会按重音变化，🔊 只是正常读法；重音靠你自己读、录下来回放听。</div>';
  }
  function twistView() {
    const L = D.twisters || [];
    return '<div class="sk-bar">' + back + '</div><h2 class="sk-title">绕口令<small>先 🐢 慢速读准，再一点点加快；目标：正常速度读对 90% 以上</small></h2>' +
      '<div class="sk-grid">' + L.map((x, i) => '<div class="sk-item"><div class="e"><span class="sk-tag">' + esc(x.focus) + "</span>" + esc(x.en) + '</div><div class="z sk-zh">' + esc(x.zh || "") + '</div><div class="z">💡 ' + esc(x.tip_zh || "") + "</div>" + ops("tw:" + i, x.en) + "</div>").join("") + "</div>";
  }
  // 数字：电话、价格、时间、年份、大数、日期——听写和说
  const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" "), TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
  function w99(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""); }
  function w999(n) { const h = Math.floor(n / 100), r = n % 100; return (h ? ONES[h] + " hundred" + (r ? " and " : "") : "") + (r || !h ? w99(r) : ""); }
  function nWords(n) { if (n === 0) return "zero"; const p = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]], out = []; for (const [v, w] of p) if (n >= v) { out.push(w999(Math.floor(n / v)) + " " + w); n %= v; } if (n) out.push(w999(n)); return out.join(" "); }
  const MON = "January February March April May June July August September October November December".split(" ");
  const ordw = n => { const W = { 1: "first", 2: "second", 3: "third", 5: "fifth", 8: "eighth", 9: "ninth", 12: "twelfth", 20: "twentieth", 30: "thirtieth" }; if (W[n]) return W[n]; if (n > 20 && n % 10) return TENS[Math.floor(n / 10)] + "-" + (W[n % 10] || ONES[n % 10] + "th"); return w99(n) + "th"; };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function numItem() {
    const t = ["phone", "price", "time", "year", "big", "date"][rnd(0, 5)];
    if (t === "phone") { const d = "01" + rnd(0, 9) + String(rnd(1000000, 9999999)); return { t: "电话", show: d.slice(0, 3) + "-" + d.slice(3, 6) + " " + d.slice(6), ans: d, say: d.split("").map(c => (c === "0" ? "oh" : ONES[+c])).join(" ") }; }
    if (t === "price") { const a = rnd(1, 999), c = [0, 50, 90, 25, 99][rnd(0, 4)]; return { t: "价格", show: "RM" + a + (c ? "." + String(c).padStart(2, "0") : ""), ans: String(a) + (c ? String(c).padStart(2, "0") : ""), say: nWords(a) + " ringgit" + (c ? " " + nWords(c) : "") }; }
    if (t === "time") { const h = rnd(1, 12), m = [0, 5, 15, 30, 45, 20, 50][rnd(0, 6)]; return { t: "时间", show: h + ":" + String(m).padStart(2, "0"), ans: String(h) + String(m).padStart(2, "0"), say: ONES[h] + (m ? " " + (m < 10 ? "oh " + ONES[m] : w99(m)) : " o'clock") }; }
    if (t === "year") { const y = [rnd(1950, 1999), rnd(2010, 2035)][rnd(0, 1)]; return { t: "年份", show: String(y), ans: String(y), say: w99(Math.floor(y / 100)) + " " + (y % 100 === 0 ? "hundred" : y % 100 < 10 ? "oh " + ONES[y % 100] : w99(y % 100)) }; }
    if (t === "big") { const n = [rnd(1100, 9900), rnd(12000, 99000), rnd(120000, 990000), rnd(1, 9) * 1e6 + rnd(1, 9) * 1e5][rnd(0, 3)], r = Math.round(n / 100) * 100; return { t: "大数", show: r.toLocaleString("en-US"), ans: String(r), say: nWords(r) }; }
    const m = rnd(0, 11), d = rnd(1, 28); return { t: "日期", show: MON[m].slice(0, 3) + " " + d, ans: MON[m].toLowerCase() + d, say: MON[m] + " " + ordw(d) };
  }
  let NM = null; // {it, mode:"listen"|"say", typed, ok, n, right}
  function numView() {
    if (!NM) NM = { n: 0, right: 0, mode: "listen" };
    const it = NM.it, key = "nm:" + NM.n;
    let body = "";
    if (!it) body = '<div class="sk-center"><button class="ui-btn pri" data-act="nm-go" data-m="listen">🎧 听写数字</button><button class="ui-btn" data-act="nm-go" data-m="say">🗣 看数字说出来</button></div>';
    else if (NM.mode === "listen") body = '<div class="sk-note" style="text-align:center">' + esc(it.t) + '：听到的是什么？只填数字（日期填月份英文 + 日，比如 march3）</div><div class="sk-center"><button class="sk-ib" data-act="nm-play">🔊 再听</button><button class="sk-ib" data-act="nm-play" data-slow="1">🐢 慢速</button><input id="sk-num" placeholder="输入后回车" style="height:38px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 12px;font:inherit;font-size:17px;width:200px"></div>' +
      (NM.ok != null ? '<div class="sk-center" style="font-size:17px">' + (NM.ok ? "✅ 对了：" : "❌ 正确答案：") + "<b>" + esc(it.show) + '</b>　<span class="sk-note">读作 ' + esc(it.say) + '</span></div><div class="sk-center"><button class="ui-btn pri" data-act="nm-go" data-m="listen">下一个 ▶</button></div>' : "");
    else body = '<div class="sk-center"><div class="sk-timer" style="font-size:44px">' + esc(it.show) + '</div></div><div class="sk-note" style="text-align:center">' + esc(it.t) + "：用英语读出来</div><div class=\"sk-center\">" + recBtn(key, it.say, 10, "读") + '<button class="sk-ib" data-act="nm-play">听标准读法</button><button class="ui-btn" data-act="nm-go" data-m="say">下一个 ▶</button></div><div data-res="' + esc(key) + '">' + resHtml(key) + "</div>";
    return '<div class="sk-bar">' + back + '</div><h2 class="sk-title">数字和价格<small>电话、价格、时间、年份、大数、日期：一听就懵的最常见原因</small></h2><div class="sk-box" style="margin-top:0">' + body + '<div class="sk-note" style="text-align:center">' + (NM.n ? "听写对 " + NM.right + " / " + NM.n : "") + "</div></div>" +
      '<div class="sk-box"><h3>读法要点</h3><div style="font-size:14px;line-height:1.8;color:var(--ui-ink-2)">• 电话一位一位读，0 读 oh：012-345 6789 → oh one two, three four five…<br>• 价格：RM12.50 → twelve ringgit fifty（口语常说 twelve fifty）<br>• 时间：7:45 → seven forty-five；7:05 → seven oh five<br>• 年份两位两位读：1998 → nineteen ninety-eight；2024 → twenty twenty-four；2005 → two thousand five<br>• 大数三位一组：15,300 → fifteen thousand three hundred；1,200,000 → one point two million<br>• 日期用序数：March 3 → March third</div></div>';
  }
  function numCheck(v) { if (!NM || !NM.it || NM.ok != null) return; const n = String(v || "").toLowerCase().replace(/[^a-z0-9]/g, ""); NM.ok = n === NM.it.ans || n === NM.it.ans.replace(/^0+/, ""); NM.n++; if (NM.ok) NM.right++; if (NM.n % 5 === 0) markDone("nm:" + today()); draw(); }

  /* ---------- ⚡ 快问快答：听问题，3 秒内开口，AI 判断答得通不通 ---------- */
  let QK = null; // {lv, list, i, phase:"ask"|"count"|"rec"|"judge"|"done", left, r, err}
  function quickView() {
    const L = D.quick || [];
    if (!QK) return '<div class="sk-intro"><b>怎么练：</b>系统读一个问题，倒数 3 秒后自动开始录音，你马上用英语回答（一两句就行，别在心里先翻译）。AI 看你答得通不通，再给一个地道的回答。一轮 10 题。</div>' +
      '<div class="sk-grid three">' + ["入门", "基础", "进阶"].map(lv => '<button class="sk-card" data-act="qk-go" data-lv="' + lv + '"><div class="t"><b>' + lv + "</b><span>" + L.filter(x => x.level === lv).length + " 题，随机 10 题</span></div><i>›</i></button>").join("") + "</div>";
    const q = QK.list[QK.i], key = "qk:" + QK.i, x = RES[key] || {};
    if (!q) return '<div class="sk-bar"><button class="ui-btn" data-act="qk-end">← 返回</button></div><div class="sk-box"><h3>这一轮做完了 👏</h3><div class="sk-note">答得通 ' + QK.ok + " / " + QK.list.length + '</div><div class="sk-center"><button class="ui-btn pri" data-act="qk-go" data-lv="' + QK.lv + '">再来一轮</button></div></div>';
    const J = QK.j && QK.j[QK.i];
    return '<div class="sk-bar"><button class="ui-btn" data-act="qk-end">← 结束</button><span class="gap"></span><span class="sk-note" style="margin:0">' + QK.lv + " · 第 " + (QK.i + 1) + " / " + QK.list.length + "</span></div>" +
      '<div class="sk-box" style="margin-top:0;text-align:center"><div class="sk-big">' + (QK.phase === "count" ? "" : esc(q.q)) + '</div><div class="sk-zh" style="display:block">' + (QK.phase === "count" || QK.phase === "rec" ? "" : esc(q.qzh)) + "</div>" +
      (QK.phase === "count" ? '<div class="sk-timer prep">' + QK.left + '</div><div class="sk-note">准备开口……</div>' : "") +
      (QK.phase === "rec" ? '<div class="sk-timer go">🎙</div><div class="sk-center"><button class="ui-btn pri" data-rec="' + key + '" data-t="" data-max="15">⏹ 说完了</button></div>' : "") +
      (QK.phase === "judge" ? '<div class="sk-note">' + (x.busy ? "正在识别……" : "AI 在看你的回答……") + "</div>" : "") +
      (QK.phase === "done" ? '<div class="sk-res" style="text-align:left">' + (x.said ? '<div>你说：<b>' + esc(x.said) + "</b></div>" : '<div class="said">没识别到你说的话</div>') + (J ? (J.err ? '<div class="x">' + esc(J.err) + "</div>" : "<div>" + (J.correct ? '<span class="ok">✅ 答得通</span>' : '<span class="no">🤔 不太对题</span>') + "　" + esc(J.fb_zh || "") + "</div>" + (J.fix ? '<div><span class="no">' + esc(J.fix.bad) + '</span> → <span class="ok">' + esc(J.fix.good) + '</span><div class="x">' + esc(J.fix.why_zh || "") + "</div></div>" : "") + '<div style="margin-top:6px">地道回答：' + esc(J.better || q.a) + ' <button class="sk-ib" data-say="' + esc(J.better || q.a) + '" style="height:26px">🔊</button></div>') : '<div style="margin-top:6px">参考回答：' + esc(q.a) + ' <button class="sk-ib" data-say="' + esc(q.a) + '" style="height:26px">🔊</button></div>') + (x.url ? '<div style="margin-top:6px"><audio controls src="' + x.url + '"></audio></div>' : "") + '</div><div class="sk-center" style="margin-top:10px"><button class="ui-btn" data-act="qk-again">🔊 再听问题</button><button class="ui-btn pri" data-act="qk-next">下一题 ▶</button></div>' : "") +
      (QK.phase === "ask" ? '<div class="sk-note">听问题……</div>' : "") + "</div>";
  }
  function qkStart(lv) {
    const L = (D.quick || []).filter(x => x.level === lv); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    QK = { lv, list: L.slice(0, 10), i: 0, ok: 0, j: {} }; qkAsk();
  }
  function qkAsk() {
    if (!QK) return; const q = QK.list[QK.i]; if (!q) { markDone("qk:" + today()); draw(); return; }
    QK.phase = "ask"; draw(); const my = QK, i0 = QK.i;
    say(q.q, { end: () => { if (QK !== my || QK.i !== i0) return; QK.phase = "count"; QK.left = 3; draw();
      const t = setInterval(() => { if (QK !== my || QK.i !== i0) return clearInterval(t); QK.left--; if (QK.left <= 0) { clearInterval(t); QK.phase = "rec"; draw(); recStart("qk:" + i0, "", 15, x => qkJudge(my, i0, x)); } else draw(); }, 1000); } });
  }
  async function qkJudge(my, i0, x) {
    if (QK !== my) return; QK.phase = "judge"; draw();
    const q = QK.list[i0];
    if (!x.said) { QK.j[i0] = { err: "没识别到声音，下次大声一点" }; QK.phase = "done"; draw(); return; }
    try { const j = await AI.ask("judge", { prompt: q.q, text: x.said }); if (QK !== my) return; QK.j[i0] = j.ok ? j : { err: AI.msg(j, "AI 没回上来") }; if (j.ok && j.correct) QK.ok++; }
    catch (e) { if (QK === my) QK.j[i0] = { err: "网络问题" }; }
    if (QK === my) { QK.phase = "done"; draw(); }
  }

  /* ---------- 🤖 AI 陪练记录 ---------- */
  function chatSave() {
    if (!CH || CH.msgs.filter(m => m.role === "user").length < 2) return;
    CH.sid = CH.sid || Date.now().toString(36);
    syPut("chat:" + CH.sid, { title: CH.title, scene: CH.scene, msgs: CH.msgs.slice(-40).map(m => ({ role: m.role, content: m.content, fix: m.fix || null })), sum: CH.sum || null, at: Date.now() });
  }
  function chatHistHtml() {
    const L = items("chat:"); if (!L.length) return "";
    return '<div class="sk-sub">📜 聊天记录<small>' + L.length + " 次</small></div>" + '<div class="sk-grid three">' + L.slice(0, 30).map(c => { const fx = (c.msgs || []).filter(m => m.fix).length + ((c.sum && c.sum.fixes) || []).length; return '<button class="sk-card" data-act="chat-hist" data-id="' + esc(c.id) + '"><div class="t"><b>' + esc(c.title) + "</b><span>" + new Date(c.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " · " + (c.msgs || []).filter(m => m.role === "user").length + " 句" + (fx ? " · " + fx + " 处可改" : "") + "</span></div><i>›</i></button>"; }).join("") + "</div>";
  }
  async function chatFixesToBook(c) {
    const F = [].concat((c.msgs || []).filter(m => m.fix).map(m => m.fix), (c.sum && c.sum.fixes) || []), seen = new Set();
    const L = F.filter(f => f && f.good && !seen.has(f.good) && seen.add(f.good));
    if (!L.length) return tip("这次没有要改的句子");
    if (!(await U.ask("把这次聊天里改过的 " + L.length + " 句正确说法加进生词本？之后在「🔊 练习」里复习。", { ok: "加进生词本" }))) return; // ✅ 全站共用的弹窗（util.js）
    (async () => { let n = 0; for (const f of L) if (await WORD.add(f.good, { sent: f.bad ? "✗ " + f.bad : "", silent: true, learn: false, from: "口语·更好的说法" })) n++; tip("已加入生词本 " + n + " 条"); })(); // 全站共用的加词（word.js）
  }

  /* ---------- 事件 ---------- */
  function stopAll() { hush(); RP = null; SH = null; QK = null; if (TM) { clearInterval(TM.t); TM = null; } recStop(true); }
  function open(t, id) { stopAll(); view = { t, id }; QZ = null; draw(); window.scrollTo(0, 0); }
  function init() {
    if (root) return; const host = document.getElementById("view-speak"); if (!host) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    host.innerHTML = '<div id="speak"></div>'; root = host.firstChild;
    root.addEventListener("click", async e => {
      const t = e.target;
      const cp = t.closest("[data-clip]"); if (cp) { clipPlay(cp.dataset.clip, !!cp.dataset.slow); clipGet(cp.dataset.clip).then(() => { if (sec === "clip" && !view) draw(); }); return; }
      const ci = t.closest("[data-clipimg]"); if (ci) { const c = (CLIPS || []).find(x => x.mk === ci.dataset.clipimg); if (c) { c.showImg = !c.showImg; clipGet(c.mk).then(r => { if (c.showImg && !(r && r.img)) tip("这条没存画面"); draw(); }); } return; }
      const go = t.closest("[data-go]"); if (go) { if (go.dataset.wk && !done[go.dataset.wk]) markDone(go.dataset.wk); goSec(go.dataset.go); return; }
      const co = t.closest("[data-coach]"); if (co) { coachAns[co.dataset.coach] = co.dataset.v; LS("speak:coachAns", coachAns); draw(); return; }
      const hq = t.closest("[data-howq]"); if (hq) { howGo(hq.dataset.howq); return; }
      const ar = t.closest("[data-arch]"); if (ar) { playArchived(ar.dataset.arch); return; }
      const wd = t.closest("[data-word]"); if (wd) { sayWord(wd.dataset.word); return; }
      const sy = t.closest("[data-say]"); if (sy) { if (RP || SH) { RP = null; SH = null; } say(sy.dataset.say, { slow: !!sy.dataset.slow, who: sy.dataset.who || "" }); return; }
      const rx = t.closest("[data-rec-x],[data-rec-re]"); if (rx) { recAbort(rx.dataset.recX || rx.dataset.recRe, !!rx.dataset.recRe); return; }
      const rb = t.closest("[data-rec]"); if (rb) {
        const key = rb.dataset.rec, tgt = rb.dataset.t, max = +rb.dataset.max || 20;
        recStart(key, tgt, max, x => {
          if (key.indexOf("s:") === 0 && x.url) markDone(key); // 跟读句：录过就算练过
          if (RP && RP.mode === "rp" && key.indexOf("d:" + RP.id + ":") === 0) { (RP.shown = RP.shown || {})[RP.i] = true; draw(); }
          if (key.indexOf("t:") === 0 && x.url && view) { markDone(key); delete AIR[key]; draw(); }
          if (key.indexOf("v:") === 0 && x.url) markDone(key);
          if (key.indexOf("mock:") === 0 && MK) { MK.ans[+key.slice(5)] = x.said || ""; draw(); }
          if (key.indexOf("uw:") === 0) { if (x.said) uwCheck(key.slice(3), x.said); else { tip("没听清，再说一次，或者打字"); draw(); } }
          if (key.indexOf("r:") === 0 || key.indexOf("i:") === 0 || key.indexOf("tw:") === 0 || key.indexOf("dr:") === 0) { if (x.res && x.res.score >= .6) markDone(key); }
          if (key === "chat") { RES.chat = { }; if (x.said) chatSend(x.said); else { tip("没听清，再说一次，或者打字"); draw(); } }
          if (sec === "daily" && !view && key.indexOf("s:") === 0) draw();
        });
        return;
      }
      const ad = t.closest("[data-add]"); if (ad) { WORD.add(ad.dataset.add, { sent: ad.dataset.sent || "", from: "口语" }); return; }
      const bz = t.closest("[data-basic]"); if (bz) { stopAll(); if (window.enShow) window.enShow("basic", bz.dataset.basic); return; }
      const sc = t.closest("[data-sec]"); if (sc) { stopAll(); sec = sc.dataset.sec; view = null; LS("speak:sec", sec); draw(); return; }
      const vc = t.closest("[data-voice]"); if (vc) { hush(); if (window.TTS) TTS.setMode(vc.dataset.voice); draw(); if (vc.dataset.voice !== "sys" && window.TTS) TTS.load().then(() => say("Hi! This is the voice you will hear.")); return; }
      const rt = t.closest("[data-rate]"); if (rt) { opt.rate = +rt.dataset.rate; LS("speak:opt", opt); draw(); return; }
      const zh = t.closest("[data-zh]"); if (zh) { opt.zh = zh.dataset.zh === "1"; LS("speak:opt", opt); draw(); return; }
      const sg = t.closest("[data-sg]"); if (sg) { stopAll(); shadowGroup = +sg.dataset.sg; draw(); return; }
      const qz = t.closest("[data-qz]"); if (qz && QZ && QZ.cur && QZ.picked == null) { QZ.picked = +qz.dataset.qz; QZ.n++; if (QZ.picked === QZ.cur[2]) QZ.ok++; if (QZ.n >= 10) { markDone("p:" + QZ.id); tip("10 题答对 " + QZ.ok + " 题"); } quizPaint(); sayWord(QZ.cur[QZ.cur[2]]); return; }
      const b = t.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
      if (a === "chat-go") { const c = chatScenes().find(x => x.id === b.dataset.id); if (!c) return; stopAll(); CH = { id: c.id, title: c.title, scene: c.scene, msgs: [] }; chatAsk(); return; }
      if (a === "chat-end") { stopAll(); CH = null; draw(); return; }
      if (a === "chat-send") { const i = root.querySelector("#sk-say"); if (i && i.value.trim()) { const v = i.value; i.value = ""; chatSend(v); } return; }
      if (a === "chat-retry") { chatAsk(); return; }
      if (a === "chat-sum") { chatSum(); return; }
      if (a === "chat-zh") { const m = CH && CH.msgs[+b.dataset.i]; if (m && !m.zh) zhOf(m.content).then(z => { m.zh = z || "（没翻译出来）"; draw(); }); return; }
      if (a === "clip-more") { clipN += 40; draw(); return; }
      if (a === "ai-rate") { const tp = (D.topics || []).find(x => view && x.id === view.id); if (tp) aiRate("t:" + tp.id, tp.q); return; }
      if (["rescue", "intro", "howto", "useword", "mock", "drill", "stress", "twist", "num"].includes(a)) { open(a, b.dataset.id); return; }
      if (a === "wk-ok") { const k = b.dataset.k; if (done[k]) { delete done[k]; LS("speak:done", done); syDel("done:" + k); } else markDone(k); draw(); return; }
      if (a === "coach") { coachRun(); return; }
      if (a === "how-go") { const i = root.querySelector("#sk-how"); howGo(i && i.value); return; }
      if (a === "uw-new") { uwPick(); draw(); return; }
      if (a === "mk-next") { recStop(false); MK.i++; draw(); window.scrollTo(0, 0); const q = MK.qs[MK.i]; if (q) setTimeout(() => say(q.q), 300); else mockRate(); return; }
      if (a === "mk-rate") { mockRate(); return; }
      if (a === "mk-again") { mockNew(); draw(); return; }
      if (a === "dr-show") { SHOWN[b.dataset.k] = 1; draw(); const d = (D.drills || []).find(x => view && x.id === view.id), i = +b.dataset.k.split(":").pop(); if (d && d.items[i]) say(d.items[i].en); return; }
      if (a === "nm-go") { NM = NM || { n: 0, right: 0 }; NM.mode = b.dataset.m; NM.it = numItem(); NM.ok = null; NM.n2 = (NM.n2 || 0) + 1; draw(); if (NM.mode === "listen") setTimeout(() => say(NM.it.say), 200); const i = root.querySelector("#sk-num"); if (i) i.focus(); return; }
      if (a === "nm-play") { if (NM && NM.it) say(NM.it.say, { slow: !!b.dataset.slow }); return; }
      if (a === "qk-go") { stopAll(); qkStart(b.dataset.lv); return; }
      if (a === "qk-end") { stopAll(); draw(); return; }
      if (a === "qk-next") { if (QK) { QK.i++; qkAsk(); } return; }
      if (a === "qk-again") { if (QK && QK.list[QK.i]) say(QK.list[QK.i].q); return; }
      if (a === "chat-hist") { const c = items("chat:").find(x => x.id === b.dataset.id); if (c) { stopAll(); CH = { sid: c.id, title: c.title, scene: c.scene, msgs: (c.msgs || []).map(m => Object.assign({}, m)), sum: c.sum || null }; draw(); window.scrollTo(0, 0); } return; }
      if (a === "chat-book") { if (CH) chatFixesToBook(CH); return; }
      if (a === "back") { stopAll(); const home = () => { view = null; draw(); window.scrollTo(0, 0); }; if (window.NAV) NAV.back(home); else home(); return; } // 回到上一个页面（不一定是这一栏的列表）
      if (["dialog", "func", "pair", "conn", "topic"].includes(a)) { open(a, b.dataset.id); return; }
      if (a === "mark") { markDone(b.dataset.k); draw(); return; }
      if (a === "play") { if (RP && RP.mode === "play") { stopAll(); draw(); } else { stopAll(); RP = { id: view.id, i: 0, mode: "play" }; rpStep(); } return; }
      if (a === "rp") { if (RP && RP.mode === "rp") { stopAll(); draw(); } else { stopAll(); RP = { id: view.id, i: 0, mode: "rp", shown: {} }; rpStep(); } return; }
      if (a === "rp-show") { if (RP) { (RP.shown = RP.shown || {})[+b.dataset.i] = true; draw(); const d = D.dialogs.find(x => x.id === RP.id); if (d) say(d.lines[RP.i].en); } return; }
      if (a === "rp-next") { if (RP) { recStop(true); RP.i++; rpStep(); } return; }
      if (a === "sh") { if (SH) { stopAll(); draw(); } else { stopAll(); SH = { g: shadowGroup, i: 0 }; shStep(); } return; }
      if (a === "qz-go") { QZ = null; quizNew(); return; }
      if (a === "qz-next") { quizNew(); return; }
      if (a === "qz-again") { if (QZ && QZ.cur) sayWord(QZ.cur[QZ.cur[2]], { rate: Math.min(opt.rate, 1) }); return; }
      if (a === "tm") { stopAll(); const total = +b.dataset.s || 60; TM = { id: view.id, phase: total > 60 ? "talk" : "prep", left: total > 60 ? total : 15, total }; if (TM.phase === "talk") recStart("t:" + TM.id, "", total + 5, () => { TM = null; markDone("t:" + view.id); draw(); }); TM.t = setInterval(tmTick, 1000); timerPaint(); return; }
      if (a === "tm-stop") { if (!TM) return; if (TM.phase === "prep") { TM.left = 1; tmTick(); } else { clearInterval(TM.t); recStop(false); } return; }
    });
    root.addEventListener("keydown", e => {
      if (e.key !== "Enter" || e.isComposing) return;
      if (e.target.id === "sk-say") { e.preventDefault(); const v = e.target.value; e.target.value = ""; chatSend(v); }
      else if (e.target.dataset.uwin) { e.preventDefault(); uwCheck(e.target.dataset.uwin, e.target.value); }
      else if (e.target.id === "sk-num") { e.preventDefault(); numCheck(e.target.value); }
      else if (e.target.id === "sk-how" && !e.shiftKey) { e.preventDefault(); howGo(e.target.value); }
    });
    root.addEventListener("change", e => { if (e.target.id === "sk-auto") { chatAuto = e.target.checked; LS("speak:chatAuto", chatAuto); } });
    KEYS.on("speak", { when: () => !!root && KEYS.visible(root) }, k => { if (k === "esc") { stopAll(); draw(); return true; } return false; }); // ⌨️ 全站共用的快捷键（keys.js）：Esc 全停
  }
  // 🔙 页面历史：口语在哪一栏、打开了哪个条目（看不到口语页时不记）
  if (window.NAV) NAV.reg("speak", () => document.documentElement.classList.contains("show-speak") ? { sec, v: view ? { t: view.t, id: view.id } : null } : undefined, x => {
    if (!x) return; const v = x.v && x.v.t ? { t: x.v.t, id: x.v.id } : null;
    if (x.sec === sec && JSON.stringify(v) === JSON.stringify(view && { t: view.t, id: view.id })) return;
    stopAll(); if (x.sec && SECS.some(s2 => s2[0] === x.sec) && !MOVED.includes(x.sec)) { sec = x.sec; LS("speak:sec", sec); } view = v; QZ = null; draw(); window.scrollTo(0, 0);
  });
  window.speakShow = o => { init(); if (!root) return; const was = only; only = MOVED.includes(o) ? o : null; if (was !== only) { stopAll(); view = null; } draw(); if (!D) loadData().then(draw); syPull().then(ch => { if (root && document.documentElement.classList.contains("show-speak")) draw(); }); };
  window.speakHide = () => { if (root) { stopAll(); } };
  // 直达链接（?go=speak）或上次停在口语页：切换标签的代码比本文件先跑，那时还没有 speakShow，这里补画一次
  const boot = () => { const h = document.documentElement; init(); if (h.classList.contains("show-speak")) { let o; if (h.classList.contains("show-basic")) { try { o = localStorage.getItem("en_sub_basic") === "pron" ? "pron" : "start"; } catch (e) { o = "start"; } } window.speakShow(o); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
