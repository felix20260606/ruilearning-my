/* 「🎧 听 → 📻 听力节目」：四个来源十七个栏目（后台 /api/sme，见 _worker.js），一个来源一行
   分级（Breaking News English，同一篇新闻好几个难度）：📶 L1 初级 / L3 中级 / L5 中高级 / L6 高级
   NPR（正常语速播客，进阶）：🗞 每日新闻 Up First / 🔬 科学 Short Wave / 💰 经济 Planet Money；新节目的文稿 NPR 晚一两天才放，没有时说明
   VOA（美音，2025 年 3 月起停更，旧节目都在）：📚 美国故事 American Stories / 🗝 词语故事 Words and Their Stories / ✏️ 每日语法 Everyday Grammar / 🗞 慢速新闻 As It Is
   BBC（英音）：🎭 广播剧 Drama / 🎓 大学英语 English at University（这两个也不更新了）/ 🐢 慢速对话 Real Easy English / 💬 地道说法 The English We Speak / 📰 新闻英语 Learning English from the News / 📻 6 分钟英语 6 Minute English
   故事类（美国故事、广播剧、大学英语）：列表按故事排、每个故事从第 1 集起；顶上推荐「还没听的下一集」
   - 顶上一排切换栏目（记住上次选的 sme:s）；每个栏目：最新（或还没听的最新）一期 + 列表
   - 一期页面：播放器（慢 / 正常 / 快）、简介、本期问题、新闻标题、生词表（＋ 加生词本，例句取节目里那一句）、文稿按说话人分行（默认折起来，先盲听）
     「🀄 中文」开关（sme:zh）：所有英文下面加中文（一层层兜底：本机存的 sme:zhc → 后台存好的（KV，全家共用）→ 浏览器直接问谷歌 → 后台补缺的句子（谷歌没被拦就谷歌，不然 Workers AI）；还缺就显示「还有 N 句没翻出来 · 重试」，20 秒后自动再试一次）
     「📰 在阅读里打开文稿」= 用阅读页打开（按水平上色、点词查词、译文）
   - 播放中切到别的页面：播放器变成底部悬浮条继续播（↩ 回到节目 / ✕ 关掉）；同一个 <audio> 元素在页面和悬浮条之间挪，不会断
   - 听完（播放到 90% 以上，或点「✓ 听完了」）记进 sme:done {期号: 时间}，同步到后台 /api/mine k=sme；「📅 每日」的「听」今天听完一期就自动打勾
   - 🎯 逐句精听：每句单独播、慢放、听写对答案、🎙 跟读打分；「🔁 自动连播」每句放 N 遍、停几秒再下一句；快捷键 空格 / ← → / R / S
   - 🎵 文稿跟着语音（sme:follow，默认开）：放到哪句就高亮哪句、自动滚到那里；点任意一句从那句开始播（每句的时间和精听共用，同一期第一次要对一两分钟）
   - 文稿里点词 = 查词弹窗（word.js 的 WORD，能加生词本）；点句首 ▸ = 从这句播；单词按词汇水平上色（word.js 的 WORD.html，和阅读、视频字幕一样），生词本里「在学」的词淡紫底；开着「🎵 跟着语音」时还逐词亮（用 Whisper 每个词的时间）
   - 🤔 为什么没听出来：精听听写没全对时，AI 讲漏掉的地方是连读 / 弱读 / 吞音…，原文读起来像什么（POST /api/ai {task:"whymiss"}，同一句存 KV）
   - 🧩 听后小测：每期 5 道四选一（POST /api/ai {task:"lquiz"}，同一期全家共用一份），成绩记 sme:lq，做错的进错题本
   - 📥 离线下载：mp3 经 /api/sme?mp3=期号 转一手存进 Cache Storage「sme-off-v1」（连同文稿、每句时间），下好的在列表顶上；sme:off 记下了哪几期
   - ⏭ 播完接下一期（sme:cont）：同一栏目里下一期没听过的
   - 📊 每期难度：语速（词 / 分钟）+ 生词率（read.js 的 window.readTextDiff，按你的词汇水平），算过的存 sme:diff
   - 📈 我的听力：每天听了几分钟、精听几句、听写平均正确率、跟读几次（sme:stat {日期: {设备: {s, dk, dks, sh}}}，同步到 /api/mine k=sme 的 "st:日期:设备"）
   - 记住听到哪（sme:pos {期号: {t 秒, at}}，同步到 /api/mine k=sme 的 "pos:期号"）：再打开从断点接着听；听完就清掉
   - 手机锁屏 / 耳机：Media Session（标题、封面、播放暂停、快进快退 10 秒；精听时「上一首 / 下一首」= 上一句 / 下一句）
   依赖 index.html：window.enShow、toast；加词用 word.js 的 WORD.add；read.js 的 window.readingOpen；watch.js 的 window.videoCore.pause（两边不同时放） */
(function () {
  "use strict";
  const { esc, LG, LS, tip } = U; // 全站共用的小工具（util.js）
  // 新加的排前面。[栏目, 按钮, 英文名, 一句介绍, 来源, 故事类（按集连着听）]
  // 🇩🇪 学德语（window.VL === "de"）：只有德语的栏目（DW 慢速新闻，后台 /api/sme?s=dw 转 /api/dw）；英语的栏目都不显示
  const DE = window.VL === "de", RL = () => (DE ? "de" : "en"); // 跟读 / 听写打分按哪种语言比
  const SER_DE = [["dw", "📰 慢速新闻", "Langsam gesprochene Nachrichten", "德国之声（DW）每个工作日的德语新闻，用比平常慢的语速念，几分钟一期；带全文、中文翻译，点句子能跟读、听写", "DW"]];
  const SER = (DE ? SER_DE : [
    ["new", "🆕 本周更新", "This week", "所有来源最近 7 天出的新节目合在一起，按天排、新的在前（VOA 已停更、广播剧和大学英语是固定的旧节目，不在这里）", "NEW"],
    ["bn1", "📶 L1 初级", "Level 1", "同一篇时事新闻按难度改写成好几级：L1 句子短、词简单；每篇一两分钟，带全文。每三四天出一篇新的", "BNE"],
    ["bn3", "📶 L3 中级", "Level 3", "同一篇新闻的 L3 版本：句子长一点、细节多一点；每篇两三分钟，带全文", "BNE"],
    ["bn5", "📶 L5 中高级", "Level 5", "进阶篇的 L5 版本：用词和句式接近真实新闻；带全文", "BNE"],
    ["bn6", "📶 L6 高级", "Level 6", "进阶篇的原文（L6）：真实新闻的难度和语速；带全文", "BNE"],
    ["nup", "🗞 每日新闻", "Up First", "NPR 每天早上 15 分钟三条要闻，几位主持人和记者对话；正常语速（进阶），带按说话人分行的全文", "NPR"],
    ["nsw", "🔬 科学", "Short Wave", "NPR 科学播客：每期十几分钟聊一个科学话题，两人对话、讲得很清楚；正常语速，带全文", "NPR"],
    ["npm", "💰 经济", "Planet Money", "NPR 经济播客：用故事讲经济现象，二三十分钟；语速快、生词多（高级），带全文", "NPR"],
    ["vst", "📚 美国故事", "American Stories", "爱伦·坡、马克·吐温、欧·亨利等美国作家的经典短篇，用简单英语慢速朗读，长的分几集讲完；带生词表和全文", "VOA", 1],
    ["vwd", "🗝 词语故事", "Words and Their Stories", "每期几分钟讲一个美国人常用的习语：意思、来历和例句，慢速；带生词表和全文", "VOA"],
    ["vgr", "✏️ 每日语法", "Everyday Grammar", "每期讲一个语法点或容易用错的地方，例句多、慢速；带生词表和全文", "VOA"],
    ["vnw", "🗞 慢速新闻", "As It Is", "一篇一则时事、科技、文化新闻，用常用词写、慢速念；带生词表和全文", "VOA"],
    ["drama", "🎭 广播剧", "Drama", "名著改编的广播剧：爱丽丝梦游仙境、弗兰肯斯坦、格列佛游记、圣诞颂歌…多人对话，一个故事好几集；带文稿和生词", "BBC", 1],
    ["eau", "🎓 大学英语", "English at University", "18 集情景剧：跟着留学生 Mary 过大学第一年，每集学几句实用表达（求助、讨论、交作业…）；带文稿", "BBC", 1],
    ["ree", "🐢 慢速对话", "Real Easy English", "每周一期 · 两位主持人用简单英语慢慢聊日常话题，带生词表和文稿，最适合打基础"],
    ["tews", "💬 地道说法", "The English We Speak", "每周一期 · 3 分钟讲一个英国人常说的地道表达，有例句和文稿"],
    ["news", "📰 新闻英语", "Learning English from the News", "每周一期 · 用真实的新闻标题讲词：新闻背景、各家标题、关键词和例句（这个栏目没有全文文稿）"],
    ["sme", "📻 6 分钟英语", "6 Minute English", "每周一期 · 两位主持人 6 分钟聊一个话题，有本期问题、生词表和文稿"],
  ]).map(x => (x[4] ? x : x.concat("BBC")));
  const SM = Object.fromEntries(SER.map(x => [x[0], x]));
  const serOf = id => { const m = /^([a-z0-9]{2,6})\//.exec(id); return m && SM[m[1]] ? m[1] : /^drama\//.test(id) ? "drama" : /^english-at-university\//.test(id) ? "eau" : /^real-easy-english\//.test(id) ? "ree" : /^the-english-we-speak/.test(id) ? "tews" : /^learning-english-from-the-news/.test(id) ? "news" : "sme"; };
  const SRC = { DW: ["DW", "Deutsche Welle", "德国之声的学德语节目：慢速德语新闻，带全文"], NEW: ["最新", "各来源", ""], BNE: ["分级", "Breaking News English", "分级新闻：同一篇新闻有好几个难度，选适合自己的那一级"], NPR: ["NPR", "NPR", "美国公共广播电台的播客，正常语速（进阶）；新节目的文稿 NPR 一般晚一两天才放"], VOA: ["VOA", "VOA Learning English", "美音；2025 年 3 月起停更，旧节目都能听"], BBC: ["BBC", "BBC Learning English", ""] }; // [行首标签, 全名, 说明]
  const srcName = id => SRC[SM[serOf(id)][4]][1];
  const srcUrl = (id, ep) => { const s = serOf(id), sub = id.slice(s.length + 1), src = SM[s][4]; return (ep && ep.url) || (src === "DW" ? "https://learngerman.dw.com/de/x/a-" + sub : src === "VOA" ? "https://learningenglish.voanews.com/a/" + sub + ".html" : src === "NPR" ? "https://www.npr.org/transcripts/" + sub : src === "BNE" ? "https://breakingnewsenglish.com/" + sub + ".html" : "https://www.bbc.co.uk/learningenglish/english/features/" + id); };
  const MORE = {}; // 列表显示到第几期（「显示更多」）
  // 🆕 本周更新：一直在更新的栏目（分级、NPR、BBC 每周的）各自的列表里，挑最近 7 天的合起来
  const WKS = () => SER.filter(x => x[4] !== "NEW" && x[4] !== "VOA" && !x[5]).map(x => x[0]);
  const WKDAY = U.dayStart;
  function weekItems() { // → [{id, s, t, d, img, day, lv:[[栏目, id]...]}]，同一篇分级新闻的几个级别合成一张
    const cut = WKDAY(Date.now()) - 6 * 864e5, out = [], bne = {};
    WKS().forEach((k, si) => (LISTS[k] || []).forEach(x => {
      const t = Date.parse(x.d); if (!t || WKDAY(t) < cut) return;
      if (SM[k][4] === "BNE") { const b = x.id.slice(k.length + 1); if (bne[b]) { bne[b].lv.push([k, x.id]); return; } out.push(bne[b] = Object.assign({}, x, { s: k, si, day: WKDAY(t), lv: [[k, x.id]] })); return; }
      out.push(Object.assign({}, x, { s: k, si, day: WKDAY(t) }));
    }));
    return out.sort((a, b) => b.day - a.day || a.si - b.si);
  }
  const CSS = `
  #sme{display:none;max-width:900px;margin:0 auto;padding:6px 0 60px;overflow-wrap:anywhere;color:var(--ui-ink);font-family:var(--ui-font)}#sme.on{display:block}
  #sme .sm-ser{display:flex;flex-direction:column;gap:7px;margin:2px 0 10px}#sme .sm-row{display:flex;flex-wrap:wrap;gap:7px;align-items:center} /* 一个来源一行（VOA / BBC），放不下就折行，不用左右滑 */
  #sme .sm-ser button{flex:0 0 auto;border:1px solid var(--ui-line-2);background:var(--ui-surface);color:var(--ui-ink);border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}
  #sme .sm-ser button.on{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}
  #sme .sm-ser .src{flex:0 0 34px;font-size:11.5px;font-weight:800;letter-spacing:.04em;color:var(--ui-muted)}
  @media(max-width:640px){#sme .sm-ser button{padding:6px 11px;font-size:13.5px}#sme .sm-row{gap:6px}}
  #sme .sm-head{margin:2px 0 12px;color:var(--ui-muted);font-size:13.5px;line-height:1.55}#sme .sm-head b{color:var(--ui-ink-2)}
  #sme .sm-new{display:grid;grid-template-columns:200px 1fr;gap:14px;align-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--ui-pur) 16%,var(--ui-surface)),var(--ui-surface));border:1px solid color-mix(in srgb,var(--ui-pur) 40%,var(--ui-line));border-radius:16px;padding:14px;cursor:pointer;margin-bottom:16px}
  #sme .sm-new img{width:100%;border-radius:10px;display:block;aspect-ratio:16/9;object-fit:cover}#sme .sm-new small{color:var(--ui-pur-text);font-weight:800;font-size:12.5px}#sme .sm-new b{display:block;font-size:19px;margin:4px 0}#sme .sm-new p{margin:0;color:var(--ui-ink-2);font-size:14px}
  #sme .sm-grid{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:720px){#sme .sm-grid{grid-template-columns:1fr 1fr}}
  #sme .sm-it{display:flex;gap:12px;align-items:center;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:10px 12px;cursor:pointer;min-width:0}#sme .sm-it:hover{border-color:var(--ui-pur)}
  #sme .sm-wk-n{margin:0 0 4px;color:var(--ui-muted);font-size:13.5px}#sme .sm-wk-n b{color:var(--ui-ink)}#sme h3.sm-day{margin:16px 0 8px;font-size:14px;color:var(--ui-ink-2)}
  #sme .sm-it .lv{font-style:normal;display:inline-flex;gap:5px;margin-left:4px;vertical-align:1px}#sme .sm-it .lv button{border:1px solid var(--ui-line-2);background:var(--ui-surface-2,var(--ui-surface));color:var(--ui-ink);border-radius:999px;padding:1px 8px;font:inherit;font-size:11.5px;font-weight:700;cursor:pointer}#sme .sm-it .lv button:hover{border-color:var(--ui-pur)}#sme .sm-it .lv button.ok{color:var(--ui-muted)}
  #sme .sm-it .ph{width:88px;height:50px;border-radius:8px;flex:0 0 auto;display:grid;place-items:center;font-size:24px;font-style:normal;background:var(--ui-line)}
  #sme .sm-it img{width:88px;height:50px;object-fit:cover;border-radius:8px;flex:0 0 auto}#sme .sm-it .t{min-width:0;flex:1}#sme .sm-it b{display:block;font-size:14.5px;line-height:1.35}#sme .sm-it span{display:block;color:var(--ui-muted);font-size:12px;margin-top:2px}
  #sme .ok{color:var(--ui-green,#3fb37f);font-weight:700}
  #sme .sm-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:2px 0 12px}#sme .sm-bar .sp{flex:1}
  #sme .ui-btn.on{border-color:var(--ui-pur);color:var(--ui-pur-text)}
  #sme h1{margin:4px 0 6px;font-size:24px;line-height:1.35}#sme .sm-date{color:var(--ui-muted);font-size:13px;margin-bottom:10px}
  #sme .sm-box{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:14px;padding:12px 14px;margin:0 0 12px}#sme .sm-box h3{margin:0 0 8px;font-size:15px}
  #sme .sm-opts{margin:-4px 2px 12px}
  #sme .sm-pl.stick{position:sticky;top:var(--sm-top,104px);z-index:30;transition:box-shadow .2s}#sme .sm-pl.stick.stuck{box-shadow:0 10px 24px rgba(0,0,0,.45);border-color:var(--ui-line-2)}
  #sme .sm-pl .sm-kbd{font-size:12px;color:var(--ui-muted);margin-left:4px}@media (hover:none),(max-width:600px){#sme .sm-pl .sm-kbd{display:none}}
  #sme audio,#sm-float audio{width:100%;margin:4px 0 6px;display:block}#sme .sm-rate{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--ui-muted)}
  #sme .sm-rate button{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:8px;padding:3px 10px;font:inherit;font-size:13px;cursor:pointer}#sme .sm-rate button.on{border-color:var(--ui-pur);color:var(--ui-pur-text)}
  #sme .sm-q div{margin:3px 0;font-size:14.5px}#sme .sm-intro{font-size:14.5px;line-height:1.6;color:var(--ui-ink-2)}
  #sme .zh{display:block;color:var(--ui-muted);font-size:.88em;line-height:1.55;margin-top:2px}#sme .zh:empty{display:none}#sme .zh.ld{opacity:.6}
  #sme .sm-voc{display:grid;grid-template-columns:auto 1fr auto;gap:8px 12px;align-items:center}#sme .sm-voc b{font-size:15px}#sme .sm-voc span.d{color:var(--ui-ink-2);font-size:13.5px}#sme .sm-voc i{display:block;font-style:normal;color:var(--ui-muted);font-size:13px;margin-top:3px}
  #sme .sm-voc button{border:1px solid var(--ui-line-2);background:transparent;color:var(--ui-ink);border-radius:8px;height:30px;padding:0 9px;font:inherit;font-size:13px;cursor:pointer}
  #sme .sm-hd div{margin:0 0 8px;font-size:14.5px}#sme .sm-hd small{color:var(--ui-muted);font-size:12px;margin-left:6px}
  #sme .sm-tr{font-size:16px;line-height:1.7}#sme .sm-tr p{margin:0 0 10px}#sme .sm-tr .w{display:block;font-size:12px;font-weight:800;color:var(--ui-pur-text)}#sme .sm-tr .sn{border-radius:5px;padding:1px 2px;margin:0 -2px;transition:background .25s,color .25s}#sme .sm-tr .sn.cur .vs-w.on{background:var(--ui-pur);color:#fff}#sme .sm-tr .sp{font-style:normal;font-weight:400;color:var(--ui-pur-text);opacity:.55;cursor:pointer;font-size:.78em;padding:0 4px 0 1px}#sme .sm-tr .sp:hover{opacity:1}#sme .sm-tr .sn.cur{background:var(--ui-pur-soft);color:var(--ui-pur-text);box-shadow:inset 0 -2px 0 var(--ui-pur)}#sme .sm-trst{font-size:13px;color:var(--ui-muted);margin:-4px 0 10px}#sme .sm-tr.hide{filter:blur(6px);user-select:none;max-height:220px;overflow:hidden;cursor:pointer}
  #sme .sm-empty{color:var(--ui-muted);padding:16px 2px}
  #sme .sm-diff{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 10px;font-size:12.5px}#sme .sm-diff span{border:1px solid var(--ui-line-2);border-radius:999px;padding:2px 9px;color:var(--ui-ink-2)}#sme .sm-diff span.e{border-color:var(--ui-green-line);color:var(--ui-green)}#sme .sm-diff span.m{border-color:var(--ui-orange-line);color:var(--ui-orange)}#sme .sm-diff span.h{border-color:var(--ui-red-line);color:var(--ui-red)}
  #sme .dk-why{border-left:3px solid var(--ui-pur);padding:6px 10px;margin:8px 0 0;background:var(--ui-surface-2);border-radius:0 10px 10px 0;font-size:14px;line-height:1.6}#sme .dk-why b{font-size:15px}#sme .dk-why code{background:var(--ui-pur-soft);color:var(--ui-pur-text);border-radius:5px;padding:1px 6px;font-family:inherit;font-weight:700}#sme .dk-why .kd{font-size:12px;border:1px solid var(--ui-line-2);border-radius:999px;padding:0 7px;margin-left:6px;color:var(--ui-muted)}#sme .dk-why button{margin-left:6px}
  #sme .lq-q{margin:0 0 12px}#sme .lq-q b{display:block;font-size:14.5px;margin-bottom:5px}#sme .lq-q button{display:block;width:100%;text-align:left;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:9px;padding:7px 10px;margin:0 0 5px;font:inherit;font-size:14px;cursor:pointer}#sme .lq-q button.ok{border-color:var(--ui-green);color:var(--ui-green)}#sme .lq-q button.bad{border-color:var(--ui-red);color:var(--ui-red)}#sme .lq-q .why{font-size:13px;color:var(--ui-ink-2)}
  #sme .st-row{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13.5px;color:var(--ui-ink-2)}#sme .st-row b{font-size:17px;color:var(--ui-ink)}#sme .st-bars{display:flex;gap:4px;align-items:flex-end;height:46px;margin:10px 0 2px}#sme .st-bars i{flex:1;background:var(--ui-pur);border-radius:3px 3px 0 0;min-height:2px;opacity:.85}#sme .st-bars i.z{background:var(--ui-line-2);opacity:.6}#sme .st-ax{display:flex;justify-content:space-between;font-size:11px;color:var(--ui-muted)}
  #sme .sm-off{display:flex;gap:10px;align-items:center;margin:0 0 6px}#sme .sm-off .t{flex:1;min-width:0;cursor:pointer}#sme .sm-off b{display:block;font-size:14px}#sme .sm-off small{color:var(--ui-muted);font-size:12px}
  #sme .sm-dk h3 small{font-weight:400;color:var(--ui-muted);font-size:12.5px;margin-left:6px}#sme .dk-n{font-size:12.5px;color:var(--ui-pur-text);font-weight:800;margin-bottom:4px}
  #sme .dk-t{font-size:18px;line-height:1.65;min-height:30px;margin:2px 0 8px}#sme .dk-t.hid{color:var(--ui-muted);font-size:14.5px}#sme .dk-t .h{color:var(--ui-green,#3fb37f)}#sme .dk-t .m{color:var(--ui-red,#ff8080);text-decoration:underline wavy;text-underline-offset:4px}
  #sme .dk-b{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}#sme .dk-b .ui-btn{min-width:44px}
  #sme .dk-in{display:flex;gap:6px}#sme .dk-in input{flex:1;min-width:0;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:10px;padding:9px 11px;font:inherit;font-size:15.5px}
  #sme .dk-sc{font-size:14px;margin-top:8px;color:var(--ui-ink-2)}#sme .dk-sc b{font-size:16px}
  #sm-float{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9400;width:min(560px,calc(100vw - 24px));box-sizing:border-box;background:var(--ui-surface,#26282c);border:1px solid color-mix(in srgb,var(--ui-pur,#9C3FD0) 50%,var(--ui-line-2,#454950));border-radius:16px;padding:8px 10px 4px;box-shadow:0 14px 40px rgba(0,0,0,.45);color:var(--ui-ink,#e6e8eb);font-family:var(--ui-font);display:none}
  #sm-float.on{display:block}#sm-float .top{display:flex;align-items:center;gap:8px;font-size:13px}#sm-float .top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #sm-float button{border:1px solid var(--ui-line-2,#454950);background:var(--ui-surface-2,#2d2f34);color:var(--ui-ink,#e6e8eb);border-radius:8px;height:28px;padding:0 9px;font:inherit;font-size:12.5px;cursor:pointer;flex:0 0 auto}
  @media(max-width:640px){#sme .sm-new{grid-template-columns:1fr}#sme h1{font-size:21px}#sme .sm-voc{grid-template-columns:1fr auto}#sme .sm-voc b{grid-column:1/-1;margin-top:4px}}`;

  let root = null, ser = SM[LG("sme:s", "")] ? LG("sme:s", "") : SER[0][0], view = "home", trShow = false, rate = +LG("sme:rate", 1) || 1, zhOn = !!LG("sme:zh", false), follow = LG("sme:follow", true) !== false, fword = LG("sme:fword", true) !== false, cont = !!LG("sme:cont", false);
  const LISTS = {}, listBusy = {}, EPS = {}, ZH = {}, zhBusy = {}; let EP = null, epBusy = false;
  // ---------- 一个一直在的 <audio>：在节目页里显示，切走了就挪进悬浮条 ----------
  const AU = document.createElement("audio"); AU.controls = true; AU.preload = "metadata"; AU.id = "sm-audio"; if (window.NET) NET.audio(AU); // 大陆打不开 BBC：自动改走后台中转
  let fl = null, flClosed = false, auTitle = "";
  function flEl() {
    if (fl) return fl; fl = document.createElement("div"); fl.id = "sm-float";
    fl.innerHTML = '<div class="top"><span>🎧</span><b></b><button data-f="back" title="回到这期节目">↩ 回到节目</button><button data-f="x" title="停止并关掉">✕</button></div><div class="au"></div>';
    fl.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; if (b.dataset.f === "x") { AU.pause(); flClosed = true; sync(); } else backToEp(); });
    document.body.append(fl); return fl;
  }
  const onPage = () => !!(root && root.classList.contains("on") && root.getClientRects().length && view === "ep" && EP && !EP.err && EP.id === AU.dataset.id);
  // html.sm-floating：视频悬浮窗看到这个会往上挪，不叠在一起。只在真的要变时才写：classList 就算没变也会触发 MutationObserver，sync 又在监听 html 的 class，会死循环卡住页面
  function setFloatCls(on) { const H = document.documentElement; if (H.classList.contains("sm-floating") !== on) H.classList.toggle("sm-floating", on); }
  function sync() { // 节目页看得见 → 播放器放回页面；看不见但在播（或暂停在中途）→ 悬浮条
    const slot = root && root.querySelector("#sm-slot"), f = flEl(), box = f.querySelector(".au");
    if (onPage() && slot) { if (AU.parentNode !== slot) slot.append(AU); f.classList.remove("on"); setFloatCls(false); return; }
    if (AU.parentNode !== box) box.append(AU);
    const keep = !!AU.dataset.id && !flClosed && (!AU.paused || (AU.currentTime > 0 && !AU.ended));
    f.querySelector("b").textContent = auTitle; f.classList.toggle("on", keep); setFloatCls(keep);
  }
  function backToEp() {
    const id = AU.dataset.id; if (!id) return;
    if (window.enShow) window.enShow("listen", "sme");
    ser = serOf(id); LS("sme:s", ser); if (!(EP && EP.id === id && view === "ep")) openEp(id); else { draw(); window.scrollTo(0, 0); }
  }
  // ---------- 记住听到哪 ----------
  const fmt = t => { t = Math.max(0, Math.round(t || 0)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
  const POS = () => LG("sme:pos", {}) || {};
  let posT = 0;
  function savePos(sync) {
    const id = AU.dataset.id; if (!id || !AU.duration || (DK[id] && DK[id].sents)) return; // 精听时的跳来跳去不算
    const P = POS(), t = AU.currentTime, at = Date.now();
    if (t < 15 || t > AU.duration - 20 || AU.ended) { if (!P[id]) return; delete P[id]; LS("sme:pos", P); if (sync) putPos(id, null, at); return; }
    P[id] = { t: Math.round(t), at }; LS("sme:pos", P); if (sync) putPos(id, P[id].t, at);
  }
  const CL = CLOUD.chan("sme"); // 全站共用的同步（cloud.js）：听过哪几期、听到哪、听力统计
  function putPos(id, t, at) { if (t == null) CL.del("pos:" + id, at); else CL.put("pos:" + id, t, at); }
  window.addEventListener("pagehide", () => { if (AU.dataset.id && !AU.paused) savePos(false); });
  AU.addEventListener("loadedmetadata", () => {
    AU.playbackRate = rate;
    const p = POS()[AU.dataset.id]; // 从断点接着听（精听已经定好位置的不动）
    if (p && AU.currentTime < 1 && !(DK[AU.dataset.id] && DK[AU.dataset.id].sents) && p.t > 15 && p.t < AU.duration - 20) { AU.currentTime = p.t; tip("⏯ 从 " + fmt(p.t) + " 接着听（上次听到这里）"); }
  });
  AU.addEventListener("pause", () => savePos(true));
  AU.addEventListener("ended", () => savePos(true));
  AU.addEventListener("timeupdate", () => { if (Date.now() - posT > 5000) { posT = Date.now(); savePos(false); } });
  // ---------- 手机锁屏 / 耳机控制（Media Session） ----------
  function msSet() {
    const M = navigator.mediaSession; if (!M || !AU.dataset.id) return;
    const id = AU.dataset.id, m = meta(id), ep = EPS[id] || {};
    try { M.metadata = new MediaMetadata({ title: ep.title || m.t || auTitle, artist: srcName(id), album: SM[serOf(id)][2], artwork: m.img ? [{ src: m.img, sizes: "624x351", type: "image/jpeg" }] : [] }); } catch (e) {}
    const dk = () => EP && EP.id === id && DK[id] && DK[id].sents && view === "ep";
    const H = { play: () => AU.play().catch(() => {}), pause: () => AU.pause(), seekbackward: () => { AU.currentTime = Math.max(0, AU.currentTime - 10); }, seekforward: () => { AU.currentTime = Math.min(AU.duration || 1e9, AU.currentTime + 10); },
      previoustrack: () => dk() ? dkGo(-1) : (AU.currentTime = Math.max(0, AU.currentTime - 10)), nexttrack: () => dk() ? dkGo(1) : (AU.currentTime = Math.min(AU.duration || 1e9, AU.currentTime + 10)) };
    for (const k in H) try { M.setActionHandler(k, H[k]); } catch (e) {}
  }
  AU.addEventListener("play", msSet);
  AU.addEventListener("play", () => { flClosed = false; MEDIA.solo(AU); sync(); }); // 全站共用的放音（media.js）：朗读、视频、练习课的原声都停掉
  AU.addEventListener("pause", () => sync());
  AU.addEventListener("timeupdate", () => { if (AU.duration && AU.currentTime / AU.duration > 0.9 && AU.dataset.id) markDone(AU.dataset.id); });
  window.smePause = () => { try { AU.pause(); } catch (e) {} }; // 旧接口；新代码用 MEDIA.solo（media.js）
  MEDIA.reg(AU);

  // ---------- 听过哪几期：本机 sme:done + 后台 /api/mine k=sme ----------
  const done = () => LG("sme:done", {}) || {};
  function markDone(id) {
    const D = done(); if (D[id] && U.day(D[id]) === U.day()) return;
    D[id] = Date.now(); LS("sme:done", D);
    CL.put(id, D[id], D[id]);
    tip("✓ 这期听完了"); if (view === "ep") draw();
  }
  let pulled = false;
  function pull() {
    if (pulled) return; pulled = true;
    CL.pull({ force: true }).then(items => { if (!items) return; const j = { items }, D = done(); let ch = false; const P = POS(); let pc = false;
      for (const id in j.items || {}) {
        const x = j.items[id];
        if (id.startsWith("st:")) { const mm = id.match(/^st:(\d{4}-\d\d-\d\d):(\w+)$/); if (mm && x.v && typeof x.v === "object") { const A = STAT(), Dd = A[mm[1]] = A[mm[1]] || {}, mine = mm[2] === DEV; if (!Dd[mm[2]] || (!mine && +x.at > (+Dd[mm[2]].at || 0)) || (mine && +x.v.s > (+Dd[mm[2]].s || 0))) { Dd[mm[2]] = x.v; LS("sme:stat", A); pc = true; } } continue; } // 听力统计：每台设备一条
        if (id.startsWith("pos:")) { const e = id.slice(4); if (+x.at > (+(P[e] || {}).at || 0)) { if (x.del) { if (P[e]) { delete P[e]; pc = true; } } else { P[e] = { t: +x.v, at: +x.at }; pc = true; } } continue; } // 听到哪：新的为准
        if (!x.del && +x.v > (+D[id] || 0)) { D[id] = +x.v; ch = true; }
      }
      if (pc) LS("sme:pos", P); if (ch || pc) { if (ch) LS("sme:done", D); draw(); } });
  }

  const LAT = {}; // 每个栏目的列表是什么时候读的
  function loadList(s) {
    if (s === "new") { WKS().forEach(loadList); return; }
    // 读过的列表 30 分钟内直接用；页面一直开着（手机上的网页 App）超过 30 分钟，下次进来再问一次后台有没有新的一期（先照样显示旧的）
    if ((LISTS[s] && Date.now() - (LAT[s] || 0) < 30 * 60e3) || listBusy[s]) return; listBusy[s] = true;
    const fin = l => { listBusy[s] = false; LAT[s] = Date.now(); if (!l.length && LISTS[s] && LISTS[s].length) return; LISTS[s] = l; if (view === "home" && (ser === s || (ser === "new" && WKS().includes(s)))) draw(); };
    U.json("/api/sme?s=" + s).then(j => fin(j.ok ? j.list : []));
  }
  let openId = null; // 正在打开的那一期（加载完之前 EP 还是空的，页面历史要用）
  const ok = id => { id = String(id || ""); const m = /^([a-z0-9]{2,6})\//.exec(id); if (m && !SM[m[1]]) return false; return !!SM[serOf(id)]; }; // 带栏目前缀的（dw/、vst/…）栏目必须是这种语言的；BBC 的期号按名字认 // 这一期属于这种语言的栏目吗（英语的期号在学德语时打不开，反过来也一样）
  function openEp(id) {
    if (!ok(id)) { openId = null; view = "home"; loadList(ser); draw(); return; } // 上次在另一种语言里打开的那期（页面历史 / 下载记录）：回到列表
    openId = id;
    if (OFF()[id] && !(id in BLOB) && "caches" in window) { offBlob(id).then(() => openEp(id)); return; } // 下载过的：先拿到本机的音频再画
    view = "ep"; trShow = false; EP = EPS[id] || null; epBusy = !EP; draw(); if (root && root.getClientRects().length) window.scrollTo(0, 0);
    if (EP) { if (zhOn) loadZh(id); return; }
    const fromOff = async () => { const o = await offJson(id); if (!o || !o.ep) return null; if (o.zh) ZH[id] = o.zh; if (o.sents) TIM[id] = o.sents; return o.ep; };
    U.json("/api/sme?ep=" + encodeURIComponent(id)).then(async j => { if (!(j && j.ok)) j = (await fromOff()) || j; epBusy = false; if (j && j.ok) EPS[id] = j; if (view === "ep" && !EP) { EP = j && j.ok ? j : { err: 1, id, msg: j && j.error === "net" ? "网络不通" : (j && j.error) || "" }; draw(); if (zhOn && EP.ok) loadZh(id); } });
  }
  // 🀄 中文：先找后台（翻过的存 KV，全家共用）；后台翻不了（谷歌拦了 Cloudflare 机房的 IP）就在浏览器里翻（tr.js，和阅读、视频字幕一样）
  // 一期要翻的所有文字（顺序和后台 /api/sme?zh=1 一样）↔ 翻好的结构
  const zhAll = ep => [ep.intro || "", ...(ep.q || []), ...(ep.vocab || []).map(v => v[1] || ""), ...(ep.vocab || []).map(v => v[2] || ""), ...(ep.heads || []).map(h => h[0]), ...(ep.lines || []).map(l => l.t)];
  const zhFlat = (j, ep) => { const pad = (a, n) => Array.from({ length: n }, (_, i) => (a || [])[i] || ""); const V = (ep.vocab || []).length; return [j.intro || "", ...pad(j.q, (ep.q || []).length), ...pad(j.vocab, V), ...pad(j.vex, V), ...pad(j.heads, (ep.heads || []).length), ...pad(j.lines, (ep.lines || []).length)]; };
  function zhBuild(ep, zh) { let i = 1; const take = n => { const r = zh.slice(i, i + n); i += n; return r; }, V = (ep.vocab || []).length; return { ok: true, id: ep.id, intro: zh[0], q: take((ep.q || []).length), vocab: take(V), vex: take(V), heads: take((ep.heads || []).length), lines: take((ep.lines || []).length) }; }
  const zhMiss = id => { const ep = EPS[id], j = ZH[id]; if (!ep) return 0; if (!j) return zhAll(ep).filter(Boolean).length; const f = zhFlat(j, ep); return zhAll(ep).filter((t, i) => t && !f[i]).length; };
  const ZHC = () => LG("sme:zhc", {}) || {}; // 这台设备翻好的（最近 15 期）：再打开马上有，没网也有
  const zhKeep = (id, j) => U.keep("sme:zhc", id, j, { max: 15 }); // 💾 全站共用的缓存（util.js）：最近 15 期
  // 🀄 一层层来，哪层成了就停：① 本机存的 ② 后台（存过的 / 谷歌 / Workers AI）③ 浏览器直接问谷歌 ④ 剩下的请后台 AI 翻（③④ 都在 tr.js 的 TR.lines）；还缺的页面上写「还有 N 句没翻出来 · 重试」
  const zhSt = {};
  async function loadZh(id, retry) {
    if (zhBusy[id] || (ZH[id] && !retry && !zhMiss(id))) return; zhBusy[id] = true; zhSt[id] = ""; if (EP && EP.id === id) draw();
    let j = ZH[id] || U.kept("sme:zhc", id) || (ZHC()[id] || {}).j || null; // (… ).j：以前的存法
    if (!j || zhMissOf(j, id)) { try { const r = await U.json("/api/sme?zh=1&co=1&ep=" + encodeURIComponent(id)); if (r && r.ok && (!j || zhMissOf(r, id) < zhMissOf(j, id))) j = r; } catch (e) {} }
    const ep = EPS[id];
    if (ep) {
      const all = zhAll(ep), zh = j ? zhFlat(j, ep) : all.map(() => ""), miss = () => all.map((t, i) => (t && !zh[i] ? i : -1)).filter(i => i >= 0);
      let m = miss();
      if (m.length) { const g = await TR.lines(m.map(i => all[i])); m.forEach((i, k) => { if (g[k]) zh[i] = g[k]; }); } // 全站共用的翻译（tr.js）：谷歌，剩下的请后台 AI 翻
      if (zh.some(Boolean)) j = zhBuild(ep, zh);
    }
    zhBusy[id] = false;
    if (j && j.ok) { ZH[id] = j; zhKeep(id, j); }
    const left = zhMiss(id); zhSt[id] = left ? (ZH[id] ? "还有 " + left + " 句没翻出来" : "中文没翻出来（网络不通？）") : "";
    if (left && !retry) setTimeout(() => { if (zhOn && zhMiss(id)) loadZh(id, true); }, 20000); // 过 20 秒自动再试一次
    if (EP && EP.id === id) draw();
  }
  const zhMissOf = (j, id) => { const ep = EPS[id]; if (!ep) return j ? 0 : 1; const f = zhFlat(j, ep); return zhAll(ep).filter((t, i) => t && !f[i]).length; };


  const meta = id => (LISTS[serOf(id)] || []).find(x => x.id === id) || {};

  // ---------- 🎯 逐句精听：每句单独播、重复、放慢、听写对答案 ----------
  // 每句的时间：后台 /api/sme?al=期号&part=N 用 Whisper 把原声分段转成「每个词在第几秒」（存 KV，只花一次），这里和文稿逐词对齐（最长公共子序列），
  // 每句从第一个对上的词开始、到下一句开头结束；对不上的句子按前后两句插值。听写对得少于 80% 的句子收进「❌ 错题本」
  const DK = {};
  const ntok = t => String(t || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}'\s-]+/gu, " ").split(/[\s-]+/).map(x => x.replace(/^'+|'+$/g, "")).filter(Boolean);
  function splitSents(lines) {
    const out = [];
    (lines || []).forEach((l, li) => U.sents(l.t).forEach(t => { /* ✂️ 全站共用的分句（util.js） */ t = t.trim(); if (/\p{L}/u.test(t)) { const p = out[out.length - 1]; if (p && p.li === li && ntok(t).length < 3) p.t += " " + t; else out.push({ who: l.who || "", t, li }); } }));
    return out;
  }
  function alignTimes(S, W) {
    const A = [], own = [], off = []; S.forEach((x, si) => { off.push(A.length); ntok(x.t).forEach(w => { A.push(w); own.push(si); }); }); off.push(A.length);
    const B = W.map(w => ntok(w[0])[0] || ""), n = A.length, m = B.length, M = m + 1, T = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i * M + j] = A[i] === B[j] ? T[(i + 1) * M + j + 1] + 1 : Math.max(T[(i + 1) * M + j], T[i * M + j + 1]);
    const st = S.map(() => null), en = S.map(() => null), tt = new Array(n).fill(null); let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { const si = own[i]; if (st[si] == null) st[si] = W[j][1]; en[si] = W[j][2]; tt[i] = Math.round(W[j][1] * 100) / 100; i++; j++; } else if (T[(i + 1) * M + j] >= T[i * M + j + 1]) i++; else j++; }
    for (let k = 0; k < S.length; k++) if (st[k] == null) { let a = k - 1; while (a >= 0 && st[a] == null) a--; let b = k + 1; while (b < S.length && st[b] == null) b++; const t0 = a >= 0 ? en[a] : 0, t1 = b < S.length ? st[b] : t0 + 4 * (k - a); st[k] = t0 + (t1 - t0) * (k - a) / (b - a); en[k] = st[k]; }
    return S.map((x, k) => Object.assign({}, x, { w: tt.slice(off[k], off[k + 1]), s: Math.max(0, st[k] - 0.15), e: k + 1 < S.length ? Math.max(st[k] + 0.6, st[k + 1] - 0.05) : (en[k] || st[k] + 4) + 0.6 }));
  }
  window.smeAlignTimes = alignTimes; window.smeSplitSents = splitSents; // 测试用
  function durOf(id, mp3) {
    return new Promise(res => {
      if (AU.dataset.id === id && isFinite(AU.duration) && AU.duration > 0) return res(AU.duration);
      const a = AU.dataset.id === id ? AU : new Audio(); if (a !== AU) { a.preload = "metadata"; if (window.NET) NET.audio(a); a.src = mp3; }
      let t = setTimeout(() => res(0), 15000); a.addEventListener("loadedmetadata", () => { clearTimeout(t); res(a.duration || 0); }, { once: true }); if (a !== AU) try { a.load(); } catch (e) {} // 别 load 正在用的播放器：会打断正在放的
    });
  }
  // 每句的时间（精听和「🎵 文稿跟着语音」共用）：同一期只对一次，两边同时要就等同一个
  const TIM = {}, TIMP = {};
  function timesOf(id, onProg) {
    if (TIM[id]) return Promise.resolve(TIM[id]);
    if (TIMP[id]) { if (onProg) TIMP[id].cbs.push(onProg); return TIMP[id].p; }
    const ep = EPS[id] || EP, cbs = onProg ? [onProg] : [];
    const p = (async () => {
      const oj = await offJson(id); if (oj && Array.isArray(oj.sents) && oj.sents.length) return (TIM[id] = oj.sents); // 下载过的：离线也有
      const dur = await durOf(id, srcOf(id, ep)); if (!dur) throw new Error("音频时长没取到");
      const W = []; let parts = 1, total = 0, id3 = 0;
      for (let p = 0; p < parts && p < 40; p++) {
        const j = await U.json("/api/sme?al=" + encodeURIComponent(id) + "&part=" + p);
        if (!j || !j.ok) throw new Error(j && j.error === "noai" ? AI.MSG.noai : "对时间失败（" + ((j && j.error) || "网络") + "）");
        parts = j.parts || 1; total = j.total || 1; if (p === 0) id3 = +j.id3 || 0;
        const off = Math.max(0, (p * 1e6 - (p ? id3 : 0)) / Math.max(1, total - id3) * dur);
        (j.words || []).forEach(w => W.push([w[0], w[1] + off, w[2] + off]));
        cbs.forEach(f => { try { f((p + 1) + " / " + parts); } catch (e) {} });
      }
      return (TIM[id] = alignTimes(splitSents(ep.lines), W));
    })();
    TIMP[id] = { p, cbs }; p.then(() => { delete TIMP[id]; }, () => { delete TIMP[id]; });
    return p;
  }
  // 现在放到第几句（还没到第一句 = -1）
  function idxAt(S, t) { let k = -1; for (let i = 0; i < S.length; i++) { if (S[i].s <= t + 0.05) k = i; else break; } return k; }
  window.smeIdxAt = idxAt; // 测试用
  async function dkLoad(id) {
    const d = DK[id] = { busy: true, prog: "", i: 0, show: false, typed: "", res: null }; draw();
    try {
      d.sents = await timesOf(id, pr => { d.prog = pr; if (DK[id] === d && EP && EP.id === id) { const el = root && root.querySelector(".dk-prog"); if (el) el.textContent = pr; } });
      if (AU.dataset.id === id && AU.currentTime > 1) d.i = Math.max(0, idxAt(d.sents, AU.currentTime)); // 从正在听的那句开始
    } catch (e) { d.err = e.message || String(e); }
    d.busy = false; if (EP && EP.id === id) draw();
  }
  // ---------- 📥 离线下载（Cache Storage「sme-off-v1」：/off/期号.mp3 + /off/期号.json {ep, sents, zh}） ----------
  // 📥 下载的节目 sme:off 两种语言共用一个键：只列这种语言有的栏目（以前学德语时列英语下载的期，找不到栏目 → 整页出错、一片空白）
  const OFFC = "sme-off-v1", OFF_ALL = () => LG("sme:off", {}) || {}, OFF = () => { const A = OFF_ALL(), o = {}; for (const id in A) if (SM[(A[id] && A[id].s) || serOf(id)] && ok(id)) o[id] = A[id]; return o; }, BLOB = {}, OFFB = {};
  const srcOf = (id, ep) => { const u = (ep || EPS[id] || EP || {}).mp3 || ""; return BLOB[id] || (window.NET && u ? NET.src(u) : u); }; // 已知连不上 BBC 就直接走中转
  async function offBlob(id) { // 下载过的这期 → 本机的 blob: 地址（Safari 也能拖进度条）
    if (id in BLOB) return BLOB[id];
    try { const r = await (await caches.open(OFFC)).match("/off/" + id + ".mp3"); BLOB[id] = r ? URL.createObjectURL(await r.blob()) : ""; } catch (e) { BLOB[id] = ""; }
    if (!BLOB[id]) { const O = OFF_ALL(); if (O[id]) { delete O[id]; LS("sme:off", O); } } // 缓存被系统清掉了
    return BLOB[id];
  }
  async function offJson(id) { if (!OFF()[id]) return null; try { const r = await (await caches.open(OFFC)).match("/off/" + id + ".json"); return r ? await r.json() : null; } catch (e) { return null; } }
  const mb = n => (n / 1048576).toFixed(1) + " MB";
  function offProg(id, t) { OFFB[id] = t; const el = root && root.querySelector(".off-prog"); if (el && EP && EP.id === id) el.textContent = t; }
  async function offSave(id) {
    const ep = EPS[id]; if (!ep || OFFB[id] != null) return; offProg(id, "准备中…"); draw();
    try {
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      const r = await fetch("/api/sme?mp3=" + encodeURIComponent(id)); if (!r.ok || !r.body) throw new Error("音频没取到（" + r.status + "）");
      const len = +r.headers.get("content-length") || 0, rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const x = await rd.read(); if (x.done) break; parts.push(x.value); got += x.value.length; offProg(id, len ? Math.round(got / len * 100) + "%" : mb(got)); }
      const blob = new Blob(parts, { type: "audio/mpeg" }); if (blob.size < 100000) throw new Error("音频不完整");
      let sents = null; if ((ep.lines || []).length && serOf(id) !== "news") { offProg(id, "给每句对时间…"); try { sents = await timesOf(id); } catch (e) {} } // 离线也能精听、文稿跟着亮
      const c = await caches.open(OFFC);
      await c.put("/off/" + id + ".mp3", new Response(blob, { headers: { "content-type": "audio/mpeg" } }));
      await c.put("/off/" + id + ".json", new Response(JSON.stringify({ ep, sents, zh: ZH[id] || null }), { headers: { "content-type": "application/json" } }));
      const m = meta(id), O = OFF_ALL(); O[id] = { t: ep.title, d: m.d || "", s: serOf(id), size: blob.size, at: Date.now() }; LS("sme:off", O);
      tip("📥 下好了（" + mb(blob.size) + "），没网也能听");
    } catch (e) { tip("下载失败：" + (e.message || e)); }
    delete OFFB[id]; draw();
  }
  async function offDel(id) {
    try { const c = await caches.open(OFFC); await c.delete("/off/" + id + ".mp3"); await c.delete("/off/" + id + ".json"); } catch (e) {}
    const O = OFF_ALL(); delete O[id]; LS("sme:off", O); if (BLOB[id] && AU.dataset.id !== id) { URL.revokeObjectURL(BLOB[id]); delete BLOB[id]; } draw();
  }

  // ---------- 📈 我的听力（每天几分钟、精听、听写、跟读） ----------
  const DEV = (() => { let d = LG("sme:dev", ""); if (!d) { d = Math.random().toString(36).slice(2, 8); LS("sme:dev", d); } return d; })();
  const dayOf = t => U.day(t); // 📅 全站共用的「今天」（util.js，吉隆坡 / 北京时间）
  const STAT = () => LG("sme:stat", {}) || {};
  let statAcc = 0, statT = 0, statSent = 0;
  function statAdd(f) {
    const A = STAT(), d = dayOf(Date.now()), D = A[d] = A[d] || {}, o = D[DEV] = D[DEV] || { s: 0, dk: 0, dks: 0, sh: 0 }; f(o); o.at = Date.now();
    const keys = Object.keys(A).sort(); keys.slice(0, Math.max(0, keys.length - 120)).forEach(k => delete A[k]); LS("sme:stat", A); // 只留最近 120 天
  }
  function statFlush(push) {
    if (statAcc >= 1) { const a = Math.round(statAcc); statAcc -= a; statAdd(o => { o.s += a; }); }
    if (push && Date.now() - statSent > 20000) { const d = dayOf(Date.now()), o = (STAT()[d] || {})[DEV]; if (o) { statSent = Date.now(); CL.put("st:" + d + ":" + DEV, o, o.at); CL.flush(); } }
  }
  AU.addEventListener("timeupdate", () => { const now = Date.now(); if (!AU.paused && statT && now - statT < 3000) statAcc += (now - statT) / 1000 * Math.min(1, AU.playbackRate || 1); statT = AU.paused ? 0 : now; if (statAcc >= 30) statFlush(false); });
  AU.addEventListener("pause", () => { statT = 0; statFlush(true); }); window.addEventListener("pagehide", () => statFlush(true));
  function statSum(day) { const D = STAT()[day] || {}, o = { s: 0, dk: 0, dks: 0, sh: 0 }; for (const k in D) ["s", "dk", "dks", "sh"].forEach(f => (o[f] += +D[k][f] || 0)); if (day === dayOf(Date.now())) o.s += statAcc; return o; }
  function statHtml() {
    const days = Array.from({ length: 14 }, (_, i) => dayOf(Date.now() - (13 - i) * 864e5)), S = days.map(statSum), wk = S.slice(7), mins = x => Math.round(x.s / 60);
    if (!S.some(x => x.s >= 30 || x.dk || x.sh)) return "";
    let streak = 0; for (let i = 13; i >= 0; i--) { if (S[i].s >= 60 || S[i].dk) streak++; else if (i < 13) break; }
    const dk = wk.reduce((n, x) => n + x.dk, 0), dks = wk.reduce((n, x) => n + x.dks, 0), sh = wk.reduce((n, x) => n + x.sh, 0), mx = Math.max(10, ...S.map(mins));
    return '<div class="sm-box"><h3>📈 我的听力</h3><div class="st-row"><span>今天 <b>' + mins(S[13]) + "</b> 分钟</span><span>近 7 天 <b>" + wk.reduce((n, x) => n + mins(x), 0) + "</b> 分钟</span><span>连续 <b>" + streak + "</b> 天</span>" +
      (dk ? "<span>精听 <b>" + dk + "</b> 句 · 听写平均 <b>" + Math.round(dks / dk) + "%</b></span>" : "") + (sh ? "<span>跟读 <b>" + sh + "</b> 句</span>" : "") + "</div>" +
      '<div class="st-bars">' + S.map((x, i) => '<i class="' + (mins(x) ? "" : "z") + '" style="height:' + Math.max(4, mins(x) / mx * 100) + '%" title="' + days[i].slice(5) + "：" + mins(x) + " 分钟" + (x.dk ? "，精听 " + x.dk + " 句" : "") + '"></i>').join("") + '</div><div class="st-ax"><span>' + days[0].slice(5) + "</span><span>最近 14 天（听力节目、精听）</span><span>今天</span></div></div>";
  }

  // ---------- 📊 每期难度：语速 + 生词率 ----------
  const DIFF = () => LG("sme:diff", {}) || {}, diffBusy = {};
  async function diffCalc(id) {
    if (diffBusy[id]) return; diffBusy[id] = true;
    try {
      const ep = EPS[id]; if (!ep || !(ep.lines || []).length || serOf(id) === "news") return;
      const text = ep.lines.map(l => l.t).join("\n"), n = ntok(text).length, dur = await durOf(id, srcOf(id, ep)); if (!dur) return;
      const d = window.readTextDiff && !DE ? await window.readTextDiff(text) : null; // 生词率按英语词频算：学德语时不算
      const D = DIFF(); D[id] = { wpm: Math.round(n / (dur / 60)), rate: d && d.ready ? Math.round(d.rate * 1000) / 10 : null, lv: d ? d.level : 0, at: Date.now() };
      const ks = Object.keys(D).sort((a, b) => D[b].at - D[a].at); ks.slice(200).forEach(k => delete D[k]); LS("sme:diff", D);
      const el = root && EP && EP.id === id && root.querySelector(".sm-diff"); if (el) el.outerHTML = diffHtml(id);
    } catch (e) {} finally { diffBusy[id] = false; }
  }
  const diffLv = x => { const a = x.wpm <= 125 ? 0 : x.wpm <= 160 ? 1 : 2, b = x.rate == null ? a : x.rate < 2 ? 0 : x.rate < 5 ? 1 : 2; return Math.round((a + b) / 2); };
  function diffHtml(id) {
    const x = DIFF()[id]; if (!x) return '<div class="sm-diff"></div>';
    const L = diffLv(x), C = ["e", "m", "h"][L];
    return '<div class="sm-diff"><span class="' + C + '">难度 ' + ["容易", "中等", "偏难"][L] + "</span><span>🏃 语速 " + x.wpm + " 词/分（" + (x.wpm <= 125 ? "慢" : x.wpm <= 160 ? "正常" : "快") + "）</span>" + (x.rate != null ? "<span>🔤 生词率 " + x.rate + "%（常用 " + x.lv + " 词以外、不在生词本里的）</span>" : "") + "</div>";
  }
  const diffShort = id => { const x = DIFF()[id]; return x ? " · " + ["🟢", "🟠", "🔴"][diffLv(x)] + " " + x.wpm + " 词/分" + (x.rate != null ? " · 生词 " + x.rate + "%" : "") : ""; };

  // ---------- 🧩 听后小测 ----------
  const LQ = {}, LQR = () => LG("sme:lq", {}) || {};
  async function lqLoad(id) {
    const ep = EPS[id]; if (!ep) return; LQ[id] = { busy: true, pick: {} }; draw();
    try {
      const j = await AI.ask("lquiz", { lang: RL(), title: ep.title, text: ep.lines.map(l => (l.who ? l.who + ": " : "") + l.t).join("\n") });
      if (!j.ok || !(j.quiz || []).length) throw new Error(AI.msg(j, "AI 没出好题，再点一次"));
      LQ[id] = { quiz: j.quiz, pick: {} };
    } catch (e) { LQ[id] = { err: e.message || String(e) }; }
    if (EP && EP.id === id) draw();
  }
  function lqPick(id, qi, oi) {
    const Q = LQ[id], q = Q && Q.quiz && Q.quiz[qi]; if (!q || Q.pick[qi] != null) return; Q.pick[qi] = oi;
    if (oi !== q.ans && window.ERR) window.ERR.add([{ src: "listen", kind: "mcq", q: q.q, ctx: "听后小测 · 出自：" + (EPS[id] || {}).title, opts: q.opts, ans: q.ans, wrong: q.opts[oi], why: q.why_zh || "" }]);
    if (Q.quiz.every((x, i) => Q.pick[i] != null)) { const R = LQR(); R[id] = { got: Q.quiz.filter((x, i) => Q.pick[i] === x.ans).length, n: Q.quiz.length, at: Date.now() }; LS("sme:lq", R); }
    const y = window.scrollY; draw(); window.scrollTo(0, y);
  }
  function lqHtml() {
    if (!EP || !(EP.lines || []).length || serOf(EP.id) === "news") return "";
    const Q = LQ[EP.id], R = LQR()[EP.id];
    let s = '<div class="sm-box sm-lq"><h3>🧩 听后小测' + (R ? ' <small style="font-weight:400;color:var(--ui-muted)">上次答对 ' + R.got + " / " + R.n + "</small>" : "") + "</h3>";
    if (!Q) return s + '<div class="sm-intro">听完一两遍、先别看文稿，做 5 道题看看到底听懂多少：大意、细节、推断、说话人的态度、词在这里的意思。做错的进「❌ 错题本」。</div><div class="dk-b"><button class="ui-btn pri" data-a="lq">' + (R ? "再做一次" : "开始做题") + "</button></div></div>";
    if (Q.busy) return s + '<div class="sm-intro">AI 在出题（半分钟左右，这期出过就是现成的）…</div></div>';
    if (Q.err) return s + '<div class="sm-intro">' + esc(Q.err) + '</div><div class="dk-b"><button class="ui-btn" data-a="lq">重试</button></div></div>';
    const all = Q.quiz.every((x, i) => Q.pick[i] != null), got = Q.quiz.filter((x, i) => Q.pick[i] === x.ans).length;
    s += Q.quiz.map((q, qi) => { const pk = Q.pick[qi]; return '<div class="lq-q"><b>' + (qi + 1) + ". " + esc(q.q) + "</b>" + q.opts.map((o, oi) => '<button data-lq="' + qi + '" data-o="' + oi + '" class="' + (pk == null ? "" : oi === q.ans ? "ok" : oi === pk ? "bad" : "") + '">' + "ABCD"[oi] + ". " + esc(o) + "</button>").join("") + (pk != null ? '<div class="why">' + (pk === q.ans ? "✅ 对了。" : "❌ 正确答案是 " + "ABCD"[q.ans] + "。") + esc(q.why_zh || "") + "</div>" : "") + "</div>"; }).join("");
    if (all) s += '<div class="dk-sc">答对 <b>' + got + " / " + Q.quiz.length + "</b>" + (got === Q.quiz.length ? " 🎉 全听懂了" : got >= Q.quiz.length - 1 ? " 不错" : " 错的题打开文稿对照着再听一遍") + "</div>";
    return s + "</div>";
  }

  // ---------- 🤔 为什么没听出来 ----------
  async function whyLoad() {
    const d = EP && DK[EP.id], x = d && d.sents && d.sents[d.i], R = d && d.res; if (!x || !R) return;
    const i = d.i, toks = String(x.t).split(/\s+/); let k = 0; const miss = [];
    toks.forEach(w => { const n = ntok(w).length; if (!n) return; if (!R.hit.slice(k, k + n).every(Boolean)) miss.push(w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")); k += n; });
    if (!miss.length) return; d.why = { i, busy: true }; draw();
    try {
      const j = await AI.ask("whymiss", { lang: RL(), sent: x.t, typed: d.typed, missed: [...new Set(miss)] });
      if (!j.ok || !(j.items || []).length) throw new Error(AI.msg(j, "这次没讲好，再点一次"));
      if (d.why && d.why.i === i) d.why = { i, items: j.items, tip: j.tip_zh || "" };
    } catch (e) { if (d.why && d.why.i === i) d.why = { i, err: e.message || String(e) }; }
    if (EP && DK[EP.id] === d) draw();
  }
  function whyHtml(d) {
    const W = d.why; if (!W || W.i !== d.i) return d.res && d.res.score < 1 ? '<div class="dk-b"><button class="ui-btn" data-a="dk-why">🤔 为什么没听出来</button></div>' : "";
    if (W.busy) return '<div class="dk-why">AI 在分析这句的发音（连读、弱读、吞音…）</div>';
    if (W.err) return '<div class="dk-why">' + esc(W.err) + ' <button class="ui-btn" data-a="dk-why">重试</button></div>';
    return W.items.map(x => '<div class="dk-why"><b>' + esc(x.chunk) + "</b>" + (x.sounds ? " 听起来像 <code>" + esc(x.sounds) + "</code>" : "") + (x.kind_zh ? '<span class="kd">' + esc(x.kind_zh) + "</span>" : "") + '<button class="ui-btn" data-say="' + esc(x.chunk) + '" title="一个词一个词清楚地读（对比原声）">🔊</button><div>' + esc(x.why_zh) + "</div></div>").join("") +
      (W.tip ? '<div class="dk-why">💡 ' + esc(W.tip) + "</div>" : "") + '<div class="dk-b" style="margin-top:8px"><button class="ui-btn" data-a="dk-slow">🐢 慢放原声再听</button><button class="ui-btn" data-a="dk-play">▶ 正常速度</button></div>';
  }

  // ---------- 文稿：每个词能点（查词）、按词汇水平上色，句首 ▸ 从这句播 ----------
  // 上色是全站共用的 word.js（WORD.html，和阅读、视频字幕同一套颜色；生词本里在学的淡紫底）；逐词时间写进 data-t（播放时跟着高亮）
  function wordsHtml(t, wt) {
    const h = WORD.html(t); if (!wt) return h;
    const tk = ntok(t); let p = 0;
    return h.replace(/<span class="([^"]*\bvs-w\b[^"]*)" data-w="([^"]*)">/g, (a, cl, w) => {
      const ks = ntok(w); if (!ks.length) return a;
      let j = p; while (j < tk.length && tk[j] !== ks[0]) j++;
      if (j >= tk.length || j - p > 8) return a; // 对不上（数字、符号）：这个词不写时间
      const tm = wt.slice(j, j + ks.length).find(v => v != null); p = j + ks.length;
      return tm != null ? '<span class="' + cl + '" data-w="' + w + '" data-t="' + tm + '">' : a;
    });
  }

  window.smeWordsHtml = wordsHtml; // 测试用
  let curW = null;
  function hlWord() { // 逐词：当前这句里，最后一个已经开口的词
    const box = root && fword && curK >= 0 && wantFollow() ? root.querySelector('.sm-tr [data-si="' + curK + '"]') : null; let on = null;
    if (box) { const t = AU.currentTime + 0.08; for (const el of box.querySelectorAll("[data-t]")) { if (+el.dataset.t <= t) on = el; else break; } }
    if (on === curW) return; if (curW) curW.classList.remove("on"); curW = on; if (on) on.classList.add("on");
  }
  let raf = 0;
  function tick() { raf = 0; if (AU.paused) return; hl(); hlWord(); raf = requestAnimationFrame(tick); }
  AU.addEventListener("play", () => { if (!raf) raf = requestAnimationFrame(tick); });

  // ---------- ⏭ 播完接下一期 ----------
  let autoNext = null;
  function nextEp(id) {
    const L = (ser === "new" ? weekItems().map(x => x.lv ? { id: x.lv.find(v => v[0] === serOf(id)) ? x.lv.find(v => v[0] === serOf(id))[1] : x.id, t: x.t } : x) : LISTS[serOf(id)]) || [], D = done(), i = L.findIndex(x => x.id === id); // 从「本周更新」点开的：接着放本周没听的
    return L.slice(i + 1).concat(L.slice(0, Math.max(0, i))).find(x => !D[x.id] && x.id !== id) || null; // 往旧的找没听过的，再从最新的找
  }
  AU.addEventListener("ended", () => {
    const id = AU.dataset.id; if (!cont || !id || (DK[id] && DK[id].auto)) return;
    const n = nextEp(id); if (!n) { tip(ser === "new" ? "本周更新的都听过了" : "这个栏目的都听过了"); return; }
    tip("⏭ 接着放：" + n.t); autoNext = n.id; if (ser !== "new") ser = serOf(n.id); openEp(n.id);
  });

  // ---------- 🎵 文稿跟着语音 ----------
  const FL = {}; let curK = -1, userScrollT = 0;
  const wantFollow = () => follow && trShow && view === "ep" && EP && !EP.err && (EP.lines || []).length && serOf(EP.id) !== "news";
  function followLoad(id) { // 不在这里 draw：draw 自己会调
    if (TIM[id] || (FL[id] && (FL[id].busy || FL[id].err))) return; FL[id] = { busy: true, prog: "" };
    timesOf(id, pr => { FL[id].prog = pr; const el = root && root.querySelector(".fl-prog"); if (el) el.textContent = pr; })
      .then(() => { FL[id] = {}; }, e => { FL[id] = { err: e.message || String(e) }; }).then(() => { if (EP && EP.id === id && view === "ep") draw(); });
  }
  ["wheel", "touchmove"].forEach(ev => window.addEventListener(ev, () => { userScrollT = Date.now(); }, { passive: true }));
  function hl(noScroll) {
    if (!root || !wantFollow() || AU.dataset.id !== EP.id) return; const S = TIM[EP.id]; if (!S) return;
    const k = AU.currentTime > 0 || !AU.paused ? idxAt(S, AU.currentTime) : -1; if (k === curK && !noScroll) return;
    const box = root.querySelector(".sm-tr"); if (!box) return;
    const old = box.querySelector(".sn.cur"); if (old) old.classList.remove("cur");
    if (curW) { curW.classList.remove("on"); curW = null; }
    curK = k; const el = k >= 0 ? box.querySelector('[data-si="' + k + '"]') : null; if (!el) return; el.classList.add("cur");
    // 自动滚：在播、文稿在屏幕上、这句跑出屏幕了、最近 4 秒没自己滑动页面
    if (noScroll || AU.paused || Date.now() - userScrollT < 4000 || !root.getClientRects().length || document.querySelector("#wd-pop.on")) return; // 查词框开着不滚（一滚它就关了）
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(), H = window.innerHeight;
    if (b.bottom < 0 || b.top > H) return;
    const pl = root.querySelector(".sm-pl.stick"), lim = pl ? pl.getBoundingClientRect().bottom + 8 : 70; // 吸顶的播放器下面才算看得见
    if (r.top < lim || r.bottom > H - 90) window.scrollBy({ top: r.top - Math.max(H * 0.35, lim + 24), behavior: "smooth" });
  }
  AU.addEventListener("timeupdate", () => { hl(); hlWord(); }); AU.addEventListener("seeked", () => { hl(); hlWord(); }); // 逐词主要靠 tick（每帧），后台标签页里帧停了就靠这个
  function seekSent(k) { // 点文稿里的一句 → 从那句开始播
    const S = TIM[EP.id], x = S && S[k]; if (!x) return;
    autoStop(); recStop(true); MEDIA.stop(AU); AU.playbackRate = rate;
    if (AU.dataset.id !== EP.id) { AU.src = srcOf(EP.id); AU.dataset.id = EP.id; auTitle = SM[serOf(EP.id)][1] + " · " + EP.title; }
    AU.currentTime = x.s; AU.play().catch(() => {});
    const d = DK[EP.id]; if (d && d.sents) { d.i = k; d.typed = ""; d.res = null; d.why = null; d.rec = null; d.show = false; draw(); } else hl(true);
  }
  // 播这一句；放完调 done(true)，被手动暂停 / 换句调 done(false)
  function dkPlay(slow, done) {
    const d = EP && DK[EP.id], x = d && d.sents && d.sents[d.i]; if (!x) return;
    if (AU.dataset.id !== EP.id) { AU.src = srcOf(EP.id); AU.dataset.id = EP.id; auTitle = SM[serOf(EP.id)][1] + " · " + EP.title; }
    recStop(true); AU.playbackRate = rate; // 放完 / 被打断后回到这个速度
    MEDIA.seg(AU, x.s, x.e, { rate: slow ? 0.75 : rate, end: () => { if (done) done(true); }, cut: () => { if (done) done(false); }, fail: () => { if (done) done(false); } }); // 全站共用的放一段原声（media.js）
  }

  // 🔁 自动连播：每句放 reps 遍，每遍之间停 gap 秒，放完自动下一句；手动点任何精听按钮或暂停就停
  let autoTok = 0;
  function autoStop() { autoTok++; const d = EP && DK[EP.id]; if (d && d.auto) { d.auto = false; draw(); } }
  function autoRun() {
    const d = EP && DK[EP.id]; if (!d || !d.sents) return; const my = ++autoTok, reps = +LG("sme:dkreps", 2) || 2, gap = +LG("sme:dkgap", 2) || 2;
    d.auto = true; let k = 0;
    const step = () => {
      if (my !== autoTok) return;
      dkPlay(false, ok => {
        if (my !== autoTok) return; if (!ok) { d.auto = false; autoTok++; draw(); return; }
        setTimeout(() => {
          if (my !== autoTok) return;
          if (++k < reps) return step();
          if (d.i >= d.sents.length - 1) { d.auto = false; draw(); tip("🎉 这期全部句子放完了"); return; }
          k = 0; d.i++; d.typed = ""; d.res = null; d.why = null; d.rec = null; draw(); step();
        }, gap * 1000);
      });
    };
    draw(); step();
  }
  // 🎙 跟读：录这一句（最长 = 句子时长 × 2 + 3 秒），转文字（/api/stt，不行用浏览器语音识别）后逐词打分
  const RK = "listen";
  function recStop(cancel) { if (REC.cur() === RK) REC.stop(cancel); } // 全站共用的 rec.js（REC）
  function recStart() {
    const d = EP && DK[EP.id], x = d && d.sents && d.sents[d.i]; if (!x) return;
    if (REC.cur() === RK) { recStop(false); return; }
    const id = EP.id, i = d.i;
    REC.toggle(RK, { lang: RL(), max: Math.min(30, (x.e - x.s) * 2 + 3), before: () => { autoTok++; d.auto = false; AU.pause(); },
      start: () => { d.rec = { on: true }; draw(); },
      cancel: () => { if (d.rec && d.rec.on) d.rec = null; },
      busy: () => { d.rec = { busy: true }; if (EP && EP.id === id) draw(); },
      done: y => {
        const dd = DK[id]; if (!dd) return; const R = REC.score(dd.sents[i].t, y.text, { lang: RL() });
        dd.rec = { said: y.text, hit: R.hit, score: R.score, url: y.url, i }; statAdd(o => { o.sh++; });
        if (EP && EP.id === id) draw();
      } });
  }
  function dkCheck() {
    const d = EP && DK[EP.id], x = d && d.sents && d.sents[d.i]; if (!x) return;
    const SC = REC.score(x.t, d.typed, { lang: RL(), near: false }), a = SC.a, hit = SC.hit, n = a.length; // 听写是打字：不放宽
    d.res = { hit, score: n ? hit.filter(Boolean).length / n : 0 }; d.show = true; d.why = null;
    statAdd(o => { o.dk++; o.dks += Math.round(d.res.score * 100); });
    if (d.res.score < 0.8 && window.ERR) { const miss = a.filter((w, k) => !hit[k]); window.ERR.add([{ src: "listen", kind: "say", q: "精听时没听出来：听一遍，再跟着读", ctx: x.t, right: x.t, why: "没听出来的词：" + miss.slice(0, 12).join(", ") + "（出自 " + EP.title + "）" }], true); }
  }
  function dkHtml() {
    if (!EP || !(EP.lines || []).length || serOf(EP.id) === "news") return "";
    const d = DK[EP.id], Z = zhOn ? ZH[EP.id] : null;
    let s = '<div class="sm-box sm-dk"><h3>🎯 逐句精听<small>一句一句听：重复、放慢、听写对答案</small></h3>';
    if (!d) return s + '<div class="sm-intro">整期听完一两遍以后，用这个一句一句抠：每句能单独重复、放慢，也可以先听写再对答案（没听出来的句子会进「❌ 错题本」）。</div><div class="dk-b"><button class="ui-btn pri" data-a="dk">开始逐句精听</button></div></div>';
    if (d.busy) return s + '<div class="sm-intro">正在给每一句对时间（这期第一次用要一两分钟，以后打开就不用等）… <span class="dk-prog">' + esc(d.prog) + "</span></div></div>";
    if (d.err) return s + '<div class="sm-intro">' + esc(d.err) + '</div><div class="dk-b"><button class="ui-btn" data-a="dk">重试</button></div></div>';
    const x = d.sents[d.i], R = d.res;
    let shown = esc(x.t);
    if (R) shown = REC.mark(x.t, R.hit, { lang: RL(), ok: "h", no: "m" });
    s += '<div class="dk-n">第 ' + (d.i + 1) + " / " + d.sents.length + " 句" + (x.who ? " · " + esc(x.who) : "") + "</div>";
    s += '<div class="dk-t' + (d.show ? "" : " hid") + '">' + (d.show ? shown + (Z && (Z.lines || [])[x.li] ? '<span class="zh">' + esc(Z.lines[x.li]) + "</span>" : "") : "（先别看原文：听几遍，把听到的写下来）") + "</div>";
    const RC = d.rec && (d.rec.i == null || d.rec.i === d.i) ? d.rec : null, reps = +LG("sme:dkreps", 2) || 2, gap = +LG("sme:dkgap", 2) || 2;
    s += '<div class="dk-b"><button class="ui-btn" data-a="dk-prev" title="上一句（←）">⏮</button><button class="ui-btn pri" data-a="dk-play" title="播放这句（空格；R 重放）">▶ 这句</button><button class="ui-btn" data-a="dk-slow" title="慢放（S）">🐢 慢放</button><button class="ui-btn" data-a="dk-next" title="下一句（→）">⏭</button><button class="ui-btn" data-a="dk-show">' + (d.show ? "🙈 藏起原文" : "👀 看原文") + '</button><button class="ui-btn' + (RC && RC.on ? " on" : "") + '" data-a="dk-rec" title="跟着读这一句，逐词打分">' + (RC && RC.on ? "⏹ 读完了" : RC && RC.busy ? "打分中…" : "🎙 跟读") + "</button></div>";
    s += '<div class="dk-b" style="font-size:13px;color:var(--ui-muted);align-items:center"><button class="ui-btn' + (d.auto ? " on" : "") + '" data-a="dk-auto">' + (d.auto ? "⏸ 停止连播" : "🔁 自动连播") + "</button>每句 " + [1, 2, 3].map(n => '<button class="ui-btn' + (reps === n ? " on" : "") + '" data-reps="' + n + '">' + n + " 遍</button>").join("") + " 停 " + [1, 2, 4].map(n => '<button class="ui-btn' + (gap === n ? " on" : "") + '" data-gap="' + n + '">' + n + " 秒</button>").join("") + "</div>";
    if (RC && RC.hit) { const sh = REC.mark(x.t, RC.hit, { lang: RL(), ok: "h", no: "m" }); s += '<div class="dk-sc" style="margin:0 0 10px">🎙 跟读 <b>' + Math.round(RC.score * 100) + "%</b>" + (RC.score >= 0.9 ? " 👍" : " 红色的没读出来") + (RC.url ? ' <button class="ui-btn" data-a="dk-me">▶ 听我读的</button>' : "") + '<div class="dk-t" style="font-size:15.5px;margin:6px 0 0">' + sh + "</div>" + (RC.said ? '<div style="color:var(--ui-muted);font-size:13px">识别到：' + esc(RC.said) + "</div>" : "") + "</div>"; }
    s += '<div style="color:var(--ui-muted);font-size:12px;margin:-4px 0 8px">快捷键：空格 播放这句 · ← → 上一句 / 下一句 · R 重放 · S 慢放；手机锁屏、耳机的「上一首 / 下一首」也能换句</div>';
    s += '<div class="dk-in"><input id="dk-in" placeholder="听写：把这句写下来，回车对答案" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(d.typed) + '"><button class="ui-btn" data-a="dk-check">对答案</button></div>';
    if (R) s += '<div class="dk-sc">听对 <b>' + Math.round(R.score * 100) + "%</b>" + (R.score >= 0.95 ? " 🎉 全对" : R.score >= 0.8 ? " 不错，红色的再听一遍" : " 红色的词没听出来，点 🐢 慢放多听几遍（已收进错题本）") + "</div>" + whyHtml(d);
    return s + "</div>";
  }
  function dkGo(di) { const d = EP && DK[EP.id]; if (!d || !d.sents) return; if (d.auto) { autoTok++; d.auto = false; } d.i = Math.max(0, Math.min(d.sents.length - 1, d.i + di)); d.typed = ""; d.res = null; d.why = null; d.rec = null; d.show = false; draw(); dkPlay(false); const el = root.querySelector(".sm-dk"); if (el && el.getBoundingClientRect().top < 60) el.scrollIntoView({ block: "start" }); }

  function offHtml() {
    const O = OFF(), ids = Object.keys(O).sort((a, b) => O[b].at - O[a].at); if (!ids.length) return "";
    const tot = ids.reduce((n, id) => n + (+O[id].size || 0), 0), D = done();
    return '<div class="sm-box"><h3>📥 已下载 ' + ids.length + ' 期 <small style="font-weight:400;color:var(--ui-muted)">共 ' + mb(tot) + "，没网也能听</small></h3>" + ids.map(id => '<div class="sm-off"><div class="t" data-ep="' + esc(id) + '"><b>' + esc(O[id].t) + "</b><small>" + esc(SM[O[id].s || serOf(id)][1]) + (O[id].d ? " · " + esc(O[id].d) : "") + " · " + mb(+O[id].size || 0) + (D[id] ? " · ✓ 听过" : "") + '</small></div><button class="ui-btn" data-offdel="' + esc(id) + '" title="删掉下载的文件">🗑</button></div>').join("") + "</div>";
  }
  const pic = (src, s) => src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<i class="ph">' + esc(SM[s][1].split(" ")[0]) + "</i>"; // 没配图的（NPR Up First）放栏目图标
  function weekHtml(top) {
    const ks = WKS(), wait = ks.filter(k => !LISTS[k]).length, W = weekItems(), D = done(), PP = POS(), OF = OFF();
    if (!W.length) return top + '<div class="sm-empty">' + (wait ? "正在取各栏目的节目列表…" : "最近 7 天没取到新节目" + (navigator.onLine === false ? "（现在没网）" : "，过一会儿再试")) + "</div>";
    const heard = x => (x.lv || [[x.s, x.id]]).some(v => D[v[1]]), left = W.filter(x => !heard(x)).length, today = WKDAY(Date.now());
    const dayName = t => (t === today ? "今天" : t === today - 864e5 ? "昨天" : t === today - 1728e5 ? "前天" : "") + " " + (new Date(t).getMonth() + 1) + " 月 " + new Date(t).getDate() + " 日 周" + "日一二三四五六"[new Date(t).getDay()];
    const it = x => '<div class="sm-it" data-ep="' + esc(x.id) + '">' + pic(x.img, x.s || ser) + '<div class="t"><b>' + esc(x.t) + "</b><span>" + (x.lv ? '分级新闻 <i class="lv">' + x.lv.map(v => '<button data-ep="' + esc(v[1]) + '" class="' + (D[v[1]] ? "ok" : "") + '" title="' + esc(SM[v[0]][1]) + '">' + esc(SM[v[0]][2].replace("Level ", "L")) + (D[v[1]] ? " ✓" : "") + "</button>").join("") + "</i>" : esc(SM[x.s][1]) + " · " + SRC[SM[x.s][4]][0] + (D[x.id] ? ' · <em class="ok">✓ 听过</em>' : PP[x.id] ? " · ⏯ 听到 " + fmt(PP[x.id].t) : "") + (OF[x.id] ? " · 📥" : "") + diffShort(x.id)) + "</span></div></div>";
    const days = [...new Set(W.map(x => x.day))];
    return top + '<div class="sm-wk-n">最近 7 天共 <b>' + W.length + "</b> 期新节目" + (left < W.length ? "，还没听 <b>" + left + "</b> 期" : "") + (wait ? " · 还在取 " + wait + " 个栏目…" : "") + "</div>" +
      days.map(d => '<h3 class="sm-day">' + dayName(d) + '</h3><div class="sm-grid">' + W.filter(x => x.day === d).map(it).join("") + "</div>").join("");
  }
  function homeHtml() {
    const D = done(), L = LISTS[ser], top = offHtml() + statHtml();
    if (ser === "new") return weekHtml(top);
    if (!L) return top + '<div class="sm-empty">正在取节目列表…</div>';
    if (!L.length) return top + '<div class="sm-empty">节目列表没取到' + (navigator.onLine === false ? "（现在没网：上面「📥 已下载」的能听）" : "，过一会儿再试") + "</div>";
    const story = !!SM[ser][5], n0 = L[0], fresh = L.find(x => !D[x.id]) || n0; // 故事类：列表就是从第 1 集起的顺序，「没听的第一个」= 该听的下一集
    const PP = POS();
    const OF = OFF(), QR = LQR();
    const it = x => '<div class="sm-it" data-ep="' + esc(x.id) + '">' + pic(x.img, x.s || ser) + '<div class="t"><b>' + esc(x.t) + "</b><span>" + esc(x.d) + (D[x.id] ? ' · <em class="ok">✓ 听过</em>' : PP[x.id] ? " · ⏯ 听到 " + fmt(PP[x.id].t) : "") + (OF[x.id] ? " · 📥" : "") + (QR[x.id] ? " · 🧩 " + QR[x.id].got + "/" + QR[x.id].n : "") + diffShort(x.id) + "</span></div></div>";
    return top + '<div class="sm-new" data-ep="' + esc(fresh.id) + '">' + (fresh.img ? '<img src="' + esc(fresh.img) + '" alt="">' : pic("", ser)) + '<div><small>' + (story ? (fresh === n0 ? "👉 从这一集开始" : "👉 接着听下一集") : SM[ser][4] === "VOA" ? (fresh === n0 ? "🆕 最近一期" : "👉 还没听的最近一期") : SM[ser][4] === "BNE" ? (fresh === n0 ? "🆕 最新一篇" : "👉 还没听的最新一篇") : fresh === n0 ? "🆕 最新一期" : "👉 还没听的最新一期") + " · " + esc(fresh.d) + "</small><b>" + esc(fresh.t) + "</b><p>" + esc(fresh.p || "") + "</p></div></div>" +
      '<div class="sm-grid">' + L.slice(0, MORE[ser] || (story || SM[ser][4] === "VOA" ? 120 : 40)).map(it).join("") + "</div>" + // 故事类、VOA 是固定的旧节目（50–60 期），全列出来
      (L.length > (MORE[ser] || (story || SM[ser][4] === "VOA" ? 120 : 40)) ? '<div style="text-align:center;margin:14px 0"><button class="ui-btn" data-a="more">显示更多（还有 ' + (L.length - (MORE[ser] || 40)) + " 期，往前到 " + esc((L[L.length - 1].d || "").slice(-4)) + " 年）</button></div>" : "");
  }
  function epHtml() {
    if (!EP) return '<div class="sm-empty">' + (epBusy ? "正在取这一期的音频和文稿…" : "") + "</div>";
    if (EP.err) return '<div class="sm-empty">' + (EP.msg === "no transcript yet" ? "这一期 NPR 还没放文稿（一般播出后一两天才有），过两天再来；或者先" : EP.msg === "no such level" ? "这篇新闻没有这一级（简单篇只有 L0–L3，进阶篇只有 L4–L6），换个级别看看；或者" : "这一期没取到，") + '<a href="' + esc(srcUrl(EP.id)) + '" target="_blank" rel="noopener">去 ' + SRC[SM[serOf(EP.id)][4]][1] + ' 网站看</a></div>';
    const m = meta(EP.id), D = done(), heard = !!D[EP.id], S = SM[serOf(EP.id)], Z = zhOn ? ZH[EP.id] : null, zl = zhOn && !Z && zhBusy[EP.id];
    // 中文：开着才有；还在翻就先在前面几处显示「翻译中…」
    const zh = (arr, i) => zhOn ? '<span class="zh' + (zl ? " ld" : "") + '">' + (Z ? esc((arr ? (Z[arr] || [])[i] : Z.intro) || "") : zl && (arr !== "lines" || i < 2) ? "翻译中…" : "") + "</span>" : "";
    const TS = follow && TIM[EP.id], byLi = {}; if (TS) TS.forEach((x, k) => (byLi[x.li] = byLi[x.li] || []).push(k));
    const tr = (EP.lines || []).map((l, i) => '<p data-li="' + i + '">' + (l.who ? '<span class="w">' + esc(l.who === "Examples" ? "例句 Examples" : l.who) + "</span>" : "") + (byLi[i] ? byLi[i].map(k => '<span class="sn" data-si="' + k + '"><b class="sp" data-sp="' + k + '" title="从这句开始播">▸</b>' + wordsHtml(TS[k].t, fword ? TS[k].w : null) + "</span>").join(" ") : wordsHtml(l.t, null)) + zh("lines", i) + "</p>").join("");
    const news = serOf(EP.id) === "news";
    const F = FL[EP.id] || {}, fst = !trShow || news || !follow ? "" : TS ? '<div class="sm-trst">🎵 放到哪句亮哪句' + (fword ? "、逐词跟着亮" : "") + "；点句首 ▸ 从那句播，点词查意思（颜色和插件、视频字幕一样按词汇水平；淡紫底 = 生词本里在学的词）</div>" : F.busy ? '<div class="sm-trst">🎵 正在给每一句对时间（这期第一次要一两分钟，以后打开就不用等）… <span class="fl-prog">' + esc(F.prog || "") + "</span></div>" : F.err ? '<div class="sm-trst">🎵 ' + esc(F.err) + ' <button class="ui-btn" data-a="follow-retry">重试</button></div>' : "";
    const off = OFF()[EP.id], ob = OFFB[EP.id];
    return '<h1>' + esc(EP.title) + '</h1><div class="sm-date">' + esc(m.d || "") + " · " + srcName(EP.id) + " · " + esc(S[2]) + (heard ? ' · <span class="ok">✓ 听过</span>' : "") + "</div>" + (news ? "" : diffHtml(EP.id)) +
      '<div class="sm-box sm-pl' + (trShow && tr ? " stick" : "") + '"><div id="sm-slot"></div><div class="sm-rate">速度 ' + [0.75, 0.9, 1, 1.15].map(v => '<button data-rate="' + v + '" class="' + (Math.abs(rate - v) < .01 ? "on" : "") + '">' + v + "×</button>").join("") +
      '<span class="sm-kbd" title="不在输入框里时按空格">空格 ⏯</span><span style="flex:1"></span><button data-a="done">' + (heard ? "✓ 已听完" : "✓ 听完了") + "</button></div></div>" +
      '<div class="sm-rate sm-opts"><button data-a="cont" class="' + (cont ? "on" : "") + '" title="播完自动放这个栏目里下一期没听过的">⏭ 播完接下一期：' + (cont ? "开" : "关") + "</button>" + (ob != null ? '<button disabled>📥 下载中 <span class="off-prog">' + esc(ob) + "</span></button>" : off ? '<button data-a="offdel" title="删掉下载的文件">📥 已下载 ' + mb(off.size || 0) + " · 删除</button>" : '<button data-a="off" title="存到这台设备上，没网也能听（连同文稿、每句时间）">📥 下载离线听</button>') + "</div>" + dkHtml() +
      (EP.intro ? '<div class="sm-box"><h3>' + (news ? "📰 新闻背景" : "📝 简介") + '</h3><div class="sm-intro">' + esc(EP.intro) + zh("", 0) + "</div></div>" : "") +
      ((EP.q || []).length ? '<div class="sm-box sm-q"><h3>❓ 本期问题（答案在节目最后）</h3>' + EP.q.map((x, i) => "<div>" + esc(x) + zh("q", i) + "</div>").join("") + "</div>" : "") +
      ((EP.heads || []).length ? '<div class="sm-box sm-hd"><h3>🗞️ 各家新闻标题</h3>' + EP.heads.map((h, i) => "<div>" + esc(h[0]) + (h[1] ? "<small>— " + esc(h[1]) + "</small>" : "") + zh("heads", i) + "</div>").join("") + "</div>" : "") +
      ((EP.vocab || []).length ? '<div class="sm-box"><h3>🔤 ' + (news ? "关键词" : "本期生词") + '</h3><div class="sm-voc">' + EP.vocab.map((v, i) => '<b data-w="' + esc(String(v[0]).replace(/\s*\(.*?\)\s*/g, " ").trim()) + '">' + esc(v[0]) + '</b><span class="d">'  + esc(v[1]) + zh("vocab", i) + (v[2] ? "<i>例：" + esc(v[2]) + (Z ? '<span class="zh">' + esc((Z.vex || [])[i] || "") + "</span>" : "") + "</i>" : "") + '</span><button data-add="' + i + '">＋ 生词本</button>').join("") + "</div></div>" : "") +
      (tr ? '<div class="sm-box"><h3 style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">📄 文稿 <span style="flex:1"></span><button class="ui-btn" data-a="tr">' + (trShow ? "折起来" : "显示文稿") + '</button>' + (trShow ? '<button class="ui-btn' + (follow ? " on" : "") + '" data-a="follow" title="放到哪句就高亮哪句、自动滚过去">🎵 跟着语音：' + (follow ? "开" : "关") + "</button>" + (follow ? '<button class="ui-btn' + (fword ? " on" : "") + '" data-a="fword" title="正在说的那个词也亮">逐词：' + (fword ? "开" : "关") + "</button>" : "") : "") + '<button class="ui-btn" data-a="read">📰 在阅读里打开（查词、上色）</button></h3>' + fst +
        '<div class="sm-tr' + (trShow ? "" : " hide") + '" data-a="tr-peek" title="' + (trShow ? "" : "建议先不看文稿听一两遍，再点开对照") + '">' + tr + "</div></div>" + lqHtml() : (news ? '<div class="sm-empty">这个栏目 BBC 没有放全文文稿：先听一遍，再看上面的新闻背景和关键词。</div>' : ""));
  }
  function zhBar() {
    if (!zhOn || view !== "ep" || !EP || EP.err) return "";
    if (zhBusy[EP.id]) return '<div class="sm-trst">🀄 正在翻译…（第一次打开这期要几秒）</div>';
    return zhSt[EP.id] ? '<div class="sm-trst">🀄 ' + esc(zhSt[EP.id]) + ' <button class="ui-btn" data-a="zh-retry">重试</button></div>' : "";
  }
  function draw() {
    if (!root) return;
    const f = flEl(); if (root.contains(AU)) f.querySelector(".au").append(AU); // 先把播放器挪出去，重画页面时不会被删掉（删掉会停）
    const S = SM[ser]; if (wantFollow()) followLoad(EP.id);
    root.innerHTML = '<div class="sm-ser">' + [...new Set(SER.map(x => x[4]))].map(src => '<div class="sm-row"><span class="src">' + SRC[src][0] + "</span>" + SER.filter(x => x[4] === src).map(x => '<button data-ser="' + x[0] + '" class="' + (x[0] === ser ? "on" : "") + '">' + x[1] + "</button>").join("") + "</div>").join("") + "</div>" +
      (view === "ep" ? '<div class="sm-bar"><button class="ui-btn" data-a="home">← 节目列表</button><span class="sp"></span><button class="ui-btn' + (zhOn ? " on" : "") + '" data-a="zh" title="英文下面显示中文翻译">🀄 中文：' + (zhOn ? "开" : "关") + "</button></div>" + zhBar() + epHtml()
        : '<div class="sm-head"><b>' + esc(S[2]) + "</b> · " + SRC[S[4]][1] + (SRC[S[4]][2] ? "（" + SRC[S[4]][2] + "）" : "") + " · " + esc(S[3]) + "</div>" + homeHtml());
    if (view === "ep" && EP && !EP.err && AU.dataset.id !== EP.id) { AU.pause(); AU.src = srcOf(EP.id); AU.dataset.id = EP.id; auTitle = SM[serOf(EP.id)][1] + " · " + EP.title; AU.playbackRate = rate; flClosed = false; }
    sync(); stickTop(); curK = -1; curW = null; hl(true); hlWord();
    if (view === "ep" && EP && !EP.err && autoNext === EP.id && AU.dataset.id === EP.id) { autoNext = null; AU.play().catch(() => {}); }
    if (view === "ep" && EP && !EP.err && !DIFF()[EP.id] && navigator.onLine !== false) diffCalc(EP.id);
    if (window.NAV) NAV.mark(); // 🔙 换栏目 / 打开一期：记一条页面历史（nav.js）
  }
  function stickTop() { // 顶上固定的几条（标签栏、子标签、栏目条）下面
    if (!root) return; let b = 0;
    document.querySelectorAll("#apptabs,#subtabs,#en-secbar").forEach(e => { if (e.getClientRects().length && getComputedStyle(e).position === "fixed") b = Math.max(b, e.getBoundingClientRect().bottom); });
    root.style.setProperty("--sm-top", Math.round(b + 6) + "px"); stuckChk();
  }
  function stuckChk() { const pl = root && root.querySelector(".sm-pl.stick"); if (pl) pl.classList.toggle("stuck", pl.getBoundingClientRect().top <= parseFloat(root.style.getPropertyValue("--sm-top") || "104") + 1 && window.scrollY > 0); }
  function playPause() { if (!EP || EP.err || AU.dataset.id !== EP.id) return; if (AU.paused) AU.play().catch(() => {}); else AU.pause(); }
  function init() {
    if (root) return; root = document.getElementById("sme"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    flEl();
    // 文稿里的词：全站共用的 word.js（点词查词卡片、右键循环标记，同看视频 / 插件）；标记 / 加词以后重新上色
    if (window.WORD) WORD.bind(root, {
      skip: el => !(EP && ((trShow && el.closest(".sm-tr")) || el.closest(".sm-voc"))), // 文稿（显示时）和本期生词
      sent: el => { const sn = el.closest("[data-si]"), p = el.closest("[data-li]"); return (sn && TIM[EP.id] ? (TIM[EP.id][+sn.dataset.si] || {}).t : p ? (EP.lines[+p.dataset.li] || {}).t : "") || ""; },
      quiet: () => !AU.paused,
      showCtx: true, // 卡片里显示这个词所在的句子（同看视频）
    });
    document.addEventListener("word-change", () => { if (trShow && view === "ep" && root.getClientRects().length) { const y = window.scrollY; draw(); window.scrollTo(0, y); } });
    // 切标签（#sme 或外面的页面被藏起来）时把播放器挪进悬浮条
    const mo = new MutationObserver(() => sync());
    mo.observe(root, { attributes: true, attributeFilter: ["class"] }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-en", "data-mode"] });
    const ven = document.getElementById("view-en"); if (ven) mo.observe(ven, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("scroll", stuckChk, { passive: true }); window.addEventListener("resize", stickTop);
    // ⌨️ 快捷键：全站共用的 keys.js（节目页看得见时）。空格 = 播放 / 暂停；开了精听就是精听的键
    KEYS.on("listen", { when: () => view === "ep" && !!EP && !EP.err && root.classList.contains("on") && KEYS.visible(root) }, (k, e) => {
      const d = DK[EP.id];
      if (!d || !d.sents) { if (k === "space" && e.target !== AU) { if (!e.repeat) playPause(); return true; } return false; }
      if (k === "space" || k === "r") { if (d.auto) autoStop(); dkPlay(false); }
      else if (k === "s") { if (d.auto) autoStop(); dkPlay(true); }
      else if (k === "left") dkGo(-1); else if (k === "right") dkGo(1);
      else return false;
      return true;
    });
    root.addEventListener("input", e => { if (e.target.id === "dk-in" && EP && DK[EP.id]) DK[EP.id].typed = e.target.value; });
    root.addEventListener("keydown", e => {
      const d = EP && DK[EP.id]; if (!d || !d.sents || view !== "ep") return;
      if (e.target.id === "dk-in") { if (e.key === "Enter") { e.preventDefault(); d.typed = e.target.value; if (!d.typed.trim()) return dkPlay(false); dkCheck(); draw(); const i = root.querySelector("#dk-in"); if (i) i.focus(); } return; }
    });
    root.addEventListener("click", e => {
      const t = e.target, sp = trShow && EP && TIM[EP.id] && t.closest(".sm-tr [data-sp]");
      if (sp) { seekSent(+sp.dataset.sp); return; }
      const sy = t.closest("[data-say]"); if (sy) { try { AU.pause(); speak(sy.dataset.say, { rate: 0.85 }); } catch (e) {} return; }
      const lq = t.closest("[data-lq]"); if (lq && EP) { lqPick(EP.id, +lq.dataset.lq, +lq.dataset.o); return; }
      const od = t.closest("[data-offdel]"); if (od) { U.ask("删掉下载的这一期？（以后还能再下）", { ok: "删掉", danger: true }).then(ok => { if (ok) offDel(od.dataset.offdel); }); return; }
      const rp = t.closest("[data-reps],[data-gap]"); if (rp) { if (rp.dataset.reps) LS("sme:dkreps", +rp.dataset.reps); else LS("sme:dkgap", +rp.dataset.gap); draw(); return; }
      const sv = t.closest("[data-ser]"); if (sv) { ser = sv.dataset.ser; LS("sme:s", ser); view = "home"; loadList(ser); draw(); return; }
      const epEl = t.closest("[data-ep]"); if (epEl) { openEp(epEl.dataset.ep); return; }
      const r = t.closest("[data-rate]"); if (r) { rate = +r.dataset.rate; LS("sme:rate", rate); AU.playbackRate = rate; root.querySelectorAll("[data-rate]").forEach(x => x.classList.toggle("on", x === r)); return; }
      const ad = t.closest("[data-add]"); if (ad && EP) { const v = EP.vocab[+ad.dataset.add], w = String(v[0]).replace(/\s*\(.*?\)\s*/g, " ").trim(), re = new RegExp("(^|[^\\p{L}])" + w.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu") /* \\b 认不出 Ä Ö Ü 开头的德语词 */, line = (EP.lines || []).find(l => re.test(l.t)); ad.disabled = true; WORD.add(w, { sent: v[2] || (line ? line.t : ""), from: "听力·词汇" }).then(ok => { if (ok == null) ad.disabled = false; else ad.textContent = ok ? "✓ 已加" : "已在本里"; }); return; } /* 全站共用的加词（word.js） */
      const b = t.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
      if (a === "more") { MORE[ser] = (MORE[ser] || 40) + 80; draw(); return; }
      if (a === "home") { const home = () => { view = "home"; if (EP && !EP.err && ser !== "new") ser = serOf(EP.id); loadList(ser); draw(); }; if (window.NAV) NAV.back(home); else home(); return; } // 回到上一个页面
      if (a === "dk" && EP && !EP.err) { dkLoad(EP.id); return; }
      if (/^dk-/.test(a) && EP && DK[EP.id] && DK[EP.id].sents) {
        const d = DK[EP.id], inp = root.querySelector("#dk-in"); if (inp) d.typed = inp.value;
        if (a !== "dk-auto" && d.auto) { autoTok++; d.auto = false; }
        if (a === "dk-why") return whyLoad();
        if (a === "dk-auto") { if (d.auto) autoStop(); else autoRun(); return; }
        if (a === "dk-rec") return recStart();
        if (a === "dk-me") { if (d.rec && d.rec.url) { MEDIA.play(d.rec.url); } return; }
        if (a === "dk-play") { draw(); return dkPlay(false); }
        if (a === "dk-slow") { draw(); return dkPlay(true); }
        if (a === "dk-prev") return dkGo(-1);
        if (a === "dk-next") return dkGo(1);
        if (a === "dk-show") { d.show = !d.show; draw(); return; }
        if (a === "dk-check") { if (!d.typed.trim()) { tip("先把听到的写下来"); return; } dkCheck(); draw(); return; }
      }
      if (a === "fword") { fword = !fword; LS("sme:fword", fword); draw(); return; }
      if (a === "cont") { cont = !cont; LS("sme:cont", cont); draw(); return; }
      if (a === "off" && EP && !EP.err) { offSave(EP.id); return; }
      if (a === "offdel" && EP) { const id = EP.id; U.ask("删掉下载的这一期？（以后还能再下）", { ok: "删掉", danger: true }).then(ok => { if (ok) offDel(id); }); return; }
      if (a === "lq" && EP && !EP.err) { lqLoad(EP.id); return; }
      if (a === "follow") { follow = !follow; LS("sme:follow", follow); draw(); return; }
      if (a === "follow-retry" && EP) { delete FL[EP.id]; draw(); return; }
      if (a === "zh-retry" && EP && !EP.err) { loadZh(EP.id, true); return; }
      if (a === "zh") { zhOn = !zhOn; LS("sme:zh", zhOn); if (zhOn && EP && !EP.err) loadZh(EP.id); draw(); return; }
      if (a === "done" && EP && !EP.err) { markDone(EP.id); return; }
      if (a === "tr" || (a === "tr-peek" && !trShow)) { trShow = !trShow; draw(); return; }
      if (a === "read" && EP && window.readingOpen) {
        const text = (EP.lines || []).map(l => (l.who ? l.who + ": " : "") + l.t).join("\n\n");
        if (window.enShow) window.enShow("read"); setTimeout(() => window.readingOpen(text, SM[serOf(EP.id)][2] + ": " + EP.title, "sme:" + EP.id), 50); return;
      }
    });
  }
  // 🔙 页面历史：哪个栏目、打开了哪一期（看不到这一页时不记）
  if (window.NAV) NAV.reg("sme", () => root && root.getClientRects().length ? { ser, ep: view === "ep" ? (EP && EP.id) || openId : null } : undefined, x => {
    if (!x || !root) return;
    if (x.ser && x.ser !== ser && SM[x.ser]) { ser = x.ser; LS("sme:s", ser); }
    if (x.ep) { if (!(view === "ep" && ((EP && EP.id) || openId) === x.ep)) openEp(x.ep); return; }
    if (view !== "home") { view = "home"; loadList(ser); draw(); } else { loadList(ser); draw(); }
  });
  window.smeShow = () => { init(); if (!root) return; pull(); loadList(ser); draw(); };
  window.smeOpen = id => { init(); if (!root) return; const s = serOf(id); if (s && SM[s]) { ser = s; LS("sme:s", s); loadList(s); } openEp(id); }; // 直接打开某一期（🔎 真人例句里点「打开这一期」）
  window.smeDoneToday = () => { const D = done(), t = U.day(); return Object.keys(D).filter(id => U.day(D[id]) === t); }; // 「📅 每日」的「听」用
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
