/* 从 index.html 原样搬出来的一段（个人学习资料换设备同步（阅读 / 写作 / 词汇量测试））：还是普通脚本，按原来的位置加载，全局变量、执行顺序都和以前一样 */
/* 个人学习资料换设备也在：阅读的文章（reading:docs）、作文批改历史（writing:history）、词汇量测试（vocab:test）
   这三页照旧存本机；这里在本机存储这一层盯着：哪一条变了就传到后台 /api/mine（按人分开），删掉的传删除记号；
   打开网站、切到这几页时把后台的合进来（别的设备新加 / 改过 / 删掉的）。mine:seen:* 记着上次见到的后台版本时间 */
(function(){
  var KS={"reading:docs":{k:"reading",max:20,id:function(x){return x.id;}},"writing:history":{k:"writing",max:30,id:function(x){return x.id;}},"vocab:test":{k:"vtest",max:10,id:function(x){return String(x.at);}}};
  var S=Storage.prototype,set0=S.setItem,quiet=false;
  function rd(key){try{var v=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(v)?v:[];}catch(e){return [];}}
  function seen(k){try{return JSON.parse(localStorage.getItem("mine:seen:"+k)||"{}")||{};}catch(e){return {};}}
  function setSeen(k,o){quiet=true;try{localStorage.setItem("mine:seen:"+k,JSON.stringify(o));}catch(e){}quiet=false;}
  function post(k,ch){if(!Object.keys(ch).length)return;var sn=seen(k);for(var id in ch){ch[id].at=Math.max(ch[id].at,(+sn[id]||0)+1);sn[id]=ch[id].at;}setSeen(k,sn);
    fetch("/api/mine",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({k:k,changes:ch})}).catch(function(){});}
  // 阅读位置 pos 单独传（一项「pos:文章id」= 位置数字）：读的时候每滚一下、每朗读一句都会改它，以前每次都把整篇文章（最多 8 万字）传一遍、
  //   后台每次写一次 KV（一天只有 1000 次）。现在最多两分钟传一次，切走页面时马上传。存储满了本机少存几篇（__mineKeepDel）不当成删除
  function sig(key,x){if(key!=="reading:docs")return JSON.stringify(x);var y=Object.assign({},x);delete y.pos;return JSON.stringify(y);}
  var posQ={},posT=0,posLast=0;
  function posFlush(){clearTimeout(posT);posT=0;if(!Object.keys(posQ).length)return;var ch={},now=Date.now();for(var id in posQ)ch["pos:"+id]={v:posQ[id],at:now};posQ={};posLast=now;post("reading",ch);}
  function posLater(){if(posT)return;posT=setTimeout(posFlush,Math.max(0,120e3-(Date.now()-posLast)));}
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")posFlush();});
  function push(key,before,after){var c=KS[key],B={},P={},A={},ch={},now=Date.now();
    before.forEach(function(x){if(x&&c.id(x)){B[c.id(x)]=sig(key,x);P[c.id(x)]=x.pos;}});
    after.forEach(function(x){if(x&&c.id(x)){A[c.id(x)]=1;if(B[c.id(x)]!==sig(key,x))ch[c.id(x)]={v:x,at:now};else if(key==="reading:docs"&&P[c.id(x)]!==x.pos){posQ[c.id(x)]=x.pos;posLater();}}});
    if(!window.__mineKeepDel)for(var id in B)if(!A[id])ch[id]={del:1,at:now};
    post(c.k,ch);}
  S.setItem=function(key,v){var c=!quiet&&KS[key];var ls=null;try{ls=window.localStorage;}catch(e){}if(this!==ls)c=null;var before=c?rd(key):null;var r=set0.apply(this,arguments);if(c)push(key,before,rd(key));return r;};
  var busy={};
  window.mineSyncPull=function(key){var c=KS[key];if(!c||busy[key])return Promise.resolve(false);busy[key]=1;
    return fetch("/api/mine?k="+c.k,{cache:"no-store"}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok)return false;var R=j.items||{},sn=seen(c.k),L=rd(key),byId={},changed=false,up={};
      L.forEach(function(x){if(x&&c.id(x))byId[c.id(x)]=x;});
      for(var id in R){var r=R[id];var known=+sn[id]||0;
        if(key==="reading:docs"&&id.indexOf("pos:")===0){var pd=byId[id.slice(4)];if(pd&&!r.del&&r.at>known&&pd.pos!==r.v&&!(id.slice(4) in posQ)){pd.pos=r.v;changed=true;}sn[id]=Math.max(known,+r.at||0);continue;} // 别的设备读到哪了
        if(r.del){if(byId[id]&&r.at>known){delete byId[id];changed=true;}}
        else if(!byId[id]){if(r.at>known||!sn[id]){byId[id]=r.v;changed=true;}}
        else if(r.at>known&&JSON.stringify(byId[id])!==JSON.stringify(r.v)){byId[id]=r.v;changed=true;}
        sn[id]=Math.max(known,+r.at||0);}
      for(var id2 in byId)if(!R[id2]&&!sn[id2]&&id2.indexOf("pos:")!==0)up[id2]={v:byId[id2],at:Date.now()}; // 这台设备上从没传过的：补传
      setSeen(c.k,sn);post(c.k,up);
      if(changed){var M=Object.keys(byId).map(function(i){return byId[i];}).sort(function(a,b){return (+b.at||0)-(+a.at||0);}).slice(0,c.max);
        quiet=true;try{localStorage.setItem(key,JSON.stringify(M));}catch(e){}quiet=false;}
      return changed;}).catch(function(){return false;}).then(function(ch){busy[key]=0;return ch;});};
  function redraw(key){
    if(key==="reading:docs"&&window.readingRefresh&&document.getElementById("reading").classList.contains("on"))readingRefresh();
    if(key==="vocab:test"&&window.statsRefresh)statsRefresh();
    var wv=document.getElementById("ielts-write-view");if(key==="writing:history"&&wv&&wv.dataset.on&&window.writingShow)writingShow(wv);}
  function pullAll(){Object.keys(KS).forEach(function(key){window.mineSyncPull(key).then(function(ch){if(ch)redraw(key);});});}
  window.addEventListener("load",function(){setTimeout(pullAll,1500);
    if(/^#article\//.test(location.hash)){var l1=document.getElementById("l1-en"),nb=document.getElementById("tab-notebook"),rb=document.querySelector('.modes button[data-mode="reading"]');if(l1)l1.click();if(nb)nb.click();if(rb)rb.click();} // 阅读文章的直达链接
  });
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")pullAll();}); // 切回这个标签页时再拉一次
})();
