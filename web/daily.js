/* 📅 每日一练（英语 → 第一个标签）：把每天该做的「词 · 听 · 说 · 读 · 写」排成一张清单，点「去练」直接跳到那个模块，做完自动打勾
   - 自动打勾用各模块自己记的数据：
       🔤 背单词：pump:log[今天].n（练习每做一张卡 +1）≥ 目标张数；有难词时多一个「🔥 只练难词」
       🎧 听：「🧩 练习课」今天做完一节或复习 5 句（window.drillToday），或「📻 听力节目」今天听完一期（sme:done），或练习里 10 张听力 / 听写卡（pump:log[今天].ls），或口语原声跟读一条（speak:done 的 v:）
       🗣 说：口语「📅 每日一练」今天打卡（speak:days[今天]）
       📖 读：今天打开过一篇文章（reading:docs 的 at）；「去练」直接打开「📰 今日新闻」
       ✍️ 写：今天批改过一篇（writing:history 的 at），或者在这里用 3 个词各造一句、交给 AI 看过（daily:sent）
   - 🎓 考试目标：设雅思日期和目标分，顶部倒计时，按剩下的天数建议每天单词张数
   - 📊 本周小结：最近 7 天每样练了几天、卡片数和正确率（比上周多还是少）、写作分数、最难的词、下周建议；周日、周一自动展开一次
   - 本机存 daily:opt（开哪几项、单词目标、考试日期和目标分）、daily:check（手动打勾）、daily:days（每天完成几项 / 共几项）、daily:sent（造句）；
     opt、check、days 同步到后台 /api/mine k=daily（换设备也在，记在 daily:sat 每项的修改时间；days 两边取完成得多的）
   - 最上面是 🔋 AI 额度面板（quota.js：今天还剩多少 neurons、每个模型用了多少、最近 7 天、剩下的还能做几次）
   - 去练了某项之后，页面左下角有「📅 每日一练 2/5」小按钮，点一下回来 */
(function () {
  "use strict";
  const { LG, LS, esc, tip } = U; // 全站共用的小工具（util.js）
  // 📅 日期：全站共用的 U.day（util.js，吉隆坡 / 北京时间）；以前这里按手机时区、口语按北京时间，两种混着用
  const lday = t => U.day(t), kday = lday, ago = U.dayAgo;
  const isToday = t => !!t && lday(+t) === lday();
  const $ = id => document.getElementById(id);
  const arr = v => (Array.isArray(v) ? v : []);

  const DEF = { word: 20, on: { word: 1, listen: 1, speak: 1, read: 1, write: 1 } };
  const opt = () => { const o = LG("daily:opt", {}); return { word: +o.word || DEF.word, on: Object.assign({}, DEF.on, o.on || {}), exam: /^\d{4}-\d{2}-\d{2}$/.test(o.exam || "") ? o.exam : "", band: +o.band || 0 }; };
  function setOpt(f) { const o = LG("daily:opt", {}); f(o); LS("daily:opt", o); put("opt", o); }

  // ---------- 换设备同步：/api/mine k=daily，items：opt、chk:日期、day:日期 ----------
  const CL = CLOUD.chan("daily"); // 全站共用的同步（cloud.js）
  function put(key, v) { const S = LG("daily:sat", {}), at = Math.max(Date.now(), (+S[key] || 0) + 1); S[key] = at; LS("daily:sat", S); CL.put(key, v, at); }
  function pull() {
    CL.pull().then(items => {
      if (!items) return; const j = { items }, S = LG("daily:sat", {}), C = LG("daily:check", {}), D = LG("daily:days", {}); let ch = false;
      for (const k in j.items || {}) {
        const x = j.items[k]; if (!x || x.del) continue;
        if (k.startsWith("day:")) { const d = k.slice(4), a = D[d], b = arr(x.v); if (b.length === 2 && (!a || b[0] / (b[1] || 1) > a[0] / (a[1] || 1))) { D[d] = b; ch = true; } continue; } // 每天完成几项：两边取完成得多的
        if (+x.at <= (+S[k] || 0)) continue; S[k] = +x.at; ch = true;
        if (k === "opt" && x.v && typeof x.v === "object") LS("daily:opt", x.v);
        else if (k.startsWith("chk:")) C[k.slice(4)] = x.v || {};
      }
      if (ch) { LS("daily:sat", S); LS("daily:check", C); LS("daily:days", D); if (root && document.documentElement.classList.contains("show-daily")) draw(); }
    });
  }

  // ⚡ 练习课（今日进度）、阅读（今天的新闻）是按需加载的（lazy.js）：加载好了，「每日」开着就重画一次
  document.addEventListener("lazy-loaded", e => { const n = e.detail && e.detail.name; if ((n === "drill" || n === "read") && root && document.documentElement.classList.contains("show-daily")) draw(); });

  // ---------- 跳到各模块 ----------
  const click = el => { if (el) el.click(); };
  // 英语七个标签（index.html 的 window.enShow(标签, 小标签)）；没有 enShow 的旧页面退回点按钮
  const en = (w, sub) => { if (typeof window.enShow !== "function") return false; window.enShow(w, sub); return true; };
  const mode = m => setTimeout(() => { const b = document.querySelector('.modes button[data-mode="' + m + '"]'); if (b && !b.classList.contains("on")) b.click(); }, 0);
  function toNotebook(m) { if (!en("notebook")) { click($("l1-en")); click($("tab-notebook")); } mode(m); }
  function toHard() { toNotebook("pump"); setTimeout(() => { if (!(window.pumpStartHard && window.pumpStartHard())) tip("先打开练习页再点「只练难词」"); }, 200); }
  function toListen() { if (!en("listen", "sme")) toSpeak("clip"); }
  function toSpeak(sec) {
    try { localStorage.setItem("speak:sec", JSON.stringify(sec)); } catch (e) {}
    if (!en("speak")) { click($("l1-en")); click($("tab-speak")); }
    let n = 0; const t = setInterval(() => { const b = document.querySelector('#view-speak [data-sec="' + sec + '"]'); if (b) { if (!b.classList.contains("on")) b.click(); clearInterval(t); } else if (++n > 30) clearInterval(t); }, 100);
  }
  function toNews() { if (!en("read")) toNotebook("reading"); setTimeout(() => { if (window.readingNews) window.readingNews(); }, 60); }
  function toWrite() { if (!en("write", "writing")) { click($("l1-en")); click($("tab-ielts")); setTimeout(() => click($("ielts-t-write")), 0); } }

  // ---------- ✏️ 用新词造句（「写」的轻量版）：按日期从难词、在学的词里挑 3 个，各写一句，AI（/api/ai task useword）判对错 ----------
  const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function sentWords() {
    const all = (typeof words !== "undefined" && Array.isArray(words) ? words : []).filter(w => w && w.word && /^[A-Za-z][A-Za-z' -]*$/.test(w.word) && (w.type || "word") !== "pattern" && (w.type || "word") !== "sentence");
    const hard = (window.pumpHard ? window.pumpHard() : []).map(h => all.find(w => w.id === h.id)).filter(Boolean);
    const lrn = all.filter(w => w.status !== "known" && !hard.includes(w)), h0 = hashOf(lday());
    const pickN = (L, n) => L.slice().sort((a, b) => hashOf(lday() + a.id) - hashOf(lday() + b.id)).slice(0, n);
    const out = pickN(hard, 2).concat(pickN(lrn.length ? lrn : all, 3)).slice(0, 3); void h0;
    return out.map(w => ({ id: w.id, word: w.word, zh: String(w.zh || "").replace(/\(.*?中…\)/, "").slice(0, 40) }));
  }
  const sentDay = () => (LG("daily:sent", {})[lday()]) || {};
  function sentSave(word, rec) { const A = LG("daily:sent", {}), k = lday(); A[k] = A[k] || {}; A[k][word] = rec; for (const d in A) if (d < ago(k, 14)) delete A[d]; LS("daily:sent", A); }
  let sentOpen = false, sentBusy = {};
  async function sentCheck(w, text) {
    text = String(text || "").trim(); if (!text) { tip("先写一句"); return; }
    if (!new RegExp("\\b" + w.word.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 5), "i").test(text)) { tip("句子里要用上「" + w.word + "」"); return; }
    sentBusy[w.word] = 1; draw();
    const j = await AI.ask("useword", { word: w.word, zh: w.zh, text });
    delete sentBusy[w.word];
    sentSave(w.word, { t: text, r: j && j.ok ? { correct: !!j.correct, fixed: j.fixed || "", why_zh: j.why_zh || "", better: j.better || "", better_zh: j.better_zh || "" } : null, at: Date.now() });
    if (!j.ok) tip(AI.msg(j, "AI 没回应") + "，句子先记下了");
    draw();
  }
  function sentHtml() {
    const W = sentWords(), S = sentDay();
    if (!W.length) return '<div class="dy-sent"><div class="s">生词本里还没有可以造句的词。</div></div>';
    return '<div class="dy-sent">' + W.map((w, i) => { const x = S[w.word], r = x && x.r;
      return '<div class="row1"><b data-to="word:' + esc(w.word) + '" title="查这个词">' + esc(w.word) + "</b><small>" + esc(w.zh) + "</small>" +
        (x ? '<div class="mine">' + esc(x.t) + "</div>" + (r ? '<div class="' + (r.correct ? "good" : "bad") + '">' + (r.correct ? "✅ 用对了" : "✏️ 改一下：" + esc(r.fixed)) + (r.why_zh ? "<br><small>" + esc(r.why_zh) + "</small>" : "") + (r.better ? '<br><small>更地道：' + esc(r.better) + (r.better_zh ? "（" + esc(r.better_zh) + "）" : "") + "</small>" : "") + "</div>" : '<div class="s">（AI 没看到，算你写过了）</div>') + '<button class="dy-chk" data-sredo="' + i + '">重写</button>'
          : '<div class="in"><input data-sin="' + i + '" placeholder="用 ' + esc(w.word) + ' 造一个句子" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="ui-btn" data-scheck="' + i + '"' + (sentBusy[w.word] ? " disabled" : "") + ">" + (sentBusy[w.word] ? "检查中…" : "检查") + "</button></div>") + "</div>"; }).join("") + "</div>";
  }

  // ---------- 今天的任务 ----------
  function tasks() {
    const o = opt(), today = lday();
    const plog = (LG("pump:log", {})[today] || {}), pn = +plog.n || 0, ls = +plog.ls || 0;
    const sdone = LG("speak:done", {}), vToday = Object.keys(sdone).filter(k => /^v:/.test(k) && isToday(sdone[k])).length;
    const sme = LG("sme:done", {}), smeT = Object.keys(sme).filter(k => isToday(sme[k])).length;
    const sday = !!LG("speak:days", {})[kday()], slog = +(LG("speak:log", {})[kday()] || 0);
    const rd = arr(LG("reading:docs", [])).filter(d => isToday(d.at));
    const wr = arr(LG("writing:history", [])).filter(h => isToday(h.at));
    const sn = Object.keys(sentDay()).length, man = (LG("daily:check", {})[today]) || {};
    const hard = window.pumpHard ? window.pumpHard().length : 0;
    let dr = { n: 0, rv: 0, due: 0 }; try { if (window.drillToday) dr = window.drillToday(); } catch (e) {} // 🧩 练习课（drill.js）：今天做完几节、复习几句、还有几句该复习
    const L = [
      { id: "word", ic: "🔤", t: "背单词", sub: "在「📖 词汇 → 🔊 练习」里复习、学新词，做满 " + o.word + " 张卡" + (hard ? "；还有 " + hard + " 个老忘的难词，可以单独练" : ""), prog: Math.min(pn, o.word) + " / " + o.word + " 张", pct: pn / o.word, auto: pn >= o.word, min: Math.round(o.word / 2), extra: hard ? '<button class="dy-chk" data-hard="1">🔥 只练难词（' + hard + "）</button>" : "" },
      { id: "listen", ic: "🎧", t: "听", sub: "「🎧 听 → 🧩 练习课」做一节（或者把做错的复习 5 句）；或者「📻 听力节目」听一期（有文稿、生词和中文对照）；或者听力练习做 10 张听力 / 听写卡", prog: [dr.n ? "练习课 " + dr.n + " 节" : "", dr.rv ? "复习 " + dr.rv + " 句" : "", smeT ? "听力节目 " + smeT + " 期" : "", ls ? "听力卡 " + Math.min(ls, 10) + " / 10" : "", vToday ? "原声 " + vToday + " 条" : ""].filter(Boolean).join(" · "), pct: smeT || vToday || dr.n || dr.rv >= 5 ? 1 : Math.max(ls / 10, dr.rv / 5), auto: smeT > 0 || vToday > 0 || ls >= 10 || dr.n > 0 || dr.rv >= 5, min: 8, extra: dr.due ? '<button class="dy-chk" data-drillrv="1">📅 复习做错的 ' + dr.due + " 句</button>" : "" },
      { id: "speak", ic: "🗣", t: "说", sub: "「🗣 说 → 📅 每日一练」：1 段情景对话 + 跟读 5 句 + 说 1 个话题", prog: sday ? "今天已打卡" : slog ? "今天练了 " + slog + " 次，还没打卡" : "", pct: sday ? 1 : Math.min(.9, slog / 7), auto: sday, min: 15 },
      { id: "read", ic: "📖", t: "读", sub: "读「📰 今日新闻」（觉得难就点「✨ 简单版 + 小测」），或者阅读里任意一篇；点不认识的词查意思、收进生词本", prog: rd.length ? "今天读了：" + rd.map(d => d.title).slice(0, 2).join("、") : "", pct: rd.length ? 1 : 0, auto: rd.length > 0, min: 10 },
      { id: "write", ic: "✍️", t: "写", sub: "在「✍️ 写 → 📝 写作批改」写一段交给它批改；时间不够就用下面 3 个词各造一句（AI 帮你看对不对）", prog: [wr.length ? "今天批改了 " + wr.length + " 篇" : "", sn ? "造句 " + Math.min(sn, 3) + " / 3" : ""].filter(Boolean).join(" · "), pct: wr.length ? 1 : sn / 3, auto: wr.length > 0 || sn >= 3, min: 10, extra: '<button class="dy-chk' + (sentOpen ? " on" : "") + '" data-sent="1">✏️ 用新词造 3 句</button>', more: sentOpen ? sentHtml() : "" },
    ].filter(x => o.on[x.id]);
    L.forEach(x => { x.man = !!man[x.id]; x.ok = x.auto || x.man; });
    return L;
  }

  // 每天完成情况：{日期: [完成几项, 共几项]}；连续天数 = 从今天（今天没做完就从昨天）往前数，全部做完的天
  function record(L) {
    const D = LG("daily:days", {}), k = lday(), v = [L.filter(x => x.ok).length, L.length];
    if (!D[k] || D[k][0] !== v[0] || D[k][1] !== v[1]) { const was = full(D[k]); D[k] = v; LS("daily:days", D); put("day:" + k, v); if (!was && full(v)) tip("🎉 今天的每日一练全部完成！"); }
    return D;
  }
  const full = x => !!(x && x[1] && x[0] >= x[1]);
  const streak = D => U.streak(k => full(D[k]));

  // ---------- 🎓 考试目标 ----------
  const daysTo = d => U.daysBetween(lday(), d);
  const suggestWord = left => (left <= 30 ? 50 : left <= 90 ? 30 : 20);

  // ---------- 📊 本周小结（最近 7 天，和前 7 天比） ----------
  function week() {
    const t = lday(), days = Array.from({ length: 7 }, (_, i) => ago(t, i)), prev = Array.from({ length: 7 }, (_, i) => ago(t, i + 7));
    const P = LG("pump:log", {}), SP = LG("speak:log", {}), SME = LG("sme:done", {}), DOC = arr(LG("reading:docs", [])), WR = arr(LG("writing:history", [])), DD = LG("daily:days", {});
    const sum = (D, f) => D.reduce((a, d) => a + (+((P[d] || {})[f]) || 0), 0);
    const cards = sum(days, "n"), cardsP = sum(prev, "n"), ok = sum(days, "ok"), fail = sum(days, "fail"), nw = sum(days, "nw"), sec = sum(days, "sec");
    const inWk = t0 => t0 && days.includes(lday(+t0));
    const kd = d => SP[d] || SP[kday(Date.parse(d + "T12:00:00"))];
    const area = {
      词: days.filter(d => (+((P[d] || {}).n) || 0) > 0).length,
      听: days.filter(d => (+((P[d] || {}).ls) || 0) > 0 || Object.values(SME).some(x => lday(+x) === d)).length,
      说: days.filter(d => +kd(d) > 0).length,
      读: days.filter(d => DOC.some(x => x.at && lday(+x.at) === d)).length,
      写: days.filter(d => WR.some(x => x.at && lday(+x.at) === d) || Object.keys(LG("daily:sent", {})[d] || {}).length).length,
    };
    const wr = WR.filter(x => inWk(x.at)), bands = wr.map(x => x.ai && x.ai.band && +x.ai.band.overall).filter(x => x > 0);
    const smeN = Object.values(SME).filter(inWk).length, docsN = DOC.filter(x => inWk(x.at)).length;
    const full7 = days.filter(d => full(DD[d])).length, act = days.filter(d => (+((P[d] || {}).n) || 0) > 0 || +kd(d) > 0 || DOC.some(x => x.at && lday(+x.at) === d) || WR.some(x => x.at && lday(+x.at) === d)).length;
    const hard = (window.pumpHard ? window.pumpHard() : []).slice(0, 8);
    const weak = Object.keys(area).filter(k => opt().on[{ 词: "word", 听: "listen", 说: "speak", 读: "read", 写: "write" }[k]]).sort((a, b) => area[a] - area[b]);
    return { cards, cardsP, ok, fail, nw, mins: Math.round(sec / 60), area, wr: wr.length, band: bands.length ? Math.max(...bands) : 0, smeN, docsN, full7, act, hard, weak, from: days[6], to: days[0] };
  }
  function weekHtml() {
    const w = week(), acc = w.ok + w.fail ? Math.round(w.ok / (w.ok + w.fail) * 100) : 0, diff = w.cards - w.cardsP;
    const md = d => +d.slice(5, 7) + "月" + +d.slice(8) + "日";
    const tip1 = w.act === 0 ? "这周还没开始，今天先做一项也好。" : w.weak.length && w.area[w.weak[0]] <= 3 ? "下周多安排「" + w.weak[0] + "」：这周只练了 " + w.area[w.weak[0]] + " 天。" : w.full7 >= 5 ? "这周很稳，下周可以把单词目标提高一档。" : "保持住，争取每天把清单做完。";
    return '<div class="dy-wkbox"><div class="h"><b>📊 本周小结</b><small>' + md(w.from) + " – " + md(w.to) + '</small><span style="flex:1"></span><button class="dy-chk" data-act="wk">收起</button></div>' +
      '<div class="nums"><div data-to="notebook/stats" title="看热力日历"><b>' + w.act + '</b><span>天有练习</span></div><div data-to="notebook/stats" title="看热力日历"><b>' + w.full7 + '</b><span>天全勤</span></div><div data-to="notebook/stats" title="看统计"><b>' + w.cards + '</b><span>张卡片 <em class="' + (diff >= 0 ? "up" : "dn") + '">' + (w.cardsP || diff ? (diff >= 0 ? "↑" : "↓") + Math.abs(diff) : "") + "</em></span></div><div><b>" + (acc ? acc + "%" : "—") + "</b><span>记得率</span></div><div><b>" + w.nw + "</b><span>个新词</span></div><div><b>" + w.mins + "</b><span>分钟背词</span></div></div>" +
      '<div class="areas">' + Object.keys(w.area).map(k => '<span' + (AREA_TO[k] ? ' data-to="' + AREA_TO[k] + '" title="去练「' + k + '」"' : "") + "><b>" + k + "</b> " + w.area[k] + " 天</span>").join("") + "</div>" +
      '<div class="more">' + ['<span data-to="read">读了 ' + w.docsN + " 篇文章</span>", '<span data-to="listen/sme">听了 ' + w.smeN + " 期听力节目</span>", '<span data-to="write">批改了 ' + w.wr + " 篇作文" + (w.band ? "（最高 " + w.band + " 分）" : "") + "</span>"].join(" · ") + "</div>" +
      (w.hard.length ? '<div class="more">🔥 最难的词：' + w.hard.map(h => '<b data-to="word:' + esc(h.word) + '" title="查这个词">' + esc(h.word) + "</b>" + (h.f ? "（忘了 " + h.f + " 次）" : "")).join("、") + "</div>" : "") +
      '<div class="adv">💡 ' + esc(tip1) + "</div></div>";
  }
  const AREA_TO = { 词: "notebook/pump", 听: "listen/sme", 说: "speak", 读: "read", 写: "write" }; // 本周小结「词 / 听 / 说 / 读 / 写 N 天」点了去练
  function weekBrief() { // 收起时：一行简略的（几天有练习、几天全勤、卡片数和正确率），点「展开」看全部
    const w = week(), acc = w.ok + w.fail ? Math.round(w.ok / (w.ok + w.fail) * 100) : 0, diff = w.cards - w.cardsP;
    const md = d => +d.slice(5, 7) + "/" + +d.slice(8);
    return '<div class="dy-wkbox sm"><div class="h"><b>📊 本周小结</b><small>' + md(w.from) + "–" + md(w.to) + '</small><span class="brief" data-act="wk" title="展开看全部" style="cursor:pointer">练了 <b>' + w.act + "</b> 天 · 全勤 <b>" + w.full7 + "</b> 天 · <b>" + w.cards + "</b> 张卡" +
      (w.cardsP || diff ? '<em class="' + (diff >= 0 ? "up" : "dn") + '">' + (diff >= 0 ? "↑" : "↓") + Math.abs(diff) + "</em>" : "") + (w.ok + w.fail ? " · 正确率 <b>" + acc + "%</b>" : "") +
      '</span><span style="flex:1"></span><button class="dy-chk" data-act="wk">展开 ▾</button></div></div>';
  }
  const wkKey = () => { const d = new Date(lday() + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return lday(d.getTime()); }; // 这周一
  let showWk = null;

  // ---------- 页面 ----------
  const CSS = `
  html.show-daily #view-en{display:none}html.show-daily #view-daily{display:block}#view-daily{display:none}
  .dy{max-width:860px;margin:0 auto;padding:calc(110px + env(safe-area-inset-top,0px)) 16px 90px;color:var(--ui-ink);font-family:var(--ui-font)}
  @media(min-width:1024px){.dy{padding-top:84px}}
  .dy-hd{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 10px;margin:6px 0 14px}.dy-hd h1{margin:0;font-size:26px;font-weight:900}.dy-hd p{margin:0;color:var(--ui-muted);font-size:13.5px;flex:1 1 240px}
  .dy-top{display:grid;grid-template-columns:auto 1fr auto;gap:14px 18px;align-items:center;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:16px;padding:14px 16px;margin-bottom:14px}
  .dy-ring{--p:0;width:74px;height:74px;border-radius:50%;background:conic-gradient(var(--ui-pur) calc(var(--p)*1%),var(--ui-surface-3,#3a3d43) 0);display:grid;place-items:center}
  .dy-ring>div{width:58px;height:58px;border-radius:50%;background:var(--ui-surface);display:grid;place-items:center;text-align:center;line-height:1.1}.dy-ring b{font-size:19px;font-weight:900}.dy-ring span{display:block;font-size:11px;color:var(--ui-muted)}
  .dy-meta b{font-size:16px}.dy-meta div{color:var(--ui-muted);font-size:13px;margin-top:4px}.dy-meta .ex{color:var(--ui-pur-text);font-weight:700}
  .dy-wk{display:flex;gap:5px}.dy-wk i{display:flex;flex-direction:column;align-items:center;gap:3px;font-style:normal;font-size:11px;color:var(--ui-muted)}
  .dy-wk u{width:18px;height:18px;border-radius:5px;background:var(--ui-surface-3,#3a3d43);display:block}.dy-wk u.h{background:var(--ui-pur);opacity:.45}.dy-wk u.f{background:var(--ui-pur)}.dy-wk i.td em{color:var(--ui-ink);font-weight:800}.dy-wk em{font-style:normal}
  .dy-go{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .dy-list{display:flex;flex-direction:column;gap:10px}
  .dy-it{display:grid;grid-template-columns:44px 1fr auto;gap:4px 12px;align-items:center;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px}
  .dy-it.ok{border-color:color-mix(in srgb,var(--ui-green,#3fb37f) 55%,transparent)}
  .dy-ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;background:var(--ui-surface-2)}.dy-it.ok .dy-ic{background:color-mix(in srgb,var(--ui-green,#3fb37f) 22%,transparent)}
  .dy-t b{font-size:16px}.dy-t small{margin-left:8px;color:var(--ui-muted);font-size:12px}.dy-t .s{color:var(--ui-ink-2);font-size:13.5px;line-height:1.5;margin-top:2px}
  .dy-t .p{font-size:12.5px;color:var(--ui-pur-text);margin-top:4px}.dy-bar{height:4px;border-radius:3px;background:var(--ui-surface-3,#3a3d43);margin-top:6px;overflow:hidden}.dy-bar u{display:block;height:100%;background:var(--ui-pur)}
  .dy-t .x{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
  .dy-btns{display:flex;flex-direction:column;gap:6px;align-items:stretch}
  .dy-chk{border:1px solid var(--ui-line-2);background:transparent;color:var(--ui-muted);border-radius:10px;font:inherit;font-size:12.5px;padding:5px 8px;cursor:pointer}.dy-chk.on{color:var(--ui-green,#3fb37f);border-color:currentColor}
  .dy-more{grid-column:1/-1}
  .dy-sent{display:flex;flex-direction:column;gap:10px;margin-top:6px;border-top:1px solid var(--ui-line);padding-top:10px}.dy-sent .row1 b{font-size:15px}.dy-sent .row1>small{margin-left:8px;color:var(--ui-muted)}
  .dy-sent .in{display:flex;gap:6px;margin-top:5px}.dy-sent input{flex:1;min-width:0;height:38px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 10px;font:inherit;font-size:14.5px}
  .dy-sent .mine{margin-top:4px;font-size:14.5px}.dy-sent .good{color:var(--ui-green,#3fb37f);font-size:13.5px;margin:3px 0}.dy-sent .bad{color:var(--ui-orange);font-size:13.5px;margin:3px 0}.dy-sent .good small,.dy-sent .bad small{color:var(--ui-ink-2)}.dy-sent .s{color:var(--ui-muted);font-size:13px}
  .dy-note{color:var(--ui-muted);font-size:12.5px;line-height:1.6;margin-top:14px}
  .dy-set{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;margin-bottom:14px;display:none;font-size:14px}.dy-set.on{display:block}
  .dy-set label{display:inline-flex;align-items:center;gap:5px;margin:4px 14px 4px 0;cursor:pointer}.dy-set .row{margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .dy-set input[type=date]{height:36px;border-radius:9px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 8px;font:inherit;color-scheme:dark}
  .dy-wkbox{background:linear-gradient(135deg,color-mix(in srgb,var(--ui-pur) 14%,var(--ui-surface)),var(--ui-surface));border:1px solid color-mix(in srgb,var(--ui-pur) 40%,var(--ui-line));border-radius:16px;padding:14px 16px;margin-bottom:14px}
  .dy-wkbox.sm{padding:10px 14px}.dy-wkbox .h{flex-wrap:wrap}.dy-wkbox .brief{font-size:13.5px;color:var(--ui-ink-2)}.dy-wkbox .brief b{color:var(--ui-ink)}.dy-wkbox .brief em{font-style:normal;font-weight:700;margin-left:3px}.dy-wkbox .brief em.up{color:var(--ui-green,#3fb37f)}.dy-wkbox .brief em.dn{color:var(--ui-orange)}
  .dy-wkbox .h{display:flex;align-items:center;gap:8px}.dy-wkbox .h b{font-size:17px}.dy-wkbox .h small{color:var(--ui-muted)}
  .dy-wkbox .nums{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:10px 0}.dy-wkbox .nums b{display:block;font-size:20px;font-weight:900}.dy-wkbox .nums span{font-size:12px;color:var(--ui-muted)}.dy-wkbox em{font-style:normal;font-weight:700}.dy-wkbox em.up{color:var(--ui-green,#3fb37f)}.dy-wkbox em.dn{color:var(--ui-orange)}
  .dy-wkbox .areas{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13.5px;color:var(--ui-ink-2)}.dy-wkbox .more{font-size:13.5px;color:var(--ui-ink-2);margin-top:6px;line-height:1.6}.dy-wkbox .adv{margin-top:8px;font-size:14px}
  #dy-back{position:fixed;left:14px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:8950;display:none;border:1px solid var(--ui-line-2);border-radius:999px;height:40px;padding:0 14px;background:var(--ui-surface);color:var(--ui-ink);font:inherit;font-size:13.5px;font-weight:700;box-shadow:var(--ui-shadow);cursor:pointer}
  #dy-back.on{display:block}html.show-daily #dy-back,html.collect-mode #dy-back{display:none}
  @media(max-width:640px){.dy-hd h1{font-size:22px}.dy-top{grid-template-columns:auto 1fr}.dy-wk{grid-column:1/-1;justify-content:space-between}.dy-it{grid-template-columns:40px 1fr}.dy-ic{width:40px;height:40px}.dy-btns{grid-column:1/-1;flex-direction:row}.dy-btns .ui-btn{flex:1}.dy-wkbox .nums{grid-template-columns:repeat(3,1fr)}}`;

  let root = null, back = null, showSet = false, went = false;
  function draw() {
    if (!root) return;
    const L = tasks(), D = record(L), n = L.filter(x => x.ok).length, st = streak(D), next = L.find(x => !x.ok), o = opt();
    const left = L.filter(x => !x.ok).reduce((a, x) => a + x.min, 0);
    const WD = "日一二三四五六", wk = Array.from({ length: 7 }, (_, i) => ago(lday(), 6 - i));
    const exL = o.exam ? daysTo(o.exam) : null, sug = exL != null && exL >= 0 ? suggestWord(exL) : 0;
    if (showWk === null) { const dw = new Date().getDay(); showWk = (dw === 0 || dw === 1) && LG("daily:wkseen", "") !== wkKey(); }
    const set = '<div class="dy-set' + (showSet ? " on" : "") + '"><b>每天练哪几项</b><div class="row">' +
      [["word", "🔤 背单词"], ["listen", "🎧 听"], ["speak", "🗣 说"], ["read", "📖 读"], ["write", "✍️ 写"]].map(([k, t]) => '<label><input type="checkbox" data-on="' + k + '"' + (o.on[k] ? " checked" : "") + ">" + t + "</label>").join("") +
      '</div><div class="row">单词每天 ' + [10, 20, 30, 50].map(v => '<button class="ui-btn' + (o.word === v ? " pri" : "") + '" data-word="' + v + '">' + v + " 张</button>").join("") + "</div>" +
      '<div class="row" style="margin-top:14px"><b>🎓 雅思考试</b> 日期 <input type="date" data-exam value="' + esc(o.exam) + '"> 目标 ' + [5.5, 6, 6.5, 7, 7.5].map(v => '<button class="ui-btn' + (o.band === v ? " pri" : "") + '" data-band="' + v + '">' + v + "</button>").join("") + (o.exam ? ' <button class="dy-chk" data-exam-clear="1">不设了</button>' : "") + "</div>" +
      (sug && sug !== o.word ? '<div class="row" style="color:var(--ui-muted);font-size:13px">离考试还有 ' + exL + " 天，建议单词每天 " + sug + ' 张 <button class="ui-btn" data-word="' + sug + '">用建议值</button></div>' : "") + "</div>";
    const exTxt = o.exam ? (exL > 0 ? '<span class="ex">🎓 离雅思还有 ' + exL + " 天" + (o.band ? "（目标 " + o.band + "）" : "") + "</span> · " : exL === 0 ? '<span class="ex">🎓 今天考试，加油！</span> · ' : "") : "";
    root.innerHTML = '<div class="dy">' +
      '<div id="dy-quota">' + (window.quotaHtml ? window.quotaHtml() : "") + "</div>" + // 🔋 AI 额度（quota.js）
      '<div class="dy-hd"><h1>📅 每日一练</h1><p>每天按顺序做完这几项：词 → 听 → 说 → 读 → 写。点「去练」直接跳过去，做完回来会自动打勾。</p><button class="ui-btn" data-act="wk">📊 本周小结</button><button class="ui-btn" data-act="set">⚙ 设置</button></div>' + set +
      (showWk ? weekHtml() : weekBrief()) +
      '<div class="dy-top"><div class="dy-ring" style="--p:' + (L.length ? Math.round(n / L.length * 100) : 0) + '"><div><div><b>' + n + "/" + L.length + '</b><span>今天</span></div></div></div>' +
      '<div class="dy-meta"><b>' + (!L.length ? "在 ⚙ 设置里选几项开始" : n >= L.length ? "🎉 今天全部完成" : "还剩 " + (L.length - n) + " 项，约 " + left + " 分钟") + "</b><div>" + exTxt + '<span data-to="notebook/stats" title="看热力日历和统计">🔥 连续全勤 ' + st + " 天" + (Object.keys(D).length ? " · 共练了 " + Object.keys(D).filter(k => D[k][0] > 0).length + " 天" : "") + "</span>" + (!o.exam ? ' · <a href="javascript:void 0" data-act="set" style="color:var(--ui-muted)">设考试日期</a>' : "") + "</div></div>" +
      '<div class="dy-wk">' + wk.map(d => { const x = D[d]; return '<i class="' + (d === lday() ? "td" : "") + '" title="' + d + (x ? "：" + x[0] + " / " + x[1] : "") + '"><u class="' + (full(x) ? "f" : x && x[0] ? "h" : "") + '"></u><em>' + WD[new Date(d + "T12:00:00").getDay()] + "</em></i>"; }).join("") + "</div>" +
      (next ? '<div class="dy-go"><button class="ui-btn pri" data-go="' + next.id + '">▶ ' + (n ? "继续" : "开始") + "：" + next.ic + " " + next.t + "</button></div>" : "") + "</div>" +
      '<div class="dy-list">' + L.map(x => '<div class="dy-it' + (x.ok ? " ok" : "") + '"><div class="dy-ic">' + (x.ok ? "✅" : x.ic) + '</div><div class="dy-t"><b>' + x.ic + " " + esc(x.t) + "</b><small>约 " + x.min + " 分钟</small>" +
        '<div class="s">' + esc(x.sub) + "</div>" + (x.prog ? '<div class="p">' + esc(x.prog) + "</div>" : "") + (x.pct > 0 && !x.ok ? '<div class="dy-bar"><u style="width:' + Math.round(Math.min(1, x.pct) * 100) + '%"></u></div>' : "") + (x.extra ? '<div class="x">' + x.extra + "</div>" : "") + "</div>" +
        '<div class="dy-btns"><button class="ui-btn' + (x.ok ? "" : " pri") + '" data-go="' + x.id + '">' + (x.ok ? "再练" : "去练 ▶") + "</button>" +
        (x.auto ? "" : '<button class="dy-chk' + (x.man ? " on" : "") + '" data-chk="' + x.id + '">' + (x.man ? "✓ 已做完" : "手动打勾") + "</button>") + "</div>" + (x.more ? '<div class="dy-more">' + x.more + "</div>" : "") + "</div>").join("") + "</div>" +
      '<div class="dy-note">打勾都是看各模块今天的练习记录自动算的，也可以手动打勾。每项都做完算一天全勤；设置、打勾和每天完成情况会同步，换设备也在。更细的数字看「📖 词汇 → 📊 统计」和口语页顶部的统计。</div></div>';
    paintBack(L, n);
  }
  function paintBack(L, n) {
    if (!back) return;
    if (!L) { L = tasks(); n = L.filter(x => x.ok).length; }
    back.textContent = "📅 每日一练 " + n + "/" + L.length;
    back.classList.toggle("on", went && L.length > 0);
  }
  function go(id) {
    went = true;
    ({ word: () => toNotebook("pump"), listen: toListen, speak: () => toSpeak("daily"), read: toNews, write: toWrite })[id]();
    paintBack();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function init() {
    if (root) return;
    root = $("view-daily"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    back = document.createElement("button"); back.id = "dy-back"; back.type = "button"; document.body.append(back);
    back.onclick = () => { if (!en("daily")) click($("tab-daily")); };
    root.addEventListener("click", e => {
      const t = e.target.closest("button, a[data-act], span[data-act]"); if (!t) return;
      if (t.dataset.go) return go(t.dataset.go);
      if (t.dataset.hard) { went = true; toHard(); paintBack(); return; }
      if (t.dataset.drillrv) { went = true; en("listen", "drill"); setTimeout(() => { if (window.drillReview) window.drillReview(); }, 150); paintBack(); return; }
      if (t.dataset.act === "set") { showSet = !showSet; return draw(); }
      if (t.dataset.act === "wk") { showWk = !showWk; if (!showWk) LS("daily:wkseen", wkKey()); return draw(); }
      if (t.dataset.word) { setOpt(o => { o.word = +t.dataset.word; }); return draw(); }
      if (t.dataset.band) { setOpt(o => { o.band = +t.dataset.band; }); return draw(); }
      if (t.dataset.examClear) { setOpt(o => { delete o.exam; delete o.band; }); return draw(); }
      if (t.dataset.sent) { sentOpen = !sentOpen; return draw(); }
      if (t.dataset.scheck != null) { const w = sentWords()[+t.dataset.scheck], inp = root.querySelector('[data-sin="' + t.dataset.scheck + '"]'); if (w) sentCheck(w, inp && inp.value); return; }
      if (t.dataset.sredo != null) { const w = sentWords()[+t.dataset.sredo]; if (w) { const A = LG("daily:sent", {}); if (A[lday()]) delete A[lday()][w.word]; LS("daily:sent", A); draw(); } return; }
      if (t.dataset.chk) { const C = LG("daily:check", {}), k = lday(), m = C[k] || (C[k] = {}); if (m[t.dataset.chk]) delete m[t.dataset.chk]; else m[t.dataset.chk] = Date.now(); for (const d in C) if (d < ago(k, 30)) delete C[d]; LS("daily:check", C); put("chk:" + k, m); return draw(); }
    });
    root.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset.sin != null && !e.isComposing) { e.preventDefault(); const w = sentWords()[+e.target.dataset.sin]; if (w) sentCheck(w, e.target.value); } });
    root.addEventListener("change", e => {
      const k = e.target.dataset.on; if (k) { setOpt(o => { o.on = Object.assign({}, DEF.on, o.on || {}); o.on[k] = e.target.checked ? 1 : 0; }); draw(); return; }
      if (e.target.hasAttribute("data-exam")) { const v = e.target.value; setOpt(o => { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) o.exam = v; else delete o.exam; }); draw(); }
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (document.documentElement.classList.contains("show-daily")) { pull(); draw(); } else paintBack(); } else CL.flush(); });
    setInterval(() => { if (went && !document.hidden && !document.documentElement.classList.contains("show-daily")) paintBack(); }, 5000); // 在别的模块练的时候，左下角的进度跟着更新
  }
  window.dailyShow = () => { init(); pull(); draw(); };
  window.dailyHide = () => { if (back) paintBack(); };
  const boot = () => { init(); if (document.documentElement.classList.contains("show-daily")) { pull(); draw(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
