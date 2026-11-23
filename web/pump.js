/* 生词本「🔊 练习」：照 Language Reactor 的 PhrasePump 做的练法，复习进度存在生词本里（state.srs，网站后台），哪台设备练都算
   一个词这一轮要么听 3 句例句（词条自带的 + Tatoeba 例句库，每次换着听），要么做 1 道填空（用保存时的原句）；被动听过 2 次之后才出填空（同 PhrasePump）。
   排程用 Ebisu（同 Language Reactor 默认的 EBISU 排程，公式照 Ebisu 2.1 官方库）：每个词一个模型 [α, β, t]，算出「现在记得的概率」和「半衰期」；
   记得的概率降到 50%（过了半衰期）该复习，降到 30% 算紧急；答对半衰期变长（越接近遗忘时答对涨得越多），答错变短。
   半衰期到 42 天（同 LR「至少 6 周都很可能记得」）自动标为「已掌握」。没有到期的词时，挑现在最可能忘的做「额外练习」。
   依赖 index.html 的全局：state / words / save / speak / toast */
(function () {
  const { LG, LS, esc } = U; // 全站共用的小工具（util.js）
  const DAY = 864e5, PER = 3, NUMS = [20, 40, 60, 80, 100], NEWS = [0, 5, 10, 15, 20, 25];
  const today = () => U.day(); // 📅 全站共用的「今天」（util.js，吉隆坡 / 北京时间）
  // 默认值同 PhrasePump：测验、建议、练习都开，练习数量 60，新项目 15 %（和默认不一样时「会话」旁出现「重置」）；后面几项是我们加的
  const DEF = { quiz: true, sugg: true, listen: true, num: 60, newPct: 15, tags: [], recall: false, dir: "en", types: ["word", "phrase", "sentence"], speed: 1, dict: false, shadow: false, gfill: false }; // 听写、跟读、语法填空也是我们加的，默认关 // 认词卡是我们加的，默认关（RL 没有）
  let opt = Object.assign(JSON.parse(JSON.stringify(DEF)), LG("pump:opt", {})); if (!Array.isArray(opt.tags)) opt.tags = [];
  if (!LG("pump:rl1", false)) { opt.recall = false; if (!opt.types.includes("sentence")) opt.types.push("sentence"); LS("pump:rl1", true); LS("pump:opt", opt); } // 2026-11-20 对齐 RL：认词卡默认关、句子也练
  if (!LG("pump:def60", false)) { if (opt.num === 20) opt.num = 60; LS("pump:def60", true); LS("pump:opt", opt); } // 以前默认 20：没改过的换成 PhrasePump 的默认 60
  // ---------- 排程：Ebisu（同 Language Reactor 默认的 EBISU 排程；公式照 Ebisu 2.1 官方库 github.com/fasiha/ebisu） ----------
  // 每个词一个模型 [α, β, t]：过了 t 天，记得的概率服从 Beta(α, β)。更新后自动把 t 调到「半衰期」（记得的概率降到 50% 的时间）
  const EB_INIT = [3, 3, 1];                 // 新词：Ebisu 默认 α = β = 3，半衰期先按 1 天
  const DUE_R = 0.5, URGENT_R = 0.3, KNOWN_H = 42; // 记得的概率降到 50%（过了半衰期）该复习，降到 30% 算紧急；半衰期 ≥ 42 天算已学会（同 LR：「至少 6 周都很可能记得」）
  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) { if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x); x -= 1; let a = LANCZOS[0]; const t = x + 7.5; for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
  const betaln = (a, b) => lgamma(a) + lgamma(b) - lgamma(a + b);
  const ebPredict = (m, tDays) => Math.exp(betaln(m[0] + Math.max(0, tDays) / m[2], m[1]) - betaln(m[0], m[1])); // 过了 t 天记得的概率
  function ebDecay(m, p) { // 记得的概率降到 p 要多少天
    let lo = 1e-6, hi = m[2]; while (ebPredict(m, hi) > p && hi < 1e7) hi *= 2;
    for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); if (ebPredict(m, mid) > p) lo = mid; else hi = mid; }
    return Math.sqrt(lo * hi);
  }
  // Ebisu 2.1 _updateRecallSingle（rebalance）：result 1 = 记得，0 = 忘了；tnow = 距上次复习多少天
  function ebUpdate(m, result, tnow) {
    const [a, b, t] = m, z = result > 0.5, q1 = z ? result : 1 - result, q0 = 1 - q1, dt = Math.max(tnow, 1e-6) / t;
    const c = z ? q1 - q0 : q0 - q1, d = z ? q0 : 1 - q0;
    const lin = terms => { const mx = Math.max(...terms.map(x => x[1])); const s = terms.reduce((acc, x) => acc + x[0] * Math.exp(x[1] - mx), 0); return [s, mx]; }; // Σ coef·exp(logB)
    const moment = (N, et) => { const tm = [[c, betaln(a + dt + N * dt * et, b)]]; if (d) tm.push([d, betaln(a + N * dt * et, b)]); return lin(tm); };
    const den = moment(0, 0), ratio = (N, et) => { const [s, mx] = moment(N, et); return (s / den[0]) * Math.exp(mx - den[1]); };
    let lo = 1e-6, hi = 1; while (ratio(1, hi) > 0.5 && hi < 1e8) hi *= 2; while (ratio(1, lo) < 0.5 && lo > 1e-12) lo /= 2; // 找后验平均记得概率 = 0.5 的时间（新半衰期）
    for (let i = 0; i < 90; i++) { const mid = Math.sqrt(lo * hi); if (ratio(1, mid) > 0.5) lo = mid; else hi = mid; }
    const et = Math.sqrt(lo * hi), mean = ratio(1, et), m2 = ratio(2, et), v = Math.max(1e-12, m2 - mean * mean), k = mean * (1 - mean) / v - 1;
    return [mean * k, (1 - mean) * k, et * Math.max(tnow, 1e-6)];
  }
  const LEVELS = [1, 3, 7, 16, 35, 90]; // 换算成原来的「级别」，给插件等旧显示用
  // 旧进度换算成 Ebisu 模型：之前的 FSRS 稳定度 / 级别当作半衰期
  const ebOf = r => (r && Array.isArray(r.e) ? r.e : !r ? null : [3, 3, r.s ? Math.max(0.25, r.s) : [0.5, 1, 3, 7, 16, 35, 90][r.b || 0] || 0.5]);
  const halfOf = r => { const m = ebOf(r); return !m ? 0 : r.h || ebDecay(m, 0.5); };
  const rNow = r => { if (!r || !r.at) return 0; return ebPredict(ebOf(r), (Date.now() - r.at) / DAY); }; // 现在记得的概率
  // 掌握进度：半衰期到 42 天（同 LR「至少 6 周都很可能记得」）= 100 % 已掌握；中间按对数换算（1 天 ≈ 18 %，7 天 ≈ 55 %，14 天 ≈ 72 %）
  const mastery = (r, w) => (w && w.status === "known" ? 1 : !r || !(r.e || r.s || r.b) ? 0 : Math.min(1, Math.log(1 + halfOf(r)) / Math.log(1 + KNOWN_H)));
  const pcent = x => Math.round(x * 100);
  const mbar = (x, known) => '<span class="pp-mb' + (known ? " known" : "") + '"><i style="width:' + pcent(x) + '%"></i></span>';
  const levelOf = s => { let b = 0; LEVELS.forEach((x, i) => { if (s >= x) b = i + 1; }); return b; };
  const seen = r => (r ? (r.x != null ? r.x : r.n || 0) : 0); // 被动听过几次（同 RL：每张听力卡算一次）
  // ---------- 例句：词条自带的 + Tatoeba 例句库（/api/sent，后台缓存）；听力每次换着听，最近听过的往后排 ----------
  const SENT = {}, heard = LG("pump:heard", {});
  const sentFor = w => { const k = String(w.word || "").toLowerCase().trim(); if (!hasEn(w) || w.type === "sentence" || /\s.*\s.*\s/.test(k) || k in SENT) return Promise.resolve(); SENT[k] = null;
    if (window.VL && window.VL !== "en") return Promise.resolve(SENT[k] = []); // 🇩🇪 例句库（Tatoeba，后台）只有英语句子：学德语时只用词条自带的例句
    return U.json("/api/sent?w=" + encodeURIComponent(k)).then(j => { if (!j.items && j.ok === false) delete SENT[k]; else SENT[k] = j.items || []; }); };
  let day = LG("pump:day", { d: "", n: 0 }); if (day.d !== today()) day = { d: today(), n: 0 };
  let cards = [], at = 0, bad = 0, playing = false, root = null;
  // 🔙 页面历史：在首页还是在练（练到一半没法恢复，所以只支持「后退 = 停下回首页」）
  if (window.NAV) NAV.reg("pump", () => root && root.classList.contains("on") ? { p: playing ? 1 : 0 } : undefined, x => { if (x && !x.p && playing) { stopAudio(); home(); } });
  // 插件保存时录下的原声和两张截图（存在 Cloudflare：/api/ext 里有索引，/api/media 一条一条取），哪台设备都能用
  let MED = null, medP = null, player = null, EXT = null; const SUGZH = {}; const medRec = {}, medPr = {};
  const nrm = s => String(s || "").toLowerCase().replace(/[{}]/g, "").replace(/[^a-z0-9']+/g, " ").trim();
  function medMap() {
    if (medP) return medP;
    medP = CLOUD.chan("ext").get().then(it => { const m = {}; // 全站共用的同步（cloud.js）
      const X = { tags: {}, sugg: {}, marks: {}, saved: new Set(), sents: new Map() }; // sents：收藏的句子（小写原文 → k），和插件的 ☆ 同一份 // 和插件复习页一样的几样：颜色标签、从看过的视频里推荐的生词、标记、已保存
      for (const k in it) { const i = k.indexOf("|"), n = k.slice(0, i), id = k.slice(i + 1), v = it[k].v; if (n === "tags" && v) X.tags[id] = v; else if (n === "sugg" && v && v.t) X.sugg[id] = v; else if (n === "marks") X.marks[id] = v; else if (n === "saved") X.saved.add(id); else if (n === "savedSents" && v && v.t && !v.ph) X.sents.set(String(v.t).replace(/\s+/g, " ").trim().toLowerCase(), v.k); }
      EXT = X;
      for (const k in it) if (k.startsWith("med|med:w:")) m[k.slice(10)] = k.slice(4);
      for (const k in it) if (k.startsWith("savedSents|")) { const x = it[k].v, mk = "med:s:" + (x && x.k); if (x && x.t && it["med|" + mk]) { const t = String(x.t).toLowerCase().trim(); if (!m[t]) m[t] = mk; } }
      return (MED = m); }).catch(() => { medP = null; return (MED = {}); }); // 读不到：EXT 保持 null（☆ 不能点，免得重复收藏），下次再读
    return medP;
  }
  function medFor(w) {
    const k = MED && MED[String(w.word || "").toLowerCase().trim()]; if (!k) return Promise.resolve(null);
    return medPr[k] || (medPr[k] = CLOUD.media(k).then(rec => (medRec[k] = rec)));
  }
  // 这张卡片的句子就是保存时的那一句：用原声和截图
  const medOf = c => { const k = MED && MED[String(c.w.word || "").toLowerCase().trim()], r = k && medRec[k]; if (!r) return null; return (r.t ? nrm(r.t) === nrm(c.s.en) : !!c.s.orig) ? r : null; };
  const prefetch = from => { for (let i = from; i < Math.min(cards.length, from + 4); i++) medFor(cards[i].w); };
  const CSS = `
  #pump{display:none;max-width:860px;margin:0 auto;padding:6px 0 30px}#pump.on{display:block}
  @media(min-width:1024px){#pump{max-width:1200px}.pp-home{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}.pp-card{min-height:320px}.pp-en{font-size:24px;max-width:860px}.pp-zh{font-size:17px;max-width:860px}}
  .pp-home{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
  @media(max-width:720px){.pp-home{grid-template-columns:1fr}}
  .pp-hc{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:20px 20px 22px;box-shadow:0 1px 0 rgba(0,0,0,.02)}
  .pp-hc h2{margin:0 0 14px;font-size:20px;display:flex;align-items:center;gap:8px}.pp-hc h2 b{color:var(--jade)}
  .pp-today{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px;margin-bottom:8px}.pp-today .emo{font-size:18px}.pp-today b{color:var(--ink);font-weight:600}
  .pp-bar{height:6px;border-radius:3px;background:var(--paper-2);overflow:hidden}.pp-bar i{display:block;height:100%;background:var(--jade);width:0;transition:width .3s}
  .pp-st{display:flex;margin:18px 0 14px;padding-bottom:16px;border-bottom:1px solid var(--line)}.pp-st div{flex:1}
  .pp-st small{display:block;color:var(--muted);font-size:12px}.pp-st b{font-size:24px;font-weight:600}.pp-st em{display:block;font-style:normal;color:var(--muted);font-size:12px}
  .pp-go{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px;flex-wrap:wrap}
  .pp-go button.pp-cm{background:var(--ui-surface-2,#2d2f34);color:var(--ui-ink,#eee);border:1px solid var(--ui-line-2,#454950)}
  .pp-go button{background:var(--jade);color:#fff;border:0;font:inherit;font-weight:800;font-size:16px;border-radius:12px;padding:0 22px;min-height:46px;cursor:pointer}.pp-go button:disabled{opacity:.4;cursor:default}.pp-go span{color:var(--muted);font-size:13px}
  .pp-only{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}.pp-only small{color:var(--muted);font-size:12.5px}
  .pp-hard .hw{flex-basis:100%;text-align:center;color:var(--muted);font-size:12.5px}
  .pp-only button{border:1px solid var(--ui-line-2,var(--line));background:var(--ui-surface-2,var(--paper-2));color:var(--ui-ink,var(--ink));font:inherit;font-weight:700;font-size:14px;border-radius:10px;padding:0 14px;min-height:40px;cursor:pointer}.pp-only button:hover{border-color:var(--ui-pur,var(--jade))}.pp-only button:disabled{opacity:.4;cursor:default}
  .pp-next{margin-top:16px;font-size:13px;color:var(--muted)}.pp-next b{color:var(--ink)}
  .pp-q{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.pp-q span{font-size:13px;color:#9a6512;border:1px solid #ecd2a0;background:#FFF8EA;border-radius:5px;padding:0 6px;line-height:1.6}
  .pp-opt{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:14px 16px}
  .pp-opt h4{margin:2px 0 8px;font-size:12px;color:var(--muted);font-weight:600}
  .pp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:42px;font-size:14px;border-top:1px dashed var(--line)}.pp-row:first-of-type{border-top:0}.pp-row small{color:var(--muted);font-size:12px}
  .pp-seg{display:inline-flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}.pp-seg b{font-weight:600;font-size:12.5px;color:var(--muted);border:1px solid var(--line);padding:3px 9px;border-radius:999px;cursor:pointer;background:var(--paper)}.pp-seg b.on{background:var(--jade);border-color:var(--jade);color:#fff}
  .pp-tg{appearance:none;width:42px;height:24px;border-radius:999px;background:#d9dfdc;position:relative;cursor:pointer;margin:0;flex:none}.pp-tg::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}.pp-tg:checked{background:var(--jade)}.pp-tg:checked::after{left:21px}
  .pp-note{color:var(--muted);font-size:12px;line-height:1.6;margin:10px 2px 0}
  .pp-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}.pp-top button{border:1px solid var(--line);background:var(--paper);border-radius:999px;font:inherit;font-size:13px;padding:0 12px;min-height:34px;cursor:pointer}
  .pp-top .pp-bar{flex:1}.pp-top span{font-size:13px;color:var(--muted);min-width:44px;text-align:right}
  .pp-hint{text-align:center;color:var(--muted);font-size:13px;margin:6px 0 10px}.pp-hint b{color:var(--ink);margin-right:6px}
  .pp-card{position:relative;background:var(--paper);border:1px solid var(--line);border-radius:18px;min-height:250px;padding:46px 22px 40px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .pp-zh .hm{display:inline-block;font-size:10.5px;font-weight:800;border-radius:4px;padding:0 4px;margin-right:6px;background:var(--ui-surface-3);color:var(--ui-muted);vertical-align:1px}
  .pp-sg{margin-top:12px;font-size:13px;color:var(--ui-muted)}.pp-sg button{margin-left:8px;height:30px;border-radius:8px;border:1px solid var(--ui-pur);background:var(--ui-pur-soft);color:var(--ui-pur-text);font:inherit;font-size:13px;padding:0 12px;cursor:pointer}.pp-sg button:disabled{opacity:.6;cursor:default}
  .pp-rc{cursor:pointer}.pp-rc.back{cursor:default;text-align:left;align-items:stretch}
  .pp-rc .rc-w{font-size:36px;font-weight:900;color:var(--ui-ink);line-height:1.25;text-align:center}.pp-rc .rc-w.long{font-size:24px}.pp-rc.back .rc-w{font-size:26px;text-align:left}
  .pp-rc .rc-p{color:var(--ui-muted);margin-top:6px;text-align:center}.pp-rc.back .rc-p{text-align:left;margin-top:2px}
  .pp-rc .rc-q{margin-top:18px;color:var(--ui-muted);font-size:13px;text-align:center}
  .pp-rc .rc-zh{margin-top:10px;font-size:18px;color:var(--ui-ink)}.pp-rc .rc-en{margin-top:4px;color:var(--ui-muted);font-size:14px}
  .pp-rc .rc-fm{margin-top:10px;font-size:13.5px;color:var(--ui-ink-2);display:grid;gap:2px}.pp-rc .rc-fm span{color:var(--ui-muted)}
  .pp-rc .rc-ex{margin-top:10px;display:grid;gap:8px;font-size:14.5px;color:var(--ui-ink)}.pp-rc .rc-ex span{display:block;color:var(--ui-muted);font-size:13px}.pp-rc .rc-ex .t{color:var(--ui-orange);font-weight:700}
  .pp-rc .rc-tip{margin-top:10px;font-size:13.5px;color:var(--ui-ink-2)}
  .pp-rcb{display:flex;gap:10px;margin:12px 0 0}.pp-rcb button{flex:1;height:46px;border-radius:12px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink)}#pp-yes{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}#pp-no:hover{border-color:var(--ui-red);color:var(--ui-red)}
  .pp-segbar{flex:1;display:flex;gap:3px;height:6px}.pp-segbar span{border-radius:3px;overflow:hidden;background:var(--ui-surface-3)}.pp-segbar i{display:block;height:100%}
  .pp-segbar .sg-t i{background:#db9470}.pp-segbar .sg-p i{background:#70db94}.pp-segbar .sg-e i{background:#9370db}.pp-segbar .sg-t{box-shadow:inset 0 0 0 1px rgba(219,148,112,.35)}.pp-segbar .sg-p{box-shadow:inset 0 0 0 1px rgba(112,219,148,.35)}.pp-segbar .sg-e{box-shadow:inset 0 0 0 1px rgba(147,112,219,.35)}
  .pp-gap{display:inline-block;min-width:3em;padding:0 6px;margin:0 3px;border-radius:6px;background:rgba(219,148,112,.18);border-bottom:2px solid #db9470;color:transparent;filter:blur(5px);cursor:pointer;transition:filter .15s}.pp-gap.on{color:#ffcfb4;filter:none;font-weight:800;cursor:default}
  .pp-rate{display:flex;justify-content:center;gap:10px;margin:12px 0 0}.pp-rate button{min-width:130px;height:44px;border-radius:10px;border:0;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer}.pp-rate kbd{font:11px monospace;opacity:.7;margin-right:10px;border:1px solid rgba(255,255,255,.4);border-radius:4px;padding:0 4px}
  #pp-fail{background:#75771e}#pp-fail:hover{background:#818322}#pp-ok{background:#28815b}#pp-ok:hover{background:#2f9366}
  .pp-sgw{text-align:center;margin:4px 0 12px}.pp-sgw b{font-size:2em;color:var(--ui-ink)}.pp-sgw small{margin-left:14px;font-size:13px;color:var(--ui-muted);font-style:italic;vertical-align:10px}.pp-sgw .z{margin-top:4px;color:#70db94;font-size:15px}
  .pp-stage{display:flex;justify-content:center;gap:10px;margin:12px 0 0}.pp-stage button{min-width:110px;height:44px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;font-size:15px;font-weight:700;cursor:pointer}.pp-stage kbd{font:11px monospace;opacity:.6;margin-right:8px}
  .pp-stage .known:hover,.pp-stage .known.on{border-color:#e6e8eb;background:rgba(255,255,255,.12)}.pp-stage .learn:hover,.pp-stage .learn.on{border-color:#FFB86B;background:rgba(255,184,107,.18);color:#FFB86B}.pp-stage .skip:hover,.pp-stage .skip.on{border-color:var(--ui-muted);background:var(--ui-surface-3)}.pp-stage button:disabled:not(.on){opacity:.4}
  .pp-ctl button.wait{opacity:.35}
  .pp-dots{display:flex;justify-content:center;gap:7px;margin-top:12px}.pp-dots i{width:7px;height:7px;border-radius:50%;background:var(--ui-surface-3);cursor:pointer}.pp-dots i.on{background:#70db94}
  .pp-rate button.pressed,.pp-rcb button.pressed{outline:2px solid #fff;box-shadow:0 0 0 3px rgba(250,219,255,.27)}.pp-rate button:disabled{opacity:.45;cursor:default}
  .pp-done{position:relative;margin-bottom:16px}.pp-done .x{position:absolute;right:12px;top:10px;border:0;background:none;color:var(--ui-muted);font-size:16px;cursor:pointer}
  .pp-card .st{position:absolute;right:58px;top:10px;border:0;background:none;color:var(--ui-muted);font-size:18px;cursor:pointer;line-height:1}.pp-card .st.on{color:#E8A23C}
  .pp-gear{margin-left:auto;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:999px;width:32px;height:32px;font-size:16px;cursor:pointer}.pp-gear:hover{color:var(--ui-pur-text);border-color:var(--ui-pur)}
  .pp-top .tb{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink-2);border-radius:999px;height:26px;min-width:34px;padding:0 8px;font:inherit;font-size:12px;cursor:pointer;margin-left:6px}
  .pp-keyhelp{margin:6px auto 10px;max-width:420px;background:var(--ui-surface);border:1px solid var(--ui-line-2);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--ui-ink-2);cursor:pointer}.pp-keyhelp b{display:block;margin-bottom:6px;color:var(--ui-ink)}.pp-keyhelp kbd{display:inline-block;min-width:110px;font:12px monospace;color:var(--ui-pur-text)}
  .pp-first{position:absolute;right:12px;bottom:34px;font-size:15px;opacity:.75}
  .pp-mb{display:inline-block;vertical-align:middle;width:64px;height:6px;border-radius:3px;background:var(--ui-surface-3);overflow:hidden}.pp-mb i{display:block;height:100%;background:var(--ui-pur);border-radius:3px}.pp-mb.known i{background:linear-gradient(90deg,#f6c453,#ffdf80)}
  .pp-master{margin:14px 0 4px;padding:12px 14px;border-radius:12px;background:var(--ui-surface-2)}.pp-master .h{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}.pp-master .h span{color:#f6c453;font-weight:700}.pp-master .h b{font-size:20px;color:#ffdf80}.pp-master .h small{color:var(--ui-muted)}.pp-master>.pp-mb{width:100%;height:8px}
  .pp-master .h2{margin:10px 0 6px;font-size:13px;color:var(--ui-muted)}.pp-master .h2 b{color:var(--ui-pur-text)}.pp-master .h2+.pp-mb{width:100%}
  .pp-q span .pp-mb{width:34px;height:4px;margin-left:5px}
  .pp-prog{display:flex;align-items:center;justify-content:center;gap:8px;margin:2px 0 10px;font-size:12.5px;color:var(--ui-muted)}.pp-prog .pp-mb{width:120px}.pp-prog b{color:var(--ui-ink)}.pp-prog em{font-style:normal;color:var(--ui-green);font-weight:700}
  .pp-prog.known{color:#f6c453;font-weight:700}.pp-prog.known b{color:#ffdf80}
  #pump.pp-known .pp-card{border-color:#f6c453;box-shadow:0 0 0 1px #f6c453,0 0 26px rgba(246,196,83,.25)}
  .pp-new{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(246,196,83,.12);border:1px solid rgba(246,196,83,.45);color:#ffdf80}.pp-new b{color:#fff}
  .pp-sum{display:grid;gap:6px;margin:12px auto;max-width:460px;text-align:left}.pp-sum .row{display:grid;grid-template-columns:1fr 120px 110px;align-items:center;gap:10px;font-size:14px}.pp-sum .row .pp-mb{width:100%}.pp-sum .n{color:var(--ui-muted);font-size:13px}.pp-sum em{font-style:normal;color:var(--ui-green);font-weight:700}.pp-sum em.dn{color:var(--ui-red)}
  .pp-sum .row.known .w{color:#ffdf80;font-weight:700}.pp-sum .row.known .n{color:#f6c453;font-weight:700}
  .pp-opt h4{display:flex;align-items:center}.pp-opt h4 #pp-reset{margin-left:auto;color:var(--ui-pur-text);text-decoration:none;font-weight:600}.pp-opt h4 #pp-reset:hover{text-decoration:underline}
  .pp-q span.sg{border-style:dashed}
  .pp-q span i{font-style:normal;font-size:11px;opacity:.7}
  .pp-img{display:flex;gap:8px;justify-content:center;width:100%;max-width:640px;margin:0 auto 14px}.pp-img img{flex:1 1 0;min-width:0;max-width:300px;aspect-ratio:16/9;object-fit:cover;border-radius:10px;background:var(--paper-2)}
  .pp-card .pl{position:absolute;left:12px;top:12px;width:32px;height:32px;border-radius:50%;background:var(--jade);color:#fff;border:0;font-size:13px;cursor:pointer}
  .pp-card .cp{position:absolute;right:12px;top:12px;border:0;background:none;color:var(--muted);font-size:13px;cursor:pointer;padding:6px}
  .pp-en{font-size:21px;font-weight:700;line-height:1.55;max-width:640px}.pp-en .t{color:#b5651d;box-shadow:inset 0 -2px 0 #ecd2a0;border-radius:2px}
  .pp-zh{font-size:16px;color:#3c4a55;margin-top:14px;max-width:640px}.pp-def{font-size:13px;color:var(--muted);margin-top:10px;max-width:600px}
  .pp-card .hid{filter:blur(7px);cursor:pointer;user-select:none}
  .pp-chip{position:absolute;right:12px;bottom:10px;font-size:12px;color:#9a6512;border:1px solid #ecd2a0;border-radius:4px;padding:0 6px}
  .pp-card input{font:700 20px inherit;font-family:inherit;width:auto;border:0;border-bottom:2px solid var(--jade);background:var(--paper-2);border-radius:6px 6px 0 0;text-align:center;padding:2px 6px;outline:none;color:var(--ink)}
  .pp-card input.ok{border-color:#2e9e5b;color:#2e9e5b}.pp-card input.no{border-color:#d0463b;color:#d0463b}
  .pp-ans{margin-top:10px;font-size:14px;color:#2e9e5b;min-height:20px}.pp-ans.no{color:#d0463b}
  .pp-ctl{display:flex;justify-content:center;gap:14px;margin-top:16px}.pp-ctl div{display:flex;flex-direction:column;align-items:center;gap:6px}
  .pp-ctl button{width:56px;height:56px;border-radius:50%;border:1px solid var(--line);background:var(--paper);font-size:22px;cursor:pointer;color:var(--ink)}.pp-ctl button.pri{background:var(--jade);border-color:var(--jade);color:#fff}.pp-ctl button:disabled{opacity:.35;cursor:default}
  .pp-ctl kbd{font:11px ui-monospace,monospace;color:var(--muted);border:1px solid var(--line);border-radius:3px;padding:0 5px}
  @media(hover:none){.pp-ctl kbd{display:none}}
  .pp-done h3{margin:0 0 8px;font-size:20px}.pp-done p{color:var(--muted);margin:4px 0}.pp-done button{margin-top:16px;background:var(--jade);color:#fff;border:0;font:inherit;font-weight:800;border-radius:12px;padding:0 20px;min-height:44px;cursor:pointer}
  /* 深色主题：用 theme.css 的颜色 */
  .pp-q span,.pp-chip{color:var(--ui-orange);border-color:rgba(255,184,107,.35);background:rgba(255,184,107,.08)}
  .pp-en .t{color:var(--ui-orange);box-shadow:inset 0 -2px 0 rgba(255,184,107,.45)}
  .pp-zh{color:var(--ui-ink-2)}
  .pp-tg{background:#3a4048}.pp-tg:checked{background:var(--ui-pur)}
  .pp-card input.ok{border-color:var(--ui-green);color:var(--ui-green)}.pp-card input.no{border-color:var(--ui-red);color:var(--ui-red)}
  .pp-ans{color:var(--ui-green)}.pp-ans.no{color:var(--ui-red)}
  .pp-ctl button{background:var(--ui-surface-2);border-color:var(--ui-line-2)}.pp-ctl button.pri{background:var(--ui-pur);border-color:var(--ui-pur)}
  .pp-hc,.pp-opt,.pp-card{box-shadow:var(--ui-shadow)}
  .pp-dt{display:block;width:100%;max-width:640px;margin:8px auto 0;font:500 18px/1.5 inherit;font-family:inherit;color:var(--ui-ink);background:var(--ui-surface-2);border:1px solid var(--ui-line-2);border-radius:12px;padding:10px 12px;resize:vertical;outline:none}.pp-dt:focus{border-color:var(--ui-pur)}
  .pp-card input#pp-in{font-size:inherit;min-width:4ch;max-width:100%}
  .pp-xrow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}
  .pp-btn{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:12px;min-height:42px;padding:0 18px;font:inherit;font-weight:700;cursor:pointer}.pp-btn kbd{font:11px ui-monospace,monospace;color:var(--ui-muted);margin-left:6px}
  .pp-btn.rec{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}.pp-btn.rec.on{background:var(--ui-red);border-color:var(--ui-red);animation:pprec 1s infinite}.pp-btn:disabled{opacity:.5}
  @keyframes pprec{50%{opacity:.6}}
  .pp-diff{margin:12px auto 0;max-width:640px;font-size:18px;line-height:1.7}.pp-diff span.ok{color:var(--ui-green)}.pp-diff span.no{color:var(--ui-red);text-decoration:line-through;text-decoration-thickness:1px}.pp-diff .x{font-size:13px;color:var(--ui-muted);margin-top:4px}
  .pp-gt{font-size:13px;color:var(--ui-pur-text);margin-bottom:8px}.pp-gap.bad{color:var(--ui-red)}.pp-mine{color:var(--ui-muted);font-size:.8em}`;
  const srs = () => (state.srs = state.srs || {});
  const LEVELS_DAY = [{ p: 0, e: "😭", bg: "#414943", min: 0, per: 0 }, { p: 1, e: "😢", bg: "#4f7358", min: 0, per: 1 }, { p: 50, e: "🙂", bg: "#5ba06c", min: 50, per: .6 }, { p: 100, e: "😎💯", bg: "#68cf7f", min: 80, per: .2 }, { p: 200, e: "🐢👑", bg: "#76ff90", min: 100, per: 0 }]; // 同 PhrasePump
  const dayLevel = () => LEVELS_DAY.filter(l => l.p <= day.n).pop();
  const emoji = () => dayLevel().e;
  const dayBar = () => { const l = dayLevel(); return '<div class="pp-bar" title="0 张 😭 · 1–49 😢 · 50–99 🙂 · 100–199 😎💯 · 200 以上 🐢👑"><i style="width:' + Math.min(100, l.min + (day.n - l.p) * l.per) + "%;background:" + l.bg + '"></i></div>'; };
  const countCard = c => { if (c && !c.counted) { c.counted = true; if (day.d !== today()) day = { d: today(), n: 0 }; day.n++; LS("pump:day", day); logDay(Object.assign({ n: 1, sec: spent() }, c.k === "listen" || c.k === "dict" ? { ls: 1 } : {})); } }; // 按「下一个」离开一张卡时算练了一张（同 PhrasePump）；听力、听写卡另记 ls（「📅 每日一练」的「听」用）
  // ---------- 每天的练习记录（「📊 统计」用）：本机 pump:log + /api/ext 的 "stat|日期"（换设备也在）----------
  // { "YYYY-MM-DD"（本地日期）: { n 卡片数, ok 记得, fail 忘了, nw 新词, sec 用时秒 } }
  const lday = today;
  let lastT = Date.now(), logT = null;
  const spent = () => { const now = Date.now(), s = Math.min(90, Math.max(0, (now - lastT) / 1000)); lastT = now; return Math.round(s); }; // 两张卡之间最多算 90 秒（中途走开不算）
  function logDay(add) {
    const L = LG("pump:log", {}), d = lday(), x = L[d] || (L[d] = { n: 0, ok: 0, fail: 0, nw: 0, sec: 0 });
    for (const k in add) x[k] = (x[k] || 0) + add[k];
    LS("pump:log", L);
    clearTimeout(logT); logT = setTimeout(() => { CLOUD.chan("ext").send({ ["stat|" + d]: { v: x, at: Date.now() } }); }, 4000);
  }
  const hasEn = w => !/[一-鿿]/.test(w.word); // 「规律」类词条标题是中文：没法听，只能用认词卡练
  const clozes = w => (w.examples || []).filter(x => Array.isArray(x) && /\{[^}]+\}/.test(String(x[0] || "")) && !/[一-鿿]/.test(String(x[0]).match(/\{([^}]+)\}/)[1])); // 语法填空能用的例句（{} 里是英文）
  const usable = w => w && w.word && opt.types.includes(w.type || "word") && (hasEn(w) || opt.recall || (opt.gfill && clozes(w).length > 0));
  // 这个词这一轮出哪几张卡（同 PhrasePump：要么听 3 句，要么 1 道填空；被动听过 2 轮之后才出填空，关了「练习」就直接出填空）
  const ownSent = w => { const k = String(w.word || "").toLowerCase().trim(); return sentences(w).map((x, i) => Object.assign({ orig: i === 0 }, x)).filter(x => nrm(x.en) !== nrm(w.word) || !(SENT[k] || []).length); };
  // ---------- 挑卡：照 PhrasePump 服务器的做法（2026-11-20 在 LR 上逐项对照过它返回的挑卡记录） ----------
  // 模式：测验 + 练习都开 = 混合（每个词看复习记录：被动听够 2 轮出 1 道填空，不够就听）；只开测验 = 只考；只开练习 = 只听；都关 = 不复习，只出「建议」
  // 每个词占几张：听 = 3 句（整句 1 张）；填空 = 1 张；认词卡（我们加的）+1；推荐生词 1 张
  const quizable = w => !w.sg && hasEn(w) && w.type !== "sentence" && /\{[^}]+\}/.test(mark(sentences(w)[0].en, w));
  const canQuiz = w => opt.quiz && quizable(w);
  const modeOf = () => (opt.quiz && opt.listen ? "mixed" : opt.quiz ? "quiz" : opt.listen ? "practice" : "none");
  function spec(w) {
    const mode = modeOf(), r = srs()[w.id], k = String(w.word || "").toLowerCase().trim();
    if (w.sg) return { quiz: 0, recall: 0, listen: Math.min(PER, 1 + (SENT[k] || []).length) }; // 建议：几句例句，每句一张
    if (mode === "none") return { quiz: 0, recall: 0, listen: 0 };
    if (!hasEn(w)) return opt.gfill && clozes(w).length ? { quiz: 0, recall: 0, listen: 0, gfill: 1 } : { quiz: 0, recall: 1, listen: 0 }; // 规律类（中文标题）：语法填空（开了的话），不然认词卡
    const ex = { dict: opt.dict ? 1 : 0, shadow: opt.shadow ? 1 : 0 }; // 听写、跟读（我们加的）：每个词再各加一张
    if (mode === "quiz") return Object.assign(quizable(w) ? { quiz: 1, recall: 0, listen: 0 } : { quiz: 0, recall: 1, listen: 0 }, ex); // 只考：考不了的给认词卡
    if (mode === "mixed" && quizable(w) && seen(r) >= 2) return Object.assign({ quiz: 1, recall: 0, listen: 0 }, ex);
    const avail = ownSent(w).length + (SENT[k] || []).length, listen = Math.min(w.type === "sentence" ? 1 : PER, avail); // 整句（PhrasePump 的 PHRASE）听 1 张
    return Object.assign({ quiz: 0, recall: opt.recall || !listen ? 1 : 0, listen }, ex);
  }
  const nCards = w => { const x = spec(w); return x.quiz + x.recall + x.listen + (x.dict || 0) + (x.shadow || 0) + (x.gfill || 0); };
  // 🔥 难词：忘过 2 次以上（r.f），或者练了 3 轮以上半衰期还不到 3 天的（以前没记 f 的旧数据靠这条）；已掌握的不算。最难的在前
  let hardOnly = false;
  const isHard = r => !!r && !!r.at && ((r.f || 0) >= 2 || ((r.n || 0) >= 3 && (r.h || 0) < 3));
  function hardOf(L, S) { return L.filter(w => w.status !== "known" && isHard(S[w.id])).sort((a, b) => ((S[b.id].f || 0) - (S[a.id].f || 0)) || ((S[a.id].h || 0) - (S[b.id].h || 0))); }
  function plan() {
    const S = srs(), now = Date.now(), tagOf = w => (EXT && EXT.tags[String(w.word).toLowerCase().trim()]) || "", mode = modeOf();
    const P = (typeof words !== "undefined" ? words : []).filter(usable).filter(w => !opt.tags.length || opt.tags.includes(tagOf(w))), live = P.filter(w => w.status !== "known");
    const due = live.filter(w => S[w.id] && S[w.id].at && rNow(S[w.id]) <= DUE_R).sort((a, b) => rNow(S[a.id]) - rNow(S[b.id])); // 该复习的（记得的概率降到 50% 以下，过了半衰期），最可能忘的先练
    const fresh = live.filter(w => !S[w.id]).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    // 建议（同 PhrasePump「来自你的混合内容的新词」）：从看过的视频里挑还没收、没标记过的词；练了不记进度，想学就点「＋ 收进生词本」
    const have = new Set((typeof words !== "undefined" ? words : []).map(w => String(w.word || "").toLowerCase().trim()));
    const pool = opt.sugg && EXT && !opt.tags.length ? Object.keys(EXT.sugg).filter(w => !have.has(w) && !EXT.marks[w] && !EXT.saved.has(w)).sort((a, b) => (EXT.sugg[b].n || 1) - (EXT.sugg[a].n || 1) || (EXT.sugg[b].at || 0) - (EXT.sugg[a].at || 0)) : [];
    const sugg = pool.map(w => ({ id: "sg_" + w, word: w, zh: "", type: "word", sg: 1, examples: [[EXT.sugg[w].t, ""]] }));
    const early = live.filter(w => S[w.id] && S[w.id].at && rNow(S[w.id]) > DUE_R).sort((a, b) => rNow(S[a.id]) - rNow(S[b.id])); // 还没到期的复习，最可能忘的先
    // 名额 = 练习数量。顺序同 PhrasePump：该复习的 → 新词（最多 练习数量 × 新项目）→ 建议（用新词剩下的名额）→ 没到期的复习 → 还有剩就用例句库的额外句子补满
    // 最后一个词放不下时：剩下的名额够它一半就照样放（所以选 60 有时是 61 张），不够就停
    const N = opt.num, queue = []; let rem = N, newSlots = Math.round(N * opt.newPct / 100);
    const fits = c => c <= rem || rem / c >= 0.5;
    const fill = (L, kind, isNew) => { for (const w of L) { if (rem <= 0 || (isNew && newSlots <= 0)) return; const c = nCards(w); if (!c) continue; if (!fits(c) || (isNew && c > newSlots && newSlots / c < 0.5)) return; queue.push({ w, kind, c }); rem -= c; if (isNew) newSlots -= c; } };
    if (hardOnly) fill(hardOf(live, S), "due"); // 「只练难词」：只排难词，不加新词、建议、额外句子
    else {
      if (mode !== "none") fill(due, "due");
      newSlots = Math.min(newSlots, Math.max(0, rem));
      if (mode !== "none") fill(fresh, "new", true);
      fill(sugg, "sugg", true);
      if (mode !== "none") fill(early, "early");
    }
    const pump = !hardOnly && opt.listen && rem > 0 && (queue.length || mode !== "none") ? rem : 0; // 额外句子：只在「练习」开着时补
    return { P, live, due, fresh, pool, queue, list: queue.map(q => q.w), pump, n: N - Math.max(0, rem) + pump, extra: queue.some(q => q.kind === "early") || pump > 0, mode };
  }
  // 一个词条的例句：词条自带的 examples（{目标词} 标出位置）；没有就用词条本身
  function sentences(w) { // 词条自带的例句（第一句通常是保存时的原句）
    const L = (w.examples || []).filter(x => Array.isArray(x) && x[0]).map(x => ({ en: String(x[0]), zh: String(x[1] || "") }));
    if (w.type === "sentence") L.unshift({ en: w.word, zh: w.zh || "" });
    return L.length ? L : [{ en: w.word, zh: w.zh || "" }];
  }
  function listenSet(w, n) { // 听力：词条例句 + 例句库，最近听过的往后排，挑 n 句
    const k = String(w.word || "").toLowerCase().trim(), own = ownSent(w); // 没有例句时词条会拿单词本身凑数：例句库有句子就不要它
    const all = own.concat((SENT[k] || []).map(x => ({ en: x.en, zh: x.zh, src: "tatoeba" }))).filter((x, i, a) => a.findIndex(y => y.en.toLowerCase() === x.en.toLowerCase()) === i);
    const h = heard[k] || [], score = x => { const i = h.indexOf(x.en); return i < 0 ? 0 : h.length - i; }; // 越近听过分越高，排越后
    const pick = all.map((x, i) => ({ x, r: score(x) * 10 + Math.random() + (x.orig ? -0.5 : 0) })).sort((a, b) => a.r - b.r).slice(0, n || PER).map(o => o.x);
    heard[k] = h.filter(e => !pick.some(p => p.en === e)).concat(pick.map(p => p.en)).slice(-12); LS("pump:heard", heard);
    return pick;
  }
  const plain = en => en.replace(/[{}]/g, "");
  function mark(en, w) { // 目标词位置：优先用 {} 标记；没有就在句子里找这个词
    if (/\{[^}]+\}/.test(en)) return en;
    if (w.type === "sentence") return en;
    const i = en.toLowerCase().indexOf(String(w.word).toLowerCase()); return i >= 0 ? en.slice(0, i) + "{" + en.substr(i, w.word.length) + "}" + en.slice(i + w.word.length) : en;
  }
  const html = en => esc(en).replace(/\{([^}]+)\}/g, '<span class="t">$1</span>');
  function home() {
    playing = false; root.classList.remove("pp-known"); if (window.NAV) NAV.mark(); /* 🔙 页面历史（nav.js） */ const p = plan(), S = srs();
    const VS = window.vocabStats ? window.vocabStats() : null; // 学习中 / 已掌握：和顶部、统计页同一个口径（index.html 的 vocabStats）
    const lrn = VS ? VS.learning : p.P.filter(w => S[w.id] && w.status !== "known").length, done = VS ? VS.known : p.P.filter(w => w.status === "known").length;
    const rs = p.live.filter(w => S[w.id] && S[w.id].at).map(w => rNow(S[w.id])), avgR = rs.length ? Math.round(rs.reduce((a, x) => a + x, 0) / rs.length * 100) : 0;
    p.list.slice(0, 12).forEach(w => sentFor(w)); // 先把例句取回来
    const urgent = p.due.filter(w => rNow(S[w.id]) <= URGENT_R).length, n = p.n;
    const tg = (id, on, name, small) => '<label class="pp-row"><span>' + name + " <small>" + small + '</small></span><input type="checkbox" class="pp-tg" id="' + id + '"' + (on ? " checked" : "") + "></label>";
    const seg = (k, list, isOn, title) => '<div class="pp-row"' + (title ? ' title="' + title + '"' : "") + "><span>" + list.name + '</span><span class="pp-seg" data-k="' + k + '">' + list.items.map(([v, t]) => '<b data-v="' + esc(v) + '" class="' + (isOn(v) ? "on" : "") + '">' + esc(t) + "</b>").join("") + "</span></div>";
    const tags = EXT ? [...new Set(Object.values(EXT.tags))] : [];
    // 布局、文字、顺序同 PhrasePump：左边统计和开始，右边「会话」设置（测验 · 建议 · 练习 · 练习数量 · 新项目 · 筛选），我们自己加的放在后面
    root.innerHTML = lastSum + '<div class="pp-home"><div class="pp-hc"><h2>🔊 <b>练习</b><button class="pp-gear" id="pp-gear" title="设置：朗读语音、导出">⚙</button></h2>' +
      '<div class="pp-today"><span class="emo">' + emoji() + "</span>今天<b>" + day.n + " 张卡片</b></div>" + dayBar() +
      '<div class="pp-st"><div title="记得的概率已经降到 50% 以下（过了半衰期）、该复习的；「紧急」= 降到 30% 以下"><small>待复习</small><b>' + p.due.length + "</b><em>" + (urgent ? urgent + " 个紧急" : "") + '</em></div>' +
      '<div data-to="notebook/list?f=practicing&amp;c=all" title="' + (rs.length ? "按 Ebisu 算，现在平均记得 " + avgR + "%" : "正在练的词") + ' · 点一下看是哪些"><small>学习中</small><b>' + lrn + "</b><em data-to=\"notebook/list?f=fresh&amp;c=all\">+" + p.fresh.length + ' 个排队中</em></div>' +
      '<div data-to="notebook/list?f=known&amp;c=all" title="半衰期到了 42 天（至少 6 周都很可能记得），自动算已掌握 · 点一下看是哪些"><small>已掌握</small><b>' + done + "</b></div></div>" +
      (() => { const all = VS ? words.filter(w => (w.type || "word") !== "pattern") : p.P.filter(w => !w.sg), kn = VS ? VS.known : all.filter(w => w.status === "known").length, lr = all.filter(w => mastery(S[w.id], w) < 1 && S[w.id]), avg = lr.length ? lr.reduce((a, w) => a + mastery(S[w.id], w), 0) / lr.length : 0, tot = all.length ? kn / all.length : 0;
        return '<div class="pp-master" data-to="notebook/list?f=known&amp;c=all" title="半衰期到 42 天（至少 6 周都很可能记得）算已掌握 · 点一下看是哪些"><div class="h"><span>🏆 已掌握</span><b>' + pcent(tot) + "%</b><small>" + kn + " / " + all.length + " 个</small></div>" + mbar(tot, true) + (lr.length ? '<div class="h2">学习中的 ' + lr.length + " 个词平均掌握进度 <b>" + pcent(avg) + "%</b></div>" + mbar(avg) : "") + "</div>"; })() +
      '<div class="pp-go"><button id="pp-start"' + (n ? "" : " disabled") + ">开始练习</button>" + '<button id="pp-commute" class="pp-cm" title="生词一条条读给你听：熄屏、走路、开车也能复习">🎧 通勤模式</button>' + "<span>" + (n ? n + " 张卡片" : p.mode === "none" ? (opt.sugg ? "测验、练习都关了：只练建议，现在没有建议" : "测验、练习、建议都关了，没有可练的") : "现在没有要练的") + "</span></div>" +
      (() => { const H = hardOf(p.P.filter(w => !w.sg), S); return H.length ? '<div class="pp-only pp-hard"><small>🔥 难词 ' + H.length + ' 个</small><button id="pp-hard" title="' + esc(H.slice(0, 30).map(w => w.word).join(" · ")) + '">只练难词</button><span class="hw">' + H.slice(0, 6).map(w => '<u data-w="' + esc(w.word) + '">' + esc(w.word) + "</u>").join(" · ") + (H.length > 6 ? " …" : "") + "</span></div>" : ""; })() +
      '<div class="pp-only"><small>只练一种：</small><button id="pp-only-shadow"' + (p.queue.length ? "" : " disabled") + ' title="听一句，自己读一遍，录音转文字，标出读对、读漏的词">🎙 跟读</button><button id="pp-only-dict"' + (p.queue.length ? "" : " disabled") + ' title="只放声音，把整句打出来，逐词对错">✍️ 听写</button></div>' +
      (p.queue.length ? '<div class="pp-next"><b>接下来</b> · 你的队列，然后是推荐' + '<div class="pp-q">' + p.queue.slice(0, 12).map(q => { const r = S[q.w.id]; const m = mastery(r, q.w); return "<span" + (q.kind === "sugg" ? ' class="sg" title="推荐：从看过的视频里来的新词"' : ' title="掌握进度 ' + pcent(m) + "%" + (r && r.at ? " · 现在记得 " + pcent(rNow(r)) + "%" : " · 新词") + '"') + " data-w=\"" + esc(q.w.word) + "\">" + esc(q.w.word) + (q.kind === "sugg" ? "" : " <i>" + pcent(m) + "%</i>" + mbar(m)) + "</span>"; }).join("") + "</div></div>" : "") + "</div>" +
      '<div class="pp-opt"><h4>会话' + (JSON.stringify(Object.keys(DEF).map(k => opt[k])) !== JSON.stringify(Object.keys(DEF).map(k => DEF[k])) ? '<a id="pp-reset" href="javascript:void 0">重置</a>' : "") + "</h4>" +
      tg("pp-quiz", opt.quiz, "测验", "填空题") +
      tg("pp-sugg", opt.sugg, "建议", "来自你看过的视频的新词（" + (p.pool ? p.pool.length : 0) + " 个）") +
      tg("pp-listen", opt.listen, "练习", "先理解再显示") +
      seg("num", { name: "练习数量", items: NUMS.map(v => [v, v]) }, v => +v === opt.num) +
      seg("newPct", { name: "新项目", items: NEWS.map(v => [v, v + " %"]) }, v => +v === opt.newPct, "这些卡片里新词最多占的比例") +
      (tags.length ? seg("tags", { name: "筛选", items: tags.map(t => [t, t]) }, v => opt.tags.includes(v)) : "") +
      '<h4 style="margin-top:14px">我们加的</h4>' +
      tg("pp-recall", opt.recall, "认词卡", "先看词回想意思，翻开后自己判断认不认识（原来的「背诵」「自测」）") +
      (opt.recall ? seg("dir", { name: "认词方向", items: [["en", "看英文想中文"], ["zh", "看中文想英文"]] }, v => opt.dir === v) : "") +
      tg("pp-dict", opt.dict, "听写", "每个词再加一张：只放声音，把整句打出来，逐词对错") +
      tg("pp-shadow", opt.shadow, "跟读", "每个词再加一张：听完自己读一遍，录音转文字，标出读对、读漏的词") +
      tg("pp-gfill", opt.gfill, "语法填空", "「规律」词条的例句挖空，自己打出来（开了会自动加上「规律」类型）") +
      seg("types", { name: "类型", items: [["word", "单词"], ["phrase", "短语"], ["sentence", "句子"], ["pattern", "规律"]] }, v => opt.types.includes(v)) +
      '<p class="pp-note">插件里的「复习」也打开这里，进度是同一份：在哪台设备练都算。「练习数量」是这一组的卡片张数；「新项目」是其中新词最多占的比例。每个词这一轮要么听 3 句例句（每次换着听），要么做 1 道填空。按 Ebisu 排复习（同 Language Reactor）：记得的概率降到 50%（过了半衰期）时再练，越接近遗忘时答对，半衰期涨得越多；半衰期到 42 天（至少 6 周都很可能记得），自动算「已掌握」。电脑上可以用键盘（同 Language Reactor）：A 上一个、S 播放、E 显示 / 看答案、D 下一个；测验和认词卡 Z 忘了、C 记得；建议 Z 已知、X 学习、C 跳过。</p></div></div>';
    root.querySelector("#pp-start").onclick = () => { lastSum = ""; start(); };
    const cm = root.querySelector("#pp-commute"); if (cm) cm.onclick = () => { if (window.commuteShow) window.commuteShow(); }; // 🎧 通勤模式（commute.js，按需加载）
    root.querySelector("#pp-only-shadow").onclick = () => { lastSum = ""; start("shadow"); };
    root.querySelector("#pp-only-dict").onclick = () => { lastSum = ""; start("dict"); };
    const hb = root.querySelector("#pp-hard"); if (hb) hb.onclick = () => { lastSum = ""; start(null, true); };
    root.querySelector("#pp-gear").onclick = () => window.openVocabSettings && window.openVocabSettings();
    const sx = root.querySelector("#pp-sumx"); if (sx) sx.onclick = () => { lastSum = ""; home(); };
    root.querySelector("#pp-quiz").onchange = e => { opt.quiz = e.target.checked; LS("pump:opt", opt); home(); }; // 关了「测验」：只听不考
    const rs0 = root.querySelector("#pp-reset"); if (rs0) rs0.onclick = () => { opt = JSON.parse(JSON.stringify(DEF)); LS("pump:opt", opt); home(); };
    root.querySelector("#pp-recall").onchange = e => { opt.recall = e.target.checked; LS("pump:opt", opt); home(); };
    root.querySelector("#pp-dict").onchange = e => { opt.dict = e.target.checked; LS("pump:opt", opt); home(); };
    root.querySelector("#pp-shadow").onchange = e => { opt.shadow = e.target.checked; LS("pump:opt", opt); home(); };
    root.querySelector("#pp-gfill").onchange = e => { opt.gfill = e.target.checked; if (opt.gfill && !opt.types.includes("pattern")) opt.types = opt.types.concat("pattern"); LS("pump:opt", opt); home(); };
    root.querySelector("#pp-sugg").onchange = e => { opt.sugg = e.target.checked; LS("pump:opt", opt); home(); };
    root.querySelector("#pp-listen").onchange = e => { opt.listen = e.target.checked; LS("pump:opt", opt); home(); }; // 关了「练习」：只考不听（同 PhrasePump，和「测验」互不影响）
    if (!EXT) medMap().then(() => { if (!playing && root.classList.contains("on")) home(); }); // 插件数据到了：刷新推荐生词、标签
    root.querySelectorAll(".pp-seg").forEach(g => g.onclick = e => { const b = e.target.closest("b"); if (!b) return; const k = g.dataset.k, v = b.dataset.v;
      if (k === "types") { opt.types = opt.types.includes(v) ? opt.types.filter(x => x !== v) : opt.types.concat(v); if (!opt.types.length) opt.types = ["word"]; } else if (k === "dir") opt.dir = v; else if (k === "tags") opt.tags = opt.tags.includes(v) ? opt.tags.filter(x => x !== v) : opt.tags.concat(v); else opt[k] = +v;
      LS("pump:opt", opt); home(); });
  }
  // only = "shadow" / "dict"：只练跟读 / 只练听写（练习页左边的快捷按钮），这一轮每个词只出这一种卡
  function start(only, hard) {
    hardOnly = !!hard; const p = plan(); hardOnly = false; if (!p.queue.length) { if (hard) toast("现在没有难词 👍"); return; } const S = srs(); cards = []; at = 0; bad = 0; playing = true; if (window.NAV) NAV.mark();
    medMap().then(() => { prefetch(0); const c = cards[at]; if (c && playing) medFor(c.w).then(() => { if (playing && cards[at] === c && medOf(c)) show(); }); }); // 原声截图在后台取，取到之前先用朗读；取到了重画当前卡片
    p.list.forEach(w => {
      const r = S[w.id], wasNew = !r, x0 = seen(r), sp = spec(w), base = { w, wasNew, x0, m0: mastery(r, w), rev: 0 }; // x0：这一轮开始前练过几轮；m0：开始前的掌握进度
      if (w.sg) { const exs = [{ en: String((EXT.sugg[w.word] || {}).t || w.word), zh: "" }].concat((SENT[w.word] || []).map(x => ({ en: x.en, zh: x.zh }))).slice(0, sp.listen || 1); exs.forEach((x, i) => cards.push(Object.assign({ s: { en: mark(x.en, w), zh: x.zh, src: i ? "tatoeba" : "video" }, i, gi: i, gc: exs.length, k: "sugg" }, base))); return; } // 建议：一组「想学这个新词吗？」，每句例句一张
      if (sp.gfill) { const L = clozes(w), x = L[Math.floor(Math.random() * L.length)]; cards.push(Object.assign({ s: { en: String(x[0]), zh: String(x[1] || "") }, i: 0, k: "gfill" }, base)); return; } // 语法填空：规律的例句，把 {} 里的部分挖掉，自己打出来
      const extra = () => { // 听写、跟读：各用一句（优先保存时的原句，太长的换短一点的）
        const L = sentences(w).concat((SENT[String(w.word || "").toLowerCase().trim()] || []).map(x => ({ en: x.en, zh: x.zh, src: "tatoeba" }))), pick = L.find(x => plain(x.en).split(/\s+/).length <= 16) || L[0];
        if ((sp.dict || only === "dict") && pick) cards.push(Object.assign({ s: { en: mark(pick.en, w), zh: pick.zh, src: pick.src }, i: 0, k: "dict" }, base));
        if ((sp.shadow || only === "shadow") && pick) cards.push(Object.assign({ s: { en: mark(pick.en, w), zh: pick.zh, src: pick.src }, i: 0, k: "shadow" }, base));
      };
      if (sp.quiz) { const o = sentences(w)[0]; cards.push(Object.assign({ s: { en: mark(o.en, w), zh: o.zh, orig: true }, i: 0, k: "quiz" }, base)); extra(); return; } // 一道填空，用保存时的原句
      if (sp.recall) cards.push(Object.assign({ s: { en: hasEn(w) ? w.word : "", zh: w.zh || "" }, i: -1, k: "recall" }, base)); // 认词卡
      (sp.listen ? listenSet(w, sp.listen) : []).forEach((x, i) => cards.push(Object.assign({ s: { en: mark(x.en, w), zh: x.zh, orig: x.orig, src: x.src }, i, k: "listen" }, base)));
      extra();
    });
    const RANK = { quiz: 0, gfill: 0, sugg: 1, dict: 3, shadow: 4 }; cards = cards.map((c, i) => ({ c, i })).sort((a, b) => (RANK[a.c.k] ?? 2) - (RANK[b.c.k] ?? 2) || a.i - b.i).map(o => o.c); // 顺序同 PhrasePump：测验 → 建议 → 练习；我们加的听写、跟读放在听完之后
    if (only) cards = cards.filter(c => c.k === only);
    if (only && !cards.length) { playing = false; toast("现在没有能" + (only === "shadow" ? "跟读" : "听写") + "的句子"); home(); return; }
    cards.forEach((c, i) => { c.last = !cards.slice(i + 1).some(x => x.w.id === c.w.id); });
    if (only) { enter(); return; } // 只练跟读 / 听写：不补额外句子
    // 名额还有剩：例句库的额外句子补满（不记进度，同 PhrasePump 的 pump）
    if (p.pump && (!window.VL || window.VL === "en")) U.json("/api/sent?pump=" + p.pump).then(j => { if (!playing) return; (j.items || []).forEach((x, i) => cards.push({ w: { id: "pump_" + i, word: "", zh: "", pump: 1 }, s: { en: x.en, zh: x.zh, src: "tatoeba" }, i: 0, k: "listen", last: true, rev: 0 })); if (cards[at]) show(); });
    enter();
  }
  function grade(c, ok) {
    if (c.done) return; c.done = true; c.ok = ok; if (!ok) bad++;
    if (c.w.sg || c.w.pump) return; // 建议、额外句子：不记进度
    if (c.k !== "listen" && c.k !== "shadow") logDay(ok ? { ok: 1 } : { fail: 1 }); if (c.wasNew && c.last) logDay({ nw: 1 });
    const S = srs(), id = c.w.id, r = Object.assign({ n: 0 }, S[id]), now = Date.now();
    const lapsed = cards.some(x => x !== c && x.w.id === id && x.done && !x.ok); // 这一轮前面已经错过一张（已经按「忘了」算过）
    r.n++;
    const upd = res => { // 用 Ebisu 更新这个词的模型，按「记得的概率降到 50%」排下次
      const prev = S[id], m0 = ebOf(prev), tnow = prev && prev.at ? (now - prev.at) / DAY : 0;
      const m = !prev || !(prev.e || prev.s || prev.b) ? (res ? EB_INIT.slice() : [3, 3, 0.25]) : ebUpdate(m0, res, tnow); // 新词：第一轮只是初始化（同 LR 第一次见），第一轮就忘了的半衰期先按 6 小时
      const h = ebDecay(m, 0.5); delete r.s; delete r.d;
      Object.assign(r, { e: m.map(x => +x.toFixed(4)), h: +h.toFixed(3), at: now, due: now + ebDecay(m, DUE_R) * DAY, b: levelOf(h) });
      if (h >= KNOWN_H) { const was = state.progress[id] === "known"; state.progress[id] = "known"; if (!was) { c.w.justKnown = true; toast("🏆 「" + c.w.word + "」已掌握！"); } }
    };
    if (!ok && !lapsed) { r.f = (r.f || 0) + 1; upd(0); }        // 忘了：马上按「忘了」更新（半衰期变短）；f = 一共忘过几次（🔥 难词用）
    const nL = cards.filter(x => x.w.id === id && x.k === "listen").length; // 这一轮被动听了几张
    if (ok && c.last && !lapsed) { upd(1); r.x = (c.x0 || 0) + nL; } // 这一轮都对：按「记得」更新
    else if (c.last && lapsed) r.x = (c.x0 || 0) + nL;
    S[id] = r; save(state);
  }

  // 人工翻译（视频自带）和机器翻译不一样时两行都给（同插件复习页的 H / M）
  const zhHtml = c => { const m = medOf(c), hu = m && m.hu ? String(m.hu).trim() : "", zh = String(c.s.zh || (m && m.tr) || "").trim(); return hu && zh && hu !== zh ? '<span class="hm">H</span>' + esc(hu) + '<br><span class="hm">M</span>' + esc(zh) : esc(hu || zh); };
  // 句子按词汇水平上色（和视频字幕、插件一样），目标词照旧带框
  function colorEn(c) {
    const el = root.querySelector("#pp-en"); if (!el) return; const h = WORD.html(plain(c.s.en)); // 🎨 全站共用的上色（word.js）；插件模块还没加载好时先不上色，加载好发 word-change 再画
    const pre = (c.s.en.split("{")[0].match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length, m = c.s.en.match(/\{([^}]+)\}/), len = m ? (m[1].match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length : 0;
    el.innerHTML = h; const ws = el.querySelectorAll(".vs-w"); for (let i = pre; i < pre + len && i < ws.length; i++) ws[i].classList.add("t");
  }
  // 其它卡片里的英文也能停留查词（测验的填空句、认词卡翻过来的词和例句、建议的词、语法填空）：只给纯英文的文字上色，
  // 中文、按钮、输入框、还没揭开的空格不动；认词卡正面不上（一停就看到意思，等于偷看答案）
  function colorText(el) {
    if (!el || el.__wdc === el.innerHTML) return;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (!/[A-Za-z]/.test(n.nodeValue) || /[\u3400-\u9fff]/.test(n.nodeValue) || n.parentNode.closest(".vs-w, button, input, textarea, .pp-gap:not(.on), kbd, .rc-q") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const L = []; while (tw.nextNode()) L.push(tw.currentNode);
    L.forEach(n => { const t = document.createElement("template"); t.innerHTML = WORD.html(n.nodeValue); n.replaceWith(t.content); });
    el.__wdc = el.innerHTML;
  }
  function colorAll(c) { // 🎨 这张卡片上的英文都上色、都能停留查词（同 Language Reactor 练习）
    if (!c || !root) return; colorEn(c);
    root.querySelectorAll(".pp-en:not(#pp-en), .pp-sgw > b" + (c.k !== "recall" || c.flip ? ", .pp-rc .rc-ex, .pp-rc .rc-w" : "")).forEach(colorText);
  }
  // 推荐生词收进生词本：查释义生成词条（同网站视频页），并告诉插件「将要学习」
  async function addSugg(c, silent) {
    const w = c.w.word, sg = EXT.sugg[w] || {};
    if ((await WORD.add(w, { sent: sg.t || "", silent: true, learn: false, from: "背单词·推荐生词" })) == null) { toast("收进生词本失败"); return; } // 全站共用的加词（word.js）；「将要学习」下面自己告诉插件
    EXT.saved.add(w); c.w.added = true; cards.forEach(x => { if (x.w.word === w) x.w.added = true; });
    await CLOUD.chan("ext").send({ ["saved|" + w]: { v: w, at: Date.now() } }); // 全站共用的同步（cloud.js）
    if (!silent) toast("已收进生词本：" + w);
  }
  const sayText = t => { try { speak(t, { rate: opt.speed }); } catch (e) {} }; // speak() 在 index.html：先 AI 真人声（tts.js），不行再系统语音
  const say = c => { try { if (window.TTS) TTS.hush(); if (player) { player.pause(); player = null; } const m = medOf(c); if (m && m.aud) { player = MEDIA.play(m.aud, { rate: opt.speed, fail: () => sayText(plain(c.s.en)) }); return; } /* 全站共用的放音（media.js）；放不出来就朗读 */ sayText(plain(c.s.en)); } catch (e) {} };
  const imgs = c => { const m = medOf(c), L = m ? [m.img, m.img2].filter(Boolean) : []; return L.length ? '<div class="pp-img">' + L.map(u => '<img src="' + esc(u) + '" alt="">').join("") + "</div>" : ""; };
  function show() {
    if (at >= cards.length) return finish();
    const c = cards[at], pct = (at + 1) / cards.length * 100; prefetch(at);
    if (MED && MED[String(c.w.word || "").toLowerCase().trim()] && !(MED[String(c.w.word).toLowerCase().trim()] in medRec)) medFor(c.w).then(() => { if (cards[at] === c && medOf(c)) show(); }); // 原声截图到了：重画这张卡片
    const mNow = c.w.sg || c.w.pump ? null : mastery(srs()[c.w.id], c.w), known = c.w.justKnown || (mNow != null && mNow >= 1);
    const prog = mNow == null ? "" : '<div class="pp-prog' + (known ? " known" : "") + '" title="这个词的掌握进度：半衰期到 42 天（6 周）算已掌握">' + (known ? "🏆 已掌握" : "掌握进度") + mbar(mNow, known) + "<b>" + pcent(mNow) + "%</b>" + (c.done && mNow > (c.m0 || 0) + 0.005 ? '<em>+' + (pcent(mNow) - pcent(c.m0 || 0)) + "%</em>" : "") + "</div>";
    const typ = x => (x.k === "quiz" || x.k === "gfill" || x.k === "dict" ? "t" : x.k === "sugg" ? "p" : "e"), segs = ["t", "p", "e"].map(k => ({ k, n: cards.filter(x => typ(x) === k).length, d: cards.filter((x, i) => typ(x) === k && (i < at || x.done)).length })).filter(g => g.n);
    const bar = '<div class="pp-segbar" title="测验 / 建议 / 练习">' + segs.map(g => '<span class="sg-' + g.k + '" style="flex:' + g.n + '"><i style="width:' + (g.d / g.n * 100) + '%"></i></span>').join("") + "</div>";
    const top = '<div class="pp-top"><button id="pp-back">← 返回</button>' + bar + "<span>" + (at + 1) + "/" + cards.length + '</span><button class="tb" id="pp-gear2" title="设置：朗读语音、导出">⚙</button><button class="tb" id="pp-keys" title="快捷键">⌨</button><button class="tb" id="pp-speed" title="播放速度">' + (opt.speed === 1 ? "1x" : opt.speed + "x") + "</button></div>" + prog;
    root.classList.toggle("pp-known", !!known); // 已掌握的词：卡片换成金色
    const ctl = (k) => '<div class="pp-ctl"><div><button id="pp-a" title="上一个"' + (at ? "" : " disabled") + '>‹</button><kbd>A</kbd></div><div><button id="pp-s" title="重听">↻</button><kbd>S</kbd></div><div><button id="pp-e" title="' + (k === "quiz" ? "看答案" : k === "recall" ? "翻开" : "显示") + '"' + ((k === "listen" && c.rev >= 2) || (k === "quiz" && (c.done || c.rev >= 1)) || (k === "recall" && c.flip) || k === "sugg" || k === "shadow" || ((k === "dict" || k === "gfill") && c.done) ? " disabled" : "") + '>👁</button><kbd>E</kbd></div><div><button id="pp-d" class="pri' + ((k === "quiz" || k === "dict" || k === "gfill" || (k === "recall" && c.flip)) && !c.done ? " wait" : "") + '" title="下一个">›</button><kbd>D</kbd></div></div>';
    const first = c.wasNew && !c.w.sg && !c.w.pump ? '<span class="pp-first" title="第一次练这个词">🌱</span>' : "";
    const def = c.w.zh ? '<div class="pp-def' + (c.k === "listen" && c.rev < 2 ? " hid" : "") + '">' + esc(c.w.word) + "：" + esc(c.w.zh) + "</div>" : "";
    if (c.k === "recall") {
      const w = c.w, zhFirst = opt.dir === "zh" && w.zh, big = t => '<div class="rc-w' + (String(t).length > 24 ? " long" : "") + '">' + t + "</div>";
      const front = zhFirst ? big(esc(w.zh)) + '<div class="rc-q">想一想英文怎么说</div>' : big(esc(plain(w.word))) + (w.phon ? '<div class="rc-p">' + esc(w.phon) + "</div>" : "") + '<div class="rc-q">想一想是什么意思</div>';
      const ex = (w.examples || []).filter(x => Array.isArray(x) && x[0]).slice(0, 2), fm = (w.forms || []).slice(0, 6);
      const back = big(esc(plain(w.word))) + (w.phon ? '<div class="rc-p">' + esc(w.phon) + "</div>" : "") + '<div class="rc-zh">' + esc(w.zh || "") + "</div>" + (w.en ? '<div class="rc-en">' + esc(w.en) + "</div>" : "") +
        (fm.length ? '<div class="rc-fm">' + fm.map(x => "<div><b>" + esc(x[0]) + "</b> <span>" + esc(x[1] || "") + "</span> " + esc(x[2] || "") + "</div>").join("") + "</div>" : "") +
        (ex.length ? '<div class="rc-ex">' + ex.map(x => "<div>" + html(String(x[0])) + "<span>" + esc(x[1] || "") + "</span></div>").join("") + "</div>" : "") + (w.tip ? '<div class="rc-tip">🧠 ' + esc(w.tip) + "</div>" : "");
      root.innerHTML = top + '<div class="pp-hint"><b>🃏 认词</b>' + (c.flip ? (c.done ? (c.ok ? "认识 ✓" : "忘了：半衰期变短，很快会再练") : "记得吗？自己判断：忘了按 Z，记得按 C") : "先回想，再点卡片或按 E 翻开") + '</div><div class="pp-card pp-rc' + (c.flip ? " back" : "") + '" id="pp-rc"><button class="pl" id="pp-pl" title="朗读">▶</button><button class="cp" id="pp-cp">复制</button><button class="st" id="pp-star" title="收藏这句（R）">☆</button>' + (c.flip ? back : front) + "</div>" +
        (c.flip && !c.done ? '<div class="pp-rate"><button id="pp-no"><kbd>Z</kbd>忘了</button><button id="pp-yes"><kbd>C</kbd>记得</button></div>' : "") + ctl("recall");
      root.querySelector("#pp-rc").onclick = e => { if (e.target.closest("button")) return; flip(c); };
      if (c.flip && !c.done) { root.querySelector("#pp-no").onclick = () => rate(c, false); root.querySelector("#pp-yes").onclick = () => rate(c, true); }
    } else if (c.k === "listen") {
      root.innerHTML = top + '<div class="pp-hint"><b>🔊 听力练习</b>在展示文本之前试着理解。</div><div class="pp-card"><button class="pl" id="pp-pl" title="播放">▶</button><button class="cp" id="pp-cp">复制</button><button class="st" id="pp-star" title="收藏这句（R）">☆</button>' + imgs(c) +
        '<div class="pp-en' + (c.rev < 1 ? " hid" : "") + '" id="pp-en">' + html(c.s.en) + '</div><div class="pp-zh' + (c.rev < 2 ? " hid" : "") + '" id="pp-zh">' + zhHtml(c) + "</div>" + def + "" + first + '<span class="pp-chip">' + (c.w.pump ? "额外练习" : esc(c.w.word)) + "</span></div>" + ctl("listen");
      if (!c.done && !c.w.pump) grade(c, true); // 一显示就记一次「听过」（同 PhrasePump）
      if (!c.spoken) { c.spoken = true; c.medSaid = !!medOf(c); say(c); } else if (medOf(c) && !c.medSaid) { c.medSaid = true; say(c); } // 原声晚到：用原声再放一遍
      const en0 = root.querySelector("#pp-en"), zh0 = root.querySelector("#pp-zh");
      en0.onclick = en0.onmouseenter = () => { if (c.rev < 1) { c.rev = 1; show(); } };
      zh0.onclick = zh0.onmouseenter = () => { if (c.rev < 2) { c.rev = 2; show(); } };
      colorEn(c);
    } else if (c.k === "sugg") { // 🌱 建议的单词：你想学这个新词吗？已知 / 学习 / 跳过（同 PhrasePump）
      const w = c.w, rk = window.VS_RANK && (window.VS_RANK[w.word] || (typeof vsLemma === "function" && window.VS_RANK[vsLemma(w.word)]));
      if (!(w.word in SUGZH)) { SUGZH[w.word] = null; TR.word(w.word).then(r => { SUGZH[w.word] = r.zh.slice(0, 4).join("；"); if (cards[at] === c) show(); }); } // 全站共用的翻译（tr.js）
      const lab = { known: "已知", learn: "学习", skip: "跳过" };
      if (!w.stage) { w.stage = "learn"; addSugg(c, true); } // 一显示就自动标成「学习」（同 PhrasePump）；要不学就点已知 / 跳过改掉
      root.innerHTML = top + '<div class="pp-hint"><b>🌱 建议的单词</b>你想学习这个新词吗？</div><div class="pp-sgw"><b>' + esc(w.word) + "</b>" + (rk ? "<small>词频 #" + rk + "</small>" : "") + (SUGZH[w.word] ? '<div class="z">' + esc(SUGZH[w.word]) + "</div>" : "") + "</div>" +
        '<div class="pp-card"><button class="pl" id="pp-pl" title="播放">▶</button><button class="cp" id="pp-cp">复制</button><button class="st" id="pp-star" title="收藏这句（R）">☆</button><div class="pp-en" id="pp-en">' + html(c.s.en) + "</div>" + (c.s.zh ? '<div class="pp-zh">' + esc(c.s.zh) + "</div>" : "") + (c.gc > 1 ? '<div class="pp-dots">' + Array.from({ length: c.gc }, (x, i) => '<i class="' + (i === c.gi ? "on" : "") + '"></i>').join("") + "</div>" : "") + '<span class="pp-chip">建议</span></div>' +
        '<div class="pp-stage">' + ["known", "learn", "skip"].map((k, i) => '<button data-st="' + k + '" class="' + k + (w.stage === k ? " on" : "") + '"><kbd>' + "ZXC"[i] + "</kbd>" + lab[k] + "</button>").join("") + "</div>" + ctl("sugg");
      if (!c.spoken) { c.spoken = true; say(c); }
      colorAll(c);
      root.querySelectorAll(".pp-stage button").forEach(b => (b.onclick = () => chooseSugg(c, b.dataset.st)));
    } else if (c.k === "dict" || c.k === "gfill" || c.k === "shadow") { cardX(c, top, ctl, def, first);
    } else { // ❔ 测验：填空。看翻译找提示。目标词先遮住，按 E 看答案，再点「忘了 / 记得」（同 PhrasePump，不用打字）
      const m = c.s.en.match(/\{([^}]+)\}/), ans = m ? m[1] : "", parts = c.s.en.split(/\{[^}]+\}/), shown = c.rev >= 1;
      root.innerHTML = top + '<div class="pp-hint"><b>❔ 测验</b>填空。看翻译找提示。</div><div class="pp-card"><button class="pl" id="pp-pl" title="播放（会念出答案）">▶</button><button class="cp" id="pp-cp">复制</button><button class="st" id="pp-star" title="收藏这句（R）">☆</button>' + imgs(c) +
        '<div class="pp-en">' + esc(parts[0]) + '<span class="pp-gap' + (shown ? " on" : "") + '" id="pp-gap" title="' + (shown ? "" : "点一下看答案") + '">' + esc(ans) + "</span>" + esc(parts.slice(1).join("")) + '</div><div class="pp-zh">' + zhHtml(c) + "</div>" +
        (shown ? def : "") + first + '<span class="pp-chip">' + (shown ? esc(c.w.word) : "？") + "</span></div>" +
        '<div class="pp-rate forgot-okay-buttons"><button id="pp-fail"' + (c.done ? " disabled" : "") + (c.done && !c.ok ? ' class="pressed"' : "") + '><kbd>Z</kbd>忘了</button><button id="pp-ok"' + (c.done ? " disabled" : "") + (c.done && c.ok ? ' class="pressed"' : "") + '><kbd>C</kbd>记得</button></div>' + ctl("quiz");
      const g0 = root.querySelector("#pp-gap"); g0.onclick = () => revealQuiz(c); g0.parentNode.onmouseenter = () => revealQuiz(c);
      if (!c.done) { root.querySelector("#pp-fail").onclick = () => rate(c, false); root.querySelector("#pp-ok").onclick = () => rate(c, true); }
    }
    root.querySelector("#pp-back").onclick = () => { stopAudio(); if (window.NAV) NAV.back(home); else home(); }; // 回到上一个页面
    root.querySelector("#pp-gear2").onclick = () => window.openVocabSettings && window.openVocabSettings();
    root.querySelector("#pp-speed").onclick = () => { opt.speed = opt.speed === 1 ? 0.75 : opt.speed === 0.75 ? 0.5 : 1; LS("pump:opt", opt); show(); say(c); }; // 同 RL：1x → 0.75x → 0.5x
    root.querySelector("#pp-keys").onclick = () => { const k = root.querySelector(".pp-keyhelp"); if (k) return k.remove(); const d = document.createElement("div"); d.className = "pp-keyhelp"; d.innerHTML = "<b>快捷键</b>" + [["A / ←", "上一个"], ["S / ↓ / 空格", "播放"], ["E", "显示（听力：先原文、再翻译）/ 看答案（测验）"], ["D / →", "下一个"], ["Z / C", "测验：忘了 / 记得"], ["Z / X / C", "建议：已知 / 学习 / 跳过"], ["R", "收藏这句（☆）"]].map(x => "<div><kbd>" + x[0] + "</kbd>" + x[1] + "</div>").join(""); d.onclick = () => d.remove(); root.querySelector(".pp-top").after(d); };
    root.querySelector("#pp-pl").onclick = root.querySelector("#pp-s").onclick = () => say(c);
    root.querySelector("#pp-cp").onclick = () => { U.copy(plain(c.s.en)); }; /* 📋 全站共用（util.js） */
    root.querySelector("#pp-a").onclick = () => go(-1); root.querySelector("#pp-d").onclick = () => go(1);
    if (c.k === "recall" || c.k === "quiz" || c.k === "gfill" || c.k === "dict") colorAll(c); // 测验 / 认词 / 语法填空 / 听写的英文也能停留查词
    const st0 = root.querySelector("#pp-star"); if (st0) { const on = starred(c); st0.textContent = on ? "★" : "☆"; st0.classList.toggle("on", on); st0.onclick = e => { e.stopPropagation(); toggleStar(c); }; }
    const chip = root.querySelector(".pp-chip"); if (chip) chip.title = srcOf(c); // 鼠标停在右下角：例句出处（同 RL）
    root.querySelector("#pp-e").onclick = () => (c.k === "listen" ? reveal(c) : c.k === "recall" ? flip(c) : c.k === "quiz" ? revealQuiz(c) : c.k === "dict" || c.k === "gfill" ? giveUp(c) : null);
  }
  // ☆ 收藏这句（同 RL 的星标 / R 键）：存进插件的「收藏的句子」（插件、网站同一份），并在生词本里加一条句子词条
  const sentText = c => plain(c.s.en).replace(/\s+/g, " ").trim();
  const starred = c => !!(EXT && c.s && c.s.en && EXT.sents.has(sentText(c).toLowerCase()));
  async function toggleStar(c) {
    if (!EXT || !c.s || !c.s.en) return; const t = sentText(c), lt = t.toLowerCase(), k0 = EXT.sents.get(lt), now = Date.now();
    const id0 = "v_" + lt.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 70), post = ch => CLOUD.chan("ext").send(ch);
    state.custom = state.custom || [];
    if (k0) { EXT.sents.delete(lt); post({ ["savedSents|" + k0]: { del: 1, at: now } }); const e = state.custom.find(x => x && x.type === "sentence" && (x.id === id0 || String(x.word || "").toLowerCase() === lt)); if (e) { state.custom = state.custom.filter(x => x !== e); state.deleted = (state.deleted || []).concat(e.id); } toast("已取消收藏这句"); }
    else { const k = "web|" + lt.replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90); EXT.sents.set(lt, k); post({ ["savedSents|" + k]: { v: { k, t, tr: c.s.zh || "", at: now, v: "", s: 0 }, at: now } }); if (!state.custom.some(x => x && (x.id === id0 || String(x.word || "").toLowerCase() === lt))) state.custom.push({ id: window.freshId ? window.freshId(id0) : id0, type: "sentence", word: t, phon: "", en: "", zh: c.s.zh || "(未查到，可手动补)", tag: "练习", date: window.ymdLocal ? window.ymdLocal() : today(), forms: [], examples: [], tip: "" }); toast("已收藏这句"); }
    if (typeof refresh === "function") refresh(); save(state); show();
  }
  function srcOf(c) { // 例句出处（同 RL 卡片右下角的提示）
    const m = medOf(c); if (m) return "保存于 YouTube：" + (m.title || "") + (m.ch ? "（" + m.ch + "）" : "");
    if (c.w.pump) return "额外练习句子 · 例句来源：Tatoeba CC-BY";
    if (c.s && c.s.src === "tatoeba") return "例句来源：Tatoeba CC-BY";
    if (c.s && c.s.src === "video") return "看过的视频里的句子";
    return "生词本里的例句";
  }
  function revealQuiz(c) { if (c.k !== "quiz" || c.rev >= 1) return; c.rev = 1; show(); say(c); } // 看答案：念出整句
  function rate(c, ok) { // 忘了 / 记得：按钮亮一下，记下来，马上翻下一张（同 PhrasePump）；刚练成已掌握时金色停 1 秒
    if (c.done) return; const b = root.querySelector(ok ? "#pp-ok,#pp-yes" : "#pp-fail,#pp-no"); if (b) b.classList.add("pressed");
    grade(c, ok); const me = c, wait = c.w.justKnown ? 1100 : 300; if (c.w.justKnown) show();
    setTimeout(() => { if (cards[at] === me && playing) go(1); }, wait);
  }
  // 建议：已知 = 标为已掌握（插件里也变白）；学习 = 收进生词本（插件里带框）；跳过 = 标为不学习（同插件右键）
  async function chooseSugg(c, st) {
    const w = c.w, word = w.word, prev = w.stage; if (prev === st && st === "learn") return;
    w.stage = st; c.done = true; show();
    const at0 = Date.now(), post = ch => CLOUD.chan("ext").send(ch);
    if (st === "learn") { delete EXT.marks[word]; await addSugg(c, true); post({ ["marks|" + word]: { del: 1, at: at0 } }); }
    else {
      EXT.marks[word] = st === "known" ? "known" : "ignore"; EXT.saved.delete(word);
      const e = (state.custom || []).find(x => x && String(x.word || "").toLowerCase() === word); // 自动标「学习」时加进生词本的词条：已知 → 标为已掌握；跳过 → 删掉
      if (e) { if (st === "known") { state.progress = state.progress || {}; state.progress[e.id] = "known"; } else { state.custom = state.custom.filter(x => x !== e); state.deleted = (state.deleted || []).concat(e.id); } if (typeof refresh === "function") refresh(); save(state); }
      post({ ["marks|" + word]: { v: EXT.marks[word], at: at0 }, ["saved|" + word]: { del: 1, at: at0 } });
      toast(word + " → " + lab2[st]);
      countCard(c); let j = at + 1; while (cards[j] && cards[j].w === w) j++; // 跳过这个词剩下的例句
      if (j >= cards.length) return finish(); stopAudio(); at = j; enter();
    }
  }
  const lab2 = { known: "已知", learn: "学习", skip: "跳过（不学习）" };
  function flip(c) { if (c.flip) return; c.flip = true; show(); if (c.s.en) say(c); } // 翻开认词卡，顺便念一下
  function reveal(c) { if (c.k !== "listen") return; c.rev = Math.min(2, c.rev + 1); show(); }
  const stopAudio = () => { try { if (window.TTS) TTS.hush(); else speechSynthesis.cancel(); if (player) player.pause(); } catch (e) {} recStop(true); };
  function enter() { // 进入当前卡：重新盖上，非测验卡自动播放（同 PhrasePump：换卡时 blur 回到 HIDE_BOTH、测验回到 SHOW_GAP）
    const c = cards[at]; if (!c) return finish(); c.rev = 0; c.spoken = true; c.medSaid = !!medOf(c);
    if (c.k === "recall") c.flip = c.done ? c.flip : false;
    show(); if (c.k !== "quiz" && c.k !== "recall" && c.k !== "gfill") say(c);
    if (c.k === "dict" || c.k === "gfill") { const i = root.querySelector("#pp-in"); if (i) setTimeout(() => i.focus(), 50); }
  }
  function go(d) {
    const c = cards[at]; if (!c) return;
    if (d > 0) {
      if ((c.k === "quiz" || c.k === "dict" || c.k === "gfill" || (c.k === "recall" && c.flip)) && !c.done) { const r = root.querySelector(".pp-rate"); if (r && r.animate) r.animate([{ opacity: 1 }, { opacity: .5 }, { opacity: 1 }, { opacity: .5 }, { opacity: 1 }, { opacity: .5 }, { opacity: 1 }], { duration: 800 }); return; } // 还没评：不让翻，按钮闪（同 PhrasePump 的 NOT_ALLOWED）
      if (c.k === "recall" && !c.flip) { flip(c); return; } // 认词卡（我们加的）：先翻开
      countCard(c);
      if (at + 1 >= cards.length) { stopAudio(); return finish(); } // 最后一张：回到首页（同 PhrasePump）
    } else if (at === 0) return;
    stopAudio(); at += d; enter();
  }
  // ---------- 听写 / 语法填空 / 跟读（我们加的）----------
  // 逐词对比、分词：全站共用的 rec.js（REC.score / REC.toks）；听写是打字，不放宽（near:false）
  const toks = t => REC.toks(t);
  const align = (target, said, speech) => REC.score(target, said, { near: !!speech });
  const diffHtml = r => r.a.map((w, i) => '<span class="' + (r.hit[i] ? "ok" : "no") + '">' + esc(w) + "</span>").join(" ") + (r.extra.length ? '<div class="x">多了：' + r.extra.map(esc).join(" ") + "</div>" : "");
  const gans = c => (String(c.s.en).match(/\{([^}]+)\}/) || [])[1] || "";
  const same = (x, y) => { const f = t => toks(t).join(" "); return String(y).split(/\s*\/\s*/).some(alt => f(x) === f(alt)); }; // 语法填空：大小写、标点不算；答案里有 a / b 的都算对
  function check(c) {
    if (c.done) return; const inp = root.querySelector("#pp-in"), v = inp ? inp.value.trim() : ""; if (!v) { if (inp) inp.focus(); return; }
    c.typed = v;
    if (c.k === "dict") { c.res = align(plain(c.s.en), v); grade(c, c.res.score >= 0.8); } else grade(c, same(v, gans(c)));
    show(); say(c);
  }
  function giveUp(c) { if (c.done) return; c.typed = c.typed || ""; if (c.k === "dict") c.res = align(plain(c.s.en), ""); grade(c, false); show(); say(c); }
  // 跟读：全站共用的 rec.js（REC）。录音 → 后台 /api/stt（Workers AI 的 Whisper）转文字；后台没开 AI 时用浏览器自带的语音识别（Chrome / Edge / Safari；Brave 不行）
  const SR = REC.SR, PK = "pump";
  function recStop(cancel) { if (REC.cur() === PK) REC.stop(cancel); }
  function recStart(c) {
    REC.toggle(PK, { max: 20, before: stopAudio, // 最长 20 秒
      start: () => { c.recOn = true; c.said = null; show(); },
      cancel: () => { c.recOn = false; },
      busy: () => { c.recOn = false; c.busy = true; if (cards[at] === c) show(); },
      done: y => recDone(c, y) });
  }
  function recDone(c, y) {
    if (y.url) { try { if (c.myUrl) URL.revokeObjectURL(c.myUrl); } catch (e) {} c.myUrl = y.url; }
    if (y.noai) c.noai = true;
    const text = y.text;
    c.busy = false; c.said = text; c.res = align(plain(c.s.en), text, true);
    c.best = Math.max(c.best || 0, c.res.score);
    if (cards[at] === c) show();
    if (!text) toast(c.noai && !SR ? "转文字没开：在 Cloudflare 打开 Workers AI，或换 Chrome / Safari" : "没听清，再读一次");
  }
  function cardX(c, top, ctl, def, first) { // 画听写 / 语法填空 / 跟读卡
    const head = '<button class="pl" id="pp-pl" title="播放' + (c.k === "gfill" ? "（会念出答案）" : "") + '">▶</button><button class="cp" id="pp-cp">复制</button><button class="st" id="pp-star" title="收藏这句（R）">☆</button>';
    const chip = '<span class="pp-chip">' + (c.k === "gfill" && !c.done ? "？" : esc(c.w.word)) + "</span>";
    if (c.k === "dict") {
      root.innerHTML = top + '<div class="pp-hint"><b>✍️ 听写</b>' + (c.done ? (c.ok ? "对了 " + pcent(c.res.score) + "% ✓" : "对了 " + pcent(c.res.score) + "%：到 80% 才算记得") : "只听声音，把整句打出来（S 重听，Enter 检查，E 看答案）") + '</div><div class="pp-card">' + head + imgs(c) +
        (c.done ? '<div class="pp-diff">' + diffHtml(c.res) + '</div><div class="pp-en" id="pp-en">' + html(c.s.en) + '</div><div class="pp-zh">' + zhHtml(c) + "</div>" + def
          : '<textarea id="pp-in" class="pp-dt" rows="2" placeholder="听到什么就打什么，标点、大小写不用管" autocomplete="off" autocapitalize="off" spellcheck="false">' + esc(c.typed || "") + '</textarea><div class="pp-xrow"><button id="pp-chk" class="pp-btn">检查 <kbd>Enter</kbd></button></div>') + first + chip + "</div>" + ctl("dict");
    } else if (c.k === "gfill") {
      const parts = String(c.s.en).split(/\{[^}]+\}/), ans = gans(c), wd = Math.max(4, Math.min(28, ans.length + 2));
      root.innerHTML = top + '<div class="pp-hint"><b>📐 语法填空</b>' + (c.done ? (c.ok ? "对了 ✓" : "答案是「" + esc(ans) + "」") : "按规律把空格填上（Enter 检查，E 看答案）") + '</div><div class="pp-card">' + head +
        '<div class="pp-gt">' + esc(String(c.w.word).replace(/[{}]/g, "")) + "</div>" +
        '<div class="pp-en">' + esc(parts[0]) + (c.done ? '<span class="pp-gap on' + (c.ok ? "" : " bad") + '">' + esc(ans) + "</span>" + (!c.ok && c.typed ? ' <s class="pp-mine">' + esc(c.typed) + "</s>" : "") : '<input id="pp-in" style="width:' + wd + 'ch" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.typed || "") + '">') + esc(parts.slice(1).join("")) + "</div>" +
        '<div class="pp-zh">' + esc(c.s.zh) + "</div>" + (c.done && c.w.tip ? '<div class="pp-def">💡 ' + esc(c.w.tip) + "</div>" : "") + (c.done ? "" : '<div class="pp-xrow"><button id="pp-chk" class="pp-btn">检查 <kbd>Enter</kbd></button></div>') + chip + "</div>" + ctl("gfill");
    } else {
      const r = c.res, sc = r ? pcent(r.score) : null;
      root.innerHTML = top + '<div class="pp-hint"><b>🎙 跟读</b>' + (c.recOn ? "正在录音……读完再点一下 🎙" : c.busy ? "正在识别……" : r ? "这次读对 " + sc + "%" + (c.best > r.score ? "（最好 " + pcent(c.best) + "%）" : "") : "先听原句（S 重听），再点 🎙 跟着读一遍") + '</div><div class="pp-card">' + head + imgs(c) +
        '<div class="pp-en" id="pp-en">' + html(c.s.en) + '</div><div class="pp-zh">' + zhHtml(c) + "</div>" +
        (r ? '<div class="pp-diff">' + diffHtml(r) + (c.said ? '<div class="x">听到的：' + esc(c.said) + "</div>" : "") + "</div>" : "") +
        '<div class="pp-xrow"><button id="pp-rec" class="pp-btn rec' + (c.recOn ? " on" : "") + '"' + (c.busy ? " disabled" : "") + ">🎙 " + (c.recOn ? "停止" : r ? "再读一次" : "开始跟读") + "</button>" + (c.myUrl ? '<button id="pp-mine" class="pp-btn">▶ 听我的录音</button>' : "") + "</div>" + chip + "</div>" + ctl("shadow");
      if (!c.done) grade(c, true); // 跟读和听力一样：一显示就算「听过」一次
      root.querySelector("#pp-rec").onclick = () => recStart(c);
      const mine = root.querySelector("#pp-mine"); if (mine) mine.onclick = () => { stopAudio(); player = MEDIA.play(c.myUrl); };
      colorEn(c);
    }
    const inp = root.querySelector("#pp-in");
    if (inp) inp.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); check(c); } };
    const chk = root.querySelector("#pp-chk"); if (chk) chk.onclick = () => check(c);
    if (c.done && c.k !== "shadow") { const d = root.querySelector("#pp-d"); if (d) setTimeout(() => d.focus(), 30); }
  }
  let lastSum = "";
  function finish() { // 练完一组：回到首页（同 PhrasePump）；这一组每个词的掌握进度放在首页最上面（我们加的）
    if (window.NAV && playing) NAV.back(); // 🔙 练完：退掉「练习中」那条历史，不然后退一次什么也不变
    playing = false; root.classList.remove("pp-known");
    const S = srs(), seenW = new Map(); cards.forEach(c => { if (!c.w.sg && !c.w.pump && !seenW.has(c.w.id)) seenW.set(c.w.id, c); });
    const rows = [...seenW.values()].map(c => ({ w: c.w, a: c.m0 || 0, b: mastery(S[c.w.id], c.w), k: !!c.w.justKnown })).sort((x, y) => y.k - x.k || (y.b - y.a) - (x.b - x.a));
    const newly = rows.filter(r => r.k);
    lastSum = '<div class="pp-card pp-done"><button class="x" id="pp-sumx" title="收起">✕</button><h3>这一组练完了 ' + emoji() + "</h3><p>今天一共练了 " + day.n + " 张卡片" + (bad ? "，有 " + bad + " 张忘了" : "") + "</p>" +
      (newly.length ? '<div class="pp-new">🏆 新掌握 ' + newly.length + " 个：" + newly.map(r => "<b>" + esc(r.w.word) + "</b>").join("、") + "</div>" : "") +
      (rows.length ? '<div class="pp-sum">' + rows.map(r => '<div class="row' + (r.k || r.b >= 1 ? " known" : "") + '"><span class="w">' + esc(r.w.word) + "</span>" + mbar(r.b, r.k || r.b >= 1) + '<span class="n">' + (r.k || r.b >= 1 ? "🏆 已掌握" : pcent(r.b) + "%") + (r.b > r.a + 0.005 ? " <em>+" + (pcent(r.b) - pcent(r.a)) + "%</em>" : r.b < r.a - 0.005 ? ' <em class="dn">' + (pcent(r.b) - pcent(r.a)) + "%</em>" : "") + "</span></div>").join("") + "</div>" : "") + "</div>";
    setTimeout(home, 500); // 同 PhrasePump：停半秒回首页
  }
  // ⌨️ 快捷键：全站共用的 keys.js（在练、这页看得见时；打字、查词卡片开着都不触发）
  KEYS.on("pump", { when: () => playing && !!root && root.classList.contains("on") && KEYS.visible(root) }, k => {
    const c = cards[at]; if (!c) return false;
    if (k === "d" || k === "right") go(1); else if (k === "a" || k === "left") { if (at) go(-1); } else if (k === "s" || k === "down" || k === "space") say(c); else if (k === "r") toggleStar(c); else if (k === "e") { if (c.k === "listen") reveal(c); else if (c.k === "recall") flip(c); else if (c.k === "quiz") revealQuiz(c); else if (c.k === "dict" || c.k === "gfill") giveUp(c); } else if (c.k === "quiz" && !c.done && (k === "z" || k === "c")) rate(c, k === "c"); else if (c.k === "sugg" && /^[zxc]$/.test(k)) chooseSugg(c, { z: "known", x: "learn", c: "skip" }[k]); else if (c.k === "recall" && c.flip && !c.done && (k === "z" || k === "c")) rate(c, k === "c"); else return;
    return true;
  });

  window.pumpShow = () => { if (!playing) home(); };
  // 🔥 难词（「📅 每日」的难词、每周小结用）：[{id, word, zh, f 忘过几次, n 练过几轮, h 半衰期天数}]
  window.pumpHard = () => { const S = srs(); return hardOf((typeof words !== "undefined" ? words : []).filter(w => w && w.word), S).map(w => ({ id: w.id, word: w.word, zh: w.zh || "", f: S[w.id].f || 0, n: S[w.id].n || 0, h: S[w.id].h || 0 })); };
  window.pumpStartHard = () => { if (!root) return false; if (playing) return false; lastSum = ""; start(null, true); return true; };
  window.pumpCards = () => cards.map(c => (c.w.pump ? "额外句子" : c.w.sg ? "建议" : { quiz: "填空", listen: "听力", recall: "认词", dict: "听写", shadow: "跟读", gfill: "语法填空" }[c.k])); // 检查用：这一组每张卡是什么
  window.pumpRefresh = () => { if (root && root.classList.contains("on") && !playing) home(); };
  function init() {
    root = document.getElementById("pump"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    // 卡片上英文句子里的词：全站共用的 word.js（点词查词卡片、右键循环标记，同看视频 / 插件）；标记 / 加词以后重新上色
    if (window.WORD) WORD.bind(root, { skip: el => !el.closest(".pp-en, .pp-sgw, .rc-ex, .rc-w, .hw, .pp-q") || el.closest(".hid"), sent: () => (cards[at] && cards[at].s ? plain(cards[at].s.en) : ""), quiet: () => false, onOpen: () => stopAudio(), hover: "rl" }); /* 停留：同 Language Reactor 练习的小卡片（• 意思 + ✓ 已掌握 + 📖 词典） */
    document.addEventListener("word-change", () => { if (playing && cards[at]) { root.querySelectorAll(".pp-en:not(#pp-en), .pp-sgw > b, .rc-ex, .rc-w").forEach(e => { e.__wdc = null; }); colorAll(cards[at]); } });
    // 生词本的模式：新加的「⭐ 已保存」排最前，第一次打开默认进它；之后记住上次选的模式
    // ?go=pump / ?go=saved：插件里的「复习」「已保存」按钮直接打开这里
    let m = "saved"; try { m = localStorage.getItem("vocab_mode") || "saved"; } catch (e) {}
    if (m === "flash" || m === "test" || m === "export") m = "pump"; // 「背诵」「自测」已并进练习的认词卡；「⚙ 设置」挪到练习右上角的齿轮
    const go = new URLSearchParams(location.search).get("go");
    if (go && /^(saved|pump|list|grammar|reading|stats)$/.test(go)) { m = go; try { history.replaceState(null, "", location.pathname); localStorage.setItem("wt:tab", "0"); } catch (e) {} const l1 = document.getElementById("l1-en"), nb = document.getElementById("tab-notebook"); if (l1) l1.click(); if (nb) nb.click(); }
    const b = document.querySelector('.modes button[data-mode="' + m + '"]') || document.querySelector('.modes button[data-mode="saved"]');
    if (b && !document.documentElement.classList.contains("collect-mode")) b.click();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
