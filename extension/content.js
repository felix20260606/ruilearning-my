(function () {
  const DEF = { showPat: true, n_phrase: true, n_spoken: true, n_link: true, n_word: true, cloze: false, gramLabel: "abbr", capSync: true, savePhrase: true, saveMedia: true, panelTrans: "popup", showGram: true, g_pa: true, g_pf: true, g_pg: true, g_md: true, g_pv: true, g_s3: true, g_pl: true, g_art: true, g_cmp: true, g_neg: true, target: "zh-CN", showTrans: true, hoverPause: true, level: -1, greenKnown: false, fadeRare: true, trColor: "#FFD77A", trSize: 100, origSize: 100, bgColor: "#0E141C", bgOpacity: 78, engine: "youtube", merge: true, autoPause: false, blurTrans: false, posBottom: 12, panelOpen: true, ctlHidden: false, srcLang: "en", showHuman: true, hideMode: "off", enabled: true, ratio: 1.5, showMarks: true, showSuggest: true, showLearn: true, showLearnOutline: true, showIgnore: true, showSpecial: true, colKnown: "#7CE3B8", colSuggest: "#FFB86B", colIgnore: "#CDA8F7", colSpecial: "#7CE3B8", speakOnClick: true, arrowKeys: false, rate: 1, font: "", hideBar: false, below: false, dictUrls: "" };
  let S = Object.assign({}, DEF);
  let selCi = -1, tagOpen = false, wtags = {}, suggDone = "", humanAt = {}, srcVia = false, viaBase = "", pendUrl = "", lastStatus = 200, limitTry = 0, revO = false, revT = false, asr = false, custom = false, pill, tracks = [], human = [], hEl, loadedLang = "", raw = [], baseUrl = "", cues = [], trans = [], lazy = false, key = "", cur = -1, loopOn = false, loopIdx = -1, ver = 0;
  let pauseDone = -1, savedSet = new Set(), pausedByUs = false, pinned = false, hideT = null, vidId = "";
  let pEl, pdEl, root, box, oEl, tEl, tip, bar, nav, panel, listEl, tab = "subs", savedSents = [], wview = "learn", wpage = 0, wfilter = "", wtag = "", wlist = [], savedCtx = {}, showCtx = false, wtip = true, ctxDirty = false, panelMin = false, follow = true, autoScrollT = 0, userScrollT = 0;
  const pendIdx = new Set(), retry = {};

  const $ = (s, r) => (r || document).querySelector(s);
  // 和网站有关的都在 sites.js 的 VS_SITE 里（YouTube / 哔哩哔哩）：播放器、video、视频 id、浮层挂在哪、右侧栏、全屏
  const SITE = VS_SITE, BILI = SITE.id === "bili";
  const video = () => SITE.video();
  const player = () => SITE.player();
  const vId = () => SITE.vid();
  // 统一的图标：全部 24×24 画布、2px 圆头描边、跟随文字颜色
  const IC = {
    next: '<path d="M9 5l7 7-7 7"/>', prev: '<path d="M15 5l-7 7 7 7"/>', up: '<path d="M5 15l7-7 7 7"/>', down: '<path d="M5 9l7 7 7-7"/>',
    replay: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    down2: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    play: '<path class="f" d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11.3-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z"/>',
    star: '<path class="s" d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    say: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    book: '<path d="M12 6v14"/><path d="M12 6C10.5 4.7 8.3 4 5 4H3v14h2c3.3 0 5.5.7 7 2 1.5-1.3 3.7-2 7-2h2V4h-2c-3.3 0-5.5.7-7 2z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    dots: '<path class="f" d="M12 4.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm0 5.9a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm0 5.9a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'
  };
  const I = n => '<svg class="vi" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + "</svg>";
  const send = m => new Promise(res => { try { chrome.runtime.sendMessage(m, r => res(r || {})); } catch (e) { res({}); } });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const baseOf = l => String(l || "").toLowerCase().split(/[-_]/)[0];
  const askTracks = () => window.postMessage({ src: "VS-C", type: "get-tracks" }, "*");
  const zhFix = t => String(t || "").replace(/([\u3400-\u9fff\u3000-\u303f\uff00-\uffef“”‘’—…])\s+(?=[\u3400-\u9fff\u3000-\u303f\uff00-\uffef“”‘’—…])/g, "$1").trim();
  const tlangOf = t => (t === "zh-CN" ? "zh-Hans" : t === "zh-TW" ? "zh-Hant" : t);

  document.documentElement.classList.add("vs-on", "vs-" + SITE.id);
  chrome.storage.sync.get(DEF, v => { S = v; applyBar(); });
  chrome.storage.onChanged.addListener((c, a) => {
    if (a !== "sync") return;
    const old = Object.assign({}, S);
    for (const k in c) S[k] = c[k].newValue;
    applyBar(); { const k0 = cur; cur = -1; if (k0 >= 0 && cues[k0] && root) { cur = k0; render(k0); } }
    if (["level", "ratio", "greenKnown", "fadeRare", "showMarks", "showSuggest", "showLearn", "showLearnOutline", "showIgnore", "showSpecial", "showGram", "gramLabel", "g_pa", "g_pf", "g_pg", "g_md", "g_pv", "g_s3", "g_pl", "g_art", "g_cmp", "g_neg"].some(k => S[k] !== old[k])) refreshMarks();
    if (S.rate !== old.rate) { const v = video(); if (v && v.playbackRate !== S.rate) v.playbackRate = S.rate; }
    if (S.srcLang !== old.srcLang) { key = ""; loadedLang = ""; if (BILI) biliReload(); else askTracks(); }
    else if (raw.length && (S.engine !== old.engine || S.target !== old.target || S.merge !== old.merge || S.showHuman !== old.showHuman)) buildCues();
  });
  // 别的页面或云端同步改了已保存的词、标记、句子：这里的内存副本跟着换，免得下次保存时用旧的把新的盖掉
  let syncRT = 0;
  chrome.storage.onChanged.addListener((c, a) => {
    if (a !== "local" || !(c.saved || c.savedSents || c.marks || c.savedCtx || c.tags)) return;
    if (c.saved) { savedSet = new Set((c.saved.newValue || []).map(w => String(w).toLowerCase())); VS_SAVED = savedSet; }
    if (c.marks) VS_MARKS = c.marks.newValue || {};
    if (c.savedSents) savedSents = c.savedSents.newValue || [];
    if (c.savedCtx) savedCtx = c.savedCtx.newValue || {};
    if (c.tags) wtags = c.tags.newValue || {};
    clearTimeout(syncRT); syncRT = setTimeout(refreshMarks, 300);
  });
  chrome.storage.onChanged.addListener((c, a) => { if (!BILI && a === "local" && c.audioPick && c.audioPick.newValue) window.postMessage({ src: "VS-C", type: "set-audio", index: c.audioPick.newValue.i }, "*"); });
  // 一次性迁移：旧版本的 ✕ 会把侧栏彻底关掉，新版本改为收起，所以把被关掉的侧栏恢复出来
  chrome.storage.local.get({ pm1: false }, v => { if (!v.pm1) { chrome.storage.local.set({ pm1: true }); chrome.storage.sync.set({ panelOpen: true }); } });
  send({ type: "pageSync" }); // 拿一下云端和生词本的最新状态（别的电脑、网站上的改动）
  // 一次性：把已保存的词补齐成生词本网站上的完整词条
  chrome.storage.local.get({ cloudFill1: false }, v => { if (!v.cloudFill1) setTimeout(() => send({ type: "syncAll", tl: S.target }).then(r => { if (r && r.cloud) { chrome.storage.local.set({ cloudFill1: true }); if (r.added) toast("已同步 " + r.added + " 个词到生词本网站"); } }), 6000); });
  chrome.storage.local.get({ saved: [], savedSents: [], marks: {}, savedCtx: {}, showCtx: false, wtipOff: false, panelMin: false, tags: {} }, v => { wtags = v.tags || {}; panelMin = !!v.panelMin; if (panel) panel.classList.toggle("min", panelMin); savedCtx = v.savedCtx || {}; showCtx = !!v.showCtx; wtip = !v.wtipOff; savedSet = new Set(v.saved.map(w => w.toLowerCase())); VS_SAVED = savedSet; VS_MARKS = v.marks || {}; savedSents = v.savedSents; cur = -1; });

  // ---------- 字幕获取 ----------
  window.addEventListener("message", e => {
    if (e.source !== window || !e.data || e.data.src !== "VS") return;
    if (e.data.type === "dev-level" && e.data.level >= 0) { chrome.storage.sync.set({ level: +e.data.level, ratio: +e.data.ratio || 1.5 }); return; } // 开发用：只允许改词汇水平和比率
    if (e.data.type === "dev-state") { window.postMessage({ src: "VS-R", level: S.level, ratio: S.ratio, merge: S.merge, engine: S.engine, hideMode: S.hideMode, showHuman: S.showHuman, target: S.target }, "*"); return; }
    if (e.data.type === "dev-tts") { send({ type: "tts", text: e.data.text, lang: S.srcLang }).then(r => window.postMessage({ src: "VS-T", text: e.data.text, kb: Math.round((r.a || "").length / 1024), head: (r.a || "").slice(0, 22) }, "*")); return; }
    if (e.data.type === "dev-cap") { needCapture("med:__test", +e.data.ci); return; }
    if (e.data.type === "dev-media") { chrome.storage.local.get(null, v => { const m = Object.keys(v).filter(k => k.startsWith("med:")).map(k => k.slice(4) + " img=" + ((v[k].img || "").length > 100 ? 1 : 0) + " aud=" + ((v[k].aud || "").length > 100 ? Math.round(v[k].aud.length / 1024) + "KB" : 0) + " " + new Date(v[k].at).toTimeString().slice(0, 5)); window.postMessage({ src: "VS-M", saveMedia: S.saveMedia, cur, recording: recR ? recR._i : null, clips: Object.keys(clips).map(k => k + ":" + Math.round(clips[k].length / 1024) + "KB"), pend: Object.keys(pendMed), med: m, saved: (v.saved || []).length }, "*"); }); return; }
    if (e.data.type === "reload-ext") { send({ type: "reloadSelf" }); return; } // 开发用：让插件重新加载自身（仅重启插件，不涉及数据）
    if (e.data.type === "audio") { chrome.storage.local.set({ audioTracks: e.data.names || [] }); return; }
    if (e.data.type === "tracks" && !BILI) { tracks = e.data.tracks || []; chrome.storage.local.set({ trackLangs: tracks.filter(t => t.kind !== "asr").map(t => t.lang) }); pickTrack(e.data.cur); if (pendUrl && tracks.length) { const p = pendUrl; pendUrl = ""; onTimedtext(p); } return; }
    if (e.data.type === "timedtext" && !BILI) onTimedtext(e.data.url);
    if (BILI && e.data.type === "bili-tracks") onBiliTracks(e.data);
    if (BILI && e.data.type === "bili-sub" && e.data.url) { biliSubs.set(e.data.url.split("?")[0], e.data.body); if (biliSubs.size > 12) biliSubs.delete(biliSubs.keys().next().value); }
    if (BILI && e.data.type === "bili-pl" && !raw.length && !custom && vidId) setTimeout(askBili, 300); // 播放器拿到了字幕列表（比如刚登录、换了分 P）：再问一次
  });
  const dec = s => s.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  // 清洗字幕文本：实体、不可见字符、说话人标记、音效注释、--、引号、标点前空格
  function clean(t) {
    t = dec(t).replace(/[\u200b-\u200f\u2060\ufeff]/g, "").replace(/\u00a0/g, " ").replace(/\s*\n\s*/g, " ");
    t = t.replace(/^\s*>>+\s*/, "").replace(/\s*>>+\s*/g, " ").replace(/^[-–]\s+/, "").trim();
    const plain = t.replace(/[\[(][^\])]{1,40}[\])]/g, "").replace(/[♪♫]+/g, "").trim();
    if (!plain.replace(/[^\p{L}\p{N}]/gu, "")) return { t, note: true };
    let q = 0;
    t = plain.replace(/\s+-{2,}\s+/g, " — ").replace(/-{2,}/g, "—").replace(/\s+([,.;:!?])/g, "$1")
      .replace(/"/g, () => (q++ % 2 === 0 ? "“" : "”")).replace(/\s{2,}/g, " ").trim();
    return { t, note: false };
  }
  function pickTrack(curLang) {
    const want = baseOf(S.srcLang), c = tracks.filter(t => baseOf(t.lang) === want); if (!c.length) return;
    if (baseOf(curLang) !== want) window.postMessage({ src: "VS-C", type: "set-track", lang: (c.find(t => t.kind !== "asr") || c[0]).lang }, "*");
  }
  // YouTube 的 json3 字幕 → 统一的一行一行 {s, e, t}
  const parse = j => parseLines((j.events || []).filter(e => e.segs).map(e => ({ s: e.tStartMs / 1000, e: (e.tStartMs + (e.dDurationMs || 0)) / 1000, t: e.segs.map(g => g.utf8 || "").join("") })));
  function parseLines(lines) {
    const out = [];
    lines.forEach(x => {
      const c = clean(x.t);
      if (!c.t) return;
      out.push({ s: x.s, e: c.note ? Math.min(x.e, x.s + 2) : x.e, t: c.t, note: c.note }); // 音效标记最多显示 2 秒
    });
    out.sort((a, b) => a.s - b.s);
    const res = [];
    out.forEach((c, i) => {
      const n = out[i + 1];
      if (n && n.s > c.s && n.s < c.e) c.e = n.s; // 下一条开始时上一条让位（实测：音效标记会打断正在显示的句子，显示 2 秒后收起）
      const p = res[res.length - 1];
      if (p && p.t === c.t && !c.note && c.s <= p.e + 0.3) { p.e = Math.max(p.e, c.e); return; } // 只合并时间上相连的重复行
      res.push(c);
    });
    res.sort((a, b) => a.s - b.s);
    return res;
  }
  // 把被切断的字幕合并成完整句子（翻译更准，也更接近 Language Reactor）
  function groupCues(c) {
    const out = []; let g = null;
    for (const x of c) {
      if (x.note) { if (g) { out.push(g); g = null; } out.push({ s: x.s, e: x.e, t: x.t, n: 1, note: true }); continue; }
      if (g) {
        const ended = /[.?!…。？！]["”’')\]]*$/.test(g.t);
        const tooLong = g.t.length + x.t.length > 170 || g.n >= 4;
        if (!ended && x.s - g.e < 1.6 && !tooLong) { g.t += " " + x.t; g.e = x.e; g.n++; continue; }
        out.push(g);
      }
      g = { s: x.s, e: x.e, t: x.t, n: 1 };
    }
    if (g) out.push(g);
    return out;
  }
  // 自动生成的字幕：相邻两行合成一条（中间停顿较长则不合并）
  function pairCues(c) {
    const out = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[i + 1];
      if (!a.note && b && b.s - a.e < 1.5 && a.t.length + b.t.length < 110) { out.push({ s: a.s, e: b.e, t: a.t + " " + b.t, n: 2 }); i++; } // 第二行可以是 [Music] 这类标记
      else out.push(Object.assign({ n: 1 }, a));
    }
    return out;
  }
  async function getJson(u) { try { const r = await fetch(u); lastStatus = r.status; if (!r.ok) return null; return await r.json(); } catch (e) { lastStatus = 0; return null; } }
  const tsec = x => { const m = /(?:(\d+):)?(\d+):(\d+)[.,](\d+)/.exec(x); return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +("0." + m[4]) : 0; };
  function parseSubFile(txt, name) {
    const out = [];
    if (/\.(ass|ssa)$/i.test(name)) txt.split(/\r?\n/).forEach(l => { const m = /^Dialogue:\s*[^,]*,([^,]+),([^,]+),(?:[^,]*,){6}(.*)$/.exec(l); if (m) out.push({ s: tsec(m[1]), e: tsec(m[2]), t: m[3].replace(/\{[^}]*\}/g, "").replace(/\\N/gi, " ") }); });
    else txt.replace(/\r/g, "").split(/\n\n+/).forEach(b => { const ls = b.split("\n"), i = ls.findIndex(l => l.includes("-->")); if (i < 0) return; const ab = ls[i].split("-->"); out.push({ s: tsec(ab[0]), e: tsec(ab[1]), t: ls.slice(i + 1).join(" ").replace(/<[^>]+>/g, "") }); });
    return out.map(x => { const c = clean(x.t); return { s: x.s, e: x.e, t: c.t, note: c.note }; }).filter(x => x.t && x.e > x.s).sort((a, b) => a.s - b.s);
  }
  function loadSubFile(file) {
    const fr = new FileReader();
    fr.onload = async () => { const c = parseSubFile(String(fr.result), file.name); if (!c.length) { toast("没有读到字幕，请检查文件格式"); return; } custom = true; asr = false; raw = c; baseUrl = ""; await buildCues(); toast("已载入自定义字幕 " + cues.length + " 句"); };
    fr.readAsText(file);
  }
  function repair() {
    custom = false; key = ""; loadedLang = ""; raw = []; cues = []; trans = []; cur = -1; ver++; noSubs = ""; if (box) box.style.display = "none"; buildPanel(); toast("正在重新获取字幕…");
    if (BILI) { biliReload(); return; }
    const b = $(".ytp-subtitles-button"); if (b) { if (b.getAttribute("aria-pressed") === "true") { b.click(); setTimeout(() => b.click(), 400); } else b.click(); }
    setTimeout(askTracks, 1500);
  }
  async function fetchAllForce() { if (!lazy) return; for (let k = 0; k < cues.length; k += 8) await fetchTrans(k, 8); }
  const dl = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); };
  const csv = rows => "\ufeff" + rows.map(r => r.map(x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
    const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    files.forEach(f => { const nm = enc.encode(f[0]), d = enc.encode(f[1]), crc = CRC(d);
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0].concat(u32(crc), u32(d.length), u32(d.length), u16(nm.length), [0, 0]));
      parts.push(lh, nm, d);
      cd.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0].concat(u32(crc), u32(d.length), u32(d.length), u16(nm.length), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], u32(off))), nm);
      off += lh.length + nm.length + d.length; });
    const cs = cd.reduce((a, x) => a + x.length, 0);
    return new Blob(parts.concat(cd, [new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0].concat(u16(files.length), u16(files.length), u32(cs), u32(off), [0, 0]))]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function xlsx(rows) {
    const x = t => String(t == null ? "" : t).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const col = n => { let s = ""; n++; while (n) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="4" width="60" customWidth="1"/></cols><sheetData>' + rows.map((r, i) => '<row r="' + (i + 1) + '">' + r.map((c, k) => '<c r="' + col(k) + (i + 1) + '" t="inlineStr"><is><t xml:space="preserve">' + x(c) + "</t></is></c>").join("") + "</row>").join("") + "</sheetData></worksheet>";
    return zipStore([
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Subtitles" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
      ["xl/worksheets/sheet1.xml", sheet]]);
  }
  const dlBlob = (name, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); };
  async function exportData(kind) {
    const title = SITE.title() || "subtitles", safe = title.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 60);
    if (kind === "saved") { dlBlob(safe + " - 已保存.xlsx", xlsx([["类型", "内容", "翻译"]].concat([...savedSet].map(w => ["词", w, ""]), savedSents.map(x => ["句子", x.t, x.tr || ""])))); return; }
    toast("正在准备导出…"); await fetchAllForce();
    const rows = cues.filter(c => !c.note).map(c => { const i = cues.indexOf(c); return [fmt(c.s), c.t, S.showTrans ? trans[i] || "" : "", S.showHuman ? human[i] || "" : ""]; });
    if (kind === "excel") { dlBlob(safe + ".xlsx", xlsx([["时间", "原文", "机器翻译", "人工翻译"]].concat(rows))); return; }
    const hl = t => esc(t).replace(WORD_RE, w => (savedSet.has(w.toLowerCase()) ? "<mark>" + w + "</mark>" : w));
    const html = '<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font:15px/1.6 system-ui,"PingFang SC",sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#1E2733}h1{font-size:20px}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #E6EAEC;padding:7px 8px;vertical-align:top}td.t{color:#7C8794;white-space:nowrap;font-size:12px}td.z{color:#0C9370}mark{background:#FFF2B8;border-radius:3px;padding:0 2px}@media print{body{margin:0}}</style><h1>' + esc(title) + "</h1><p style=\"color:#7C8794\">" + esc(location.href) + "</p><table>" +
      rows.map(r => '<tr><td class="t">' + r[0] + "</td><td>" + hl(r[1]) + (r[2] ? '<div class="z">' + esc(r[2]) + "</div>" : "") + (r[3] ? '<div class="z">' + esc(r[3]) + "</div>" : "") + "</td></tr>").join("") + "</table>";
    dl(safe + ".html", html, "text/html");
  }
  function openSettings() {
    let ov = document.getElementById("vs-set"); if (ov) { ov.remove(); return; }
    ov = document.createElement("div"); ov.id = "vs-set";
    ov.innerHTML = '<div class="in"><div class="hd"><b>双语字幕 · 设置</b><span class="x">' + I("x") + '</span></div><iframe src="' + chrome.runtime.getURL("popup.html") + '"></iframe></div>';
    ov.addEventListener("click", e => { if (e.target === ov || e.target.classList.contains("x")) ov.remove(); });
    document.body.append(ov);
  }
  async function onTimedtext(url) {
    if (custom) return;
    const u = new URL(url);
    if (u.searchParams.get("lv")) return;
    if (u.searchParams.get("tlang")) { if (raw.length) return; u.searchParams.delete("tlang"); } // 播放器或别的插件请求的是翻译版：还没有字幕时借用它的地址，去掉翻译参数
    if (u.searchParams.get("v") !== vId()) return;
    const lang = (u.searchParams.get("lang") || "").toLowerCase(), base = lang.split(/[-_]/)[0];
    // 其他插件（如 Language Reactor）也会请求别的语言轨：忽略与翻译目标相同的语言；已载入英文轨后不再被其他语言覆盖
    const want = baseOf(S.srcLang);
    let via = false;
    if (base !== want) {
      if (tracks.some(t => baseOf(t.lang) === want) || (loadedLang === want && !srcVia)) return;
      if (!tracks.length) { pendUrl = url; return; } // 还不知道视频有哪些字幕轨，等列表回来再决定
      via = true; // 视频没有学习语言的字幕轨：和 LR 一样，让 YouTube 把现有字幕自动翻译成学习语言当作原文
    }
    const k = [u.searchParams.get("v"), lang, u.searchParams.get("kind"), via ? "via" : ""].join("|");
    if (k === key) return; key = k; loadedLang = via ? want : base; srcVia = via; viaBase = base;
    u.searchParams.set("fmt", "json3"); u.searchParams.set("lv", "1");
    const src = new URL(u.href); if (via) src.searchParams.set("tlang", tlangOf(S.srcLang));
    const j = await getJson(src.href);
    if (!j) { // YouTube 限流（429）时提示并稍后自动重试，最多 4 次
      key = "";
      if (lastStatus === 429 && limitTry < 4) { limitTry++; toast("YouTube 暂时限制了字幕请求，" + 15 * limitTry + " 秒后自动重试"); const vid = vidId; setTimeout(() => { if (vid === vidId && !raw.length) onTimedtext(url); }, 15000 * limitTry); }
      return;
    }
    limitTry = 0;
    const c = parse(j); if (!c.length) { key = ""; return; }
    raw = c; baseUrl = u.href; asr = u.searchParams.get("kind") === "asr";
    await buildCues();
    toast("已载入 " + cues.length + " 句字幕");
  }
  async function buildCues() {
    const my = ++ver;
    cues = S.merge ? groupCues(raw) : asr ? pairCues(raw) : raw.map(x => Object.assign({ n: 1 }, x));
    // 「视频自带翻译」：YouTube 自动翻译；B 站用视频自己的 AI 中文字幕（不用连谷歌）
    const bt = BILI && !custom && baseOf(S.srcLang) !== baseOf(S.target) ? vsBiliTrack(tracks, S.target, true) : null;
    const own = S.engine === "youtube" && (BILI ? !!bt : !!baseUrl);
    trans = []; pendIdx.clear(); for (const k in retry) delete retry[k]; cur = -1; loopIdx = -1; lazy = !own; // 等视频自带的翻译取回后再决定哪些句子需要备用引擎

    if (own) {
      let t2 = [];
      if (BILI) t2 = await biliLoad(bt, S.target);
      else { const u2 = new URL(baseUrl); if (srcVia && viaBase === baseOf(S.target)) u2.searchParams.delete("tlang"); else u2.searchParams.set("tlang", tlangOf(S.target)); // 原字幕本身就是翻译语言时直接用它
        const j2 = await getJson(u2.href); t2 = j2 ? parse(j2) : []; }
      if (my !== ver) return;
      if (t2.length) {
        trans = cues.map((g, i) => zhFix(t2.filter(x => x.s >= g.s - 0.05 && x.s < g.e - 0.01).map(x => x.t).join(" ")) || undefined); // 没对上的句子稍后用备用引擎补
      }
    }
    lazy = true;
    human = []; humanAt = {};
    if (S.showHuman && BILI && !custom && baseOf(S.srcLang) !== baseOf(S.target)) { // B 站视频自带的人工中文字幕
      const ht = vsBiliTrack(tracks, S.target, false), h = ht ? await biliLoad(ht, S.target) : []; if (my !== ver) return;
      cues.forEach((g, i) => { const x = zhFix(h.filter(x => !x.note && x.s >= g.s - 0.3 && x.s < g.e - 0.2).map(x => x.t).join(" ")); if (x) { trans[i] = x; humanAt[i] = 1; } });
    } else if (S.showHuman && !BILI) {
      const tb = baseOf(S.target), ht = tracks.find(t => t.kind !== "asr" && t.lang.toLowerCase() === String(S.target).toLowerCase()) || tracks.find(t => t.kind !== "asr" && baseOf(t.lang) === tb);
      if (ht && ht.baseUrl && baseUrl && baseOf(S.srcLang) !== tb && !srcVia) {
        const u3 = new URL(ht.baseUrl, location.href);
        new URL(baseUrl).searchParams.forEach((v, k) => { if (!u3.searchParams.has(k) && !/^(kind|lang|name|tlang|fmt)$/.test(k)) u3.searchParams.set(k, v); });
        u3.searchParams.set("fmt", "json3"); u3.searchParams.set("lv", "1"); u3.searchParams.delete("tlang");
        const j3 = await getJson(u3.href), h = j3 ? parse(j3) : []; if (my !== ver) return;
        // 有人工翻译的句子用人工翻译，没有的句子保留机器翻译；只显示一行
        cues.forEach((g, i) => { const x = zhFix(h.filter(x => !x.note && x.s >= g.s - 0.3 && x.s < g.e - 0.2).map(x => x.t).join(" ")); if (x) { trans[i] = x; humanAt[i] = 1; } });
      }
    }
    noteSugg();
    buildPanel();
    { const v = video(); if (v) { const i = findCue(v.currentTime); cur = i; if (root || i >= 0) render(i); } } // 翻译取回后重画当前句
  }
  function ensureCaptionsOn() {
    // 先问页面脚本有没有已经发出过的字幕请求（本脚本启动得晚会错过）；还没有就打开 CC；CC 开着却一直没拿到，就关开一次强制重取
    const my = vidId, ask = () => window.postMessage({ src: "VS-C", type: "get-last" }, "*");
    setTimeout(ask, 300); setTimeout(ask, 1500);
    [2500, 6000, 11000].forEach((ms, n) => setTimeout(() => {
      if (raw.length || custom || my !== vidId || lastStatus === 429 || limitTry) return; // 被限流时不再反复开关 CC，免得越请求越被限
      const b = $(".ytp-subtitles-button"); if (!b) return;
      if (b.getAttribute("aria-pressed") === "false") b.click();
      else if (n > 0) { b.click(); setTimeout(() => b.click(), 400); }
      else ask();
    }, ms));
  }

  // ---------- B 站字幕：页面脚本 bili-inject.js 带着登录 cookie 取字幕列表，这里挑学习语言的轨、下载、解析 ----------
  // 没有字幕时说清楚原因：没登录（B 站的 AI 字幕要登录才给）/ 这个视频没有 CC 字幕（英文多半是烧在画面里的硬字幕）/ 只有别的语言
  const biliSubs = new Map(); // 播放器自己下载过的字幕文件（拦下来的），省一次请求
  let biliTry = 0, noSubs = "";
  const askBili = () => { if (vidId) window.postMessage({ src: "VS-C", type: "bili-tracks", vid: vidId }, "*"); };
  function biliStart() { biliTry = 0; noSubs = ""; [800, 3000].forEach(ms => setTimeout(() => { if (!raw.length && !custom) askBili(); }, ms)); }
  function biliReload() { raw = []; cues = []; trans = []; human = []; cur = -1; key = ""; loadedLang = ""; ver++; noSubs = ""; biliTry = 0; askBili(); }
  async function biliLoad(t, lang) { // 一条字幕轨 → 清洗过的句子；内容和标的语言对不上（上传者标错）当作没有
    let body = biliSubs.get(t.url.split("?")[0]);
    if (!body) { const j = await getJson(t.url); body = j && j.body; if (!body) return []; }
    const lines = vsBiliLines({ body }); return lines.length && vsLooksLang(lines, lang) ? parseLines(lines) : [];
  }
  async function onBiliTracks(d) {
    if (custom || d.vid !== vidId || raw.length) return;
    if (!vsBiliSame(vidId, d.info)) { if (++biliTry < 8) setTimeout(askBili, 1200); return; } // 播放器还没换到这个视频
    tracks = vsBiliTracks(d.list); chrome.storage.local.set({ trackLangs: tracks.filter(t => t.kind !== "asr").map(t => t.lang) });
    const my = vidId;
    for (const t of vsBiliCands(tracks, S.srcLang)) {
      const c = await biliLoad(t, S.srcLang); if (my !== vidId || custom || raw.length) return;
      if (!c.length) continue;
      raw = c; baseUrl = ""; asr = !!t.kind; loadedLang = baseOf(t.lang); srcVia = false; noSubs = "";
      await buildCues(); toast("已载入 " + cues.length + " 句字幕（" + t.name + "）"); return;
    }
    const other = tracks.filter(t => baseOf(t.lang) !== baseOf(S.srcLang)).map(t => t.name);
    noSubs = !tracks.length && !d.login ? "login" : other.length && !tracks.some(t => baseOf(t.lang) === baseOf(S.srcLang)) ? "other:" + [...new Set(other)].join("、") : "none";
    if (noSubs === "login" && ++biliTry < 3) setTimeout(askBili, 4000); // 刚打开时播放器可能还没拿到登录信息
    buildPanel(); toast(noSubsMsg());
  }
  function noSubsMsg() {
    if (!BILI) return "还没有字幕。请打开视频的 CC 字幕。";
    if (!noSubs) return "正在读取 B 站字幕…";
    if (noSubs === "login") return "没有拿到字幕：登录 B 站后才有字幕（包括「英语（自动生成）」AI 字幕）。登录后刷新页面。";
    if (noSubs.startsWith("other:")) return "这个视频没有英文 CC 字幕（只有：" + noSubs.slice(6) + "）。可以点 📄 载入字幕文件。";
    return "这个视频没有 CC 字幕。画面里的英文多半是烧在视频上的硬字幕，插件拿不到；可以点 📄 载入字幕文件（.srt / .vtt / .ass）。";
  }

  // ---------- 界面 ----------
  function build() {
    const p = player(); if (!p) return false;
    let host = p; p.classList.add("vs-pl"); // 播放器（YouTube 的 #movie_player / B 站的 .bpx-player-video-area）：样式表用 .vs-pl 找它
    { const bl = S.below && SITE.below(); if (bl) { host = document.getElementById("vs-below"); if (!host) { host = document.createElement("div"); host.id = "vs-below"; } if (host.nextElementSibling !== bl) bl.parentNode.insertBefore(host, bl); } }
    if (root && root.isConnected && nav && nav.isConnected) { if (root.parentNode !== host) { host.append(root); root.classList.toggle("below", host !== p); } return true; }
    if (root) [root, bar, nav, document.getElementById("vs-ap"), document.getElementById("vs-mv")].forEach(x => x && x.remove());
    root = document.createElement("div"); root.id = "vs-sub";
    box = document.createElement("div"); box.className = "vs-box"; box.style.display = "none";
    oEl = document.createElement("div"); oEl.className = "vs-o";
    tEl = document.createElement("div"); tEl.className = "vs-t";
    hEl = document.createElement("div"); hEl.className = "vs-h";
    pEl = document.createElement("div"); pEl.className = "vs-p";
    pdEl = document.createElement("div"); pdEl.className = "vs-pd"; // 讲解浮层：不占位置，免得把字幕框顶出视频
    pEl.addEventListener("mouseover", e => { const c = e.target.closest(".vs-pc"); if (c) patShow(+c.dataset.i, false); });
    pEl.addEventListener("mouseleave", () => patShow(-1, false));
    pEl.addEventListener("click", e => { e.stopPropagation(); const c = e.target.closest(".vs-pc"); if (c) patShow(+c.dataset.i, true); });
    const rp = document.createElement("i"); rp.className = "vs-rp"; rp.innerHTML = I("play"); rp.dataset.tip = "重播本句 (S)";
    const sv = document.createElement("i"); sv.className = "vs-sv"; sv.innerHTML = I("star"); sv.dataset.tip = "保存当前字幕 (R)";
    rp.addEventListener("click", e => { e.stopPropagation(); replay(); });
    sv.addEventListener("click", e => { e.stopPropagation(); if (cur >= 0) { toggleSent(cur); syncStar(); } });
    // 隐藏字幕：鼠标移到或点击哪一行，就显示哪一行，之后保持显示，直到换句
    ["mouseenter", "click"].forEach(ev => { oEl.addEventListener(ev, () => { if (!revO) { revO = true; applyHide(); } }); [tEl, hEl].forEach(x => x.addEventListener(ev, () => { if (!revT) { revT = true; applyHide(); } })); });
    box.append(rp, oEl, tEl, hEl, pEl, pdEl, sv); root.append(box); host.append(root); root.classList.toggle("below", host !== p);
    box.addEventListener("mouseenter", () => clearTimeout(hideT));
    box.addEventListener("mouseleave", () => schedResume());
    box.addEventListener("mouseup", () => {
      const sel = String(getSelection() || "").trim();
      if (sel && /\s/.test(sel) && sel.length < 120) { selCi = cur; showTip(sel, box.getBoundingClientRect(), true); }
    });
    oEl.addEventListener("click", e => { const w = e.target.closest(".vs-w"); if (w) showTip(w.dataset.w, null, true, undefined, w); });
    oEl.addEventListener("mouseover", e => { const w = e.target.closest(".vs-w"); if (w) hoverWord(w); });
    bar = document.createElement("div"); bar.id = "vs-bar";
    bar.innerHTML = '<button data-a="tr" title="显示/隐藏翻译">译</button><button data-a="pause" title="悬停时暂停">悬停暂停</button><button data-a="loop" title="单句循环 (R)">' + I("loop") + '</button><button data-a="list" title="字幕列表 (L)">📜</button><button data-a="lvl" title="设置词汇水平">词汇</button>';
    bar.addEventListener("click", e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === "tr") chrome.storage.sync.set({ showTrans: !S.showTrans });
      if (a === "pause") chrome.storage.sync.set({ hoverPause: !S.hoverPause });
      if (a === "loop") toggleLoop();
      if (a === "list") togglePanel();
      if (a === "lvl") send({ type: "openLevel" });
    });
    nav = document.createElement("div"); nav.id = "vs-nav";
    nav.innerHTML = '<button data-a="next" data-tip="下一句 (D)">' + I("next") + '</button><button data-a="rep" data-tip="重播本句 (S)">' + I("replay") + '</button><button data-a="prev" data-tip="上一句 (A)">' + I("prev") + '</button><div id="vs-ap" data-a="ap" data-tip="每句结束自动暂停"><span class="sw" data-a="ap"></span><span class="lb" data-a="ap">AP</span></div>';
    nav.addEventListener("click", e => {
      const a = e.target.dataset.a; if (!a) return; e.stopPropagation();
      if (a === "prev") jump(-1); if (a === "next") jump(1); if (a === "rep") replay();
      if (a === "ap") chrome.storage.sync.set({ autoPause: !S.autoPause });
    });
    p.append(bar, nav); const apEl = nav.querySelector("#vs-ap"); apEl.addEventListener("click", e => { e.stopPropagation(); chrome.storage.sync.set({ autoPause: !S.autoPause }); }); p.append(apEl);
    // 播放器右上角的小按钮：展开 / 收起右侧字幕栏（和 LR 的位置、大小一致）
    { const old = document.getElementById("vs-tv"); if (old) old.remove(); const tv = document.createElement("div"); tv.id = "vs-tv"; tv.dataset.tip = "展开 / 收起字幕栏"; tv.innerHTML = I("list"); tv.onclick = e => { e.stopPropagation(); if (!panel || !panel.classList.contains("show")) { chrome.storage.sync.set({ panelOpen: true }); return; } const b = panel.querySelector(panelMin ? ".mn" : "#vs-px"); if (b) b.click(); }; p.append(tv); }
    const mv = document.createElement("div"); mv.id = "vs-mv"; mv.dataset.tip = "移动/切换控件"; mv.innerHTML = "<span>" + I("up") + "</span><span>" + I("down") + "</span>";
    let drag = null;
    mv.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); drag = { y: e.clientY, b: S.posBottom, moved: false }; mv.setPointerCapture(e.pointerId); mv.classList.add("drag"); });
    mv.addEventListener("pointermove", e => {
      if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 3) drag.moved = true; if (!drag.moved) return;
      S.posBottom = Math.max(2, Math.min(80, drag.b - dy / p.offsetHeight * 100)); applyStyle();
    });
    const end = e => {
      if (!drag) return; const d = drag; drag = null; mv.classList.remove("drag"); try { mv.releasePointerCapture(e.pointerId); } catch (x) {}
      if (d.moved) { S.posBottom = Math.round(S.posBottom); chrome.storage.sync.set({ posBottom: S.posBottom }); }
      else chrome.storage.sync.set({ ctlHidden: !S.ctlHidden });
    };
    mv.addEventListener("pointerup", end); mv.addEventListener("pointercancel", end);
    mv.addEventListener("click", e => e.stopPropagation());
    p.append(mv); mountPill(); applyBar();
    // B 站播放器在整个画面上监听点击（单击暂停、双击全屏）：点插件的字幕、按钮时不要传给它
    if (BILI) [root, bar, nav, apEl, mv, document.getElementById("vs-tv")].forEach(x => x && ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup"].forEach(ev => x.addEventListener(ev, e => e.stopPropagation())));
    return true;
  }
  function mountPill() {
    const lc = SITE.ctlLeft(); if (!lc) return;
    if (!pill) {
      pill = document.createElement("div"); pill.id = "vs-pill";
      pill.innerHTML = '<span class="tg" data-a="tg" data-tip="双语字幕 - 开/关"><span class="ic" data-a="tg">BAN</span><span class="st" data-a="tg">ON</span></span><span class="gr" data-a="set" data-tip="双语字幕 - 设置">' + I("gear") + "</span>";
      pill.addEventListener("click", e => {
        const a = e.target.dataset.a; if (!a) return; e.stopPropagation(); e.preventDefault();
        if (a === "tg") chrome.storage.sync.set({ enabled: !S.enabled }); else openSettings();
      });
    }
    if (pill.parentNode !== lc) lc.append(pill);
  }
  // 隐藏字幕（与 Language Reactor 一致）：被隐藏的行用模糊遮住；暂停不会显示；
  // 隐藏翻译→翻译模糊；隐藏字幕→原文模糊；先翻译后字幕 / 先字幕后翻译→两行都模糊，按 E 依次显示
  function applyHide() {
    if (!oEl) return;
    const m = S.hideMode, both = m === "transFirst" || m === "origFirst";
    oEl.classList.toggle("hid", (m === "orig" || both) && !revO);
    if (pEl) pEl.classList.toggle("hid", oEl.classList.contains("hid")); // 原文隐藏时句型也藏起来，免得提前看到
    const ht = (m === "trans" || both) && !revT;
    tEl.classList.toggle("hid", ht); hEl.classList.toggle("hid", ht);
  }
  function revealNext() {
    const m = S.hideMode; if (m === "off" || !oEl) return;
    const order = m === "transFirst" ? ["T", "O"] : m === "origFirst" ? ["O", "T"] : m === "trans" ? ["T"] : ["O"];
    for (const x of order) { if (x === "T" && !revT) { revT = true; break; } if (x === "O" && !revO) { revO = true; break; } }
    applyHide();
  }
  function hexRgb(h) { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function applyStyle() {
    if (!root) return;
    const [r, g, b] = hexRgb(S.bgColor);
    root.style.bottom = S.posBottom + "%"; applyHide();
    root.style.fontFamily = S.font || "";
    const de = document.documentElement.style; de.setProperty("--vs-ck", S.colKnown); de.setProperty("--vs-cs", S.colSuggest); de.setProperty("--vs-ci", S.colIgnore); de.setProperty("--vs-cp", S.colSpecial);
    root.style.setProperty("--vs-tc", S.trColor);
    root.style.setProperty("--vs-ts", String(S.trSize / 100));
    root.style.setProperty("--vs-os", String(S.origSize / 100));
    root.style.setProperty("--vs-bg", "rgba(" + r + "," + g + "," + b + "," + (S.bgOpacity / 100) + ")");
  }
  function applyBar() {
    applyStyle();
    if (!bar) return;
    bar.querySelector('[data-a="tr"]').classList.toggle("on", !!S.showTrans);
    bar.querySelector('[data-a="pause"]').classList.toggle("on", !!S.hoverPause);
    bar.querySelector('[data-a="loop"]').classList.toggle("on", loopOn);
    bar.querySelector('[data-a="list"]').classList.toggle("on", !!(panel && panel.classList.contains("show")));
    { const ap = document.getElementById("vs-ap"); if (ap) ap.classList.toggle("on", !!S.autoPause); }
    { const p = player(); if (p) { p.classList.add("vs-pl"); p.classList.toggle("vs-hidectl", !!S.ctlHidden); p.classList.toggle("vs-off", !S.enabled); p.classList.toggle("vs-hidebar", !!S.hideBar && !!S.enabled); } }
    document.documentElement.classList.toggle("vs-on", !!S.enabled);
    document.documentElement.classList.toggle("vs-cloze", !!S.cloze); { const m = S.showGram === false ? "off" : (S.gramLabel || "abbr"), H = document.documentElement; H.classList.toggle("vs-gab", m !== "off"); ["zh", "en", "abbr"].forEach(x => H.classList.toggle("vs-gl-" + x, m === x)); }
    if (pill) { pill.classList.toggle("off", !S.enabled); pill.querySelector(".st").textContent = S.enabled ? "ON" : "OFF"; }
    if (tEl) tEl.style.display = S.showTrans ? "" : "none";
    if (hEl) hEl.style.display = S.showHuman ? "" : "none";
  }
  function toast(msg, ms) {
    const p = player(); if (!p) return;
    let t = $("#vs-toast", p); if (t) t.remove();
    t = document.createElement("div"); t.id = "vs-toast"; t.textContent = msg; p.append(t);
    setTimeout(() => t.remove(), ms || (msg.length > 40 ? 6000 : 1800));
  }

  const WORD_RE = VS_WORD_RE;
  const wordsHtml = t => { const h = vsMark(esc(t), S); return phMark(S.showGram !== false && /\s/.test(t) ? vsGramHtml(h).replace(/ g-(\w+)(?=[ "])/g, (a, c) => (S["g_" + c] === false ? "" : a)) : h); };
  // 保存过的短语在字幕里整段标出来（连续的几个词一起带框）
  function phraseAt(el) { // el 所在的已保存短语（可能不止一个）
    if (!el.classList.contains("vs-ph") || !el.parentNode) return [];
    const ws = [...el.parentNode.children].filter(x => x.classList && x.classList.contains("vs-w")), i = ws.indexOf(el); let a = i, b = i;
    while (a > 0 && ws[a].classList.contains("vs-ph") && !ws[a].classList.contains("ph-s")) a--; while (b < ws.length - 1 && ws[b].classList.contains("vs-ph") && !ws[b].classList.contains("ph-e")) b++;
    const words = ws.slice(a, b + 1).map(x => x.dataset.w.toLowerCase()), at = i - a;
    return savedSents.filter(x => { if (!x.ph || !x.t) return false; const p = x.t.toLowerCase().split(/\s+/);
      for (let s0 = 0; s0 + p.length <= words.length; s0++) if (at >= s0 && at < s0 + p.length && p.every((q, k) => words[s0 + k] === q || (k === 0 && vsLemma(words[s0 + k]) === vsLemma(q)))) return true;
      return false; });
  }
  function phMark(h) {
    const phs = savedSents.filter(x => x.ph && x.t).map(x => x.t.toLowerCase().split(/\s+/)); if (!phs.length) return h;
    const re = /<span class="vs-w ([^"]*)" data-w="([^"]+)">/g, ws = []; let m; while ((m = re.exec(h))) ws.push(m[2].toLowerCase()); if (ws.length < 2) return h;
    const tag = {};
    phs.forEach(p => { for (let i = 0; i + p.length <= ws.length; i++) { let ok = true; for (let k = 0; k < p.length; k++) if (ws[i + k] !== p[k] && !(k === 0 && vsLemma(ws[i + k]) === vsLemma(p[k]))) { ok = false; break; } if (ok) for (let k = 0; k < p.length; k++) tag[i + k] = "vs-ph" + (k === 0 ? " ph-s" : "") + (k === p.length - 1 ? " ph-e" : ""); } });
    let n = 0; return h.replace(re, (a, cl, w) => { const t = tag[n++]; return t ? '<span class="vs-w ' + cl + " " + t + '" data-w="' + w + '">' : a; });
  }
  const gramLine = el => { const g = [...el.classList].filter(c => /^g-/.test(c)).map(c => VS_GRAM_NAME[c.slice(2)] && VS_GRAM_NAME[c.slice(2)] + " " + VS_GRAM_ABBR[c.slice(2)]).filter(Boolean); return g.length ? '<div class="gm">语法：' + g.join(" · ") + "</div>" : ""; };
  // ---------- 渲染当前句 ----------
  // ---------- 句型提示：字幕下面一排小标签，悬停高亮关键词并显示讲解 ----------
  let pats = [], patPin = -1;
  function renderPat() {
    if (!pEl) return; pats = []; patPin = -1;
    if (!oEl.querySelector(".vs-note")) {
      const ws = [...oEl.querySelectorAll(".vs-w")].map(x => x.dataset.w), raw = oEl.textContent;
      if (S.showPat !== false && typeof vsPatterns === "function") pats = vsPatterns(ws, 3, raw);
      if (typeof vsSentNotes === "function") pats = pats.concat(vsSentNotes(ws, raw, S, Math.max(1, 5 - pats.length), [].concat(...pats.map(p => p.keys))));
    }
    pEl.innerHTML = pats.map((p, i) => '<span class="vs-pc' + (p.cls ? " " + p.cls : "") + '" data-i="' + i + '">' + (p.icon || "📐") + " <b>" + esc(p.name) + "</b> " + esc(p.zh) + "</span>").join("");
    pEl.style.display = pats.length ? "" : "none"; if (pdEl) pdEl.classList.remove("show");
  }
  function patShow(i, pin) {
    if (pin) { patPin = patPin === i ? -1 : i; i = patPin; } else if (i < 0) i = patPin;
    const ws = oEl ? [...oEl.querySelectorAll(".vs-w")] : [];
    ws.forEach(w => w.classList.remove("vs-pk"));
    pEl.querySelectorAll(".vs-pc").forEach(c => c.classList.toggle("on", +c.dataset.i === i));
    const d = pdEl, p = pats[i];
    if (!p) { d.classList.remove("show"); return; }
    p.keys.forEach(k => ws[k] && ws[k].classList.add("vs-pk"));
    d.innerHTML = '<div class="hd">' + (p.icon || "📐") + " " + esc(p.name) + " · " + esc(p.zh) + '</div><div class="tp">' + esc(p.tip) + '</div>' + (p.ex ? '<div class="ex">例：' + esc(p.ex) + "</div>" : "");
    // 放在字幕框上方还是下方：看哪边空间够（以播放器为界，字幕在视频下方时以窗口为界）
    const pl = player(), inP = !!(pl && pl.contains(box)), cr = inP ? pl.getBoundingClientRect() : { top: 0, bottom: innerHeight, width: innerWidth }, br = box.getBoundingClientRect();
    d.style.maxWidth = Math.max(220, Math.min(560, cr.width - 24)) + "px"; d.style.maxHeight = "";
    d.classList.remove("up", "down"); d.classList.add("show");
    const h = d.offsetHeight, upS = br.top - cr.top - 10, dnS = cr.bottom - br.bottom - 10, up = upS >= h || upS >= dnS;
    d.classList.add(up ? "up" : "down"); if (h > (up ? upS : dnS)) d.style.maxHeight = Math.max(80, up ? upS : dnS) + "px";
  }
  function render(i) {
    if (!build()) return;
    revO = revT = false; applyHide();
    if (i < 0) { box.style.display = "none"; return; }
    const c = cues[i]; box.style.display = "";
    hEl.textContent = (!c.note && human[i]) || "";
    if (c.note) { oEl.innerHTML = '<span class="vs-note">' + vsMark(esc(c.t), S) + "</span>"; renderPat(); setTrans(i); markPanel(i); syncStar(); return; }
    oEl.innerHTML = wordsHtml(c.t); renderPat();
    setTrans(i); markPanel(i); syncStar();
    // 提前查好这一句里的生词，悬停时直接显示
    [...new Set([...oEl.querySelectorAll(".vs-u1,.vs-u2,.vs-lo,.vs-ln")].map(x => x.dataset.w))].slice(0, 6).forEach(w => liteLookup(w));
  }
  function setTrans(i) {
    if (i !== cur) return;
    if (trans[i]) { tEl.textContent = trans[i]; if (lazy) fetchTrans(i + 1, 6); return; }
    tEl.textContent = "";
    if (lazy) fetchTrans(i, 6);
  }
  function fetchTrans(i, span) {
    if (!lazy) return Promise.resolve();
    const idx = [];
    for (let k = i; k < Math.min(cues.length, i + (span || 6)); k++) if (cues[k] && trans[k] === undefined && !pendIdx.has(k)) idx.push(k);
    if (!idx.length) return Promise.resolve();
    const my = ver; idx.forEach(k => pendIdx.add(k));
    return send({ type: "translateMany", texts: idx.map(k => cues[k].t), tl: S.target, engine: S.engine, sl: S.srcLang }).then(r => {
      if (my !== ver) return;
      let failed = false;
      idx.forEach((k, n) => { pendIdx.delete(k); if (r.t && r.t[n]) { if (trans[k] === undefined) trans[k] = zhFix(r.t[n]); if (panel) updPanelTr(k); } else failed = true; });
      if (cur >= 0 && idx.includes(cur) && trans[cur]) tEl.textContent = trans[cur];
      if (failed && (retry[idx[0]] = (retry[idx[0]] || 0) + 1) <= 3) setTimeout(() => { if (my === ver) fetchTrans(idx[0], span); }, 1500 * retry[idx[0]]);
    });
  }
  function findCue(t) {
    let lo = 0, hi = cues.length - 1, r = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].s <= t + 0.05) { r = m; lo = m + 1; } else hi = m - 1; }
    return r; // 一句结束后停在这一句，直到下一句开始才切换
  }
  function tick() {
    if (vId() !== vidId) { vidId = vId(); raw = []; cues = []; trans = []; key = ""; loadedLang = ""; cur = -1; loopIdx = -1; loopOn = false; lazy = false; ver++; if (panel) buildPanel(); tracks = []; human = []; custom = false; noSubs = ""; if (vidId && BILI) { biliStart(); setTimeout(() => { const v = video(); if (v && S.rate && S.rate !== 1) v.playbackRate = S.rate; }, 1200); } else if (vidId && SITE.isWatch()) { ensureCaptionsOn(); setTimeout(askTracks, 1500); setTimeout(askTracks, 4500); setTimeout(() => window.postMessage({ src: "VS-C", type: "get-audio" }, "*"), 3000); setTimeout(() => { const v = video(); if (v && S.rate && S.rate !== 1) v.playbackRate = S.rate; }, 1200); } }
    document.documentElement.classList.toggle("vs-has", cues.length > 0); // B 站：有了插件的字幕才藏起播放器自己的 CC 字幕
    const v = video(); if (!v || !cues.length || !SITE.isWatch()) return;
    if (tk % 50 === 0) capSync(v);
    if (++tk % 10 === 0) { checkVV(); const pp = player(); if (pp && root) root.style.setProperty("--vs-fs", Math.max(13, pp.offsetHeight * 0.0373).toFixed(2) + "px"); // 字号跟播放器高度走，和 LR 同一比例
      mountPill(); const shown = !!(panel && panel.classList.contains("show")), wantP = !!(S.panelOpen && S.enabled); if (wantP !== shown) { if (panel) { panel.classList.toggle("show", wantP); if (wantP) { mountPanel(); markPanel(cur, true); } } else if (wantP) togglePanel(); } else if (panel && panel.classList.contains("show")) mountPanel(); }
    if (capBusy) return; // 补录原声期间不切字幕、不触发自动暂停
    const t = v.currentTime; if (root && tk % 10 === 0) build();
    if (loopOn && loopIdx >= 0 && cues[loopIdx] && t >= cues[loopIdx].e - 0.08) { v.currentTime = cues[loopIdx].s; return; }
    if (S.autoPause && !loopOn && cur >= 0 && cues[cur]) {
      const nx = cues[cur + 1], end = Math.min(cues[cur].e, nx ? nx.s : Infinity);
      if (pauseDone !== cur && !v.paused) {
        // 句末自动暂停：暂停后停在当前句，绝不提前换成下一句
        if (t >= end - 0.12 && t < end + 1) { pauseDone = cur; v.pause(); if (t > end - 0.03) v.currentTime = Math.max(cues[cur].s, end - 0.03); return; }
        const rem = (end - 0.12 - t) / (v.playbackRate || 1); if (rem > 0 && rem < 0.1) { clearTimeout(apT); apT = setTimeout(tick, rem * 1000 + 2); }
      } else if (pauseDone === cur && v.paused && t >= cues[cur].s - 0.1 && t < end + 0.5) return; // 自动暂停期间保持当前句
    }
    const i = findCue(t);
    if (i !== cur) { { const k = recR && recR._i; recStop(k != null && !!cues[k] && t >= cueEnd(k) - 0.5 && t < cueEnd(k) + 1.5); } pauseDone = -1; cur = i; if (loopOn && i >= 0) loopIdx = i; render(i); if (i >= 0) recStart(i); }
  }
  let apT = null;
  setInterval(tick, 100);

  // ---------- 悬停 / 查词卡片 ----------
  let hoverTimer = null, tk = 0, mini = null, tipData = null;
  const lite = new Map(), full = new Map();
  // 缩写展开后再翻译（I'd 直接翻会被当成 ID）
  function expand(w) {
    const x = w.replace(/’/g, "'"), l = x.toLowerCase();
    const fix = { "won't": "will not", "can't": "cannot", "shan't": "shall not", "ain't": "is not", "let's": "let us", "y'all": "you all" };
    if (fix[l]) return fix[l];
    let m;
    if ((m = /^(.+)n't$/i.exec(x))) return m[1] + " not";
    if ((m = /^(.+)'ll$/i.exec(x))) return m[1] + " will";
    if ((m = /^(.+)'re$/i.exec(x))) return m[1] + " are";
    if ((m = /^(.+)'ve$/i.exec(x))) return m[1] + " have";
    if ((m = /^(.+)'m$/i.exec(x))) return m[1] + " am";
    if ((m = /^(.+)'d$/i.exec(x))) return m[1] + " would";
    if ((m = /^(i|you|he|she|it|we|they|that|there|here|what|who|where|how|when|why)'s$/i.exec(x))) return m[1] + " is";
    return null;
  }
  // 后台连不上（插件刚更新、后台休眠出错）或请求失败时，页面自己直接查一次；失败的结果不缓存，下次悬停会重查
  const alive = () => { try { return !!chrome.runtime.id; } catch (e) { return false; } };
  let warned = false, gDown = 0;
  async function gDirect(text, isWord) {
    if (!alive() && !warned) { warned = true; toast("插件已更新，刷新页面后查词更快"); }
    if (Date.now() < gDown) return null; // 谷歌连不上（中国大陆）：10 分钟内不再直连，免得每次白等
    if (alive()) { try { const b = (await chrome.storage.local.get({ netBad: {} })).netBad || {}, t = b["translate.googleapis.com"]; if (t && Date.now() - t < 6 * 3600e3) return null; } catch (e) {} } // 后台记着谷歌不通
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 4000);
    try {
      const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(S.srcLang || "auto") + "&tl=" + encodeURIComponent(S.target) + "&dt=t" + (isWord ? "&dt=bd" : "") + "&q=" + encodeURIComponent(text), { signal: ac.signal }).finally(() => clearTimeout(tm));
      if (!r.ok) return null; const j = await r.json(), t = (j[0] || []).map(x => x[0]).join("");
      const zh = !isWord || /['’]/.test(text) ? [] : (j[1] || []).slice(0, 4).map(e => ({ pos: e[0], words: (e[1] || []).filter(x => !/[。！？.!?]$/.test(x) && x.length <= 12).slice(0, 5) })).filter(z => z.words.length);
      return t ? { t, zh } : null;
    } catch (e) { gDown = Date.now() + 600000; return null; }
  }
  const okG = g => !!(g && (g.t || (g.zh || []).length));
  const liteLookup = w => { const k0 = w.toLowerCase() + "|" + S.target, p = liteLookup0(w); p.then(g => { if (!okG(g) && lite.get(k0) === p) lite.delete(k0); }); return p; };
  const liteLookup0 = w => { const k = w.toLowerCase() + "|" + S.target; const ex = /['’]/.test(w) && !/\s/.test(w) ? expand(w) : null; if (ex && !lite.has(k)) lite.set(k, send({ type: "translate", text: ex, tl: S.target, engine: "google", sl: S.srcLang }).then(r => ({ t: r.t || "", zh: [], note: "= " + ex }))); if (!lite.has(k)) lite.set(k, (/\s/.test(w) ? send({ type: "translate", text: w, tl: S.target, engine: S.engine, sl: S.srcLang }).then(r => (r.t ? { t: r.t, zh: [] } : gDirect(w, false).then(g => g || { t: "", zh: [] }))) : send({ type: "wordLite", word: w, tl: S.target, sl: S.srcLang }).then(r => (okG(r.g) ? r.g : gDirect(w.toLowerCase(), true))))); return lite.get(k); };
  const fullLookup = w => { const k = w.toLowerCase() + "|" + S.target; if (!full.has(k)) full.set(k, /\s/.test(w) ? liteLookup(w).then(g => ({ g, d: null })) : (/['’]/.test(w) && expand(w) ? liteLookup(w).then(g => ({ g, d: null })) : send({ type: "word", word: w, tl: S.target, sl: S.srcLang }).then(r => { if (r.g) lite.set(k, Promise.resolve(r.g)); return r; }))); const fp = full.get(k); fp.then(r => { if (!(r && (okG(r.g) || r.d)) && full.get(k) === fp) full.delete(k); }); return fp; };
  const meanings = g => { const out = []; const add = x => { x = String(x || "").trim(); if (x && !out.includes(x)) out.push(x); }; if (g) { add(g.t); (g.zh || []).forEach(z => z.words.forEach(add)); } return out; };
  const freqBar = w => { const r = vsRank(w), f = r === Infinity ? 1 : Math.max(0.16, Math.min(1, r / 6000)); return '<span class="fb"><i style="width:' + Math.round(f * 100) + '%"></i></span>'; };
  // ---------- 短语识别 ----------
  const STOP = new Set("a an the of to in on at for and or but is are was were be been am i you he she it we they me him her us them my your his its our their this that these those do does did have has had not no so as if with by from".split(" "));
  const NUMW = "(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|\\d+|few|several|many|some)";
  const UNIT = "(?:second|minute|hour|day|night|week|weekend|month|year|decade|century|moment|while)s?";
  const TIME_RE = new RegExp("^(?:" + NUMW + " )?(?:(?:few|couple|couple of|number of|lot of|half) )?(?:of )?(?:" + NUMW + " )?" + UNIT + " (?:later|ago|earlier|before|after|long|from now|or so)$|^(?:every|each|last|next|this|that|the other|every single|the next|the last|the following|the previous) (?:second|minute|hour|day|night|week|weekend|month|year|decade|morning|evening|afternoon|time)$|^(?:the )?(?:day|week|month|year|night|morning) (?:before|after)$|^(?:all|the whole) (?:day|night|week|month|year|morning|afternoon|evening) long$|^(?:once|twice) (?:a|per|every) (?:day|week|month|year)$|^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|\\d+|few|several) " + UNIT + "$");
  const pcache = new Map();
  async function findPhrase(el) {
    const host = el.parentNode; if (!host) return null;
    const ws = [...host.children].filter(x => x.classList && x.classList.contains("vs-w")), i = ws.indexOf(el); if (i < 0) return null;
    const adj = (a, b) => { let n = a.nextSibling, t = ""; while (n && n !== b) { t += n.textContent; n = n.nextSibling; } return n === b && /^\s+$/.test(t); };
    const cands = [];
    for (let n = 5; n >= 2; n--) for (let st = i - n + 1; st <= i; st++) {
      if (st < 0 || st + n > ws.length) continue;
      let ok = true; for (let k = st; k < st + n - 1; k++) if (!adj(ws[k], ws[k + 1])) { ok = false; break; }
      if (!ok) continue;
      const arr = ws.slice(st, st + n).map(x => x.dataset.w.toLowerCase());
      if (!arr.every(w => STOP.has(w))) cands.push(arr);
    }
    if (!cands.length) return null;
    for (const a of cands) if (TIME_RE.test(a.join(" "))) return a.join(" ");
    const titles = new Set();
    cands.filter(a => a.length <= 4).forEach(a => { titles.add(a.join(" ")); [vsLemma(a[0])].concat(vsStems(a[0]).slice(0, 3)).forEach(q => { if (q !== a[0]) titles.add([q].concat(a.slice(1)).join(" ")); }); if (a.length === 2 || a.length === 3) vsStems(a[a.length - 1]).slice(0, 2).forEach(q => titles.add(a.slice(0, -1).concat([q]).join(" "))); });
    const need = [...titles].filter(t => !pcache.has(t));
    if (need.length) { const r = await send({ type: "phrases", titles: need }); if (!r.exist) return null; const ex = new Set(r.exist); need.forEach(t => pcache.set(t, ex.has(t))); }
    let best = null; titles.forEach(t => { if (pcache.get(t) && (!best || t.split(" ").length > best.split(" ").length)) best = t; });
    if (best) { const a = best.split(" "); if (a.length >= 3 && STOP.has(a[a.length - 1])) { const pre = a.slice(0, -1).join(" "); if (pcache.get(pre)) best = pre; } }
    return best;
  }
  function hideMini() { clearTimeout(hoverTimer); if (mini) { mini.remove(); mini = null; } }
  // 悬停：只出小气泡（两三个意思 + 词频条）
  function showMini(el) {
    hideMini(); const word = el.dataset.w, p = player(), inP = !!(p && p.contains(el));
    mini = document.createElement("div"); mini.id = "vs-mini"; mini.className = inP ? "" : "fx";
    mini.innerHTML = '<div class="pz"></div><div class="hd wd" style="display:none"></div><div class="ms">…</div>' + gramLine(el) + (S.n_word !== false && typeof vsWordNotesHtml === "function" ? vsWordNotesHtml(word, true) : "") + freqBar(word);
    (inP ? p : document.body).append(mini);
    if (inP && root) mini.style.setProperty("--vs-fs", root.style.getPropertyValue("--vs-fs") || "22px");
    mini.style.setProperty("--fbc", getComputedStyle(el).color);
    const base = inP ? p.getBoundingClientRect() : { left: 0, top: 0 };
    const my = mini, fix = () => {
      if (mini !== my) return;
      const r = el.getBoundingClientRect(), H = my.offsetHeight, W = my.offsetWidth, lim = inP ? base.top + 6 : 6;
      const holder = el.closest(".vs-box") || el.closest(".it") || el.closest(".ex") || el, hr = holder.getBoundingClientRect();
      const cx = Math.max(base.left + W / 2 + 6, Math.min(r.left + r.width / 2, (inP ? base.left + base.width : innerWidth) - W / 2 - 6));
      my.style.left = cx - base.left + "px"; my.style.setProperty("--ax", Math.max(14, Math.min(W - 14, r.left + r.width / 2 - (cx - W / 2))) + "px");
      const up = r.top - 10 - H >= lim;
      my.classList.toggle("dn", !up);
      my.style.top = (up ? r.top - 10 : hr.bottom + 12) - base.top + "px";
    };
    fix();
    { const lm = VS_IRR[word.toLowerCase()]; if (lm) liteLookup(lm).then(g => { if (mini !== my || !g) return; const x = meanings(g)[0]; if (!x) return; const d = document.createElement("div"); d.className = "lm"; d.textContent = lm + "：" + x; my.insertBefore(d, $(".fb", my)); fix(); }); }
    findPhrase(el).then(ph => { if (mini !== my || !ph || ph === word.toLowerCase()) return; liteLookup(ph).then(g => { if (mini !== my || !g || !g.t || g.t.toLowerCase() === ph) return; $(".pz", my).innerHTML = '<div class="hd">' + esc(ph) + '</div><div class="pt">' + esc(g.t) + "</div>"; const wd = $(".wd", my); wd.textContent = word; wd.style.display = ""; my.dataset.phrase = ph; fix(); }); });
    liteLookup(word).then(g => { if (mini !== my) return; setTimeout(fix, 0); const m = meanings(g).slice(0, 3); $(".ms", my).innerHTML = (g && g.note ? '<div class="m2" style="font-size:.8em">' + esc(g.note) + "</div>" : "") + (m.length ? m.map((x, i) => '<div class="m' + i + '">' + esc(x) + "</div>").join("") : "—"); fix(); });
  }
  // 侧栏悬停：气泡出现在侧栏左边 —— 短语、单词释义、整句翻译
  function showSide(it, w) {
    const i = +it.dataset.i, c = cues[i]; if (!c || !panel) return;
    const word = w ? w.dataset.w : "", inl = S.panelTrans === "inline";
    if (inl && !word) { if (mini && mini.id === "vs-side") hideMini(); return; }
    if (mini && mini.id === "vs-side" && mini._it === it && mini._w === (word ? w : null)) return;
    hideMini();
    const my = mini = document.createElement("div"); my.id = "vs-side"; my._it = it; my._w = word ? w : null; my.dataset.i = i;
    my.innerHTML = '<div class="pz"></div>' + (word ? '<div class="wr">' + freqBar(word) + "<b>" + esc(word) + '</b> : <span class="ms">…</span></div>' : "") + (word ? gramLine(w) : "") + (inl ? "" : '<div class="sn' + (word ? " ln" : "") + '">' + esc(trans[i] || "…") + "</div>");
    document.body.append(my);
    const fix = () => { if (mini !== my) return; const pr = panel.getBoundingClientRect(), r = it.getBoundingClientRect(), vw = document.documentElement.clientWidth; my.style.maxWidth = Math.max(160, Math.min(440, pr.left - 24)) + "px"; my.style.right = vw - pr.left + 10 + "px"; my.style.top = Math.max(6, Math.min(r.top - 4, innerHeight - my.offsetHeight - 6)) + "px"; };
    fix();
    if (trans[i] === undefined) fetchTrans(i, 1);
    if (!word) return;
    findPhrase(w).then(ph => { if (mini !== my || !ph || ph === word.toLowerCase()) return; liteLookup(ph).then(g => { if (mini !== my || !g || !g.t || g.t.toLowerCase() === ph) return; $(".pz", my).innerHTML = '<div class="wr"><b>' + esc(ph) + "</b> : " + esc(g.t) + "</div>"; my.dataset.phrase = ph; fix(); }); });
    liteLookup(word).then(g => { if (mini !== my) return; const m = meanings(g).slice(0, 3); $(".ms", my).textContent = m.length ? m.join(", ") : "—"; fix(); });
  }
  function hoverWord(w) {
    clearTimeout(hideT);
    if (S.hoverPause && !pinned) { const v = video(); if (v && !v.paused) { v.pause(); pausedByUs = true; } }
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showMini(w), 90);
  }
  function schedResume() {
    clearTimeout(hideT);
    hideT = setTimeout(() => {
      hideMini(); if (pinned) return;
      if (pausedByUs) { const v = video(); if (v) v.play(); pausedByUs = false; }
    }, 250);
  }
  function closeTip() { if (tip) { tip.remove(); tip = null; } tipData = null; pinned = false; }
  function placeTip() {}
  const EXT = [["Re", "Reverso Context", "https://context.reverso.net/translation/english-chinese/WORD"], ["Ca", "Cambridge", "https://dictionary.cambridge.org/dictionary/english-chinese-simplified/WORD"], ["Wr", "WordReference", "https://www.wordreference.com/enzh/WORD"], ["Gl", "Google 翻译", "https://translate.google.com/?sl=auto&tl=zh-CN&text=WORD"], ["Wi", "Wiktionary", "https://en.wiktionary.org/wiki/WORD"], ["Ba", "百度翻译", "https://fanyi.baidu.com/#en/zh/WORD"]];
  function sameWord(x, base, F) { const lx = x.toLowerCase(); if (lx === base || F.has(lx)) return true; const lb = vsLemma(base), ll = vsLemma(lx); if (ll === lb || ll === base || lx === lb) return true; const st = vsStems(lx); return st.includes(base) || st.some(q => F.has(q)); }
  // 点击：打开停靠在右侧的完整词典
  function drawDict(word, res) {
    if (!tip) return;
    const isPhrase = /\s/.test(word), g = res && res.g, d = res && res.d, ms = meanings(g), r = vsRank(word), cat = isPhrase ? "" : vsCat(word, S, false);
    const base = word.toLowerCase(), F = new Set(vsStems(base));
    const ex = []; if (!isPhrase) cues.forEach((c, i) => { if (!c.note && (c.t.match(WORD_RE) || []).some(x => sameWord(x, base, F))) ex.push(i); });
    else cues.forEach((c, i) => { if (!c.note && c.t.toLowerCase().includes(base)) ex.push(i); });
    const ci = +tip.dataset.ci; ex.sort((x, y) => (y === ci) - (x === ci) || x - y);
    const sk = new Set(savedSents.map(x => x.k));
    const users = String(S.dictUrls || "").split(/\n+/).map(u => u.trim()).filter(u => /^https?:\/\//.test(u) && u.includes("WORD"));
    const st = tip.querySelector(".bd") ? tip.querySelector(".bd").scrollTop : 0;
    tip.innerHTML = '<div class="th"><b>词典</b><span data-a="x" title="关闭">' + I("x") + '</span></div><div class="bd">' +
      '<div class="hw"><div><div class="w">' + esc(word) + (d && d.phonetic ? '<span class="ph">' + esc(d.phonetic) + "</span>" : "") + (d && d.lemma ? '<span class="ph">原形 ' + esc(d.lemma) + "</span>" : "") + '</div><div class="zh">' + (res ? esc(ms.slice(0, 4).join("，")) || "（无翻译）" : "…") + '</div></div><span class="sp" data-a="say" title="发音">' + I("say") + '</span></div>' +
      (isPhrase ? '<div class="mk"><a data-a="svph" class="svp' + (savedSents.some(x => x.k === "ph|" + word.toLowerCase().trim()) ? " on" : "") + '" title="把选中的这段文字存进「保存的短语」，并同步到生词本网站">' + I("star") + (savedSents.some(x => x.k === "ph|" + word.toLowerCase().trim()) ? "已保存短语" : "保存短语") + '</a></div>' : '<div class="fr">' + freqBar(word) + '<span class="rk">' + (r === Infinity ? "生僻" : r) + '</span></div><div class="mk"><a data-a="mk" data-m="known" class="' + (cat === "known" ? "on" : "") + '" title="已掌握">' + I("check") + '</a><a data-a="mk" data-m="learn" class="' + (cat === "learn" ? "on" : "") + '" title="将要学习（加入生词本）">' + I("book") + '</a><a data-a="mk" data-m="ignore" class="' + (cat === "ignore" ? "on" : "") + '" title="不学习">' + I("ban") + '</a><a data-a="tgo" class="cl" title="颜色标签 / 下次学习">标记 ' + (tagOpen || wtags[base] ? "&lt;&lt;" : "&gt;&gt;") + '</a></div><div class="mk2' + (tagOpen || wtags[base] ? "" : " hid") + '"><span class="tgr">' + [["", "/", "无标签"], ["g", "#", "绿色"], ["y", "#", "黄色"], ["r", "#", "红色"], ["b", "#", "蓝色"]].map(x => '<a data-a="tag" data-c="' + x[0] + '" class="t-' + (x[0] || "0") + ((wtags[base] || "") === x[0] ? " on" : "") + '" title="' + x[2] + (x[0] ? "标签" : "") + '">' + x[1] + '</a>').join("") + '</span><a data-a="next" class="nx" title="下一次复习从这个词开始">⚡ 下次学习</a></div>') +
      (tip.dataset.phrase && tip.dataset.phraseT ? '<div class="sec phz"><div class="lw">' + esc(tip.dataset.phrase) + '</div><div class="ln">' + esc(tip.dataset.phraseT) + "</div></div>" : "") +
      (tip.dataset.lemma && tip.dataset.lemmaT ? '<div class="sec phz"><div class="lw">' + esc(tip.dataset.lemma) + ' <span class="ph">（' + esc(word) + ' 的原形）</span></div><div class="ln">' + esc(tip.dataset.lemmaT) + "</div></div>" : "") +
      (g && g.zh && g.zh.length ? '<div class="sec"><div class="lw">' + esc(word) + "</div>" + g.zh.map(z => '<div class="ln"><i>(' + esc(z.pos) + ")</i>" + esc(z.words.join("，")) + "</div>").join("") + "</div>" : "") +
      (d && d.meanings && d.meanings.length ? '<div class="sec">' + d.meanings.map(m => m.defs.map((x, i) => '<div class="ln en"><i>' + (i ? "" : "(" + esc(m.pos) + ")") + "</i>" + vsMark(esc(x.def), S) + (x.example ? '<div class="eg">“' + vsMark(esc(x.example), S) + "”</div>" : "") + "</div>").join("")).join("") + "</div>" : "") +
      (S.n_word !== false && typeof vsWordNotesHtml === "function" ? vsWordNotesHtml(word, false) : "") +
      '<div class="sec lk">' + EXT.map(e => '<a target="_blank" rel="noopener" title="' + e[1] + '" href="' + e[2].replace("WORD", encodeURIComponent(word)) + '">' + e[0] + "</a>").join("") + users.map((u, n) => '<a target="_blank" rel="noopener" href="' + esc(u.replace(/WORD/g, encodeURIComponent(word))) + '">U' + (n + 1) + "</a>").join("") + "</div>" +
      '<div class="exh">示例：当前文本（' + ex.length + "）</div>" +
      (ex.slice(0, 40).map(i => '<div class="ex' + (i === cur ? " cur" : "") + '" data-i="' + i + '" title="' + esc(trans[i] || human[i] || "") + '"><i class="pl" data-a="go" title="播放这句">' + I("play") + '</i><span class="tx">' + wordsHtml(cues[i].t) + '</span><i class="st' + (sk.has(sentKey(cues[i])) ? " on" : "") + '" data-a="star">' + I("star") + "</i></div>").join("") || '<div class="ex"><span class="tx" style="color:#7f8994">本视频里没有其它例句</span></div>') + "</div>";
    tip.querySelectorAll(".ex .vs-w").forEach(x => { if (isPhrase ? false : sameWord(x.dataset.w, base, F)) x.classList.add("hit"); });
    tip.querySelector(".bd").scrollTop = st;
  }
  async function showTip(word, _rect, _pin, ci, el) {
    const p = player(); if (!p) return;
    hideMini(); pinned = true; { const v = video(); if (v && !v.paused) { v.pause(); pausedByUs = true; } }
    if (S.speakOnClick && !/\s/.test(word)) speak(word);
    if (!tip) {
      tip = document.createElement("div"); tip.id = "vs-tip"; p.append(tip);
      tip.addEventListener("click", e => {
        const a = e.target.dataset.a, word = tip.dataset.word, row = e.target.closest(".ex");
        if (a === "x") { closeTip(); if (pausedByUs) { const v = video(); if (v) v.play(); pausedByUs = false; } return; }
        if (a === "say") { speak(word); return; }
        if (a === "tag") { const k = word.toLowerCase(), cc = e.target.dataset.c; if (cc) wtags[k] = cc; else delete wtags[k]; chrome.storage.local.set({ tags: wtags }); drawDict(word, tipData); return; }
        if (a === "next") { const k = word.toLowerCase(); if (vsMarkOf(k) !== "learn") setMark(word, "learn"); send({ type: "reviewNext", word: [...savedSet].find(x => vsSame(x, k)) || k }).then(r => toast(r && r.ok ? "已排到下次复习的最前面" : "没连上网络，稍后再试")); return; }
        if (a === "svph") { const ph = word.toLowerCase().trim(), k = "ph|" + ph, at = savedSents.findIndex(x => x.k === k);
          if (at >= 0) { savedSents.splice(at, 1); chrome.storage.local.set({ savedSents }); chrome.storage.local.remove("med:s:" + k); refreshMarks(); toast("已取消保存：" + ph); drawDict(word, tipData); }
          else addPhrase(ph, selCi, true).then(() => drawDict(word, tipData));
          return; }
        if (a === "tgo") { tagOpen = !tagOpen; drawDict(word, tipData); return; }
        if (a === "mk") { const mb = e.target.closest("[data-m]"), mm = mb.classList.contains("on") ? "" : mb.dataset.m; if (mm === "learn" && S.savePhrase !== false && tip.dataset.phrase && vsMarkOf(word) !== "learn") addPhrase(tip.dataset.phrase, +tip.dataset.ci); setMark(word, mm); return; }
        if (a === "star" && row) { toggleSent(+row.dataset.i); drawDict(word, tipData); return; }
        if (a === "go" && row) { const v = video(); if (v) { v.currentTime = cues[+row.dataset.i].s + 0.01; pausedByUs = false; v.play(); } return; }
        const w = e.target.closest(".vs-w"); if (w) showTip(w.dataset.w, null, true, row ? +row.dataset.i : undefined, w);
      });
      tip.addEventListener("mouseover", e => { const w = e.target.closest(".vs-w"); if (w) showMini(w); });
      tip.addEventListener("mouseout", e => { if (e.target.closest(".vs-w")) hideMini(); });
    }
    tip.dataset.word = word; tip.dataset.ci = ci !== undefined ? ci : cur; tipData = null; tip.dataset.phrase = tip.dataset.phraseT = tip.dataset.lemma = tip.dataset.lemmaT = "";
    if (el && !/\s/.test(word)) findPhrase(el).then(ph => { if (!ph || !tip || tip.dataset.word !== word) return; liteLookup(ph).then(g => { if (!tip || tip.dataset.word !== word || !g || !g.t || g.t.toLowerCase() === ph) return; tip.dataset.phrase = ph; tip.dataset.phraseT = g.t; drawDict(word, tipData); }); });
    { const lm = VS_IRR[word.toLowerCase()]; if (lm) liteLookup(lm).then(g => { if (!tip || tip.dataset.word !== word || !g) return; tip.dataset.lemma = lm; tip.dataset.lemmaT = meanings(g).slice(0, 4).join("，"); drawDict(word, tipData); }); }
    drawDict(word, null); if (tip.querySelector(".bd")) tip.querySelector(".bd").scrollTop = 0;
    const res = await fullLookup(word);
    if (!tip || tip.dataset.word !== word) return;
    tipData = res; drawDict(word, res);
  }
  document.addEventListener("mousedown", e => { if (tip && !tip.contains(e.target) && !(root && root.contains(e.target)) && !(panel && panel.contains(e.target))) { closeTip(); if (pausedByUs) { const v = video(); if (v) v.play(); pausedByUs = false; } } }, true);

  function refreshMarks() { const keep = cur; cur = -1; if (keep >= 0 && cues[keep] && oEl) { cur = keep; oEl.innerHTML = cues[keep].note ? '<span class="vs-note">' + vsMark(esc(cues[keep].t), S) + "</span>" : wordsHtml(cues[keep].t); } else cur = keep; if (panel) { const st = listEl.scrollTop; const fl = follow; buildPanel(); autoScrollT = Date.now() + 300; listEl.scrollTop = st; markPanel(cur, fl); } if (tip) drawDict(tip.dataset.word, tipData); }
  // ---------- 原声与截图 ----------
  // 每句字幕播放时顺手把这一句的声音录下来（只留最近几句在内存里）；保存单词或句子时，把原声、当前画面和出处一起存下
  let recR = null, recV = null, recStream = null, capBusy = false; const clips = {}, pendMed = {}, capQ = [], shots = {}; // shots[i] = [这一句开头的画面, 结尾的画面]（复习卡片上并排显示两张，同 LR）
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const putShots = (o, i) => { const sh = shots[i]; if (!sh) return; if (sh[0] && !o.img) o.img = sh[0]; if (sh[1] && !o.img2) o.img2 = sh[1]; };
  const attach = (key, url, i) => chrome.storage.local.get(key, o => { if (o[key]) { o[key].aud = url; putShots(o[key], i); chrome.storage.local.set({ [key]: o[key] }); } });
  const liveAudio = v => { if (!recStream || !recStream.getAudioTracks().some(t => t.readyState === "live")) recStream = v.captureStream(); return recStream.getAudioTracks().filter(t => t.readyState === "live"); };
  const seekTo = (v, t) => new Promise(res => { let done = false; const f = () => { if (!done) { done = true; v.removeEventListener("seeked", f); res(); } }; v.addEventListener("seeked", f); v.currentTime = t; setTimeout(f, 2500); });
  // 补录：保存的那一句没有录到原声时（没从头播过、或还没播到），在视频暂停时静音回放这一句把声音录下来，再回到原来的位置
  // 只在不打扰的时候补录：视频是用户自己暂停的（不是悬停暂停），鼠标不在字幕 / 侧栏 / 词典上，并且已经停了一会儿
  let capAbort = false, capT = 0;
  const capIdle = v => v && v.paused && !pausedByUs && !document.querySelector("#vs-sub:hover, #vs-panel:hover, #vs-tip:hover, #vs-mini, #vs-side");
  const capSoon = ms => { clearTimeout(capT); capT = setTimeout(runCap, ms || 1500); };
  function needCapture(key, ci) { if (!capQ.some(x => x.key === key)) capQ.push({ key, ci, vid: vidId, n: 0 }); capSoon(1500); }
  ["keydown", "mousedown", "wheel", "touchstart"].forEach(t => document.addEventListener(t, () => { if (capBusy) capAbort = true; }, true)); // 补录时用户一动手就立刻让开
  async function runCap() {
    if (capBusy || !capQ.length) return; const v = video(); if (!v || !v.captureStream || SITE.ad()) return;
    if (!capIdle(v)) { if (v.paused && !pausedByUs) capSoon(2000); return; } // 现在不合适：留在队列里，等下次暂停再试；这一句之后正常播到的话会自动录上
    const job = capQ.shift(); if (job.vid !== vidId || !cues[job.ci]) return runCap();
    if (clips[job.ci]) { attach(job.key, clips[job.ci], job.ci); return runCap(); }
    capBusy = true; capAbort = false; const cu = cues[job.ci], t0 = v.currentTime, m0 = v.muted, r0 = v.playbackRate; let url = "", r = null;
    toast("正在补录这一句的原声（静音回放）…");
    try {
      recStop(false); v.muted = true; v.playbackRate = 1;
      await seekTo(v, Math.max(0, cu.s - 0.06)); const f0 = frameShot();
      const at = liveAudio(v); if (!at.length) throw 0;
      const chunks = []; r = new MediaRecorder(new MediaStream([at[0]]), { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32000 });
      r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; const done = new Promise(res => (r.onstop = res));
      r.start(); await v.play();
      const end = Math.min(cueEnd(job.ci) + 0.1, cu.s + 20), lim = Date.now() + (end - cu.s) * 1000 + 4000;
      while (v.currentTime < end && Date.now() < lim && !v.ended && job.vid === vidId && !capAbort) await sleep(40);
      const full = v.currentTime >= end - 0.15;
      shots[job.ci] = [f0, frameShot()]; v.pause(); r.stop(); await done;
      const b = new Blob(chunks, { type: "audio/webm" });
      if (full && !capAbort && b.size > 900 && b.size < 600000) url = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(""); fr.readAsDataURL(b); });
    } catch (e) { try { if (r && r.state !== "inactive") r.stop(); } catch (x) {} }
    const aborted = capAbort;
    try { v.pause(); if (job.vid === vidId) await seekTo(v, t0); } catch (e) {}
    try { v.playbackRate = r0; } catch (e) {}
    v.muted = m0; capBusy = false; capAbort = false;
    if (!m0) [250, 1200].forEach(ms => setTimeout(() => { const x = video(); if (x && x.muted && !capBusy) x.muted = false; }, ms)); // 保险：确保声音一定恢复
    if (url) { clips[job.ci] = url; attach(job.key, url, job.ci); (pendMed[job.ci] || []).forEach(k => attach(k, url, job.ci)); delete pendMed[job.ci]; toast("原声已保存"); }
    else if (job.vid === vidId && ++job.n < 3) capQ.push(job); // 没录成不提示：留着下次暂停时再试，或等正常播到这一句时自动录上
    if (!aborted) capSoon(600);
  }
  const cueEnd = i => (cues[i] ? Math.min(cues[i].e, cues[i + 1] ? Math.max(cues[i + 1].s, cues[i].s + 0.3) : Infinity) : 0); // 这一句实际显示到什么时候（下一句开始或自己结束）
  function recStop(full) { const r = recR; recR = null; if (r && r.state !== "inactive") { r._full = full; try { r.stop(); } catch (e) {} } }
  function recStart(i) {
    try {
      if (S.saveMedia === false || custom || capBusy) return; const v = video(); if (!v || !v.captureStream || v.paused || !cues[i] || cues[i].note) return;
      if (Math.abs(v.currentTime - cues[i].s) > 0.6) return; // 只从句子开头录，保证是完整的一句
      recStop(false);
      if (recV !== v) { recV = v; recStream = null; 
        // 句末暂停：这一句录完了。句子中途暂停（比如悬停查词）：录音也暂停，继续播放时接着录，不丢这一句
        v.addEventListener("pause", () => { if (capBusy) return; if (capQ.length) capSoon(1500); const r = recR; if (!r) return; if (v.currentTime >= cueEnd(r._i) - 0.5) recStop(true); else if (r.state === "recording") { try { r.pause(); r._pt = v.currentTime; } catch (e) { recStop(false); } } });
        v.addEventListener("playing", () => { if (capBusy) return; const r = recR; if (r && r.state === "paused") { if (cur === r._i && Math.abs(v.currentTime - r._pt) < 0.5) { try { r.resume(); } catch (e) { recStop(false); } } else recStop(false); } if (!recR && cur >= 0) recStart(cur); });
        v.addEventListener("seeking", () => { if (capBusy) return; const r = recR; if (r && !(r.state === "paused" && Math.abs(v.currentTime - r._pt) < 0.5)) recStop(false); });
      }
      const at = liveAudio(v); if (!at.length) return;
      const r = new MediaRecorder(new MediaStream([at[0]]), { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 32000 }), chunks = [], vid = vidId;
      r._i = i; r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        const lost = () => { (pendMed[i] || []).forEach(key => needCapture(key, i)); }; // 这一句没录完整：改为补录
        if (vid !== vidId) return; if (!r._full) return lost(); if (shots[i] && !shots[i][1]) shots[i][1] = frameShot(); const b = new Blob(chunks, { type: "audio/webm" }); if (b.size < 900 || b.size > 600000) return lost();
        const fr = new FileReader(); fr.onload = () => { clips[i] = fr.result; Object.keys(clips).filter(k => Math.abs(k - i) > 3).forEach(k => { delete clips[k]; delete shots[k]; }); (pendMed[i] || []).forEach(key => chrome.storage.local.get(key, o => { if (o[key]) { o[key].aud = fr.result; putShots(o[key], i); chrome.storage.local.set({ [key]: o[key] }); } })); delete pendMed[i]; }; fr.readAsDataURL(b);
      };
      r.start(); recR = r; shots[i] = [frameShot()];
    } catch (e) { recR = null; }
  }
  function frameShot() { try { const v = video(); if (!v || !v.videoWidth) return ""; const w = 360, h = Math.round(w * v.videoHeight / v.videoWidth), cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(v, 0, 0, w, h); return cv.toDataURL("image/jpeg", 0.62); } catch (e) { return ""; } }
  // 把这个视频的字幕 + 译文存到生词本网站，手机上打开就能边看边学
  let capSent = "", capSeen = "", capSince = 0;
  function capSync(v) {
    if (!SITE.capSync || S.capSync === false || custom || !vidId || capSent === vidId || cues.length < 10 || v.paused) return;
    if (capSeen !== vidId) { capSeen = vidId; capSince = Date.now(); return; }
    if (Date.now() - capSince < 20000) return; // 真的在看才同步
    capSent = vidId; const my = vidId, mv = ver, k = "cap:" + my;
    chrome.storage.local.get(k, async o => {
      if (o[k] && o[k].n === cues.length && o[k].tr >= cues.length * 0.9) return;
      try { await fetchAllForce(); } catch (e) {}
      if (vidId !== my || ver !== mv) { capSent = ""; return; }
      const body = { v: my, title: SITE.title(), author: SITE.channel(), lang: S.srcLang, tl: S.target, cues: cues.filter(c => !c.note).map(c => ({ s: +c.s.toFixed(2), e: +cueEnd(cues.indexOf(c)).toFixed(2), t: c.t, r: trans[cues.indexOf(c)] || "" })) };
      send({ type: "capUp", body }).then(r => { if (r && r.ok) chrome.storage.local.set({ [k]: { n: cues.length, tr: body.cues.filter(c => c.r).length, at: Date.now() } }); else capSent = ""; });
    });
  }
  function saveMedia(key, ci) {
    try {
      if (S.saveMedia === false || ci < 0 || !cues[ci] || custom) return; const cu = cues[ci], v = video(), near = v && v.currentTime >= cu.s - 0.3 && v.currentTime <= cu.e + 1.5;
      const o = { t: cu.t, tr: trans[ci] || "", v: vidId, s: cu.s, e: cu.e, title: SITE.title(), ch: SITE.channel(), site: SITE.id, img: (shots[ci] && shots[ci][0]) || (near ? frameShot() : ""), img2: (shots[ci] && shots[ci][1]) || "", hu: human[ci] || "", aud: clips[ci] || "", at: Date.now() }; // hu：视频自带的人工翻译
      chrome.storage.local.set({ [key]: o }, () => {
        if (o.aud) return;
        (pendMed[ci] = pendMed[ci] || []).push(key);          // 这一句正在录：录完后自动补上
        if (!(recR && recR._i === ci)) needCapture(key, ci);   // 这一句没在录：补录
      });
    } catch (e) {}
  }
  // 保存短语：进“保存的短语”，带上所在的原句、原声、画面和出处
  async function addPhrase(ph, ci, manual) {
    try {
      ph = String(ph).toLowerCase().trim(); const k = "ph|" + ph; if (!ph || savedSents.some(x => x.k === k)) return;
      const cu = cues[ci] || cues[cur] || null, g = await liteLookup(ph).catch(() => null);
      if (savedSents.some(x => x.k === k)) return;
      savedSents.push({ k, v: cu ? vidId : "", s: cu ? cu.s : 0, t: ph, tr: (g && g.t) || "", at: Date.now(), ph: 1, ctx: cu ? cu.t : "" });
      chrome.storage.local.set({ savedSents }); if (cu) saveMedia("med:s:" + k, cues.indexOf(cu)); send({ type: "add", word: ph, queueOnly: true, tl: S.target, zh: (g && g.t) || "", ctx: cu ? { t: cu.t, tr: trans[cues.indexOf(cu)] || "" } : null });
      refreshMarks();
      if (manual) toast("已保存短语：" + ph); else setTimeout(() => toast("短语 “" + ph + "” 也一起保存了"), 1900);
    } catch (e) {}
  }
  function noteCtx(k) {
    const has = c => c && !c.note && (c.t.match(WORD_RE) || []).some(x => x.toLowerCase() === k || vsLemma(x.toLowerCase()) === k);
    const ci = has(cues[cur]) ? cur : cues.findIndex(has);
    savedCtx[k] = ci >= 0 ? { t: cues[ci].t, v: vidId, s: cues[ci].s, at: Date.now() } : { at: Date.now() };
    saveMedia("med:w:" + k, ci);
    return ci >= 0 ? { t: cues[ci].t, tr: trans[ci] || "" } : null;
  }
  function markMany(words) {
    words.forEach(w => { const k = w.toLowerCase(); delete VS_MARKS[k]; savedSet.add(k); send({ type: "add", word: w, tl: S.target, ctx: noteCtx(k) }); });
    chrome.storage.local.set({ marks: VS_MARKS, savedCtx }); refreshMarks(); toast("已标记 " + words.length + " 个词为正在学习");
  }
  function setMark(word, m) { // m: known | ignore | learn | ""
    const k = word.toLowerCase();
    if (m === "learn") { Object.keys(VS_MARKS).forEach(x => { if (vsSame(x, k)) delete VS_MARKS[x]; }); savedSet.add(k); send({ type: "add", word, tl: S.target, ctx: noteCtx(k) }); chrome.storage.local.set({ savedCtx }); }
    else {
      // 按原形取消：标 wrote 为已掌握时，之前保存的 write / written 也一起移出“正在学习”
      const gone = [...savedSet].filter(x => vsSame(x, k));
      if (gone.length) { gone.forEach(x => savedSet.delete(x)); chrome.storage.local.get({ saved: [] }, v => chrome.storage.local.set({ saved: v.saved.filter(x => !gone.includes(x.toLowerCase())) })); }
      Object.keys(VS_MARKS).forEach(x => { if (x !== k && vsSame(x, k)) delete VS_MARKS[x]; });
      if (m) VS_MARKS[k] = m; else delete VS_MARKS[k];
    }
    chrome.storage.local.set({ marks: VS_MARKS }); refreshMarks();
    if (m === "known" || m === "learn") send({ type: "vocabMark", word, st: m === "known" ? "known" : "learning" }); // 生词本里的掌握状态跟着变
    toast(word + " → " + ({ learn: "将要学习", known: "已掌握", ignore: "不学习", "": "恢复默认" })[m]);
  }
  document.addEventListener("contextmenu", e => {
    const w = e.target.closest && e.target.closest(".vs-w"); if (!w || !S.enabled) return;
    e.preventDefault(); e.stopPropagation();
    if (!alive()) { toast("插件刚更新过，请刷新这个页面后再标记"); return; } // 插件重新加载后，旧页面里的标记保存不了
    // 这个词在一个已保存的短语框里：右键先取消这个短语（和单词一样，恢复成原来的样子）
    { const phs = phraseAt(w); if (phs.length) {
        phs.forEach(x => { const at = savedSents.indexOf(x); if (at >= 0) savedSents.splice(at, 1); chrome.storage.local.remove("med:s:" + x.k); });
        chrome.storage.local.set({ savedSents });
        if (vsMarkOf(w.dataset.w.toLowerCase()) !== "learn") { refreshMarks(); toast("已取消保存短语：" + phs.map(x => x.t).join("、")); return; } // 词本身没在学习：只取消短语
    } }
    // 右键循环：本来的颜色 → 正在学习（带框）→ 已掌握（白色）→ 回到本来的颜色。本来就是白色的词只在“白色 / 带框”之间切换
    const lw = w.dataset.w.toLowerCase(), mk = vsMarkOf(lw), def = vsCat(w.dataset.w, S, false, false, true), plain = def === "known" || def === "";
    const next = mk === "learn" ? (plain ? "" : "known") : mk === "known" ? (plain ? "learn" : "") : "learn", on = next !== "learn";
    if (!on && S.savePhrase !== false) { const it = w.closest(".it[data-i], .ex[data-i]"), ci = it ? +it.dataset.i : cur; findPhrase(w).then(ph => { if (ph && ph !== lw) addPhrase(ph, ci); }).catch(() => {}); } // 这个词在一个短语里：短语也一起保存
    setMark(w.dataset.w, next);
  }, true);
  // 朗读：先用后台取回的真人录音 / 在线朗读（经 AudioContext 播放，不受页面限制）；取不到再用浏览器自带语音
  let actx = null, ttsNode = null;
  function speakLocal(word) { try { const u = new SpeechSynthesisUtterance(word); u.lang = S.srcLang === "en" ? "en-US" : S.srcLang; const vs = speechSynthesis.getVoices().filter(x => x.lang && x.lang.toLowerCase().startsWith(u.lang.toLowerCase().slice(0, 2))), pick = vs.find(x => /Samantha|Google US English|Microsoft Aria|Alex/i.test(x.name)) || vs.find(x => x.lang === u.lang && x.localService) || vs[0]; if (pick) u.voice = pick; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (x) {} }
  async function speak(word) {
    const my = (speak.n = (speak.n || 0) + 1);
    try {
      const r = await send({ type: "tts", text: word, lang: S.srcLang }); if (my !== speak.n) return;
      if (r.a) {
        actx = actx || new AudioContext(); if (actx.state === "suspended") await actx.resume();
        const bin = atob(r.a.split(",")[1]), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
        const buf = await actx.decodeAudioData(u8.buffer); if (my !== speak.n) return;
        if (ttsNode) { try { ttsNode.stop(); } catch (e) {} }
        ttsNode = actx.createBufferSource(); ttsNode.buffer = buf; ttsNode.connect(actx.destination); ttsNode.start(); return;
      }
    } catch (e) {}
    speakLocal(word);
  }
  function setRate(r) { const v = video(); if (!v) return; r = Math.max(0.25, Math.min(2, r)); v.playbackRate = r; if (S.rate !== r) chrome.storage.sync.set({ rate: r }); toast("播放速度 " + r + "x"); }
  // ---------- 循环 / 跳句 / 快捷键 ----------
  function toggleLoop() {
    loopOn = !loopOn; loopIdx = loopOn ? Math.max(cur, 0) : -1; applyBar();
    toast(loopOn ? "单句循环：开" : "单句循环：关");
  }
  function replay() { const v = video(); if (v && cur >= 0) { pauseDone = -1; v.currentTime = cues[cur].s; v.play(); } else jump(0); }
  function jump(d) {
    const v = video(); if (!v || !cues.length) return;
    let i = cur >= 0 ? cur : (() => { let k = 0; while (k < cues.length && cues[k].s < v.currentTime) k++; return k - 1; })();
    i = Math.max(0, Math.min(cues.length - 1, i + d));
    v.currentTime = cues[i].s + 0.01; if (loopOn) loopIdx = i; if (v.paused) v.play();
  }
  document.addEventListener("keydown", e => {
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!S.enabled) return;
    const k = e.key.toLowerCase(), stop = () => { e.preventDefault(); e.stopPropagation(); };
    if ((e.ctrlKey || e.metaKey) && k === "c" && !e.altKey && cur >= 0 && !String(getSelection() || "").trim()) { navigator.clipboard.writeText(cues[cur].t).then(() => toast("已复制当前句子"), () => {}); stop(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.arrowKeys && (k === "arrowleft" || k === "arrowright" || k === "arrowdown")) { k === "arrowleft" ? jump(-1) : k === "arrowright" ? jump(1) : replay(); stop(); return; }
    if (k === "a") { jump(-1); stop(); }
    else if (k === "d") { jump(1); stop(); }
    else if (k === "s") { replay(); stop(); }
    else if (k === "q") { chrome.storage.sync.set({ autoPause: !S.autoPause }); toast("自动暂停：" + (!S.autoPause ? "开" : "关")); stop(); }
    else if (k === "r") { if (cur >= 0) { toggleSent(cur); syncStar(); toast(savedSents.some(x => x.k === sentKey(cues[cur])) ? "已保存当前字幕" : "已取消保存"); } stop(); }
    else if (k === "o") { toggleLoop(); stop(); }
    else if (k === "e") { revealNext(); stop(); }
    else if (k === "z" || k === "x") { const v = video(); if (v) setRate(Math.round((v.playbackRate + (k === "x" ? 0.25 : -0.25)) * 100) / 100); stop(); }
  }, true);

  // ---------- 字幕列表 ----------
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  async function fetchAll() { for (let k = 0; k < cues.length && panel && panel.classList.contains("show") && lazy; k += 6) await fetchTrans(k, 6); }
  function togglePanel() {
    if (!panel) {
      panel = document.createElement("div"); panel.id = "vs-panel";
      panel.innerHTML = '<div class="mn" title="展开"><span>字幕（隐藏）</span><i>' + I("down") + '</i></div><div class="ph"><span class="tabs"><b data-t="subs" class="on">字幕</b><b data-t="words">词语</b><b data-t="saved">已保存</b></span><span class="pr"><span id="vs-pf" title="载入字幕文件（.srt .vtt .ass .ssa）">' + I("file") + '</span><span id="vs-pr" title="修复：重新获取字幕">' + I("replay") + '</span><span id="vs-pe" title="导出">' + I("down2") + '</span><span id="vs-pg" title="设置">' + I("gear") + '</span><span id="vs-px" title="隐藏">' + I("x") + '</span></span></div><div class="em"><a data-k="html">打印（HTML）</a><a data-k="excel">Excel</a><a data-k="saved">已保存项目</a></div><input type="file" id="vs-file" accept=".srt,.vtt,.ass,.ssa" hidden><div class="ls"></div><i id="vs-back" title="回到当前字幕">' + I("target") + "</i>";
      listEl = $(".ls", panel); mountPanel();
      // ✕ 是收起：默认视图下收成「字幕（隐藏）」一条（同 LR），影院 / 全屏时整块藏起来；都可以用视频右侧的 ☰（#vs-tv）再展开
      const setMin = v => { panelMin = v; panel.classList.toggle("min", v); chrome.storage.local.set({ panelMin: v }); hideMini(); mountPanel(); if (!v) markPanel(cur, true); };
      panel.classList.toggle("min", panelMin);
      $("#vs-px", panel).onclick = () => setMin(true);
      $(".mn", panel).onclick = () => setMin(false);
      $("#vs-pg", panel).onclick = openSettings;
      $("#vs-pr", panel).onclick = repair;
      $("#vs-pf", panel).onclick = () => $("#vs-file", panel).click();
      $("#vs-file", panel).onchange = e => { const f = e.target.files[0]; if (f) loadSubFile(f); e.target.value = ""; };
      $("#vs-pe", panel).onclick = () => $(".em", panel).classList.toggle("show");
      $(".em", panel).onclick = e => { const k = e.target.dataset.k; if (!k) return; $(".em", panel).classList.remove("show"); exportData(k); };
      $(".tabs", panel).addEventListener("click", e => { const t = e.target.dataset.t; if (!t) return; tab = t; panel.querySelectorAll(".tabs b").forEach(x => x.classList.toggle("on", x.dataset.t === t)); buildPanel(); markPanel(cur, true); });
      listEl.addEventListener("mouseover", e => { const w = e.target.closest(".vs-w"), it = e.target.closest(".it.sb"); if (it) { showSide(it, w); return; } if (w) showMini(w); });
      listEl.addEventListener("mouseout", e => { if (mini && mini.id === "vs-side") { if (!e.relatedTarget || !listEl.contains(e.relatedTarget) || !e.relatedTarget.closest(".it.sb")) hideMini(); return; } if (e.target.closest(".vs-w")) hideMini(); });
      // 手动滚动后停止自动跟随，出现“回到当前”按钮；点它或滚回当前句就恢复跟随
      listEl.addEventListener("scroll", () => {
        if (mini && mini.id === "vs-side") hideMini();
        if (tab !== "subs" || Date.now() - userScrollT > 1500) return;
        const it = listEl.children[cur]; if (!it || !it.classList.contains("sb")) return;
        const mid = it.offsetTop + it.offsetHeight / 2, vis = mid >= listEl.scrollTop && mid <= listEl.scrollTop + listEl.clientHeight;
        follow = vis; panel.classList.toggle("away", !vis);
      }, { passive: true });
      ["wheel", "touchmove", "pointerdown", "keydown"].forEach(ev => listEl.addEventListener(ev, () => { userScrollT = Date.now(); }, { passive: true }));
      $("#vs-back", panel).onclick = () => { userScrollT = 0; markPanel(cur, true); };
      listEl.addEventListener("click", e => {
        { const sel = String(getSelection() || "").replace(/\s+/g, " ").trim(), row = e.target.closest(".it[data-i]"); // 在一行里拖选了几个词：查这个短语，可在词典里保存
          if (sel && /\s/.test(sel) && sel.length < 120 && row) { selCi = +row.dataset.i; showTip(sel, row.getBoundingClientRect(), true); return; } }
        const st = e.target.closest(".st"), w = e.target.closest(".vs-w"), it = e.target.closest(".it"), rm = e.target.closest(".rm");
        if (rm) { if (rm.dataset.w) { savedSet.delete(rm.dataset.w.toLowerCase()); chrome.storage.local.get({ saved: [] }, v => chrome.storage.local.set({ saved: v.saved.filter(x => x.toLowerCase() !== rm.dataset.w.toLowerCase()) })); } else { savedSents.splice(+rm.dataset.si, 1); chrome.storage.local.set({ savedSents }); } buildPanel(); cur = -1; return; }
        if (st) { toggleSent(+st.dataset.i); return; }
        { const cp = e.target.closest(".cpm"), mo = e.target.closest(".mo"), old = listEl.querySelector(".cpm");
          if (cp) { const c = cues[+cp.dataset.i]; if (c) navigator.clipboard.writeText(c.t).then(() => toast("已复制"), () => toast("复制失败")); cp.remove(); return; }
          if (old) old.remove();
          if (mo) { if (old && old.dataset.i === mo.dataset.i) return; const m = document.createElement("b"); m.className = "cpm"; m.dataset.i = mo.dataset.i; m.textContent = "复制"; mo.closest(".it").append(m); return; } }
        const q = x => e.target.closest(x);
        if (q(".wv b")) { wview = q(".wv b").dataset.v; wpage = 0; buildPanel(); listEl.scrollTop = 0; return; }
        if (q(".wtip .ok")) { wtip = false; chrome.storage.local.set({ wtipOff: true }); buildPanel(); return; }
        if (q(".tgs b")) { const t = q(".tgs b").dataset.t; wtag = wtag === t ? "" : t; buildPanel(); return; }
        if (q(".flt b")) { const f = q(".flt b").dataset.f; wfilter = wfilter === f ? "" : f; buildPanel(); return; }
        if (q(".pgr i")) { if (!q(".pgr i").classList.contains("dis")) { wpage += +q(".pgr i").dataset.p; buildPanel(); listEl.scrollTop = 0; } return; }
        if (q(".mkall")) { if (wlist.length) markMany(wlist); return; }
        if (q(".bk")) { setMark(q(".bk").dataset.w, "learn"); return; }
        if (q(".cxt")) { showCtx = !showCtx; chrome.storage.local.set({ showCtx }); buildPanel(); return; }
        if (q(".svall")) { send({ type: "openSaved" }); return; }
        if (q(".svrev")) { send({ type: "openReview" }); return; }
        if (w) { showTip(w.dataset.w, null, true, it && it.dataset.i !== undefined ? +it.dataset.i : undefined, w); return; }
        if (it && it.dataset.s !== undefined) { const v = video(); if (v) { v.currentTime = +it.dataset.s + 0.01; v.play(); } }
      });
      buildPanel();
    }
    panel.classList.toggle("show"); applyBar();
    const open = panel.classList.contains("show"); updateVV();
    if (S.panelOpen !== open) { S.panelOpen = open; chrome.storage.sync.set({ panelOpen: open }); }
    if (open) { mountPanel(); markPanel(cur, true); fetchAll(); }
  }
  // 和 LR 的「垂直视图」一样：影院模式 / 全屏时，字幕栏放在视频右侧、和视频一样高，视频缩窄让位
  const vvHost = () => SITE.wide(); // YouTube 影院 / 全屏、B 站全屏 / 网页全屏
  let vvWas = null;
  function updateVV() {
    const on = !!(panel && panel.classList.contains("vv") && panel.classList.contains("show") && !panelMin);
    if (document.documentElement.classList.contains("vs-vv-on") === on) return;
    document.documentElement.classList.toggle("vs-vv-on", on);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 30); // 让播放器按新宽度重排视频
  }
  function checkVV() { const h = vvHost(); if (h !== vvWas) { vvWas = h; mountPanel(); } }
  document.addEventListener("fullscreenchange", () => [60, 400, 1200].forEach(t => setTimeout(checkVV, t)));
  setInterval(() => { if (panel && !document.hidden) checkVV(); }, 1500); // 暂停时切换影院 / 全屏也能及时换位置
  function mountPanel() {
    if (!panel) return;
    const vv = vvHost(); vvWas = vv;
    if (!vv && SITE.sideWait && SITE.sideWait()) { if (panel.parentNode) panel.remove(); return; } // B 站页面还没渲染完：先不放（每秒再试）
    const sec = SITE.isWatch() && SITE.side();
    const host = vv || (sec && sec.offsetWidth > 200 ? sec : document.body);
    panel.classList.toggle("vv", !!vv);
    if (panel.parentNode !== host || (host !== document.body && host.firstElementChild !== panel)) host.prepend(panel);
    panel.classList.toggle("dock", host !== document.body && !vv);
    panel.classList.toggle("tr-in", S.panelTrans === "inline"); // 翻译直接显示在列表里，而不是悬停弹框
    const p = player(); panel.style.height = !vv && !panelMin && host !== document.body && p ? Math.max(320, p.offsetHeight) + "px" : "";
    updateVV();
  }
  const sentKey = c => vidId + "|" + c.t;
  function syncStar() { const sv = box && box.querySelector(".vs-sv"); if (!sv) return; const on = cur >= 0 && cues[cur] && savedSents.some(x => x.k === sentKey(cues[cur])); sv.classList.toggle("on", !!on); }
  function toggleSent(i) {
    const c = cues[i]; if (!c) return; const k = sentKey(c), at = savedSents.findIndex(x => x.k === k);
    if (at >= 0) savedSents.splice(at, 1); else savedSents.push({ k, v: vidId, s: c.s, t: c.t, tr: trans[i] || "", at: Date.now() });
    chrome.storage.local.set({ savedSents }); if (at < 0) saveMedia("med:s:" + k, i); else chrome.storage.local.remove("med:s:" + k);
    if (at < 0) { send({ type: "add", word: c.t, queueOnly: true, kind: "sentence", tl: S.target, zh: trans[i] || "" }); toast("已保存整句"); } else toast("已取消保存整句");
    if (listEl) listEl.querySelectorAll('.st[data-i="' + i + '"]').forEach(el => { el.classList.toggle("on", at < 0); });
  }
  function rowHtml(i, sk, hl) {
    const c = cues[i], on = sk.has(sentKey(c)); let en = c.note ? vsMark(esc(c.t), S) : wordsHtml(c.t);
    if (hl) en = en.replace(/<span class="vs-w ([^"]*)" data-w="([^"]+)">/g, (a, cl, w) => { const lw = w.toLowerCase(); return hl.f.has(lw) || vsLemma(lw) === hl.w ? '<span class="vs-w hl ' + cl + '" data-w="' + w + '">' : a; });
    return '<div class="it sb" data-i="' + i + '" data-s="' + c.s + '"><i class="pl" title="从这句播放">' + I("play") + '</i><i class="st' + (on ? " on" : "") + '" data-i="' + i + '" title="保存短语">' + I("star") + '</i><i class="mo" data-i="' + i + '" title="更多">' + I("dots") + '</i><div class="tm">' + fmt(c.s) + '</div><div class="en' + (c.note ? " nt" : "") + '">' + en + '</div><div class="tr">' + esc(trans[i] || "") + "</div></div>";
  }
  // 把这个视频里最值得学的生词记下来，供复习页的“建议”使用（最多留 300 个）
  function noteSugg() {
    try {
      if (S.level < 0 || !cues.length || suggDone === vidId) return; suggDone = vidId;
      const { m } = videoWords(), sc = o => o.n / Math.pow(Math.log(Math.max(3, Math.min(o.r, 25000))), 0.9);
      const top = [...m.values()].filter(o => (o.ct === "suggest" || o.ct === "rare") && o.r < 30000 && /^[a-z]+$/.test(o.w) && o.w.length > 2).sort((a, b) => sc(b) - sc(a)).slice(0, 15);
      if (!top.length) return;
      chrome.storage.local.get({ sugg: {} }, v => { const g = v.sugg; top.forEach(o => { const c = cues[o.cs[0]]; g[o.w] = { t: c.t, v: vidId, s: c.s, n: o.n, at: Date.now() }; }); const ks = Object.keys(g); if (ks.length > 300) ks.sort((a, b) => g[a].at - g[b].at).slice(0, ks.length - 300).forEach(k => delete g[k]); chrome.storage.local.set({ sugg: g }); });
    } catch (e) {}
  }
  function videoWords() {
    const m = new Map(); let tot = 0; const SS = S.level >= 0 ? S : Object.assign({}, S, { level: 2000 });
    cues.forEach((c, i) => { if (c.note) return; (c.t.match(WORD_RE) || []).forEach(w => {
      if (/^\d/.test(w)) return; const lw = w.toLowerCase(), k = vsLemma(lw); tot++;
      let o = m.get(k); if (!o) { o = { w: k, n: 0, r: Math.min(vsRank(k), vsRank(lw)), i, cs: [], f: new Set(), cap: 0 }; m.set(k, o); }
      o.n++; o.f.add(lw); if (o.cs[o.cs.length - 1] !== i) o.cs.push(i); if (/^[A-Z]/.test(w) && w !== "I" && c.t.indexOf(w) > 0) o.cap++;
    }); });
    m.forEach(o => { let ct = vsCat(o.w, SS, false); if ([...o.f].some(x => savedSet.has(x))) ct = "learn"; else if (o.cap === o.n && (ct === "suggest" || ct === "rare")) ct = "special"; if ((ct === "suggest" || ct === "rare") && /['’]/.test(o.w)) ct = "known"; o.ct = ct; o.g = ct === "known" || ct === "special" || ct === "" ? "known" : ct === "learn" || ct === "suggest" ? "learn" : "ignore"; });
    return { m, tot };
  }
  function buildPanel() {
    if (!panel) return;
    if (tab === "subs") {
      const sk = new Set(savedSents.map(x => x.k));
      listEl.innerHTML = cues.map((c, i) => rowHtml(i, sk)).join("") || '<div class="it">' + esc(noSubsMsg()) + "</div>";
      if (panel.classList.contains("show")) fetchAll();
    } else if (tab === "words") {
      const { m, tot } = videoWords(), all = [...m.values()], sk = new Set(savedSents.map(x => x.k));
      const cnt = { known: 0, learn: 0, ignore: 0 }; let kt = 0; all.forEach(o => { cnt[o.g]++; if (o.g === "known") kt += o.n; });
      const disp = o => wordsHtml(o.w === "i" ? "I" : o.w);
      let h = (wtip ? '<div class="wtip"><b>按频率排序的视频词汇</b><ul><li>右键点击标记单词</li><li>左键点击，打开词典。</li></ul><button class="ok">好的</button></div>' : "") + '<div class="wv">' + [["learn", "学习"], ["rank", "词频排名"], ["count", "视频中出现次数"]].map(x => '<b data-v="' + x[0] + '"' + (wview === x[0] ? ' class="on"' : "") + ">" + x[1] + "</b>").join("") + "</div>";
      wlist = [];
      if (!all.length) h += '<div class="it">' + esc(noSubsMsg()) + "</div>";
      else if (wview === "learn") {
        const sc = o => o.n / Math.pow(Math.log(Math.max(3, Math.min(o.r, 25000))), 0.9);
        const cand = all.filter(o => o.ct === "suggest" || o.ct === "rare").sort((a, b) => sc(b) - sc(a) || a.r - b.r);
        const pages = Math.max(1, Math.ceil(cand.length / 20)); wpage = Math.max(0, Math.min(wpage, pages - 1));
        const pg = cand.slice(wpage * 20, wpage * 20 + 20), gain = pg.reduce((a, o) => a + o.n, 0), pct = x => tot ? Math.round(x / tot * 100) : 0;
        h += '<div class="pgs"><div class="pt">你已掌握 ' + pct(kt) + '% 的单词</div><div class="pb"><i style="width:' + pct(kt) + '%"></i><i class="g" style="width:' + (pct(kt + gain) - pct(kt)) + '%"></i></div><div class="pt">' + (pg.length ? "学习 " + pg.length + " 个单词即可达到 " + pct(kt + gain) + "%" : "这个视频里没有需要学习的生词") + "</div></div>";
        const secOf = o => Math.floor(cues[o.i].s / 600); let no = wpage * 20;
        [...new Set(pg.map(secOf))].sort((a, b) => a - b).forEach(sx => {
          h += '<div class="sec">' + sx * 10 + "–" + (sx * 10 + 10) + " min</div>";
          pg.filter(o => secOf(o) === sx).forEach(o => { no++; wlist.push(o.w); h += '<div class="wh"><i class="no">' + no + "</i>" + disp(o) + '<i class="cx">' + o.n + '×</i><span class="mt" data-m="' + esc(o.w) + '"></span><i class="bk" data-w="' + esc(o.w) + '" title="标记为正在学习">' + I("book") + "</i></div>" + o.cs.slice(0, 6).map(i => rowHtml(i, sk, o)).join(""); });
        });
        if (pg.length) h += '<div class="wft"><button class="mkall">标记为正在学习 (' + pg.length + ')</button><span class="pgr"><i data-p="-1"' + (wpage ? "" : ' class="dis"') + ">" + I("prev") + "</i><b>" + (wpage + 1) + '</b><i data-p="1"' + (wpage < pages - 1 ? "" : ' class="dis"') + ">" + I("next") + "</i></span></div>";
      } else {
        h += '<div class="flt">' + [["known", I("check")], ["learn", I("book")], ["ignore", I("ban")]].map(x => '<b data-f="' + x[0] + '" class="f-' + x[0] + (wfilter && wfilter !== x[0] ? " off" : "") + '">' + x[1] + " " + cnt[x[0]] + "</b>").join("") + '</div><div class="tgs"><b class="tot' + (wtag ? " off" : "") + '" data-t="">/ ' + all.length + "</b>" + ["g", "y", "r", "b"].map(c => '<b class="tg-' + c + (wtag === c ? " on" : "") + '" data-t="' + c + '"># ' + all.filter(o => wtags[o.w] === c).length + "</b>").join("") + "</div>";
        const list = all.filter(o => (!wfilter || o.g === wfilter) && (!wtag || wtags[o.w] === wtag)), CB = [[100, "100+"], [50, "50+"], [20, "20+"], [10, "10+"], [5, "5+"], [4, "4"], [3, "3"], [2, "2"], [1, "1"]], bk = n => CB.find(x => n >= x[0]);
        const grp = (arr, letters) => CB.map(b => { const ws = arr.filter(o => bk(o.n) === b).sort((a, c) => (a.w < c.w ? -1 : 1)); if (!ws.length) return ""; let body = "", lt = ""; ws.forEach(o => { if (letters && ws.length > 30 && o.w[0].toUpperCase() !== lt) { lt = o.w[0].toUpperCase(); body += '<i class="lt">' + esc(lt) + "</i>"; } body += disp(o) + " "; }); return '<div class="rk"><i class="bd c' + b[0] + '">' + b[1] + '</i><div class="ws">' + body + "</div></div>"; }).join("");
        if (wview === "rank") { const R = [1, 101, 201, 301, 501, 701, 1001, 1501, 2001, 2501, 3001, 4001, 5001, 6001, 8001, Infinity]; for (let x = 0; x < R.length - 1; x++) { const arr = list.filter(o => o.r >= R[x] && (o.r < R[x + 1] || (x === R.length - 2))); if (arr.length) h += '<div class="sec">Rank ' + (x === R.length - 2 ? "8001+" : R[x] + " - " + (R[x + 1] - 1)) + "</div>" + grp(arr, false); } }
        else h += grp(list, true);
      }
      listEl.innerHTML = h;
      if (wview === "learn") { const my = ver, pgKey = wpage; (async () => { for (const el of listEl.querySelectorAll(".mt[data-m]")) { if (tab !== "words" || wview !== "learn" || wpage !== pgKey || my !== ver || !el.isConnected) return; const g = await liteLookup(el.dataset.m); el.textContent = meanings(g).slice(0, 2).join(", "); } })(); }
    } else {
      const items = [...savedSet].map((w, n) => ({ w, at: (savedCtx[w] || {}).at || 0, n })).concat(savedSents.map((x, si) => ({ x, si, at: x.at || 0, n: si })));
      items.sort((a, b) => b.at - a.at || (!a.x === !b.x ? b.n - a.n : a.x ? 1 : -1));
      listEl.innerHTML = '<div class="svb"><button class="svall">' + I("list") + '查看全部</button><button class="svrev">' + I("clock") + '练习</button></div><div class="svh"><span>最近保存:</span><span class="cxt">显示上下文<i class="tg' + (showCtx ? " on" : "") + '"></i></span></div>' +
        (items.map(o => { if (o.x) return '<div class="it sv"' + (o.x.v === vidId ? ' data-s="' + o.x.s + '"' : "") + '><i class="ty">p</i><div class="en">' + wordsHtml(o.x.t) + '</div><i class="rm" data-si="' + o.si + '" title="移除">' + I("x") + '</i></div>'; let c = savedCtx[o.w]; if (showCtx && !(c && c.t)) { const ci = cues.findIndex(q => !q.note && (q.t.match(WORD_RE) || []).some(x => x.toLowerCase() === o.w || vsLemma(x.toLowerCase()) === o.w || vsLemma(x.toLowerCase()) === vsLemma(o.w))); if (ci >= 0) { c = { t: cues[ci].t, v: vidId, s: cues[ci].s, at: (c || {}).at || 0 }; savedCtx[o.w] = c; ctxDirty = true; } } const ctx = showCtx && c && c.t; return '<div class="it sv"' + (ctx && c.v === vidId ? ' data-s="' + c.s + '"' : "") + '><i class="ty">w</i><div class="en">' + wordsHtml(ctx ? c.t : o.w) + '</div><i class="rm" data-w="' + esc(o.w) + '" title="移除">' + I("x") + '</i></div>'; }).join("") || '<div class="it"><span class="cnt">还没有保存的内容。右键点击单词，或点字幕右侧的 ☆</span></div>') +
        '<div class="hd">生词本待整理队列 <a id="vs-qc" style="cursor:pointer;color:#0FA37A;margin-left:8px">复制全部</a></div><div class="chips" id="vs-q"><span class="cnt">读取中…</span></div>';
      if (ctxDirty) { ctxDirty = false; chrome.storage.local.set({ savedCtx }); }
      send({ type: "pending" }).then(r => { const q = $("#vs-q", panel); if (!q || tab !== "saved") return; const p = r.pending; q.innerHTML = !p ? '<span class="cnt">读取失败</span>' : p.length ? p.map(w => '<span class="chip" style="padding-right:10px">' + esc(w) + "</span>").join("") : '<span class="cnt">队列是空的</span>'; const c = $("#vs-qc", panel); if (c) c.onclick = () => navigator.clipboard.writeText((p || []).join("\n")).then(() => toast("已复制 " + (p || []).length + " 个词")); });
    }
  }
  function updPanelTr(i) { if (!listEl || tab !== "subs") return; const it = listEl.children[i]; if (it && $(".tr", it)) $(".tr", it).textContent = trans[i] || ""; if (mini && mini.id === "vs-side" && +mini.dataset.i === i && $(".sn", mini)) $(".sn", mini).textContent = trans[i] || ""; }
  function markPanel(i, force) {
    if (!panel) return; if (tab !== "subs") { panel.classList.remove("away"); return; }
    if (!panel.classList.contains("show")) return;
    const old = $(".it.cur", listEl); if (old) old.classList.remove("cur");
    if (force) { follow = true; panel.classList.remove("away"); }
    const it = listEl.children[i]; if (it) { it.classList.add("cur"); if (!follow) return; autoScrollT = Date.now() + 900; listEl.scrollTo({ top: it.offsetTop - listEl.clientHeight / 2 + it.offsetHeight / 2, behavior: force ? "auto" : "smooth" }); }
  }
})();
