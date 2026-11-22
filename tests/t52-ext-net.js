// 插件在中国大陆：谷歌翻译 / 谷歌发音 / 维基词典连不上时，翻译、查词、发音都有备用，而且记住哪个不通（6 小时内不再白等）
// 插件后台 extension/background.js 跑在 vm 里，所有外部请求都是假的（不联网、不碰线上数据）
const fs = require("fs"), vm = require("vm"), path = require("path");
(async () => {
  const local = {}, sync = {};
  const pick = (o, k) => { if (k == null) return JSON.parse(JSON.stringify(o)); if (typeof k === "string") return k in o ? { [k]: JSON.parse(JSON.stringify(o[k])) } : {}; if (Array.isArray(k)) { const r = {}; k.forEach(x => { if (x in o) r[x] = JSON.parse(JSON.stringify(o[x])); }); return r; } const r = {}; for (const x in k) r[x] = x in o ? JSON.parse(JSON.stringify(o[x])) : k[x]; return r; };
  const area = o => ({ get: (k, cb) => { const r = pick(o, k); if (cb) cb(r); return Promise.resolve(r); }, set: async v => { for (const x in v) o[x] = JSON.parse(JSON.stringify(v[x])); }, remove: async ks => { [].concat(ks).forEach(x => delete o[x]); }, getKeys: async () => Object.keys(o) });
  // 假的外部服务：down 里的网站「连不上」（抛网络错误）
  const down = new Set(["translate.googleapis.com", "ssl.gstatic.com", "en.wiktionary.org", "ruilearning-my.pages.dev", "tatoeba.org"]), calls = [];
  let msFail = false, mmQuota = false, ms404 = false;
  const YD = {
    running: { ec: { word: [{ usphone: "ˈrʌnɪŋ", trs: [{ tr: [{ l: { i: ["n. 跑步，赛跑；管理，运作；走私，私运（毒品、枪支等）"] } }] }, { tr: [{ l: { i: ["v. 跑；运转；行驶（run的现在分词形式）"] } }] }, { tr: [{ l: { i: ["【名】 （Running）（英）朗宁（人名）"] } }] }] }] }, ee: { source: { name: "WordNet" }, word: { trs: [{ pos: "n.", tr: [{ l: { i: "the act of running; traveling on foot at a fast pace" }, exam: { i: { f: { l: [{ i: "he broke into a run" }] } } } }] }] } }, rel_word: { stem: "run" } },
    bonded: { ec: { word: [{ usphone: "ˈbɑːndɪd", trs: [{ tr: [{ l: { i: ["adj. 有担保的；保税的；黏合的"] } }] }] }] }, collins_primary: { words: { word: "bond" }, gramcat: [{ partofspeech: "verb", senses: [{ definition: "When one thing bonds with another, it sticks to it.", examples: [{ example: "The atoms bond together." }] }] }] }, ee: { source: { name: "Wikipedia" }, word: { trs: [{ pos: "abstract:", tr: [{ l: { i: "Bonded is a film." } }] }] } } },
    "look up": { ec: { word: [{ trs: [{ tr: [{ l: { i: ["查阅，查找，检索：在参考资料、词典、网站或列表中寻找信息。"] } }] }] }] } },
    "the cat": { meta: {} },
  };
  const res = (body, o) => Object.assign({ ok: true, status: 200, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), arrayBuffer: async () => new Uint8Array(1200).fill(65).buffer }, o || {});
  const fakeFetch = async (u, o) => {
    u = String(u); const h = new URL(u).hostname; calls.push(h + new URL(u).pathname);
    if (down.has(h)) throw new TypeError("Failed to fetch");
    if (h === "edge.microsoft.com") return ms404 ? res("", { ok: false, status: 404 }) : msFail ? res("", { ok: false, status: 500 }) : res("tok");
    if (h === "api-edge.cognitive.microsofttranslator.com") return msFail ? res("", { ok: false, status: 500 }) : res(JSON.parse(o.body).map(x => ({ translations: [{ text: "微软:" + x.Text }] })));
    if (h === "dict.youdao.com" && u.includes("/jsonapi")) return res(YD[new URL(u).searchParams.get("q")] || { meta: {} });
    if (h === "dict.youdao.com" && u.includes("/dictvoice")) return res(null);
    if (h === "api.datamuse.com") return res([]);
    if (h === "api.mymemory.translated.net") { const q = new URL(u).searchParams.get("q"); return res(mmQuota ? { responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY" }, quotaFinished: true, responseStatus: 429 } : { responseData: { translatedText: "MM:" + q + " &amp; ok" }, responseStatus: 200 }); }
    if (h === "ruilearning-my.pages.dev" && u.includes("/api/ai")) return res({ ok: true, zh: JSON.parse(o.body).texts.map(t => "后台:" + t) });
    return res({}, { ok: false, status: 404 });
  };
  const ctx = { console, setTimeout, clearTimeout, URL, URLSearchParams, encodeURIComponent, Promise, JSON, AbortController, Uint8Array, String, btoa, importScripts() {},
    chrome: { storage: { local: area(local), sync: area(sync), onChanged: { addListener() {} } },
      runtime: { onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, getURL: x => x, id: "x" },
      alarms: { create() {}, onAlarm: { addListener() {} } }, tabs: { create() {} } },
    fetch: fakeFetch };
  ctx.self = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8") + "\n;globalThis.__t={translateMany,gWord,dict,tts,phrases,isDown,netMark,siteTranslate};", ctx);
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
  const T = ctx.__t, n = h => calls.filter(c => c.startsWith(h)).length;

  // 翻译：谷歌连不上 → 微软；谷歌记成不通，下一次直接用微软
  let r = await T.translateMany(["Hello", "World", ""], "zh-CN", "youtube", "en");
  ok(JSON.stringify(r) === '["微软:Hello","微软:World",""]', "谷歌不通用微软 " + JSON.stringify(r));
  ok(await T.isDown("translate.googleapis.com"), "记住谷歌不通");
  ok(local.netBad && local.netBad["translate.googleapis.com"] > Date.now() - 5000, "不通的记录存在本机（重启后台也记得）");
  const g0 = n("translate.googleapis.com");
  r = await T.translateMany(["Again"], "zh-CN", "google", "en");
  ok(r[0] === "微软:Again" && n("translate.googleapis.com") === g0, "6 小时内不再去问谷歌");
  // 微软也不行 → 网站后台（只翻简体中文）
  msFail = true; down.delete("ruilearning-my.pages.dev");
  r = await T.translateMany(["Site one"], "zh-CN", "youtube", "en");
  ok(r[0] === "后台:Site one", "微软也不行用网站后台 " + r[0]);
  r = await T.translateMany(["Site one"], "ja", "youtube", "en");
  ok(r[0] === "MM:Site one & ok", "后台只翻中文，日语交给 MyMemory " + r[0]);
  mmQuota = true; r = await T.translateMany(["Quota"], "ja", "youtube", "en");
  ok(r[0] === "" && (await T.isDown("api.mymemory.translated.net")), "MyMemory 额度用完：留空、今天不再问");
  ok(await T.isDown("edge.microsoft.com") === false, "微软 500 不算不通");
  msFail = false; down.add("ruilearning-my.pages.dev");
  // 微软取令牌的接口在 Chrome / Brave 里 404：记为不通，6 小时内不再试
  vm.runInContext("msTok = null", ctx); ms404 = true; await T.translateMany(["x"], "zh-CN", "ms", "en"); ms404 = false;
  ok(await T.isDown("edge.microsoft.com"), "微软令牌 404 记为不通");
  vm.runInContext("delete netBad['edge.microsoft.com']", ctx);
  // 过了 6 小时再试一次谷歌
  local.netBad["translate.googleapis.com"] = Date.now() - 7 * 3600e3; ctx.__t.netMark("x", true);
  vm.runInContext("netBad['translate.googleapis.com'] = Date.now() - 7 * 3600e3", ctx);
  ok(!(await T.isDown("translate.googleapis.com")), "6 小时后不再当作不通");
  await T.translateMany(["Retry"], "zh-CN", "youtube", "en");
  ok(n("translate.googleapis.com") === g0 + 1, "6 小时后重新试谷歌");

  // 查词：有道词典给按词性的中文，微软给整体意思
  let w = await T.gWord("running", "zh-CN", "en");
  ok(w && w.t === "微软:running", "整体意思来自微软 " + JSON.stringify(w));
  ok(w && w.zh.length === 2 && w.zh[0].pos === "n." && w.zh[0].words.includes("跑步") && w.zh[1].pos === "v." && !w.zh.some(z => /朗宁/.test(z.words.join(""))), "有道的词性和中文 " + JSON.stringify(w && w.zh));
  ok(local["dc:zh-CN:running"], "查到的存本地");
  // 维基词典、中转都连不上：英文释义、音标、原形来自有道
  let d = await T.dict("running");
  ok(d && d.phonetic === "/ˈrʌnɪŋ/" && d.meanings[0].defs[0].def === "the act of running; traveling on foot at a fast pace" && d.meanings[0].defs[0].example === "he broke into a run" && d.lemma === "run", "WordNet 释义 " + JSON.stringify(d));
  d = await T.dict("bonded");
  ok(d && d.meanings[0].pos === "v." && /sticks to it/.test(d.meanings[0].defs[0].def) && d.lemma === "bond", "柯林斯释义优先、原形 bond " + JSON.stringify(d));
  const y0 = n("dict.youdao.com/jsonapi"); await T.dict("bonded"); ok(n("dict.youdao.com/jsonapi") === y0, "有道结果有缓存");
  // 发音：谷歌两个都不通 → 有道真人发音
  const a = await T.tts("hello", "en");
  ok(/^data:audio\/mpeg;base64,/.test(a) && calls.some(c => c === "dict.youdao.com/dictvoice"), "有道发音");
  ok(await T.isDown("ssl.gstatic.com"), "记住 gstatic 不通");
  ok((await T.tts("bonjour", "fr")) === "", "法语没有备用：返回空，页面用浏览器自带语音");
  // 固定短语：维基词典不通 → 问有道有没有这个词条
  const ph = await T.phrases(["look up", "the cat"]);
  ok(JSON.stringify(ph) === '["look up"]', "有道认出固定短语 " + JSON.stringify(ph));
  // 每个请求都有超时：卡住的网站等 6 秒后放弃并记为不通（这里把 setTimeout 缩短来测）
  const hang = new Promise(() => {}); let aborted = false;
  ctx.fetch = (u, o) => { if (String(u).includes("api.datamuse.com")) return new Promise((_, rej) => o.signal.addEventListener("abort", () => { aborted = true; rej(new Error("abort")); })); return fakeFetch(u, o); };
  vm.runInContext("self.fetch = globalThis.fetch", ctx);
  const t0 = Date.now(); const realST = ctx.setTimeout; ctx.setTimeout = (f, ms) => realST(f, Math.min(ms, 50));
  vm.runInContext("setTimeout = globalThis.setTimeout", ctx);
  d = await T.dict("bonded");
  ok(aborted && Date.now() - t0 < 3000 && (await T.isDown("api.datamuse.com")), "卡住的请求超时放弃、记为不通");
  void hang;

  console.log(fail ? "t52 FAILED " + fail : "t52 ok"); process.exit(fail ? 1 : 0);
})();
