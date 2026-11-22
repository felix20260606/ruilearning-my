/* ▶ 全站共用的放音小工具（window.MEDIA）
   MEDIA.solo(留下的播放器 | "video")：要开始放声音了，把别的都停掉（朗读、视频、MEDIA.reg 登记过的播放器、页面上别的 <audio>/<video>），一次只响一个
   MEDIA.reg(播放器)：页面自己 new Audio() 的播放器登记一下（听力节目、练习课、考试、背单词的配音）
   MEDIA.seg(播放器, 开始秒, 结束秒, {rate, end, cut, fail})：放原声的一段（精听、练习课的一句一句）
     放到结束秒自动停：end()；中途被暂停 / 换了别的段：cut()；放不出来：fail()（默认弹提示）
     后台标签页里没有动画帧，所以同时用 timeupdate 和 50 毫秒的定时器看有没有到点
     rate 播放速度（默认 1；放完 / 被打断后恢复成原来的速度）
   MEDIA.play(地址, {rate, end, fail})：放一小段声音（录音回放、卡片配音、短片原声），全站共用一个播放器，返回它（要停就 .pause()）
   MEDIA.stop(播放器)：停掉这个播放器上正在放的段（会调 cut）
   出错记进 U.log("media", …) */
(function () {
  "use strict";
  if (window.MEDIA) return;
  const log = (m, d) => { if (window.U) U.log("media", m, d); };
  const SEG = new WeakMap(), OWN = new Set();
  function reg(au) { OWN.add(au); return au; } // 页面自己 new Audio() 的播放器（不在网页里，querySelectorAll 找不到）登记一下，solo 才停得到
  function solo(keep) {
    try { if (window.TTS && TTS.hush) TTS.hush(); else speechSynthesis.cancel(); } catch (e) {}
    try { if (window.videoCore && videoCore.pause && keep !== "video") videoCore.pause(); } catch (e) {}
    const L = new Set(OWN); try { document.querySelectorAll("audio,video").forEach(a => L.add(a)); } catch (e) {}
    L.forEach(a => { if (a !== keep && !a.paused) try { a.pause(); } catch (e) {} });
  }
  function finish(au, ended) {
    const S = SEG.get(au); if (!S) return; SEG.delete(au);
    clearInterval(S.iv); au.removeEventListener("timeupdate", S.chk); au.removeEventListener("pause", S.chk);
    if (ended && !au.paused) try { au.pause(); } catch (e) {}
    if (S.rate0 != null) try { au.playbackRate = S.rate0; } catch (e) {}
    const f = ended ? S.o.end : S.o.cut; if (f) try { f(); } catch (e) {}
  }
  function stop(au) { if (SEG.has(au)) finish(au, false); }
  function seg(au, s, e, o) {
    o = o || {}; stop(au);
    const S = { o, e: +e, rate0: au.playbackRate, started: false }; SEG.set(au, S);
    S.chk = () => { if (SEG.get(au) !== S) return; if (au.currentTime >= S.e || au.ended) finish(au, true); else if (S.started && au.paused) finish(au, false); };
    const go = () => {
      if (SEG.get(au) !== S) return;
      try { au.currentTime = +s; } catch (err) {}
      try { au.playbackRate = o.rate || 1; } catch (err) {}
      const p = au.play();
      Promise.resolve(p).then(() => { if (SEG.get(au) !== S) return; S.started = true; S.iv = setInterval(S.chk, 50); }).catch(err => {
        if (SEG.get(au) !== S) return; SEG.delete(au); if (S.rate0 != null) au.playbackRate = S.rate0;
        log("原声放不出来", { src: String(au.currentSrc || au.src).slice(-80), err: String(err && err.name || err) });
        if (o.fail) o.fail(err); else if (window.U) U.tip("原声放不出来，点一下 🔊 再试");
      });
    };
    au.addEventListener("timeupdate", S.chk); au.addEventListener("pause", S.chk);
    if (au.readyState >= 1) go(); else au.addEventListener("loadedmetadata", go, { once: true });
  }
  let ONE = null;
  function play(src, o) { // 放一小段声音（录音回放、卡片配音、短片原声）：全站共用一个播放器，新的一放旧的就停
    o = o || {}; if (!ONE) { ONE = new Audio(); OWN.add(ONE); }
    solo(ONE); try { ONE.pause(); } catch (e) {}
    const a = ONE; a.onended = () => { if (a.src === S0 && o.end) o.end(); };
    let S0 = /^https?:/i.test(src) && window.NET && NET.src ? NET.src(src) : src; a.src = S0; S0 = a.src;
    try { a.playbackRate = o.rate || 1; } catch (e) {}
    Promise.resolve(a.play()).catch(err => { if (err && err.name === "AbortError") return; log("放不出来", { src: String(src).slice(0, 80), err: String(err && err.name || err) }); if (o.fail) o.fail(err); else if (window.U) U.tip("播放不了"); });
    return a;
  }
  window.MEDIA = { solo, reg, seg, stop, play, playing: au => SEG.has(au) };
})();
