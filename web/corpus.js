/* 🔎 真人例句（对标 YouGlish）：搜一个词 / 短语，看它在真人说的话里怎么用
   - 例句库 web/corpus.json（tools/build-corpus.mjs，备份流程每 6 小时更新）：你看过、存过字幕的视频 + BBC 每周节目最近几期的文稿
   - 视频的句子：点 ▶ 在弹窗里从那一秒开始播（YouTube 嵌入，播到这句结束再多 1 秒）；BBC 的：点「打开这一期」去「📻 听力节目」
   - 变形也算：went / goes 能搜到 go（有 web/vs/vlevel.js 的 vsKeys 就按它，没有就按简单规则）
   - 最下面「在 YouGlish 上听更多」：全 YouTube 的例子（外部网站）
   入口：window.corpusShow(词)（查词卡片上的「🔎 真人例句」；按需加载，lazy.js）
   依赖：U（esc、json、tip）；index.html 的 enShow；listen.js 的 smeOpen */
(function () {
  "use strict";
  if (window.corpusShow && !window.corpusShow.__lazy) return;
  const { esc } = U;
  const CSS = `
  #cp{position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.55);display:none;align-items:flex-start;justify-content:center;padding:calc(20px + env(safe-area-inset-top,0px)) 12px 20px}
  #cp.on{display:flex}#cp .box{background:var(--ui-surface,#26282c);color:var(--ui-ink);border:1px solid var(--ui-line-2);border-radius:16px;width:min(760px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:var(--ui-font)}
  #cp .hd{display:flex;gap:8px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--ui-line)}#cp .hd input{flex:1;min-width:0;background:var(--ui-surface-2);color:var(--ui-ink);border:1px solid var(--ui-line-2);border-radius:10px;padding:9px 12px;font:inherit;font-size:16px}
  #cp .hd button{border:0;background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;min-width:40px;min-height:40px;font-size:16px;cursor:pointer}
  #cp .bd{overflow:auto;padding:6px 14px 14px}#cp .st{color:var(--ui-muted);font-size:13px;margin:8px 0}
  #cp .it{padding:10px 0;border-top:1px solid var(--ui-line)}#cp .it:first-of-type{border-top:0}#cp .en{font-size:16px;line-height:1.55}#cp .en b{color:var(--ui-pur-text,#c8a6ff);background:color-mix(in srgb,var(--ui-pur) 18%,transparent);border-radius:4px;padding:0 2px}
  #cp .zh{color:var(--ui-ink-2);font-size:13.5px;margin-top:2px}#cp .src{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--ui-muted);font-size:12.5px;margin-top:4px}
  #cp .src button{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:8px;padding:3px 10px;font:inherit;font-size:13px;cursor:pointer}
  #cp .vid{position:relative;width:100%;aspect-ratio:16/9;margin-top:8px;border-radius:10px;overflow:hidden;background:#000}#cp .vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
  #cp .more{display:block;text-align:center;margin:12px 0 4px;color:var(--ui-pur-text,var(--ui-pur));font-weight:700}`;
  let root = null, DATA = null, loading = null, playing = -1, q = "", hits = [];
  function load() {
    if (DATA) return Promise.resolve(DATA);
    return loading || (loading = U.json("/corpus.json").then(j => { loading = null; if (j && Array.isArray(j.s)) DATA = j; return DATA; }));
  }
  // 这个词的各种写法都算：句子里的每个词推回原形（vsKeys），和搜的词比；短语按整段找
  const toks = s => String(s).toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}]+)*/gu) || [];
  const keys = w => { try { if (typeof window.vsKeys === "function") return [w].concat(window.vsKeys(w)); } catch (e) {} const o = [w]; for (const x of ["s", "es", "ed", "d", "ing", "'s"]) if (w.endsWith(x) && w.length - x.length >= 3) o.push(w.slice(0, -x.length)); return o; };
  function search(text) {
    const Q = toks(text); if (!Q.length || !DATA) return [];
    const out = [], one = Q.length === 1, want = new Set(keys(Q[0]));
    for (let i = 0; i < DATA.s.length && out.length < 60; i++) {
      const r = DATA.s[i], T = toks(r[3]);
      if (one) { const j = T.findIndex(t => t === Q[0] || keys(t).some(k => want.has(k) || k === Q[0])); if (j >= 0) out.push({ r, w: T[j] }); }
      else { const s = " " + T.join(" ") + " ", p = " " + Q.join(" ") + " "; if (s.includes(p)) out.push({ r, w: Q.join(" ") }); }
    }
    // 视频的排前面（能直接播）；同一个视频最多 4 句
    const per = {}; return out.sort((a, b) => (DATA.docs[a.r[0]][0] === "y" ? 0 : 1) - (DATA.docs[b.r[0]][0] === "y" ? 0 : 1)).filter(h => (per[h.r[0]] = (per[h.r[0]] || 0) + 1) <= 4).slice(0, 30);
  }
  const mark = (t, w) => { const re = new RegExp("(^|[^\\p{L}])(" + w.split(" ").map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s,]+") + ")(?![\\p{L}])", "iu"); return esc(t).replace(re, "$1<b>$2</b>"); };
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function draw(msg) {
    const bd = root.querySelector(".bd");
    if (msg) { bd.innerHTML = '<div class="st">' + msg + "</div>"; return; }
    const yg = '<a class="more" href="https://youglish.com/pronounce/' + encodeURIComponent(q) + '/english" target="_blank" rel="noopener">在 YouGlish 上听更多（全 YouTube 的例子）↗</a>';
    if (!hits.length) { bd.innerHTML = '<div class="st">例句库里还没有「' + esc(q) + "」（例句库 = 你看过、存过字幕的 " + DATA.docs.filter(d => d[0] === "y").length + " 个视频 + BBC 最近几期节目，每 6 小时更新）</div>" + yg; return; }
    bd.innerHTML = '<div class="st">找到 ' + hits.length + " 句" + (hits.length >= 30 ? "（只列前 30）" : "") + "</div>" + hits.map((h, i) => {
      const d = DATA.docs[h.r[0]], yt = d[0] === "y";
      return '<div class="it"><div class="en">' + mark(h.r[3], h.w) + "</div>" + (h.r[4] ? '<div class="zh">' + esc(h.r[4]) + "</div>" : "") +
        '<div class="src">' + (yt ? '<button data-play="' + i + '">' + (playing === i ? "■ 收起" : "▶ " + fmt(h.r[1])) + "</button>🎬 " : '<button data-ep="' + i + '">打开这一期</button>📻 BBC · ') + esc(d[2]).slice(0, 90) + "</div>" +
        (yt && playing === i ? '<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(d[1]) + "?autoplay=1&start=" + Math.max(0, Math.floor(h.r[1]) - 1) + "&end=" + Math.ceil(h.r[2] + 1) + '&rel=0&playsinline=1" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>' : "") + "</div>";
    }).join("") + yg;
  }
  function go(text) { q = String(text || "").trim(); playing = -1; root.querySelector("input").value = q; if (!q) return draw("输入一个词或短语"); draw("正在找……"); load().then(D => { if (!D) return draw("例句库没读到（网络不通？）"); hits = search(q); draw(); }); }
  function init() {
    if (root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    root = document.createElement("div"); root.id = "cp"; document.body.append(root);
    root.innerHTML = '<div class="box"><div class="hd"><span>🔎</span><input placeholder="搜一个词或短语，看真人怎么用" enterkeyhint="search"><button data-a="go" title="搜">↵</button><button data-a="x" title="关掉">✕</button></div><div class="bd"></div></div>';
    root.addEventListener("click", e => {
      if (e.target === root) return close();
      const b = e.target.closest("[data-a],[data-play],[data-ep]"); if (!b) return;
      if (b.dataset.a === "x") return close(); if (b.dataset.a === "go") return go(root.querySelector("input").value);
      if (b.dataset.play != null) { const i = +b.dataset.play; playing = playing === i ? -1 : i; draw(); return; }
      if (b.dataset.ep != null) { const d = DATA.docs[hits[+b.dataset.ep].r[0]]; close(); if (typeof window.enShow === "function") window.enShow("listen", "sme"); setTimeout(() => { if (typeof window.smeOpen === "function") window.smeOpen(d[1]); }, 400); }
    });
    root.querySelector("input").addEventListener("keydown", e => { if (e.key === "Enter") go(e.target.value); if (e.key === "Escape") close(); });
  }
  function close() { playing = -1; root.classList.remove("on"); const bd = root.querySelector(".bd"); if (bd) bd.innerHTML = ""; }
  window.corpusShow = text => { init(); root.classList.add("on"); go(text || ""); if (!text) setTimeout(() => root.querySelector("input").focus(), 50); };
  window.CORPUS = { search, toks, keys, set: d => { DATA = d; } }; // 测试用
})();
