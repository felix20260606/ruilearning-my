/* 从 index.html 原样搬出来的一段（家人 + 学习语言、请求自动带 ?u=&lang=、本机存储按人分开、写入口令）：还是普通脚本，按原来的位置加载，全局变量、执行顺序都和以前一样 */
/* 家人（多用户，不设密码）+ 学习语言：当前是谁存在 localStorage 的 "vu"（空 = 主人），学哪种语言存在 "lang"（按人分开；空或 en = 英语）。必须在所有脚本之前运行：
   ① 发往 /api/vocab、/api/ext、/api/media、/api/mine 的请求自动带上 ?u=<id>、?lang=<语言>（英语不带）——后台按「人 + 语言」分开存，见 _worker.js「六、家人」
   ② 本机缓存（下面 MINE 里的键：生词本、错题本、练习设置和计数、每日、阅读 / 写作 / 口语 / 听力 / 练习课的记录、视频观看进度…）按人、按语言分开存：
      键后面加 "@<id>"（家人）和 "~<语言>"（非英语），如 err:items@u2~de —— 否则网页打开时会把别人 / 别的语言的缓存合并进来
      "lang" 自己只按人分开（不然读不出来是哪种语言）
   切换家人 / 语言：改 "vu" / "lang" 后整页重新加载（见下面 #who 菜单、lang.js）
   英语和以前完全一样（键名、接口参数都不变），不用迁移旧数据 */
(function(){
  var id="";try{id=localStorage.getItem("vu")||"";}catch(e){}
  if(!/^[a-z0-9]{1,12}$/.test(id))id="";
  window.VU=id;
  var us=id?"@"+id:"",lg="";try{lg=localStorage.getItem("lang"+us)||"";}catch(e){}
  if(!/^[a-z]{2}$/.test(lg)||lg==="en")lg="";
  window.VL=lg||"en";
  if(!id&&!lg)return;
  var ls2=lg?"~"+lg:"";
  var API=/^\/api\/(vocab|ext|media|mine)$/,of=window.fetch;
  var fix=function(u){var x=new URL(String(u),location.href);if(x.origin===location.origin&&API.test(x.pathname)){if(id)x.searchParams.set("u",id);if(lg)x.searchParams.set("lang",lg);return x.pathname+x.search;}return u;};
  window.fetch=function(u,o){
    try{if(typeof u==="string"||u instanceof URL)u=fix(u);}catch(e){}
    return of.call(this,u,o);
  };
  if(navigator.sendBeacon){var ob=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{u=fix(u);}catch(e){}return ob(u,d);};}
  var MINE=/^(vocab_state_v1|pump:opt|pump:heard|pump:day|pump:log|wt:meta|reading:docs|reading:tr|speak:done|speak:log|speak:days|reading:lv|writing:draft|writing:history|writing:lang|vocab:test|vocab:kn|vocab:ms|vocab:frz|remind:time|daily:opt|daily:check|daily:days|daily:sat|daily:sent|daily:wkseen|sme:done|sme:pos|sme:stat|sme:lq|sme:diff|err:items|exam:hist|lang|drill:[\w:]+|mine:seen:reading|mine:seen:writing|mine:seen:vtest|speak:howto|speak:coachAns|remind:last)$/,S=Storage.prototype,g=S.getItem,st=S.setItem,rm=S.removeItem;
  var k=function(t,key){var ls=null;try{ls=window.localStorage;}catch(e){}key=String(key);return t===ls&&MINE.test(key)?key+us+(key==="lang"?"":ls2):key;};
  S.getItem=function(key){return g.call(this,k(this,key));};
  S.setItem=function(key,v){return st.call(this,k(this,key),v);};
  S.removeItem=function(key){return rm.call(this,k(this,key));};
  window.__lsRawRemove=function(key){try{rm.call(window.localStorage,String(key));}catch(e){}}; // 按真实键名删（util.js 清缓存用：localStorage.key(i) 拿到的已经是带后缀的真实键名，再走上面那层会被改成当前家人的）
})();
/* 🔒 写入口令（见 _worker.js「写入保护」）：发往本站 /api/ 的请求自动带请求头 x-key（本机 localStorage「auth:key」，各家人共用）。
   平时用不到口令；后台说「这次改动太大，要口令」（403 needkey）时弹窗问一次，对了就记在本机、把这次请求再发一遍。
   window.authUI() 打开设置 / 输入口令的小窗（👤 菜单里的「🔒 写入口令」） */
(function(){
  var of=window.fetch,AP=/^\/api\//,ask=null,noAsk=0;
  function key(){try{return localStorage.getItem("auth:key")||"";}catch(e){return "";}}
  function withKey(o,k){o=Object.assign({},o||{});var h=new Headers(o.headers||{});h.set("x-key",k);o.headers=h;return o;}
  function mine(u){try{var x=new URL(String(u&&u.url||u),location.href);return x.origin===location.origin&&AP.test(x.pathname);}catch(e){return false;}}
  var WHY={replace:"整份还原",big:"一次删除或改写很多条",day:"今天删除或改写的已经很多了",cap:"删除视频字幕",users:"改家人名字或删家人",change:"改口令"};
  function modal(title,tip,two){return new Promise(function(done){
    var d=document.createElement("div");d.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    d.innerHTML='<form style="background:var(--ui-surface,#222);color:var(--ui-ink,#eee);border:1px solid var(--ui-line-2,#444);border-radius:16px;padding:18px;width:100%;max-width:380px;font:15px/1.6 system-ui,sans-serif"><b style="font-size:17px">'+title+'</b><div style="color:var(--ui-muted,#aaa);font-size:13.5px;margin:6px 0 10px">'+tip+'</div><input type="password" autocomplete="current-password" placeholder="口令（至少 8 位）" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--ui-line-2,#555);background:var(--ui-surface-2,#111);color:inherit;font:inherit;margin-bottom:8px">'+(two?'<input type="password" autocomplete="new-password" placeholder="再输一遍" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--ui-line-2,#555);background:var(--ui-surface-2,#111);color:inherit;font:inherit;margin-bottom:8px">':'')+'<div class="er" style="color:var(--ui-red,#f88);font-size:13px;min-height:18px"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><button type="button" data-x style="padding:8px 14px;border-radius:10px;border:1px solid var(--ui-line-2,#555);background:transparent;color:inherit;font:inherit;cursor:pointer">取消</button><button type="submit" style="padding:8px 16px;border-radius:10px;border:0;background:var(--ui-pur,#7c5cff);color:#fff;font:inherit;font-weight:700;cursor:pointer">确定</button></div></form>';
    document.body.appendChild(d);var f=d.querySelector("form"),I=d.querySelectorAll("input"),er=d.querySelector(".er");I[0].focus();
    var end=function(v){d.remove();done(v);};d.querySelector("[data-x]").onclick=function(){end("");};
    f.onsubmit=function(e){e.preventDefault();var v=I[0].value;if(v.length<8){er.textContent="至少 8 位";return;}if(two&&I[1].value!==v){er.textContent="两次不一样";return;}
      if(two)return end(v);er.textContent="检查中…";of("/api/auth",{headers:{"x-key":v},cache:"no-store"}).then(function(r){return r.json();}).then(function(j){if(j&&j.valid){try{localStorage.setItem("auth:key",v);}catch(e){}end(v);}else er.textContent="口令不对";}).catch(function(){er.textContent="连不上网，过一会儿再试";});};
  });}
  function askKey(why){
    if(Date.now()<noAsk)return Promise.resolve("");
    if(!ask)ask=modal("🔒 要写入口令","这次是「"+(WHY[why]||"大改动")+"」，为了防止生词本被别人乱改，要输一次口令（本机会记住，以后不再问）。",false).then(function(v){ask=null;if(!v)noAsk=Date.now()+10*60e3;return v;});
    return ask;
  }
  window.fetch=function(u,o){
    if(!mine(u)||u instanceof Request)return of.apply(this,arguments);
    var k=key(),self=this;if(k)o=withKey(o,k);
    return of.call(self,u,o).then(function(r){
      if(r.status!==403)return r;
      return r.clone().json().then(function(j){
        if(!j||j.error!=="needkey")return r;
        try{localStorage.removeItem("auth:key");}catch(e){}
        return askKey(j.why).then(function(nk){return nk?of.call(self,u,withKey(o,nk)):r;});
      },function(){return r;});
    });
  };
  window.authUI=function(){
    return of("/api/auth",{headers:key()?{"x-key":key()}:{},cache:"no-store"}).then(function(r){return r.json();}).then(function(j){
      var t=window.toast||alert;
      if(!j||!j.ok)return t("连不上后台");
      if(!j.set)return modal("🔒 设一个写入口令","平时用网站、插件都不用输；只有整份还原、一次删很多词这类大改动才要。忘了的话：Cloudflare 后台 → KV → CAPTIONS 删掉「auth」这一条再重新设。建议存进密码管理器。",true).then(function(v){if(!v)return;
        return of("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({set:v})}).then(function(r){return r.json();}).then(function(x){if(x&&x.ok){try{localStorage.setItem("auth:key",v);}catch(e){}t("🔒 口令设好了，这台设备已经记住");}else t("没设成："+((x&&x.error)||""));});});
      if(j.valid){return U.ask("这台设备已经记住口令了。\n\n要改口令吗？",{ok:"改口令",cancel:"不改"}).then(function(ok){if(!ok)return;return modal("🔒 新口令","输入新口令，其它设备下次遇到大改动时要输新的。",true).then(function(v){if(!v)return;return fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({set:v})}).then(function(r){return r.json();}).then(function(x){if(x&&x.ok){try{localStorage.setItem("auth:key",v);}catch(e){}t("口令改好了");}else t("没改成");});});});}
      return modal("🔒 输入写入口令","这台设备还没记住口令。输一次以后，大改动就不会再问。",false).then(function(v){if(v)t("🔒 这台设备记住口令了");});
    }).catch(function(){(window.toast||alert)("连不上后台");});
  };
})();
