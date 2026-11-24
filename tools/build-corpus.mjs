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
// 🇩🇪 --lang de：德语例句库 web/corpus-de.json（存过字幕的德语视频 + DW 慢速新闻最近几期的文稿，期号 dw/<文章号>，在「📻 听力节目」里打开）
const LANG = process.argv.includes("--lang") ? process.argv[process.argv.indexOf("--lang") + 1] : "en", DE = LANG === "de";
const OUT = path.join(ROOT, DE ? "web/corpus-de.json" : "web/corpus.json");
const BBC = (process.env.CORPUS_BBC || "sme,ree,tews,news").split(",").filter(Boolean), PER = +(process.env.CORPUS_PER || 8);
const ok = t => { const n = String(t || "").split(/\s+/).length; return n >= 3 && n <= 40; };
const clean = t => String(t || "").replace(/\s+/g, " ").trim();

export function fromCaptions(dir, lang = "en") {
  const docs = [], s = [];
  if (!fs.existsSync(dir)) return { docs, s };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "index.json").sort()) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    if (!d || !d.v || !Array.isArray(d.cues) || !new RegExp("^" + lang, "i").test(d.lang || "en")) continue;
    const di = docs.push(["y", d.v, clean(d.title || d.v)]) - 1;
    d.cues.forEach(c => { const t = clean(c.t); if (ok(t)) s.push([di, Math.round((+c.s || 0) * 10) / 10, Math.round((+c.e || 0) * 10) / 10, t, clean(c.r)]); });
  }
  return { docs, s };
}
async function getJson(u) { try { const r = await fetch(u, { headers: { "User-Agent": "ruilearning-corpus" }, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
// 某个栏目这次没取到（网络抖了一下）：沿用旧文件里这个栏目的句子，不让例句库忽大忽小、白白多部署一次
function oldSeries(old, ser) {
  const out = []; if (!old || !Array.isArray(old.docs)) return out;
  old.docs.forEach((d, i) => { if (d[0] === "b" && String(d[1]).split("/")[0].replace(/_\d{4}$/, "").startsWith(SLUG[ser] || ser)) out.push({ d, s: old.s.filter(r => r[0] === i) }); });
  return out;
}
const SLUG = { sme: "6-minute-english", ree: "real-easy-english", tews: "the-english-we-speak", news: "learning-english-from-the-news" };
async function fromBBC(docs, s, old) {
  for (const ser of BBC) {
    const L = await getJson(SITE + "/api/sme?s=" + ser);
    if (!L || !L.ok) { oldSeries(old, ser).forEach(o => { const di = docs.push(o.d) - 1; o.s.forEach(r => s.push([di].concat(r.slice(1)))); }); console.log("栏目 " + ser + " 没取到，沿用旧的"); continue; }
    for (const it of (L.list || []).slice(0, PER)) {
      const ep = await getJson(SITE + "/api/sme?ep=" + encodeURIComponent(it.id));
      if (!ep || !ep.ok || !Array.isArray(ep.lines)) { const o = oldSeries(old, ser).find(x => x.d[1] === it.id); if (o) { const di = docs.push(o.d) - 1; o.s.forEach(r => s.push([di].concat(r.slice(1)))); } continue; }
      const di = docs.push(["b", it.id, clean(ep.title || it.t || it.id)]) - 1;
      ep.lines.forEach((l, i) => { const t = clean(l.t); if (ok(t)) s.push([di, i, 0, t, ""]); });
    }
  }
}
// 德语分句（同 web/util.js 的 U.sents 学德语时的规则）：缩写（z. B.、ca.、Nr.）、序数（am 23. Februar、im 19. Jahrhundert）、下一个字小写都不断
const ABBR_DE = new Set("z b u a d h o s bzw ca usw ggf inkl vgl evtl sog nr mio mrd jh jhd str bspw tel abs ff dt engl max min ehem gegr hrsg zb".split(" "));
const ORD_PREV = /(^|\s)(der|die|das|den|dem|des|am|im|vom|zum|zur|beim|ab|bis|seit|ihr|sein|seinem|ihrem|seines|ihres|unser|jeder)\s+\d{1,4}$/i; // 「der 30.」「am Dienstag den 6.」：冠词 / 介词后面的数字带点 = 序数
const ORD_NEXT = /^(Januar|Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jahrhundert|Jahrhunderts|Jahrestag|Mal|Stock|Platz|Klasse|Runde|Spieltag|Geburtstag|Lebensjahr|Kapitel|Etage|Woche|Tag|Bundestag|Parteitag)\b/;
export function splitDe(p) {
  p = String(p || "").replace(/\s+/g, " ").trim(); const out = [], re = /[.!?…]+["'”’“)\]]*(?=\s|$)/g; let m, start = 0;
  while ((m = re.exec(p))) {
    const end = m.index + m[0].length, rest = p.slice(end).replace(/^\s+/, ""); if (!rest) break;
    if (/^\p{Ll}/u.test(rest)) continue;
    if (/^\.["'”’“)\]]*$/.test(m[0])) { const lw = (p.slice(start, m.index).match(/([\p{L}\d]+)$/u) || [])[1] || ""; if (ABBR_DE.has(lw.toLowerCase()) || /^\p{Lu}$/u.test(lw) || (/^\d{1,4}$/.test(lw) && (ORD_NEXT.test(rest) || ORD_PREV.test(p.slice(start, m.index))))) continue; }
    out.push(p.slice(start, end).trim()); start = end;
  }
  const last = p.slice(start).trim(); if (last) out.push(last); return out;
}
// DW 慢速新闻：/api/dw 的最近 PER 期（每期几条新闻，每条一段：按句切开）；取不到的期沿用旧文件
async function fromDW(docs, s, old) {
  const L = await getJson(SITE + "/api/dw?list=1"), oldDw = id => { if (!old || !Array.isArray(old.docs)) return null; const i = old.docs.findIndex(d => d[0] === "b" && d[1] === id); return i < 0 ? null : { d: old.docs[i], s: old.s.filter(r => r[0] === i) }; };
  const keep = o => { const di = docs.push(o.d) - 1; o.s.forEach(r => s.push([di].concat(r.slice(1)))); };
  if (!L || !L.ok) { if (old) old.docs.forEach(d => { if (d[0] === "b") { const o = oldDw(d[1]); if (o) keep(o); } }); console.log("DW 没取到，沿用旧的"); return; }
  for (const it of (L.list || []).slice(0, +(process.env.CORPUS_PER_DE || 30))) { // DW 列表有二十几期，全取（每期就几段，文件很小）
    const id = "dw/" + it.id, ep = await getJson(SITE + "/api/dw?ep=" + encodeURIComponent(it.id));
    if (!ep || !ep.ok || !Array.isArray(ep.lines)) { const o = oldDw(id); if (o) keep(o); continue; }
    const di = docs.push(["b", id, clean(ep.title || it.t || it.id)]) - 1;
    ep.lines.forEach((l, i) => splitDe(l.t).forEach(x => { const t = clean(x); if (ok(t)) s.push([di, i, 0, t, ""]); }));
  }
}
async function main() {
  const { docs, s } = fromCaptions(path.join(ROOT, "data/captions"), LANG);
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) {}
  if (DE) { if (!process.argv.includes("--no-bbc")) await fromDW(docs, s, old); }
  else if (!process.argv.includes("--no-bbc")) await fromBBC(docs, s, old);
  const nb = d => (d && d.docs ? d.docs.filter(x => x[0] === "b").length : 0);
  if (old && nb({ docs }) < nb(old) * 0.5) { console.log("BBC 来源比上次少了一半以上（" + nb({ docs }) + " < " + nb(old) + "），这次不更新"); return; }
  const out = JSON.stringify({ docs, s });
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (prev.replace(/^\{"at":\d+,/, "{") === out) { console.log("例句库没变化"); return; }
  fs.writeFileSync(OUT, '{"at":' + Date.now() + "," + out.slice(1));
  console.log("例句库：" + docs.length + " 个来源，" + s.length + " 句，" + Math.round(fs.statSync(OUT).size / 1024) + " KB");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
