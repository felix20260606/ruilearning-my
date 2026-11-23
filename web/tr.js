/* 🌐 全站共用的翻译（window.TR）：阅读、听力、视频字幕、口语、背单词、查词都走这里
   一层层来，哪层成了就停：① 这次打开网页翻过的（内存）② 谷歌翻译（NET.g：谷歌不通时 index.html 的 NET 会请后台代翻）③ 备用：MyMemory（只用于整段文字）/ 后台 Workers AI（只用于一批句子）
   TR.text(英文, {tl}) → 中文（整段，太长自动按句子拆开翻）；全都不行就抛错
   TR.lines(句子数组, {tl, ai}) → 一样长的中文数组（翻不出的是 ""）；合并成一次请求（每批 1500 字以内，3 批同时），行数对不上就一行行翻；ai:false 不用后台 AI 补
   TR.word(词, {tl}) → { zh: [意思…]（第一个是直译）, pos: [{p 词性, w: [意思…]}] }；查不到给空的
   tl 目标语言默认 "zh-CN"，sl 原文语言默认 "en"（练习课学德语时传 "de"）；出错都记进 U.log("tr", …) */
(function () {
  "use strict";
  if (window.TR) return;
  const log = (m, d) => { if (window.U) U.log("tr", m, d); };
  const G = (q, tl, dict, sl) => "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(sl || "en") + "&tl=" + encodeURIComponent(tl || "zh-CN") + "&dt=t" + (dict ? "&dt=bd" : "") + "&q=" + encodeURIComponent(q);
  const get = (u, o) => (window.NET && NET.g ? NET.g(u, o) : fetch(u)); // o.noAI：谷歌不通时不请后台 AI 代翻（查词、ai:false 的时候）
  const MEM = new Map(), WM = new Map(), WP = new Map(), WMISS = new Map();
  async function google(q, tl, sl) {
    const r = await get(G(q, tl, false, sl)); if (!r.ok) throw new Error("google " + r.status);
    const j = await r.json(); return ((j && j[0]) || []).map(x => (x && x[0]) || "").join("");
  }
  async function mymemory(q, tl, sl) { // 备用：每次最多 500 个字
    const r = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(q.slice(0, 480)) + "&langpair=" + (sl || "en") + "|" + (tl || "zh-CN"));
    const j = r.ok && (await r.json()), t = j && j.responseData && j.responseData.translatedText; if (!t || /MYMEMORY WARNING/i.test(t)) throw new Error("mymemory"); return t;
  }
  async function text(q, o) {
    o = o || {}; q = String(q || "").trim(); if (!q) return ""; const tl = o.tl || "zh-CN", sl = o.sl || "en", k = sl + ">" + tl + "|" + q;
    if (MEM.has(k)) return MEM.get(k);
    const parts = []; let cur = "";
    U.sents(q).forEach(s => { if (cur && (cur + " " + s).length > 1500) { parts.push(cur); cur = s; } else cur = cur ? cur + " " + s : s; }); if (cur) parts.push(cur); // ✂️ 全站共用的分句（util.js）
    const out = [];
    for (const p of parts) {
      let t = "";
      try { t = await google(p, tl, sl); } catch (e) { log("谷歌翻译不行，换 MyMemory", String(e.message || e)); }
      if (!t) { const z = []; for (const s of U.sents(p)) z.push(await mymemory(s, tl, sl)); t = z.join(""); } // 这层也不行就抛错
      out.push(t);
    }
    const r = out.join(""); if (r) MEM.set(k, r); return r;
  }
  async function lines(arr, o) {
    o = o || {}; const tl = o.tl || "zh-CN", sl = o.sl || "en", K = t => sl + ">" + tl + "|" + String(t || "").trim(), out = arr.map(t => MEM.get(K(t)) || "");
    const go = async idx => {
      const r = await get(G(idx.map(i => String(arr[i]).replace(/\s+/g, " ")).join("\n"), tl, false, sl), { noAI: o.ai === false }); if (!r.ok) throw new Error("google " + r.status);
      const zh = (((await r.json()) || [])[0] || []).map(x => (x && x[0]) || "").join("").split("\n").map(x => x.trim());
      if (zh.length === idx.length) idx.forEach((i, k) => { out[i] = zh[k]; });
      else if (idx.length === 1) out[idx[0]] = zh.join(" ").trim();
      else for (const i of idx) { try { await go([i]); } catch (e) { log("这一行没翻出来", String(e.message || e)); } } // 行数对不上就一行一行翻（一行出错不影响后面的）
    };
    const todo = arr.map((t, i) => (t && !out[i] ? i : -1)).filter(i => i >= 0), chunks = []; let cur = [], len = 0;
    todo.forEach(i => { const t = String(arr[i]); if (cur.length && len + t.length > 1500) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += t.length + 1; });
    if (cur.length) chunks.push(cur);
    let fails = 0;
    for (let i = 0; i < chunks.length; i += 3) await Promise.all(chunks.slice(i, i + 3).map(c => go(c).catch(e => { fails++; log("谷歌翻译一批失败", String(e.message || e)); })));
    let miss = arr.map((t, i) => (t && !out[i] ? i : -1)).filter(i => i >= 0);
    if (miss.length && o.ai !== false && window.AI && tl === "zh-CN" && sl === "en") { // 剩下的请后台 AI 翻（一次最多 120 句）
      for (let k = 0; k < miss.length; k += 120) { const part = miss.slice(k, k + 120), j = await AI.ask("tr", { texts: part.map(i => arr[i]) }); if (j && Array.isArray(j.zh)) part.forEach((i, n) => { if (j.zh[n]) out[i] = j.zh[n]; }); }
      miss = arr.map((t, i) => (t && !out[i] ? i : -1)).filter(i => i >= 0);
    }
    arr.forEach((t, i) => { if (t && out[i]) MEM.set(K(t), out[i]); });
    if (miss.length || fails) log("一批句子翻完", { 句数: todo.length, 没翻出: miss.length, 失败批: fails });
    return out;
  }
  // 鼠标停在词上就会查：同一个词正在查的只发一次；查不到的 1 分钟内不再查；不请后台 AI 代翻（每个新词都会让后台写一次缓存）
  //   原文语言默认跟着现在学的语言（德语时按德语查）
  function word(w, o) {
    o = o || {}; const k0 = String(w || "").trim().toLowerCase(), tl = o.tl || "zh-CN", sl = o.sl || (window.VL && window.VL !== "en" ? window.VL : "en"), key = sl + ">" + tl + "|" + k0;
    if (!k0) return Promise.resolve({ zh: [], pos: [] }); if (WM.has(key)) return Promise.resolve(WM.get(key));
    if (WP.has(key)) return WP.get(key);
    if (Date.now() - (WMISS.get(key) || 0) < 60e3) return Promise.resolve({ zh: [], pos: [] });
    const p = word1(k0, tl, sl, key).finally(() => WP.delete(key)); WP.set(key, p); return p;
  }
  async function word1(k0, tl, sl, key) {
    const res = { zh: [], pos: [] };
    try {
      const r = await get(G(k0, tl, true, sl), { noAI: true }); if (!r.ok) throw new Error("google " + r.status); const j = await r.json();
      const add = x => { x = String(x || "").trim(); if (x && x.toLowerCase() !== k0 && !res.zh.includes(x)) res.zh.push(x); };
      add(((j && j[0]) || []).map(x => (x && x[0]) || "").join("")); ((j && j[1]) || []).forEach(e => (e[1] || []).slice(0, 4).forEach(add));
      res.pos = ((j && j[1]) || []).slice(0, 4).map(e => ({ p: e[0], w: (e[1] || []).slice(0, 6) })); // 最多 4 个词性、每个 6 个意思，用的地方自己再截
    } catch (e) { log("查词翻译失败：" + k0, String(e.message || e)); }
    if (res.zh.length) WM.set(key, res); else WMISS.set(key, Date.now());
    return res;
  }
  window.TR = { text, lines, word };
})();
