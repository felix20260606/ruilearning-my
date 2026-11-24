/* 🇩🇪 德语「🌱 入门」（学德语时 tabs.js 的 SECS.basic 换成这几个小标签；英语的入门是 basic.js）：零基础快速上手
   - 🧭 从这开始：按「发音 → 救命句 → 语法 → 数字 → 每天练」排好顺序，点卡片直接去
   - 🔤 字母和发音：字母表（ä ö ü ß）、德语特有的读法（ei / ie / eu / ch / sch / sp / st / w / v / z …），每个都有例词
   - 👋 常用句：打招呼、礼貌、救命句、自我介绍、点餐购物、问路、交通、在家里
   - 📐 语法入门：名词大写和 der / die / das、复数、人称代词、sein / haben、规则动词变位、语序（动词第二位）、疑问句、否定、格、情态动词、du / Sie
   - 🔢 数字和时间：0–100（21 = einundzwanzig 倒着说）、星期、月份、几点了（halb drei = 2:30！）
   每一句 / 每个例词：🔊 听（浏览器的德语语音，慢速可选）、🎙 跟读打分（rec.js，lang:"de"）、＋ 生词本（德语生词本，WORD.add）
   学过的小节打勾存在本机「drill:basic」（index.html 的 MINE 按家人 + 语言分开存）
   依赖：U、TTS、REC、WORD；index.html 的 enShow（切标签） */
(function () {
  "use strict";
  if (window.deBasicShow && !window.deBasicShow.__lazy) return;
  const { esc, LG, LS } = U;
  const CSS = `
  #view-basic .db{max-width:960px;margin:0 auto;padding:6px 16px 60px;font-family:var(--ui-font)}
  #view-basic .db h1{font-size:22px;font-weight:900;margin:4px 0 6px}
  #view-basic .db .lead{color:var(--ui-ink-2);font-size:14.5px;line-height:1.75;margin:0 0 16px}
  #view-basic .db .sec{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:16px;padding:14px 16px;margin:0 0 12px}
  #view-basic .db .sec h2{font-size:16px;margin:0 0 4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  #view-basic .db .sec h2 .n{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--ui-pur);color:#fff;font-size:13px;flex:0 0 auto}
  #view-basic .db .sec h2 .sp{flex:1}#view-basic .db .sec h2 .done{font-size:12px;font-weight:800;border-radius:999px;padding:2px 10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink-2);cursor:pointer}
  #view-basic .db .sec h2 .done.on{background:var(--ui-green);color:var(--ui-on-accent,#111);border-color:transparent}
  #view-basic .db .sec>p{color:var(--ui-muted);font-size:13.5px;line-height:1.65;margin:0 0 10px}
  #view-basic .db .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
  #view-basic .db .cd{display:flex;align-items:center;gap:10px;text-align:left;background:var(--ui-surface-2);border:1px solid var(--ui-line);border-radius:12px;padding:10px 12px;color:inherit;font:inherit;cursor:pointer;min-height:56px}
  #view-basic .db .cd:hover{border-color:var(--ui-pur-line)}#view-basic .db .cd .t{flex:1;min-width:0}#view-basic .db .cd b{display:block;font-size:14.5px}
  #view-basic .db .cd small{display:block;color:var(--ui-muted);font-size:12.5px;line-height:1.5;margin-top:2px}#view-basic .db .cd .ok{flex:0 0 auto;font-size:12px;font-weight:800;color:var(--ui-on-accent,#111);background:var(--ui-green);border-radius:999px;padding:2px 8px}
  #view-basic .db .ph{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;padding:9px 0;border-top:1px solid var(--ui-line)}
  #view-basic .db .ph:first-of-type{border-top:0}
  #view-basic .db .ph .de{font-size:16px;font-weight:700;color:var(--ui-ink)}#view-basic .db .ph .zh{grid-column:1;color:var(--ui-ink-2);font-size:13.5px}
  #view-basic .db .ph .nt{grid-column:1/-1;color:var(--ui-muted);font-size:12.5px;line-height:1.55}
  #view-basic .db .ph .bt{grid-row:1/span 2;grid-column:2;display:flex;gap:6px;align-items:center}
  #view-basic .db .ib{border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:9px;min-width:36px;min-height:34px;padding:0 8px;font:inherit;font-size:14px;cursor:pointer}
  #view-basic .db .ib.on{background:var(--ui-red,#e5484d);color:#fff;border-color:transparent}
  #view-basic .db .res{grid-column:1/-1;font-size:13.5px;line-height:1.6}#view-basic .db .res .ok{color:var(--ui-green)}#view-basic .db .res .no{color:var(--ui-red,#ff8080);text-decoration:underline wavy}
  #view-basic .db table{border-collapse:collapse;width:100%;font-size:14px;margin:6px 0 4px}@media(max-width:700px){.db table{display:block;overflow-x:auto;max-width:100%}} /* 手机上宽表（形容词词尾、情态动词）在表里横着滑，不撑宽整页 */#view-basic .db td,#view-basic .db th{border-bottom:1px solid var(--ui-line);padding:6px 8px;text-align:left;vertical-align:top}
  #view-basic .db th{color:var(--ui-muted);font-weight:700;font-size:12.5px}#view-basic .db td .s{cursor:pointer;border-bottom:1px dashed var(--ui-line-2)}
  #view-basic .db .tip{background:color-mix(in srgb,var(--ui-pur) 10%,transparent);border:1px solid var(--ui-pur-line,var(--ui-line));border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13.5px;line-height:1.7;color:var(--ui-ink-2)}
  #view-basic .db .tip b{color:var(--ui-ink)}#view-basic .db .slow{display:flex;align-items:center;gap:6px;color:var(--ui-muted);font-size:13px;margin:0 0 10px}
  #view-basic .db .abc{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px}#view-basic .db .abc button{border:1px solid var(--ui-line);background:var(--ui-surface-2);color:inherit;border-radius:10px;padding:8px 4px;font:inherit;cursor:pointer;text-align:center}
  #view-basic .db .abc b{display:block;font-size:20px}#view-basic .db .abc small{color:var(--ui-muted);font-size:12px}`;

  // ---------- 内容 ----------
  // 句子 / 例词：[德语, 中文, 说明（可选）]
  const SOUNDS = [
    ["ä", "像「哎」（Bär 熊、Mädchen 女孩、spät 晚）", [["Bär", "熊"], ["Mädchen", "女孩"], ["spät", "晚"]]],
    ["ö", "嘴唇圆起来说「e」（schön 美、hören 听、Österreich 奥地利）", [["schön", "美"], ["hören", "听"], ["Österreich", "奥地利"]]],
    ["ü", "嘴唇圆起来说「i」，像汉语「鱼」（über 关于、Tür 门、müde 累）", [["über", "在……上方"], ["Tür", "门"], ["müde", "累"]]],
    ["ß", "就是清楚的「s」，长元音后面写 ß（Straße 街、groß 大、heißen 叫做）", [["Straße", "街道"], ["groß", "大"], ["heißen", "叫做"]]],
    ["ei", "读「爱」[ai]，不是 e-i（mein 我的、Wein 葡萄酒、zwei 二）", [["mein", "我的"], ["Wein", "葡萄酒"], ["zwei", "二"]]],
    ["ie", "读长「衣」[iː]（Liebe 爱、vier 四、spielen 玩）——和 ei 正好反过来", [["Liebe", "爱"], ["vier", "四"], ["spielen", "玩"]]],
    ["eu / äu", "读「奥伊」[ɔy]（heute 今天、Deutsch 德语、Häuser 房子们）", [["heute", "今天"], ["Deutsch", "德语"], ["Häuser", "房子（复数）"]]],
    ["ch（在 e / i / ä / ö / ü 后面）", "舌面轻轻擦出「希」（ich 我、nicht 不、Milch 牛奶）", [["ich", "我"], ["nicht", "不"], ["Milch", "牛奶"]]],
    ["ch（在 a / o / u 后面）", "喉咙里擦出「赫」（Buch 书、acht 八、noch 还）", [["Buch", "书"], ["acht", "八"], ["noch", "还"]]],
    ["sch", "读「师」[ʃ]（Schule 学校、schnell 快、Tisch 桌子）", [["Schule", "学校"], ["schnell", "快"], ["Tisch", "桌子"]]],
    ["sp / st（在词首）", "s 读成「师」：sp = schp、st = scht（Sport、Straße、Stadt 城市）", [["Sport", "运动"], ["Stadt", "城市"], ["sprechen", "说"]]],
    ["w", "读 [v]，像英语的 v（Wasser 水、was 什么、wo 哪里）", [["Wasser", "水"], ["was", "什么"], ["wo", "哪里"]]],
    ["v", "多数读 [f]（Vater 父亲、viel 很多、vier 四）", [["Vater", "父亲"], ["viel", "很多"], ["vor", "在……前"]]],
    ["z", "读 [ts]，像「次」（Zeit 时间、zehn 十、Zug 火车）", [["Zeit", "时间"], ["zehn", "十"], ["Zug", "火车"]]],
    ["s（元音前）", "读浊的 [z]，像英语 zoo 的 z（Sonne 太阳、sieben 七、Hase 兔子）", [["Sonne", "太阳"], ["sieben", "七"], ["Rose", "玫瑰"]]],
    ["j", "读 [j]，像「耶」的开头（ja 是、Jahr 年、jetzt 现在）", [["ja", "是"], ["Jahr", "年"], ["jetzt", "现在"]]],
    ["词尾的 b / d / g", "在词尾变清音：Tag 读 [taːk]、Hund 读 [hʊnt]、gelb 读 [gɛlp]", [["Tag", "天"], ["Hund", "狗"], ["gelb", "黄色"]]],
    ["-er（词尾）", "轻轻带过，像「呃」，r 几乎不读（Vater、Lehrer 老师、besser 更好）", [["Lehrer", "老师"], ["besser", "更好"], ["Wasser", "水"]]],
  ];
  const ALPHA = "A a|B be|C tse|D de|E e|F ef|G ge|H ha|I i|J jot|K ka|L el|M em|N en|O o|P pe|Q ku|R er|S es|T te|U u|V fau|W we|X iks|Y ypsilon|Z tset|Ä ä|Ö ö|Ü ü|ß eszett".split("|").map(x => x.split(" "));
  const PHR = [
    ["hi", "👋 打招呼和告别", "Guten Tag 最正式、最安全；熟人之间说 Hallo。南德、奥地利常听到 Grüß Gott / Servus。", [
      ["Hallo!", "你好！"], ["Guten Morgen!", "早上好！"], ["Guten Tag!", "你好！（白天，正式）"], ["Guten Abend!", "晚上好！"], ["Gute Nacht!", "晚安！（睡前）"],
      ["Wie geht es Ihnen?", "您好吗？（对陌生人、长辈）"], ["Wie geht's?", "最近怎么样？（熟人）"], ["Gut, danke. Und Ihnen?", "很好，谢谢。您呢？"],
      ["Tschüss!", "再见！（熟人）"], ["Auf Wiedersehen!", "再见！（正式）"], ["Bis später!", "回头见！"], ["Bis morgen!", "明天见！"]]],
    ["polite", "🙏 礼貌用语", "bitte 一词多用：请、不客气、（递东西时）给你。", [
      ["Bitte.", "请 / 不客气 / 给你"], ["Danke!", "谢谢！"], ["Danke schön!", "非常感谢！"], ["Vielen Dank!", "多谢！"], ["Gern geschehen.", "不客气。"],
      ["Entschuldigung!", "对不起 / 打扰一下"], ["Es tut mir leid.", "我很抱歉。"], ["Kein Problem.", "没问题。"], ["Ja. / Nein.", "是。/ 不是。"]]],
    ["rescue", "🆘 救命句（听不懂的时候）", "先学会这几句，听不懂也不慌。", [
      ["Ich verstehe das nicht.", "我听不懂 / 我不明白。"], ["Können Sie das bitte wiederholen?", "您能再说一遍吗？"], ["Langsamer, bitte.", "请说慢一点。"],
      ["Was bedeutet das?", "这是什么意思？"], ["Wie sagt man das auf Deutsch?", "这个用德语怎么说？"], ["Sprechen Sie Englisch?", "您说英语吗？"],
      ["Ich spreche nur ein bisschen Deutsch.", "我只会说一点德语。"], ["Können Sie das bitte aufschreiben?", "您能写下来吗？"], ["Einen Moment, bitte.", "请稍等。"]]],
    ["me", "🙋 自我介绍", "Ich heiße … 我叫……；Ich komme aus … 我来自……（国家名前一般不加冠词）。", [
      ["Ich heiße Ray.", "我叫 Ray。"], ["Mein Name ist Ray.", "我的名字是 Ray。"], ["Ich komme aus China.", "我来自中国。"], ["Ich wohne in Kuala Lumpur.", "我住在吉隆坡。"],
      ["Ich bin dreißig Jahre alt.", "我三十岁。"], ["Ich lerne Deutsch.", "我在学德语。"], ["Ich arbeite als Ingenieur.", "我的工作是工程师。"], ["Freut mich!", "很高兴认识你！"],
      ["Woher kommen Sie?", "您来自哪里？"], ["Wie heißen Sie?", "您叫什么名字？"]]],
    ["food", "☕ 点餐、购物", "Ich hätte gern … 我想要……（最礼貌、最常用）；结账说 Zahlen, bitte!", [
      ["Ich hätte gern einen Kaffee.", "我想要一杯咖啡。"], ["Ein Wasser, bitte.", "一瓶水，谢谢。"], ["Die Speisekarte, bitte.", "请给我菜单。"], ["Was empfehlen Sie?", "您推荐什么？"],
      ["Das schmeckt gut!", "这个好吃！"], ["Zahlen, bitte! / Die Rechnung, bitte.", "买单！"], ["Was kostet das?", "这个多少钱？"], ["Ich nehme das.", "我要这个。"],
      ["Haben Sie das auch in Größe M?", "这个有 M 号吗？"], ["Kann ich mit Karte bezahlen?", "可以刷卡吗？"]]],
    ["way", "🧭 问路、交通", "links 左、rechts 右、geradeaus 直走；die Haltestelle 车站（公交）、der Bahnhof 火车站。", [
      ["Entschuldigung, wo ist der Bahnhof?", "请问，火车站在哪里？"], ["Wie komme ich zum Flughafen?", "去机场怎么走？"], ["Gehen Sie geradeaus.", "您一直往前走。"],
      ["Dann links / rechts.", "然后左转 / 右转。"], ["Ist das weit?", "远吗？"], ["Eine Fahrkarte nach Berlin, bitte.", "一张去柏林的票。"],
      ["Wann fährt der nächste Zug?", "下一班火车什么时候开？"], ["Wo ist die Toilette?", "洗手间在哪里？"]]],
    ["day", "🏠 日常一句话", "", [
      ["Ich habe Hunger.", "我饿了。"], ["Ich habe Durst.", "我渴了。"], ["Ich bin müde.", "我累了。"], ["Es ist kalt / warm.", "天冷 / 暖和。"],
      ["Ich weiß es nicht.", "我不知道。"], ["Das ist gut!", "这个好！"], ["Alles klar!", "明白了 / 好的！"], ["Viel Glück!", "祝你好运！"], ["Schönes Wochenende!", "周末愉快！"]]],
  ];
  const GRAM = [
    ["noun", "名词大写 + 三个「the」：der / die / das", "德语所有名词首字母都大写。每个名词有阳性 der、阴性 die、中性 das，要和词一起背（背 der Tisch，不是只背 Tisch）。",
      '<table><tr><th>阳性 der</th><th>阴性 die</th><th>中性 das</th><th>复数 die</th></tr><tr><td><span class="s">der Mann</span> 男人</td><td><span class="s">die Frau</span> 女人</td><td><span class="s">das Kind</span> 孩子</td><td><span class="s">die Kinder</span></td></tr>' +
      '<tr><td><span class="s">der Tisch</span> 桌子</td><td><span class="s">die Lampe</span> 灯</td><td><span class="s">das Buch</span> 书</td><td><span class="s">die Bücher</span></td></tr></table>' +
      '<div class="tip">猜词性的小规律：<b>-ung / -heit / -keit / -schaft / -ion</b> 结尾 → die（die Zeitung 报纸）；<b>-chen / -lein</b> 结尾 → das（das Mädchen 女孩）；男性的人、星期、月份 → der。<br>「一个」：der / das 词用 <b>ein</b>，die 词用 <b>eine</b>（ein Mann、eine Frau、ein Kind）。</div>'],
    ["plural", "复数：没有统一规则，跟着词背", "常见几种：加 -e（der Tag → die Tage）、加 -en / -n（die Frau → die Frauen）、加 -er 带变音（das Haus → die Häuser）、加 -s（das Auto → die Autos）、不变（der Lehrer → die Lehrer）。复数的冠词都是 die。", ""],
    ["pron", "人称代词 + 最重要的两个动词 sein（是）/ haben（有）", "这两个动词不规则，必须背下来；其它动词的「我、你、他」词尾规律也从这里开始。",
      '<table><tr><th></th><th>sein 是</th><th>haben 有</th></tr>' + [["ich 我", "bin", "habe"], ["du 你", "bist", "hast"], ["er / sie / es 他 / 她 / 它", "ist", "hat"], ["wir 我们", "sind", "haben"], ["ihr 你们", "seid", "habt"], ["sie / Sie 他们 / 您", "sind", "haben"]].map(r => "<tr><td>" + r[0] + '</td><td><span class="s">' + r[0].split(" ")[0] + " " + r[1] + '</span></td><td><span class="s">' + r[0].split(" ")[0] + " " + r[2] + "</span></td></tr>").join("") + "</table>"],
    ["verb", "规则动词现在时：去掉 -en，加词尾", "原形都以 -en 结尾（machen 做、wohnen 住、lernen 学）。去掉 -en 得到词干 mach-，再按人称加：-e / -st / -t / -en / -t / -en。",
      '<table><tr><th>人称</th><th>词尾</th><th>machen 做</th><th>lernen 学</th></tr>' + [["ich", "-e", "mache", "lerne"], ["du", "-st", "machst", "lernst"], ["er / sie / es", "-t", "macht", "lernt"], ["wir", "-en", "machen", "lernen"], ["ihr", "-t", "macht", "lernt"], ["sie / Sie", "-en", "machen", "lernen"]].map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + '</td><td><span class="s">' + r[0].split(" ")[0] + " " + r[2] + '</span></td><td><span class="s">' + r[0].split(" ")[0] + " " + r[3] + "</span></td></tr>").join("") + "</table>" +
      '<div class="tip">有些常用动词在 du / er 时变元音：fahren → du <b>fährst</b>、er <b>fährt</b>；sprechen → du <b>sprichst</b>、er <b>spricht</b>；lesen → er <b>liest</b>。</div>'],
    ["order", "语序：动词永远站第二位", "陈述句里变位的动词是第 2 个成分，前面放什么都行（主语、时间、地点）。这是德语最重要的一条规则。",
      '<div class="tip"><span class="s">Ich gehe heute ins Kino.</span> 我今天去看电影。<br><span class="s">Heute gehe ich ins Kino.</span> 今天我去看电影。（时间放前面，主语就跑到动词后面）<br>有情态动词或完成时，第二个动词放到<b>句尾</b>：<span class="s">Ich kann heute nicht kommen.</span> 我今天来不了。</div>'],
    ["q", "疑问句：W 开头的问题 + 动词开头的是非题", "W-问句：疑问词在第 1 位、动词第 2 位。是非问句：动词放第 1 位。",
      '<table><tr><th>疑问词</th><th>例句</th></tr>' + [["was 什么", "Was machst du?"], ["wer 谁", "Wer ist das?"], ["wo 哪里", "Wo wohnst du?"], ["woher 从哪里", "Woher kommst du?"], ["wann 什么时候", "Wann beginnt der Kurs?"], ["wie 怎么 / 怎样", "Wie heißt du?"], ["warum 为什么", "Warum lernst du Deutsch?"], ["是非题（动词开头）", "Kommst du mit?"]].map(r => "<tr><td>" + r[0] + '</td><td><span class="s">' + r[1] + "</span></td></tr>").join("") + "</table>"],
    ["neg", "否定：nicht 和 kein", "否定名词（尤其是 ein / 没冠词的）用 kein：Ich habe kein Auto. 其它都用 nicht：Ich komme nicht. Das ist nicht gut.",
      '<div class="tip"><span class="s">Ich habe keine Zeit.</span> 我没时间。（kein 和 ein 一样变：keine 用于 die 词）<br><span class="s">Ich spreche nicht so gut Deutsch.</span> 我德语说得没那么好。</div>'],
    ["case", "格：先认识主格和宾格（只有阳性会变）", "德语名词前的冠词随着在句子里的作用变。入门先记一条：阳性名词当宾语时 der → den、ein → einen，其它不变。",
      '<div class="tip"><span class="s">Der Mann trinkt einen Kaffee.</span> 那个男人喝一杯咖啡。（der Kaffee 当宾语 → einen Kaffee）<br><span class="s">Ich sehe den Hund.</span> 我看见那条狗。（der Hund → den Hund）<br>阴性、中性、复数当宾语时不变：Ich kaufe <b>eine</b> Lampe / <b>ein</b> Buch。</div>'],
    ["modal", "情态动词：können / müssen / wollen / möchten", "情态动词放第 2 位，后面的动词用原形放到句尾。ich 和 er 的形式一样（没有 -t）。",
      '<table><tr><th>动词</th><th>意思</th><th>例句</th></tr>' + [["können", "能、会", "Ich kann Deutsch sprechen."], ["müssen", "必须", "Ich muss heute arbeiten."], ["wollen", "想要（意愿强）", "Wir wollen nach Berlin fahren."], ["möchten", "想要（礼貌）", "Ich möchte einen Tee trinken."], ["dürfen", "可以、被允许", "Darf ich hier rauchen?"]].map(r => '<tr><td><span class="s">' + r[0] + "</span></td><td>" + r[1] + '</td><td><span class="s">' + r[2] + "</span></td></tr>").join("") + "</table>"],
    ["sie", "du 还是 Sie？", "对陌生人、长辈、店员、同事（刚认识）用 Sie（大写，动词和「他们」一样：Sie sind、Sie haben）；对朋友、家人、小孩、同学用 du。拿不准就用 Sie，对方会说 Wir können uns duzen（我们可以用 du）。",
      '<div class="tip"><span class="s">Wie heißen Sie?</span> 您叫什么？ ↔ <span class="s">Wie heißt du?</span> 你叫什么？</div>'],
  ];
  const NUM = [["0", "null"], ["1", "eins"], ["2", "zwei"], ["3", "drei"], ["4", "vier"], ["5", "fünf"], ["6", "sechs"], ["7", "sieben"], ["8", "acht"], ["9", "neun"], ["10", "zehn"], ["11", "elf"], ["12", "zwölf"], ["13", "dreizehn"], ["16", "sechzehn"], ["17", "siebzehn"], ["20", "zwanzig"], ["21", "einundzwanzig"], ["30", "dreißig"], ["45", "fünfundvierzig"], ["99", "neunundneunzig"], ["100", "hundert"], ["1000", "tausend"]];
  const DAYS = [["Montag", "星期一"], ["Dienstag", "星期二"], ["Mittwoch", "星期三"], ["Donnerstag", "星期四"], ["Freitag", "星期五"], ["Samstag", "星期六"], ["Sonntag", "星期日"]];
  const MONTHS = "Januar,Februar,März,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember".split(",");
  const TIME = [["Wie spät ist es?", "几点了？"], ["Es ist drei Uhr.", "三点。"], ["Es ist Viertel nach drei.", "三点一刻（3:15）。"], ["Es ist halb vier.", "三点半（3:30）——halb vier = 「离四点差一半」！"], ["Es ist Viertel vor vier.", "差一刻四点（3:45）。"], ["Um wie viel Uhr?", "几点钟？"], ["Heute ist Montag.", "今天星期一。"], ["Mein Geburtstag ist im Mai.", "我的生日在五月。"]];

  // ---------- 进度、跳转 ----------
  const DONE_K = "drill:basic", done = () => LG(DONE_K, {}) || {};
  const setDone = (k, on) => { const d = done(); if (on) d[k] = Date.now(); else delete d[k]; LS(DONE_K, d); };
  const en = (w, sub) => { if (typeof window.enShow === "function") window.enShow(w, sub); window.scrollTo(0, 0); };
  const mode = m => setTimeout(() => { const b = document.querySelector('.modes button[data-mode="' + m + '"]'); if (b && !b.classList.contains("on")) b.click(); }, 0);
  const GO = {
    laut: () => en("basic", "laut"), satz: () => en("basic", "satz"), gram: () => en("basic", "gram"), zahl: () => en("basic", "zahl"),
    drill: () => { LS("drill:lvl", 1); en("listen", "drill"); }, pump: () => { en("notebook"); mode("pump"); }, daily: () => en("daily"),
  };
  let slow = false; try { slow = localStorage.getItem("debasic:slow") === "1"; } catch (e) {}
  const say = t => { if (window.TTS) TTS.say(t, { lang: "de", rate: slow ? 0.75 : 1 }); };

  // ---------- 一行可以听、跟读、收进生词本的句子 ----------
  const RES = {};
  function row(id, de, zh, note) {
    const r = RES[id] || {}, k = esc(id);
    return '<div class="ph" data-id="' + k + '"><div class="de">' + esc(de) + '</div><div class="bt"><button class="ib" data-say="' + esc(de) + '" title="听">🔊</button><button class="ib' + (r.on ? " on" : "") + '" data-rec="' + k + '" data-t="' + esc(de) + '" title="跟读打分">' + (r.on ? "⏹" : "🎙") + '</button><button class="ib" data-add="' + esc(de) + '" title="收进德语生词本">＋</button></div>' +
      '<div class="zh">' + esc(zh) + "</div>" + (note ? '<div class="nt">' + esc(note) + "</div>" : "") + resHtml(id) + "</div>";
  }
  function resHtml(id) {
    const r = RES[id]; if (!r) return "";
    if (r.on) return '<div class="res">正在录音…… 读完点 ⏹</div>';
    if (r.busy) return '<div class="res">正在识别……</div>';
    if (r.err) return '<div class="res" style="color:var(--ui-orange,#FFB86B)">⚠️ ' + esc(r.err) + "</div>";
    if (r.sc) return '<div class="res">读对 <b>' + Math.round(r.sc.score * 100) + "%</b>：" + REC.mark(r.t, r.sc.hit, { ok: "ok", no: "no" }) + (r.said ? ' <span style="color:var(--ui-muted)">（听到：' + esc(r.said) + "）</span>" : "") + "</div>";
    return "";
  }
  function paintRow(id) { const el = root && root.querySelector('.ph[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); if (!el) return; const de = el.querySelector(".de").textContent, zh = el.querySelector(".zh").textContent, nt = el.querySelector(".nt"); el.outerHTML = row(id, de, zh, nt ? nt.textContent : ""); }
  function rec(id, t) {
    const r = RES[id] = RES[id] || {}; const tok = (r.tok = (r.tok || 0) + (REC.cur() === id ? 0 : 1));
    REC.toggle(id, { lang: "de", max: 12, before: () => { if (window.TTS) TTS.hush(); },
      start: () => { if (RES[id].tok !== tok) return; r.on = true; r.err = ""; paintRow(id); },
      cancel: () => { r.on = false; r.busy = false; paintRow(id); },
      fail: m => { r.on = false; r.err = m; paintRow(id); },
      busy: () => { if (RES[id].tok !== tok) return; r.on = false; r.busy = true; paintRow(id); },
      done: x => { if (x && x.url) try { URL.revokeObjectURL(x.url); } catch (e) {} /* 这里不回放录音：录音地址用不上，马上放掉 */ if (RES[id].tok !== tok) return; r.on = false; r.busy = false; r.t = t; r.said = x.text || ""; r.sc = x.text ? REC.score(t, x.text, { lang: "de" }) : null;
        r.err = x.text ? "" : x.err === "empty" ? "没录到声音，靠近一点、大声一点再试" : /neuron|4006|quota/i.test(x.err || "") ? "今天的 AI 识别额度用完了，北京时间早上 8 点恢复" : "没识别出来，再读一次试试"; paintRow(id); } });
  }

  // ---------- 各小标签 ----------
  const sec = (k, n, t, p, body) => { const on = !!done()[k]; return '<div class="sec"><h2>' + (n ? '<span class="n">' + n + "</span>" : "") + esc(t) + '<span class="sp"></span><button class="done' + (on ? " on" : "") + '" data-done="' + k + '">' + (on ? "✓ 学过了" : "学完打勾") + "</button></h2>" + (p ? "<p>" + esc(p) + "</p>" : "") + body + "</div>"; };
  const slowBar = () => '<label class="slow"><input type="checkbox" data-slow' + (slow ? " checked" : "") + "> 🐢 慢速朗读（浏览器自带的德语语音；没声音的话，在系统设置里加一个德语语音）</label>";
  const card = (go, title, sub, ok) => '<button class="cd" data-go="' + go + '"><span class="t"><b>' + title + "</b><small>" + sub + "</small></span>" + (ok ? '<span class="ok">' + esc(ok) + "</span>" : '<span class="go">›</span>') + "</button>";
  function start() {
    const d = done(), n = pre => Object.keys(d).filter(k => k.indexOf(pre) === 0).length;
    const step = (i, t, p, cards) => '<div class="sec"><h2><span class="n">' + i + "</span>" + t + "</h2><p>" + p + '</p><div class="cards">' + cards.join("") + "</div></div>";
    return '<div class="db"><h1>🌱 德语入门</h1><p class="lead">零基础也能很快上手：先把<b>发音规则</b>弄懂（德语基本上怎么写就怎么读），再背<b>救命句和自我介绍</b>，然后掌握最核心的几条<b>语法</b>（der / die / das、动词变位、动词第二位）。之后每天用 🧩 练习课听慢速德语、在 🔊 练习里背单词。</p>' +
      step(1, "发音：德语基本上看字就能读", "先学会 ä ö ü ß 和 ei / ie / ch / sch 这些和英语不一样的读法，之后见到新词就能读出来。", [card("laut", "🔤 字母和发音", "字母表、变音字母、18 个特别的读法，每个都有例词可以听、跟读", n("laut") ? "学过 " + n("laut") + " 节" : "")]) +
      step(2, "开口：救命句 + 自我介绍", "先学会听不懂时怎么说，再把自我介绍说顺；每句都能听、跟读打分、收进生词本。", [card("satz", "👋 常用句", "打招呼、礼貌、救命句、自我介绍、点餐购物、问路、日常", n("satz") ? "学过 " + n("satz") + " 组" : "")]) +
      step(3, "语法：只学最核心的几条", "der / die / das、sein 和 haben、动词变位、动词第二位、问句、否定、格、情态动词、du 和 Sie。", [card("gram", "📐 语法入门", "10 张卡片，一张讲一件事，例句都能点着听", n("gram") ? "学过 " + n("gram") + " 张" : ""), card("zahl", "🔢 数字和时间", "0–100、星期、月份、几点了（halb drei 是 2:30！）", n("zahl") ? "学过" : "")]) +
      step(4, "每天练：听 + 背词", "每天一点点比一次学很多有用。", [card("drill", "🧩 练习课（德语）", "德语素材拆成小节：听、跟读、选句、排词；点进去自动设成「简单」"), card("pump", "🔤 背单词（🔊 练习）", "把上面收进生词本的词一张张练"), card("daily", "📅 每日一练", "每天自动排好「词 · 听」，做完打勾，看连续天数")]) + "</div>";
  }
  function laut() {
    return '<div class="db"><h1>🔤 字母和发音</h1><p class="lead">德语的拼写和读音很规则：学会下面这些，见到生词基本都能读对。点例词听，🎙 跟读看自己读得准不准。</p>' + slowBar() +
      sec("laut:abc", 1, "字母表（26 个 + ä ö ü ß）", "点字母听它的读法（拼名字、拼地址时用得到）。", '<div class="abc">' + ALPHA.map(([l, nm]) => '<button data-say="' + esc(nm) + '"><b>' + esc(l) + "</b><small>" + esc(nm) + "</small></button>").join("") + "</div>") +
      SOUNDS.map((s, i) => sec("laut:" + i, i + 2, s[0], s[1], s[2].map((w, j) => row("laut:" + i + ":" + j, w[0], w[1])).join(""))).join("") + "</div>";
  }
  function satz() {
    return '<div class="db"><h1>👋 常用句</h1><p class="lead">每组先听一遍，再一句一句跟读；有用的点 ＋ 收进德语生词本，之后在 🔊 练习里复习。</p>' + slowBar() +
      PHR.map((g, i) => sec("satz:" + g[0], i + 1, g[1], g[2], g[3].map((p, j) => row("satz:" + g[0] + ":" + j, p[0], p[1], p[2])).join(""))).join("") + "</div>";
  }
  function gram() {
    return '<div class="db"><h1>📐 语法入门</h1><p class="lead">只讲入门最需要的 10 件事。表格和例句里带下划虚线的都能点着听。</p>' + slowBar() +
      GRAM.map((g, i) => sec("gram:" + g[0], i + 1, g[1], g[2], g[3])).join("") + "</div>";
  }
  function zahl() {
    return '<div class="db"><h1>🔢 数字和时间</h1>' + slowBar() +
      sec("zahl:num", 1, "数字", "21 以上是「个位 + und + 十位」倒着说：21 = ein-und-zwanzig（一和二十）。", '<div class="abc">' + NUM.map(([n, w]) => '<button data-say="' + esc(w) + '"><b>' + n + "</b><small>" + esc(w) + "</small></button>").join("") + "</div>") +
      sec("zahl:days", 2, "星期", "都是阳性 der；「在星期一」说 am Montag。", DAYS.map((d, j) => row("zahl:d:" + j, d[0], d[1])).join("")) +
      sec("zahl:months", 3, "月份", "「在五月」说 im Mai。", '<div class="abc">' + MONTHS.map((m, j) => '<button data-say="' + esc(m) + '"><b>' + (j + 1) + "</b><small>" + esc(m) + "</small></button>").join("") + "</div>") +
      sec("zahl:time", 4, "几点了", "halb 是「差半小时到下一个整点」：halb vier = 3:30，不是 4:30。", TIME.map((t, j) => row("zahl:t:" + j, t[0], t[1])).join("")) + "</div>";
  }
  // 📚 语法速查（内容在 de-grammar-data.js 的 window.DE_GRAM_REF，第一次打开才加载）：格变化、形容词词尾、动词变位、介词……表格查
  let refP = null, refQ = "";
  function refLoad() { if (window.DE_GRAM_REF) return Promise.resolve(); return refP || (refP = new Promise(res => { const s = document.createElement("script"); s.src = "de-grammar-data.js?v=6e8bb232"; s.onload = s.onerror = res; document.head.append(s); }).then(() => { if (cur === "ref") draw(); })); }
  // 搜索：格的几种叫法都算（Dativ = 三格 = Dat、Akkusativ = 四格 = Akk…）
  const REF_ALIAS = [["dativ", "三格", "dat"], ["akkusativ", "四格", "akk"], ["nominativ", "一格", "nom"], ["genitiv", "二格", "gen"], ["perfekt", "完成时"], ["präteritum", "过去时"], ["konjunktiv", "虚拟"], ["passiv", "被动"], ["adjektiv", "形容词"], ["präposition", "介词"], ["relativ", "关系"]];
  function refHit(text, q) {
    q = String(q || "").trim().toLowerCase(); if (!q) return true; const t = String(text).replace(/<[^>]+>/g, " ").toLowerCase();
    const alt = REF_ALIAS.find(a => a.some(x => x === q || (q.length >= 3 && x.startsWith(q))));
    return (alt ? alt : [q]).some(x => t.includes(x));
  }
  function ref() {
    const L = window.DE_GRAM_REF; if (!L) { refLoad(); return '<div class="db"><h1>📚 语法速查</h1><p class="lead">载入中…</p></div>'; }
    const S = L;
    return '<div class="db"><h1>📚 语法速查</h1><p class="lead">A1–B1 最常用的语法表：冠词和格、代词、形容词词尾、动词变位、完成时、介词、语序……查的时候直接搜（中文、德语都行），例句点着能听。入门先看「📐 语法入门」。</p>' + slowBar() +
      '<input class="ref-q" data-refq placeholder="搜：Dativ、形容词词尾、weil、Perfekt…" value="' + esc(refQ) + '" style="width:100%;height:40px;border-radius:10px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:0 12px;font:inherit;font-size:15px;margin:4px 0 12px">' +
      S.map(g => '<div class="refw"' + (refHit(g[1] + " " + g[2] + " " + g[3], refQ) ? "" : ' style="display:none"') + ">" + sec("ref:" + g[0], L.indexOf(g) + 1, g[1], g[2], g[3]) + "</div>").join("") + '<p class="lead refnone"' + (S.some(g => refHit(g[1] + " " + g[2] + " " + g[3], refQ)) ? ' style="display:none"' : "") + ">没找到，换个词试试（中文、德语都行）</p></div>";
  }
  const VIEWS = { start, laut, satz, gram, ref, zahl };

  let root = null, cur = "start";
  function init() {
    if (root) return; root = document.getElementById("view-basic"); if (!root) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    root.addEventListener("input", e => { // 📚 语法速查的搜索：按文字筛（不重画，输入框不丢焦点）
      if (!e.target.matches || !e.target.matches("[data-refq]")) return; refQ = e.target.value; let n = 0;
      root.querySelectorAll(".db .refw").forEach(el => { const on = refHit(el.innerHTML, refQ); el.style.display = on ? "" : "none"; if (on) n++; });
      const none = root.querySelector(".refnone"); if (none) none.style.display = n ? "none" : "";
    });
    root.addEventListener("click", e => {
      if (window.VL !== "de") return;
      const t = e.target;
      const g = t.closest("[data-go]"); if (g && GO[g.dataset.go]) return GO[g.dataset.go]();
      const s = t.closest("[data-say]"); if (s) return say(s.dataset.say);
      const sp = t.closest(".s"); if (sp) return say(sp.textContent.replace(/\s*\/\s*/g, ", "));
      const r = t.closest("[data-rec]"); if (r) return rec(r.dataset.rec, r.dataset.t);
      const a = t.closest("[data-add]"); if (a) { if (window.WORD && WORD.add) WORD.add(a.dataset.add.split(" / ")[0], { from: "德语入门", learn: true }); return; }
      const d = t.closest("[data-done]"); if (d) { setDone(d.dataset.done, !done()[d.dataset.done]); draw(); return; }
    });
    root.addEventListener("change", e => { if (e.target.matches("[data-slow]")) { slow = e.target.checked; try { localStorage.setItem("debasic:slow", slow ? "1" : "0"); } catch (er) {} } });
  }
  function draw() { if (root && VIEWS[cur]) root.innerHTML = VIEWS[cur](); }
  window.deBasicShow = sub => { init(); cur = VIEWS[sub] ? sub : "start"; draw(); if (window.NAV) NAV.mark(); };
  window.DE_BASIC = { SOUNDS, PHR, GRAM, NUM, VIEWS }; // 测试用
})();
