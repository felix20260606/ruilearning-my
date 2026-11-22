// 🛡 代码检查（GitHub Actions 自动测试跑；本机跑法见 tools/lint.sh）：只查两类会让页面直接报错的问题
// ① no-undef：用了没定义的变量（比如删掉的函数还有地方在调）
// ② 页面里的变量和全站公用模块重名（比如 const WORD = 正则，把 word.js 的 WORD 遮住了）
// ③ 同一个作用域里重复定义（两个同名函数，后面的悄悄盖掉前面的）
// 跨文件共用的全局变量都要登记在下面；新加一个公用模块 / index.html 的全局函数，记得加进来
import globals from "globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 自动收集的全局：① 各文件 window.xxx = … 导出的（别的文件直接写 xxx 用）② 从 index.html 搬出来的几段普通脚本（boot / net / vocab / tabs / mine-sync）顶层声明的
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const INDEX_PARTS = ["boot.js", "net.js", "vocab.js", "tabs.js", "mine-sync.js"];
function topNames(src) { // 顶层（行首、不缩进）的 function / const / let / var 声明的名字
  const out = new Set();
  for (const line of src.split("\n")) {
    let m = line.match(/^(?:async\s+)?function\s*\*?\s*([\w$]+)/); if (m) { out.add(m[1]); continue; }
    m = line.match(/^(?:const|let|var)\s+(.*)$/); if (!m) continue;
    let d = 0, cur = "", parts = []; for (const ch of m[1]) { if ("([{".includes(ch)) d++; else if (")]}".includes(ch)) d--; if (ch === "," && d === 0) { parts.push(cur); cur = ""; } else if (ch === ";" && d === 0) break; else cur += ch; } parts.push(cur);
    for (const p of parts) { const n = p.trim().match(/^([\w$]+)\s*(=|$)/); if (n) out.add(n[1]); }
  }
  return out;
}
const AUTO = new Set();
for (const f of fs.readdirSync(WEB).filter(f => f.endsWith(".js") && f !== "_worker.js" && f !== "speak-data.js")) {
  const src = fs.readFileSync(path.join(WEB, f), "utf8");
  for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) AUTO.add(m[1]);
  if (INDEX_PARTS.includes(f)) topNames(src).forEach(n => AUTO.add(n));
}
const SHARED = ["U", "AI", "TR", "CLOUD", "MEDIA", "KEYS", "WORD", "TTS", "REC", "NAV"]; // web/ 下的全站公用模块（window.X）
const g = o => Object.fromEntries(o.map(k => [k, "readonly"]));
const SHARED_RE = "^(" + SHARED.join("|") + ")$";
export default [{
  files: ["web/*.js"],
  ignores: ["web/_worker.js", "web/speak-data.js", "web/sw.js"],
  languageOptions: {
    ecmaVersion: 2023, sourceType: "script",
    globals: {
      ...globals.browser,
      ...Object.fromEntries([...AUTO].map(k => [k, "writable"])),
      ...g(SHARED),
      ...g(["NET", "LANG", "ERR", "videoCore", "YT", "module"]), // index.html 的 NET、lang.js、errbook.js、watch.js 的视频、YouTube 播放器、node 测试用的 module
      ...g(["state", "words", "toast", "speak", "save", "refresh", "quickAdd", "masteryOf", "chosenVoice", "syncNow", "schedulePush", "vStamp", "freshId", "ymdLocal"]), // index.html 里生词本那段的全局（用之前都判断过）
      ...g(["vsMark", "vsGramHtml", "vsKeys", "vsLemma", "vsCat", "vsRank", "vsMarkOf", "vsPatterns", "vsSentNotes", "vsWordNotesHtml", "VS_RANK", "VS_WORDS", "VS_WORD_RE", "VS_GRAM_NAME", "VS_GRAM_ABBR", "VS_MARKS", "VS_SAVED", "VS_IRR"]), // web/vs/（插件同一份）
    },
  },
  rules: {
    "no-undef": "error",
    "no-redeclare": ["error", { builtinGlobals: false }], // 同一个作用域里两个同名函数 / 变量：后面的会悄悄盖掉前面的（word.js 的 html 出过这个事）
    "no-dupe-keys": "error", "no-func-assign": "error",
    "no-restricted-syntax": ["error",
      { selector: `VariableDeclarator[id.name=/${SHARED_RE}/]`, message: "变量名和全站公用模块重名，会把它遮住（换个名字）" },
      { selector: `FunctionDeclaration[id.name=/${SHARED_RE}/]`, message: "函数名和全站公用模块重名，会把它遮住（换个名字）" },
      { selector: `:function > Identifier.params[name=/${SHARED_RE}/]`, message: "参数名和全站公用模块重名，会把它遮住（换个名字）" },
    ],
  },
}];
