/* 「🎬 视频」首页的「📺 频道通关地图」：YouTube 英文频道按难度分级推荐，可收起
   数据：yt-channels.json（整理自 Notion「用油管足不出户自学流利英文·频道通关推荐」）
   依赖 watch.js：插在 .wt-home 的说明文字后面；样片用 window.__wt.open(视频ID, 秒数) 在网站播放器里放 */
(function () {
  const { esc } = U; // 全站共用的小工具（util.js）
  const LS = { get: U.LG, set: U.LS }; // util.js
  const CAT = [["可理解输入", ["可理解输入英文"]], ["生活实用", ["生活实用英文"]], ["小孩家庭", ["小孩家庭日常"]], ["华语地区外国人", ["住在华语地区的外国人"]], ["Vlog", ["Vlog", "大学生活Vlog", "高中生活Vlog", "生活Vlog"]], ["对话 · 脱口秀 · 播客", ["超多对话频道", "脱口秀", "脱口秀访谈", "视频播客", "播客访谈", "Omegle", "游戏连麦", "朋友游戏调侃"]], ["兴趣", ["兴趣频道", "室内设计", "食物", "篮球"]]];
  const LVC = { "0基础": "#3BAA7A", "初阶": "#5BAE4E", "初中阶衔接": "#C9A227", "中阶": "#D9822B", "高阶": "#C8553D" };
  const CSS = `
  .ch-map{background:var(--paper);border:1px solid var(--line);border-radius:14px;margin-bottom:12px;font-size:14px;line-height:1.6}
  .ch-map>summary{cursor:pointer;padding:12px 14px;min-height:44px;list-style:none;display:flex;align-items:center;gap:10px}
  .ch-map>summary::-webkit-details-marker{display:none}
  .ch-map>summary b{font-weight:800}.ch-map>summary small{color:var(--muted);font-size:12.5px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ch-map>summary i{font-style:normal;color:var(--muted);transition:transform .2s;font-size:13px}.ch-map[open]>summary i{transform:rotate(180deg)}
  .ch-in{padding:0 14px 14px}
  .ch-intro{background:var(--paper-2);border-radius:10px;padding:0 12px;margin-bottom:10px;font-size:13px}.ch-intro summary{cursor:pointer;padding:9px 0;font-weight:700;color:var(--jade)}
  .ch-intro h4{margin:10px 0 4px;font-size:13.5px}.ch-intro p,.ch-intro li{margin:3px 0;color:var(--ink)}.ch-intro ul,.ch-intro ol{margin:2px 0 6px;padding-left:20px}
  .ch-row{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-bottom:8px;padding-bottom:2px}.ch-row::-webkit-scrollbar{display:none}
  .ch-row button{flex:none;background:var(--paper);border:1px solid var(--line);color:var(--muted);font:inherit;font-size:12.5px;font-weight:600;padding:0 11px;min-height:32px;border-radius:999px;cursor:pointer;white-space:nowrap}
  .ch-row button.on{background:var(--jade);color:#fff;border-color:var(--jade)}.ch-row.ty button.on{background:var(--gold);color:#3a2c08;border-color:var(--gold)}
  .ch-row button em{font-style:normal;opacity:.7;margin-left:4px;font-weight:500}
  .ch-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
  .ch-c{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--paper)}
  .ch-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .ch-n{font-weight:800;color:var(--ink);text-decoration:none;font-size:14.5px}.ch-n:hover{color:var(--jade);text-decoration:underline}.ch-n::after{content:" ↗";color:var(--muted);font-weight:400;font-size:12px}
  .ch-lv{display:flex;gap:4px;flex-wrap:wrap}.ch-lv span{font-size:11px;font-weight:700;color:#fff;border-radius:999px;padding:0 7px;line-height:18px}
  .ch-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.ch-tags span{font-size:11.5px;color:var(--muted);background:var(--paper-2);border-radius:6px;padding:0 6px;line-height:20px}
  .ch-note{margin:6px 0 0;font-size:13px;color:var(--ink);line-height:1.55}
  .ch-s{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ch-s button,.ch-s a{font:inherit;font-size:12.5px;font-weight:700;color:var(--jade);background:none;border:1px solid var(--jade);border-radius:999px;padding:0 10px;min-height:30px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
  .ch-s button:hover,.ch-s a:hover{background:var(--jade);color:#fff}
  .ch-empty{color:var(--muted);font-size:13px;padding:10px 2px}
  .ch-src{color:var(--muted);font-size:12px;margin:10px 2px 0}.ch-src a{color:var(--muted)}
  @media (max-width:520px){.ch-list{grid-template-columns:1fr}}
  .ch-row.ty button.on{color:#2b1d05}.ch-c{background:var(--ui-surface-2)}.ch-c:hover{border-color:var(--ui-line-2)}
  .ch-s button,.ch-s a{color:var(--ui-pur-text);border-color:rgba(185,133,230,.5)}.ch-s button:hover,.ch-s a:hover{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}
  .ch-n:hover{color:var(--ui-pur-text)}.ch-intro summary{color:var(--ui-pur-text)}`;
  const fmt = t => Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  const lab = s => String(s || "").replace(/[（(]\s*\d+:\d+\s*[)）]/g, "").replace(/\bSample\b/ig, "样片").replace(/\s+/g, "").trim() || "样片"; // 原文的 Sample(5:21) → 样片（时间另外显示）
  let data = null, lv = LS.get("wt:ch:lv", "全部"), ty = LS.get("wt:ch:ty", "");
  function introHtml(items) { // Notion 的标题 / 列表块 → 简单 HTML
    let h = "", list = "";
    const close = () => { if (list) { h += "</" + list + ">"; list = ""; } };
    items.forEach(x => {
      const t = esc(x.text);
      if (x.kind === "bulleted_list" || x.kind === "numbered_list") { const want = x.kind === "numbered_list" ? "ol" : "ul"; if (list !== want) { close(); h += "<" + want + ">"; list = want; } h += "<li>" + t + "</li>"; return; }
      close(); h += /header/.test(x.kind) ? "<h4>" + t + "</h4>" : "<p>" + t + "</p>";
    });
    close(); return h;
  }
  const catOf = c => CAT.filter(([, ts]) => (c.type || []).some(t => ts.includes(t))).map(([n]) => n);
  function card(c) {
    const tags = [].concat(c.accent || [], (c.voice || []).length ? [(c.voice || []).join("/") + "声"] : [], c.topic || []);
    const sm = (c.samples || []).map(s => s.v ? '<button type="button" data-v="' + esc(s.v) + '" data-t="' + (s.t || 0) + '">▶ ' + esc(lab(s.label)) + (s.t ? "（从 " + fmt(s.t) + "）" : "") + "</button>" : '<a target="_blank" rel="noopener" href="https://www.youtube.com/playlist?list=' + encodeURIComponent(s.list) + '">▶ ' + esc(lab(s.label)) + " ↗</a>").join("");
    return '<div class="ch-c"><div class="ch-h"><a class="ch-n" target="_blank" rel="noopener" href="' + esc(c.url) + '">' + esc(c.name) + '</a><span class="ch-lv">' + (c.level || []).map(l => '<span style="background:' + (LVC[l] || "#888") + '">' + esc(l) + "</span>").join("") + "</span></div>" +
      (tags.length ? '<div class="ch-tags">' + tags.map(t => "<span>" + esc(t) + "</span>").join("") + "</div>" : "") +
      (c.notes ? '<p class="ch-note">' + esc(c.notes) + "</p>" : "") + (sm ? '<div class="ch-s">' + sm + "</div>" : "") + "</div>";
  }
  function paint(root) {
    const all = data.channels, inLv = c => lv === "全部" || (c.level || []).includes(lv), inTy = c => !ty || catOf(c).includes(ty);
    root.querySelector(".ch-row.lv").innerHTML = ["全部"].concat(data.levels).map(l => '<button type="button" data-lv="' + esc(l) + '" class="' + (l === lv ? "on" : "") + '">' + esc(l) + "<em>" + all.filter(c => l === "全部" || (c.level || []).includes(l)).length + "</em></button>").join("");
    root.querySelector(".ch-row.ty").innerHTML = ['<button type="button" data-ty="" class="' + (!ty ? "on" : "") + '">全部类型</button>'].concat(CAT.map(([n]) => { const k = all.filter(c => inLv(c) && catOf(c).includes(n)).length; return k ? '<button type="button" data-ty="' + esc(n) + '" class="' + (n === ty ? "on" : "") + '">' + esc(n) + "<em>" + k + "</em></button>" : ""; })).join("");
    const list = all.filter(c => inLv(c) && inTy(c));
    root.querySelector(".ch-list").innerHTML = list.length ? list.map(card).join("") : '<div class="ch-empty">这个难度下没有这类频道</div>';
  }
  async function mount() { if (window.VL === "de") return true; /* 🇩🇪 频道地图是英语频道：学德语时不显示 */
    const home = document.querySelector("#watch .wt-home"), hint = home && home.querySelector(".wt-hint");
    if (!home || !hint || document.getElementById("ch-map")) return !!home;
    try { const r = await fetch("yt-channels.json?v=ef879b89"); data = await r.json(); } catch (e) { return true; }
    if (!document.getElementById("ch-css")) { const st = document.createElement("style"); st.id = "ch-css"; st.textContent = CSS; document.head.append(st); }
    const d = document.createElement("details"); d.className = "ch-map"; d.id = "ch-map"; d.open = LS.get("wt:ch:open", true);
    d.innerHTML = '<summary><span>📺</span><b>频道通关地图</b><small>' + data.channels.length + ' 个英文频道 · 由易到难，像过关一样升级</small><i>▾</i></summary><div class="ch-in">' +
      '<details class="ch-intro"><summary>怎么用这份清单</summary>' + introHtml(data.intro || []) + "</details>" +
      '<div class="ch-row lv"></div><div class="ch-row ty"></div><div class="ch-list"></div>' +
      '<p class="ch-src">整理自 <a target="_blank" rel="noopener" href="' + esc(data.source.url) + '">' + esc(data.source.title) + "</a>（Notion，" + esc(data.source.fetched) + " 抓取）。频道介绍归原作者。点频道名打开 YouTube；点 ▶ 在这里的播放器看样片。</p></div>";
    hint.after(d);
    d.addEventListener("toggle", () => LS.set("wt:ch:open", d.open));
    d.addEventListener("click", e => {
      const a = e.target.closest("[data-lv]"), b = e.target.closest("[data-ty]"), s = e.target.closest("button[data-v]");
      if (a) { lv = a.dataset.lv; LS.set("wt:ch:lv", lv); if (ty && !data.channels.some(c => (lv === "全部" || (c.level || []).includes(lv)) && catOf(c).includes(ty))) { ty = ""; LS.set("wt:ch:ty", ty); } paint(d); }
      else if (b) { ty = b.dataset.ty; LS.set("wt:ch:ty", ty); paint(d); }
      else if (s) { e.preventDefault(); if (window.__wt && window.__wt.open) { window.__wt.open(s.dataset.v, +s.dataset.t || 0); try { scrollTo(0, 0); } catch (er) {} } else location.href = "?v=" + s.dataset.v; }
    });
    paint(d); return true;
  }
  // watch.js 建好「视频」页之后再插进去
  let n = 0; const tryMount = async () => { if (await mount() || ++n > 40) return; setTimeout(tryMount, 250); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryMount); else tryMount();
})();
