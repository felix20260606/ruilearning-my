/* 🧩 练习课（「🎧 听」→「🧩 练习课」）：把一期真人原声拆成几节，每节 8 句左右，一张一张卡片做
   每节：📒 本期重点词（只在第 1 节）→ 🔁 跟读 → 👂 听音选句 → ⌨️ 听写填空 → 小结
   做法参考 Language Reactor 的课程页：素材先整理成统一的「课」格式，再由同一个播放器按题型出卡片；所以换语言只要换素材来源
   ── 多语言 ──
   现在学哪种语言看 window.LANG（lang.js，顶栏切换）。PROV[语言] = 这门语言的素材来源，统一交出：
     list(系列) → [{id, t 标题, d 日期, img}]
     load(id, 进度回调) → {id, title, src 原声地址, sents:[{t 原句, who, zh 中文, zhAll 中文是整段的, s, e 起止秒（没对上时间 = null）}], vocab:[{w, def, zh, ex}]}
   原声的每句时间：用 listen.js 的逐句精听（/api/sme?al= 后台 Whisper 转写，存 KV，一期只花一次 AI 额度）；对不上就用浏览器朗读（按这门语言的 bcp 语音）
   德语还没有素材来源：PROV.de 不存在时页面说明「准备中」
   ── 记录 ──
   localStorage「drill:prog」{语言: {期号: {节号: {sc 正确率 0–100, at}}}}、「drill:last」{语言: 期号}：按家人分开（index.html 的 MINE）；「drill:opt」{rate, zh} 本机
   做错的选择题 / 填空收进「❌ 错题本」（window.ERR，来源「🎧 精听」）
   键盘：A / ← 上一张，D / → 下一张，S 再听一遍，E 显示 / 隐藏中文，1–4 选选项；填空框里回车 = 检查 / 下一张
   入口：window.drillShow()（index.html 点「🧩 练习课」时调）；测试用 window.DRILL = {split, lessons, build, blankOf} */
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
  const PROV = {
    en: {
      name: "BBC Learning English",
      series: [["ree", "🐢 慢速对话"], ["tews", "💬 地道说法"], ["sme", "📻 6 分钟英语"]], // 「新闻英语」没有全文文稿，不能拆句
      async list(s) { const j = await getJ("/api/sme?s=" + encodeURIComponent(s)); if (!j || !j.ok) throw new Error((j && j.error) || "列表没拿到"); return j.list || []; },
      async load(id, prog) {
        prog("取文稿…");
        const ep = await getJ("/api/sme?ep=" + encodeURIComponent(id)); if (!ep || !ep.ok) throw new Error("文稿没拿到（" + ((ep && ep.error) || "网络") + "）");
        prog("取中文翻译…");
        let zh = null; try { zh = await getJ("/api/sme?ep=" + encodeURIComponent(id) + "&zh=1"); if (!zh || !zh.ok) zh = null; } catch (e) {}
        const raw = splitSents(ep.lines), per = {}; raw.forEach(x => { per[x.li] = (per[x.li] || 0) + 1; });
        let sents = raw.map(x => ({ t: x.t, who: x.who, li: x.li, zh: zh && zh.lines ? zh.lines[x.li] || "" : "", zhAll: per[x.li] > 1, s: null, e: null }));
        const src = window.NET && NET.src ? NET.src(ep.mp3) : ep.mp3;
        let note = "";
        try { // 每句的时间：和 listen.js 的逐句精听同一个接口、同一个换算
          prog("量原声长度…"); const dur = await durOf(src); if (!dur) throw new Error("原声打不开");
          const W = []; let parts = 1, total = 0, id3 = 0;
          for (let p = 0; p < parts && p < 40; p++) {
            prog("给原声对时间 " + (p + 1) + " / " + parts + "（第一次打开这期要等一会儿）");
            const j = await getJ("/api/sme?al=" + encodeURIComponent(id) + "&part=" + p);
            if (!j || !j.ok) throw new Error((j && j.error) || "网络");
            parts = j.parts || 1; total = j.total || 1; if (p === 0) id3 = +j.id3 || 0;
            const off = Math.max(0, (p * 1e6 - (p ? id3 : 0)) / Math.max(1, total - id3) * dur);
            (j.words || []).forEach(w => W.push([w[0], w[1] + off, w[2] + off]));
          }
          if (!window.smeAlignTimes) throw new Error("listen.js 没加载");
          const T = window.smeAlignTimes(raw, W); sents = sents.map((x, i) => Object.assign(x, { s: T[i].s, e: T[i].e }));
        } catch (e) { note = "原声没对上时间（" + (e.message || e) + "），这期用机器朗读"; }
        const vocab = (ep.vocab || []).map((v, i) => ({ w: String(v[0] || "").trim(), def: v[1] || "", zh: zh && zh.vocab ? zh.vocab[i] || "" : "", ex: v[2] || "" })).filter(v => v.w);
        return { id, title: ep.title || id, src, sents, vocab, note };
      },
    },
    // de: 以后加德国之声（DW）的慢速德语新闻，交出同样的格式即可
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
  // 一节的卡片：[{k:'voc'|'say'|'pick'|'gap'|'end', act 第几个活动, ...}] 和活动表 acts
  function build(M, li) {
    const L = lessons(M.sents.length), [a, b] = L[li] || [0, 0], r = rng(hash(M.id + "#" + li)), stop = LANG().stop();
    const idx = []; for (let i = a; i < b; i++) idx.push(i);
    const acts = [], cards = [];
    const add = (name, ins, list) => { if (!list.length) return; acts.push({ name, ins, n: list.length }); list.forEach(c => cards.push(Object.assign({ act: acts.length - 1 }, c))); };
    if (li === 0) add("📒 本期重点词", "先认识这期要用的词：点 🔊 听发音，想记的加进生词本", M.vocab.slice(0, 10).map((v, i) => ({ k: "voc", v: i })));
    add("🔁 跟读", "听一句，大声跟着读一遍", idx.map(s => ({ k: "say", s })));
    const long = idx.filter(i => LANG().words(M.sents[i].t).length >= 4);
    const shuf = long.slice().sort(() => r() - 0.5);
    const pickS = shuf.slice(0, Math.min(4, Math.ceil(shuf.length / 2))); // 句子少时选择题和填空各分一半，尽量别用同一句（选完再填就是送答案）
    const gapPool = idx.filter(i => !pickS.includes(i) && LANG().words(M.sents[i].t).length >= 3).sort(() => r() - 0.5).concat(pickS);
    add("👂 听音选句", "先别看字，听一遍，选出你听到的那句", pickS.map(s => {
      const n = LANG().words(M.sents[s].t).length, seen = new Set([M.sents[s].t]);
      const others = M.sents.map((x, i) => ({ i, d: Math.abs(LANG().words(x.t).length - n) + r() })).filter(x => x.i !== s && LANG().words(M.sents[x.i].t).length >= 3).sort((p, q) => p.d - q.d)
        .map(x => M.sents[x.i].t).filter(t => !seen.has(t) && seen.add(t)).slice(0, 3);
      const opts = others.concat([M.sents[s].t]).sort(() => r() - 0.5);
      return { k: "pick", s, opts, ans: opts.indexOf(M.sents[s].t) };
    }).filter(c => c.opts.length >= 2));
    const gaps = []; const used = new Set();
    for (const s of gapPool) { if (gaps.length >= 4 || used.has(s)) continue; used.add(s); const g = blankOf(M.sents[s].t, M.vocab.map(v => v.w.split(/\s+/)[0]), stop, r); if (g) gaps.push(Object.assign({ k: "gap", s }, g)); }
    add("⌨️ 听写填空", "听，把空着的那个词写出来（回车检查）", gaps);
    cards.push({ k: "end", act: -1 });
    return { acts, cards, range: [a, b] };
  }
  window.DRILL = { split: splitSents, lessons, build, blankOf, rng, PROV };

  // ---------- 状态 ----------
  let root = null, view = "home", ser = LG("drill:ser", "ree"), M = null, LI = 0, C = null, ci = 0, res = {}, busy = "", err = "";
  const MODELS = {}, LISTS = {};
  const opt = () => Object.assign({ rate: 1, zh: false }, LG("drill:opt", {}));
  const setOpt = o => LS("drill:opt", Object.assign(opt(), o));
  const progAll = () => LG("drill:prog", {}) || {};
  const progOf = id => ((progAll()[LANG().cur()] || {})[id]) || {};
  function saveProg(id, li, sc) { const P = progAll(), c = LANG().cur(); P[c] = P[c] || {}; P[c][id] = P[c][id] || {}; P[c][id][li] = { sc, at: Date.now() }; LS("drill:prog", P); }
  const lastOf = () => (LG("drill:last", {}) || {})[LANG().cur()] || "";
  function setLast(id) { const o = LG("drill:last", {}) || {}; o[LANG().cur()] = id; LS("drill:last", o); }

  // ---------- 放音：原声的一段（[s, e]），没时间就用浏览器朗读 ----------
  const AU = new Audio(); AU.preload = "auto"; if (window.NET && NET.audio) try { NET.audio(AU); } catch (e) {}
  let stopAt = 0, raf = 0; window.DRILL.au = AU; // 测试用
  function tick() { if (!AU.paused && stopAt && AU.currentTime >= stopAt) { AU.pause(); stopAt = 0; } if (!AU.paused) raf = requestAnimationFrame(tick); }
  function hush() { try { AU.pause(); } catch (e) {} stopAt = 0; try { speechSynthesis.cancel(); } catch (e) {} }
  function others() { try { if (window.smePause) smePause(); } catch (e) {} try { if (window.videoCore && videoCore.pause) videoCore.pause(); } catch (e) {} }
  function sayTTS(t, rate) {
    try { if (!("speechSynthesis" in window)) return tip("这个浏览器不能朗读"); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t), bcp = LANG().cfg().bcp; u.lang = bcp; const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.replace("_", "-").toLowerCase().startsWith(bcp.slice(0, 2))); if (v) u.voice = v; u.rate = 0.95 * (rate || 1); speechSynthesis.speak(u); } catch (e) {}
  }
  function play(si, slow) {
    const x = M && M.sents[si]; if (!x) return; others(); hush();
    const rate = slow ? 0.75 : opt().rate;
    if (x.s == null) return sayTTS(x.t, rate);
    if (AU.getAttribute("src") !== M.src) AU.src = M.src;
    const go = () => { try { AU.currentTime = x.s; } catch (e) {} AU.playbackRate = rate; stopAt = x.e; AU.play().then(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }).catch(() => tip("原声放不出来，点一下 🔊 再试")); };
    if (AU.readyState >= 1) go(); else AU.addEventListener("loadedmetadata", go, { once: true });
  }
  function sayWord(w) { others(); hush(); if (LANG().cur() === "en" && typeof window.speak === "function") window.speak(w); else sayTTS(w); }

  // ---------- 界面 ----------
  const CSS = `
  #drill{display:none;max-width:960px;margin:0 auto;padding:6px 0 40px;color:var(--ui-ink);font-family:var(--ui-font);overflow-wrap:anywhere}#drill.on{display:block}
  #drill .dr-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0 6px}#drill .dr-h h2{font-size:20px;margin:0;font-weight:900}#drill .dr-h .sp{flex:1}
  #drill .dr-sub{color:var(--ui-muted);font-size:13.5px;line-height:1.6;margin:0 0 12px}
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
  @media (hover:none){#drill .dr-nav button small{display:none}}`;

  function home() {
    const lg = LANG().cfg(), P = PROV[lg.code];
    let s = '<div class="dr-h"><h2>🧩 练习课</h2><span class="sp"></span><span class="ui-chip">' + lg.flag + " " + esc(lg.name) + "</span></div>";
    if (!P) return s + '<div class="dr-empty">' + lg.flag + " <b>" + esc(lg.name) + "练习课还在准备</b><br>素材来源还没接上" + (lg.code === "de" ? "（计划用德国之声 DW 的慢速德语新闻）" : "") + "。<br>练习页本身已经按多语言做好，接上素材就能用。<br><br><button class=\"ui-btn pri\" data-a=\"en\">🇬🇧 切回英语</button></div>";
    s += '<p class="dr-sub">素材：' + esc(P.name) + "。每期拆成几节、每节 8 句左右，一张卡一张卡做：跟读 → 听音选句 → 听写填空。全是真人原声；做错的进「❌ 错题本」。</p>";
    const last = lastOf();
    if (last) {
      const pr = progOf(last), done = Object.keys(pr).length, m = MODELS[lg.code + "/" + last];
      s += '<div class="dr-cont"><div class="t"><small style="color:var(--ui-muted)">上次练到</small><br><b>' + esc(m ? m.title : (findEp(last) || {}).t || last) + "</b>" + (done ? " · 做完 " + done + " 节" : "") + '</div><button class="ui-btn pri" data-ep="' + esc(last) + '">继续 →</button></div>';
    }
    s += '<div class="dr-seg">' + P.series.map(x => '<button data-s="' + x[0] + '" class="' + (x[0] === ser ? "on" : "") + '">' + x[1] + "</button>").join("") + "</div>";
    const L = LISTS[lg.code + "/" + ser];
    if (!L) { loadList(); return s + '<div class="dr-empty">正在取节目列表…</div>'; }
    if (L.err) return s + '<div class="dr-empty">列表没拿到：' + esc(L.err) + '<br><button class="ui-btn" data-a="relist">再试一次</button></div>';
    return s + L.list.slice(0, 30).map(x => { const n = Object.keys(progOf(x.id)).length; return '<button class="dr-ep" data-ep="' + esc(x.id) + '">' + (x.img ? '<img loading="lazy" alt="" src="' + esc(window.NET && NET.src ? NET.src(x.img) : x.img) + '">' : "") + '<span class="t"><b>' + esc(x.t) + "</b><small>" + esc(x.d || "") + "</small></span>" + (n ? '<span class="dr-badge">练过 ' + n + " 节</span>" : "") + "</button>"; }).join("");
  }
  function findEp(id) { for (const k in LISTS) { const f = (LISTS[k].list || []).find(x => x.id === id); if (f) return f; } return null; }
  async function loadList() {
    const lg = LANG().cur(), k = lg + "/" + ser; if (LISTS[k] && !LISTS[k].err) return; LISTS[k] = { list: null, loading: 1 };
    try { LISTS[k] = { list: await PROV[lg].list(ser) }; } catch (e) { LISTS[k] = { err: e.message || String(e), list: [] }; }
    if (view === "home") draw();
  }
  function epView() {
    const L = lessons(M.sents.length), pr = progOf(M.id), nx = L.findIndex((_, i) => !pr[i]);
    let s = '<div class="dr-top"><button class="ui-btn" data-a="home">← 换一期</button><span class="t">' + esc(M.title) + "</span></div>";
    if (M.note) s += '<div class="dr-note">' + esc(M.note) + "</div>";
    s += '<p class="dr-sub">共 ' + M.sents.length + " 句，分 " + L.length + " 节。" + (M.vocab.length ? "第 1 节先过一遍 " + Math.min(10, M.vocab.length) + " 个重点词。" : "") + "</p>";
    s += '<div class="dr-btns" style="margin:0 0 14px"><button class="ui-btn pri" data-li="' + (nx < 0 ? 0 : nx) + '">' + (nx < 0 ? "全部做完了 · 从第 1 节再来" : nx === 0 ? "开始第 1 节 →" : "继续第 " + (nx + 1) + " 节 →") + "</button></div>";
    s += L.map((r, i) => { const p = pr[i], sl = M.sents.slice(r[0], r[1]), f = (sl.find(x => LANG().words(x.t).length >= 5) || sl[0]).t; return '<button class="dr-les" data-li="' + i + '"><span class="t"><b>第 ' + (i + 1) + " 节</b><small>" + esc(f.slice(0, 70)) + (f.length > 70 ? "…" : "") + "</small></span>" + (p ? '<span class="dr-badge done">✓ ' + p.sc + "%</span>" : '<span class="dr-badge">' + (r[1] - r[0]) + " 句</span>") + "</button>"; }).join("");
    return s;
  }
  function zhLine(x, show) { if (!x.zh) return ""; return '<div class="dr-zh"' + (show ? "" : ' style="display:none"') + ">" + esc(x.zh) + (x.zhAll ? " <small>（整段的翻译）</small>" : "") + "</div>"; }
  function cardHtml(c) {
    const o = opt(), R = res[ci];
    if (c.k === "voc") { const v = M.vocab[c.v]; return '<div class="dr-w">' + esc(v.w) + ' <button class="ui-btn" data-a="sayw">🔊</button></div><div class="dr-zh">' + esc(v.def) + "</div>" + (v.zh ? '<div class="dr-zh" style="color:var(--ui-ink)">' + esc(v.zh) + "</div>" : "") + (v.ex ? '<div class="dr-ex">' + esc(v.ex) + "</div>" : "") + '<div class="dr-btns"><button class="ui-btn" data-a="addw">＋ 加入生词本</button></div>'; }
    const x = M.sents[c.s];
    if (c.k === "say") return (x.who ? '<div class="dr-who">' + esc(x.who) + "</div>" : "") + '<div class="dr-en">' + esc(x.t) + "</div>" + zhLine(x, o.zh) + '<div class="dr-btns"><button class="ui-btn pri" data-a="play">🔊 再听一遍</button><button class="ui-btn" data-a="slow">🐢 慢放</button>' + (x.zh ? '<button class="ui-btn" data-a="zh">' + (o.zh ? "隐藏中文" : "看中文") + "</button>" : "") + "</div>";
    if (c.k === "pick") {
      let s = '<button class="dr-big" data-a="play" title="再听一遍（S）">🔊</button><div class="dr-opts">' + c.opts.map((t, i) => '<button data-o="' + i + '" class="' + (R ? (i === c.ans ? "ok" : i === R.pick ? "no" : "") : "") + '"' + (R ? " disabled" : "") + "><b>" + (i + 1) + "</b>" + esc(t) + "</button>").join("") + "</div>";
      if (R) s += '<div class="dr-fb">' + (R.ok ? '<span class="ok">✓ 对了</span>' : '<span class="no">✗ 听到的是第 ' + (c.ans + 1) + " 句</span>（已收进错题本）") + "</div>" + zhLine(x, true);
      return s;
    }
    if (c.k === "gap") {
      const parts = c.shown.split("\u0000"), shown = R ? '<span class="gap">' + esc(c.word) + "</span>" : '<span class="gap">&nbsp;</span>';
      let s = (x.who ? '<div class="dr-who">' + esc(x.who) + "</div>" : "") + '<div class="dr-en">' + esc(parts[0]) + shown + esc(parts[1] || "") + "</div>";
      if (!R) s += '<input class="dr-in" id="dr-in" placeholder="空着的词" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"><div class="dr-btns"><button class="ui-btn pri" data-a="check">检查</button><button class="ui-btn" data-a="play">🔊 再听</button><button class="ui-btn" data-a="slow">🐢 慢放</button><button class="ui-btn" data-a="giveup">不会，看答案</button></div>';
      else s += '<div class="dr-fb">' + (R.ok ? '<span class="ok">✓ 对了</span>' : '<span class="no">✗</span> ' + (R.typed ? "你写的 <s>" + esc(R.typed) + "</s>，" : "") + "答案 <b>" + esc(c.word) + "</b>") + (R.note ? "（" + esc(R.note) + "）" : "") + "</div>" + zhLine(x, true) + '<div class="dr-btns"><button class="ui-btn" data-a="play">🔊 再听</button></div>';
      return s;
    }
    // end
    const q = C.cards.map((k, i) => ({ k, r: res[i] })).filter(o => o.k.k === "pick" || o.k.k === "gap"), right = q.filter(o => o.r && o.r.ok).length, sc = q.length ? Math.round(right / q.length * 100) : 100;
    const L = lessons(M.sents.length), more = LI + 1 < L.length;
    return '<div class="dr-sum"><div style="font-size:15px;color:var(--ui-muted)">第 ' + (LI + 1) + " 节做完了</div><div class=\"n\">" + sc + '%</div><div class="dr-zh">' + (q.length ? "选择和填空 " + q.length + " 题，对了 " + right + " 题" : "") + (q.some(o => o.r && !o.r.ok) ? "；做错的已收进「❌ 错题本」" : "") + (q.some(o => !o.r) ? "；跳过 " + q.filter(o => !o.r).length + " 题" : "") + '</div><div class="dr-btns" style="justify-content:center">' + (more ? '<button class="ui-btn pri" data-li="' + (LI + 1) + '">下一节 →</button>' : '<button class="ui-btn pri" data-a="ep">这期全部做完 ✓</button>') + '<button class="ui-btn" data-li="' + LI + '">再做一遍</button><button class="ui-btn" data-a="ep">回到本期</button></div></div>';
  }
  function lessonView() {
    const c = C.cards[ci], N = C.cards.length, L = lessons(M.sents.length), act = C.acts[c.act];
    let s = '<div class="dr-top"><button class="ui-btn" data-a="ep">←</button><span class="t">' + esc(M.title) + " · 第 " + (LI + 1) + " / " + L.length + ' 节</span><button class="ui-btn" data-a="rate" title="原声速度">' + (opt().rate === 1 ? "1×" : opt().rate + "×") + "</button></div>";
    s += '<div class="dr-bar"><span class="tr"><i style="width:' + Math.round((ci + 1) / N * 100) + '%"></i></span>' + (ci + 1) + " / " + N + "</div>";
    s += '<div class="dr-body"><ol class="dr-acts">' + C.acts.map((a, i) => '<li><button data-act="' + i + '" class="' + (c.act === i ? "on" : "") + '">' + (i + 1) + ". " + a.name + "<small>" + a.n + "</small></button></li>").join("") + '<li><button data-act="end" class="' + (c.k === "end" ? "on" : "") + '">✓ 小结</button></li></ol>';
    s += '<div class="dr-card">' + (act ? '<div class="dr-ins">' + act.name + " · " + esc(act.ins) + "</div>" : "") + cardHtml(c) + "</div></div>";
    const canZh = c.k === "say" && M.sents[c.s].zh;
    s += '<div class="dr-nav"><button data-a="prev"' + (ci ? "" : " disabled") + '><span>←</span><small>A</small></button><button data-a="play"' + (c.k === "end" ? " disabled" : "") + '><span>🔊</span><small>S</small></button><button data-a="zh" class="' + (opt().zh && canZh ? "on" : "") + '"' + (canZh ? "" : " disabled") + '><span>👁</span><small>E</small></button><button data-a="next"' + (ci < N - 1 ? "" : " disabled") + "><span>→</span><small>D</small></button></div>";
    return s;
  }
  function draw() {
    if (!root) return;
    if (busy) { root.innerHTML = '<div class="dr-empty">⏳ ' + esc(busy) + "</div>"; return; }
    if (err) { const e = err; err = ""; root.innerHTML = '<div class="dr-empty">没打开：' + esc(e) + '<br><br><button class="ui-btn" data-a="home">← 回到列表</button></div>'; return; }
    root.innerHTML = view === "lesson" && C ? lessonView() : view === "ep" && M ? epView() : home();
    const inp = root.querySelector("#dr-in"); if (inp) try { inp.focus({ preventScroll: true }); } catch (e) {}
  }
  function go(i, auto) {
    if (!C) return; ci = Math.max(0, Math.min(C.cards.length - 1, i)); hush(); draw();
    const c = C.cards[ci];
    if (c.k === "end") { const q = C.cards.map((k, j) => ({ k, r: res[j] })).filter(o => o.k.k === "pick" || o.k.k === "gap"); if (!q.length || q.some(o => o.r)) saveProg(M.id, LI, q.length ? Math.round(q.filter(o => o.r && o.r.ok).length / q.length * 100) : 100); } // 一题没做就跳到小结：不算做过
    else if (auto !== false && c.s != null) play(c.s);
    try { const top = root.getBoundingClientRect().top; if (top < 0) window.scrollBy(0, top - 120); } catch (e) {}
  }
  async function openEp(id) {
    const lg = LANG().cur(), P = PROV[lg]; if (!P) return;
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
  function openLesson(li) { LI = li; C = build(M, li); res = {}; view = "lesson"; go(0); }
  function answerPick(i) {
    const c = C.cards[ci]; if (!c || c.k !== "pick" || res[ci]) return;
    const ok = i === c.ans; res[ci] = { ok, pick: i };
    if (!ok && window.ERR) window.ERR.add([{ src: "listen", kind: "mcq", q: "练习课 · 听音选句：哪一句是原声？", ctx: "出自：" + M.title, opts: c.opts, ans: c.ans, wrong: c.opts[i] }], true);
    draw();
  }
  function answerGap(give) {
    const c = C.cards[ci]; if (!c || c.k !== "gap" || res[ci]) return;
    const inp = root.querySelector("#dr-in"), typed = give ? "" : (inp ? inp.value.trim() : "");
    if (!give && !typed) return tip("先写一个词，或者点「不会，看答案」");
    const r = give ? { ok: false, note: "" } : LANG().check(typed, c.word);
    res[ci] = { ok: r.ok, typed, note: r.note };
    if (!r.ok && window.ERR && LANG().cur() === "en") window.ERR.add([{ src: "listen", kind: "gap", q: "练习课 · 听写填空（" + M.title + "）", ctx: c.shown.replace("\u0000", "____"), right: c.word, wrong: typed }], true);
    draw();
  }

  function onClick(e) {
    const t = e.target;
    const sb = t.closest("[data-s]"); if (sb) { ser = sb.dataset.s; LS("drill:ser", ser); draw(); return; }
    const ep = t.closest("[data-ep]"); if (ep) return openEp(ep.dataset.ep);
    const li = t.closest("[data-li]"); if (li) return openLesson(+li.dataset.li);
    const ac = t.closest("[data-act]"); if (ac && C) { const k = ac.dataset.act === "end" ? C.cards.length - 1 : C.cards.findIndex(c => c.act === +ac.dataset.act); if (k >= 0) go(k); return; }
    const op = t.closest("[data-o]"); if (op) return answerPick(+op.dataset.o);
    const b = t.closest("[data-a]"); if (!b) return; const a = b.dataset.a, c = C && C.cards[ci];
    if (a === "en") { if (window.LANG) LANG().set("en"); return; }
    if (a === "home") { view = "home"; hush(); return draw(); }
    if (a === "relist") { delete LISTS[LANG().cur() + "/" + ser]; return draw(); }
    if (a === "ep") { view = "ep"; hush(); return draw(); }
    if (a === "prev") return go(ci - 1);
    if (a === "next") return go(ci + 1);
    if (a === "play") { if (c && c.k === "voc") return sayWord(M.vocab[c.v].w); if (c && c.s != null) play(c.s); return; }
    if (a === "slow") { if (c && c.s != null) play(c.s, true); return; }
    if (a === "zh") { setOpt({ zh: !opt().zh }); return draw(); }
    if (a === "rate") { const R = [1, 0.85, 0.7], r = R[(R.indexOf(opt().rate) + 1) % R.length]; setOpt({ rate: r }); tip("原声速度 " + r + "×"); return draw(); }
    if (a === "sayw" && c && c.k === "voc") return sayWord(M.vocab[c.v].w);
    if (a === "addw" && c && c.k === "voc") { const v = M.vocab[c.v], w = v.w.replace(/\s*\(.*?\)\s*/g, " ").trim(), line = M.sents.find(x => x.t.toLowerCase().includes(w.split(/\s+/)[0].toLowerCase())); if (window.vocabAddWord) { b.disabled = true; window.vocabAddWord(w, v.ex || (line ? line.t : "")).then(ok => { b.textContent = ok ? "✓ 已加" : "已在本里"; }); } return; }
    if (a === "check") return answerGap(false);
    if (a === "giveup") return answerGap(true);
  }
  function onKey(e) {
    if (!root || !root.classList.contains("on") || view !== "lesson" || !C || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!root.offsetParent) return; // 页面没显示（在别的标签）
    const inInput = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (inInput) { if (e.key === "Enter" && e.target.id === "dr-in") { e.preventDefault(); answerGap(false); } return; }
    const k = e.key.toLowerCase(), c = C.cards[ci];
    if (k === "a" || k === "arrowleft") { e.preventDefault(); go(ci - 1); }
    else if (k === "d" || k === "arrowright" || (k === "enter" && res[ci])) { e.preventDefault(); go(ci + 1); }
    else if (k === "s") { e.preventDefault(); if (c.k === "voc") sayWord(M.vocab[c.v].w); else if (c.s != null) play(c.s); }
    else if (k === "e") { e.preventDefault(); if (c.k === "say") { setOpt({ zh: !opt().zh }); draw(); } }
    else if (/^[1-6]$/.test(k) && c.k === "pick") { e.preventDefault(); answerPick(+k - 1); }
  }

  window.drillShow = function () {
    root = document.getElementById("drill"); if (!root) return;
    if (!root.dataset.init) {
      root.dataset.init = "1";
      const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
      root.addEventListener("click", onClick); document.addEventListener("keydown", onKey);
      window.addEventListener("lang-change", () => { hush(); view = "home"; M = null; C = null; draw(); });
    }
    draw();
  };
  window.drillHide = hush;
})();
