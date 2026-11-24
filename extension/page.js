// 🌐 任意英文网页（YouTube、B 站、生词本网站以外）：查词、收词、学习模式（对标 Readlang / Toucan）
// - 双击一个词（或选中 2–6 个词再点旁边的「查」）：弹出查词卡片 —— 中文、音标、英文释义、🔊、＋ 收进生词本（带上这一句当例句）、✓ 认识了
// - 📖 学习模式（右下角的小按钮，每个网站分开记，默认关）：正文里的词按你的词汇水平上色（和字幕同一套：在学的词加黄框、难词下划线），点词也出卡片
//   右下角按钮上的 ✕：这个网站不再显示按钮
// 用到：vlevel.js（vsMark / vsMarkOf，VS_SAVED / VS_MARKS）、freq.js（词频）；查词、收词、发音都交给后台 background.js（"word" / "add" / "tts" / "vocabMark"）
(function () {
  "use strict";
  if (window.__vsPage) return; window.__vsPage = true;
  const host = location.hostname;
  // 插件被重新加载 / 更新后，旧网页里的这份脚本和插件断开了：chrome.* 一调就报错。先看一眼还连着没有
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  const send = m => new Promise(res => { if (!alive()) return res({}); try { chrome.runtime.sendMessage(m, r => { void chrome.runtime.lastError; res(r || {}); }); } catch (e) { res({}); } });
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let S = { level: -1, ratio: 1.5, target: "zh-CN", srcLang: "en", fadeRare: true, showMarks: true };
  const loadState = () => new Promise(res => { if (!alive()) return res(); try { chrome.storage.sync.get(S, s => { S = s || S; chrome.storage.local.get({ saved: [], marks: {} }, v => { VS_SAVED = new Set((v.saved || []).map(w => String(w).toLowerCase())); VS_MARKS = v.marks || {}; res(); }); }); } catch (e) { res(); } });
  const local = () => (alive() ? chrome.storage.local : null);

  // ---------- 卡片（Shadow DOM：不受网页样式影响，也不影响网页） ----------
  let hostEl = null, sh = null, card = null, cur = "", curCtx = "";
  function ui() {
    if (hostEl) return; hostEl = document.createElement("vs-page"); hostEl.style.cssText = "all:initial;position:absolute;top:0;left:0;z-index:2147483646"; document.documentElement.append(hostEl);
    sh = hostEl.attachShadow({ mode: "closed" }); // 网页的脚本拿不到里面的按钮
    sh.innerHTML = `<style>
      .c{position:fixed;width:320px;max-width:calc(100vw - 16px);max-height:60vh;overflow:auto;background:#26282c;color:#eee;border:1px solid #454950;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.45);padding:12px 14px;font:14px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;display:none}
      .c.on{display:block}.hd{display:flex;align-items:center;gap:8px}.w{font-size:19px;font-weight:800}.ph{color:#9aa0a6;font-size:13px}.sp{flex:1}
      button{font:inherit;cursor:pointer;border-radius:9px;border:1px solid #454950;background:#2d2f34;color:#eee;min-height:32px;padding:0 10px}button.p{background:#7c4dcc;border-color:#7c4dcc;color:#fff}button.ok{background:#2f7d5d;border-color:#2f7d5d;color:#fff}
      .zh{margin-top:6px;font-size:15px}.en{color:#b8bcc2;font-size:13px;margin-top:4px}.ctx{margin-top:8px;color:#b8bcc2;font-size:12.5px;border-left:3px solid #6d3a8f;padding-left:8px}.ctx b{color:#fff}
      .act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.st{color:#9aa0a6;font-size:12.5px;margin-top:6px}
      .q{position:fixed;display:none;background:#7c4dcc;color:#fff;border:0;border-radius:8px;min-height:28px;padding:0 10px;font:600 13px -apple-system,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3)}.q.on{display:block}
      .pill{position:fixed;right:14px;bottom:14px;display:none;align-items:center;gap:2px;background:#26282c;color:#eee;border:1px solid #454950;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35);font:600 13px -apple-system,sans-serif;overflow:hidden}
      .pill.on{display:flex}.pill button{border:0;border-radius:0;background:transparent;min-height:34px}.pill button.t.active{background:#7c4dcc;color:#fff}.pill button.x{color:#9aa0a6;padding:0 9px}
    </style><div class="c"></div><button class="q">🔎 查</button><div class="pill"><button class="t" title="学习模式：按你的词汇水平给这个网站的正文上色，点词查意思">📖 学习模式</button><button class="x" title="这个网站不再显示这个按钮">✕</button></div>`;
    card = sh.querySelector(".c");
    sh.addEventListener("click", e => { if (e.isTrusted) onCardClick(e); }); // 只认真的点击（网页脚本模拟的不算）
    sh.querySelector(".q").addEventListener("click", e => { if (!e.isTrusted) return; const s = selText(); hideQ(); if (s) open(s.text, s.rect, s.ctx); });
    sh.querySelector(".pill .t").addEventListener("click", e => { if (e.isTrusted) toggleMode(); });
    sh.querySelector(".pill .x").addEventListener("click", e => { if (!e.isTrusted || !local()) return; chrome.storage.local.get({ pageHide: {} }, v => { const o = v.pageHide || {}; o[host] = 1; chrome.storage.local.set({ pageHide: o }); }); sh.querySelector(".pill").classList.remove("on"); });
  }
  function place(rect) {
    const W = Math.min(320, innerWidth - 16), x = Math.max(8, Math.min(rect.left, innerWidth - W - 8)), below = rect.bottom + 8, H = Math.min(card.offsetHeight || 220, innerHeight * 0.6);
    card.style.left = x + "px"; card.style.top = (below + H < innerHeight - 8 ? below : Math.max(8, rect.top - H - 8)) + "px";
  }
  function close() { if (card) card.classList.remove("on"); cur = ""; }
  async function open(text, rect, ctx) {
    if (!alive()) return; ui(); await loadState();
    const w = String(text).trim().replace(/\s+/g, " ").replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, ""); if (!w) return;
    cur = w; try { curCtx = (typeof ctx === "function" ? ctx() : ctx) || ""; } catch (e) { curCtx = ""; } // 例句：点开卡片时才去算（以前每次松开鼠标都算一遍整段文字）
    const lw = w.toLowerCase(), mk = typeof vsMarkOf === "function" ? vsMarkOf(lw) : "";
    card.innerHTML = '<div class="hd"><span class="w">' + esc(w) + '</span><span class="ph"></span><span class="sp"></span><button data-a="say" title="朗读">🔊</button><button data-a="x" title="关掉">✕</button></div><div class="zh">查询中…</div>' + ctxHtml(w, curCtx) +
      '<div class="act">' + (mk === "learn" ? '<button disabled>已在生词本</button>' : '<button class="p" data-a="add">＋ 收进生词本</button>') + (mk === "known" ? '<button disabled>✓ 已认识</button>' : '<button class="ok" data-a="known">✓ 认识了</button>') + "</div>";
    card.classList.add("on"); place(rect);
    const r = await send({ type: /\s/.test(w) ? "wordLite" : "word", word: w, tl: S.target || "zh-CN", sl: "en" });
    if (cur !== w) return;
    const g = r && r.g, d = r && r.d, zh = []; if (g) { if (g.t) zh.push(g.t); (g.zh || []).forEach(z => (z.words || []).slice(0, 3).forEach(x => { if (!zh.includes(x) && zh.length < 6) zh.push(x); })); }
    const en = d && d.meanings && d.meanings[0] && d.meanings[0].defs && d.meanings[0].defs[0] ? "(" + (d.meanings[0].pos || "") + ") " + d.meanings[0].defs[0].def : "";
    card.querySelector(".zh").textContent = zh.length ? zh.join("；") : "没查到"; if (d && d.phonetic) card.querySelector(".ph").textContent = d.phonetic;
    if (en) card.querySelector(".zh").insertAdjacentHTML("afterend", '<div class="en">' + esc(en) + "</div>");
    place(rect);
  }
  function ctxHtml(w, ctx) {
    if (!ctx) return ""; const i = ctx.toLowerCase().indexOf(w.toLowerCase()); if (i < 0) return '<div class="ctx">' + esc(ctx) + "</div>";
    return '<div class="ctx">' + esc(ctx.slice(0, i)) + "<b>" + esc(ctx.slice(i, i + w.length)) + "</b>" + esc(ctx.slice(i + w.length)) + "</div>";
  }
  async function onCardClick(e) {
    const b = e.target.closest("button[data-a]"); if (!b) return; const a = b.dataset.a, w = cur, lw = w.toLowerCase();
    if (a === "x") return close();
    if (a === "say") { const r = await send({ type: "tts", text: w, lang: "en" }); if (r && r.a) { try { await new Audio(r.a).play(); return; } catch (er) {} } try { const u = new SpeechSynthesisUtterance(w); u.lang = "en-US"; speechSynthesis.speak(u); } catch (er) {} return; }
    if (a === "add") {
      if (!local()) { b.textContent = "插件更新过：刷新这个网页再试"; return; }
      b.disabled = true; b.textContent = "收进中…";
      // 同字幕页（content.js 的 setMark）：这个词各种形式的手动标记都去掉、取消标记的记录也去掉；记下这一句当例句（同步时补词条用，tag「网页」）
      await new Promise(res => chrome.storage.local.get({ marks: {}, savedCtx: {}, unmk: {} }, v => {
        const m = v.marks || {}, C = v.savedCtx || {}, U = v.unmk || {}; Object.keys(m).forEach(x => { if (vsSame(x, lw)) delete m[x]; }); delete U[lw];
        C[lw] = Object.assign(curCtx ? { t: curCtx } : {}, { at: Date.now(), tag: "网页" }); chrome.storage.local.set({ marks: m, savedCtx: C, unmk: U }, res);
      }));
      const r = await send({ type: "add", word: w, tl: S.target || "zh-CN", ctx: curCtx ? { t: curCtx } : null, tag: "网页", queueOnly: /\s/.test(w) }); // 短语只进待整理（同字幕页）
      b.textContent = !r || r.ok === false ? "没收进去，再试一次" : r.cloud === false ? "✓ 已存本机，联网后同步" : "✓ 已收进生词本"; if (!r || r.ok === false) b.disabled = false;
      await loadState(); if (modeOn) recolor(); return;
    }
    if (a === "known") {
      if (!local()) { b.textContent = "插件更新过：刷新这个网页再试"; return; }
      b.disabled = true; chrome.storage.local.get({ marks: {}, saved: [], unmk: {} }, v => {
        const m = v.marks || {}, U = v.unmk || {}; Object.keys(m).forEach(x => { if (x !== lw && vsSame(x, lw)) delete m[x]; }); m[lw] = "known"; delete U[lw]; // 按原形：wrote 标认识，write / written 也一起
        chrome.storage.local.set({ marks: m, unmk: U, saved: (v.saved || []).filter(x => !vsSame(String(x), lw)) }, () => loadState().then(() => { if (modeOn) recolor(); }));
      });
      send({ type: "vocabMark", word: lw, st: "known" }); b.textContent = "✓ 已标为认识"; return;
    }
  }

  // ---------- 双击查词、选中短语查 ----------
  function selText() {
    const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null;
    const t = String(s).trim(); if (!t || t.length > 60 || !/[A-Za-z]/.test(t) || /[㐀-鿿]/.test(t) || t.split(/\s+/).length > 6) return null;
    const rg = s.getRangeAt(0), rect = rg.getBoundingClientRect(), node = rg.startContainer, at = rg.startOffset;
    return { text: t, rect, ctx: () => sentenceAt(node, at, t) };
  }
  // 选中的那个位置所在的一句（同一段里这个词出现好几次时，取你点的那一次；以前总是取第一次出现的那句）
  const BLK = "p,li,td,dd,blockquote,figcaption,h1,h2,h3,h4,h5,h6,article,section,div";
  function sentenceAt(node, at, w) {
    const el = node && (node.nodeType === 1 ? node : node.parentElement), blk = el && el.closest(BLK); if (!blk) return "";
    const tx = blk.textContent || ""; let off = -1;
    try { const pre = document.createRange(); pre.setStart(blk, 0); pre.setEnd(node, at); off = pre.toString().length; } catch (e) {}
    if (off < 0 || off > tx.length) { off = tx.toLowerCase().indexOf(String(w).toLowerCase()); if (off < 0) return ""; }
    const END = /[.!?。！？]/; let a = off, b = off + String(w).length;
    while (a > 0 && !END.test(tx[a - 1])) a--; while (b < tx.length && !END.test(tx[b])) b++; if (b < tx.length) b++;
    let s = tx.slice(a, b).replace(/\s+/g, " ").trim();
    if (s.length > 300) { const i = Math.max(0, s.toLowerCase().indexOf(String(w).toLowerCase()) - 140); s = s.slice(i, i + 300).trim(); }
    return s;
  }
  const editable = t => !!(t && t.closest && t.closest("input,textarea,select,[contenteditable],[contenteditable=true]"));
  document.addEventListener("dblclick", e => { if (!alive() || editable(e.target) || (hostEl && e.composedPath().includes(hostEl))) return; setTimeout(() => { const s = selText(); if (s && s.text.split(/\s+/).length === 1) { hideQ(); open(s.text, s.rect, s.ctx); } }, 10); }, true);
  let qT = 0;
  const hideQ = () => { if (sh) sh.querySelector(".q").classList.remove("on"); };
  document.addEventListener("mouseup", e => {
    if (!alive() || editable(e.target) || (hostEl && e.composedPath().includes(hostEl)) || e.detail >= 2) return;
    clearTimeout(qT); qT = setTimeout(() => { const s = selText(); if (!s || s.text.split(/\s+/).length < 2) return hideQ(); ui(); const q = sh.querySelector(".q"); q.style.left = Math.max(8, Math.min(s.rect.right - 40, innerWidth - 70)) + "px"; q.style.top = Math.max(8, s.rect.top - 34) + "px"; q.classList.add("on"); }, 30);
  }, true);
  document.addEventListener("mousedown", e => { if (hostEl && e.composedPath().includes(hostEl)) return; close(); hideQ(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape") { close(); hideQ(); } }, true);
  addEventListener("scroll", () => { hideQ(); }, { passive: true });

  // ---------- 📖 学习模式：正文上色（只改段落里的文字，不碰链接、按钮、输入框、代码） ----------
  let modeOn = false;
  const SKIP = "a,button,input,textarea,select,code,pre,script,style,noscript,svg,math,kbd,samp,var,[contenteditable],vs-page,span.vsp,label,summary,[role=button],[role=link],[role=menuitem],[role=tab],[onclick]";
  const ORIG = new WeakMap(); // 上色的 <span class="vsp"> → 原来的文字节点：关掉学习模式时原样放回去（不改网页自己的 DOM 结构）
  const COLORED = /\bvs-(u1|u2|ln|lo)\b/;
  function textNodes() {
    const roots = document.querySelectorAll("p, li, blockquote, dd, figcaption, h1, h2, h3, td"), out = [], got = new Set();
    roots.forEach(r => { if (out.length > 4000 || r.closest(SKIP)) return;
      const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, { acceptNode: n => (!/[A-Za-z]{2}/.test(n.nodeValue) || got.has(n) || n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      let n; while ((n = tw.nextNode()) && out.length < 4000) { got.add(n); out.push(n); } });
    return out;
  }
  function colorize() {
    if (typeof vsMark !== "function") return;
    const St = Object.assign({}, S, { level: S.level >= 0 ? S.level : 3000 }); // 没设过水平：按 3000 词算
    const run = f => (typeof vsBatch === "function" ? vsBatch(f) : f()); // 整页一起判断：标记表只数一次（vlevel.js）
    run(() => textNodes().forEach(n => {
      // 只留上了色的英文词（中文、日文这些不标；不上色的词还原成普通文字），一个上色的词都没有的文字节点不动
      const h = vsMark(esc(n.nodeValue), St, "vsp-w vs-w").replace(/<span class="vsp-w vs-w ([^"]*)" data-w="([^"]*)">[^<]*<\/span>/g, (all, c, w) => (COLORED.test(c) && /[A-Za-z]/.test(w) && !/[^\x00-\u024f'’\-]/.test(w) ? all : w));
      if (!COLORED.test(h)) return; const sp = document.createElement("span"); sp.className = "vsp"; sp.innerHTML = h; ORIG.set(sp, n); n.replaceWith(sp);
    }));
  }
  function uncolor() { document.querySelectorAll("span.vsp").forEach(sp => { const o = ORIG.get(sp); sp.replaceWith(o || document.createTextNode(sp.textContent)); }); }
  function recolor() { uncolor(); colorize(); }
  const PCSS = "span.vsp .vs-w{cursor:pointer}span.vsp .vs-u1{text-decoration:underline dotted #E5821A 2px;text-underline-offset:3px}span.vsp .vs-u2{text-decoration:underline dotted #8E5BD0 2px;text-underline-offset:3px}span.vsp .vs-u2.vs-rare{text-decoration-color:rgba(142,91,208,.45)}span.vsp .vs-lo,span.vsp .vs-ln{background:rgba(255,214,102,.38);box-shadow:inset 0 -2px 0 #E3B341;border-radius:3px}span.vsp .vs-w:hover{background:rgba(124,77,204,.22);border-radius:3px}";
  function toggleMode() {
    if (!local()) return;
    modeOn = !modeOn; chrome.storage.local.get({ pageOn: {} }, v => { const o = v.pageOn || {}; if (modeOn) o[host] = 1; else delete o[host]; chrome.storage.local.set({ pageOn: o }); });
    sh.querySelector(".pill .t").classList.toggle("active", modeOn);
    if (modeOn) { if (!document.getElementById("vsp-css")) { const st = document.createElement("style"); st.id = "vsp-css"; st.textContent = PCSS; document.head.append(st); } loadState().then(colorize); } else uncolor();
  }
  document.addEventListener("click", e => {
    if (!modeOn || !e.isTrusted) return; const w = e.target.closest && e.target.closest("span.vsp .vs-w"); if (!w || !COLORED.test(w.className) || e.target.closest("a")) return; // 只拦上了色的词，别的点击照常给网页
    e.preventDefault(); e.stopPropagation(); open(w.dataset.w || w.textContent, w.getBoundingClientRect(), () => sentenceAt(w.firstChild || w, 0, w.textContent));
  }, true);
  // 单页网站（换文章不刷新页面）：网址变了就把新内容也上色
  let lastUrl = location.href;
  setInterval(() => { if (location.href === lastUrl) return; lastUrl = location.href; if (modeOn && alive()) setTimeout(() => { if (modeOn) colorize(); }, 1200); }, 1500);

  // 正文够长的英文网页才显示右下角的按钮（短页面、中文页面不打扰）
  function boot() {
    const tx = Array.from(document.querySelectorAll("p")).slice(0, 80).map(p => p.textContent).join(" "), en = (tx.match(/\b[A-Za-z]{2,}\b/g) || []).length;
    if (en < 150) return;
    if (!local()) return;
    chrome.storage.local.get({ pageHide: {}, pageOn: {} }, v => {
      if ((v.pageHide || {})[host]) return; ui(); sh.querySelector(".pill").classList.add("on");
      if ((v.pageOn || {})[host]) { modeOn = false; toggleMode(); }
    });
  }
  if (document.readyState === "complete") setTimeout(boot, 800); else addEventListener("load", () => setTimeout(boot, 800));

  // ---------- 🙈 上班模式：任意网页角落定时弹一张生词卡（插件设置里选每 10 / 20 / 30 / 60 分钟，默认关） ----------
  //   从插件里「正在学」的词（saved）随机挑一个；所有标签页共用一个计时（chrome.storage.local 的 workCardAt），只在你正看着的网页弹，一次一张
  //   先只显示单词，点一下看中文；「记得 / 没记住」记在本机 workCardLog，「✕」关掉，「今天别弹了」到明天再弹
  let wcHost = null, wcSh = null, wcWord = "";
  function wcClose() { if (wcHost) wcHost.remove(); wcHost = wcSh = null; wcWord = ""; }
  async function wcShow() {
    if (wcHost || document.visibilityState !== "visible" || !alive()) return;
    await loadState(); const L = [...(typeof VS_SAVED !== "undefined" ? VS_SAVED : [])].filter(w => /[a-z]/i.test(w) && !/\s.*\s/.test(w)); if (!L.length) return;
    const w = L[Math.floor(Math.random() * L.length)]; wcWord = w;
    wcHost = document.createElement("vs-card"); wcHost.style.cssText = "all:initial;position:fixed;right:14px;bottom:60px;z-index:2147483645"; /* 右下角「📖 学习模式」按钮的上面 */ document.documentElement.append(wcHost);
    wcSh = wcHost.attachShadow({ mode: "closed" });
    wcSh.innerHTML = `<style>.c{width:230px;background:#26282c;color:#eee;border:1px solid #454950;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);padding:10px 12px;font:13.5px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;opacity:.94}
      .h{display:flex;align-items:center;gap:6px;color:#9aa0a6;font-size:11.5px}.h .sp{flex:1}.x{cursor:pointer;border:0;background:none;color:#9aa0a6;font-size:14px}
      .w{font-size:19px;font-weight:800;margin:4px 0 2px;cursor:pointer}.zh{color:#cfd3d8;min-height:1.4em}.zh.hid{color:#6b7078}
      .b{display:flex;gap:6px;margin-top:8px}.b button{flex:1;border:1px solid #454950;background:#2d2f34;color:#eee;border-radius:8px;min-height:28px;font:inherit;font-size:12.5px;cursor:pointer}.b button.ok{background:#2f7d5d;border-color:#2f7d5d}
      .off{margin-top:6px;text-align:right}.off a{color:#6b7078;font-size:11px;cursor:pointer}</style>
      <div class="c"><div class="h">🃏 复习一个词<span class="sp"></span><button class="x" data-a="x" title="关掉">✕</button></div><div class="w" data-a="say" title="点一下朗读">${esc(w)}</div><div class="zh hid" data-a="show">点这里看意思</div>
      <div class="b"><button data-a="no">没记住</button><button class="ok" data-a="yes">记得</button></div><div class="off"><a data-a="off">今天别弹了</a></div></div>`;
    let zh = "";
    send({ type: "word", word: w, tl: S.target || "zh-CN", sl: "en" }).then(r => { const g = r && r.g; zh = g ? [g.t].concat(...(g.zh || []).map(z => (z.words || []).slice(0, 2))).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 4).join("；") : ""; });
    wcSh.addEventListener("click", e => {
      if (!e.isTrusted) return; const el = e.target.closest("[data-a]"); if (!el) return; const a = el.dataset.a;
      if (a === "show") { el.classList.remove("hid"); el.textContent = zh || "（没查到，点单词听一下）"; return; }
      if (a === "say") { send({ type: "tts", text: w, lang: "en" }).then(r => { if (r && r.a) new Audio(r.a).play().catch(() => {}); else try { const u = new SpeechSynthesisUtterance(w); u.lang = "en-US"; speechSynthesis.speak(u); } catch (er) {} }); return; }
      if (a === "yes" || a === "no") { try { chrome.storage.local.get({ workCardLog: {} }, v => { const g = v.workCardLog || {}, k = w.toLowerCase(), x = g[k] || { y: 0, n: 0 }; x[a === "yes" ? "y" : "n"]++; x.at = Date.now(); g[k] = x; chrome.storage.local.set({ workCardLog: g }); }); } catch (er) {} }
      if (a === "off") { try { chrome.storage.local.set({ workCardOff: new Date().toDateString() }); } catch (er) {} }
      wcClose();
    });
  }
  function wcTick() {
    if (!alive()) return;
    try {
      chrome.storage.sync.get({ workCard: 0 }, o => { const min = +o.workCard || 0; if (!min || wcHost || document.visibilityState !== "visible") return;
        chrome.storage.local.get({ workCardAt: 0, workCardOff: "" }, v => {
          if (v.workCardOff === new Date().toDateString()) return;
          if (Date.now() - (+v.workCardAt || 0) < min * 60e3) return;
          chrome.storage.local.set({ workCardAt: Date.now() }, () => wcShow());
        });
      });
    } catch (e) {}
  }
  setInterval(wcTick, 60e3); setTimeout(wcTick, 20e3);
})();
