// 📻 听力节目列表及时更新：后台先给缓存、过了 2–3 小时在后台重新抓；BBC 每周的按页面日期排（期号不一定对）；网页 30 分钟后再问一次
const fs = require("fs"), path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map(), waits = [];
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => kv.delete(k), list: async () => ({ keys: [], list_complete: true }) };
  // 旧的缓存（4 小时前抓的）：马上返回旧的，同时后台重新抓
  kv.set("sme/list/ree", JSON.stringify({ ok: true, s: "ree", at: Date.now() - 4 * 3600e3, list: [{ id: "real-easy-english/261113", t: "old", d: "13 Nov 2026" }] }));
  const item = (id, t, d) => '<a href="/learningenglish/english/features/real-easy-english/' + id + '"><img src="x.jpg"></a><h2><a href="#">' + t + "</a></h2><h3>Episode " + id + " / " + d + "</h3><p>desc</p>";
  const page = item("261120", "New one", "20 Nov 2026") + item("261113", "Old", "13 Nov 2026");
  const of = globalThis.fetch; let fetched = 0; globalThis.fetch = async () => { fetched++; return new Response(page, { status: 200 }); };
  let r = await W.fetch(new Request("https://x.test/api/sme?s=ree"), { CAPTIONS: KV }, { waitUntil: p => waits.push(p) }); let j = await r.json();
  ok(j.list[0].t === "old" && waits.length === 1, "stale list returned at once, refresh started in background");
  await Promise.all(waits); const after = JSON.parse(kv.get("sme/list/ree"));
  ok(fetched > 0 && after.at > Date.now() - 60e3 && after.list[0].t === "New one", "background refresh stored a new list (" + after.list.map(x => x.t) + ")");
  waits.length = 0; r = await W.fetch(new Request("https://x.test/api/sme?s=ree"), { CAPTIONS: KV }, { waitUntil: p => waits.push(p) });
  ok(!waits.length, "fresh list: no refetch");
  globalThis.fetch = of;
  const src = fs.readFileSync(path.join(__dirname, "..", "web", "_worker.js"), "utf8");
  ok(/Date\.parse\(q\.d\) \|\| 0\) - \(Date\.parse\(p\.d\) \|\| 0\) \|\| idk\(q\)/.test(src), "BBC weekly lists sorted by page date");
  ok(/hit\.at < 2 \* 3600e3\) return hit\.arts/.test(src), "BNE article index cached 2h");
  const L = fs.readFileSync(path.join(__dirname, "..", "web", "listen.js"), "utf8");
  ok(/Date\.now\(\) - \(LAT\[s\] \|\| 0\) < 30 \* 60e3/.test(L), "page re-asks after 30 minutes");
  console.log(fail ? fail + " FAILED" : "t78 listen fresh: all ok"); process.exit(fail ? 1 : 0);
})();
