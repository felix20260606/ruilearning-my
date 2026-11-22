/* 全站朗读：AI 真人声（Workers AI Deepgram Aura-1）优先，播不了退回各页面原来的系统语音。
   - 固定内容（口语句子、生词本的词和例句、雅思笔记）预先生成成静态文件 /tts/<编号>.mp3（tools/gen-tts.mjs，GitHub Actions 每天一批），播放不花额度；
     清单 /tts/index.json：done = 已生成，todo = 固定内容但还没生成（先用系统语音，不现场花额度）。
   - 不在清单里的句子（新加的生词、AI 回复、随机数字、阅读文章里点的句子……）现场请求 /api/tts（生成过的放 Cloudflare 缓存）。
   - 编号 = FNV-1a 32 位（"声音|句子"），和 tools/gen-tts.mjs 的 ttsKey 同一算法；句子先去掉 { } 和多余空白。
   - 开关：localStorage "tts:mode" = "ai"（默认）| "sys"。生词本 ⚙ 的「朗读语音」和口语页头的「AI 真人声 / 系统声」改的都是它。
   用法：TTS.play(text, {who:"A" 用男声, rate:播放速度, end:播完, fallback:播不了时改用系统语音}) → true 表示交给 AI 声音了（之后出错会调 fallback），false 表示请直接用系统语音。
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
  window.TTS = { play: play, stop: stop, load: load, mode: mode, setMode: setMode, key: key, clean: clean, srcOf: srcOf };
  if (mode() === "ai") load();
})();
