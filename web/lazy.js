/* ⚡ 按需加载（window.LAZY）：口语、入门、阅读、听力、练习课、考试、写作、语法这几个大页面，打开网站时先不加载，点进去才加载；
   首页显示好以后（约 2.5 秒、浏览器空闲时）再一个个在后台加载完（离线也能用、换页不用等）
   - 这些页面对外的入口（speakShow、smeShow……）先放一个「替身」：一调用就去加载那个页面，加载好再转给真的；页面加载后会把替身换掉
   - quiet 的入口（speakHide、readingRefresh……）：还没加载就什么都不做（本来就没东西要藏 / 要刷新）
   - 「显示」类入口（el）：那一页的容器还看不见时先不加载，等容器真的显示出来再加载、再显示（标签还没切过来时就被叫到的情况）
   - deps：先要加载的（练习课要用听力的分句、对时间；入门里嵌着口语）
   - 每加载好一个发 document 事件 "lazy-loaded" {name}（「📅 每日」等它们的数据：练习课的今日进度、阅读的新闻）
   - 加载都在网页解析完以后（DOMContentLoaded）才开始，保证它们要用的公用模块（U、TTS、REC、WORD……）都在
   ?v= 由 tools/bump-versions.js 按文件内容自动改；出错记进 U.log("lazy", …) */
(function () {
  "use strict";
  if (window.LAZY) return;
  const MODS = {
    speak: { src: "speak.js?v=ea54186b", fns: ["speakShow"], el: { speakShow: "#view-speak" }, quiet: ["speakHide"] },
    basic: { src: "basic.js?v=6f44a263", deps: ["speak"], fns: ["basicShow"], el: { basicShow: "#view-basic" } },
    read: { src: "read.js?v=53955424", fns: ["readingShow", "readingNews", "readingOpen", "readTextDiff"], el: { readingShow: "#reading" }, quiet: ["readingRefresh"] },
    listen: { src: "listen.js?v=ff2e05be", fns: ["smeShow"], el: { smeShow: "#sme" }, quiet: ["smePause"] },
    drill: { src: "drill.js?v=f24f138e", deps: ["listen"], fns: ["drillShow", "drillReview"], el: { drillShow: "#drill" }, quiet: ["drillHide"] },
    exam: { src: "exam.js?v=c0953f36", fns: ["examShow"], el: { examShow: 0 } },
    write: { src: "write.js?v=0b8cb009", fns: ["writingShow"], el: { writingShow: 0 } },
    commute: { src: "commute.js?v=eeeda1a7", fns: ["commuteShow"] }, // 🎧 通勤模式（「🔊 练习」首页的按钮）
    debasic: { src: "de-basic.js?v=a1a62562", fns: ["deBasicShow"], el: { deBasicShow: "#view-basic" } }, // 🌱 德语入门（学德语时）
    grammar: { src: "grammar.js?v=19e2e8e7", fns: ["grammarShow"], el: { grammarShow: "#grammar" }, quiet: ["grammarRefresh"] },
  };
  const log = (m, d) => { if (window.U) U.log("lazy", m, d); };
  const ready = document.readyState === "loading" ? new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true })) : Promise.resolve();
  const P = {}, OK = new Set();
  // bg：后台预加载（用户没点什么），失败了不弹提示。失败（包括它依赖的页面失败）会把记录删掉，下次再点能重新加载
  function need(name, bg) {
    const m = MODS[name]; if (!m) return Promise.reject(new Error("没有这个页面：" + name));
    if (P[name]) return P[name];
    const t0 = Date.now();
    P[name] = ready.then(() => Promise.all((m.deps || []).map(d => need(d, true)))).then(() => new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = m.src; s.async = false;
      s.onload = () => { OK.add(name); log(name + " 加载好了", { ms: Date.now() - t0 }); try { document.dispatchEvent(new CustomEvent("lazy-loaded", { detail: { name } })); } catch (e) {} res(); };
      s.onerror = () => { s.remove(); log(name + " 加载失败", m.src); rej(new Error("load " + m.src)); };
      document.head.append(s);
    })).catch(e => { delete P[name]; if (!bg && window.U) U.tip("这一页没加载出来（网络不通？），再点一次试试"); throw e; });
    return P[name];
  }
  // 「显示」类入口（el：这一页的容器；数字 = 第几个参数是容器）：容器还看不见时先记下这次调用，等它真的显示出来再加载、再调用
  //   （标签还没切过来、生词本恢复上次的模式、雅思页恢复上次的小标签……都会在看不见的时候先叫一次）
  const WAIT = new Map(); let mo = null;
  const shown = el => !!(el && el.isConnected && el.getClientRects().length);
  function check() { if (!loadedPage) return; WAIT.forEach((w, fn) => { if (!shown(w.el)) return; WAIT.delete(fn); const f = window[fn]; Promise.resolve().then(() => f.apply(w.self, w.a)).catch(e => log(fn + " 出错", String(e && e.message || e))); }); if (!WAIT.size && mo) { mo.disconnect(); mo = null; } }
  // 网页解析完（DOMContentLoaded）就能判断看不看得见：样式表在前面的同步脚本之前就加载好了。以前要等整页 load（字体、配图都到齐），大陆网慢时页面一直空着
  let loadedPage = document.readyState !== "loading";
  ready.then(() => { loadedPage = true; setTimeout(check, 0); });
  function later(fn, el, self, a) { WAIT.set(fn, { el, self, a }); if (loadedPage) setTimeout(check, 50); if (!mo && window.MutationObserver) { mo = new MutationObserver(() => { clearTimeout(mo.t); mo.t = setTimeout(check, 30); }); mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["class", "style"] }); } }
  for (const name in MODS) {
    const m = MODS[name];
    (m.fns || []).forEach(fn => {
      if (window[fn]) return;
      const stub = function () {
        const a = arguments, self = this, sel = m.el && m.el[fn], el = sel == null ? null : typeof sel === "number" ? a[sel] : document.querySelector(sel);
        if (el && (!loadedPage || !shown(el))) { later(fn, el, self, a); return Promise.resolve(); } // 看不见（或网页还没加载完、样式没到齐，看不准）：等它真的显示出来
        WAIT.delete(fn);
        if (!P[name]) log(name + " 开始加载（因为调用了 " + fn + "）");
        return need(name).then(() => { const f = window[fn]; if (!f || f.__lazy) { log(name + " 加载了但没有 " + fn); return; } return f.apply(self, a); }); };
      stub.__lazy = true; window[fn] = stub;
    });
    (m.quiet || []).forEach(fn => { if (window[fn]) return; const stub = function () {}; stub.__lazy = true; window[fn] = stub; });
  }
  // 首页显示好以后，后台把剩下的一个个加载完（空闲时；手机省电模式下 requestIdleCallback 可能很晚，最多等 6 秒）
  function preload() {
    // 学德语时不预加载英语专用的页面（反正藏起来了）；学英语时不预加载德语入门
    const DE = window.VL === "de", EN_ONLY = { speak: 1, basic: 1, read: 1, exam: 1, write: 1, grammar: 1 };
    const left = Object.keys(MODS).filter(n => !P[n] && (DE ? !EN_ONLY[n] : n !== "debasic"));
    const next = () => { const n = left.shift(); if (!n) return; need(n, true).catch(() => {}).then(() => idle(next)); };
    next();
  }
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 6000 }) : setTimeout(f, 200));
  window.addEventListener("load", () => setTimeout(() => idle(preload), 2500));
  window.LAZY = { need, loaded: n => OK.has(n), MODS };
})();
