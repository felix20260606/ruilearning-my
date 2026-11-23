/* 从 index.html 原样搬出来的一段（标签：英语 / 生活、旅游、减脂、雅思）：还是普通脚本，按原来的位置加载，全局变量、执行顺序都和以前一样 */
(function(){
  /* ===== 旅游 tab 的文件清单 —— 只改这里就行 =====
     name = 按钮显示名, file = 同目录下的文件名, dl:true = 点了直接新窗口打开/下载 */
  var TRIP_FILES=[
    {name:"📖 行程手册", file:"dongbei-trip.html"},
    {name:"🗺 路线图",   file:"dongbei-route.svg"},
    {name:"🖨 打印版PDF", file:"dongbei-handbook.pdf"},
    {name:"📝 Word版",   file:"dongbei-handbook.docx", dl:true}
  ];

  var l1En=document.getElementById('l1-en'),l1Life=document.getElementById('l1-life');
  var tNb=document.getElementById('tab-notebook'),tFat=document.getElementById('tab-fat'),tTrip=document.getElementById('tab-trip'),tIelts=document.getElementById('tab-ielts'),tSpeak=document.getElementById('tab-speak'),tDaily=document.getElementById('tab-daily');
  var fr=document.getElementById('fatframe'),tf=document.getElementById('tripframe');
  var fatKl=document.getElementById('fat-kl'),fatLy=document.getElementById('fat-ly'),fatBkk=document.getElementById('fat-bkk'),fat14d=document.getElementById('fat-14d'),fatX10=document.getElementById('fat-x10'),fatWrap=document.getElementById('fat-wrap'),fatNav=document.getElementById('fat-nav'),fatCalc=document.getElementById('fat-calc');
  var FAT_FILES={nav:'fat-nav.html',calc:'jianzhi-calc.html',wrap:'jianzhi-wrap.html',x10:'jianzhi-exec10.html','14d':'jianzhi-14day.html',kl:'jianzhi-kl.html',ly:'jianzhi-linyi.html',bkk:'jianzhi-plan.html'};
  var row=document.getElementById('triprow'),empty=document.getElementById('tripempty');
  var destDb=document.getElementById('dest-db'),destMel=document.getElementById('dest-mel'),destMel1=document.getElementById('dest-mel1'),destSg=document.getElementById('dest-sg'),destSg2=document.getElementById('dest-sg2'),destPg=document.getElementById('dest-pg'),destLk=document.getElementById('dest-lk'),destTnav=document.getElementById('dest-tnav');
  var CQ_FILE='cq-transit.html',LAST6_FILE='last6-trip.html',destLast6=document.getElementById('dest-last6'),FOOT_FILE='my-trips.html',destFoot=document.getElementById('dest-foot'),MELAKA_FILE='malacca.html',MELAKA1_FILE='malacca-1day.html',SG_FILE='sg-trip.html',SG2_FILE='sg-2day.html',PG_FILE='penang-trip.html',LK_FILE='langkawi-trip.html',TNAV_FILE='trip-nav.html';
  var grpEn=document.querySelector('.subgrp[data-l1="en"]'),grpLife=document.querySelector('.subgrp[data-l1="life"]');
  if(!l1En||!l1Life||!tNb)return;
  var root=document.documentElement, tripLoaded=false, fatLoaded=false;
  var L2_OF={en:'notebook',life:'fat'}; // 每个 L1 下当前/记住的 L2 选项

  function buildTripRow(){
    if(!row)return;
    row.innerHTML='';
    TRIP_FILES.forEach(function(f,i){
      var b=document.createElement('button');
      b.type='button'; b.textContent=f.name;
      b.onclick=function(){openTrip(i);};
      row.appendChild(b);
    });
    if(!TRIP_FILES.length&&empty)empty.style.display='flex';
  }
  function openTrip(i){
    var f=TRIP_FILES[i]; if(!f||!tf)return;
    if(f.dl){ window.open(f.file,'_blank'); return; }
    Array.prototype.forEach.call(row.children,function(b,j){b.classList.toggle('on',j===i);});
    if(empty)empty.style.display='none';
    tf.style.display='block';
    tf.setAttribute('src',f.file);
    try{localStorage.setItem('vocab_trip_i',String(i));}catch(e){}
  }
  function openDongbeiDefault(){
    if(row)row.style.display='flex';
    var i=0;try{i=parseInt(localStorage.getItem('vocab_trip_i')||'0',10)||0;}catch(e){}
    if(i<0||i>=TRIP_FILES.length||TRIP_FILES[i].dl)i=0;
    while(i<TRIP_FILES.length&&TRIP_FILES[i].dl)i++;
    if(i<TRIP_FILES.length)openTrip(i); else if(empty){empty.style.display='flex';tf.style.display='none';}
  }
  function setDest(d){
    var isDb=(d==='db');
    if(destDb)destDb.classList.toggle('on',isDb);
    if(destMel)destMel.classList.toggle('on',d==='mel');
    if(destMel1)destMel1.classList.toggle('on',d==='mel1');
    if(destSg)destSg.classList.toggle('on',d==='sg');
    if(destSg2)destSg2.classList.toggle('on',d==='sg2');
    if(destPg)destPg.classList.toggle('on',d==='pg');
    if(destLk)destLk.classList.toggle('on',d==='lk');
    if(destTnav)destTnav.classList.toggle('on',d==='tnav');
    if(destFoot)destFoot.classList.toggle('on',d==='foot');
    if(destLast6)destLast6.classList.toggle('on',d==='last6');
    if(isDb){
      openDongbeiDefault();
    }else{
      if(row)row.style.display='none';
      if(empty)empty.style.display='none';
      if(tf){tf.style.display='block';tf.setAttribute('src',d==='cq'?CQ_FILE:d==='last6'?LAST6_FILE:d==='foot'?FOOT_FILE:d==='tnav'?TNAV_FILE:(d==='lk'?LK_FILE:(d==='pg'?PG_FILE:(d==='sg2'?SG2_FILE:(d==='sg'?SG_FILE:(d==='mel1'?MELAKA1_FILE:MELAKA_FILE))))));}
    }
    try{localStorage.setItem('trip_dest',d);}catch(e){}
    if(window.NAV)NAV.mark();
  }
  function setFatRegion(r){
    if(fatNav)fatNav.classList.toggle('on',r==='nav');
    if(fatCalc)fatCalc.classList.toggle('on',r==='calc');
    if(fatWrap)fatWrap.classList.toggle('on',r==='wrap');
    if(fatX10)fatX10.classList.toggle('on',r==='x10');
    if(fat14d)fat14d.classList.toggle('on',r==='14d');
    if(fatKl)fatKl.classList.toggle('on',r==='kl');
    if(fatLy)fatLy.classList.toggle('on',r==='ly');
    if(fatBkk)fatBkk.classList.toggle('on',r==='bkk');
    if(fr)fr.setAttribute('src',FAT_FILES[r]||FAT_FILES.wrap);
    try{localStorage.setItem('fat_region',r);}catch(e){}
    if(window.NAV)NAV.mark();
  }
  // 英语八个二级标签：📅 每日 | 📖 词汇 | 🎧 听 | 🗣 说 | 📰 读 | ✍️ 写 | 🎓 雅思 | 🌱 入门
  //   入门 → 🧭 从这开始（basic.js）/ 🗣 口语入门、🔊 发音（speak.js 只显示这一栏：speakShow("start" / "pron")）/ 📐 语法（生词本页的语法模式，原来在「✍️ 写」下面）
  //   词汇 / 听（听力练习）/ 读 / 写 借用生词本这一页（#view-en）：html[data-en] 决定隐藏哪些部分，再切到对应的模式（.modes 按钮）
  //   听 → 🎬 视频（watch.js 的 videoCore）/ 🎧 听力练习（「🔊 练习」）；写 → 📝 写作批改（write.js）/ 📐 语法；读 → 📰 阅读（今日新闻、文章）
  var tListen=document.getElementById('tab-listen'),tRead=document.getElementById('tab-read'),tWrite=document.getElementById('tab-write'),tBasic=document.getElementById('tab-basic');
  var L2_OWNER={daily:'en',notebook:'en',listen:'en',speak:'en',read:'en',write:'en',ielts:'en',basic:'en',fat:'life',trip:'life'};
  var EN_PAGE={notebook:'vocab',listen:'listen',read:'read',write:'write',basic:'write'}; // 入门只有「📐 语法」用生词本页
  var SECS={listen:[['drill','🧩 练习课'],['sme','📻 听力节目'],['video','🎬 视频'],['practice','🎧 听力练习']],basic:[['start','🧭 从这开始'],['speak','🗣 口语入门'],['pron','🔊 发音'],['grammar','📐 语法']]}; // 「📐 语法」从「✍️ 写」挪到了「🌱 入门」
  // 🇩🇪 学德语时：只有英语内容的页面整个藏起来（说、读、写、雅思、入门、BBC 听力节目、视频、语法、写作批改、已保存），各语言完全分开；
  //   留下的是按语言分开存的：生词本（列表、练习、统计、错题）、🧩 练习课（德语素材）、🎧 听力练习（练自己生词本里的词）。样式在 index.css 的 html[data-lang="de"]
  var DE=window.VL==='de', DE_OFF={speak:1,read:1,write:1,ielts:1};
  if(DE)SECS.listen=SECS.listen.filter(function(x){return x[0]==='drill'||x[0]==='practice';});
  if(DE)SECS.basic=[['start','🧭 从这开始'],['laut','🔤 字母和发音'],['satz','👋 常用句'],['gram','📐 语法入门'],['zahl','🔢 数字和时间']]; // 🌱 德语入门（de-basic.js）
  var VOCAB_MODES=DE?/^(err|stats|pump|list)$/:/^(err|stats|pump|saved|list)$/, CUR='', busy=false;
  try{if(!localStorage.getItem('drill:seen')){localStorage.setItem('drill:seen','1');if(localStorage.getItem('en_sub_listen'))localStorage.setItem('en_sub_listen','drill');}}catch(e){} // 新加的「🧩 练习课」第一次默认选它（新标签排最前、默认选最新）
  function getSub(w){var d=SECS[w][0][0];try{var v=localStorage.getItem('en_sub_'+w);if(SECS[w].some(function(x){return x[0]===v;}))return v;}catch(e){}return d;}
  function clickMode(m){var b=document.querySelector('.modes button[data-mode="'+m+'"]');if(b&&!b.classList.contains('on'))b.click();}
  function setSec(which,sub){
    root.classList.toggle('has-sec',!!SECS[which]);
    var bar=document.getElementById('en-secbar'),wrap=bar&&bar.firstElementChild;if(!wrap)return;
    wrap.innerHTML=SECS[which]?SECS[which].map(function(x){return '<button type="button" data-sub="'+x[0]+'" class="'+(x[0]===sub?'on':'')+'">'+x[1]+'</button>';}).join(''):'';
  }
  function show(which,sub){
    if(!L2_OWNER[which]||(DE&&DE_OFF[which]))which='notebook';
    var l1=L2_OWNER[which];
    L2_OF[l1]=which; CUR=which;
    // L1 按钮 + 子导航条 显隐
    l1En.classList.toggle('on',l1==='en'); l1Life.classList.toggle('on',l1==='life');
    if(grpEn)grpEn.classList.toggle('on',l1==='en');
    if(grpLife)grpLife.classList.toggle('on',l1==='life');
    // L2 按钮高亮
    tNb.classList.toggle('on',which==='notebook');
    if(tListen)tListen.classList.toggle('on',which==='listen');
    if(tRead)tRead.classList.toggle('on',which==='read');
    if(tWrite)tWrite.classList.toggle('on',which==='write');
    if(tIelts)tIelts.classList.toggle('on',which==='ielts');
    if(tSpeak)tSpeak.classList.toggle('on',which==='speak');
    if(tDaily)tDaily.classList.toggle('on',which==='daily');
    if(tBasic)tBasic.classList.toggle('on',which==='basic');
    tFat.classList.toggle('on',which==='fat');
    tTrip.classList.toggle('on',which==='trip');
    // 内容区切换
    root.classList.remove('show-fat','show-trip','show-ielts','show-speak','show-daily','show-basic','show-basic-home');
    if(SECS[which]){sub=sub&&SECS[which].some(function(x){return x[0]===sub;})?sub:getSub(which);try{localStorage.setItem('en_sub_'+which,sub);}catch(e){}}else sub='';
    var bSpeak=which==='basic'&&(sub==='speak'||sub==='pron');
    if(which!=='speak'&&!bSpeak&&window.speakHide)speakHide();
    if(which!=='daily'&&window.dailyHide)dailyHide();
    var ep=which==='basic'&&sub!=='grammar'?'':EN_PAGE[which];
    if(ep)root.setAttribute('data-en',ep);else root.removeAttribute('data-en');
    setSec(which,sub);
    var wantVideo=which==='listen'&&sub==='video';
    if(!wantVideo){window.__wantVideo=0;if(window.videoCore)videoCore.leave();}
    if(which==='fat'){
      root.classList.add('show-fat');
      if(!fatLoaded){fatLoaded=true;
        var fd='nav';try{fd=localStorage.getItem('fat_region')||'nav';}catch(e){}
        setFatRegion(FAT_FILES[fd]?fd:'nav');
      }
    }else if(which==='trip'){
      root.classList.add('show-trip');
      if(!tripLoaded){tripLoaded=true;
        var d0='foot';try{d0=localStorage.getItem('trip_dest')||'foot';if(!localStorage.getItem('trip:foot:seen')){localStorage.setItem('trip:foot:seen','1');d0='foot';}}catch(e){} // 「🗺 我的足迹」排最前、第一次打开默认它（「吉隆坡周边」没有单独的标签，从导航页卡片打开） // 新加的「🗺 我的足迹」第一次打开默认它
        setDest((d0==='db'||d0==='mel'||d0==='mel1'||d0==='sg'||d0==='sg2'||d0==='pg'||d0==='lk'||d0==='tnav'||d0==='foot'||d0==='last6'||d0==='cq')?d0:'foot'); // 新加的「🗺 我的足迹」排最前、第一次默认它
      }
    }else if(which==='ielts'){
      root.classList.add('show-ielts');
    }else if(which==='speak'){
      root.classList.add('show-speak');
      if(window.speakShow)speakShow();
    }else if(which==='daily'){
      root.classList.add('show-daily');
      if(window.dailyShow)dailyShow();
    }else if(which==='basic'){
      root.classList.add('show-basic');
      if(DE){root.classList.add('show-basic-home');if(window.deBasicShow)deBasicShow(sub);}
      else if(bSpeak){root.classList.add('show-speak');if(window.speakShow)speakShow(sub==='speak'?'start':'pron');}
      else if(sub==='start'){root.classList.add('show-basic-home');if(window.basicShow)basicShow();}
    }
    busy=true;
    try{
      if(which==='notebook'){if(!VOCAB_MODES.test(root.getAttribute('data-mode')||'')){var lm='list';try{lm=localStorage.getItem('vocab_mode_v')||'list';}catch(e){}clickMode(VOCAB_MODES.test(lm)?lm:'list');}}
      else if(which==='read')clickMode('reading');
      else if(which==='write')clickMode('writing');
      else if(which==='basic'&&sub==='grammar')clickMode('grammar');
      else if(which==='listen'){if(wantVideo){if(window.videoCore)videoCore.enter();else window.__wantVideo=1;}else clickMode(sub==='sme'||sub==='drill'?sub:'pump');}
    }finally{busy=false;}
    try{localStorage.setItem('vocab_tab',which);}catch(e){}
    if(window.NAV)NAV.mark();
  }
  window.enShow=show;
  // 🔙 页面历史（nav.js）：标签、小标签、生词本的模式；生活里减脂 / 旅行选的是哪一页
  if(window.NAV){
    NAV.reg('tab',function(){return CUR?{w:CUR,sub:SECS[CUR]?getSub(CUR):'',m:CUR==='notebook'?(root.getAttribute('data-mode')||''):''}:undefined;},function(s){
      if(!s||!L2_OWNER[s.w])return;
      if(s.w!==CUR||(SECS[s.w]&&s.sub!==getSub(s.w)))show(s.w,s.sub);
      if(s.m&&s.w==='notebook'&&s.m!==root.getAttribute('data-mode'))clickMode(s.m);
    });
    NAV.reg('life',function(){var f='',t='';try{f=localStorage.getItem('fat_region')||'';t=localStorage.getItem('trip_dest')||'';}catch(e){}return CUR==='fat'?{f:f}:CUR==='trip'?{t:t}:undefined;},function(s){
      if(s.f&&FAT_FILES[s.f]){var c='';try{c=localStorage.getItem('fat_region');}catch(e){}if(c!==s.f)setFatRegion(s.f);}
      if(s.t){var d='';try{d=localStorage.getItem('trip_dest');}catch(e){}if(d!==s.t)setDest(s.t);}
    });
  }
  // 生词本的模式按钮被点了（包括每日一练、统计页、#article 链接直接点模式按钮跳过来）：上面的标签跟着变
  window.enSync=function(m){
    if(CUR==='basic'&&getSub('basic')!=='grammar'&&m!=='grammar'&&!busy)return; // 入门的其它小标签不用生词本页：网页启动时恢复的模式别把标签切走
    if(busy||!EN_PAGE[CUR]||root.classList.contains('show-video')){if(CUR==='notebook'&&VOCAB_MODES.test(m)){try{localStorage.setItem('vocab_mode_v',m);}catch(e){}}return;}
    if(VOCAB_MODES.test(m)&&!(m==='pump'&&CUR==='listen')){try{localStorage.setItem('vocab_mode_v',m);}catch(e){}} // 「📖 词汇」记住上次的模式（听力练习不算）
    if(m==='reading'){if(CUR!=='read')show('read');return;}
    if(m==='sme'||m==='drill'){if(CUR!=='listen'||getSub('listen')!==m)show('listen',m);return;}
    if(m==='grammar'){if(CUR!=='basic'||getSub('basic')!=='grammar')show('basic','grammar');return;}
    if(m==='writing'){if(CUR!=='write')show('write');return;}
    if(m==='pump'&&CUR==='listen')return;
    if(CUR!=='notebook')show('notebook');else if(window.NAV)NAV.mark(); // 生词本里换模式也算换页
  };
  document.getElementById('en-secbar').addEventListener('click',function(e){var b=e.target.closest('button[data-sub]');if(b&&SECS[CUR])show(CUR,b.dataset.sub);});
  buildTripRow();
  if(destDb)destDb.onclick=function(){setDest('db');};
  if(destMel)destMel.onclick=function(){setDest('mel');};
  if(destTnav)destTnav.onclick=function(){setDest('tnav');};
  if(destFoot)destFoot.onclick=function(){setDest('foot');};
  if(destLast6)destLast6.onclick=function(){setDest('last6');}; // 🧭 吉隆坡周边 6 天（last6-trip.html）：没有单独的标签，从导航页卡片打开（destLast6 为空）
  if(destLk)destLk.onclick=function(){setDest('lk');};
  window.addEventListener('message',function(e){var m={lk:'lk',pg:'pg',sg2:'sg2',sg:'sg',mel1:'mel1',mel:'mel',db:'db',foot:'foot',last6:'last6',cq:'cq'};if(e&&e.data&&e.data.tripGo&&m[e.data.tripGo])setDest(m[e.data.tripGo]);});
  if(destPg)destPg.onclick=function(){setDest('pg');};
  if(destSg2)destSg2.onclick=function(){setDest('sg2');};
  if(destSg)destSg.onclick=function(){setDest('sg');};
  if(destMel1)destMel1.onclick=function(){setDest('mel1');};
  l1En.onclick=function(){show(L2_OF.en);};
  l1Life.onclick=function(){show(L2_OF.life);};
  tNb.onclick=function(){show('notebook');};
  if(tIelts)tIelts.onclick=function(){show('ielts');};
  if(tSpeak)tSpeak.onclick=function(){show('speak');};
  if(tDaily)tDaily.onclick=function(){show('daily');};
  if(tBasic)tBasic.onclick=function(){show('basic');};
  if(tListen)tListen.onclick=function(){show('listen');};
  if(tRead)tRead.onclick=function(){show('read');};
  if(tWrite)tWrite.onclick=function(){show('write');};
  tFat.onclick=function(){show('fat');};
  if(fatNav)fatNav.onclick=function(){setFatRegion('nav');};
  if(fatCalc)fatCalc.onclick=function(){setFatRegion('calc');};
  if(fatWrap)fatWrap.onclick=function(){setFatRegion('wrap');};
  window.addEventListener('message',function(e){if(e&&e.data&&e.data.fatGo&&FAT_FILES[e.data.fatGo])setFatRegion(e.data.fatGo);});
  if(fatX10)fatX10.onclick=function(){setFatRegion('x10');};
  if(fat14d)fat14d.onclick=function(){setFatRegion('14d');};
  if(fatKl)fatKl.onclick=function(){setFatRegion('kl');};
  if(fatLy)fatLy.onclick=function(){setFatRegion('ly');};
  if(fatBkk)fatBkk.onclick=function(){setFatRegion('bkk');};
  tTrip.onclick=function(){show('trip');};
  var saved='';try{saved=localStorage.getItem('vocab_tab')||'';}catch(e){}
  if(saved==='xsaved'||saved==='xreview'){try{localStorage.setItem('vocab_mode',saved==='xsaved'?'saved':'pump');localStorage.setItem('vocab_tab','notebook');}catch(e){} saved='notebook';} // 以前的「已保存 / 复习」入口已并进生词本
  var vsub='';try{if(localStorage.getItem('wt:tab')==='1'){saved='listen';vsub='video';}}catch(e){} // 以前一级标签「🎬 视频」上次开着：现在在「🎧 听 → 🎬 视频」
  if(saved==='notebook'){try{var om=localStorage.getItem('vocab_mode')||'';if(om==='reading')saved='read';else if(om==='grammar')saved='basic',vsub='grammar';}catch(e){}} // 以前停在生词本的「阅读 / 语法」：现在是「📰 读」「✍️ 写」
  try{if(saved==='write'&&localStorage.getItem('en_sub_write')==='grammar')saved='basic',vsub='grammar';}catch(e){} // 上次停在「✍️ 写 → 📐 语法」：语法现在在「🌱 入门」
  var g='';try{g=new URLSearchParams(location.search).get('go');if(g==='speak'||g==='daily'||g==='listen'||g==='read'||g==='write'||g==='ielts'||g==='basic')saved=g,vsub='';if(g==='video')saved='listen',vsub='video';}catch(e){} // 直达链接 ?go=speak / daily / listen / read / write / video
  if(!saved&&!g&&!/^#article\//.test(location.hash))saved='daily'; // 第一次来（没存过标签）：先进「📅 每日一练」
  if(L2_OWNER[saved]&&!root.classList.contains('collect-mode'))show(saved,vsub);
})();

/* ===== 雅思页内二级：笔记(ielts-notes.html) / 基本常识；「📝 写作批改」挪到了「✍️ 写」 ===== */
(function(){
  var bBtn=document.getElementById('ielts-t-basics'),nBtn=document.getElementById('ielts-t-notes');
  var basics=document.getElementById('ielts-basics'),notesV=document.getElementById('ielts-notes-view');
  var ifr=document.getElementById('ieltsframe');
  if(!bBtn||!nBtn||!basics||!notesV)return;
  var wBtn=document.getElementById('ielts-t-write'),lBtn=document.getElementById('ielts-t-lexam'),rBtn=document.getElementById('ielts-t-rexam'),exV=document.getElementById('ielts-exam-view');
  function sw(which){
    var isNotes=which==='notes',isEx=which==='lexam'||which==='rexam';
    bBtn.classList.toggle('on',which==='basics');
    nBtn.classList.toggle('on',isNotes);
    if(lBtn)lBtn.classList.toggle('on',which==='lexam');
    if(rBtn)rBtn.classList.toggle('on',which==='rexam');
    basics.style.display=which==='basics'?'block':'none';
    notesV.style.display=isNotes?'block':'none';
    if(exV){exV.style.display=isEx?'block':'none';if(isEx&&window.examShow)examShow(exV,which==='lexam'?'listening':'reading');}
    if(isNotes&&ifr&&!ifr.getAttribute('src'))ifr.setAttribute('src','ielts-notes.html');
    try{localStorage.setItem('ielts_sub',which);}catch(e){}
    if(window.NAV)NAV.mark();
  }
  bBtn.onclick=function(){sw('basics');};
  nBtn.onclick=function(){sw('notes');};
  if(lBtn)lBtn.onclick=function(){sw('lexam');};
  if(rBtn)rBtn.onclick=function(){sw('rexam');};
  if(window.NAV)NAV.reg('ielts',function(){if(!document.documentElement.classList.contains('show-ielts'))return undefined;var v='';try{v=localStorage.getItem('ielts_sub')||'';}catch(e){}return v;},function(v){var c='';try{c=localStorage.getItem('ielts_sub')||'';}catch(e){}if(v&&v!==c)sw(v);});
  window.ieltsSub=sw; // 别的模块跳到雅思某个小标签：ieltsSub('lexam' | 'rexam' | 'notes' | 'basics')
  if(wBtn)wBtn.onclick=function(){if(window.enShow)enShow('write','writing');}; // 旧的跳转（每日一练「写」）点这个隐藏按钮 → 「✍️ 写 → 📝 写作批改」
  var s='';try{s=localStorage.getItem('ielts_sub')||'';}catch(e){}
  sw(/^(basics|notes|lexam|rexam)$/.test(s)?s:'lexam'); // 新加的「听力模考」排最前、第一次打开默认它
})();
