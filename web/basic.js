/* 英语「🌱 入门」（「🎓 雅思」后面）：刚开始学、基础不牢的人从这里开始。下面四个小标签（index.html 的 SECS.basic）：
   - 🧭 从这开始（本文件画）：按「词 · 听 · 说 · 读 · 写」排好新手先做什么，每张卡点一下直接跳到那个模块
   - 🗣 口语入门：口语页的「🌱 入门」（救命句、自我介绍、新手 7 天计划、AI 教练定计划），speak.js 的 speakShow("start")
   - 🔊 发音：口语页的「🔊 发音」（最小对立词、连读弱读、重音、绕口令、数字），speakShow("pron")
   - 📐 语法：原来在「✍️ 写」下面的「📐 语法」（语法速查、句型、拼写、构词、发音规律、数字日期、美英差异），grammar.js
   这一页只看各模块自己记的数据显示进度（不新存东西）：speak:done、vocab:test、drill:prog、sme:done
   依赖 index.html 的全局：enShow（切标签）；跳到生词本的模式用 .modes 按钮 */
(function () {
  "use strict";
  if (window.basicShow && !window.basicShow.__lazy) return; // __lazy：lazy.js 先放的替身，不算加载过
  const { esc, LG, LS } = U; // 全站共用的小工具（util.js）
  const CSS = `
  #view-basic{display:none;background:var(--ui-bg,var(--bg));color:var(--ui-ink);min-height:100vh;font-family:var(--ui-font)}
  html.show-basic-home #view-en,html.show-basic-home #view-speak{display:none}html.show-basic-home #view-basic{display:block}
  html.show-basic.has-sec #en-secbar{display:flex!important}
  html.show-basic #view-speak,#view-basic{padding-top:150px}
  @media (max-width:1023px){html.show-basic #view-speak,#view-basic{padding-top:calc(150px + var(--sat,0px))}}
  @media (min-width:1024px){html.show-basic #view-speak,#view-basic{padding-top:108px}}
  html.show-basic #view-speak .sk-chips{display:none}
  #view-basic .bs{max-width:960px;margin:0 auto;padding:6px 16px 60px}
  #view-basic h1{font-size:22px;font-weight:900;margin:4px 0 6px}
  #view-basic .lead{color:var(--ui-ink-2);font-size:14.5px;line-height:1.75;margin:0 0 16px}
  #view-basic .step{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:16px;padding:14px 16px;margin:0 0 12px}
  #view-basic .step h2{font-size:16px;margin:0 0 4px;display:flex;align-items:center;gap:8px}
  #view-basic .step h2 .n{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--ui-pur);color:#fff;font-size:13px;flex:0 0 auto}
  #view-basic .step>p{color:var(--ui-muted);font-size:13.5px;line-height:1.6;margin:0 0 10px}
  #view-basic .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
  #view-basic .cd{display:flex;align-items:center;gap:10px;text-align:left;background:var(--ui-surface-2);border:1px solid var(--ui-line);border-radius:12px;padding:10px 12px;color:inherit;font:inherit;cursor:pointer;min-height:56px}
  #view-basic .cd:hover{border-color:var(--ui-pur-line)}
  #view-basic .cd .t{flex:1;min-width:0}#view-basic .cd b{display:block;font-size:14.5px}#view-basic .cd small{display:block;color:var(--ui-muted);font-size:12.5px;line-height:1.5;margin-top:2px}
  #view-basic .cd .ok{flex:0 0 auto;font-size:12px;font-weight:800;color:var(--ui-on-accent);background:var(--ui-green);border-radius:999px;padding:2px 8px}
  #view-basic .cd .go{flex:0 0 auto;color:var(--ui-muted)}`;

  // 跳到别的模块
  const en = (w, sub) => { if (typeof window.enShow === "function") window.enShow(w, sub); window.scrollTo(0, 0); };
  const mode = m => setTimeout(() => { const b = document.querySelector('.modes button[data-mode="' + m + '"]'); if (b && !b.classList.contains("on")) b.click(); }, 0);
  function speakSec(sec) { LS("speak:sec", sec); en("speak"); }
  const GO = {
    vtest: () => { en("notebook"); mode("stats"); setTimeout(() => { const el = document.getElementById("st-vt"); if (el) el.scrollIntoView({ block: "start" }); }, 300); },
    pump: () => { en("notebook"); mode("pump"); },
    rules: () => en("basic", "grammar"),
    rescue: () => en("basic", "speak"),
    pron: () => en("basic", "pron"),
    sdaily: () => speakSec("daily"),
    dialog: () => speakSec("dialog"),
    quick: () => speakSec("quick"),
    ree: () => { LS("sme:s", "ree"); en("listen", "sme"); },
    drill: () => { LS("drill:lvl", 1); try { const o = LG("drill:opt", {}); o.rate = 0.85; LS("drill:opt", o); } catch (e) {} en("listen", "drill"); },
    chan: () => en("listen", "video"),
    news: () => en("read"),
    write: () => en("write"),
    daily: () => en("daily"),
  };
  function stats() {
    const sd = LG("speak:done", {}), vt = (LG("vocab:test", []) || [])[0], dp = LG("drill:prog", {}) || {}, sme = LG("sme:done", {}) || {};
    const n = p => Object.keys(sd).filter(k => k.startsWith(p)).length;
    let lessons = 0; for (const c in dp) for (const id in dp[c] || {}) lessons += Object.keys(dp[c][id] || {}).length;
    return { vt, dlg: n("d:"), pron: n("p:"), lessons, ree: Object.keys(sme).filter(k => /^real-easy-english\//.test(k)).length };
  }
  const card = (go, title, sub, ok) => '<button class="cd" data-go="' + go + '"><span class="t"><b>' + title + "</b><small>" + sub + "</small></span>" + (ok ? '<span class="ok">' + esc(ok) + "</span>" : '<span class="go">›</span>') + "</button>";
  function html() {
    const S = stats();
    const step = (n, t, p, cards) => '<div class="step"><h2><span class="n">' + n + "</span>" + t + "</h2><p>" + p + '</p><div class="cards">' + cards.join("") + "</div></div>";
    return '<div class="bs"><h1>🌱 入门</h1><p class="lead">刚开始学英语，或者觉得基础不牢？不用一下子什么都学，按下面的顺序来：先知道自己大概什么水平，再把<b>救命句、发音、基础语法</b>打好，然后每天用<b>慢速、简单的真人英语</b>练听和说。上面的小标签「🗣 口语入门」「🔊 发音」「📐 语法」就是最基础的三块。</p>' +
      step(1, "先测一下词汇量", "5 分钟，知道自己大概在哪个级别，之后看进步。", [
        card("vtest", "📊 词汇量测试", "认得几个词就点几个，估出大概词汇量和对应的级别", S.vt ? "上次 " + S.vt.size + " 词" : ""),
      ]) +
      step(2, "开口的底气：救命句 + 自我介绍", "听不懂、想不起词时怎么说，先学会这 40 句；再把自我介绍说顺。有新手 7 天计划，也可以让 AI 按你的情况排。", [
        card("rescue", "🗣 口语入门", "🆘 救命句、🙋 自我介绍、🧭 新手 7 天计划、🤖 AI 教练定计划"),
        card("dialog", "🎭 情景对话（从「入门」级开始）", "在 mamak 点餐、问路、打车……听全文 → 跟读 → 角色扮演", S.dlg ? "练过 " + S.dlg + " 个" : ""),
        card("quick", "⚡ 快问快答（入门）", "别人随口一问，你张口就答"),
      ]) +
      step(3, "发音和基础语法", "发音不准会听不懂、别人也听不懂你；语法只要先会最常用的那些。", [
        card("pron", "🔊 发音", "最小对立词（ship / sheep）听音辨词、连读弱读、重音、数字", S.pron ? "练过 " + S.pron + " 组" : ""),
        card("rules", "📐 语法", "语法速查、常用句型、拼写、构词、数字和日期、美英差异"),
      ]) +
      step(4, "每天听：慢速、简单的真人英语", "听得懂一大半的材料才有用。先从慢速对话开始，练习课选「简单」。", [
        card("ree", "🐢 慢速对话（BBC Real Easy English）", "两位主持人用简单英语慢慢聊日常话题，有生词表、文稿和中文", S.ree ? "听过 " + S.ree + " 期" : ""),
        card("drill", "🧩 练习课 · 简单难度", "一期拆成小节：跟读、听音选句、排词成句；点进去自动设成「简单」、0.85 倍速", S.lessons ? "做过 " + S.lessons + " 节" : ""),
        card("chan", "📺 YouTube 频道通关地图", "在「🎬 视频」首页，从「0基础」那一档的频道看起"),
      ]) +
      step(5, "每天一点点：背词、读、写", "词在用的时候记得最牢：读到、听到不认识的随手收进生词本，每天练一会儿。", [
        card("pump", "🔤 背单词（🔊 练习）", "生词本里的词，一张一张卡听、认、拼"),
        card("news", "📰 读：今日新闻点「✨ 简单版」", "难的文章一键改写成简单英语，还有小测"),
        card("write", "✍️ 写：用新词造句、写一小段", "AI 帮你改，告诉你哪里错了"),
        card("daily", "📅 每日一练", "每天自动排好「词 · 听 · 说 · 读 · 写」，做完打勾，看连续天数"),
      ]) + "</div>";
  }
  let root = null;
  function init() {
    if (root) return; root = document.getElementById("view-basic"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    root.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b && GO[b.dataset.go]) GO[b.dataset.go](); });
  }
  window.basicShow = () => { init(); if (root) root.innerHTML = html(); };
  window.BASIC = { GO }; // 测试用
  const boot = () => { init(); if (document.documentElement.classList.contains("show-basic-home")) window.basicShow(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
