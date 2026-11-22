/* 生词本「📐 语法」：常用语法、句型、拼写构词、发音等速查，按类别分好，可搜索，点开进全屏查看页（reader.js）。
   内容来源：
   ① 生词本里的「规律」词条（type=pattern），按 tag 分到各栏；主题词汇 / 场景表达不算语法，留在「📖 列表」的规律分类里
   ② 插件的句型提示数据 web/vs/pattern.js（VS_PAT_LIST：看视频时字幕下面的句型标签，和插件同一份）
   ③ 插件的语法下划线（web/vs/gram.js 的 VS_GRAM_NAME，颜色同插件 content.css）
   依赖 index.html 的全局：words / speak / toast */
(function () {
  const { esc, LG, LS } = U; // 全站共用的小工具（util.js）
  const SECTIONS = [
    { k: "grammar", t: "📐 语法速查", tags: ["语法规律"] },
    { k: "colloc", t: "🔗 搭配和易混词", tags: ["搭配易混"] },
    { k: "pattern", t: "🧩 常用句型", src: "pat" },
    { k: "spell", t: "✏️ 拼写和书写", tags: ["拼写规律", "书写规律"] },
    { k: "word", t: "🧱 构词和词根", tags: ["构词规律", "词缀规律", "词根"] },
    { k: "sound", t: "🔊 发音", tags: ["发音规律"] },
    { k: "spoken", t: "💬 口语表达", tags: ["口语规律"] },
    { k: "number", t: "🔢 数字和日期", tags: ["数字规律", "日期规律"] },
    { k: "usuk", t: "🇺🇸🇬🇧 美英差异", tags: ["美英差异"] },
    { k: "marks", t: "〰 字幕下划线图例", src: "marks" },
  ];
  // 插件字幕里的语法下划线（颜色、线型同插件 content.css）
  const MARKS = [["pa", "solid #5BB0FF 2px", "I {worked} late."], ["pf", "double #35D0BA 2px", "I {have finished}."], ["pg", "wavy #8EE05A 2px", "She {is reading}."], ["md", "dashed #FF8FC7 2px", "You {should} go."], ["pv", "solid #FF7A59 3.5px", "It {was built} in 1990."], ["s3", "dotted #5BB0FF 2.5px", "He {works} here."], ["pl", "dotted #B0B7C0 2.5px", "two {books}"], ["art", "dotted #E8D36B 2.5px", "{a} cat, {the} sun"], ["cmp", "dashed #C9A0FF 2px", "{bigger}, {the best}"], ["neg", "", "I {don't} know."]];
  let root = null, sec = LG("grammar:sec", "all"), q = "", loaded = false;
  const CSS = `
  #grammar{display:none;max-width:1200px;margin:0 auto;padding:6px 0 40px}#grammar.on{display:block}
  .gr-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
  .gr-top input{flex:1 1 220px;min-width:0;height:40px;border-radius:12px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 14px;font:inherit;font-size:15px}
  .gr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
  .gr-chips button{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}
  .gr-chips button b{margin-left:5px;font-weight:600;color:var(--ui-muted)}.gr-chips button.on{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}.gr-chips button.on b{color:#fff}
  .gr-sec{margin:18px 0 8px;font-size:16px;font-weight:800;color:var(--ui-ink)}.gr-sec small{margin-left:8px;font-weight:500;color:var(--ui-muted);font-size:12.5px}
  .gr-list{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:1024px){.gr-list{grid-template-columns:1fr 1fr}}
  .gr-it{display:flex;align-items:center;gap:12px;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:13px 16px;cursor:pointer;transition:border-color .15s,background .15s}
  .gr-it:hover{border-color:var(--ui-pur);background:var(--ui-surface-2)}.gr-it .t{flex:1 1 auto;min-width:0}.gr-it b{display:block;color:var(--ui-ink);font-size:15.5px}.gr-it span{display:block;color:var(--ui-ink-2);font-size:13.5px;margin-top:3px}
  .gr-it .pv{margin:7px 0 0;color:var(--ui-muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gr-it .n{margin:5px 0 0;color:var(--ui-pur-text);font-size:12px}
  .gr-it>i{font-style:normal;font-size:22px;color:var(--ui-muted)}.gr-it:hover>i{color:var(--ui-pur-text)}
  .gr-mk{display:grid;grid-template-columns:1fr;gap:8px}@media(min-width:1024px){.gr-mk{grid-template-columns:1fr 1fr}}
  .gr-mk div{display:flex;gap:12px;align-items:center;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:12px;padding:10px 14px;font-size:14px;color:var(--ui-ink-2)}.gr-mk b{min-width:96px;color:var(--ui-ink)}.gr-mk u{text-underline-offset:4px;color:var(--ui-ink)}
  .gr-empty{color:var(--ui-muted);text-align:center;padding:40px 0}`;
  // 插件的句型数据（和插件同一份）：第一次打开语法页时才加载
  function loadPat() {
    if (loaded) return Promise.resolve(); loaded = true;
    return Promise.all(["vs/pattern.js", "vs/gram.js"].map(src => window.VS_PAT_LIST && /pattern/.test(src) || window.VS_GRAM_NAME && /gram/.test(src) ? null : new Promise(res => { const s = document.createElement("script"); s.src = src + "?v=" + Date.now().toString(36).slice(0, -4); s.onload = s.onerror = res; document.head.append(s); }))).then(() => draw());
  }
    const enOf = s => String(s).replace(/[{}]/g, "").split(/[一-鿿（(]/)[0].trim(); // 例句里英文部分（句型例句后面带中文）
  // 家人（多用户）：规律是参考资料，存在主人 Ray 的生词本里；家人打开语法页时也读一份主人的规律（只读），和自己加的合在一起显示。
  // 用 Request 对象请求：index.html 开头给 /api/vocab 自动加 ?u= 的那段只处理字符串网址，这样读到的是主人的
  let shared = null;
  function loadShared() {
    if (!window.VU || shared) return; shared = [];
    U.json("/api/vocab", { cache: "no-store" }).then(j => { if (!j.custom && j.ok === false) { shared = null; return; } shared = (j.custom || []).filter(w => w && w.type === "pattern"); draw(); }); // util.js：网络不通不抛错
  }
  function items() { // 每栏的条目：查看页格式（reader.js 的 readerFromWord / readerFromPat）+ text（搜索用）
    const own = (typeof words !== "undefined" ? words : []).filter(w => w.type === "pattern"), ids = new Set(own.map(w => w.id));
    const W = own.concat((shared || []).filter(w => !ids.has(w.id)));
    const out = {};
    SECTIONS.forEach(s => {
      if (s.tags) out[s.k] = W.filter(w => s.tags.includes(w.tag)).map(window.readerFromWord);
      else if (s.src === "pat") out[s.k] = (window.VS_PAT_LIST || []).map(window.readerFromPat);
    });
    Object.values(out).forEach(L => L.forEach(x => (x.text = [x.title, x.sub, x.tip].concat(x.rows.flat(), x.ex.flat()).join(" ").toLowerCase())));
    return out;
  }
  // 卡片：标题、中文、对照表前几行预览；点开进全屏查看页（reader.js），在那里看完整的对照表、配图、例句
  function card(x) {
    const pv = x.rows.length ? x.rows.slice(0, 4).map(r => String(r[0]).replace(/[{}]/g, "")).join(" · ") : x.ex.length ? enOf(x.ex[0][0]) : "";
    const n = [x.rows.length ? x.rows.length + " 行" : "", x.ex.length ? x.ex.length + " 例句" : "", x.rows.some(r => r[3]) || x.cover ? "🖼 配图" : ""].filter(Boolean).join(" · ");
    return '<div class="gr-it" data-k="' + esc(x.key) + '"><div class="t"><b>' + esc(x.title) + "</b><span>" + esc(x.sub || "") + "</span>" + (pv ? '<p class="pv">' + esc(pv) + "</p>" : "") + (n ? '<p class="n">' + n + "</p>" : "") + '</div><i>›</i></div>';
  }
  function draw() {
    if (!root) return;
    const all = items(), s0 = q.trim().toLowerCase(), match = x => !s0 || x.text.includes(s0);
    const counts = {}; SECTIONS.forEach(s => (counts[s.k] = s.src === "marks" ? MARKS.length : (all[s.k] || []).filter(match).length));
    const total = Object.entries(counts).filter(([k]) => k !== "marks").reduce((a, [, n]) => a + n, 0);
    const show = SECTIONS.filter(s => sec === "all" || sec === s.k);
    let body = "";
    show.forEach(s => {
      if (s.src === "marks") { if (s0) return; body += '<div class="gr-sec">' + s.t + "<small>看视频时字幕里的下划线是什么意思（和插件一样）</small></div>" + '<div class="gr-mk">' + MARKS.map(m => { const nm = window.VS_GRAM_NAME ? window.VS_GRAM_NAME[m[0]] : m[0], st = m[1] ? "text-decoration:underline " + m[1] : "box-shadow:inset 0 2px 0 #FF5C5C"; return "<div><b>" + esc(nm) + "</b><span>" + esc(m[2]).replace(/\{([^}]+)\}/g, '<u style="' + st + '">$1</u>') + "</span></div>"; }).join("") + "</div>"; return; }
      const L = (all[s.k] || []).filter(match); if (!L.length) return;
      body += '<div class="gr-sec">' + s.t + "<small>" + L.length + " 条</small></div><div class=\"gr-list\">" + L.map(card).join("") + "</div>";
    });
    root.innerHTML = '<div class="gr-top"><input id="gr-q" placeholder="搜索语法、句型、例句（中英文都行）" value="' + esc(q) + '"></div>' +
      '<div class="gr-chips"><button data-s="all" class="' + (sec === "all" ? "on" : "") + '">全部<b>' + total + "</b></button>" + SECTIONS.map(s => '<button data-s="' + s.k + '" class="' + (sec === s.k ? "on" : "") + '">' + s.t + "<b>" + counts[s.k] + "</b></button>").join("") + "</div>" +
      (body || '<div class="gr-empty">' + (s0 ? "没有找到「" + esc(q) + "」" : "这一栏还没有内容") + "</div>");
  }
  function init() {
    if (root) return; root = document.getElementById("grammar"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    root.addEventListener("click", e => {
      const ch = e.target.closest(".gr-chips button"); if (ch) { sec = ch.dataset.s; LS("grammar:sec", sec); draw(); return; }
      const it = e.target.closest(".gr-it"); if (!it || !window.openReader) return;
      const by = {}; Object.values(items()).flat().forEach(x => (by[x.key] = x)); // 换条的顺序 = 页面上看到的顺序（当前栏目 / 搜索结果）
      const keys = [...root.querySelectorAll(".gr-it")].map(n => n.dataset.k), L = keys.map(k => by[k]).filter(Boolean);
      window.openReader(L, keys.indexOf(it.dataset.k));
    });
    root.addEventListener("input", e => { if (e.target.id !== "gr-q") return; q = e.target.value; const pos = e.target.selectionStart; draw(); const n = root.querySelector("#gr-q"); n.focus(); n.setSelectionRange(pos, pos); });
  }
  window.grammarShow = () => { init(); if (!root) return; draw(); loadPat(); loadShared(); }; // 直达链接（?go=grammar）时可能比本文件的初始化先调用：先初始化
  window.grammarRefresh = () => { if (root && root.classList.contains("on")) { draw(); loadPat(); loadShared(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
