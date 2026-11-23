// 🔎 真人例句库：把「你看过、存过字幕的视频」和 BBC 几个每周节目最近几期的文稿，合成一个小文件 web/corpus.json，
// 网页「🔎 真人例句」（web/corpus.js）在里面搜一个词：视频的句子能从那一秒开始播，BBC 的能直接打开那一期。
// 来源：
//   - data/captions/*.json（备份流程从 /api/cap 下载的视频字幕：每句 s 开始秒、e 结束秒、t 英文、r 中文）
//   - BBC 6 分钟英语 / 慢速对话 / 地道说法 / 新闻英语：各取最近 8 期，GET /api/sme?ep=（后台有缓存；第一次取会让后台缓存一次）
// 输出：{ at, docs: [[类型 "y" | "b", id, 标题]], s: [[第几个 doc, 开始秒, 结束秒, 英文, 中文]] }（句子太短 / 太长的不要）
// 用法：node tools/build-corpus.mjs（备份流程每 6 小时跑一次；内容没变就不改文件，不会多一次部署）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.SITE || "https://ruilearning-my.pages.dev";
const OUT = path.join(ROOT, "web/corpus.json");
const BBC = (process.env.CORPUS_BBC || "sme,ree,tews,news").split(",").filter(Boolean), PER = +(process.env.CORPUS_PER || 8);
const ok = t => { const n = String(t || "").split(/\s+/).length; return n >= 3 && n <= 40; };
const clean = t => String(t || "").replace(/\s+/g, " ").trim();

export function fromCaptions(dir) {
  const docs = [], s = [];
  if (!fs.existsSync(dir)) return { docs, s };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    if (!d || !d.v || !Array.isArray(d.cues) || !/^en/i.test(d.lang || "en")) continue;
    const di = docs.push(["y", d.v, clean(d.title || d.v)]) - 1;
    d.cues.forEach(c => { const t = clean(c.t); if (ok(t)) s.push([di, Math.round((+c.s || 0) * 10) / 10, Math.round((+c.e || 0) * 10) / 10, t, clean(c.r)]); });
  }
  return { docs, s };
}
async function getJson(u) { try { const r = await fetch(u, { headers: { "User-Agent": "ruilearning-corpus" } }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
async function fromBBC(docs, s) {
  for (const ser of BBC) {
    const L = await getJson(SITE + "/api/sme?s=" + ser); if (!L || !L.ok) continue;
    for (const it of (L.list || []).slice(0, PER)) {
      const ep = await getJson(SITE + "/api/sme?ep=" + encodeURIComponent(it.id)); if (!ep || !ep.ok || !Array.isArray(ep.lines)) continue;
      const di = docs.push(["b", it.id, clean(ep.title || it.t || it.id)]) - 1;
      ep.lines.forEach((l, i) => { const t = clean(l.t); if (ok(t)) s.push([di, i, 0, t, ""]); });
    }
  }
}
async function main() {
  const { docs, s } = fromCaptions(path.join(ROOT, "data/captions"));
  if (!process.argv.includes("--no-bbc")) await fromBBC(docs, s);
  const out = JSON.stringify({ docs, s });
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (old.replace(/^\{"at":\d+,/, "{") === out) { console.log("例句库没变化"); return; }
  fs.writeFileSync(OUT, '{"at":' + Date.now() + "," + out.slice(1));
  console.log("例句库：" + docs.length + " 个来源，" + s.length + " 句，" + Math.round(fs.statSync(OUT).size / 1024) + " KB");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
