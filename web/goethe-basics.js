/* 🎓 歌德考试常识（学德语时考试页「📖 常识」小标签显示，exam 页的 tabs.js 调 window.goetheBasicsHtml()）。内容由 Claude 编写；考试细节以歌德学院官网为准。 */
(function () { window.goetheBasicsHtml = () => `
<div class="ielts-header">
  <div class="wrap">
    <p class="eyebrow">Goethe-Zertifikat</p>
    <h1>🎓 歌德考试常识</h1>
    <nav>
      <a href="#gb-what">🏅 证书与等级</a>
      <a href="#gb-b1">📋 B1 结构</a>
      <a href="#gb-levels">📊 各级对比</a>
      <a href="#gb-score">💯 计分</a>
      <a href="#gb-sprechen">🗣 口语</a>
      <a href="#gb-schreiben">✍️ 写作</a>
      <a href="#gb-linkers">🔗 连接词</a>
      <a href="#gb-prep">🗓 报名备考</a>
      <a href="#gb-tips">💡 误区贴士</a>
    </nav>
  </div>
</div>

<div class="wrap">

  <section id="gb-what">
    <div class="sec-head"><div class="sec-badge">🏅</div><h2>歌德证书是什么</h2></div>
    <p class="sub">歌德学院（Goethe-Institut）颁发的德语水平证书，等级对应欧洲语言共同参考框架（CEFR / GER）</p>
    <div class="card">
      <div class="tscroll"><table class="wide">
        <tr><th>等级</th><th>证书名称</th><th>大致水平</th></tr>
        <tr><td><b>A1</b><span>入门</span></td><td><i>Goethe-Zertifikat A1: Start Deutsch 1</i></td><td>能用简单句介绍自己、问路、填简单表格</td></tr>
        <tr><td><b>A2</b><span>初级</span></td><td><i>Goethe-Zertifikat A2</i></td><td>能应付日常熟悉场景：购物、工作、家庭</td></tr>
        <tr><td><b>B1</b><span>中级</span></td><td><i>Goethe-Zertifikat B1</i></td><td>能独立应付生活和工作中的大部分场景，能说明理由、表达观点</td></tr>
        <tr><td><b>B2</b><span>中高级</span></td><td><i>Goethe-Zertifikat B2</i></td><td>能比较流利地讨论抽象话题、写有论证的文章</td></tr>
        <tr><td><b>C1</b><span>高级</span></td><td><i>Goethe-Zertifikat C1</i></td><td>能在学习和工作中灵活、准确地使用德语</td></tr>
        <tr><td><b>C2</b><span>精通</span></td><td><i>Goethe-Zertifikat C2: Großes Deutsches Sprachdiplom</i></td><td>接近母语者的理解和表达</td></tr>
      </table></div>
      <div class="tip">💡 A1、A2、B1 等考试分<b>成人版</b>和<b>青少年版</b>（如 <i>Fit in Deutsch</i>、<i>B1 für Jugendliche</i>），成年人报成人版即可。部分考点也提供<b>电脑考</b>（digital），是否开设以考点为准。</div>
    </div>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>常见用途</th><th>通常要求（仅供参考）</th></tr>
        <tr><td><b>家庭团聚签证</b><span>Ehegattennachzug</span></td><td>配偶团聚一般要求 <b>A1</b> 德语证明，有例外情况</td></tr>
        <tr><td><b>永居 / 入籍</b><span>Niederlassungserlaubnis / Einbürgerung</span></td><td>通常要求 <b>B1</b></td></tr>
        <tr><td><b>工作 / 职业认证</b><span>Beruf / Anerkennung</span></td><td>视行业和雇主而定，常见 B1–B2（如护理类常见 B1/B2）</td></tr>
        <tr><td><b>德国大学</b><span>Studium</span></td><td>德语授课专业通常要 C1 左右；很多学校认可歌德 C2，部分认可 C1，主流还有 TestDaF / DSH</td></tr>
      </table></div>
      <div class="tip">⚠️ 以上只是常见情况，<b>具体要求每个机构、每种签证都不同，而且会变</b>——以德国驻马来西亚使馆、目标大学或雇主的最新说明为准。歌德证书本身不印有效期，但很多机构只认<b>近一两年</b>的成绩。</div>
    </div>
  </section>

  <section id="gb-b1">
    <div class="sec-head"><div class="sec-badge">📋</div><h2>B1 考试结构（重点）</h2></div>
    <p class="sub">四个模块（Module）：阅读 Lesen、听力 Hören、写作 Schreiben、口语 Sprechen</p>
    <div class="card">
      <div class="tscroll"><table class="wide">
        <tr><th>模块</th><th>时长</th><th>结构</th></tr>
        <tr><td><b>Lesen</b><span>阅读</span></td><td>65 分钟</td><td>5 部分，共 30 题</td></tr>
        <tr><td><b>Hören</b><span>听力</span></td><td>约 40 分钟</td><td>4 部分，共 30 题</td></tr>
        <tr><td><b>Schreiben</b><span>写作</span></td><td>60 分钟</td><td>3 篇短文</td></tr>
        <tr><td><b>Sprechen</b><span>口语</span></td><td>约 15 分钟<span>另有 15 分钟准备</span></td><td>3 部分，两人一组（Paarprüfung）</td></tr>
      </table></div>
    </div>

    <div class="topic">
      <h3>📖 Lesen 阅读 · 65 分钟 · 5 部分</h3>
      <p class="qa"><b>Teil 1</b> 博客 / 私人文章（Blogeintrag）→ 判断对错 richtig / falsch（6 题）</p>
      <p class="qa"><b>Teil 2</b> 两篇报刊短文（Zeitungsartikel）→ 三选一 a / b / c（6 题）</p>
      <p class="qa"><b>Teil 3</b> 广告匹配（Anzeigen）→ 给 7 个人的需求找合适的广告，有的人找不到（7 题）</p>
      <p class="qa"><b>Teil 4</b> 读者评论（Leserbriefe / Kommentare）→ 判断此人是否赞成 ja / nein（7 题）</p>
      <p class="cn"><b>Teil 5</b> 规章 / 说明（Hausordnung、Gebrauchsanweisung 等）→ 三选一（4 题）</p>
    </div>

    <div class="topic">
      <h3>🎧 Hören 听力 · 约 40 分钟 · 4 部分</h3>
      <p class="qa"><b>Teil 1</b> 5 段短录音（广播通知、电话留言、车站广播等），每段 2 题，<b>听两遍</b></p>
      <p class="qa"><b>Teil 2</b> 一个人的讲话（如导游介绍、活动说明）→ 三选一（5 题），<b>听一遍</b></p>
      <p class="qa"><b>Teil 3</b> 两个人的日常对话 → 判断对错（7 题），<b>听一遍</b></p>
      <p class="cn"><b>Teil 4</b> 电台讨论（主持人 + 两位嘉宾）→ 判断每句观点是谁说的（8 题），<b>听两遍</b></p>
    </div>

    <div class="topic">
      <h3>✍️ Schreiben 写作 · 60 分钟 · 3 部分</h3>
      <p class="qa"><b>Teil 1</b> 给朋友写私人邮件，约 <b>80 词</b>，要回应 3 个要点（Leitpunkte）</p>
      <p class="qa"><b>Teil 2</b> 在论坛 / 留言板就一个话题发表观点（Diskussionsbeitrag），约 <b>80 词</b></p>
      <p class="cn"><b>Teil 3</b> 给老师、上司、房东等写正式短邮件 / 留言，约 <b>40 词</b></p>
    </div>

    <div class="topic">
      <h3>🗣 Sprechen 口语 · 约 15 分钟 · 3 部分</h3>
      <p class="qa"><b>Teil 1</b> 和搭档一起计划一件事（Gemeinsam etwas planen）</p>
      <p class="qa"><b>Teil 2</b> 每人做一个小报告（Ein Thema präsentieren）</p>
      <p class="cn"><b>Teil 3</b> 就对方的报告给反馈、提问，并回答问题（Über ein Thema sprechen）——详见下面「口语」一节</p>
    </div>
  </section>

  <section id="gb-levels">
    <div class="sec-head"><div class="sec-badge">📊</div><h2>A1 / A2 / B1 / B2 简要对比</h2></div>
    <p class="sub">时长为成人版大致时长，具体以官网当年的考试说明（Modellsatz）为准</p>
    <div class="card">
      <div class="tscroll"><table class="wide">
        <tr><th>等级</th><th>Lesen</th><th>Hören</th><th>Schreiben</th><th>Sprechen</th></tr>
        <tr><td><b>A1</b><span>不分模块</span></td><td>约 25 分钟</td><td>约 20 分钟</td><td>约 20 分钟<span>填表 + 短信</span></td><td>约 15 分钟<span>小组考</span></td></tr>
        <tr><td><b>A2</b><span>不分模块</span></td><td>约 30 分钟</td><td>约 30 分钟</td><td>约 30 分钟<span>两篇短信</span></td><td>约 15 分钟<span>两人一组</span></td></tr>
        <tr><td><b>B1</b><span>模块化</span></td><td>65 分钟<span>5 部分</span></td><td>约 40 分钟<span>4 部分</span></td><td>60 分钟<span>3 部分</span></td><td>约 15 分钟<span>+15 分钟准备</span></td></tr>
        <tr><td><b>B2</b><span>模块化</span></td><td>65 分钟</td><td>约 40 分钟</td><td>75 分钟<span>2 部分</span></td><td>约 15 分钟<span>+15 分钟准备</span></td></tr>
      </table></div>
      <div class="tip">💡 从 A2 到 B1，最大的跳跃是<b>要说明理由、表达观点</b>：写作多了「论坛发表观点」，口语多了「做报告 + 回答问题」。只会描述事实不够，要练「我觉得……因为……」。</div>
    </div>
  </section>

  <section id="gb-score">
    <div class="sec-head"><div class="sec-badge">💯</div><h2>计分与及格线</h2></div>
    <p class="sub">B1 起是模块化考试，每个模块单独算分</p>
    <div class="card">
      <div class="tscroll"><table class="wide">
        <tr><th>项目</th><th>B1 / B2 / C1（模块化）</th><th>A1 / A2</th></tr>
        <tr><td><b>满分</b></td><td>每个模块 <b>100 分</b></td><td>整场考试合计 <b>100 分</b></td></tr>
        <tr><td><b>及格</b></td><td>每个模块 <b>60 分</b>及格，各模块互不影响</td><td>总分 <b>60 分</b>及格（另有分项要求，以官网为准）</td></tr>
        <tr><td><b>报考方式</b></td><td>可以四个一起考，也可以<b>单考某一个模块</b></td><td>必须整场一起考</td></tr>
        <tr><td><b>证书</b></td><td>每通过一个模块就有该模块的成绩证明</td><td>一张总证书</td></tr>
        <tr><td><b>补考</b></td><td>只需补考没过的模块</td><td>整场重考</td></tr>
      </table></div>
      <div class="tip">⚠️ 签证、入籍等场合通常要求<b>四个模块全部通过</b>，有的机构还要求在同一次考试中通过。不同场次的模块能否合并、合并有无时间限制，<b>以官网和接收机构的要求为准</b>。</div>
    </div>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>主观题</th><th>考官看什么</th></tr>
        <tr><td><b>Schreiben</b><span>写作</span></td><td>任务完成度（Erfüllung）、连贯（Kohärenz）、词汇（Wortschatz）、语法结构（Strukturen）</td></tr>
        <tr><td><b>Sprechen</b><span>口语</span></td><td>以上四项 + 发音（Aussprache）</td></tr>
      </table></div>
      <div class="tip">💡 写作 Teil 1、Teil 2 的分数比重明显大于 Teil 3；口语 Teil 2「做报告」占分最多。具体每部分多少分以官网评分说明为准。</div>
    </div>
  </section>

  <section id="gb-sprechen">
    <div class="sec-head"><div class="sec-badge">🗣</div><h2>B1 口语三部分</h2></div>
    <p class="sub">两人一组，两位考官；考前有 15 分钟准备时间，可以写关键词（不能用词典）</p>

    <div class="topic">
      <h3>🤝 Teil 1 · Gemeinsam etwas planen（约 3 分钟）</h3>
      <p class="qa"><b>做什么：</b>和搭档一起计划一件事，比如给同事办告别会、一起去看望生病的朋友。题卡上有几个要点（什么时候、在哪里、买什么、谁负责……）</p>
      <p class="cn">思路：主动提建议 → 回应对方（同意 / 婉拒 + 理由 + 新建议）→ 最后总结一起定下的方案。重点是<b>互动</b>，不是各说各的。</p>
    </div>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>场景</th><th>怎么说</th></tr>
        <tr><td>提建议</td><td><i>Wie wäre es, wenn wir …? / Ich schlage vor, dass wir …</i></td></tr>
        <tr><td>问对方意见</td><td><i>Was meinst du? / Hast du eine Idee?</i></td></tr>
        <tr><td>同意</td><td><i>Gute Idee! / Einverstanden. / Das machen wir so.</i></td></tr>
        <tr><td>婉拒</td><td><i>Das ist keine schlechte Idee, aber … / Ich weiß nicht, ob das klappt, weil …</i></td></tr>
        <tr><td>分工</td><td><i>Wer kümmert sich um …? / Ich kann … übernehmen.</i></td></tr>
        <tr><td>总结</td><td><i>Also, dann machen wir es so: …</i></td></tr>
      </table></div>
    </div>

    <div class="topic">
      <h3>📊 Teil 2 · Ein Thema präsentieren（每人约 3 分钟）</h3>
      <p class="qa"><b>做什么：</b>按题目给的几页提纲（Folien）做一个小报告，话题如「孩子该不该用手机」「网购」「在家工作」等。</p>
      <p class="cn">通常的提纲：① 介绍题目和报告结构 → ② 自己的经历 → ③ 在你的国家情况如何 → ④ 优缺点 + 你的看法 → ⑤ 结尾、致谢。<b>每一页都要讲到</b>，漏掉会扣分。</p>
    </div>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>步骤</th><th>怎么说</th></tr>
        <tr><td>开场</td><td><i>Ich möchte heute über das Thema „…“ sprechen.</i></td></tr>
        <tr><td>讲结构</td><td><i>Zuerst erzähle ich von meinen Erfahrungen, dann …, zum Schluss …</i></td></tr>
        <tr><td>个人经历</td><td><i>Ich habe selbst erlebt, dass … / Bei mir ist es so: …</i></td></tr>
        <tr><td>本国情况</td><td><i>In Malaysia ist es so, dass … / Bei uns in China …</i></td></tr>
        <tr><td>优缺点</td><td><i>Ein Vorteil ist, dass … Ein Nachteil ist aber, dass …</i></td></tr>
        <tr><td>表观点</td><td><i>Meiner Meinung nach … / Ich finde, dass …</i></td></tr>
        <tr><td>结尾</td><td><i>Das war meine Präsentation. Vielen Dank fürs Zuhören!</i></td></tr>
      </table></div>
    </div>

    <div class="topic">
      <h3>💬 Teil 3 · Über ein Thema sprechen（约 2 分钟）</h3>
      <p class="qa"><b>做什么：</b>搭档讲完后，你对他的报告<b>给一句反馈</b>并<b>提一个问题</b>；你讲完后，也要回答搭档和考官的问题。</p>
      <p class="cn">所以搭档报告时要认真听、记一两个关键词，好提问。</p>
    </div>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>场景</th><th>怎么说</th></tr>
        <tr><td>给反馈</td><td><i>Danke für deine Präsentation. Besonders interessant fand ich, dass …</i></td></tr>
        <tr><td>提问</td><td><i>Ich habe eine Frage: Wie ist das bei dir …?</i></td></tr>
        <tr><td>回答 / 争取时间</td><td><i>Das ist eine gute Frage. Ich glaube, …</i></td></tr>
        <tr><td>没听清</td><td><i>Entschuldigung, können Sie die Frage bitte wiederholen?</i></td></tr>
      </table></div>
      <div class="tip">💡 15 分钟准备时间只写<b>关键词</b>，别写全文去念——考官看的是自然表达。发音（Aussprache）单独算分，平时多跟读、录音对比。</div>
    </div>
  </section>

  <section id="gb-schreiben">
    <div class="sec-head"><div class="sec-badge">✍️</div><h2>B1 写作三部分</h2></div>
    <p class="sub">60 分钟三篇，字数是「约」，不用卡死，但明显太少会扣任务完成分</p>
    <div class="card struct">
      <div class="step"><div class="stepnum">1</div><div class="stepbody"><b>Teil 1 · 给朋友的邮件（约 80 词，建议约 20 分钟）</b><span>私人语气（du）。题目给 3 个要点，比如：描述一件事 / 说明理由 / 提建议或约时间——<b>三点都要写到</b>。开头 <i>Liebe Anna, / Lieber Tom,</i>，结尾 <i>Viele Grüße</i>。</span></div></div>
      <div class="step"><div class="stepnum">2</div><div class="stepbody"><b>Teil 2 · 论坛发表观点（约 80 词，建议约 25 分钟）</b><span>看完一段讨论或别人的留言，写自己的看法：表明立场 + 1–2 个理由 + 例子。常用 <i>Ich bin der Meinung, dass … / Einerseits …, andererseits … / Deshalb …</i></span></div></div>
      <div class="step"><div class="stepnum">3</div><div class="stepbody"><b>Teil 3 · 正式短邮件（约 40 词，建议约 15 分钟）</b><span>写给老师、上司、房东等（Sie）：道歉 / 请假 / 请求 / 取消约定。开头 <i>Sehr geehrte Frau Müller, / Sehr geehrter Herr …,</i>，结尾 <i>Mit freundlichen Grüßen</i>。</span></div></div>
      <div class="tip">💡 最常见的丢分：漏写要点、Teil 3 用了 du、Teil 1 用了 Sie、称呼和落款搞错。建议先写 Teil 1 和 Teil 2（分值大），时间不够时 Teil 3 也至少写满要点。</div>
    </div>
    <div class="card">
      <div class="swap"><span class="old">Ich denke …</span><span class="arrow">→</span><span class="new">Meiner Meinung nach … / Ich bin der Meinung, dass …</span></div>
      <div class="swap"><span class="old">und dann … und dann …</span><span class="arrow">→</span><span class="new">zuerst … danach … schließlich …</span></div>
      <div class="swap"><span class="old">gut / schlecht</span><span class="arrow">→</span><span class="new">praktisch / sinnvoll / problematisch</span></div>
      <div class="swap"><span class="old">Ich kann nicht kommen.</span><span class="arrow">→</span><span class="new">Leider kann ich nicht kommen, weil …</span></div>
      <div class="swap"><span class="old">Ich will …</span><span class="arrow">→</span><span class="new">Ich würde gern … / Könnten Sie mir bitte …?</span></div>
    </div>
  </section>

  <section id="gb-linkers">
    <div class="sec-head"><div class="sec-badge">🔗</div><h2>连接词与语序</h2></div>
    <p class="sub">B1 写作口语都在看你会不会用复合句——连接词决定动词放哪儿</p>
    <div class="card">
      <div class="conn-grp"><div class="lbl">从句：动词放句末</div>
        <span class="chip">weil</span><span class="chip">dass</span><span class="chip">obwohl</span><span class="chip">wenn</span><span class="chip">als</span><span class="chip">damit</span><span class="chip">ob</span>
      </div>
      <div class="conn-grp"><div class="lbl">副词：动词紧跟（第二位）</div>
        <span class="chip">deshalb</span><span class="chip">trotzdem</span><span class="chip">außerdem</span><span class="chip">dann</span><span class="chip">danach</span><span class="chip">leider</span>
      </div>
      <div class="conn-grp"><div class="lbl">并列：语序不变</div>
        <span class="chip">und</span><span class="chip">aber</span><span class="chip">oder</span><span class="chip">denn</span><span class="chip">sondern</span>
      </div>
      <div class="conn-grp"><div class="lbl">表观点 / 对比</div>
        <span class="chip">einerseits … andererseits</span><span class="chip">zum Beispiel</span><span class="chip">im Gegenteil</span><span class="chip">zum Schluss</span>
      </div>
      <div class="tip">💡 对比一下：<i>Ich lerne Deutsch, <b>weil</b> ich in Deutschland arbeiten <b>möchte</b>.</i> ↔ <i><b>Deshalb lerne</b> ich Deutsch.</i> ↔ <i>Ich lerne Deutsch, <b>denn</b> ich <b>möchte</b> in Deutschland arbeiten.</i></div>
    </div>
  </section>

  <section id="gb-prep">
    <div class="sec-head"><div class="sec-badge">🗓</div><h2>报名与备考</h2></div>
    <p class="sub">在吉隆坡可以在歌德学院马来西亚（Goethe-Institut Malaysia）报名考试</p>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>事项</th><th>说明</th></tr>
        <tr><td><b>报名</b></td><td>在歌德学院官网的马来西亚页面查考期并报名；热门场次可能很快报满，提早留意</td></tr>
        <tr><td><b>费用</b></td><td>每年调整，学员 / 非学员价格可能不同 → <b>以官网为准</b></td></tr>
        <tr><td><b>考期</b></td><td>每年不同 → <b>以官网为准</b></td></tr>
        <tr><td><b>出成绩</b></td><td>一般考后几周 → 以考点通知为准</td></tr>
        <tr><td><b>考试当天</b></td><td>带有效身份证件（如护照），以准考通知为准；不能用词典和手机</td></tr>
        <tr><td><b>真题样卷</b></td><td>官网有免费的模拟题（Übungsmaterialien / Modellsatz）含听力音频，考前至少完整做一套</td></tr>
      </table></div>
      <div class="tip">🔎 官网：<b>https://www.goethe.de</b>（搜索 Goethe-Institut Malaysia 或 Goethe-Zertifikat B1）</div>
    </div>

    <div class="card struct">
      <div class="step"><div class="stepnum">1</div><div class="stepbody"><b>🔊 练习：每天过生词</b><span>B1 词汇量要求大约是几千词量级，靠每天少量、不断复习，别考前突击。</span></div></div>
      <div class="step"><div class="stepnum">2</div><div class="stepbody"><b>🧩 练习课：语法和句型</b><span>重点练从句语序、Perfekt / Präteritum、被动态、Konjunktiv II（würde / könnte / hätte）。</span></div></div>
      <div class="step"><div class="stepnum">3</div><div class="stepbody"><b>📻 DW 慢速新闻：练耳朵</b><span>B1 听力 Teil 2、Teil 3 只放一遍，平时就要习惯「一遍抓重点」。先听不看稿，再对照文字。</span></div></div>
      <div class="step"><div class="stepnum">4</div><div class="stepbody"><b>🗣 说：开口练三部分</b><span>用上面的句型练「计划一件事」「三分钟报告」「提问 + 回答」，录音回放听发音。</span></div></div>
      <div class="step"><div class="stepnum">5</div><div class="stepbody"><b>✍️ 写作批改：每周写几篇</b><span>三种题型轮着写：朋友邮件、论坛观点、正式邮件；看批改里漏的要点和语法错误。</span></div></div>
      <div class="step"><div class="stepnum">6</div><div class="stepbody"><b>🎓 歌德模考：限时做题</b><span>按真实时长做听力、阅读模考，找出最弱的部分；考前一个月起每周至少一次。</span></div></div>
    </div>
  </section>

  <section id="gb-tips">
    <div class="sec-head"><div class="sec-badge">💡</div><h2>常见误区 / 小贴士</h2></div>
    <div class="card">
      <div class="tscroll"><table>
        <tr><th>误区</th><th>实际上</th></tr>
        <tr><td>「总分够了就行」</td><td>B1 是<b>每个模块</b>各自 60 分及格，一个模块再高也补不了另一个</td></tr>
        <tr><td>「写作越长越好」</td><td>字数「约 80 / 约 40」就够，<b>要点写全</b>比写长更重要</td></tr>
        <tr><td>「口语背范文」</td><td>考官会追问，背的内容一问就卡；背<b>句型框架</b>，内容现场组织</td></tr>
        <tr><td>「听力每段都听两遍」</td><td>B1 的 Teil 2、Teil 3 只放一遍（Teil 1、Teil 4 放两遍）——放录音前先把题读完</td></tr>
        <tr><td>「阅读要逐字看懂」</td><td>65 分钟 30 题，时间很紧；先看题目再找关键信息，别卡在生词上</td></tr>
        <tr><td>「A2 证书可以跳过」</td><td>考试本身不要求先有低级证书，可以直接报 B1；但实力最好稳过 A2 再冲</td></tr>
      </table></div>
      <div class="tip">💡 阅读和听力的答案要写到<b>答题卡（Antwortbogen）</b>上，只写在题本上不算分，注意留时间誊写（具体安排以考场说明为准）。考前一定要用官网样卷完整模拟一次，熟悉题型和时间节奏。</div>
    </div>
  </section>

</div>
`; })();
