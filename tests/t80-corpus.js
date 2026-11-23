// 🔎 真人例句：例句库生成（tools/build-corpus.mjs 的 fromCaptions）+ 网页里的搜索（corpus.js 的 search）：变形也算、短语整段找、视频的排前面
const fs = require("fs"), path = require("path"), vm = require("vm"), os = require("os");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  const { fromCaptions } = await import(path.join(__dirname, "..", "tools", "build-corpus.mjs"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-"));
  fs.writeFileSync(path.join(dir, "abcdefghijk.json"), JSON.stringify({ v: "abcdefghijk", title: "Test video", lang: "en", cues: [{ s: 1, e: 3, t: "She went to the market yesterday", r: "她昨天去了市场" }, { s: 4, e: 5, t: "Hi", r: "" }, { s: 6, e: 9, t: "We need to take off right now", r: "" }] }));
  fs.writeFileSync(path.join(dir, "zzzzzzzzzzz.json"), JSON.stringify({ v: "zzzzzzzzzzz", title: "中文视频", lang: "zh", cues: [{ s: 1, e: 2, t: "不要这个", r: "" }] }));
  fs.writeFileSync(path.join(dir, "index.json"), "[]");
  const C = fromCaptions(dir);
  ok(C.docs.length === 1 && C.s.length === 2 && C.s[0][3] === "She went to the market yesterday" && C.s[0][1] === 1, "captions → sentences (too short / non-English skipped)");
  const ctx = { console, U: { esc: s => String(s), json: async () => null, tip() {} }, document: { createElement: () => ({}), head: { append() {} }, body: { append() {} } }, window: {} };
  ctx.window = ctx; ctx.vsKeys = w => (w === "went" ? ["go"] : w.endsWith("s") ? [w.slice(0, -1)] : []);
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "web", "corpus.js"), "utf8"), ctx);
  ctx.CORPUS.set({ docs: [["b", "6-minute-english_2026/ep-1", "BBC ep"]].concat(C.docs), s: [[0, 0, 0, "Where did you go last week", ""]].concat(C.s.map(r => [r[0] + 1].concat(r.slice(1)))) });
  let h = ctx.CORPUS.search("go"); ok(h.length === 2 && h[0].w === "went" && h[1].w === "go", "forms count (went → go), video first: " + h.map(x => x.w));
  h = ctx.CORPUS.search("take off"); ok(h.length === 1 && /take off/.test(h[0].r[3]), "phrase search");
  h = ctx.CORPUS.search("markets"); ok(h.length === 1, "plural query finds the singular in text");
  h = ctx.CORPUS.search("marketing"); ok(h.length === 0, "different word not matched (marketing ≠ market)");
  const W = fs.readFileSync(path.join(__dirname, "..", "web", "word.js"), "utf8");
  ok(/data-a="pcorp"/.test(W) && /window\.corpusShow\(w\)/.test(W), "word card has 🔎 真人例句");
  ok(/corpus: \{ src: "corpus\.js/.test(fs.readFileSync(path.join(__dirname, "..", "web", "lazy.js"), "utf8")), "lazy-loaded");
  ok(/build-corpus\.mjs/.test(fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "backup-vocab.yml"), "utf8")), "rebuilt by the backup workflow");
  console.log(fail ? fail + " FAILED" : "t80 corpus: all ok"); process.exit(fail ? 1 : 0);
})();
