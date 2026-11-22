// 收了一个词，它的其它形式也框出来（插件和网站共用 extension/vlevel.js = web/vs/vlevel.js）：
//   三单、过去式、过去分词、-ing、复数、比较级 / 最高级，含不规则变化表（tools/irregular.py 生成，和生词本「📐 规律」里的不规则变化卡片同一份数据）
const vm = require("vm"), fs = require("fs"), path = require("path"), cp = require("child_process");
const D = path.join(__dirname, "..");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const ctx = {}; vm.createContext(ctx);
for (const f of ["freq.js", "vlevel.js"]) vm.runInContext(fs.readFileSync(path.join(D, "extension", f), "utf8"), ctx);
const mark = (saved, w) => vm.runInContext("VS_SAVED=new Set(" + JSON.stringify([saved]) + ");VS_MARKS={};vsMarkOf(" + JSON.stringify(w) + ")", ctx);
const YES = { go: "goes going went gone", make: "makes making made", study: "studies studied studying", stop: "stops stopped stopping", run: "runs running ran",
  write: "writes writing wrote written", buy: "bought", big: "bigger biggest", happy: "happier happiest", nice: "nicer nicest", large: "larger largest",
  child: "children", leaf: "leaves", knife: "knives", lie: "lying lay lain lies", die: "dying died", panic: "panicked panicking", teach: "taught",
  begin: "began begun beginning", swim: "swam swum swimming", criterion: "criteria", analysis: "analyses", mouse: "mice", person: "people",
  good: "better best", bad: "worse worst", sting: "stung", weave: "wove woven", cling: "clung", box: "boxes", watch: "watches watched", embarrass: "embarrassed embarrassing" };
for (const b in YES) for (const f of YES[b].split(" ")) { ok(mark(b, f) === "learn", b + " → " + f); ok(mark(f, b) === "learn", "(saved " + f + ") → " + b); }
const NO = { sing: "singer sin", win: "winner wines", din: "dinner", ear: "early", on: "only", inter: "interest", for: "forest" };
for (const b in NO) for (const f of NO[b].split(" ")) ok(mark(b, f) !== "learn", "no false match " + b + " / " + f);
// 词频上色按原形：bigger 和 big 一样难
ok(vm.runInContext('vsLemma("bigger")', ctx) === "big" && vm.runInContext('vsLemma("happiest")', ctx) === "happy" && vm.runInContext('vsLemma("wines")', ctx) === "wine", "lemma");
// 网站那份和插件一模一样（tools/sync-shared.sh）
ok(fs.readFileSync(path.join(D, "extension", "vlevel.js"), "utf8") === fs.readFileSync(path.join(D, "web", "vs", "vlevel.js"), "utf8"), "web/vs/vlevel.js synced");
// 表是由 tools/irregular.py 生成的（再跑一遍不变）
const before = fs.readFileSync(path.join(D, "extension", "vlevel.js"), "utf8");
cp.execFileSync("python3", [path.join(D, "tools", "irregular.py")]);
ok(fs.readFileSync(path.join(D, "extension", "vlevel.js"), "utf8") === before, "irregular.py idempotent");
// 规律卡片：每张卡里的变形都能框到原形
const cards = JSON.parse(cp.execFileSync("python3", [path.join(D, "tools", "irregular.py"), "--cards"]).toString());
ok(cards.length === 6 && cards.every(c => c.type === "pattern" && c.tag === "拼写规律" && c.forms.length), "6 cards");
for (const c of cards.filter(c => /^irr_verbs/.test(c.id))) for (const [b, f] of c.forms) for (const x of f.split(/[\s·/]+/).filter(Boolean)) ok(mark(b, x) === "learn", c.id + " " + b + " → " + x);
console.log(fail ? fail + " FAILED" : "t57 forms: all ok"); process.exit(fail ? 1 : 0);
