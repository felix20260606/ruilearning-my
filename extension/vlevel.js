// 词频排名与按水平着色（content.js 与 level.js 共用）
function vsRank(w) {
  w = String(w).toLowerCase().replace(/’/g, "'");
  if (/\d/.test(w)) return 0;
  var m = VS_RANK;
  if (m[w]) return m[w];
  var c = [], n = w.length;
  function add(x) { if (x.length > 1) c.push(x); }
  if (/'s$/.test(w)) add(w.slice(0, -2));
  if (/ies$/.test(w)) add(w.slice(0, -3) + "y");
  if (/(es|ed|er)$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/s$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + "y");
  if (/ed$/.test(w) && /(.)\1$/.test(w.slice(0, -2))) add(w.slice(0, -3));
  if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); if (/(.)\1$/.test(w.slice(0, -3))) add(w.slice(0, -4)); }
  if (/ly$/.test(w)) add(w.slice(0, -2));
  if (/est$/.test(w)) add(w.slice(0, -3));
  var best = Infinity;
  for (var i = 0; i < c.length; i++) if (m[c[i]] && m[c[i]] < best) best = m[c[i]];
  return best;
}
// 个人标记与已收藏集合（由调用方填充）
var VS_MARKS = {}, VS_SAVED = new Set();
// 常见人名、地名、星期月份、国籍：大写出现时归入“特殊词汇”
var VS_NAMES = new Set("aaron abigail adam africa african alan alaska albert alex alexander alexis alice amanda amber america american amy andrea andrew andy angela ann anna annie anthony antonio april arizona arthur ashley asia asian atlanta august austin australia austria ava barbara beijing ben benjamin berlin betty beverly billy bob bobby boston bradley brandon brazil brenda brian britain british brittany brooklyn bruce bryan california canada canadian carl carlos carmen carol carolina carolyn catherine catholic charles charlie charlotte cheryl chicago china chinese chloe chris christian christina christine christmas christopher cindy colorado cynthia dallas dan daniel danielle danny dave david deborah debra december denise dennis denver detroit diana diane diego donald donna doris dorothy douglas dutch dylan easter eddie edward egypt elena elijah elizabeth ella ellie emily emma england english eric erica ethan eugene europe european evelyn february felix florida france frances frank fred french friday gabriel gary george georgia gerald german germany gloria grace greece greek gregory halloween hannah harold harry hawaii heather helen henry holland hollywood houston hugo india indian iran iraq ireland irish isabel isabella israel italian italy ivan jack jacob jacqueline jake james jane janet janice january japan japanese jason jean jeffrey jennifer jenny jeremy jerry jersey jesse jessica jewish jim jimmy joan joe john johnny jonathan jordan jose joseph josh joshua joyce juan judith judy julia julie july june justin karen kate katherine kathleen kathryn katie kayla keith kelly kenneth kevin kimberly korea kyle larry laura lauren lawrence lee leo liam lily linda lisa lisbon logan london louis lucas lucy luis luke madison madrid maggie manhattan marco margaret maria marie marilyn mario mark martha mary mason matt matthew max megan melissa mexican mexico mia miami michael michelle miguel mike molly monday monica moscow muslim nancy natalie nathan neil nicholas nick nicole noah norway november october ohio oliver olivia oscar pablo pamela paris patricia patrick paul pedro peter philadelphia philip poland polish portugal rachel ralph randy ray raymond rebecca richard rick robert roger rome ron ronald rosa rose roy russell russia russian ruth ryan sally sam samantha samuel sandra sara sarah saturday scotland scott scottish sean seattle september sharon shirley simon sofia sophia sophie spain spanish stephanie stephen steve steven sunday susan sweden swedish switzerland sydney ted teresa terry texas thanksgiving theresa thomas thursday tim timothy tina tokyo tom tommy tony tuesday turkey tyler vanessa vegas veronica victoria vietnam vincent virginia walter washington wayne wednesday wendy william willie york zachary zoe".split(" "));
// 数词与介词：归入“特殊词汇”（绿色）
var VS_NUM = new Set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion dozen hundreds thousands millions billions".split(" "));
var VS_PREP_UNUSED = new Set("about above across after against along among around at before behind below beneath beside besides between beyond by despite down during except for from in inside into near of off on onto out outside over past per since through throughout to toward towards under underneath until unto up upon via with within without".split(" "));
// 分类：learn 将要学习(已收藏) / known 已掌握 / ignore 不学习 / special 名称地点数字 / suggest 建议 / rare 更生僻
// 你自己的标记按“原形”生效：保存了 write，wrote / written / writes 也算在学；保存了 reinvented，reinvent 也算
var _vsIdx = { set: null, n: -1, mo: null, m: -1, S: null, M: null }, _vsLock = 0;
// 一大批词一起判断（这期间标记表不会变）：开始时把索引对一次，之后每个词不再数标记表
function vsBatch(fn) { if (!_vsLock) { _vsLock = 0; vsMarkOf(""); } _vsLock++; try { return fn(); } finally { _vsLock--; } }
// 一个词可能对应的原形：词频表里查得到的原形；查不到时（生僻词）按词尾规则猜
function vsKeys(x) {
  x = String(x).toLowerCase().replace(/’/g, "'"); var l = vsLemma(x), out = [l];
  if (typeof VS_IRR2 !== "undefined" && VS_IRR2[x]) VS_IRR2[x].forEach(function (b) { if (out.indexOf(b) < 0) out.push(b); }); // lay → lie 和 lay、better → good 和 well
  if (l === x && /(ed|ing|es|s)$/.test(x) && !(typeof VS_NOSTEM !== "undefined" && VS_NOSTEM.has(x)) && typeof vsStems === "function") vsStems(x).forEach(function (s) { if (s.length >= 4 && out.indexOf(s) < 0) out.push(s); });
  return out;
}
// 两个词形是不是同一个词（write / wrote，reinvent / reinvented）
function vsSame(a, b) { a = String(a).toLowerCase(); b = String(b).toLowerCase(); if (a === b) return true; var A = vsKeys(a), B = vsKeys(b); A.push(a); B.push(b); for (var i = 0; i < A.length; i++) if (B.indexOf(A[i]) >= 0) return true; return false; }
function vsMarkOf(k) {
  k = String(k).toLowerCase();
  // 标记表可能有几千个词：vsBatch 里（一段字幕 / 一整页一起上色）只在开始时数一次有几个，不是每个词都 Object.keys 一遍
  var cnt = _vsLock && _vsIdx.mo === VS_MARKS ? _vsIdx.m : Object.keys(VS_MARKS).length;
  if (_vsIdx.set !== VS_SAVED || _vsIdx.n !== VS_SAVED.size || _vsIdx.mo !== VS_MARKS || _vsIdx.m !== cnt) {
    var keys = Object.keys(VS_MARKS);
    var S = new Set(), M = {};
    VS_SAVED.forEach(function (x) { vsKeys(x).forEach(function (q) { S.add(q); }); });
    keys.forEach(function (x) { vsKeys(x).forEach(function (l) { if (!M[l] || VS_MARKS[x] === "known") M[l] = VS_MARKS[x]; }); });
    _vsIdx = { set: VS_SAVED, n: VS_SAVED.size, mo: VS_MARKS, m: keys.length, S: S, M: M };
  }
  if (VS_SAVED.has(k)) return "learn";
  var ks = vsKeys(k), i;
  for (i = 0; i < ks.length; i++) if (_vsIdx.S.has(ks[i])) return "learn";
  var m = VS_MARKS[k]; for (i = 0; !m && i < ks.length; i++) m = _vsIdx.M[ks[i]];
  return m === "known" || m === "ignore" ? m : "";
}
function vsCat(w, S, first, capAdj, noMark) { // noMark：忽略手动标记，只看这个词本来属于哪一类
  var k = String(w).toLowerCase();
  var mk = noMark ? "" : vsMarkOf(k); if (mk) return mk;
  if (S.level == null || S.level < 0) return "";
  if (/^\d/.test(w) || VS_NUM.has(k)) return "special";
  if (/^[A-Z]{2,}$/.test(w) && !/^(OK|TV|AM|PM|US|UK|ID|DJ|CEO|DNA|FBI|CIA|USA|NO|YES|OH|GO|STOP|WOW)$/.test(w)) return "special";
  if (first && /^[A-Z][a-z]/.test(w) && VS_NAMES.has(k) && !/^(mark|rose|grace|may|will|bill|jack|max|ray|lee|christian|jordan|china|turkey|georgia|virginia|carolina|frank|jean|ann|sally|penny|faith|hope|joy|dawn|april|june|august|march|sunday|monday|english|french|german|spanish|italian|russian|chinese|japanese|american|british|indian|mexican|canadian|european|african|asian|irish|scottish|greek|dutch|swedish|polish|jewish|muslim|catholic)$/.test(k)) return "special";
  if (!first && /^[A-Z]/.test(w) && w !== "I" && !/^I['’]/.test(w)) { var r0 = VS_RANK[k] || VS_RANK[typeof vsLemma === "function" ? vsLemma(k) : k]; if (capAdj || !r0 || r0 > 8000 || VS_NAMES.has(k)) return "special"; }
  var r = vsRank(k), lm = typeof vsLemma === "function" ? vsLemma(k) : k;
  if (lm !== k && VS_RANK[lm] && VS_RANK[lm] < r) r = VS_RANK[lm]; // 按原形判断难度
  if (r <= S.level) return "known";
  return r <= S.level + Math.max(S.level, 300) * (S.ratio || 1.5) ? "suggest" : "rare";
}
function vsClass(w, S, first, capAdj) {
  if (S.showMarks === false) return "";
  var c = vsCat(w, S, first, capAdj);
  if (c === "known") return S.greenKnown ? "vs-k" : "";
  if (c === "special") return S.showSpecial !== false ? "vs-sp" : "";
  if (c === "learn") return (S.showLearn !== false ? "vs-ln " : "") + (S.showLearnOutline !== false ? "vs-lo" : "");
  if (c === "suggest") return S.showSuggest !== false ? "vs-u1" : "";
  if (c === "ignore") return S.showIgnore !== false ? "vs-u2" : "";
  if (c === "rare") return S.showIgnore === false ? "" : "vs-u2" + (S.fadeRare && vsRank(w) > 15000 ? " vs-rare" : "");
  return "";
}
// 给一段已转义文本里的单词加标记
var VS_WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
function vsMark(escaped, S, cls) { return vsBatch(function () { return vsMark1(escaped, S, cls); }); }
function vsMark1(escaped, S, cls) {
  return escaped.replace(VS_WORD_RE, function (w, off, str) {
    if (off > 0 && str.charAt(off - 1) === "&" && str.charAt(off + w.length) === ";") return w; // 已经转义过的 &amp; &lt; &quot; 里的字母不是词（以前会显示成 R&amp;D、amp 还能点）
    var prev = str.slice(0, off).replace(/\s+$/, ""), first = !prev || /[.?!…“‘"'(\[:;—–\-]$/.test(prev), capAdj = false;
    if (/^[A-Z]/.test(w)) {
      if (/^\s+[A-Z][a-z]/.test(str.slice(off + w.length))) capAdj = true;
      var pm = /([A-Za-z'’\-]+)$/.exec(prev);
      if (pm && /^[A-Z][a-z]/.test(pm[1]) && pm[1] !== "I") { var pp = prev.slice(0, pm.index).replace(/\s+$/, ""); if (pp && !/[.?!…“(\[]$/.test(pp)) capAdj = true; }
    }
    return '<span class="' + (cls || "vs-w") + " " + vsClass(w, S, first, capAdj) + '" data-w="' + w + '">' + w + "</span>";
  });
}

function vsStems(w) {
  w = String(w).toLowerCase(); var c = [];
  function add(x) { if (x.length > 1 && x !== w && c.indexOf(x) < 0) c.push(x); }
  if (typeof VS_IRR !== "undefined" && VS_IRR[w]) add(VS_IRR[w]);
  if (/'s$/.test(w)) add(w.slice(0, -2));
  if (/ies$/.test(w)) add(w.slice(0, -3) + "y");
  if (/(ed|er)$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/es$/.test(w) && /(s|x|z|ch|sh|o)$/.test(w.slice(0, -2))) add(w.slice(0, -2));
  if (/s$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + "y");
  if (/ed$/.test(w) && /(.)\1$/.test(w.slice(0, -2))) add(w.slice(0, -3));
  if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); if (/(.)\1$/.test(w.slice(0, -3))) add(w.slice(0, -4)); }
  if (/ly$/.test(w)) add(w.slice(0, -2));
  if (/ves$/.test(w)) { add(w.slice(0, -3) + "f"); add(w.slice(0, -3) + "fe"); }
  if (/ying$/.test(w)) add(w.slice(0, -4) + "ie");
  var a = vsAdjBase(w); if (a) add(a);
  return c;
}
// 比较级 / 最高级 → 原形：taller、nicer、bigger、happiest…；只认 VS_ADJ 里的形容词（singer、winner、dinner 不算）
function vsAdjBase(w) {
  if (typeof VS_ADJ === "undefined") return "";
  var m = /^(.+?)(er|est)$/.exec(w); if (!m || m[1].length < 2) return "";
  var b = m[1], c = [b, b + "e", b.replace(/i$/, "y"), b.replace(/(.)\1$/, "$1")];
  for (var i = 0; i < c.length; i++) if (VS_ADJ.has(c[i])) return c[i];
  return "";
}

// <IRR> 由 tools/irregular.py 从 tools/irregular_data.py 生成（和生词本「📐 规律」里的不规则变化卡片同一份数据），别手改
var VS_IRR = {"alumni": "alumnus", "am": "be", "analyses": "analysis", "appendices": "appendix", "are": "be", "arisen": "arise", "arose": "arise", "ate": "eat", "awoke": "awake", "awoken": "awake", "bacteria": "bacterium", "beaten": "beat", "became": "become", "been": "be", "began": "begin", "begun": "begin", "being": "be", "bent": "bend", "bit": "bite", "bitten": "bite", "bled": "bleed", "blew": "blow", "blown": "blow", "bore": "bear", "borne": "bear", "bought": "buy", "bound": "bind", "broke": "break", "broken": "break", "brought": "bring", "built": "build", "burned": "burn", "burnt": "burn", "cacti": "cactus", "calves": "calf", "came": "come", "caught": "catch", "children": "child", "chose": "choose", "chosen": "choose", "clung": "cling", "crept": "creep", "crises": "crisis", "criteria": "criterion", "curricula": "curriculum", "dealt": "deal", "diagnoses": "diagnosis", "did": "do", "does": "do", "doing": "do", "done": "do", "dove": "dive", "drank": "drink", "drawn": "draw", "dreamed": "dream", "dreamt": "dream", "drew": "draw", "driven": "drive", "drove": "drive", "drunk": "drink", "dug": "dig", "dwelt": "dwell", "dying": "die", "eaten": "eat", "emphases": "emphasis", "fallen": "fall", "fed": "feed", "feet": "foot", "fell": "fall", "felt": "feel", "fitted": "fit", "fled": "flee", "flew": "fly", "flown": "fly", "flung": "fling", "forbade": "forbid", "forbidden": "forbid", "forgave": "forgive", "forgiven": "forgive", "forgot": "forget", "forgotten": "forget", "fought": "fight", "found": "find", "froze": "freeze", "frozen": "freeze", "fungi": "fungus", "gave": "give", "geese": "goose", "given": "give", "goes": "go", "going": "go", "gone": "go", "got": "get", "gotten": "get", "grew": "grow", "grown": "grow", "had": "have", "halves": "half", "has": "have", "having": "have", "heard": "hear", "held": "hold", "hid": "hide", "hidden": "hide", "hung": "hang", "hypotheses": "hypothesis", "indices": "index", "is": "be", "kept": "keep", "knelt": "kneel", "knew": "know", "knives": "knife", "known": "know", "laid": "lay", "lain": "lie", "leaned": "lean", "leant": "lean", "leaped": "leap", "leapt": "leap", "learned": "learn", "learnt": "learn", "led": "lead", "left": "leave", "lent": "lend", "lice": "louse", "lit": "light", "loaves": "loaf", "lost": "lose", "lying": "lie", "made": "make", "matrices": "matrix", "meant": "mean", "men": "man", "met": "meet", "mice": "mouse", "mimicked": "mimic", "mistaken": "mistake", "mistook": "mistake", "misunderstood": "misunderstand", "nuclei": "nucleus", "overcame": "overcome", "oxen": "ox", "paid": "pay", "panicked": "panic", "panicking": "panic", "phenomena": "phenomenon", "picnicked": "picnic", "proved": "prove", "proven": "prove", "radii": "radius", "ran": "run", "rang": "ring", "ridden": "ride", "risen": "rise", "rode": "ride", "rose": "rise", "rung": "ring", "said": "say", "sang": "sing", "sank": "sink", "sat": "sit", "saw": "see", "scarves": "scarf", "seen": "see", "selves": "self", "sent": "send", "sewed": "sew", "sewn": "sew", "shaken": "shake", "shelves": "shelf", "shone": "shine", "shook": "shake", "shot": "shoot", "showed": "show", "shown": "show", "shrank": "shrink", "shrunk": "shrink", "slept": "sleep", "slid": "slide", "smelled": "smell", "smelt": "smell", "sold": "sell", "sought": "seek", "spat": "spit", "sped": "speed", "spelled": "spell", "spelt": "spell", "spent": "spend", "spilled": "spill", "spilt": "spill", "spoiled": "spoil", "spoilt": "spoil", "spoke": "speak", "spoken": "speak", "sprang": "spring", "sprung": "spring", "spun": "spin", "stank": "stink", "stimuli": "stimulus", "stole": "steal", "stolen": "steal", "stood": "stand", "struck": "strike", "stuck": "stick", "stung": "sting", "stunk": "stink", "sung": "sing", "sunk": "sink", "swam": "swim", "swelled": "swell", "swept": "sweep", "swollen": "swell", "swore": "swear", "sworn": "swear", "swum": "swim", "swung": "swing", "taken": "take", "taught": "teach", "teeth": "tooth", "theses": "thesis", "thieves": "thief", "thought": "think", "threw": "throw", "thrown": "throw", "told": "tell", "took": "take", "tore": "tear", "torn": "tear", "trafficked": "traffic", "trafficking": "traffic", "tying": "tie", "understood": "understand", "undertaken": "undertake", "undertook": "undertake", "vying": "vie", "was": "be", "went": "go", "wept": "weep", "were": "be", "withdrawn": "withdraw", "withdrew": "withdraw", "wives": "wife", "woke": "wake", "woken": "wake", "wolves": "wolf", "women": "woman", "won": "win", "wore": "wear", "worn": "wear", "wove": "weave", "woven": "weave", "written": "write", "wrote": "write", "wrung": "wring"};
var VS_IRR2 = {"bases": ["basis", "base"], "best": ["good", "well"], "better": ["good", "well"], "born": ["bear"], "data": ["datum"], "elder": ["old"], "eldest": ["old"], "farther": ["far"], "farthest": ["far"], "further": ["far"], "furthest": ["far"], "ground": ["grind"], "lay": ["lie"], "least": ["little"], "leaves": ["leaf", "leave"], "less": ["little"], "lives": ["life", "live"], "media": ["medium"], "more": ["many", "much"], "most": ["many", "much"], "people": ["person"], "worse": ["bad", "badly", "ill"], "worst": ["bad", "badly", "ill"], "wound": ["wind"]}; // 一个词形对应几个原形（只用来匹配，不改它自己的原形）
var VS_ADJ = new Set("able angry big black bold brave bright brief broad brown busy calm cheap clean clear clever close cold cool crazy cruel cute damp dark dead deep dirty dry dull early easy empty fair false fancy fast fat few fine firm fit flat fresh friendly full funny gentle glad grand great green gross guilty handsome happy hard harsh healthy heavy high hot huge humble hungry ill keen kind large late lazy light likely little lively long loose loud lovely low lucky mad mean mild near neat new nice noisy odd old pale plain polite poor pretty proud pure quick quiet rare raw ready real rich right rough round rude sad safe scary shallow sharp short shy sick silly simple slim slow small smart smooth soft solid sore sour steep stiff still strange strict strong stupid sunny sure sweet tall tame tasty thick thin tidy tight tiny tough true ugly warm weak wealthy weird wet white wide wild wise yellow young".split(" ")); // 比较级 / 最高级只认这些形容词
// </IRR>
var VS_NOSTEM = new Set("news this his is was has does its us as yes always perhaps series species means less unless bus plus thus gas during thing king ring bring sing spring string wing nothing something anything everything morning evening red bed need feed seed speed indeed hundred sacred naked wicked wed shed ceiling darling sibling pudding class glass grass pass mass boss loss cross dress press stress process access success business address across miss kiss guess bless focus bonus status virus campus versus analysis basis crisis physics politics mathematics economics athletics lens chaos bias canvas christmas clothes".split(" "));
// 原形：不规则表优先，其次规则变形（词表里存在才算）
function vsLemma(w) {
  w = String(w).toLowerCase().replace(/’/g, "'");
  if (VS_IRR[w]) return VS_IRR[w];
  if (VS_NOSTEM.has(w) || w.length < 4) return w;
  var adj = vsAdjBase(w); if (adj) return adj; // bigger → big、happiest → happy
  var c = [];
  if (/ves$/.test(w)) { c.push(w.slice(0, -3) + "f"); c.push(w.slice(0, -3) + "fe"); } // leaves → leaf、knives → knife
  if (/ying$/.test(w)) c.push(w.slice(0, -4) + "ie"); // lying → lie
  if (/'s$/.test(w)) c.push(w.slice(0, -2));
  if (/ies$/.test(w)) c.push(w.slice(0, -3) + "y");
  if (/ied$/.test(w)) c.push(w.slice(0, -3) + "y");
  if (/ed$/.test(w)) { c.push(w.slice(0, -2)); c.push(w.slice(0, -1)); }
  if (/es$/.test(w) && /(s|x|z|ch|sh|o)$/.test(w.slice(0, -2))) c.push(w.slice(0, -2)); // boxes → box；wines 只去 -s（不当成 win）
  if (/ed$/.test(w) && /(.)\1$/.test(w.slice(0, -2))) c.push(w.slice(0, -3));
  if (/ing$/.test(w)) { if (/(.)\1$/.test(w.slice(0, -3))) c.push(w.slice(0, -4)); c.push(w.slice(0, -3)); c.push(w.slice(0, -3) + "e"); }
  if (/s$/.test(w) && !/ss$/.test(w)) c.push(w.slice(0, -1));
  if (/iest$/.test(w)) c.push(w.slice(0, -4) + "y");
  var best = w, br = Infinity;
  for (var i = 0; i < c.length; i++) { var r = VS_RANK[c[i]]; if (c[i].length >= 3 && r && r < br) { best = c[i]; br = r; } }
  if (best === w && !VS_RANK[w]) { if (/'s$/.test(w)) return vsLemma(w.slice(0, -2)); if (/[^s]s$/.test(w) && w.length > 4) return w.slice(0, -1); }
  return best;
}
