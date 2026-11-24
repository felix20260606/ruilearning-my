/* 🔤 全站共用的单词操作（阅读、听力文稿、视频字幕、练习卡片、口语对话、练习课……都用这一套，和插件一致）
   - 点词 → 查词卡片：音标、🔊、中文、英文释义、例句、这里的语法、单词注释、📌 将要学习 / ✅ 已掌握 / 🚫 不学习 / ↺ 恢复默认、＋ 加入生词本、Cambridge 链接
     电脑上贴着单词弹出，手机上从底部弹出；点外面 / Esc / 滚动（电脑）关掉
   - 右键（手机长按）单词：本来的颜色 → 将要学习（带框）→ 已掌握（白色）→ 回到本来的颜色；本来就是白色的词只在「白色 / 带框」之间切换
   - 加进生词本 = 同时标「将要学习」；标记写回 /api/ext（插件同步过去）和生词本的掌握状态（watch.js 的 window.__vs.setMark）
   - 标记 / 加词以后发 document 事件「word-change」{w, m}，各页面自己重新上色
   用法：
     WORD.bind(容器, { sent(el) → 这个词所在的句子, quiet() → true 时点词不自动朗读, onOpen(w, el) 打开卡片前（比如暂停视频）, onAdd(w) })
       容器里带 data-w="词" 的元素都按这一套处理（点词 + 右键）；一个容器只 bind 一次
     WORD.open(词, 元素, { sent, quiet, onAdd })、WORD.close()、WORD.mark(词, "learn"|"known"|"ignore"|"")
     WORD.bind(容器, {hover: "rl"}) 停留出 Language Reactor 练习那种小卡片（• 意思 + ✓ 已掌握 + 📖 词典），「🔊 练习」用
     不在任何容器里的 data-w 单词：全站兜底，也是 点一下出卡片 / 停留出气泡 / 右键循环标记（页面上随便哪里写 <b data-w="词"> 就行）
     WORD.hover(容器) 只加「停留出小气泡」（bind 已经自带）；鼠标停在词上出两三个意思 + 语法 + 注释 + 词频（同插件），手机上没有
     WORD.html(英文, {level, settings, gram}) → 能点、按水平上色的 html（全站单词颜色都用它）
     WORD.add(词, {sent, silent, learn, from}) 加进生词本（全站加词都用它）→ true 加了 / false 本来就有 / null 失败
     WORD.status(词) → "kn" 已掌握 / "lr" 在学 / ""（按原形匹配生词本，收了 go，went / goes 也算）；WORD.loadBook() 生词本变了以后重读
   旧接口照旧能用：window.readPop(词, 元素, opt)、window.readBook(reload) → status 函数（听力文稿上色用）
   依赖 util.js（U）；index.html 的全局：words（生词本）、speak、toast、quickAdd(词, 例句)、window.dictGet（查词，没有就直接 /api/dict）；watch.js 的 window.__vs */
(function () {
  "use strict";
  if (window.WORD) return;
  const { esc, tip } = U; // util.js
  const say = t => { try { speak(t); } catch (e) {} };
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isSheet = () => { try { return matchMedia("(max-width: 600px)").matches; } catch (e) { return innerWidth <= 600; } };
  const V = () => window.__vs || null, vsOk = () => !!(V() && V().ready && V().ready());
  const vsLoad = () => { try { return V() && V().load ? V().load() : Promise.resolve(); } catch (e) { return Promise.resolve(); } };

  const CSS = `
  #wd-mask{position:fixed;inset:0;z-index:8990;background:rgba(0,0,0,.45);display:none}#wd-mask.on{display:block}
  #wd-pop{position:fixed;z-index:9000;display:none;width:340px;max-width:calc(100vw - 16px);max-height:60vh;overflow:auto;background:var(--ui-surface,#26282c);border:1px solid var(--ui-line-2,#454950);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);padding:12px 14px;color:var(--ui-ink,#eee);font-family:var(--ui-font,system-ui);text-align:left}
  #wd-pop.on{display:block}
  #wd-pop.sheet{left:0!important;right:0;top:auto!important;bottom:0;width:auto;max-width:none;max-height:72vh;border-radius:18px 18px 0 0;border-bottom:0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}
  #wd-pop .hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#wd-pop .hd b{font-size:22px}#wd-pop .hd .ph{color:var(--ui-muted);font-size:14px}#wd-pop .gd{font-size:15px;font-weight:800;border-radius:6px;padding:1px 6px;vertical-align:3px}#wd-pop .gd.der{color:#6fb3ff;background:rgba(111,179,255,.14)}#wd-pop .gd.die{color:#ff8fa3;background:rgba(255,143,163,.14)}#wd-pop .gd.das{color:#7ce3b8;background:rgba(124,227,184,.14)}
  #wd-pop .hd button{border:0;background:var(--ui-surface-2,#2d2f34);color:var(--ui-ink-2);border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:15px}#wd-pop .hd .x{margin-left:auto;background:none}
  #wd-pop .mk{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}#wd-pop .mk button{flex:1 1 auto;min-height:36px;border-radius:9px;border:1px solid var(--ui-line-2,#454950);background:var(--ui-surface-2,#2d2f34);color:var(--ui-ink,#eee);font:inherit;font-size:13px;cursor:pointer;padding:0 8px}
  #wd-pop .mk button.on{background:var(--ui-pur,#9C3FD0);border-color:var(--ui-pur,#9C3FD0);color:#fff}#wd-pop .vs-wns{margin-top:8px}
  #wd-pop .zh{margin-top:8px;font-size:16.5px;font-weight:700;line-height:1.5}#wd-pop .en{margin-top:6px;color:var(--ui-ink-2);font-size:14px;line-height:1.55}
  #wd-pop .ld{margin-top:8px;color:var(--ui-muted);font-size:14px}
  #wd-pop .ex{display:flex;gap:8px;align-items:flex-start;margin-top:8px;background:var(--ui-surface-2,#2d2f34);border-radius:10px;padding:8px 10px;font-size:14px;line-height:1.5}#wd-pop .ex small{display:block;color:var(--ui-muted);font-size:12.5px}
  #wd-pop .ex button{flex:0 0 auto;border:0;background:none;cursor:pointer;padding:0;font-size:13px;line-height:1.5}
  #wd-pop .ctx{margin-top:8px;font-size:13.5px;line-height:1.55;color:var(--ui-ink-2);border-left:3px solid var(--ui-pur-line,#6d3a8f);padding-left:8px}#wd-pop .ctx b{color:var(--ui-ink)}#wd-pop .ctx small{display:block;color:var(--ui-muted)}
  #wd-pop .gm{margin-top:8px;font-size:13px;color:#9cc8ff}
  #wd-pop .act{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}#wd-pop .act .ui-btn{flex:1 1 auto}#wd-pop .act .ui-btn.in{background:var(--ui-surface-2);border-color:var(--ui-line-2);color:var(--ui-muted);cursor:default}
  #wd-pop .act a{font-size:13px;white-space:nowrap;color:var(--ui-pur-text)}
  @media(max-width:600px){#wd-pop .act .ui-btn{min-height:46px}}`;
  const COLOR_CSS = `
  /* 🎨 单词颜色（全站共用：阅读、视频字幕、听力文稿、背单词卡片……都是这一份；颜色和插件一样，按词汇水平） */
  .vs-w{cursor:pointer;border-radius:3px}.vs-w:hover{background:var(--ui-surface-3,#363940)}
  .vs-w.vs-k{color:var(--vs-ck,#7CE3B8)}.vs-w.vs-u1,.vs-w.vs-ln{color:var(--vs-cs,#FFB86B)}.vs-w.vs-u2{color:var(--vs-ci,#CDA8F7)}.vs-w.vs-sp{color:var(--vs-cp,#7CE3B8)}
  .vs-w.vs-rare{opacity:.55}
  .vs-w.vs-lo{box-shadow:inset 0 0 0 1.5px #E9CF8A;background:rgba(255,226,140,.14);border-radius:6px;padding:0 3px}
  .vs-w.vs-pk{background:rgba(120,175,240,.32);box-shadow:0 0 0 2px rgba(120,175,240,.32);border-radius:4px}
  .vs-w[class*=" g-"]{text-underline-offset:4px}
  .vs-w.g-pa{text-decoration:underline solid #5BB0FF 2px}.vs-w.g-pf{text-decoration:underline double #35D0BA 2px}.vs-w.g-pg{text-decoration:underline wavy #8EE05A 2px}.vs-w.g-md{text-decoration:underline dashed #FF8FC7 2px}.vs-w.g-pv{text-decoration:underline solid #FF7A59 3.5px}.vs-w.g-s3{text-decoration:underline dotted #5BB0FF 2.5px}.vs-w.g-pl{text-decoration:underline dotted #B0B7C0 2.5px}.vs-w.g-art{text-decoration:underline dotted #E8D36B 2.5px}.vs-w.g-cmp{text-decoration:underline dashed #C9A0FF 2px}.vs-w.g-neg{box-shadow:inset 0 2px 0 #FF5C5C}
  .vs-w.vs-ph{background:rgba(255,226,140,.13);box-shadow:inset 0 1.5px 0 #E9CF8A,inset 0 -1.5px 0 #E9CF8A;border-radius:0;padding:0 2px}.vs-w.vs-ph.ph-s{border-radius:5px 0 0 5px;box-shadow:inset 0 1.5px 0 #E9CF8A,inset 0 -1.5px 0 #E9CF8A,inset 1.5px 0 0 #E9CF8A}.vs-w.vs-ph.ph-e{border-radius:0 5px 5px 0;box-shadow:inset 0 1.5px 0 #E9CF8A,inset 0 -1.5px 0 #E9CF8A,inset -1.5px 0 0 #E9CF8A}
  .vs-w.wd-lr{background:var(--ui-pur-soft,rgba(156,63,208,.18));box-shadow:0 0 0 2px var(--ui-pur-soft,rgba(156,63,208,.18));border-radius:4px}

  /* 🫧 鼠标停在词上的小气泡（和插件看视频时一样：两三个意思 + 这里的语法 + 单词注释 + 词频条），只在有鼠标的电脑上 */
  #wd-mini{position:fixed;z-index:9001;transform:translate(-50%,-100%);background:#2A5F99;color:#fff;border-radius:10px;padding:8px 14px 9px;text-align:center;font:500 15px/1.35 system-ui,"PingFang SC",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4);pointer-events:none;max-width:320px}
  #wd-mini::after{content:"";position:absolute;left:var(--ax,50%);top:100%;margin-left:-7px;border:7px solid transparent;border-top-color:#2A5F99}
  #wd-mini.dn{transform:translate(-50%,0)}#wd-mini.dn::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#2A5F99}
  #wd-mini .ms div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#wd-mini .m1{opacity:.85}#wd-mini .m2{opacity:.7}
  #wd-mini .lm{font-size:.82em;opacity:.85;margin-top:3px;border-top:1px solid rgba(255,255,255,.2);padding-top:3px}
  #wd-mini .gm{font-size:.8em;opacity:.9;margin-top:4px;color:#CFE6FF}
  #wd-mini .fb{display:inline-block;width:52px;height:5px;border-radius:3px;background:rgba(0,0,0,.35);overflow:hidden;vertical-align:middle;margin-top:6px}#wd-mini .fb i{display:block;height:100%;background:#C9A7E8;border-radius:3px}
  #wd-mini .vs-wns{text-align:left;font-size:12.5px;margin-top:5px}

  /* 「🔊 练习」卡片上的停留小卡片（同 Language Reactor 练习）：深色，列两三个意思，下面 ✓ 标已掌握、📖 打开完整词典；鼠标能移进去点按钮 */
  #wd-mini.rl{transform:translate(-50%,-100%);background:#2f3136;border:1px solid #4a4d53;color:#eef0f2;border-radius:8px;padding:10px 12px 8px;text-align:left;font-size:18px;line-height:1.55;box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:auto;min-width:120px}
  #wd-mini.rl::after{display:none}#wd-mini.rl.dn{transform:translate(-50%,0)}
  #wd-mini.rl .ms div{white-space:nowrap;opacity:1;padding-left:18px;position:relative}#wd-mini.rl .ms div::before{content:"";position:absolute;left:4px;top:.62em;width:7px;height:7px;border-radius:50%;background:#6b6f76}
  #wd-mini.rl .bt{display:flex;gap:6px;margin-top:8px}
  #wd-mini.rl .bt button{flex:1;display:flex;align-items:center;justify-content:center;height:34px;min-width:58px;border-radius:9px;border:0;background:#45484e;cursor:pointer;padding:0}
  #wd-mini.rl .bt button:hover{background:#55585f}
  #wd-mini.rl .bt .kn{background:transparent;outline:2px dotted #7CE3B8;outline-offset:-3px}#wd-mini.rl .bt .kn.on{background:#2f6b52;outline:0}
  .vs-w.wd-hl{background:#3a3d43!important;border-radius:4px}
`;
  { const st = document.createElement("style"); st.id = "wd-color-css"; st.textContent = COLOR_CSS; (document.head || document.documentElement).append(st); } // 颜色一加载就要有（不等查词卡片）

  /* ---------- 生词本状态（按原形匹配；规则同插件 web/vs/vlevel.js 的 vsKeys） ---------- */
  function stems(w) { const o = [w]; if (/ies$/.test(w)) o.push(w.slice(0, -3) + "y"); if (/(es|ed)$/.test(w)) o.push(w.slice(0, -2), w.slice(0, -1)); if (/s$/.test(w)) o.push(w.slice(0, -1)); if (/ing$/.test(w)) o.push(w.slice(0, -3), w.slice(0, -3) + "e"); if (/(.)\1(ed|ing)$/.test(w)) o.push(w.replace(/(.)\1(ed|ing)$/, "$1")); return o; }
  const DE = () => window.VL === "de" && window.DE_FORMS;
  const keysOf = w => { try { if (typeof vsKeys === "function") return [w].concat(vsKeys(w)); } catch (e) {} return stems(w); };
  // 德语（de-forms.js）：生词本里的词按原样（再去掉变音的写法），文章里的词推回可能的原形去比：Häuser / gemacht / ging 都能框到 Haus / machen / gehen
  const bookKeys = w => (DE() ? [...new Set([w, w.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")])] : keysOf(w));
  const textKeys = w => (DE() ? window.DE_FORMS.keys(w) : keysOf(w));
  const lemma = w => { try { return typeof vsLemma === "function" ? vsLemma(w) : w; } catch (e) { return w; } };
  let book = new Map(), bookK = null;
  function loadBook() {
    book = new Map(); bookK = null;
    try { (typeof words !== "undefined" ? words : []).forEach(w => { const k = String(w.word || "").toLowerCase().replace(/[{}]/g, "").replace(/’/g, "'").trim(); if (k && (!book.has(k) || w.status === "known")) book.set(k, w.status === "known" ? "kn" : "lr"); }); } catch (e) {}
  }
  function bookIdx() { if (!bookK || bookK.fn !== typeof vsKeys) { bookK = new Map(); bookK.fn = typeof vsKeys; book.forEach((v, k) => bookKeys(k).forEach(q => { if (!bookK.has(q) || v === "kn") bookK.set(q, v); })); } return bookK; }
  function status(w) {
    w = String(w || "").toLowerCase().replace(/’/g, "'"); if (!w) return "";
    if (!book.size) loadBook();
    const B = bookIdx(); for (const s of textKeys(w)) if (B.has(s)) return B.get(s);
    return "";
  }

  /* ---------- 查词（/api/dict 或 index.html 的 dictGet；变形查不到用原形再查） ---------- */
  const DC = new Map();
  async function dict(w) {
    const k = window.VL === "de" ? String(w).normalize("NFC") : w.toLowerCase(); if (DC.has(k)) return DC.get(k); // 德语：大小写不同是不同的词（Morgen 早晨 / morgen 明天、Essen / essen），按原样查
    const get = async q => { try { if (window.dictGet) return await window.dictGet(q); const r = await fetch("/api/dict?w=" + encodeURIComponent(q)); if (!r.ok) return null; const j = await r.json(); return j && j.ok ? j : null; } catch (e) { return null; } };
    let j = await get(k); const l = DE() ? (j && j.lemma) || "" : lemma(k); if (!j && l && l !== k) j = await get(l); // 德语：变形查不到时用后台给的原形（ging → gehen）
    if (j) DC.set(k, j); return j;
  }

  /* ---------- 查词卡片 ---------- */
  let pop = null, mask = null, req = 0, pWord = "", pSent = "", pEl = null, pOpt = null;
  function build() {
    if (pop) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    mask = document.createElement("div"); mask.id = "wd-mask"; mask.onclick = close;
    pop = document.createElement("div"); pop.id = "wd-pop"; pop.setAttribute("role", "dialog");
    document.body.append(mask, pop);
    pop.addEventListener("click", e => {
      const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
      if (a === "pcorp") { const w = pWord; close(); if (window.corpusShow) window.corpusShow(w); return; } // 🔎 真人例句（corpus.js，按需加载）
      if (a === "px") close(); else if (a === "psay" && b.dataset.au && window.TTS && TTS.url) TTS.url(b.dataset.au, b.dataset.t || pWord, { lang: "de" }); /* 🇩🇪 有真人录音（维基共享资源）先放录音 */ else if (a === "psay") say(b.dataset.t || pWord); else if (a === "padd") addWord(b);
      else if (a === "mk") { const m = b.dataset.m; b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b && !!m)); mark(pWord, m); }
    });
    // 点卡片外面关掉（点的是另一个词就换成那个词）；Esc 关；电脑上滚动就关（贴着单词的位置不对了）
    document.addEventListener("click", e => { if (pop.classList.contains("on") && !pop.contains(e.target) && !(pEl && pEl.contains(e.target)) && !e.target.closest("[data-w]")) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && pop.classList.contains("on")) { close(); e.stopPropagation(); } }, true);
    window.addEventListener("scroll", () => { if (pop.classList.contains("on") && !pop.classList.contains("sheet")) close(); }, { passive: true });
    window.addEventListener("resize", place);
  }
  function place() {
    if (!pop || !pop.classList.contains("on")) return;
    const sh = isSheet(); pop.classList.toggle("sheet", sh); mask.classList.toggle("on", sh);
    if (sh || !pEl || !pEl.isConnected) { if (!sh) { pop.style.left = Math.max(8, (innerWidth - pop.offsetWidth) / 2) + "px"; pop.style.top = "80px"; } return; }
    const r = pEl.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8), top = r.bottom + 8;
    if (top + h > innerHeight - 8 && r.top - h - 8 > 8) top = r.top - h - 8; // 下面放不下就放到上面
    pop.style.left = left + "px"; pop.style.top = Math.max(8, Math.min(top, innerHeight - h - 8)) + "px";
  }
  function addBtn(w) {
    let st = status(w);
    if (st && window.VL === "de") { const n = x => String(x || "").normalize("NFC").replace(/[{}]/g, "").trim(), W0 = n(w), L = typeof words !== "undefined" ? words : []; // 德语：收了 Morgen（早晨）不等于收了 morgen（明天）
      if (!L.some(x => n(x.word) === W0) && L.some(x => n(x.word).toLowerCase() === W0.toLowerCase())) st = ""; }
    return st ? '<button class="ui-btn in" disabled>' + (st === "kn" ? "已在生词本（已掌握）" : "已在生词本") + "</button>" : '<button class="ui-btn pri" data-a="padd">＋ 加入生词本</button>';
  }
  function html(w, d, loading) {
    const word = (d && d.word) || w, cam = "https://dictionary.cambridge.org/dictionary/english-chinese-simplified/" + encodeURIComponent(word.toLowerCase());
    const g = pEl && typeof VS_GRAM_NAME !== "undefined" ? [...pEl.classList].filter(c => /^g-/.test(c)).map(c => VS_GRAM_NAME[c.slice(2)]).filter(Boolean) : [];
    let h = '<div class="hd"><b>' + (d && d.gender ? '<span class="gd ' + esc(d.gender) + '">' + esc(d.gender) + "</span> " : "") + esc(word) + "</b>" + (d && d.lemma ? '<span class="ph">← ' + esc(d.lemma) + "</span>" : "") + (d && d.phon ? '<span class="ph">' + esc(d.phon) + "</span>" : "") + '<button data-a="psay" data-t="' + esc(word) + '"' + (d && d.audio && window.VL === "de" ? ' data-au="' + esc(d.audio) + '" title="真人发音（维基共享资源）">🎙' : ' title="朗读">🔊') + '</button><button class="x" data-a="px" title="关闭">✕</button></div>';
    if (loading) h += '<div class="ld">查询中…</div>';
    else if (d) {
      const zh = (Array.isArray(d.zh) ? d.zh.join("；") : d.zh || "") + (Array.isArray(d.zhs) && d.zhs.length ? "（" + d.zhs.map(x => (x.pos ? x.pos + " " : "") + (x.terms || []).slice(0, 3).join("、")).join("；") + "）" : "");
      const en = Array.isArray(d.en) ? d.en.slice(0, 3).map(x => typeof x === "string" ? x : (x.pos ? "(" + x.pos + ") " : "") + (x.def || "")).join("; ") : d.en || ""; // /api/dict：en 是 [{pos, def, ex}]
      if (zh) h += '<div class="zh">' + esc(zh) + "</div>"; if (en) h += '<div class="en">' + esc(en) + "</div>";
      (Array.isArray(d.examples) ? d.examples : []).filter(x => x && x[0]).slice(0, 2).forEach(x => { h += '<div class="ex"><button data-a="psay" data-t="' + esc(x[0]) + '" title="朗读例句">🔊</button><div>' + esc(x[0]) + (x[1] ? "<small>" + esc(x[1]) + "</small>" : "") + "</div></div>"; });
    } else h += '<div class="ld">（没查到释义）</div>';
    if (!loading) {
      if (pSent && pOpt && pOpt.showCtx) h += '<div class="ctx">' + esc(pSent).replace(new RegExp("(^|[^\\p{L}])(" + reEsc(esc(w)) + ")(?![\\p{L}])", "iu"), "$1<b>$2</b>") + (pOpt.zh ? "<small>" + esc(pOpt.zh) + "</small>" : "") + "</div>";
      const extra = vsOk() && V().sheetExtra && window.VL !== "de" ? V().sheetExtra(word, pEl) : ""; // 德语：插件的难度（英语词频）和标记（英语）不适用 // 语法、单词注释、📌 将要学习 / ✅ 已掌握 / 不学习（同插件）
      if (extra) h += extra; else if (g.length) h += '<div class="gm">这里的语法：' + esc(g.join(" · ")) + "</div>";
    }
    return h + '<div class="act">' + (loading ? "" : addBtn(word)) + (window.VL && window.VL !== "en" && window.VL !== "de" ? "" : '<button class="ui-btn" data-a="pcorp" title="看这个词在真人视频、' + (window.VL === "de" ? "DW 慢速新闻" : "BBC 节目") + '里怎么说">🔎 真人例句</button>') + (window.VL === "de" ? '<a href="https://www.dict.cc/?s=' + encodeURIComponent(word) + '" target="_blank" rel="noopener">dict.cc 德英词典 ↗</a>' : '<a href="' + cam + '" target="_blank" rel="noopener">Cambridge 词典 ↗</a>') + "</div>";
  }
  async function open(w, el, opt) { // opt：{ sent 例句, zh 例句的中文, quiet 不自动读, onAdd(词), showCtx 卡片里显示这句 }
    build(); w = String(w || "").replace(/’/g, "'").trim(); if (!w) return;
    hideMini(); const my = ++req; pWord = w; pEl = el || null; pOpt = opt || {}; pSent = pOpt.sent ? String(pOpt.sent) : "";
    pop.innerHTML = html(w, null, true); pop.classList.add("on"); place();
    if (!pOpt.quiet) say(w);
    const [d] = await Promise.all([dict(w), vsLoad()]); if (my !== req || !pop.classList.contains("on")) return;
    pop.innerHTML = html(w, d, false); place();
  }
  function close() { if (!pop) return; req++; pWord = ""; pEl = null; pop.classList.remove("on", "sheet"); mask.classList.remove("on"); }
  const changed = (w, m) => { try { document.dispatchEvent(new CustomEvent("word-change", { detail: { w, m } })); } catch (e) {} };
  // ＋ 加入生词本（全站共用：查词卡片、阅读关键词、听力 / 练习课的词汇、口语的「更好的说法」、背单词的推荐生词都走这里）
  // WORD.add(词, { sent 例句, silent 不弹提示, learn:false 不标「将要学习」, from 哪来的（记日志用）}) → true 加进去了 / false 本来就有 / null 失败
  async function add(w, o) {
    o = o || {}; w = String(w || "").trim(); if (!w) return false;
    const qa = typeof quickAdd === "function" ? quickAdd : null, lw = w.toLowerCase();
    if (!qa) { if (!o.silent) tip("生词本还没准备好，暂时加不了"); U.log("word", "加词失败：生词本还没加载", w); return null; }
    let ok; try { ok = await qa(w, o.sent || ""); } catch (e) { U.log("word", "加词失败：" + w, String(e && e.message || e)); if (!o.silent) tip("加入失败，请再试一次"); return null; }
    U.log("word", (ok ? "加入生词本 " : "已在生词本 ") + w, o.from || "");
    if (!o.silent) tip(ok ? "已加入生词本：" + w : "已在生词本里");
    if (o.learn !== false && window.VL !== "de" && (ok === true || status(lw) !== "kn") && vsOk() && V().markOf(lw) !== "learn") { /* 插件的「将要学习」标记只有英语 */ V().setMark(lw, "learn"); const lb = pop && pWord.toLowerCase() === lw && pop.querySelector("[data-m=learn]"); if (lb) lb.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === lb)); } // 加进生词本 = 将要学习
    setTimeout(() => { loadBook(); if (book.size && !status(lw)) book.set(lw, "lr"); bookK = null; changed(lw, "learn"); }, 300);
    return ok;
  }
  function addWord(b) { // 查词卡片上的「＋ 加入生词本」
    const de = window.VL === "de", d = DC.get(de ? String(pWord).normalize("NFC") : pWord.toLowerCase()), w = de ? String((d && d.word) || pWord) : String((d && d.word) || pWord).toLowerCase(), cb = pOpt && pOpt.onAdd; // 德语：名词保留大写（词典给的写法，如 Haus）
    b.disabled = true; b.textContent = "加入中…";
    add(w, { sent: pSent, from: "查词卡片" }).then(res => {
      if (res == null) { b.disabled = false; b.textContent = "＋ 加入生词本"; return; }
      b.className = "ui-btn in"; b.textContent = "已在生词本";
      if (cb) setTimeout(() => { try { cb(w); } catch (e) {} }, 300);
    });
  }

  const MK_NAME = { learn: "将要学习", known: "已掌握", ignore: "不学习", "": "恢复默认" };
  async function mark(w, m, toastIt) {
    await vsLoad(); if (!(V() && V().setMark)) { tip("标记功能还没加载好"); return; }
    if (toastIt) tip(w + " → " + MK_NAME[m || ""]);
    try { await V().setMark(w, m || ""); } catch (e) {}
    loadBook(); changed(w, m || "");
  }
  function cycle(w) { // 右键：按插件的规则换到下一个标记
    w = String(w || "").replace(/’/g, "'"); if (!w) return;
    vsLoad().then(() => { if (!(V() && V().next)) return; mark(w, V().next(w), true); });
  }

  /* ---------- 绑到页面上：容器里带 data-w 的都按这一套 ---------- */
  /* ---------- 🫧 停留：鼠标停在词上 0.09 秒，词上方出小气泡（同插件看视频）；移开 0.25 秒后消失；点了就换成完整的查词卡片 ---------- */
  const canHover = () => { try { return matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { return false; } };
  let mini = null, hT = 0, xT = 0;
  function hideMini() { clearTimeout(hT); clearTimeout(xT); if (mini) { if (mini._el) mini._el.classList.remove("wd-hl"); mini.remove(); mini = null; } }
  const ICON_OK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7CE3B8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_BOOK = '<svg width="24" height="22" viewBox="0 0 24 22"><path d="M2 3.5C5 2 8.5 2 12 4v15c-3.5-2-7-2-10-.5z" fill="#F2A93B"/><path d="M22 3.5C19 2 15.5 2 12 4v15c3.5-2 7-2 10-.5z" fill="#E8962A"/><path d="M14.5 7.5h5M14.5 10.5h5M14.5 13.5h5" stroke="#7a4a0c" stroke-width="1.3"/></svg>';
  function showMini(el, style) {
    hideMini(); if (!el.isConnected || (pop && pop.classList.contains("on"))) return;
    if (style === "rl") return showRl(el);
    const w = el.dataset.w, lw = String(w).toLowerCase().replace(/’/g, "'");
    const g = typeof VS_GRAM_NAME !== "undefined" ? [...el.classList].filter(c => /^g-/.test(c)).map(c => VS_GRAM_NAME[c.slice(2)] && VS_GRAM_NAME[c.slice(2)] + (typeof VS_GRAM_ABBR !== "undefined" && VS_GRAM_ABBR[c.slice(2)] ? " " + VS_GRAM_ABBR[c.slice(2)] : "")).filter(Boolean) : [];
    const EN = window.VL !== "de"; // 单词注释、词频条、不规则变化都是英语的数据：学德语时不显示（以前德语 am / was 会冒出「be：是」）
    let notes = ""; try { const S = V() && V().settings ? V().settings() : null; if (EN && (!S || S.n_word !== false) && typeof vsWordNotesHtml === "function" && !/\s/.test(w)) notes = vsWordNotesHtml(w, true) || ""; } catch (e) {}
    let fb = ""; try { if (EN && typeof vsRank === "function") { const r = vsRank(lw), f = r === Infinity ? 1 : Math.max(0.16, Math.min(1, r / 6000)); fb = '<span class="fb" title="词频（越长越少见）"><i style="width:' + Math.round(f * 100) + '%"></i></span>'; } } catch (e) {}
    const my = mini = document.createElement("div"); my.id = "wd-mini"; my._el = el;
    my.innerHTML = '<div class="ms">…</div>' + (g.length ? '<div class="gm">语法：' + esc(g.join(" · ")) + "</div>" : "") + notes + fb;
    document.body.append(my);
    const fix = () => {
      if (mini !== my) return;
      const r = el.getBoundingClientRect(), H = my.offsetHeight, W = my.offsetWidth;
      const cx = Math.max(W / 2 + 6, Math.min(r.left + r.width / 2, innerWidth - W / 2 - 6));
      my.style.left = cx + "px"; my.style.setProperty("--ax", Math.max(14, Math.min(W - 14, r.left + r.width / 2 - (cx - W / 2))) + "px");
      const up = r.top - 10 - H >= 6; my.classList.toggle("dn", !up); my.style.top = (up ? r.top - 10 : r.bottom + 10) + "px";
    };
    fix();
    const lem = EN && typeof VS_IRR !== "undefined" && VS_IRR[lw]; // 不规则变化：went → go 的意思也给
    if (lem && window.TR) TR.word(lem).then(r => { if (mini !== my || !r.zh.length) return; const d = document.createElement("div"); d.className = "lm"; d.textContent = lem + "：" + r.zh[0]; my.insertBefore(d, my.querySelector(".gm") || my.querySelector(".fb")); fix(); });
    (window.TR ? TR.word(w) : Promise.resolve({ zh: [] })).then(r => {
      if (mini !== my) return; const m = (r.zh || []).slice(0, 3);
      my.querySelector(".ms").innerHTML = m.length ? m.map((x, i) => '<div class="m' + i + '">' + esc(x) + "</div>").join("") : "<div>—</div>"; fix();
    });
  }
  function showRl(el) { // 同 Language Reactor 练习：• 意思（最多 3 个）+ ✓ 已掌握 / 📖 完整词典
    const w = el.dataset.w, lw = String(w).toLowerCase().replace(/’/g, "'"), known = () => vsOk() && V().markOf && V().markOf(lw) === "known";
    const my = mini = document.createElement("div"); my.id = "wd-mini"; my.className = "rl"; my._el = el; el.classList.add("wd-hl");
    my.innerHTML = '<div class="ms"><div>…</div></div><div class="bt"><button type="button" class="kn' + (known() ? " on" : "") + '" data-m="known" title="已掌握（再点取消）">' + ICON_OK + '</button><button type="button" data-m="dict" title="完整词典">' + ICON_BOOK + "</button></div>";
    document.body.append(my);
    const fix = () => {
      if (mini !== my) return;
      const r = el.getBoundingClientRect(), H = my.offsetHeight, W = my.offsetWidth, cx = Math.max(W / 2 + 6, Math.min(r.left + r.width / 2, innerWidth - W / 2 - 6));
      my.style.left = cx + "px"; const up = r.top - 8 - H >= 6; my.classList.toggle("dn", !up); my.style.top = (up ? r.top - 8 : r.bottom + 8) + "px";
    };
    fix();
    my.addEventListener("mouseenter", () => { clearTimeout(xT); clearTimeout(hT); }); my.addEventListener("mouseleave", () => { clearTimeout(xT); xT = setTimeout(hideMini, 250); });
    my.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return; e.stopPropagation();
      if (b.dataset.m === "dict") { hideMini(); open(w, el, { sent: el.closest("[data-sent]") ? el.closest("[data-sent]").dataset.sent : "" }); return; }
      const on = !b.classList.contains("on"); b.classList.toggle("on", on); mark(lw, on ? "known" : "", true);
    });
    (window.TR ? TR.word(w) : Promise.resolve({ zh: [] })).then(r => { if (mini !== my) return; const m = (r.zh || []).slice(0, 3); my.querySelector(".ms").innerHTML = m.length ? m.map(x => "<div>" + esc(x) + "</div>").join("") : "<div>—</div>"; fix(); });
  }
  function hover(box, o) { // 给一个容器里的词（data-w）加上停留气泡；bind 会自动加，只要停留不要点词的页面（视频字幕自己管点击）单独调
    if (!box || box.__wdHover) return; box.__wdHover = 1; o = o || {};
    if (!o.global && box.setAttribute) box.setAttribute("data-wd-bound", "1"); // 这个容器里的词归它自己管，全站兜底不插手
    box.addEventListener("mouseover", e => {
      if (!canHover()) return; const el = e.target.closest && e.target.closest("[data-w]"); if (!el || !box.contains(el) || (o.skip && o.skip(el))) return;
      clearTimeout(xT); if (mini && mini._el === el) return; clearTimeout(hT); hT = setTimeout(() => showMini(el, o.hover), 90);
    });
    box.addEventListener("mouseout", e => {
      const el = e.target.closest && e.target.closest("[data-w]"); if (!el || (e.relatedTarget && el.contains(e.relatedTarget)) || (o.skip && o.skip(el))) return;
      clearTimeout(hT); clearTimeout(xT); xT = setTimeout(hideMini, 250); // 先清掉旧的：容器和全站兜底都会跑到这里，两个计时器只清得掉一个，小卡片 / 下一个词的气泡会被误关
    });
  }
  // 里面的列表、字幕滚动（不冒泡到 window）也关；小卡片自己滚动不关
  window.addEventListener("scroll", e => { if (mini && !(e.target && e.target.nodeType === 1 && mini.contains(e.target))) hideMini(); }, { passive: true, capture: true });
  // 词被重画掉了（字幕换句、改完标记重新上色）：它不会再触发 mouseout，鼠标一动就把挂着的气泡关掉
  document.addEventListener("mouseover", e => { if (mini && mini._el && !mini._el.isConnected && !mini.contains(e.target)) { clearTimeout(xT); hideMini(); } }, { passive: true });
  function bind(box, o) {
    if (!box || box.__word) return; box.__word = 1; o = o || {};
    box.setAttribute("data-wd-bound", "1");
    hover(box, o);
    box.addEventListener("click", e => {
      const el = e.target.closest("[data-w]"); if (!el || !box.contains(el) || (o.skip && o.skip(el))) return;
      if (String(window.getSelection ? getSelection() : "").trim()) return; // 拖选文字不算点词
      e.stopPropagation(); e.preventDefault();
      if (o.onOpen) try { o.onOpen(el.dataset.w, el); } catch (er) {}
      open(el.dataset.w, el, { sent: o.sent ? o.sent(el) : "", zh: o.zh ? o.zh(el) : "", quiet: o.quiet ? !!o.quiet(el) : false, onAdd: o.onAdd, showCtx: !!o.showCtx });
    }, true);
    box.addEventListener("contextmenu", e => {
      const el = e.target.closest("[data-w]"); if (!el || !box.contains(el) || (o.skip && o.skip(el))) return;
      e.preventDefault(); e.stopPropagation(); close(); cycle(el.dataset.w);
    }, true);
  }

  /* 🔤 全站兜底：不在任何 WORD.bind / WORD.hover 容器里的单词（data-w，比如「每日」的难词、背单词首页的队列、写作的高级词、听力生词表），
     也是同一套：点一下出查词卡片、停留出小气泡、右键按插件规则循环标记 */
  const loose = t => { const el = t && t.closest && t.closest("[data-w]"); return el && !el.closest("[data-wd-bound]") && !el.closest("#wd-pop, #wd-mini") ? el : null; };
  document.addEventListener("click", e => {
    const el = loose(e.target); if (!el || e.defaultPrevented || String(window.getSelection ? getSelection() : "").trim()) return;
    e.preventDefault(); e.stopPropagation(); open(el.dataset.w, el, { sent: el.dataset.sent || "" });
  });
  document.addEventListener("contextmenu", e => { const el = loose(e.target); if (!el) return; e.preventDefault(); close(); cycle(el.dataset.w); });
  hover(document, { global: true, skip: el => !loose(el) });
  // 📱 iPhone / iPad：长按不会触发 contextmenu（安卓会，那边走上面的右键），自己数 0.55 秒：长按单词 = 右键循环标记
  if (typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))) {
    let lpT = 0, lpEl = null, lpDone = 0;
    const lpOff = () => { clearTimeout(lpT); lpT = 0; lpEl = null; };
    document.addEventListener("touchstart", e => {
      lpOff(); const el = e.target.closest && e.target.closest("[data-w]"); if (!el || e.touches.length !== 1 || el.closest("#wd-pop, #wd-mini")) return;
      lpEl = el; lpT = setTimeout(() => { const w = lpEl && lpEl.dataset.w; lpOff(); if (!w) return; lpDone = Date.now(); close(); hideMini(); cycle(w); }, 550);
    }, { passive: true });
    document.addEventListener("touchmove", lpOff, { passive: true });
    document.addEventListener("touchend", e => { lpOff(); if (Date.now() - lpDone < 800) e.preventDefault(); }, { passive: false }); // 长按完松手：不再当成点一下（不弹查词卡片）
    document.addEventListener("touchcancel", lpOff, { passive: true });
  }
  document.addEventListener("keydown", e => { if (e.key !== "Enter") return; const el = loose(e.target); if (el && el.tabIndex >= 0) { e.preventDefault(); open(el.dataset.w, el, {}); } });

  /* 🎨 英文 → 能点、按水平上色的 html（全站共用：阅读、视频字幕、听力文稿、背单词卡片）
     WORD.html(英文, { level 换一个词汇水平（不传 = 跟插件设置）, settings 额外的插件设置, gram:false 不画语法下划线 })
     ① 插件那套（web/vs/：按词汇水平上色、语法下划线、短语框、你的标记）② 生词本：已掌握的去掉颜色，在学的淡紫底（wd-lr）
     vs 模块还没加载：先给不上色、但能点的词，同时去加载，加载好发 word-change {m:"ready"}，各页面重画 */
  const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu; // 和 web/vs/vlevel.js 的 VS_WORD_RE 一样
  // vs 模块在「转义后的文本」里找单词：&amp; / &quot; 里的字母会被当成单词，所以先换成占位符 / 弯引号，上色后再换回实体
  const protect = t => String(t).replace(/&/g, "\u0001").replace(/</g, "\u0002").replace(/>/g, "\u0003").replace(/(^|[\s(\[{—–-])"/g, "$1“").replace(/"/g, "”");
  const unprotect = h => h.replace(/\u0001/g, "&amp;").replace(/\u0002/g, "&lt;").replace(/\u0003/g, "&gt;");
  let colorLoading = null;
  function colorHtml(t, o) { // 别叫 html：上面画查词卡片的函数已经叫 html 了（同名会把它盖掉，卡片就只剩一个词）
    o = o || {}; const pt = protect(t), v = V(); let h = null;
    const foreign = window.VL && window.VL !== "en"; // 学德语等：词频、语法下划线都是按英语算的，不上色（以前德语词全被当成生僻词变淡）
    if (!foreign) try {
      if (o.level == null && !o.settings && v && v.ready && v.ready()) h = v.html(pt); // 跟插件设置：直接用视频页那一份（还带你的标记、保存过的短语框）
      else if (typeof vsMark === "function") {
        const S = Object.assign({ fadeRare: true }, (v && v.settings && v.settings()) || {}, o.settings || {}, o.level != null ? { level: o.level } : {});
        h = vsMark(pt, S);
        if (o.gram !== false && S.showGram !== false && /\s/.test(t) && typeof vsGramHtml === "function") h = vsGramHtml(h).replace(/ g-(\w+)(?=[ "])/g, (a, c) => (S["g_" + c] === false ? "" : a));
      }
    } catch (e) { h = null; U.log("word", "上色出错", String(e && e.message || e)); }
    if (h == null) {
      h = pt.replace(WORD_RE, w => '<span class="vs-w" data-w="' + w + '">' + w + "</span>");
      if (!foreign && !colorLoading && v && v.load) colorLoading = Promise.resolve(v.load()).then(() => changed("", "ready"), () => {});
    }
    h = h.replace(/<span class="([^"]*)" data-w="([^"]*)">/g, (a, cl, w) => {
      if (!/\bvs-w\b/.test(cl)) return a; const st = status(w); if (!st) return a;
      return '<span class="' + cl.replace(/\s*\bvs-(u1|u2|ln|lo|k|sp|rare)\b/g, "") + (st === "lr" ? " wd-lr" : "") + '" data-w="' + w + '">';
    });
    return unprotect(h);
  }
  window.WORD = { html: colorHtml, bind, hover, open, close, mark, cycle, status, loadBook, dict, add, get openWord() { return pWord; } };
  // 旧接口（read.js / listen.js 以前用的）
  window.readPop = (w, el, opt) => open(w, el, opt || {});
  window.readBook = reload => { if (reload || !book.size) loadBook(); if (typeof vsKeys !== "function") vsLoad(); return status; };
})();
