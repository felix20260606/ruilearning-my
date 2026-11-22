// 🇩🇪 /api/dw（德国之声慢速德语新闻：列表、文稿、中文、Whisper 德语对时间）和 /api/stt?lang=de
// 用假的 KV、假的 AI、假的外网（fetch 换成本地小网页）直接跑 web/_worker.js；不联网
const path = require("path");
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default;
  const kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [] }) };
  const ai = [];
  const env = { CAPTIONS: KV, AI: { run: async (m, o) => { ai.push([m, o]); if (/whisper/.test(m)) return { text: "Guten Morgen", segments: [{ start: 0, end: 1, text: "Guten Morgen", words: [{ word: "Guten", start: 0, end: 0.4 }, { word: "Morgen", start: 0.4, end: 1 }] }] }; return { response: "{}" }; } } };
  const MP3 = "https://radiodownloaddw-a.akamaihd.net/Events/dwelle/dira/mp3/deutschkurse/langsamenachrichten/ABC_2.mp3";
  const LIST = '<a href="/de/12112026-langsam-gesprochene-nachrichten/a-79926623">x</a><a href="/de/13112026-langsam-gesprochene-nachrichten/a-79930000">y</a><a href="/de/12112026-langsam-gesprochene-nachrichten/a-79926623">dup</a><a href="/de/impressum/a-57669411">i</a>';
  const EP = '<title>12.11.2026 – Langsam Gesprochene Nachrichten | DW</title><audio><source src="' + MP3 + '"/></audio><div class="x" data-testid="richtext-content-container"><span><h2>Papst kehrt nach Peru zurück</h2>\n<p>Papst Leo ist in Peru eingetroffen. Er trifft die Präsidentin.<br> &#160;</p> <h2>Streik in Spanien</h2> <p>Züge &amp; Flüge fielen aus.</p></span></div></article>';
  const seen = [];
  global.fetch = async (u, o) => {
    u = String(u); seen.push(u);
    if (u.startsWith("https://learngerman.dw.com/de/langsam")) return new Response(LIST, { status: 200 });
    if (u === "https://learngerman.dw.com/de/x/a-79926623") return new Response(EP, { status: 200 });
    if (u === "https://learngerman.dw.com/de/x/a-111111") return new Response("<title>Impressum</title>", { status: 200 });
    if (u.startsWith(MP3)) return new Response(new Uint8Array(3000), { status: 206, headers: { "content-range": "bytes 0-2999/3000" } });
    if (/translate_a\/single/.test(u)) { const q = new URL(u).searchParams.get("q").split("\n"); return new Response(JSON.stringify({ sentences: [{ trans: q.map(x => "【中】" + x).join("\n") }] }), { status: 200 }); }
    return new Response("no", { status: 404 });
  };
  const call = async (p, init) => { const r = await W.fetch(new Request("https://x.test" + p, init), env, {}); return { status: r.status, j: await r.json() }; };
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

  let r = await call("/api/dw?list=1");
  ok(r.j.ok && r.j.list.length === 2 && r.j.list[0].id === "79930000" && r.j.list[1].d === "2026-11-12", "list newest first, no dups " + JSON.stringify(r.j).slice(0, 200));
  r = await call("/api/dw?list=1"); ok(r.j.cached, "list cached");
  r = await call("/api/dw?ep=79926623");
  ok(r.j.ok && r.j.mp3 === MP3 && r.j.title === "12.11.2026 – Langsam Gesprochene Nachrichten", "ep mp3 + title " + JSON.stringify(r.j).slice(0, 200));
  ok(r.j.lines.length === 2 && r.j.lines[0].who === "Papst kehrt nach Peru zurück" && r.j.lines[0].t === "Papst Leo ist in Peru eingetroffen. Er trifft die Präsidentin." && r.j.lines[1].t === "Züge & Flüge fielen aus.", "ep lines " + JSON.stringify(r.j.lines));
  ok(kv.has("dw/ep/79926623"), "ep stored");
  r = await call("/api/dw?ep=111111"); ok(r.status === 404, "not a slow-news page → 404");
  r = await call("/api/dw?ep=abc"); ok(r.status === 400, "bad id");
  r = await call("/api/dw?ep=79926623&zh=1");
  ok(r.j.ok && r.j.lines[0] === "【中】Papst Leo ist in Peru eingetroffen. Er trifft die Präsidentin.", "zh " + JSON.stringify(r.j));
  ok(seen.some(u => /translate_a\/single.*[?&]sl=de&/.test(u)), "google asked with sl=de");
  ok(kv.has("dw/zh/79926623"), "zh stored");
  // Whisper 德语对时间
  r = await call("/api/dw?al=79926623&part=0");
  const wcall = ai.find(x => /whisper/.test(x[0]));
  ok(r.j.ok && r.j.words.length === 2 && r.j.words[1][0] === "Morgen" && wcall && wcall[1].language === "de", "align de " + JSON.stringify(r.j).slice(0, 200));
  ok(kv.has("dw/al/79926623/0"), "align stored");
  r = await call("/api/dw?al=99999&part=0"); ok(r.status === 409, "align needs opened episode");
  // 跟读录音：?lang=de 让 Whisper 按德语听
  ai.length = 0; r = await call("/api/stt?lang=de", { method: "POST", body: new Uint8Array(10) });
  ok(r.j.ok && ai[0] && ai[0][1].language === "de", "stt de");
  ai.length = 0; r = await call("/api/stt", { method: "POST", body: new Uint8Array(10) }); ok(ai[0] && ai[0][1].language === "en", "stt default en");
  // 中转名单：DW 的 mp3 可以中转（大陆打不开 DW）
  r = await W.fetch(new Request("https://x.test/api/px?u=" + encodeURIComponent(MP3)), env, {}); ok(r.status === 206 || r.status === 200, "px dw mp3 " + r.status);
  console.log(fail ? fail + " FAILED" : "t55 dw: all ok"); process.exit(fail ? 1 : 0);
})();
