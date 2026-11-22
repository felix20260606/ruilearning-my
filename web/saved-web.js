/* ⭐ 已保存（网站版）：没装插件的设备（手机、别的浏览器）也能看插件里保存的单词、句子和短语，
   带视频截图、原声、配图、出处和中文；数据来自 Cloudflare 的 /api/ext 和 /api/media，和插件是同一份。
   生词本「⭐ 已保存」模式：装了插件的电脑上仍然直接嵌入插件自己的页面（能编辑）。 */
(function () {
  const { esc } = U; // 全站共用的小工具（util.js）
  const CSS = `
  #ext-web{display:none;padding:6px 0 30px}#savedbox.web #ext-web{display:block}
  .sw{max-width:1200px;margin:0 auto}
  .sw-hd{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px}
  .sw-hd h2{margin:0;font-size:19px;color:var(--ui-ink)}.sw-hd .n{color:var(--ui-muted);font-size:13px}
  .sw-hd input{flex:1 1 200px;min-width:0;height:36px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 12px;font:inherit}
  .sw-note{font-size:12.5px;color:var(--ui-muted);margin:-4px 0 12px}
  .sw-list{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:1024px){.sw-list{grid-template-columns:1fr 1fr}}
  .sw-it{display:flex;gap:12px;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px}
  .sw-im{flex:0 0 132px;display:flex;flex-direction:column;gap:6px}.sw-im img{width:132px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:var(--ui-surface-2);cursor:zoom-in}.sw-im:empty{display:none}
  .sw-tx{flex:1 1 auto;min-width:0}
  .sw-w{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}.sw-w b{font-size:18px;color:var(--ui-ink)}.sw-w .ph{color:var(--ui-muted);font-size:13px}
  .sw-st{font-size:11.5px;border-radius:999px;padding:0 8px;line-height:20px;background:var(--ui-orange-soft);color:var(--ui-orange)}.sw-st.k{background:var(--ui-green-soft);color:var(--ui-green)}
  .sw-ms{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ui-muted)}.sw-ms .pp-mb{width:56px;height:5px}.sw-ms.k{color:#f6c453;font-weight:700}
  .sw-it.k{border-color:rgba(246,196,83,.55)}
  .sw-zh{margin-top:3px;color:var(--ui-ink-2);font-size:14px}
  .sw-cx{margin-top:7px;font-size:13.5px;color:var(--ui-ink-2);line-height:1.5}.sw-cx em{font-style:normal;color:var(--ui-orange);font-weight:700}.sw-cx .tr{display:block;color:var(--ui-muted);font-size:12.5px}
  .sw-bt{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.sw-bt button{height:28px;border-radius:8px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;font-size:12.5px;padding:0 10px;cursor:pointer}.sw-bt button:hover{border-color:var(--ui-pur);color:var(--ui-pur-text)}
  .sw-more{display:block;margin:16px auto 0;height:38px;padding:0 22px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;cursor:pointer}
  .sw-empty{color:var(--ui-muted);text-align:center;padding:40px 0}
  .sw-view{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:zoom-out}.sw-view img{max-width:92vw;max-height:88vh;border-radius:10px}
  @media(max-width:560px){.sw-im{flex-basis:96px}.sw-im img{width:96px}}`;
  let D = null, tab = "w", q = "", shown = 60, box = null, io = null, player = null;
  const medRec = {}, medPr = {};
  const medGet = k => medPr[k] || (medPr[k] = fetch("/api/media?k=" + encodeURIComponent(k)).then(r => (r.ok ? r.json() : null)).then(j => (medRec[k] = (j && j.rec) || null)).catch(() => (medRec[k] = null)));
  async function load() {
    const it = await CLOUD.chan("ext").get(0); // 全站共用的同步（cloud.js）
    const ws = [], ss = [], ctx = {}, wimg = {}, med = new Set(), tags = {};
    for (const k in it) { const i = k.indexOf("|"), n = k.slice(0, i), id = k.slice(i + 1), v = it[k].v;
      if (n === "saved") ws.push(String(v)); else if (n === "savedSents" && v && v.t) ss.push(v); else if (n === "savedCtx") ctx[id] = v; else if (n === "wimg") wimg[id] = v; else if (n === "med") med.add(id); else if (n === "tags") tags[id] = v; }
    const NB = {}; try { (typeof words !== "undefined" ? words : []).forEach(w => { const k = String(w.word || "").toLowerCase().trim(); if (k && !NB[k]) NB[k] = w; }); } catch (e) {}
    const W = ws.map(w => { const k = w.toLowerCase(), c = ctx[k] || {}, e = NB[k]; return { k, w, at: c.at || 0, ctx: c, e, mk: med.has("med:w:" + k) ? "med:w:" + k : "", wi: wimg[k], tags: tags[k] }; }).sort((a, b) => b.at - a.at);
    const S = ss.map(x => ({ k: x.k, w: x.t, ph: !!x.ph, at: x.at || 0, x, e: NB[String(x.t).toLowerCase().trim()], mk: med.has("med:s:" + x.k) ? "med:s:" + x.k : "" })).sort((a, b) => b.at - a.at);
    D = { W, S };
  }
  function wikiImgs(o) { if (!o || o.off || !o.c || !o.c.length) return []; const c = o.c, s = (o.o || 0) % c.length; return c.slice(s).concat(c.slice(0, s)).slice(0, 2); }
  function card(o, i) {
    const e = o.e, mm = e && typeof masteryOf === "function" ? masteryOf(e) : 0, mk = mm >= 1; // 掌握进度：和练习、列表同一个算法
    const st = e ? '<span class="sw-ms' + (mk ? " k" : "") + '" title="掌握进度：半衰期到 42 天（6 周）算已掌握"><span class="pp-mb' + (mk ? " known" : "") + '"><i style="width:' + Math.round(mm * 100) + '%"></i></span>' + (mk ? "🏆 已掌握" : Math.round(mm * 100) + "%") + "</span>" : "";
    const ex = e && (e.examples || []).find(y => Array.isArray(y) && y[0]);
    let cx = o.x ? (o.x.ph ? o.x.ctx || "" : o.x.t) : (o.ctx && o.ctx.t) || (ex ? String(ex[0]).replace(/[{}]/g, "") : ""), tr = o.x ? (o.x.ph ? "" : o.x.tr || "") : ex ? ex[1] || "" : "";
    if (o.x && !o.x.ph) cx = ""; // 整句本身就是标题
    const hl = s => esc(s).replace(new RegExp("\\b(" + o.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\w*)", "i"), "<em>$1</em>");
    const vid = (o.x && o.x.v) || (o.ctx && o.ctx.v) || "", sec = (o.x && o.x.s) || (o.ctx && o.ctx.s) || 0;
    const imgs = o.mk ? "" : wikiImgs(o.wi).map(u => '<img src="' + esc(u) + '" loading="lazy" alt="">').join("");
    return '<div class="sw-it' + (mk ? " k" : "") + '" data-i="' + i + '"' + (o.mk ? ' data-mk="' + esc(o.mk) + '"' : "") + '><div class="sw-im">' + imgs + '</div><div class="sw-tx">' +
      '<div class="sw-w"><b>' + esc(o.w) + "</b>" + (e && e.phon ? '<span class="ph">' + esc(e.phon) + "</span>" : "") + st + (o.tags && o.tags.length ? o.tags.map(t => '<span class="sw-st" style="background:var(--ui-pur-soft);color:var(--ui-pur-text)">' + esc(t) + "</span>").join("") : "") + "</div>" +
      '<div class="sw-zh">' + esc((e && e.zh) || (o.x && o.x.tr) || "") + "</div>" +
      (cx ? '<div class="sw-cx">' + hl(cx) + (tr ? '<span class="tr">' + esc(tr) + "</span>" : "") + "</div>" : "") +
      '<div class="sw-bt"><button data-b="say">🔊 朗读</button>' + (o.mk ? '<button data-b="aud" hidden>▶ 原声</button>' : "") + (vid ? '<button data-b="vid" data-v="' + esc(vid) + '" data-t="' + (+sec || 0) + '">🎬 原视频</button>' : "") + "</div></div></div>";
  }
  function list() { const L = tab === "w" ? D.W : D.S, s = q.trim().toLowerCase(); return s ? L.filter(o => o.w.toLowerCase().includes(s) || String((o.e && o.e.zh) || (o.x && o.x.tr) || "").includes(s)) : L; }
  function draw() {
    const L = list();
    box.innerHTML = '<div class="sw"><div class="sw-hd"><h2>⭐ 已保存</h2><div class="ui-seg" id="sw-tab"><button data-t="w" class="' + (tab === "w" ? "on" : "") + '">单词 ' + D.W.length + '</button><button data-t="s" class="' + (tab === "s" ? "on" : "") + '">句子和短语 ' + D.S.length + '</button></div><input id="sw-q" placeholder="搜索英文或中文" value="' + esc(q) + '"></div>' +
      '<div class="sw-note">插件里保存的内容（和电脑插件同一份，存在 Cloudflare）。这台设备没装插件，只能查看；要编辑请在装了插件的电脑上打开。</div>' +
      (L.length ? '<div class="sw-list">' + L.slice(0, shown).map((o, i) => card(o, i)).join("") + "</div>" + (L.length > shown ? '<button class="sw-more">再显示 ' + Math.min(60, L.length - shown) + " 个（共 " + L.length + "）</button>" : "") : '<div class="sw-empty">' + (q ? "没有找到" : "还没有保存的内容") + "</div>") + "</div>";
    if (io) io.disconnect();
    io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; io.unobserve(en.target); fillMed(en.target); }), { rootMargin: "300px" });
    box.querySelectorAll("[data-mk]").forEach(el => io.observe(el));
  }
  async function fillMed(el) {
    const r = await medGet(el.dataset.mk); if (!r || !el.isConnected) return;
    const im = el.querySelector(".sw-im"); im.innerHTML = [r.img, r.img2].filter(Boolean).map(u => '<img src="' + esc(u) + '" alt="">').join("");
    const ab = el.querySelector('[data-b="aud"]'); if (ab && r.aud) ab.hidden = false;
    const cx = el.querySelector(".sw-cx"); if (!cx && r.t) { const d = document.createElement("div"); d.className = "sw-cx"; d.innerHTML = esc(r.t) + (r.tr ? '<span class="tr">' + esc(r.tr) + "</span>" : ""); el.querySelector(".sw-zh").after(d); }
  }
  function onClick(e) {
    const t = e.target.closest("#sw-tab button"); if (t) { tab = t.dataset.t; shown = 60; draw(); return; }
    if (e.target.closest(".sw-more")) { shown += 60; draw(); return; }
    const img = e.target.closest(".sw-im img"); if (img) { const v = document.createElement("div"); v.className = "sw-view"; v.innerHTML = '<img src="' + esc(img.src) + '">'; v.onclick = () => v.remove(); document.body.append(v); return; }
    const b = e.target.closest("[data-b]"); if (!b) return; const el = b.closest(".sw-it"), o = list()[+el.dataset.i];
    if (b.dataset.b === "say") { try { speak(o.w); } catch (er) {} }
    else if (b.dataset.b === "aud") { const r = medRec[el.dataset.mk]; if (r && r.aud) { player = MEDIA.play(r.aud); } }
    else if (b.dataset.b === "vid" && /^(BV[0-9A-Za-z]{10}|ep\d+$|ss\d+$)/.test(b.dataset.v)) { // 插件在 B 站保存的：网站视频页放不了，直接打开 B 站（从这句开始）
      const m = /^(BV[0-9A-Za-z]{10})(?:\?p=(\d+))?$/.exec(b.dataset.v), t = Math.floor(+b.dataset.t || 0);
      window.open(m ? "https://www.bilibili.com/video/" + m[1] + "/?" + (m[2] && m[2] !== "1" ? "p=" + m[2] + "&" : "") + "t=" + t : "https://www.bilibili.com/bangumi/play/" + b.dataset.v + "?t=" + t, "_blank", "noopener"); }
    else if (b.dataset.b === "vid") { if (window.__wt && window.__wt.enter) { window.__wt.enter(); window.__wt.open(b.dataset.v, +b.dataset.t || 0); } else location.href = "?v=" + b.dataset.v; }
  }
  window.savedWeb = {
    async render(el) {
      if (!document.getElementById("sw-css")) { const st = document.createElement("style"); st.id = "sw-css"; st.textContent = CSS; document.head.append(st); }
      box = el; if (!box.dataset.on) { box.dataset.on = 1; box.addEventListener("click", onClick); box.addEventListener("input", e => { if (e.target.id === "sw-q") { q = e.target.value; shown = 60; const pos = e.target.selectionStart; draw(); const n = box.querySelector("#sw-q"); n.focus(); n.setSelectionRange(pos, pos); } }); }
      if (!D) { box.innerHTML = '<div class="sw-empty">正在读取…</div>'; try { await load(); } catch (e) { box.innerHTML = '<div class="sw-empty">没读到数据，检查一下网络</div>'; return; } }
      draw();
    }
  };
})();
