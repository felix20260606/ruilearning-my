// 「🔊 发音」最小对立词的真人录音：从维基词典（Wiktionary）页面上找这个词的英语录音（文件放在 Wikimedia Commons，CC BY-SA 等自由授权），
// 写成 web/pron-real.json：{ "ship": { "u": mp3 地址, "f": "File:En-us-ship.ogg", "a": "us" | "uk" | "au" | "ll" }, ... }
// 网页（speak.js）点词、听音辨词优先播这些录音；找不到真人录音的词才用 AI 声音。
// 挑录音的顺序：en-us-词.ogg（美音，维基词典标准录音）> LL-Q1860 (eng)（Lingua Libre 志愿者录的英语）> en-uk / en-au
// 用法：node tools/gen-pron.mjs   （只读公开的维基接口，不需要任何密钥；词表来自 web/speak-data.js 的 pron.pairs）
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "User-Agent": "ban-life-pron/1.0 (language-learning site; pronunciation audio lookup)" };
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, "web/speak-data.js"), "utf8"), ctx);
const D = ctx.window.SPEAK_DATA;
const words = [...new Set(D.pron.pairs.flatMap(p => p.words.flat()).map(w => w.toLowerCase().trim()))];

const api = async q => { for (let t = 0; t < 4; t++) { const r = await fetch("https://en.wiktionary.org/w/api.php?format=json&formatversion=2&" + q, { headers: UA }); if (r.ok) return r.json(); await new Promise(s => setTimeout(s, 5000 * (t + 1))); } throw new Error("wiktionary " + q); };
const norm = s => s.toLowerCase().replace(/_/g, " ").replace(/[’‘]/g, "'");
function rank(file, w) { // 文件名要正好是这个词，越靠前越好；-1 = 不要
  const n = norm(file).replace(/^file:/, "").replace(/\.(ogg|oga|wav|mp3|flac)$/, "");
  if (n === "en-us-" + w) return 0;
  if (/^ll-q1860 \(eng\)-[^-]+-/.test(n) && n.replace(/^ll-q1860 \(eng\)-[^-]+-/, "") === w) return 1;
  if (n === "en-uk-" + w || n === "en-gb-" + w) return 2;
  if (n === "en-au-" + w || n === "en-ca-" + w) return 3;
  return -1;
}
const ACC = ["us", "ll", "uk", "au"];

// 一词多音：指定用哪条录音（live 要动词 /lɪv/，lead 要「带领」/liːd/，不是金属 /led/）
const PICK = { live: "File:en-us-live-verb.ogg", lead: "File:En-us-lead-guide.oga" };
const found = {};
for (const w in PICK) if (words.includes(w)) found[w] = { r: 0, f: PICK[w], fixed: 1 };
for (let i = 0; i < words.length; i += 20) { // 页面上用到的文件（标题试原样和首字母大写，比如 Luke；一次最多 50 个标题，结果多了要接着翻页）
  const part = words.slice(i, i + 20), titles = [...new Set(part.flatMap(w => [w, w[0].toUpperCase() + w.slice(1)]))];
  let cont = "";
  do {
    const j = await api("action=query&prop=images&imlimit=max&titles=" + encodeURIComponent(titles.join("|")) + cont);
    if (!j.query) throw new Error(JSON.stringify(j).slice(0, 300));
    for (const p of j.query.pages || []) for (const im of p.images || []) {
      const w = norm(p.title), r = rank(im.title, w); if (r < 0) continue;
      if (!found[w] || (!found[w].fixed && r < found[w].r)) found[w] = { r, f: im.title };
    }
    cont = j.continue && j.continue.imcontinue ? "&imcontinue=" + encodeURIComponent(j.continue.imcontinue) : "";
  } while (cont);
}
const files = Object.values(found).map(x => x.f), url = {};
for (let i = 0; i < files.length; i += 40) {
  const j = await api("action=query&prop=imageinfo&iiprop=url&titles=" + encodeURIComponent(files.slice(i, i + 40).join("|")));
  for (const p of j.query.pages || []) if (p.imageinfo && p.imageinfo[0]) url[p.title] = p.imageinfo[0].url.split("?")[0];
}
async function mp3Of(u) { // .ogg / .wav：用 Commons 转好的 mp3（苹果手机放不了 ogg）
  if (/\.mp3$/i.test(u)) return u;
  const m = u.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w)\/(\w\w)\/(.+)$/); if (!m) return null;
  const t = "https://upload.wikimedia.org/wikipedia/commons/transcoded/" + m[1] + "/" + m[2] + "/" + m[3] + "/" + m[3] + ".mp3";
  for (let k = 0; k < 3; k++) { const r = await fetch(t, { method: "HEAD", headers: UA }); if (r.ok) return t; if (r.status === 404) break; await new Promise(s => setTimeout(s, 1500)); }
  return /\.wav$/i.test(u) ? u : null;
}
const out = {};
for (const w of words.sort()) {
  const x = found[w]; if (!x) continue;
  const n = x.f.replace(/ /g, "_"), u = url[x.f] || url[n]; if (!u) continue;
  const m = await mp3Of(u); if (m) out[w] = { u: m, f: x.f, a: ACC[x.r] };
}
fs.writeFileSync(path.join(ROOT, "web/pron-real.json"), JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"') + "\n");
const miss = words.filter(w => !out[w]);
console.log("真人录音 " + Object.keys(out).length + " / " + words.length + " 个词；没有的：" + miss.join(", "));
