/* 从 index.html 原样搬出来的一段（生词本（词条、复习、设置、同步））：还是普通脚本，按原来的位置加载，全局变量、执行顺序都和以前一样 */
/* 词条全部存在网站后台（/api/vocab），页面里不再写死；备份见仓库 data/vocab.json */

/* ===== storage ===== */
const KEY="vocab_state_v1";
const hasStore=typeof window!=="undefined"&&window.storage;
let mem=null;
async function load(){
  if(hasStore){try{const r=await Promise.race([window.storage.get(KEY),new Promise((_,rej)=>setTimeout(()=>rej("t"),1500))]);return r?JSON.parse(r.value):def();}catch{return def();}}
  try{const r=localStorage.getItem(KEY);return r?JSON.parse(r):def();}catch(e){return mem||def();}
}
async function save(s){
  vStamp(s);
  if(hasStore){try{await Promise.race([window.storage.set(KEY,JSON.stringify(s)),new Promise((_,r)=>setTimeout(r,1500))]);}catch(e){}}
  else{mem=s;try{localStorage.setItem(KEY,JSON.stringify(noImg(s)));}catch(e){
    // 本机存储满了：先去掉配图缓存（能重新找）再存；还存不下就提醒一次（生词本内容已经传到后台的不会丢，只是这台设备的缓存没更新）
    try{const t=Object.assign({},s);delete t.imgcache;delete t.rowimgcache;localStorage.setItem(KEY,JSON.stringify(t));}
    catch(e2){if(!save.warned){save.warned=1;try{toast("⚠️ 这台设备的浏览器存储满了，生词本的改动只能先传到后台。可以在浏览器设置里清一下这个网站以外的数据。");}catch(e3){}}}
  }}
  schedulePush();
}
function def(){return{progress:{},custom:[],deleted:[],pending:[],srs:{}};}
// 🖼 配图缓存单独存（vocab:img / vocab:rowimg，不跟生词本一起存）：以前在生词本里占 300 KB，练习时每答一张卡都要连它一起重写一遍，手机上每次多几十毫秒；
//   改了只在 2 秒后写一次。没找到图的也记下（7 天内不再去维基百科找，以前每次打开网页都重新找一遍）
const IMG_KEY="vocab:img",ROWIMG_KEY="vocab:rowimg",NOIMG_TTL=7*864e5;
const noImg=s=>{if(!s||(!("imgcache" in s)&&!("rowimgcache" in s)))return s;const t=Object.assign({},s);delete t.imgcache;delete t.rowimgcache;return t;};
let imgSaveT=0;
function imgSave(){clearTimeout(imgSaveT);imgSaveT=setTimeout(()=>{
  const now=Date.now(),o={};for(const k in imgCache){const v=imgCache[k];if(Array.isArray(v))o[k]=v;else if(v===null)o[k]={none:now};else if(v&&v.none)o[k]=v;}
  const r={};for(const k in rowImgCache){const v=rowImgCache[k];if(v&&v!=="pending")r[k]=v;}
  try{localStorage.setItem(IMG_KEY,JSON.stringify(o));localStorage.setItem(ROWIMG_KEY,JSON.stringify(r));}catch(e){} // 存不下就算了（能重新找）
},2000);}
function imgLoad(st){ // 读单独存的配图缓存；第一次（以前存在生词本里的）搬过来
  let o=null,r=null;try{o=JSON.parse(localStorage.getItem(IMG_KEY)||"null");r=JSON.parse(localStorage.getItem(ROWIMG_KEY)||"null");}catch(e){}
  if(!o&&st&&st.imgcache)o=st.imgcache; if(!r&&st&&st.rowimgcache)r=st.rowimgcache;
  const now=Date.now(),I={};for(const k in o||{}){const v=o[k];if(Array.isArray(v))I[k]=v;else if(v&&v.none&&now-v.none<NOIMG_TTL)I[k]=v;} // 没图的记录 7 天后再找一次
  const RW={};for(const k in r||{}){const v=r[k];if(v&&v!=="pending")RW[k]=v;}
  return {I,RW};
}
/* 掌握状态、待整理队列：改了的项记下时间（progAt / pendAdd / pendDel），合并时同一项按时间新的为准（后台同样）——
   别的设备 / 标签页的旧缓存改不回去，「清空待整理」也清得掉。哪个页面改的都一样：保存前和上次的样子比一下就知道改了哪些 */
let vSnap=null;
const lowSet=L=>new Set((L||[]).map(w=>(w+"").toLowerCase()));
function vResnap(){vSnap={p:Object.assign({},state.progress||{}),q:lowSet(state.pending)};}
function vStamp(s){
  if(s!==state)return; if(!vSnap){vResnap();return;}
  const now=Date.now();s.progAt=s.progAt||{};s.pendAdd=s.pendAdd||{};s.pendDel=s.pendDel||{};
  const P=s.progress||{};for(const k of new Set([...Object.keys(P),...Object.keys(vSnap.p)]))if(P[k]!==vSnap.p[k])s.progAt[k]=now;
  const Q=lowSet(s.pending);Q.forEach(w=>{if(!vSnap.q.has(w))s.pendAdd[w]=now;});vSnap.q.forEach(w=>{if(!Q.has(w))s.pendDel[w]=now;});
  vResnap();
}
const tMax=(x,y)=>{const o={},cut=Date.now()-90*864e5;[x||{},y||{}].forEach(m=>{for(const k in m){const t=Math.min(+m[k]||0,Date.now()+5000);if(t>cut&&t>(o[k]||0))o[k]=t;}});return o;};
// 新词条的日期：本地日期（toISOString 是 UTC，北京时间 0–8 点加的词会记成前一天）
const ymdLocal=()=>U.day(); // 📅 全站共用的「今天」（util.js，吉隆坡 / 北京时间）
window.ymdLocal=ymdLocal;
// 用固定 id（v_单词）加词的页面：这个 id 删过就换一个新的（删除记录只增不减，用旧 id 会被合并时再删掉）
window.freshId=id=>(state.deleted||[]).includes(id)?id+"_"+Date.now().toString(36):id;

/* ===== cloud sync — 生词本存在本站后台（Cloudflare KV，/api/vocab）=====
   不设口令：打开就同步；被乱改时可从后台存档或仓库 data/vocab.json 还原 */
const SYNC_API="/api/vocab";
const SYNC_ON=true;
try{localStorage.removeItem("vocab_sync_key");}catch(e){}
let syncing=false, pushTimer=null, syncAgain=false;
// 2026-11-20 线上测试误写进来的 3 条复习记录（按精确时间认）：本机缓存里有就清掉，免得再推上去
const POISON={v_possessions:1795107503971,v_motion:1795106191839,v_guys:1795104545153};
function unpoison(st){ if(!st||!st.srs)return st; let hit=false; for(const k in POISON){ if(st.srs[k]&&+st.srs[k].at===POISON[k]){delete st.srs[k];hit=true;} } if(hit&&st.progress&&st.progress.v_possessions==="known")delete st.progress.v_possessions; return st; }
function mergeState(a,b){ // union of two states; on same id, b wins. deletions propagate.
  a=unpoison(a||def()); b=unpoison(b||def());
  const byId={};
  (a.custom||[]).forEach(e=>{if(e&&e.id)byId[e.id]=e;});
  (b.custom||[]).forEach(e=>{if(e&&e.id&&!((+(byId[e.id]||{}).u||0)>(+e.u||0)))byId[e.id]=e;}); // 词条带修改时间 u：以新的为准
  const deleted=Array.from(new Set([...(a.deleted||[]),...(b.deleted||[])]));
  const del=new Set(deleted);
  const custom=Object.values(byId).filter(e=>!del.has(e.id));
  // 掌握状态：同一个词两边都有时间就按新的为准；都没有时间按以前的规矩（b 有就用 b）
  const ap=a.progress||{},bp=b.progress||{},pa=a.progAt||{},pb=b.progAt||{},progress={},progAt=tMax(pa,pb);
  for(const k of new Set([...Object.keys(ap),...Object.keys(bp)])){const ta=+pa[k]||0,tb=+pb[k]||0,w=ta>tb?ap:tb>ta?bp:(k in bp?bp:ap);if(k in w)progress[k]=w[k];}
  // 待整理队列：一个词最近一次拿掉的时间比加入的新，就不要了
  const pendAdd=tMax(a.pendAdd,b.pendAdd),pendDel=tMax(a.pendDel,b.pendDel);
  const pend={};[...(a.pending||[]),...(b.pending||[])].forEach(w=>{const k=(w+"").toLowerCase();if(w&&(!pendDel[k]||(pendAdd[k]||0)>pendDel[k]))pend[k]=w;});
  const pending=Object.values(pend);
  const srs=Object.assign({},a.srs||{}); for(const k in (b.srs||{})){const x=b.srs[k]; if(x&&(!srs[k]||(+x.at||0)>=(+srs[k].at||0)))srs[k]=x;} // 复习进度：同一个词以最近练习的为准
  return {custom,progress,deleted,pending,srs,progAt,pendAdd,pendDel};
}
const pick=s=>({custom:s.custom||[],progress:s.progress||{},deleted:s.deleted||[],pending:s.pending||[],srs:s.srs||{},progAt:s.progAt||{},pendAdd:s.pendAdd||{},pendDel:s.pendDel||{}});
function adopt(merged){
  if(JSON.stringify(pick(merged))===JSON.stringify(pick(state)))return;
  state.custom=merged.custom;state.progress=merged.progress;state.deleted=merged.deleted;state.pending=merged.pending;state.srs=merged.srs||{};
  state.progAt=merged.progAt||{};state.pendAdd=merged.pendAdd||{};state.pendDel=merged.pendDel||{};vResnap();
  try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){} refresh();
}
async function syncNow(){
  if(syncing){syncAgain=true;return;}
  syncing=true;
  try{
    vStamp(state); // 有的页面改完只调 schedulePush，没走 save
    const r=await fetch(SYNC_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({v:2,state:pick(state)})}); // 本机内容交给后台合并，拿回合并结果
    if(r.ok){const j=await r.json();if(j&&j.ok&&j.state)adopt(mergeState(j.state,state));}
  }catch(e){}finally{syncing=false; if(syncAgain){syncAgain=false;schedulePush();}}
}
function schedulePush(){ clearTimeout(pushTimer); pushTimer=setTimeout(syncNow,1500); }
let state=def(), words=[], filter="all", query="", cat="all", addType="word", sortBy="new", ptag="all";
/* 规律的分类（词条 tag）：顺序 = 「规律」下面分类按钮的顺序；没列到的 tag 排在后面 */
const PTAGS=[["语法规律","📐 语法"],["搭配易混","🔗 搭配易混"],["拼写规律","✏️ 拼写"],["书写规律","🖊 书写标点"],["构词规律","🧱 构词"],["词根","🌱 词根"],["发音规律","🔊 发音"],["口语规律","💬 口语"],["数字规律","🔢 数字"],["日期规律","📅 日期"],["美英差异","🇺🇸🇬🇧 美英"],["场景表达","🧭 场景"],["主题词汇","🗂 主题词汇"]];
function renderPtags(){
  const box=document.getElementById("ptags");if(!box)return;
  box.classList.toggle("on",cat==="pattern");if(cat!=="pattern")return;
  const n={};words.forEach(w=>{if(w.type==="pattern"){const t=w.tag||"其他";n[t]=(n[t]||0)+1;}});
  const L=PTAGS.filter(([t])=>n[t]).concat(Object.keys(n).filter(t=>!PTAGS.some(p=>p[0]===t)).map(t=>[t,t]));
  if(ptag!=="all"&&!n[ptag])ptag="all";
  const all=Object.values(n).reduce((a,b)=>a+b,0);
  box.innerHTML=`<button data-pt="all" class="${ptag==="all"?"on":""}">全部<b>${all}</b></button>`+L.map(([t,l])=>`<button data-pt="${eAttr(t)}" class="${ptag===t?"on":""}">${l}<b>${n[t]}</b></button>`).join("");
}
function sortedWords(){
  let arr=words.map((w,i)=>({w,i}));
  if(sortBy==="az")arr.sort((a,b)=>a.w.word.toLowerCase().localeCompare(b.w.word.toLowerCase()));
  else if(sortBy==="za")arr.sort((a,b)=>b.w.word.toLowerCase().localeCompare(a.w.word.toLowerCase()));
  else if(sortBy==="old")arr.sort((a,b)=>(a.w.date||"").localeCompare(b.w.date||"")||a.i-b.i);
  else arr.sort((a,b)=>(b.w.date||"").localeCompare(a.w.date||"")||b.i-a.i); // "new"
  return arr.map(x=>x.w);
}

function build(){
  const del=new Set(state.deleted);
  const all=(state.custom||[]).filter(w=>w&&w.id&&!del.has(w.id));
  const seen=new Set();
  words=all.filter(w=>{if(seen.has(w.id))return false;seen.add(w.id);return true;})
           .map(w=>({...w,type:w.type||"word",status:state.progress[w.id]||"learning"}));
}
/* 生词本的统计口径（顶部、「🔊 练习」、「📊 统计」都用这一个，数字才对得上）：
   生词 = 单词 + 短语 + 句子（「规律」是参考资料，不算）；已掌握 = 掌握进度 100%（标为已掌握，或练到半衰期 42 天）；
   学习中 = 练过、还没掌握；没练过 = 其余 */
function vocabStats(){
  const L=words.filter(w=>(w.type||"word")!=="pattern"),S=state.srs||{};let known=0,learning=0;
  L.forEach(w=>{if(masteryOf(w)>=1)known++;else if(S[w.id])learning++;});
  return {total:L.length,known,learning,fresh:L.length-known-learning,patterns:words.length-L.length,pct:L.length?known/L.length:0};
}
window.vocabStats=vocabStats;
function counts(){
  const vs=vocabStats(),known=vs.known;
  document.getElementById("num").textContent=vs.total;
  document.getElementById("known-num").textContent=known;
  const tt=(id,t)=>{const e=document.getElementById(id);if(e)e.title=t;};
  tt("st-total","单词 + 短语 + 句子，共 "+vs.total+" 个（另有 "+vs.patterns+" 条规律是参考资料，不算在里面）· 点一下看列表");
  tt("st-learn","练过、还没掌握的；还有 "+vs.fresh+" 个没练过 · 点一下看是哪些");
  tt("st-known","掌握进度 100%：标为已掌握，或练到半衰期 42 天（至少 6 周都很可能记得）· 点一下看是哪些");
  const by=t=>words.filter(w=>w.type===t).length;
  document.getElementById("c-all").textContent=words.length;
  document.getElementById("c-word").textContent=by("word");
  document.getElementById("c-phrase").textContent=by("phrase");
  document.getElementById("c-sentence").textContent=by("sentence");
  document.getElementById("c-pattern").textContent=by("pattern");
  const ln=document.getElementById("learn-num");if(ln)ln.textContent=vs.learning;
  const pct=Math.round(vs.pct*100);
  const rp=document.getElementById("ring-pct");if(rp)rp.textContent=pct+"%";
  const rg=document.getElementById("mastery-ring");if(rg)rg.style.setProperty("--p",pct);
}
function hl(t){return t.replace(/\{([^}]+)\}/g,'<b>$1</b>');}
const CATNAME={word:"单词",phrase:"短语",sentence:"句子",pattern:"规律"};

/* ===== unique real photos via Wikipedia (one per word, no duplicates) ===== */
let imgCache={};
function applyImg(id){
  const arr=imgCache[id];
  document.querySelectorAll('img[data-wimg="'+id+'"]').forEach(im=>{
    if(Array.isArray(arr)&&arr.length){im.src=arr[0];im.style.display="";}
    else if(arr===null||(arr&&arr.none)){im.style.display="none";}
  });
  document.querySelectorAll('[data-wgallery="'+id+'"]').forEach(g=>{
    const bv=g.closest('.bigvisual');
    if(Array.isArray(arr)&&arr.length){
      g.innerHTML=arr.map(u=>'<img src="'+u+'" loading="lazy" onerror="this.style.display=\'none\'">').join("");
      if(bv)bv.style.display="";
    }else{
      g.innerHTML="";
      if(bv)bv.style.display="none";
    }
  });
}
/* 维基百科一次最多问 3 个：生词本页一打开要几百张配图，同时发会被维基限流（429）；
   没连上 / 被限流的不记成「没有图」（以前记了就再也不找），过 10 分钟再试；真的查到没有图才记 null */
let wikiN=0;const wikiQ=[],imgRetry={};
function wikiSlot(){return new Promise(res=>{const go=()=>{wikiN++;res(()=>{wikiN--;const n=wikiQ.shift();if(n)n();});};if(wikiN<3)go();else wikiQ.push(go);});}
async function wikiJson(u){const r=await NET.fetch(u);if(!r.ok)throw new Error("wiki "+r.status);return r.json();}
async function fetchWiki(id){
  const w=words.find(x=>x.id===id);
  if(!w){imgCache[id]=null;return;}
  if(imgRetry[id]>Date.now())return;
  imgCache[id]="pending";
  const done=await wikiSlot();let failed=false;
  const BAD=/(Commons-logo|Wiktionary|Edit-|OOjs|Ambox|Question_book|Wikidata|Red_pog|Location|_map|\bmap\b|Increase|Decrease|icon|logo|flag|disambig|placeholder|no[_-]?image|nuvola|symbol|\.svg)/i;
  let urls=[];
  try{
    if(w.wiki){ // curated page → accurate representative image (en.wikipedia)
      const title=encodeURIComponent(w.wiki);
      const j=await wikiJson("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=original%7Cthumbnail&pithumbsize=700&titles="+title);
      const pg=j&&j.query&&j.query.pages;
      if(pg){const p=Object.values(pg)[0]||{};const src=(p.original&&p.original.source)||(p.thumbnail&&p.thumbnail.source);if(src&&!BAD.test(src))urls.push(src);}
      if(urls.length<4){
        const j2=await wikiJson("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=images&gimlimit=25&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=700&titles="+title);const pg2=j2&&j2.query&&j2.query.pages;
        if(pg2)Object.values(pg2).forEach(p=>{if(urls.length>=4)return;const ii=p.imageinfo&&p.imageinfo[0];if(!ii)return;if(!/^image\//.test(ii.mime||"")||/svg/i.test(ii.mime||""))return;const src=ii.thumburl||ii.url;if(!src||BAD.test(src))return;if(urls.indexOf(src)<0)urls.push(src);});
      }
    }
    if(urls.length<2){ // no curated page, or too few → search Wikimedia Commons by the word
      const q=encodeURIComponent((w.wiki||w.word||"").replace(/[{}]/g,"").trim());
      const j3=await wikiJson("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch="+q+"&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url%7Cmime&iiurlwidth=700");const pg3=j3&&j3.query&&j3.query.pages;
      if(pg3)Object.values(pg3).sort((a,b)=>(a.index||0)-(b.index||0)).forEach(p=>{
        if(urls.length>=4)return;
        const ii=p.imageinfo&&p.imageinfo[0];if(!ii)return;
        if(!/^image\//.test(ii.mime||"")||/svg/i.test(ii.mime||""))return;
        const src=ii.thumburl||ii.url;if(!src||BAD.test(src))return;
        if(urls.indexOf(src)<0)urls.push(src);
      });
    }
  }catch(e){failed=true;}
  done();
  if(failed&&!urls.length){imgCache[id]=null;applyImg(id);delete imgCache[id];imgRetry[id]=Date.now()+10*60e3;return;} // 没连上：先不显示，下次再找
  imgCache[id]=urls.length?urls:null;
  applyImg(id);
  imgSave();
}
function populateImgs(){
  const ids=new Set();
  document.querySelectorAll("[data-wimg],[data-wgallery]").forEach(im=>ids.add(im.getAttribute("data-wimg")||im.getAttribute("data-wgallery")));
  ids.forEach(id=>{
    const c=imgCache[id];
    if(Array.isArray(c)||(c&&c.none))applyImg(id); // 有图 / 记着没图：直接用
    else if(c===undefined)fetchWiki(id);
  });
  populateRowImgs();
}
/* ===== per-row thumbnails inside 对照表 (forms[i][3] = wikipedia page title) ===== */
let rowImgCache={};
function applyRowImg(title){
  const u=rowImgCache[title];
  document.querySelectorAll('img.rowthumb[data-rowimg="'+(title||"").replace(/"/g,'\\"')+'"]').forEach(im=>{
    if(typeof u==="string"&&u){im.src=u;im.style.display="";}
    else if(u===null){im.style.display="none";}
  });
}
async function fetchRowImg(title){
  if(!title)return;
  if(imgRetry["r:"+title]>Date.now())return;
  rowImgCache[title]="pending";
  const done=await wikiSlot();
  try{
    const j=await wikiJson("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=220&titles="+encodeURIComponent(title));
    const pg=j&&j.query&&j.query.pages;
    let src=null;
    if(pg){const p=Object.values(pg)[0]||{};src=(p.thumbnail&&p.thumbnail.source)||null;}
    rowImgCache[title]=src;
  }catch(e){delete rowImgCache[title];imgRetry["r:"+title]=Date.now()+10*60e3;done();return;} // 没连上不记成「没有图」
  done();
  applyRowImg(title);
  imgSave();
}
function populateRowImgs(){
  const titles=new Set();
  document.querySelectorAll("img.rowthumb[data-rowimg]").forEach(im=>titles.add(im.getAttribute("data-rowimg")));
  titles.forEach(t=>{
    const c=rowImgCache[t];
    if(typeof c==="string"&&c!=="pending")applyRowImg(t);
    else if(c===null)applyRowImg(t);
    else if(c===undefined)fetchRowImg(t);
  });
}
function eHtml(s){return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function eAttr(s){return (s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function noBrace(s){return (s||"").split("{").join("").split("}").join("");}
let voices=[], chosenVoice=null;
// 朗读按当前学习语言（window.VL，见最上面那段）挑系统语音：英语 en-*，德语 de-*；AI 真人声（tts.js，deepgram）只会英语，别的语言直接用系统语音
const VLX=window.VL&&window.VL!=="en"?window.VL:"en";
function enVoices(){
  const all=(window.speechSynthesis&&window.speechSynthesis.getVoices)?window.speechSynthesis.getVoices():[];
  if(VLX==="de")return all.filter(v=>/^de[-_]/i.test(v.lang)||/german|deutsch/i.test(v.name));
  return all.filter(v=>/^en[-_]/i.test(v.lang)||/english/i.test(v.name));
}
function bestVoiceIndex(){
  const pref=VLX==="de"?[/google deutsch/i,/anna/i,/(enhanced|premium|natural|neural)/i,/^de-de/i]:[/google us english/i,/google uk english female/i,/samantha/i,/ava/i,/allison/i,/serena/i,/aaron/i,/(enhanced|premium|natural|neural)/i,/^en-us/i,/^en-gb/i];
  for(const p of pref){const i=voices.findIndex(v=>p.test(v.name)||p.test(v.lang));if(i>=0)return i;}
  return voices.length?0:-1;
}
function loadVoices(){
  voices=enVoices();
  const sel=document.getElementById("voice-sel");
  if(!sel)return;
  const ai=VLX==="en"?'<option value="ai">🤖 AI 真人声（推荐）</option>':'';
  if(!voices.length){sel.innerHTML=ai+'<option value="none">此设备暂无'+(VLX==="de"?"德语":"英语")+'语音</option>';sel.value=window.TTS&&TTS.mode()==="sys"?"none":"ai";return;}
  sel.innerHTML=ai+voices.map((v,i)=>`<option value="${i}">${v.name.replace(/^(Microsoft|Google)\s/,"")} · ${v.lang}</option>`).join("");
  let idx=state.voice?voices.findIndex(v=>v.name===state.voice):-1;
  if(idx<0)idx=bestVoiceIndex();
  if(idx>=0){sel.value=idx;chosenVoice=voices[idx];}
  if(VLX==="en"&&window.TTS&&TTS.mode()!=="sys")sel.value="ai";
}
// 全站朗读入口：先交给 AI 真人声（tts.js），播不了再用系统语音；o.rate 是相对正常速度的倍数（练习页的慢速用）
function speak(text,o){
  o=o||{};
  if(window.TTS&&TTS.say){TTS.say(text,{rate:o.rate||1,end:o.end,lang:VLX});return;} // 全站共用的朗读：tts.js 的 TTS.say（声音、语速按「⚙ 设置」）
  sysSpeak(text,o);
}
function sysSpeak(text,o){
  o=o||{};
  if(window.TTS&&TTS.sys){TTS.sys(text,{rate:o.rate||1,end:o.end,lang:VLX});return;}
  try{
    if(window.TTS)TTS.stop();
    if(!("speechSynthesis" in window)){toast("此环境不支持朗读，可在手机浏览器打开");return;}
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    if(chosenVoice){u.voice=chosenVoice;u.lang=chosenVoice.lang;}else{u.lang=VLX==="de"?"de-DE":"en-US";}
    u.rate=(state.rate||0.95)*(o.rate||1);u.pitch=1;
    if(o.end){u.onend=()=>o.end();u.onerror=()=>o.end(true);}
    window.speechSynthesis.speak(u);
  }catch(e){toast("朗读失败");}
}

/* ===== self-test (cover & reveal) ===== */
/* ===== 掌握进度（和「🔊 练习」pump.js 同一个算法）：Ebisu 半衰期到 42 天（6 周，同 Language Reactor）= 100 % 已掌握，中间按对数换算 ===== */
function masteryOf(w){
  if(!w)return 0; if(w.status==="known")return 1;
  const r=(state.srs||{})[w.id]; if(!r||!(r.h||r.s||r.b))return 0;
  const h=r.h||r.s||[0.5,1,3,7,16,35,90][r.b||0]||0.5; return Math.min(1,Math.log(1+h)/Math.log(43));
}
function masteryHtml(w){
  const m=masteryOf(w),k=m>=1,p=Math.round(m*100);
  return `<div class="mprog${k?" known":""}" title="掌握进度：半衰期到 42 天（至少 6 周都很可能记得）算已掌握"><span class="pp-mb${k?" known":""}"><i style="width:${p}%"></i></span><b>${k?"🏆 已掌握":p+"%"}</b></div>`;
}
/* ===== list ===== */
function renderList(){
  const box=document.getElementById("list");
  let arr=sortedWords();
  if(cat!=="all")arr=arr.filter(w=>w.type===cat);
  renderPtags();if(cat==="pattern"&&ptag!=="all")arr=arr.filter(w=>(w.tag||"其他")===ptag);
  if(filter!=="all"){const S=state.srs||{},st=w=>masteryOf(w)>=1?"known":S[w.id]?"practicing":"fresh";arr=arr.filter(w=>(w.type||"word")!=="pattern"&&(filter==="learning"?st(w)!=="known":st(w)===filter));} // 学习中 / 没练过 / 已掌握：和上面的数字同一个算法（vocabStats），三个加起来 = 生词（规律不算）；learning = 旧的「未掌握」
  if(query){const q=query.toLowerCase();arr=arr.filter(w=>w.word.toLowerCase().includes(q)||w.zh.includes(query));}
  if(!arr.length){box.innerHTML='<div class="empty">这个分类还没有内容。<br>问我新词/短语/台词，或用“添加”自己加进来。</div>';return;}
  LIST_ARR=arr;const key=[cat,ptag,filter,query,sortBy].join("|"),keep=key===listKey?Math.max(LIST_PAGE,listShown):LIST_PAGE;listKey=key;listShown=0; // 同样的筛选再画（标了已掌握、同步回来）：画到原来那么多，不跳位置
  box.innerHTML="";appendCards(keep);
}
// 📱 卡片按需画：一次画 40 张，滚到底附近再画下一批（以前 500 多个词一次全画，四万多个元素，手机上切到「📖 词汇」、改一个词都要卡一下）；
//   卡片里的中文、词形、例句（点开才看得到的部分）也是点开时才画
let LIST_ARR=[],listShown=0,listKey="",listIO=null;const LIST_PAGE=40;
function cardHtml(w){return `
   <div class="card card--${w.type} ${w.status==="known"?"known":""}" data-id="${w.id}">
     <div class="stamp">已掌握</div>
     <div class="card-head">
       <div>
         ${w.type!=="word"?`<span class="typebadge ${w.type}">${CATNAME[w.type]}</span>`:""}
         <div class="word-row">${w.type==="pattern"&&!w.wiki?"":`<img class="thumb-sm" data-wimg="${w.id}" alt="" loading="lazy">`}<span class="word">${w.word}</span><button class="say" data-say="${eAttr(noBrace(w.word))}" title="朗读">🔊</button></div>
         ${w.phon?`<div class="phon">${w.phon}</div>`:""}
         ${w.en?`<div class="endef">${w.en}</div>`:""}
         ${w.type==="sentence"||w.type==="pattern"?`<div class="rdpv">${w.zh?`<div class="z">${w.zh}</div>`:""}${w.forms&&w.forms.length?`<div class="r">${w.forms.slice(0,4).map(f=>noBrace(String(f[0]))).join(" · ")}</div>`:""}</div>`:""}
         <div class="tagrow">${w.tag?`<span class="tag">${w.tag}</span>`:""}<span class="tag">${w.date||""}</span>${w.type==="sentence"||w.type==="pattern"?`<span class="tag">${[(w.forms||[]).length?(w.forms.length+" 行"):"",(w.examples||[]).length?(w.examples.length+" 例句"):""].filter(Boolean).join(" · ")}</span>`:""}</div>
         ${masteryHtml(w)}
       </div>
       ${w.type==="sentence"||w.type==="pattern"?`<svg class="chev go" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>`:`<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`}
     </div>
     <div class="body"></div>
   </div>`;}
function cardBodyHtml(w){return `
       ${w.type==="pattern"&&!w.wiki?"":`<div class="bigvisual" style="display:none"><div class="gallery" data-wgallery="${w.id}"></div></div>`}<!-- 规律类标题是中文，按标题搜到的图不相干：只有手动指定了维基条目（wiki 字段）的才显示封面，其余只用对照表每行自己的小图 -->
       <div class="sec-label">中文意思</div><div class="zh-full">${w.zh}</div>
       ${w.forms&&w.forms.length?`<div class="sec-label">${w.type==="sentence"?"常用句":(w.type==="pattern"?"对照表":"词形变化")}</div><div class="forms">${w.forms.map(f=>`<div>${f[3]?(String(f[3]).charAt(0)==="#"?`<span class="rowswatch" style="background:${eAttr(f[3])}"></span>`:`<img class="rowthumb" data-rowimg="${eAttr(f[3])}" alt="" loading="lazy">`):""}<span class="f">${f[0]}</span><span class="p">${f[1]}</span><span class="m">${f[2]}</span></div>`).join("")}</div>`:""}
       ${w.examples&&w.examples.length?`<div class="sec-label">例句</div>${w.examples.map(e=>`<div class="ex"><div class="en"><button class="say say-sm" data-say="${eAttr(noBrace(e[0]))}" title="朗读">🔊</button>${hl(e[0])}</div><div class="t">${e[1]}</div></div>`).join("")}`:""}
       ${w.tip?`<div class="sec-label">${w.type==="sentence"?"用法提示":"记忆法"}</div><div class="tip">${w.type==="sentence"?"💬":"🧠"} ${w.tip}</div>`:""}
       ${w.related&&w.related.length?`<div class="sec-label">近义 / 相关词</div><div class="related">${w.related.map(r=>`<span class="relchip" data-say="${eAttr(r[0])}" title="朗读"><b>${r[0]}</b>${r[1]?` ${r[1]}`:""}</span>`).join("")}</div>`:""}
       <div class="actions">
         <button class="mark ${w.status==="known"?"on":""}" data-act="mark">${w.status==="known"?"已掌握 ✓":"标记已掌握"}</button>
         <button class="del" data-act="del">删除</button>
       </div>
     `;}
function appendCards(n){
  const box=document.getElementById("list");if(!box)return;
  const old=document.getElementById("list-more");if(old)old.remove();
  const next=LIST_ARR.slice(listShown,listShown+(n||LIST_PAGE));listShown+=next.length;
  const left=LIST_ARR.length-listShown;
  box.insertAdjacentHTML("beforeend",next.map(cardHtml).join("")+(left>0?`<div id="list-more" class="list-more"><button type="button" data-more="1">显示更多（还有 ${left} 个）</button></div>`:""));
  populateImgs();
  const more=document.getElementById("list-more");
  if(more&&"IntersectionObserver" in window){if(!listIO)listIO=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){listIO.disconnect();appendCards();}},{rootMargin:"800px 0px"});listIO.disconnect();listIO.observe(more);}
}

/* ===== export ===== */
function download(name,text,type){U.download(name,text,type);} // ⬇️ 全站共用（util.js）
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),1800);}

/* ===== events ===== */
function refresh(){build();prunePending();counts();renderList();renderPending();if(window.pumpRefresh)pumpRefresh();if(window.grammarRefresh)grammarRefresh();if(window.readingRefresh&&document.getElementById("reading").classList.contains("on"))readingRefresh();if(window.statsRefresh)statsRefresh();}

// ⭐ 已保存：装了插件嵌插件页面（能编辑），没装显示网站只读版；插件晚一点连上会自动换过来
// 插件同步的是插件设置里选的那个人（data-ban-user，旧版插件没有 = 主人）：和网站当前用户不是同一个人时不嵌插件页面，显示网站版
function savedShow(){
  const box=document.getElementById("savedbox"),ext=document.documentElement.getAttribute("data-ban-ext")||"",id=ext&&(document.documentElement.getAttribute("data-ban-user")||"")===(window.VU||"")?ext:"",web=!id&&!!window.savedWeb;
  box.classList.toggle("web",!id);
  if(id){const u="chrome-extension://"+id+"/saved.html",xf=document.getElementById("extframe");if(xf.getAttribute("src")!==u)xf.setAttribute("src",u);document.getElementById("ext-open").href=u;}
  else if(web)window.savedWeb.render(document.getElementById("ext-web"));
}
window.addEventListener("ban-ext",()=>{if(document.documentElement.getAttribute("data-mode")==="saved")savedShow();});

/* ===== 👤 家人：切换用户（数据各自分开，不设密码；原理见 <head> 里最前面那段） ===== */
(function(){
  const btn=document.getElementById("who"),nameEl=document.getElementById("who-name");if(!btn)return;
  const menu=document.createElement("div");menu.className="who-menu";document.body.append(menu);
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let users=null;try{users=JSON.parse(localStorage.getItem("vu:list")||"null");}catch(e){}
  const me=()=>(users||[]).find(x=>x.id===(window.VU||""));
  const paint=()=>{const m=me();nameEl.textContent=m?m.name:(window.VU?window.VU:"Ray");};
  paint();
  const load=()=>fetch("/api/users",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(j&&j.ok){users=j.users;try{localStorage.setItem("vu:list",JSON.stringify(users));}catch(e){}
    if(window.VU&&!users.some(x=>x.id===window.VU)){try{localStorage.removeItem("vu");}catch(e){}location.reload();return;} paint();}}).catch(()=>{});
  load();
  const close=()=>menu.classList.remove("on");
  function open(){
    const L=users||[{id:"",name:"Ray"}];
    menu.innerHTML=L.map(x=>`<button data-u="${esc(x.id)}" class="${x.id===(window.VU||"")?"on":""}">👤 ${esc(x.name)}</button>`).join("")+
      `<hr><button data-act="add">＋ 添加家人</button><button data-act="rename">✎ 改我的名字</button>${window.VU?'<button data-act="remove">✕ 删掉我（只能删还没内容的）</button>':""}<hr><button data-act="auth">🔒 写入口令</button><div class="who-tip">每个人的生词本、练习进度、已保存、标记各自分开，家里人都能切换。写入口令只在整份还原、一次删很多词这类大改动时才要。</div>`;
    const r=btn.getBoundingClientRect();menu.classList.add("on");
    const w=menu.offsetWidth;menu.style.left=Math.max(16,Math.min(r.left,innerWidth-w-16))+"px";menu.style.top=(r.bottom+6)+"px";
  }
  async function switchTo(id){
    if(id===(window.VU||""))return close();
    close();toast("正在切换…");
    try{if(typeof syncNow==="function")await Promise.race([syncNow(),new Promise(r=>setTimeout(r,4000))]);}catch(e){} // 先把这个人没传完的改动传上去
    try{if(id)localStorage.setItem("vu",id);else localStorage.removeItem("vu");}catch(e){}
    location.reload();
  }
  async function post(body){const r=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!j.ok)throw new Error(j.error||"失败");users=j.users;try{localStorage.setItem("vu:list",JSON.stringify(users));}catch(e){}return j;}
  btn.onclick=e=>{e.stopPropagation();menu.classList.contains("on")?close():(open(),load().then(()=>{if(menu.classList.contains("on"))open();}));};
  menu.onclick=async e=>{
    e.stopPropagation();const b=e.target.closest("button");if(!b)return;
    if(b.dataset.u!=null)return switchTo(b.dataset.u);
    if(b.dataset.act==="auth"){close();if(window.authUI)window.authUI();return;}
    if(b.dataset.act==="add"){const n=((await U.input("家人的名字（比如：妈妈、Lily）",""))||"").trim();if(!n)return; // ✅ 全站共用的弹窗（util.js）
      try{const j=await post({add:n});if(await U.ask("已添加「"+j.user.name+"」，现在切换过去吗？",{ok:"切换过去",cancel:"先不切"}))switchTo(j.user.id);else open();}catch(er){U.tip("没加上："+er.message);}}
    if(b.dataset.act==="rename"){const m=me(),n=((await U.input("改成什么名字？",m?m.name:""))||"").trim();if(!n)return;
      try{await post({rename:{id:window.VU||"",name:n}});paint();open();}catch(er){U.tip("没改成："+er.message);}}
    if(b.dataset.act==="remove"){const m=me();if(!(await U.ask("删掉「"+(m?m.name:window.VU)+"」？只有还没收词、没保存内容的才能删（加错名字时用）。",{ok:"删掉",danger:true})))return;
      try{await post({remove:window.VU});try{localStorage.removeItem("vocab_state_v1");localStorage.removeItem("vu");}catch(x){}location.reload();}catch(er){U.tip("没删："+er.message);}}
  };
  document.addEventListener("click",close);window.addEventListener("resize",close);
})();
// ⚙ 设置（朗读、导出）：弹窗，练习页右上角的齿轮打开
window.openVocabSettings=function(){const p=document.getElementById("export-panel"),m=document.getElementById("sp-mask");p.classList.add("pop");m.classList.add("on");};
function closeVocabSettings(){document.getElementById("export-panel").classList.remove("pop");document.getElementById("sp-mask").classList.remove("on");}
document.getElementById("sp-close").onclick=closeVocabSettings;document.getElementById("sp-mask").onclick=closeVocabSettings;
document.querySelectorAll(".modes button").forEach(b=>b.onclick=()=>{
  if(window.VL==="de"&&/^(saved|grammar)$/.test(b.dataset.mode)){const l=document.querySelector('.modes button[data-mode="list"]');if(l&&l!==b)return l.click();} // 🇩🇪 英语专用的模式：学德语时不进（按钮也藏起来了）
  document.querySelectorAll(".modes button").forEach(x=>x.classList.remove("on"));b.classList.add("on");
  const m=b.dataset.mode;
  document.documentElement.setAttribute("data-mode",m);
  document.getElementById("list-view").style.display=m==="list"?"block":"none";
  document.getElementById("pump").classList.toggle("on",m==="pump"); if(m==="pump"&&window.pumpShow)pumpShow();
  document.getElementById("savedbox").classList.toggle("on",m==="saved"); if(m==="saved")savedShow();
  document.getElementById("grammar").classList.toggle("on",m==="grammar"); if(m==="grammar"&&window.grammarShow)grammarShow();
  document.getElementById("reading").classList.toggle("on",m==="reading"); if(m==="reading"&&window.readingShow)readingShow();
  {const sm=document.getElementById("sme"); if(sm){sm.classList.toggle("on",m==="sme"); if(m==="sme"&&window.smeShow)smeShow();}}
  {const dr=document.getElementById("drill"); if(dr){dr.classList.toggle("on",m==="drill"); if(m==="drill"&&window.drillShow)drillShow(); else if(window.drillHide)drillHide();}}
  document.getElementById("stats").classList.toggle("on",m==="stats"); if(m==="stats"&&window.statsShow)statsShow();
  {const ew=document.getElementById("errwrap"); if(ew){ew.style.display=m==="err"?"block":"none"; if(m==="err"&&window.errShow)errShow(ew);}}
  const wv=document.getElementById("ielts-write-view"); if(wv){wv.style.display=m==="writing"?"block":"none"; if(m==="writing"&&window.writingShow&&!wv.dataset.on){wv.dataset.on="1";Promise.resolve(writingShow(wv)).catch(()=>{delete wv.dataset.on;});} /* 写作页没加载出来：下次点「✍️ 写」再试 */}
  try{localStorage.setItem("vocab_mode",m);}catch(e){}
  if(window.enSync)enSync(m); // 阅读 → 「📰 读」，语法 / 写作批改 → 「✍️ 写」，其它 → 「📖 词汇」（别的页面直接点模式按钮跳过来时，上面的标签跟着变）
  
  document.getElementById("export-panel").classList.toggle("on",m==="export");
});

document.getElementById("list").addEventListener("click",async e=>{
  if(e.target.closest("[data-more]")){appendCards();return;}
  const sb=e.target.closest(".say");if(sb){e.stopPropagation();speak(sb.dataset.say);return;}
  const rc=e.target.closest(".relchip");if(rc){e.stopPropagation();speak(rc.dataset.say);return;}
  const card=e.target.closest(".card");if(!card)return;
  const id=card.dataset.id;const act=e.target.closest("[data-act]");
  if(act){
    if(act.dataset.act==="mark"){
      const w=words.find(x=>x.id===id);
      state.progress[id]=w.status==="known"?"learning":"known";refresh();save(state);
    }else if(act.dataset.act==="del"){
      if(!state.deleted.includes(id))state.deleted.push(id);
      state.custom=state.custom.filter(c=>c.id!==id);refresh();toast("已删除");save(state);
    }
    return;
  }
  const w0=words.find(x=>x.id===id);
  if(w0&&(w0.type==="sentence"||w0.type==="pattern")&&window.openReader){ // 句子、规律：点开进全屏查看页（reader.js），可以上一条 / 下一条翻
    const L=LIST_ARR.filter(w=>w.type==="sentence"||w.type==="pattern"); // 按当前筛选的整个列表（卡片是分批画的，不能从页面上数）
    openReader(L.map(readerFromWord),L.indexOf(w0));return;
  }
  const body=card.querySelector(".body");if(body&&!body.childElementCount&&w0){body.innerHTML=cardBodyHtml(w0);populateImgs();} // 第一次点开才画详情
  card.classList.toggle("open");
});
// 全屏查看页顶栏的「标记已掌握 / 删除」：不带 act 时只返回当前状态
window.readerAct=(id,act)=>{
  const w=words.find(x=>x.id===id);if(!w)return null;
  if(act==="mark"){state.progress[id]=w.status==="known"?"learning":"known";refresh();save(state);}
  else if(act==="del"){if(!state.deleted.includes(id))state.deleted.push(id);state.custom=state.custom.filter(c=>c.id!==id);refresh();toast("已删除");save(state);return "del";}
  const w2=words.find(x=>x.id===id);return w2?w2.status:null;
};

document.getElementById("q").oninput=e=>{query=e.target.value.trim();renderList();};
document.getElementById("sort-sel").onchange=e=>{
  sortBy=e.target.value;state.sort=sortBy;save(state);
  renderList();
};
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("on"));b.classList.add("on");filter=b.dataset.f;renderList();
});
function setCat(c){
  cat=c;
  document.querySelectorAll("[data-c]").forEach(b=>b.classList.toggle("on",b.dataset.c===c));
  renderList();
}
document.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>setCat(b.dataset.c));
document.getElementById("ptags").onclick=e=>{const b=e.target.closest("[data-pt]");if(!b)return;ptag=b.dataset.pt;try{localStorage.setItem("list:ptag",ptag);}catch(x){}renderList();};
try{ptag=localStorage.getItem("list:ptag")||"all";}catch(x){}


/* ===== quick collect (from videos / web pages) ===== */
// 查词：后台 /api/dict；后台拿不到中文时（谷歌会拦机房 IP），在浏览器里直接查谷歌翻译补上（插件、练习页也是这样查的）
window.dictGet=async function(word){
  let j=null;
  // 🇩🇪 学德语：后台 /api/dict?lang=de（中文 + 维基词典的德语词条：词性、名词的性 der/die/das、音标、英文释义、变形的原形 + Tatoeba 德语例句）
  try{const r=await fetch("/api/dict?"+(window.VL==="de"?"lang=de&":"")+"w="+encodeURIComponent(word));j=await r.json();}catch(e){}
  if(j&&j.ok&&j.zh)return j;
  try{const g=await TR.word(word); // 全站共用的翻译（tr.js）
    const zh=g.zh[0]||"",zhs=g.pos.map(x=>({pos:x.p||"",terms:x.w}));
    if(zh){j=j&&j.ok?j:{ok:true,word:word,phon:"",audio:"",en:[],examples:[]};j.zh=zh;j.zhs=zhs;}}catch(e){}
  return j&&j.ok?j:null;
};
async function enrich(entry){ // 后台 /api/dict 一次拿齐：中文（谷歌翻译）、音标和英文释义（dictionaryapi.dev）、例句（Tatoeba）；后台不通再用老办法
  try{
    const j=await window.dictGet(entry.word);
    if(j&&j.ok){
      if(j.phon)entry.phon=j.phon;
      const de=window.VL==="de";
      if(de&&j.word&&j.word!==entry.word&&j.word.toLowerCase()===String(entry.word).toLowerCase())entry.word=j.word; // 德语名词大写：haus → Haus
      const zs=(j.zhs||[]).map(x=>(x.terms||[]).slice(0,3).join("、")).filter(Boolean);
      entry.zh=[j.zh].concat(zs).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,3).join("；")||"(未查到，可手动补)";
      const d=(j.en||[])[0];entry.en=d?(de&&j.gender?j.gender+" "+entry.word+" · ":"")+(d.pos?"("+d.pos+") ":"")+d.def:(de&&j.gender?j.gender+" "+entry.word:"");
      if(de&&j.lemma&&!entry.tip)entry.tip="原形："+j.lemma;
      const wre=entry.word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),re=de?new RegExp("(^|[^\\p{L}])("+wre+"\\p{L}*)","iu"):new RegExp("\\b("+wre+"\\w*)","i"),mk=de?"$1{$2}":"{$1}"; // 德语：\b 认不出 ä ö ü ß
      const ex=(j.examples||[]).map(x=>[String(x[0]).replace(re,mk),x[1]||""]);
      (j.en||[]).forEach(x=>{if(x.ex&&ex.length<4)ex.push([String(x.ex).replace(re,mk),""]);});
      entry.examples=(entry.examples||[]).concat(ex).slice(0,4);
      if(j.audio)entry.audio=j.audio;
      return;
    }
  }catch(e){}
  const sl=window.VL&&window.VL!=="en"?window.VL:"en"; // 学德语：英语词典不查，翻译按德语
  if(sl==="en")try{
    const r=await NET.fetch("https://api.dictionaryapi.dev/api/v2/entries/en/"+encodeURIComponent(entry.word));
    const j=await r.json();
    if(Array.isArray(j)&&j[0]){
      if(j[0].phonetic)entry.phon=j[0].phonetic;
      else if(j[0].phonetics){const p=j[0].phonetics.find(x=>x.text);if(p)entry.phon=p.text;}
      for(const m of (j[0].meanings||[])){
        for(const d of (m.definitions||[])){
          if(d.definition&&entry.en==="(查询中…)")entry.en=d.definition;
          if(d.example&&!entry.examples.length)entry.examples=[[d.example,""]];
        }
      }
    }
  }catch(e){}
  try{
    const r2=await fetch("https://api.mymemory.translated.net/get?q="+encodeURIComponent(entry.word)+"&langpair="+sl+"|zh-CN");
    const j2=await r2.json();
    if(j2&&j2.responseData&&j2.responseData.translatedText)entry.zh=j2.responseData.translatedText;
  }catch(e){}
  if(entry.en==="(查询中…)")entry.en="";
  if(entry.zh==="(翻译中…)")entry.zh="(未查到，可手动补)";
}
async function quickAdd(word,sentence){
  word=(word||"").trim().normalize("NFC").replace(/[’‘]/g,"'").replace(/[^\p{L}' -]/gu,"").replace(/\s+/g," "); // 字母包括 ä ö ü ß é（以前只认 A–Z，德语 Mädchen 会存成 Mdchen）
  if(!word)return false;
  if(words.some(w=>w.word.toLowerCase()===word.toLowerCase())){return false;}
  const re=new RegExp("(?<![\\p{L}])("+word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\p{L}*)","iu"),own=sentence&&re.test(sentence)?[[String(sentence).trim().replace(re,"{$1}"),""]]:[];
  const entry={id:"u_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),type:/\s/.test(word)?"phrase":"word",word:word,
    phon:"",en:"(查询中…)",zh:"(翻译中…)",tag:"收集",date:ymdLocal(),forms:[],examples:own,tip:"",auto:1}; // auto：自动生成的词条（想要多义项、记忆法时再发给 Claude 补）
  state.custom.push(entry);refresh();save(state);
  await enrich(entry);refresh();save(state);
  return true;
}
async function addMany(list){
  let added=0,dup=0;
  for(const w of list){const ok=await quickAdd(w);if(ok)added++;else if(w.trim())dup++;}
  toast("已添加 "+added+" 个"+(dup?("，跳过 "+dup+" 个重复"):""));
}
function escHtml(s){return (s+"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function addPending(list){ // 书签收的词：直接自动生成词条（不再等整理）；生成不了的才留在待整理队列
  addMany(list);
}
function addPendingQueue(list){
  let added=0,dup=0;
  const known=new Set(words.map(w=>w.word.toLowerCase()));
  state.pending=state.pending||[];
  const pend=new Set(state.pending.map(s=>(s+"").toLowerCase()));
  for(let w of list){
    w=(w||"").trim().replace(/\s+/g," ");
    if(!w)continue;
    const k=w.toLowerCase();
    if(known.has(k)||pend.has(k)){dup++;continue;}
    state.pending.push(w);pend.add(k);added++;
  }
  save(state);renderPending();
  toast(added?("已进待整理 "+added+" 个"+(dup?("，跳过 "+dup):"")):(dup?"已在队列或已收录":"没有可添加的词"));
}
function prunePending(){ // drop words that are already in the notebook
  if(!state.pending||!state.pending.length)return;
  const known=new Set(words.map(w=>w.word.toLowerCase()));
  const before=state.pending.length;
  state.pending=state.pending.filter(w=>!known.has((w+"").toLowerCase()));
  if(state.pending.length!==before)save(state);
}
function renderPending(){
  const box=document.getElementById("pending-box");if(!box)return;
  const p=state.pending||[];
  if(!p.length){box.innerHTML='';return;} // 队列空就不显示（「📒 加生词」书签收的词会先进这里，发给 Claude 整理后才进列表）
  box.innerHTML='<div class="pend-card"><div style="font-size:13px;font-weight:700;color:var(--accent);margin:2px 0 8px">📤 待整理 '+p.length+' 个 · 发给 Claude 做成完整词条</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'+p.map(w=>'<span style="font-size:13px;background:var(--paper-2);border:1px solid var(--line);border-radius:999px;padding:4px 11px">'+escHtml(w)+'</span>').join('')+'</div>'+
    '<div class="vrow"><button id="pend-auto" class="bulk-btn primary-btn">⚡ 自动生成词条</button><button id="pend-copy" class="bulk-btn">📋 复制发给 Claude</button><button id="pend-clear" class="bulk-btn">清空</button></div></div>';
  const cp=document.getElementById("pend-copy");if(cp)cp.onclick=async()=>{const t=(state.pending||[]).join("\n");if(await U.copy(t,{ok:"已复制，粘贴发给 Claude",manual:false})){}else{download("pending.txt",t,"txt");toast("已下载为文本");}};
  const au=document.getElementById("pend-auto");if(au)au.onclick=async()=>{const L=(state.pending||[]).slice();au.disabled=true;au.textContent="生成中…";await addMany(L);prunePending();renderPending();};
  const cl=document.getElementById("pend-clear");if(cl)cl.onclick=async()=>{if(await U.ask("清空待整理队列？",{ok:"清空",danger:true})){state.pending=[];save(state);renderPending();}};
}
// 阅读、视频等页面「＋ 加入生词本」：查词典自动生成词条，带上原句
window.vocabAddWord=async(word,sentence)=>{const ok=await quickAdd(word,sentence);toast(ok?"已加入生词本："+word:"已在生词本里");return ok;};
// ===== 🗑 回收站：30 天内删掉的词条（后台 /api/vocab?trash=1），恢复时用新 id 加回去（删除记录只增不减），复习进度一起带回 =====
async function renderTrash(){
  const box=document.getElementById("trash-box");if(!box)return;
  if(!box.classList.contains("on")){box.innerHTML="";return;}
  box.innerHTML='<div class="trash-card">读取中…</div>';
  let items=[];try{items=(await (await fetch("/api/vocab?trash=1",{cache:"no-store"})).json()).items||[];}catch(e){}
  const have=new Set(words.map(w=>String(w.word).toLowerCase()));
  items=items.filter(t=>t&&t.e&&!have.has(String(t.e.word||"").toLowerCase()));
  box.innerHTML='<div class="trash-card"><div class="th"><b>🗑 回收站</b><small>30 天内删掉的 '+items.length+' 条，恢复后进度照旧</small><button id="trash-x" class="bulk-btn">收起</button></div>'+
    (items.length?items.map(t=>'<div class="tr"><span class="w">'+escHtml(String(t.e.word||"").replace(/[{}]/g,""))+'</span><span class="z">'+escHtml(String(t.e.zh||"").slice(0,40))+'</span><span class="d">'+new Date(t.at).toLocaleDateString()+'</span><button class="bulk-btn" data-rs="'+escHtml(t.e.id)+'">恢复</button></div>').join(""):'<div class="tr empty">回收站是空的</div>')+'</div>';
  box.querySelector("#trash-x").onclick=()=>{box.classList.remove("on");renderTrash();};
  box.querySelectorAll("[data-rs]").forEach(b=>b.onclick=async()=>{
    const t=items.find(x=>x.e.id===b.dataset.rs);if(!t)return;b.disabled=true;
    const nid=t.e.id.replace(/_r\d+$/,"")+"_r"+Date.now().toString(36),e=Object.assign({},t.e,{id:nid,u:Date.now()});
    state.custom.push(e);if(state.srs&&state.srs[t.e.id])state.srs[nid]=Object.assign({},state.srs[t.e.id]);if(state.progress&&state.progress[t.e.id])state.progress[nid]=state.progress[t.e.id];
    refresh();save(state);
    try{await fetch("/api/vocab",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({untrash:t.e.id})});}catch(x){}
    toast("已恢复："+String(t.e.word).replace(/[{}]/g,""));renderTrash();
  });
}
document.getElementById("trash-btn").onclick=()=>{const b=document.getElementById("trash-box");b.classList.toggle("on");renderTrash();};
function parseWords(t){return (t||"").split(/[,\n;]+/).map(s=>s.trim()).filter(Boolean);}
function handleHash(){
  const m=location.hash.match(/[#&]add=([^&]+)/);
  if(m){
    const list=parseWords(decodeURIComponent(m[1].replace(/\+/g," ")));
    history.replaceState(null,"",location.pathname+location.search);
    if(list.length)addPending(list);
  }
}
window.addEventListener("hashchange",handleHash);

// voice settings
document.getElementById("voice-sel").onchange=e=>{
  const v=e.target.value;
  if(v==="ai"){if(window.TTS){TTS.setMode("ai");TTS.load().then(()=>speak("Hi! How does this sound?"));}return;}
  if(window.TTS)TTS.setMode("sys");
  chosenVoice=voices[v]||null;
  state.voice=chosenVoice?chosenVoice.name:null;save(state);
  speak("Hi! How does this sound?");
};
document.getElementById("voice-test").onclick=()=>speak("I'd like the green curry, not too spicy please.");
if(window.speechSynthesis){window.speechSynthesis.onvoiceschanged=loadVoices;loadVoices();setTimeout(loadVoices,300);}

refresh(); // show seed words immediately, no waiting on storage
(async()=>{
  const loaded=await load();
  if(loaded){state=loaded;if(!state.progress)state.progress={};if(!state.custom)state.custom=[];if(!state.deleted)state.deleted=[];if(!state.pending)state.pending=[];
    {const g=imgLoad(state);imgCache=g.I;rowImgCache=g.RW;if("imgcache" in state||"rowimgcache" in state){delete state.imgcache;delete state.rowimgcache;imgSave();if(!hasStore)try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}} // 配图缓存搬到单独的键，生词本里去掉
    refresh();
    if(state.sort){sortBy=state.sort;const ss=document.getElementById("sort-sel");if(ss)ss.value=sortBy;renderList();}
    loadVoices();
  }
  vResnap(); // 记下载入时的掌握状态 / 待整理队列，之后改了哪些一比就知道
  var collect=document.documentElement.classList.contains('collect-mode');
  var collectWord='';
  if(collect){var mm=location.hash.match(/[#&]add=([^&]+)/);if(mm){try{collectWord=decodeURIComponent(mm[1].replace(/\+/g," ")).trim();}catch(e){}}}
  handleHash();
  if(SYNC_ON){
    if(collect){
      await syncNow();
      var cm=document.getElementById('collect-msg'),cs=document.getElementById('collect-sub');
      if(cm)cm.textContent=collectWord?('✓ 已收：'+collectWord):'✓ 已收进待整理';
      if(cs)cs.textContent='共 '+((state.pending||[]).length)+' 个待整理 · 发 Claude 整理';
      setTimeout(function(){try{window.close();}catch(e){}},1300);
    }else{
      syncNow();
      document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncNow();});
      window.addEventListener("focus",syncNow);
    }
  }else if(collect){setTimeout(function(){try{window.close();}catch(e){}},1300);}
})();
