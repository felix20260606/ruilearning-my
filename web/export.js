/* 生词本导出（⚙ 设置弹窗里）：多种格式，尽量把截图 / 配图和原声一起导出
   格式：Anki（ZIP：卡片文字 + 媒体 + 说明）、表格 CSV（ZIP：表格 + 媒体）、离线网页（单个 .html，图片原声内嵌）、
         完整备份 JSON（含 base64 媒体）、复制成文字
   数据：词条 = index.html 的全局 words / state；原声截图 = /api/ext 里的索引（"med|med:w:单词"、"med|med:s:k"）+ /api/media；
         维基配图 = /api/ext 里的 "wimg|单词"（{c:[网址], o, off}）。只读，不写任何数据。ZIP 用 cdnjs 的 JSZip，点导出时才加载。 */
(function () {
  const { esc } = U; // 全站共用的小工具（util.js）
  const FORMATS = [
    ["anki", "📇 Anki", "ZIP：卡片文字 + 图片 + 原声，按里面的说明导入 Anki"],
    ["csv", "📊 表格 CSV", "Excel / Google Sheets 打开；勾了图片或原声就打成 ZIP，表格里写文件名"],
    ["html", "🌐 离线网页", "一个 .html 文件，图片和原声都在里面，手机电脑双击就能看、能听"],
    ["json", "🗄 完整备份 JSON", "所有内容（含截图、原声），以后可以还原"],
    ["text", "📋 复制成文字", "复制到备忘录或微信（只有文字）"],
  ];
  const SCOPES = [["all", "全部"], ["learning", "未掌握"], ["known", "已掌握"]];
  const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  const opt = Object.assign({ fmt: "anki", scope: "all", img: true, aud: true }, LS("exp:opt") || {});
  const noBr = s => String(s || "").replace(/[{}]/g, "");
  const hl = s => esc(s).replace(/\{([^}]+)\}/g, "<b>$1</b>");
  const today = () => U.day(); // 📅 全站共用的「今天」（util.js）
  let box = null, busy = false;

  function draw() {
    box = document.getElementById("exp-box"); if (!box) return;
    const needMedia = opt.fmt !== "text";
    box.innerHTML = '<div class="exp-fmts">' + FORMATS.map(([k, t, d]) => '<label class="exp-fmt' + (opt.fmt === k ? " on" : "") + '"><input type="radio" name="exp-fmt" value="' + k + '"' + (opt.fmt === k ? " checked" : "") + "><b>" + t + "</b><span>" + d + "</span></label>").join("") + "</div>" +
      '<div class="exp-row"><span>范围</span><span class="exp-seg">' + SCOPES.map(([k, t]) => '<button type="button" data-sc="' + k + '" class="' + (opt.scope === k ? "on" : "") + '">' + t + "</button>").join("") + "</span></div>" +
      (needMedia ? '<div class="exp-row"><span>一起导出</span><label class="exp-ck"><input type="checkbox" id="exp-img"' + (opt.img ? " checked" : "") + '>截图 · 配图</label><label class="exp-ck"><input type="checkbox" id="exp-aud"' + (opt.aud ? " checked" : "") + ">原声</label></div>" : "") +
      '<div class="exp-go"><button type="button" id="exp-run" class="vtest">' + (opt.fmt === "text" ? "📋 复制" : "⬇ 导出") + "</button><span id=\"exp-msg\"></span></div>" +
      '<p class="vhint">截图、原声是用插件看视频时保存的；没有的词用维基配图。原声是 webm 格式：电脑版 Anki 能放，iPhone 版 Anki 可能放不了。</p>';
    box.querySelectorAll('input[name="exp-fmt"]').forEach(r => (r.onchange = () => { opt.fmt = r.value; LS("exp:opt", opt); draw(); }));
    box.querySelectorAll(".exp-seg button").forEach(b => (b.onclick = () => { opt.scope = b.dataset.sc; LS("exp:opt", opt); draw(); }));
    const ci = document.getElementById("exp-img"), ca = document.getElementById("exp-aud");
    if (ci) ci.onchange = () => { opt.img = ci.checked; LS("exp:opt", opt); };
    if (ca) ca.onchange = () => { opt.aud = ca.checked; LS("exp:opt", opt); };
    document.getElementById("exp-run").onclick = run;
  }
  const msg = t => { const m = document.getElementById("exp-msg"); if (m) m.textContent = t; };

  // ---------- 取数据 ----------
  function pickWords() {
    const all = (typeof words !== "undefined" ? words : []).slice();
    return opt.scope === "known" ? all.filter(w => w.status === "known") : opt.scope === "learning" ? all.filter(w => w.status !== "known") : all;
  }
  async function getJSON(u) { const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }
  async function mediaIndex() { // 小写的词 / 句子 → 原声截图的键；小写的词 → 维基配图网址
    const it = (await getJSON("/api/ext")).items || {}, med = {}, wiki = {};
    for (const k in it) if (k.startsWith("med|med:w:")) med[k.slice(10)] = k.slice(4);
    for (const k in it) if (k.startsWith("savedSents|")) { const x = it[k].v, mk = "med:s:" + (x && x.k); if (x && x.t && it["med|" + mk]) { const t = String(x.t).toLowerCase().trim(); if (!med[t]) med[t] = mk; } }
    for (const k in it) if (k.startsWith("wimg|")) { const v = it[k].v; if (v && !v.off && Array.isArray(v.c) && v.c.length) wiki[k.slice(5)] = v.c[(v.o || 0) % v.c.length]; }
    return { med, wiki };
  }
  const EXT_OF = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3" };
  function fromDataUrl(d) { // data:…;base64,… → { mime, bytes, data }
    const m = /^data:([\w/+.-]+)(?:;[^,]*)?;base64,(.*)$/s.exec(d || ""); if (!m) return null;
    const bin = atob(m[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1], bytes, data: d };
  }
  const blobToData = b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => res(""); f.readAsDataURL(b); });
  async function fetchWiki(u) { try { const r = await fetch(u); if (!r.ok) return null; const b = await r.blob(); if (!/^image\//.test(b.type)) return null; return fromDataUrl(await blobToData(b)); } catch (e) { return null; } }
  async function pool(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; await fn(list[k], k); } })); }
  async function collectMedia(ws) { // 每个词：{ img1, img2, aud }（每个是 { mime, bytes, data, name }）
    const out = {}; if (!opt.img && !opt.aud) return out;
    msg("读取媒体目录…"); let idx; try { idx = await mediaIndex(); } catch (e) { msg("没取到媒体目录，只导出文字"); return out; }
    let done = 0;
    await pool(ws, 4, async w => {
      const k = String(w.word || "").toLowerCase().replace(/[{}]/g, "").trim(), r = {};
      const mk = idx.med[k];
      if (mk) { try { const j = await getJSON("/api/media?k=" + encodeURIComponent(mk)), rec = j && j.rec; if (rec) { if (opt.img) { r.img1 = fromDataUrl(rec.img); r.img2 = fromDataUrl(rec.img2); } if (opt.aud) r.aud = fromDataUrl(rec.aud); r.src = rec.title ? rec.title + (rec.ch ? "（" + rec.ch + "）" : "") : ""; } } catch (e) {} }
      if (opt.img && !r.img1 && idx.wiki[k]) r.img1 = await fetchWiki(idx.wiki[k]);
      if (r.img1 || r.img2 || r.aud) out[w.id] = r;
      msg("取图片、原声… " + ++done + " / " + ws.length);
    });
    return out;
  }
  function nameMedia(ws, media) { // 给媒体起文件名：单词_1.jpg、单词_2.jpg、单词.webm（重名加编号）
    const used = new Set();
    ws.forEach(w => { const m = media[w.id]; if (!m) return; let base = String(w.word || w.id).toLowerCase().replace(/[{}]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "item"; let b = base, n = 2; while (used.has(b)) b = base + "_" + n++; used.add(b);
      if (m.img1) m.img1.name = b + "_1." + (EXT_OF[m.img1.mime] || "jpg"); if (m.img2) m.img2.name = b + "_2." + (EXT_OF[m.img2.mime] || "jpg"); if (m.aud) m.aud.name = b + "." + (EXT_OF[m.aud.mime] || "webm"); });
  }
  const files = media => Object.values(media).flatMap(m => [m.img1, m.img2, m.aud].filter(Boolean));

  // ---------- 各种格式 ----------
  const statusOf = w => (w.status === "known" ? "已掌握" : "未掌握");
  const pct = w => (typeof masteryOf === "function" ? Math.round(masteryOf(w) * 100) : 0);
  const exs = w => (w.examples || []).filter(e => Array.isArray(e) && e[0]);
  function ankiText(ws, media) {
    const cell = s => String(s).replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
    const rows = ws.map(w => {
      const m = media[w.id] || {};
      const front = '<div style="font-size:28px;font-weight:700">' + esc(noBr(w.word)) + "</div>" + (w.phon ? "<div>" + esc(w.phon) + "</div>" : "") + (m.img1 ? '<div><img src="' + m.img1.name + '"></div>' : "") + (m.aud ? "[sound:" + m.aud.name + "]" : "");
      const back = [w.zh ? "<div>" + esc(w.zh) + "</div>" : "", w.en ? '<div style="color:#888">' + esc(w.en) + "</div>" : "",
        (w.forms || []).length ? "<div>" + w.forms.map(f => esc(f[0]) + "（" + esc(f[1] || "") + "）" + esc(f[2] || "")).join("<br>") + "</div>" : "",
        exs(w).length ? "<div>" + exs(w).map(e => hl(e[0]) + (e[1] ? "<br><span style=\"color:#888\">" + esc(e[1]) + "</span>" : "")).join("<br><br>") + "</div>" : "",
        w.tip ? "<div>🧠 " + esc(w.tip) + "</div>" : "", m.img2 ? '<div><img src="' + m.img2.name + '"></div>' : ""].filter(Boolean).join("<hr>");
      const tags = [w.tag, w.type, statusOf(w)].filter(Boolean).map(t => String(t).replace(/\s+/g, "_")).join(" ");
      return cell(front) + "\t" + cell(back) + "\t" + tags;
    });
    return "#separator:tab\n#html:true\n#tags column:3\n" + rows.join("\n") + "\n";
  }
  function csvText(ws, media) {
    const q = v => '"' + String(v == null ? "" : v).split('"').join('""') + '"';
    const head = ["单词", "音标", "类型", "中文", "英文释义", "词形变化", "例句", "例句翻译", "记忆法", "标签", "日期", "状态", "掌握进度", "图片1", "图片2", "原声", "出处"];
    const rows = ws.map(w => { const m = media[w.id] || {}, e = exs(w);
      return [noBr(w.word), w.phon, w.type, w.zh, w.en, (w.forms || []).map(f => f[0] + "(" + (f[1] || "") + ")=" + (f[2] || "")).join("; "), e.map(x => noBr(x[0])).join(" | "), e.map(x => x[1] || "").join(" | "), w.tip, w.tag, w.date, statusOf(w), pct(w) + "%",
        m.img1 ? "media/" + m.img1.name : "", m.img2 ? "media/" + m.img2.name : "", m.aud ? "media/" + m.aud.name : "", m.src || ""].map(q).join(","); });
    return "﻿" + [head.map(q).join(",")].concat(rows).join("\r\n");
  }
  function htmlPage(ws, media) {
    const cards = ws.map(w => { const m = media[w.id] || {}, known = w.status === "known", p = pct(w);
      return '<article class="c' + (known ? " k" : "") + '" data-q="' + esc((noBr(w.word) + " " + (w.zh || "")).toLowerCase()) + '"><div class="t"><b>' + esc(noBr(w.word)) + "</b>" + (w.phon ? "<i>" + esc(w.phon) + "</i>" : "") + '<span class="s">' + (known ? "🏆 已掌握" : "掌握 " + p + "%") + "</span></div>" +
        (m.img1 || m.img2 ? '<div class="im">' + [m.img1, m.img2].filter(Boolean).map(x => '<img src="' + x.data + '" alt="">').join("") + "</div>" : "") +
        (m.aud ? '<audio controls preload="none" src="' + m.aud.data + '"></audio>' : "") +
        (w.zh ? '<p class="z">' + esc(w.zh) + "</p>" : "") + (w.en ? '<p class="e">' + esc(w.en) + "</p>" : "") +
        exs(w).map(e => '<p class="x">' + hl(e[0]) + (e[1] ? "<br><span>" + esc(e[1]) + "</span>" : "") + "</p>").join("") +
        (w.tip ? '<p class="tip">🧠 ' + esc(w.tip) + "</p>" : "") + (m.src ? '<p class="src">出处：' + esc(m.src) + "</p>" : "") + "</article>"; }).join("");
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>生词本 ' + today() + "</title><style>" +
      ":root{color-scheme:dark}body{margin:0;background:#1d1e21;color:#e6e8eb;font:15px/1.6 system-ui,-apple-system,'PingFang SC',sans-serif}header{position:sticky;top:0;background:#18191c;padding:12px 16px;border-bottom:1px solid #34373d;display:flex;gap:12px;align-items:center;flex-wrap:wrap}header h1{margin:0;font-size:18px}header input{flex:1;min-width:160px;height:34px;border-radius:10px;border:1px solid #454950;background:#2d2f34;color:#e6e8eb;padding:0 12px;font:inherit}" +
      "main{max-width:1100px;margin:0 auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}.c{background:#26282c;border:1px solid #34373d;border-radius:14px;padding:14px}.c.k{border-color:rgba(246,196,83,.6)}.t{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.t b{font-size:20px}.t i{color:#959ca5;font-style:normal}.t .s{margin-left:auto;font-size:12px;color:#C59BEF}.c.k .t .s{color:#f6c453}" +
      ".im{display:flex;gap:6px;margin:10px 0}.im img{flex:1;min-width:0;max-width:50%;aspect-ratio:16/9;object-fit:cover;border-radius:8px}audio{width:100%;height:32px;margin:4px 0}.z{margin:6px 0 2px}.e{color:#959ca5;margin:0 0 6px;font-size:13px}.x{margin:6px 0;font-size:14px}.x b{color:#FFB86B}.x span,.src{color:#959ca5;font-size:12.5px}.tip{font-size:13.5px;color:#c9ced4}" +
      "</style></head><body><header><h1>📖 生词本 · " + ws.length + " 个 · " + today() + '</h1><input id="q" placeholder="搜索英文或中文"></header><main>' + cards + "</main>" +
      "<script>document.getElementById('q').oninput=function(e){var q=e.target.value.trim().toLowerCase();document.querySelectorAll('.c').forEach(function(c){c.style.display=!q||c.dataset.q.indexOf(q)>=0?'':'none';});};<\/script></body></html>";
  }
  function jsonBackup(ws, media) {
    const srs = (typeof state !== "undefined" && state.srs) || {}, prog = (typeof state !== "undefined" && state.progress) || {};
    return JSON.stringify({ app: "ruilearning-my 生词本", exportedAt: new Date().toISOString(), scope: opt.scope, count: ws.length,
      entries: ws.map(w => { const m = media[w.id] || {}, o = Object.assign({}, w); delete o.status; o.status = statusOf(w); o.progress = prog[w.id] || null; o.srs = srs[w.id] || null;
        o.media = { img1: m.img1 ? m.img1.data : null, img2: m.img2 ? m.img2.data : null, aud: m.aud ? m.aud.data : null, source: m.src || null }; return o; }) }, null, 1);
  }
  function plainText(ws) {
    return ws.map(w => { let s = "【" + noBr(w.word) + "】" + (w.phon || "") + "\n意思：" + (w.zh || "");
      if ((w.forms || []).length) s += "\n变形：" + w.forms.map(f => f[0] + "(" + (f[1] || "") + ") " + (f[2] || "")).join("；");
      if (exs(w).length) s += "\n例句：" + exs(w).map(e => noBr(e[0]) + " —— " + (e[1] || "")).join("\n     ");
      if (w.tip) s += "\n记忆：" + w.tip; return s; }).join("\n\n──────────\n\n");
  }
  const README_ANKI = "生词本 Anki 导入说明\n\n" +
    "1. 把 media 文件夹里的所有文件，复制到 Anki 的媒体文件夹 collection.media：\n" +
    "   电脑版 Anki：工具 → 检查媒体 → 查看文件夹（Tools → Check Media → View Files）可以打开它。\n" +
    "2. Anki：文件 → 导入，选 生词本.txt。字段分隔已写在文件开头（Tab、允许 HTML），第 3 列是标签。\n" +
    "   正面：单词、音标、截图、原声；背面：中文、英文释义、词形变化、例句、记忆法、第二张截图。\n" +
    "3. 原声是 webm 格式：电脑版 Anki 能放，iPhone 版 AnkiMobile 可能放不了。\n";

  // ---------- 导出 ----------
  let zipP = null;
  const loadZip = () => zipP || (zipP = new Promise((res, rej) => { if (window.JSZip) return res(window.JSZip); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = () => res(window.JSZip); s.onerror = () => { zipP = null; rej(new Error("JSZip")); }; document.head.append(s); }));
  function save(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function run() {
    if (busy) return; const ws = pickWords(); if (!ws.length) { msg("这个范围里没有词"); return; }
    busy = true; const btn = document.getElementById("exp-run"); if (btn) btn.disabled = true;
    const tag = { all: "全部", learning: "未掌握", known: "已掌握" }[opt.scope], stamp = today();
    try {
      if (opt.fmt === "text") { const t = plainText(ws); try { await navigator.clipboard.writeText(t); msg("已复制 " + ws.length + " 个"); } catch (e) { save("生词本_" + tag + "_" + stamp + ".txt", new Blob([t], { type: "text/plain;charset=utf-8" })); msg("已下载为文本"); } return; }
      const media = await collectMedia(ws); nameMedia(ws, media); const fl = files(media), nImg = fl.filter(f => /^image/.test(f.mime)).length, nAud = fl.filter(f => /^audio/.test(f.mime)).length;
      const sum = ws.length + " 个词" + (opt.img ? "，图片 " + nImg + " 张" : "") + (opt.aud ? "，原声 " + nAud + " 条" : "");
      if (opt.fmt === "html") { save("生词本_" + tag + "_" + stamp + ".html", new Blob([htmlPage(ws, media)], { type: "text/html;charset=utf-8" })); msg("已下载离线网页：" + sum); return; }
      if (opt.fmt === "json") { save("生词本_" + tag + "_" + stamp + ".json", new Blob([jsonBackup(ws, media)], { type: "application/json" })); msg("已下载完整备份：" + sum); return; }
      const main = opt.fmt === "anki" ? ["生词本.txt", ankiText(ws, media)] : ["生词本.csv", csvText(ws, media)];
      if (!fl.length) { save("生词本_" + tag + "_" + stamp + (opt.fmt === "anki" ? "_anki.txt" : ".csv"), new Blob([main[1]], { type: opt.fmt === "anki" ? "text/plain;charset=utf-8" : "text/csv;charset=utf-8" })); msg("已下载：" + sum); return; }
      msg("打包中…"); const JSZip = await loadZip(), zip = new JSZip();
      zip.file(main[0], main[1]); if (opt.fmt === "anki") zip.file("导入说明.txt", README_ANKI);
      fl.forEach(f => zip.file("media/" + f.name, f.bytes));
      const blob = await zip.generateAsync({ type: "blob" });
      save("生词本_" + (opt.fmt === "anki" ? "Anki" : "表格") + "_" + tag + "_" + stamp + ".zip", blob); msg("已下载 ZIP：" + sum);
    } catch (e) { msg("导出失败：" + (e && e.message || e)); }
    finally { busy = false; if (btn) btn.disabled = false; }
  }
  window.vocabExport = { run, draw, _test: { ankiText, csvText, htmlPage, jsonBackup, plainText, collectMedia, nameMedia, pickWords, opt } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw); else draw();
})();
