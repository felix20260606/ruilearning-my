/* 生词本「📊 统计」：学习统计 + 词汇量测试 + 每日提醒 + 装到手机桌面
   ① 统计：连续天数、今天卡片数、已掌握 / 在学、练习天数；最近 26 周热力日历；未来 14 天要复习的数量；掌握度分布；掌握曲线
      每天的练习记录 = 本机 localStorage「pump:log」+ 后台 /api/ext 的「stat|YYYY-MM-DD」，两处合并（同一天取卡片数多的那份）
      旧日子没有记录：用 state.srs 里各词的 at（上次练习时间）推算「那天练过几个词」
   ② 词汇量测试：按词频排名（web/vs/freq.js，OpenSubtitles 字幕词频）分段抽词，混进约 15% 的假词，只选「认识 / 不认识」
      估算 = Σ 每段（校正后的认识比例 × 段宽）；校正：命中率 − 假词误认率（Yes/No 测试常用的 H − FA 校正：假词选成认识几成，每段就扣几成）
      结果存 localStorage「vocab:test」，最近 10 次
   ③ 每日提醒：提醒时间存 localStorage「remind:time」（"HH:MM"，空 = 关）；网页开着时到点用 Notification 提醒，点一下打开 /?go=pump
      另给「添加到日历」：下载 .ics（每天重复、带提醒），最可靠的免费提醒，iPhone 和电脑都能用
   ④ 装到桌面：支持 beforeinstallprompt 的浏览器直接给安装按钮；iPhone 给「分享 → 添加到主屏幕」的步骤
   依赖 index.html 的全局：words / state / toast（masteryOf 有就用，没有用同一个算法） */
(function () {
  const DAY = 864e5, HEAT_WEEKS = 26, AHEAD = 14, KNOWN_H = 42;
  const SITE = "https://ruilearning-my.pages.dev", PUMP_URL = SITE + "/?go=pump";
  const hasLS = typeof localStorage !== "undefined";
  const LG = (k, d) => { try { const v = hasLS ? localStorage.getItem(k) : null; return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const LS = (k, v) => { try { if (hasLS) localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const pad = n => (n < 10 ? "0" : "") + n;
  // 📅 日期：全站共用的「今天」（util.js 的 U.day，吉隆坡 / 北京时间）；在 node 里单独跑（测试）时没有 U，用同样的算法
  const UU = typeof U !== "undefined" ? U : (() => { const TZ = 8 * 3600e3, D = 864e5, day = t => new Date(+t + TZ).toISOString().slice(0, 10), st = t => { const x = +t + TZ; return x - (((x % D) + D) % D) - TZ; }; return { day, dayStart: st, dayAgo: (k, n) => day(Date.parse(k + "T12:00:00Z") - TZ - n * D) }; })();
  const dayKey = ts => UU.day(ts);
  const dayStart = ts => UU.dayStart(ts);
  const addDay = (k, n) => UU.dayAgo(k, -n);
  const keyTs = k => { const p = String(k).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12).getTime(); }; // 只用来显示几月几日、星期几（当天中午）
  const WD = "日一二三四五六";
  const fmtDay = k => { const d = new Date(keyTs(k)); return (d.getMonth() + 1) + "月" + d.getDate() + "日 周" + WD[d.getDay()]; };
  const fmtShort = k => { const d = new Date(keyTs(k)); return (d.getMonth() + 1) + "/" + d.getDate(); };

  // ======================= 纯函数（不碰页面，node 里也能测） =======================
  // 半衰期（天）：同 index.html 的 masteryOf
  const hOf = r => (r ? r.h || r.s || [0.5, 1, 3, 7, 16, 35, 90][r.b || 0] || 0.5 : 0);
  function masteryLocal(w, S) {
    if (!w) return 0; if (w.status === "known") return 1;
    const r = (S || {})[w.id]; if (!r || !(r.h || r.s || r.b)) return 0;
    return Math.min(1, Math.log(1 + hOf(r)) / Math.log(1 + KNOWN_H));
  }
  // 每天的练习记录：本机 + 后台合并；没有记录的日子用 srs 的 at 推算（est = true，数字是「练过几个词」不是卡片数）
  // local / server：{ "YYYY-MM-DD": {n, ok, fail, nw, sec} }；pumpDay：pump.js 的 {d: UTC 日期, n: 今天练了几张}
  function mergeDaily(local, server, srs, pumpDay, now) {
    const out = {}, num = x => (typeof x === "number" && isFinite(x) ? x : 0);
    const put = (k, v) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") return; const r = { n: num(v.n), ok: num(v.ok), fail: num(v.fail), nw: num(v.nw), sec: num(v.sec) }; if (!out[k] || r.n > out[k].n) out[k] = r; };
    for (const k in local || {}) put(k, local[k]);
    for (const k in server || {}) put(k, server[k]);
    const tk = dayKey(now);
    if (pumpDay && pumpDay.d === tk && num(pumpDay.n) > 0) { // pump:day 的日期和本地今天相同才当今天的卡片数下限（以前按 UTC 比，北京时间 0–8 点会把昨天的卡数算到今天）
      if (!out[tk]) out[tk] = { n: 0, ok: 0, fail: 0, nw: 0, sec: 0 };
      if (pumpDay.n > out[tk].n) out[tk].n = pumpDay.n;
    }
    const est = {};
    for (const id in srs || {}) { const r = srs[id]; if (r && r.at > 0 && r.at <= now + DAY) { const k = dayKey(r.at); est[k] = (est[k] || 0) + 1; } }
    for (const k in est) if (!out[k] || !(out[k].n > 0)) out[k] = { n: est[k], est: true };
    return out;
  }
  // 连续学习天数：从今天往回数；今天还没练不算断（从昨天开始数）
  // 🛡 断签保护（同 Duolingo 的 streak freeze）：每个月 2 张；漏了一天、而前一天练过，就自动用一张，连续天数不断（那一天不算进天数）
  //   fz = { set: 用过的日期 Set, from: 从哪天开始有这个功能, per: 每月几张, add(日期) 用掉一张时记下来 }；不传 = 和以前一样
  const FRZ_FROM = "2026-11-23", FRZ_PER = 2;
  const frzLeft = (set, month) => FRZ_PER - [...set].filter(d => d.slice(0, 7) === month).length;
  function streakOf(daily, now, fz) {
    let k = dayKey(now), s = 0, guard = 0; const act = x => daily[x] && daily[x].n > 0;
    if (!act(k)) k = addDay(k, -1);
    while (guard++ < 5000) {
      if (act(k)) { s++; k = addDay(k, -1); continue; }
      if (fz && fz.set.has(k)) { k = addDay(k, -1); continue; } // 用过保护卡的一天：不断（也不算进天数）
      if (fz && fz.add && k >= (fz.from || FRZ_FROM) && act(addDay(k, -1)) && frzLeft(fz.set, k.slice(0, 7)) > 0) { fz.set.add(k); fz.add(k); k = addDay(k, -1); continue; }
      break;
    }
    return s;
  }
  // 最长连续天数（徽章用）
  function bestStreak(daily) { const ks = Object.keys(daily).filter(k => daily[k] && daily[k].n > 0).sort(); let b = 0, c = 0, prev = ""; for (const k of ks) { c = prev && addDay(prev, 1) === k ? c + 1 : 1; b = Math.max(b, c); prev = k; } return b; }
  // 未来 14 天要复习的数量：有 due 用 due，没有用 at + 半衰期（回忆率降到 50%）；status = known 的不复习（同 pump.js）
  function forecastOf(W, S, now, types) {
    const days = []; for (let i = 0; i < AHEAD; i++) days.push({ k: dayKey(dayStart(now) + i * DAY + 3600e3 * 12), n: 0 });
    let over = 0; const t0 = dayStart(now);
    (W || []).forEach(w => {
      if (!w || w.status === "known" || (types && !types.includes(w.type || "word"))) return;
      const r = (S || {})[w.id]; if (!r || !r.at) return;
      const t = r.due || r.at + hOf(r) * DAY;
      if (t <= now) { over++; return; }
      const i = Math.floor((dayStart(t) - t0) / DAY + 0.5); if (i >= 0 && i < AHEAD) days[i].n++;
    });
    days[0].over = over; // 今天：已到期 over + 今天稍后到期 n
    return { over, days, today: over + days[0].n };
  }
  const BUCKETS = ["0%", "1–25%", "26–50%", "51–75%", "76–99%", "🏆 已掌握"];
  const bucketOf = m => (m >= 1 ? 5 : m <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(m * 100 / 25))));
  const TYPES = [["word", "单词"], ["phrase", "短语"], ["sentence", "句子"], ["pattern", "规律"]];
  function distOf(W, mfn) {
    const all = BUCKETS.map(() => 0), by = {}; TYPES.forEach(([t]) => (by[t] = BUCKETS.map(() => 0)));
    (W || []).forEach(w => { const b = bucketOf(mfn(w)), t = w.type || "word"; all[b]++; (by[t] || (by[t] = BUCKETS.map(() => 0)))[b]++; });
    return { all, by };
  }
  // 掌握曲线：累计收集（words[].date）+ 已掌握（掌握的词按最后一次练习 at 近似；手动标「已掌握」没有练习记录的按收词日期）
  function curveOf(W, S, mfn, now) {
    const col = {}, mas = {}; let first = null; const tk = dayKey(now);
    (W || []).forEach(w => {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(w.date || "") ? w.date : null;
      if (d) { col[d] = (col[d] || 0) + 1; if (!first || d < first) first = d; }
      if (mfn(w) >= 1) { const r = (S || {})[w.id], k = r && r.at ? dayKey(r.at) : d; if (k) { mas[k] = (mas[k] || 0) + 1; if (!first || k < first) first = k; } }
    });
    if (!first) return null;
    if (first > tk) first = tk;
    const pts = []; let a = 0, b = 0;
    for (let k = first, guard = 0; k <= tk && guard < 4000; k = addDay(k, 1), guard++) { a += col[k] || 0; b += mas[k] || 0; pts.push({ k, col: a, mas: b }); }
    return pts;
  }

  // ---------- 词汇量测试 ----------
  // 分段（排名区间）：前面细、后面粗；每段抽 5 个 → 45 个真词 + 8 个假词（≈ 15 %）= 53 题
  const VT_BANDS = [[1, 1000], [1001, 2000], [2001, 3000], [3001, 4000], [4001, 6000], [6001, 8000], [8001, 11000], [11001, 15000], [15001, 20000]];
  const VT_PER = 5, VT_FAKE_N = 8;
  // 每段的候选词：从 freq.js 对应排名里挑的原形词（去掉人名、感叹词、变形、粗口），抽题时再用 VS_RANK 核对排名
  const VT_POOL = [
    "you like why tell should nothing put hello bad woman seen men phone each forget mine least speak welcome bed alive perfect human dream given worth class ride terrible ran single radio stick agent broken cry",
    "jail laughter grab arrest address risk herself stage taste video cost suspect asleep faith necessary ghost ought taught breathe project mountain universe proof purpose property introduce easily loose safety spread subject bike tour cheap statement",
    "jury grave chocolate courage victory wood central ear scream tip silent tear drag score wide garage magazine sentence bull thunder debt nightmare federal detail custody heavily swing behave couch confess miserable flag ceremony comfort fox experiment",
    "beaten virus distant trigger underground reckon patience electric complex behalf adventure paradise sample fence relief monitor charm hood angle increase transport necklace strategy pole random serial tap admiral hostage praise comedy superior basketball entry brick bucket",
    "satellite necessarily constant smash bunny sheet boot retreat scandal document practical commitment swell compare barrel tension conclusion institute destination balloon verdict furious rainbow shotgun cheek economic publicity precise tore gesture triple carbon crucial circuit balcony honorable",
    "scoundrel straw invention clip difficulty cope cord craft concentration handful congressman jelly mechanic notebook tray avenge chili curry confront pawn detect selection misunderstood acceptable resignation pronounce infinite dinosaur parish granddad magistrate dusty diagnosis misfortune flirt gasoline",
    "inventory humiliation invincible distribution squadron scholar admission notorious calf vintage gem obstacle payroll hostess cardiac leash dolphin elimination spontaneous defy scorpion alias intercom scold whichever ensign clarity valet dent flexible meadow precaution intervene formidable pedal",
    "vitamin maneuver tar merge corny noose thinner decay porridge famine suppress detonator allergy comfortably cucumber anarchy vulture nauseous wedge enlighten manufacture crave infiltrate pretentious midday export disgraceful bleak culinary incision exhaustion purgatory bog installation trainee caterpillar",
    "duet tumble coil turbulence fearsome payoff crafty pointy coy provocation copyright weaponry outright snort reconstruct devastation anthrax utopia knuckle modify pedestrian soothe obituary minimize wreath millennia unattractive ripple spectator wobbly allegation nocturnal",
  ].map(s => s.split(" "));
  // 40 个假词：看着像英语、实际不存在（已对照系统词典 /usr/share/dict/words 和 freq.js 核对过）
  const VT_FAKE = "blurrow plentation grastle moddle frunch snavid trelling cobbish dreffle prandle mertion vosper glimmet trassel wendible clopper drussy fernick plabble loftish narling bevish crantle mibble pextion rumbish stender folvery glamber pertible harrish crimpet lonticle dremble varnage condle brimple scrandle plunter stoggle".split(" ");
  const shuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 出题：rank = 词 → 排名（VS_RANK，可为空）；allWords = VS_WORDS 拆开的数组（候选不够时从这里补）
  function vtBuild(rnd, rank, allWords) {
    rnd = rnd || Math.random; const qs = [];
    VT_BANDS.forEach((B, i) => {
      let cand = VT_POOL[i].filter(w => !rank || !rank[w] || (rank[w] >= B[0] && rank[w] <= B[1]));
      if (cand.length < VT_PER && allWords) cand = cand.concat(allWords.slice(B[0] - 1, B[1]).filter(w => /^[a-z]{4,}$/.test(w)));
      shuffle(cand, rnd).slice(0, VT_PER).forEach(w => qs.push({ w, b: i, r: (rank && rank[w]) || 0 }));
    });
    shuffle(VT_FAKE, rnd).slice(0, VT_FAKE_N).forEach(w => qs.push({ w, b: -1 }));
    return shuffle(qs, rnd);
  }
  // 估算：answers = [{b: 段号（假词 −1）, y: 认识?}]
  function vtEstimate(answers) {
    const fk = answers.filter(a => a.b < 0), fa = fk.length ? fk.filter(a => a.y).length / fk.length : 0;
    let size = 0, raw = 0;
    const bands = VT_BANDS.map((B, i) => {
      const L = answers.filter(a => a.b === i), y = L.filter(a => a.y).length, h = L.length ? y / L.length : 0;
      const p = Math.max(0, Math.min(1, h - fa)), width = B[1] - B[0] + 1;
      size += p * width; raw += h * width;
      return { from: B[0], to: B[1], n: L.length, y, h, p };
    });
    const r50 = x => Math.round(x / 50) * 50;
    return { size: r50(size), raw: r50(raw), fa, fakeN: fk.length, fakeY: fk.filter(a => a.y).length, bands, shaky: fa > 0.25 };
  }
  // 大致水平（粗估；按字幕词频表的词形计数，变形词也算一个）
  const VT_LEVELS = [[1000, "入门（Pre-A1）", "雅思 3 以下"], [2000, "A1", "雅思约 3"], [3000, "A2", "雅思约 3.5–4"], [4500, "B1", "雅思约 4.5–5"], [6500, "B2", "雅思约 5.5–6.5"], [9000, "C1", "雅思约 7–7.5"], [Infinity, "C2", "雅思约 8 以上"]];
  const vtLevel = size => { const L = VT_LEVELS.find(x => size < x[0]); return { cefr: L[1], ielts: L[2] }; };

  // ======================= 下面是页面部分 =======================
  const API = { dayKey, mergeDaily, streakOf, bestStreak, frzLeft, forecastOf, distOf, curveOf, bucketOf, masteryLocal, vtBuild, vtEstimate, vtLevel, VT_BANDS, VT_POOL, VT_FAKE };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.STATS = API; // 「📅 每日」的家庭排行也用同一个连续天数算法
  if (typeof document === "undefined") return;
  const { esc } = U; // 全站共用的小工具（util.js）
  window.statsDayKey = (ts) => dayKey(ts == null ? Date.now() : ts);

  let root = null, tip = null, SRV = null, srvOK = false, srvAt = 0, dailyOK = false, dailyP = null, CURVE = null, installEv = null;
  let vt = null; // 进行中的测试：{qs, i, ans}
  const W = () => (typeof words !== "undefined" && Array.isArray(words) ? words : []);
  const ST = () => (typeof state !== "undefined" && state ? state : {});
  const mfn = w => (typeof masteryOf === "function" ? masteryOf(w) : masteryLocal(w, ST().srs));
  const say = m => { if (typeof toast === "function") toast(m); };
  const pumpTypes = () => { const o = LG("pump:opt", null); return o && Array.isArray(o.types) && o.types.length ? o.types : ["word", "phrase", "sentence"]; };

  const CSS = `
  #stats{display:none;max-width:1200px;margin:0 auto;padding:6px 0 40px;color:var(--ui-ink)}#stats.on{display:block}
  .st-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}@media(min-width:720px){.st-tiles{grid-template-columns:repeat(5,minmax(0,1fr))}}
  .st-tile{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;min-width:0}
  .st-tile b{display:block;font-size:26px;line-height:1.15;font-weight:800;color:var(--ui-ink);font-variant-numeric:tabular-nums}.st-tile b small{font-size:13px;font-weight:600;color:var(--ui-muted);margin-left:3px}
  .st-tile span{display:block;margin-top:3px;font-size:12.5px;color:var(--ui-muted)}
  .st-tile.fire{background:var(--ui-hero);border-color:var(--ui-pur-line)}
  .st-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media(min-width:1024px){.st-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.st-wide{grid-column:1/-1}}
  .st-ms-big{display:flex;align-items:baseline;gap:8px;margin:4px 0 8px}.st-ms-big b{font-size:34px;font-weight:900;color:var(--ui-green);font-variant-numeric:tabular-nums}.st-ms-big span{color:var(--ui-ink-2);font-size:14px}
  .st-ms-bar{height:8px;border-radius:4px;background:var(--ui-surface-2);overflow:hidden}.st-ms-bar u{display:block;height:100%;background:var(--ui-green);border-radius:4px}
  .st-ms-row{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 6px}.st-ms{font-size:12.5px;font-weight:700;border-radius:999px;padding:3px 9px;background:var(--ui-surface-2);color:var(--ui-muted);border:1px solid var(--ui-line)}.st-ms.on{color:var(--ui-ink);border-color:var(--ui-green)}
  .st-spark{width:100%;height:46px;display:block;margin-top:6px}.st-ms-lv{margin-top:8px;font-size:13.5px;color:var(--ui-ink-2)}.st-ms-lv u{cursor:pointer;color:var(--ui-pur-text,var(--ui-pur))}
  .st-card{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:14px 16px;min-width:0}
  .st-card h3{margin:0 0 4px;font-size:15.5px;font-weight:800;color:var(--ui-ink)}.st-card .sub{margin:0 0 10px;font-size:12.5px;color:var(--ui-muted)}
  .st-card svg{display:block;width:100%;height:auto;overflow:visible}
  .st-card svg text{fill:var(--ui-muted);font-size:11px;font-family:var(--ui-font)}.st-card svg text.v{fill:var(--ui-ink-2);font-weight:700}
  .st-heat-wrap{overflow-x:auto}.st-heat-wrap svg{min-width:420px;max-width:680px}
  .st-legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:8px;font-size:12px;color:var(--ui-muted)}
  .st-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:4px}.st-legend .ln{width:16px;height:3px;border-radius:2px;vertical-align:3px}
  .st-detail{min-height:18px;margin-top:6px;font-size:12.5px;color:var(--ui-ink-2)}
  .st-tbl{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px;font-variant-numeric:tabular-nums}
  .st-tbl th,.st-tbl td{padding:5px 4px;text-align:right;border-bottom:1px solid var(--ui-line);white-space:nowrap}.st-tbl th:first-child,.st-tbl td:first-child{text-align:left}
  .st-tbl th{color:var(--ui-muted);font-weight:600}.st-tbl td{color:var(--ui-ink-2)}.st-tbl td.z{color:#5d636c}.st-tbl tr.sum td{color:var(--ui-ink);font-weight:700;border-bottom:0}
  .st-scroll{overflow-x:auto}
  .st-tip{position:fixed;z-index:9999;pointer-events:none;max-width:260px;padding:7px 10px;border-radius:9px;background:var(--ui-surface-3);border:1px solid var(--ui-line-2);color:var(--ui-ink);font-size:12.5px;line-height:1.45;box-shadow:var(--ui-shadow);display:none;white-space:pre-line}
  [data-tip]{cursor:pointer}
  .st-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
  .st-note{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:var(--ui-surface-2);font-size:12.5px;line-height:1.6;color:var(--ui-ink-2)}.st-note b{color:var(--ui-ink)}
  .st-note.warn{background:var(--ui-orange-soft);border:1px solid var(--ui-orange-line)}
  .st-time{height:38px;border-radius:8px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 10px;font:inherit;font-size:15px}
  .st-ok{color:var(--ui-green);font-weight:700}
  .st-vt-q{text-align:center;padding:14px 0 6px}.st-vt-q .w{font-size:34px;font-weight:800;letter-spacing:.5px;color:var(--ui-ink);margin:10px 0 18px;word-break:break-all}
  .st-vt-q .pg{font-size:12.5px;color:var(--ui-muted)}.st-vt-q .bar{height:4px;border-radius:2px;background:var(--ui-surface-2);margin:8px auto 0;max-width:320px;overflow:hidden}.st-vt-q .bar i{display:block;height:100%;background:var(--ui-pur)}
  .st-vt-q .btns{display:flex;gap:10px;justify-content:center}.st-vt-q .btns .ui-btn{min-width:120px;min-height:46px;font-size:16px}
  .st-vt-res{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:6px 0}.st-vt-res b{font-size:34px;font-weight:800;color:var(--ui-ink);font-variant-numeric:tabular-nums}.st-vt-res span{color:var(--ui-pur-text);font-weight:700}
  .st-bands{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;font-size:12px;color:var(--ui-muted);margin-top:8px;font-variant-numeric:tabular-nums}
  .st-bands .tr{height:8px;border-radius:4px;background:var(--ui-surface-2);overflow:hidden}.st-bands .tr i{display:block;height:100%;background:var(--ui-pur-text);border-radius:4px}
  .st-hist{list-style:none;margin:10px 0 0;padding:0;font-size:12.5px;color:var(--ui-ink-2)}.st-hist li{display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--ui-line);font-variant-numeric:tabular-nums}.st-hist li b{color:var(--ui-ink);min-width:64px}.st-hist li em{font-style:normal;color:var(--ui-muted);margin-left:auto}
  .st-steps{margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.75;color:var(--ui-ink-2)}
  .st-card .ui-chip:disabled{opacity:.4;cursor:default}
  .st-empty{color:var(--ui-muted);font-size:13px;padding:18px 0;text-align:center}`;

  // ---------- 数据 ----------
  function loadServer(force) { // /api/ext 里的 stat|YYYY-MM-DD（每台设备练完写进去），60 秒内不重复取
    if (!force && SRV && Date.now() - srvAt < 60e3) return Promise.resolve();
    srvAt = Date.now();
    return CLOUD.chan("ext").get().then(it => { // 全站共用的同步（cloud.js）
      const m = {};
      for (const k in it) if (k.indexOf("stat|") === 0 && it[k] && !it[k].del && it[k].v) m[k.slice(5)] = it[k].v;
      SRV = m; srvOK = true;
    }).catch(() => { SRV = SRV || {}; });
  }
  // 云端 daily（/api/mine）里别的设备记的：kn:日期（已掌握曲线）、ms:数字（到站日期）、frz:日期（用过的断签保护卡）→ 并进本机
  //   拉完之前不用保护卡、不判断到没到新的一站（免得换了设备重复用卡、重复弹提示）
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function pullDaily() {
    if (dailyOK) return Promise.resolve(); if (dailyP) return dailyP;
    const C = window.CLOUD && CLOUD.chan("daily"); if (!C) return Promise.resolve();
    return (dailyP = C.get(60e3).then(it => {
      const K = LG("vocab:kn", {}) || {}, M = LG("vocab:ms", {}) || {}, FZ = LG("vocab:frz", {}) || {}; let ch = false;
      for (const k in it || {}) {
        const x = it[k]; if (!x || x.del) continue; const a = k.slice(k.indexOf(":") + 1);
        if (k.indexOf("kn:") === 0 && DAY_RE.test(a) && !K[a] && Array.isArray(x.v) && x.v.length === 2 && x.v.every(n => Number.isFinite(+n))) { K[a] = [+x.v[0], +x.v[1]]; ch = true; }
        else if (k.indexOf("ms:") === 0 && MS.includes(+a) && !M[a] && DAY_RE.test(String(x.v))) { M[a] = String(x.v); ch = true; }
        else if (k.indexOf("frz:") === 0 && DAY_RE.test(a) && !FZ[a]) { FZ[a] = 1; ch = true; }
      }
      if (ch) { LS("vocab:kn", K); LS("vocab:ms", M); LS("vocab:frz", FZ); }
      dailyOK = true; dailyP = null;
    }).catch(() => { dailyP = null; }));
  }
  function data() {
    const now = Date.now(), S = ST().srs || {}, L = W().filter(w => (w.type || "word") !== "pattern"); // 规律是参考资料，不算（和顶部、练习页同一个口径）
    const daily = mergeDaily(LG("pump:log", {}), SRV || {}, S, LG("pump:day", null), now);
    const tk = dayKey(now), td = daily[tk] ? Object.assign({}, daily[tk]) : null; // 今天的卡片数：只算练习卡（先记下来，下面再加口语）
    // 「🗣 口语」的练习次数（speak.js 记在 speak:log）：算进热力日历、连续天数、练习天数；每次（练完一段对话、跟读一句、说一个话题……）算 1
    const SP = LG("speak:log", {}); for (const k in SP) { const v = +SP[k] || 0; if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue; const r = daily[k] && !daily[k].est ? daily[k] : (daily[k] = { n: 0, ok: 0, fail: 0, nw: 0, sec: 0 }); r.sp = v; r.n = (r.n || 0) + v; }
    let mastered = 0, learning = 0, untouched = 0;
    L.forEach(w => { const m = mfn(w); if (m >= 1) mastered++; else if (S[w.id]) learning++; else untouched++; });
    // 🛡 断签保护：用过的日期存本机 vocab:frz + 同步到 daily「frz:日期」（换设备、家庭排行都认）
    const F = LG("vocab:frz", {}) || {}, fset = new Set(Object.keys(F));
    const fz = { set: fset, add: !(srvOK && dailyOK) ? null : d => { /* 服务器的练习记录和别的设备用过的卡都拿到了，才判断要不要用卡 */ F[d] = 1; LS("vocab:frz", F); if (window.CLOUD) CLOUD.chan("daily").put("frz:" + d, 1); if (window.U) U.tip("🛡 " + d.slice(5) + " 没练，用了一张断签保护卡，连续天数没断（这个月还剩 " + frzLeft(fset, d.slice(0, 7)) + " 张）"); } };
    const streak = streakOf(daily, now, fz);
    return { now, S, L, daily, tk, today: td && !td.est ? td.n : 0, todayEst: td && td.est ? td.n : 0, streak, frzLeft: frzLeft(fset, tk.slice(0, 7)), best: Math.max(bestStreak(daily), streak), cards: Object.keys(daily).reduce((a, k) => a + (+daily[k].n || 0), 0), days: Object.keys(daily).filter(k => daily[k].n > 0).length, mastered, learning, untouched };
  }

  // ---------- 画图（纯 SVG） ----------
  const topBar = (x, y, w, h, r) => { if (h <= 0) return ""; r = Math.min(r, w / 2, h); return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z"; };
  const niceMax = v => { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const HEAT = ["var(--ui-surface-2)", "#4d2570", "#7a36a8", "#a457d6", "#d2a6f5"]; // 同一个紫色由暗到亮：越亮练得越多
  function heatSvg(d) {
    const cell = 13, gap = 3, step = cell + gap, left = 22, top = 16, t0 = keyTs(d.tk), dow = (new Date(t0).getDay() + 6) % 7; // 周一 = 0
    const start = addDay(d.tk, -dow - (HEAT_WEEKS - 1) * 7); let max = 0;
    for (let i = 0; i < HEAT_WEEKS * 7; i++) { const x = d.daily[addDay(start, i)]; if (x && x.n > max) max = x.n; }
    let s = "", lastM = -1, lastC = -9;
    for (let c = 0; c < HEAT_WEEKS; c++) {
      for (let r = 0; r < 7; r++) {
        const k = addDay(start, c * 7 + r); if (k > d.tk) continue;
        const x = d.daily[k], n = x ? x.n : 0, lv = !n ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4)));
        const t = fmtDay(k) + "\n" + (!n ? "没有练习" : x.est ? "约练了 " + n + " 个词（按复习记录推算）" : n + " 张卡片" + (x.ok || x.fail ? "：记得 " + x.ok + "，忘了 " + x.fail : "") + (x.nw ? "，新词 " + x.nw : "") + (x.sec ? "，用时 " + Math.max(1, Math.round(x.sec / 60)) + " 分钟" : ""));
        s += '<rect x="' + (left + c * step) + '" y="' + (top + r * step) + '" width="' + cell + '" height="' + cell + '" rx="3" fill="' + HEAT[lv] + '"' + (k === d.tk ? ' stroke="var(--ui-pur-text)" stroke-width="1.5"' : "") + ' data-tip="' + esc(t) + '"/>';
      }
      const m = new Date(keyTs(addDay(start, c * 7))).getMonth();
      if (m !== lastM) { if (c < HEAT_WEEKS - 1 && c - lastC >= 3) { s += '<text x="' + (left + c * step) + '" y="10">' + (m + 1) + "月</text>"; lastC = c; } lastM = m; } // 月份标签至少隔 3 列，免得挤在一起
    }
    ["一", "三", "五"].forEach((t, i) => (s += '<text x="0" y="' + (top + i * 2 * step + 10) + '">' + t + "</text>"));
    const w = left + HEAT_WEEKS * step, h = top + 7 * step;
    return '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="最近 26 周每天的练习量">' + s + "</svg>";
  }
  function forecastSvg(f) {
    const W0 = 420, H0 = 180, L = 30, R = 6, T = 18, B = 34, pw = W0 - L - R, ph = H0 - T - B, slot = pw / AHEAD, bw = Math.min(26, slot * 0.62);
    const vals = f.days.map((x, i) => x.n + (i ? 0 : f.over)), mx = niceMax(Math.max(1, ...vals)), y = v => T + ph - (v / mx) * ph;
    let s = "";
    [0, 0.5, 1].forEach(q => { const v = Math.round(mx * q), yy = y(v); s += '<line x1="' + L + '" x2="' + (W0 - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--ui-line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (yy + 3) + '" text-anchor="end">' + v + "</text>"; });
    const peak = vals.indexOf(Math.max(...vals));
    f.days.forEach((x, i) => {
      const cx = L + slot * i + slot / 2, x0 = cx - bw / 2, tot = vals[i];
      const tipT = (i === 0 ? "今天（" + fmtDay(x.k) + "）\n已到期 " + f.over + " 个，今天稍后到期 " + x.n + " 个" : i === 1 ? "明天（" + fmtDay(x.k) + "）\n" + x.n + " 个到期" : fmtDay(x.k) + "\n" + x.n + " 个到期");
      if (i === 0 && f.over) { // 今天：已到期（橙）在下，稍后到期（紫）叠在上面，中间留 2px
        const hO = (f.over / mx) * ph, hN = (x.n / mx) * ph;
        s += '<path d="' + (x.n ? "M" + x0 + "," + (T + ph) + "V" + (T + ph - hO) + "H" + (x0 + bw) + "V" + (T + ph) + "Z" : topBar(x0, T + ph - hO, bw, hO, 4)) + '" fill="var(--ui-orange)"/>';
        if (x.n) s += '<path d="' + topBar(x0, T + ph - hO - hN, bw, Math.max(0, hN - 2), 4) + '" fill="var(--ui-pur-text)"/>';
      } else if (tot) s += '<path d="' + topBar(x0, y(tot), bw, (tot / mx) * ph, 4) + '" fill="var(--ui-pur-text)"/>';
      if ((i === 0 || i === peak) && tot) s += '<text class="v" x="' + cx + '" y="' + (y(tot) - 5) + '" text-anchor="middle">' + tot + "</text>";
      if (i % 2 === 0) s += '<text x="' + cx + '" y="' + (H0 - B + 16) + '" text-anchor="middle">' + (i === 0 ? "今天" : i === 1 ? "明天" : fmtShort(x.k)) + "</text>";
      s += '<rect x="' + (L + slot * i) + '" y="' + T + '" width="' + slot + '" height="' + ph + '" fill="transparent" data-tip="' + esc(tipT) + '"/>'; // 比柱子大的悬停区
    });
    s += '<line x1="' + L + '" x2="' + (W0 - R) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" stroke="var(--ui-line-2)" stroke-width="1"/>';
    return '<svg viewBox="0 0 ' + W0 + " " + H0 + '" role="img" aria-label="未来 14 天每天要复习的数量">' + s + "</svg>";
  }
  function distSvg(all) {
    const W0 = 420, H0 = 170, L = 6, R = 6, T = 20, B = 30, pw = W0 - L - R, ph = H0 - T - B, slot = pw / all.length, bw = Math.min(56, slot * 0.6), mx = Math.max(1, ...all), tot = all.reduce((a, b) => a + b, 0);
    let s = "";
    all.forEach((n, i) => {
      const cx = L + slot * i + slot / 2, h = (n / mx) * ph;
      if (n) s += '<path d="' + topBar(cx - bw / 2, T + ph - h, bw, h, 4) + '" fill="' + (i === 5 ? "var(--ui-green)" : "var(--ui-pur-text)") + '"/>';
      s += '<text class="v" x="' + cx + '" y="' + (T + ph - h - 6) + '" text-anchor="middle">' + n + "</text>";
      s += '<text x="' + cx + '" y="' + (H0 - B + 17) + '" text-anchor="middle">' + BUCKETS[i] + "</text>";
      s += '<rect x="' + (L + slot * i) + '" y="0" width="' + slot + '" height="' + H0 + '" fill="transparent" data-tip="' + esc("掌握度 " + BUCKETS[i] + "\n" + n + " 个（占 " + (tot ? Math.round((n / tot) * 100) : 0) + "%）") + '"/>';
    });
    s += '<line x1="' + L + '" x2="' + (W0 - R) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" stroke="var(--ui-line-2)" stroke-width="1"/>';
    return '<svg viewBox="0 0 ' + W0 + " " + H0 + '" role="img" aria-label="掌握度分布">' + s + "</svg>";
  }
  const CV = { W: 420, H: 190, L: 36, R: 64, T: 14, B: 28 };
  function curveSvg(pts) {
    const { W: W0, H: H0, L, R, T, B } = CV, pw = W0 - L - R, ph = H0 - T - B, n = pts.length, last = pts[n - 1];
    const showMas = last.mas >= 2, mx = niceMax(Math.max(1, last.col, last.mas));
    const X = i => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw), Y = v => T + ph - (v / mx) * ph;
    const line = key => pts.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(p[key]).toFixed(1)).join("");
    let s = "";
    [0, 0.5, 1].forEach(q => { const v = Math.round(mx * q); s += '<line x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--ui-line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + v + "</text>"; });
    s += '<path d="' + line("col") + "L" + X(n - 1) + "," + (T + ph) + "L" + X(0) + "," + (T + ph) + 'Z" fill="var(--ui-pur-soft)"/>';
    s += '<path d="' + line("col") + '" fill="none" stroke="var(--ui-pur-text)" stroke-width="2" stroke-linejoin="round"/>';
    if (showMas) s += '<path d="' + line("mas") + '" fill="none" stroke="var(--ui-green)" stroke-width="2" stroke-linejoin="round"/>';
    // 末端直接标注（两条线的标签隔开，免得叠在一起）
    let yc = Y(last.col), ym = Y(last.mas); if (showMas && Math.abs(yc - ym) < 14) { if (yc <= ym) ym = yc + 14; else yc = ym + 14; }
    s += '<text class="v" x="' + (X(n - 1) + 6) + '" y="' + (yc + 4) + '">收集 ' + last.col + "</text>";
    if (showMas) s += '<text class="v" x="' + (X(n - 1) + 6) + '" y="' + (ym + 4) + '">掌握 ' + last.mas + "</text>";
    s += '<text x="' + L + '" y="' + (H0 - 8) + '">' + fmtShort(pts[0].k) + '</text><text x="' + (L + pw) + '" y="' + (H0 - 8) + '" text-anchor="end">' + (n > 1 ? "今天" : "") + "</text>";
    s += '<line id="st-cx" x1="0" x2="0" y1="' + T + '" y2="' + (T + ph) + '" stroke="var(--ui-line-2)" stroke-width="1" style="display:none"/>';
    s += '<circle id="st-cc" r="4" fill="var(--ui-pur-text)" stroke="var(--ui-surface)" stroke-width="2" style="display:none"/>' + (showMas ? '<circle id="st-cm" r="4" fill="var(--ui-green)" stroke="var(--ui-surface)" stroke-width="2" style="display:none"/>' : "");
    s += '<rect id="st-cov" x="' + L + '" y="0" width="' + pw + '" height="' + H0 + '" fill="transparent" style="cursor:crosshair"/>';
    CURVE = { pts, X, Y, showMas };
    return '<svg id="st-curve" viewBox="0 0 ' + W0 + " " + H0 + '" role="img" aria-label="累计收集和已掌握的词数随时间的变化">' + s + "</svg>";
  }

  // ---------- 各块 ----------
  function tilesHtml(d) {
    const t = (cls, big, unit, lab, to) => '<div class="st-tile' + (cls ? " " + cls : "") + '"' + (to ? ' data-to="' + to + '" tabindex="0" role="link"' : "") + '><b>' + big + (unit ? "<small>" + unit + "</small>" : "") + "</b><span>" + lab + "</span></div>"; // to：点了跳到哪（util.js 的 data-to）
    return '<div class="st-tiles">' +
      t("fire", "🔥 " + d.streak, "天", (d.streak ? "连续学习" : "今天练一下就开始连续") + ' · <span title="漏练一天会自动用一张，连续天数不断；每月 2 张">🛡 本月还剩 ' + d.frzLeft + " 张</span>", "daily") +
      t("", d.today || d.todayEst, d.today ? "张" : d.todayEst ? "个词" : "张", d.today ? "今天的卡片" : d.todayEst ? "今天练过的词（推算）" : "今天还没练", "notebook/pump") +
      t("", d.mastered, "个", "🏆 已掌握", "notebook/list?f=known&amp;c=all") +
      t("", d.learning, "个", "学习中" + (d.untouched ? ' · 还有 <u data-to="notebook/list?f=fresh&amp;c=all">' + d.untouched + " 个没练过</u>" : ""), "notebook/list?f=practicing&amp;c=all") +
      t("", d.days, "天", "总练习天数", "daily") + "</div>";
  }
  function forecastHtml(d) {
    const f = forecastOf(d.L, d.S, d.now, pumpTypes()), sum = f.days.reduce((a, x) => a + x.n, 0) + f.over;
    return '<div class="st-card"><h3>📅 未来 14 天要复习</h3><p class="sub">按每个词的记忆模型：回忆率降到 50%（过了半衰期）就该复习。现在已到期 <b style="color:var(--ui-orange)"' + (f.over ? ' data-to="notebook/pump" title="去练习"' : "") + ">" + f.over + "</b> 个，14 天内共 " + sum + " 个</p>" +
      (sum ? forecastSvg(f) : '<div class="st-empty">14 天内没有要复习的词</div>') +
      '<div class="st-legend"><span><i style="background:var(--ui-orange)"></i>已到期</span><span><i style="background:var(--ui-pur-text)"></i>当天到期</span></div>' +
      (f.over ? '<div class="st-row"><button class="ui-btn pri" id="st-go-pump">🔊 去练习</button></div>' : "") + "</div>";
  }
  function distHtml(d) {
    const ds = distOf(d.L, mfn), rows = TYPES.filter(([t]) => ds.by[t] && ds.by[t].some(Boolean));
    const cell = n => "<td" + (n ? "" : ' class="z"') + ">" + n + "</td>";
    return '<div class="st-card"><h3>📈 掌握度分布</h3><p class="sub">掌握度 = 半衰期换算（到 42 天算 🏆 已掌握），和列表里的进度条同一个算法</p>' + distSvg(ds.all) +
      '<div class="st-scroll"><table class="st-tbl"><thead><tr><th>类型</th>' + BUCKETS.map(b => "<th>" + b + "</th>").join("") + "<th>合计</th></tr></thead><tbody>" +
      rows.map(([t, nm]) => '<tr><td data-to="notebook/list?f=all&amp;c=' + t + '">' + nm + "</td>" + ds.by[t].map((n, i) => (i === ds.by[t].length - 1 && n ? '<td data-to="notebook/list?f=known&amp;c=' + t + '">' + n + "</td>" : cell(n))).join("") + (ds.by[t].reduce((a, b) => a + b, 0) ? '<td data-to="notebook/list?f=all&amp;c=' + t + '">' + ds.by[t].reduce((a, b) => a + b, 0) + "</td>" : cell(0)) + "</tr>").join("") + // 点类型 / 合计 → 列表按类型；点 🏆 那格 → 这类里已掌握的
      '<tr class="sum"><td>全部</td>' + ds.all.map(n => "<td>" + n + "</td>").join("") + "<td>" + ds.all.reduce((a, b) => a + b, 0) + "</td></tr></tbody></table></div></div>";
  }
  function curveHtml(d) {
    const pts = curveOf(d.L, d.S, mfn, d.now);
    if (!pts) return '<div class="st-card"><h3>📚 收集和掌握曲线</h3><div class="st-empty">词条还没有收词日期，暂时画不出曲线</div></div>';
    const showMas = pts[pts.length - 1].mas >= 2;
    return '<div class="st-card"><h3>📚 收集和掌握曲线</h3><p class="sub">累计收集按收词日期；已掌握按每个词最后一次练习的时间近似' + (showMas ? "" : "（已掌握的词还太少，先只画收集）") + "</p>" + curveSvg(pts) +
      '<div class="st-legend"><span><i class="ln" style="background:var(--ui-pur-text)"></i>累计收集</span>' + (showMas ? '<span><i class="ln" style="background:var(--ui-green)"></i>已掌握</span>' : "") + '</div><div class="st-detail" id="st-cd"></div></div>';
  }
  // 🏅 词量里程碑（对标 LingQ 的已知词数）：已掌握多少个、下一站还差多少、到过哪几站（哪天）、按词汇量测试估的水平
  //   每天记一笔「已掌握 / 收集」（本机 vocab:kn + 同步到 /api/mine 的 daily「kn:日期」），这条曲线从开始记的那天起是准的；
  //   上面「收集和掌握曲线」里以前的部分是按练习时间推算的。到了新的一站（vocab:ms + daily「ms:数字」）弹一次提示
  const MS = [50, 100, 250, 500, 1000, 1500, 2000, 3000, 5000, 8000];
  function msRecord(known, total) {
    const day = U.day(), K = LG("vocab:kn", {}) || {}, M = LG("vocab:ms", {}) || {}, C = window.CLOUD && CLOUD.chan("daily");
    if (!total || !dailyOK) return; // 生词本还没读到 / 别的设备记的还没拉过来：先不记（免得记成 0、重复弹提示）
    if (!K[day] || K[day][0] !== known || K[day][1] !== total) { K[day] = [known, total]; LS("vocab:kn", K); if (C) C.put("kn:" + day, [known, total]); }
    const hit = MS.filter(m => known >= m && !M[m]);
    if (hit.length) { hit.forEach(m => { M[m] = day; if (C) C.put("ms:" + m, day); }); LS("vocab:ms", M); U.tip("🏅 已掌握 " + hit[hit.length - 1] + " 个词！"); }
  }
  function msHtml(d) {
    const total = d.L.length, known = d.mastered; msRecord(known, total);
    const M = LG("vocab:ms", {}) || {}, K = LG("vocab:kn", {}) || {}, next = MS.find(m => m > known), prev = [...MS].reverse().find(m => m <= known) || 0;
    const pct = next ? Math.round((known - prev) / (next - prev) * 100) : 100;
    const badges = MS.map(m => '<span class="st-ms' + (M[m] ? " on" : "") + '" title="' + (M[m] ? "到达：" + esc(M[m]) : "还没到") + '">' + (M[m] ? "🏅" : "🔒") + " " + m + "</span>").join("");
    const vt = (LG("vocab:test", []) || [])[0], lv = vt && vt.size ? vtLevel(vt.size) : null, ago = vt ? Math.floor((Date.now() - (+vt.at || 0)) / 864e5) : 0;
    const days = Object.keys(K).filter(k => DAY_RE.test(k) && Array.isArray(K[k])).sort().slice(-60), pts = days.map(k => +K[k][0] || 0);
    let spark = "";
    if (pts.length >= 2) { const mx = Math.max(...pts, 1), mn = Math.min(...pts), w = 300, h = 46, x = i => (i / (pts.length - 1)) * w, y = v => h - 4 - ((v - mn) / Math.max(1, mx - mn)) * (h - 8); spark = '<svg viewBox="0 0 ' + w + " " + h + '" class="st-spark" preserveAspectRatio="none"><polyline fill="none" stroke="var(--ui-green)" stroke-width="2" points="' + pts.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ") + '"/></svg><div class="st-note">' + days[0] + " → " + days[days.length - 1] + "：" + pts[0] + " → " + pts[pts.length - 1] + " 个</div>"; }
    return '<div class="st-card"><h3>🏅 里程碑和徽章</h3><p class="sub">已掌握 = 掌握度到 42 天的词（和顶上「🏆 已掌握」同一个数）</p>' +
      '<div class="st-ms-big"><b>' + known + '</b><span>个已掌握 · 收集了 ' + total + " 个</span></div>" +
      (next ? '<div class="st-ms-bar"><u style="width:' + pct + '%"></u></div><div class="st-note">下一站 <b>' + next + "</b>，还差 <b>" + (next - known) + "</b> 个</div>" : '<div class="st-note">🎉 所有里程碑都到了</div>') +
      '<div class="st-ms-row">' + badges + "</div>" + '<div class="st-ms-row">' + [[7, "🔥 连续 7 天"], [30, "🔥 连续 30 天"], [100, "🔥 连续 100 天"], [365, "🔥 连续一年"]].map(([n, t]) => '<span class="st-ms' + (d.best >= n ? " on" : "") + '" title="最长连续 ' + d.best + ' 天">' + (d.best >= n ? "" : "🔒 ") + t + "</span>").join("") +
        [[1000, "🃏 1,000 张卡"], [5000, "🃏 5,000 张卡"], [10000, "🃏 1 万张卡"]].map(([n, t]) => '<span class="st-ms' + (d.cards >= n ? " on" : "") + '" title="一共练了 ' + d.cards + ' 张">' + (d.cards >= n ? "" : "🔒 ") + t + "</span>").join("") + "</div>" + spark +
      (window.VL && window.VL !== "en" ? "" : '<div class="st-ms-lv">' + (lv ? "📊 估计水平：<b>" + lv.cefr + "</b>（" + lv.ielts + "，词汇量约 " + vt.size + "，" + (ago ? ago + " 天前测的" : "今天测的") + "）" + (ago >= 30 ? ' · <u id="st-ms-vt">一个月了，再测一次看进步</u>' : "") : '📊 还没测过词汇量：<u id="st-ms-vt">测一下</u>（5 分钟，估出大概的 CEFR 等级）') + "</div>") + "</div>";
  }
  function heatHtml(d) {
    return '<div class="st-card st-wide"><h3>🗓 最近 26 周</h3><p class="sub">每格一天，越亮练得越多；悬停或点一下看具体数字</p><div class="st-heat-wrap">' + heatSvg(d) + "</div>" +
      '<div class="st-legend"><span>少</span>' + HEAT.map(c => '<i style="background:' + c + ';margin:0"></i>').join("") + '<span>多</span></div><div class="st-detail" id="st-hd"></div></div>';
  }

  // ---------- 词汇量测试 ----------
  function loadFreq() { // 词频表（和视频页、插件同一份）：第一次测试时才加载
    if (typeof VS_RANK !== "undefined") return Promise.resolve();
    return new Promise(res => { const s = document.createElement("script"); s.src = "vs/freq.js"; s.onload = s.onerror = res; document.head.append(s); setTimeout(res, 6000); });
  }
  function vtHtml() {
    const hist = LG("vocab:test", []);
    let body;
    if (vt && !vt.done) {
      const q = vt.qs[vt.i];
      body = '<div class="st-vt-q"><div class="pg">第 ' + (vt.i + 1) + " / " + vt.qs.length + ' 题</div><div class="bar"><i style="width:' + Math.round((vt.i / vt.qs.length) * 100) + '%"></i></div>' +
        '<div class="w">' + esc(q.w) + '</div><div class="btns"><button class="ui-btn pri st-vt-a" data-y="1">认识</button><button class="ui-btn st-vt-a" data-y="0">不认识</button></div>' +
        '<div class="st-row" style="justify-content:center"><button class="ui-chip" id="st-vt-back"' + (vt.i ? "" : " disabled") + '>↩ 上一题</button><button class="ui-chip" id="st-vt-quit">放弃测试</button></div>' +
        '<p class="sub" style="margin-top:10px">能说出大概意思才算认识。里面混了不存在的假词，乱点「认识」会扣分。键盘：← 认识，→ 不认识</p></div>';
    } else if (vt && vt.done) {
      const e = vt.res, lv = vtLevel(e.size);
      body = '<div class="st-vt-res"><b>≈ ' + e.size.toLocaleString() + "</b><span>" + lv.cefr + " · " + lv.ielts + "</span></div>" +
        '<p class="sub">假词选了「认识」：' + e.fakeY + " / " + e.fakeN + "（已按比例扣分；不扣分是 " + e.raw.toLocaleString() + "）</p>" +
        (e.shaky ? '<div class="st-note warn">假词有 ' + Math.round(e.fa * 100) + "% 选成了认识，这次结果不太可靠。下次只在确定知道意思时选「认识」。</div>" : "") +
        '<div class="st-bands">' + e.bands.map(b => "<span>" + b.from.toLocaleString() + "–" + b.to.toLocaleString() + '</span><span class="tr"><i style="width:' + Math.round(b.p * 100) + '%"></i></span><span>' + b.y + "/" + b.n + "</span>").join("") + "</div>" +
        '<div class="st-row"><button class="ui-btn pri" id="st-vt-start">再测一次</button><button class="ui-btn" id="st-vt-close">收起</button></div>';
    } else {
      body = '<p class="sub">从字幕词频表的前 2 万词里分段抽 45 个，再混进 8 个假词，一共 53 题，2 分钟左右。只选「认识 / 不认识」。</p><div class="st-row"><button class="ui-btn pri" id="st-vt-start">开始测试</button></div>';
    }
    const histHtml = hist.length ? '<ul class="st-hist">' + hist.map(h => "<li><b>" + (h.size || 0).toLocaleString() + "</b><span>" + esc(h.cefr || "") + "</span><em>" + esc(h.d || "") + (h.fa ? " · 假词误认 " + Math.round(h.fa * 100) + "%" : "") + "</em></li>").join("") + "</ul>" : "";
    return '<div class="st-card" id="st-vt"><h3>🧪 词汇量测试</h3>' + body +
      '<div class="st-note">这是<b>粗估</b>：词表按字幕词频排名、按词形算（went、going 各算一个），CEFR 和雅思对照只是大致参考，前后差一两千很正常。适合隔几周测一次看趋势。</div>' +
      (histHtml ? '<h3 style="margin-top:14px">最近 ' + hist.length + " 次</h3>" + histHtml : "") + "</div>";
  }
  function vtStart() {
    const btn = root.querySelector("#st-vt-start"); if (btn) { btn.disabled = true; btn.textContent = "准备中…"; }
    loadFreq().then(() => {
      const rank = typeof VS_RANK !== "undefined" ? VS_RANK : null, all = typeof VS_WORDS !== "undefined" ? VS_WORDS.split(" ") : null;
      vt = { qs: vtBuild(Math.random, rank, all), i: 0, ans: [] }; drawVt();
    });
  }
  function vtAnswer(y) {
    if (!vt || vt.done) return; const q = vt.qs[vt.i]; vt.ans[vt.i] = { b: q.b, y, w: q.w }; vt.i++;
    if (vt.i >= vt.qs.length) {
      vt.done = true; vt.res = vtEstimate(vt.ans); const lv = vtLevel(vt.res.size);
      const hist = LG("vocab:test", []); hist.unshift({ at: Date.now(), d: dayKey(Date.now()), size: vt.res.size, raw: vt.res.raw, fa: +vt.res.fa.toFixed(3), cefr: lv.cefr, ielts: lv.ielts, n: vt.qs.length });
      LS("vocab:test", hist.slice(0, 10));
    }
    drawVt();
  }
  function drawVt() { const el = root && root.querySelector("#st-vt"); if (el) el.outerHTML = vtHtml(); }

  // ---------- 每日提醒 ----------
  const LGN = () => (window.VL === "de" ? "德语" : "英语");
  const rmTime = () => { try { return localStorage.getItem("remind:time") || ""; } catch (e) { return ""; } };
  const notifOK = () => typeof Notification !== "undefined" && Notification.permission === "granted";
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  function remindHtml() {
    const t = rmTime(), perm = typeof Notification === "undefined" ? "none" : Notification.permission;
    const st = !t ? "提醒关着" : perm === "granted" ? '<span class="st-ok">✓ 每天 ' + esc(t) + (pushed() ? " 推送到这台设备（不开网页也会弹；今天练够 20 张就不打扰）" : " 提醒（网页开着时）") + "</span>" : perm === "denied" ? "通知被浏览器拦了：到浏览器的网站设置里允许通知" : perm === "none" ? "这个浏览器不支持网页通知" + (isIOS() && !standalone() ? "（iPhone 要先添加到主屏幕）" : "") : "还没允许通知";
    return '<div class="st-card"><h3>⏰ 每日提醒</h3><p class="sub">到点提醒「今天有 N 个要复习」，点一下直接进练习</p>' +
      '<div class="st-row"><input type="time" class="st-time" id="st-rm-time" value="' + esc(t || "20:00") + '"><button class="ui-btn pri" id="st-rm-on">' + (t && perm === "granted" ? "更新时间" : "开启提醒") + "</button>" + (t ? '<button class="ui-btn" id="st-rm-off">关闭</button>' : "") + "</div>" +
      '<div class="st-detail">' + st + (t && perm === "granted" ? ' · <a href="#" id="st-rm-test">试一下</a>' : "") + "</div>" +
      '<div class="st-row"><button class="ui-btn" id="st-rm-ics">📆 添加到日历（.ics）</button></div>' +
      '<div class="st-note"><b>最可靠的是「添加到日历」</b>：下载一个每天重复的日历事件（带提醒，点开就是练习页），手机、电脑都不用开着网页，免费。<br>' +
      "开启后，能推送的设备（安卓 Chrome、电脑上的 Chrome / Edge、<b>iPhone 先「添加到主屏幕」再从桌面图标打开</b>，iOS 16.4 以上）<b>不开网页也会到点推送</b>（今天还没练就提醒，练够 20 张就不打扰）；不支持推送的只在网页开着时提醒。每台设备要各自开一次。</div></div>";
  }
  function dueToday() { const f = forecastOf(W(), ST().srs || {}, Date.now(), pumpTypes()); return f.today; }
  function notify(n, test) {
    const title = test ? "提醒试一下 ✓" : "该练" + LGN() + "了 🔊", body = n ? "今天有 " + n + " 个要复习" : "今天没有到期的词，来学几个新词吧";
    const opt = { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "remind-pump", data: { url: "/?go=pump" } };
    const plain = () => { try { const x = new Notification(title, opt); x.onclick = () => { window.focus(); location.href = "/?go=pump"; x.close(); }; } catch (e) { say("这个浏览器只能从桌面 App 发通知"); } };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r => (r ? r.showNotification(title, opt) : plain())).catch(plain);
    else plain();
  }
  function remindTick() { // 每 30 秒看一次：到了提醒时间、今天还没提醒过、有要复习的 → 提醒
    const t = rmTime(); if (!t || !notifOK() || pushed()) return; // 开了手机推送：后台到点推，这里不再重复提醒
    const now = new Date(), hm = pad(now.getHours()) + ":" + pad(now.getMinutes()), tk = dayKey(now.getTime());
    let last = ""; try { last = localStorage.getItem("remind:last") || ""; } catch (e) {}
    if (hm < t || last === tk) return;
    if (typeof words === "undefined" || !W().length) return; // 生词本还没加载好：下次再看
    try { localStorage.setItem("remind:last", tk); } catch (e) {}
    const n = dueToday(); if (n > 0) notify(n);
  }
  // 🔔 手机推送（Web Push）：开通知时顺便订阅，到点由后台推（不开网页也会弹）；iPhone 要先「添加到主屏幕」
  const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
  const b64 = s => { const p = "=".repeat((4 - (s.length % 4)) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  const sameKey = (sub, key) => { try { const a = new Uint8Array(sub.options.applicationServerKey), b = b64(key); return a.length === b.length && a.every((x, i) => x === b[i]); } catch (e) { return true; } }; // 读不到就当一样（老浏览器）
  const pushPost = b => U.json("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ u: window.VU || "", lang: window.VL || "en" }, b)) });
  async function pushOn(t) {
    if (!pushOK() || Notification.permission !== "granted") return false;
    try {
      const reg = await navigator.serviceWorker.ready, k = await U.json("/api/push?key=1"); if (!k || !k.key) return false;
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub, k.key)) { const old = sub.endpoint; await sub.unsubscribe().catch(() => {}); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.key) }); pushPost({ renew: { old, sub: sub.toJSON() } }); } // 后台换过钥匙：旧订阅收不到了，重订一个并把这台设备的几组搬过去
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.key) });
      const r = await pushPost({ sub: sub.toJSON(), time: t });
      if (r && r.ok) { try { localStorage.setItem("remind:push", "1"); } catch (e) {} return true; }
    } catch (e) { if (window.U) U.log("push", "订阅失败", String(e && e.message || e)); }
    return false;
  }
  async function pushOff() { // 只关这个人、这种语言的这一组（同一台设备上别人 / 另一种语言的提醒还在，所以不退订设备）
    try { localStorage.removeItem("remind:push"); } catch (e) {}
    try { if (!pushOK()) return; const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) await pushPost({ sub: sub.toJSON(), off: 1 }); } catch (e) {}
  }
  const pushed = () => { try { return localStorage.getItem("remind:push") === "1"; } catch (e) { return false; } }; // remind:push 按人、按语言分开存（boot.js 的 MINE）
  // 打开网页时（每次打开一次）：开过推送的，确认订阅还在、钥匙没换、后台还记得（续期；后台内容没变就不写 KV）；订阅被浏览器清掉了就重订
  function pushSync() {
    const t = rmTime(); if (!t || !pushed() || !pushOK() || Notification.permission !== "granted") return;
    pushOn(t).then(ok => { if (!ok && window.U) U.log("push", "打开网页时续订没成功（下次再试）"); });
  }
  function remindOn() {
    const t = (root.querySelector("#st-rm-time") || {}).value || "20:00";
    if (typeof Notification === "undefined") { try { localStorage.setItem("remind:time", t); } catch (e) {} say(isIOS() ? "iPhone 要先「添加到主屏幕」，从桌面打开才能开通知；先用「添加到日历」吧" : "这个浏览器不支持网页通知，用「添加到日历」吧"); draw(); return; }
    Promise.resolve(Notification.permission === "default" ? Notification.requestPermission() : Notification.permission).then(p => {
      try { localStorage.setItem("remind:time", t); if (pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) >= t) localStorage.setItem("remind:last", dayKey(Date.now())); } catch (e) {} // 今天已经过了这个点：从明天开始提醒
      if (p !== "granted") { say("没有允许通知，提醒不会响；可以用「添加到日历」"); draw(); return; }
      pushOn(t).then(ok => { say(ok ? "🔔 每天 " + t + " 推送到这台设备（不开网页也会弹）" : "⏰ 每天 " + t + " 提醒（网页开着时；这个浏览器不支持推送" + (isIOS() && !standalone() ? "，iPhone 要先「添加到主屏幕」" : "") + "）"); draw(); });
    });
  }
  // .ics：每天重复的日历事件，开始时间 = 提醒时间（本地时间，不带时区，跟着手机所在时区走），开始时提醒
  function icsText(t, now) {
    const [hh, mm] = (t || "20:00").split(":"), d = new Date(now), ymd = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    const stamp = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ray's Life//English practice//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:pump-daily-" + (window.VL === "de" ? "de-" : "") + ymd + "@ruilearning-my.pages.dev", "DTSTAMP:" + stamp, "DTSTART:" + ymd + "T" + pad(+hh) + pad(+mm) + "00", "DURATION:PT15M", "RRULE:FREQ=DAILY",
      "SUMMARY:🔊 " + LGN() + "练习", "DESCRIPTION:打开练习：" + PUMP_URL, "URL:" + PUMP_URL,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:该练" + LGN() + "了", "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
  }
  function icsDownload() {
    const t = (root.querySelector("#st-rm-time") || {}).value || rmTime() || "20:00";
    U.download(LGN() + "练习提醒.ics", icsText(t, Date.now())); // ⬇️ 全站共用（util.js）
    say("已生成日历文件：打开后选「添加」，每天 " + t + " 提醒");
  }

  // ---------- 装到桌面 ----------
  function installHtml() {
    let body;
    if (standalone()) body = '<p class="st-ok">✓ 已经装在桌面上了</p>';
    else if (installEv) body = '<p class="sub">装好后从桌面图标打开，直接进练习页，像 App 一样全屏</p><div class="st-row"><button class="ui-btn pri" id="st-inst">📲 装到桌面</button></div>';
    else if (isIOS()) body = '<p class="sub">iPhone / iPad 要用 <b>Safari</b> 打开本页，然后：</p><ol class="st-steps"><li>点底部（或地址栏旁）的「分享」按钮 <b>⬆︎</b></li><li>往下找「<b>添加到主屏幕</b>」</li><li>点右上角「添加」</li><li>以后从桌面的「英语」图标打开；想要网页通知，在那里开</li></ol>';
    else body = '<p class="sub">在浏览器菜单里找「安装应用」或「添加到主屏幕」（Chrome / Edge 地址栏右侧也可能有安装图标）</p>';
    return '<div class="st-card"><h3>📲 装到手机桌面</h3>' + body + "</div>";
  }
  function onBIP(e) { e.preventDefault(); installEv = e; if (root && root.classList.contains("on")) draw(); }

  // ---------- 整页 ----------
  function draw() {
    if (!root) return;
    const d = data(); // 词汇量测试进行中也照常画：vtHtml 按 vt 的状态画到第几题
    root.innerHTML = tilesHtml(d) + '<div class="st-grid">' + msHtml(d) + heatHtml(d) + forecastHtml(d) + distHtml(d) + curveHtml(d) + (window.VL && window.VL !== "en" ? "" : vtHtml()) + remindHtml() + installHtml() + "</div>";
    const hw = root.querySelector(".st-heat-wrap"); if (hw) hw.scrollLeft = hw.scrollWidth; // 手机上热力图横向滚动：默认停在最近几周
  }
  function showTip(el, x, y) {
    if (!tip) return; tip.textContent = el.getAttribute("data-tip"); tip.style.display = "block";
    const r = tip.getBoundingClientRect(), vw = window.innerWidth;
    tip.style.left = Math.max(8, Math.min(vw - r.width - 8, x + 12)) + "px"; tip.style.top = Math.max(8, y - r.height - 12) + "px";
  }
  const hideTip = () => { if (tip) tip.style.display = "none"; };
  function curveMove(e) {
    const svg = root.querySelector("#st-curve"); if (!svg || !CURVE) return;
    const b = svg.getBoundingClientRect(), sx = ((e.clientX - b.left) / b.width) * CV.W, { pts, X, Y, showMas } = CURVE, n = pts.length;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((sx - CV.L) / (CV.W - CV.L - CV.R)) * (n - 1)))), p = pts[i];
    const ln = svg.querySelector("#st-cx"), cc = svg.querySelector("#st-cc"), cm = svg.querySelector("#st-cm");
    ln.setAttribute("x1", X(i)); ln.setAttribute("x2", X(i)); ln.style.display = "";
    cc.setAttribute("cx", X(i)); cc.setAttribute("cy", Y(p.col)); cc.style.display = "";
    if (cm) { cm.setAttribute("cx", X(i)); cm.setAttribute("cy", Y(p.mas)); cm.style.display = ""; }
    const t = fmtDay(p.k) + "\n累计收集 " + p.col + " 个" + (showMas ? "\n已掌握 " + p.mas + " 个" : "");
    const dd = root.querySelector("#st-cd"); if (dd) dd.textContent = t.replace(/\n/g, " · ");
    if (tip) { tip.textContent = t; tip.style.display = "block"; const r = tip.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, e.clientX + 12)) + "px"; tip.style.top = Math.max(8, e.clientY - r.height - 12) + "px"; }
  }
  function curveLeave() { const svg = root && root.querySelector("#st-curve"); if (svg) ["#st-cx", "#st-cc", "#st-cm"].forEach(s => { const n = svg.querySelector(s); if (n) n.style.display = "none"; }); hideTip(); }
  function init() {
    if (root) return; root = document.getElementById("stats"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    tip = document.createElement("div"); tip.className = "st-tip"; document.body.append(tip);
    root.addEventListener("pointermove", e => {
      if (e.target.id === "st-cov") { curveMove(e); return; }
      const el = e.target.closest && e.target.closest("[data-tip]"); if (el && e.pointerType === "mouse") showTip(el, e.clientX, e.clientY); else if (e.pointerType === "mouse") hideTip();
    });
    root.addEventListener("pointerleave", curveLeave);
    root.addEventListener("pointerout", e => { if (e.target.id === "st-cov") curveLeave(); });
    root.addEventListener("click", e => {
      const T = e.target, id = T.id || (T.closest("button,a") || {}).id;
      if (T.id === "st-cov") { curveMove(e); return; }
      const tp = T.closest("[data-tip]");
      if (tp) { const txt = tp.getAttribute("data-tip"), hd = tp.closest(".st-heat-wrap") ? root.querySelector("#st-hd") : null; if (hd) hd.textContent = txt.replace(/\n/g, " · "); showTip(tp, e.clientX, e.clientY); clearTimeout(tip._t); tip._t = setTimeout(hideTip, 2500); return; }
      const a = T.closest(".st-vt-a"); if (a) { vtAnswer(a.dataset.y === "1"); return; }
      if (id === "st-vt-start") vtStart();
      else if (id === "st-vt-quit") { vt = null; drawVt(); }
      else if (id === "st-vt-back") { if (vt && vt.i > 0) { vt.i--; drawVt(); } }
      else if (id === "st-vt-close") { vt = null; drawVt(); }
      else if (id === "st-rm-on") remindOn();
      else if (id === "st-ms-vt") { const v = document.getElementById("st-vt"); if (v) v.scrollIntoView({ behavior: "smooth", block: "start" }); }
      else if (id === "st-rm-off") { try { localStorage.removeItem("remind:time"); } catch (x) {} pushOff(); say("提醒已关闭"); draw(); }
      else if (id === "st-rm-test") { e.preventDefault(); notify(dueToday(), true); }
      else if (id === "st-rm-ics") icsDownload();
      else if (id === "st-inst" && installEv) { const ev = installEv; ev.prompt(); (ev.userChoice || Promise.resolve({})).then(c => { if (c.outcome === "accepted") { installEv = null; say("📲 已装到桌面"); } draw(); }); }
      else if (id === "st-go-pump") { const b = document.querySelector('.modes button[data-mode="pump"]'); if (b) b.click(); else location.href = "/?go=pump"; }
    });
    KEYS.on("vtest", { when: () => !!vt && !vt.done && root.classList.contains("on") && KEYS.visible(root) }, k => { // ⌨️ 全站共用的快捷键（keys.js）
      if (k === "left") vtAnswer(true); else if (k === "right") vtAnswer(false); else return false;
      return true;
    });
  }
  // 提醒和安装：页面一打开就开始（不用先进统计页）
  window.addEventListener("beforeinstallprompt", onBIP);
  window.addEventListener("appinstalled", () => { installEv = null; if (root && root.classList.contains("on")) draw(); });
  setInterval(remindTick, 30e3); setTimeout(remindTick, 5e3); setTimeout(pushSync, 9e3);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") remindTick(); });

  window.statsShow = () => { init(); if (!root) return; draw(); Promise.all([loadServer(), pullDaily()]).then(() => { if (root.classList.contains("on") && !(vt && !vt.done)) draw(); }); };
  window.statsRefresh = () => { if (root && root.classList.contains("on") && !(vt && !vt.done)) draw(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
