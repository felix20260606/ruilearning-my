// 每日听力 /api/sme（BBC Learning English 四个栏目）：目录页解析、每期页面解析（简介 / 本期问题 / 新闻标题 / 生词表 / 按说话人分行的文稿 / mp3）、中文对照 zh=1、KV 缓存、坏参数
// 用假的 KV、假的 fetch 直接跑 web/_worker.js（Node 18+，不联网，不碰线上数据）
const path = require("path");
(async () => {
  const BASE = "https://www.bbc.co.uk/learningenglish/english/features/";
  const item = (id, img, t, d, p) => '<div class="img"><a  href="/learningenglish/english/features/' + id + '"><img src="' + img + '" alt="" /></a></div><div class="text"><h2><a  href="/learningenglish/english/features/' + id + '">' + t + '</a></h2><div class="details"><h3><b>Episode x</b> / ' + d + '</h3>\n<p>' + p + "</p></div></div>";
  const y = +new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 4);
  const IDX = {
    [BASE + "6-minute-english_" + y]: "<html>" + item("6-minute-english_" + y + "/ep-" + String(y).slice(2) + "1119", "https://img/1.jpg", "Are microplastics harming us?", "19 Nov " + y, "What&#39;s the last plastic thing you used?") + item("6-minute-english_" + y + "/ep-" + String(y).slice(2) + "1112", "https://img/2.jpg", "Learning &amp; ageing", "12 Nov " + y, "Mixing generations") + "</html>",
    [BASE + "6-minute-english_" + (y - 1)]: "<html>" + item("6-minute-english_" + (y - 1) + "/ep-" + String(y - 1).slice(2) + "1225", "https://img/3.jpg", "Was Christmas better?", "25 Dec " + (y - 1), "Nostalgia") + "</html>",
  };
  const EP = '<html><head><meta property="og:title" content="BBC Learning English - 6 Minute English / Are microplastics harming us?" /></head><body>' +
    '<h3>Introduction</h3><p>How much plastic do you use?</p><p>Becca and Phil discuss this.</p>' +
    "<h3>This week's question</h3><p>How long would it take?<br />a) 13,000 years<br />b) 23,000 years<br />Listen to the programme to hear the answer.</p>" +
    '<h3>Vocabulary</h3><p><strong>marine</strong><br />related to the sea</p><p><strong>spike</strong><br />sudden, sharp increase</p>' +
    '<p><strong>TRANSCRIPT</strong></p><p class="p2">Note: This is not a word-for-word transcript.&nbsp;</p>' +
    "<p><strong>Phil</strong><br />Hi Becca.<br />&nbsp;<br /><strong>Becca</strong><br />Hi Phil.<br />&nbsp;<br /><strong>Phil</strong><br />Microplastics &ndash; tiny pieces.<br />&nbsp;<br /><strong>Professor Mark Miodownik</strong><br />We are exposed.<br />&nbsp;<br /><strong>Becca</strong><br /><strong>A spike</strong> is a sudden, sharp increase.<br />&nbsp;<br /><strong>Phil</strong><br />Bye!</p>" +
    '<div class="widget-pagelink-download-inner bbcle-download-linkparent-extension-mp3"><a class="download" href="https://downloads.bbc.co.uk/learningenglish/features/6min/x_download.mp3">Download Audio</a></div><h3>Next</h3><p>Other stuff here</p></body></html>';
  let calls = 0;
  globalThis.fetch = async u => { u = String(u); calls++; if (IDX[u]) return new Response(IDX[u], { headers: { "content-type": "text/html" } }); if (u === BASE + "6-minute-english_" + y + "/ep-" + String(y).slice(2) + "1119") return new Response(EP, { headers: { "content-type": "text/html" } }); return new Response("no", { status: 404 }); };
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map(), opts = {};
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v, o) => { kv.set(k, String(v)); opts[k] = o; }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
  const env = { CAPTIONS: KV };
  const call = async p => { const r = await W.fetch(new Request("https://x.test" + p), env); return { status: r.status, j: await r.json() }; };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

  let r = await call("/api/sme");
  ok(r.j.ok && r.j.list.length === 3, "list " + JSON.stringify(r.j).slice(0, 300));
  ok(r.j.list[0].t === "Are microplastics harming us?" && r.j.list[0].d === "19 Nov " + y && r.j.list[0].p === "What's the last plastic thing you used?" && r.j.list[0].img === "https://img/1.jpg", "first item " + JSON.stringify(r.j.list[0]));
  ok(r.j.list[1].t === "Learning & ageing" && r.j.list[2].id.includes(String(y - 1)), "entities + previous year");
  ok(kv.has("sme/list") && opts["sme/list"].expirationTtl === 2 * 86400 && JSON.parse(kv.get("sme/list")).at > 0, "list stored with its fetch time (refreshed in the background after 3h)");
  const c1 = calls; r = await call("/api/sme"); ok(r.j.ok && calls === c1, "list from cache");

  const id = r.j.list[0].id;
  r = await call("/api/sme?ep=" + encodeURIComponent(id));
  ok(r.j.ok && r.j.title === "Are microplastics harming us?", "ep title " + r.j.title);
  ok(r.j.mp3 === "https://downloads.bbc.co.uk/learningenglish/features/6min/x_download.mp3", "mp3");
  ok(r.j.intro === "How much plastic do you use? Becca and Phil discuss this.", "intro " + r.j.intro);
  ok(JSON.stringify(r.j.q) === JSON.stringify(["How long would it take?", "a) 13,000 years", "b) 23,000 years"]), "question " + JSON.stringify(r.j.q));
  ok(JSON.stringify(r.j.vocab) === JSON.stringify([["marine", "related to the sea"], ["spike", "sudden, sharp increase"]]), "vocab " + JSON.stringify(r.j.vocab));
  ok(r.j.lines.length === 6 && r.j.lines[0].who === "Phil" && r.j.lines[1].who === "Becca" && r.j.lines[2].t === "Microplastics – tiny pieces." && r.j.lines[3].who === "Professor Mark Miodownik", "transcript " + JSON.stringify(r.j.lines));
  ok(r.j.lines[4].who === "Becca" && r.j.lines[4].t === "A spike is a sudden, sharp increase.", "inline bold kept in sentence " + JSON.stringify(r.j.lines[4]));
  ok(!r.j.lines.some(l => /Other stuff|Note:/.test(l.t)), "stops at Next, drops note");
  ok(kv.has("sme/ep/" + id) && opts["sme/ep/" + id].expirationTtl === 90 * 86400, "episode cached 90 days");
  r = await call("/api/sme?ep=" + encodeURIComponent("../../etc")); ok(r.status === 400, "bad ep 400");
  r = await call("/api/sme?ep=" + encodeURIComponent("6-minute-english_" + y + "/ep-000000")); ok(r.status === 502 && !kv.has("sme/ep/6-minute-english_" + y + "/ep-000000"), "missing ep 502 not cached");
  // mine 接受 daily / sme 两种新集合
  r = await (async () => { const q = await W.fetch(new Request("https://x.test/api/mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ k: "sme", changes: { [id]: { v: 123, at: 5 } } }) }), env); return q.json(); })();
  ok(r.ok && r.items[id].v === 123, "mine k=sme");
  r = await (async () => { const q = await W.fetch(new Request("https://x.test/api/mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ k: "daily", changes: { "day:2026-11-21": { v: [3, 5], at: 6 } } }) }), env); return q.json(); })();
  ok(r.ok && r.items["day:2026-11-21"].v[0] === 3, "mine k=daily");
  // ---- 另外三个栏目：Real Easy English（不分年份）、The English We Speak（「<strong>名字<br /></strong>」）、Learning English from the News（没有文稿：新闻背景 + 标题 + 关键词带例句）----
  const ITEM2 = (id, t) => '<div class="img"><a  href="/learningenglish/english/features/' + id + '"><img src="https://img/x.jpg" alt="" /></a></div><div class="text"><h2><a  href="/learningenglish/english/features/' + id + '">' + t + ' </a></h2><div class="details"><h3><b>Episode 1 </b> / 20 Nov ' + y + "</h3>\n<p>Intro</p></div></div>";
  IDX[BASE + "real-easy-english"] = "<html>" + ITEM2("real-easy-english/" + String(y).slice(2) + "1113", "Older") + ITEM2("real-easy-english/" + String(y).slice(2) + "1120", "Embarrassing moments") + "</html>";
  IDX[BASE + "the-english-we-speak_" + y] = "<html>" + ITEM2("the-english-we-speak_" + y + "/ep-" + String(y).slice(2) + "1116", "In for a treat") + "</html>";
  const TEWS = '<html><head><meta property="og:title" content="BBC Learning English - The English We Speak / In for a treat " /></head><body><h3><strong>Introduction</strong></h3><p>You are in for a treat!</p><p><strong style="font-size: 1.17em;">Transcript</strong></p>' +
    "<p><strong>Feifei<br /></strong>Hello and welcome.</p><p><strong>Georgie<br /></strong>Hi Feifei. That&#39;s a cake.</p><p><strong>Feifei<br /></strong>You are in for a treat.</p><p><strong>Examples<br /></strong>You&#39;re in for a treat!</p><p>That&#39;ll be &pound;25.</p><p><strong>Georgie<br /></strong>Bye!</p>" +
    '<a href="https://downloads.bbc.co.uk/learningenglish/features/tews/x_download.mp3">Download</a><p><strong style="font-size: 1.17em;">Next</strong></p><p>Other</p></body></html>';
  const LEFTN = '<html><head><meta property="og:title" content="BBC Learning English - Learning English from the News / AI exam cheat confesses" /></head><body><p><strong style="font-size: 1.17em;">The story</strong></p><p>A student admitted cheating.</p><p>New measures follow.</p>' +
    "<h3>News headlines&nbsp;</h3><p><strong>Not adding up</strong>: Student admits using AI<br /><strong>RTE</strong></p><p>Korea tightens checks to <strong>screen</strong> for cameras<br /><strong>US News</strong></p>" +
    "<h3><strong>Key words and phrases</strong></h3><p><strong>doesn't add up<br /></strong>doesn't seem true</p><ul><li>Something <strong>doesn't add up</strong>.</li></ul><p><strong>screen</strong><br />check for problems</p><ul><li>They <strong>screened</strong> the bags.</li></ul>" +
    '<a href="https://downloads.bbc.co.uk/learningenglish/features/LEFTN/x_download.mp3">mp3</a><p>Note: This podcast uses the wrong name.</p><p><strong style="font-size: 1.17em;">Next</strong></p></body></html>';
  const tewsId = "the-english-we-speak_" + y + "/ep-" + String(y).slice(2) + "1116", newsId = "learning-english-from-the-news_" + y + "/" + String(y).slice(2) + "1118";
  const F0 = globalThis.fetch; let tq = [];
  globalThis.fetch = async u => { u = String(u); if (u === BASE + tewsId) return new Response(TEWS); if (u === BASE + newsId) return new Response(LEFTN); if (/translate_a/.test(u)) { const q = new URL(u).searchParams.get("q"); tq.push(q); return new Response(JSON.stringify({ sentences: [{ trans: q.split("\n").map(x => "中:" + x).join("\n") }] })); } return F0(u); };
  r = await call("/api/sme?s=ree"); ok(r.j.ok && r.j.s === "ree" && r.j.list.length === 2 && r.j.list[0].t === "Embarrassing moments" && /1120$/.test(r.j.list[0].id), "ree list newest first " + JSON.stringify(r.j).slice(0, 200));
  ok(kv.has("sme/list/ree"), "ree list cached under its own key");
  r = await call("/api/sme?s=tews"); ok(r.j.ok && r.j.list.length === 1 && r.j.list[0].t === "In for a treat", "tews list");
  r = await call("/api/sme?s=nope"); ok(r.status === 400, "bad series 400");
  r = await call("/api/sme?ep=" + encodeURIComponent(tewsId));
  ok(r.j.ok && r.j.s === "tews" && r.j.title === "In for a treat" && r.j.intro === "You are in for a treat!", "tews ep " + JSON.stringify(r.j).slice(0, 300));
  ok(r.j.lines.length === 6 && r.j.lines[0].who === "Feifei" && r.j.lines[1].t === "Hi Feifei. That's a cake." && r.j.lines[3].who === "Examples" && r.j.lines[4].who === "Examples" && r.j.lines[4].t === "That'll be £25." && r.j.lines[5].who === "Georgie", "tews speakers <strong>name<br></strong> " + JSON.stringify(r.j.lines));
  r = await call("/api/sme?ep=" + encodeURIComponent(newsId));
  ok(r.j.ok && r.j.s === "news" && r.j.lines.length === 0 && r.j.intro === "A student admitted cheating. New measures follow.", "news story as intro " + JSON.stringify(r.j).slice(0, 300));
  ok(JSON.stringify(r.j.heads) === JSON.stringify([["Not adding up: Student admits using AI", "RTE"], ["Korea tightens checks to screen for cameras", "US News"]]), "news headlines " + JSON.stringify(r.j.heads));
  ok(JSON.stringify(r.j.vocab) === JSON.stringify([["doesn't add up", "doesn't seem true", "Something doesn't add up."], ["screen", "check for problems", "They screened the bags."]]), "news key words with example " + JSON.stringify(r.j.vocab));
  // 中文：和英文一一对应，存 KV
  r = await call("/api/sme?zh=1&ep=" + encodeURIComponent(tewsId));
  ok(r.j.ok && r.j.intro === "中:You are in for a treat!" && r.j.lines.length === 6 && r.j.lines[5] === "中:Bye!" && r.j.lines[4] === "中:That'll be £25.", "tews zh aligned " + JSON.stringify(r.j));
  ok(kv.has("sme/zh/" + tewsId) && opts["sme/zh/" + tewsId].expirationTtl === 180 * 86400, "zh cached 180 days");
  const n0 = tq.length; r = await call("/api/sme?zh=1&ep=" + encodeURIComponent(tewsId)); ok(r.j.ok && tq.length === n0, "zh from cache");
  r = await call("/api/sme?zh=1&ep=" + encodeURIComponent(newsId));
  ok(r.j.ok && r.j.heads[1] === "中:Korea tightens checks to screen for cameras" && r.j.vocab[0] === "中:doesn't seem true" && r.j.vex[1] === "中:They screened the bags.", "news zh " + JSON.stringify(r.j));
  // 谷歌那边行数对不上：拆小再翻，还是每句都有中文
  globalThis.fetch = async u => { u = String(u); if (/translate_a/.test(u)) { const q = new URL(u).searchParams.get("q"); return new Response(JSON.stringify({ sentences: [{ trans: q.includes("\n") ? "乱成一行" : "中:" + q }] })); } return F0(u); };
  kv.delete("sme/zh/" + tewsId); r = await call("/api/sme?zh=1&ep=" + encodeURIComponent(tewsId));
  ok(r.j.ok && r.j.lines.every((x, i) => x === "中:" + ["Hello and welcome.", "Hi Feifei. That's a cake.", "You are in for a treat.", "You're in for a treat!", "That'll be £25.", "Bye!"][i]), "zh split fallback " + JSON.stringify(r.j.lines));
  // 翻译全失败：502，不存
  globalThis.fetch = async u => { u = String(u); if (/translate|mymemory/.test(u)) return new Response("x", { status: 500 }); return F0(u); };
  kv.delete("sme/zh/" + tewsId); r = await call("/api/sme?zh=1&ep=" + encodeURIComponent(tewsId)); ok(r.status === 502 && !kv.has("sme/zh/" + tewsId), "zh fail 502 not cached");
  console.log(fail ? "t48 FAILED" : "t48 ok");
  process.exit(fail ? 1 : 0);
})();
