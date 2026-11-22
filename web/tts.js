/* 全站朗读：AI 真人声（Workers AI Deepgram Aura-1）优先，播不了退回各页面原来的系统语音。
   - 固定内容（口语句子、生词本的词和例句、雅思笔记）预先生成成静态文件 /tts/<编号>.mp3（tools/gen-tts.mjs，GitHub Actions 每天一批），播放不花额度；
     清单 /tts/index.json：done = 已生成，todo = 固定内容但还没生成（先用系统语音，不现场花额度）。
   - 不在清单里的句子（新加的生词、AI 回复、随机数字、阅读文章里点的句子……）现场请求 /api/tts（生成过的放 Cloudflare 缓存）。
   - 编号 = FNV-1a 32 位（"声音|句子"），和 tools/gen-tts.mjs 的 ttsKey 同一算法；句子先去掉 { } 和多余空白。
   - 开关：localStorage "tts:mode" = "ai"（默认）| "sys"。生词本 ⚙ 的「朗读语音」和口语页头的「AI 真人声 / 系统声」改的都是它。
   底层：TTS.play(text, {who:"A" 用男声, rate:播放速度, end:播完, fallback:播不了时改用系统语音}) → true 表示交给 AI 声音了（之后出错会调 fallback），false 表示请直接用系统语音。
*/
(function () {
  if (window.TTS) return;
  var M = null, loading = null, player = null, id = 0, KEY = "tts:mode";
  function clean(t) { return String(t == null ? "" : t).replace(/[{}]/g, "").replace(/\s+/g, " ").trim(); }
  function key(voice, text) { var s = voice + "|" + clean(text), h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); }
  function load() {
    if (!loading) loading = fetch("/tts/index.json?h=" + Math.floor(Date.now() / 3.6e6)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (j) { // 读不到清单（刚部署时可能拿到首页）就先用系统语音，30 秒后再试，免得把固定内容都拿去现场生成
        if (j && Object.prototype.toString.call(j.done) === "[object Array]") M = { voices: j.voices || { "": "asteria", A: "orion" }, done: new Set(j.done), todo: new Set(j.todo || []) };
        else setTimeout(function () { loading = null; }, 30000);
        return M;
      });
    return loading;
  }
  function mode() { try { return localStorage.getItem(KEY) === "sys" ? "sys" : "ai"; } catch (e) { return "ai"; } }
  function setMode(m) { try { localStorage.setItem(KEY, m === "sys" ? "sys" : "ai"); } catch (e) {} if (m !== "sys") load(); }
  function stop() { id++; if (player) { try { player.pause(); } catch (e) {} player = null; } }
  function srcOf(text, who) {
    if (!M) return "";
    var t = clean(text), v = M.voices[who === "A" ? "A" : ""] || "asteria", k = key(v, t);
    if (M.done.has(k)) return "/tts/" + k + ".mp3";
    if (M.todo.has(k) || !t || t.length > 1500 || !/[a-z]/i.test(t)) return "";
    return "/api/tts?v=" + v + "&t=" + encodeURIComponent(t);
  }
  function play(text, o) {
    o = o || {};
    if (mode() === "sys") return false;
    if (window.VL && window.VL !== "en") return false; // AI 真人声只会英语：学德语等其它语言时用系统语音（index.html 按语言挑）
    if (!M) { load(); return false; }
    var src = srcOf(text, o.who); if (!src) return false;
    stop(); try { speechSynthesis.cancel(); } catch (e) {}
    var my = ++id, a = new Audio(src), fell = false; player = a;
    var back = function () { if (fell || my !== id) return; fell = true; player = null; if (o.fallback) o.fallback(); };
    try { a.preservesPitch = true; a.playbackRate = Math.max(0.5, Math.min(2, +o.rate || 1)); } catch (e) {}
    a.onended = function () { if (my === id) { player = null; if (o.end) o.end(); } };
    a.onerror = back;
    try { var pr = a.play(); if (pr && pr.catch) pr.catch(back); } catch (e) { back(); }
    return true;
  }
  /* ---------- 全站统一朗读入口（所有页面都用这一套，不再各写一份） ----------
     TTS.say(text, o)：先 AI 真人声，播不了 / 不是英语 / 选了系统声 → 系统语音
       o.who "A" 换另一个声音（对话里的另一个人）；o.rate 语速倍数（1 = 正常，🐢 慢速传 0.75）；o.end(err) 播完（被别的朗读打断就不调）
       o.sys true 只用系统语音（全文连读这种不花 AI 额度）；o.lang 语言代码（默认当前学习语言）；o.base 系统语音的基础语速（默认「⚙ 设置」里的）
     TTS.sys(text, o)：只用系统语音；TTS.word(w, o)：单词先放真人录音（pron-real.json，维基词典），没有再 say
     TTS.hush()：停掉所有朗读（AI、系统语音、真人录音），之前的 end 都不会再调
     系统语音挑哪个：index.html「⚙ 设置」里选的（chosenVoice，语言对得上才用）> 这个语言里最好听的；who "A" 挑同语言另一个 */
  var sayId = 0, realA = null, REAL = null, realLoading = null;
  function bcpOf(o) {
    if (o && o.lang) return o.lang.length === 2 ? ({ en: "en-US", de: "de-DE" }[o.lang] || o.lang) : o.lang;
    var c = window.VL || (window.LANG && LANG.cur && LANG.cur()) || "en";
    return c === "en" ? "en-US" : (window.LANG && LANG.cfg ? LANG.cfg(c).bcp : c);
  }
  var PREF = [/google us english/i, /google uk english female/i, /samantha/i, /ava/i, /allison/i, /serena/i, /aaron/i, /google deutsch/i, /anna/i, /(enhanced|premium|natural|neural)/i];
  function voicesOf(bcp) {
    var p = bcp.slice(0, 2).toLowerCase(), all = [];
    try { all = speechSynthesis.getVoices(); } catch (e) {}
    return all.filter(function (v) { return v.lang && v.lang.replace("_", "-").toLowerCase().indexOf(p) === 0; });
  }
  function prefVoice() { try { return typeof chosenVoice !== "undefined" && chosenVoice ? chosenVoice : null; } catch (e) { return null; } } // index.html「⚙ 设置」选的
  function prefRate() { try { return typeof state !== "undefined" && state && +state.rate ? +state.rate : 0.95; } catch (e) { return 0.95; } }
  function voiceFor(who, bcp) {
    var L = voicesOf(bcp), p = bcp.slice(0, 2).toLowerCase(), main = prefVoice();
    if (main && (!main.lang || main.lang.toLowerCase().indexOf(p) !== 0)) main = null;
    if (!main) for (var i = 0; i < PREF.length && !main; i++) for (var j = 0; j < L.length; j++) if (PREF[i].test(L[j].name) || PREF[i].test(L[j].lang)) { main = L[j]; break; }
    if (!main) main = L.filter(function (v) { return v.lang.replace("_", "-").toLowerCase() === bcp.toLowerCase(); })[0] || L[0] || null;
    if (who !== "A") return main;
    var other = L.filter(function (v) { return (!main || v.name !== main.name) && /en[-_]US/i.test(v.lang); })[0] || L.filter(function (v) { return !main || v.name !== main.name; })[0];
    return other || main;
  }
  function realStop() { if (realA) { try { realA.pause(); } catch (e) {} realA = null; } }
  function hush() { sayId++; stop(); realStop(); try { speechSynthesis.cancel(); } catch (e) {} }
  function sysSay(t, o, my) {
    var done = false, end = function (err) { if (done || my !== sayId) return; done = true; if (o.end) o.end(err); };
    try {
      if (!("speechSynthesis" in window)) { if (window.toast) toast("此环境不支持朗读，可在手机浏览器打开"); end(true); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(t), bcp = bcpOf(o), v = voiceFor(o.who, bcp);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = bcp;
      u.rate = (o.base != null ? o.base : prefRate()) * (o.rate || 1); u.pitch = o.who === "A" ? 1.05 : 1;
      u.onend = function () { end(); };
      u.onerror = function (e) { if (e && (e.error === "interrupted" || e.error === "canceled")) return; end(true); }; // 被别的代码 cancel 掉：不算播完
      speechSynthesis.speak(u);
    } catch (e) { end(true); }
  }
  function sys(text, o) { o = o || {}; hush(); var t = clean(text); if (!t) { if (o.end) o.end(true); return; } sysSay(t, o, sayId); }
  function say(text, o) {
    o = o || {}; hush(); var my = sayId, t = clean(text);
    if (!t) { if (o.end) o.end(true); return; }
    var en = bcpOf(o).slice(0, 2).toLowerCase() === "en";
    if (!o.sys && en && play(t, { who: o.who, rate: o.rate || 1, end: function () { if (my === sayId && o.end) o.end(); }, fallback: function () { if (my === sayId) sysSay(t, o, my); } })) return;
    sysSay(t, o, my);
  }
  function realLoad() { if (!realLoading) realLoading = fetch("pron-real.json?v=b6ceb67b").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { REAL = j || {}; return REAL; }); return realLoading; }
  function realOf(w) { return (REAL && REAL[String(w || "").toLowerCase().trim()]) || null; }
  function word(w, o) { // 真人录音（upload.wikimedia.org 打不开时 NET 换后台中转）；没有 / 播不了就 say()
    o = o || {}; var x = realOf(w); if (!x) { if (!REAL) realLoad(); say(w, o); return; }
    hush(); var my = sayId, a = new Audio(window.NET ? NET.src(x.u) : x.u), fell = false; realA = a;
    a.playbackRate = Math.max(0.7, Math.min(1, o.rate || 1));
    var fall = function () { if (fell || my !== sayId || realA !== a) return; fell = true; realA = null; say(w, o); };
    a.onended = function () { if (my === sayId && realA === a) { realA = null; if (o.end) o.end(); } };
    a.addEventListener("error", function () { if (!window.NET || /\/api\/px\?/.test(a.src)) fall(); }); // 直连出错 NET 会换中转再试；中转也不行才用合成声音
    if (window.NET) NET.audio(a); // 要在上面那个监听之后加
    var pr = a.play(); if (pr && pr.catch) pr.catch(function (e) { if (e && e.name === "NotAllowedError") fall(); });
  }
  window.TTS = { play: play, stop: stop, load: load, mode: mode, setMode: setMode, key: key, clean: clean, srcOf: srcOf,
    say: say, sys: sys, hush: hush, word: word, realLoad: realLoad, realOf: realOf, voiceFor: voiceFor, bcpOf: bcpOf };
  if (mode() === "ai") load();
})();
