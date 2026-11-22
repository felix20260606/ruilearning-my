// 「📻 BBC · VOA」新加的六个栏目：BBC 广播剧 / 大学英语，VOA 美国故事 / 词语故事 / 每日语法 / 慢速新闻
// 目录解析（故事按集排、同名去重、跳过只有视频的）、一期解析（没有 Transcript 标题的广播剧、http 和带空格的 mp3、「Next.」台词、「词 - 解释」生词、
// VOA 正文 / 生词表 / 署名不算台词 / <br> 分段 / 老地址 av.voanews.com）、离线下载和中转白名单放行 VOA 的 mp3
// 用假的 KV、假的 fetch 直接跑 web/_worker.js（Node 18+，不联网，不碰线上数据）
const path = require("path");
(async () => {
  const BBC = "https://www.bbc.co.uk/learningenglish/english/features/", VOA = "https://learningenglish.voanews.com";
  const bItem = (id, t, d, p) => '<li><div class="img"><a  href="/learningenglish/english/features/' + id + '"><img src="https://ichef.bbci.co.uk/images/ic/624xn/' + id.replace(/\W/g, "") + '.jpg" alt="" /></a></div><div class="text"><h2><a  href="/learningenglish/english/features/' + id + '">' + t + '</a></h2><div class="details"><h3><b>Episode x </b> / ' + d + "</h3>\n<p>" + p + "</p></div></div></li>";
  const vItem = (slug, n, t, d) => '<li><div class="media-block "><a href="/a/' + slug + "/" + n + '.html"  class="img-wrap img-wrap--t-spac img-wrap--size-3" title="' + t + '"><div class="thumb thumb16_9"><noscript class="nojs-img"><img src="https://gdb.voanews.com/' + n + '_w160_r1.png" alt="" /></noscript><img data-src="x" src="" alt="" /></div></a>\n<div class="media-block__content">\n<span class="date date--mb date--size-3" >' + d + '</span><a href="/a/' + slug + "/" + n + '.html" ><h4>' + t + "</h4></a></div></div></li>";
  const P = {
    [BBC + "drama"]: "<ul>" +
      bItem("drama/gulliver-ep2", "Gulliver&#039;s Travels: Part 2: The war", "09 Oct 2015", "Two") +
      bItem("drama/gulliver-ep1", "Gulliver&#039;s Travels: Part 1: Voyage to Lilliput", "02 Oct 2015", "One") +
      bItem("drama/carol-ep01", "A Christmas Carol - Part 1: Marley's ghost", "18 Dec 2015", "c1") +
      bItem("drama/carol-episode-01", "A Christmas Carol - Part 1: Marley's ghost", "18 Dec 2015", "c1 again") +
      bItem("drama/carol-ep05", "A Christmas Carol - ep 05 - The end of it", "22 Dec 2015", "c5") +
      bItem("drama/elephant-ep1", "The White Elephant: Episode 1: Panic!", "01 Jan 2019", "video only") + "</ul>",
    [BBC + "drama/gulliver-ep1"]: '<html><head><meta property="og:title" content="BBC Learning English - Drama / Gulliver&amp;#039;s Travels: Part 1: Voyage to Lilliput" /></head><body>' +
      "<h3>Gulliver's Travels: Part 1</h3><p>To play this audio you need to enable JavaScript.</p><p>Join us for the first episode.</p>" +
      "<p><strong>Narrator<br clear=\"none\" /></strong>Our story begins at sea.</p><p><strong>Gulliver</strong><br />Help! The ship is sinking!</p><p><strong>Narrator</strong><br />He swims to an island.</p><p><strong>Gulliver</strong><br />Where am I?</p><p><strong>Tiny voice</strong><br />Lilliput!</p><p><strong>Gulliver</strong><br />Next.</p>" +
      '<h3>Vocabulary</h3><p><strong>sinking</strong><br />going under the water</p><div class="mp3"><a class="download" href=" http://downloads.bbc.co.uk/learningenglish/drama/gulliver_ep1_download.mp3">Download Audio</a></div><h3>Latest Dramas</h3><p>Other</p></body></html>',
    [BBC + "english-at-university"]: "<ul>" + bItem("english-at-university/ep-170116", "18 - Emergency", "16 Jan 2017", "e18") + bItem("english-at-university/ep-170109", "17 - Take note", "09 Jan 2017", "e17") + bItem("english-at-university/ep-161010", "Episode 5 - Registration", "10 Oct 2016", "e5") + bItem("english-at-university/ep-160921", "Episode 1 - Leaving Home", "21 Sep 2016", "e1") + "</ul>",
    [BBC + "english-at-university/ep-161010"]: '<html><head><meta property="og:title" content="BBC Learning English - English at University / Episode 5 - Registration" /></head><body><p>To play this video you need to enable JavaScript.</p>' +
      "<h3>Vocabulary</h3><p>Words Mary found on some forms</p><p>D.o.B - date of birth</p><p>next of kin - your closest relative</p><p>nationality - the country you are a citizen of</p>" +
      "<h3>Transcript</h3><p><strong>Narrator</strong><br />It's time again for English at University.</p><p><strong>Sharon</strong><br />Next.</p><p><strong>Mary</strong><br />Oh, hello. I'm Mary.</p><p><strong>Sharon</strong><br />You've come to register?</p><p><strong>Mary</strong><br />I think so.</p><p><strong>Narrator</strong><br />Well done Mary.</p>" +
      '<h3>Next</h3><p>Episode 6</p><a href="https://downloads.bbc.co.uk/learningenglish/eau/ep5_download.mp3">mp3</a></body></html>',
    [VOA + "/z/1581"]: "<ul>" + vItem("open-boat-part-two", "7504521", "&#x27;The Open Boat&#x27; by Stephen Crane, Part Two", "March 14, 2025") + vItem("gift-of-the-magi", "3333333", "The Gift of the Magi", "January 02, 2025") + vItem("open-boat-part-one", "2572601", "&#x27;The Open Boat&#x27; by Stephen Crane, Part One", "March 07, 2025") + "</ul>",
    [VOA + "/z/1581?p=1"]: "<ul>" + vItem("rappaccini-two", "2615957", "&#x27;Rappaccini’s Daughter&#x27; by Nathaniel Hawthorne, Part Two", "February 28, 2025") + vItem("rappaccini-one", "2600030", "Rappaccini’s Daughter by Nathaniel Hawthorne, Part One", "February 21, 2025") + "</ul>",
    [VOA + "/a/7504521.html"]: '<html><head><meta content="&#x27;The Open Boat&#x27; by Stephen Crane, Part Two" property="og:title"></meta><meta content="The men try to reach the shore." property="og:description"></meta></head><body>' +
      '<div class="wsw"><p>​</p><div class="wsw__embed"><audio><source src="https://voa-audio.voanews.eu/vle/2025/03/14/abc.mp3" /><source src="https://voa-audio.voanews.eu/vle/2025/03/14/abc_hq.mp3" /></audio><p class="ta-c">No media source currently available</p></div>' +
      "<p>Today we finish our story “The Open Boat.”</p><p>The four men sailed toward the shore. The waves were high.</p><p><em>“We must swim,” said the captain.</em></p><p>The cook could not swim well.</p><p>At last they reached the beach.</p><p>I’m Kay Gallant.</p>" +
      "<p><em>This story was adapted for VOA Learning English by Dana Demange.</em></p><p><strong>________________________________________________</strong></p>" +
      '<h2 class="wsw__h2"><strong>Words in This Story</strong></h2><p><strong>shore </strong><em>–n.</em> the land along the edge of the sea</p><p><strong>wave </strong><em>–n.</em> a moving ridge of water</p>' +
      "<h2><strong>Now it's your turn</strong></h2><p>Write a sentence in the comments.</p></div><div id=\"comments\"><p>Forum stuff</p></div></body></html>",
    [VOA + "/a/2615957.html"]: '<html><head><meta content="Rappaccini’s Daughter, Part Two" property="og:title"></meta></head><body><div class="wsw"><audio><source src="http://av.voanews.com/Videoroot/Archive/media/VOA_LearningEnglish/129/771/rap-2.mp3" /></audio>' +
      "<p>Today, we complete the story.<br /><br />Many years ago, a young man left his home.<br />He took a room in an old house.<br /><br />The garden was full of strange flowers.<br />A beautiful girl lived there.<br />Her father was a doctor.<br /><br />I’m Kay Gallant.</p>" +
      "<p>_______________________________________________________</p><p>Download a lesson plan with activities for this story.</p><p>_______________________</p><p>sparkle - v. to be or become bright and lively</p><p>scream - v. to suddenly cry out in a loud voice</p><p>Now it's your turn. Use one of the words in a sentence.</p></div><div id=\"comments\"></div></body></html>",
  };
  let calls = [];
  globalThis.fetch = async (u, o) => { u = String(u); calls.push(u); if (P[u]) return new Response(P[u], { headers: { "content-type": "text/html" } }); if (/\.mp3$/.test(u)) return new Response(new Uint8Array(100), { headers: { "content-type": "audio/mpeg", "content-length": "100" } }); return new Response("<html></html>", { status: /\/z\/1581\?p=/.test(u) ? 200 : 404 }); };
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map(), opts = {};
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v, o) => { kv.set(k, String(v)); opts[k] = o; }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
  const env = { CAPTIONS: KV };
  const call = async (p, init) => { const r = await W.fetch(new Request("https://x.test" + p, init), env); const ct = r.headers.get("content-type") || ""; return { status: r.status, j: /json/.test(ct) ? await r.json() : null, r }; };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

  // ---- BBC 广播剧：目录 ----
  let r = await call("/api/sme?s=drama");
  const ids = (r.j.list || []).map(x => x.id);
  ok(r.j.ok && !ids.includes("drama/elephant-ep1"), "只有视频的 White Elephant 不进列表 " + JSON.stringify(ids));
  ok(!ids.includes("drama/carol-episode-01") && ids.includes("drama/carol-ep01"), "同一集两个地址：按标题去重 " + JSON.stringify(ids));
  ok(JSON.stringify(ids) === JSON.stringify(["drama/carol-ep01", "drama/carol-ep05", "drama/gulliver-ep1", "drama/gulliver-ep2"]), "故事之间新的在前、故事里从第 1 集起（「ep 05」也认） " + JSON.stringify(ids));
  ok(r.j.list[2].t === "Gulliver's Travels: Part 1: Voyage to Lilliput", "标题里的 &#039; " + r.j.list[2].t);
  ok(opts["sme/list/drama"].expirationTtl === 7 * 86400, "不更新的栏目目录存一周");
  // ---- 广播剧一期：没有 Transcript 标题、mp3 是 http 且 href 前面有空格、<br clear="none"> ----
  r = await call("/api/sme?ep=drama/gulliver-ep1");
  ok(r.j.ok && r.j.mp3 === "https://downloads.bbc.co.uk/learningenglish/drama/gulliver_ep1_download.mp3", "mp3 改成 https " + r.j.mp3);
  ok(r.j.title === "Gulliver's Travels: Part 1: Voyage to Lilliput", "标题 " + r.j.title);
  ok(r.j.intro === "Join us for the first episode.", "简介 = 播放器和第一句台词之间 " + r.j.intro);
  ok(r.j.lines.length === 6 && r.j.lines[0].who === "Narrator" && r.j.lines[0].t === "Our story begins at sea." && r.j.lines[5].t === "Next.", "台词按说话人分行 " + JSON.stringify(r.j.lines));
  ok(JSON.stringify(r.j.vocab) === JSON.stringify([["sinking", "going under the water"]]), "生词 " + JSON.stringify(r.j.vocab));
  r = await call("/api/sme?s=eau");
  ok(JSON.stringify((r.j.list || []).map(x => x.t)) === JSON.stringify(["Episode 1 - Leaving Home", "Episode 5 - Registration", "17 - Take note", "18 - Emergency"]), "大学英语从第 1 集起（后几集标题没有 Episode） " + JSON.stringify((r.j.list || []).map(x => x.t)));
  // ---- 大学英语：「Next.」是台词，不是页面结尾；生词是「词 - 解释」一行 ----
  r = await call("/api/sme?ep=english-at-university/ep-161010");
  ok(r.j.ok && r.j.lines.length === 6 && r.j.lines[1].t === "Next." && r.j.lines[5].who === "Narrator", "「Next.」不截断文稿 " + JSON.stringify(r.j.lines));
  ok(JSON.stringify(r.j.vocab) === JSON.stringify([["D.o.B", "date of birth"], ["next of kin", "your closest relative"], ["nationality", "the country you are a citizen of"]]), "「词 - 解释」 " + JSON.stringify(r.j.vocab));

  // ---- VOA 美国故事：目录（两页、故事按集排、Part One 在 Part Two 前面，引号不同也算同一个故事） ----
  r = await call("/api/sme?s=vst");
  const vt = (r.j.list || []).map(x => x.id);
  ok(r.j.ok && JSON.stringify(vt) === JSON.stringify(["vst/2572601", "vst/7504521", "vst/2600030", "vst/2615957", "vst/3333333"]), "VOA 故事排序 " + JSON.stringify(vt));
  ok(r.j.list[0].t === "'The Open Boat' by Stephen Crane, Part One" && r.j.list[0].d === "March 07, 2025" && r.j.list[0].img === "https://gdb.voanews.com/2572601_w320_r1.png", "VOA 目录项 " + JSON.stringify(r.j.list[0]));
  ok(calls.filter(u => u.startsWith(VOA + "/z/1581")).length === 5, "VOA 目录取 5 页");
  // ---- VOA 一期 ----
  r = await call("/api/sme?ep=vst/7504521");
  ok(r.j.ok && r.j.mp3 === "https://voa-audio.voanews.eu/vle/2025/03/14/abc_hq.mp3", "VOA mp3 用高音质 " + r.j.mp3);
  ok(r.j.title === "'The Open Boat' by Stephen Crane, Part Two" && r.j.intro === "The men try to reach the shore.", "VOA 标题简介 " + r.j.title + " / " + r.j.intro);
  ok(r.j.lines.length === 6 && r.j.lines[0].t === "Today we finish our story “The Open Boat.”" && r.j.lines[5].t === "I’m Kay Gallant." && !r.j.lines.some(l => /adapted|No media|Forum|comments/.test(l.t)), "VOA 正文（署名、播放器提示、讨论区不算） " + JSON.stringify(r.j.lines));
  ok(JSON.stringify(r.j.vocab) === JSON.stringify([["shore", "n. the land along the edge of the sea"], ["wave", "n. a moving ridge of water"]]), "VOA 生词表 " + JSON.stringify(r.j.vocab));
  ok(kv.get("sme/ep/vst/7504521") && JSON.parse(kv.get("sme/ep/vst/7504521")).s === "vst", "存 KV");
  // 老文章：整篇在一个 <p> 里用 <br> 分段；mp3 是 av.voanews.com 的 http 地址；生词是纯文字「词 - v. 解释」
  r = await call("/api/sme?ep=vst/2615957");
  ok(r.j.ok && r.j.mp3 === "https://voa-video.voanews.eu/Archive/media/VOA_LearningEnglish/129/771/rap-2.mp3", "老 mp3 地址换成 voa-video.voanews.eu " + r.j.mp3);
  ok(r.j.lines.length === 7 && r.j.lines[1].t === "Many years ago, a young man left his home." && r.j.lines[6].t === "I’m Kay Gallant.", "<br> 分段 " + JSON.stringify(r.j.lines));
  ok(JSON.stringify(r.j.vocab) === JSON.stringify([["sparkle", "v. to be or become bright and lively"], ["scream", "v. to suddenly cry out in a loud voice"]]), "纯文字生词 " + JSON.stringify(r.j.vocab));
  // 坏期号
  r = await call("/api/sme?ep=vst/abc"); ok(r.status === 400, "坏期号 400");
  r = await call("/api/sme?ep=" + encodeURIComponent("drama/../../x")); ok(r.status === 400, "广播剧期号只认字母数字横线");
  // ---- 离线下载转 VOA 的 mp3；中转白名单 ----
  r = await call("/api/sme?mp3=vst/7504521"); ok(r.status === 200 && r.r.headers.get("content-type") === "audio/mpeg", "离线下载转 VOA mp3 " + r.status);
  r = await call("/api/px?u=" + encodeURIComponent("https://voa-audio.voanews.eu/vle/2025/03/14/abc_hq.mp3")); ok(r.status === 200, "中转放行 voa-audio " + r.status);
  r = await call("/api/px?u=" + encodeURIComponent("https://gdb.voanews.com/2572601_w320_r1.png")); ok(r.status !== 403, "中转放行 gdb 图片 " + r.status);
  r = await call("/api/px?u=" + encodeURIComponent("https://learningenglish.voanews.com/a/1.html")); ok(r.status === 403, "VOA 网页本身不转 " + r.status);

  console.log(fail ? "t56 FAILED " + fail : "t56 ok"); process.exit(fail ? 1 : 0);
})();
