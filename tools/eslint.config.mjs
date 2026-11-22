// 🛡 代码检查（GitHub Actions 自动测试跑；本机跑法见 tools/lint.sh）：只查两类会让页面直接报错的问题
// ① no-undef：用了没定义的变量（比如删掉的函数还有地方在调）
// ② 页面里的变量和全站公用模块重名（比如 const WORD = 正则，把 word.js 的 WORD 遮住了）
// 跨文件共用的全局变量都要登记在下面；新加一个公用模块 / index.html 的全局函数，记得加进来
import globals from "globals";
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
      ...g(SHARED),
      ...g(["NET", "LANG", "ERR", "videoCore", "YT", "module"]), // index.html 的 NET、lang.js、errbook.js、watch.js 的视频、YouTube 播放器、node 测试用的 module
      ...g(["state", "words", "toast", "speak", "save", "refresh", "quickAdd", "masteryOf", "chosenVoice", "syncNow", "schedulePush", "vStamp", "freshId", "ymdLocal"]), // index.html 里生词本那段的全局（用之前都判断过）
      ...g(["vsMark", "vsGramHtml", "vsKeys", "vsLemma", "vsCat", "vsRank", "vsMarkOf", "vsPatterns", "vsSentNotes", "vsWordNotesHtml", "VS_RANK", "VS_WORDS", "VS_WORD_RE", "VS_GRAM_NAME", "VS_GRAM_ABBR", "VS_MARKS", "VS_SAVED"]), // web/vs/（插件同一份）
    },
  },
  rules: {
    "no-undef": "error",
    "no-restricted-syntax": ["error",
      { selector: `VariableDeclarator[id.name=/${SHARED_RE}/]`, message: "变量名和全站公用模块重名，会把它遮住（换个名字）" },
      { selector: `FunctionDeclaration[id.name=/${SHARED_RE}/]`, message: "函数名和全站公用模块重名，会把它遮住（换个名字）" },
      { selector: `:function > Identifier.params[name=/${SHARED_RE}/]`, message: "参数名和全站公用模块重名，会把它遮住（换个名字）" },
    ],
  },
}];
