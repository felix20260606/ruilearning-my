/* 雅思「✍️ 写作批改」：选题 → 写作（词数、计时、草稿自动保存）→ 批改，结果分三层：
   a) 语法拼写：LanguageTool 免费公共接口（api.languagetool.org，支持 CORS，限 20 次/分钟、20KB）
   b) 本地分析：不联网。词数句数、用词多样性、按词频的用词水平（web/vs/freq.js + vs/vlevel.js，按需加载）、
      重复词和替换建议、连接词、复杂句、被动语态、口语化表达
   c) AI 评分：本站后台 POST /api/ai（Cloudflare Workers AI，免费，可能没开）；另给一个只靠 a、b 数据的「本地粗估分」
   入口：window.writingShow(el) 把整个界面画进 el。
   本地存储：writing:draft 草稿、writing:history 批改历史（最多 30 条，新的在前）、writing:lang 美式/英式
   用到页面全局（有才用）：speak(text)、toast(msg)
   本地分析部分是纯函数（不碰 DOM），在 node 里 require 本文件可以拿到它们单独测试。 */
(function () {
  "use strict";

  /* ================= 一、内置数据 ================= */
  const TYPES = {
    task2: { t: "IELTS Task 2 议论文", s: "Task 2", words: 250, min: 40 },
    task1: { t: "IELTS Task 1 图表描述", s: "Task 1", words: 150, min: 20 },
    email: { t: "邮件 / 书信", s: "书信", words: 150, min: 20 },
    free: { t: "自由写作", s: "自由", words: 0, min: 30 },
  };
  const T2_END = "\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.";
  const T1_END = "\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.";
  const EM_END = "\n\nWrite at least 150 words. You do NOT need to write any addresses.";

  // 题库（原创练习题，不是真题）
  const BANK = {
    task2: [
      ["教育", "Some people believe that universities should mainly prepare students for specific careers, while others think the main purpose of higher education is to develop independent and critical thinking. Discuss both views and give your own opinion."],
      ["教育", "In many countries, school students are given more homework than ever before. Do the advantages of this outweigh the disadvantages?"],
      ["教育", "Some argue that printed textbooks in schools should be completely replaced by tablets and online learning materials. To what extent do you agree or disagree?"],
      ["教育", "It is often claimed that children should start learning a foreign language at primary school rather than at secondary school. To what extent do you agree or disagree?"],
      ["科技", "Artificial intelligence is increasingly used to make decisions in areas such as hiring staff and approving bank loans. What problems could this cause, and how can they be addressed?"],
      ["科技", "Many people now rely on their smartphones to remember phone numbers, find their way and do simple calculations. Is this a positive or negative development?"],
      ["科技", "Some people think that social media companies should be legally responsible for false information that their users post. To what extent do you agree or disagree?"],
      ["科技", "Online video meetings are replacing a large number of business trips. Do the advantages of this trend outweigh the disadvantages?"],
      ["环境", "Some people believe that individuals can do very little to protect the environment and that only governments and large companies can make a real difference. To what extent do you agree or disagree?"],
      ["环境", "Many cities have banned single-use plastic bags. Some people think such bans should be extended to all disposable plastic products. Discuss both views and give your own opinion."],
      ["环境", "The number of flights people take for holidays is rising quickly. What are the environmental consequences of this trend, and what measures could reduce them?"],
      ["城市", "In many countries, young people are moving from rural areas to large cities. What are the reasons for this, and what effects does it have on the countryside?"],
      ["城市", "Some city planners argue that private cars should be banned from city centres. Do the advantages of such a policy outweigh the disadvantages?"],
      ["城市", "Housing in many major cities has become too expensive for ordinary workers. What are the causes of this problem, and what solutions can you suggest?"],
      ["工作", "Some companies are trying out a four-day working week. Is this a positive or negative development for employees and employers?"],
      ["工作", "Some people prefer to stay with one employer for most of their career, while others prefer to change jobs every few years. Discuss both views and give your own opinion."],
      ["工作", "As automation spreads, many traditional jobs may disappear. Some people think governments should give every adult a basic income. To what extent do you agree or disagree?"],
      ["健康", "Childhood obesity is rising in many countries. Some people think parents are mainly responsible, while others blame food and drink companies. Discuss both views and give your own opinion."],
      ["健康", "Some people argue that sugary drinks should be heavily taxed in order to improve public health. To what extent do you agree or disagree?"],
      ["健康", "People in many countries are living longer than ever before. What problems does an ageing population create, and how can societies prepare for them?"],
      ["政府", "Some people think public money should be spent on preserving historic buildings, while others believe it should be used for new housing and roads. Discuss both views and give your own opinion."],
      ["政府", "Many governments spend large amounts of money on space exploration. Some people say this money would be better spent on solving problems on Earth. To what extent do you agree or disagree?"],
      ["政府", "Some people believe that public transport in cities should be free for everyone. Do the advantages of this outweigh the disadvantages?"],
      ["社会", "Some people think that longer prison sentences are the most effective way to reduce crime. Others believe there are better alternatives. Discuss both views and give your own opinion."],
      ["文化", "International tourism has grown enormously in recent decades. Some say it helps people understand other cultures, while others believe it damages local traditions. Discuss both views and give your own opinion."],
    ],
    task1: [
      ["表格", "The table below shows the average daily water use per person (in litres) in three countries in 2010, 2015 and 2020.\n\nCountry   2010   2015   2020\nCanada     330    305    280\nSpain      265    250    240\nIndia      140    155    175"],
      ["折线图", "The line graph shows the percentage of commuters in one city who travelled to work by car, bus and bicycle between 2000 and 2020.\n\nYear   Car   Bus   Bicycle\n2000   62%   28%    5%\n2005   60%   27%    8%\n2010   55%   26%   12%\n2015   49%   27%   17%\n2020   43%   29%   21%"],
      ["柱状图", "The bar chart shows the average number of hours per week that people in five age groups spent online in 2023.\n\nAge group   Hours per week\n16-24       34\n25-34       29\n35-49       22\n50-64       15\n65+          8"],
      ["饼图", "The two pie charts compare how an average household in one country spent its income in 1990 and 2020.\n\nCategory        1990   2020\nHousing          24%    35%\nFood             30%    18%\nTransport        14%    16%\nEntertainment     8%    13%\nHealth            6%    10%\nOther            18%     8%"],
      ["流程图", "The diagram shows how used plastic bottles are recycled into new products.\n\nStep 1  Bottles are collected from recycling bins\nStep 2  Bottles are sorted by colour and type of plastic\nStep 3  Labels and caps are removed and bottles are washed\nStep 4  Clean bottles are crushed into small flakes\nStep 5  Flakes are melted and formed into pellets\nStep 6  Pellets are used to make new bottles, clothing fibre or furniture"],
      ["地图", "The two maps show the village of Westbrook in 2000 and today.\n\nArea     2000              Today\nNorth    Farmland          Housing estate (120 homes)\nCentre   Shop, post office Supermarket; post office closed\nEast     Forest            Half the forest cut down; car park\nSouth    Railway station   Station kept; new cycle path to town\nWest     Football field    Football field and a new primary school"],
      ["表格", "The table shows what graduates from four universities were doing six months after finishing their degrees in 2022 (percentage of graduates).\n\nUniversity  Working  Study  Unemployed  Other\nNorthfield    68%     18%       9%       5%\nEastgate      54%     31%       8%       7%\nRiverside     72%     10%      12%       6%\nHillcrest     61%     24%       6%       9%"],
      ["折线图", "The line graph shows the share of electricity produced from four sources in one country from 1990 to 2020.\n\nSource       1990   2000   2010   2020\nCoal          60%    52%    41%    28%\nGas           15%    24%    33%    36%\nNuclear       20%    15%     9%     5%\nRenewables     5%     9%    17%    31%"],
      ["柱状图", "The bar chart shows the percentage of men and women in one country who took part in five sports at least once a month in 2022.\n\nSport      Men   Women\nRunning    32%   27%\nSwimming   18%   24%\nFootball   21%    6%\nCycling    25%   15%\nYoga        5%   19%"],
      ["表格", "The table shows the number of visitors (in thousands) to three museums in one city between 2016 and 2022.\n\nMuseum           2016   2018   2020   2022\nScience Museum    820    860    240    790\nArt Gallery       610    650    180    520\nHistory Museum    430    410    120    470"],
    ],
    email: [
      ["投诉", "You ordered an item online, but it arrived damaged. Write a letter to the company. In your letter:\n- give details of your order\n- describe the damage\n- say what you want the company to do"],
      ["请求", "You recently stayed at a hotel and left something valuable in your room. Write a letter to the hotel manager. In your letter:\n- describe what you left and where\n- explain why it is important to you\n- say what you would like the manager to do"],
      ["邻里", "Your neighbour has been making noise late at night. Write a letter to your neighbour. In your letter:\n- explain the problem\n- describe how it affects you\n- suggest a solution"],
      ["朋友", "A friend is visiting your city for the first time next month. Write an email to your friend. In your email:\n- suggest some places to visit\n- recommend where to stay\n- give advice about getting around"],
      ["咨询", "You want to take a short evening course at a local college. Write a letter to the college. In your letter:\n- say which course you are interested in\n- explain why you want to take it\n- ask about fees and the timetable"],
      ["工作", "Your manager has asked staff for ideas to improve the workplace. Write a letter to your manager. In your letter:\n- describe a problem in the office\n- suggest an improvement\n- explain how it would help staff"],
    ],
    free: [
      ["生活", "Describe a skill you would like to learn in the next year and explain why it matters to you."],
      ["经历", "Write about a time when you changed your mind about something important."],
      ["城市", "Describe the city you live in to someone who has never been there."],
      ["观点", "Is it better to have a few close friends or many casual friends? Explain your view."],
      ["科技", "How has the internet changed the way you learn English?"],
      ["未来", "Describe what you think a typical working day will look like in 2040."],
    ],
  };
  BANK.task2.forEach(x => (x[1] += T2_END));
  BANK.task1.forEach(x => (x[1] += T1_END));
  BANK.email.forEach(x => (x[1] += EM_END));

  // 常见词 → 高级同义词（约 60 组）
  const SYN = {
    good: ["beneficial", "favourable", "advantageous"], bad: ["detrimental", "harmful", "adverse"], big: ["substantial", "considerable", "significant"],
    small: ["minor", "modest", "marginal"], very: ["extremely", "highly", "remarkably"], show: ["illustrate", "demonstrate", "reveal"],
    think: ["believe", "contend", "maintain"], important: ["crucial", "vital", "essential"], help: ["assist", "facilitate", "support"],
    get: ["obtain", "acquire", "gain"], make: ["create", "generate", "produce"], use: ["utilise", "employ", "adopt"],
    many: ["numerous", "a wide range of", "a multitude of"], change: ["alter", "transform", "modify"], problem: ["issue", "challenge", "drawback"],
    increase: ["rise", "surge", "grow considerably"], decrease: ["decline", "drop", "diminish"], people: ["individuals", "citizens", "the public"],
    way: ["method", "approach", "means"], need: ["require", "necessitate", "call for"], give: ["provide", "offer", "grant"],
    keep: ["maintain", "retain", "preserve"], start: ["commence", "initiate", "launch"], try: ["attempt", "endeavour", "strive"],
    say: ["state", "argue", "assert"], want: ["wish", "desire", "aspire"], easy: ["straightforward", "effortless", "manageable"],
    hard: ["challenging", "demanding", "arduous"], difficult: ["challenging", "demanding", "complex"], cheap: ["affordable", "inexpensive", "economical"],
    expensive: ["costly", "prohibitive", "high-priced"], rich: ["affluent", "wealthy", "prosperous"], poor: ["deprived", "disadvantaged", "low-income"],
    old: ["elderly", "ageing", "outdated"], happy: ["content", "satisfied", "fulfilled"], clear: ["evident", "apparent", "obvious"],
    real: ["genuine", "authentic", "actual"], main: ["primary", "principal", "predominant"], enough: ["sufficient", "adequate", "ample"],
    fast: ["rapid", "swift", "speedy"], grow: ["expand", "flourish", "develop"], find: ["discover", "identify", "detect"],
    choose: ["select", "opt for", "decide on"], buy: ["purchase", "acquire", "invest in"], stop: ["cease", "halt", "curb"],
    allow: ["permit", "enable", "authorise"], idea: ["notion", "concept", "proposal"], job: ["occupation", "profession", "employment"],
    money: ["funds", "finance", "income"], hurt: ["harm", "damage", "undermine"], affect: ["influence", "impact", "shape"],
    cause: ["trigger", "give rise to", "contribute to"], improve: ["enhance", "boost", "refine"], reduce: ["minimise", "alleviate", "curb"],
    solve: ["resolve", "tackle", "address"], part: ["component", "proportion", "element"], benefit: ["advantage", "merit", "upside"],
    interesting: ["fascinating", "engaging", "compelling"], nice: ["pleasant", "agreeable", "appealing"], great: ["tremendous", "remarkable", "outstanding"],
    huge: ["enormous", "immense", "vast"], look: ["examine", "consider", "observe"], lead: ["result in", "bring about", "give rise to"],
    deal: ["tackle", "address", "cope with"], maybe: ["perhaps", "possibly", "potentially"],
  };
  const IRR = { made: "make", got: "get", gotten: "get", gave: "give", given: "give", said: "say", thought: "think", found: "find", kept: "keep", chose: "choose", chosen: "choose", bought: "buy", grew: "grow", grown: "grow", shown: "show", led: "lead", dealt: "deal", better: "good", best: "good", worse: "bad", worst: "bad", bigger: "big", biggest: "big", larger: "large", smaller: "small", easier: "easy", harder: "hard", richer: "rich", poorer: "poor", older: "old", children: "child", women: "woman", men: "man", went: "go", gone: "go", took: "take", taken: "take", ran: "run", began: "begin", begun: "begin", wrote: "write", written: "write", is: "be", are: "be", was: "be", were: "be", been: "be", am: "be", has: "have", had: "have", does: "do", did: "do", done: "do" };

  // 功能词（不算「用词水平」「重复词」）
  const STOP = new Set(("a an the and or but nor so yet for of in on at to from by with without about above below over under into onto upon out up down off through during before after since until while as than then " +
    "i me my mine myself you your yours yourself we us our ours ourselves he him his himself she her hers herself it its itself they them their theirs themselves one ones " +
    "this that these those there here who whom whose which what when where why how whether if because although though unless whereas " +
    "be am is are was were been being have has had having do does did doing done will would shall should can could may might must ought " +
    "not no yes all any some each every both either neither few more most much many other another such own same very too also just only even still already " +
    "s t d ll m re ve don doesn didn isn aren wasn weren won wouldn can't cannot let let's it's i'm don't doesn't didn't isn't aren't").split(" "));

  // 连接词分类（每组前面的更高级，推荐时优先推荐前面的）
  const LINKS = [
    { k: "add", t: "递进", w: ["furthermore", "moreover", "what is more", "in addition", "additionally", "not only", "besides", "also", "and"] },
    { k: "contrast", t: "转折对比", w: ["nevertheless", "nonetheless", "conversely", "in contrast", "on the other hand", "whereas", "even though", "although", "though", "despite", "in spite of", "however", "while", "yet", "but"] },
    { k: "cause", t: "因果", w: ["consequently", "as a consequence", "hence", "thus", "therefore", "as a result", "owing to", "due to", "because of", "because", "since", "so"] },
    { k: "example", t: "举例", w: ["a case in point is", "to illustrate", "namely", "in particular", "for instance", "for example", "such as"] },
    { k: "sum", t: "总结", w: ["to sum up", "in summary", "all in all", "on the whole", "to conclude", "in conclusion", "ultimately", "overall", "in short"] },
    { k: "order", t: "顺序", w: ["to begin with", "first of all", "subsequently", "firstly", "secondly", "thirdly", "finally", "lastly", "meanwhile", "first,", "second,", "then"] },
    { k: "view", t: "观点让步", w: ["admittedly", "arguably", "undoubtedly", "it is widely believed", "from my perspective", "in my view", "in my opinion", "i believe", "i think"] },
    { k: "similar", t: "类比", w: ["similarly", "likewise", "in the same way", "equally"] },
  ];

  // 口语化 / 不正式表达
  const INFORMAL = [
    [/\ba lot of\b/gi, "a great deal of / a large number of / numerous"],
    [/\blots of\b/gi, "a large number of / plenty of"],
    [/\b(?:tons|loads) of\b/gi, "a large amount of / a great many"],
    [/\bgonna\b/gi, "going to"], [/\bwanna\b/gi, "want to"], [/\bgotta\b/gi, "have to"],
    [/\bkids?\b/gi, "children / a child / young people"],
    [/\bstuff\b/gi, "things / materials / belongings"],
    [/\bthings?\b/gi, "aspect / factor / issue（说具体）"],
    [/\b(?:ok|okay)\b/gi, "acceptable / satisfactory"],
    [/\byeah\b/gi, "yes"],
    [/\bguys\b/gi, "people"],
    [/\bpretty (?=[a-z]{3,})/gi, "fairly / rather / quite"],
    [/\breally\b/gi, "genuinely / particularly（或删去）"],
    [/\b(?:totally|basically|super|awesome|cool)\b/gi, "换成 completely / essentially / extremely 等，或删去"],
    [/\b(?:kind|sort) of\b/gi, "somewhat / to some extent"],
    [/\bget(?:s|ting)? (?:better|worse)\b/gi, "improve / deteriorate"],
    [/\bbig deal\b/gi, "a significant issue"],
    [/\bmaybe\b/gi, "perhaps / possibly"],
    [/\band so on\b/gi, "among others / and other similar ..."],
    [/!/g, "议论文避免感叹号，用句子本身表达语气"],
  ];

  /* ================= 二、本地分析（纯函数） ================= */
  const WORD_RE = /\d+(?:[.,]\d+)+|[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g; // 3.5、1,000 算一个词
  const words = text => String(text || "").match(WORD_RE) || [];
  const countWords = text => words(text).length;
  const lc = w => String(w).toLowerCase().replace(/’/g, "'");
  const round1 = x => Math.round(x * 10) / 10;

  // 分句：先保护缩写和小数里的点
  // ✂️ 分句：全站共用（util.js 的 U.sents：缩写、人名首字母、小数不断句；node 里跑要先加载 util.js）
  const sentences = text => (typeof U !== "undefined" ? U.sents(text) : String(text || "").split(/(?<=[.!?…])\s+|\n+/)).map(s => s.trim()).filter(s => /[A-Za-z0-9]/.test(s));

  const paragraphs = text => String(text || "").split(/\n+/).filter(p => /[A-Za-z0-9]/.test(p));

  // 在词表里找这个词的原形（只用于 SYN 这类小表）
  function keyIn(w, dict) {
    w = lc(w);
    if (dict[w]) return w;
    if (IRR[w] && dict[IRR[w]]) return IRR[w];
    const c = [];
    if (/ies$/.test(w)) c.push(w.slice(0, -3) + "y");
    if (/ied$/.test(w)) c.push(w.slice(0, -3) + "y");
    if (/(es|ed)$/.test(w)) c.push(w.slice(0, -2), w.slice(0, -1));
    if (/ing$/.test(w)) c.push(w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4));
    if (/s$/.test(w)) c.push(w.slice(0, -1));
    if (/ed$/.test(w)) c.push(w.slice(0, -3));
    for (const x of c) if (x.length > 1 && dict[x]) return x;
    return null;
  }
  // 原形：有 vlevel.js 的 vsLemma 就用它，没有就只做最保守的处理
  function lemmaOf(w, lemma) {
    w = lc(w);
    if (IRR[w]) return IRR[w];
    if (lemma) { try { return lemma(w) || w; } catch (e) {} }
    if (w.length > 4 && /[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  // 用词多样性：TTR（不同词数 / 总词数）和 MATTR（50 词滑动窗口的平均 TTR，不太受文章长短影响）
  function diversity(ws) {
    const a = ws.map(lc), n = a.length;
    const ttr = n ? new Set(a).size / n : 0;
    const W = 50;
    if (n < W) return { ttr, mattr: ttr };
    const cnt = new Map(); let uniq = 0, sum = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i]; cnt.set(x, (cnt.get(x) || 0) + 1); if (cnt.get(x) === 1) uniq++;
      if (i >= W) { const y = a[i - W]; cnt.set(y, cnt.get(y) - 1); if (cnt.get(y) === 0) uniq--; }
      if (i >= W - 1) sum += uniq / W;
    }
    return { ttr, mattr: sum / (n - W + 1) };
  }

  // 用词水平：按 OpenSubtitles 词频排名分 4 档（只看实词）
  const BANDS = [{ t: "基础", max: 2000 }, { t: "常用", max: 5000 }, { t: "中高级", max: 10000 }, { t: "高级", max: Infinity }];
  function levelDist(ws, rank, lemma, skip) {
    if (typeof rank !== "function") return null;
    const bands = [0, 0, 0, 0], adv = new Map();
    let total = 0;
    ws.forEach((w, i) => {
      const k = lc(w);
      if (STOP.has(k) || /\d/.test(k) || k.length < 2 || (skip && skip.has(k))) return;
      let r = rank(k);
      if (lemma) { const l = lemmaOf(k, lemma); if (l !== k) { const r2 = rank(l); if (r2 && r2 < (r || Infinity)) r = r2; } }
      if (r === 0) return;
      if (!r || r === Infinity) { if (k.length < 4 || /^[A-Z]/.test(w)) return; r = Infinity; } // 词表里没有：大写开头当专有名词跳过
      const b = BANDS.findIndex(x => r <= x.max);
      bands[b]++; total++;
      if (b >= 2) adv.set(k, (adv.get(k) || 0) + 1);
    });
    return { bands, total, advRatio: total ? (bands[2] + bands[3]) / total : 0, advWords: [...adv.keys()].slice(0, 30) };
  }

  // 重复太多的词 + 替换建议
  function overused(ws, lemma, promptText) {
    const cnt = new Map(), forms = new Map(), syn = new Map();
    const pw = new Set(words(promptText).map(w => lemmaOf(w, lemma)));
    ws.forEach(w => {
      const k = lc(w);
      const sk = keyIn(k, SYN);
      if (sk) syn.set(sk, (syn.get(sk) || 0) + 1);
      if (STOP.has(k) || /\d/.test(k) || k.length < 3) return;
      const l = sk || lemmaOf(k, lemma);
      cnt.set(l, (cnt.get(l) || 0) + 1);
      if (!forms.has(l)) forms.set(l, new Set()); forms.get(l).add(k);
    });
    const lim = Math.max(3, Math.round(ws.length / 80));
    const list = [];
    cnt.forEach((n, l) => {
      const s = SYN[l];
      if ((s && n >= 2) || n >= lim) list.push({ w: l, n, forms: [...forms.get(l)], syn: s || null, topic: pw.has(l) });
    });
    // 「very」等在 STOP 里，单独补上
    syn.forEach((n, l) => { if (STOP.has(l) && n >= 2 && !list.some(x => x.w === l)) list.push({ w: l, n, forms: [l], syn: SYN[l], topic: false }); });
    list.sort((a, b) => (b.syn ? 1 : 0) - (a.syn ? 1 : 0) || b.n - a.n);
    const once = [...syn.entries()].filter(([l, n]) => n === 1).map(([l]) => ({ w: l, syn: SYN[l] }));
    return { list: list.slice(0, 14), once: once.slice(0, 12), lim };
  }

  // 连接词统计：长的短语先匹配，匹配过的位置抹掉，避免 even though 又算一次 though
  function connectives(text, type) {
    let s = " " + lc(text).replace(/\s+/g, " ") + " ";
    const all = [];
    LINKS.forEach(g => g.w.forEach(p => all.push([p, g.k])));
    all.sort((a, b) => b[0].length - a[0].length);
    const used = {};
    LINKS.forEach(g => (used[g.k] = {}));
    all.forEach(([p, k]) => {
      const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("(^|[^a-z'])" + esc + (/[a-z]$/.test(p) ? "(?![a-z'])" : ""), "g");
      s = s.replace(re, (m, pre) => { used[k][p] = (used[k][p] || 0) + 1; return pre + " ".repeat(m.length - pre.length); });
    });
    const cats = LINKS.map(g => {
      const u = used[g.k], total = Object.values(u).reduce((a, b) => a + b, 0);
      return { k: g.k, t: g.t, used: u, total, unused: g.w.filter(p => !u[p] && !/,$/.test(p) && !/^(and|but|so|then|i think|also|yet)$/.test(p)) };
    });
    const distinct = cats.reduce((a, c) => a + Object.keys(c.used).filter(p => !/^(and|but|so|then)$/.test(p)).length, 0);
    const total = cats.reduce((a, c) => a + c.total, 0);
    const tips = [], nW = countWords(text), C = Object.fromEntries(cats.map(c => [c.k, c]));
    cats.forEach(c => Object.entries(c.used).forEach(([p, n]) => {
      const lim = /^(and|but|so)$/.test(p) ? 8 : 3;
      if (n >= lim && n / c.total >= 0.5) tips.push("「" + p + "」用了 " + n + " 次，" + c.t + "还可以用：" + c.unused.slice(0, 4).join(" / "));
    }));
    if (nW >= 120 && distinct < 4) tips.push("连接词种类偏少（" + distinct + " 种），句子之间的逻辑关系不够清楚，可以多用 however、moreover、as a result、for instance 等");
    if (type === "task2" && nW >= 120) {
      if (!C.contrast.total || Object.keys(C.contrast.used).every(p => p === "but")) tips.push("几乎没有转折：讨论另一方观点或让步时可以用 " + C.contrast.unused.slice(0, 4).join(" / "));
      if (!C.example.total) tips.push("没有举例的连接词：可以用 " + C.example.unused.slice(0, 4).join(" / ") + " 引出例子");
      if (!C.sum.total) tips.push("结尾段没看到总结词：可以用 in conclusion / to sum up 开头");
    }
    if (type === "task1" && nW >= 60) {
      if (!C.sum.used.overall) tips.push("Task 1 一定要有总览（overview），通常用 Overall, ... 开头写最主要的趋势或对比");
      if (!C.contrast.used.whereas && !C.contrast.used.while && !C.contrast.used["in contrast"] && !C.similar.total) tips.push("Task 1 要做比较：可以用 whereas / while / in contrast / similarly");
    }
    return { cats, distinct, total, tips };
  }

  // 复杂句：含从句标志词的句子
  const SUB_RE = /\b(which|that|who|whom|whose|although|though|because|if|while|whereas|when|unless|since|until|once|where|whether|so that|even if|provided that|as long as)\b/i;
  function complexSentences(sents) {
    const hit = sents.filter(s => SUB_RE.test(s));
    return { n: hit.length, ratio: sents.length ? hit.length / sents.length : 0 };
  }

  // 被动语态：be 动词 +（最多两个副词）+ 过去分词
  const PP_IRR = "made|done|given|taken|seen|known|shown|built|written|found|held|kept|left|lost|paid|sold|spent|told|thought|brought|bought|caught|taught|chosen|driven|eaten|fallen|forgotten|hidden|grown|thrown|worn|broken|spoken|stolen|beaten|born|cut|put|set|hit|hurt|shut|spread|led|fed|met|sent|understood|drawn|begun|won|felt|heard|meant|run";
  const PASSIVE_RE = new RegExp("\\b(?:am|is|are|was|were|be|been|being)\\s+(?:(?:not|also|often|usually|widely|generally|always|never|still|now|largely|mainly|increasingly|being|\\w+ly)\\s+){0,2}(\\w+ed|" + PP_IRR + ")\\b", "gi");
  const NOT_PP = /^(tired|interested|bored|excited|worried|married|pleased|surprised|satisfied|scared|frightened|ashamed|red|bed|shed|need|seed|speed|feed|hundred|indeed|sacred|naked|wicked|beloved|aged|talented|skilled|crowded|complicated|sophisticated|advanced|detailed|related|limited|qualified|experienced|educated|dedicated|determined|devoted|supposed)$/i;
  function passives(text) {
    const out = []; let m;
    PASSIVE_RE.lastIndex = 0;
    while ((m = PASSIVE_RE.exec(text))) if (!NOT_PP.test(m[1])) out.push(m[0]);
    return { n: out.length, list: out.slice(0, 6) };
  }

  // 口语化表达和缩写
  function expandContraction(w) {
    const k = lc(w), sp = { "can't": "cannot", "won't": "will not", "shan't": "shall not", "let's": "let us", "ain't": "is not" };
    if (sp[k]) return sp[k];
    let m;
    if ((m = /^(.+)n't$/.exec(k))) return m[1] + " not";
    if ((m = /^(.+)'re$/.exec(k))) return m[1] + " are";
    if ((m = /^(.+)'m$/.exec(k))) return m[1] + " am";
    if ((m = /^(.+)'ll$/.exec(k))) return m[1] + " will";
    if ((m = /^(.+)'ve$/.exec(k))) return m[1] + " have";
    if ((m = /^(.+)'d$/.exec(k))) return m[1] + " would / had";
    if ((m = /^(.+)'s$/.exec(k))) return m[1] + " is / has";
    return k;
  }
  function informal(text) {
    const t = String(text || ""), map = new Map();
    const add = (s, fix, cat) => { const k = lc(s); const o = map.get(k) || { text: s, n: 0, fix, cat }; o.n++; map.set(k, o); };
    INFORMAL.forEach(([re, fix]) => { re.lastIndex = 0; (t.match(re) || []).forEach(s => add(s.trim(), fix, s === "!" ? "标点" : "口语")); });
    (t.match(/\b[A-Za-z]+(?:n['’]t|['’](?:re|m|ll|ve|d))\b/g) || []).forEach(s => add(s, expandContraction(s), "缩写"));
    (t.match(/\b(?:it|that|there|what|he|she|who|here|where|let)['’]s\b/gi) || []).forEach(s => add(s, expandContraction(s), "缩写"));
    const you = (t.match(/\byou\b/gi) || []).length;
    const list = [...map.values()].sort((a, b) => b.n - a.n);
    return { list, total: list.reduce((a, x) => a + x.n, 0), you };
  }

  // 汇总：一次算出本地分析的全部结果
  function analyze(text, opts) {
    opts = opts || {};
    const ws = words(text), sents = sentences(text), paras = paragraphs(text);
    const dv = diversity(ws);
    return {
      words: ws.length,
      sentences: sents.length,
      avgLen: sents.length ? round1(ws.length / sents.length) : 0,
      paragraphs: paras.length,
      ttr: Math.round(dv.ttr * 100) / 100,
      ttrRaw: dv.ttr,
      mattr: dv.mattr,
      level: levelDist(ws, opts.rank, opts.lemma, opts.skip),
      overused: overused(ws, opts.lemma, opts.prompt || ""),
      links: connectives(text, opts.type),
      complex: complexSentences(sents),
      passive: passives(text),
      informal: informal(text),
    };
  }

  // LanguageTool 的规则分到 4 类
  function ltCat(m) {
    const c = (m && m.rule && m.rule.category && m.rule.category.id) || "", t = (m && m.rule && m.rule.issueType) || "";
    if (/PUNCTUATION|TYPOGRAPHY/.test(c) || t === "whitespace" || t === "typographical") return "punct";
    if (/TYPOS|CASING|CONFUSED_WORDS/.test(c) || (t === "misspelling" && !/GRAMMAR|MISC/.test(c))) return "spell";
    if (/STYLE|REDUNDANCY|PLAIN_ENGLISH|COLLOQUIALISMS|REGISTER|SEMANTICS|CREATIVE_WRITING|WIKIPEDIA/.test(c) || t === "style" || t === "locale-violation" || t === "register") return "style";
    return "grammar";
  }
  function catCount(matches) {
    const c = { spell: 0, grammar: 0, punct: 0, style: 0 };
    (matches || []).forEach(m => (c[m.cat || ltCat(m)]++));
    return c;
  }

  // 本地粗估分：只根据 a（错误数）和 b（本地分析）估 LR、GRA，粗估仅供参考
  function estimate(loc, cats, ltOk) {
    if (!loc || loc.words < 50) return null;
    const per = x => (x / loc.words) * 100, clamp = x => Math.max(4, Math.min(8, Math.round(x * 2) / 2));
    const lrWhy = [], graWhy = [];
    let lr = 5.5;
    const adv = loc.level ? loc.level.advRatio : null;
    if (adv != null) {
      if (adv >= 0.3) { lr += 1.5; lrWhy.push("中高级词占比高"); } else if (adv >= 0.22) { lr += 1; lrWhy.push("中高级词较多"); } else if (adv >= 0.15) { lr += 0.5; } else if (adv < 0.08) { lr -= 0.5; lrWhy.push("基础词为主"); }
    }
    if (loc.mattr >= 0.8) { lr += 0.5; lrWhy.push("用词多样"); } else if (loc.mattr < 0.7) { lr -= 0.5; lrWhy.push("重复用词偏多"); }
    if (ltOk) {
      const sp = per(cats.spell);
      if (sp === 0) lr += 0.5; else if (sp > 2.5) { lr -= 1; lrWhy.push("拼写错误多"); } else if (sp > 1) { lr -= 0.5; lrWhy.push("有拼写错误"); }
    }
    if (loc.informal.total >= 3) { lr -= 0.5; lrWhy.push("口语化表达偏多"); }
    if (loc.overused.list.filter(x => x.syn).length >= 3) { lr -= 0.5; lrWhy.push("基础词反复使用"); }
    let gra = 5.5;
    if (ltOk) {
      const ge = per(cats.grammar + cats.punct);
      if (ge === 0) { gra += 1; graWhy.push("没查到语法错误"); } else if (ge <= 1) gra += 0.5; else if (ge <= 2.5) {} else if (ge <= 4) { gra -= 0.5; graWhy.push("语法错误较多"); } else { gra -= 1; graWhy.push("语法错误多"); }
    }
    const cr = loc.complex.ratio;
    if (cr >= 0.5) { gra += 1; graWhy.push("复杂句多"); } else if (cr >= 0.3) { gra += 0.5; graWhy.push("有一定复杂句"); } else if (cr < 0.15) { gra -= 0.5; graWhy.push("复杂句少"); }
    if (loc.avgLen < 10) { gra -= 0.5; graWhy.push("句子偏短"); } else if (loc.avgLen >= 14 && loc.avgLen <= 28) gra += 0.25;
    if (loc.passive.n >= 1) gra += 0.25;
    return { LR: clamp(lr), GRA: clamp(gra), lrWhy, graWhy, noLT: !ltOk };
  }

  const API = { TYPES, BANK, SYN, LINKS, words, countWords, sentences, paragraphs, diversity, levelDist, overused, connectives, complexSentences, passives, informal, expandContraction, analyze, ltCat, catCount, estimate, keyIn };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const { esc, LG, LS } = U; // 全站共用的小工具（util.js）

  /* ================= 三、界面 ================= */
  const say = m => { if (typeof window.toast === "function") window.toast(m); else if (typeof toast === "function") toast(m); };
  const talk = t => { if (typeof window.speak === "function") window.speak(t); else if (typeof speak === "function") speak(t); else say("这个页面没有朗读功能"); };
  const CAT = { spell: "拼写", grammar: "语法", punct: "标点", style: "风格" };
  const HMAX = 30;

  const CSS = `
  .wr{max-width:920px;margin:0 auto;padding:8px 0 48px;color:var(--ui-ink);font-family:var(--ui-font);box-sizing:border-box}
  .wr *,.wr *::before,.wr *::after{box-sizing:border-box}
  .wr-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:4px 0 12px}
  .wr-hd h2{margin:0;font-size:20px;font-weight:900}
  .wr-card{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:var(--ui-radius);padding:14px 16px;margin-bottom:12px;min-width:0}
  .wr-card h3{margin:0 0 10px;font-size:15.5px;font-weight:800;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .wr-card h3 small{font-weight:500;color:var(--ui-muted);font-size:12.5px}
  .wr .ui-tabs{flex-wrap:wrap}.wr .ui-tabs>*{flex:1 1 140px;min-width:0;font-size:13px;padding:8px 4px}
  .wr .ui-tabs>* small{display:block;font-weight:500;font-size:11px;opacity:.75}
  .wr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}
  .wr-row>.grow{flex:1 1 200px;min-width:0}
  .wr select{width:100%;height:38px;border-radius:var(--ui-radius-sm);border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;font-size:13.5px;padding:0 8px;min-width:0}
  .wr textarea{width:100%;display:block;border-radius:12px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;padding:12px 14px;resize:vertical;line-height:1.6}
  .wr textarea:focus,.wr select:focus{outline:2px solid var(--ui-pur-line);border-color:var(--ui-pur)}
  .wr-prompt{margin-top:8px;min-height:92px;font-size:14px}
  .wr-prompt.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;white-space:pre;overflow-x:auto}
  .wr-text{min-height:340px;font-size:16px}
  .wr-note{font-size:12px;color:var(--ui-muted);margin-top:6px;line-height:1.5}
  .wr-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
  .wr-wc{display:flex;align-items:center;gap:8px;flex:1 1 220px;min-width:0;font-size:13.5px}
  .wr-wc b{font-size:18px;font-variant-numeric:tabular-nums}
  .wr-prog{flex:1 1 80px;height:8px;border-radius:99px;background:var(--ui-surface-3);overflow:hidden;min-width:60px;position:relative}
  .wr-prog i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--ui-red)}
  .wr-wc.mid i{background:var(--ui-orange)}.wr-wc.ok i{background:var(--ui-green)}.wr-wc.lo b{color:var(--ui-red)}.wr-wc.mid b{color:var(--ui-orange)}.wr-wc.ok b{color:var(--ui-green)}
  .wr-tm{display:flex;align-items:center;gap:6px}
  .wr-tm b{font-variant-numeric:tabular-nums;font-size:17px;min-width:62px;text-align:center}
  .wr-tm.warn b{color:var(--ui-orange)}.wr-tm.over b{color:var(--ui-red)}
  .wr .ui-btn.sm{min-height:32px;padding:0 10px;font-size:13px}
  .wr-act{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
  .wr-act .pri{min-width:120px}
  .wr-privacy{font-size:11.5px;color:var(--ui-muted);flex:1 1 220px;min-width:0;line-height:1.5}
  .wr-privacy select{width:auto;height:26px;font-size:12px;padding:0 4px;margin-left:4px}
  .wr-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .wr-tile{background:var(--ui-surface-2);border-radius:12px;padding:10px 12px;min-width:0}
  .wr-tile span{display:block;font-size:11.5px;color:var(--ui-muted)}
  .wr-tile b{display:block;font-size:20px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}
  .wr-tile em{display:block;font-style:normal;font-size:11.5px;margin-top:2px;color:var(--ui-ink-2)}
  .wr-tile em.g{color:var(--ui-green)}.wr-tile em.o{color:var(--ui-orange)}.wr-tile em.r{color:var(--ui-red)}
  .wr-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  .wr-chips .ui-chip b{font-weight:800}
  .wr-mk{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:var(--ui-surface-2);border-radius:12px;padding:12px 14px;font-size:15px;line-height:1.75;max-height:460px;overflow-y:auto}
  .wr-mk mark{background:transparent;color:inherit;cursor:pointer;border-radius:3px;padding:0 1px;border-bottom:2px solid}
  .wr-mk mark.spell{border-color:var(--ui-red);background:var(--ui-red-soft)}
  .wr-mk mark.grammar{border-color:var(--ui-orange);background:var(--ui-orange-soft)}
  .wr-mk mark.punct{border-color:var(--ui-blue);background:var(--ui-blue-soft)}
  .wr-mk mark.style{border-color:var(--ui-pur-text);background:var(--ui-pur-soft)}
  .wr-mk mark.act{outline:2px solid var(--ui-pur-text)}
  .wr-mk mark.blank{display:inline-block;min-width:8px}
  .wr-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:2px}
  .wr-dot.spell{background:var(--ui-red)}.wr-dot.grammar{background:var(--ui-orange)}.wr-dot.punct{background:var(--ui-blue)}.wr-dot.style{background:var(--ui-pur-text)}
  .wr-iss{margin-top:10px;display:flex;flex-direction:column;gap:6px}
  .wr-is{display:flex;gap:10px;align-items:flex-start;background:var(--ui-surface-2);border-radius:10px;padding:8px 10px;font-size:13.5px;min-width:0}
  .wr-is .t{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
  .wr-is .t s{color:var(--ui-red);text-decoration-thickness:1.5px}
  .wr-is .t i{font-style:normal;color:var(--ui-muted);display:block;font-size:12.5px;margin-top:2px}
  .wr-is .ui-btn{flex:none}
  .wr-err{background:var(--ui-red-soft);border:1px solid var(--ui-red-line);color:var(--ui-ink);border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.55}
  .wr-info{background:var(--ui-orange-soft);border:1px solid var(--ui-orange-line);border-radius:10px;padding:10px 12px;font-size:13.5px;line-height:1.55}
  .wr-load{color:var(--ui-muted);font-size:13.5px;padding:8px 0}
  .wr-load::before{content:"";display:inline-block;width:12px;height:12px;border:2px solid var(--ui-pur-text);border-right-color:transparent;border-radius:50%;margin-right:8px;vertical-align:-2px;animation:wrspin .8s linear infinite}
  @keyframes wrspin{to{transform:rotate(360deg)}}
  .wr-sub{margin:14px 0 6px;font-size:13.5px;font-weight:800;color:var(--ui-ink)}
  .wr-sub small{font-weight:500;color:var(--ui-muted);margin-left:6px}
  .wr-lv{display:flex;height:14px;border-radius:99px;overflow:hidden;background:var(--ui-surface-3)}
  .wr-lv i{display:block;height:100%}
  .wr-lv .b0,.wr-leg .b0{background:#5d636c}.wr-lv .b1,.wr-leg .b1{background:var(--ui-blue)}.wr-lv .b2,.wr-leg .b2{background:var(--ui-pur-text)}.wr-lv .b3,.wr-leg .b3{background:var(--ui-orange)}
  .wr-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--ui-ink-2);margin-top:6px}
  .wr-leg span{display:inline-flex;align-items:center;gap:5px}.wr-leg em{width:10px;height:10px;border-radius:3px;display:inline-block}
  .wr-words{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
  .wr-words .ui-tag{font-size:12px}
  .wr-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
  .wr-tbl td,.wr-tbl th{padding:6px 6px;border-bottom:1px solid var(--ui-line);text-align:left;vertical-align:top;overflow-wrap:anywhere}
  .wr-tbl th{color:var(--ui-muted);font-weight:600;font-size:12px}
  .wr-tbl td:first-child{white-space:nowrap;font-weight:700}
  .wr-tips{margin:6px 0 0;padding-left:18px;font-size:13.5px;line-height:1.6;color:var(--ui-ink-2)}
  .wr-tips li{margin:2px 0}
  .wr-lk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
  .wr-lk div{background:var(--ui-surface-2);border-radius:10px;padding:8px 10px;font-size:12.5px;min-width:0;overflow-wrap:anywhere}
  .wr-lk b{display:block;font-size:13px;margin-bottom:2px}.wr-lk .z{color:var(--ui-muted)}
  .wr-band{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
  .wr-band div{background:var(--ui-surface-2);border-radius:12px;padding:10px 4px;text-align:center;min-width:0}
  .wr-band span{display:block;font-size:11.5px;color:var(--ui-muted)}
  .wr-band b{display:block;font-size:22px;font-weight:900;margin-top:2px}
  .wr-band .all{background:var(--ui-pur-soft);border:1px solid var(--ui-pur-line)}.wr-band .all b{color:var(--ui-pur-text)}
  .wr-rw{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--ui-surface-2);border-radius:12px;padding:12px 14px;font-size:14.5px;line-height:1.7}
  .wr-est{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .wr-tag-est{font-size:11px;color:var(--ui-on-accent);background:var(--ui-orange);border-radius:6px;padding:1px 6px;font-weight:700}
  .wr-hist{display:flex;flex-direction:column;gap:8px}
  .wr-hi{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;min-width:0}
  .wr-hi .t{flex:1 1 auto;min-width:0;cursor:pointer}
  .wr-hi .t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wr-hi .t span{display:block;font-size:12px;color:var(--ui-muted);margin-top:3px}
  .wr-hi .sc{font-size:20px;font-weight:900;color:var(--ui-pur-text);min-width:40px;text-align:center}
  .wr-hi .sc small{display:block;font-size:10.5px;font-weight:500;color:var(--ui-muted)}
  .wr-empty{color:var(--ui-muted);text-align:center;padding:36px 0;font-size:14px}
  .wr-banner{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--ui-pur-soft);border:1px solid var(--ui-pur-line);border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:13.5px}
  .wr-banner span{flex:1 1 200px;min-width:0}
  .wr-pop,.wr-pop *{box-sizing:border-box}
  .wr-pop{position:fixed;z-index:10050;width:340px;max-width:calc(100vw - 16px);background:var(--ui-surface);border:1px solid var(--ui-line-2);border-radius:14px;box-shadow:var(--ui-shadow-pop, 0 24px 60px rgba(0,0,0,.5));padding:12px 14px;color:var(--ui-ink);font-family:var(--ui-font);font-size:13.5px;line-height:1.55;overflow-wrap:anywhere}
  .wr-pop h4{margin:0 0 6px;font-size:14px;display:flex;gap:6px;align-items:center}
  .wr-pop .ctx{background:var(--ui-surface-2);border-radius:8px;padding:6px 8px;margin:8px 0;font-size:13px;color:var(--ui-ink-2)}
  .wr-pop .ctx u{color:var(--ui-red);text-decoration-thickness:2px}
  .wr-pop .reps{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  .wr-pop .reps .ui-btn{min-height:32px;padding:0 10px;font-size:13px}
  .wr-pop .foot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px}
  .wr-pop .rule{font-size:11px;color:var(--ui-muted)}
  .wr-mask{position:fixed;inset:0;z-index:10040;background:rgba(0,0,0,.45);display:none}
  @media(max-width:640px){
    .wr-card{padding:12px}
    .wr-sum{grid-template-columns:repeat(2,minmax(0,1fr))}
    .wr-band{grid-template-columns:repeat(3,minmax(0,1fr))}
    .wr-lk{grid-template-columns:1fr}
    .wr-text{min-height:280px}
    .wr-pop{left:0!important;right:0;top:auto!important;bottom:0;width:100%;max-width:100%;border-radius:16px 16px 0 0;max-height:70vh;overflow-y:auto;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}
    .wr-mask.on{display:block}
  }`;

  /* ---------- 状态 ---------- */
  const d0 = LG("writing:draft", null) || {};
  const st = {
    type: TYPES[d0.type] ? d0.type : "task2", prompt: d0.prompt || "", text: d0.text || "", elapsed: +d0.elapsed || 0,
    running: false, tick: null, warned: false, view: "write", lang: LG("writing:lang", "en-US"),
  };
  let host = null, res = null, histView = null, pop = null, mask = null, saveT = null, ltCalls = [], vocabP = null;

  function saveDraft(now) {
    clearTimeout(saveT);
    const go = () => LS("writing:draft", { type: st.type, prompt: st.prompt, text: st.text, elapsed: st.elapsed, at: Date.now() });
    if (now) go(); else saveT = setTimeout(go, 400);
  }
  const hist = () => { const h = LG("writing:history", []); return Array.isArray(h) ? h : []; };
  function saveHist(h) {
    h = h.slice(0, HMAX);
    while (h.length && !LS("writing:history", h)) h = h.slice(0, h.length - 1); // 存不下就丢最旧的
    if (!h.length) LS("writing:history", []);
  }

  // 按需加载词频数据（vs/freq.js → VS_RANK，vs/vlevel.js → vsRank / vsLemma）；看视频页已经加载过就不再加载
  function loadVocab() {
    if (vocabP) return vocabP;
    const need = [];
    if (!window.VS_RANK) need.push("vs/freq.js");
    if (typeof window.vsRank !== "function") need.push("vs/vlevel.js");
    vocabP = need.reduce((p, src) => p.then(() => new Promise(r => { const s = document.createElement("script"); s.src = src + "?v=" + Date.now().toString(36).slice(0, -4); s.onload = s.onerror = r; document.head.append(s); })), Promise.resolve());
    return vocabP;
  }
  const rankFn = () => (window.VS_RANK && typeof window.vsRank === "function" ? window.vsRank : null);
  const lemmaFn = () => (typeof window.vsLemma === "function" && window.VS_RANK ? window.vsLemma : null);
  function runLocal(r) {
    const skip = new Set((r.matches || []).filter(m => m.cat === "spell").map(m => lc(r.text.substr(m.offset, m.length))));
    r.local = analyze(r.text, { rank: rankFn(), lemma: lemmaFn(), skip, prompt: r.prompt, type: r.type });
    r.est = estimate(r.local, catCount(r.matches), !r.ltErr && !r.ltLoading);
  }

  /* ---------- 画界面 ---------- */
  function draw() {
    if (!host) return;
    closePop();
    const h = hist();
    let body = '<div class="wr"><div class="wr-hd"><h2>✍️ 写作批改</h2><div class="ui-seg" data-a="view"><button data-v="write" class="' + (st.view === "write" ? "on" : "") + '">写作</button><button data-v="hist" class="' + (st.view === "hist" ? "on" : "") + '">历史 ' + h.length + "</button></div></div>";
    if (st.view === "hist") body += drawHist(h);
    else body += drawWrite();
    host.innerHTML = body + "</div>";
    if (st.view === "write") { updCount(); updTimer(); }
    if (window.NAV) NAV.mark(); // 🔙 写作 / 历史记录 / 打开某条记录：记一条页面历史（nav.js）
  }

  function bankOptions() {
    const L = BANK[st.type] || [], groups = {};
    L.forEach((x, i) => (groups[x[0]] = groups[x[0]] || []).push(i));
    let cur = L.findIndex(x => x[1] === st.prompt);
    return '<option value="">— 从题库选一题（' + L.length + " 道）—</option>" + Object.entries(groups).map(([g, ids]) => '<optgroup label="' + esc(g) + '">' + ids.map(i => '<option value="' + i + '"' + (i === cur ? " selected" : "") + ">" + (i + 1) + ". " + esc(L[i][1].split("\n")[0].slice(0, 70)) + "…</option>").join("") + "</optgroup>").join("");
  }

  function drawWrite() {
    const T = TYPES[st.type];
    let s = '<div class="wr-card"><h3>① 选题</h3><div class="ui-tabs" data-a="type">' + Object.entries(TYPES).map(([k, v]) => '<button data-t="' + k + '" class="' + (st.type === k ? "on" : "") + '">' + esc(v.t.replace(/^IELTS /, "")) + "<small>" + (v.words ? v.words + " 词 · " + v.min + " 分钟" : "不限字数") + "</small></button>").join("") + "</div>";
    s += '<div class="wr-row" style="margin-top:10px"><div class="grow"><select id="wr-bank">' + bankOptions() + '</select></div><button class="ui-btn sm" data-a="rand">🎲 随机一题</button></div>';
    s += '<textarea id="wr-prompt" class="wr-prompt' + (st.type === "task1" ? " mono" : "") + '" rows="' + (st.type === "task1" ? 9 : 4) + '" placeholder="点「随机一题」或从题库选，也可以直接在这里输入 / 粘贴自己的题目">' + esc(st.prompt) + "</textarea>";
    if (st.type === "task1") s += '<div class="wr-note">图表用文字表格给出，数据为练习虚构，不是真实统计。先写引言（改写题目）→ 总览（Overall …）→ 两段细节。</div>';
    s += "</div>";
    s += '<div class="wr-card"><h3>② 写作</h3><div class="wr-bar"><div class="wr-wc" id="wr-wc"></div><div class="wr-tm" id="wr-tm"><b id="wr-tmv"></b><button class="ui-btn sm" data-a="timer" id="wr-tmb"></button><button class="ui-btn sm" data-a="treset" title="计时归零">↺</button></div></div>';
    s += '<textarea id="wr-text" class="wr-text" spellcheck="false" autocapitalize="sentences" placeholder="在这里写作文……草稿会自动保存在这台设备上">' + esc(st.text) + "</textarea>";
    s += '<div class="wr-act"><button class="ui-btn pri" data-a="check" id="wr-check"' + (res && (res.ltLoading || res.aiLoading) && !res.readonly ? " disabled" : "") + ">✅ 批改</button><button class=\"ui-btn sm\" data-a=\"clear\">清空正文</button>" +
      '<div class="wr-privacy">语法检查会把文本发送到 LanguageTool（免费公共服务）<select id="wr-lang" title="拼写按哪种英语检查"><option value="en-US"' + (st.lang === "en-US" ? " selected" : "") + '>美式拼写</option><option value="en-GB"' + (st.lang === "en-GB" ? " selected" : "") + ">英式拼写</option></select><br>AI 评分发送到本站后台（Cloudflare Workers AI）</div></div></div>";
    s += '<div id="wr-res">' + (res && !res.readonly ? drawRes(res) : "") + "</div>";
    return s;
  }

  function updCount() {
    const el = host && host.querySelector("#wr-wc"); if (!el) return;
    const n = countWords(st.text), T = TYPES[st.type], tg = T.words;
    if (!tg) { el.className = "wr-wc"; el.innerHTML = "<b>" + n + "</b> 词"; return; }
    const p = Math.min(1, n / tg), cls = n >= tg ? "ok" : n >= tg * 0.8 ? "mid" : "lo";
    el.className = "wr-wc " + cls;
    el.innerHTML = "<b>" + n + '</b><span>/ ' + tg + ' 词</span><div class="wr-prog"><i style="width:' + Math.round(p * 100) + '%"></i></div><span>' + (n >= tg ? (n > tg * 1.6 ? "偏长了" : "✓ 达标") : "还差 " + (tg - n)) + "</span>";
  }
  const fmt = s => { s = Math.abs(Math.round(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  function updTimer() {
    const v = host && host.querySelector("#wr-tmv"), b = host && host.querySelector("#wr-tmb"), box = host && host.querySelector("#wr-tm");
    if (!v) return;
    const left = TYPES[st.type].min * 60 - st.elapsed;
    v.textContent = left >= 0 ? fmt(left) : "+" + fmt(left);
    v.title = left >= 0 ? "剩余时间（" + TYPES[st.type].min + " 分钟）" : "已超时";
    box.className = "wr-tm" + (left < 0 ? " over" : left <= 300 ? " warn" : "");
    b.textContent = st.running ? "⏸ 暂停" : st.elapsed ? "▶ 继续" : "▶ 开始计时";
  }
  function timer(on) {
    st.running = on;
    clearInterval(st.tick);
    if (on) {
      let last = Date.now();
      st.tick = setInterval(() => {
        const now = Date.now(); st.elapsed += (now - last) / 1000; last = now;
        const left = TYPES[st.type].min * 60 - st.elapsed;
        if (left <= 300 && left > 0 && !st.warned5) { st.warned5 = true; say("⏳ 还剩 5 分钟"); }
        if (left <= 0 && !st.warned) { st.warned = true; say("⏰ 时间到！（计时继续，显示超时多久）"); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} }
        updTimer();
        if (Math.round(st.elapsed) % 10 === 0) saveDraft();
      }, 1000);
    } else saveDraft(true);
    updTimer();
  }

  /* ---------- 批改结果 ---------- */
  function tile(label, val, note, cls) { return '<div class="wr-tile"><span>' + label + "</span><b>" + val + "</b>" + (note ? '<em class="' + (cls || "") + '">' + note + "</em>" : "") + "</div>"; }

  function drawRes(r) {
    let s = "";
    const loc = r.local, cats = catCount(r.matches), nIss = (r.matches || []).length;
    const ai = r.ai && r.ai.band;
    // 总览
    s += '<div class="wr-card"><h3>📋 批改结果<small>' + esc(new Date(r.at).toLocaleString("zh-CN", { hour12: false })) + " · " + esc(TYPES[r.type] ? TYPES[r.type].s : r.type) + "</small></h3><div class=\"wr-sum\">" +
      tile("词数", loc.words, TYPES[r.type] && TYPES[r.type].words ? (loc.words >= TYPES[r.type].words ? "达标" : "少于 " + TYPES[r.type].words + "，TR 会扣分") : "", loc.words >= (TYPES[r.type] || {}).words ? "g" : "r") +
      tile("语法拼写问题", r.ltLoading ? "…" : r.ltErr ? "—" : nIss, r.ltLoading ? "检查中" : r.ltErr ? "检查失败" : r.fixed ? "已改 " + r.fixed + " 处" : "", nIss ? "o" : "g") +
      tile("AI 总分", r.aiLoading ? "…" : ai && ai.overall != null ? bandStr(ai.overall) : "—", r.aiLoading ? "评分中" : ai ? "Workers AI" : "未开启 / 失败") +
      tile("本地粗估 LR / GRA", r.est ? bandStr(r.est.LR) + " / " + bandStr(r.est.GRA) : "—", r.est ? "粗估，仅供参考" : "字数太少", "o") + "</div>";
    if (r.text !== st.text && !r.readonly) s += '<div class="wr-note">⚠️ 正文在批改后改过了，下面的标注对应批改时的文字；要更新请再点一次「批改」。</div>';
    s += "</div>";
    s += drawLT(r, cats) + drawLocal(r) + drawAI(r);
    return s;
  }
  const isNum = x => typeof x === "number" && isFinite(x);
  const bandStr = x => (x != null && x !== "" && isNum(+x) ? (+x).toFixed(1) : "—");

  function drawLT(r, cats) {
    let s = '<div class="wr-card" id="wr-lt"><h3>a) 语法拼写<small>LanguageTool · ' + esc(r.lang || "en-US") + "</small></h3>";
    if (r.ltLoading) return s + '<div class="wr-load">正在检查语法和拼写……</div></div>';
    if (r.ltErr) return s + '<div class="wr-err">❌ ' + esc(r.ltErr) + (r.readonly ? "" : ' <button class="ui-btn sm" data-a="relt">重试</button>') + "</div></div>";
    const M = r.matches || [], f = r.filter || "all";
    if (!M.length) return s + '<div class="wr-info" style="background:var(--ui-green-soft);border-color:var(--ui-green-line)">🎉 没有查到语法和拼写问题' + (r.fixed ? "（已修改 " + r.fixed + " 处）" : "") + "。注意：工具查不出逻辑、用词是否地道等问题。</div></div>";
    const canFix = M.filter(m => m.rep && m.rep.length && (f === "all" || m.cat === f)).length;
    s += '<div class="wr-chips"><button class="ui-chip' + (f === "all" ? " on" : "") + '" data-a="filt" data-f="all">全部 <b>' + M.length + "</b></button>" +
      Object.keys(CAT).map(k => '<button class="ui-chip' + (f === k ? " on" : "") + '" data-a="filt" data-f="' + k + '"' + (cats[k] ? "" : " disabled") + '><span class="wr-dot ' + k + '"></span>' + CAT[k] + " <b>" + cats[k] + "</b></button>").join("") +
      (r.readonly ? "" : '<button class="ui-btn sm pri" data-a="fixall" style="margin-left:auto"' + (canFix ? "" : " disabled") + ">全部应用（" + canFix + "）</button>") + "</div>";
    // 原文高亮
    const T = r.text; let out = "", pos = 0;
    M.slice().sort((a, b) => a.offset - b.offset).forEach(m => {
      if (m.offset < pos) return; // 和前一条重叠：只在列表里显示
      out += esc(T.slice(pos, m.offset));
      const seg = T.substr(m.offset, m.length), show = f === "all" || f === m.cat;
      out += show ? '<mark class="' + m.cat + (/^\s*$/.test(seg) ? " blank" : "") + '" data-id="' + m.id + '">' + (esc(seg) || "&nbsp;") + "</mark>" : esc(seg);
      pos = m.offset + m.length;
    });
    out += esc(T.slice(pos));
    s += '<div class="wr-mk" id="wr-mk">' + out + "</div><div class=\"wr-note\">点标出的地方看说明和改法。红 = 拼写，橙 = 语法，蓝 = 标点，紫 = 风格。</div>";
    // 问题列表
    s += '<div class="wr-sub">问题列表<small>' + (r.readonly ? "历史记录只能查看；点「载入到写作区」后可以应用修改" : "点「应用」直接改正文") + '</small></div><div class="wr-iss">' +
      M.filter(m => f === "all" || f === m.cat).map(m => {
        const bad = T.substr(m.offset, m.length);
        return '<div class="wr-is" data-id="' + m.id + '"><span class="wr-dot ' + m.cat + '" style="margin-top:6px"></span><div class="t"><s>' + (esc(bad.trim()) || "（空格）") + "</s>" + (m.rep && m.rep[0] != null ? " → <b>" + (esc(m.rep[0]) || "（删除）") + "</b>" : "") + "<i>" + esc(m.msg) + "</i></div>" +
          (r.readonly || !(m.rep && m.rep.length) ? "" : '<button class="ui-btn sm" data-a="fix1" data-id="' + m.id + '">应用</button>') + "</div>";
      }).join("") + "</div></div>";
    return s;
  }

  function drawLocal(r) {
    const L = r.local, T = TYPES[r.type] || {};
    let s = '<div class="wr-card"><h3>b) 本地分析<small>不联网，在你的设备上算</small></h3><div class="wr-sum">';
    const al = L.avgLen, alN = al < 10 ? ["偏短，多用复合句", "r"] : al > 30 ? ["偏长，注意断句", "o"] : al < 13 ? ["稍短", "o"] : ["合适", "g"];
    const pExp = r.type === "task2" ? [4, 5] : r.type === "task1" ? [3, 4] : null;
    const pN = !pExp ? ["", ""] : L.paragraphs < pExp[0] ? ["建议分 " + pExp[0] + "–" + pExp[1] + " 段", "o"] : L.paragraphs > pExp[1] + 1 ? ["段落偏多", "o"] : ["合适", "g"];
    const mt = L.mattr, mtN = mt >= 0.8 ? ["丰富", "g"] : mt >= 0.72 ? ["一般", "o"] : ["偏单一", "r"];
    s += tile("句数", L.sentences) + tile("平均句长", al + " 词", alN[0], alN[1]) + tile("段落数", L.paragraphs, pN[0], pN[1]) +
      tile("用词多样性 TTR", L.ttrRaw.toFixed(2), "MATTR " + mt.toFixed(2) + " · " + mtN[0], mtN[1]) + "</div>";
    // 用词水平
    s += '<div class="wr-sub">用词水平<small>按英语词频排名，只算实词</small></div>';
    if (!L.level) s += '<div class="wr-load">正在加载词频数据……（加载失败时这一项不显示）</div>';
    else if (!L.level.total) s += '<div class="wr-note">实词太少，算不出分布。</div>';
    else {
      const b = L.level.bands, tt = L.level.total, pc = x => Math.round((x / tt) * 100);
      const adv = L.level.advRatio, aN = adv >= 0.25 ? "高级词用得不错" : adv >= 0.15 ? "可以再多用一些高级词" : "高级词偏少，多用学术词（如 significant、facilitate、consequently）";
      s += '<div class="wr-lv">' + b.map((x, i) => '<i class="b' + i + '" style="width:' + (x / tt) * 100 + '%" title="' + BANDS[i].t + " " + x + '"></i>').join("") + "</div>";
      s += '<div class="wr-leg">' + b.map((x, i) => '<span><em class="b' + i + '"></em>' + BANDS[i].t + (i < 3 ? "（前 " + BANDS[i].max + "）" : "") + " " + pc(x) + "%</span>").join("") + "</div>";
      s += '<div class="wr-note">中高级 + 高级词占 <b style="color:var(--ui-pur-text)">' + Math.round(adv * 100) + "%</b>（" + (b[2] + b[3]) + " / " + tt + "）。" + aN + "</div>";
      if (L.level.advWords.length) s += '<div class="wr-words">' + L.level.advWords.slice(0, 24).map(w => '<span class="ui-tag" data-to="word:' + esc(w) + '" title="查这个词">' + esc(w) + "</span>").join("") + "</div>";
    }
    // 重复词
    const O = L.overused;
    s += '<div class="wr-sub">重复用得多的词<small>同一个词用了 ' + O.lim + " 次以上，或基础词用了 2 次以上</small></div>";
    if (!O.list.length) s += '<div class="wr-note">✓ 没有明显重复的词。</div>';
    else s += '<table class="wr-tbl"><tr><th>词</th><th>次数</th><th>可以换成</th></tr>' + O.list.map(x => "<tr><td>" + esc(x.forms.slice(0, 3).join(" / ")) + "</td><td>" + x.n + "</td><td>" + (x.syn ? esc(x.syn.join(" / ")) : x.topic ? '<span class="ui-muted">题目关键词，适当用同义改写（paraphrase）或代词</span>' : '<span class="ui-muted">换个说法、用代词，或合并句子</span>') + "</td></tr>").join("") + "</table>";
    if (O.once.length) s += '<div class="wr-note">这些基础词也可以升级：' + O.once.map(x => "<b>" + esc(x.w) + "</b> → " + esc(x.syn.slice(0, 2).join(" / "))).join("；") + "</div>";
    // 连接词
    const K = L.links;
    s += '<div class="wr-sub">连接词<small>共 ' + K.total + " 处，" + K.distinct + " 种（不算 and / but / so / then）</small></div><div class=\"wr-lk\">" +
      K.cats.map(c => { const u = Object.entries(c.used).sort((a, b) => b[1] - a[1]); return "<div><b>" + c.t + " · " + c.total + "</b>" + (u.length ? esc(u.map(([p, n]) => p.replace(/,$/, "") + (n > 1 ? "×" + n : "")).join("、")) : '<span class="z">没用到 · 可用 ' + esc(c.unused.slice(0, 3).join(" / ")) + "</span>") + "</div>"; }).join("") + "</div>";
    if (K.tips.length) s += '<ul class="wr-tips">' + K.tips.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul>";
    // 句子结构
    const C = L.complex, P = L.passive;
    s += '<div class="wr-sub">句子结构</div><div class="wr-sum">' +
      tile("复杂句", C.n + " / " + L.sentences, Math.round(C.ratio * 100) + "% · " + (C.ratio >= 0.4 ? "不错" : C.ratio >= 0.25 ? "可以再多一些" : "偏少"), C.ratio >= 0.4 ? "g" : C.ratio >= 0.25 ? "o" : "r") +
      tile("被动语态", P.n, P.n ? "有被动，句式有变化" : r.type === "task1" ? "流程图题尤其要用被动" : "可以适当用被动", P.n ? "g" : "o") + "</div>";
    s += '<div class="wr-note">复杂句 = 含 which / that / who / although / because / if / while / when 等从句标志词的句子。' + (P.list.length ? "被动：" + esc(P.list.join("；")) : "") + "</div>";
    // 口语化
    const I = L.informal;
    s += '<div class="wr-sub">口语化 / 不正式表达<small>' + (r.type === "email" ? "写给朋友的信可以口语一些；正式信件要避免" : r.type === "free" ? "自由写作可以不管，练雅思时要避免" : "雅思学术写作要避免") + "</small></div>";
    if (!I.list.length && I.you < 3) s += '<div class="wr-note">✓ 没有发现明显的口语化表达。</div>';
    else {
      if (I.list.length) s += '<table class="wr-tbl"><tr><th>写法</th><th>次数</th><th>建议</th></tr>' + I.list.slice(0, 16).map(x => "<tr><td>" + esc(x.text) + ' <span class="ui-tag">' + x.cat + "</span></td><td>" + x.n + "</td><td>" + esc(x.fix) + "</td></tr>").join("") + "</table>";
      if (I.you >= 3 && r.type !== "email") s += '<div class="wr-note">用了 ' + I.you + " 次「you」：议论文少对读者说话，可以改成 people / individuals / one。</div>";
    }
    return s + "</div>";
  }

  function drawAI(r) {
    let s = '<div class="wr-card"><h3>c) 评分</h3>';
    // 本地粗估
    const E = r.est;
    s += '<div class="wr-sub" style="margin-top:0">本地粗估分 <span class="wr-tag-est">粗估，仅供参考</span><small>只根据上面 a、b 的数据按经验规则估算，不看内容和逻辑</small></div>';
    if (!E) s += '<div class="wr-note">字数太少（少于 50 词），不估分。</div>';
    else s += '<div class="wr-est">' + tile("LR 词汇", bandStr(E.LR), E.lrWhy.join("、") || "—") + tile("GRA 语法", bandStr(E.GRA), (E.graWhy.join("、") || "—") + (E.noLT ? "（语法检查没成功，没算错误数）" : "")) + "</div>";
    // AI
    s += '<div class="wr-sub">AI 评分<small>Cloudflare Workers AI，按雅思四项评分标准</small></div>';
    if (r.aiLoading) return s + '<div class="wr-load">AI 正在评分，可能要十几秒……</div></div>';
    if (r.aiErr) return s + (r.aiErr === "noai" ? '<div class="wr-info">AI 评分未开启（需要在 Cloudflare 打开 Workers AI，免费）</div>' : '<div class="wr-err">AI 评分失败：' + esc(r.aiErr) + "</div>") + (r.readonly ? "" : '<div style="margin-top:8px"><button class="ui-btn sm" data-a="reai">重试 AI 评分</button></div>') + "</div>";
    const A = r.ai; if (!A) return s + '<div class="wr-note">没有 AI 结果。</div></div>';
    const B = A.band || {};
    if (["TR", "CC", "LR", "GRA", "overall"].some(k => B[k] != null)) s += '<div class="wr-band">' + [["TR", r.type === "task1" ? "TA 任务" : "TR 任务"], ["CC", "CC 连贯"], ["LR", "LR 词汇"], ["GRA", "GRA 语法"], ["overall", "总分"]].map(([k, t]) => '<div class="' + (k === "overall" ? "all" : "") + '"><span>' + t + "</span><b>" + (B[k] == null || B[k] === "" ? "—" : bandStr(B[k])) + "</b></div>").join("") + "</div>";
    if (A.summary_zh) s += '<p style="margin:10px 0 0;font-size:14px;line-height:1.65">' + esc(A.summary_zh) + "</p>";
    if (A.strengths_zh && A.strengths_zh.length) s += '<div class="wr-sub">👍 优点</div><ul class="wr-tips">' + A.strengths_zh.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    if (A.improve_zh && A.improve_zh.length) s += '<div class="wr-sub">🔧 改进建议</div><ul class="wr-tips">' + A.improve_zh.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    if (A.rewrite) s += '<div class="wr-sub">📝 改进后的范文<small><button class="ui-btn sm" data-a="say" style="min-height:26px">🔊 朗读</button> <button class="ui-btn sm" data-a="copy" style="min-height:26px">复制</button></small></div><div class="wr-rw">' + esc(A.rewrite) + "</div>";
    return s + '<div class="wr-note">AI 评分也只是参考，和真实考官评分会有出入。</div></div>';
  }

  function redrawRes() {
    if (!host) return;
    if (st.view === "hist") { const box = host.querySelector("#wr-hdet"); if (box && histView) box.innerHTML = drawRes(histView); return; }
    const box = host.querySelector("#wr-res"); if (box) box.innerHTML = res && !res.readonly ? drawRes(res) : "";
    const b = host.querySelector("#wr-check"); if (b) b.disabled = !!(res && (res.ltLoading || res.aiLoading));
  }

  /* ---------- 历史 ---------- */
  function drawHist(h) {
    if (histView) return '<div class="wr-banner"><span>📜 历史记录 · ' + esc(new Date(histView.at).toLocaleString("zh-CN", { hour12: false })) + '</span><button class="ui-btn sm" data-a="hback">← 返回列表</button><button class="ui-btn sm pri" data-a="hload">载入到写作区</button></div>' +
      (histView.prompt ? '<div class="wr-card"><h3>题目</h3><div class="wr-rw" style="font-size:13.5px">' + esc(histView.prompt) + "</div></div>" : "") + '<div id="wr-hdet">' + drawRes(histView) + "</div>";
    if (!h.length) return '<div class="wr-empty">还没有批改记录。写完点「批改」，结果会自动存在这里（最多 ' + HMAX + " 条）。</div>";
    return '<div class="wr-note" style="margin-bottom:8px">存在这台设备的浏览器里，最多 ' + HMAX + ' 条，新的在前。</div><div class="wr-hist">' + h.map(x => {
      const sc = x.ai && x.ai.band && x.ai.band.overall != null ? bandStr(x.ai.band.overall) : "—";
      return '<div class="wr-hi"><div class="t" data-a="hopen" data-id="' + esc(x.id) + '"><b>' + esc((x.prompt || "（没有题目）").split("\n")[0]) + "</b><span>" + esc(new Date(x.at).toLocaleString("zh-CN", { hour12: false })) + " · " + esc(TYPES[x.type] ? TYPES[x.type].s : "") + " · " + x.words + " 词 · " + (x.ltErr ? "语法检查失败" : x.issues + " 个问题") + (x.est ? " · 粗估 LR " + bandStr(x.est.LR) + " / GRA " + bandStr(x.est.GRA) : "") + '</span></div><div class="sc" data-a="hopen" data-id="' + esc(x.id) + '" style="cursor:pointer">' + sc + '<small>AI 分</small></div><button class="ui-btn sm" data-a="hdel" data-id="' + esc(x.id) + '" title="删除这条">🗑</button></div>';
    }).join("") + "</div>";
  }
  function toHist(r) {
    return { id: r.id, at: r.at, type: r.type, prompt: r.prompt, text: r.text, lang: r.lang, words: r.local.words, issues: (r.matches || []).length, cats: catCount(r.matches), matches: r.matches, ltErr: r.ltErr || "", ai: r.ai || null, aiErr: r.aiErr || "", est: r.est || null };
  }
  function fromHist(x) {
    const r = { id: x.id, at: x.at, type: x.type, prompt: x.prompt || "", text: x.text || "", lang: x.lang, matches: (x.matches || []).map(m => Object.assign({}, m)), ltErr: x.ltErr || "", ai: x.ai, aiErr: x.aiErr || "", readonly: true, filter: "all", fixed: 0 };
    runLocal(r);
    return r;
  }
  function recordHist(r) {
    const h = hist().filter(x => x.id !== r.id);
    h.unshift(toHist(r));
    saveHist(h);
  }

  /* ---------- 调接口 ---------- */
  async function callLT(r) {
    r.ltLoading = true; r.ltErr = ""; redrawRes();
    try {
      const now = Date.now(); ltCalls = ltCalls.filter(t => now - t < 60000);
      if (ltCalls.length >= 18) throw new Error("一分钟内检查次数太多（公共接口限 20 次/分钟），请稍等一会儿再试");
      const bytes = new TextEncoder().encode(r.text).length;
      if (bytes > 20000) throw new Error("文本超过 20KB，LanguageTool 公共接口不支持，请分段检查");
      ltCalls.push(now);
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 30000);
      const body = new URLSearchParams({ text: r.text, language: r.lang || "en-US" });
      let resp;
      try { resp = await NET.fetch("https://api.languagetool.org/v2/check", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), signal: ctl.signal }); }
      catch (e) { throw new Error(e.name === "AbortError" ? "LanguageTool 超时没有响应，请稍后重试" : "连不上 LanguageTool（网络问题或被拦截），请稍后重试"); }
      finally { clearTimeout(to); }
      if (resp.status === 429) throw new Error("LanguageTool 说请求太频繁了（限 20 次/分钟），请等一分钟再试");
      if (!resp.ok) throw new Error("LanguageTool 返回错误（HTTP " + resp.status + "），请稍后重试");
      const j = await resp.json();
      r.matches = (j.matches || []).map((m, i) => ({
        id: "m" + i, offset: m.offset, length: m.length, cat: ltCat(m),
        msg: m.message || "", short: m.shortMessage || "", rule: (m.rule && (m.rule.description || m.rule.id)) || "",
        rep: (m.replacements || []).slice(0, 5).map(x => x.value),
      })).filter(m => m.offset >= 0 && m.offset + m.length <= r.text.length);
    } catch (e) { r.ltErr = e.message || String(e); r.matches = []; }
    r.ltLoading = false; runLocal(r); redrawRes();
  }
  async function callAI(r) {
    r.aiLoading = true; r.aiErr = ""; r.ai = null; redrawRes();
    try {
      const j = await AI.ask("write", { type: r.type, prompt: r.prompt, text: r.text }, { timeout: 120000 }); // 全站共用的调 AI（ai.js）
      if (!j.ok) throw j.error === "noai" || j.status === 404 || j.status === 405 || j.status === 501 ? "noai" : AI.msg(j, "AI 评分失败，请稍后重试");
      if (!j.band && !j.summary_zh && !j.rewrite) throw "AI 返回的格式不对";
      const nb = x => { const v = parseFloat(x); return isFinite(v) ? Math.max(0, Math.min(9, Math.round(v * 2) / 2)) : null; };
      const B = j.band || {}, arr = a => (Array.isArray(a) ? a : a ? [a] : []).map(String).filter(Boolean).slice(0, 10);
      r.ai = { band: { TR: nb(B.TR), CC: nb(B.CC), LR: nb(B.LR), GRA: nb(B.GRA), overall: nb(B.overall) }, summary_zh: String(j.summary_zh || ""), strengths_zh: arr(j.strengths_zh), improve_zh: arr(j.improve_zh), rewrite: String(j.rewrite || "") };
    } catch (e) { r.aiErr = typeof e === "string" ? e : e && e.message ? e.message : "noai"; }
    r.aiLoading = false; redrawRes();
  }

  async function check() {
    const text = st.text, n = countWords(text);
    if (n < 20) { say("至少写 20 个词再批改"); return; }
    if (res && (res.ltLoading || res.aiLoading)) return;
    const r = { id: "w" + Date.now().toString(36), at: Date.now(), type: st.type, prompt: st.prompt.trim(), text, lang: st.lang, matches: [], filter: "all", fixed: 0, ltLoading: true, aiLoading: true };
    res = r; runLocal(r); redrawRes();
    loadVocab().then(() => { runLocal(r); redrawRes(); });
    const box = host && host.querySelector("#wr-res"); if (box && box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "start" });
    await Promise.all([callLT(r), callAI(r), loadVocab()]);
    runLocal(r); redrawRes();
    recordHist(r);
    toErrBook(r);
    const hb = host && host.querySelector('[data-v="hist"]'); if (hb) hb.textContent = "历史 " + hist().length;
  }

  // 语法和拼写错误收进「❌ 错题本」（errbook.js）：错的写法 → 第一条建议，带原句；人名地名（大写开头的拼写提示）不收；一篇最多 10 条
  function toErrBook(r) {
    if (!window.ERR || !r || !(r.matches || []).length) return;
    const T = r.text, L = [];
    for (const m of r.matches) {
      if (L.length >= 10) break;
      if (!(m.cat === "grammar" || m.cat === "spell") || !m.rep || !m.rep[0] || !m.length) continue;
      const wrong = T.substr(m.offset, m.length); if (!/[a-z]/i.test(wrong) || wrong.trim() === m.rep[0].trim()) continue;
      if (m.cat === "spell" && /^[A-Z]/.test(wrong)) continue;
      let a = m.offset, b = m.offset + m.length;
      while (a > 0 && !/[.!?\n]/.test(T[a - 1])) a--;
      while (b < T.length && !/[.!?\n]/.test(T[b])) b++;
      const ctx = T.slice(a, Math.min(T.length, b + 1)).trim();
      L.push({ src: "write", kind: "fix", ctx: ctx.length > 400 ? T.slice(Math.max(0, m.offset - 120), m.offset + m.length + 120) : ctx, wrong, right: m.rep[0], why: (m.cat === "spell" ? "拼写：" : "语法：") + (m.msg || m.short || m.rule || "") });
    }
    if (L.length) window.ERR.add(L);
  }

  /* ---------- 应用建议 ---------- */
  function applyOne(r, m, rep) {
    const end = m.offset + m.length, d = rep.length - m.length;
    r.text = r.text.slice(0, m.offset) + rep + r.text.slice(end);
    r.matches = r.matches.filter(x => x !== m && !(x.offset < end && x.offset + x.length > m.offset) && !(x.length === 0 && x.offset === m.offset)).map(x => (x.offset >= end ? Object.assign(x, { offset: x.offset + d }) : x));
    r.fixed = (r.fixed || 0) + 1;
  }
  function syncText(r) {
    st.text = r.text;
    const ta = host && host.querySelector("#wr-text"); if (ta) ta.value = r.text;
    saveDraft(true); runLocal(r); updCount(); redrawRes();
  }
  function canEdit(r) {
    if (!r || r.readonly) return false;
    if (r.text !== st.text) { say("正文在批改后改过了，请重新批改再应用建议"); return false; }
    return true;
  }
  function fix1(id, rep) {
    const r = res; if (!canEdit(r)) return;
    const m = r.matches.find(x => x.id === id); if (!m) return;
    applyOne(r, m, rep == null ? m.rep[0] : rep);
    closePop(); syncText(r);
  }
  async function fixAll() {
    const r = res; if (!canEdit(r)) return;
    const L = r.matches.filter(m => m.rep && m.rep.length && (r.filter === "all" || !r.filter || m.cat === r.filter)).sort((a, b) => b.offset - a.offset);
    if (!L.length) return;
    if (!(await U.ask("把 " + L.length + " 条建议都按第一个改法应用到正文？（可以用 Ctrl/⌘+Z 在文本框里撤销）", { ok: "全部应用" })) || res !== r) return; // ✅ 全站共用的弹窗（util.js）
    let lim = Infinity, n = 0;
    L.forEach(m => { if (m.offset + m.length > lim || !r.matches.includes(m)) return; applyOne(r, m, m.rep[0]); lim = m.offset; n++; });
    syncText(r); say("已应用 " + n + " 条建议");
  }

  /* ---------- 弹出说明 ---------- */
  function closePop() {
    if (pop) { pop.remove(); pop = null; }
    if (mask) mask.classList.remove("on");
    if (host) host.querySelectorAll(".wr-mk mark.act").forEach(x => x.classList.remove("act"));
  }
  function openPop(r, id, anchor) {
    closePop();
    const m = (r.matches || []).find(x => x.id === id); if (!m) return;
    const T = r.text, a = Math.max(0, m.offset - 40), b = Math.min(T.length, m.offset + m.length + 40);
    const ctx = (a > 0 ? "…" : "") + esc(T.slice(a, m.offset)) + "<u>" + (esc(T.substr(m.offset, m.length)) || "&nbsp;") + "</u>" + esc(T.slice(m.offset + m.length, b)) + (b < T.length ? "…" : "");
    const ro = r.readonly || r.text !== st.text;
    pop = document.createElement("div"); pop.className = "wr-pop"; pop.setAttribute("role", "dialog");
    pop.innerHTML = '<h4><span class="wr-dot ' + m.cat + '"></span>' + CAT[m.cat] + (m.short ? " · " + esc(m.short) : "") + "</h4><div>" + esc(m.msg) + '</div><div class="ctx">' + ctx + "</div>" +
      (m.rep && m.rep.length ? '<div style="font-size:12.5px;color:var(--ui-muted)">建议改成' + (ro ? "（" + (r.readonly ? "历史记录不能直接改" : "正文已改动，请重新批改") + "）" : "，点一下就应用") + '：</div><div class="reps">' + m.rep.map((x, i) => '<button class="ui-btn' + (i === 0 ? " pri" : "") + '" data-rep="' + i + '"' + (ro ? " disabled" : "") + ">" + (esc(x) || "（删除）") + "</button>").join("") + "</div>" : '<div style="font-size:12.5px;color:var(--ui-muted)">没有自动改法，请自己修改。</div>') +
      '<div class="foot"><span class="rule">' + esc(m.rule) + "</span><span>" + (ro ? "" : '<button class="ui-btn sm" data-ig="1">忽略</button> ') + '<button class="ui-btn sm" data-x="1">关闭</button></span></div>';
    document.body.append(pop);
    if (!mask) { mask = document.createElement("div"); mask.className = "wr-mask"; mask.addEventListener("click", closePop); document.body.append(mask); }
    if (anchor && anchor.classList) anchor.classList.add("act");
    if (window.matchMedia && window.matchMedia("(max-width:640px)").matches) mask.classList.add("on"); // 手机：从底部弹出
    else if (anchor) {
      const rc = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
      let left = Math.min(Math.max(8, rc.left), vw - pw - 8), top = rc.bottom + 8;
      if (top + ph > vh - 8) top = Math.max(8, rc.top - ph - 8);
      pop.style.left = left + "px"; pop.style.top = top + "px";
    }
    pop.addEventListener("click", e => {
      const rb = e.target.closest("[data-rep]");
      if (rb) { fix1(m.id, m.rep[+rb.dataset.rep]); return; }
      if (e.target.closest("[data-ig]")) { r.matches = r.matches.filter(x => x !== m); closePop(); runLocal(r); redrawRes(); return; }
      if (e.target.closest("[data-x]")) closePop();
    });
  }

  /* ---------- 事件 ---------- */
  function setType(t) {
    if (!TYPES[t] || t === st.type) return;
    const inBank = Object.values(BANK).some(L => L.some(x => x[1] === st.prompt));
    st.type = t; if (inBank) st.prompt = ""; st.warned = st.warned5 = false;
    saveDraft(true); draw();
  }
  function randPrompt() {
    const L = BANK[st.type]; if (!L || !L.length) return;
    let i, n = 0; do { i = Math.floor(Math.random() * L.length); } while (L[i][1] === st.prompt && L.length > 1 && ++n < 10);
    setPrompt(L[i][1]);
  }
  function setPrompt(p) {
    st.prompt = p; saveDraft();
    const ta = host.querySelector("#wr-prompt"); if (ta) ta.value = p;
    const sel = host.querySelector("#wr-bank"); if (sel) sel.innerHTML = bankOptions();
  }
  function bind(el) {
    if (el._wrBound) return; el._wrBound = true;
    el.addEventListener("click", async e => { // async：确认弹窗（U.ask）要等回答
      if (!host || el !== host) return;
      const t = e.target;
      const tb = t.closest('[data-a="type"] [data-t]'); if (tb) { setType(tb.dataset.t); return; }
      const vb = t.closest('[data-a="view"] [data-v]'); if (vb) { st.view = vb.dataset.v; histView = null; draw(); return; }
      const mk = t.closest(".wr-mk mark"); if (mk) { e.stopPropagation(); openPop(st.view === "hist" ? histView : res, mk.dataset.id, mk); return; }
      const it = t.closest(".wr-is"); if (it && !t.closest("[data-a]")) { const r = st.view === "hist" ? histView : res, a = host.querySelector('.wr-mk mark[data-id="' + it.dataset.id + '"]'); openPop(r, it.dataset.id, a || it); return; }
      const b = t.closest("[data-a]"); if (!b) return;
      const A = b.dataset.a, cur = st.view === "hist" ? histView : res;
      if (A === "rand") randPrompt();
      else if (A === "timer") timer(!st.running);
      else if (A === "treset") { timer(false); st.elapsed = 0; st.warned = st.warned5 = false; saveDraft(true); updTimer(); }
      else if (A === "check") check();
      else if (A === "clear") { if (!st.text || !(await U.ask("清空正文？（题目保留）", { ok: "清空", danger: true }))) return; st.text = ""; host.querySelector("#wr-text").value = ""; saveDraft(true); updCount(); redrawRes(); }
      else if (A === "filt") { if (cur) { cur.filter = b.dataset.f; redrawRes(); } }
      else if (A === "fix1") fix1(b.dataset.id);
      else if (A === "fixall") fixAll();
      else if (A === "relt" && res) callLT(res).then(() => recordHist(res));
      else if (A === "reai" && res) callAI(res).then(() => recordHist(res));
      else if (A === "say" && cur && cur.ai) talk(cur.ai.rewrite);
      else if (A === "copy" && cur && cur.ai) U.copy(cur.ai.rewrite, { ok: "已复制范文" }); // 📋 全站共用（util.js）
      else if (A === "hopen") { const x = hist().find(y => y.id === b.dataset.id); if (x) { histId = x.id; histView = fromHist(x); draw(); loadVocab().then(() => { if (histView) { runLocal(histView); redrawRes(); } }); } }
      else if (A === "hdel") { if (!(await U.ask("删除这条批改记录？", { ok: "删除", danger: true }))) return; saveHist(hist().filter(y => y.id !== b.dataset.id)); draw(); }
      else if (A === "hback") { const up = () => { histView = null; draw(); }; if (window.NAV) NAV.back(up); else up(); } // 回到上一个页面
      else if (A === "hload" && histView) {
        if (st.text.trim() && st.text !== histView.text && !(await U.ask("载入会替换写作区现在的正文和题目，继续？", { ok: "载入" }))) return;
        const r = histView; if (!r) return; timer(false);
        st.type = TYPES[r.type] ? r.type : "task2"; st.prompt = r.prompt; st.text = r.text; st.lang = r.lang || st.lang;
        r.readonly = false; res = r; histView = null; st.view = "write"; saveDraft(true); draw();
      }
    });
    el.addEventListener("input", e => {
      if (el !== host) return;
      if (e.target.id === "wr-text") { st.text = e.target.value; saveDraft(); updCount(); }
      else if (e.target.id === "wr-prompt") { st.prompt = e.target.value; saveDraft(); }
    });
    el.addEventListener("change", e => {
      if (el !== host) return;
      if (e.target.id === "wr-bank" && e.target.value !== "") setPrompt(BANK[st.type][+e.target.value][1]);
      else if (e.target.id === "wr-lang") { st.lang = e.target.value; LS("writing:lang", st.lang); }
    });
  }
  function initGlobal() {
    if (document.getElementById("wr-css")) return;
    const s = document.createElement("style"); s.id = "wr-css"; s.textContent = CSS; document.head.append(s);
    document.addEventListener("click", e => { if (pop && !pop.contains(e.target) && !e.target.closest(".wr-mk mark,.wr-is")) closePop(); }, true);
    KEYS.on("write-pop", { when: () => !!pop, prio: 5 }, k => { if (k === "esc") { closePop(); return true; } return false; }); // ⌨️ 全站共用的快捷键（keys.js）：Esc 关批改说明
    window.addEventListener("scroll", () => { if (pop && !(mask && mask.classList.contains("on"))) closePop(); }, { passive: true });
    window.addEventListener("resize", () => closePop());
    window.addEventListener("pagehide", () => saveDraft(true));
  }

  // 入口：把整个写作批改界面画进 el（重复调用没关系，状态会保留）
  // 🔙 页面历史：在「写作」还是「历史记录」、打开了哪条记录（看不到这一页时不记）
  let histId = null;
  if (window.NAV) NAV.reg("write", () => host && host.getClientRects().length ? { v: st.view, h: histView ? histId : null } : undefined, x => {
    if (!x || !host) return;
    const want = x.h ? hist().find(y => y.id === x.h) : null;
    if (x.v === st.view && (want ? histView && histId === x.h : !histView)) return;
    if (x.v) st.view = x.v;
    if (want) { histId = want.id; histView = fromHist(want); draw(); loadVocab().then(() => { if (histView) { runLocal(histView); redrawRes(); } }); } else { histView = null; draw(); }
  });
  window.writingShow = function (el) {
    if (!el) return;
    initGlobal();
    host = el; bind(el);
    draw();
    loadVocab(); // 提前加载词频数据，批改时就不用等
  };
})();
