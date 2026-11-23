/* 🎙 全站共用的「录音 + 转文字 + 逐词打分」（口语、练习的跟读卡、听力逐句精听、精听逐句练都用这一套）
   录音：MediaRecorder 录下来 → 后台 /api/stt（Workers AI 的 Whisper）转文字；后台没开 AI / 失败时，用浏览器自带的语音识别（Chrome / Edge / Safari；Brave 不行）同时听到的文字
   REC.toggle(key, o)：没在录 → 开始录 key；正在录 key → 停下并识别；正在录别的 → 先把那条停下识别，再开始录 key
     o.lang 语言（默认当前学习语言）；o.max 最长秒数（默认 20）；o.before() 开始前（停掉页面自己的播放器）；o.start() 已经在录了（画「⏹ 停止」）
     o.done(x) 录完、识别完：x = { key, blob, url（能回放的地址）, text（识别到的话）, noai（后台没开 AI）}；o.cancel() 被取消（不识别）
   REC.stop(cancel)：停下（cancel = true 不识别、不调 done）；REC.cur() 正在录的 key（没在录 = null）；REC.SR 浏览器能不能自己识别
   打分：REC.score(原句, 说的 / 打的, {lang, near}) → { a: 原句的词, hit: 每个词对上没有, extra: 多出来的词, score: 0–1 }
     near（默认 true）长词只差一个字母也算对（语音识别常把词尾听错）；听写打字传 near:false
   REC.mark(原句, hit, {ok, no}) → 原句 html，对上的词套 ok 类、没对上的套 no 类（保留原句的大小写和标点）
   REC.toks(句子, lang) 分词：小写、去标点、连字符拆开；德语 ä ö ü ß 写成 ae oe ue ss 也算对 */
(function () {
  "use strict";
  if (window.REC) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const curLang = o => (o && o.lang) || window.VL || (window.LANG && LANG.cur && LANG.cur()) || "en";
  const bcp = l => (l === "en" ? "en-US" : window.LANG && LANG.cfg ? LANG.cfg(l).bcp : l);
  const tip = m => { try { if (typeof window.toast === "function") window.toast(m); else if (typeof toast === "function") toast(m); } catch (e) {} };
  let rec = null;

  function stop(cancel) {
    const r = rec; if (!r) return; rec = null; if (r.pending) return; // 还在等麦克风：start 拿到以后看到被取消，会自己关掉
    clearTimeout(r.t); r.cancel = !!cancel;
    try { if (r.sr) r.sr.stop(); } catch (e) {}
    try { if (r.mr && r.mr.state !== "inactive") r.mr.stop(); else { r.stream.getTracks().forEach(t => t.stop()); finish(r); } } catch (e) { finish(r); }
  }
  async function start(key, o) {
    if (o.before) try { o.before(); } catch (e) {}
    if (window.TTS) TTS.hush();
    // 等麦克风（第一次会弹权限框）期间先占个位：这时再点录音、翻卡、停止，都能取消这一次（以前会同时开两个，旧的那个麦克风一直不关）
    const ph = rec = { key, o, pending: true };
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { if (rec === ph) rec = null; tip("没拿到麦克风：请在浏览器地址栏允许使用麦克风"); return false; }
    if (rec !== ph) { stream.getTracks().forEach(t => t.stop()); return false; }
    const lang = curLang(o), r = rec = { key, o, lang, stream, chunks: [], srText: "", fin: false };
    try { r.mr = new MediaRecorder(stream); r.mr.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); }; r.mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); finish(r); }; r.mr.start(); } catch (e) { r.mr = null; }
    if (SR) try { const sr = r.sr = new SR(); sr.lang = bcp(lang); sr.interimResults = false; sr.continuous = true; sr.onresult = e => { r.srText = [...e.results].map(y => y[0].transcript).join(" "); }; sr.onerror = () => {}; sr.start(); } catch (e) { r.sr = null; }
    if (!r.mr && !r.sr) { stream.getTracks().forEach(t => t.stop()); rec = null; tip("这个浏览器不能录音"); return false; }
    r.t = setTimeout(() => { if (rec === r) stop(false); }, Math.min(60, o.max || 20) * 1000);
    if (o.start) try { o.start(); } catch (e) {}
    return true;
  }
  async function finish(r) {
    if (r.fin) return; r.fin = true;
    if (r.cancel) { if (r.o.cancel) r.o.cancel(); return; }
    const blob = r.chunks.length ? new Blob(r.chunks, { type: r.chunks[0].type || "audio/webm" }) : null, x = { key: r.key, blob, url: "", text: "", noai: false };
    if (r.o.busy) try { r.o.busy(); } catch (e) {}
    if (blob) {
      try { x.url = URL.createObjectURL(blob); } catch (e) {}
      try { const j = await (await fetch("/api/stt" + (r.lang !== "en" ? "?lang=" + r.lang : ""), { method: "POST", headers: { "Content-Type": blob.type }, body: blob })).json(); if (j && j.ok) x.text = j.text || ""; else if (j && j.error === "noai") x.noai = true; } catch (e) {}
    }
    if (!x.text) { await new Promise(res => setTimeout(res, 600)); x.text = r.srText || ""; } // 浏览器语音识别的结果稍晚一点才到
    if (r.o.done) r.o.done(x);
  }
  function toggle(key, o) {
    o = o || {};
    if (rec) { const same = rec.key === key; stop(false); if (same) return Promise.resolve(false); }
    return start(key, o);
  }

  /* ---------- 打分 ---------- */
  function fold(w, lang) { return lang === "de" ? w.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss") : w; }
  function toks(t, lang) {
    return String(t || "").normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}'\s-]+/gu, " ").split(/[\s-]+/)
      .map(x => fold(x.replace(/^'+|'+$/g, ""), lang || curLang())).filter(Boolean);
  }
  function near(a, b) { // 一样，或者长词（5 个字母以上）只差一个字母
    if (a === b) return true; if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function score(target, said, o) { // 逐词对比（按顺序的最长公共子序列）
    o = o || {}; const lang = curLang(o), eq = o.near === false ? (x, y) => x === y : near;
    const a = toks(target, lang), b = toks(said, lang), n = a.length, m = b.length, W = m + 1, T = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i * W + j] = eq(a[i], b[j]) ? T[(i + 1) * W + j + 1] + 1 : Math.max(T[(i + 1) * W + j], T[i * W + j + 1]);
    const hit = new Array(n).fill(false), extra = []; let i = 0, j = 0;
    while (i < n && j < m) { if (eq(a[i], b[j]) && T[i * W + j] === T[(i + 1) * W + j + 1] + 1) { hit[i] = true; i++; j++; } else if (T[(i + 1) * W + j] >= T[i * W + j + 1]) i++; else extra.push(b[j++]); }
    while (j < m) extra.push(b[j++]);
    return { a, hit, extra, score: n ? hit.filter(Boolean).length / n : 0 };
  }
  function mark(text, hit, o) { // 原句按空白切开：这一段里的词都对上了才算对
    o = o || {}; let k = 0; const lang = curLang(o), ok = o.ok || "ok", no = o.no || "no";
    return String(text || "").split(/(\s+)/).map(w => { if (!w || /^\s+$/.test(w)) return w; const n = toks(w, lang).length; if (!n) return esc(w); const good = (hit || []).slice(k, k + n).every(Boolean); k += n; return '<span class="' + (good ? ok : no) + '">' + esc(w) + "</span>"; }).join("");
  }
  window.REC = { toggle, stop, cur: () => (rec ? rec.key : null), SR: !!SR, score, mark, toks, near };
})();
