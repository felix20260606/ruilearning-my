/* 🎧 通勤模式（对标 Pimsleur / 免手复习）：生词本里的词一条条读给你听，走路、开车、熄屏也能复习
   每一条：读英文 → 停几秒（自己在心里想意思）→ 读中文意思 → 读例句 → 短停，接着下一条
   - 全部用 <audio> 播放（不用浏览器的朗读）：手机锁屏、切到别的 App 也能接着播；锁屏 / 耳机上能 ⏯ ⏭ ⏮（Media Session）
   - 英文：先用 GitHub 每天预先生成好的 AI 真人语音（/tts/<编号>.mp3，不花额度）；没有的、还有中文 / 德语，用谷歌翻译的朗读（免费）
   - 停顿：现做一段静音音频（这样锁屏时也不会断）
   - 顺序：没掌握的先（到期该复习的最前），可以只听没掌握的；数量、停顿秒数、读不读中文 / 例句、语速都能调（存在本机 commute:opt）
   - 听完一条算一张「听力卡」：记进 pump:log 今天的 ls（「📅 每日」的「听」、统计页都认）
   入口：window.commuteShow()（「🔊 练习」首页的按钮；按需加载，lazy.js）
   依赖：U、TTS（tts.js 的 srcOf / clean）、index.html 的 words、state、masteryOf */
(function () {
  "use strict";
  if (window.commuteShow && !window.commuteShow.__lazy) return;
  const { esc, LG, LS } = U;
  const CSS = `
  #cm{position:fixed;inset:0;z-index:9500;background:var(--ui-bg,#111);color:var(--ui-ink);display:none;flex-direction:column;font-family:var(--ui-font);padding:calc(14px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px))}
  #cm.on{display:flex}
  #cm .hd{display:flex;align-items:center;gap:10px}#cm .hd b{font-size:17px}#cm .hd .sp{flex:1}#cm .x{border:0;background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;min-width:40px;min-height:40px;font-size:18px;cursor:pointer}
  #cm .card{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:10px}
  #cm .w{font-size:clamp(30px,9vw,56px);font-weight:900;line-height:1.15;word-break:break-word}
  #cm .zh{font-size:20px;color:var(--ui-ink-2);min-height:1.4em;transition:opacity .2s}#cm .zh.hid{opacity:0}
  #cm .ex{font-size:16px;color:var(--ui-muted);max-width:640px;line-height:1.55;min-height:1.4em}
  #cm .st{font-size:13px;color:var(--ui-muted)}#cm .bar{width:min(520px,90%);height:4px;border-radius:2px;background:var(--ui-surface-2);overflow:hidden}#cm .bar u{display:block;height:100%;background:var(--ui-pur)}
  #cm .ctl{display:flex;justify-content:center;gap:16px;margin:8px 0 12px}#cm .ctl button{border:0;border-radius:50%;width:64px;height:64px;font-size:26px;background:var(--ui-surface-2);color:var(--ui-ink);cursor:pointer}
  #cm .ctl .pp{width:80px;height:80px;font-size:32px;background:var(--ui-pur);color:#fff}
  #cm .opts{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;font-size:13.5px;color:var(--ui-ink-2)}
  #cm .opts select{background:var(--ui-surface-2);color:var(--ui-ink);border:1px solid var(--ui-line-2);border-radius:8px;padding:4px 6px;font:inherit}
  #cm .tip{font-size:12.5px;color:var(--ui-muted);text-align:center;margin-top:8px;line-height:1.6}`;
  const DEF = { n: 30, gap: 3, zh: true, ex: true, rate: 1, only: true };
  let opt = Object.assign({}, DEF, LG("commute:opt", {}));
  let root = null, au = null, Q = [], qi = 0, step = 0, playing = false, tok = 0;
  const lang = () => (window.VL && window.VL !== "en" ? window.VL : "en");
  const clean = t => String(t || "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();

  // ---------- 音频 ----------
  const gtts = (t, tl) => "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" + tl + "&q=" + encodeURIComponent(String(t).slice(0, 190));
  function srcEn(t) { // 预先生成的 AI 语音（不花额度）→ 谷歌朗读
    try { if (lang() === "en" && window.TTS && TTS.srcOf) { const s = TTS.srcOf(t, ""); if (s && s.indexOf("/tts/") === 0) return [s, gtts(t, "en")]; } } catch (e) {}
    return [gtts(t, lang() === "de" ? "de" : "en")];
  }
  const SIL = {};
  function silence(sec) { // 一段静音 WAV（8 kHz、8 位、单声道）
    if (SIL[sec]) return SIL[sec];
    const n = Math.round(8000 * sec), b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
    return (SIL[sec] = URL.createObjectURL(new Blob([b], { type: "audio/wav" })));
  }
  // 放一段：srcs 一个个试（前一个放不了就换下一个）；结束 / 全失败都往下走
  // fb = [文字, 语言]：音频都放不了（谷歌朗读被拦）时，页面开着就用浏览器自己的朗读顶上（锁屏时浏览器朗读会停，只好跳过）
  function sysSay(t, l, rate) { return new Promise(res => { try { if (document.hidden || !window.speechSynthesis) return res(); const u = new SpeechSynthesisUtterance(t); u.lang = l === "zh" ? "zh-CN" : l === "de" ? "de-DE" : "en-US"; u.rate = rate || 1; u.onend = u.onerror = () => res(); speechSynthesis.speak(u); setTimeout(res, 15000); } catch (e) { res(); } }); }
  function playSrc(srcs, rate, my, fb) {
    return new Promise(res => {
      let i = 0;
      const next = () => { if (my !== tok) return res(false); if (i >= srcs.length) return fb ? sysSay(fb[0], fb[1], rate).then(() => res(my === tok)) : res(true); au.src = srcs[i++]; au.playbackRate = rate || 1; try { au.preservesPitch = true; } catch (e) {} const p = au.play(); if (p && p.catch) p.catch(e => { if (e && e.name === "NotAllowedError") { pause(); res(false); } else next(); }); };
      au.onended = () => res(true); au.onerror = () => next();
      next();
    });
  }

  // ---------- 要听的词 ----------
  function build() {
    const W = (typeof words !== "undefined" ? words : []).filter(w => w && w.word && (w.type || "word") !== "pattern" && !/[一-鿿]/.test(w.word));
    const S = (typeof state !== "undefined" && state.srs) || {}, m = w => { try { return typeof masteryOf === "function" ? masteryOf(w) : 0; } catch (e) { return 0; } };
    const now = Date.now(), due = w => { const r = S[w.id]; return r && r.due ? r.due <= now : false; };
    let L = W.map(w => ({ w, m: m(w), due: due(w), seen: !!S[w.id] }));
    if (opt.only) L = L.filter(x => x.m < 1);
    L.sort((a, b) => (b.due - a.due) || (b.seen - a.seen) || (a.m - b.m) || String(b.w.date || "").localeCompare(String(a.w.date || "")));
    return L.slice(0, opt.n).map(x => {
      const w = x.w, ex = (w.examples || []).find(e => Array.isArray(e) && e[0]);
      return { id: w.id, en: clean(w.word), zh: String(w.zh || "").split(/[；;]/)[0].replace(/\(未查到.*\)/, "").trim(), ex: ex ? clean(ex[0]) : "", exzh: ex ? String(ex[1] || "") : "" };
    });
  }

  // ---------- 播放流程 ----------
  async function run() {
    const my = ++tok; playing = true; paint();
    while (playing && my === tok && qi < Q.length) {
      const it = Q[qi];
      if (step === 0) { show(it, false); if (!(await playSrc(srcEn(it.en), opt.rate, my, [it.en, lang()]))) return; step = 1; }
      if (step === 1) { if (!(await playSrc([silence(opt.gap)], 1, my))) return; step = 2; }
      if (step === 2) { show(it, true); if (opt.zh && it.zh) { if (!(await playSrc([gtts(it.zh, "zh-CN")], 1, my, [it.zh, "zh"]))) return; } step = 3; }
      if (step === 3) { if (opt.ex && it.ex) { if (!(await playSrc(srcEn(it.ex), opt.rate, my, [it.ex, lang()]))) return; } step = 4; }
      if (step === 4) { if (!(await playSrc([silence(1)], 1, my))) return; count(); qi++; step = 0; }
    }
    if (my === tok && qi >= Q.length) { playing = false; meta(null); paint("🎉 这一轮听完了：" + Q.length + " 条"); }
  }
  function count() { // 听完一条 = 一张听力卡（「📅 每日」的「听」、统计页）
    try { const d = U.day(), L = LG("pump:log", {}) || {}, r = L[d] = L[d] || {}; r.ls = (+r.ls || 0) + 1; LS("pump:log", L); } catch (e) {}
  }
  function pause() { playing = false; tok++; try { au.pause(); } catch (e) {} paint(); setState("paused"); }
  function play() { if (!Q.length) return; if (qi >= Q.length) { qi = 0; step = 0; } setState("playing"); run(); }
  function jump(d) { const was = playing; tok++; try { au.pause(); } catch (e) {} qi = Math.max(0, Math.min(Q.length - 1, qi + d)); step = 0; if (Q[qi]) show(Q[qi], false); if (was) run(); else paint(); }

  // ---------- 锁屏 / 耳机控制 ----------
  const MS = () => "mediaSession" in navigator ? navigator.mediaSession : null;
  function meta(it) { const m = MS(); if (!m) return; try { m.metadata = it ? new MediaMetadata({ title: it.en, artist: it.zh || "", album: "🎧 通勤模式 · " + (qi + 1) + " / " + Q.length }) : null; } catch (e) {} }
  function setState(s) { const m = MS(); if (m) try { m.playbackState = s; } catch (e) {} }
  function bindMS() { const m = MS(); if (!m) return; const h = (a, f) => { try { m.setActionHandler(a, f); } catch (e) {} }; h("play", play); h("pause", pause); h("nexttrack", () => jump(1)); h("previoustrack", () => jump(-1)); }

  // ---------- 界面 ----------
  function show(it, rev) {
    if (!root || !it) return; meta(it);
    root.querySelector(".w").textContent = it.en; const z = root.querySelector(".zh"); z.textContent = it.zh || ""; z.classList.toggle("hid", !rev);
    root.querySelector(".ex").textContent = rev && opt.ex ? it.ex + (it.exzh ? "（" + it.exzh + "）" : "") : "";
    paint();
  }
  function paint(msg) {
    if (!root) return;
    root.querySelector(".pp").textContent = playing ? "⏸" : "▶";
    root.querySelector(".st").textContent = msg || (Q.length ? "第 " + Math.min(qi + 1, Q.length) + " / " + Q.length + " 条" : opt.only ? "生词本里没有没掌握的词（可以把「只听没掌握的」关掉）" : "生词本还是空的");
    root.querySelector(".bar u").style.width = (Q.length ? Math.round(qi / Q.length * 100) : 0) + "%";
  }
  const sel = (k, vals, lab) => "<label>" + lab + ' <select data-o="' + k + '">' + vals.map(v => '<option value="' + v[0] + '"' + (String(opt[k]) === String(v[0]) ? " selected" : "") + ">" + v[1] + "</option>").join("") + "</select></label>";
  function init() {
    if (root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    root = document.createElement("div"); root.id = "cm"; document.body.append(root);
    au = new Audio(); au.preload = "auto";
    root.innerHTML = '<div class="hd"><b>🎧 通勤模式</b><span class="sp"></span><button class="x" data-a="close" title="关掉">✕</button></div>' +
      '<div class="card"><div class="st"></div><div class="bar"><u></u></div><div class="w">　</div><div class="zh hid"></div><div class="ex"></div></div>' +
      '<div class="ctl"><button data-a="prev" title="上一条">⏮</button><button class="pp" data-a="pp">▶</button><button data-a="next" title="下一条">⏭</button></div>' +
      '<div class="opts">' + sel("n", [[20, "20 条"], [30, "30 条"], [50, "50 条"], [100, "100 条"]], "每轮") + sel("gap", [[2, "2 秒"], [3, "3 秒"], [5, "5 秒"]], "想一想") +
      sel("rate", [[0.8, "0.8×"], [1, "1×"], [1.2, "1.2×"]], "语速") + sel("zh", [["true", "读"], ["false", "不读"]], "中文") + sel("ex", [["true", "读"], ["false", "不读"]], "例句") + sel("only", [["true", "只听没掌握的"], ["false", "全部"]], "范围") + "</div>" +
      '<div class="tip">读英文 → 停几秒你在心里想意思 → 读中文 → 读例句。可以锁屏、切到别的 App，用耳机 / 锁屏上的按钮控制。<br>听完一条算一张听力卡（「📅 每日」的「听」会自动打勾）。</div>';
    root.addEventListener("click", e => {
      const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
      if (a === "close") { pause(); root.classList.remove("on"); document.documentElement.style.overflow = ""; }
      else if (a === "pp") { if (playing) pause(); else play(); }
      else if (a === "next") jump(1); else if (a === "prev") jump(-1);
    });
    root.addEventListener("change", e => {
      const s = e.target.closest("[data-o]"); if (!s) return; const k = s.dataset.o, v = s.value;
      opt[k] = v === "true" ? true : v === "false" ? false : +v; LS("commute:opt", opt);
      if (k === "n" || k === "only") { const was = playing; pause(); Q = build(); qi = 0; step = 0; if (Q[0]) show(Q[0], false); else paint(); if (was) play(); }
    });
    bindMS();
  }
  window.commuteShow = () => {
    init(); if (window.TTS && TTS.load) try { TTS.load(); } catch (e) {}
    root.classList.add("on"); document.documentElement.style.overflow = "hidden";
    if (!playing) { Q = build(); qi = 0; step = 0; if (Q[0]) show(Q[0], false); else paint(); }
  };
  window.COMMUTE = { build, silence }; // 测试用
})();
