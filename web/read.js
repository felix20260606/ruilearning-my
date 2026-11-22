/* 生词本「📰 阅读」：粘贴英文文章（或填网址抓正文），大字号按段落、按句子显示，点词查词、一键加入生词本。
   - 上色和语法下划线：和看视频时的字幕同一套（watch.js 的 window.__vs 加载 web/vs/ 里和插件共用的 freq.js / vlevel.js / gram.js）
     · 生词本里已掌握的词不上色，在学的加淡紫底
   - 顶部：词数、预计阅读时间、生词率（不在生词本、且比设定水平难的词的占比）、按词频分的水平分布条
   - 每句末尾 🔊 读整句，点句子左侧的小圆点也行；「全文朗读」逐句读并高亮当前句，可以停止
   - 我的文章：最近读过的存在本机 localStorage「reading:docs」（最多 20 篇，{id, title, text, at, pos}，pos = 读到第几句）
   - 译文：阅读栏「译文」按钮显示 / 隐藏每段下面的中文（记在本机「reading:trOn」）；按段翻译（浏览器直接调谷歌翻译，失败退到 MyMemory），
     译好的存在本机「reading:tr」（{文章 id: {段号: 中文, t: 标题中文}}，只留「我的文章」里还在的），再打开不用重新翻
   依赖 index.html 的全局：words / speak / toast；生词本加词用 word.js 的 WORD.add(word, {sent})
   - 📰 今日新闻（首页最上面，每天一篇）：GET /api/news?d=今天 → 后台从 BBC / Guardian / NPR 的头条里按日期挑一篇（同一天家里人拿到同一篇），
     本机记在「reading:news」；「🎲 换一篇」「其它头条」从当天的头条列表里另抓一篇（/api/readurl）；读过的进「我的文章」（id = "n:" + 网址哈希）
   依赖后台：GET /api/readurl?url=… → {ok, title, text}；GET /api/news?d=… → {ok, date, src, url, title, text, words, list}；GET /api/dict?w=… → {ok, word, phon, zh, en, examples:[[en, zh]]}；
            GET /api/ext（只读，取插件设置里的词汇水平，和 watch.js 同一个接口） */
(function () {
  "use strict";

  /* ================= 纯函数：清理文本、分段、分句、分词（不碰页面，node 里也能测） ================= */
  // 和 web/vs/vlevel.js 的 VS_WORD_RE 一样的分词规则（字母数字，中间可以带 ' ’ -）
  const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

  function cleanText(t) {
    return String(t == null ? "" : t).replace(/\r\n?/g, "\n").replace(/[    ]/g, " ").replace(/[​‌‍﻿]/g, "")
      .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  // 分段：有空行就按空行分（段内换行并成空格）；没有空行就一行一段，但上一行没写完（不以标点结尾、下一行小写开头）时接上
  function splitParas(t) {
    t = cleanText(t); if (!t) return [];
    let blocks;
    if (/\n\n/.test(t)) blocks = t.split(/\n\n+/).map(b => b.replace(/\n/g, " "));
    else {
      blocks = [];
      t.split("\n").forEach(l => { const p = blocks.length - 1; if (p >= 0 && !/[.!?:;"”’)\]…]$/.test(blocks[p]) && /^[a-z]/.test(l)) blocks[p] += " " + l; else blocks.push(l); });
    }
    return blocks.map(b => b.replace(/\s+/g, " ").trim()).filter(b => /[A-Za-z]/.test(b));
  }
  const splitSents = p => U.sents(p); // ✂️ 分句：全站共用（util.js，听力文稿、练习课、翻译、写作统计也用这一个）
  // 分词：[{ w 词, i 位置, first 是否句首（判断大写是不是专有名词用，规则同 vlevel.js 的 vsMark） }]
  function tokens(s) {
    s = String(s == null ? "" : s); const out = []; let m; WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(s))) { const prev = s.slice(0, m.index).replace(/\s+$/, ""); out.push({ w: m[0], i: m.index, first: !prev || /[.?!…“‘"'(\[:;—–\-]$/.test(prev) }); }
    return out;
  }
  const isWord = w => /[A-Za-z]/.test(w);
  const wordCount = t => tokens(t).filter(x => isWord(x.w)).length;
  // 标题：第一段很短、不以句号结尾就当标题；否则取开头 8 个词
  function titleOf(t) {
    const p = splitParas(t)[0] || ""; if (!p) return "未命名文章";
    if (p.length <= 80 && !/[.!?]$/.test(p)) return p;
    const ws = p.split(/\s+/); return ws.slice(0, 8).join(" ").replace(/[,.;:!?]+$/, "") + (ws.length > 8 ? "…" : "");
  }
  // 文章 → { paras: [[句子序号…]…], sents: [句子…] }，句子序号全文连续编号
  function parse(t) { const sents = [], paras = splitParas(t).map(p => splitSents(p).map(s => sents.push(s) - 1)); return { paras, sents }; }
  // 生词本匹配用：常见词尾变化的原形（同 watch.js 的 stems）
  function stems(w) { const o = [w]; if (/ies$/.test(w)) o.push(w.slice(0, -3) + "y"); if (/(es|ed)$/.test(w)) o.push(w.slice(0, -2), w.slice(0, -1)); if (/s$/.test(w)) o.push(w.slice(0, -1)); if (/ing$/.test(w)) o.push(w.slice(0, -3), w.slice(0, -3) + "e"); if (/(.)\1(ed|ing)$/.test(w)) o.push(w.replace(/(.)\1(ed|ing)$/, "$1")); return o; }

  /* ================= 内置示例短文（原创） ================= */
  const SAMPLES = [
    { id: "s:saturday", tag: "日常", title: "A Slow Saturday Morning", text: `Every Saturday, I try to wake up without an alarm. Usually my body still opens its eyes at seven, but I stay in bed for a few more minutes and listen to the rain on the window. There is no meeting to join and no train to catch, so the morning feels much longer than a weekday morning.

After I get up, I make a pot of coffee and two slices of toast with peanut butter. I eat breakfast slowly by the window while I write a short list of things I want to do. The list is never very serious. Last week it said: buy vegetables, call Mum, fix the bike light, and read one chapter of a book.

Around ten o'clock, I walk to the small market near my flat. The man who sells fruit already knows my name, and he always tells me which mangoes are the sweetest that day. I don't always believe him, but I usually buy them anyway.

By lunchtime I have finished most of my list. The bike light is still broken, of course. I have decided that it can wait until next Saturday.` },
    { id: "s:penang", tag: "旅行", title: "Two Days in Penang", text: `If you only have a weekend, Penang is one of the easiest trips you can take from Kuala Lumpur. The flight takes less than an hour, and the bus from the airport to George Town is cheap and comfortable.

On our first morning, we rented bicycles and rode through the old streets of George Town. Many of the shophouses are more than a hundred years old, and some walls are covered with paintings of children, cats and bicycles. Tourists stop to take photos everywhere, so it is better to go early before the streets get crowded.

In the afternoon, the heat became too much for us, and we hid inside a quiet café with ceiling fans and very strong iced coffee. Later, we took the funicular train up Penang Hill. The air at the top was cooler, and we could see the whole island and the long bridge to the mainland.

Of course, the real reason most people visit Penang is the food. In two days we tried char kway teow, assam laksa and a bowl of cendol that was so cold it made my teeth hurt. My advice is simple: bring comfortable shoes, drink lots of water, and leave some space in your stomach.` },
    { id: "s:gps", tag: "科技", title: "How Does Your Phone Know Where You Are?", text: `When you open a map app, a small blue dot shows your position almost immediately. It feels like magic, but your phone is actually combining several different signals.

The most famous one is GPS. High above the Earth, there are dozens of satellites that constantly send out the time and their own position. Your phone listens to at least four of them and measures how long each signal took to arrive. Because radio signals travel at a known speed, the phone can calculate its distance from each satellite and work out where it is.

However, GPS has weaknesses. Inside a shopping mall or between tall buildings, the signals can be blocked or reflected. That is why your phone also uses nearby Wi-Fi networks and mobile phone towers. Companies have recorded where millions of these networks are, so seeing a few familiar names is often enough to guess your location within a few dozen metres.

Finally, sensors inside the phone help to fill the gaps. The compass knows which way you are facing, and the accelerometer can tell when you are walking. Put together, these clues make the blue dot surprisingly accurate, even in places where the sky is hard to see.` },
    { id: "s:mamak", tag: "马来西亚", title: "Breakfast at the Mamak Stall", text: `When I first moved to Malaysia, a colleague told me that I could not really understand the country until I had eaten breakfast at a mamak stall. A few days later, she took me to one near our office.

A mamak is a simple restaurant run by Indian Muslim families. Most of them have plastic chairs, metal tables and a big TV showing football, and many stay open all night. Nobody cares what you wear, and you can sit there for hours with just one drink.

My colleague ordered for both of us. First came roti canai, a flat bread that is crispy outside and soft inside, served with a small bowl of curry. Then the waiter brought two glasses of teh tarik. The name means "pulled tea", because the tea is poured from one cup to another from a great height until it becomes smooth and foamy.

The whole breakfast cost less than ten ringgit. Now I go to the same stall almost every week. The waiter remembers that I like my tea less sweet, and when he sees me coming, he simply nods and starts pulling.` },
    { id: "s:train", tag: "日常", title: "Missing the Last Train", text: `Last month I learned an expensive lesson about checking the timetable. I had spent the evening at a friend's birthday dinner on the other side of the city. The food was great, the conversation was even better, and nobody looked at the clock.

When I finally said goodbye, it was almost midnight. I walked quickly to the station, only to find the gates closed and the lights turned off. A tired security guard told me that the last train had left twenty minutes earlier. I stood there for a moment, feeling a little silly.

My phone battery was at eight percent, so I had to make a decision fast. I booked a ride with an app and waited outside a closed convenience store. Because it was late on a Friday night, prices were much higher than usual, and the ride cost almost five times as much as a train ticket.

The driver was friendly, though. He told me that he picks up people like me every weekend, and he called us "the midnight club". Since that night, I always check when the last train leaves before I go out, and I carry a small power bank in my bag.` },
    { id: "s:cashless", tag: "马来西亚", title: "Life Without Cash in Kuala Lumpur", text: `A few years ago, I always kept some cash in my wallet. These days, I sometimes go a whole week in Kuala Lumpur without touching a single banknote.

Most of my payments happen on my phone. At the supermarket, I scan a QR code at the counter and the money leaves my bank account in a second. Even the small noodle stall near my flat has a printed QR code stuck to the wall, next to a photo of the owner's cat. On toll roads and at train stations, a card called Touch 'n Go does the same job, and I can top it up with an app whenever the balance gets low.

This way of living is convenient, but it is not perfect. Once, my phone died while I was waiting to pay for petrol, and the cashier had to watch me search every pocket for coins. Older people sometimes find the apps confusing, and a few night markets still prefer cash.

So I have made a small rule for myself. I still carry fifty ringgit, folded neatly behind my identity card. I rarely use it, but on the day my battery runs out, it will feel like the best money I have ever saved.` },
  ];

  const PURE = { cleanText, splitParas, splitSents, tokens, wordCount, titleOf, parse, stems, SAMPLES };
  if (typeof module === "object" && module && module.exports) module.exports = PURE;
  if (typeof document === "undefined") return; // node 测试：只要上面的纯函数（要先加载 util.js）
  const { esc, LG, LS, tip } = U; // 全站共用的小工具（util.js）

  /* ================= 页面部分 ================= */
  const say = t => { try { speak(t); } catch (e) {} };
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isSheet = () => { try { return matchMedia("(max-width: 600px)").matches; } catch (e) { return innerWidth <= 600; } };
  const KEY = "reading:docs", MAX_DOCS = 20, MAX_CHARS = 80000, WPM = 150; // 学英语的人按每分钟 150 词估阅读时间
  const LEVELS = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 15000];
  // 水平分布条：按词频排名分档（排名来自插件同一份词频表 VS_RANK）
  const BANDS = [["前 1000", "#8EE5A1"], ["1000–3000", "#6FD3FF"], ["3000–6000", "#C59BEF"], ["6000–1.2万", "#FFB86B"], ["1.2万以后", "#FF8A7A"], ["人名 / 数字", "#5d636b"]];

  const CSS = `
  #reading{display:none;max-width:900px;margin:0 auto;padding:6px 0 60px;overflow-wrap:anywhere}#reading.on{display:block}
  #reading *{box-sizing:border-box}
  .ra-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;margin:4px 0 12px}.ra-head h2{margin:0;font-size:20px;color:var(--ui-ink)}.ra-head span{color:var(--ui-muted);font-size:13.5px}
  .ra-card{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:var(--ui-radius,14px);padding:14px}
  .ra-card textarea{display:block;width:100%;min-height:150px;resize:vertical;border-radius:12px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:12px 14px;font:inherit;font-size:15px;line-height:1.6}
  .ra-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}.ra-row.end{justify-content:flex-end}
  .ra-row input{flex:1 1 200px;min-width:0;height:40px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 12px;font:inherit;font-size:14.5px}
  .ra-msg{margin-top:8px;font-size:13.5px;color:var(--ui-red);min-height:0}.ra-msg:empty{display:none}.ra-msg.ok{color:var(--ui-muted)}
  .ra-sec{margin:22px 0 10px;font-size:16px;font-weight:800;color:var(--ui-ink)}.ra-sec small{margin-left:8px;font-weight:500;color:var(--ui-muted);font-size:12.5px}
  .ra-grid{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:720px){.ra-grid{grid-template-columns:1fr 1fr}}
  .ra-it{display:flex;align-items:center;gap:12px;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;cursor:pointer;transition:border-color .15s,background .15s;min-width:0}
  .ra-it:hover{border-color:var(--ui-pur);background:var(--ui-surface-2)}.ra-it .t{flex:1 1 auto;min-width:0}
  .ra-it b{display:block;color:var(--ui-ink);font-size:15px;line-height:1.4}.ra-it span{display:block;color:var(--ui-muted);font-size:12.5px;margin-top:3px}
  .ra-it .pv{color:var(--ui-ink-2);font-size:13px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ra-it .tg{display:inline-block;font-size:11.5px;line-height:19px;padding:0 7px;border-radius:6px;background:var(--ui-pur-soft);color:var(--ui-pur-text);margin-right:6px}
  .ra-it .del{flex:0 0 auto;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-muted);border-radius:9px;height:32px;padding:0 10px;font:inherit;font-size:13px;cursor:pointer}.ra-it .del:hover{color:var(--ui-red);border-color:var(--ui-red-line)}
  .ra-it>i{font-style:normal;font-size:22px;color:var(--ui-muted)}
  .ra-empty{color:var(--ui-muted);font-size:14px;padding:14px 2px}
  .ra-news{background:linear-gradient(135deg,color-mix(in srgb,var(--ui-pur) 16%,var(--ui-surface)),var(--ui-surface));border:1px solid color-mix(in srgb,var(--ui-pur) 40%,var(--ui-line));border-radius:16px;padding:14px 16px;margin-bottom:14px}
  .ra-news .hd{font-size:13px;font-weight:800;color:var(--ui-pur-text);letter-spacing:.02em}.ra-news .hd small{margin-left:6px;font-weight:500;color:var(--ui-muted)}
  .ra-news .tt{display:block;margin:6px 0 4px;font-size:19px;line-height:1.4;color:var(--ui-ink);cursor:pointer}.ra-news .pv{color:var(--ui-ink-2);font-size:14px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ra-news .mt{margin-top:6px;font-size:12.5px;color:var(--ui-muted)}.ra-news .mt .ok{color:var(--ui-green,#3fb37f);font-weight:700}
  .ra-news a.src{color:var(--ui-muted);font-size:13px;text-decoration:none;margin-left:auto}.ra-news a.src:hover{color:var(--ui-ink)}
  .ra-quiz{margin:18px 0 6px;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:14px 16px}.ra-quiz h3{margin:0 0 4px;font-size:17px}.ra-quiz .sm{color:var(--ui-muted);font-size:13px;margin-bottom:8px}
  .ra-qq{margin:12px 0 0}.ra-qq b{display:block;font-size:15px;line-height:1.5;margin-bottom:6px}.ra-qq button{display:block;width:100%;text-align:left;margin:5px 0;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;padding:8px 12px;font:inherit;font-size:14.5px;cursor:pointer}
  .ra-qq button.ok{border-color:var(--ui-green,#3fb37f);background:color-mix(in srgb,var(--ui-green,#3fb37f) 18%,transparent)}.ra-qq button.bad{border-color:var(--ui-red);background:color-mix(in srgb,var(--ui-red) 15%,transparent)}.ra-qq .why{font-size:13px;color:var(--ui-ink-2);margin-top:4px}
  .ra-kw{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ra-kw span{border:1px solid var(--ui-line-2);border-radius:999px;padding:4px 10px;font-size:13.5px}.ra-kw span small{color:var(--ui-muted);margin-left:4px}
  .ra-nl{margin-top:10px;border-top:1px solid var(--ui-line);padding-top:6px}.ra-nl button{display:flex;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:var(--ui-ink-2);font:inherit;font-size:14px;line-height:1.45;padding:7px 2px;cursor:pointer;border-radius:8px}
  .ra-nl button:hover{color:var(--ui-ink);background:var(--ui-surface-2)}.ra-nl button em{flex:0 0 auto;font-style:normal;font-size:11.5px;color:var(--ui-muted);padding-top:2px;min-width:56px}
  .ra-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:2px 0 12px}.ra-bar .sp{flex:1 1 auto}
  .ra-title{margin:4px 0 10px;font-size:26px;line-height:1.35;color:var(--ui-ink)}
  .ra-stats{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;margin-bottom:18px}
  .ra-nums{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:14px;color:var(--ui-ink-2)}.ra-nums b{color:var(--ui-ink);font-size:16px}.ra-nums .hi b{color:var(--ui-orange)}
  .ra-nums label{margin-left:auto;display:flex;align-items:center;gap:6px;color:var(--ui-muted);font-size:13px;min-width:0}
  .ra-nums select{height:30px;border-radius:8px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);font:inherit;font-size:13px;max-width:200px;min-width:0}
  .ra-dist{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--ui-surface-2);margin-top:12px}.ra-dist i{display:block;height:100%}
  .ra-leg{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:12px;color:var(--ui-muted)}.ra-leg i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;vertical-align:-1px}
  .ra-note{margin-top:8px;font-size:12.5px;color:var(--ui-muted)}
  .ra-unk{margin-top:10px}.ra-unk summary{cursor:pointer;font-size:13.5px;color:var(--ui-pur-text)}
  .ra-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ra-chips button{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:999px;padding:3px 11px;font:inherit;font-size:13.5px;cursor:pointer}.ra-chips button small{color:var(--ui-muted);margin-left:3px}
  .ra-body{font-size:21px;line-height:1.95;color:var(--ui-ink);font-family:"Noto Serif",Georgia,"Times New Roman",var(--ui-font),serif}
  .ra-body p{margin:0 0 1.05em}
  .ra-s{border-radius:6px;transition:background .2s,box-shadow .2s}.ra-s.cur{background:rgba(156,63,208,.22);box-shadow:0 0 0 3px rgba(156,63,208,.22)}.ra-s.flash{background:rgba(156,63,208,.14)}
  .ra-sm{display:inline-flex;align-items:center;justify-content:center;width:18px;height:1em;vertical-align:-.08em;cursor:pointer}
  .ra-sm::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ui-line-2);transition:background .15s}.ra-sm:hover::before,.ra-s.cur .ra-sm::before{background:var(--ui-pur-text)}
  .ra-ss{border:0;background:none;padding:0 3px;margin:0;font-size:.62em;line-height:1;vertical-align:.12em;cursor:pointer;opacity:.5;color:inherit}.ra-ss:hover{opacity:1}
  .ra-tr{display:none;margin:-.55em 0 1.2em;padding:8px 12px;border-left:3px solid var(--ui-pur-soft,rgba(156,63,208,.35));background:var(--ui-surface);border-radius:0 10px 10px 0;color:var(--ui-ink-2);font-family:var(--ui-font);font-size:15.5px;line-height:1.75}
  .ra-tr.ld{color:var(--ui-muted);font-size:14px}.ra-tr.err{color:var(--ui-muted);font-size:13.5px;cursor:pointer}
  .ra-ttr{display:none;margin:-4px 0 12px;color:var(--ui-ink-2);font-size:16px}
  #reading.tr-on .ra-tr,#reading.tr-on .ra-ttr{display:block}
  #reading .ui-btn[data-a="tr"].on{background:var(--ui-pur-soft,rgba(156,63,208,.22));border-color:var(--ui-pur);color:var(--ui-pur-text)}
  .ra-end{margin-top:26px;display:flex;justify-content:center}
  #ra-fab{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:60;display:none;border:0;border-radius:999px;height:44px;padding:0 18px;background:var(--ui-pur);color:#fff;font:inherit;font-size:15px;font-weight:700;box-shadow:var(--ui-shadow);cursor:pointer}#ra-fab.on{display:block}
  @media(max-width:600px){.ra-body{font-size:18.5px;line-height:1.9}.ra-title{font-size:22px}.ra-nums label{margin-left:0;width:100%}.ra-nums select{flex:1 1 auto;max-width:none}}
  .toast{z-index:9700!important}`;

  let quiet = 0, root = null, view = "home", doc = null, P = { paras: [], sents: [] }, draft = "", urlDraft = "", msg = "", msgOk = false, fetching = false;
  let lvSel = String(LG("reading:lv", "auto")), PS = {}, vsP = null, vsDone = false;

  /* ---------- 译文：按段翻译，显示 / 隐藏 ---------- */
  let trOn = !!LG("reading:trOn", true), trBusy = 0;
  const TRK = "reading:tr", trAll = () => { const o = LG(TRK, {}); return o && typeof o === "object" ? o : {}; };
  function trGet(id) { return trAll()[id] || {}; }
  function trPut(id, k, v) { // 只留「我的文章」里还在的几篇，免得本机存储越积越多
    const o = trAll(), keep = new Set(docs().map(d => d.id)); keep.add(id);
    for (const x in o) if (!keep.has(x)) delete o[x];
    (o[id] = o[id] || {})[k] = v; if (!LS(TRK, o)) { const n = {}; n[id] = o[id]; LS(TRK, n); }
  }
  // 一段（几句）→ 中文：全站共用的翻译（tr.js：谷歌，不行用 MyMemory；太长自动按句子拆开）
  const translate = sents => TR.text(sents.join(" "));

  // 把当前文章没翻的段翻出来（两段同时翻），翻好一段填一段
  function fillTr() {
    if (!trOn || !doc || !root || view !== "read") return;
    const id = doc.id, have = trGet(id), my = ++trBusy;
    const jobs = [...root.querySelectorAll(".ra-tr[data-p], .ra-ttr")].filter(el => have[el.dataset.p] == null && !el.dataset.busy);
    const run = async () => {
      while (jobs.length && my === trBusy && doc && doc.id === id) {
        const el = jobs.shift(), k = el.dataset.p; el.dataset.busy = "1";
        const src = k === "t" ? [doc.title] : (P.paras[+k] || []).map(i => P.sents[i]);
        try { const t = await translate(src); trPut(id, k, t); if (el.isConnected) { el.textContent = t; el.className = el.className.replace(/\s*(ld|err)\b/g, ""); } else { const n = root.querySelector('[data-p="' + k + '"]'); if (n) { n.textContent = t; n.classList.remove("ld", "err"); } } }
        catch (e) { const n = el.isConnected ? el : root.querySelector('[data-p="' + k + '"]'); if (n) { n.textContent = "翻译没取到，点这里重试"; n.classList.remove("ld"); n.classList.add("err"); } }
        delete el.dataset.busy;
      }
    };
    run(); run();
  }
  function trHtml(k, cls) { const t = doc ? trGet(doc.id)[k] : null; return '<div class="' + cls + (t == null ? " ld" : "") + '" data-p="' + k + '">' + (t == null ? "翻译中…" : esc(t)) + "</div>"; }

  /* ---------- 生词本状态（words：已掌握 known / 在学 learning） ---------- */
  // 生词本状态（已掌握 kn / 在学 lr，按原形匹配）：全站共用 word.js 的 WORD.status
  function loadBook() { if (window.WORD) WORD.loadBook(); }
  const bookStatus = w => (window.WORD ? WORD.status(w) : "");
  const lemma = w => { try { return typeof vsLemma === "function" ? vsLemma(w) : w; } catch (e) { return w; } };


  /* ---------- 上色：和视频字幕同一套（web/vs/ 的 vsMark + vsGramHtml） ---------- */
  // 加载 vs/ 模块：优先用 watch.js 的 window.__vs.load()（顺便把插件标记、生词本合进 VS_MARKS）；没有视频页就自己加载那几个文件
  function ensureVs() {
    if (vsP) return vsP;
    vsP = (async () => {
      try { if (window.__vs && window.__vs.load) await window.__vs.load(); } catch (e) {}
      if (typeof vsMark !== "function") {
        let ver = ""; try { ver = (await (await fetch("vs/VERSION", { cache: "no-store" })).text()).trim(); } catch (e) {}
        const F = ["freq.js", "vlevel.js", "gram.js"];
        await new Promise(res => F.forEach((f, i) => { const s = document.createElement("script"); s.src = "vs/" + f + "?v=" + ver; s.async = false; if (i === F.length - 1) s.onload = s.onerror = res; document.head.append(s); }));
      }
      // 插件设置（词汇水平、颜色、开关）：只读，和 watch.js 读的是同一份
      try { const it = await CLOUD.chan("ext").get(); for (const k in it) if (k.indexOf("set|") === 0) PS[k.slice(4)] = it[k].v; } catch (e) {}
      vsDone = true;
    })().catch(() => { vsDone = true; });
    return vsP;
  }
  const plugLevel = () => { const n = Number(PS.level); return PS.level != null && isFinite(n) && n >= 0 ? n : -1; };
  const effLevel = () => (lvSel === "auto" ? (plugLevel() >= 0 ? plugLevel() : 3000) : Number(lvSel) || 3000);
  // 🎨 一句英文 → 能点、按水平上色的 html：全站共用的 word.js（WORD.html，和视频字幕、听力文稿同一套颜色）
  // 跟随插件水平、插件也设了水平：直接用插件设置；自己选了水平 / 插件没设水平：同样的函数，换个水平
  const sentHtml = t => WORD.html(t, lvSel === "auto" && plugLevel() >= 0 ? {} : { level: effLevel(), settings: PS });

  /* ---------- 统计：词数、阅读时间、生词率、水平分布 ---------- */
  function rankOf(w) {
    const k = w.toLowerCase().replace(/’/g, "'"); let r = vsRank(k); const l = lemma(k);
    if (l !== k && VS_RANK[l] && VS_RANK[l] < r) r = VS_RANK[l]; return r;
  }
  function analyze() {
    const ready = vsDone && typeof vsRank === "function" && typeof vsCat === "function" && typeof VS_RANK !== "undefined";
    const S = { level: effLevel(), ratio: PS.ratio || 1.5 }, bands = BANDS.map(() => 0), unk = new Map();
    let n = 0, unkN = 0;
    P.sents.forEach((s, si) => tokens(s).forEach(t => {
      if (!isWord(t.w)) return; n++; if (!ready) return;
      let cat = ""; try { cat = vsCat(t.w, S, t.first, false, true); } catch (e) {}
      if (cat === "special") { bands[5]++; return; }
      const r = rankOf(t.w); bands[r <= 1000 ? 0 : r <= 3000 ? 1 : r <= 6000 ? 2 : r <= 12000 ? 3 : 4]++;
      if ((cat === "suggest" || cat === "rare") && !bookStatus(t.w)) {
        unkN++; const k = lemma(t.w.toLowerCase()); const u = unk.get(k); if (u) u.c++; else unk.set(k, { w: t.w.toLowerCase(), c: 1, r, si });
      }
    }));
    return { ready, n, mins: Math.max(1, Math.round(n / WPM)), unkN, rate: n ? unkN / n : 0, bands, unk: [...unk.values()].sort((a, b) => b.c - a.c || a.r - b.r) };
  }
  function statsHtml() {
    const a = analyze(), tot = a.bands.reduce((x, y) => x + y, 0) || 1, pct = x => Math.round(x * 1000) / 10 + "%";
    const pl = plugLevel(), opt = (v, t) => '<option value="' + v + '"' + (String(lvSel) === String(v) ? " selected" : "") + ">" + t + "</option>";
    const sel = '<label>生词标准 <select id="ra-lv">' + opt("auto", pl >= 0 ? "跟随插件（" + pl + " 词）" : "跟随插件（未设置，按 3000）") + LEVELS.map(v => opt(v, "常用 " + v + " 词以内算认识")).join("") + "</select></label>";
    let h = '<div class="ra-nums"><span><b>' + a.n + "</b> 词</span><span>约 <b>" + a.mins + "</b> 分钟</span>" +
      (a.ready ? '<span class="hi">生词率 <b>' + pct(a.rate) + "</b>（" + a.unkN + " 处，" + a.unk.length + " 个词）</span>" : "<span>" + (vsDone ? "生词率：词频表没加载上" : "生词率计算中…") + "</span>") + sel + "</div>";
    if (a.ready) {
      h += '<div class="ra-dist">' + a.bands.map((x, i) => (x ? '<i style="width:' + (x / tot) * 100 + "%;background:" + BANDS[i][1] + '" title="' + esc(BANDS[i][0]) + " " + pct(x / tot) + '"></i>' : "")).join("") + "</div>" +
        '<div class="ra-leg">' + a.bands.map((x, i) => (x ? '<span><i style="background:' + BANDS[i][1] + '"></i>' + esc(BANDS[i][0]) + " " + pct(x / tot) + "</span>" : "")).join("") + "</div>";
      if (lvSel === "auto" && pl < 0) h += '<div class="ra-note">插件里还没设词汇水平，暂时按「常用 3000 词以内算认识」上色和统计，可以在右上角改。</div>';
      if (a.unk.length) h += '<details class="ra-unk"><summary>本文生词 ' + a.unk.length + " 个（点词查释义）</summary><div class=\"ra-chips\">" + a.unk.slice(0, 60).map(u => '<button data-w="' + esc(u.w) + '" data-si="' + u.si + '">' + esc(u.w) + (u.c > 1 ? "<small>×" + u.c + "</small>" : "") + "</button>").join("") + "</div></details>";
    }
    return h;
  }

  /* ---------- 我的文章（本机 localStorage） ---------- */
  const docs = () => { const L = LG(KEY, []); return Array.isArray(L) ? L.filter(d => d && d.id && typeof d.text === "string") : []; };
  function saveDocs(L) { L = L.slice(0, MAX_DOCS); if (!LS(KEY, L)) { window.__mineKeepDel = 1; try { if (!LS(KEY, L.slice(0, 8))) tip("本机存储满了，这篇文章没存下来"); } finally { window.__mineKeepDel = 0; } } } // 存不下时本机只留最近 8 篇（少掉的不当成删除传上去：别的设备上还在）
  function remember(d) { const L = docs().filter(x => x.id !== d.id); L.unshift({ id: d.id, title: d.title, text: d.text, at: d.at, pos: d.pos || 0 }); saveDocs(L); }
  let posTimer = 0;
  function setPos(i) { if (!doc || doc.pos === i) return; doc.pos = i; clearTimeout(posTimer); posTimer = setTimeout(() => { const L = docs(), x = L.find(y => y.id === doc.id); if (x) { x.pos = doc.pos; saveDocs(L); } }, 800); }
  function openDoc(text, title, id) {
    text = cleanText(text);
    if (!text || !/[A-Za-z]/.test(text)) { showMsg("先粘贴一段英文文章"); return; }
    if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); tip("文章太长，只保留前 " + MAX_CHARS / 10000 + " 万字"); }
    const old = docs().find(x => (id && x.id === id) || x.text === text);
    doc = { id: old ? old.id : id || "d" + Date.now().toString(36), title: title || (old && old.title) || titleOf(text), text, at: Date.now(), pos: old ? old.pos || 0 : 0 };
    remember(doc); stopAll(); closePop(); view = "read"; P = parse(text); draw(); setHash(doc.id); quiet = Date.now() + 1500; // 程序滚动不算「读到哪」
    const at = doc.pos > 0 && root.querySelector('.ra-s[data-i="' + doc.pos + '"]');
    if (at) { at.scrollIntoView({ block: "center" }); at.classList.add("flash"); setTimeout(() => at.classList.remove("flash"), 1600); tip("从上次读到的地方继续"); }
    else try { root.scrollIntoView({ block: "start" }); } catch (e) {}
  }
  function showMsg(m, ok) { msg = m; msgOk = !!ok; const el = root && root.querySelector("#ra-msg"); if (el) { el.textContent = m; el.classList.toggle("ok", !!ok); } }
  async function fromUrl(u) {
    u = String(u || "").trim(); if (!u) { showMsg("先填文章网址"); return; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    if (fetching) return; fetching = true; showMsg("正在抓取正文…", true); const b = root.querySelector('[data-a="url"]'); if (b) b.disabled = true;
    let j = null; try { const r = await fetch("/api/readurl?url=" + encodeURIComponent(u)); j = await r.json(); } catch (e) { j = null; }
    fetching = false; if (b) b.disabled = false;
    if (j && j.ok && j.text && /[A-Za-z]/.test(j.text)) { showMsg(""); urlDraft = ""; openDoc(j.text, j.title ? String(j.title).trim() : ""); }
    else { showMsg("这个网站抓不到，请直接粘贴正文"); tip("这个网站抓不到，请直接粘贴正文"); }
  }

  /* ---------- 画页面 ---------- */
  const fmtAt = t => { const d = new Date(t), n = new Date(); if (isNaN(d)) return ""; const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); return U.day(+d) === U.day() ? "今天 " + hm : d.getMonth() + 1 + "月" + d.getDate() + "日" + (d.getFullYear() !== n.getFullYear() ? "（" + d.getFullYear() + "）" : ""); };
  /* ---------- 📰 今日新闻 ---------- */
  const nday = () => U.day(); // 📅 全站共用的「今天」（util.js），和后台同一个（吉隆坡 / 北京时间）
  const hashU = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const newsId = n => "n:" + hashU(n.url || n.title || "");
  let NEWS = null, newsBusy = false, newsErr = "", newsList = false, newsTried = [], newsOpenAfter = false;
  function newsLoad(force) {
    const c = LG("reading:news", null);
    if (!force && c && c.date === nday() && c.text) { NEWS = c; return; }
    if (newsBusy) return; newsBusy = true; newsErr = ""; paintNews();
    U.json("/api/news?d=" + nday()).then(j => { newsBusy = false; if (j && j.ok && j.text) { NEWS = j; LS("reading:news", j); } else newsErr = j.error === "net" ? "今天的新闻没取到（网络问题）" : "今天的新闻还没取到，过一会儿再试"; paintNews(); if (NEWS && newsOpenAfter && view === "home") newsRead(); newsOpenAfter = false; })
      .catch(() => { newsBusy = false; newsErr = "今天的新闻没取到（网络问题）"; paintNews(); });
  }
  function newsHtml() {
    if (!NEWS) return '<div class="ra-news"><div class="hd">📰 今日新闻</div><div class="mt">' + (newsBusy ? "正在挑今天的热点新闻…" : esc(newsErr || "")) + (newsErr ? ' <button class="ui-btn" data-a="news-retry">重试</button>' : "") + "</div></div>";
    const d = docs().find(x => x.id === newsId(NEWS)), p = d ? parse(d.text) : null, n = p ? p.sents.length : 0, pc = d && n > 1 ? Math.min(100, Math.round(((d.pos || 0) / (n - 1)) * 100)) : 0;
    const first = splitSents(splitParas(NEWS.text)[0] || "")[0] || "", w = NEWS.words || wordCount(NEWS.text);
    const when = NEWS.pub ? fmtAt(NEWS.pub) : "";
    return '<div class="ra-news"><div class="hd">📰 今日新闻<small>每天一篇热点 · ' + esc(NEWS.src || "") + (when ? " · " + esc(when) : "") + "</small></div>" +
      '<b class="tt" data-a="news">' + esc(NEWS.title) + '</b><div class="pv">' + esc(first) + "</div>" +
      '<div class="mt">' + w + " 词 · 约 " + Math.max(1, Math.round(w / WPM)) + " 分钟" + (d ? ' · <span class="ok">' + (pc >= 90 ? "✓ 读完了" : "读到 " + pc + "%") + "</span>" : "") + "</div>" +
      '<div class="ra-row"><button class="ui-btn pri" data-a="news">' + (d ? "继续读 →" : "开始阅读 →") + '</button><button class="ui-btn" data-a="news-simp" title="AI 改写成 B1 难度（250–350 词），附 4 道理解题和文中生词；全家共用一份">' + (simpOf(NEWS) ? "✨ 读简单版" : simpBusy ? "✨ AI 改写中…" : "✨ 简单版 + 小测") + '</button><button class="ui-btn" data-a="news-alt">🎲 换一篇</button>' +
      ((NEWS.list || []).length ? '<button class="ui-btn" data-a="news-list">其它头条 ' + (newsList ? "▴" : "▾") + "</button>" : "") +
      (NEWS.url ? '<a class="src" href="' + esc(NEWS.url) + '" target="_blank" rel="noopener">原文 ↗</a>' : "") + "</div>" +
      (newsList ? '<div class="ra-nl">' + (NEWS.list || []).map((x, i) => '<button data-a="news-pick" data-i="' + i + '"><em>' + esc(x.s) + "</em><span>" + esc(x.t) + "</span></button>").join("") + "</div>" : "") + "</div>";
  }
  function paintNews() { const el = root && root.querySelector("#ra-newsbox"); if (el) el.innerHTML = newsHtml(); }
  async function newsFetch(x) { // 抓当天列表里的另一篇，成了就换成「今日新闻」
    if (fetching) return false; fetching = true; tip("正在抓取：" + x.t);
    let j = null; try { const r = await fetch("/api/readurl?url=" + encodeURIComponent(x.u)); j = await r.json(); } catch (e) { j = null; }
    fetching = false;
    if (!(j && j.ok && j.text && wordCount(j.text) >= 120)) { tip("这篇抓不到正文，换一篇试试"); return false; }
    const text = j.text.replace(/^[^\n]{0,200}\n\n/, m => (/[.!?"”]\s*$/.test(m.trim()) ? m : "")); // 第一段是标题就去掉
    NEWS = Object.assign({}, NEWS, { src: x.s, url: x.u, title: x.t || j.title, text, words: wordCount(text), pub: x.p, list: (NEWS.list || []).filter(y => y.u !== x.u).concat(NEWS.url ? [{ t: NEWS.title, u: NEWS.url, s: NEWS.src, p: NEWS.pub }] : []) });
    LS("reading:news", NEWS); newsList = false; paintNews(); return true;
  }
  async function newsAlt() {
    const L = (NEWS && NEWS.list || []).filter(x => !newsTried.includes(x.u)); if (!L.length) { newsTried = []; tip("今天的头条都换过一遍了"); return; }
    for (let k = 0; k < 3 && L.length; k++) { const x = L.splice(Math.floor(Math.random() * L.length), 1)[0]; newsTried.push(x.u); if (await newsFetch(x)) return; }
  }
  const newsRead = () => { if (NEWS) openDoc(NEWS.text, NEWS.title, newsId(NEWS)); };
  // ✨ 简单版 + 读后小测（/api/ai task newsimp）：结果按文章 id 存本机「reading:newsq」（最多 20 篇）；简单版作为一篇文章打开（id 后面加 ":s"）
  let simpBusy = false;
  const simpAll = () => { const A = LG("reading:newsq", {}) || {}, o = {}; for (const k in A) { const x = A[k]; o[k] = x && typeof x === "object" && "v" in x ? x.v : x; } return o; }; // 💾 U.keep 存的是 {v, at}（以前直接存内容，两种都认）
  const simpOf = n => n && simpAll()[newsId(n)];
  const baseId = id => String(id || "").replace(/:s$/, "");
  async function newsSimp() {
    if (!NEWS) return; const have = simpOf(NEWS); if (have) { openDoc(have.simple, "（简单版）" + NEWS.title, newsId(NEWS) + ":s"); return; }
    if (simpBusy) return; simpBusy = true; paintNews(); tip("AI 正在改写成简单版，大约半分钟…");
    const j = await AI.ask("newsimp", { url: NEWS.url, title: NEWS.title, text: NEWS.text });
    simpBusy = false;
    if (!(j && j.ok && j.simple)) { paintNews(); tip(j.ok ? "AI 改写失败了，过一会儿再试" : AI.msg(j, "AI 改写失败了，过一会儿再试")); return; }
    const id = newsId(NEWS); U.keep("reading:newsq", id, { simple: j.simple, summary_zh: j.summary_zh || "", quiz: j.quiz || [], words: j.words || [], at: Date.now() }, { max: 20 }); // 💾 全站共用的缓存（util.js）：最多 20 篇
    paintNews(); if (view === "home") openDoc(j.simple, "（简单版）" + NEWS.title, id + ":s");
  }
  let quizPick = {};
  // 读后小测答错的题收进「❌ 错题本」（errbook.js）
  function quizErr(qi, oi) {
    const Q = doc && simpAll()[baseId(doc.id)], q = Q && (Q.quiz || [])[qi];
    if (!q || oi === +q.ans || !window.ERR) return;
    window.ERR.add([{ src: "read", kind: "mcq", q: q.q, ctx: "出自：" + String(doc.title || "").replace(/^（简单版）/, ""), opts: q.opts, ans: +q.ans, wrong: q.opts[oi], why: q.why_zh || "" }]);
  }
  function quizHtml() { // 新闻文章（原文或简单版）读到底下：读后小测 + 文中生词
    const Q = doc && /^n:/.test(doc.id) && simpAll()[baseId(doc.id)]; if (!Q) return "";
    const isS = /:s$/.test(doc.id), qs = (Q.quiz || []).map((q, qi) => { const pk = quizPick[doc.id + qi]; return '<div class="ra-qq"><b>' + (qi + 1) + ". " + esc(q.q) + "</b>" + q.opts.map((o, oi) => '<button data-a="qz" data-q="' + qi + '" data-o="' + oi + '" class="' + (pk == null ? "" : oi === +q.ans ? "ok" : oi === pk ? "bad" : "") + '">' + String.fromCharCode(65 + oi) + ". " + esc(o) + "</button>").join("") + (pk != null ? '<div class="why">' + (pk === +q.ans ? "✅ 对了。" : "❌ 正确答案是 " + String.fromCharCode(65 + +q.ans) + "。") + esc(q.why_zh || "") + "</div>" : "") + "</div>"; }).join("");
    const n = (Q.quiz || []).length, got = (Q.quiz || []).filter((q, qi) => quizPick[doc.id + qi] === +q.ans).length, done = (Q.quiz || []).every((q, qi) => quizPick[doc.id + qi] != null);
    return '<div class="ra-quiz"><h3>🧩 读后小测</h3><div class="sm">' + esc(Q.summary_zh || "") + (done ? "　<b>答对 " + got + " / " + n + "</b>" : "") + "</div>" + qs +
      ((Q.words || []).length ? '<h3 style="margin-top:16px">🆕 原文里的生词</h3><div class="ra-kw">' + Q.words.map(w => '<span data-w="' + esc(w.en) + '">' + esc(w.en) + "<small>" + esc(w.zh || "") + "</small></span>").join("") + '</div><div class="ra-row"><button class="ui-btn" data-a="kw-add">＋ 全部加入生词本</button></div>' : "") +
      '<div class="ra-row"><button class="ui-btn" data-a="sw">' + (isS ? "📰 看原文" : "✨ 看简单版") + "</button></div></div>";
  }
  // 给别的页面用（📻 BBC 听力的文稿）：点词弹同一个查词框；生词本里这个词的状态（"lr" 在学 / "kn" 已掌握 / ""）；一段文字的生词率
  window.readTextDiff = async text => { init(); loadBook(); await ensureVs(); const sv = P; P = parse(String(text || "")); try { const a = analyze(); return { ready: a.ready, n: a.n, unkN: a.unkN, rate: a.rate, unk: a.unk.length, level: effLevel() }; } finally { P = sv; } };
  window.readingOpen = (text, title, id) => { init(); if (!root) return; openDoc(text, title, id); }; // 别的页面（📻 6 分钟英语的文稿）在阅读里打开一篇
  window.readingNews = () => { newsLoad(); if (NEWS) newsRead(); else newsOpenAfter = true; }; // 还没取到：取到后自动打开 // 「📅 每日一练」的「读」可以直接打开今天这篇

  function drawHome() {
    const L = docs();
    const mine = L.length ? '<div class="ra-grid">' + L.map(d => { const p = parse(d.text), n = p.sents.length, pc = n > 1 ? Math.round(((d.pos || 0) / (n - 1)) * 100) : 0;
      return '<div class="ra-it" data-a="open" data-id="' + esc(d.id) + '"><div class="t"><b>' + esc(d.title || "未命名文章") + "</b><span>" + esc(fmtAt(d.at)) + " · " + wordCount(d.text) + " 词" + (pc > 0 ? " · 读到 " + Math.min(100, pc) + "%" : "") + '</span></div><button class="del" data-a="del" data-id="' + esc(d.id) + '">删除</button><i>›</i></div>'; }).join("") + "</div>"
      : '<div class="ra-empty">还没有读过的文章。粘贴一篇，或者先读下面的示例。</div>';
    newsLoad();
    root.innerHTML = '<div class="ra-head"><h2>📰 阅读</h2><span>粘贴英文文章或网址，点词查词，一键加入生词本</span></div>' +
      '<div id="ra-newsbox">' + newsHtml() + "</div>" +
      '<div class="ra-card"><textarea id="ra-text" placeholder="把英文文章粘贴到这里…（直接粘贴网址也行）">' + esc(draft) + "</textarea>" +
      '<div class="ra-row"><input id="ra-url" inputmode="url" placeholder="或者填文章网址 https://…" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(urlDraft) + '"><button class="ui-btn" data-a="url">抓取</button></div>' +
      '<div class="ra-msg' + (msgOk ? " ok" : "") + '" id="ra-msg">' + esc(msg) + '</div><div class="ra-row end"><button class="ui-btn pri" data-a="go">开始阅读 →</button></div></div>' +
      '<div class="ra-sec">📚 我的文章<small>最近 ' + MAX_DOCS + " 篇，只存在这台设备</small></div>" + mine +
      '<div class="ra-sec">✨ 示例短文<small>每篇 200 词左右</small></div><div class="ra-grid">' +
      SAMPLES.map(s => '<div class="ra-it" data-a="sample" data-id="' + s.id + '"><div class="t"><b>' + esc(s.title) + '</b><span><em class="tg">' + esc(s.tag) + "</em>" + wordCount(s.text) + ' 词</span><div class="pv">' + esc(splitSents(splitParas(s.text)[0])[0]) + "</div></div><i>›</i></div>").join("") + "</div>";
  }
  function drawRead() {
    const skip0 = P.paras.length > 1 && P.paras[0].map(i => P.sents[i]).join(" ") === doc.title; // 第一段就是标题：不重复显示
    const body = P.paras.map((p, pi) => pi === 0 && skip0 ? "" : "<p>" + p.map(i => '<span class="ra-s" data-i="' + i + '"><b class="ra-sm" data-si="' + i + '" title="朗读这句"></b>' + sentHtml(P.sents[i]) + ' <button class="ra-ss" data-si="' + i + '" title="朗读这句" aria-label="朗读这句">🔊</button></span> ').join("") + "</p>" + trHtml(pi, "ra-tr")).join("");
    root.classList.toggle("tr-on", trOn);
    root.innerHTML = '<div class="ra-bar"><button class="ui-btn" data-a="home">← 文章列表</button><span class="sp"></span><button class="ui-btn" data-a="link" title="复制这篇文章的直达链接">🔗 链接</button><button class="ui-btn' + (trOn ? " on" : "") + '" data-a="tr" title="显示 / 隐藏每段的中文译文">文 译文' + (trOn ? "：显示" : "：隐藏") + '</button><button class="ui-btn pri" data-a="all">' + (tts ? "⏹ 停止朗读" : "▶ 全文朗读") + "</button></div>" +
      '<h1 class="ra-title">' + esc(doc.title) + "</h1>" + trHtml("t", "ra-ttr") + '<div class="ra-stats" id="ra-stats">' + statsHtml() + "</div>" +
      '<div class="ra-body" id="ra-body">' + body + "</div>" + quizHtml() + '<div class="ra-end"><button class="ui-btn" data-a="home">读完了，回到文章列表</button></div>' +
      '<button id="ra-fab" data-a="all">⏹ 停止朗读</button>';
    syncTts(); fillTr();
  }
  function draw() { if (!root) return; if (view === "read" && doc) drawRead(); else { view = "home"; drawHome(); } if (window.NAV) NAV.mark(); setHash(view === "read" && doc ? doc.id : ""); } // 🔙 打开 / 关上文章：记一条页面历史（nav.js）；地址栏的 #article/ 只在显示文章时有

  /* ---------- 朗读：单句、全文逐句（高亮当前句） ---------- */
  let tts = null;
  function hiSent(i) { if (!root) return; root.querySelectorAll(".ra-s.cur").forEach(x => x.classList.remove("cur")); const el = i >= 0 && root.querySelector('.ra-s[data-i="' + i + '"]'); if (!el) return; el.classList.add("cur"); const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 110) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  function syncTts() { if (!root) return; root.querySelectorAll('[data-a="all"]').forEach(b => { if (b.id === "ra-fab") b.classList.toggle("on", !!tts); else b.textContent = tts ? "⏹ 停止朗读" : "▶ 全文朗读"; }); }
  function stopAll() { if (!tts) return; clearTimeout(tts.t); tts = null; if (window.TTS) TTS.hush(); hiSent(-1); syncTts(); }
  function readAll(from) {
    if (!("speechSynthesis" in window)) { tip("此环境不支持朗读，可在手机浏览器打开"); return; }
    stopAll(); if (window.TTS) TTS.hush(); const run = {}; tts = run; syncTts(); // 全文朗读用系统语音（整篇用 AI 声音太费额度）；点单句才用 AI 真人声
    const step = i => {
      if (tts !== run) return;
      if (i >= P.sents.length || !root.classList.contains("on") || view !== "read") { stopAll(); if (i >= P.sents.length) tip("读完了"); return; }
      hiSent(i); setPos(i);
      let done = false;
      const next = () => { if (done || tts !== run) return; done = true; clearTimeout(run.t); run.t = setTimeout(() => step(i + 1), 220); };
      TTS.sys(P.sents[i], { lang: "en", end: next }); // 全站共用的朗读（tts.js），声音、语速和「⚙ 设置」里选的一样
      run.t = setTimeout(next, 5000 + P.sents[i].length * 140); // 有些浏览器偶尔不触发 onend：超时也往下读
    };
    setTimeout(() => step(Math.max(0, Math.min(from || 0, P.sents.length - 1))), 80);
  }
  function sayOne(i) { stopAll(); const el = root.querySelector('.ra-s[data-i="' + i + '"]'); if (el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1500); } say(P.sents[i]); setPos(i); }
  // 屏幕上第一句看得见的句子（全文朗读从这里开始；滚动时记进度）
  function firstVisible() { const L = root.querySelectorAll(".ra-s"); for (const el of L) if (el.getBoundingClientRect().bottom > 90) return +el.dataset.i; return 0; }

  /* ---------- 点词：全站共用的 word.js（点词查词卡片、右键循环标记，和看视频 / 插件一样） ---------- */
  const closePop = () => { if (window.WORD) WORD.close(); };
  function sentOf(el) { // 这个词所在的句子（生词清单里的词：文章里第一句有它的）
    const w = String(el.dataset.w || "").replace(/’/g, "'"), re = new RegExp("(^|[^\\p{L}])" + reEsc(w) + "(?![\\p{L}])", "iu");
    const s = el.closest(".ra-s"), si = s ? +s.dataset.i : el.dataset.si != null ? +el.dataset.si : null;
    return si != null && P.sents[si] && re.test(P.sents[si]) ? P.sents[si] : P.sents.find(x => re.test(x)) || "";
  }
  /* ---------- 重画（保持滚动位置、朗读高亮） ---------- */
  function redrawKeep() {
    if (!root || !root.classList.contains("on") || view !== "read") return; // 首页不依赖上色，不重画（免得打字时文本框被换掉）
    const y = window.scrollY, cur = root.querySelector(".ra-s.cur"), ci = cur ? cur.dataset.i : null;
    const open = root.querySelector(".ra-unk[open]");
    draw(); window.scrollTo(0, y);
    if (ci != null) { const el = root.querySelector('.ra-s[data-i="' + ci + '"]'); if (el) el.classList.add("cur"); }
    if (open) { const u = root.querySelector(".ra-unk"); if (u) u.open = true; }
  }

  function init() {
    if (root) return; root = document.getElementById("reading"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    loadBook();
    // 点词 / 右键单词：全站共用的 word.js；标记 / 加词以后重新上色
    if (window.WORD) WORD.bind(root, { sent: sentOf, quiet: () => !!tts });
    document.addEventListener("word-change", () => { loadBook(); redrawKeep(); });
    root.addEventListener("click", e => {
      const t = e.target;
      const sm = t.closest("[data-si]"); if (sm) { sayOne(+sm.dataset.si); return; }
      if (t.closest(".ra-tr.err, .ra-ttr.err")) { const n = t.closest(".err"); n.textContent = "翻译中…"; n.classList.remove("err"); n.classList.add("ld"); fillTr(); return; }
      const b = t.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
      if (a === "del") { e.stopPropagation(); const L = docs(), d = L.find(x => x.id === b.dataset.id); if (!d) return; U.ask("删除「" + (d.title || "这篇文章") + "」？换设备同步的记录也会一起删掉。", { ok: "删除", danger: true }).then(ok => { if (!ok) return; saveDocs(docs().filter(x => x.id !== d.id)); if (doc && doc.id === d.id) doc = null; draw(); }); return; }
      if (a === "open") { const d = docs().find(x => x.id === b.dataset.id); if (d) openDoc(d.text, d.title, d.id); return; }
      if (a === "news") { newsRead(); return; }
      if (a === "news-alt") { newsAlt(); return; }
      if (a === "news-simp") { newsSimp(); return; }
      if (a === "qz") { const k = doc.id + b.dataset.q; if (quizPick[k] == null) { quizPick[k] = +b.dataset.o; quizErr(+b.dataset.q, +b.dataset.o); const y = window.scrollY; drawRead(); window.scrollTo(0, y); } return; }
      if (a === "kw-add") { const Q = simpAll()[baseId(doc.id)]; if (!Q) return; b.disabled = true; b.textContent = "加入中…"; (async () => { let n = 0; for (const w of Q.words || []) { const sent = P.sents.find(x => x.toLowerCase().includes(String(w.en).toLowerCase())) || ""; if (await WORD.add(w.en, { sent, silent: true, from: "阅读·关键词" })) n++; } b.textContent = "已加入 " + n + " 个"; tip("已加入生词本 " + n + " 个"); })(); return; } /* 全站共用的加词（word.js） */
      if (a === "sw") { const Q = simpAll()[baseId(doc.id)], bid = baseId(doc.id); if (!Q) return; if (/:s$/.test(doc.id)) { const d = docs().find(x => x.id === bid); if (d) openDoc(d.text, d.title, d.id); else if (NEWS && newsId(NEWS) === bid) newsRead(); } else openDoc(Q.simple, "（简单版）" + doc.title, bid + ":s"); return; }
      if (a === "news-list") { newsList = !newsList; paintNews(); return; }
      if (a === "news-retry") { newsLoad(true); return; }
      if (a === "news-pick") { const x = NEWS && NEWS.list && NEWS.list[+b.dataset.i]; if (x) newsFetch(x).then(ok => { if (ok) newsRead(); }); return; }
      if (a === "sample") { const s = SAMPLES.find(x => x.id === b.dataset.id); if (s) openDoc(s.text, s.title, s.id); return; }
      if (a === "url") { urlDraft = (root.querySelector("#ra-url") || {}).value || ""; fromUrl(urlDraft); return; }
      if (a === "go") {
        const v = ((root.querySelector("#ra-text") || {}).value || "").trim();
        if (/^https?:\/\/\S+$/i.test(v)) { fromUrl(v); return; } // 文本框里只粘了一个网址：当网址抓
        if (!v) { const u = ((root.querySelector("#ra-url") || {}).value || "").trim(); if (u) { fromUrl(u); return; } }
        showMsg(""); openDoc(v); if (view === "read") draft = ""; return;
      }
      if (a === "link") { const u = location.origin + "/#article/" + encodeURIComponent(doc.id); U.copy(u, { ok: "已复制这篇文章的链接（换设备打开也能直接读到这篇）" }); return; } /* 📋 全站共用（util.js） */
      if (a === "home") { stopAll(); closePop(); const home = () => { view = "home"; draw(); setHash(""); try { root.scrollIntoView({ block: "start" }); } catch (er) {} }; if (window.NAV) NAV.back(home); else home(); return; } // 回到上一个页面
      if (a === "all") { if (tts) stopAll(); else readAll(firstVisible()); }
      if (a === "tr") { trOn = !trOn; LS("reading:trOn", trOn); root.classList.toggle("tr-on", trOn); b.classList.toggle("on", trOn); b.textContent = "文 译文" + (trOn ? "：显示" : "：隐藏"); fillTr(); }
    });
    root.addEventListener("input", e => { if (e.target.id === "ra-text") draft = e.target.value; else if (e.target.id === "ra-url") urlDraft = e.target.value; });
    root.addEventListener("keydown", e => { if (e.target.id === "ra-url" && e.key === "Enter") { e.preventDefault(); urlDraft = e.target.value; fromUrl(urlDraft); } });
    root.addEventListener("change", e => { if (e.target.id !== "ra-lv") return; lvSel = e.target.value; LS("reading:lv", lvSel); redrawKeep(); });
    // Esc 停朗读（查词卡片的 Esc 由 word.js 处理）
    KEYS.on("read", { when: () => root.classList.contains("on") && KEYS.visible(root) }, k => { if (k === "esc" && tts) { stopAll(); return true; } return false; }); // ⌨️ 全站共用的快捷键（keys.js）：Esc 停朗读
    let sT = 0;
    window.addEventListener("scroll", () => {
      if (view !== "read" || tts || !root.classList.contains("on") || sT || Date.now() < quiet) return;
      sT = setTimeout(() => { sT = 0; if (view === "read" && !tts && root.classList.contains("on")) setPos(firstVisible()); }, 500); // 记住读到哪一句
    }, { passive: true });
  }

  // 直达链接：地址 #article/文章id（文章会同步到后台，换设备也能打开）
  // 有页面历史（nav.js）时晚一点改地址：等它先记下新的一条，改的是新的那条（保留 history.state）
  function setHash(id) { const f = () => { if (id && !(root && root.getClientRects().length)) return; /* 文章不在屏幕上（切到别的标签了）：不加 #article/ */ try { const h = id ? "#article/" + encodeURIComponent(id) : ""; if (location.hash !== h && (id || /^#article\//.test(location.hash))) history.replaceState(history.state, "", location.pathname + location.search + h); } catch (e) {} }; if (window.NAV) setTimeout(f, 380); else f(); }
  async function fromHash() {
    const m = location.hash.match(/^#article\/(.+)$/); if (!m) return false; const id = decodeURIComponent(m[1]);
    let d = docs().find(x => x.id === id);
    if (!d && window.mineSyncPull) { await window.mineSyncPull("reading:docs"); d = docs().find(x => x.id === id); }
    if (d) { if (!(view === "read" && doc && doc.id === id)) openDoc(d.text, d.title, d.id); return true; }
    tip("没找到这篇文章（可能已经删掉了）"); setHash(""); return false;
  }
  // 🔙 页面历史：打开的是哪篇文章（看不到这一页时不记）
  if (window.NAV) NAV.reg("read", () => root && root.getClientRects().length ? { doc: view === "read" && doc ? doc.id : null } : undefined, x => {
    if (!x || !root) return;
    if (!x.doc) { if (view !== "home") { stopAll(); closePop(); view = "home"; draw(); setHash(""); } return; }
    if (view === "read" && doc && doc.id === x.doc) return;
    const d = docs().find(y => y.id === x.doc); if (d) openDoc(d.text, d.title, d.id); else { view = "home"; draw(); }
  });
  window.readingShow = () => { init(); if (!root) return; loadBook(); draw(); ensureVs().then(() => redrawKeep()); fromHash(); }; // 先画出来（不上色），vs 模块加载完再上色
  window.readingRefresh = () => { if (!root) return; loadBook(); if (root.classList.contains("on")) redrawKeep(); }; // 生词本变了（加词、标记已掌握）时调用
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
