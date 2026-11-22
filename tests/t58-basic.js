// 🌱 入门标签：接在「🎓 雅思」后面；下面四个小标签（从这开始 / 口语入门 / 发音 / 语法）；口语的「入门」「发音」和写的「语法」挪过来了
// 只读网页源码检查（不联网）
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const h = W("index.html"), sp = W("speak.js"), bs = W("basic.js");

// 标签顺序：雅思后面是入门
const tabs = [...h.matchAll(/<button id="tab-(\w+)" type="button">/g)].map(m => m[1]);
ok(tabs.indexOf("basic") === tabs.indexOf("ielts") + 1, "入门 right after 雅思 " + tabs);
// 小标签：入门有四个，写只剩写作批改（不再有小标签条）
ok(/basic:\[\['start','🧭 从这开始'\],\['speak','🗣 口语入门'\],\['pron','🔊 发音'\],\['grammar','📐 语法'\]\]/.test(h), "basic secs");
ok(!/write:\[\[/.test(h), "write has no sub tabs any more");
ok(/m==='grammar'\)\{if\(CUR!=='basic'/.test(h), "grammar mode syncs to 入门");
ok(/L2_OWNER=\{[^}]*basic:'en'/.test(h) && /tBasic\.onclick/.test(h), "tab wired");
ok(/<div id="view-basic"><\/div>/.test(h) && /<script src="speak\.js\?v=\d+"><\/script>\s*<script src="basic\.js\?v=\d+"><\/script>/.test(h), "container + script after speak.js");
ok(/g==='basic'/.test(h), "?go=basic");
ok(/saved==='write'&&localStorage\.getItem\('en_sub_write'\)==='grammar'\)saved='basic'/.test(h), "old 写→语法 lands on 入门→语法");
// 口语页：入门 / 发音不在「说」里列，嵌在入门里时只显示那一栏
ok(/const MOVED = \["start", "pron"\]/.test(sp) && /SECS\.filter\(x => !MOVED\.includes\(x\[0\]\)\)/.test(sp), "speak hides moved secs");
ok(/\}\)\[only \|\| sec\]\(\)/.test(sp) && /window\.speakShow = o =>/.test(sp), "speakShow(only)");
ok(/if \(!sec \|\| MOVED\.includes\(sec\)\) sec = "daily"/.test(sp), "說 defaults to daily");
// basic.js：首页每张卡都有跳转
{
  const store = new Map(), el = () => ({ style: {}, dataset: {}, classList: { contains: () => false, toggle() {}, add() {}, remove() {} }, addEventListener() {}, append() {}, innerHTML: "", querySelector: () => null });
  const root = el();
  const document = { readyState: "complete", head: el(), documentElement: el(), getElementById: id => (id === "view-basic" ? root : null), querySelector: () => null, createElement: el, addEventListener() {} };
  const win = { document, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }, setTimeout: () => 0, scrollTo() {}, console, JSON, Object, String, Array };
  win.window = win; const ctx = vm.createContext(win); vm.runInContext(W("util.js"), ctx); vm.runInContext(bs, ctx);
  ctx.basicShow();
  const gos = [...root.innerHTML.matchAll(/data-go="(\w+)"/g)].map(m => m[1]);
  ok(gos.length >= 12 && gos.every(g => typeof ctx.BASIC.GO[g] === "function"), "every card has a target " + gos.filter(g => !ctx.BASIC.GO[g]));
  const calls = []; ctx.enShow = (w, s) => calls.push(w + "/" + (s || ""));
  ctx.BASIC.GO.rules(); ctx.BASIC.GO.rescue(); ctx.BASIC.GO.pron(); ctx.BASIC.GO.drill(); ctx.BASIC.GO.ree();
  ok(calls.join() === "basic/grammar,basic/speak,basic/pron,listen/drill,listen/sme", "card targets " + calls);
  ok(store.get("drill:lvl") === "1" && JSON.parse(store.get("drill:opt")).rate === 0.85 && JSON.parse(store.get("sme:s")) === "ree", "drill easy + slow series preset");
}
console.log(fail ? fail + " FAILED" : "t58 basic: all ok"); process.exit(fail ? 1 : 0);
