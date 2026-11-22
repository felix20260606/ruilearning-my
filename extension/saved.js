// 已保存项目：保存的单词 / 保存的句子 / 所有单词
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const send = m => new Promise(res => { try { chrome.runtime.sendMessage(m, r => res(r || {})); } catch (e) { res({}); } });
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const IC = {
  mark: '<path class="f" d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>', star: '<path class="f" d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>', play: '<path class="f" d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.3-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>', book: '<path d="M12 6v14"/><path d="M12 6C10.5 4.7 8.3 4 5 4H3v14h2c3.3 0 5.5.7 7 2 1.5-1.3 3.7-2 7-2h2V4h-2c-3.3 0-5.5.7-7 2z"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>', exp: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  down: '<path d="M5 9l7 7 7-7"/>', say: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>', bolt: '<path class="f" d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>'
};
const I = n => '<svg class="vi" viewBox="0 0 24 24">' + IC[n] + "</svg>";
const DAY = 864e5, PER = 50, DONE = 5;
let S = { level: -1, ratio: 1.5, target: "zh-CN", srcLang: "en" }, saved = [], ctx = {}, srs = {}, marks = {}, sents = [], med = {};
let NBW = {}, nbSents = [], nbSynced = false; // 网站生词本：NBW 单词词条（按小写的词），nbSents 短语 / 句子词条（「短语和句子」页显示，不存进插件本地）
let tab = "words", q = "", sort = "date", filt = "learn", src = "", page = 0, picked = new Set(), player = null, allShown = 1e9, tags = {}, tagF = new Set(), allSort = "freq", allView = "cell", allF = new Set(), dictW = "", miniT = null, miniW = null, hist = [];
const TAGS = [["g", "#8EE05A", "绿色"], ["y", "#F1E46B", "黄色"], ["r", "#FF6B5E", "红色"], ["b", "#6FD3FF", "蓝色"]];
const tagDot = k => (tags[k] ? '<i class="tg t-' + tags[k] + '"></i>' : "");
const tagChips = () => '<span class="chip tg0' + (tagF.has("") ? " on" : "") + '" data-tg="" title="没有标签的">/</span>' + TAGS.map(t => '<span class="chip tgc t-' + t[0] + (tagF.has(t[0]) ? " on" : "") + '" data-tg="' + t[0] + '" title="' + t[2] + '标签">#</span>').join("");
const tagOk = k => !tagF.size || tagF.has(tags[k] || "");
const tagBtns = '<span class="tgb">标签' + TAGS.map(t => '<button data-b="tag" data-c="' + t[0] + '" class="t-' + t[0] + '" title="' + t[2] + '"></button>').join("") + '<button data-b="tag" data-c="" title="清除标签">/</button></span>';
const lem = w => vsLemma(String(w).toLowerCase());
const tm = x => Math.floor(x / 60) + ":" + String(Math.floor(x % 60)).padStart(2, "0");
const dayOf = at => (at ? new Date(at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" }) : "更早保存的");
const mOf = w => med["med:w:" + w] || null, sOf = x => med["med:s:" + x.k] || null;

// 和网站生词本合并：生词本里在学的词 = 插件里「将要学习」，已掌握 = 「已知」；插件里标过已知的写回生词本；插件里有、生词本没有的补上去
function mergeNotebook(cb) {
  send({ type: "vocab" }).then(nb => {
    if (!nb || !nb.custom) { cb(); return; } // 断网：只显示插件本地的
    const del = new Set(nb.deleted || []), P = nb.progress || {}, cloud = nb.srs || {};
    NBW = {}; nbSents = [];
    nb.custom.filter(e => e && e.id && e.word && !del.has(e.id) && !/[\u4e00-\u9fff]/.test(e.word)).forEach(e => {
      const k = String(e.word).toLowerCase().trim(), t = e.type || "word", at = Date.parse(e.date) || 0;
      if (t === "word" && /^[a-z][a-z'’-]*$/i.test(k)) { if (!NBW[k]) NBW[k] = e; }
      else if (t === "phrase" || t === "sentence") nbSents.push({ k: "nb:" + e.id, t: e.word, tr: e.zh || "", ph: t === "phrase", at, nb: e });
    });
    let changed = false; const toKnown = {};
    Object.keys(NBW).forEach(k => { const e = NBW[k];
      if (P[e.id] === "known") { if (marks[k] !== "known") { marks[k] = "known"; changed = true; } if (saved.includes(k)) { saved = saved.filter(x => x !== k); changed = true; } }
      else if (marks[k] === "known") toKnown[e.id] = "known";
      else if (!saved.includes(k) && marks[k] !== "ignore") { saved.push(k); changed = true; }
    });
    if (Object.keys(toKnown).length) send({ type: "vocabPatch", patch: { progress: toKnown } });
    Object.keys(NBW).forEach(k => { const r = cloud[NBW[k].id]; if (r) srs[k] = r; }); // 复习进度以生词本里的为准
    if (!nbSynced) { nbSynced = true; if (saved.some(k => !NBW[k])) send({ type: "syncAll", tl: S.target }); }
    VS_SAVED = new Set(saved); VS_MARKS = marks;
    if (changed) persist(cb); else cb();
  });
}
const nbEx = w => { const e = NBW[w], x = e && (e.examples || []).find(y => Array.isArray(y) && y[0]); return x ? String(x[0]).replace(/[{}]/g, "") : ""; };
const nbId = k => (String(k).startsWith("nb:") ? k.slice(3) : NBW[k] ? NBW[k].id : "");
function load(cb) {
  chrome.storage.sync.get({ level: -1, ratio: 1.5, target: "zh-CN", srcLang: "en", greenKnown: false, fadeRare: true, showMarks: true }, s => { S = s;
    chrome.storage.local.get(null, v => {
      saved = [...new Set((v.saved || []).map(w => w.toLowerCase()))]; ctx = v.savedCtx || {}; srs = v.srs || {}; marks = v.marks || {}; sents = v.savedSents || []; tags = v.tags || {}; hist = v.dictHist || [];
      med = {}; Object.keys(v).forEach(k => { if (k.startsWith("med:")) med[k] = v[k]; });
      VS_SAVED = new Set(saved); VS_MARKS = marks; mergeNotebook(cb);
    });
  });
}
function say(text, m) {
  try { speechSynthesis.cancel(); if (player) player.pause(); } catch (e) {}
  if (m && m.aud) { player = new Audio(m.aud); player.play().catch(() => {}); return; }
  if (!text) return; const my = (say.n = (say.n || 0) + 1);
  send({ type: "tts", text, lang: S.srcLang }).then(r => { if (my !== say.n) return; if (r.a) { player = new Audio(r.a); player.play().catch(() => {}); return; } try { const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; speechSynthesis.speak(u); } catch (e) {} });
}
function srcCell(m, c) {
  const o = m || c; if (!o || !o.v) return '<span class="no">—</span>';
  const url = vsVidUrl(o.v, o.s), title = (m && m.title) || (vsVidSite(o.v) === "bili" ? "哔哩哔哩" : "YouTube"); // 出处：YouTube 或 B 站，从这句开始播
  return '<a href="' + url + '" target="_blank" rel="noopener" title="' + esc(title + (m && m.ch ? " · " + m.ch : "") + " · " + tm(o.s || 0)) + '">' + (m && m.img ? '<img src="' + m.img + '" alt="">' : '<span class="yt' + (vsVidSite(o.v) === "bili" ? " bl" : "") + '">' + I("play") + "</span>") + '<span class="ti">' + esc(title) + "</span></a>";
}
// 掌握进度：和网站「🔊 练习」、列表同一个算法——Ebisu 半衰期到 42 天（6 周，同 Language Reactor）= 100 % 已掌握，中间按对数换算
const mastOf = w => { const r = srs[w]; if (marks[w] === "known" || (r && ((r.h || r.s) ? (r.h || r.s) >= 42 : r.b >= DONE))) return 1; if (!r || !(r.h || r.s || r.b)) return 0; const h = r.h || r.s || [0.5, 1, 3, 7, 16, 35, 90][r.b || 0] || 0.5; return Math.min(1, Math.log(1 + h) / Math.log(43)); };
function stage(w) { const m = mastOf(w), k = m >= 1, p = Math.round(m * 100); return '<span class="stg' + (k ? " known" : "") + '" title="掌握进度（Ebisu 半衰期到 42 天，也就是 6 周，算已掌握）· ' + esc(stage0(w)) + '">' + I("book") + '<span class="mb"><i style="width:' + p + '%"></i></span><b>' + (k ? "🏆 已掌握" : p + "%") + "</b>" + (k ? "" : "<small>" + esc(stage0(w)) + "</small>") + "</span>"; }
function stage0(w) { const r = srs[w]; if (!r) return "未开始"; if ((r.h || r.s) ? (r.h || r.s) >= 42 : r.b >= DONE) return "已学会"; const d = r.due - Date.now(); return (r.h ? "半衰期 " + (r.h < 1 ? Math.round(r.h * 24) + " 小时" : Math.round(r.h) + " 天") : r.s ? "能记 " + Math.round(r.s) + " 天" : "第 " + (r.b + 1) + " 级") + " · " + (d <= 0 ? "到期" : d < DAY ? Math.ceil(d / 36e5) + " 小时后" : Math.ceil(d / DAY) + " 天后"); } // 和网站「🔊 练习」一样按遗忘曲线：稳定度到 60 天算已学会
function ctxHtml(t, w) { const L = lem(w); return vsMark(esc(t), S).replace(/<span class="vs-w ([^"]*)" data-w="([^"]+)">/g, (a, cl, x) => (x.toLowerCase() === w || lem(x) === L || lem(x) === w ? '<span class="vs-w wb" data-w="' + x + '">' : a)); }
function head() {
  $$(".tabs b").forEach(b => { const t = b.dataset.t; b.innerHTML = I(t === "words" ? "mark" : t === "sents" ? "star" : "list") + (t === "words" ? "保存的单词" : t === "sents" ? "保存的短语" : "所有单词"); b.classList.toggle("on", t === tab); });
}
function pager(n) { const pages = Math.max(1, Math.ceil(n / PER)); page = Math.min(page, pages - 1); return '<span class="pg"><button id="pp"' + (page ? "" : " disabled") + ">" + I("prev") + "</button><b>" + (page + 1) + "</b>/ " + pages + '<button id="pn"' + (page < pages - 1 ? "" : " disabled") + ">" + I("next") + "</button></span>"; }
function tools(ph, sources) {
  return '<div class="tools"><label class="q"><input id="q" placeholder="' + ph + '" value="' + esc(q) + '">' + I("search") + '</label><select id="src"><option value="">来源：全部</option>' + sources.map(x => '<option value="' + esc(x[0]) + '"' + (src === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>").join("") + '</select><span class="seg" id="sort">' + [["date", "日期 ↓"], ["freq", "频率"], ["due", "待复习"]].map(x => '<b data-v="' + x[0] + '"' + (sort === x[0] ? ' class="on"' : "") + ">" + x[1] + "</b>").join("") + "</span></div>";
}
function sourcesOf(list, get) { const m = new Map(); list.forEach(x => { const o = get(x); if (o && o.v) m.set(o.v, (o.title || "视频 " + o.v)); }); return [...m.entries()]; }

function drawWords() {
  const known = Object.keys(marks).filter(k => marks[k] === "known"), ign = Object.keys(marks).filter(k => marks[k] === "ignore");
  let base = filt === "known" ? known : filt === "ignore" ? ign : saved.slice();
  const at = w => (mOf(w) || {}).at || (ctx[w] || {}).at || (NBW[w] ? Date.parse(NBW[w].date) || 0 : 0), vOf = w => mOf(w) || ctx[w];
  let list = base.map((w, n) => ({ w, n, at: at(w), r: Math.min(vsRank(w), vsRank(lem(w))) }));
  if (q) { const k = q.toLowerCase(); list = list.filter(o => o.w.includes(k) || ((vOf(o.w) || {}).t || "").toLowerCase().includes(k)); }
  if (src) list = list.filter(o => (vOf(o.w) || {}).v === src);
  list = list.filter(o => tagOk(o.w));
  if (sort === "date") list.sort((a, b) => b.at - a.at || b.n - a.n); else if (sort === "freq") list.sort((a, b) => a.r - b.r); else list.sort((a, b) => ((srs[a.w] || {}).due || 9e15) - ((srs[b.w] || {}).due || 9e15));
  const pg = list.slice(page * PER, page * PER + PER);
  let h = '<div class="hd"><h1>保存的单词</h1><span>' + saved.length + "</span><em>你标记的单词及其复习记录</em></div>" + tools("搜索", sourcesOf(saved, vOf)) +
    '<div class="chips"><span class="chip k' + (filt === "known" ? " on" : "") + '" data-f="known">' + I("check") + "标记为已知 <b>" + known.length + '</b></span><span class="chip l' + (filt === "learn" ? " on" : "") + '" data-f="learn">' + I("book") + "标记为将要学习 <b>" + saved.length + '</b></span><span class="chip g' + (filt === "ignore" ? " on" : "") + '" data-f="ignore">' + I("ban") + "不学习 <b>" + ign.length + '</b></span><span style="width:14px"></span>' + tagChips() + pager(list.length) + "</div>" +
    '<div class="sel" id="sel"><span id="seln"></span>' + (filt === "learn" ? '<button data-b="known">标为已知</button>' : '<button data-b="learn">标为将要学习</button>') + '<button data-b="copy">复制</button>' + tagBtns + '<button class="del" data-b="del">' + (filt === "learn" ? "删除" : "取消标记") + "</button></div>";
  if (!pg.length) h += '<div class="empty">' + (base.length ? "没有符合条件的单词。" : filt === "learn" ? "还没有保存的单词。看视频时右键点击单词，把它加入“正在学习”。" : "这一类还没有单词。") + "</div>";
  let last = null, open = false;
  pg.forEach(o => {
    const d = sort === "date" ? dayOf(o.at) : "", m = mOf(o.w), c = ctx[o.w], t = (m && m.t) || (c && c.t) || nbEx(o.w);
    if (sort === "date" && d !== last) { if (open) h += "</table>"; last = d; h += '<div class="day">' + d + "<span>" + list.filter(x => dayOf(x.at) === d).length + "</span></div><table><colgroup><col style=\"width:38px\"><col style=\"width:17%\"><col style=\"width:168px\"><col style=\"width:17%\"><col style=\"width:76px\"><col><col style=\"width:120px\"><col style=\"width:230px\"></colgroup><tr><th></th><th>单词</th><th>图片</th><th>翻译</th><th style=\"text-align:right;padding-right:22px\">排名</th><th>上下文</th><th>阶段</th><th>来源</th></tr>"; open = true; }
    else if (!open) { h += "<table><colgroup><col style=\"width:38px\"><col style=\"width:17%\"><col style=\"width:168px\"><col style=\"width:17%\"><col style=\"width:76px\"><col><col style=\"width:120px\"><col style=\"width:230px\"></colgroup><tr><th></th><th>单词</th><th>图片</th><th>翻译</th><th style=\"text-align:right;padding-right:22px\">排名</th><th>上下文</th><th>阶段</th><th>来源</th></tr>"; open = true; }
    h += '<tr data-w="' + esc(o.w) + '"><td class="c"><input type="checkbox"' + (picked.has(o.w) ? " checked" : "") + '></td><td class="w"><span class="pl" title="' + (m && m.aud ? "播放原声" : "朗读") + '">' + I("play") + '</span>' + tagDot(o.w) + '<span class="vs-w ' + (filt === "learn" ? "wb" : "") + '" data-w="' + esc(o.w) + '">' + esc(o.w) + '</span></td><td class="im" data-im="' + esc(o.w) + '"></td>' + (NBW[o.w] && NBW[o.w].zh ? '<td class="t" title="生词本词条">' + esc(NBW[o.w].zh) + "</td>" : '<td class="t" data-tr="' + esc(o.w) + '"></td>') + '<td class="r">' + (o.r === Infinity ? "—" : o.r) + '</td><td class="x">' + (t ? ctxHtml(t, o.w) : '<span class="no" style="color:#555b63">—</span>') + '</td><td class="st">' + (filt === "learn" ? stage(o.w) : "—") + '</td><td class="so"><div class="so">' + srcCell(m, c) + '<span class="rm" title="' + (filt === "learn" ? "删除" : "取消标记") + '">' + I("x") + "</span></div></td></tr>";
  });
  if (open) h += "</table>";
  $("#wrap").innerHTML = h; bind(list.length); fillImgs();
  (async () => { const me = tab + page + filt + sort + q + src; for (const el of $$("td[data-tr]")) { if (me !== tab + page + filt + sort + q + src || !el.isConnected) return; const r = await send({ type: "wordLite", word: el.dataset.tr, tl: S.target, sl: S.srcLang }), g = r.g, out = []; if (g) { if (g.t) out.push(g.t); (g.zh || []).forEach(z => z.words.forEach(x => { if (!out.includes(x)) out.push(x); })); } el.textContent = out.slice(0, 3).join(", "); } })();
}
function drawSents() {
  const allS = sents.concat(nbSents.filter(y => !sents.some(x => x.t.toLowerCase() === y.t.toLowerCase())));
  let list = allS.map((x, n) => ({ x, n, at: x.at || (sOf(x) || {}).at || 0 }));
  if (q) { const k = q.toLowerCase(); list = list.filter(o => o.x.t.toLowerCase().includes(k) || (o.x.tr || "").includes(q)); }
  if (src) list = list.filter(o => o.x.v === src);
  list = list.filter(o => tagOk(o.x.k));
  list.sort((a, b) => b.at - a.at || b.n - a.n);
  const pg = list.slice(page * PER, page * PER + PER);
  let h = '<div class="hd"><h1>保存的短语</h1><span>' + allS.length + "</span><em>你用 ☆ 保存的待复习句子</em></div>" + tools("搜索", sourcesOf(sents, x => Object.assign({}, x, sOf(x) || {}))) + '<div class="chips"><span class="chip l on">' + I("book") + "标记为将要学习 <b>" + sents.length + '</b></span><span style="width:14px"></span>' + tagChips() + pager(list.length) + '</div><div class="sel" id="sel"><span id="seln"></span><button data-b="copy">复制</button>' + tagBtns + '<button class="del" data-b="del">删除</button></div>';
  if (!pg.length) h += '<div class="empty">' + (sents.length ? "没有符合条件的短语。" : "还没有保存的短语。看视频时点字幕旁边的 ☆ 保存整句。") + "</div>";
  let last = null, open = false;
  pg.forEach(o => { const d = dayOf(o.at), m = sOf(o.x);
    if (d !== last) { if (open) h += "</table>"; last = d; open = true; h += '<div class="day">' + d + "<span>" + list.filter(x => dayOf(x.at) === d).length + "</span></div><table><colgroup><col style=\"width:38px\"><col><col style=\"width:34%\"><col style=\"width:120px\"><col style=\"width:230px\"></colgroup><tr><th></th><th>短语</th><th>翻译</th><th>阶段</th><th>来源</th></tr>"; }
    h += '<tr data-k="' + esc(o.x.k) + '"><td class="c"><input type="checkbox"' + (picked.has(o.x.k) ? " checked" : "") + '></td><td class="p"><span class="pl" title="' + (m && m.aud ? "播放原声" : "朗读") + '">' + I("play") + "</span>" + tagDot(o.x.k) + vsMark(esc(o.x.t), S) + (o.x.ctx ? '<div class="pc">' + esc(o.x.ctx) + "</div>" : "") + '</td><td class="t">' + esc(o.x.tr || (m && m.tr) || "") + '</td><td class="st">' + stage("s:" + o.x.k) + '</td><td class="so"><div class="so">' + srcCell(m, o.x) + '<span class="rm" title="删除">' + I("x") + "</span></div></td></tr>"; });
  if (open) h += "</table>";
  $("#wrap").innerHTML = h; bind(list.length);
}
// 所有单词：按词频每 100 个一段，段内按首字母排；颜色表示状态，右键标记
// 和字幕里给单词上色用的是同一个判断（vsMarkOf + vsCat），所以这里看到的状态就是视频里的状态
function catOf(w) { const mk = vsMarkOf(w); if (mk) return mk === "learn" ? "m-l" : mk === "known" ? "m-k" : "m-i"; const c = vsCat(w, S.level >= 0 ? S : Object.assign({}, S, { level: 2000 }), true); return c === "suggest" ? "a-s" : c === "rare" ? "a-r" : "a-k"; }
let LEMMAS = null; // 只列原形：going、went 归到 go 下面，和字幕里的匹配方式一致
const allWords = () => LEMMAS || (LEMMAS = VS_WORDS.split(" ").filter(w => vsLemma(w) === w));
function drawAll() {
  let W = allWords(); const n = { "m-k": 0, "m-l": 0, "m-i": 0, "a-k": 0, "a-s": 0, "a-r": 0 }; W.forEach(w => n[catOf(w)]++); n["m-l"] = saved.length; n["m-k"] = Object.values(marks).filter(x => x === "known").length; n["m-i"] = Object.values(marks).filter(x => x === "ignore").length; // 自己标记的按实际数量算（有些词不在这张表里）
  let h = '<div class="lv"><b>英语</b><span>' + (S.level >= 0 ? "词汇水平 " + S.level : "未设置词汇水平（按 2000 估算）") + '</span><span>该语言最常用的 ' + W.length + ' 个单词（按原形）</span><button id="lvb">设置词汇水平</button></div>' +
    '<div class="tools"><label class="q"><input id="q" placeholder="搜索" value="' + esc(q) + '">' + I("search") + '</label><span class="seg" id="asort"><b data-v="freq"' + (allSort === "freq" ? ' class="on"' : "") + '>频率</b><b data-v="az"' + (allSort === "az" ? ' class="on"' : "") + '>A–Z</b></span><span class="seg" id="aview"><b data-v="cell"' + (allView === "cell" ? ' class="on"' : "") + '>单元格</b><b data-v="row"' + (allView === "row" ? ' class="on"' : "") + ">行</b></span></div>" +
    '<div class="chips duo">' + [["k", "check", "已掌握", "m-k", "a-k"], ["l", "book", "学习中", "m-l", "a-s"], ["g", "ban", "不学习", "m-i", "a-r"]].map(x => '<span class="pair ' + x[0] + '"><span class="chip ' + x[0] + (allF.has(x[3]) || !allF.size ? " on" : "") + '" data-af="' + x[3] + '" title="' + x[2] + ' — 你标记的">' + I(x[1]) + "<b>" + n[x[3]] + '</b></span><span class="chip dot ' + x[0] + (allF.has(x[4]) || !allF.size ? " on" : "") + '" data-af="' + x[4] + '" title="' + (x[0] === "k" ? "已掌握" : x[0] === "l" ? "建议学习" : "罕见") + ' — 根据你的词汇量水平预测"><b>' + n[x[4]] + "</b></span></span>").join("") + '</div><div class="leg"><i class="lg1"></i>你标记的 · <i class="lg2"></i>根据你的词汇量水平预测。点上面的数字可以只看那一类；鼠标放到单词上看释义并快速标记，点击单词打开词典。</div>';
  if (allF.size) W = W.filter(w => allF.has(catOf(w)));
  const k = q.toLowerCase(), lim = k ? W.length : allShown, jump = [];
  const cell = w => { const ct = catOf(w); return '<span class="vs-w ' + (ct === "m-l" ? "wb" : ct) + '" data-w="' + esc(w) + '">' + esc(w === "i" ? "I" : w) + "</span>"; };
  const NAME = { "m-k": "已掌握", "m-l": "学习中", "m-i": "不学习", "a-k": "已掌握（推测）", "a-s": "建议学习", "a-r": "罕见" };
  const row = w => '<div class="wr"><span class="rk">' + vsRank(w) + "</span>" + cell(w) + '<span class="rt" data-rt="' + esc(w) + '"></span><span class="sn">' + NAME[catOf(w)] + "</span></div>";
  if (allSort === "freq") {
    for (let a = 0; a < lim; a += 100) {
      let ws = W.slice(a, a + 100); if (k) ws = ws.filter(w => w.includes(k)); if (!ws.length) continue;
      if (!k && (a < 1000 || a % 1000 === 0)) jump.push([a, a === 0 ? 1 : a >= 1000 ? a / 1000 + "k" : a]);
      h += '<div class="sec" id="r' + a + '">第 ' + (a + 1) + " – " + (a + 100) + " 个<span>词频排名 " + vsRank(W[a]) + " – " + vsRank(W[Math.min(a + 99, W.length - 1)]) + "</span></div>";
      if (allView === "row") { h += ws.map(row).join(""); continue; }
      const by = {}; ws.slice().sort().forEach(w => { const c = w[0].toUpperCase(); (by[c] = by[c] || []).push(w); });
      Object.keys(by).forEach(c => { h += '<div class="lr"><i>' + esc(c) + "</i><div>" + by[c].map(cell).join(" ") + "</div></div>"; });
    }
  } else { // A–Z：在已显示的范围内按首字母分段
    let ws = W.slice(0, lim); if (k) ws = ws.filter(w => w.includes(k)); const by = {}; ws.slice().sort().forEach(w => { const c = /^[a-z]/.test(w) ? w[0].toUpperCase() : "#"; (by[c] = by[c] || []).push(w); });
    Object.keys(by).sort().forEach(c => { jump.push([c, c]); h += '<div class="sec" id="r' + c + '">' + esc(c) + "<span>" + by[c].length + "</span></div>" + (allView === "row" ? by[c].map(row).join("") : '<div class="lr"><div>' + by[c].map(cell).join(" ") + "</div></div>"); });
  }
  h += '<div class="jump">' + jump.map(a => '<a data-a="' + a[0] + '">' + a[1] + "</a>").join("") + "</div>";
  $("#wrap").innerHTML = h;
  $("#q").oninput = e => { q = e.target.value.trim(); clearTimeout(drawAll.t); drawAll.t = setTimeout(() => { drawAll(); const i = $("#q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $("#lvb").onclick = () => chrome.runtime.openOptionsPage();
  $$(".chip[data-af]").forEach(c => (c.onclick = () => { const f = c.dataset.af; if (allF.has(f)) allF.delete(f); else allF.add(f); drawAll(); }));
  if (allView === "row") { if (drawAll.io) drawAll.io.disconnect(); drawAll.io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; const el = en.target; drawAll.io.unobserve(el); send({ type: "wordLite", word: el.dataset.rt, tl: S.target, sl: S.srcLang }).then(r => { el.textContent = meaningsOf(r.g).slice(0, 3).join(", "); }); }), { rootMargin: "200px" }); $$(".wr .rt").forEach(el => drawAll.io.observe(el)); }
  $("#asort").onclick = e => { const b = e.target.closest("b"); if (b) { allSort = b.dataset.v; drawAll(); } };
  $("#aview").onclick = e => { const b = e.target.closest("b"); if (b) { allView = b.dataset.v; drawAll(); } };
  $$(".jump a").forEach(a => (a.onclick = () => { const el = document.getElementById("r" + a.dataset.a); if (el) el.scrollIntoView(); }));
}
function setMark(w, m) { // learn | known | ignore | ""
  w = w.toLowerCase();
  if (m === "known" || m === "learn") send({ type: "vocabMark", word: w, st: m === "known" ? "known" : "learning" }); // 生词本里的掌握状态跟着变
  Object.keys(marks).forEach(x => { if (vsSame(x, w)) delete marks[x]; });
  if (m === "learn") { if (vsMarkOf(w) !== "learn") { saved.push(w); ctx[w] = ctx[w] || { at: Date.now() }; send({ type: "add", word: w }); } }
  else { saved = saved.filter(x => !vsSame(x, w)); if (m) marks[w] = m; VS_SAVED = new Set(saved); }
}
// 改动前先重新读一遍存储：这个页面可能开了很久，期间在视频里新保存的词不能被旧数据覆盖掉
function fresh(fn) { load(() => { fn(); }); }
let selfWrite = 0;
function persist(cb) { selfWrite = Date.now(); chrome.storage.local.get({ saved: [] }, v => { const keep = new Set(saved), out = v.saved.filter(x => keep.has(x.toLowerCase())); saved.forEach(w => { if (!out.some(x => x.toLowerCase() === w)) out.push(w); }); chrome.storage.local.set({ saved: out, marks, savedCtx: ctx, savedSents: sents }, () => { VS_SAVED = new Set(saved); VS_MARKS = marks; cb && cb(); }); }); }
function bind(n) {
  const re = () => { picked.clear(); draw(); };
  $("#q").oninput = e => { q = e.target.value.trim(); page = 0; clearTimeout(bind.t); bind.t = setTimeout(() => { draw(); const i = $("#q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $("#src").onchange = e => { src = e.target.value; page = 0; re(); };
  $("#sort").onclick = e => { const b = e.target.closest("b"); if (b) { sort = b.dataset.v; page = 0; re(); } };
  $$(".chip[data-f]").forEach(c => (c.onclick = () => { filt = c.dataset.f; page = 0; re(); }));
  $$(".chip[data-tg]").forEach(c => (c.onclick = () => { const t = c.dataset.tg; if (tagF.has(t)) tagF.delete(t); else tagF.add(t); page = 0; re(); }));
  if ($("#pp")) $("#pp").onclick = () => { page--; re(); scrollTo(0, 0); }; if ($("#pn")) $("#pn").onclick = () => { page++; re(); scrollTo(0, 0); };
  const upd = () => { const s = $("#sel"); s.classList.toggle("on", picked.size > 0); $("#seln").textContent = "已选 " + picked.size + " 项"; };
  $$("#wrap tr[data-w], #wrap tr[data-k]").forEach(tr => {
    const key = tr.dataset.w || tr.dataset.k, isW = !!tr.dataset.w;
    tr.querySelector("input").onchange = e => { if (e.target.checked) picked.add(key); else picked.delete(key); upd(); };
    tr.querySelector(".pl").onclick = () => { if (isW) { const m = mOf(key); say(m && m.aud ? "" : (m && m.t) || (ctx[key] || {}).t || key, m); } else { const x = sents.find(s => s.k === key); say(x.t, sOf(x)); } };
    tr.querySelector(".rm").onclick = () => removeKeys([key]);
  });
  $$("#sel button").forEach(b => (b.onclick = () => { const keys = [...picked], act = b.dataset.b;
    if (act === "copy") { const txt = tab === "words" ? keys.join("\n") : keys.map(k => { const x = sents.find(s => s.k === k); return x ? x.t + "\t" + (x.tr || "") : ""; }).join("\n"); navigator.clipboard.writeText(txt).then(() => (b.textContent = "已复制")); return; }
    if (act === "del") return removeKeys(keys);
    if (act === "tag") { fresh(() => { keys.forEach(k => { if (b.dataset.c) tags[k] = b.dataset.c; else delete tags[k]; }); selfWrite = Date.now(); chrome.storage.local.set({ tags }, re); }); return; }
    fresh(() => { keys.forEach(w => setMark(w, act)); persist(re); });
  }));
  upd();
}
function removeKeys(keys) { fresh(() => removeKeys0(keys)); }
function removeKeys0(keys) {
  const inNb = keys.filter(k => nbId(k)).length && (tab !== "words" || filt === "learn");
  if ((keys.length > 1 || inNb) && !confirm("确定要" + (tab === "words" && filt !== "learn" ? "取消标记" : "删除") + "这 " + keys.length + " 项吗？保存的原声和画面也会一起删除。" + (inNb ? "\n其中有网站生词本里的词条，生词本里也会删除（可以从备份还原）。" : ""))) return;
  if (tab === "words") { keys.forEach(w => { if (filt === "learn") { saved = saved.filter(x => x !== w); delete ctx[w]; delete srs[w]; delete med["med:w:" + w]; } else delete marks[w]; }); if (filt === "learn") chrome.storage.local.remove(keys.map(w => "med:w:" + w)); }
  else { sents = sents.filter(x => !keys.includes(x.k)); nbSents = nbSents.filter(x => !keys.includes(x.k)); chrome.storage.local.remove(keys.map(k => "med:s:" + k)); }
  const gone = (tab === "words" ? (filt === "learn" ? keys : []) : keys).map(nbId).filter(Boolean); // 删除的是生词本词条：生词本里也删（仓库和后台都有备份）
  if (gone.length) { send({ type: "vocabPatch", patch: { deleted: gone } }); gone.forEach(id => Object.keys(NBW).forEach(k => { if (NBW[k].id === id) delete NBW[k]; })); }
  persist(() => { picked.clear(); draw(); });
}
function draw() { head(); if (tab === "words") drawWords(); else if (tab === "sents") drawSents(); else drawAll(); }
$$(".tabs b").forEach(b => (b.onclick = () => { tab = b.dataset.t; q = ""; src = ""; page = 0; picked.clear(); if (tab !== "words") sort = "date"; draw(); scrollTo(0, 0); }));
$("#rv").onclick = () => window.open("https://ruilearning-my.pages.dev/?go=pump", "_top"); // 复习统一用网站「🔊 练习」（嵌在网站里时整页切过去）
// 导出：制表符分隔的文本，Anki 的“导入文件”可以直接读（正面 / 背面 / 例句 / 例句翻译 / 来源 / 标签）
$("#exp").onclick = async () => {
  const b = $("#exp"); b.disabled = true; const rows = [], clean = x => String(x || "").replace(/[\t\r\n]+/g, " ");
  const tagName = k => ({ g: "green", y: "yellow", r: "red", b: "blue" }[tags[k]] || "");
  for (const w of saved) { b.textContent = "导出中 " + (rows.length + 1) + "/" + (saved.length + sents.length); const r = await send({ type: "wordLite", word: w, tl: S.target, sl: S.srcLang }), m = mOf(w) || ctx[w] || {}; rows.push([w, meaningsOf(r.g).slice(0, 4).join(", "), m.t || "", m.tr || "", m.v ? "https://www.youtube.com/watch?v=" + m.v + "&t=" + Math.floor(m.s || 0) + "s" : "", tagName(w)].map(clean).join("\t")); }
  sents.forEach(x => { const m = sOf(x) || {}; rows.push([x.t, x.tr || m.tr || "", x.ctx || "", "", x.v ? vsVidUrl(x.v, x.s) : "", tagName(x.k)].map(clean).join("\t")); });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["#separator:tab\n#html:false\n#tags column:6\n" + rows.join("\n") + "\n"], { type: "text/tab-separated-values" })); a.download = "saved-items-anki.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  b.disabled = false; b.innerHTML = I("exp") + "导出";
};
$("#exp").innerHTML = I("exp") + "导出";
document.addEventListener("contextmenu", e => { const w = e.target.closest && e.target.closest(".lr .vs-w, .wr .vs-w, td.x .vs-w"); if (!w) return; e.preventDefault(); const k = w.dataset.w.toLowerCase(); fresh(() => { setMark(k, vsMarkOf(k) === "learn" ? "known" : "learn"); const y = scrollY; persist(() => { draw(); scrollTo(0, y); }); }); });

// ---------- 悬停：小气泡（释义 + 快速标记）；点击：右侧词典 ----------
const meaningsOf = g => { const out = []; if (g) { if (g.t) out.push(g.t); (g.zh || []).forEach(z => z.words.forEach(x => { if (!out.includes(x)) out.push(x); })); } return out; };
const stateOf = w => vsMarkOf(w);
function redraw() { const y = scrollY; persist(() => { draw(); scrollTo(0, y); if (dictW) drawDict(dictW, drawDict.res); }); }
function hideMini() { clearTimeout(miniT); const m = $("#mini"); if (m) m.remove(); miniW = null; }
function showMini(el) {
  hideMini(); const w = el.dataset.w.toLowerCase(); miniW = el;
  const m = document.createElement("div"); m.id = "mini"; const st = stateOf(w);
  m.innerHTML = '<div class="ms">…</div><div class="qb"><button data-m="known" class="k' + (st === "known" ? " on" : "") + '" title="已掌握">' + I("check") + '</button><button data-m="learn" class="l' + (st === "learn" ? " on" : "") + '" title="学习中">' + I("book") + "</button></div>";
  document.body.append(m);
  const place = () => { const r = el.getBoundingClientRect(), H = m.offsetHeight, W2 = m.offsetWidth; const up = r.top - H - 8 > 50; m.style.left = Math.max(6, Math.min(innerWidth - W2 - 6, r.left + r.width / 2 - W2 / 2)) + "px"; m.style.top = (up ? r.top - H - 6 : r.bottom + 6) + "px"; };
  place();
  send({ type: "wordLite", word: w, tl: S.target, sl: S.srcLang }).then(r => { if (!m.isConnected) return; const ms = meaningsOf(r.g).slice(0, 3); m.querySelector(".ms").innerHTML = ms.length ? ms.map(x => "<div>" + esc(x) + "</div>").join("") : "<div>—</div>"; place(); });
  m.onmouseenter = () => clearTimeout(miniT); m.onmouseleave = () => (miniT = setTimeout(hideMini, 180));
  m.querySelectorAll("button").forEach(b => (b.onclick = () => fresh(() => { const cur = stateOf(w); setMark(w, cur === b.dataset.m ? "" : b.dataset.m); hideMini(); redraw(); })));
}
document.addEventListener("mouseover", e => { const w = e.target.closest && e.target.closest("#wrap .vs-w, #dict .bd .vs-w"); if (!w || w === miniW) return; clearTimeout(miniT); miniT = setTimeout(() => showMini(w), 260); });
document.addEventListener("mouseout", e => { const w = e.target.closest && e.target.closest("#wrap .vs-w, #dict .bd .vs-w"); if (!w) return; clearTimeout(miniT); miniT = setTimeout(hideMini, 220); });
document.addEventListener("scroll", hideMini, { passive: true });
document.addEventListener("click", e => { const w = e.target.closest && e.target.closest("#wrap .vs-w, #dict .bd .vs-w"); if (!w || e.target.closest("input")) return; hideMini(); openDict(w.dataset.w); });

const EXT = [["Re", "Reverso", "https://context.reverso.net/translation/english-chinese/WORD"], ["Ca", "Cambridge", "https://dictionary.cambridge.org/dictionary/english/WORD"], ["Wr", "WordReference", "https://www.wordreference.com/enzh/WORD"], ["Gl", "Google", "https://translate.google.com/?sl=en&tl=zh-CN&text=WORD"], ["Wi", "Wiktionary", "https://en.wiktionary.org/wiki/WORD"]];
async function openDict(word) {
  word = String(word).trim(); if (!word) return; dictW = word.toLowerCase(); hist = [dictW].concat(hist.filter(x => x !== dictW)).slice(0, 30); chrome.storage.local.set({ dictHist: hist }); drawDict.res = null; drawDict.sent = null; drawDict.open = drawDict.open || false;
  document.body.classList.add("dict"); drawDict(dictW, null);
  const me = dictW, r = await send({ type: "word", word: dictW, tl: S.target, sl: S.srcLang }); if (dictW !== me) return; drawDict.res = r; drawDict(dictW, r); fillImgs("#dict");
  const sx = await send({ type: "sentences", word: dictW, tl: S.target, sl: S.srcLang }); if (dictW !== me) return; drawDict.sent = sx.s || []; drawDict(dictW, r);
}
function drawDict(w, res) {
  let d = $("#dict"); if (!d) { d = document.createElement("div"); d.id = "dict"; document.body.append(d); }
  const g = res && res.g, dd = res && res.d, ms = meaningsOf(g), r = Math.min(vsRank(w), vsRank(lem(w))), st = stateOf(w), lv = S.level >= 0 ? S.level : 2000;
  const auto = st ? "" : (() => { const c = vsCat(w, S.level >= 0 ? S : Object.assign({}, S, { level: 2000 }), true); return c === "suggest" ? "建议学习" : c === "rare" ? "罕见" : "已掌握"; })();
  const m = mOf(w) || (ctx[w] && ctx[w].t ? ctx[w] : null), f = r === Infinity ? 1 : Math.max(0.12, Math.min(1, r / 6000)), keep = d.querySelector(".bd") ? d.querySelector(".bd").scrollTop : 0;
  const big = (k, ic, name, tip) => '<button class="bigm ' + k + (st === (k === "k" ? "known" : k === "l" ? "learn" : "ignore") ? " on" : "") + '" data-m="' + (k === "k" ? "known" : k === "l" ? "learn" : "ignore") + '">' + I(ic) + name + '</button><div class="ex1"><span>' + esc(w) + "</span>" + tip + "</div>";
  d.innerHTML = '<div class="dh"><b>词典</b><button id="dx" title="关闭">' + I("x") + '</button></div>' +
    '<div class="ds"><label><input id="dq" value="' + esc(w) + '" spellcheck="false" autocomplete="off"><button id="dqx" title="清空">' + I("x") + '</button></label><button id="dsay" class="rnd" title="朗读">' + I("say") + '</button><button id="dhis" class="rnd" title="查过的词">' + I("hist") + '</button></div><div class="his" id="hisl" hidden>' + (hist.map(x => '<a data-h="' + esc(x) + '">' + esc(x) + "</a>").join("") || "<span>还没有查过别的词</span>") + "</div>" +
    '<div class="dm"><span class="fbar"><i style="width:' + Math.round(f * 100) + '%"></i></span><span class="rk">' + (r === Infinity ? "生僻" : r) + '</span><span class="sp"></span><button class="mk k' + (st === "known" ? " on" : "") + '" data-m="known" title="已掌握">' + I("check") + '</button><button class="mk l' + (st === "learn" ? " on" : "") + '" data-m="learn" title="学习中">' + I("book") + '</button><button class="mk g' + (st === "ignore" ? " on" : "") + '" data-m="ignore" title="不学习">' + I("ban") + '</button><button id="dmore" class="more' + (drawDict.open ? " on" : "") + '" title="更多">' + I("down") + "</button></div>" +
    '<div class="bd"><div class="dimg" data-im="' + esc(w) + '">' + (imgsSync(w) ? imgsHtml(w, imgsSync(w), true) : "") + '</div>' + (drawDict.open ? '<div class="mx"><div class="hint">' + (r === Infinity ? "不在常用词表里" : "排名 " + r + " · " + (r <= lv ? "符合你的水平" : "高于你的水平（" + lv + "）")) + "</div>" +
      big("k", "check", "已掌握", "保存为已掌握。不会学习或推荐。") + big("l", "book", "学习中", "保存到你的项目，加入复习队列。") + big("g", "ban", "不学习", "不学习且不推荐。") +
      '<div class="hint">' + (st ? "这是你自己标记的" : "根据你的词汇量水平预测：" + auto) + '</div><div class="tgr"><button data-tg="" class="t0' + (tags[w] ? "" : " on") + '">/</button>' + TAGS.map(t => '<button data-tg="' + t[0] + '" class="t-' + t[0] + (tags[w] === t[0] ? " on" : "") + '" title="' + t[2] + '">#</button>').join("") + '</div><div class="hint">你自己的分类标签，可在列表里按标签筛选。</div>' +
      '<button class="bigm nx" id="dnext">' + I("bolt") + '下次学习</button><div class="hint">下一次复习从这个词开始。</div></div>' : "") +
    '<div class="card"><div class="zh">' + (res ? esc(ms.slice(0, 4).join("，")) || "（无翻译）" : "…") + (dd && dd.phonetic ? '<span class="ph">' + esc(dd.phonetic) + "</span>" : "") + (dd && dd.lemma ? '<span class="ph">原形 ' + esc(dd.lemma) + "</span>" : "") + "</div>" +
      (g && g.zh && g.zh.length ? g.zh.map(z => '<div class="ln"><i>' + esc(z.pos) + "</i>" + esc(z.words.join("，")) + "</div>").join("") : "") + "</div>" +
    (m && m.t ? '<div class="card"><div class="ct">你保存时的句子</div><div class="eg">' + (m.img ? '<img src="' + m.img + '" alt="">' : "") + "<div>" + ctxHtml(m.t, w) + (m.tr ? '<div class="tr">' + esc(m.tr) + "</div>" : "") + '<div class="so">' + srcCell(mOf(w), ctx[w]) + (m.aud ? '<button id="dorig" class="rnd sm" title="播放原声">' + I("play") + "</button>" : "") + "</div></div></div></div>" : "") +
    (dd && dd.meanings && dd.meanings.length ? '<div class="card"><div class="ct">英文释义</div>' + dd.meanings.map(mm => mm.defs.map((x, i) => '<div class="ln en"><i>' + (i ? "" : esc(mm.pos)) + "</i><div>" + vsMark(esc(x.def), S) + (x.example ? '<div class="eq">“' + vsMark(esc(x.example), S) + "”</div>" : "") + "</div></div>").join("")).join("") + "</div>" : "") +
    (drawDict.sent && drawDict.sent.length ? '<div class="card"><div class="ct">例句</div>' + drawDict.sent.slice(0, 6).map(x => '<div class="sx">' + ctxHtml(x.en, w) + (x.tr ? '<div class="tr">' + esc(x.tr) + "</div>" : "") + "</div>").join("") + "</div>" : "") +
    '<div class="card lk">' + EXT.map(e => '<a target="_blank" rel="noopener" title="' + e[1] + '" href="' + e[2].replace("WORD", encodeURIComponent(w)) + '">' + e[0] + "</a>").join("") + "</div></div>";
  d.querySelector(".bd").scrollTop = keep;
  $("#dx").onclick = () => { dictW = ""; d.remove(); document.body.classList.remove("dict"); };
  $("#dq").onkeydown = e => { if (e.key === "Enter") openDict(e.target.value); }; $("#dqx").onclick = () => { $("#dq").value = ""; $("#dq").focus(); };
  $("#dhis").onclick = () => ($("#hisl").hidden = !$("#hisl").hidden); $$("#hisl a").forEach(a => (a.onclick = () => openDict(a.dataset.h)));
  $("#dsay").onclick = () => say(w, null); if ($("#dorig")) $("#dorig").onclick = () => say("", mOf(w));
  $("#dmore").onclick = () => { drawDict.open = !drawDict.open; drawDict(w, res); };
  d.querySelectorAll("[data-m]").forEach(b => (b.onclick = () => fresh(() => { setMark(w, stateOf(w) === b.dataset.m ? "" : b.dataset.m); redraw(); })));
  d.querySelectorAll("[data-tg]").forEach(b => (b.onclick = () => fresh(() => { if (b.dataset.tg) tags[w] = b.dataset.tg; else delete tags[w]; selfWrite = Date.now(); chrome.storage.local.set({ tags }, redraw); })));
  if ($("#dnext")) $("#dnext").onclick = () => fresh(() => { if (stateOf(w) !== "learn") setMark(w, "learn"); const key = saved.find(x => x === w || lem(x) === lem(w)) || w; srs[key] = Object.assign({ b: 0, n: 0 }, srs[key], { due: 1 }); send({ type: "reviewNext", word: key }).then(() => redraw()); });
}
// 别处（视频页、复习页）改了数据：这里自动跟着刷新
let extT = null;
chrome.storage.onChanged.addListener((c, a) => { if (a !== "local" || Date.now() - selfWrite < 1500) return; if (!Object.keys(c).some(k => /^(saved|savedSents|savedCtx|marks|srs|tags)$/.test(k) || k.startsWith("med:"))) return; clearTimeout(extT); extT = setTimeout(() => { const y = scrollY; load(() => { draw(); scrollTo(0, y); if (dictW) drawDict(dictW, drawDict.res); }); }, 400); });
load(draw);

// ---------- 单词配图：每个词尽量 2 张，方便记忆 ----------
// 优先用视频里保存时截的两帧（这句开头和结尾）；不够的从维基百科（生词本词条指定的页面 → 按这个词搜索）和维基共享资源找。
// 找到的候选存在本地 wimg:单词 = { c: [候选图], o: 从第几张开始显示, off: 不要图 }，不重复去网上找。
const IMG_BAD = /(Commons-logo|Wiktionary|Edit-|OOjs|Ambox|Question_book|Wikidata|Red_pog|Location|_map|\bmap\b|Increase|Decrease|icon|logo|flag|disambig|placeholder|no[_-]?image|nuvola|symbol|\.svg|\.tif)/i;
const imgMem = {};
async function wikiCands(w) {
  // 先找这个词本身的维基百科条目（或生词本词条指定的页面）：条目主图 + 条目里的其它图，基本都切题；消歧义页跳过
  // 找不到再搜维基共享资源，只要文件名里有这个词本身的（排除 Pond's 这种品牌名）；都没有就不配图，宁缺毋滥
  const out = [], seen = new Set(), add = u => { if (!u || IMG_BAD.test(u)) return; const k = decodeURIComponent(u.split("/").pop()).replace(/\?.*$/, "").replace(/^\d+px-/, "").toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push(u); }; // 同一张图的不同尺寸只算一张
  const get = async u => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const L = lem(w), e = NBW[w];
  if (!(e && e.wiki) && /ly$/.test(L) && L.length > 5) return []; // 副词（-ly）很难有切题的图，宁缺毋滥
  const titles = [e && e.wiki, L.charAt(0).toUpperCase() + L.slice(1)].filter(Boolean);
  for (const t of titles) {
    if (out.length >= 4) break;
    const j = await get("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages%7Cpageprops&ppprop=disambiguation&piprop=thumbnail&pithumbsize=480&titles=" + encodeURIComponent(t));
    const p = Object.values((j && j.query && j.query.pages) || {})[0];
    if (!p || p.missing !== undefined || (p.pageprops && p.pageprops.disambiguation !== undefined)) continue;
    add(p.thumbnail && p.thumbnail.source);
    const j2 = await get("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=images&gimlimit=30&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=480&titles=" + encodeURIComponent(p.title));
    Object.values((j2 && j2.query && j2.query.pages) || {}).forEach(q => { const ii = q.imageinfo && q.imageinfo[0]; if (ii && /^image\/(jpeg|png|webp)/.test(ii.mime || "")) add(ii.thumburl || ii.url); });
  }
  if (!out.length) {
    const re = new RegExp("(^|[^a-z])" + L.replace(/[^a-z]/g, "") + "(s|es)?(?!['’]s)([^a-z]|$)", "i");
    const j3 = await get("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=" + encodeURIComponent(L + " filetype:bitmap") + "&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=480");
    Object.values((j3 && j3.query && j3.query.pages) || {}).sort((x, y) => (x.index || 0) - (y.index || 0)).forEach(q => { const ii = q.imageinfo && q.imageinfo[0]; if (ii && /^image\/(jpeg|png|webp)/.test(ii.mime || "") && re.test(String(q.title || "").replace(/^File:/, "").replace(/\.[a-z]+$/i, ""))) add(ii.thumburl || ii.url); });
  }
  return out.slice(0, 8);
}
async function imgState(w) {
  if (imgMem[w]) return imgMem[w];
  const k = "wimg:" + w; let st = (await chrome.storage.local.get(k))[k];
  if (!st) { st = { c: await wikiCands(w), o: 0 }; chrome.storage.local.set({ [k]: st }); }
  return (imgMem[w] = st);
}
function imgsSync(w) { // 已经查过的直接给（词典面板重画时不用再等）；没查过返回 null
  const m = mOf(w), fr = m ? [m.img, m.img2].filter(Boolean).map(u => ({ u, f: 1 })) : [];
  if (fr.length >= 2) return fr.slice(0, 2);
  const st = imgMem[w]; if (!st) return null; if (st.off) return fr;
  const c = st.c || [], o = c.length ? st.o % c.length : 0; return fr.concat(c.slice(o).concat(c.slice(0, o)).map(u => ({ u }))).slice(0, 2);
}
async function imgsFor(w) { // 返回 [{u, f}]，f = 视频截图
  const m = mOf(w), fr = m ? [m.img, m.img2].filter(Boolean).map(u => ({ u, f: 1 })) : [];
  if (fr.length >= 2) return fr.slice(0, 2);
  const st = await imgState(w); if (st.off) return fr;
  const c = st.c || [], o = c.length ? st.o % c.length : 0, rot = c.slice(o).concat(c.slice(0, o));
  return fr.concat(rot.map(u => ({ u }))).slice(0, 2);
}
function imgsHtml(w, list, big) {
  const st = imgMem[w] || {}, more = !mOf(w) || !mOf(w).img2;
  return (list.length ? list.map(x => '<img src="' + esc(x.u) + '" loading="lazy" alt="" title="' + (x.f ? "视频里保存时的画面" : "来自维基百科 / 维基共享资源") + '" data-fb="1">').join("") : '<span class="noimg">' + (st.off ? "已关闭配图" : "没找到合适的图") + "</span>") +
    (more ? '<span class="imb"><button data-ia="next" data-w="' + esc(w) + '" title="换一组图">↻</button><button data-ia="off" data-w="' + esc(w) + '" title="' + (st.off ? "重新显示配图" : "不要配图") + '">' + (st.off ? "＋" : "✕") + "</button></span>" : "") + (big ? '<div class="imsrc">图片来自视频画面或维基百科 / 维基共享资源</div>' : "");
}
async function fillImgs(scope) {
  const cells = $$((scope || "#wrap") + " [data-im]");
  let i = 0; const worker = async () => { while (i < cells.length) { const el = cells[i++]; if (!el.isConnected) continue; const w = el.dataset.im; try { const L = await imgsFor(w); if (el.isConnected) el.innerHTML = imgsHtml(w, L, el.classList.contains("dimg")); } catch (e) {} } };
  await Promise.all([worker(), worker(), worker()]); // 同时最多查 3 个词
}
// 图片加载失败就隐藏（扩展页不允许内联 onerror）
document.addEventListener("error", e => { const t = e.target; if (t && t.tagName === "IMG" && t.dataset.fb) t.style.display = "none"; }, true);
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-ia]"); if (b) { e.stopPropagation(); const w = b.dataset.w, st = await imgState(w), k = "wimg:" + w;
    if (b.dataset.ia === "off") st.off = !st.off; else { st.off = false; st.o = (st.o || 0) + 2; }
    chrome.storage.local.set({ [k]: st }); $$("[data-im]").filter(el => el.dataset.im === w).forEach(async el => { el.innerHTML = imgsHtml(w, await imgsFor(w), el.classList.contains("dimg")); }); return; }
  const im = e.target.closest("[data-im] img"); if (im) { e.stopPropagation(); const v = document.createElement("div"); v.className = "imgview"; const big = document.createElement("img"); big.src = im.src; v.append(big); v.onclick = () => v.replaceWith(); document.body.append(v); }
}, true);
// 打开页面时先和云端同步一次（换设备后能马上看到录音、截图和已保存的内容；同步回来的变化会自动刷新页面）
chrome.runtime.sendMessage({ type: "extSync" }, () => void chrome.runtime.lastError);
