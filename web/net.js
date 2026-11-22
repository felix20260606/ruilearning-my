/* 从 index.html 原样搬出来的一段（在中国大陆也能用：window.NET）：还是普通脚本，按原来的位置加载，全局变量、执行顺序都和以前一样 */
/* 🇨🇳 在中国大陆也能用：谷歌、BBC、维基百科、YouTube 这些在大陆打不开（或者一直卡着不回）。
   window.NET：
   - 打开网页时（6 小时一次）测一下这几个网站连不连得上（no-cors 请求，5 秒没回就算不通），结果记在 localStorage「net:bad」{网站: 时间}
   - NET.fetch(网址, 选项)：先直连（不通的网站直接跳过；直连最多等 6 秒），不行就走后台中转 /api/px?u=（_worker.js 里有名单）
   - NET.src(网址)：<img> / <audio> 用的地址，已知不通的网站直接换成中转地址；加载失败的图片也会自动换中转（下面的 error 监听）
   - NET.g(谷歌翻译网址)：谷歌通就用谷歌；不通就请后台翻（POST /api/ai {task:"tr"}，后台再用谷歌 / Workers AI），返回和谷歌一样格式的结果，原来的代码不用改
   - NET.isBad(网站)：比如视频页看 www.youtube.com 通不通，不通就提示要开 VPN */
(function(){
  var KEY="net:bad", PXH=/^(en\.wikipedia\.org|zh\.wikipedia\.org|commons\.wikimedia\.org|upload\.wikimedia\.org|thumb\.wikimedia\.org|ichef\.bbci\.co\.uk|downloads\.bbc\.co\.uk|voa-audio\.voanews\.eu|voa-video\.voanews\.eu|gdb\.voanews\.com|npr\.simplecastaudio\.com|npr\.brightspotcdn\.com|breakingnewsenglish\.com|radiodownloaddw-a\.akamaihd\.net|i\.ytimg\.com|api\.dictionaryapi\.dev|api\.languagetool\.org)$/;
  function bad(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{};}catch(e){return {};}}
  function save(b){try{localStorage.setItem(KEY,JSON.stringify(b));}catch(e){}}
  function host(u){try{return new URL(u,location.href).hostname;}catch(e){return "";}}
  function isBad(h){var t=bad()[h];return !!t&&Date.now()-t<6*3600e3;}
  function mark(h,ok){var b=bad();if(ok){if(!(h in b))return;delete b[h];}else b[h]=Date.now();save(b);}
  function pxu(u){return "/api/px?u="+encodeURIComponent(u);}
  function tfetch(u,o,ms){var ac=window.AbortController?new AbortController():null,t=setTimeout(function(){if(ac)ac.abort();},ms);return fetch(u,Object.assign({},o||{},ac?{signal:ac.signal}:{})).then(function(r){clearTimeout(t);return r;},function(e){clearTimeout(t);throw e;});}
  // 中转一次最多 4 个（页面上几百张配图同时要，维基会把后台限流成 429）
  var q=[],run=0;function pq(f){return new Promise(function(res,rej){q.push(function(){run++;f().then(res,rej).then(next,next);});next0();});}
  function next(){run--;next0();}function next0(){while(run<4&&q.length)q.shift()();}
  function nfetch(u,o){
    var h=host(u),tried=false;
    if(!PXH.test(h))return fetch(u,o);
    var direct=isBad(h)?Promise.reject(0):(tried=true,tfetch(u,o,6000).then(function(r){if(r.ok||r.status===404){mark(h,1);return r;}throw 0;}));
    return direct.catch(function(){
      if(tried)mark(h,0);
      return pq(function(){return fetch(pxu(u),o);}).then(function(r){
        if(r.ok||r.status===404||tried)return r;
        return tfetch(u,o,10000).then(function(d){if(d.ok){mark(h,1);return d;}return r;},function(){return r;}); // 中转也不行（限流）：说不定直连其实通，试一下，通了就撤销「不通」
      });
    });
  }
  function src(u){var h=host(u);return u&&PXH.test(h)&&isBad(h)?pxu(u):u;}
  function g(u){ // 谷歌翻译：translate.googleapis.com/translate_a/single?…&q=
    var H="translate.googleapis.com";
    var direct=isBad(H)?Promise.reject(0):tfetch(u,{},5000).then(function(r){if(r.ok){mark(H,1);return r;}throw 0;});
    return direct.catch(function(){
      mark(H,0);
      var UR=new URL(u),q=UR.searchParams.get("q")||"",dj=UR.searchParams.get("dj")==="1",lines=q.split("\n"),parts=[];
      for(var i=0;i<lines.length;i+=120)parts.push(lines.slice(i,i+120));
      return Promise.all(parts.map(function(p){return fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:"tr",texts:p})}).then(function(r){return r.json();}).then(function(j){return j&&Array.isArray(j.zh)?j.zh:p.map(function(){return "";});},function(){return p.map(function(){return "";});});})).then(function(rs){
        var zh=[].concat.apply([],rs),t=zh.join("\n"),body=dj?{sentences:[{trans:t,orig:q}],src:"en"}:[[[t,q]],null,"en"];
        return new Response(JSON.stringify(body),{status:zh.some(Boolean)?200:502,headers:{"content-type":"application/json"}});
      });
    });
  }
  // 测一下哪些外部网站不通（6 小时一次；在打开网页 3 秒后做，不和网页抢）
  function probe(){
    var last=0;try{last=+localStorage.getItem("net:probe")||0;}catch(e){}
    if(Date.now()-last<6*3600e3)return;try{localStorage.setItem("net:probe",String(Date.now()));}catch(e){}
    ["translate.googleapis.com","ichef.bbci.co.uk","downloads.bbc.co.uk","voa-audio.voanews.eu","gdb.voanews.com","npr.simplecastaudio.com","breakingnewsenglish.com","en.wikipedia.org","upload.wikimedia.org","thumb.wikimedia.org","www.youtube.com","api.dictionaryapi.dev","fonts.googleapis.com"].forEach(function(h){
      tfetch("https://"+h+"/favicon.ico",{mode:"no-cors",cache:"no-store"},9000).then(function(){mark(h,1);},function(){mark(h,0);});
    });
  }
  setTimeout(probe,3000);
  // 图片加载失败（大陆打不开的网站）→ 换成后台中转再试一次
  document.addEventListener("error",function(e){
    var el=e.target;if(!el||el.tagName!=="IMG"||el.getAttribute("data-px"))return;
    var s=el.currentSrc||el.src,h=host(s);if(!/^https:/.test(s)||!PXH.test(h))return;
    mark(h,0);el.setAttribute("data-px","1");el.src=pxu(s);
  },true);
  // 已知不通的网站：网页里新出现的 <img>（或改了 src）直接换成中转地址，不用等它卡半天再失败
  function fix(el){if(el&&el.tagName==="IMG"&&!el.getAttribute("data-px")){var s=el.getAttribute("src")||"";if(/^https:/.test(s)&&PXH.test(host(s))&&isBad(host(s))){el.setAttribute("data-px","1");el.src=pxu(s);}}}
  try{new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==="attributes")fix(m.target);else m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;fix(n);if(n.querySelectorAll)n.querySelectorAll("img").forEach(fix);});});}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["src"]});}catch(e){}
  // <audio>：直连 BBC 的音频出错，或者 8 秒还没开始加载（大陆常见：一直卡着）→ 换成中转，接着从原来的位置放
  function audio(el){
    if(!el||el.__net)return;el.__net=1;var tm=0;
    function swap(){var s=el.currentSrc||el.src,h=host(s);if(!/^https:/.test(s)||!PXH.test(h))return;mark(h,0);var t=el.currentTime||0,go=!el.paused;el.src=pxu(s);if(t)try{el.currentTime=t;}catch(e){}if(go)el.play().catch(function(){});}
    el.addEventListener("error",swap);
    el.addEventListener("loadstart",function(){clearTimeout(tm);tm=setTimeout(function(){if(el.readyState===0&&PXH.test(host(el.currentSrc||el.src)))swap();},8000);});
  }
  window.NET={audio:audio,fetch:nfetch,src:src,g:g,px:pxu,isBad:isBad,mark:mark,host:host,canPx:function(u){return PXH.test(host(u));}};
})();
