// 今日新闻 /api/news：从假的 RSS 里按日期挑一篇（跳过视频、太短的、太旧的），去掉重复的标题段，存 KV「news/日期」，第二次直接用缓存；list 是其它头条
// 用假的 KV、假的 fetch、简化的 HTMLRewriter 直接跑 web/_worker.js（Node 18+，不联网，不碰线上数据）
const path = require("path");
(async () => {
  // 简化版 HTMLRewriter：只认 <title> 和 <p>（够 extractArticle 用）
  globalThis.HTMLRewriter = class {
    constructor() { this.h = []; }
    on(sel, h) { this.h.push([sel, h]); return this; }
    transform(res) {
      const H = this.h;
      return { arrayBuffer: async () => {
        const html = await res.text();
        for (const [sel, h] of H) {
          if (sel === "title") { const m = html.match(/<title>([\s\S]*?)<\/title>/); if (m && h.text) h.text({ text: m[1] }); }
          if (/^p,/.test(sel)) for (const m of html.matchAll(/<p>([\s\S]*?)<\/p>/g)) { const end = []; h.element({ tagName: "p", getAttribute: () => null, onEndTag: f => end.push(f) }); h.text({ text: m[1] }); end.forEach(f => f()); }
        }
        return new ArrayBuffer(0);
      } };
    }
  };
  const now = Date.now(), pd = t => new Date(t).toUTCString();
  const words = n => Array.from({ length: n }, (_, i) => "word" + (i % 50)).join(" ") + ".";
  const ARTS = {
    "https://www.bbc.co.uk/news/articles/long1": "<title>Long one</title><p>Long one headline here</p><p>" + words(200) + "</p><p>" + words(200) + "</p>",
    "https://www.bbc.co.uk/news/articles/short1": "<title>Short</title><p>" + words(60) + "</p>",
    "https://www.theguardian.com/world/2026/nov/20/g1": "<title>G1</title><p>" + words(150) + "</p><p>" + words(150) + "</p>",
    "https://www.npr.org/2026/11/20/n1": "<title>N1</title><p>" + words(300) + "</p>",
  };
  const rss = items => '<?xml version="1.0"?><rss><channel>' + items.map(([t, u, ago]) => "<item><title><![CDATA[" + t + "]]></title><link>" + u + "</link><pubDate>" + pd(now - ago * 3600e3) + "</pubDate></item>").join("") + "</channel></rss>";
  let calls = 0;
  globalThis.fetch = async (u) => {
    u = String(u); calls++;
    if (/feeds\.bbci\.co\.uk\/news\/world/.test(u)) return new Response(rss([["Long one", "https://www.bbc.co.uk/news/articles/long1?at_medium=RSS&amp;at_campaign=rss", 3], ["Short one", "https://www.bbc.co.uk/news/articles/short1", 2], ["A video", "https://www.bbc.co.uk/news/videos/v1", 1], ["Old news", "https://www.bbc.co.uk/news/articles/old", 24 * 10]]), { headers: { "content-type": "application/rss+xml" } });
    if (/theguardian\.com\/world\/rss/.test(u)) return new Response(rss([["G one", "https://www.theguardian.com/world/2026/nov/20/g1", 5]]));
    if (/feeds\.npr\.org/.test(u)) return new Response(rss([["N one", "https://www.npr.org/2026/11/20/n1", 4], ["Long one", "https://www.bbc.co.uk/news/articles/long1", 3]]));
    const a = ARTS[u.replace(/\?.*$/, "")]; if (a) return new Response("<html>" + a + "</html>", { headers: { "content-type": "text/html; charset=utf-8" } });
    if (/rss|feeds/.test(u)) return new Response("<rss></rss>");
    return new Response("nope", { status: 404 });
  };
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v, o) => { kv.set(k, String(v)); KV.lastOpt = o; }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
  const env = { CAPTIONS: KV };
  const call = async p => { const r = await W.fetch(new Request("https://x.test" + p), env); return { status: r.status, j: await r.json() }; };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

  // 日期都按现在往前推（后台只认最近 30 天的日期，写死的日期过一个月就会被当成今天）：D1 = 北京时间昨天
  const bjAgo = k => new Date(Date.now() + 8 * 3600e3 - k * 86400e3).toISOString().slice(0, 10), D1 = bjAgo(1);
  let r = await call("/api/news?d=" + D1);
  ok(r.j.ok, "news ok " + JSON.stringify(r.j).slice(0, 200));
  ok(["https://www.bbc.co.uk/news/articles/long1", "https://www.theguardian.com/world/2026/nov/20/g1", "https://www.npr.org/2026/11/20/n1"].includes(r.j.url), "picked a long article, got " + r.j.url);
  ok(r.j.words >= 250, "words >= 250: " + r.j.words);
  ok(!/headline here/.test(r.j.text), "headline-like first paragraph dropped");
  ok(!r.j.list.some(x => x.u === r.j.url), "list excludes pick");
  ok(!r.j.list.some(x => /videos|\/old$/.test(x.u)), "no video / old items in list " + JSON.stringify(r.j.list.map(x => x.u)));
  ok(r.j.list.filter(x => /long1/.test(x.u)).length + (/long1/.test(r.j.url) ? 1 : 0) === 1, "duplicate (same title from NPR) removed");
  ok(!r.j.list.concat([{ u: r.j.url }]).some(x => /at_medium/.test(x.u)), "BBC tracking query stripped");
  ok(kv.has("news/" + D1) && KV.lastOpt && KV.lastOpt.expirationTtl === 3 * 86400, "cached 3 days");
  const pick1 = r.j.url, c1 = calls;
  r = await call("/api/news?d=" + D1); ok(r.j.url === pick1 && calls === c1, "second call served from cache");
  r = await call("/api/news?d=" + D1 + "&fresh=1"); ok(r.j.ok && r.j.url === pick1 && calls > c1, "fresh re-picks deterministically for the same date");
  r = await call("/api/news?d=bad"); ok(r.j.ok && /^\d{4}-\d{2}-\d{2}$/.test(r.j.date), "bad date falls back to today");
  // readurl 还是原样工作（拆成 extractArticle 之后）
  r = await call("/api/readurl?url=" + encodeURIComponent("https://www.npr.org/2026/11/20/n1")); ok(r.j.ok && r.j.text.split(/\s+/).length >= 300 && r.j.title === "N1", "readurl ok");
  r = await call("/api/readurl?url=" + encodeURIComponent("https://www.bbc.co.uk/news/articles/nothing")); ok(r.status === 502 && !r.j.ok, "readurl 404 → 502");
  r = await call("/api/readurl?url=ftp%3A%2F%2Fx"); ok(r.status === 400, "readurl bad url 400");
  // 所有源都挂了
  globalThis.fetch = async () => new Response("", { status: 500 });
  // 用一个不会是「今天」的日期：上面「bad date → 今天」那次已经把今天的缓存好了（以前写死 2026-11-22，到了 11 月 22 日这天就撞上，测试就一直失败）
  // 后台只认最近 30 天的日期（再早的当今天），所以用「北京时间前天」：上面没缓存过
  // 前天：上面只缓存过昨天（D1）和今天
  const d2 = bjAgo(2);
  r = await call("/api/news?d=" + d2); ok(r.status === 502 && !r.j.ok && !kv.has("news/" + d2), "no feeds → 502, not cached");
  const n0 = kv.size; r = await call("/api/news?d=2000-01-01"); ok(kv.size === n0 && !kv.has("news/2000-01-01"), "old date not stored as its own key");
  console.log(fail ? "t46 FAILED" : "t46 ok");
  process.exit(fail ? 1 : 0);
})();
