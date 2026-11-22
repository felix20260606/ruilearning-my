// 插件的 B 站支持：站点适配 extension/sites.js（视频 id、出处链接、字幕列表 / 字幕文件解析、挑轨、语言核对）
// 和页面脚本 extension/bili-inject.js（拦播放器的字幕请求、主动取字幕列表）。不联网：用假的 window / fetch / XHR
const fs = require("fs"), vm = require("vm"), path = require("path");
const EXT = path.join(__dirname, "..", "extension");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + " → " + JSON.stringify(a));

(async () => {
  // ---------- sites.js：在 Node 里直接加载（不碰页面）----------
  const G = {}; vm.runInNewContext(fs.readFileSync(path.join(EXT, "sites.js"), "utf8"), { globalThis: G, URLSearchParams });
  ok(G.VS_SITE && G.VS_SITE.id === "yt", "没有 location 时默认 YouTube");
  ok(G.VS_SITES.bili && G.VS_SITES.bili.capSync === false && G.VS_SITES.yt.capSync === true, "B 站字幕不传网站视频页");
  const L = (p, s) => ({ pathname: p, search: s || "" });
  eq(G.vsBiliVid(L("/video/BV1Gf4y1y7wc/")), "BV1Gf4y1y7wc", "普通视频");
  eq(G.vsBiliVid(L("/zh-Hans/video/BV1Gf4y1y7wc/", "?p=4&spm_id_from=333")), "BV1Gf4y1y7wc?p=4", "语言前缀 + 分 P");
  eq(G.vsBiliVid(L("/video/BV1Gf4y1y7wc", "?p=1")), "BV1Gf4y1y7wc", "第 1 P 不带 p");
  eq(G.vsBiliVid(L("/bangumi/play/ep123456")), "ep123456", "番剧 ep");
  eq(G.vsBiliVid(L("/bangumi/play/ss789")), "ss789", "番剧 ss");
  eq(G.vsBiliVid(L("/")), "", "首页不是视频");
  eq(G.vsBiliVid(L("/video/BV1Gf4y1y7wcX/")), "", "BV 号位数不对");
  eq(G.vsVidUrl("BV1Gf4y1y7wc", 83.6), "https://www.bilibili.com/video/BV1Gf4y1y7wc/?t=83", "B 站链接带时间");
  eq(G.vsVidUrl("BV1Gf4y1y7wc?p=4", 17), "https://www.bilibili.com/video/BV1Gf4y1y7wc/?p=4&t=17", "分 P 链接");
  eq(G.vsVidUrl("ep123456", 5), "https://www.bilibili.com/bangumi/play/ep123456?t=5", "番剧链接");
  eq(G.vsVidUrl("dQw4w9WgXcQ", 61), "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=61s", "YouTube 链接不变");
  eq(["BV1Gf4y1y7wc?p=2", "ep1", "dQw4w9WgXcQ", "", "BV_short"].map(G.vsVidSite), ["bili", "bili", "yt", "yt", "yt"], "按 id 认出是哪个网站");
  ok(G.vsBiliSame("BV1Gf4y1y7wc?p=4", { cid: 1, bvid: "BV1Gf4y1y7wc", p: 4 }), "播放器信息对得上");
  ok(!G.vsBiliSame("BV1Gf4y1y7wc?p=4", { cid: 1, bvid: "BV1Gf4y1y7wc", p: 3 }), "分 P 还没切过来");
  ok(!G.vsBiliSame("BV1Gf4y1y7wc", { cid: 1, bvid: "BV1xx411c7mD", p: 1 }), "页内换了视频、播放器还是旧的");
  ok(!G.vsBiliSame("BV1Gf4y1y7wc", null), "还没有播放器信息");
  ok(G.vsBiliSame("ep9", { cid: 1, ep: 9 }) && !G.vsBiliSame("ep9", { cid: 1, ep: 10 }), "番剧集数核对");

  // 字幕列表：x/v2/dm/view 实际返回的样子（http 地址、标错语言的 en-US、AI 字幕、没有地址的）
  const list = [
    { lan: "zh-CN", lan_doc: "中文（中国）", subtitle_url: "http://aisubtitle.hdslb.com/bfs/subtitle/a.json?auth_key=1", type: 0 },
    { lan: "zh-Hant", lan_doc: "中文（繁體）", subtitle_url: "//aisubtitle.hdslb.com/bfs/subtitle/t.json", type: 0 },
    { lan: "en", lan_doc: "English", subtitle_url: "http://aisubtitle.hdslb.com/bfs/subtitle/e.json?auth_key=2", type: 0 },
    { lan: "en-US", lan_doc: "English(US)", subtitle_url: "http://aisubtitle.hdslb.com/bfs/subtitle/z.json?auth_key=3", type: 0 },
    { lan: "ai-en", lan_doc: "英语（自动生成）", subtitle_url: "https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/x.json?auth_key=4", type: 1 },
    { lan: "ai-zh", lan_doc: "中文（自动生成）", subtitle_url: "https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/y.json", type: 1 },
    { lan: "ja", lan_doc: "日本語", subtitle_url: "", type: 0 },
    null,
  ];
  const tr = G.vsBiliTracks(list);
  eq(tr.map(t => t.lang + "/" + (t.kind || "-")), ["zh-CN/-", "zh-Hant/-", "en/-", "en-US/-", "en/asr", "zh/asr"], "字幕轨（没地址的跳过）");
  ok(tr.every(t => t.url.startsWith("https://")), "地址都换成 https");
  eq(tr.find(t => t.kind === "asr" && t.lang === "en").name, "英语（自动生成）", "AI 字幕名字");
  eq(G.vsBiliCands(tr, "en").map(t => t.lang + "/" + (t.kind || "-")), ["en/-", "en-US/-", "en/asr"], "英文候选：人工在前、AI 在后");
  eq(G.vsBiliCands(tr, "en-US").map(t => t.lang + "/" + (t.kind || "-")), ["en-US/-", "en/-", "en/asr"], "精确语言在前");
  eq(G.vsBiliCands(tr, "ko"), [], "没有韩语");
  eq((G.vsBiliTrack(tr, "zh-CN", false) || {}).lang, "zh-CN", "人工中文：简体");
  eq((G.vsBiliTrack(tr, "zh-TW", false) || {}).lang, "zh-Hant", "人工中文：繁体");
  eq((G.vsBiliTrack(tr, "zh-CN", true) || {}).lang, "zh", "AI 中文（当机器翻译）");
  eq(G.vsBiliTrack(tr, "ja", false), null, "没有日语");
  eq(G.vsBiliTracks(undefined), [], "列表不存在");
  // 字幕文件
  const body = { font_size: 0.4, body: [{ from: 6.99, to: 10.24, location: 2, content: "You probably know that all stuff\nis made up of atoms" }, { from: 10.27, to: 11.42, content: "and that an atom" }, { from: "x", to: 1, content: "坏的" }, { from: 12, to: 11, content: "to 比 from 小" }] };
  eq(G.vsBiliLines(body), [{ s: 6.99, e: 10.24, t: "You probably know that all stuff\nis made up of atoms" }, { s: 10.27, e: 11.42, t: "and that an atom" }, { s: 12, e: 12, t: "to 比 from 小" }], "字幕文件 → 句子");
  eq(G.vsBiliLines({}), [], "空字幕文件");
  const en = G.vsBiliLines(body), zh = [{ s: 1, e: 2, t: "你或许知道所有东西都是由原子组成的。" }, { s: 2, e: 3, t: "而原子本身是一个非常小的粒子 (atom)" }];
  ok(G.vsLooksLang(en, "en") && !G.vsLooksLang(en, "zh-CN"), "英文字幕是英文");
  ok(G.vsLooksLang(zh, "zh-CN") && !G.vsLooksLang(zh, "en"), "标成英语其实是中文的字幕认得出来");
  ok(!G.vsLooksLang([], "en"), "空的不算");

  // ---------- bili-inject.js：页面环境 ----------
  const posted = [], listeners = [], reqs = []; let inner;
  const answers = { // 假的 B 站接口
    "/x/player/wbi/v2": { code: 0, data: { aid: 288571926, cid: 281031471, login_mid: 0, subtitle: { subtitles: [] } } },
    "/x/v2/dm/view": { code: 0, data: { subtitle: { subtitles: list.slice(0, 3) } } },
  };
  const resp = j => ({ ok: true, json: async () => j, text: async () => JSON.stringify(j), clone() { return resp(j); } });
  function XHR() { this.listeners = {}; }
  XHR.prototype.open = function (m, u) { this.u = u; };
  XHR.prototype.send = function () { this.responseType = ""; this.responseText = JSON.stringify(this.u.includes("bfs/subtitle") ? body : answers["/x/player/wbi/v2"]); (this.listeners.load || []).forEach(f => f()); };
  XHR.prototype.addEventListener = function (t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); };
  const win = {
    XMLHttpRequest: XHR, location: { href: "https://www.bilibili.com/video/BV1Gf4y1y7wc/" },
    fetch: async (u, o) => { reqs.push([String(u), o && o.credentials]); const k = Object.keys(answers).find(k => String(u).includes(k)); return resp(k ? answers[k] : {}); },
    postMessage: m => { posted.push(m); listeners.forEach(f => f({ source: inner, data: m })); }, // source 要是脚本里看到的那个 window
    addEventListener: (t, f) => { if (t === "message") listeners.push(f); },
    player: { getManifest: () => ({ p: 1, aid: 288571926, cid: 281031471, bvid: "BV1Gf4y1y7wc", episodeId: null }) },
  };
  win.window = win; const doc = { cookie: "buvid3=x" };
  const ctx = vm.createContext(Object.assign(win, { document: doc, URL })); inner = vm.runInContext("window", ctx);
  vm.runInContext(fs.readFileSync(path.join(EXT, "bili-inject.js"), "utf8"), ctx);
  const wait = () => new Promise(r => setTimeout(r, 20));
  // 1. 主动取：wbi/v2 没给字幕（没登录）→ 再问 dm/view
  win.postMessage({ src: "VS-C", type: "bili-tracks", vid: "BV1Gf4y1y7wc" }); await wait();
  let got = posted.find(m => m.src === "VS" && m.type === "bili-tracks");
  ok(got && got.vid === "BV1Gf4y1y7wc" && got.info.cid === 281031471 && got.info.bvid === "BV1Gf4y1y7wc", "带上播放器信息 " + JSON.stringify(got && got.info));
  ok(got && got.list.length === 3 && got.login === false, "dm/view 的字幕列表、没登录");
  ok(reqs[0][0].includes("/x/player/wbi/v2?aid=288571926&cid=281031471") && reqs[0][1] === "include", "先带 cookie 问 wbi/v2 " + reqs[0]);
  ok(reqs[1] && reqs[1][0].includes("/x/v2/dm/view?type=1&oid=281031471&pid=288571926"), "再问 dm/view");
  // 2. 播放器自己请求到了字幕列表（登录了、有 AI 字幕）：拦下来，下次直接用，不再请求
  answers["/x/player/wbi/v2"] = { code: 0, data: { aid: 288571926, cid: 281031471, login_mid: 42, subtitle: { subtitles: list.slice(4, 6) } } };
  const x = new win.XMLHttpRequest(); x.open("GET", "https://api.bilibili.com/x/player/wbi/v2?aid=288571926&cid=281031471&w_rid=abc"); x.send();
  ok(posted.some(m => m.type === "bili-pl" && m.cid === 281031471 && m.n === 2), "拦到播放器的字幕列表");
  reqs.length = 0; posted.length = 0;
  win.postMessage({ src: "VS-C", type: "bili-tracks", vid: "BV1Gf4y1y7wc" }); await wait();
  got = posted.find(m => m.src === "VS" && m.type === "bili-tracks");
  ok(got && got.list.length === 2 && got.login === true && !reqs.length, "用拦下来的列表（登录）、不再请求 " + reqs.length);
  // 3. 播放器下载字幕文件（fetch）：内容转给 content.js
  posted.length = 0; await win.fetch("https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/x.json?auth_key=4"); await wait();
  answers["bfs/ai_subtitle"] = body; posted.length = 0; await win.fetch("https://aisubtitle.hdslb.com/bfs/ai_subtitle/prod/x.json?auth_key=4"); await wait();
  got = posted.find(m => m.type === "bili-sub");
  ok(got && got.body.length === 4 && /ai_subtitle\/prod\/x\.json/.test(got.url), "拦到字幕文件");
  // 4. 别的消息不理
  posted.length = 0; win.postMessage({ src: "VS-C", type: "get-tracks" }); await wait();
  ok(!posted.some(m => m.src === "VS"), "YouTube 的消息不理");
  // 5. 没有播放器、也没有页面数据
  delete win.player; posted.length = 0; win.postMessage({ src: "VS-C", type: "bili-tracks", vid: "BV1" }); await wait();
  got = posted.find(m => m.src === "VS" && m.type === "bili-tracks"); ok(got && got.info === null && !got.list.length, "拿不到视频信息");
  // 6. 没有 getManifest 时用 __INITIAL_STATE__（分 P）
  win.__INITIAL_STATE__ = { aid: 5, bvid: "BV1Gf4y1y7wc", p: 2, videoData: { aid: 5, bvid: "BV1Gf4y1y7wc", cid: 100, pages: [{ cid: 100 }, { cid: 200 }] } };
  posted.length = 0; win.postMessage({ src: "VS-C", type: "bili-tracks", vid: "BV1Gf4y1y7wc?p=2" }); await wait();
  got = posted.find(m => m.src === "VS" && m.type === "bili-tracks"); ok(got && got.info && got.info.cid === 200 && got.info.p === 2, "页面数据里的分 P cid " + JSON.stringify(got && got.info));
  ok(G.vsBiliSame("BV1Gf4y1y7wc?p=2", got.info), "和地址对得上");

  // ---------- manifest：B 站的匹配和权限、版本 ----------
  const M = JSON.parse(fs.readFileSync(path.join(EXT, "manifest.json"), "utf8"));
  ok(/^1\.25\.\d+$/.test(M.version), "版本 1.25.x " + M.version);
  const cs = M.content_scripts, main = cs.find(c => c.world === "MAIN" && c.js.includes("bili-inject.js")), iso = cs.find(c => c.js.includes("content.js"));
  ok(main && main.matches.includes("https://www.bilibili.com/*") && main.run_at === "document_start", "页面脚本在 B 站一开始就跑");
  ok(iso.matches.includes("https://www.bilibili.com/*") && iso.matches.includes("https://www.youtube.com/*"), "内容脚本两个网站都跑");
  ok(iso.js.indexOf("sites.js") >= 0 && iso.js.indexOf("sites.js") < iso.js.indexOf("content.js"), "sites.js 在 content.js 前面");
  ok(["https://*.bilibili.com/*", "https://*.hdslb.com/*", "https://api.bilibili.com/*", "https://dict.youdao.com/*"].every(h => M.host_permissions.includes(h)), "权限");
  ok(!cs.find(c => c.js.includes("inject.js")).matches.some(m => /bilibili/.test(m)), "YouTube 的 inject.js 不在 B 站跑");
  // 网站后台：维基词典进了中转白名单
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const px = async u => (await W.fetch(new Request("https://x.test/api/px?u=" + encodeURIComponent(u), { method: "OPTIONS" }), {})).status;
  ok((await px("https://en.wiktionary.org/api/rest_v1/page/definition/run")) === 200, "中转：维基词典释义（OPTIONS）");
  const bad = await W.fetch(new Request("https://x.test/api/px?u=" + encodeURIComponent("https://en.wiktionary.org/wiki/run")), {});
  ok(bad.status === 403, "中转：维基词典别的页面不转 " + bad.status);

  console.log(fail ? "t51 FAILED " + fail : "t51 ok"); process.exit(fail ? 1 : 0);
})();
