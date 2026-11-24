/* 🇩🇪 德语语法速查的内容（de-basic.js「📚 语法速查」用）：每条 [id, 中文标题, 中文说明, HTML 表格 / 例句]。由 Claude 编写并校对。 */
window.DE_GRAM_REF = [
  ["art", "冠词四格总表：der / ein / kein", "冠词随「格」变：主格 Nom（主语，问 wer / was）、宾格 Akk（直接宾语，问 wen / was）、与格 Dat（间接宾语，问 wem）、属格 Gen（「……的」，问 wessen）。ein / kein 的词尾大多和 der 对应，但阳性主格、中性主格 / 宾格没有词尾（ein Mann、ein Kind）；复数没有 ein。",
    '<table><tr><th>格</th><th>阳性 m</th><th>阴性 f</th><th>中性 n</th><th>复数 Pl</th></tr>' +
    '<tr><td><b>Nom</b> 主格</td><td><span class="s">der / ein / kein</span></td><td><span class="s">die / eine / keine</span></td><td><span class="s">das / ein / kein</span></td><td><span class="s">die / keine</span></td></tr>' +
    '<tr><td><b>Akk</b> 宾格</td><td><span class="s">den / einen / keinen</span></td><td><span class="s">die / eine / keine</span></td><td><span class="s">das / ein / kein</span></td><td><span class="s">die / keine</span></td></tr>' +
    '<tr><td><b>Dat</b> 与格</td><td><span class="s">dem / einem / keinem</span></td><td><span class="s">der / einer / keiner</span></td><td><span class="s">dem / einem / keinem</span></td><td><span class="s">den / keinen</span></td></tr>' +
    '<tr><td><b>Gen</b> 属格</td><td><span class="s">des / eines / keines</span></td><td><span class="s">der / einer / keiner</span></td><td><span class="s">des / eines / keines</span></td><td><span class="s">der / keiner</span></td></tr></table>' +
    '<table><tr><th>格</th><th>男人</th><th>女人</th><th>孩子</th><th>孩子们</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">der Mann</span></td><td><span class="s">die Frau</span></td><td><span class="s">das Kind</span></td><td><span class="s">die Kinder</span></td></tr>' +
    '<tr><td>Akk</td><td><span class="s">den Mann</span></td><td><span class="s">die Frau</span></td><td><span class="s">das Kind</span></td><td><span class="s">die Kinder</span></td></tr>' +
    '<tr><td>Dat</td><td><span class="s">dem Mann</span></td><td><span class="s">der Frau</span></td><td><span class="s">dem Kind</span></td><td><span class="s">den Kinder<b>n</b></span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">des Mann<b>es</b></span></td><td><span class="s">der Frau</span></td><td><span class="s">des Kind<b>es</b></span></td><td><span class="s">der Kinder</span></td></tr></table>' +
    '<div class="tip"><b>名词自己也变：</b>阳性、中性单数属格加 <b>-es</b>（多为单音节：des Mannes、des Kindes）或 <b>-s</b>（多音节：des Lehrers、des Autos）；复数与格加 <b>-n</b>（den Kindern），本来以 -n / -s 结尾的不再加（den Frauen、den Autos）。阴性名词单数永远不变。<br>' +
    '<span class="s">Der Mann gibt dem Kind einen Apfel.</span> 那个男人给孩子一个苹果。<br><span class="s">Das ist das Auto des Lehrers.</span> 这是老师的车。<br>' +
    '<b>dieser / jeder / welcher</b> 跟 der 同一套词尾：dieser – diese – dieses – diese；宾格 diesen，与格 diesem，属格 dieses。</div>'],

  ["pron", "人称代词四格：ich / mich / mir", "代词也分格：动词或介词要求 Akk 就用第二列，要求 Dat 就用第三列。属格代词现代德语几乎不用，认识即可。",
    '<table><tr><th>主格 Nom</th><th>宾格 Akk</th><th>与格 Dat</th><th>属格 Gen</th></tr>' +
    '<tr><td><span class="s">ich</span> 我</td><td><span class="s">mich</span></td><td><span class="s">mir</span></td><td>meiner</td></tr>' +
    '<tr><td><span class="s">du</span> 你</td><td><span class="s">dich</span></td><td><span class="s">dir</span></td><td>deiner</td></tr>' +
    '<tr><td><span class="s">er</span> 他</td><td><span class="s">ihn</span></td><td><span class="s">ihm</span></td><td>seiner</td></tr>' +
    '<tr><td><span class="s">sie</span> 她</td><td><span class="s">sie</span></td><td><span class="s">ihr</span></td><td>ihrer</td></tr>' +
    '<tr><td><span class="s">es</span> 它</td><td><span class="s">es</span></td><td><span class="s">ihm</span></td><td>seiner</td></tr>' +
    '<tr><td><span class="s">wir</span> 我们</td><td><span class="s">uns</span></td><td><span class="s">uns</span></td><td>unser</td></tr>' +
    '<tr><td><span class="s">ihr</span> 你们</td><td><span class="s">euch</span></td><td><span class="s">euch</span></td><td>euer</td></tr>' +
    '<tr><td><span class="s">sie</span> 他们</td><td><span class="s">sie</span></td><td><span class="s">ihnen</span></td><td>ihrer</td></tr>' +
    '<tr><td><span class="s">Sie</span> 您</td><td><span class="s">Sie</span></td><td><span class="s">Ihnen</span></td><td>Ihrer</td></tr></table>' +
    '<table><tr><th>例句</th><th>说明</th></tr>' +
    '<tr><td><span class="s">Ich liebe dich.</span> 我爱你。</td><td>lieben + Akk</td></tr>' +
    '<tr><td><span class="s">Kannst du mir helfen?</span> 你能帮我吗？</td><td>helfen + Dat</td></tr>' +
    '<tr><td><span class="s">Wie geht es Ihnen?</span> 您好吗？</td><td>es geht + Dat</td></tr>' +
    '<tr><td><span class="s">Das Kleid gefällt mir.</span> 我喜欢这条裙子。</td><td>gefallen + Dat</td></tr>' +
    '<tr><td><span class="s">Ich komme mit dir.</span> 我跟你一起去。</td><td>mit + Dat</td></tr>' +
    '<tr><td><span class="s">Das ist für ihn.</span> 这是给他的。</td><td>für + Akk</td></tr></table>' +
    '<div class="tip"><b>常见要求 Dat 的动词：</b>helfen 帮助、danken 感谢、gefallen 令人喜欢、gehören 属于、antworten 回答、gratulieren 祝贺、schmecken 好吃、passen 合适、fehlen 缺少、glauben（相信某人）。<br>' +
    '<b>两个宾语的顺序：</b>两个名词 → 先 Dat 后 Akk：<span class="s">Ich gebe dem Mann das Buch.</span><br>有代词 → 代词在前：<span class="s">Ich gebe ihm das Buch.</span> <span class="s">Ich gebe es dem Mann.</span><br>两个代词 → 先 Akk 后 Dat：<span class="s">Ich gebe es ihm.</span></div>'],

  ["poss", "物主冠词：mein / dein / sein / ihr …", "「我的、你的……」放在名词前，词尾和 ein / kein 完全一样（复数和 kein 一样）。sein 用于 er / es，ihr 用于 sie（她 / 他们），Ihr（大写）= 您的。",
    '<table><tr><th>人称</th><th>物主冠词</th><th>例</th></tr>' +
    '<tr><td>ich</td><td><span class="s">mein</span> 我的</td><td><span class="s">mein Vater, meine Mutter</span></td></tr>' +
    '<tr><td>du</td><td><span class="s">dein</span> 你的</td><td><span class="s">dein Bruder, deine Schwester</span></td></tr>' +
    '<tr><td>er / es</td><td><span class="s">sein</span> 他的 / 它的</td><td><span class="s">sein Auto, seine Frau</span></td></tr>' +
    '<tr><td>sie 她</td><td><span class="s">ihr</span> 她的</td><td><span class="s">ihr Mann, ihre Tochter</span></td></tr>' +
    '<tr><td>wir</td><td><span class="s">unser</span> 我们的</td><td><span class="s">unser Haus, unsere Kinder</span></td></tr>' +
    '<tr><td>ihr</td><td><span class="s">euer</span> 你们的</td><td><span class="s">euer Lehrer, eure Wohnung</span></td></tr>' +
    '<tr><td>sie 他们</td><td><span class="s">ihr</span> 他们的</td><td><span class="s">ihr Sohn, ihre Eltern</span></td></tr>' +
    '<tr><td>Sie 您</td><td><span class="s">Ihr</span> 您的</td><td><span class="s">Ihr Name, Ihre Adresse</span></td></tr></table>' +
    '<table><tr><th>格</th><th>阳性 m</th><th>阴性 f</th><th>中性 n</th><th>复数 Pl</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">mein</span></td><td><span class="s">meine</span></td><td><span class="s">mein</span></td><td><span class="s">meine</span></td></tr>' +
    '<tr><td>Akk</td><td><span class="s">meinen</span></td><td><span class="s">meine</span></td><td><span class="s">mein</span></td><td><span class="s">meine</span></td></tr>' +
    '<tr><td>Dat</td><td><span class="s">meinem</span></td><td><span class="s">meiner</span></td><td><span class="s">meinem</span></td><td><span class="s">meinen</span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">meines</span></td><td><span class="s">meiner</span></td><td><span class="s">meines</span></td><td><span class="s">meiner</span></td></tr></table>' +
    '<div class="tip"><span class="s">Ich suche meinen Schlüssel.</span> 我在找我的钥匙。<br><span class="s">Ich wohne bei meinen Eltern.</span> 我和父母住。<br><span class="s">Sie ruft ihren Vater an.</span> 她给她爸爸打电话。<br><span class="s">Wie ist Ihr Name?</span> 您叫什么名字？<br>' +
    '<b>euer</b> 加词尾时去掉中间的 e：eure Mutter、euren Sohn、eurem Haus；<b>unser</b> 保留：unsere、unseren、unserem。</div>'],

  ["adj", "形容词词尾：弱 / 混合 / 强变化", "形容词放在名词前要加词尾；放在 sein / werden / bleiben 后面不加（Der Wein ist gut）。词尾看前面的冠词：定冠词 → 弱变化；ein / kein / mein → 混合变化；没有冠词 → 强变化。",
    '<b>① 定冠词后（der / dieser / jeder / welcher / alle）：弱变化</b>' +
    '<table><tr><th>格</th><th>阳性 m</th><th>阴性 f</th><th>中性 n</th><th>复数 Pl</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">der gut<b>e</b> Wein</span></td><td><span class="s">die gut<b>e</b> Suppe</span></td><td><span class="s">das gut<b>e</b> Brot</span></td><td><span class="s">die gut<b>en</b> Weine</span></td></tr>' +
    '<tr><td>Akk</td><td><span class="s">den gut<b>en</b> Wein</span></td><td><span class="s">die gut<b>e</b> Suppe</span></td><td><span class="s">das gut<b>e</b> Brot</span></td><td><span class="s">die gut<b>en</b> Weine</span></td></tr>' +
    '<tr><td>Dat</td><td><span class="s">dem gut<b>en</b> Wein</span></td><td><span class="s">der gut<b>en</b> Suppe</span></td><td><span class="s">dem gut<b>en</b> Brot</span></td><td><span class="s">den gut<b>en</b> Weinen</span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">des gut<b>en</b> Weines</span></td><td><span class="s">der gut<b>en</b> Suppe</span></td><td><span class="s">des gut<b>en</b> Brotes</span></td><td><span class="s">der gut<b>en</b> Weine</span></td></tr></table>' +
    '<b>② ein / kein / 物主冠词后：混合变化</b>' +
    '<table><tr><th>格</th><th>阳性 m</th><th>阴性 f</th><th>中性 n</th><th>复数 Pl</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">ein gut<b>er</b> Wein</span></td><td><span class="s">eine gut<b>e</b> Suppe</span></td><td><span class="s">ein gut<b>es</b> Brot</span></td><td><span class="s">meine gut<b>en</b> Weine</span></td></tr>' +
    '<tr><td>Akk</td><td><span class="s">einen gut<b>en</b> Wein</span></td><td><span class="s">eine gut<b>e</b> Suppe</span></td><td><span class="s">ein gut<b>es</b> Brot</span></td><td><span class="s">meine gut<b>en</b> Weine</span></td></tr>' +
    '<tr><td>Dat</td><td><span class="s">einem gut<b>en</b> Wein</span></td><td><span class="s">einer gut<b>en</b> Suppe</span></td><td><span class="s">einem gut<b>en</b> Brot</span></td><td><span class="s">meinen gut<b>en</b> Weinen</span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">eines gut<b>en</b> Weines</span></td><td><span class="s">einer gut<b>en</b> Suppe</span></td><td><span class="s">eines gut<b>en</b> Brotes</span></td><td><span class="s">meiner gut<b>en</b> Weine</span></td></tr></table>' +
    '<b>③ 没有冠词：强变化</b>' +
    '<table><tr><th>格</th><th>阳性 m</th><th>阴性 f</th><th>中性 n</th><th>复数 Pl</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">gut<b>er</b> Wein</span></td><td><span class="s">gut<b>e</b> Suppe</span></td><td><span class="s">gut<b>es</b> Brot</span></td><td><span class="s">gut<b>e</b> Weine</span></td></tr>' +
    '<tr><td>Akk</td><td><span class="s">gut<b>en</b> Wein</span></td><td><span class="s">gut<b>e</b> Suppe</span></td><td><span class="s">gut<b>es</b> Brot</span></td><td><span class="s">gut<b>e</b> Weine</span></td></tr>' +
    '<tr><td>Dat</td><td><span class="s">gut<b>em</b> Wein</span></td><td><span class="s">gut<b>er</b> Suppe</span></td><td><span class="s">gut<b>em</b> Brot</span></td><td><span class="s">gut<b>en</b> Weinen</span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">gut<b>en</b> Weines</span></td><td><span class="s">gut<b>er</b> Suppe</span></td><td><span class="s">gut<b>en</b> Brotes</span></td><td><span class="s">gut<b>er</b> Weine</span></td></tr></table>' +
    '<div class="tip"><b>记法：</b>弱变化只有 -e 和 -en：三个主格单数 + 阴性、中性宾格是 -e，其余全是 -en。<br>混合变化 = 弱变化，只有 ein 看不出性别的三处换成强词尾：ein gut<b>er</b>（阳性主格）、ein gut<b>es</b>（中性主格 / 宾格）。<br>强变化 = 形容词替冠词「露出」词尾（dem → gut<b>em</b>，der → gut<b>er</b>），唯一例外是阳性、中性属格用 -en。<br>' +
    'viele / einige / mehrere / wenige / 数字后面用强变化：<span class="s">viele nette Leute</span>、<span class="s">zwei kleine Kinder</span>。<br>拼写变化：teuer → <span class="s">ein teures Hotel</span>，dunkel → <span class="s">ein dunkles Zimmer</span>，hoch → <span class="s">ein hoher Berg</span>；lila、rosa、prima 不加词尾。</div>'],

  ["nounpl", "名词复数类型 + n-变格（der Junge → den Jungen）", "复数要跟着单词一起背，但有大致规律。另有一小组阳性名词（n-Deklination）除了单数主格，所有格都加 -(e)n。",
    '<table><tr><th>复数类型</th><th>例子</th><th>常见于</th></tr>' +
    '<tr><td>-e（有时变音）</td><td><span class="s">der Tag – die Tage</span><br><span class="s">der Stuhl – die Stühle</span></td><td>阳性单音节词</td></tr>' +
    '<tr><td>-(e)n</td><td><span class="s">die Frau – die Frauen</span><br><span class="s">die Lampe – die Lampen</span></td><td>大部分阴性词</td></tr>' +
    '<tr><td>-nen</td><td><span class="s">die Lehrerin – die Lehrerinnen</span></td><td>-in 结尾的阴性词</td></tr>' +
    '<tr><td>-er（能变音就变音）</td><td><span class="s">das Kind – die Kinder</span><br><span class="s">das Haus – die Häuser</span><br><span class="s">der Mann – die Männer</span></td><td>中性单音节词</td></tr>' +
    '<tr><td>-s</td><td><span class="s">das Auto – die Autos</span><br><span class="s">das Hotel – die Hotels</span></td><td>外来词、元音结尾</td></tr>' +
    '<tr><td>不变 / 只变音</td><td><span class="s">der Lehrer – die Lehrer</span><br><span class="s">der Vater – die Väter</span><br><span class="s">das Zimmer – die Zimmer</span></td><td>-er / -el / -en 结尾的阳性、中性词</td></tr></table>' +
    '<b>n-变格（弱变化阳性名词）</b>' +
    '<table><tr><th>格</th><th>男孩</th><th>大学生</th><th>先生</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">der Junge</span></td><td><span class="s">der Student</span></td><td><span class="s">der Herr</span></td></tr>' +
    '<tr><td>Akk</td><td><span class="s">den Junge<b>n</b></span></td><td><span class="s">den Student<b>en</b></span></td><td><span class="s">den Herr<b>n</b></span></td></tr>' +
    '<tr><td>Dat</td><td><span class="s">dem Junge<b>n</b></span></td><td><span class="s">dem Student<b>en</b></span></td><td><span class="s">dem Herr<b>n</b></span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">des Junge<b>n</b></span></td><td><span class="s">des Student<b>en</b></span></td><td><span class="s">des Herr<b>n</b></span></td></tr>' +
    '<tr><td>复数</td><td><span class="s">die Jungen</span></td><td><span class="s">die Studenten</span></td><td><span class="s">die Herren</span></td></tr></table>' +
    '<div class="tip"><b>哪些词属于 n-变格：</b>表示人或动物、以 -e 结尾的阳性词（der Kollege、der Kunde、der Neffe、der Löwe）；-ent / -ant / -ist / -oge 结尾的阳性词（der Student、der Praktikant、der Polizist、der Biologe）；还有 der Mensch、der Nachbar、der Herr、der Bär。<br>' +
    '<span class="s">Ich kenne den Studenten.</span> 我认识那个大学生。<br><span class="s">Ich helfe meinem Kollegen.</span> 我帮我的同事。<br><span class="s">Sehr geehrter Herr Müller</span>（信件称呼）→ <span class="s">Ich rufe Herrn Müller an.</span><br>' +
    '特殊：der Name → den Namen，属格 <b>des Namens</b>（同类：der Gedanke、der Buchstabe）。</div>'],

  ["praes", "现在时变位：规则、加 -e-、词干变元音", "去掉 -en 得到词干，再加 -e / -st / -t / -en / -t / -en。词干以 -t / -d 结尾要多加 -e- 便于发音；一批不规则动词在 du 和 er / sie / es 时换元音。",
    '<table><tr><th>人称</th><th>wohnen 住<br>（规则）</th><th>arbeiten 工作<br>（加 -e-）</th><th>sprechen 说<br>（e → i）</th><th>fahren 乘车<br>（a → ä）</th></tr>' +
    '<tr><td>ich</td><td><span class="s">ich wohne</span></td><td><span class="s">ich arbeite</span></td><td><span class="s">ich spreche</span></td><td><span class="s">ich fahre</span></td></tr>' +
    '<tr><td>du</td><td><span class="s">du wohnst</span></td><td><span class="s">du arbeitest</span></td><td><span class="s">du sprichst</span></td><td><span class="s">du fährst</span></td></tr>' +
    '<tr><td>er / sie / es</td><td><span class="s">er wohnt</span></td><td><span class="s">er arbeitet</span></td><td><span class="s">er spricht</span></td><td><span class="s">er fährt</span></td></tr>' +
    '<tr><td>wir</td><td><span class="s">wir wohnen</span></td><td><span class="s">wir arbeiten</span></td><td><span class="s">wir sprechen</span></td><td><span class="s">wir fahren</span></td></tr>' +
    '<tr><td>ihr</td><td><span class="s">ihr wohnt</span></td><td><span class="s">ihr arbeitet</span></td><td><span class="s">ihr sprecht</span></td><td><span class="s">ihr fahrt</span></td></tr>' +
    '<tr><td>sie / Sie</td><td><span class="s">sie wohnen</span></td><td><span class="s">sie arbeiten</span></td><td><span class="s">sie sprechen</span></td><td><span class="s">sie fahren</span></td></tr></table>' +
    '<b>常用变元音动词（只有 du 和 er / sie / es 变）</b>' +
    '<table><tr><th>变化</th><th>原形</th><th>du</th><th>er / sie / es</th></tr>' +
    '<tr><td>e → i</td><td>geben 给</td><td><span class="s">du gibst</span></td><td><span class="s">er gibt</span></td></tr>' +
    '<tr><td>e → i</td><td>helfen 帮助</td><td><span class="s">du hilfst</span></td><td><span class="s">er hilft</span></td></tr>' +
    '<tr><td>e → i</td><td>essen 吃</td><td><span class="s">du isst</span></td><td><span class="s">er isst</span></td></tr>' +
    '<tr><td>e → i</td><td>nehmen 拿</td><td><span class="s">du nimmst</span></td><td><span class="s">er nimmt</span></td></tr>' +
    '<tr><td>e → i</td><td>treffen 遇见</td><td><span class="s">du triffst</span></td><td><span class="s">er trifft</span></td></tr>' +
    '<tr><td>e → i</td><td>vergessen 忘记</td><td><span class="s">du vergisst</span></td><td><span class="s">er vergisst</span></td></tr>' +
    '<tr><td>e → ie</td><td>sehen 看见</td><td><span class="s">du siehst</span></td><td><span class="s">er sieht</span></td></tr>' +
    '<tr><td>e → ie</td><td>lesen 读</td><td><span class="s">du liest</span></td><td><span class="s">er liest</span></td></tr>' +
    '<tr><td>e → ie</td><td>empfehlen 推荐</td><td><span class="s">du empfiehlst</span></td><td><span class="s">er empfiehlt</span></td></tr>' +
    '<tr><td>a → ä</td><td>schlafen 睡</td><td><span class="s">du schläfst</span></td><td><span class="s">er schläft</span></td></tr>' +
    '<tr><td>a → ä</td><td>tragen 穿、拿</td><td><span class="s">du trägst</span></td><td><span class="s">er trägt</span></td></tr>' +
    '<tr><td>a → ä</td><td>waschen 洗</td><td><span class="s">du wäschst</span></td><td><span class="s">er wäscht</span></td></tr>' +
    '<tr><td>a → ä</td><td>halten 停、握</td><td><span class="s">du hältst</span></td><td><span class="s">er hält</span></td></tr>' +
    '<tr><td>a → ä</td><td>lassen 让</td><td><span class="s">du lässt</span></td><td><span class="s">er lässt</span></td></tr>' +
    '<tr><td>au → äu</td><td>laufen 跑</td><td><span class="s">du läufst</span></td><td><span class="s">er läuft</span></td></tr>' +
    '<tr><td>特殊</td><td>wissen 知道</td><td><span class="s">du weißt</span></td><td><span class="s">ich weiß, er weiß</span></td></tr></table>' +
    '<div class="tip"><b>-t / -d 词干</b>（以及 -chn、-ffn、-tm 等）在 du / er / ihr 前加 -e-：<span class="s">du findest</span>、<span class="s">es regnet</span>、<span class="s">er öffnet</span>、<span class="s">ihr wartet</span>。但变元音的不加：du hältst、er hält。<br>' +
    '<b>-s / -ß / -z / -x 词干</b>，du 只加 -t：<span class="s">du heißt</span>、<span class="s">du tanzt</span>、<span class="s">du reist</span>、<span class="s">du sitzt</span>。<br>' +
    '<b>-eln / -ern 动词</b>：wir / sie 只加 -n（<span class="s">wir wandern</span>），-eln 的 ich 去掉 e（<span class="s">ich sammle</span>）。</div>'],

  ["sein", "sein / haben / werden 全变位", "三个最重要的不规则动词，既是实义动词，也是助动词：haben / sein 构成完成时，werden 构成将来时和被动态。口语里它们的过去式常用 Präteritum（war / hatte）。",
    '<b>现在时 Präsens</b>' +
    '<table><tr><th>人称</th><th>sein 是</th><th>haben 有</th><th>werden 变成</th></tr>' +
    '<tr><td>ich</td><td><span class="s">ich bin</span></td><td><span class="s">ich habe</span></td><td><span class="s">ich werde</span></td></tr>' +
    '<tr><td>du</td><td><span class="s">du bist</span></td><td><span class="s">du hast</span></td><td><span class="s">du wirst</span></td></tr>' +
    '<tr><td>er / sie / es</td><td><span class="s">er ist</span></td><td><span class="s">er hat</span></td><td><span class="s">er wird</span></td></tr>' +
    '<tr><td>wir</td><td><span class="s">wir sind</span></td><td><span class="s">wir haben</span></td><td><span class="s">wir werden</span></td></tr>' +
    '<tr><td>ihr</td><td><span class="s">ihr seid</span></td><td><span class="s">ihr habt</span></td><td><span class="s">ihr werdet</span></td></tr>' +
    '<tr><td>sie / Sie</td><td><span class="s">sie sind</span></td><td><span class="s">sie haben</span></td><td><span class="s">sie werden</span></td></tr></table>' +
    '<b>过去时 Präteritum</b>' +
    '<table><tr><th>人称</th><th>sein</th><th>haben</th><th>werden</th></tr>' +
    '<tr><td>ich</td><td><span class="s">ich war</span></td><td><span class="s">ich hatte</span></td><td><span class="s">ich wurde</span></td></tr>' +
    '<tr><td>du</td><td><span class="s">du warst</span></td><td><span class="s">du hattest</span></td><td><span class="s">du wurdest</span></td></tr>' +
    '<tr><td>er / sie / es</td><td><span class="s">er war</span></td><td><span class="s">er hatte</span></td><td><span class="s">er wurde</span></td></tr>' +
    '<tr><td>wir</td><td><span class="s">wir waren</span></td><td><span class="s">wir hatten</span></td><td><span class="s">wir wurden</span></td></tr>' +
    '<tr><td>ihr</td><td><span class="s">ihr wart</span></td><td><span class="s">ihr hattet</span></td><td><span class="s">ihr wurdet</span></td></tr>' +
    '<tr><td>sie / Sie</td><td><span class="s">sie waren</span></td><td><span class="s">sie hatten</span></td><td><span class="s">sie wurden</span></td></tr>' +
    '<tr><td>完成时</td><td><span class="s">ich bin gewesen</span></td><td><span class="s">ich habe gehabt</span></td><td><span class="s">ich bin geworden</span></td></tr></table>' +
    '<div class="tip"><b>werden 的三种用法：</b><br>① 变成：<span class="s">Er wird Arzt.</span> 他要当医生了。<span class="s">Es wird kalt.</span> 天变冷了。<br>② 将来时 werden + 原形（句尾）：<span class="s">Ich werde dich morgen anrufen.</span> 我明天会给你打电话。<br>③ 被动态 werden + 过去分词：<span class="s">Das Auto wird repariert.</span> 车正在被修。</div>'],

  ["modal", "情态动词：können / müssen / dürfen / sollen / wollen / mögen", "情态动词放第 2 位，实义动词用原形放句尾。单数 ich 和 er 形式相同、没有词尾，而且大多换元音；复数和规则动词一样。",
    '<table><tr><th>动词</th><th>ich / er</th><th>du</th><th>wir / sie</th><th>ihr</th><th>过去时</th></tr>' +
    '<tr><td>können 能、会</td><td><span class="s">kann</span></td><td><span class="s">kannst</span></td><td><span class="s">können</span></td><td><span class="s">könnt</span></td><td><span class="s">konnte</span></td></tr>' +
    '<tr><td>müssen 必须</td><td><span class="s">muss</span></td><td><span class="s">musst</span></td><td><span class="s">müssen</span></td><td><span class="s">müsst</span></td><td><span class="s">musste</span></td></tr>' +
    '<tr><td>dürfen 允许</td><td><span class="s">darf</span></td><td><span class="s">darfst</span></td><td><span class="s">dürfen</span></td><td><span class="s">dürft</span></td><td><span class="s">durfte</span></td></tr>' +
    '<tr><td>sollen 应该</td><td><span class="s">soll</span></td><td><span class="s">sollst</span></td><td><span class="s">sollen</span></td><td><span class="s">sollt</span></td><td><span class="s">sollte</span></td></tr>' +
    '<tr><td>wollen 想要</td><td><span class="s">will</span></td><td><span class="s">willst</span></td><td><span class="s">wollen</span></td><td><span class="s">wollt</span></td><td><span class="s">wollte</span></td></tr>' +
    '<tr><td>mögen 喜欢</td><td><span class="s">mag</span></td><td><span class="s">magst</span></td><td><span class="s">mögen</span></td><td><span class="s">mögt</span></td><td><span class="s">mochte</span></td></tr>' +
    '<tr><td>möchte 想要（礼貌）</td><td><span class="s">möchte</span></td><td><span class="s">möchtest</span></td><td><span class="s">möchten</span></td><td><span class="s">möchtet</span></td><td>用 <span class="s">wollte</span></td></tr></table>' +
    '<table><tr><th>句型</th><th>例句</th></tr>' +
    '<tr><td>主句：情态动词第 2 位，原形句尾</td><td><span class="s">Ich muss heute lange arbeiten.</span> 我今天得工作很久。</td></tr>' +
    '<tr><td>问句</td><td><span class="s">Darf ich hier parken?</span> 我可以在这儿停车吗？</td></tr>' +
    '<tr><td>从句：情态动词在最后</td><td><span class="s">Ich komme nicht, weil ich arbeiten muss.</span></td></tr>' +
    '<tr><td>过去：用 Präteritum</td><td><span class="s">Ich konnte gestern nicht kommen.</span> 我昨天来不了。</td></tr>' +
    '<tr><td>可单独用</td><td><span class="s">Ich kann Deutsch.</span> 我会德语。<span class="s">Ich mag Kaffee.</span> 我喜欢咖啡。</td></tr></table>' +
    '<div class="tip"><b>注意否定：</b><span class="s">Du musst nicht kommen.</span> = 你不必来；<span class="s">Du darfst nicht rauchen.</span> = 你不准抽烟。<br>' +
    'sollen 多指别人的要求 / 建议：<span class="s">Der Arzt sagt, ich soll mehr schlafen.</span><br>' +
    '完成时很少用，要用时情态动词保持原形（双不定式）：<span class="s">Ich habe gestern arbeiten müssen.</span></div>'],

  ["perfekt", "完成时 Perfekt：haben 还是 sein？过去分词怎么构成", "口语里讲过去的事主要用完成时：haben / sein 变位放第 2 位，过去分词（Partizip II）放句尾。大多数动词用 haben。",
    '<table><tr><th>助动词</th><th>什么动词</th><th>例句</th></tr>' +
    '<tr><td><b>sein</b></td><td>不带宾语的位置移动：gehen, kommen, fahren, fliegen, laufen, reisen</td><td><span class="s">Wir sind nach Hamburg gefahren.</span></td></tr>' +
    '<tr><td><b>sein</b></td><td>状态变化：aufstehen, einschlafen, aufwachen, werden, sterben, wachsen</td><td><span class="s">Ich bin um sechs Uhr aufgestanden.</span></td></tr>' +
    '<tr><td><b>sein</b></td><td>特例：sein, bleiben, passieren, geschehen</td><td><span class="s">Was ist passiert?</span> <span class="s">Er ist zu Hause geblieben.</span></td></tr>' +
    '<tr><td><b>haben</b></td><td>其它所有动词：带四格宾语的、反身动词、情态动词、liegen / sitzen / stehen</td><td><span class="s">Ich habe Pizza gegessen.</span> <span class="s">Ich habe mich gefreut.</span></td></tr></table>' +
    '<table><tr><th>构成</th><th>规则</th><th>例子</th></tr>' +
    '<tr><td>规则动词（弱）</td><td>ge- + 词干 + -t<br>（-t / -d 词干：-et）</td><td><span class="s">machen – gemacht</span><br><span class="s">kaufen – gekauft</span><br><span class="s">arbeiten – gearbeitet</span></td></tr>' +
    '<tr><td>不规则动词（强）</td><td>ge- + 词干（常换元音）+ -en</td><td><span class="s">sehen – gesehen</span><br><span class="s">trinken – getrunken</span><br><span class="s">schreiben – geschrieben</span></td></tr>' +
    '<tr><td>混合动词</td><td>ge- + 换元音 + -t</td><td><span class="s">bringen – gebracht</span><br><span class="s">denken – gedacht</span><br><span class="s">wissen – gewusst</span></td></tr>' +
    '<tr><td>可分动词</td><td>前缀 + ge + …</td><td><span class="s">einkaufen – eingekauft</span><br><span class="s">anrufen – angerufen</span><br><span class="s">aufstehen – aufgestanden</span></td></tr>' +
    '<tr><td>不可分前缀<br>be- ge- er- ver- zer- ent- emp- miss-</td><td><b>不加 ge-</b></td><td><span class="s">besuchen – besucht</span><br><span class="s">verstehen – verstanden</span><br><span class="s">bekommen – bekommen</span><br><span class="s">erzählen – erzählt</span></td></tr>' +
    '<tr><td>-ieren 动词</td><td><b>不加 ge-</b>，词尾 -t</td><td><span class="s">studieren – studiert</span><br><span class="s">telefonieren – telefoniert</span><br><span class="s">passieren – passiert</span></td></tr></table>' +
    '<div class="tip">从句里助动词在最后：<span class="s">Ich bin müde, weil ich lange gearbeitet habe.</span><br>' +
    'fahren 带宾语时用 haben：<span class="s">Ich habe das Auto in die Garage gefahren.</span><br>' +
    '德国南部和奥地利 liegen / sitzen / stehen 也常用 sein（ich bin gesessen），标准德语用 haben。</div>'],

  ["irreg", "常用不规则动词三形表", "原形 – 过去时 Präteritum – 过去分词。分词前写 ist 的用 sein 构成完成时，写 hat 的用 haben。点击可听。",
    '<table><tr><th>原形</th><th>过去时</th><th>完成时</th><th>意思</th></tr>' +
    '<tr><td><span class="s">gehen</span></td><td><span class="s">ging</span></td><td><span class="s">ist gegangen</span></td><td>走、去</td></tr>' +
    '<tr><td><span class="s">kommen</span></td><td><span class="s">kam</span></td><td><span class="s">ist gekommen</span></td><td>来</td></tr>' +
    '<tr><td><span class="s">fahren</span></td><td><span class="s">fuhr</span></td><td><span class="s">ist gefahren</span></td><td>乘车、开车</td></tr>' +
    '<tr><td><span class="s">fliegen</span></td><td><span class="s">flog</span></td><td><span class="s">ist geflogen</span></td><td>飞</td></tr>' +
    '<tr><td><span class="s">laufen</span></td><td><span class="s">lief</span></td><td><span class="s">ist gelaufen</span></td><td>跑、步行</td></tr>' +
    '<tr><td><span class="s">bleiben</span></td><td><span class="s">blieb</span></td><td><span class="s">ist geblieben</span></td><td>留下</td></tr>' +
    '<tr><td><span class="s">sein</span></td><td><span class="s">war</span></td><td><span class="s">ist gewesen</span></td><td>是</td></tr>' +
    '<tr><td><span class="s">werden</span></td><td><span class="s">wurde</span></td><td><span class="s">ist geworden</span></td><td>变成</td></tr>' +
    '<tr><td><span class="s">aufstehen</span></td><td><span class="s">stand auf</span></td><td><span class="s">ist aufgestanden</span></td><td>起床</td></tr>' +
    '<tr><td><span class="s">schwimmen</span></td><td><span class="s">schwamm</span></td><td><span class="s">ist geschwommen</span></td><td>游泳</td></tr>' +
    '<tr><td><span class="s">sterben</span></td><td><span class="s">starb</span></td><td><span class="s">ist gestorben</span></td><td>死</td></tr>' +
    '<tr><td><span class="s">haben</span></td><td><span class="s">hatte</span></td><td><span class="s">hat gehabt</span></td><td>有</td></tr>' +
    '<tr><td><span class="s">essen</span></td><td><span class="s">aß</span></td><td><span class="s">hat gegessen</span></td><td>吃</td></tr>' +
    '<tr><td><span class="s">trinken</span></td><td><span class="s">trank</span></td><td><span class="s">hat getrunken</span></td><td>喝</td></tr>' +
    '<tr><td><span class="s">sehen</span></td><td><span class="s">sah</span></td><td><span class="s">hat gesehen</span></td><td>看见</td></tr>' +
    '<tr><td><span class="s">lesen</span></td><td><span class="s">las</span></td><td><span class="s">hat gelesen</span></td><td>读</td></tr>' +
    '<tr><td><span class="s">sprechen</span></td><td><span class="s">sprach</span></td><td><span class="s">hat gesprochen</span></td><td>说</td></tr>' +
    '<tr><td><span class="s">schreiben</span></td><td><span class="s">schrieb</span></td><td><span class="s">hat geschrieben</span></td><td>写</td></tr>' +
    '<tr><td><span class="s">nehmen</span></td><td><span class="s">nahm</span></td><td><span class="s">hat genommen</span></td><td>拿、乘</td></tr>' +
    '<tr><td><span class="s">geben</span></td><td><span class="s">gab</span></td><td><span class="s">hat gegeben</span></td><td>给</td></tr>' +
    '<tr><td><span class="s">finden</span></td><td><span class="s">fand</span></td><td><span class="s">hat gefunden</span></td><td>找到、觉得</td></tr>' +
    '<tr><td><span class="s">helfen</span></td><td><span class="s">half</span></td><td><span class="s">hat geholfen</span></td><td>帮助</td></tr>' +
    '<tr><td><span class="s">treffen</span></td><td><span class="s">traf</span></td><td><span class="s">hat getroffen</span></td><td>遇见</td></tr>' +
    '<tr><td><span class="s">schlafen</span></td><td><span class="s">schlief</span></td><td><span class="s">hat geschlafen</span></td><td>睡觉</td></tr>' +
    '<tr><td><span class="s">tragen</span></td><td><span class="s">trug</span></td><td><span class="s">hat getragen</span></td><td>穿、拿</td></tr>' +
    '<tr><td><span class="s">waschen</span></td><td><span class="s">wusch</span></td><td><span class="s">hat gewaschen</span></td><td>洗</td></tr>' +
    '<tr><td><span class="s">beginnen</span></td><td><span class="s">begann</span></td><td><span class="s">hat begonnen</span></td><td>开始</td></tr>' +
    '<tr><td><span class="s">vergessen</span></td><td><span class="s">vergaß</span></td><td><span class="s">hat vergessen</span></td><td>忘记</td></tr>' +
    '<tr><td><span class="s">verstehen</span></td><td><span class="s">verstand</span></td><td><span class="s">hat verstanden</span></td><td>明白</td></tr>' +
    '<tr><td><span class="s">anrufen</span></td><td><span class="s">rief an</span></td><td><span class="s">hat angerufen</span></td><td>打电话</td></tr>' +
    '<tr><td><span class="s">liegen</span></td><td><span class="s">lag</span></td><td><span class="s">hat gelegen</span></td><td>躺、位于</td></tr>' +
    '<tr><td><span class="s">sitzen</span></td><td><span class="s">saß</span></td><td><span class="s">hat gesessen</span></td><td>坐</td></tr>' +
    '<tr><td><span class="s">stehen</span></td><td><span class="s">stand</span></td><td><span class="s">hat gestanden</span></td><td>站</td></tr>' +
    '<tr><td><span class="s">bringen</span></td><td><span class="s">brachte</span></td><td><span class="s">hat gebracht</span></td><td>带来</td></tr>' +
    '<tr><td><span class="s">denken</span></td><td><span class="s">dachte</span></td><td><span class="s">hat gedacht</span></td><td>想</td></tr>' +
    '<tr><td><span class="s">kennen</span></td><td><span class="s">kannte</span></td><td><span class="s">hat gekannt</span></td><td>认识</td></tr>' +
    '<tr><td><span class="s">wissen</span></td><td><span class="s">wusste</span></td><td><span class="s">hat gewusst</span></td><td>知道</td></tr></table>' +
    '<div class="tip">fahren / fliegen 带四格宾语时用 haben：<span class="s">Er hat das Auto gefahren.</span><br>最后四个（bringen 到 wissen）是混合动词：换元音，但词尾像规则动词 -te / -t。</div>'],

  ["praet", "过去时 Präteritum：什么时候用", "口语讲过去一般用完成时；但 sein、haben、情态动词（还有 wissen、es gibt）口语里也直接用 Präteritum。书面叙述、新闻、小说、童话主要用 Präteritum。",
    '<table><tr><th>场合</th><th>例句</th></tr>' +
    '<tr><td>口语：sein / haben</td><td><span class="s">Ich war gestern krank.</span> 我昨天病了。<br><span class="s">Ich hatte keine Zeit.</span> 我没时间。</td></tr>' +
    '<tr><td>口语：情态动词</td><td><span class="s">Ich konnte nicht schlafen.</span> 我睡不着。<br><span class="s">Wir mussten lange warten.</span> 我们得等很久。</td></tr>' +
    '<tr><td>口语：wissen / es gibt</td><td><span class="s">Das wusste ich nicht.</span> 这我不知道。<br><span class="s">Es gab viel zu tun.</span> 有很多事要做。</td></tr>' +
    '<tr><td>口语：其它动词 → 完成时</td><td><span class="s">Ich habe gestern Fußball gespielt.</span></td></tr>' +
    '<tr><td>书面叙述</td><td><span class="s">Es war einmal ein König.</span> 从前有个国王。<br><span class="s">Er öffnete die Tür und ging hinaus.</span></td></tr></table>' +
    '<b>Präteritum 词尾（ich 和 er 相同，没有词尾）</b>' +
    '<table><tr><th>人称</th><th>规则 machen<br>（词干 + -te）</th><th>不规则 gehen<br>（换元音）</th></tr>' +
    '<tr><td>ich</td><td><span class="s">ich machte</span></td><td><span class="s">ich ging</span></td></tr>' +
    '<tr><td>du</td><td><span class="s">du machtest</span></td><td><span class="s">du gingst</span></td></tr>' +
    '<tr><td>er / sie / es</td><td><span class="s">er machte</span></td><td><span class="s">er ging</span></td></tr>' +
    '<tr><td>wir</td><td><span class="s">wir machten</span></td><td><span class="s">wir gingen</span></td></tr>' +
    '<tr><td>ihr</td><td><span class="s">ihr machtet</span></td><td><span class="s">ihr gingt</span></td></tr>' +
    '<tr><td>sie / Sie</td><td><span class="s">sie machten</span></td><td><span class="s">sie gingen</span></td></tr></table>' +
    '<div class="tip">-t / -d 词干加 -ete：<span class="s">ich arbeitete</span>、<span class="s">er wartete</span>。<br>' +
    '<b>过去完成时 Plusquamperfekt</b>（比过去更早）：hatte / war + 过去分词：<span class="s">Nachdem ich gegessen hatte, ging ich spazieren.</span> 吃完饭后我去散步了。</div>'],

  ["trenn", "可分动词与不可分前缀", "可分前缀（重读）在主句里跑到句尾；在从句、情态动词句里和动词连写；完成时 ge 夹在中间；zu 不定式 zu 也夹在中间。不可分前缀（不重读）永远不分开。",
    '<table><tr><th>位置</th><th>aufstehen 起床（可分）</th></tr>' +
    '<tr><td>主句现在时</td><td><span class="s">Ich stehe um sieben Uhr auf.</span></td></tr>' +
    '<tr><td>过去时</td><td><span class="s">Ich stand um sieben Uhr auf.</span></td></tr>' +
    '<tr><td>情态动词</td><td><span class="s">Ich muss um sieben Uhr aufstehen.</span></td></tr>' +
    '<tr><td>从句</td><td><span class="s">…, weil ich um sieben Uhr aufstehe.</span></td></tr>' +
    '<tr><td>完成时（ge 在中间）</td><td><span class="s">Ich bin um sieben Uhr aufgestanden.</span></td></tr>' +
    '<tr><td>zu 不定式（zu 在中间）</td><td><span class="s">Ich habe keine Lust, früh aufzustehen.</span></td></tr>' +
    '<tr><td>命令式</td><td><span class="s">Steh auf!</span></td></tr></table>' +
    '<table><tr><th>位置</th><th>verstehen 明白（不可分）</th></tr>' +
    '<tr><td>主句</td><td><span class="s">Ich verstehe das nicht.</span></td></tr>' +
    '<tr><td>完成时（不加 ge）</td><td><span class="s">Ich habe das nicht verstanden.</span></td></tr>' +
    '<tr><td>zu 不定式</td><td><span class="s">Ich versuche, das zu verstehen.</span></td></tr></table>' +
    '<div class="tip"><b>常见可分前缀：</b>ab- an- auf- aus- ein- mit- nach- vor- zu- zurück- weg- los- fern- her- hin- vorbei- zusammen-（如 anrufen、einkaufen、mitkommen、fernsehen、zurückkommen）。<br>' +
    '<b>不可分前缀：</b>be- emp- ent- er- ge- miss- ver- zer-（如 bekommen、empfehlen、erklären、gefallen、vergessen）。<br>' +
    '<b>两可的前缀</b> über- um- unter- durch- wieder-：可分时重读前缀、意思较具体，不可分时重读词干：<span class="s">Ich ziehe nächste Woche um.</span> 我下周搬家（úmziehen）；<span class="s">Ich übersetze den Text.</span> 我翻译这篇文章（übersétzen）。</div>'],

  ["order", "语序：动词第二位、框形结构、从句动词句尾", "主句变位动词永远在第 2 位，第 1 位放什么都行；第二个动词部分（原形、分词、可分前缀）放句尾，形成「框」。从句里变位动词放最后。",
    '<table><tr><th>第 1 位</th><th>动词 ①</th><th>中场</th><th>句尾 ②</th></tr>' +
    '<tr><td>Ich</td><td><b>gehe</b></td><td>heute ins Kino.</td><td></td></tr>' +
    '<tr><td>Heute</td><td><b>gehe</b></td><td>ich ins Kino.</td><td></td></tr>' +
    '<tr><td>Ich</td><td><b>will</b></td><td>heute ins Kino</td><td><b>gehen</b>.</td></tr>' +
    '<tr><td>Gestern</td><td><b>bin</b></td><td>ich ins Kino</td><td><b>gegangen</b>.</td></tr>' +
    '<tr><td>Der Film</td><td><b>fängt</b></td><td>um acht Uhr</td><td><b>an</b>.</td></tr>' +
    '<tr><td>Wann</td><td><b>fängt</b></td><td>der Film</td><td><b>an</b>?</td></tr>' +
    '<tr><td>（空）</td><td><b>Kommst</b></td><td>du heute</td><td><b>mit</b>?</td></tr></table>' +
    '<table><tr><th>结构</th><th>例句</th></tr>' +
    '<tr><td>倒装：其它成分在第 1 位，主语放动词后</td><td><span class="s">Morgen fahre ich nach Berlin.</span></td></tr>' +
    '<tr><td>从句：变位动词在最后</td><td><span class="s">Ich weiß, dass er heute kommt.</span></td></tr>' +
    '<tr><td>从句 + 情态动词 / 完成时</td><td><span class="s">…, weil ich nicht kommen kann.</span><br><span class="s">…, dass er schon gegangen ist.</span></td></tr>' +
    '<tr><td>从句在前 = 占第 1 位，主句动词紧跟</td><td><span class="s">Wenn ich Zeit habe, komme ich mit.</span></td></tr></table>' +
    '<div class="tip"><b>中场顺序 TeKaMoLo：</b>时间 Temporal → 原因 Kausal → 方式 Modal → 地点 Lokal：<br><span class="s">Ich fahre morgen wegen der Arbeit mit dem Zug nach Berlin.</span> 我明天因为工作坐火车去柏林。<br>' +
    '代词宾语紧靠动词、排在名词前：<span class="s">Heute gebe ich es dir.</span><br>und / aber / oder / denn / sondern 不占位置，后面照常（见「连词」）。</div>'],

  ["konj", "连词：并列 / 从属 / 副词连接，后面语序各不同", "并列连词不占位置，后面正常语序；从属连词引导从句，动词放最后；副词连接词占第 1 位，后面马上接动词（倒装）。",
    '<table><tr><th>连词</th><th>例句</th></tr>' +
    '<tr><th>① 并列（第 0 位）</th><th>主语 + 动词 …</th></tr>' +
    '<tr><td>und 和</td><td><span class="s">Ich koche und du spülst.</span></td></tr>' +
    '<tr><td>aber 但是</td><td><span class="s">Das Hotel ist schön, aber es ist teuer.</span></td></tr>' +
    '<tr><td>oder 或者</td><td><span class="s">Trinkst du Kaffee oder möchtest du Tee?</span></td></tr>' +
    '<tr><td>denn 因为</td><td><span class="s">Ich gehe nach Hause, denn ich bin müde.</span></td></tr>' +
    '<tr><td>sondern 而是（前面有否定）</td><td><span class="s">Er kommt nicht heute, sondern morgen.</span></td></tr>' +
    '<tr><th>② 从属（动词句尾）</th><th>…, 连词 + 主语 … 动词</th></tr>' +
    '<tr><td>weil 因为</td><td><span class="s">Ich lerne Deutsch, weil ich in Berlin arbeiten möchte.</span></td></tr>' +
    '<tr><td>dass 引出「……这件事」</td><td><span class="s">Ich glaube, dass er recht hat.</span></td></tr>' +
    '<tr><td>wenn 如果 / 每当</td><td><span class="s">Wenn es regnet, bleiben wir zu Hause.</span></td></tr>' +
    '<tr><td>als 当……时（过去一次）</td><td><span class="s">Als ich ein Kind war, wohnte ich in Shanghai.</span></td></tr>' +
    '<tr><td>ob 是否</td><td><span class="s">Weißt du, ob der Laden heute offen ist?</span></td></tr>' +
    '<tr><td>obwohl 虽然</td><td><span class="s">Obwohl er krank ist, geht er zur Arbeit.</span></td></tr>' +
    '<tr><td>damit 为了（主语不同）</td><td><span class="s">Ich spreche langsam, damit du mich verstehst.</span></td></tr>' +
    '<tr><td>bevor 在……之前</td><td><span class="s">Bevor ich frühstücke, dusche ich.</span></td></tr>' +
    '<tr><td>nachdem 在……之后</td><td><span class="s">Nachdem ich gegessen hatte, ging ich spazieren.</span></td></tr>' +
    '<tr><td>während 在……期间</td><td><span class="s">Während ich koche, hört er Musik.</span></td></tr>' +
    '<tr><td>bis 直到</td><td><span class="s">Ich warte, bis du kommst.</span></td></tr>' +
    '<tr><th>③ 副词连接（第 1 位）</th><th>…, 副词 + 动词 + 主语 …</th></tr>' +
    '<tr><td>deshalb / deswegen 所以</td><td><span class="s">Ich bin müde, deshalb gehe ich früh ins Bett.</span></td></tr>' +
    '<tr><td>trotzdem 尽管如此</td><td><span class="s">Es regnet, trotzdem gehen wir spazieren.</span></td></tr>' +
    '<tr><td>dann 然后</td><td><span class="s">Zuerst kaufe ich ein, dann koche ich.</span></td></tr>' +
    '<tr><td>sonst 否则</td><td><span class="s">Beeil dich, sonst verpasst du den Zug.</span></td></tr>' +
    '<tr><td>außerdem 此外</td><td><span class="s">Die Wohnung ist groß, außerdem ist sie billig.</span></td></tr></table>' +
    '<div class="tip"><b>wenn 还是 als：</b>过去发生一次 → als；现在、将来、或过去反复 → wenn（<span class="s">Immer wenn ich ihn besuchte, kochte er.</span>）。<br>' +
    '<b>um … zu</b>（主语相同时代替 damit）：<span class="s">Ich lerne Deutsch, um in Deutschland zu arbeiten.</span><br>' +
    '<b>成对连词：</b>entweder … oder（要么……要么）、sowohl … als auch（既……又）、weder … noch（既不……也不）、nicht nur … sondern auch（不但……而且）。</div>'],

  ["praep", "介词：支配四格 / 三格 / 双向 / 二格", "每个介词规定后面名词的格，要整组背。双向介词问 Wo?（在哪，静止）用三格，问 Wohin?（去哪，方向）用四格。",
    '<table><tr><th>支配</th><th>介词</th><th>例子</th></tr>' +
    '<tr><td><b>四格 Akk</b></td><td>durch 穿过、für 为了、gegen 反对 / 大约、ohne 没有、um 围绕 / 在几点、bis 直到、entlang 沿着（后置）</td><td><span class="s">für dich</span>、<span class="s">ohne mich</span>、<span class="s">durch den Park</span>、<span class="s">um acht Uhr</span>、<span class="s">bis Montag</span>、<span class="s">den Fluss entlang</span></td></tr>' +
    '<tr><td><b>三格 Dat</b></td><td>aus 从……出来、bei 在……那里、mit 和 / 乘、nach 去 / 之后、seit 自从、von 从 / 的、zu 去、gegenüber 对面、ab 从……起、außer 除了</td><td><span class="s">aus China</span>、<span class="s">bei meiner Mutter</span>、<span class="s">mit dem Bus</span>、<span class="s">nach der Arbeit</span>、<span class="s">seit einem Jahr</span>、<span class="s">zum Arzt</span>、<span class="s">gegenüber dem Bahnhof</span></td></tr>' +
    '<tr><td><b>双向</b><br>Wo? → Dat<br>Wohin? → Akk</td><td>an 在边上、auf 在上面（接触）、hinter 后面、in 里面、neben 旁边、über 上方、unter 下面、vor 前面、zwischen 之间</td><td><span class="s">Das Buch liegt auf dem Tisch.</span>（Wo?）<br><span class="s">Ich lege das Buch auf den Tisch.</span>（Wohin?）</td></tr>' +
    '<tr><td><b>二格 Gen</b></td><td>wegen 因为、trotz 尽管、während 在……期间、statt / anstatt 代替、innerhalb 之内、außerhalb 之外</td><td><span class="s">wegen des Wetters</span>、<span class="s">trotz des Regens</span>、<span class="s">während der Arbeit</span>、<span class="s">statt eines Autos</span></td></tr></table>' +
    '<table><tr><th>缩写</th><th>=</th><th>例</th></tr>' +
    '<tr><td><b>am</b></td><td>an dem</td><td><span class="s">am Montag</span>、<span class="s">am Fenster</span></td></tr>' +
    '<tr><td><b>ans</b></td><td>an das</td><td><span class="s">ans Meer</span></td></tr>' +
    '<tr><td><b>im</b></td><td>in dem</td><td><span class="s">im Sommer</span>、<span class="s">im Büro</span></td></tr>' +
    '<tr><td><b>ins</b></td><td>in das</td><td><span class="s">ins Kino</span></td></tr>' +
    '<tr><td><b>zum</b></td><td>zu dem</td><td><span class="s">zum Bahnhof</span></td></tr>' +
    '<tr><td><b>zur</b></td><td>zu der</td><td><span class="s">zur Arbeit</span>、<span class="s">zur Schule</span></td></tr>' +
    '<tr><td><b>beim</b></td><td>bei dem</td><td><span class="s">beim Arzt</span>、<span class="s">beim Essen</span></td></tr>' +
    '<tr><td><b>vom</b></td><td>von dem</td><td><span class="s">vom Bahnhof</span></td></tr></table>' +
    '<div class="tip"><b>动词成对：</b>liegen（躺着，Wo）↔ legen（放平，Wohin）；stehen ↔ stellen；sitzen ↔ setzen；hängen ↔ hängen。<br>' +
    '<b>去哪里：</b>不带冠词的城市 / 国家用 nach（<span class="s">nach Berlin</span>、<span class="s">nach Hause</span>）；带冠词的国家用 in + Akk（<span class="s">in die Schweiz</span>）；去人那里 / 机构用 zu（<span class="s">zu meiner Freundin</span>、<span class="s">zur Post</span>）。<span class="s">zu Hause</span> = 在家。<br>' +
    '<b>时间：</b>an / in / vor 表示时间时用三格：<span class="s">am Abend</span>、<span class="s">im Mai</span>、<span class="s">vor einer Woche</span>（一周前）。<br>口语里 wegen / trotz 常跟三格（wegen dem Wetter），书面用二格。</div>'],

  ["reflex", "反身动词 + 反身代词（mich / mir）", "动作作用到主语自己身上时用反身代词。只有第三人称和 Sie 用 sich，其它和人称代词一样。句子里已经有四格宾语时，反身代词用三格。",
    '<table><tr><th>人称</th><th>四格</th><th>三格</th><th>例（四格）</th><th>例（三格 + 宾语）</th></tr>' +
    '<tr><td>ich</td><td>mich</td><td>mir</td><td><span class="s">Ich wasche mich.</span></td><td><span class="s">Ich wasche mir die Hände.</span></td></tr>' +
    '<tr><td>du</td><td>dich</td><td>dir</td><td><span class="s">Du freust dich.</span></td><td><span class="s">Du putzt dir die Zähne.</span></td></tr>' +
    '<tr><td>er / sie / es</td><td>sich</td><td>sich</td><td><span class="s">Er setzt sich.</span></td><td><span class="s">Er kauft sich ein Auto.</span></td></tr>' +
    '<tr><td>wir</td><td>uns</td><td>uns</td><td><span class="s">Wir treffen uns.</span></td><td><span class="s">Wir sehen uns den Film an.</span></td></tr>' +
    '<tr><td>ihr</td><td>euch</td><td>euch</td><td><span class="s">Ihr beeilt euch.</span></td><td><span class="s">Ihr macht euch Sorgen.</span></td></tr>' +
    '<tr><td>sie / Sie</td><td>sich</td><td>sich</td><td><span class="s">Sie interessieren sich für Musik.</span></td><td><span class="s">Sie merken sich die Nummer.</span></td></tr></table>' +
    '<table><tr><th>常用反身动词</th><th>例句</th></tr>' +
    '<tr><td>sich freuen auf + Akk 期待 / über + Akk 为……高兴</td><td><span class="s">Ich freue mich auf das Wochenende.</span></td></tr>' +
    '<tr><td>sich interessieren für 对……感兴趣</td><td><span class="s">Ich interessiere mich für Geschichte.</span></td></tr>' +
    '<tr><td>sich erinnern an 记得</td><td><span class="s">Erinnerst du dich an mich?</span></td></tr>' +
    '<tr><td>sich ärgern über 对……生气</td><td><span class="s">Er ärgert sich über den Lärm.</span></td></tr>' +
    '<tr><td>sich kümmern um 照顾</td><td><span class="s">Sie kümmert sich um die Kinder.</span></td></tr>' +
    '<tr><td>sich gewöhnen an 习惯</td><td><span class="s">Ich habe mich an das Wetter gewöhnt.</span></td></tr>' +
    '<tr><td>sich fühlen 感觉</td><td><span class="s">Ich fühle mich nicht gut.</span></td></tr>' +
    '<tr><td>sich beeilen 赶紧</td><td><span class="s">Beeil dich!</span></td></tr>' +
    '<tr><td>sich vorstellen 自我介绍（Akk）/ 想象（Dat）</td><td><span class="s">Darf ich mich vorstellen?</span><br><span class="s">Das kann ich mir vorstellen.</span></td></tr></table>' +
    '<div class="tip">完成时一律用 haben：<span class="s">Ich habe mich sehr gefreut.</span><br>' +
    '倒装时，主语是代词 → 反身代词在主语后：<span class="s">Heute freue ich mich.</span>；主语是名词 → 反身代词常在主语前：<span class="s">Heute freut sich mein Bruder.</span></div>'],

  ["imp", "命令式：du / ihr / Sie", "du：去掉现在时的 -st（和人称）；ihr：就是 ihr 的现在时形式去掉 ihr；Sie：原形 + Sie。可分前缀放句尾；加 bitte / mal / doch 更客气。",
    '<table><tr><th>原形</th><th>du</th><th>ihr</th><th>Sie</th></tr>' +
    '<tr><td>kommen 来</td><td><span class="s">Komm!</span></td><td><span class="s">Kommt!</span></td><td><span class="s">Kommen Sie!</span></td></tr>' +
    '<tr><td>warten 等</td><td><span class="s">Warte!</span></td><td><span class="s">Wartet!</span></td><td><span class="s">Warten Sie!</span></td></tr>' +
    '<tr><td>fahren 开车</td><td><span class="s">Fahr langsam!</span></td><td><span class="s">Fahrt langsam!</span></td><td><span class="s">Fahren Sie langsam!</span></td></tr>' +
    '<tr><td>nehmen 拿</td><td><span class="s">Nimm!</span></td><td><span class="s">Nehmt!</span></td><td><span class="s">Nehmen Sie!</span></td></tr>' +
    '<tr><td>lesen 读</td><td><span class="s">Lies!</span></td><td><span class="s">Lest!</span></td><td><span class="s">Lesen Sie!</span></td></tr>' +
    '<tr><td>anrufen 打电话</td><td><span class="s">Ruf mich an!</span></td><td><span class="s">Ruft mich an!</span></td><td><span class="s">Rufen Sie mich an!</span></td></tr>' +
    '<tr><td>sich setzen 坐下</td><td><span class="s">Setz dich!</span></td><td><span class="s">Setzt euch!</span></td><td><span class="s">Setzen Sie sich!</span></td></tr>' +
    '<tr><td>sein 是</td><td><span class="s">Sei ruhig!</span></td><td><span class="s">Seid ruhig!</span></td><td><span class="s">Seien Sie ruhig!</span></td></tr>' +
    '<tr><td>haben 有</td><td><span class="s">Hab keine Angst!</span></td><td><span class="s">Habt keine Angst!</span></td><td><span class="s">Haben Sie keine Angst!</span></td></tr></table>' +
    '<div class="tip"><b>du 命令式要点：</b>a → ä 的变音<b>不</b>保留（fahren → Fahr!，不是 Fähr!）；e → i / ie 保留（Gib! Nimm! Hilf! Iss! Lies! Sieh!）。<br>' +
    '词干以 -t / -d / -ig / -chn、-ffn、-tm 等结尾要加 -e：<span class="s">Warte!</span>、<span class="s">Öffne die Tür!</span>、<span class="s">Entschuldige!</span>；其它的 -e 可加可不加（Komm! / Komme!）。<br>' +
    '「我们一起……吧」：原形 + wir：<span class="s">Gehen wir!</span><br>客气点：<span class="s">Komm doch mal vorbei!</span> <span class="s">Bitte warten Sie hier.</span></div>'],

  ["komp", "比较级 / 最高级", "比较级：形容词 + -er；最高级：am + -sten（作谓语、副词时），或 der / die / das + -ste + 词尾（放名词前）。很多单音节词要变音。",
    '<table><tr><th>类型</th><th>原级</th><th>比较级</th><th>最高级</th></tr>' +
    '<tr><td>规则</td><td><span class="s">klein</span> 小</td><td><span class="s">kleiner</span></td><td><span class="s">am kleinsten</span></td></tr>' +
    '<tr><td>规则</td><td><span class="s">schnell</span> 快</td><td><span class="s">schneller</span></td><td><span class="s">am schnellsten</span></td></tr>' +
    '<tr><td>-t / -d / -s / -ß / -z / -sch 结尾：-esten</td><td><span class="s">heiß</span> 热</td><td><span class="s">heißer</span></td><td><span class="s">am heißesten</span></td></tr>' +
    '<tr><td>同上</td><td><span class="s">interessant</span> 有趣</td><td><span class="s">interessanter</span></td><td><span class="s">am interessantesten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">alt</span> 老</td><td><span class="s">älter</span></td><td><span class="s">am ältesten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">jung</span> 年轻</td><td><span class="s">jünger</span></td><td><span class="s">am jüngsten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">groß</span> 大</td><td><span class="s">größer</span></td><td><span class="s">am größten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">kalt</span> 冷</td><td><span class="s">kälter</span></td><td><span class="s">am kältesten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">warm</span> 暖</td><td><span class="s">wärmer</span></td><td><span class="s">am wärmsten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">lang</span> 长</td><td><span class="s">länger</span></td><td><span class="s">am längsten</span></td></tr>' +
    '<tr><td>变音</td><td><span class="s">kurz</span> 短</td><td><span class="s">kürzer</span></td><td><span class="s">am kürzesten</span></td></tr>' +
    '<tr><td>-el / -er 去 e</td><td><span class="s">teuer</span> 贵</td><td><span class="s">teurer</span></td><td><span class="s">am teuersten</span></td></tr>' +
    '<tr><td>-el / -er 去 e</td><td><span class="s">dunkel</span> 暗</td><td><span class="s">dunkler</span></td><td><span class="s">am dunkelsten</span></td></tr>' +
    '<tr><td><b>不规则</b></td><td><span class="s">gut</span> 好</td><td><span class="s">besser</span></td><td><span class="s">am besten</span></td></tr>' +
    '<tr><td><b>不规则</b></td><td><span class="s">viel</span> 多</td><td><span class="s">mehr</span></td><td><span class="s">am meisten</span></td></tr>' +
    '<tr><td><b>不规则</b></td><td><span class="s">gern</span> 乐意</td><td><span class="s">lieber</span></td><td><span class="s">am liebsten</span></td></tr>' +
    '<tr><td><b>不规则</b></td><td><span class="s">hoch</span> 高</td><td><span class="s">höher</span></td><td><span class="s">am höchsten</span></td></tr>' +
    '<tr><td><b>不规则</b></td><td><span class="s">nah</span> 近</td><td><span class="s">näher</span></td><td><span class="s">am nächsten</span></td></tr>' +
    '<tr><td><b>不规则</b></td><td><span class="s">bald</span> 不久</td><td><span class="s">eher</span></td><td><span class="s">am ehesten</span></td></tr></table>' +
    '<table><tr><th>句型</th><th>例句</th></tr>' +
    '<tr><td>一样：so … wie</td><td><span class="s">Er ist so groß wie ich.</span> 他和我一样高。</td></tr>' +
    '<tr><td>比……更：比较级 + als</td><td><span class="s">Er ist größer als ich.</span> 他比我高。</td></tr>' +
    '<tr><td>最：am …sten</td><td><span class="s">Im Juli ist es am heißesten.</span></td></tr>' +
    '<tr><td>名词前要加形容词词尾</td><td><span class="s">Ich möchte ein größeres Zimmer.</span><br><span class="s">Das ist der schnellste Zug.</span></td></tr>' +
    '<tr><td>越来越：immer + 比较级</td><td><span class="s">Es wird immer kälter.</span></td></tr>' +
    '<tr><td>越……越：je … desto</td><td><span class="s">Je mehr ich übe, desto besser spreche ich.</span></td></tr>' +
    '<tr><td>gern / lieber / am liebsten 表示喜好</td><td><span class="s">Ich trinke gern Tee, lieber Kaffee, am liebsten Wasser.</span></td></tr></table>' +
    '<div class="tip">注意：groß → am grö<b>ß</b>ten（不加 e）；mehr 和 weniger 不加词尾：<span class="s">mehr Zeit</span>、<span class="s">weniger Geld</span>。</div>'],

  ["neg", "否定：nicht 还是 kein？nicht 放哪里？", "kein 否定「不定冠词 + 名词」或「无冠词名词」，词尾同 ein；其它一切（动词、形容词、带定冠词 / 物主冠词的名词、人名）用 nicht。",
    '<table><tr><th>用什么</th><th>肯定</th><th>否定</th></tr>' +
    '<tr><td><b>kein</b>：ein + 名词</td><td><span class="s">Ich habe ein Auto.</span></td><td><span class="s">Ich habe kein Auto.</span></td></tr>' +
    '<tr><td><b>kein</b>：无冠词名词</td><td><span class="s">Ich habe Zeit.</span></td><td><span class="s">Ich habe keine Zeit.</span></td></tr>' +
    '<tr><td><b>kein</b>：复数</td><td><span class="s">Wir haben Kinder.</span></td><td><span class="s">Wir haben keine Kinder.</span></td></tr>' +
    '<tr><td><b>nicht</b>：动词</td><td><span class="s">Ich komme.</span></td><td><span class="s">Ich komme nicht.</span></td></tr>' +
    '<tr><td><b>nicht</b>：形容词</td><td><span class="s">Das ist teuer.</span></td><td><span class="s">Das ist nicht teuer.</span></td></tr>' +
    '<tr><td><b>nicht</b>：定冠词 / 物主冠词名词</td><td><span class="s">Ich finde den Schlüssel.</span></td><td><span class="s">Ich finde den Schlüssel nicht.</span></td></tr>' +
    '<tr><td><b>nicht</b>：sein + 物主冠词</td><td><span class="s">Das ist mein Handy.</span></td><td><span class="s">Das ist nicht mein Handy.</span></td></tr></table>' +
    '<table><tr><th>nicht 的位置</th><th>例句</th></tr>' +
    '<tr><td>否定整句：尽量靠后，在宾语、时间之后</td><td><span class="s">Ich kaufe das Buch heute nicht.</span></td></tr>' +
    '<tr><td>但在句尾的第二个动词、可分前缀之前</td><td><span class="s">Ich kann heute nicht kommen.</span><br><span class="s">Er ruft mich nicht an.</span><br><span class="s">Ich habe ihn nicht gesehen.</span></td></tr>' +
    '<tr><td>在形容词、方式副词、介词短语（地点 / 方向）之前</td><td><span class="s">Er fährt nicht schnell.</span><br><span class="s">Ich wohne nicht in Berlin.</span><br><span class="s">Ich gehe nicht ins Kino.</span></td></tr>' +
    '<tr><td>只否定某个成分：放在它前面，常配 sondern</td><td><span class="s">Ich komme nicht heute, sondern morgen.</span><br><span class="s">Nicht ich, sondern mein Bruder hat angerufen.</span></td></tr></table>' +
    '<div class="tip"><b>其它否定词：</b>nichts 什么都不、nie / niemals 从不、niemand 没人、nirgends / nirgendwo 哪儿都不。<br>' +
    'schon ↔ <b>noch nicht</b>（还没）；noch ↔ <b>nicht mehr / kein … mehr</b>（不再）：<span class="s">Ich habe keinen Hunger mehr.</span><br>' +
    '<b>否定问句的肯定回答用 doch：</b><span class="s">Hast du keinen Hunger? – Doch!</span>（不，我饿）／ <span class="s">Nein.</span>（对，我不饿）</div>'],

  ["frage", "疑问词 + 介词疑问（womit / mit wem）+ da-复合词", "介词 + 物：问用 wo(r)- + 介词，答用 da(r)- + 介词；介词 + 人：问和答都用「介词 + 代词」。介词以元音开头时中间加 r（worauf、darüber）。",
    '<table><tr><th>疑问词</th><th>例句</th></tr>' +
    '<tr><td>wer / wen / wem / wessen 谁（四格）</td><td><span class="s">Wen besuchst du?</span> <span class="s">Wem gehört das?</span> <span class="s">Wessen Tasche ist das?</span></td></tr>' +
    '<tr><td>was 什么</td><td><span class="s">Was machst du?</span></td></tr>' +
    '<tr><td>wo / wohin / woher 哪里 / 去哪 / 从哪</td><td><span class="s">Wohin fährst du?</span></td></tr>' +
    '<tr><td>wann / wie lange / wie oft 何时 / 多久 / 多常</td><td><span class="s">Wie lange dauert der Kurs?</span></td></tr>' +
    '<tr><td>wie / wie viel / wie viele 怎样 / 多少</td><td><span class="s">Wie viel kostet das?</span> <span class="s">Wie viele Kinder hast du?</span></td></tr>' +
    '<tr><td>warum / wieso / weshalb 为什么</td><td><span class="s">Warum kommst du nicht?</span></td></tr>' +
    '<tr><td>welcher / welche / welches 哪个（词尾同 der）</td><td><span class="s">Welchen Bus nimmst du?</span></td></tr>' +
    '<tr><td>was für ein 什么样的（ein 按格变）</td><td><span class="s">Was für ein Auto hast du?</span></td></tr></table>' +
    '<table><tr><th>动词 + 介词</th><th>问物 / 答物</th><th>问人 / 答人</th></tr>' +
    '<tr><td>warten auf 等</td><td><span class="s">Worauf wartest du?</span><br><span class="s">Ich warte darauf.</span></td><td><span class="s">Auf wen wartest du?</span><br><span class="s">Ich warte auf ihn.</span></td></tr>' +
    '<tr><td>sprechen über 谈论</td><td><span class="s">Worüber sprecht ihr?</span><br><span class="s">Wir sprechen darüber.</span></td><td><span class="s">Über wen sprecht ihr?</span><br><span class="s">Über sie.</span></td></tr>' +
    '<tr><td>fahren mit 乘 / 和</td><td><span class="s">Womit fährst du?</span><br><span class="s">Mit dem Bus.</span></td><td><span class="s">Mit wem fährst du?</span><br><span class="s">Mit meiner Freundin.</span></td></tr>' +
    '<tr><td>denken an 想念 / 想到</td><td><span class="s">Woran denkst du?</span><br><span class="s">Ich denke daran.</span></td><td><span class="s">An wen denkst du?</span><br><span class="s">An dich.</span></td></tr>' +
    '<tr><td>sich interessieren für</td><td><span class="s">Wofür interessierst du dich?</span><br><span class="s">Ich interessiere mich dafür.</span></td><td><span class="s">Für wen interessierst du dich?</span><br><span class="s">Für ihn.</span></td></tr>' +
    '<tr><td>Angst haben vor 害怕</td><td><span class="s">Wovor hast du Angst?</span><br><span class="s">Ich habe Angst davor.</span></td><td><span class="s">Vor wem hast du Angst?</span><br><span class="s">Vor ihm.</span></td></tr></table>' +
    '<div class="tip">常见组合：womit / damit、wofür / dafür、worauf / darauf、worüber / darüber、woran / daran、wovon / davon、wozu / dazu、worum / darum、wovor / davor。<br>' +
    'da-复合词也可以预告后面的从句或 zu 不定式：<span class="s">Ich freue mich darauf, dich zu sehen.</span> <span class="s">Denk daran, dass wir morgen früh losfahren.</span></div>'],

  ["konj2", "第二虚拟式 Konjunktiv II：礼貌、建议、假设", "大多数动词用 würde + 原形（句尾）；sein / haben / 情态动词 / wissen 直接用自己的 Konjunktiv II 形式（过去式 + 变音）。用来表达礼貌请求、建议、愿望和不真实的条件。",
    '<table><tr><th>人称</th><th>sein</th><th>haben</th><th>werden</th><th>können</th></tr>' +
    '<tr><td>ich</td><td><span class="s">ich wäre</span></td><td><span class="s">ich hätte</span></td><td><span class="s">ich würde</span></td><td><span class="s">ich könnte</span></td></tr>' +
    '<tr><td>du</td><td><span class="s">du wärst</span></td><td><span class="s">du hättest</span></td><td><span class="s">du würdest</span></td><td><span class="s">du könntest</span></td></tr>' +
    '<tr><td>er / sie / es</td><td><span class="s">er wäre</span></td><td><span class="s">er hätte</span></td><td><span class="s">er würde</span></td><td><span class="s">er könnte</span></td></tr>' +
    '<tr><td>wir</td><td><span class="s">wir wären</span></td><td><span class="s">wir hätten</span></td><td><span class="s">wir würden</span></td><td><span class="s">wir könnten</span></td></tr>' +
    '<tr><td>ihr</td><td><span class="s">ihr wärt</span></td><td><span class="s">ihr hättet</span></td><td><span class="s">ihr würdet</span></td><td><span class="s">ihr könntet</span></td></tr>' +
    '<tr><td>sie / Sie</td><td><span class="s">sie wären</span></td><td><span class="s">sie hätten</span></td><td><span class="s">sie würden</span></td><td><span class="s">sie könnten</span></td></tr></table>' +
    '<table><tr><th>用法</th><th>例句</th></tr>' +
    '<tr><td>礼貌请求</td><td><span class="s">Könnten Sie mir bitte helfen?</span><br><span class="s">Würden Sie bitte das Fenster schließen?</span><br><span class="s">Ich hätte gern einen Kaffee.</span><br><span class="s">Wäre es möglich, den Termin zu verschieben?</span></td></tr>' +
    '<tr><td>建议</td><td><span class="s">Du solltest mehr schlafen.</span><br><span class="s">An deiner Stelle würde ich zum Arzt gehen.</span></td></tr>' +
    '<tr><td>愿望</td><td><span class="s">Ich hätte gern mehr Zeit.</span><br><span class="s">Wenn ich doch mehr Zeit hätte!</span></td></tr>' +
    '<tr><td>不真实条件（现在）</td><td><span class="s">Wenn ich Zeit hätte, würde ich mitkommen.</span><br><span class="s">Wenn ich du wäre, würde ich das nicht machen.</span></td></tr>' +
    '<tr><td>不真实条件（过去）：hätte / wäre + 过去分词</td><td><span class="s">Wenn ich das gewusst hätte, wäre ich gekommen.</span><br><span class="s">Ich hätte früher anfangen sollen.</span></td></tr></table>' +
    '<div class="tip">其它常用形式：müsste、dürfte、sollte、wollte（后两个和过去式一样）、wüsste、gäbe（<span class="s">Es wäre schön, wenn es mehr Parkplätze gäbe.</span>）。<br>' +
    '构成：过去式 + 变音（+ e）：war → wäre，hatte → hätte，konnte → könnte，kam → käme。</div>'],

  ["passiv", "被动态：werden + 过去分词", "被动态强调「发生了什么」而不是谁做的。主动句的四格宾语变成被动句主语；施动者用 von + 三格（人）或 durch + 四格（手段、原因）引出，常省略。",
    '<table><tr><th>时态</th><th>构成</th><th>例句</th></tr>' +
    '<tr><td>现在时</td><td>wird + 分词</td><td><span class="s">Das Haus wird gebaut.</span> 房子正在建。</td></tr>' +
    '<tr><td>过去时</td><td>wurde + 分词</td><td><span class="s">Das Haus wurde 1990 gebaut.</span></td></tr>' +
    '<tr><td>完成时</td><td>ist + 分词 + <b>worden</b></td><td><span class="s">Das Haus ist 1990 gebaut worden.</span></td></tr>' +
    '<tr><td>过去完成时</td><td>war + 分词 + worden</td><td><span class="s">Das Haus war schon verkauft worden.</span></td></tr>' +
    '<tr><td>带情态动词</td><td>情态动词 + 分词 + werden</td><td><span class="s">Das Auto muss repariert werden.</span><br><span class="s">Das Auto musste repariert werden.</span></td></tr>' +
    '<tr><td>从句</td><td>变位动词（wird / ist）在最后</td><td><span class="s">…, weil das Auto repariert wird.</span><br><span class="s">…, dass das Haus verkauft worden ist.</span></td></tr></table>' +
    '<table><tr><th>主动 → 被动</th><th>例句</th></tr>' +
    '<tr><td>主动</td><td><span class="s">Der Mechaniker repariert das Auto.</span></td></tr>' +
    '<tr><td>被动</td><td><span class="s">Das Auto wird vom Mechaniker repariert.</span></td></tr>' +
    '<tr><td>无主语被动（规则、习惯）</td><td><span class="s">Hier wird nicht geraucht.</span> 这里禁止吸烟。<br><span class="s">Sonntags wird nicht gearbeitet.</span></td></tr></table>' +
    '<div class="tip">完成时里用 <b>worden</b>，不是 geworden（geworden 只表示「变成」）。<br>' +
    '<b>状态被动</b> sein + 分词 = 动作完成后的状态：<span class="s">Die Tür ist geschlossen.</span> 门是关着的。↔ <span class="s">Die Tür wird geschlossen.</span> 门正在被关上。</div>'],

  ["relativ", "关系从句：der / die / das 当「……的那个」", "关系代词的性、数跟前面的名词一致，格由它在从句里的作用决定。从句用逗号隔开，变位动词放最后。形式大多同定冠词，只有加粗的几格不同。",
    '<table><tr><th>格</th><th>阳性 m</th><th>阴性 f</th><th>中性 n</th><th>复数 Pl</th></tr>' +
    '<tr><td>Nom</td><td>der</td><td>die</td><td>das</td><td>die</td></tr>' +
    '<tr><td>Akk</td><td>den</td><td>die</td><td>das</td><td>die</td></tr>' +
    '<tr><td>Dat</td><td>dem</td><td>der</td><td>dem</td><td><b>denen</b></td></tr>' +
    '<tr><td>Gen</td><td><b>dessen</b></td><td><b>deren</b></td><td><b>dessen</b></td><td><b>deren</b></td></tr></table>' +
    '<table><tr><th>格</th><th>例句</th></tr>' +
    '<tr><td>Nom</td><td><span class="s">Der Mann, der dort steht, ist mein Lehrer.</span> 站在那儿的男人是我的老师。</td></tr>' +
    '<tr><td>Akk</td><td><span class="s">Der Film, den ich gesehen habe, war toll.</span> 我看的那部电影很棒。</td></tr>' +
    '<tr><td>Dat</td><td><span class="s">Die Frau, der ich geholfen habe, war sehr nett.</span></td></tr>' +
    '<tr><td>Dat Pl</td><td><span class="s">Die Freunde, mit denen ich wandere, kommen aus Köln.</span></td></tr>' +
    '<tr><td>Gen</td><td><span class="s">Der Mann, dessen Auto kaputt ist, wartet auf den Bus.</span><br><span class="s">Die Frau, deren Sohn hier studiert, ist Ärztin.</span></td></tr>' +
    '<tr><td>介词 + 关系代词</td><td><span class="s">Das ist die Stadt, in der ich wohne.</span><br><span class="s">Der Kollege, mit dem ich arbeite, ist nett.</span></td></tr></table>' +
    '<div class="tip">表中加粗的是和定冠词不同的形式（denen、dessen、deren），注意要记。<br>' +
    '前面是 alles / etwas / nichts / das / 中性最高级时用 <b>was</b>：<span class="s">Das ist alles, was ich weiß.</span> <span class="s">Das ist das Beste, was ich je gegessen habe.</span><br>' +
    '指地点可用 <b>wo</b>：<span class="s">Die Stadt, wo ich wohne, ist klein.</span></div>'],

  ["zahl", "数字、时间、日期读法速查", "两位数个位在前（21 = einundzwanzig）；年份 1100–1999 按「几百」读；序数词 2–19 加 -te（erste、dritte、siebte、achte 特殊），20 起加 -ste，后面按形容词变词尾。口语报时用 halb / Viertel，halb drei = 2:30。",
    '<table><tr><th>数字</th><th>读法</th></tr>' +
    '<tr><td>21 / 47</td><td><span class="s">einundzwanzig</span> / <span class="s">siebenundvierzig</span></td></tr>' +
    '<tr><td>101 / 365</td><td><span class="s">hunderteins</span> / <span class="s">dreihundertfünfundsechzig</span></td></tr>' +
    '<tr><td>1 000 000</td><td><span class="s">eine Million</span></td></tr>' +
    '<tr><td>年份 1999</td><td><span class="s">neunzehnhundertneunundneunzig</span></td></tr>' +
    '<tr><td>年份 2026</td><td><span class="s">zweitausendsechsundzwanzig</span>（说 2026 或 im Jahr 2026，不说 in 2026）</td></tr>' +
    '<tr><td>3,5（小数逗号）</td><td><span class="s">drei Komma fünf</span></td></tr>' +
    '<tr><td>2,50 €</td><td><span class="s">zwei Euro fünfzig</span></td></tr>' +
    '<tr><td>½ / ¼ / 1½</td><td><span class="s">ein halb</span> / <span class="s">ein Viertel</span> / <span class="s">anderthalb</span></td></tr></table>' +
    '<table><tr><th>序数</th><th>der …（主格）</th><th>am …（哪一天）</th></tr>' +
    '<tr><td>1.</td><td><span class="s">der erste</span></td><td><span class="s">am ersten</span></td></tr>' +
    '<tr><td>2.</td><td><span class="s">der zweite</span></td><td><span class="s">am zweiten</span></td></tr>' +
    '<tr><td>3.</td><td><span class="s">der dritte</span></td><td><span class="s">am dritten</span></td></tr>' +
    '<tr><td>4.</td><td><span class="s">der vierte</span></td><td><span class="s">am vierten</span></td></tr>' +
    '<tr><td>7.</td><td><span class="s">der siebte</span></td><td><span class="s">am siebten</span></td></tr>' +
    '<tr><td>8.</td><td><span class="s">der achte</span></td><td><span class="s">am achten</span></td></tr>' +
    '<tr><td>19.</td><td><span class="s">der neunzehnte</span></td><td><span class="s">am neunzehnten</span></td></tr>' +
    '<tr><td>20.</td><td><span class="s">der zwanzigste</span></td><td><span class="s">am zwanzigsten</span></td></tr>' +
    '<tr><td>31.</td><td><span class="s">der einunddreißigste</span></td><td><span class="s">am einunddreißigsten</span></td></tr></table>' +
    '<table><tr><th>日期</th><th>例句</th></tr>' +
    '<tr><td>今天几号</td><td><span class="s">Der Wievielte ist heute?</span> – <span class="s">Heute ist der dritte Oktober.</span></td></tr>' +
    '<tr><td>在哪天：am</td><td><span class="s">Ich habe am ersten Mai Geburtstag.</span></td></tr>' +
    '<tr><td>月份、季节：im</td><td><span class="s">im Mai</span>、<span class="s">im Winter</span></td></tr>' +
    '<tr><td>星期、一天中：am</td><td><span class="s">am Montag</span>、<span class="s">am Abend</span>（但 <span class="s">in der Nacht</span>）</td></tr>' +
    '<tr><td>信头</td><td><span class="s">Berlin, den 24. November 2026</span></td></tr></table>' +
    '<table><tr><th>时间</th><th>口语</th><th>正式（车站、广播）</th></tr>' +
    '<tr><td>8:00</td><td><span class="s">acht Uhr</span></td><td><span class="s">acht Uhr</span></td></tr>' +
    '<tr><td>8:05</td><td><span class="s">fünf nach acht</span></td><td><span class="s">acht Uhr fünf</span></td></tr>' +
    '<tr><td>8:15</td><td><span class="s">Viertel nach acht</span></td><td><span class="s">acht Uhr fünfzehn</span></td></tr>' +
    '<tr><td>8:20</td><td><span class="s">zwanzig nach acht</span></td><td><span class="s">acht Uhr zwanzig</span></td></tr>' +
    '<tr><td>8:25</td><td><span class="s">fünf vor halb neun</span></td><td><span class="s">acht Uhr fünfundzwanzig</span></td></tr>' +
    '<tr><td>8:30</td><td><span class="s">halb neun</span></td><td><span class="s">acht Uhr dreißig</span></td></tr>' +
    '<tr><td>8:35</td><td><span class="s">fünf nach halb neun</span></td><td><span class="s">acht Uhr fünfunddreißig</span></td></tr>' +
    '<tr><td>8:45</td><td><span class="s">Viertel vor neun</span></td><td><span class="s">acht Uhr fünfundvierzig</span></td></tr>' +
    '<tr><td>8:50</td><td><span class="s">zehn vor neun</span></td><td><span class="s">acht Uhr fünfzig</span></td></tr>' +
    '<tr><td>20:00</td><td><span class="s">acht Uhr abends</span></td><td><span class="s">zwanzig Uhr</span></td></tr></table>' +
    '<div class="tip"><span class="s">Wie spät ist es?</span> / <span class="s">Wie viel Uhr ist es?</span> 几点了？ <span class="s">Um wie viel Uhr?</span> 几点钟？<br>' +
    '<span class="s">um acht Uhr</span> 八点整、<span class="s">gegen acht</span> 八点左右、<span class="s">von neun bis siebzehn Uhr</span>、<span class="s">ab acht Uhr</span> 八点起。<br>' +
    '1 点：<span class="s">Es ist ein Uhr.</span> 或 <span class="s">Es ist eins.</span>（不说 eins Uhr）。<br>' +
    'Uhr = 钟点，Stunde = 小时：<span class="s">Der Film dauert zwei Stunden.</span></div>'],
];
