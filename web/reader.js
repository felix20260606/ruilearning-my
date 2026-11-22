/* 全屏查看页：生词本里的「句子」「规律」，和「📐 语法」里的全部条目，点开都在这里看。
   - 大标题、概括、封面图（规律指定了维基条目的）、对照表（每行可带小图 / 色块）、例句（🔊 朗读）、记忆提示
   - 换条：底部「上一条 / 下一条」、键盘 ← →、手机左右滑；返回：左上角、Esc、浏览器后退
   - 每条有自己的网址 #read/编号（生词本词条用词条 id，插件句型用 p:id），可以收藏、分享，打开网站直接进这一条
   依赖 index.html 的全局：words / speak；插件句型数据 web/vs/pattern.js（VS_PAT_LIST） */
(function () {
  const { esc } = U; // 全站共用的小工具（util.js）
  const hl = s => esc(String(s)).replace(/\{([^}]+)\}/g, "<em>$1</em>");
  const enOf = s => String(s).replace(/[{}]/g, "").split(/[一-鿿（(]/)[0].trim();
  const CSS = `
  #rd{position:fixed;inset:0;z-index:9500;background:var(--ui-bg,#1d1e21);display:none;flex-direction:column}#rd.on{display:flex}
  #rd .rd-top{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--ui-line,#34373d);background:var(--ui-bar,#18191c)}
  #rd .rd-top button{border:1px solid var(--ui-line-2,#454950);background:var(--ui-surface-2,#2d2f34);color:var(--ui-ink,#e6e8eb);border-radius:10px;height:34px;padding:0 12px;font:inherit;font-size:14px;cursor:pointer}
  #rd .rd-top .pos{margin-left:auto;color:var(--ui-muted,#959ca5);font-size:13px}#rd .rd-top .tag{color:var(--ui-pur-text,#C59BEF);font-size:13px;font-weight:700}
  #rd .rd-act{display:flex;gap:6px}#rd .rd-act button.on{background:linear-gradient(135deg,#E8B84A,#C9952C);border-color:#E8B84A;color:#2a1d00;font-weight:700}#rd .rd-act button[data-act=del]{color:var(--ui-muted)}
  @media(max-width:600px){#rd .rd-top{flex-wrap:wrap}#rd .rd-act{order:9;width:100%}#rd .rd-act button{flex:1}}
  #rd .rd-body{flex:1 1 auto;overflow:auto;padding:22px 16px 30px}
  #rd .rd-in{max-width:860px;margin:0 auto}
  #rd h1{margin:0;font-size:28px;line-height:1.3;color:var(--ui-ink,#e6e8eb)}#rd .sub{margin-top:8px;font-size:16px;color:var(--ui-ink-2,#c9ced4);line-height:1.6}#rd .en{margin-top:4px;color:var(--ui-muted);font-size:14px}
  #rd .say1{margin-left:8px;vertical-align:middle;border:0;background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:15px}
  #rd .cover{margin-top:16px;border-radius:14px;overflow:hidden;background:var(--ui-surface-2);max-height:340px;display:flex;justify-content:center}#rd .cover img{max-width:100%;max-height:340px;object-fit:contain;display:block}
  #rd .lab{margin:22px 0 8px;font-size:12.5px;font-weight:800;letter-spacing:.06em;color:var(--ui-muted)}
  #rd table{width:100%;border-collapse:collapse;font-size:15px}#rd td{padding:9px 10px;border-bottom:1px solid var(--ui-line);vertical-align:middle;color:var(--ui-ink-2)}
  #rd td.a{color:var(--ui-ink);font-weight:700}#rd td.m{color:var(--ui-pur-text);white-space:nowrap;font-size:13px}#rd td.i{width:64px;padding-right:0}
  #rd td.i img{width:56px;height:42px;object-fit:cover;border-radius:8px;background:var(--ui-surface-2);display:block;cursor:zoom-in}#rd td.i .sw{width:42px;height:42px;border-radius:8px;border:1px solid rgba(255,255,255,.15)}
  #rd tr.p{cursor:pointer}#rd tr.p:hover td{background:var(--ui-surface)}
  #rd .ex{display:flex;gap:10px;align-items:flex-start;margin:10px 0;font-size:16px;color:var(--ui-ink);line-height:1.55}#rd .ex em{font-style:normal;color:var(--ui-orange,#FFB86B);font-weight:700}#rd .ex small{display:block;color:var(--ui-muted);font-size:14px}
  #rd .ex button{flex:0 0 auto;border:0;background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:8px;width:32px;height:32px;cursor:pointer}
  #rd .tip{margin-top:20px;padding:12px 14px;border-radius:12px;background:var(--ui-pur-soft,rgba(156,63,208,.18));color:var(--ui-ink-2);font-size:15px;line-height:1.6}
  #rd .rd-nav{flex:0 0 auto;display:flex;gap:10px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--ui-line);background:var(--ui-bar,#18191c)}
  #rd .rd-nav button{flex:1;height:44px;border-radius:12px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;font-size:15px;cursor:pointer}#rd .rd-nav button:disabled{opacity:.35;cursor:default}
  #rd .rd-nav .hint{flex:0 0 auto;align-self:center;color:var(--ui-muted);font-size:12px}@media(max-width:600px){#rd .rd-nav .hint{display:none}#rd h1{font-size:23px}}
  #rd-big{position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out}#rd-big img{max-width:92vw;max-height:88vh;border-radius:10px}.toast{z-index:9700!important}`;
  let el = null, list = [], idx = 0, opened = false, pushed = false;
  // ---------- 维基图片（封面大图、对照表每行小图）：查一次记住 ----------
  const IMG = (() => { try { return JSON.parse(localStorage.getItem("reader:img") || "{}"); } catch (e) { return {}; } })();
  const saveImg = () => { try { localStorage.setItem("reader:img", JSON.stringify(IMG)); } catch (e) {} };
  function wikiImg(title, size) {
    const k = size + "|" + title; if (k in IMG) return Promise.resolve(IMG[k]);
    return NET.fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=" + size + "&titles=" + encodeURIComponent(title))
      .then(r => r.json()).then(j => { const p = Object.values((j.query && j.query.pages) || {})[0] || {}; IMG[k] = (p.thumbnail && p.thumbnail.source) || null; saveImg(); return IMG[k]; }).catch(() => null);
  }
  // 生词本词条 → 查看页条目
  window.readerFromWord = w => ({ key: w.id, wid: w.id, title: String(w.word || "").replace(/[{}]/g, ""), sub: w.zh || "", en: w.en || "", tag: w.tag || (w.type === "sentence" ? "句子" : "规律"), cover: w.wiki || "", rows: (w.forms || []).map(f => [f[0], f[1], f[2], f[3]]), ex: (w.examples || []).filter(x => x && x[0]), tip: w.tip || "", say: w.type === "sentence" ? String(w.word || "").replace(/[{}]/g, "") : "" });
  // 插件句型 → 查看页条目
  window.readerFromPat = p => ({ key: "p:" + p.id, title: p.name, sub: p.zh, en: "", tag: "常用句型", cover: "", rows: [], ex: p.ex ? [[p.ex.replace(/([.?!])\s*([一-鿿])/, "$1\n$2").split("\n")[0], (p.ex.match(/[.?!]\s*([一-鿿].*)$/) || [])[1] || ""]] : [], tip: p.tip, say: "" });
  function draw() {
    const x = list[idx]; if (!x) return close();
    const rowImg = x.rows.some(r => r[3]);
    el.querySelector(".rd-top .tag").textContent = x.tag || "";
    el.querySelector(".rd-top .pos").textContent = list.length > 1 ? idx + 1 + " / " + list.length : "";
    const st = x.wid && window.readerAct ? window.readerAct(x.wid) : null; // 生词本词条：顶栏可以标记已掌握 / 删除（和列表卡片里的按钮一样）
    el.querySelector(".rd-act").innerHTML = st ? '<button data-act="mark" class="' + (st === "known" ? "on" : "") + '">' + (st === "known" ? "🏆 已掌握" : "标记已掌握") + '</button><button data-act="del" title="从生词本删除">删除</button>' : "";
    el.querySelector(".rd-in").innerHTML = "<h1>" + esc(x.title) + (x.say ? '<button class="say1" data-say="' + esc(x.say) + '" title="朗读">🔊</button>' : "") + "</h1>" +
      (x.sub ? '<div class="sub">' + esc(x.sub) + "</div>" : "") + (x.en ? '<div class="en">' + esc(x.en) + "</div>" : "") +
      (x.cover ? '<div class="cover" data-cover="' + esc(x.cover) + '"></div>' : "") +
      (x.rows.length ? '<div class="lab">' + (x.tag === "句子" ? "常用句" : "对照表") + "</div><table>" + x.rows.map(r => '<tr class="p" data-say="' + esc(enOf(r[0])) + '">' + (rowImg ? '<td class="i">' + (r[3] ? (String(r[3]).charAt(0) === "#" ? '<div class="sw" style="background:' + esc(r[3]) + '"></div>' : '<img data-row="' + esc(r[3]) + '" alt="">') : "") + "</td>" : "") +
        '<td class="a">' + esc(r[0]) + "</td>" + (r[1] && r[1] !== "→" ? '<td class="m">' + esc(r[1]) + "</td><td>" : '<td colspan="2">') + esc(r[2] || "") + "</td></tr>").join("") + "</table>" : "") +
      (x.ex.length ? '<div class="lab">例句</div>' + x.ex.map(e => '<div class="ex"><button data-say="' + esc(enOf(e[0])) + '" title="朗读">🔊</button><div>' + hl(e[0]) + (e[1] ? "<small>" + esc(e[1]) + "</small>" : "") + "</div></div>").join("") : "") +
      (x.tip ? '<div class="tip">💡 ' + esc(x.tip) + "</div>" : "");
    el.querySelector(".rd-body").scrollTop = 0;
    el.querySelector("#rd-prev").disabled = idx <= 0; el.querySelector("#rd-next").disabled = idx >= list.length - 1;
    const cv = el.querySelector("[data-cover]"); if (cv) wikiImg(x.cover, 900).then(u => { if (u && cv.isConnected) cv.innerHTML = '<img src="' + esc(u) + '" alt="">'; else if (cv.isConnected) cv.remove(); });
    el.querySelectorAll("img[data-row]").forEach(im => wikiImg(im.dataset.row, 200).then(u => { if (u) im.src = u; else im.style.visibility = "hidden"; }));
  }
  function build() {
    if (el) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    el = document.createElement("div"); el.id = "rd";
    el.innerHTML = '<div class="rd-top"><button id="rd-back">← 返回</button><span class="tag"></span><span class="pos"></span><span class="rd-act"></span></div><div class="rd-body"><div class="rd-in"></div></div><div class="rd-nav"><button id="rd-prev">‹ 上一条</button><span class="hint">← → 换条 · Esc 返回</span><button id="rd-next">下一条 ›</button></div>';
    document.body.append(el);
    el.querySelector("#rd-back").onclick = () => close();
    el.querySelector("#rd-prev").onclick = () => go(-1); el.querySelector("#rd-next").onclick = () => go(1);
    el.addEventListener("click", e => {
      const big = e.target.closest("td.i img,.cover img"); if (big && big.src) { e.stopPropagation(); const v = document.createElement("div"); v.id = "rd-big"; v.innerHTML = '<img src="' + esc(big.src) + '">'; v.onclick = () => v.remove(); document.body.append(v); return; }
      const a = e.target.closest(".rd-act [data-act]");
      if (a) { const x = list[idx]; if (a.dataset.act === "del" && !confirm("从生词本删除「" + x.title + "」？")) return; const r = window.readerAct(x.wid, a.dataset.act); if (r === "del") { list.splice(idx, 1); if (!list.length) return close(); idx = Math.min(idx, list.length - 1); history.replaceState(null, "", "#read/" + encodeURIComponent(list[idx].key)); } draw(); return; }
      const s = e.target.closest("[data-say]"); if (s && s.dataset.say) { try { speak(s.dataset.say); } catch (er) {} }
    });
    let x0 = null, y0 = null; // 手机左右滑换条
    el.addEventListener("touchstart", e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    el.addEventListener("touchend", e => { if (x0 == null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1); }, { passive: true });
    document.addEventListener("keydown", e => {
      if (!opened || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") { const b = document.getElementById("rd-big"); if (b) b.remove(); else close(); } else return;
      e.preventDefault(); e.stopPropagation();
    }, true);
  }
  function go(d) { const n = idx + d; if (n < 0 || n >= list.length) return; idx = n; draw(); history.replaceState(null, "", "#read/" + encodeURIComponent(list[idx].key)); }
  function close() {
    if (!opened) return; opened = false; el.classList.remove("on"); document.documentElement.style.overflow = "";
    if (pushed) { pushed = false; history.back(); } // 是点开的：退回打开前那一页（不在历史里多留一条）
    else if (/^#read\//.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  }
  window.openReader = (items, i) => {
    build(); list = items || []; idx = Math.max(0, Math.min(i || 0, list.length - 1)); if (!list.length) return;
    opened = true; el.classList.add("on"); document.documentElement.style.overflow = "hidden"; draw();
    if (location.hash !== "#read/" + encodeURIComponent(list[idx].key)) { history.pushState(null, "", "#read/" + encodeURIComponent(list[idx].key)); pushed = true; }
  };
  // 打开网站时地址是 #read/编号：直接进这一条（生词本的句子 / 规律，或插件句型）
  function fromHash(tries) {
    const m = location.hash.match(/^#read\/(.+)$/); if (!m) { close(); return; }
    if (opened) return; const key = decodeURIComponent(m[1]);
    const W = typeof words !== "undefined" ? words : [];
    if (key.startsWith("p:")) {
      const go2 = () => { const L = (window.VS_PAT_LIST || []).map(window.readerFromPat), i = L.findIndex(x => x.key === key); if (i >= 0) window.openReader(L, i); };
      if (window.VS_PAT_LIST) go2(); else { const s = document.createElement("script"); s.src = "vs/pattern.js"; s.onload = go2; document.head.append(s); }
      return;
    }
    const L = W.filter(w => w.type === "sentence" || w.type === "pattern"), i = L.findIndex(w => w.id === key);
    if (i >= 0) window.openReader(L.map(window.readerFromWord), i);
    else if ((tries || 0) < 8) setTimeout(() => fromHash((tries || 0) + 1), 800); // 生词本可能还没从后台读回来：等一下再试
  }
  window.addEventListener("popstate", () => { if (!/^#read\//.test(location.hash)) { pushed = false; close(); } else fromHash(); });
  if (document.readyState === "complete") setTimeout(fromHash, 1500); else window.addEventListener("load", () => setTimeout(fromHash, 1500));
})();
