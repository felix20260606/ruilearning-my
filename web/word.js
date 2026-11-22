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
  #wd-pop .hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#wd-pop .hd b{font-size:22px}#wd-pop .hd .ph{color:var(--ui-muted);font-size:14px}
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
`;
  { const st = document.createElement("style"); st.id = "wd-color-css"; st.textContent = COLOR_CSS; (document.head || document.documentElement).append(st); } // 颜色一加载就要有（不等查词卡片）

  /* ---------- 生词本状态（按原形匹配；规则同插件 web/vs/vlevel.js 的 vsKeys） ---------- */
  function stems(w) { const o = [w]; if (/ies$/.test(w)) o.push(w.slice(0, -3) + "y"); if (/(es|ed)$/.test(w)) o.push(w.slice(0, -2), w.slice(0, -1)); if (/s$/.test(w)) o.push(w.slice(0, -1)); if (/ing$/.test(w)) o.push(w.slice(0, -3), w.slice(0, -3) + "e"); if (/(.)\1(ed|ing)$/.test(w)) o.push(w.replace(/(.)\1(ed|ing)$/, "$1")); return o; }
  const keysOf = w => { try { if (typeof vsKeys === "function") return [w].concat(vsKeys(w)); } catch (e) {} return stems(w); };
  const lemma = w => { try { return typeof vsLemma === "function" ? vsLemma(w) : w; } catch (e) { return w; } };
  let book = new Map(), bookK = null;
  function loadBook() {
    book = new Map(); bookK = null;
    try { (typeof words !== "undefined" ? words : []).forEach(w => { const k = String(w.word || "").toLowerCase().replace(/[{}]/g, "").replace(/’/g, "'").trim(); if (k && (!book.has(k) || w.status === "known")) book.set(k, w.status === "known" ? "kn" : "lr"); }); } catch (e) {}
  }
  function bookIdx() { if (!bookK || bookK.fn !== typeof vsKeys) { bookK = new Map(); bookK.fn = typeof vsKeys; book.forEach((v, k) => keysOf(k).forEach(q => { if (!bookK.has(q) || v === "kn") bookK.set(q, v); })); } return bookK; }
  function status(w) {
    w = String(w || "").toLowerCase().replace(/’/g, "'"); if (!w) return "";
    if (!book.size) loadBook();
    const B = bookIdx(); for (const s of keysOf(w)) if (B.has(s)) return B.get(s);
    return "";
  }

  /* ---------- 查词（/api/dict 或 index.html 的 dictGet；变形查不到用原形再查） ---------- */
  const DC = new Map();
  async function dict(w) {
    const k = w.toLowerCase(); if (DC.has(k)) return DC.get(k);
    const get = async q => { try { if (window.dictGet) return await window.dictGet(q); const r = await fetch("/api/dict?w=" + encodeURIComponent(q)); if (!r.ok) return null; const j = await r.json(); return j && j.ok ? j : null; } catch (e) { return null; } };
    let j = await get(k); const l = lemma(k); if (!j && l && l !== k) j = await get(l);
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
      if (a === "px") close(); else if (a === "psay") say(b.dataset.t || pWord); else if (a === "padd") addWord(b);
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
    const st = status(w);
    return st ? '<button class="ui-btn in" disabled>' + (st === "kn" ? "已在生词本（已掌握）" : "已在生词本") + "</button>" : '<button class="ui-btn pri" data-a="padd">＋ 加入生词本</button>';
  }
  function html(w, d, loading) {
    const word = (d && d.word) || w, cam = "https://dictionary.cambridge.org/dictionary/english-chinese-simplified/" + encodeURIComponent(word.toLowerCase());
    const g = pEl && typeof VS_GRAM_NAME !== "undefined" ? [...pEl.classList].filter(c => /^g-/.test(c)).map(c => VS_GRAM_NAME[c.slice(2)]).filter(Boolean) : [];
    let h = '<div class="hd"><b>' + esc(word) + "</b>" + (d && d.phon ? '<span class="ph">' + esc(d.phon) + "</span>" : "") + '<button data-a="psay" data-t="' + esc(word) + '" title="朗读">🔊</button><button class="x" data-a="px" title="关闭">✕</button></div>';
    if (loading) h += '<div class="ld">查询中…</div>';
    else if (d) {
      const zh = (Array.isArray(d.zh) ? d.zh.join("；") : d.zh || "") + (Array.isArray(d.zhs) && d.zhs.length ? "（" + d.zhs.map(x => (x.pos ? x.pos + " " : "") + (x.terms || []).slice(0, 3).join("、")).join("；") + "）" : "");
      const en = Array.isArray(d.en) ? d.en.slice(0, 3).map(x => typeof x === "string" ? x : (x.pos ? "(" + x.pos + ") " : "") + (x.def || "")).join("; ") : d.en || ""; // /api/dict：en 是 [{pos, def, ex}]
      if (zh) h += '<div class="zh">' + esc(zh) + "</div>"; if (en) h += '<div class="en">' + esc(en) + "</div>";
      (Array.isArray(d.examples) ? d.examples : []).filter(x => x && x[0]).slice(0, 2).forEach(x => { h += '<div class="ex"><button data-a="psay" data-t="' + esc(x[0]) + '" title="朗读例句">🔊</button><div>' + esc(x[0]) + (x[1] ? "<small>" + esc(x[1]) + "</small>" : "") + "</div></div>"; });
    } else h += '<div class="ld">（没查到释义）</div>';
    if (!loading) {
      if (pSent && pOpt && pOpt.showCtx) h += '<div class="ctx">' + esc(pSent).replace(new RegExp("(^|[^\\p{L}])(" + reEsc(esc(w)) + ")(?![\\p{L}])", "iu"), "$1<b>$2</b>") + (pOpt.zh ? "<small>" + esc(pOpt.zh) + "</small>" : "") + "</div>";
      const extra = vsOk() && V().sheetExtra ? V().sheetExtra(word, pEl) : ""; // 语法、单词注释、📌 将要学习 / ✅ 已掌握 / 不学习（同插件）
      if (extra) h += extra; else if (g.length) h += '<div class="gm">这里的语法：' + esc(g.join(" · ")) + "</div>";
    }
    return h + '<div class="act">' + (loading ? "" : addBtn(word)) + '<a href="' + cam + '" target="_blank" rel="noopener">Cambridge 词典 ↗</a></div>';
  }
  async function open(w, el, opt) { // opt：{ sent 例句, zh 例句的中文, quiet 不自动读, onAdd(词), showCtx 卡片里显示这句 }
    build(); w = String(w || "").replace(/’/g, "'").trim(); if (!w) return;
    const my = ++req; pWord = w; pEl = el || null; pOpt = opt || {}; pSent = pOpt.sent ? String(pOpt.sent) : "";
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
    if (o.learn !== false && vsOk() && V().markOf(lw) !== "learn") { V().setMark(lw, "learn"); const lb = pop && pWord.toLowerCase() === lw && pop.querySelector("[data-m=learn]"); if (lb) lb.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === lb)); } // 加进生词本 = 将要学习
    setTimeout(() => { loadBook(); if (book.size && !status(lw)) book.set(lw, "lr"); bookK = null; changed(lw, "learn"); }, 300);
    return ok;
  }
  function addWord(b) { // 查词卡片上的「＋ 加入生词本」
    const d = DC.get(pWord.toLowerCase()), w = String((d && d.word) || pWord).toLowerCase(), cb = pOpt && pOpt.onAdd;
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
  function bind(box, o) {
    if (!box || box.__word) return; box.__word = 1; o = o || {};
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

  /* 🎨 英文 → 能点、按水平上色的 html（全站共用：阅读、视频字幕、听力文稿、背单词卡片）
     WORD.html(英文, { level 换一个词汇水平（不传 = 跟插件设置）, settings 额外的插件设置, gram:false 不画语法下划线 })
     ① 插件那套（web/vs/：按词汇水平上色、语法下划线、短语框、你的标记）② 生词本：已掌握的去掉颜色，在学的淡紫底（wd-lr）
     vs 模块还没加载：先给不上色、但能点的词，同时去加载，加载好发 word-change {m:"ready"}，各页面重画 */
  const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu; // 和 web/vs/vlevel.js 的 VS_WORD_RE 一样
  // vs 模块在「转义后的文本」里找单词：&amp; / &quot; 里的字母会被当成单词，所以先换成占位符 / 弯引号，上色后再换回实体
  const protect = t => String(t).replace(/&/g, "\u0001").replace(/</g, "\u0002").replace(/>/g, "\u0003").replace(/(^|[\s(\[{—–-])"/g, "$1“").replace(/"/g, "”");
  const unprotect = h => h.replace(/\u0001/g, "&amp;").replace(/\u0002/g, "&lt;").replace(/\u0003/g, "&gt;");
  let colorLoading = null;
  function html(t, o) {
    o = o || {}; const pt = protect(t), v = V(); let h = null;
    try {
      if (o.level == null && !o.settings && v && v.ready && v.ready()) h = v.html(pt); // 跟插件设置：直接用视频页那一份（还带你的标记、保存过的短语框）
      else if (typeof vsMark === "function") {
        const S = Object.assign({ fadeRare: true }, (v && v.settings && v.settings()) || {}, o.settings || {}, o.level != null ? { level: o.level } : {});
        h = vsMark(pt, S);
        if (o.gram !== false && S.showGram !== false && /\s/.test(t) && typeof vsGramHtml === "function") h = vsGramHtml(h).replace(/ g-(\w+)(?=[ "])/g, (a, c) => (S["g_" + c] === false ? "" : a));
      }
    } catch (e) { h = null; U.log("word", "上色出错", String(e && e.message || e)); }
    if (h == null) {
      h = pt.replace(WORD_RE, w => '<span class="vs-w" data-w="' + w + '">' + w + "</span>");
      if (!colorLoading && v && v.load) colorLoading = Promise.resolve(v.load()).then(() => changed("", "ready"), () => {});
    }
    h = h.replace(/<span class="([^"]*)" data-w="([^"]*)">/g, (a, cl, w) => {
      if (!/\bvs-w\b/.test(cl)) return a; const st = status(w); if (!st) return a;
      return '<span class="' + cl.replace(/\s*\bvs-(u1|u2|ln|lo|k|sp|rare)\b/g, "") + (st === "lr" ? " wd-lr" : "") + '" data-w="' + w + '">';
    });
    return unprotect(h);
  }
  window.WORD = { html, bind, open, close, mark, cycle, status, loadBook, dict, add, get openWord() { return pWord; } };
  // 旧接口（read.js / listen.js 以前用的）
  window.readPop = (w, el, opt) => open(w, el, opt || {});
  window.readBook = reload => { if (reload || !book.size) loadBook(); if (typeof vsKeys !== "function") vsLoad(); return status; };
})();
