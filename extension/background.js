// 生词本和视频字幕都存在生词本网站的后台（Cloudflare），不需要配置文件和口令
const SITE = "https://ruilearning-my.pages.dev", VOCAB = SITE + "/api/vocab";
// 家人（多用户，不设密码）：插件同步的是设置页「生词本用户」选的那个人（chrome.storage.local 的 siteUser，空 = 主人 Ray）。
// 发往网站 /api/vocab、/api/ext、/api/media 的请求自动带上 ?u=<id>（后台按人分开存）；切换见下面 setSiteUser
let siteUser = null, userSwitching = false;
const siteUserP = chrome.storage.local.get({ siteUser: "" }).then(v => (siteUser = v.siteUser || "")).catch(() => (siteUser = ""));
const fetch0 = self.fetch.bind(self);
self.fetch = async (u, o) => {
  if (typeof u === "string" && u.startsWith(SITE + "/api/") && /^\/api\/(vocab|ext|media)(\?|$)/.test(u.slice(SITE.length))) { if (siteUser == null) await siteUserP; if (siteUser) u += (u.includes("?") ? "&" : "?") + "u=" + siteUser; }
  // 网站请求也有超时（中国大陆多数地方打不开 *.pages.dev，连不上时会一直挂着）：上传录音最多等 90 秒，其它 25 秒
  if (typeof u === "string" && u.startsWith(SITE + "/") && !(o && o.signal) && typeof AbortController === "function") {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), /\/api\/media/.test(u) && o && o.method === "POST" ? 90000 : 25000);
    return fetch0(u, Object.assign({}, o, { signal: ac.signal })).finally(() => clearTimeout(t));
  }
  return fetch0(u, o);
};

// ---------- 外部服务通不通（中国大陆打不开谷歌翻译 / 谷歌发音、维基词典） ----------
// 每个请求都有超时；连不上（网络错误或超时）的网站记下来，一段时间内（第一次 15 分钟、反复不通 6 小时）直接用备用的，不再每次白等（同网站 index.html 开头的 window.NET）。
// 备用：翻译 → 微软翻译（大陆能用）→ 网站后台 /api/ai {task:"tr"}；查词 → 有道词典（国内）→ 网站后台 /api/dict；
// 维基词典 → 网站后台中转 /api/px → 有道；发音 → 有道真人发音 → 浏览器自带语音（content.js 的 speakLocal）
// 第一次不通只先绕开 15 分钟（可能只是一次慢）；2 小时内又不通（多半真被墙了）才 6 小时不问。netLong 记着哪些是「又不通」的
const NET_KEY = "netBad", NET_TTL = 6 * 3600e3, NET_SHORT = 15 * 60e3, G_HOST = "translate.googleapis.com";
let netLong = {}; chrome.storage.local.get({ netLong: {} }).then(v => (netLong = v.netLong || {})).catch(() => {});
let netBad = null;
const netP = chrome.storage.local.get({ [NET_KEY]: {} }).then(v => (netBad = v[NET_KEY] || {})).catch(() => (netBad = {}));
const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return ""; } };
async function isDown(h) { if (!netBad) await netP; const t = netBad[h]; return !!t && Date.now() - t < (netLong[h] ? NET_TTL : NET_SHORT); }
function netMark(h, ok) {
  if (!netBad || !h) return;
  if (ok) { if (!(h in netBad) && !(h in netLong)) return; delete netBad[h]; delete netLong[h]; }
  else { const prev = netBad[h]; if (prev && Date.now() - prev < 2 * 3600e3) netLong[h] = 1; netBad[h] = Date.now(); }
  chrome.storage.local.set({ [NET_KEY]: netBad, netLong }).catch(() => {});
}
// 带超时的请求：已知不通直接报错；连不上 / 超时记为不通；HTTP 出错（404、429…）说明网站是通的
async function nfetch(u, o, ms) {
  const h = hostOf(u); if (await isDown(h)) throw new Error("down " + h);
  const ac = typeof AbortController === "function" ? new AbortController() : null, t = setTimeout(() => ac && ac.abort(), ms || 6000);
  try { const r = await fetch(u, Object.assign({}, o, ac ? { signal: ac.signal } : {})); netMark(h, true); return r; }
  catch (e) { netMark(h, false); throw e; }
  finally { clearTimeout(t); }
}
const vocabGet = () => fetch(VOCAB).then(r => { if (!r.ok) throw 0; return r.json(); });

// ---------- 翻译 ----------
async function gTranslate(text, tl, sl) {
  const u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(sl || "auto") + "&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(text);
  const r = await nfetch(u, {}, 5000); if (!r.ok) throw new Error("g" + r.status);
  const j = await r.json();
  return (j[0] || []).map(x => x[0]).join("");
}
let msTok = null, msExp = 0;
async function msToken() {
  if (msTok && Date.now() < msExp) return msTok;
  const r = await nfetch("https://edge.microsoft.com/translate/auth", {}, 6000);
  if (!r.ok) { if (r.status === 404 || r.status === 403) netMark("edge.microsoft.com", false); throw new Error("auth"); } // 取令牌的接口只认 Edge 浏览器（Chrome / Brave 里 404）：6 小时内不再试
  msTok = (await r.text()).trim(); msExp = Date.now() + 8 * 60 * 1000; return msTok;
}
async function msTranslate(texts, tl, sl) {
  const to = { "zh-CN": "zh-Hans", "zh-TW": "zh-Hant" }[tl] || tl;
  const tok = await msToken();
  const r = await nfetch("https://api-edge.cognitive.microsofttranslator.com/translate?" + (sl && sl !== "auto" ? "from=" + encodeURIComponent(sl) + "&" : "") + "to=" + to + "&api-version=3.0&includeSentenceLength=true", {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(texts.map(Text => ({ Text })))
  }, 8000);
  if (!r.ok) { msTok = null; throw new Error("ms" + r.status); }
  const j = await r.json(); return j.map(x => (x.translations && x.translations[0] && x.translations[0].text) || "");
}
// 网站后台翻译（后台在 Cloudflare，谷歌 / Workers AI 都能用；只翻成简体中文）
async function siteTranslate(texts) {
  const r = await nfetch(SITE + "/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "tr", texts }) }, 20000);
  const j = await r.json().catch(() => null); if (!j || !j.ok || !Array.isArray(j.zh)) throw new Error("site tr"); return j.zh;
}
// MyMemory 公开翻译接口（免费、不用密钥，每天每个 IP 有额度；一次一句，500 字以内）：最后一道
async function mmTranslate(texts, tl, sl) {
  const out = [];
  for (let i = 0; i < texts.length; i += 3) out.push(...await Promise.all(texts.slice(i, i + 3).map(async t => {
    if (t.length > 480) return "";
    const r = await nfetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(t) + "&langpair=" + encodeURIComponent((sl && sl !== "auto" ? sl : "en") + "|" + tl), {}, 8000);
    const j = r.ok ? await r.json().catch(() => null) : null, x = j && j.responseData && j.responseData.translatedText;
    if (j && (j.quotaFinished || /MYMEMORY WARNING/i.test(x || ""))) { netMark("api.mymemory.translated.net", false); throw new Error("quota"); } // 今天的额度用完了
    return x && +j.responseStatus === 200 ? strip(x) : "";
  })));
  return out;
}
// 一批句子：按顺序换引擎，前一个没翻出来的句子交给下一个（谷歌 → 微软 → 网站后台 → MyMemory；选了微软就微软在前）
async function translateMany(texts, tl, engine, sl) {
  texts = (texts || []).map(t => String(t == null ? "" : t)); const out = texts.map(() => "");
  for (const e of engine === "ms" ? ["ms", "g", "site", "mm"] : ["g", "ms", "site", "mm"]) {
    const idx = []; out.forEach((x, i) => { if (!x && texts[i].trim()) idx.push(i); }); if (!idx.length) break;
    const part = idx.map(i => texts[i]); let got = [];
    try {
      if (e === "g") { if (await isDown(G_HOST)) continue; got = await Promise.all(part.map(t => gTranslate(t, tl, sl).catch(() => ""))); }
      else if (e === "ms") got = await msTranslate(part, tl, sl);
      else if (e === "site") { if (!/^zh(-cn|-hans)?$/i.test(tl || "") || (sl && !/^(en|auto)$/i.test(sl))) continue; got = await siteTranslate(part); }
      else got = await mmTranslate(part, tl, sl);
    } catch (x) { continue; }
    idx.forEach((i, n) => { if (got[n]) out[i] = String(got[n]); });
  }
  return out;
}

// ---------- 查词 ----------
const POS_ZH = { noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.", pronoun: "pron.", preposition: "prep.", conjunction: "conj.", interjection: "int.", determiner: "det.", exclamation: "excl.", abbreviation: "abbr.", article: "art.", numeral: "num.", particle: "part.", prefix: "pref.", suffix: "suf.", phrase: "phr." };
// 朗读：单个英文单词优先用词典的真人录音，其余用 Google 的在线朗读；谷歌不通（中国大陆）用有道的真人发音；都不行返回空，页面用浏览器自带的合成语音
const ttsMem = new Map();
async function tts(text, lang) {
  text = String(text || "").trim().slice(0, 190); if (!text) return ""; lang = String(lang || "en").split("-")[0];
  const k = lang + "|" + text.toLowerCase(); if (ttsMem.has(k)) return ttsMem.get(k);
  const urls = []; if (lang === "en" && /^[a-z]+$/i.test(text)) urls.push("https://ssl.gstatic.com/dictionary/static/sounds/oxford/" + text.toLowerCase() + "--_us_1.mp3");
  urls.push("https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=" + encodeURIComponent(lang) + "&q=" + encodeURIComponent(text));
  if (lang === "en") urls.push("https://dict.youdao.com/dictvoice?type=2&audio=" + encodeURIComponent(text)); // type=2 美音
  for (const u of urls) {
    try {
      const r = await nfetch(u, { referrerPolicy: "no-referrer" }, 5000); if (!r.ok) continue;
      const u8 = new Uint8Array(await r.arrayBuffer()); if (u8.length < 500) continue;
      let bin = ""; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      const d = "data:audio/mpeg;base64," + btoa(bin); ttsMem.set(k, d); if (ttsMem.size > 150) ttsMem.delete(ttsMem.keys().next().value); return d;
    } catch (e) {}
  }
  return "";
}
// 复习用的例句：来自 Tatoeba 例句库（CC-BY），带中文翻译；结果存本地
async function sentences(word, tl, sl) {
  if (sl && sl !== "en") return [];
  const k = "sent:" + tl + ":" + word, c = await chrome.storage.local.get(k); if (c[k]) return c[k];
  const zh = /^zh/i.test(tl || "");
  const r = await nfetch("https://tatoeba.org/en/api_v0/search?from=eng&query=" + encodeURIComponent(word) + "&sort=relevance&word_count_max=14" + (zh ? "&to=cmn&trans_filter=limit&trans_to=cmn" : ""), {}, 6000); // 例句库有时很慢，最多等 6 秒
  if (!r.ok) throw new Error("t" + r.status);
  const j = await r.json();
  const out = (j.results || []).map(x => { const ts = (x.translations || []).flat().filter(t => t && t.lang === "cmn"), t = ts.find(t => t.script === "Hans") || ts[0]; return { en: x.text, tr: zh && t ? t.text : "" }; }).filter(x => x.en && x.en.length <= 90).slice(0, 8);
  if (out.length) chrome.storage.local.set({ [k]: out });
  return out;
}
// 查词结果存本地：同一个词第二次悬停不再联网；失败自动重试一次
async function gWord(word, tl, sl) {
  const k = "dc:" + tl + ":" + word, c = await chrome.storage.local.get(k); if (c[k]) return c[k];
  let g; try { g = await gWordRaw(word, tl, sl); } catch (e) { await new Promise(r => setTimeout(r, 500)); g = await gWordRaw(word, tl, sl); }
  if (g && g.t) chrome.storage.local.set({ [k]: g });
  return g;
}
// 查一个词的中文：谷歌（带词性的几个意思）→ 谷歌不通时有道词典（英文查中文，国内能用）+ 微软翻译 → 网站后台 /api/dict
async function gWordRaw(word, tl, sl) {
  try { return await gWordGoogle(word, tl, sl); } catch (e) {}
  const en = !sl || sl === "en" || sl === "auto", zhT = /^zh/i.test(tl || "");
  if (en && zhT) { const y = await youdao(word).catch(() => null), z = y ? ydZh(y) : []; if (z.length) { let t = ""; try { t = (await msTranslate([word], tl, "en"))[0] || ""; } catch (e) {} return { t: t || z[0].words[0], zh: /\s/.test(word) && t ? [] : z }; } }
  { const t = (await translateMany([word], tl, "ms", sl).catch(() => [""]))[0]; if (t) return { t, zh: [] }; } // 微软 → 网站后台 → MyMemory
  if (en && /^zh(-cn|-hans)?$/i.test(tl || "")) { const d = await siteDict(word); if (d && (d.zh || (d.zhs || []).length)) return { t: d.zh || "", zh: (d.zhs || []).map(x => ({ pos: POS_ZH[x.pos] || x.pos, words: (x.terms || []).slice(0, 5) })).filter(z => z.words.length).slice(0, 4) }; }
  throw new Error("no word");
}
async function gWordGoogle(word, tl, sl) {
  const u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(sl || "auto") + "&tl=" + encodeURIComponent(tl) + "&dt=t&dt=bd&q=" + encodeURIComponent(word);
  const r = await nfetch(u, {}, 5000); if (!r.ok) throw new Error("g" + r.status);
  const j = await r.json();
  const t = (j[0] || []).map(x => x[0]).join("");
  const zh = /['’]/.test(word) ? [] : (j[1] || []).slice(0, 4).map(e => ({ pos: POS_ZH[e[0]] || e[0], words: (e[1] || []).filter(x => !/[。！？.!?]$/.test(x) && x.length <= 12).slice(0, 5) })).filter(z => z.words.length);
  return { t, zh };
}
// 有道词典 jsonapi（国内服务）：ec = 英汉（音标、按词性的中文），ee = 英英（WordNet 释义和例句），rel_word.stem = 原形；结果存本地
const ydMem = new Map();
async function youdao(w) {
  w = String(w || "").toLowerCase().trim(); if (!w || w.length > 60) return null; if (ydMem.has(w)) return ydMem.get(w);
  const r = await nfetch("https://dict.youdao.com/jsonapi?q=" + encodeURIComponent(w), {}, 6000); if (!r.ok) return null;
  const j = await r.json(); ydMem.set(w, j); if (ydMem.size > 200) ydMem.delete(ydMem.keys().next().value); return j;
}
const ydText = x => { const i = x && x.l && x.l.i; return strip(Array.isArray(i) ? i.map(y => (typeof y === "string" ? y : (y && y["#text"]) || "")).join("") : typeof i === "string" ? i : ""); };
// "n. 跑步，赛跑；管理" → [{pos:"n.", words:["跑步","赛跑","管理"]}]
function ydZh(j) {
  const ws = (j && j.ec && j.ec.word) || [], w0 = Array.isArray(ws) ? ws[0] : ws, out = [];
  ((w0 && w0.trs) || []).forEach(t => ((t && t.tr) || []).forEach(x => {
    const s = ydText(x).replace(/【[^】]*】.*$/, "").trim(); if (!s) return; const m = /^([a-z]+\.(?:\s*&\s*[a-z]+\.)?)\s*(.*)$/i.exec(s);
    const words = (m ? m[2] : s).replace(/（[^）]*）|\([^)]*\)|<[^>]*>/g, "").split(/[，；,;]/).map(y => y.trim()).filter(y => y && y.length <= 12).slice(0, 5);
    if (words.length) out.push({ pos: m ? m[1].replace(/\s+/g, "") : "", words });
  }));
  return out.slice(0, 4);
}
function ydPhon(j) { const ws = (j && j.ec && j.ec.word) || [], w0 = Array.isArray(ws) ? ws[0] : ws, p = w0 && (w0.usphone || w0.phone || w0.ukphone); return p ? "/" + String(p).replace(/^\/|\/$/g, "") + "/" : ""; }
function ydMeanings(j) { // 英英释义 → 和维基词典一样的 [{pos, defs:[{def, example}]}]：柯林斯（学习者释义，带例句）优先，其次 WordNet；维基百科摘要不要
  const pos = p => POS_ZH[String(p || "").replace(/\.$/, "").toLowerCase()] || String(p || "").replace(/:$/, "");
  const cg = (j && j.collins_primary && j.collins_primary.gramcat) || [];
  const co = cg.slice(0, 3).map(g => ({ pos: pos(g.partofspeech), defs: (g.senses || []).slice(0, 2).map(x => ({ def: cut(strip(x.definition || ""), 150), example: cut(strip(((x.examples || [])[0] || {}).example || ""), 120) })).filter(d => d.def) })).filter(m => m.defs.length);
  if (co.length) return co;
  const ee = j && j.ee; if (!ee || !ee.source || ee.source.name !== "WordNet") return [];
  return ((ee.word && ee.word.trs) || []).slice(0, 3).map(t => ({ pos: pos(t.pos), defs: (t.tr || []).slice(0, 2).map(x => { const e = x && x.exam && x.exam.i && x.exam.i.f && x.exam.i.f.l; return { def: cut(ydText(x), 150), example: cut(strip(Array.isArray(e) ? (e[0] && e[0].i) || "" : (e && e.i) || ""), 120) }; }).filter(d => d.def) })).filter(m => m.defs.length);
}
const ydLemma = j => String((j && ((j.collins_primary && j.collins_primary.words && j.collins_primary.words.word) || (j.rel_word && j.rel_word.stem))) || "").toLowerCase();
// 网站后台查词 /api/dict（谷歌 + dictionaryapi.dev，后台缓存 30 天）
async function siteDict(w) { try { const r = await nfetch(SITE + "/api/dict?w=" + encodeURIComponent(w), {}, 12000); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function stems(w) {
  const c = []; const add = x => { if (x.length > 1 && x !== w) c.push(x); };
  if (/ies$/.test(w)) add(w.slice(0, -3) + "y");
  if (/(es|ed|er)$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/s$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + "y");
  if (/ed$/.test(w) && /(.)\1$/.test(w.slice(0, -2))) add(w.slice(0, -3));
  if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); if (/(.)\1$/.test(w.slice(0, -3))) add(w.slice(0, -4)); }
  if (/ly$/.test(w)) add(w.slice(0, -2));
  return c;
}
const ARPA = { AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", B: "b", CH: "tʃ", D: "d", DH: "ð", EH: "ɛ", ER: "ɝ", EY: "eɪ", F: "f", G: "ɡ", HH: "h", IH: "ɪ", IY: "i", JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", OW: "oʊ", OY: "ɔɪ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", UH: "ʊ", UW: "u", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ" };
const VOW = new Set("AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW".split(" "));
function arpaToIpa(pron) {
  let out = "";
  for (const p of pron.trim().split(/\s+/)) {
    const m = /^([A-Z]+)(\d)?$/.exec(p); if (!m) continue;
    let sym = ARPA[m[1]]; if (!sym) continue;
    if (m[1] === "AH" && m[2] === "0") sym = "ə"; if (m[1] === "ER" && m[2] === "0") sym = "ɚ";
    out += (VOW.has(m[1]) ? (m[2] === "1" ? "ˈ" : m[2] === "2" ? "ˌ" : "") : "") + sym;
  }
  return out ? "/" + out + "/" : "";
}
async function phonetic(w) {
  try {
    const r = await nfetch("https://api.datamuse.com/words?sp=" + encodeURIComponent(w) + "&md=r&max=1", {}, 5000); if (!r.ok) return "";
    const j = await r.json(); const e = j[0]; if (!e || e.word !== w) return "";
    const t = (e.tags || []).find(x => x.startsWith("pron:")); return t ? arpaToIpa(t.slice(5)) : "";
  } catch (e) { return ""; }
}
const strip = h => String(h || "").replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);
// 维基词典：直连不通（中国大陆）就经网站后台中转（/api/px，只转白名单里的网站）
async function wfetch(u, ms) {
  try { return await nfetch(u, {}, ms || 6000); } catch (e) { return nfetch(SITE + "/api/px?u=" + encodeURIComponent(u), {}, 12000); }
}
async function wikt(w) {
  const r = await wfetch("https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(w));
  if (!r.ok) return null;
  const j = await r.json(); const en = (j.en || []);
  const meanings = en.filter(m => !/^(symbol|letter|number|punctuation mark)$/i.test(m.partOfSpeech || "")).slice(0, 3).map(m => ({
    pos: POS_ZH[(m.partOfSpeech || "").toLowerCase()] || (m.partOfSpeech || "").toLowerCase(),
    defs: (m.definitions || []).map(d => ({ def: cut(strip(d.definition), 150), example: cut(strip((d.examples || [])[0] || ""), 120) })).filter(d => d.def).slice(0, 2)
  })).filter(m => m.defs.length);
  return meanings.length ? meanings : null;
}
async function dict(word) {
  const w = word.toLowerCase();
  try {
    let meanings = await wikt(w).catch(() => null), lemma = "", yd = null;
    const wkDown = !meanings && (await isDown("en.wiktionary.org")) && (await isDown(hostOf(SITE))); // 维基词典和中转都不通：不再一个个试词形，直接问有道
    if (!meanings && !wkDown) for (const s of stems(w)) { meanings = await wikt(s).catch(() => null); if (meanings) { lemma = s; break; } }
    if (!meanings) { yd = await youdao(w).catch(() => null); const m = ydMeanings(yd); if (m.length) { meanings = m; const st = ydLemma(yd); if (st && st !== w && /^[a-z][a-z'-]*$/.test(st)) lemma = st; } }
    const first = meanings && meanings[0] && meanings[0].defs[0] && meanings[0].defs[0].def || "";
    const lm = /\bof ([A-Za-z'-]+)\.?$/.exec(first); if (!lemma && lm && /(past|participle|plural|person|form|comparative|superlative|spelling)/i.test(first)) lemma = lm[1].toLowerCase();
    let ph = await phonetic(w);
    if (!ph) { if (!yd) yd = await youdao(w).catch(() => null); ph = ydPhon(yd); }
    if (!meanings && !ph) return null;
    return { phonetic: ph, audio: "", meanings: meanings || [], lemma };
  } catch (e) { return null; }
}

// ---------- 加入生词本 ----------
async function addWord(word, queueOnly, m) {
  word = (word || "").trim(); if (!word) return { ok: false };
  if (!queueOnly) { // 短语只进待整理队列，不进“正在学习”的单词表
    const st = await chrome.storage.local.get({ saved: [] });
    if (!st.saved.some(w => w.toLowerCase() === word.toLowerCase())) { st.saved.push(word); await chrome.storage.local.set({ saved: st.saved }); }
  }
  const e = await makeEntry(word, m || {});
  return cloudAdd([e]);
}

// ---------- 同步到生词本网站：直接生成完整词条（释义、音标、原句），手机上打开就能复习 ----------
// 只有英文字母数字的词：v_单词（和以前一样）；带重音字母、日文、俄文等：后面再加一段按原词算的编号，免得不同的词撞成同一个 id（año / ano、所有日文词都变成 v_）
const entryId = w => { const lw = String(w).toLowerCase(), slug = lw.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 70); if (!/[^\x00-\x7f]/.test(lw) && slug) return "v_" + slug; let h = 5381; for (const c of lw) h = (h * 33 + c.codePointAt(0)) >>> 0; return "v_" + (slug ? slug + "_" : "") + h.toString(36); };
async function makeEntry(word, m) {
  if (m.kind === "sentence") { // 整句：不查词典，只要译文
    const t = word.replace(/\s+/g, " ").trim(); let zh = m.zh || "";
    if (!zh) { try { zh = (await translateMany([t], m.tl || "zh-CN", "google", "en"))[0] || ""; } catch (e) {} }
    return { id: entryId(t), type: "sentence", word: t, phon: "", en: "", zh: zh || "(未查到，可手动补)", tag: "视频", date: new Date().toISOString().slice(0, 10), forms: [], examples: [], tip: "" };
  }
  const lw = word.toLowerCase(), isPh = /\s/.test(word.trim()), tl = m.tl || "zh-CN";
  const [g, d] = await Promise.all([gWord(lw, tl, "en").catch(() => null), isPh ? null : dict(lw).catch(() => null)]);
  const zs = []; const add = x => { x = String(x || "").trim(); if (x && !zs.includes(x) && x.toLowerCase() !== lw) zs.push(x); };
  if (m.zh) add(m.zh); if (g) { add(g.t); (g.zh || []).forEach(z => z.words.forEach(add)); }
  const def = d && d.meanings && d.meanings[0] && d.meanings[0].defs[0] && d.meanings[0].defs[0].def || "";
  const ex = []; const c = m.ctx;
  if (c && c.t) { const re = new RegExp("\\b(" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\w*)", "i"); ex.push([c.t.replace(/\s+/g, " ").replace(re, "{$1}"), c.tr || ""]); }
  return { id: entryId(word), type: isPh ? "phrase" : "word", word, phon: d && d.phonetic ? (/^\//.test(d.phonetic) ? d.phonetic : "/" + d.phonetic + "/") : "", en: def, zh: zs.slice(0, 4).join("；") || "(未查到，可手动补)", tag: m.tag || "视频", date: new Date().toISOString().slice(0, 10), forms: [], examples: ex, tip: "" };
}
let cloudChain = Promise.resolve();
function cloudAdd(entries) { // 网站后台负责合并（同名词跳过、移出待整理队列）；这里串行发送，避免连续加词互相覆盖
  const run = async () => {
    try {
      if (!entries.length) return { ok: true, cloud: true, added: 0 };
      const p = await fetch(VOCAB, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ add: entries }) });
      const j = await p.json().catch(() => ({}));
      return { ok: p.ok, cloud: p.ok && !!j.ok, added: j.added || 0, total: j.total };
    } catch (e) { return { ok: true, cloud: false }; }
  };
  const res = cloudChain.then(run, run); cloudChain = res.catch(() => {}); return res;
}
// 把本机已保存的单词 / 短语，以及云端待整理队列里的词，一次补齐成完整词条
// 复习进度写回生词本（和网站「🔊 练习」共用）；发不出去就先存着，下次再补发
// 「已保存」页里删除生词本词条（deleted）也走这里：以前只带 srs / progress，删除根本没传上去，词过一会儿又回来了
let patchChain = Promise.resolve();
function vocabPatch(patch) { const run = () => vocabPatch1(patch); const p = patchChain.then(run, run); patchChain = p.catch(() => {}); return p; } // 一个一个发：队列读改写不会互相覆盖
async function vocabPatch1(patch) {
  const q = (await chrome.storage.local.get({ srsQueue: { srs: {}, progress: {} } })).srsQueue;
  q.srs = q.srs || {}; q.progress = q.progress || {};
  Object.assign(q.srs, patch.srs || {}); Object.assign(q.progress, patch.progress || {});
  if (Array.isArray(patch.deleted) && patch.deleted.length) q.deleted = [...new Set((q.deleted || []).concat(patch.deleted.filter(x => typeof x === "string")))];
  try {
    const r = await fetch(VOCAB, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patch: q }) }); if (!r.ok) throw 0;
    await chrome.storage.local.set({ srsQueue: { srs: {}, progress: {} } });
    if (q.deleted && q.deleted.length) { const nb = (await chrome.storage.local.get({ vocabCache: null })).vocabCache; if (nb && Array.isArray(nb.deleted)) { const del = new Set(nb.deleted.concat(q.deleted)); nb.deleted = [...del]; nb.custom = (nb.custom || []).filter(e => !e || !del.has(e.id)); await chrome.storage.local.set({ vocabCache: nb }); } }
    return { ok: true };
  }
  catch (e) { await chrome.storage.local.set({ srsQueue: q }); return { ok: false, queued: true }; }
}
// 在插件里把某个词标为已掌握 / 将要学习（视频字幕、已保存页、复习页）：生词本里有这个词，就同步它的掌握状态
async function vocabMark(word, st) {
  const k = String(word || "").toLowerCase().trim(); if (!k || !/^(known|learning)$/.test(st)) return { ok: false };
  let nb = (await chrome.storage.local.get({ vocabCache: null })).vocabCache;
  const find = d => ((d && d.custom) || []).find(e => e && String(e.word || "").toLowerCase().trim() === k && !(d.deleted || []).includes(e.id));
  let e = find(nb); if (!e) { try { nb = await vocabGet(); await chrome.storage.local.set({ vocabCache: nb }); e = find(nb); } catch (er) {} }
  if (!e) return { ok: false, missing: true };
  return vocabPatch({ progress: { [e.id]: st } });
}
// 「排到下次复习的最前面」：把这个词的复习时间改成现在（写进生词本的复习进度，网站「🔊 练习」下一组最先练它）
async function reviewNext(word) {
  const k = String(word || "").toLowerCase().trim(); if (!k) return { ok: false };
  let nb = (await chrome.storage.local.get({ vocabCache: null })).vocabCache;
  const find = d => ((d && d.custom) || []).find(e => e && String(e.word || "").toLowerCase().trim() === k);
  let e = find(nb); if (!e) { try { nb = await vocabGet(); await chrome.storage.local.set({ vocabCache: nb }); e = find(nb); } catch (er) {} }
  const id = e ? e.id : "v_" + k.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return vocabPatch({ srs: { [id]: Object.assign({ b: 0, n: 0 }, (nb && nb.srs && nb.srs[id]) || {}, { due: 1, at: Date.now() }) } });
}
const queued = q => q && (Object.keys(q.srs || {}).length || Object.keys(q.progress || {}).length || (q.deleted || []).length);
async function flushSrs() { const q = (await chrome.storage.local.get({ srsQueue: null })).srsQueue; if (queued(q)) vocabPatch({}); }
// 网站上删掉的词（回收站里，30 天内）：{ 小写词: 删除时间 }。插件本机还留着、而且是在删除之前保存的，就跟着删掉，不再传上去把它加回来
async function trashWords() {
  try { const r = await fetch(VOCAB + "?trash=1"); if (!r.ok) return null; const j = await r.json(), o = {}; (j.items || []).forEach(t => { if (t && t.e && t.e.word) { const k = String(t.e.word).toLowerCase().trim(); o[k] = Math.max(o[k] || 0, +t.at || 0); } }); return o; } catch (e) { return null; }
}
async function dropTrashed(nb, have) {
  const T = await trashWords(), del = new Set((nb && nb.deleted) || []);
  const st = await chrome.storage.local.get({ saved: [], savedCtx: {} }), gone = [];
  st.saved.forEach(w => { const k = String(w).toLowerCase(); if (have.has(k)) return; const at = (st.savedCtx[k] && +st.savedCtx[k].at) || 0; if (T ? T[k] && T[k] > at : del.has(entryId(k)) && !at) gone.push(k); });
  if (gone.length) await chrome.storage.local.set({ saved: st.saved.filter(w => !gone.includes(String(w).toLowerCase())) });
  return new Set(gone);
}
async function syncAll(tl) {
  const st = await chrome.storage.local.get({ saved: [], savedSents: [], savedCtx: {} });
  let pend = [], have = new Set(), nb = null;
  try { nb = await vocabGet(); pend = nb.pending || []; (nb.custom || []).forEach(x => x && have.add((x.word || "").toLowerCase())); } catch (e) { return { ok: false, cloud: false }; }
  const gone = await dropTrashed(nb, have);
  const items = new Map();
  st.saved.forEach(w => { if (!gone.has(w.toLowerCase())) items.set(w.toLowerCase(), { word: w }); });
  st.savedSents.filter(x => x.ph).forEach(x => items.set(x.t.toLowerCase(), { word: x.t, zh: x.tr, ctx: x.ctx ? { t: x.ctx } : null }));
  pend.forEach(w => { w = String(w); if (!items.has(w.toLowerCase())) items.set(w.toLowerCase(), { word: w }); });
  const out = [];
  for (const [k, it] of items) {
    if (have.has(k)) continue;
    const med = (await chrome.storage.local.get("med:w:" + k))["med:w:" + k], c = st.savedCtx[k];
    const ctx = it.ctx || (med && med.t ? { t: med.t, tr: med.tr } : c && c.t ? { t: c.t } : null);
    if (ctx && ctx.t && !ctx.tr) { try { ctx.tr = (await translateMany([ctx.t], tl || "zh-CN", "google", "en"))[0] || ""; } catch (e) {} }
    out.push(await makeEntry(it.word, { tl, zh: it.zh, ctx }));
  }
  const r = await cloudAdd(out); r.found = items.size; return r;
}

// 哪些词组是固定短语：问维基词典有没有这个词条；维基词典不通（中转也不通）就问有道词典有没有英汉释义
async function phrases(titles) {
  const out = [];
  try {
    for (let i = 0; i < titles.length; i += 45) {
      const part = titles.slice(i, i + 45);
      const r = await wfetch("https://en.wiktionary.org/w/api.php?action=query&format=json&origin=*&titles=" + encodeURIComponent(part.join("|")));
      if (!r.ok) throw new Error("wk" + r.status);
      const j = await r.json(), norm = {}; ((j.query && j.query.normalized) || []).forEach(n => (norm[n.to] = n.from));
      Object.values((j.query && j.query.pages) || {}).forEach(p => { if (p.missing === undefined && p.invalid === undefined) out.push(norm[p.title] || p.title); });
    }
    return out;
  } catch (e) {
    if (await isDown("dict.youdao.com")) throw e;
    const list = titles.slice(0, 16);
    for (let i = 0; i < list.length; i += 4) await Promise.all(list.slice(i, i + 4).map(t => youdao(t).then(j => { if (ydZh(j).length) out.push(t); }).catch(() => {})));
    return out;
  }
}
chrome.runtime.onMessage.addListener((m, _s, send) => {
  if (m.type === "translateMany") translateMany(m.texts, m.tl, m.engine, m.sl).then(t => send({ t })).catch(() => send({}));
  else if (m.type === "translate") translateMany([m.text], m.tl, m.engine, m.sl).then(t => send({ t: t[0] })).catch(() => send({}));
  else if (m.type === "phrases") phrases(m.titles).then(exist => send({ exist })).catch(() => send({}));
  else if (m.type === "wordLite") gWord(/['’]/.test(m.word) ? m.word.replace(/’/g, "'") : m.word.toLowerCase(), m.tl, m.sl).then(g => send({ g })).catch(() => send({}));
  else if (m.type === "word") Promise.all([gWord(/['’]/.test(m.word) ? m.word.replace(/’/g, "'") : m.word.toLowerCase(), m.tl, m.sl).catch(() => null), dict(m.word)]).then(([g, d]) => send({ g, d }));
  else if (m.type === "reloadSelf") { send({}); setTimeout(() => chrome.runtime.reload(), 200); }
  else if (m.type === "pending") vocabGet().then(d => send({ pending: d.pending || [] })).catch(() => send({}));
  else if (m.type === "openSettings") { chrome.windows.create({ url: chrome.runtime.getURL("popup.html"), type: "popup", width: 340, height: 760 }); send({}); }
  else if (m.type === "openLevel") { chrome.runtime.openOptionsPage(); send({}); }
  else if (m.type === "openSaved") { chrome.tabs.create({ url: SITE + "/?go=saved" }); send({}); } // 已保存统一从网站生词本进（里面嵌的就是插件页面，能编辑）
  else if (m.type === "tts") tts(m.text, m.lang).then(a => send({ a })).catch(() => send({ a: "" }));
  else if (m.type === "openReview") { chrome.tabs.create({ url: SITE + "/?go=pump" }); send({}); } // 复习统一用网站「🔊 练习」（手机、电脑同一个，进度同一份）
  else if (m.type === "sentences") sentences(m.word, m.tl, m.sl).then(s => send({ s })).catch(() => send({ s: [] }));
  else if (m.type === "add") addWord(m.word, m.queueOnly, m).then(send);
  else if (m.type === "capUp") { fetch(SITE + "/api/cap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m.body) }).then(r => r.json()).then(send).catch(() => send({ ok: false })); }
  else if (m.type === "syncAll") syncAll(m.tl).then(send);
  else if (m.type === "vocab") vocabGet().then(d => { chrome.storage.local.set({ vocabCache: d }); flushSrs(); send(d); }).catch(() => chrome.storage.local.get({ vocabCache: null }, v => send(Object.assign({ offline: true }, v.vocabCache || {}))));
  else if (m.type === "vocabPatch") vocabPatch(m.patch).then(send);
  else if (m.type === "vocabMark") vocabMark(m.word, m.st).then(send);
  else if (m.type === "reviewNext") reviewNext(m.word).then(send);
  else if (m.type === "extSync") fullSync().then(send);
  else if (m.type === "setSiteUser") setSiteUser(m.id).then(send).catch(e => send({ ok: false, error: String(e && e.message || e) }));
  else if (m.type === "pageSync") { lastFull().then(t => { if (Date.now() - Math.max(t, fullAt) > 120000) fullSync(); }); send({}); } // 打开 YouTube 页面：两分钟内最多同步一次（时间记在 storage.session，后台睡醒也算数）
  else return false;
  return true;
});

// ---------- 插件本机数据 ⇄ Cloudflare（换电脑、重装插件后自动拿回来） ----------
// 同步的内容：已保存的词和句子 / 短语、出处、颜色标记、标签、配图选择、复习页设置、插件设置，以及每个词 / 句子的录音和截图
// 做法：每一项拆成「种类|名字」，和上次同步后的样子比，改了的发上去（带改动时间），云端按时间新的为准合并，再把合并结果写回本机
// 录音截图很大，每条单独存（/api/media），整份数据里只放它的索引；本机没有的从云端下载
const EXT = SITE + "/api/ext", MEDIA = SITE + "/api/media";
const SY_ARR = { saved: w => String(w || "").toLowerCase(), savedSents: x => x && x.k }; // 列表：按小写词 / 句子的 k 区分
const SY_MAP = ["savedCtx", "marks", "tags", "sugg", "unmk"];                                  // unmk：取消标记的时间（nbApply 不再把它标回来）                                           // 对象：按里面的键区分
const SY_ONE = ["reviewOpt", "reviewRate", "dictHist", "showCtx", "wtipOff"];             // 整个值一起
const syHash = x => { const s = JSON.stringify(x); let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return s.length + ":" + (h >>> 0).toString(36); };
const medSig = r => r ? [r.at || 0, (r.aud || "").length, (r.img || "").length, (r.img2 || "").length].join(":") : "";
const isSyKey = k => k in SY_ARR || SY_MAP.includes(k) || SY_ONE.includes(k) || k.startsWith("wimg:") || k.startsWith("med:");

// 录音截图的索引 medIdx = { "med:w:apple": 签名 }：本机每次存录音截图时更新，同步时不用把所有录音都读出来
let medChain = Promise.resolve();
function medIdxUpdate(ch) { medChain = medChain.then(async () => { const idx = (await chrome.storage.local.get({ medIdx: null })).medIdx; if (!idx) return; for (const k in ch) { if (ch[k].newValue) idx[k] = medSig(ch[k].newValue); else delete idx[k]; } await chrome.storage.local.set({ medIdx: idx }); }).catch(() => {}); return medChain; }
async function medIdxGet(keys) {
  await medChain; let idx = (await chrome.storage.local.get({ medIdx: null })).medIdx;
  const n = keys ? keys.filter(k => k.startsWith("med:")).length : -1;
  if (!idx || (n >= 0 && n !== Object.keys(idx).length)) { // 第一次或对不上：全部读一遍重建
    const all = await chrome.storage.local.get(null); idx = {};
    for (const k in all) if (k.startsWith("med:") && all[k]) idx[k] = medSig(all[k]);
    await chrome.storage.local.set({ medIdx: idx });
  }
  return idx;
}
async function syRead() {
  let keys = null; try { keys = await chrome.storage.local.getKeys(); } catch (e) {}
  const v = keys ? await chrome.storage.local.get(keys.filter(k => !k.startsWith("med:"))) : await chrome.storage.local.get(null);
  if (!keys) for (const k in v) if (k.startsWith("med:")) delete v[k];
  const sv = await chrome.storage.sync.get(null), med = await medIdxGet(keys);
  const f = {};
  for (const n in SY_ARR) (Array.isArray(v[n]) ? v[n] : []).forEach(x => { const id = SY_ARR[n](x); if (id) f[n + "|" + id] = x; });
  SY_MAP.forEach(n => { const o = v[n]; if (o && typeof o === "object") for (const k in o) f[n + "|" + k] = o[k]; });
  SY_ONE.forEach(n => { if (v[n] !== undefined) f["one|" + n] = v[n]; });
  for (const k in v) if (k.startsWith("wimg:")) f["wimg|" + k.slice(5)] = v[k];
  for (const k in sv) f["set|" + k] = sv[k];
  for (const k in med) f["med|" + k] = med[k];
  return { v, f, med };
}
// 把云端合并结果写回本机：只写有变化的；列表保留本机原来的顺序，新来的按时间接在后面
// bs = 上次同步后的样子（签名）：本机有、云端没有的录音截图，只有「上次云端还有、这次没了」（别的设备删的）才删；
//   还没传上去的（一次最多传 60 条、传到一半断网）不删
// L0 = 这次同步开始时读的本机数据；写回前再读一次，同步期间本机又改过的项（又保存了词、改了标记…）保留本机的，下次再传
async function syApply(items0, L0, bs) {
  const L = await syRead(), skip = new Set(), items = Object.assign({}, items0);
  for (const k of new Set([...Object.keys(L0.f), ...Object.keys(L.f)])) if (JSON.stringify(L0.f[k]) !== JSON.stringify(L.f[k])) { skip.add(k); if (k in L.f) items[k] = { v: L.f[k], at: Date.now() }; else delete items[k]; }
  const want = { saved: [], savedSents: [] }, maps = {}, ones = {}, wimg = {}, sets = {}, meds = {};
  SY_MAP.forEach(n => (maps[n] = {}));
  for (const k in items) {
    const i = k.indexOf("|"), n = k.slice(0, i), id = k.slice(i + 1), x = items[k].v;
    if (n in SY_ARR) want[n].push([id, x, items[k].at]); else if (n in maps) maps[n][id] = x; else if (n === "one") { if (SY_ONE.includes(id)) ones[id] = x; }
    else if (n === "wimg") wimg["wimg:" + id] = x; else if (n === "set") sets[id] = x; else if (n === "med") meds[id] = x;
  }
  const put = {}, del = [], same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const n in SY_ARR) {
    const old = Array.isArray(L.v[n]) ? L.v[n] : [], byId = new Map(want[n].map(([id, x]) => [id, x])), out = [];
    old.forEach(x => { const id = SY_ARR[n](x); if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); } });
    want[n].filter(([id]) => byId.has(id)).sort((a, b) => ((a[1] && a[1].at) || a[2]) - ((b[1] && b[1].at) || b[2])).forEach(([, x]) => out.push(x));
    if (!same(out, old)) put[n] = out;
  }
  SY_MAP.forEach(n => { if (!same(maps[n], L.v[n] || {})) put[n] = maps[n]; });
  SY_ONE.forEach(n => { if (n in ones) { if (!same(ones[n], L.v[n])) put[n] = ones[n]; } else if (L.v[n] !== undefined) del.push(n); });
  for (const k in wimg) if (!same(wimg[k], L.v[k])) put[k] = wimg[k];
  for (const k in L.v) if (k.startsWith("wimg:") && !(k in wimg)) del.push(k);
  for (const k in L.med) if (!(k in meds) && bs && bs["med|" + k] !== undefined && !skip.has("med|" + k)) del.push(k); // 别的设备删掉的录音截图
  if (Object.keys(put).length) await chrome.storage.local.set(put);
  if (del.length) await chrome.storage.local.remove(del);
  const sv = await chrome.storage.sync.get(null), sput = {}, sdel = [];
  for (const k in sets) if (!same(sets[k], sv[k])) sput[k] = sets[k];
  for (const k in sv) if (!(k in sets)) sdel.push(k);
  if (Object.keys(sput).length) await chrome.storage.sync.set(sput);
  if (sdel.length) await chrome.storage.sync.remove(sdel);
  // 本机没有（或比云端旧）的录音截图：从云端下载
  let got = 0;
  for (const k in meds) {
    if (L.med[k] === meds[k]) continue;
    try { const r = await fetch(MEDIA + "?k=" + encodeURIComponent(k)); if (!r.ok) continue; const j = await r.json(); if (j && j.rec) { await chrome.storage.local.set({ [k]: j.rec }); await medIdxUpdate({ [k]: { newValue: j.rec } }); got++; } } catch (e) {}
  }
  return { got, wrote: Object.keys(put).length + del.length, skip };
}
// 生词本里的掌握状态 → 插件的颜色标记（网站上标为已掌握 / 练到已掌握：字幕里这个词变白、移出「正在学习」；插件里标过已掌握的写回生词本）
async function nbApply() {
  let nb; try { nb = await vocabGet(); await chrome.storage.local.set({ vocabCache: nb }); } catch (e) { return { ok: false }; }
  const have = new Set((nb.custom || []).map(x => x && String(x.word || "").toLowerCase()));
  await dropTrashed(nb, have).catch(() => {});
  const st = await chrome.storage.local.get({ saved: [], marks: {}, unmk: {} }), del = new Set(nb.deleted || []), P = nb.progress || {}, PA = nb.progAt || {}, U = st.unmk || {}, seen = new Set(), toKnown = {};
  let saved = st.saved, marks = st.marks, ch = false; const has = k => saved.some(x => String(x).toLowerCase() === k);
  (nb.custom || []).forEach(e => {
    if (!e || !e.id || !e.word || del.has(e.id) || (e.type || "word") !== "word") return;
    const k = String(e.word).toLowerCase().trim(); if (!/^[a-z][a-z'’-]*$/.test(k) || seen.has(k)) return; seen.add(k);
    if (U[k] && !((+PA[e.id] || 0) > U[k])) return; // 插件里「恢复默认」取消过：生词本那边之后没再改过它的状态，就不把它标回来
    if (P[e.id] === "known") { if (marks[k] !== "known") { marks[k] = "known"; ch = true; } if (has(k)) { saved = saved.filter(x => String(x).toLowerCase() !== k); ch = true; } }
    else if (marks[k] === "known") toKnown[e.id] = "known";
    else if (!has(k) && marks[k] !== "ignore") { saved.push(k); ch = true; }
  });
  if (ch) await chrome.storage.local.set({ saved, marks });
  if (Object.keys(toKnown).length) await vocabPatch({ progress: toKnown });
  // 插件早期在本机按词记的复习进度：生词本里还没有的迁移上去，然后清掉（以前由插件复习页做，复习页已并进网站「练习」）
  const old = (await chrome.storage.local.get({ srs: {} })).srs || {}, cloud = nb.srs || {}, mig = {};
  for (const k in old) { const e = (nb.custom || []).find(x => x && String(x.word || "").toLowerCase().trim() === k), id = e ? e.id : "v_" + k.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); if (!cloud[id] && old[k] && old[k].due) mig[id] = Object.assign({ at: Date.now() }, old[k]); }
  if (Object.keys(old).length) { const r = Object.keys(mig).length ? await vocabPatch({ srs: mig }) : { ok: true }; if (r.ok) await chrome.storage.local.remove("srs"); }
  return { ok: true, changed: ch };
}
let fullAt = 0;
// 一次性修复：2026-11-20 线上测试时 possessions 被误标成「已知」（生词本那边已恢复），插件本机的这个标记也去掉，免得再写回生词本
async function repair1120() {
  const v = await chrome.storage.local.get({ repair1120: false, marks: {}, saved: [] }); if (v.repair1120) return;
  const marks = v.marks || {}, saved = v.saved || [];
  if (marks.possessions === "known") { delete marks.possessions; if (!saved.some(x => String(x).toLowerCase() === "possessions")) saved.push("possessions"); await chrome.storage.local.set({ marks, saved }); }
  await chrome.storage.local.set({ repair1120: true });
}
const lastFull = () => (chrome.storage.session ? chrome.storage.session.get({ fullAt: 0 }).then(v => +v.fullAt || 0).catch(() => 0) : Promise.resolve(0));
const fullSync = () => { fullAt = Date.now(); try { chrome.storage.session && chrome.storage.session.set({ fullAt }); } catch (e) {} return repair1120().catch(() => {}).then(() => nbApply()).catch(() => {}).then(() => extSync(true)); };
let syBusy = null, syAgain = false, syLast = 0, syT = 0;
// 录音截图没传完：半分钟后再试（用 alarm，后台睡着了也会叫醒；setTimeout 跟着后台一起没了）
function retrySoon() { try { chrome.alarms.create("extRetry", { delayInMinutes: 0.5 }); } catch (e) { extSyncSoon(30000); } }
function extSyncSoon(ms) { clearTimeout(syT); syT = setTimeout(() => extSync(), ms == null ? 4000 : ms); }
function extSync(force) {
  if (userSwitching) return Promise.resolve({ ok: false, switching: true });
  if (syBusy) { syAgain = true; return syBusy; }
  syBusy = extSyncOnce(force).catch(e => ({ ok: false, error: String(e && e.message || e) })).then(async r => { syBusy = null; if (syAgain) { syAgain = false; await extSync(true); } return r; });
  return syBusy;
}
async function extSyncOnce(force) {
  const L = await syRead(), base = (await chrome.storage.local.get({ extBase: null })).extBase, bs = (base && base.sig) || {}, now = Date.now();
  const changes = {}, medUp = [];
  let cloud = null;
  if (!base) { // 这台设备第一次同步：先看云端，云端已有的项以云端为准，云端删掉的本机也删
    const r = await fetch(EXT); if (!r.ok) return { ok: false }; cloud = await r.json();
    const all = cloud.items || {};
    for (const k in L.f) if (!(k in all)) { if (k.startsWith("med|")) medUp.push(k.slice(4)); else changes[k] = { v: L.f[k], at: now }; }
  } else {
    for (const k in L.f) if (bs[k] !== (k.startsWith("med|") ? L.f[k] : syHash(L.f[k]))) { if (k.startsWith("med|")) medUp.push(k.slice(4)); else changes[k] = { v: L.f[k], at: now }; }
    for (const k in bs) if (!(k in L.f)) changes[k] = { del: 1, at: now };
  }
  // 先传录音截图，传成功了再登记到索引里（一次最多传 60 条，传不上去的下次再试）
  let up = 0;
  for (const k of medUp.slice(0, 60)) {
    const rec = (await chrome.storage.local.get(k))[k]; if (!rec) continue;
    const ok = await fetch(MEDIA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k, rec }) }).then(r => r.ok).catch(() => false);
    if (!ok) break; changes["med|" + k] = { v: medSig(rec), at: now }; up++;
  }
  if (medUp.length > up) retrySoon();
  let doc;
  if (Object.keys(changes).length) {
    const r = await fetch(EXT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) });
    if (!r.ok) return { ok: false }; doc = await r.json();
  } else {
    if (!force && base && now - syLast < 60000) return { ok: true, idle: true };
    doc = cloud || await fetch(EXT).then(r => r.ok ? r.json() : null); if (!doc) return { ok: false };
  }
  syLast = Date.now();
  if (!doc.ok) return { ok: false };
  const items = doc.items || {};
  const ap = (base && base.ver === doc.ver && !Object.keys(changes).length) ? { got: 0, wrote: 0, skip: new Set() } : await syApply(items, L, base ? bs : null);
  // 记下这次同步后的样子（下载失败的录音截图不记，下次再下；同步期间本机又改过的不记，下次再传）
  const L2 = await syRead(), sig = {};
  for (const k in items) { if (ap.skip.has(k)) { sig[k] = "~"; continue; } if (!(k in L2.f)) continue; sig[k] = k.startsWith("med|") ? L2.f[k] : syHash(L2.f[k]); } // "~"：和本机对不上，下次一定会传（改了就传新的，删了就传删除）
  if (ap.skip.size) extSyncSoon();
  await chrome.storage.local.set({ extBase: { ver: doc.ver, sig, at: Date.now() } });
  return { ok: true, sent: Object.keys(changes).length, up, got: ap.got, wrote: ap.wrote, total: Object.keys(items).length, pendingUp: medUp.length - up };
}
// 切换生词本用户：先把当前这个人的改动传完（传不上去就不切，免得丢数据），再清掉本机属于他的已保存、标记、标签、配图、录音截图，
// 然后从云端拉新的人的数据。插件设置（storage.sync）不清：新的人云端有设置就用他的，没有就沿用现在的设置并传上去
let switchChain = Promise.resolve();
function setSiteUser(id) { const run = () => setSiteUser1(id); const p = switchChain.then(run, run); switchChain = p.catch(() => {}); return p; } // 网站开了几个标签页时一个一个来
async function setSiteUser1(id) {
  id = String(id || ""); if (!/^([a-z0-9]{1,12})?$/.test(id)) return { ok: false, error: "bad user" };
  await siteUserP; if (id === siteUser) return { ok: true, same: true };
  if (id) { const L = await fetch(SITE + "/api/users").then(r => r.json()).catch(() => null); if (!L || !L.ok) return { ok: false, error: "取不到家人名单（网络问题？），没有切换" }; if (!L.users.some(x => x.id === id)) return { ok: false, error: "没有这个家人" }; }
  const r = await extSync(true); if (!r || !r.ok) return { ok: false, error: "当前用户的数据没传完（网络问题？），没有切换" };
  await cloudChain.catch(() => {});
  const q = (await chrome.storage.local.get({ srsQueue: null })).srsQueue;
  if (queued(q)) { const p = await vocabPatch({}); if (!p.ok) return { ok: false, error: "复习进度没传完（网络问题？），没有切换" }; }
  userSwitching = true;
  try {
    if (syBusy) await syBusy.catch(() => {});
    siteUser = id; await chrome.storage.local.set({ siteUser: id });
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter(k => isSyKey(k) || ["extBase", "medIdx", "vocabCache", "srsQueue", "srs"].includes(k)));
  } finally { userSwitching = false; }
  // 先拉云端（新的人的已保存、标记），再对照他的生词本，最后再同步一次；顺序反过来会把他标成「忽略」的词又加回已保存
  fullAt = Date.now(); const s1 = await extSync(true).catch(() => null);
  await nbApply().catch(() => {}); const s2 = await extSync(true).catch(() => null);
  return { ok: true, user: id, sync: s2 || s1 };
}
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "sync") return extSyncSoon();
  if (area !== "local") return;
  const med = {}; let hit = false;
  for (const k in c) { if (k.startsWith("med:")) med[k] = c[k]; if (isSyKey(k)) hit = true; }
  if (Object.keys(med).length) medIdxUpdate(med);
  if (hit) extSyncSoon();
});
// 每 15 分钟同步一次：浏览器重启后定时器可能没了，每次后台醒来都检查一下，没有就补上
const ensureAlarm = () => { try { Promise.resolve(chrome.alarms.get("extSync")).then(a => { if (!a) chrome.alarms.create("extSync", { periodInMinutes: 15 }); }).catch(() => {}); } catch (e) {} };
ensureAlarm();
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); setTimeout(fullSync, 3000); });
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create("extSync", { periodInMinutes: 15 }); setTimeout(fullSync, 3000); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "extSync") fullSync(); else if (a.name === "extRetry") extSync(); });
