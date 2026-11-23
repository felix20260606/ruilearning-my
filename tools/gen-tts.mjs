// 全站 AI 真人语音：把固定的英文预先生成成 web/tts/<编号>.mp3，网页（web/tts.js）优先播这些静态文件（不花额度）。
// 内容：口语 web/speak-data.js 的句子、生词本（线上 /api/vocab，主人和每个家人）的词 + 例句 + 相关词、雅思笔记 web/ielts-notes.html 的 data-say。
// 编号 = FNV-1a 32 位（"声音|句子"），web/tts.js 的 key() 用同一个算法。
// 每次最多生成 TTS_BUDGET 个字母（默认 3600，约 4,900 neurons），而且只用当天剩下没用完的额度（见下面 letterBudget），接口报错（额度用完等）就停下，下次接着做。
// 用法：node tools/gen-tts.mjs            生成一批并更新 web/tts/index.json
//       node tools/gen-tts.mjs --dry      只统计：一共多少句、多少字母、还剩多少没生成
// GitHub Actions（.github/workflows/tts.yml）每天跑一次，直到全部生成完；以后新加的生词、改了 speak-data.js 也会自动补上。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "web/tts");
const API = process.env.TTS_API || "https://ruilearning-my.pages.dev/api/tts";
const BUDGET = +(process.env.TTS_BUDGET || 3600);
// 只用当天（UTC 日，北京时间 8 点重置）剩下没用完的额度：先问网站 /api/usage 今天已经用了多少（Cloudflare 的数字），
//   剩下的 − 留 600 当缓冲，按每个字母约 1.45 neurons 换成字母数，和 TTS_BUDGET 取小的。
//   GitHub 定时任务常常晚一个小时才跑：已经过了 00:00 UTC（新的一天）就不跑，免得吃掉你白天的额度（--force 不管）
export const NEURONS_PER_LETTER = 1.45, DAY_LIMIT = 10000, RESERVE = 600;
export function letterBudget(usedToday, budget, utcHour, force) {
  if (!force && !(utcHour >= 20)) return { letters: 0, why: "现在是 UTC " + utcHour + " 点（北京时间 " + ((utcHour + 8) % 24) + " 点）：新的一天刚开始，额度留给白天练习，这次不生成" };
  const left = DAY_LIMIT - (+usedToday || 0) - RESERVE;
  if (left <= 0) return { letters: 0, why: "今天的 AI 额度已经用了 " + Math.round(usedToday) + "，没有剩下的" };
  return { letters: Math.min(budget, Math.floor(left / NEURONS_PER_LETTER)), why: "今天已用 " + Math.round(usedToday) + " neurons，剩下约 " + Math.round(left) + " 可以用来生成" };
}
async function usedToday() {
  try { const r = await fetch(API.replace(/\/api\/tts$/, "/api/usage")); const j = await r.json(); const d = j.days && j.days[j.today]; if (!d) return 0; return Object.values(d.m || {}).reduce((a, x) => a + (+x[1] || 0), 0); } catch (e) { return null; }
}
const DRY = process.argv.includes("--dry");
export const VOICES = { "": "asteria", A: "orion" }; // 默认（B 和其它所有句子）女声，对话里的 A 男声；改了要同步 web/speak.js 不用改（它读 index.json 里的 voices）

export const clean = t => String(t).replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
export function ttsKey(voice, text) { const s = voice + "|" + clean(text); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }

// 按页面实际朗读的字段收集句子（顺序 = 生成的先后：新手先用到的排前面）
export function collect(D, vocab = [], notes = []) {
  const L = [], seen = new Set();
  const add = (t, who) => { t = clean(t || ""); if (!t || !/[a-z]/i.test(t) || /[一-鿿]/.test(t) || t.length > 1500) return; const v = VOICES[who === "A" ? "A" : ""], k = ttsKey(v, t); if (seen.has(k)) return; seen.add(k); L.push({ k, v, t }); };
  const st = D.starter || {};
  (st.rescue || []).forEach(x => add(x.en)); (st.intro || []).forEach(x => add(x.en));
  vocab.forEach(t => add(t)); // 生词本每天练，排在前面
  notes.forEach(t => add(t));
  (D.dialogs || []).forEach(d => (d.lines || []).forEach(l => { add(l.en, l.who); if (l.who === "A") add(l.en); })); // 角色扮演里 A 也可能用默认声音读
  (D.quick || []).forEach(x => { add(x.q); add(x.a); });
  const P = D.pron || {};
  (P.shadow || []).forEach(g => (g.items || g.lines || []).forEach(x => add(x.en)));
  (D.functions || []).concat(D.slang || []).forEach(f => (f.items || []).forEach(x => { add(x.en); if (x.ex) add(String(x.ex).replace(/\b[AB]:\s*/g, "")); }));
  (D.drills || []).forEach(d => (d.items || []).forEach(x => add(x.en)));
  (D.topics || []).forEach(t => { add(t.q); add(t.sample); });
  (P.pairs || []).forEach(p => { (p.sent || []).forEach(s => s.forEach(x => add(x))); (p.words || []).forEach(w => w.forEach(x => add(x))); });
  (P.connected || []).forEach(x => add(x.en));
  (D.stress || []).forEach(x => add(x.en));
  (D.twisters || []).forEach(x => add(x.en));
  return L;
}

// 生词本：词（列表里 🔊 读的 word）、例句（examples[i][0]）、相关词（related[i][0]）；主人 + 家人
async function loadVocab() {
  const base = API.replace(/\/api\/tts$/, ""), out = [];
  let ids = [""];
  try { const u = await (await fetch(base + "/api/users")).json(); if (u && u.ok && Array.isArray(u.users)) ids = u.users.map(x => x.id || ""); } catch (e) {}
  for (const id of ids) {
    try {
      const j = await (await fetch(base + "/api/vocab" + (id ? "?u=" + encodeURIComponent(id) : ""))).json();
      for (const e of (j && j.custom) || []) {
        if (typeof e.word === "string") out.push(e.word);
        (e.examples || []).forEach(x => out.push(Array.isArray(x) ? x[0] : typeof x === "string" ? x : x && x.en));
        (e.related || []).forEach(x => out.push(Array.isArray(x) ? x[0] : x && x.w));
      }
    } catch (e) { console.log("生词本读取失败", id || "主人", e.message); }
  }
  return out.filter(x => typeof x === "string");
}
// 雅思笔记页：每个 🔊 按钮的 data-say
function loadNotes() {
  const html = fs.readFileSync(path.join(ROOT, "web/ielts-notes.html"), "utf8"), out = [];
  const dec = s => s.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  for (const m of html.matchAll(/data-say="([^"]*)"/g)) out.push(dec(m[1]));
  return out;
}

function loadData() {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "web/speak-data.js"), "utf8"), ctx);
  return ctx.window.SPEAK_DATA;
}

async function main() {
  const L = collect(loadData(), await loadVocab(), loadNotes());
  fs.mkdirSync(OUT, { recursive: true });
  const have = new Set(fs.readdirSync(OUT).filter(f => f.endsWith(".mp3")).map(f => f.slice(0, -4)));
  const todo = L.filter(x => !have.has(x.k));
  const chars = a => a.reduce((n, x) => n + x.t.length, 0);
  console.log(`共 ${L.length} 句 ${chars(L)} 个字母；已生成 ${L.length - todo.length} 句，还剩 ${todo.length} 句 ${chars(todo)} 个字母`);
  let used = 0, made = 0, stop = "", LIM = BUDGET;
  if (!DRY) {
    const u = await usedToday(), b = u == null ? { letters: Math.min(BUDGET, 1500), why: "读不到今天的用量，保守只生成 1500 个字母" } : letterBudget(u, BUDGET, new Date().getUTCHours(), process.argv.includes("--force"));
    LIM = b.letters; console.log("额度：" + b.why + " → 这次最多 " + LIM + " 个字母");
  }
  if (!DRY) for (const x of todo) {
    if (used + x.t.length > LIM) { stop = "到了这次能用的额度"; break; }
    let r;
    try { r = await fetch(API + "?v=" + x.v + "&t=" + encodeURIComponent(x.t)); } catch (e) { stop = "连不上：" + e.message; break; }
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.startsWith("audio/")) { stop = "接口报错 " + r.status + " " + (await r.text()).slice(0, 200); break; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 200) { stop = "音频太小"; break; }
    fs.writeFileSync(path.join(OUT, x.k + ".mp3"), buf); have.add(x.k); used += x.t.length; made++;
  }
  // index.json：done = 有静态文件的，todo = 固定句子但还没生成的（网页对 todo 先用系统语音，不现场花额度）
  const done = L.filter(x => have.has(x.k)).map(x => x.k), left = L.filter(x => !have.has(x.k)).map(x => x.k);
  if (!DRY) fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ voices: VOICES, done, todo: left }) + "\n");
  console.log(`这次生成 ${made} 句 ${used} 个字母；还剩 ${left.length} 句${stop ? "（停下原因：" + stop + "）" : ""}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
