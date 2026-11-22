/* 🧩 练习课（「🎧 听」→「🧩 练习课」）：把一期真人原声拆成几节，每节 8 句左右，一张一张卡片做
   每节：📒 本期重点词（只在第 1 节）→ 🔁 跟读（🎙 录音打分）→ 👂 听音选句 → 🧱 排词成句 → ⌨️ 听写填空 → 📝 整句听写 → 🀄 看中文说外语 → 🎭 角色扮演（对话类）→ 🔁 错题再来一遍 → 小结
   - 难度三档（「drill:lvl」）：简单 / 标准 / 难，决定每样出几道、选项几个、默认语速、给不给中文
   - 🔀 换一套题：同一节换几句来考、换个词挖空（build 的 v）；进度记最好的那次
   - 📅 隔天复习：做错的句子进「drill:rev」，1 天、3 天、7 天后在「今日复习」里再出，连对 3 次就不再出；「📅 每日」的「听」也算练习课和复习
   - 🤔 填空 / 整句听写做错（英语）：AI 讲为什么没听出来（和精听同一个 /api/ai task:"whymiss"）
   - 每天练了多少记在「drill:log」，首页显示最近 7 天和前 7 天比
   做法参考 Language Reactor 的课程页：素材先整理成统一的「课」格式，再由同一个播放器按题型出卡片；所以换语言只要换素材来源
   ── 多语言 ──
   现在学哪种语言看 window.LANG（lang.js，顶栏切换）。PROV[语言] = 这门语言的素材来源，统一交出：
     list(系列) → [{id, t 标题, d 日期, img}]
     load(id, 进度回调) → {id, title, src 原声地址, sents:[{t 原句, who, zh 中文, zhAll 中文是整段的, s, e 起止秒（没对上时间 = null）}], vocab:[{w, def, zh, ex}]}
   原声的每句时间：用 listen.js 的逐句精听（/api/sme?al= 后台 Whisper 转写，存 KV，一期只花一次 AI 额度）；对不上就用浏览器朗读（按这门语言的 bcp 语音）
   德语素材：德国之声 DW 的慢速德语新闻（_worker.js 的 /api/dw：列表、文稿、中文、Whisper 德语对时间）
   ── 记录 ──
   localStorage「drill:prog」{语言: {期号: {节号: {sc 最好的正确率 0–100, last 最近一次, n 做了几遍, at}}}}、「drill:rev」「drill:log」「drill:lvl」、「drill:last」{语言: 期号}：按家人分开（index.html 的 MINE）；「drill:opt」{rate, zh} 本机
   做错的选择题 / 填空收进「❌ 错题本」（window.ERR，来源「🎧 精听」；德语的进德语那本）
   键盘：A / ← 上一张，D / → 下一张，S 再听一遍，E 显示 / 隐藏中文，R 录音 / 停，1–9 选选项、点词块；填空框里回车 = 检查 / 下一张
   入口：window.drillShow()（index.html 点「🧩 练习课」时调）、drillReview()（直接开今日复习）、drillToday()（每日页用）；测试用 window.DRILL = {split, lessons, build, blankOf, chunksOf, shufIdx, LV} */
(function () {
  "use strict";
  if (window.drillShow) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const LS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const tip = m => { try { (window.toast || (() => {}))(m); } catch (e) {} };
  const LANG = () => window.LANG || { cur: () => "en", cfg: () => ({ code: "en", name: "英语", flag: "🇬🇧", bcp: "en-GB", ready: true }), words: s => String(s || "").match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g) || [], check: (a, b) => ({ ok: String(a).trim().toLowerCase() === String(b).trim().toLowerCase(), note: "" }), stop: () => new Set() };
  const getJ = async u => { const r = await fetch(u); return r.json(); };

  // ---------- 素材来源 ----------
  function durOf(src) {
    return new Promise(res => {
      const a = new Audio(); a.preload = "metadata"; if (window.NET && NET.audio) try { NET.audio(a); } catch (e) {}
      const t = setTimeout(() => res(0), 15000);
      a.addEventListener("loadedmetadata", () => { clearTimeout(t); res(a.duration || 0); }, { once: true });
      a.addEventListener("error", () => { clearTimeout(t); res(0); }, { once: true });
      a.src = src; try { a.load(); } catch (e) {}
    });
  }
  function splitSents(lines) { // listen.js 没加载时的备用（同样的切法）
    if (window.smeSplitSents) return window.smeSplitSents(lines);
    const out = [];
    (lines || []).forEach((l, li) => (String(l.t || "").match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) || []).forEach(t => { t = t.trim(); if (/\p{L}/u.test(t)) out.push({ who: l.who || "", t, li }); }));
    return out;
  }
  const within = (ms, p) => Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);
  // 一句一句翻成中文：每批 1500 字左右，一行一句；对不上行数的那批不要（还用整段的中文）
  async function trSents(arr) {
    const out = arr.map(() => ""), sl = LANG().cur(), B = []; let cur = [], len = 0;
    arr.forEach((t, i) => { if (cur.length && len + t.length > 1500) { B.push(cur); cur = []; len = 0; } cur.push(i); len += t.length + 1; }); if (cur.length) B.push(cur);
    await Promise.all(B.map(async b => {
      const u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=zh-CN&dt=t&dj=1&q=" + encodeURIComponent(b.map(i => arr[i].replace(/\s+/g, " ")).join("\n"));
      const r = await (window.NET && NET.g ? NET.g(u) : fetch(u)); if (!r.ok) return;
      const j = await r.json(), z = (j.sentences || []).map(x => x.trans || "").join("").split("\n").map(x => x.trim());
      if (z.length === b.length) b.forEach((i, k) => { out[i] = z[k]; });
    }).map(p => p.catch(() => {})));
    return out;
  }
  // 一期的素材（文稿 + 中文 + 每句时间）整理成「课」：英语、德语共用
  async function finish(base, id, ep, zh, prog) {
    const raw = splitSents(ep.lines), per = {}; raw.forEach(x => { per[x.li] = (per[x.li] || 0) + 1; });
    let sents = raw.map(x => ({ t: x.t, who: x.who, li: x.li, zh: zh && zh.lines ? zh.lines[x.li] || "" : "", zhAll: per[x.li] > 1, s: null, e: null }));
    const need = sents.filter(x => x.zhAll || !x.zh); // 一段好几句时后台只有整段的中文：每句单独翻（谷歌免费；不通时 NET.g 改请后台翻）
    if (need.length) { prog("翻译每一句…"); try { const zs = await trSents(need.map(x => x.t)); need.forEach((x, i) => { if (zs[i]) { x.zh = zs[i]; x.zhAll = false; } }); } catch (e) {} }
    const src = window.NET && NET.src ? NET.src(ep.mp3) : ep.mp3;
    let note = "";
    try { // 每句的时间：和 listen.js 的逐句精听同一个办法（后台 Whisper 转写，存 KV，一期只花一次 AI 额度）
      prog("量原声长度…"); const dur = await durOf(src); if (!dur) throw new Error("原声打不开");
      const W = []; let parts = 1, total = 0, id3 = 0;
      for (let p = 0; p < parts && p < 40; p++) {
        prog("给原声对时间 " + (p + 1) + " / " + parts + "（第一次打开这期要等一会儿）");
        const j = await getJ(base + "?al=" + encodeURIComponent(id) + "&part=" + p);
        if (!j || !j.ok) throw new Error((j && j.error) || "网络");
        parts = j.parts || 1; total = j.total || 1; if (p === 0) id3 = +j.id3 || 0;
        const off = Math.max(0, (p * 1e6 - (p ? id3 : 0)) / Math.max(1, total - id3) * dur);
        (j.words || []).forEach(w => W.push([w[0], w[1] + off, w[2] + off]));
      }
      if (!window.smeAlignTimes) throw new Error("listen.js 没加载");
      const T = window.smeAlignTimes(raw, W); sents = sents.map((x, i) => Object.assign(x, { s: T[i].s, e: T[i].e }));
    } catch (e) { note = "原声没对上时间（" + (e.message || e) + "），这期用机器朗读"; }
    const vocab = (ep.vocab || []).map((v, i) => ({ w: String(v[0] || "").trim(), def: v[1] || "", zh: zh && zh.vocab ? zh.vocab[i] || "" : "", ex: v[2] || "" })).filter(v => v.w);
    return { id, title: ep.title || id, src, sents, vocab, note, dialog: !!this.dialog };
  }
  const PROV = {
    en: {
      name: "「📻 听力节目」里的分级新闻、NPR、VOA、BBC", dialog: true, // dialog：两个人对话的节目 → 有「🎭 角色扮演」（还要文稿里真有两个以上说话人）
      // 和 listen.js 的栏目一样（[栏目, 按钮, 行]），「新闻英语」没有全文文稿，不能拆句；「本周更新」= 一直在更新的栏目最近 7 天的
      series: [["new", "🆕 本周更新", "最新"], ["bn1", "📶 L1 初级", "分级"], ["bn3", "📶 L3 中级", "分级"], ["bn5", "📶 L5 中高级", "分级"], ["bn6", "📶 L6 高级", "分级"], ["nup", "🗞 每日新闻", "NPR"], ["nsw", "🔬 科学", "NPR"], ["npm", "💰 经济", "NPR"],
        ["vst", "📚 美国故事", "VOA"], ["vwd", "🗝 词语故事", "VOA"], ["vgr", "✏️ 每日语法", "VOA"], ["vnw", "🗞 慢速新闻", "VOA"], ["drama", "🎭 广播剧", "BBC"], ["eau", "🎓 大学英语", "BBC"], ["ree", "🐢 慢速对话", "BBC"], ["tews", "💬 地道说法", "BBC"], ["sme", "📻 6 分钟英语", "BBC"]],
      week: ["bn1", "bn3", "bn5", "bn6", "nup", "nsw", "npm", "ree", "tews", "sme"],
      async list(s) {
        if (s === "new") { // 各栏目最近 7 天的合起来，新的在前；小字写是哪个栏目
          const day = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; }, cut = day(Date.now()) - 6 * 864e5, lab = Object.fromEntries(this.series.map(x => [x[0], x[1]]));
          const Ls = await Promise.all(this.week.map(k => this.list(k).catch(() => [])));
          const out = []; Ls.forEach((L, si) => L.forEach(x => { const t = Date.parse(x.d); if (t && day(t) >= cut) out.push(Object.assign({}, x, { d: x.d + " · " + lab[this.week[si]], _t: day(t), _s: si })); }));
          if (!out.length && Ls.every(L => !L.length)) throw new Error("列表没拿到");
          return out.sort((a, b) => b._t - a._t || a._s - b._s);
        }
        const j = await getJ("/api/sme?s=" + encodeURIComponent(s)); if (!j || !j.ok) throw new Error((j && j.error) || "列表没拿到"); return j.list || [];
      },
      async load(id, prog) {
        prog("取文稿…");
        const ep = await getJ("/api/sme?ep=" + encodeURIComponent(id)); if (!ep || !ep.ok) throw new Error(ep && ep.error === "no transcript yet" ? "这一期 NPR 还没放文稿（一般播出后一两天才有），先练别的" : ep && ep.error === "no such level" ? "这篇新闻没有这一级，换个级别" : "文稿没拿到（" + ((ep && ep.error) || "网络") + "）");
        prog("取中文翻译…");
        let zh = null; try { zh = await getJ("/api/sme?ep=" + encodeURIComponent(id) + "&zh=1"); if (!zh || !zh.ok) zh = null; } catch (e) {}
        return finish.call(this, "/api/sme", id, ep, zh, prog);
      },
    },
    de: { // 德国之声 DW「Langsam gesprochene Nachrichten」：每个工作日一期，慢速朗读的新闻，有全文（_worker.js 的 /api/dw）
      name: "德国之声 DW · 慢速德语新闻（Langsam gesprochene Nachrichten）", dialog: false,
      series: [["dw", "📰 慢速新闻"]],
      async list() { const j = await getJ("/api/dw?list=1"); if (!j || !j.ok) throw new Error((j && j.error) || "列表没拿到"); return j.list || []; },
      async load(id, prog) {
        prog("取文稿…");
        const ep = await getJ("/api/dw?ep=" + encodeURIComponent(id)); if (!ep || !ep.ok) throw new Error("文稿没拿到（" + ((ep && ep.error) || "网络") + "）");
        prog("取中文翻译…（第一次打开这期要十几秒）");
        let zh = null; try { zh = await within(12000, getJ("/api/dw?ep=" + encodeURIComponent(id) + "&zh=1")); if (!zh || !zh.ok) zh = null; } catch (e) {} // 后台第一次翻要很久：最多等 12 秒（它在后台接着翻完存起来），没等到就用下面每句单独翻的
        return finish.call(this, "/api/dw", id, ep, zh, prog);
      },
    },
  };

  // ---------- 拆节、出题（纯函数，测试里直接调） ----------
  const PER = 8;
  function lessons(n) { // n 句 → 每节的 [起, 止)：大约 8 句一节，平均分
    const k = Math.max(1, Math.round(n / PER)), out = [];
    for (let i = 0; i < k; i++) out.push([Math.round(i * n / k), Math.round((i + 1) * n / k)]);
    return out.filter(r => r[1] > r[0]);
  }
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 一句里挖哪个词：先挑本期重点词，再挑不是常用小词、最长的；→ {word, shown 挖空后的句子} 或 null
  function blankOf(t, vocabWords, stop, r) {
    const W = LANG().words(t), lc = w => w.toLowerCase();
    const cand = W.filter(w => w.length >= 3 && !stop.has(lc(w)) && !/^\d+$/.test(w) && !/'/.test(w));
    if (!cand.length) return null;
    const vw = new Set((vocabWords || []).map(lc));
    let word = cand.find(w => vw.has(lc(w)));
    if (!word) { const L = Math.max(...cand.map(w => w.length)), top = cand.filter(w => w.length >= L - 1); word = top[Math.floor(r() * top.length)]; }
    const re = new RegExp("(^|[^\\p{L}\\p{N}'])" + reEsc(word) + "(?=$|[^\\p{L}\\p{N}'])", "u");
    if (!re.test(t)) return null;
    return { word, shown: t.replace(re, (m, a) => a + "\u0000") };
  }
  // 排词成句：按空格切成块（标点跟着词走）；超过 8 块就两三个词一块；太短（< 4 个词）不出
  function chunksOf(t) {
    const w = String(t || "").trim().split(/\s+/).filter(Boolean); if (w.length < 4) return null;
    const k = Math.ceil(w.length / 8), out = []; for (let i = 0; i < w.length; i += k) out.push(w.slice(i, i + k).join(" "));
    return out;
  }
  function shufIdx(n, r) { // 打乱 0..n-1，保证不是原来的顺序
    const a = Array.from({ length: n }, (_, i) => i); if (n < 2) return a;
    for (let k = 0; k < 5; k++) { for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (a.some((x, i) => x !== i)) return a; }
    return a.reverse();
  }
  // 难度：每节出几道、选项几个、原声默认速度、跟读卡给不给中文
  const LV = {
    1: { name: "简单", tip: "选项少（3 个）、多排句子、不考整句听写、默认 0.85 倍速、能看中文", pick: 3, opts: 3, gap: 2, dict: 0, ord: 2, zh: 1, rate: 0.85, zhOk: true },
    2: { name: "标准", tip: "选择 4 题、填空 4 题、整句听写 1 句、原速", pick: 4, opts: 4, gap: 4, dict: 1, ord: 1, zh: 1, rate: 1, zhOk: true },
    3: { name: "难", tip: "多挖空、整句听写 2 句、默认 1.15 倍速、跟读卡不给中文、角色扮演不给台词", pick: 4, opts: 4, gap: 5, dict: 2, ord: 1, zh: 2, rate: 1.15, zhOk: false },
  };
  const GRADED = new Set(["pick", "gap", "dict", "ord"]); // 算分的题型
  // 一节的卡片：[{k:'voc'|'say'|'pick'|'ord'|'gap'|'dict'|'zh'|'role'|'end', act 第几个活动, ...}] 和活动表 acts
  // v = 第几套题（🔀 换一套题：同一节换几句来考、换个词挖空）；lv = 难度 1–3（默认 2）
  function build(M, li, v, lv) {
    v = +v || 0; const P = LV[lv] || LV[2];
    const L = lessons(M.sents.length), [a, b] = L[li] || [0, 0], r = rng(hash(M.id + "#" + li + (v ? "#v" + v : ""))), stop = LANG().stop();
    const nw = i => LANG().words(M.sents[i].t).length;
    const idx = []; for (let i = a; i < b; i++) idx.push(i);
    const acts = [], cards = [];
    const add = (name, ins, list) => { if (!list.length) return; acts.push({ name, ins, n: list.length }); list.forEach(c => cards.push(Object.assign({ act: acts.length - 1 }, c))); };
    // 先出题（随机数按固定顺序取，同一套题每次一样），再按顺序排活动
    const long = idx.filter(i => nw(i) >= 4);
    const shuf = long.slice().sort(() => r() - 0.5);
    const pickS = shuf.slice(0, Math.min(P.pick, Math.ceil(shuf.length / 2))); // 句子少时选择题和填空各分一半，尽量别用同一句（选完再填就是送答案）
    const gapPool = idx.filter(i => !pickS.includes(i) && nw(i) >= 3).sort(() => r() - 0.5).concat(pickS);
    const picks = pickS.map(s => {
      const n = nw(s), seen = new Set([M.sents[s].t]);
      const others = M.sents.map((x, i) => ({ i, d: Math.abs(LANG().words(x.t).length - n) + r() })).filter(x => x.i !== s && LANG().words(M.sents[x.i].t).length >= 3).sort((p, q) => p.d - q.d)
        .map(x => M.sents[x.i].t).filter(t => !seen.has(t) && seen.add(t)).slice(0, P.opts - 1);
      const opts = others.concat([M.sents[s].t]).sort(() => r() - 0.5);
      return { k: "pick", s, opts, ans: opts.indexOf(M.sents[s].t) };
    }).filter(c => c.opts.length >= 2);
    const gaps = []; const used = new Set();
    for (const s of gapPool) { if (gaps.length >= P.gap || used.has(s)) continue; used.add(s); const g = blankOf(M.sents[s].t, M.vocab.map(v => v.w.split(/\s+/)[0]), stop, r); if (g) gaps.push(Object.assign({ k: "gap", s }, g)); }
    const U = new Set(pickS.concat(gaps.map(g => g.s)));
    const fresh = list => list.slice().sort((p, q) => (U.has(p) ? 1 : 0) - (U.has(q) ? 1 : 0) + (r() - 0.5) * 0.9); // 没考过的句子排前面
    const ords = fresh(idx.filter(i => chunksOf(M.sents[i].t) && (lv === 1 ? nw(i) <= 12 : nw(i) <= 20))).slice(0, P.ord).map(s => { const ch = chunksOf(M.sents[s].t); return { k: "ord", s, ch, sh: shufIdx(ch.length, r) }; });
    ords.forEach(o => U.add(o.s));
    let dPool = idx.filter(i => nw(i) >= 4 && nw(i) <= (lv === 3 ? 18 : 12)); const dNo = dPool.filter(i => !ords.some(o => o.s === i)); if (dNo.length >= P.dict) dPool = dNo; // 排过的句子再听写就是送答案
    const dicts = fresh(dPool).slice(0, P.dict).map(s => ({ k: "dict", s }));
    dicts.forEach(o => U.add(o.s));
    const zhs = fresh(idx.filter(i => M.sents[i].zh && !M.sents[i].zhAll && nw(i) >= 3)).slice(0, P.zh).map(s => ({ k: "zh", s }));
    if (li === 0) add("📒 本期重点词", "先认识这期要用的词：点 🔊 听发音，想记的加进生词本", M.vocab.slice(0, 10).map((v, i) => ({ k: "voc", v: i })));
    add("🔁 跟读", "听一句，大声跟着读；点 🎙 录下来，看哪些词没读准（R）", idx.map(s => ({ k: "say", s })));
    add("👂 听音选句", "先别看字，听一遍，选出你听到的那句", picks);
    add("🧱 排词成句", "听一遍，按听到的顺序点词块（也可以按数字键）", ords);
    add("⌨️ 听写填空", "听，把空着的那个词写出来（回车检查）", gaps);
    add("📝 整句听写", "听，把整句写下来（回车检查；大小写、标点不算错）", dicts);
    add("🀄 看中文说外语", "看中文，先自己说一遍，再看原句、听原声对一下", zhs);
    if (M.dialog) {
      const who = [...new Set(idx.map(i => M.sents[i].who).filter(Boolean))];
      if (who.length >= 2 && idx.length >= 3) add("🎭 角色扮演", "选一个角色：原声放另一个人，轮到你时停下来，你来说", [{ k: "role", list: idx, who }]);
    }
    cards.push({ k: "end", act: -1 });
    return { acts, cards, range: [a, b], v };
  }
  window.DRILL = { split: splitSents, lessons, build, blankOf, chunksOf, shufIdx, rng, PROV, LV };

  // ---------- 状态 ----------
  let root = null, view = "home", ser = LG("drill:ser", "new"), M = null, LI = 0, C = null, ci = 0, res = {}, busy = "", err = "";
  let RS = {}, ORD = {}, RP = null; // RS 每张卡的录音结果、ORD 排词成句点了哪些、RP 角色扮演
  const MODELS = {}, LISTS = {}, WHY = {}, MORE = {}; // MORE：列表显示到第几期
  const lvl = () => { const v = +LG("drill:lvl", 2); return LV[v] ? v : 2; };
  const opt = () => Object.assign({ rate: LV[lvl()].rate, zh: false }, LG("drill:opt", {}));
  const setOpt = o => LS("drill:opt", Object.assign(opt(), o));
  const curSer = () => { const P = PROV[LANG().cur()]; return !P || P.series.some(x => x[0] === ser) ? ser : P.series[0][0]; };
  const progAll = () => LG("drill:prog", {}) || {};
  const progOf = id => ((progAll()[LANG().cur()] || {})[id]) || {};
  function saveProg(id, li, sc, first) { // 记最好的那次（sc），也记最近一次（last）和做了几遍（n）
    const P = progAll(), c = LANG().cur(); P[c] = P[c] || {}; P[c][id] = P[c][id] || {};
    const o = P[c][id][li] || {}; P[c][id][li] = { sc: Math.max(sc, o.sc || 0), last: sc, n: (o.n || 0) + (first ? 1 : 0) || 1, at: Date.now() }; LS("drill:prog", P);
  }
  const lastOf = () => (LG("drill:last", {}) || {})[LANG().cur()] || "";
  function setLast(id) { const o = LG("drill:last", {}) || {}; o[LANG().cur()] = id; LS("drill:last", o); }
  // 本地日期（同 daily.js）
  const lday = t => { const d = t ? new Date(t) : new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const dayAdd = n => lday(Date.now() + n * 864e5);

  // ---------- 📅 隔天复习：做错的句子 1 天、3 天、7 天后再出，连对 3 次就不再出 ----------
  // localStorage「drill:rev」{语言: {键: {k 题型, ep, title, src, t, who, zh, s, e, (opts, ans | word, shown), due 哪天到期, step, add}}}，按家人分开
  const REVI = [1, 3, 7];
  const revAll = () => LG("drill:rev", {}) || {};
  const revOf = () => revAll()[LANG().cur()] || {};
  function revSave(o) { const A = revAll(); A[LANG().cur()] = o; LS("drill:rev", A); }
  function revAdd(c, x) {
    if (!M || M.id === "review") return;
    const R = revOf(), key = M.id + "#" + hash(x.t).toString(36) + "#" + c.k;
    R[key] = Object.assign({ k: c.k, ep: M.id, title: M.title, src: x.src || M.src, t: x.t, who: x.who || "", zh: x.zhAll ? "" : x.zh || "", s: x.s, e: x.e, due: dayAdd(1), step: 0, add: Date.now() },
      c.k === "pick" ? { opts: c.opts, ans: c.ans } : c.k === "gap" ? { word: c.word, shown: c.shown } : {});
    const ks = Object.keys(R); if (ks.length > 300) ks.sort((p, q) => R[p].add - R[q].add).slice(0, ks.length - 300).forEach(k => delete R[k]);
    revSave(R);
  }
  const revDue = () => { const R = revOf(), t = lday(); return Object.keys(R).filter(k => R[k].due <= t).sort((p, q) => R[p].add - R[q].add); };
  function revMark(key, ok) { const R = revOf(), it = R[key]; if (!it) return; if (ok) { it.step++; if (it.step >= REVI.length) delete R[key]; else it.due = dayAdd(REVI[it.step]); } else { it.step = 0; it.due = dayAdd(1); } revSave(R); }
  // ---------- 每天练了多少：「drill:log」{语言: {日期: {n 做完几节, q 答了几题, ok 对几题, rv 复习几句}}}（留 60 天） ----------
  function logAdd(f) {
    const A = LG("drill:log", {}) || {}, c = LANG().cur(), d = lday(); A[c] = A[c] || {};
    f(A[c][d] = A[c][d] || { n: 0, q: 0, ok: 0, rv: 0 });
    Object.keys(A[c]).sort().slice(0, -60).forEach(k => delete A[c][k]); LS("drill:log", A);
  }
  function weekOf() { // 最近 7 天 vs 前 7 天
    const A = (LG("drill:log", {}) || {})[LANG().cur()] || {}, w = [{ n: 0, q: 0, ok: 0, rv: 0, d: 0 }, { n: 0, q: 0, ok: 0, rv: 0, d: 0 }];
    for (let i = 0; i < 14; i++) { const o = A[dayAdd(-i)]; if (!o) continue; const x = w[i < 7 ? 0 : 1]; x.n += o.n || 0; x.q += o.q || 0; x.ok += o.ok || 0; x.rv += o.rv || 0; if (o.n || o.rv) x.d++; }
    return w;
  }

  // ---------- 放音：原声的一段（[s, e]），没时间就用浏览器朗读；onEnd = 这段放完（角色扮演用） ----------
  const AU = new Audio(); AU.preload = "auto"; if (window.NET && NET.audio) try { NET.audio(AU); } catch (e) {}
  let stopAt = 0, raf = 0, endCb = null, ttsTok = 0; window.DRILL.au = AU; // 测试用
  const fire = () => { const f = endCb; endCb = null; if (f) f(); };
  function tick() { if (!AU.paused && stopAt && AU.currentTime >= stopAt) { AU.pause(); stopAt = 0; fire(); } if (!AU.paused) raf = requestAnimationFrame(tick); }
  AU.addEventListener("ended", fire);
  AU.addEventListener("timeupdate", () => { if (stopAt && AU.currentTime >= stopAt) { AU.pause(); stopAt = 0; fire(); } }); // 后台标签页里没有帧：靠这个停
  function hush() { endCb = null; ttsTok++; try { AU.pause(); } catch (e) {} stopAt = 0; try { speechSynthesis.cancel(); } catch (e) {} }
  function others() { try { if (window.smePause) smePause(); } catch (e) {} try { if (window.videoCore && videoCore.pause) videoCore.pause(); } catch (e) {} }
  function sayTTS(t, rate, onEnd) {
    try {
      if (!("speechSynthesis" in window)) return tip("这个浏览器不能朗读");
      speechSynthesis.cancel(); const tok = ++ttsTok;
      const u = new SpeechSynthesisUtterance(t), bcp = LANG().cfg().bcp; u.lang = bcp;
      const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.replace("_", "-").toLowerCase().startsWith(bcp.slice(0, 2))); if (v) u.voice = v;
      u.rate = 0.95 * (rate || 1); if (onEnd) u.onend = () => { if (tok === ttsTok) onEnd(); };
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function play(si, slow, onEnd) {
    const x = M && M.sents[si]; if (!x) return; others(); hush();
    const rate = slow ? 0.75 : opt().rate;
    if (x.s == null) return sayTTS(x.t, rate, onEnd);
    const src = x.src || M.src; // 复习：每句可能来自不同的一期
    if (AU.getAttribute("src") !== src) AU.src = src;
    endCb = onEnd || null;
    const go = () => { try { AU.currentTime = x.s; } catch (e) {} AU.playbackRate = rate; stopAt = x.e; AU.play().then(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }).catch(() => tip("原声放不出来，点一下 🔊 再试")); };
    if (AU.readyState >= 1) go(); else AU.addEventListener("loadedmetadata", go, { once: true });
  }
  function sayWord(w) { others(); hush(); if (LANG().cur() === "en" && typeof window.speak === "function") window.speak(w); else sayTTS(w); }

  // ---------- 🎙 录音打分（跟读、看中文说外语）：录下来交给 /api/stt（Whisper），和原句逐词比 ----------
  const fold = w => { let t = String(w).toLowerCase(); if (LANG().cur() === "de") t = t.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss"); return t; };
  const ntokL = t => LANG().words(t).map(fold);
  function near(a, b) { // 一样，或者长词只差一个字母
    if (a === b) return true; if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function lcsHit(a, b, eq) { // a 的每个词在 b 里有没有（按顺序最长公共子序列）
    eq = eq || ((x, y) => x === y);
    const n = a.length, m = b.length, W = m + 1, T = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i * W + j] = eq(a[i], b[j]) ? T[(i + 1) * W + j + 1] + 1 : Math.max(T[(i + 1) * W + j], T[i * W + j + 1]);
    const hit = new Array(n).fill(false); let i = 0, j = 0;
    while (i < n && j < m) { if (eq(a[i], b[j]) && T[i * W + j] === T[(i + 1) * W + j + 1] + 1) { hit[i] = true; i++; j++; } else if (T[(i + 1) * W + j] >= T[i * W + j + 1]) i++; else j++; }
    return hit;
  }
  function markHtml(t, hit) { // 原句：对的词绿、没对上的红
    let k = 0;
    return String(t).split(/(\s+)/).map(w => { if (!w || /^\s+$/.test(w)) return w; const n = LANG().words(w).length; if (!n) return esc(w); const good = hit.slice(k, k + n).every(Boolean); k += n; return '<span class="' + (good ? "hk" : "hm") + '">' + esc(w) + "</span>"; }).join("");
  }
  let REC = null;
  async function recToggle() {
    const c = C && C.cards[ci]; if (!c || c.s == null) return;
    if (REC) { recStop(false); return; }
    hush(); rpStop();
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { tip("没拿到麦克风：请在浏览器地址栏允许使用麦克风"); return; }
    const x = M.sents[c.s], r = REC = { stream, chunks: [], srText: "", key: ci, t: x.t, cards: C, k: c.k };
    try { r.mr = new MediaRecorder(stream); r.mr.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); }; r.mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); recDone(r); }; r.mr.start(); } catch (e) { r.mr = null; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) try { const sr = r.sr = new SR(); sr.lang = LANG().cfg().bcp; sr.continuous = true; sr.onresult = e => { r.srText = [...e.results].map(y => y[0].transcript).join(" "); }; sr.onerror = () => {}; sr.start(); } catch (e) { r.sr = null; }
    if (!r.mr && !r.sr) { stream.getTracks().forEach(t => t.stop()); REC = null; tip("这个浏览器不能录音"); return; }
    RS[ci] = { on: true }; draw();
    const dur = x.s != null && x.e != null ? x.e - x.s : LANG().words(x.t).length * 0.45;
    r.timer = setTimeout(() => { if (REC === r) recStop(false); }, Math.min(30, dur * 2 + 3) * 1000);
  }
  function recStop(cancel) {
    const r = REC; if (!r) return; REC = null; clearTimeout(r.timer); r.cancel = !!cancel;
    try { if (r.sr) r.sr.stop(); } catch (e) {}
    if (r.mr && r.mr.state !== "inactive") r.mr.stop(); else { r.stream.getTracks().forEach(t => t.stop()); recDone(r); }
  }
  async function recDone(r) {
    if (r.cancel) { if (r.cards === C && RS[r.key] && RS[r.key].on) { delete RS[r.key]; draw(); } return; }
    RS[r.key] = { busy: true }; if (C === r.cards) draw();
    const blob = r.chunks.length ? new Blob(r.chunks, { type: r.chunks[0].type || "audio/webm" }) : null; let text = "";
    if (blob) try { const j = await (await fetch("/api/stt?lang=" + LANG().cur(), { method: "POST", headers: { "Content-Type": blob.type }, body: blob })).json(); if (j && j.ok) text = j.text || ""; } catch (e) {}
    if (!text) { await new Promise(res => setTimeout(res, 500)); text = r.srText; }
    const a = ntokL(r.t), hit = lcsHit(a, ntokL(text), near);
    const o = { said: text, hit, score: a.length ? Math.round(hit.filter(Boolean).length / a.length * 100) : 0, url: blob ? URL.createObjectURL(blob) : "" };
    if (r.cards !== C) return;
    RS[r.key] = o; if (r.k === "zh" && !res[r.key]) res[r.key] = { seen: true }; // 看中文说：说完就给看原句
    draw();
  }
  function recReset() { if (REC) recStop(true); Object.values(RS).forEach(x => { if (x && x.url) try { URL.revokeObjectURL(x.url); } catch (e) {} }); RS = {}; }

  // ---------- 🎭 角色扮演：原声放别人的台词，轮到你的停下来等你说 ----------
  function rpStart(role) { rpStop(); RP = { ci, role, i: 0, on: false, done: false }; rpGo(); }
  function rpGo() { if (!RP) return; if (RP.done) { RP.i = 0; RP.done = false; } RP.on = true; rpStep(); }
  function rpStop() { if (!RP) return; clearTimeout(RP.t); const was = RP.on; RP.on = false; RP.wait = false; if (was) hush(); }
  function rpStep() {
    const R = RP, c = C && C.cards[R.ci]; if (!R || !R.on || !c || ci !== R.ci) return;
    clearTimeout(R.t);
    if (R.i >= c.list.length) { R.on = false; R.wait = false; R.done = true; res[R.ci] = { seen: true }; draw(); return; }
    const si = c.list[R.i], y = M.sents[si];
    if (y.who === R.role) { // 轮到你：等你说（大约原句长度的 1.5 倍），也可以点「我说完了」
      R.wait = true; draw(); rpScroll();
      const d = y.s != null && y.e != null ? y.e - y.s : LANG().words(y.t).length * 0.45;
      R.t = setTimeout(() => { if (RP === R && R.on && R.wait) rpNext(); }, Math.max(2.5, d * 1.5 + 1.5) * 1000);
    } else { R.wait = false; draw(); rpScroll(); play(si, false, () => { if (RP === R && R.on) R.t = setTimeout(() => { R.i++; rpStep(); }, 300); }); }
  }
  function rpNext() { if (!RP || !RP.on) return; clearTimeout(RP.t); RP.wait = false; RP.i++; rpStep(); }
  function rpScroll() { try { const el = root.querySelector(".dr-rp .cur"); if (el) el.scrollIntoView({ block: "nearest" }); } catch (e) {} }

  // ---------- 🤔 为什么没听出来（英语；和 📻 BBC 听力的精听同一个 AI 接口，后台存 KV，同一句只花一次） ----------
  async function whyLoad() {
    const c = C && C.cards[ci], R = res[ci]; if (!c || !R) return; const x = M.sents[c.s], key = x.t;
    const missed = c.k === "gap" ? [c.word] : LANG().words(x.t).filter((w, i) => R.hit && !R.hit[i]);
    if (!missed.length) return; WHY[key] = { busy: true }; draw();
    try {
      const j = await (await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "whymiss", sent: x.t, typed: R.typed || "", missed: [...new Set(missed)].slice(0, 8) }) })).json();
      if (!j || !j.ok || !(j.items || []).length) throw new Error(j && j.error === "noai" ? "AI 没开" : "这次没讲好，再点一次");
      WHY[key] = { items: j.items, tip: j.tip_zh || "" };
    } catch (e) { WHY[key] = { err: e.message || String(e) }; }
    draw();
  }
  function whyHtml(c, R) {
    if (!R || R.ok || LANG().cur() !== "en" || (c.k === "dict" && !(R.hit || []).some(h => !h))) return "";
    const W = WHY[M.sents[c.s].t];
    if (!W) return '<div class="dr-btns"><button class="ui-btn" data-a="why">🤔 为什么没听出来</button></div>';
    if (W.busy) return '<div class="dr-why">AI 在分析这句的发音（连读、弱读、吞音…）</div>';
    if (W.err) return '<div class="dr-why">' + esc(W.err) + ' <button class="ui-btn" data-a="why">重试</button></div>';
    return W.items.map(x => '<div class="dr-why"><b>' + esc(x.chunk) + "</b>" + (x.sounds ? " 听起来像 <code>" + esc(x.sounds) + "</code>" : "") + (x.kind_zh ? '<span class="kd">' + esc(x.kind_zh) + "</span>" : "") + "<div>" + esc(x.why_zh || "") + "</div></div>").join("") + (W.tip ? '<div class="dr-why">💡 ' + esc(W.tip) + "</div>" : "");
  }

  // ---------- 界面 ----------
  const CSS = `
  #drill{display:none;max-width:960px;margin:0 auto;padding:6px 0 40px;color:var(--ui-ink);font-family:var(--ui-font);overflow-wrap:anywhere}#drill.on{display:block}
  #drill .dr-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 6px}#drill .dr-h h2{font-size:20px;margin:0;font-weight:900}#drill .dr-h .sp{flex:1}
  #drill .dr-sub{color:var(--ui-muted);font-size:13.5px;line-height:1.6;margin:0 0 12px}
  #drill .dr-segs{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}#drill .dr-segs .dr-seg{margin:0;align-items:center}#drill .dr-seg .src{flex:0 0 34px;font-size:11.5px;font-weight:800;letter-spacing:.04em;color:var(--ui-muted)}
  #drill .dr-seg{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}#drill .dr-seg button{border:1px solid var(--ui-line-2);background:var(--ui-surface);color:var(--ui-ink-2);border-radius:999px;padding:6px 13px;font:inherit;font-size:13.5px;cursor:pointer}#drill .dr-seg button.on{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff;font-weight:700}
  #drill .dr-ep{display:flex;gap:12px;align-items:center;width:100%;text-align:left;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:10px;margin:0 0 8px;color:inherit;font:inherit;cursor:pointer}
  #drill .dr-ep:hover{border-color:var(--ui-pur-line)}#drill .dr-ep img{width:84px;height:48px;object-fit:cover;border-radius:8px;flex:0 0 auto;background:var(--ui-surface-2)}
  #drill .dr-ep .t{flex:1;min-width:0}#drill .dr-ep b{display:block;font-size:15px;line-height:1.4}#drill .dr-ep small{color:var(--ui-muted);font-size:12.5px}
  #drill .dr-badge{flex:0 0 auto;font-size:12px;font-weight:800;color:var(--ui-pur-text);background:var(--ui-pur-soft);border-radius:999px;padding:3px 9px}#drill .dr-badge.done{color:var(--ui-on-accent);background:var(--ui-green)}
  #drill .dr-cont{background:var(--ui-hero);border:1px solid var(--ui-pur-line);border-radius:16px;padding:14px 16px;margin:0 0 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}#drill .dr-cont .t{flex:1;min-width:200px}
  #drill .dr-les{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:12px;padding:12px 14px;margin:0 0 8px;color:inherit;font:inherit;cursor:pointer}
  #drill .dr-les:hover{border-color:var(--ui-pur-line)}#drill .dr-les .t{flex:1;min-width:0}#drill .dr-les small{display:block;color:var(--ui-muted);font-size:12.5px;margin-top:2px}
  #drill .dr-note{background:var(--ui-orange-soft);border:1px solid var(--ui-orange-line);border-radius:12px;padding:9px 12px;font-size:13.5px;line-height:1.6;margin:0 0 12px}
  #drill .dr-empty{text-align:center;color:var(--ui-ink-2);padding:34px 12px;line-height:1.9;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:16px}
  #drill .dr-top{display:flex;align-items:center;gap:10px;margin:0 0 8px}#drill .dr-top .t{flex:1;min-width:0;font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #drill .dr-bar{display:flex;align-items:center;gap:10px;margin:0 0 14px;color:var(--ui-muted);font-size:12.5px}#drill .dr-bar .tr{flex:1;height:5px;border-radius:9px;background:var(--ui-surface-2);overflow:hidden}#drill .dr-bar i{display:block;height:100%;background:var(--ui-pur);border-radius:9px;transition:width .25s}
  #drill .dr-body{display:grid;grid-template-columns:210px 1fr;gap:18px;align-items:start}
  #drill .dr-acts{list-style:none;margin:0;padding:0;display:grid;gap:4px}#drill .dr-acts button{width:100%;text-align:left;border:0;background:transparent;color:var(--ui-muted);font:inherit;font-size:13.5px;padding:7px 9px;border-radius:9px;cursor:pointer}
  #drill .dr-acts button.on{background:var(--ui-pur-soft);color:var(--ui-pur-text);font-weight:800}#drill .dr-acts button:hover{color:var(--ui-ink)}#drill .dr-acts small{opacity:.75;margin-left:4px}
  #drill .dr-card{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:18px;padding:20px 20px 18px;min-height:260px}
  #drill .dr-ins{font-size:12.5px;color:var(--ui-pur-text);font-weight:800;margin:0 0 14px}
  #drill .dr-who{font-size:12.5px;color:var(--ui-muted);font-weight:700;margin:0 0 4px}
  #drill .dr-en{font-size:22px;line-height:1.55;font-weight:700;margin:0 0 10px}#drill .dr-en .gap{display:inline-block;min-width:4.5em;border-bottom:2px solid var(--ui-pur);color:var(--ui-pur-text);text-align:center}
  #drill .dr-zh{font-size:15.5px;line-height:1.65;color:var(--ui-ink-2);margin:0 0 10px}#drill .dr-zh small{color:var(--ui-muted)}
  #drill .dr-btns{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}
  #drill .dr-big{display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;border:0;background:var(--ui-pur);color:#fff;font-size:26px;cursor:pointer;margin:0 0 16px}
  #drill .dr-opts{display:grid;gap:8px}#drill .dr-opts button{text-align:left;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:12px;padding:11px 13px;font:inherit;font-size:15.5px;line-height:1.5;cursor:pointer}
  #drill .dr-opts button b{color:var(--ui-muted);margin-right:6px}#drill .dr-opts button.ok{border-color:var(--ui-green);background:var(--ui-green-soft)}#drill .dr-opts button.no{border-color:var(--ui-red);background:var(--ui-red-soft)}
  #drill input.dr-in{width:100%;max-width:340px;box-sizing:border-box;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:12px;padding:11px 12px;font:inherit;font-size:18px}
  #drill .dr-fb{margin:12px 0 0;font-size:15px;line-height:1.7}#drill .dr-fb .ok{color:var(--ui-green);font-weight:800}#drill .dr-fb .no{color:var(--ui-red);font-weight:800}
  #drill .dr-w{font-size:28px;font-weight:900;margin:0 0 8px;display:flex;align-items:center;gap:10px}
  #drill .dr-ex{font-size:15px;color:var(--ui-ink-2);font-style:italic;line-height:1.6;margin:8px 0 0}
  #drill .dr-sum{text-align:center;padding:10px 0}#drill .dr-sum .n{font-size:44px;font-weight:900;color:var(--ui-green)}
  #drill .dr-nav{position:sticky;bottom:0;display:flex;justify-content:center;gap:14px;padding:12px 0 calc(8px + env(safe-area-inset-bottom));margin-top:14px;background:linear-gradient(transparent,var(--ui-bg) 30%)}
  #drill .dr-nav button{display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;color:var(--ui-ink-2);font:inherit;cursor:pointer}
  #drill .dr-nav button span{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;border:1px solid var(--ui-line-2);background:var(--ui-surface);font-size:18px}
  #drill .dr-nav button small{font-size:10.5px;color:var(--ui-muted);font-weight:700}#drill .dr-nav button:disabled{opacity:.35;cursor:default}#drill .dr-nav button.on span{border-color:var(--ui-pur);color:var(--ui-pur-text)}
  @media (max-width:760px){#drill .dr-body{grid-template-columns:1fr}#drill .dr-acts{display:none}#drill .dr-card{padding:16px 15px;border-radius:16px}#drill .dr-en{font-size:19px}#drill .dr-ep img{width:68px;height:40px}}
  @media (hover:none){#drill .dr-nav button small{display:none}}
  #drill .dr-lv{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 12px;font-size:13px;color:var(--ui-muted)}#drill .dr-lv small{flex-basis:100%;font-size:12.5px}
  #drill .dr-week{font-size:13px;color:var(--ui-ink-2);margin:-4px 0 12px;line-height:1.6}#drill .dr-week .up{color:var(--ui-green)}#drill .dr-week .dn{color:var(--ui-red)}
  #drill .dr-cont.rv{background:var(--ui-surface);border-color:var(--ui-orange-line)}
  #drill .hk{color:var(--ui-green)}#drill .hm{color:var(--ui-red);text-decoration:underline wavy;text-underline-offset:4px}
  #drill .dr-en.sm{font-size:18px;margin:10px 0 4px}
  #drill .dr-fb .mid{color:var(--ui-orange);font-weight:800}#drill .dr-fb small{color:var(--ui-muted);font-size:13px}
  #drill input.dr-in.wide{max-width:none}
  #drill .ui-btn.rec{border-color:var(--ui-red);color:var(--ui-red)}
  #drill .dr-ord{display:flex;flex-wrap:wrap;gap:8px;min-height:52px;padding:10px;border:1px dashed var(--ui-line-2);border-radius:12px;margin:0 0 12px;align-items:center}
  #drill .dr-ord .ph{color:var(--ui-muted);font-size:13.5px}
  #drill .dr-pool{display:flex;flex-wrap:wrap;gap:8px}
  #drill .dr-tok{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;padding:8px 12px;font:inherit;font-size:16px;cursor:pointer}
  #drill .dr-tok:disabled{opacity:.25;cursor:default}#drill .dr-ord .dr-tok{border-color:var(--ui-pur-line);background:var(--ui-pur-soft)}#drill .dr-tok small{color:var(--ui-muted);font-size:11px;margin-right:5px}
  #drill .dr-zh.big{font-size:20px;color:var(--ui-ink);font-weight:700;line-height:1.6}
  #drill .dr-rp-who{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13.5px;color:var(--ui-ink-2);margin:0 0 12px}
  #drill .dr-rp{display:grid;gap:6px;max-height:46vh;overflow:auto;padding:2px}
  #drill .dr-rp .rl{padding:8px 11px;border-radius:10px;background:var(--ui-surface-2);font-size:15px;line-height:1.55;border:1px solid transparent}
  #drill .dr-rp .rl b{display:block;font-size:12px;color:var(--ui-muted)}#drill .dr-rp .rl.me{border-color:var(--ui-pur-line)}#drill .dr-rp .rl.me b{color:var(--ui-pur-text)}
  #drill .dr-rp .rl.cur{border-color:var(--ui-pur);box-shadow:0 0 0 2px var(--ui-pur-soft)}#drill .dr-rp .rl.past{opacity:.6}#drill .dr-rp .hid{color:var(--ui-muted);font-style:italic}
  #drill .dr-why{background:var(--ui-surface-2);border-radius:10px;padding:9px 11px;margin:8px 0 0;font-size:14px;line-height:1.6}#drill .dr-why code{color:var(--ui-orange)}
  #drill .dr-why .kd{margin-left:6px;font-size:11.5px;color:var(--ui-pur-text);background:var(--ui-pur-soft);border-radius:999px;padding:1px 7px}
  #drill .dr-from{font-size:12px;color:var(--ui-muted);margin:-8px 0 10px}`;

  function lvHtml() {
    const v = lvl();
    return '<div class="dr-lv">难度 ' + [1, 2, 3].map(k => '<button class="ui-chip' + (k === v ? " on" : "") + '" data-lv="' + k + '">' + LV[k].name + "</button>").join("") + "<small>" + esc(LV[v].tip) + "</small></div>";
  }
  function weekHtml() {
    const [a, b] = weekOf(); if (!a.n && !a.rv && !b.n) return "";
    const pa = a.q ? Math.round(a.ok / a.q * 100) : 0, pb = b.q ? Math.round(b.ok / b.q * 100) : 0;
    return '<div class="dr-week">📈 最近 7 天：练了 ' + a.d + " 天、" + a.n + " 节" + (a.rv ? "、复习 " + a.rv + " 句" : "") + (a.q ? " · 正确率 " + pa + "%" + (b.q ? "（前 7 天 " + pb + "%" + (pa > pb ? ' <span class="up">↑</span>' : pa < pb ? ' <span class="dn">↓</span>' : "") + "）" : "") : "") + "</div>";
  }
  function home() {
    const lg = LANG().cfg(), P = PROV[lg.code];
    let s = '<div class="dr-h"><h2>🧩 练习课</h2><span class="sp"></span><span class="ui-chip">' + lg.flag + " " + esc(lg.name) + "</span></div>";
    if (!P) return s + '<div class="dr-empty">' + lg.flag + " <b>" + esc(lg.name) + "练习课还在准备</b><br>素材来源还没接上。<br><br><button class=\"ui-btn pri\" data-a=\"en\">🇬🇧 切回英语</button></div>";
    s += '<p class="dr-sub">素材：' + esc(P.name) + "。每期拆成几节、每节 8 句左右，一张卡一张卡做：跟读（可以录音打分）→ 听音选句 → 排词成句 → 听写填空 → 整句听写 → 看中文说" + (P.dialog ? " → 角色扮演" : "") + "。全是真人原声；做错的当场再做一遍，隔天、3 天、7 天后再复习。</p>";
    s += lvHtml();
    const due = revDue().length;
    if (due) s += '<div class="dr-cont rv"><div class="t">📅 <b>今日复习</b>：' + due + " 句以前做错的<br><small style=\"color:var(--ui-muted)\">对了就隔几天再来，连对 3 次就算会了</small></div><button class=\"ui-btn pri\" data-a=\"review\">开始复习 →</button></div>";
    s += weekHtml();
    const last = lastOf();
    if (last) {
      const pr = progOf(last), done = Object.keys(pr).length, m = MODELS[lg.code + "/" + last];
      s += '<div class="dr-cont"><div class="t"><small style="color:var(--ui-muted)">上次练到</small><br><b>' + esc(m ? m.title : (findEp(last) || {}).t || last) + "</b>" + (done ? " · 做完 " + done + " 节" : "") + '</div><button class="ui-btn pri" data-ep="' + esc(last) + '">继续 →</button></div>';
    }
    const cs = curSer();
    const segB = x => '<button data-s="' + x[0] + '" class="' + (x[0] === cs ? "on" : "") + '">' + x[1] + "</button>";
    if (P.series.length > 1) s += P.series[0][2] ? '<div class="dr-segs">' + [...new Set(P.series.map(x => x[2]))].map(g => '<div class="dr-seg"><span class="src">' + esc(g) + "</span>" + P.series.filter(x => x[2] === g).map(segB).join("") + "</div>").join("") + "</div>" // 栏目多：一个来源一行（同 📻 听力节目）
      : '<div class="dr-seg">' + P.series.map(segB).join("") + "</div>";
    const L = LISTS[lg.code + "/" + cs];
    if (!L) { loadList(); return s + '<div class="dr-empty">正在取节目列表…</div>'; }
    if (L.err) return s + '<div class="dr-empty">列表没拿到：' + esc(L.err) + '<br><button class="ui-btn" data-a="relist">再试一次</button></div>';
    if (L.loading) return s + '<div class="dr-empty">正在取节目列表…</div>';
    if (!L.list.length) return s + '<div class="dr-empty">' + (cs === "new" ? "最近 7 天没有新节目" : "这个栏目没有节目") + "</div>";
    const nShow = MORE[lg.code + "/" + cs] || 30;
    return s + L.list.slice(0, nShow).map(x => { const n = Object.keys(progOf(x.id)).length; return '<button class="dr-ep" data-ep="' + esc(x.id) + '">' + (x.img ? '<img loading="lazy" alt="" src="' + esc(window.NET && NET.src ? NET.src(x.img) : x.img) + '">' : "") + '<span class="t"><b>' + esc(x.t) + "</b><small>" + esc(x.d || "") + "</small></span>" + (n ? '<span class="dr-badge">练过 ' + n + " 节</span>" : "") + "</button>"; }).join("") +
      (L.list.length > nShow ? '<div style="text-align:center;margin:12px 0"><button class="ui-btn" data-a="more">显示更多（还有 ' + (L.list.length - nShow) + " 期）</button></div>" : "");
  }
  function findEp(id) { for (const k in LISTS) { const f = (LISTS[k].list || []).find(x => x.id === id); if (f) return f; } return null; }
  async function loadList() {
    const lg = LANG().cur(), cs = curSer(), k = lg + "/" + cs; if (LISTS[k] && !LISTS[k].err) return; LISTS[k] = { list: [], loading: 1 };
    try { LISTS[k] = { list: await PROV[lg].list(cs) }; } catch (e) { LISTS[k] = { err: e.message || String(e), list: [] }; }
    if (view === "home") draw();
  }
  function epView() {
    const L = lessons(M.sents.length), pr = progOf(M.id), nx = L.findIndex((_, i) => !pr[i]);
    let s = '<div class="dr-top"><button class="ui-btn" data-a="home">← 换一期</button><span class="t">' + esc(M.title) + "</span></div>";
    if (M.note) s += '<div class="dr-note">' + esc(M.note) + "</div>";
    s += '<p class="dr-sub">共 ' + M.sents.length + " 句，分 " + L.length + " 节。" + (M.vocab.length ? "第 1 节先过一遍 " + Math.min(10, M.vocab.length) + " 个重点词。" : "") + "做过的节可以「🔀 换一套题」再练。</p>" + lvHtml();
    s += '<div class="dr-btns" style="margin:0 0 14px"><button class="ui-btn pri" data-li="' + (nx < 0 ? 0 : nx) + '">' + (nx < 0 ? "全部做完了 · 从第 1 节再来" : nx === 0 ? "开始第 1 节 →" : "继续第 " + (nx + 1) + " 节 →") + "</button></div>";
    s += L.map((r, i) => { const p = pr[i], sl = M.sents.slice(r[0], r[1]), f = (sl.find(x => LANG().words(x.t).length >= 5) || sl[0]).t; return '<button class="dr-les" data-li="' + i + '"><span class="t"><b>第 ' + (i + 1) + " 节</b><small>" + esc(f.slice(0, 70)) + (f.length > 70 ? "…" : "") + "</small></span>" + (p ? '<span class="dr-badge done">✓ ' + p.sc + "%" + (p.n > 1 ? " · " + p.n + " 遍" : "") + "</span>" : '<span class="dr-badge">' + (r[1] - r[0]) + " 句</span>") + "</button>"; }).join("");
    return s;
  }
  function zhLine(x, show) { if (!x.zh) return ""; return '<div class="dr-zh"' + (show ? "" : ' style="display:none"') + ">" + esc(x.zh) + (x.zhAll ? " <small>（整段的翻译）</small>" : "") + "</div>"; }
  function recBtns() {
    const R = RS[ci], on = REC && REC.key === ci && REC.cards === C;
    return '<button class="ui-btn' + (on ? " rec" : "") + '" data-a="rec" title="录音（R）">' + (on ? "⏹ 停" : R && R.score != null ? "🎙 再录一遍" : "🎙 录音") + "</button>" + (R && R.url ? '<button class="ui-btn" data-a="myrec">▶ 我的录音</button>' : "");
  }
  function recHtml(x) {
    const R = RS[ci]; if (!R) return "";
    if (R.on) return '<div class="dr-fb"><span class="no">● 在录</span>…念完点「⏹ 停」（或按 R）</div>';
    if (R.busy) return '<div class="dr-fb">⏳ 在听你念的…</div>';
    return '<div class="dr-en sm">' + markHtml(x.t, R.hit) + '</div><div class="dr-fb"><b class="' + (R.score >= 85 ? "ok" : R.score >= 60 ? "mid" : "no") + '">' + R.score + "%</b> " + (R.score >= 85 ? "读得很好" : R.score >= 60 ? "大部分读对了，红色的词再练练" : "红色的词没听出来，慢放再跟一遍") + (R.said ? "<br><small>听到你说：" + esc(R.said) + "</small>" : "<br><small>没听到声音，靠近麦克风再试</small>") + "</div>";
  }
  function cardHtml(c) {
    const o = opt(), R = res[ci], zok = LV[lvl()].zhOk;
    if (c.k === "voc") { const v = M.vocab[c.v]; return '<div class="dr-w">' + esc(v.w) + ' <button class="ui-btn" data-a="sayw">🔊</button></div><div class="dr-zh">' + esc(v.def) + "</div>" + (v.zh ? '<div class="dr-zh" style="color:var(--ui-ink)">' + esc(v.zh) + "</div>" : "") + (v.ex ? '<div class="dr-ex">' + esc(v.ex) + "</div>" : "") + '<div class="dr-btns"><button class="ui-btn" data-a="addw">＋ 加入生词本</button></div>'; }
    if (c.k === "end") return endHtml();
    const x = M.sents[c.s] || { t: "" }, who = x.who ? '<div class="dr-who">' + esc(x.who) + "</div>" : "", from = c.from ? '<div class="dr-from">出自：' + esc(c.from) + "</div>" : "";
    if (c.k === "say") return who + '<div class="dr-en">' + esc(x.t) + "</div>" + zhLine(x, o.zh && zok) + '<div class="dr-btns"><button class="ui-btn pri" data-a="play">🔊 再听一遍</button><button class="ui-btn" data-a="slow">🐢 慢放</button>' + recBtns() + (x.zh && zok ? '<button class="ui-btn" data-a="zh">' + (o.zh ? "隐藏中文" : "看中文") + "</button>" : "") + "</div>" + recHtml(x);
    if (c.k === "pick") {
      let s = from + '<button class="dr-big" data-a="play" title="再听一遍（S）">🔊</button><div class="dr-opts">' + c.opts.map((t, i) => '<button data-o="' + i + '" class="' + (R ? (i === c.ans ? "ok" : i === R.pick ? "no" : "") : "") + '"' + (R ? " disabled" : "") + "><b>" + (i + 1) + "</b>" + esc(t) + "</button>").join("") + "</div>";
      if (R) s += '<div class="dr-fb">' + (R.ok ? '<span class="ok">✓ 对了</span>' : '<span class="no">✗ 听到的是第 ' + (c.ans + 1) + " 句</span>" + (c.rv || c.redo ? "" : "（明天再复习这句）")) + "</div>" + zhLine(x, true);
      return s;
    }
    if (c.k === "gap") {
      const parts = c.shown.split("\u0000"), shown = R ? '<span class="gap">' + esc(c.word) + "</span>" : '<span class="gap">&nbsp;</span>';
      let s = from + who + '<div class="dr-en">' + esc(parts[0]) + shown + esc(parts[1] || "") + "</div>";
      if (!R) s += '<input class="dr-in" id="dr-in" placeholder="空着的词" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><div class="dr-btns"><button class="ui-btn pri" data-a="check">检查</button><button class="ui-btn" data-a="play">🔊 再听</button><button class="ui-btn" data-a="slow">🐢 慢放</button><button class="ui-btn" data-a="giveup">不会，看答案</button></div>';
      else s += '<div class="dr-fb">' + (R.ok ? '<span class="ok">✓ 对了</span>' : '<span class="no">✗</span> ' + (R.typed ? "你写的 <s>" + esc(R.typed) + "</s>，" : "") + "答案 <b>" + esc(c.word) + "</b>") + (R.note ? "（" + esc(R.note) + "）" : "") + "</div>" + zhLine(x, true) + whyHtml(c, R) + '<div class="dr-btns"><button class="ui-btn" data-a="play">🔊 再听</button><button class="ui-btn" data-a="slow">🐢 慢放</button></div>';
      return s;
    }
    if (c.k === "dict") {
      let s = from + '<button class="dr-big" data-a="play" title="再听一遍（S）">🔊</button>';
      if (!R) s += '<input class="dr-in wide" id="dr-in" placeholder="把听到的整句写下来" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><div class="dr-btns"><button class="ui-btn pri" data-a="check">检查</button><button class="ui-btn" data-a="slow">🐢 慢放</button><button class="ui-btn" data-a="giveup">不会，看答案</button></div>';
      else s += who + '<div class="dr-en">' + markHtml(x.t, R.hit || []) + '</div><div class="dr-fb">' + (R.ok ? '<span class="ok">✓ 全对</span>' : '<span class="no">✗</span> 写对了 ' + R.sc + "%（红色的词没写对）") + (R.typed ? "<br><small>你写的：" + esc(R.typed) + "</small>" : "") + "</div>" + zhLine(x, true) + whyHtml(c, R) + '<div class="dr-btns"><button class="ui-btn" data-a="play">🔊 再听</button><button class="ui-btn" data-a="slow">🐢 慢放</button></div>';
      return s;
    }
    if (c.k === "ord") {
      const st = ORD[ci] || [];
      let s = from + '<button class="dr-big" data-a="play" title="再听一遍（S）">🔊</button>';
      if (!R) {
        s += '<div class="dr-ord">' + (st.length ? st.map((p, k) => '<button class="dr-tok" data-ou="' + k + '" title="点一下拿回去">' + esc(c.ch[c.sh[p]]) + "</button>").join("") : '<span class="ph">按听到的顺序点下面的词块</span>') + "</div>";
        s += '<div class="dr-pool">' + c.sh.map((ix, j) => '<button class="dr-tok" data-oc="' + j + '"' + (st.includes(j) ? " disabled" : "") + "><small>" + (j + 1) + "</small>" + esc(c.ch[ix]) + "</button>").join("") + "</div>";
        s += '<div class="dr-btns"><button class="ui-btn" data-a="ordclr"' + (st.length ? "" : " disabled") + '>↺ 重来</button><button class="ui-btn" data-a="slow">🐢 慢放</button><button class="ui-btn" data-a="giveup">不会，看答案</button></div>';
      } else s += who + '<div class="dr-en">' + esc(x.t) + '</div><div class="dr-fb">' + (R.ok ? '<span class="ok">✓ 顺序对了</span>' : '<span class="no">✗</span> ' + (R.typed ? "你排的：<s>" + esc(R.typed) + "</s>" : "看看原句的顺序")) + "</div>" + zhLine(x, true) + '<div class="dr-btns"><button class="ui-btn" data-a="play">🔊 再听</button></div>';
      return s;
    }
    if (c.k === "zh") {
      let s = '<div class="dr-zh big">' + esc(x.zh) + "</div>";
      if (!R) s += '<div class="dr-btns"><button class="ui-btn pri" data-a="reveal">看原句、听原声</button>' + recBtns() + "</div>" + recHtml(x);
      else s += who + (RS[ci] && RS[ci].hit ? "" : '<div class="dr-en">' + esc(x.t) + "</div>") + recHtml(x) + '<div class="dr-btns"><button class="ui-btn pri" data-a="play">🔊 听原声</button><button class="ui-btn" data-a="slow">🐢 慢放</button>' + recBtns() + "</div>";
      return s;
    }
    if (c.k === "role") {
      const rp = RP && RP.ci === ci ? RP : null, hard = lvl() === 3;
      let s = '<div class="dr-rp-who">你演：' + c.who.map(w => '<button class="ui-chip' + (rp && rp.role === w ? " on" : "") + '" data-role="' + esc(w) + '">' + esc(w) + "</button>").join("") + "</div>";
      if (!rp) return s + '<div class="dr-zh">点上面一个名字开始。原声会放另一个人的台词，轮到你的时候停下来，你大声说出你的台词' + (hard ? "（难度「难」：你的台词不显示，只给中文）" : "") + "。</div>";
      s += '<div class="dr-rp">' + c.list.map((si, j) => { const y = M.sents[si], me = y.who === rp.role, cur = j === rp.i && rp.on, past = j < rp.i || rp.done, hide = me && hard && !past; return '<div class="rl' + (me ? " me" : "") + (cur ? " cur" : "") + (past ? " past" : "") + '"><b>' + esc(y.who || "") + (me ? "（你）" : "") + "</b>" + (hide ? '<span class="hid">（你来说' + (y.zh && !y.zhAll ? "：" + esc(y.zh) : "") + "）</span>" : esc(y.t)) + "</div>"; }).join("") + "</div>";
      s += '<div class="dr-btns">' + (rp.done ? '<span class="dr-fb" style="margin:0"><span class="ok">✓ 演完了</span></span><button class="ui-btn pri" data-a="rp-go">再演一遍</button>' : rp.on ? (rp.wait ? '<button class="ui-btn pri" data-a="rp-next">我说完了 →</button>' : "") + '<button class="ui-btn" data-a="rp-stop">⏸ 停</button>' : '<button class="ui-btn pri" data-a="rp-go">' + (rp.i ? "▶ 接着演" : "▶ 开始") + "</button>") + "</div>";
      return s;
    }
    return "";
  }
  function scoreOf() { // 第一次做的算分（错题再来一遍不改分）
    const q = C.cards.map((k, i) => ({ k, r: res[i] })).filter(o => GRADED.has(o.k.k) && !o.k.redo), right = q.filter(o => o.r && o.r.ok).length;
    return { q, right, done: q.filter(o => o.r).length, sc: q.length ? Math.round(right / q.length * 100) : 100 };
  }
  function endHtml() {
    const { q, right, sc } = scoreOf(), skip = q.filter(o => !o.r).length;
    const rd = C.cards.map((k, i) => ({ k, r: res[i] })).filter(o => o.k.redo), rdOk = rd.filter(o => o.r && o.r.ok).length;
    const recs = Object.values(RS).filter(x => x && x.score != null), ra = recs.length ? Math.round(recs.reduce((a, x) => a + x.score, 0) / recs.length) : 0;
    const lines = [q.length ? (skip ? "一共 " + q.length + " 题，答了 " + (q.length - skip) + " 题（跳过的算错）" : "答了 " + q.length + " 题") + "，对了 " + right + " 题" : "", rd.length ? "错题再来一遍：对了 " + rdOk + " / " + rd.length : "", recs.length ? "录音 " + recs.length + " 句，平均 " + ra + "%" : ""].filter(Boolean).join("；");
    if (C.review) {
      const left = revDue().length;
      return '<div class="dr-sum"><div style="font-size:15px;color:var(--ui-muted)">今日复习做完了</div><div class="n">' + sc + '%</div><div class="dr-zh">' + esc(lines) + (q.some(o => o.r && !o.r.ok) ? "；错的明天再来" : "") + (right ? "；对的隔几天再出" : "") + '</div><div class="dr-btns" style="justify-content:center">' + (left ? '<button class="ui-btn pri" data-a="review">再复习一组（还有 ' + left + " 句）</button>" : "") + '<button class="ui-btn' + (left ? "" : " pri") + '" data-a="home">回到列表</button></div></div>';
    }
    const L = lessons(M.sents.length), more = LI + 1 < L.length, wrong = q.some(o => o.r && !o.r.ok);
    if (q.length && skip === q.length) return '<div class="dr-sum"><div style="font-size:15px;color:var(--ui-muted)">第 ' + (LI + 1) + ' 节</div><div class="dr-zh">还一题没做：点左边的活动（或按 A / D 翻卡片）开始。</div><div class="dr-btns" style="justify-content:center"><button class="ui-btn pri" data-act="0">从头开始</button><button class="ui-btn" data-a="ep">回到本期</button></div></div>';
    return '<div class="dr-sum"><div style="font-size:15px;color:var(--ui-muted)">第 ' + (LI + 1) + " 节做完了</div><div class=\"n\">" + sc + '%</div><div class="dr-zh">' + esc(lines) + (wrong ? "；做错的明天会在「📅 今日复习」里再出现" : "") + '</div><div class="dr-btns" style="justify-content:center">' + (more ? '<button class="ui-btn pri" data-li="' + (LI + 1) + '">下一节 →</button>' : '<button class="ui-btn pri" data-a="ep">这期全部做完 ✓</button>') + '<button class="ui-btn" data-li="' + LI + '" data-v="' + (C.v || 0) + '">再做一遍</button><button class="ui-btn" data-li="' + LI + '" data-v="' + ((C.v || 0) + 1) + '" title="同一节换几句来考、换个词挖空">🔀 换一套题</button><button class="ui-btn" data-a="ep">回到本期</button></div></div>';
  }
  function lessonView() {
    const c = C.cards[ci], N = C.cards.length, act = C.acts[c.act];
    const head = C.review ? "📅 今日复习 · " + (N - 1) + " 句" : esc(M.title) + " · 第 " + (LI + 1) + " / " + lessons(M.sents.length).length + " 节" + (C.v ? " · 第 " + (C.v + 1) + " 套题" : "");
    let s = '<div class="dr-top"><button class="ui-btn" data-a="' + (C.review ? "home" : "ep") + '">←</button><span class="t">' + head + '</span><button class="ui-btn" data-a="rate" title="原声速度">' + opt().rate + "×</button></div>";
    s += '<div class="dr-bar"><span class="tr"><i style="width:' + Math.round((ci + 1) / N * 100) + '%"></i></span>' + (ci + 1) + " / " + N + "</div>";
    s += '<div class="dr-body"><ol class="dr-acts">' + C.acts.map((a, i) => '<li><button data-act="' + i + '" class="' + (c.act === i ? "on" : "") + '">' + (i + 1) + ". " + a.name + "<small>" + a.n + "</small></button></li>").join("") + '<li><button data-act="end" class="' + (c.k === "end" ? "on" : "") + '">✓ 小结</button></li></ol>';
    s += '<div class="dr-card">' + (act ? '<div class="dr-ins">' + act.name + " · " + esc(act.ins) + "</div>" : "") + cardHtml(c) + "</div></div>";
    const canZh = c.k === "say" && !!M.sents[c.s].zh && LV[lvl()].zhOk;
    s += '<div class="dr-nav"><button data-a="prev"' + (ci ? "" : " disabled") + '><span>←</span><small>A</small></button><button data-a="play"' + (c.k === "end" || c.k === "role" || (c.k === "zh" && !res[ci]) ? " disabled" : "") + '><span>🔊</span><small>S</small></button><button data-a="zh" class="' + (opt().zh && canZh ? "on" : "") + '"' + (canZh ? "" : " disabled") + '><span>👁</span><small>E</small></button><button data-a="next"' + (ci < N - 1 ? "" : " disabled") + "><span>→</span><small>D</small></button></div>";
    return s;
  }
  function draw() {
    if (!root) return;
    if (busy) { root.innerHTML = '<div class="dr-empty">⏳ ' + esc(busy) + "</div>"; return; }
    if (err) { const e = err; err = ""; root.innerHTML = '<div class="dr-empty">没打开：' + esc(e) + '<br><br><button class="ui-btn" data-a="errhome">← 回到列表</button></div>'; return; }
    root.innerHTML = view === "lesson" && C ? lessonView() : view === "ep" && M ? epView() : home();
    const inp = root.querySelector("#dr-in"); if (inp) try { inp.focus({ preventScroll: true }); } catch (e) {}
    if (window.NAV) NAV.mark(); // 🔙 换栏目 / 打开一期 / 开始一节：记一条页面历史（nav.js）；一节课里翻卡片不算换页
  }
  function go(i, auto) {
    if (!C) return; rpStop(); if (REC) recStop(true);
    i = Math.max(0, Math.min(C.cards.length - 1, i));
    if (C.cards[i].k === "end" && !C.redo && !C.review) { // 到小结前：做错的当场再来一遍（不改分）
      const wrong = C.cards.map((c, j) => ({ c, r: res[j] })).filter(o => GRADED.has(o.c.k) && o.r && !o.r.ok);
      if (wrong.length) { C.redo = true;
        const ai = C.acts.push({ name: "🔁 错题再来一遍", ins: "刚才做错的再做一次（不改分数，只是加深印象）", n: wrong.length }) - 1, e = C.cards.length - 1;
        C.cards.splice(e, 0, ...wrong.map((o, k) => Object.assign({}, o.c, { act: ai, redo: true }, o.c.k === "ord" ? { sh: shufIdx(o.c.ch.length, rng(hash(M.id + "#redo" + k))) } : {})));
        i = e; tip("先把做错的 " + wrong.length + " 题再做一遍");
      }
    }
    ci = i; hush(); draw();
    const c = C.cards[ci];
    if (c.k === "end") finishLesson();
    else if (auto !== false && c.s != null && c.k !== "zh" && c.k !== "role") play(c.s);
    try { const top = root.getBoundingClientRect().top; if (top < 0) window.scrollBy(0, top - 120); } catch (e) {}
  }
  function finishLesson() {
    const S = scoreOf(); if (S.q.length && !S.done) return; // 一题没做就跳到小结：不算做过
    const first = !C.logged; C.logged = true;
    if (C.review) { if (first) logAdd(o => { o.rv += S.q.length; o.q += S.done; o.ok += S.right; }); return; }
    saveProg(M.id, LI, S.sc, first);
    if (first) logAdd(o => { o.n++; o.q += S.done; o.ok += S.right; });
  }
  let navEp = null; // 🔙 正在打开的那一期（加载完之前 M 还是旧的，页面历史要用）
  async function openEp(id) {
    const lg = LANG().cur(), P = PROV[lg]; if (!P) return; navEp = id;
    setLast(id);
    if (!MODELS[lg + "/" + id]) {
      busy = "打开中…"; draw();
      try { MODELS[lg + "/" + id] = await P.load(id, t => { busy = t; draw(); }); }
      catch (e) { busy = ""; err = e.message || String(e); view = "home"; return draw(); }
      busy = "";
    }
    M = MODELS[lg + "/" + id];
    if (!M.sents.length) { err = "这期没有能拆的文稿"; view = "home"; return draw(); }
    view = "ep"; C = null; draw();
  }
  function fresh() { recReset(); ORD = {}; rpStop(); RP = null; res = {}; ci = 0; }
  function openLesson(li, v) { fresh(); LI = li; C = build(M, li, v, lvl()); view = "lesson"; go(0); }
  function openReview() {
    const keys = revDue().slice(0, 20); if (!keys.length) { tip("今天没有要复习的句子"); view = "home"; return draw(); }
    fresh();
    const R = revOf(), sents = [], cards = [];
    keys.forEach((k, i) => {
      const it = R[k]; sents.push({ t: it.t, who: it.who, zh: it.zh, zhAll: false, s: it.s, e: it.e, src: it.src });
      let c = { act: 0, k: it.k, s: i, rv: k, from: it.title };
      if (it.k === "pick") Object.assign(c, { opts: it.opts, ans: it.ans });
      else if (it.k === "gap") Object.assign(c, { word: it.word, shown: it.shown });
      else if (it.k === "ord") { const ch = chunksOf(it.t); if (ch) Object.assign(c, { ch, sh: shufIdx(ch.length, rng(hash(k + lday()))) }); else c.k = "dict"; }
      cards.push(c);
    });
    M = { id: "review", title: "📅 今日复习", src: "", sents, vocab: [], dialog: false };
    LI = 0; C = { acts: [{ name: "📅 今日复习", ins: "以前做错的句子再做一次：对了隔几天再来，错了明天再来", n: cards.length }], cards: cards.concat([{ k: "end", act: -1 }]), range: [0, sents.length], v: 0, review: true };
    view = "lesson"; go(0);
  }
  function judged(c, ok, extra) { // 记结果；做错的进「📅 隔天复习」，复习卡更新下次哪天出
    res[ci] = Object.assign({ ok }, extra || {});
    if (c.rv) revMark(c.rv, ok); else if (!c.redo && !ok) revAdd(c, M.sents[c.s]);
    draw();
  }
  function answerPick(i) {
    const c = C.cards[ci]; if (!c || c.k !== "pick" || res[ci]) return;
    const ok = i === c.ans;
    if (!ok && !c.rv && !c.redo && window.ERR) window.ERR.add([{ src: "listen", kind: "mcq", q: "练习课 · 听音选句：哪一句是原声？", ctx: "出自：" + M.title, opts: c.opts, ans: c.ans, wrong: c.opts[i] }], true);
    judged(c, ok, { pick: i });
  }
  function answerGap(give) {
    const c = C.cards[ci]; if (!c || c.k !== "gap" || res[ci]) return;
    const inp = root.querySelector("#dr-in"), typed = give ? "" : (inp ? inp.value.trim() : "");
    if (!give && !typed) return tip("先写一个词，或者点「不会，看答案」");
    const r = give ? { ok: false, note: "" } : LANG().check(typed, c.word);
    if (!r.ok && !c.rv && !c.redo && window.ERR) window.ERR.add([{ src: "listen", kind: "gap", q: "练习课 · 听写填空（" + M.title + "）", ctx: c.shown.replace("\u0000", "____"), right: c.word, wrong: typed }], true);
    judged(c, r.ok, { typed, note: r.note });
  }
  function answerDict(give) {
    const c = C.cards[ci]; if (!c || c.k !== "dict" || res[ci]) return;
    const inp = root.querySelector("#dr-in"), typed = give ? "" : (inp ? inp.value.trim() : "");
    if (!give && !typed) return tip("先把听到的写下来，或者点「不会，看答案」");
    const a = ntokL(M.sents[c.s].t), hit = lcsHit(a, ntokL(typed), near), n = hit.filter(Boolean).length;
    judged(c, a.length > 0 && n === a.length, { typed, hit, sc: a.length ? Math.round(n / a.length * 100) : 0 });
  }
  function ordPick(j) {
    const c = C.cards[ci]; if (!c || c.k !== "ord" || res[ci] || j < 0 || j >= c.sh.length) return;
    const st = ORD[ci] = ORD[ci] || []; if (st.includes(j)) return; st.push(j);
    if (st.length < c.ch.length) return draw();
    const t = st.map(p => c.ch[c.sh[p]]).join(" ");
    judged(c, t === c.ch.join(" "), { typed: t });
  }

  function onClick(e) {
    const t = e.target;
    const sb = t.closest("[data-s]"); if (sb) { ser = sb.dataset.s; LS("drill:ser", ser); draw(); return; }
    const lv = t.closest("[data-lv]"); if (lv) { LS("drill:lvl", +lv.dataset.lv); setOpt({ rate: LV[lvl()].rate }); tip("难度：" + LV[lvl()].name + "（下一节起生效）"); draw(); return; }
    const ep = t.closest("[data-ep]"); if (ep) return openEp(ep.dataset.ep);
    const li = t.closest("[data-li]"); if (li) return openLesson(+li.dataset.li, +(li.dataset.v || 0));
    const ac = t.closest("[data-act]"); if (ac && C) { const k = ac.dataset.act === "end" ? C.cards.length - 1 : C.cards.findIndex(c => c.act === +ac.dataset.act); if (k >= 0) go(k); return; }
    const op = t.closest("[data-o]"); if (op) return answerPick(+op.dataset.o);
    const oc = t.closest("[data-oc]"); if (oc) return ordPick(+oc.dataset.oc);
    const ou = t.closest("[data-ou]"); if (ou) { const st = ORD[ci]; if (st && !res[ci]) { st.splice(+ou.dataset.ou, 1); draw(); } return; }
    const ro = t.closest("[data-role]"); if (ro) return rpStart(ro.dataset.role);
    const b = t.closest("[data-a]"); if (!b) return; const a = b.dataset.a, c = C && C.cards[ci];
    if (a === "en") { if (window.LANG) LANG().set("en"); return; }
    if (a === "home") { hush(); rpStop(); if (REC) recStop(true); const home = () => { view = "home"; draw(); }; return window.NAV ? NAV.back(home) : home(); } // 回到上一个页面
    if (a === "errhome") { view = "home"; return draw(); } // 没打开那一期：直接回列表（没有新的一页可退）
    if (a === "review") return openReview();
    if (a === "more") { const k = LANG().cur() + "/" + curSer(); MORE[k] = (MORE[k] || 30) + 60; return draw(); }
    if (a === "relist") { delete LISTS[LANG().cur() + "/" + curSer()]; return draw(); }
    if (a === "ep") { hush(); rpStop(); if (REC) recStop(true); const up = () => { view = C && C.review ? "home" : "ep"; draw(); }; return window.NAV ? NAV.back(up) : up(); } // 回到上一个页面
    if (a === "prev") return go(ci - 1);
    if (a === "next") return go(ci + 1);
    if (a === "play") { if (c && c.k === "voc") return sayWord(M.vocab[c.v].w); if (c && c.s != null && c.k !== "role") play(c.s); return; }
    if (a === "slow") { if (c && c.s != null) play(c.s, true); return; }
    if (a === "zh") { setOpt({ zh: !opt().zh }); return draw(); }
    if (a === "rate") { const R = [1.15, 1, 0.85, 0.7], r = R[(R.indexOf(opt().rate) + 1) % R.length]; setOpt({ rate: r }); tip("原声速度 " + r + "×"); return draw(); }
    if (a === "sayw" && c && c.k === "voc") return sayWord(M.vocab[c.v].w);
    if (a === "addw" && c && c.k === "voc") { const v = M.vocab[c.v], w = v.w.replace(/\s*\(.*?\)\s*/g, " ").trim(), line = M.sents.find(x => x.t.toLowerCase().includes(w.split(/\s+/)[0].toLowerCase())); if (window.vocabAddWord) { b.disabled = true; window.vocabAddWord(w, v.ex || (line ? line.t : "")).then(ok => { b.textContent = ok ? "✓ 已加" : "已在本里"; }); } return; }
    if (a === "check") return c && c.k === "dict" ? answerDict(false) : answerGap(false);
    if (a === "giveup") { if (!c || res[ci]) return; if (c.k === "dict") return answerDict(true); if (c.k === "ord") return judged(c, false, { typed: "" }); return answerGap(true); }
    if (a === "ordclr") { ORD[ci] = []; return draw(); }
    if (a === "rec") return recToggle();
    if (a === "myrec") { const R = RS[ci]; if (R && R.url) { hush(); new Audio(R.url).play().catch(() => {}); } return; }
    if (a === "reveal" && c && c.k === "zh") { res[ci] = { seen: true }; draw(); return play(c.s); }
    if (a === "why") return whyLoad();
    if (a === "rp-go") return rpGo();
    if (a === "rp-stop") { rpStop(); return draw(); }
    if (a === "rp-next") return rpNext();
  }
  function onKey(e) {
    if (!root || !root.classList.contains("on") || view !== "lesson" || !C || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!root.offsetParent) return; // 页面没显示（在别的标签）
    const inInput = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName), c = C.cards[ci];
    if (inInput) { if (e.key === "Enter" && e.target.id === "dr-in") { e.preventDefault(); if (c.k === "dict") answerDict(false); else answerGap(false); } return; }
    const k = e.key.toLowerCase();
    if (k === "a" || k === "arrowleft") { e.preventDefault(); go(ci - 1); }
    else if (k === "d" || k === "arrowright" || (k === "enter" && res[ci])) { e.preventDefault(); go(ci + 1); }
    else if (k === "s") { e.preventDefault(); if (c.k === "voc") sayWord(M.vocab[c.v].w); else if (c.s != null && c.k !== "role" && !(c.k === "zh" && !res[ci])) play(c.s); }
    else if (k === "e") { e.preventDefault(); if (c.k === "say" && LV[lvl()].zhOk) { setOpt({ zh: !opt().zh }); draw(); } }
    else if (k === "r") { if (c.k === "say" || c.k === "zh") { e.preventDefault(); recToggle(); } }
    else if (/^[1-9]$/.test(k) && c.k === "pick") { e.preventDefault(); answerPick(+k - 1); }
    else if (/^[1-9]$/.test(k) && c.k === "ord") { e.preventDefault(); ordPick(+k - 1); }
  }

  // 🔙 页面历史：哪个栏目、打开了哪一期、在做第几节（看不到这一页时不记）
  if (window.NAV) NAV.reg("drill", () => root && root.getClientRects().length ? { ser, ep: busy ? navEp : view !== "home" && M ? M.id : null, li: !busy && view === "lesson" && C ? (C.review ? -1 : LI) : null } : undefined, async x => {
    if (!x || !root) return; const stop = () => { hush(); rpStop(); if (REC) recStop(true); };
    if (x.ser && x.ser !== ser) { ser = x.ser; LS("drill:ser", ser); }
    if (!x.ep) { if (view !== "home") { stop(); view = "home"; } return draw(); }
    if (x.li === -1) { if (!(view === "lesson" && C && C.review)) { stop(); openReview(); } return; }
    if (!(M && M.id === x.ep)) { stop(); await openEp(x.ep); if (!(M && M.id === x.ep)) return; }
    if (x.li == null) { if (view !== "ep") { stop(); view = "ep"; C = null; draw(); } return; }
    if (!(view === "lesson" && LI === x.li)) { stop(); openLesson(x.li); }
  });
  window.drillShow = function () {
    root = document.getElementById("drill"); if (!root) return;
    if (!root.dataset.init) {
      root.dataset.init = "1";
      const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
      root.addEventListener("click", onClick); document.addEventListener("keydown", onKey);
      window.addEventListener("lang-change", () => { hush(); fresh(); view = "home"; M = null; C = null; draw(); });
    }
    draw();
  };
  window.drillHide = () => { hush(); rpStop(); if (REC) recStop(true); };
  // 「📅 每日」用：今天做完几节（n）、复习了几句（rv）、现在这门语言有几句该复习（due）
  window.drillToday = () => {
    const A = LG("drill:log", {}) || {}, d = lday(); let n = 0, rv = 0;
    for (const c in A) { const o = (A[c] || {})[d]; if (o) { n += o.n || 0; rv += o.rv || 0; } }
    return { n, rv, due: revDue().length };
  };
  window.drillReview = () => { if (!root) window.drillShow(); if (root) openReview(); };
})();
