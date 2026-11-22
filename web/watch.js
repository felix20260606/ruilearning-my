/* 看视频学英语：嵌入 YouTube 播放器 + 同步双语字幕 + 点词查词 + 一键加入生词本
   字幕来自电脑上的浏览器扩展（看过的视频自动同步到 /api/cap）。
   依赖 index.html 里的全局：state / words / refresh / save / speak / toast */
(function () {
  "use strict";
  const API = "/api/cap";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const fmt = t => { t = Math.max(0, Math.floor(t)); const m = Math.floor(t / 60), s = t % 60; return (m >= 60 ? Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };
  const WORD = /[A-Za-z][A-Za-z'’-]*/g;
  const tip = m => { try { toast(m); } catch (e) {} };

  let set = Object.assign({ autoPause: false, hideTr: false, hideEn: false, rate: 1, fs: 1 }, LS.get("wt:set", {}));
  let doc = null, cues = [], cur = -1, player = null, ready = false, timer = null, pausedFor = -1, lock = false, follow = true, userScroll = 0, apiP = null, sheetWord = "";
  let loop = null, abA = -1, loopAt = 0, started = false, resumeAt = 0; // loop = {a,b}：循环第 a～b 句（单句循环时 a === b）

  /* ---------- 本机记录：观看进度、收藏、看过（只存在这台设备的浏览器里） ----------
     wt:meta = { 视频ID: { p: 看到第几秒, d: 视频总长, t: 最近观看时间, f: 1 收藏, w: 1 看过 } } */
  let M = LS.get("wt:meta", null);
  if (!M) { M = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("wt:pos:") === 0) { const p = +LS.get(k, 0); if (p > 0) M[k.slice(7)] = { p }; } } } catch (e) {} LS.set("wt:meta", M); } // 旧版只存了 wt:pos:ID
  const meta = v => M[v] || (M[v] = {});
  const saveMeta = () => LS.set("wt:meta", M);
  let lv = Object.assign({ sort: "add", filter: "all" }, LS.get("wt:lv", {})), allItems = LS.get("wt:list", []), listState = allItems.length ? "ok" : "loading", q = "";
  const durOf = (v, x) => (M[v] && M[v].d) || (x && x.dur) || 0;
  const pctOf = (v, x) => { const m = M[v] || {}, d = durOf(v, x); return m.w ? 1 : d && m.p ? Math.min(1, m.p / d) : 0; };
  const stOf = (v, x) => { const m = M[v] || {}; return m.w ? "seen" : (m.p || 0) > 5 && pctOf(v, x) < 0.97 ? "ing" : "new"; };
  const fineKeys = () => { try { return matchMedia("(hover:hover) and (pointer:fine)").matches; } catch (e) { return false; } };
  async function copyText(s) { try { await navigator.clipboard.writeText(s); return true; } catch (e) { const ta = document.createElement("textarea"); ta.value = s; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0"; document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (er) {} ta.remove(); return ok; } }

  /* 书签小工具：在 YouTube 页面里读出正在显示的字幕，存到本站，再跳回来学习（手机上不依赖电脑） */
  const BM_SRC = "(function(){ var S=\"__SITE__\",D=document,L=location; if(!/(^|\\.)youtube\\.com$/.test(L.hostname)){alert(\"请先在 Safari 里打开 YouTube 的视频页，再点这个书签\");return;} var m=L.href.match(/[?&]v=([\\w-]{11})/)||L.href.match(/\\/shorts\\/([\\w-]{11})/); if(!m){alert(\"请先打开一个 YouTube 视频，再点这个书签\");return;} var v=m[1],p=D.getElementById(\"movie_player\")||D.querySelector(\".html5-video-player\"),done=false,hit=false; var box=D.createElement(\"div\");box.style.cssText=\"position:fixed;left:12px;right:12px;top:12px;z-index:2147483647;background:#0c9370;color:#fff;font:600 15px/1.4 system-ui;padding:12px 14px;border-radius:12px;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.35)\"; var say=function(t){box.textContent=t;if(!box.parentNode)D.body.appendChild(box);}; say(\"正在读取字幕…\"); function parse(t){var j=JSON.parse(t),c=[],i,e,s;for(i=0;i<(j.events||[]).length;i++){e=j.events[i];if(!e.segs)continue;s=e.segs.map(function(x){return x.utf8||\"\"}).join(\"\").replace(/\\s+/g,\" \").trim();if(!s)continue;c.push({s:(e.tStartMs||0)/1000,e:((e.tStartMs||0)+(e.dDurationMs||0))/1000,t:s});} for(i=0;i<c.length-1;i++)if(c[i].e>c[i+1].s)c[i].e=c[i+1].s;return c.filter(function(x){return x.e>x.s});} function send(c,lang){if(done||!c.length)return;done=true;hit=true;say(\"共 \"+c.length+\" 句（\"+c.filter(function(x){return x.r}).length+\" 句有中文），正在保存…\");var a=\"\";try{a=p.getVideoData().author||\"\"}catch(e){} F.call(window,S+\"/api/cap\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({v:v,tl:\"zh-CN\",title:D.title.replace(/^\\(\\d+\\)\\s*/,\"\").replace(/ - YouTube$/,\"\"),author:a,lang:lang||\"en\",cues:c})}).then(function(r){return r.json()}).then(function(r){if(r&&r.ok){say(\"已保存，正在打开学习页…\");L.href=S+\"/?v=\"+v;}else{done=false;say(\"保存失败：\"+((r&&r.error)||\"未知错误\"));}}).catch(function(){done=false;say(\"保存失败：网络问题，请再点一次书签\");});} var F=window.fetch,O=XMLHttpRequest.prototype.open,seen={}; function cl(t){t=String(t||\"\").replace(/\\[[^\\]]*\\]|\\u266a|>>+|\\u00bb/g,\" \").replace(/\\s+/g,\" \").trim();return /^\\([^)]*\\)$/.test(t)?\"\":t;} function merge(c,z){var m={},i,k,b,d;for(i=0;i<z.length;i++)m[Math.round(z[i].s*10)]=z[i].t; for(i=0;i<c.length;i++){k=Math.round(c[i].s*10);c[i].r=m[k]||m[k-1]||m[k+1]||\"\";if(!c[i].r&&z.length){b=null;for(d=0;d<z.length;d++)if(z[d].s<c[i].e&&z[d].e>c[i].s&&Math.abs(z[d].s-c[i].s)<1.5){b=z[d];break;}if(b)c[i].r=b.t;}} var o=[];for(i=0;i<c.length;i++){c[i].t=cl(c[i].t);c[i].r=cl(c[i].r);if(c[i].t)o.push(c[i]);}return o;} function grab(u){if(done||!/\\/api\\/timedtext/.test(u))return;var a;try{a=new URL(u,L.href)}catch(e){return}if(a.searchParams.get(\"v\")&&a.searchParams.get(\"v\")!==v)return;a.searchParams.delete(\"tlang\");a.searchParams.set(\"fmt\",\"json3\");var k=a.href;if(seen[k])return;seen[k]=1;var lang=a.searchParams.get(\"lang\")||\"en\"; F.call(window,k).then(function(r){return r.ok?r.text():\"\"}).then(function(t){if(!t||done)return;var c=parse(t);if(!c.length)return;say(\"拿到 \"+c.length+\" 句字幕，正在取中文…\");a.searchParams.set(\"tlang\",\"zh-Hans\"); return F.call(window,a.href).then(function(r){return r.ok?r.text():\"\"}).then(function(x){var z=[];try{z=x?parse(x):[]}catch(e){}send(merge(c,z),lang)},function(){send(merge(c,[]),lang)});}).catch(function(){seen[k]=0});} XMLHttpRequest.prototype.open=function(a,u){try{grab(String(u))}catch(e){}return O.apply(this,arguments);}; window.fetch=function(i){try{grab(String(typeof i===\"string\"?i:(i&&i.url)||\"\"))}catch(e){}return F.apply(this,arguments);}; var scan=function(){if(done)return;var es=performance.getEntriesByType(\"resource\"),i;for(i=es.length-1;i>=0;i--)grab(es[i].name);}; var kick=function(){if(done||!p)return;try{p.loadModule&&p.loadModule(\"captions\");var tl=p.getOption(\"captions\",\"tracklist\")||[],en=tl.filter(function(x){return /^en/.test(x.languageCode)}),tr=en.filter(function(x){return x.kind!==\"asr\"})[0]||en[0]||tl[0];p.setOption(\"captions\",\"track\",{});if(tr)setTimeout(function(){try{p.setOption(\"captions\",\"track\",{languageCode:tr.languageCode})}catch(e){}},350);else if(p.toggleSubtitlesOn)p.toggleSubtitlesOn();}catch(e){}}; scan();setTimeout(function(){if(!done)kick()},1200);setTimeout(kick,4000);setTimeout(kick,7500);var iv=setInterval(function(){if(done)clearInterval(iv);else scan()},700);setTimeout(function(){clearInterval(iv)},11000); setTimeout(function(){if(!hit)say(\"没拿到字幕：这个视频可能没有字幕。请先点一下播放，再点一次书签试试\");setTimeout(function(){if(!hit&&box.parentNode)box.parentNode.removeChild(box)},6000);},11000); })();";
  const bookmarklet = () => "javascript:" + encodeURIComponent(BM_SRC.replace("__SITE__", () => location.origin));
  /* ---------- 样式 ---------- */
  const css = `
  #view-video{display:none;padding-top:calc(56px + env(safe-area-inset-top,0px))}
  html.show-video #view-video{display:block}
  html.show-video #view-en,html.show-video #view-fat,html.show-video #view-trip,html.show-video #view-ielts,html.show-video #view-ext,html.show-video #view-speak,html.show-video #view-daily{display:none!important}
  html.show-video body{padding-bottom:0}
  /* 视频在放时切到别的页面：只留视频，缩成右下角的悬浮小窗继续播（html.wt-float，见 videoCore.leave） */
  html.wt-float:not(.show-video) #view-video{display:block;position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:min(340px,62vw);z-index:9400;padding:0;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.5)}
  html.wt-float.sm-floating:not(.show-video) #view-video{bottom:calc(130px + env(safe-area-inset-bottom,0px))}
  html.wt-float:not(.show-video) #view-video .wrap{max-width:none!important;padding:0!important}
  html.wt-float:not(.show-video) #watch>:not(.wt-play),html.wt-float:not(.show-video) .wt-play>:not(.wt-video):not(.wt-fbar){display:none!important}
  html.wt-float:not(.show-video) .wt-play{display:block!important;height:auto!important}
  html.wt-float:not(.show-video) .wt-video{border-radius:0;max-height:none!important;height:auto!important;aspect-ratio:16/9!important}
  .wt-fbar{display:none}html.wt-float:not(.show-video) .wt-fbar{display:flex;gap:6px;align-items:center;padding:5px 6px;background:#1b1d21;font-size:12.5px;color:#cfd3d8}
  .wt-fbar b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wt-fbar button{flex:0 0 auto;height:26px;padding:0 8px;border-radius:7px;border:1px solid #454950;background:#2d2f34;color:#e6e8eb;font:inherit;font-size:12px;cursor:pointer}
  #apptabs .seg-wrap.three{max-width:460px}
  #view-video .wrap{max-width:620px;margin:0 auto;padding:0 14px}
  #watch{padding-top:12px}
  .wt-open{display:flex;gap:8px}
  .wt-open input{flex:1;min-width:0;border:1px solid var(--line);background:var(--paper);border-radius:12px;padding:11px 12px;font:inherit;font-size:16px;color:var(--ink)}
  .wt-btn{border:0;border-radius:12px;background:var(--jade);color:#fff;font:inherit;font-weight:700;font-size:14px;padding:0 16px;min-height:44px;cursor:pointer}
  .wt-hint{color:var(--muted);font-size:13px;margin:10px 2px 14px;line-height:1.6}
  .wt-item{display:flex;gap:12px;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:8px;margin-bottom:10px;cursor:pointer}
  .wt-item img{width:112px;aspect-ratio:16/9;object-fit:cover;border-radius:9px;background:var(--paper-2);flex:none}
  .wt-item b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14.5px;line-height:1.35}
  .wt-item span{display:block;color:var(--muted);font-size:12px;margin-top:4px}
  .wt-bm{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:0 14px;margin-bottom:12px;font-size:14px;line-height:1.6}
  .wt-bm summary{cursor:pointer;font-weight:700;padding:12px 0;min-height:44px;list-style-position:inside}
  .wt-bm ol{margin:0 0 10px;padding-left:20px}.wt-bm li{margin-bottom:6px}.wt-bm p{color:var(--muted);font-size:13px;margin:10px 0 14px}
  .wt-bma{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .wt-bml{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1px dashed var(--jade);border-radius:12px;color:var(--jade);font-weight:700;text-decoration:none;cursor:grab}
  .wt-empty{text-align:center;color:var(--muted);padding:28px 10px;font-size:14px;line-height:1.7}
  .wt-play{display:none;flex-direction:column;min-height:420px}
  #watch.playing .wt-home{display:none}#watch.playing .wt-play{display:flex}
  .wt-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex:none}
  .wt-bar button{border:1px solid var(--line);background:var(--paper);border-radius:10px;min-width:44px;min-height:40px;font:inherit;font-size:14px;color:var(--ink);cursor:pointer}
  .wt-bar b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px}
  .wt-video{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;flex:none}
  .wt-video iframe,.wt-video>div{position:absolute;inset:0;width:100%;height:100%;border:0}
  .wt-sub{flex:none;background:#14181d;color:#fff;border-radius:12px;margin-top:8px;padding:10px 12px;min-height:76px;text-align:center}
  .wt-sub .en{font-size:19px;font-weight:700;line-height:1.4}
  .wt-sub .zh{font-size:15px;color:#c9d1d9;margin-top:4px;line-height:1.4;transition:filter .15s}
  .wt-sub.hide .zh{filter:blur(7px);cursor:pointer}.wt-sub.hide .zh.rv{filter:none}
  .wt-sub .none{color:#8b949e;font-size:14px;font-weight:400}
  .wt-w{cursor:pointer;border-radius:3px;padding:0 1px}.wt-w:active{background:rgba(255,255,255,.2)}
  .wt-w.lr{color:#FFBD80}.wt-w.kn{color:#9CFFCD}
  .wt-list .wt-w.lr{color:#c9741f}.wt-list .wt-w.kn{color:#0c9370}
  .wt-ctl{display:flex;gap:6px;margin-top:8px;flex:none}
  .wt-ctl button{flex:1;min-width:0;min-height:44px;border:1px solid var(--line);background:var(--paper);border-radius:11px;font:inherit;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;padding:0 2px;white-space:nowrap}
  .wt-ctl button.on{background:var(--jade);border-color:var(--jade);color:#fff}
  .wt-note{flex:none;margin-top:8px;padding:8px 12px;border-radius:10px;background:#FFF6E5;color:#8a5a00;font-size:13px;line-height:1.5}
  .wt-note button{margin-left:8px;border:0;border-radius:8px;background:var(--jade);color:#fff;font:inherit;font-weight:700;padding:6px 12px;min-height:36px;cursor:pointer}
  .wt-list{flex:1 1 auto;min-height:120px;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-top:8px;border:1px solid var(--line);border-radius:12px;background:var(--paper);position:relative}
  .wt-row{padding:9px 12px 9px 46px;border-bottom:1px solid var(--line);position:relative;cursor:pointer;font-size:15.5px;line-height:1.45}
  .wt-row i{position:absolute;left:10px;top:11px;font-style:normal;font-size:11px;color:var(--muted)}
  .wt-row .r{display:block;color:var(--muted);font-size:13px;margin-top:2px}
  .wt-row.cur{background:#EAF6F1;box-shadow:inset 4px 0 0 var(--jade)}.wt-row.cur .t{font-weight:700}
  .wt-back{position:sticky;bottom:10px;margin:0 auto;display:none;width:max-content;border:0;border-radius:999px;background:var(--ink);color:#fff;font:inherit;font-size:13px;padding:8px 16px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .wt-list.away .wt-back{display:block}
  .wt-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:80;display:none}.wt-mask.on{display:block}
  .wt-sheet{position:fixed;left:0;right:0;bottom:0;z-index:81;background:var(--paper);border-radius:18px 18px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.25);padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));max-width:620px;margin:0 auto;transform:translateY(105%);transition:transform .2s ease;max-height:70vh;overflow-y:auto}
  .wt-sheet.on{transform:none}
  .wt-sheet h3{margin:0;font-size:22px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .wt-sheet h3 small{font-size:14px;color:var(--muted);font-weight:400}
  .wt-sheet .m{font-size:17px;font-weight:700;margin-top:6px}
  .wt-sheet .p{color:var(--muted);font-size:14px;margin-top:4px;line-height:1.55}
  .wt-sheet .d{font-size:14px;margin-top:8px;line-height:1.5}
  .wt-sheet .x{background:var(--paper-2);border-radius:10px;padding:8px 10px;margin-top:10px;font-size:14px;line-height:1.5}
  .wt-sheet .x span{display:block;color:var(--muted);font-size:13px}
  .wt-sheet .a{display:flex;gap:8px;margin-top:14px}
  .wt-sheet .a button{flex:1;min-height:48px;border-radius:12px;border:1px solid var(--line);background:var(--paper);font:inherit;font-size:15px;font-weight:700;color:var(--ink);cursor:pointer}
  .wt-sheet .a .add{background:var(--jade);border-color:var(--jade);color:#fff;flex:2}
  .wt-sheet .a .add.in{background:var(--paper-2);border-color:var(--line);color:var(--muted)}
  @media (max-width:640px){
    #apptabs .seg-wrap.three button{font-size:13.5px;padding-left:0;padding-right:0}
    #view-video .wrap{padding:0 max(10px,env(safe-area-inset-left,0px)) 0 max(10px,env(safe-area-inset-right,0px))}
    #watch{padding-top:14px}
    .wt-sub .en{font-size:18px}
    .wt-video{border-radius:10px}
  }
  @media (max-width:640px) and (orientation:landscape){ .wt-video{max-height:62vh;aspect-ratio:auto;height:62vh} }
  /* 列表：搜索、排序、筛选 */
  .wt-tools{display:flex;gap:8px;margin-bottom:8px}
  .wt-q{flex:1;min-width:0;display:flex;align-items:center;gap:6px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:0 10px}
  .wt-q:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(15,163,122,.1)}
  .wt-q input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;padding:9px 0;color:var(--ink)}
  .wt-q button{border:0;background:transparent;color:var(--muted);font-size:18px;min-width:32px;min-height:40px;cursor:pointer;display:none}
  .wt-q.has button{display:block}
  .wt-sel{flex:none;max-width:118px;border:1px solid var(--line);background:var(--paper);border-radius:12px;font:inherit;font-size:16px;color:var(--ink);padding:0 8px;min-height:44px} /* 16px：iOS 点开不放大页面 */
  .wt-ib{flex:none;width:44px;min-height:44px;border:1px solid var(--line);background:var(--paper);border-radius:12px;font-size:18px;color:var(--ink);cursor:pointer}
  .wt-ib.spin{animation:wtspin .8s linear infinite}@keyframes wtspin{to{transform:rotate(360deg)}}
  .wt-chips{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-bottom:10px;padding-bottom:2px}
  .wt-chips::-webkit-scrollbar{display:none}
  .wt-chips button{flex:none;background:var(--paper);border:1px solid var(--line);color:var(--muted);font:inherit;font-size:12.5px;font-weight:600;padding:0 11px;min-height:34px;border-radius:999px;cursor:pointer;white-space:nowrap}
  .wt-chips button.on{background:var(--gold);color:#3a2c08;border-color:var(--gold);font-weight:700}
  .wt-chips button em{font-style:normal;opacity:.7;margin-left:3px;font-weight:500}
  .wt-cnt{color:var(--muted);font-size:12px;margin:0 2px 8px}
  .wt-cont{display:flex;gap:12px;align-items:center;background:linear-gradient(150deg,#F2FBF7,#fff);border:1px solid #CDEBDF;border-radius:14px;padding:10px;margin-bottom:12px;cursor:pointer}
  .wt-cont .wt-th{width:96px}
  .wt-cont small{display:block;color:var(--jade);font-size:11.5px;font-weight:800;letter-spacing:.06em}
  .wt-cont b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:1.35;margin-top:2px}
  .wt-cont span{display:block;color:var(--muted);font-size:12px;margin-top:3px}
  .wt-cont .go{flex:none;width:44px;height:44px;border-radius:50%;background:var(--jade);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;margin-left:auto}
  .wt-item>div:nth-child(2),.wt-cont>div:nth-child(2){flex:1;min-width:0}
  .wt-th{position:relative;flex:none;width:112px;border-radius:9px;overflow:hidden;background:var(--paper-2)}
  .wt-th img,.wt-item .wt-th img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:0}
  .wt-th .dur{position:absolute;right:4px;bottom:6px;background:rgba(0,0,0,.72);color:#fff;font-size:10.5px;font-weight:600;padding:1px 5px;border-radius:4px;line-height:1.4}
  .wt-th .pg{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.55)}
  .wt-th .pg i{display:block;height:100%;background:var(--jade)}
  .wt-item{position:relative}
  .wt-item.seen .wt-th img{opacity:.62}
  .wt-item b .st{color:var(--gold);margin-right:3px}
  .wt-item span em{font-style:normal;white-space:nowrap}
  .wt-item .ok{color:var(--jade);font-weight:700}.wt-item .ing{color:var(--jade)}.wt-item .tq{color:#c9741f}
  .wt-more{flex:none;align-self:stretch;width:36px;border:0;background:transparent;color:var(--muted);font-size:20px;font-weight:700;border-radius:10px;cursor:pointer;margin:-8px -8px -8px -6px;padding:0}
  .wt-more:active{background:var(--paper-2)}
  .wt-empty .wt-btn{margin-top:12px}
  .wt-empty ol{text-align:left;display:inline-block;margin:10px 0 0;padding-left:20px;color:var(--ink)}
  .wt-empty li{margin-bottom:4px}
  /* 播放页 */
  .wt-ctl+.wt-ctl{margin-top:6px}
  .wt-ctl button.lp{background:var(--gold);border-color:var(--gold);color:#3a2c08}
  .wt-sub.hide-en .en:not(.none){filter:blur(8px);cursor:pointer;user-select:none;-webkit-user-select:none}.wt-sub.hide-en .en.rv{filter:none;user-select:auto;-webkit-user-select:auto}
  .wt-sub .rs{display:block;margin-top:8px}
  .wt-sub .rs button{border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:999px;font:inherit;font-size:13px;padding:0 14px;min-height:34px;cursor:pointer}
  #watch.hide-tr .wt-row .r{filter:blur(5px)}
  #watch.hide-en .wt-row .t{filter:blur(6px)}
  .wt-row.lp{background:#FFF8EC;box-shadow:inset 4px 0 0 var(--gold)}
  .wt-row.lp.cur{background:#FDF0D8}
  #watch.fs0 .wt-sub .en{font-size:16px}#watch.fs0 .wt-sub .zh{font-size:13.5px}#watch.fs0 .wt-row{font-size:14px}
  #watch.fs2 .wt-sub .en{font-size:23px}#watch.fs2 .wt-sub .zh{font-size:17px}#watch.fs2 .wt-row{font-size:17.5px}
  /* 菜单（底部弹出） */
  .wt-mh b{display:block;font-size:16px;line-height:1.4;padding-right:6px}
  .wt-mh span{display:block;color:var(--muted);font-size:13px;margin-top:3px}
  .wt-menu{margin-top:10px;border-top:1px solid var(--line)}
  .wt-menu button,.wt-menu a{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;border:0;border-bottom:1px solid var(--line);background:transparent;font:inherit;font-size:15.5px;color:var(--ink);text-align:left;padding:0 4px;cursor:pointer;text-decoration:none}
  .wt-menu button:active,.wt-menu a:active{background:var(--paper-2)}
  .wt-menu .del{color:#C8432F;font-weight:700}
  .wt-mrow{display:flex;align-items:center;gap:12px;margin-top:12px;font-size:14px;color:var(--muted)}
  .wt-seg{display:flex;gap:3px;background:var(--paper-2);border:1px solid var(--line);border-radius:11px;padding:3px;flex:1}
  .wt-seg button{flex:1;border:0;background:transparent;border-radius:8px;min-height:38px;font:inherit;font-size:14px;font-weight:700;color:var(--muted);cursor:pointer}
  .wt-seg button.on{background:var(--paper);color:var(--jade);box-shadow:0 1px 4px rgba(20,30,45,.1)}
  .wt-keys{margin-top:12px;font-size:13px;color:var(--muted);line-height:1.9}
  .wt-keys kbd{display:inline-block;min-width:22px;text-align:center;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:0 5px;margin-right:4px;font:600 12px/1.6 ui-monospace,Menlo,monospace;color:var(--ink);background:var(--paper)}
  .wt-keys span{display:inline-block;margin-right:14px;white-space:nowrap}
  @media (max-width:400px){ .wt-th{width:100px}.wt-cont .wt-th{width:84px}.wt-sel{max-width:104px}.wt-ctl button{font-size:12.5px} }
  /* 深色主题（和插件同一套配色，变量在 theme.css） */
  .wt-list .wt-w.lr{color:var(--ui-orange)}.wt-list .wt-w.kn{color:var(--ui-green)}
  .wt-note{background:rgba(255,184,107,.1);color:#f3d3a8}
  .wt-row.cur{background:rgba(156,63,208,.16);box-shadow:inset 4px 0 0 var(--ui-pur)}
  .wt-q:focus-within{border-color:var(--ui-pur);box-shadow:0 0 0 3px rgba(156,63,208,.22)}
  .wt-chips button.on,.wt-ctl button.lp{background:var(--ui-orange);border-color:var(--ui-orange);color:#2b1d05}
  .wt-cont{background:linear-gradient(150deg,rgba(156,63,208,.16),var(--ui-surface));border-color:rgba(156,63,208,.35)}
  .wt-cont small{color:var(--ui-pur-text)}
  .wt-item .ok,.wt-item .ing{color:var(--ui-pur-text)}.wt-item .tq{color:var(--ui-orange)}
  .wt-row.lp{background:rgba(255,184,107,.1);box-shadow:inset 4px 0 0 var(--ui-orange)}.wt-row.lp.cur{background:rgba(255,184,107,.18)}
  .wt-menu .del{color:var(--ui-red)}
  .wt-btn{background:var(--ui-pur)}.wt-btn:hover{background:var(--ui-pur-hi)}
  /* 电脑端（≥1024px）：铺满屏幕；列表多列；播放时视频在左、字幕列表在右 */
  @media (min-width:1024px){
    #view-video .wrap{max-width:none;padding:0 40px}
    .wt-home{max-width:none}
    .wt-open{max-width:760px}
    #wt-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px;align-items:start}
    #wt-items .wt-item{margin-bottom:0}
    #wt-items>:not(.wt-item){grid-column:1/-1}
    .wt-play{display:none;grid-template-columns:minmax(0,1fr) clamp(360px,32vw,520px);grid-template-rows:auto auto auto auto auto 1fr;column-gap:20px;align-items:start}
    #watch.playing .wt-play{display:grid}
    .wt-play>*{grid-column:1}
    .wt-play>.wt-bar{grid-column:1/-1}
    .wt-play>.wt-list{grid-column:2;grid-row:2/-1;margin-top:0;height:100%;min-height:0;align-self:stretch}
    .wt-video{max-height:calc(100vh - 300px)}
  }`;

  /* ---------- 生词本状态 ---------- */
  let book = new Map();
  function loadBook() { book = new Map(); try { words.forEach(w => { const k = String(w.word || "").toLowerCase().replace(/[{}]/g, ""); if (k) book.set(k, w.status === "known" ? "kn" : "lr"); }); } catch (e) {} }
  function stems(w) { const o = [w]; if (/ies$/.test(w)) o.push(w.slice(0, -3) + "y"); if (/(es|ed)$/.test(w)) o.push(w.slice(0, -2), w.slice(0, -1)); if (/s$/.test(w)) o.push(w.slice(0, -1)); if (/ing$/.test(w)) o.push(w.slice(0, -3), w.slice(0, -3) + "e"); if (/(.)\1(ed|ing)$/.test(w)) o.push(w.replace(/(.)\1(ed|ing)$/, "$1")); return o; }
  const statusOf = w => { for (const s of stems(w.toLowerCase())) if (book.has(s)) return book.get(s); return ""; };
  const markup0 = t => esc(t).replace(WORD, w => '<span class="wt-w ' + statusOf(w.replace(/’/g, "'")) + '" data-w="' + w.replace(/’/g, "'") + '">' + w + "</span>");
  const markup = t => (VS ? vsHtml(t) : markup0(t));

  /* ---------- 和插件一致：按词汇水平上色、语法下划线、句型 / 习语 / 短语动词注释、单词注释、颜色标记 ----------
     判断规则和数据用插件同一份（web/vs/，由 tools/sync-shared.sh 从 extension/ 复制）；
     插件设置（词汇水平、颜色、开关）和你的标记从 /api/ext 读，在网站上改标记也写回 /api/ext，插件那边自动跟上 */
  const VS_FILES = ["freq.js", "vlevel.js", "gram.js", "pattern.js", "data-phrases.js", "data-words.js", "data-morph.js", "notes.js"];
  const VS_DEF = { showMarks: true, level: -1, ratio: 1.5, greenKnown: false, fadeRare: true, showSuggest: true, showLearn: true, showLearnOutline: true, showIgnore: true, showSpecial: true, colKnown: "#7CE3B8", colSuggest: "#FFB86B", colIgnore: "#CDA8F7", colSpecial: "#7CE3B8", showGram: true, gramLabel: "abbr", g_pa: true, g_pf: true, g_pg: true, g_md: true, g_pv: true, g_s3: true, g_pl: true, g_art: true, g_cmp: true, g_neg: true, showPat: true, n_phrase: true, n_spoken: true, n_link: true, n_word: true, cloze: false, target: "zh-CN" };
  const VS_CSS = `
  :is(#view-video,#pump) .vs-w{cursor:pointer;border-radius:3px}
  :is(#view-video,#pump) .vs-w.vs-k{color:var(--vs-ck,#7CE3B8)}:is(#view-video,#pump) .vs-w.vs-u1,:is(#view-video,#pump) .vs-w.vs-ln{color:var(--vs-cs,#FFB86B)}:is(#view-video,#pump) .vs-w.vs-u2{color:var(--vs-ci,#CDA8F7)}:is(#view-video,#pump) .vs-w.vs-sp{color:var(--vs-cp,#7CE3B8)}
  :is(#view-video,#pump) .vs-w.vs-rare{opacity:.55}
  :is(#view-video,#pump) .vs-w.vs-lo{box-shadow:inset 0 0 0 1.5px #E9CF8A;background:rgba(255,226,140,.14);border-radius:6px;padding:0 3px}
  :is(#view-video,#pump) .vs-w.vs-pk{background:rgba(120,175,240,.32);box-shadow:0 0 0 2px rgba(120,175,240,.32);border-radius:4px}
  :is(#view-video,#pump) .vs-w[class*=" g-"]{text-underline-offset:4px}
  :is(#view-video,#pump) .vs-w.g-pa{text-decoration:underline solid #5BB0FF 2px}:is(#view-video,#pump) .vs-w.g-pf{text-decoration:underline double #35D0BA 2px}:is(#view-video,#pump) .vs-w.g-pg{text-decoration:underline wavy #8EE05A 2px}:is(#view-video,#pump) .vs-w.g-md{text-decoration:underline dashed #FF8FC7 2px}:is(#view-video,#pump) .vs-w.g-pv{text-decoration:underline solid #FF7A59 3.5px}:is(#view-video,#pump) .vs-w.g-s3{text-decoration:underline dotted #5BB0FF 2.5px}:is(#view-video,#pump) .vs-w.g-pl{text-decoration:underline dotted #B0B7C0 2.5px}:is(#view-video,#pump) .vs-w.g-art{text-decoration:underline dotted #E8D36B 2.5px}:is(#view-video,#pump) .vs-w.g-cmp{text-decoration:underline dashed #C9A0FF 2px}:is(#view-video,#pump) .vs-w.g-neg{box-shadow:inset 0 2px 0 #FF5C5C}
  :is(#view-video,#pump) .vs-w.vs-ph{background:rgba(255,226,140,.13);box-shadow:inset 0 1.5px 0 #E9CF8A,inset 0 -1.5px 0 #E9CF8A;border-radius:0;padding:0 2px}:is(#view-video,#pump) .vs-w.vs-ph.ph-s{border-radius:5px 0 0 5px;box-shadow:inset 0 1.5px 0 #E9CF8A,inset 0 -1.5px 0 #E9CF8A,inset 1.5px 0 0 #E9CF8A}:is(#view-video,#pump) .vs-w.vs-ph.ph-e{border-radius:0 5px 5px 0;box-shadow:inset 0 1.5px 0 #E9CF8A,inset 0 -1.5px 0 #E9CF8A,inset -1.5px 0 0 #E9CF8A}
  #view-video.vs-cloze .wt-sub .en .vs-w:is(.vs-u1,.vs-u2,.vs-lo,.vs-ln){color:transparent!important;background:rgba(255,255,255,.16);border-radius:4px;border-bottom:2px dashed rgba(255,255,255,.55)}#view-video.vs-cloze .wt-sub .en .vs-w:is(.vs-u1,.vs-u2,.vs-lo,.vs-ln):hover{color:#fff!important}
  .wt-sub .vs-p{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px}
  .wt-sub .vs-pc{cursor:pointer;font:600 13px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif;color:#d8e9ff;background:rgba(47,109,176,.38);border:1px solid rgba(120,175,240,.45);border-radius:999px;padding:1px 10px;text-align:left}
  .wt-sub .vs-pc b{color:#fff;font-weight:800}.wt-sub .vs-pc:hover,.wt-sub .vs-pc.on{background:#2F6DB0;border-color:#7fb3ee}
  .wt-sub .vs-pc.k-idiom{background:rgba(176,112,32,.42);border-color:rgba(240,190,110,.55);color:#ffe6c2}.wt-sub .vs-pc.k-phv{background:rgba(32,140,110,.42);border-color:rgba(110,220,180,.5);color:#d4fff0}.wt-sub .vs-pc.k-col{background:rgba(120,80,170,.42);border-color:rgba(190,160,240,.5);color:#eee2ff}.wt-sub .vs-pc.k-red,.wt-sub .vs-pc.k-fill{background:rgba(90,96,110,.5);border-color:rgba(190,196,210,.45);color:#eef0f4}.wt-sub .vs-pc.k-link{background:rgba(170,60,90,.4);border-color:rgba(240,140,170,.5);color:#ffe0ea}.wt-sub .vs-pc.on{filter:brightness(1.35)}
  .wt-sub .vs-pd{display:none;margin:8px auto 0;max-width:560px;background:#0f1d2e;border:1px solid #2F6DB0;border-radius:10px;padding:9px 13px;text-align:left;font:500 14px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif;color:#e6eef8}.wt-sub .vs-pd.show{display:block}.wt-sub .vs-pd .hd{font-weight:800;color:#9cc8ff;margin-bottom:3px}.wt-sub .vs-pd .ex{margin-top:5px;color:#ffd77a}
  .vs-wns{margin:8px 0 2px;display:flex;flex-direction:column;gap:3px;font:500 13px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif;text-align:left}.vs-wn{display:flex;gap:6px;align-items:baseline}.vs-wn>i{flex:0 0 auto;font-style:normal;font-weight:800;font-size:11px;color:#9cc8ff;background:rgba(47,109,176,.25);border-radius:5px;padding:0 5px;line-height:1.6}.vs-wn.warn>i{color:#ffd77a;background:rgba(232,162,60,.22)}.vs-wn.bad>i{color:#ff9d9d;background:rgba(220,60,60,.22)}.vs-wn.dim{opacity:.75}.vs-wn>span b{color:#fff}.vs-wn a{color:#7fb3ee}
  #wt-sheet .gm{margin-top:6px;font-size:13px;color:#9cc8ff}
  #wt-sheet .mk{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}#wt-sheet .mk button{flex:1 1 auto;min-height:36px;border-radius:9px;border:1px solid var(--ui-line-2,#454950);background:var(--ui-surface-2,#2d2f34);color:var(--ui-ink,#E6E8EB);font:inherit;font-size:13.5px;cursor:pointer}
  #wt-sheet .mk button.on{background:var(--ui-pur,#9C3FD0);border-color:var(--ui-pur,#9C3FD0);color:#fff}`;
  let VS = null, vsP = null; // VS = { S 插件设置, sents 已保存短语（拆成词） }
  function vsLoad() {
    if (vsP) return vsP;
    vsP = (async () => {
      let ver = ""; try { ver = (await (await fetch("vs/VERSION", { cache: "no-store" })).text()).trim(); } catch (e) {}
      await new Promise((res, rej) => { VS_FILES.forEach((f, i) => { const s = document.createElement("script"); s.src = "vs/" + f + "?v=" + ver; s.async = false; if (i === VS_FILES.length - 1) { s.onload = res; s.onerror = rej; } document.head.append(s); }); }); // async=false：按顺序执行
      const st = document.createElement("style"); st.textContent = VS_CSS; document.head.append(st);
      await vsData();
    })().catch(() => { vsP = null; });
    return vsP;
  }
  window.__vs = { load: () => vsLoad(), ready: () => !!VS, html: t => (VS ? vsHtml(t) : null) }; // 练习页（pump.js）也用同一套上色
  async function vsData() {
    let it = {}; try { it = (await (await fetch("/api/ext", { cache: "no-store" })).json()).items || {}; } catch (e) {}
    const S = Object.assign({}, VS_DEF), marks = {}, saved = new Set(), sents = [];
    for (const k in it) { const i = k.indexOf("|"), n = k.slice(0, i), id = k.slice(i + 1), v = it[k].v;
      if (n === "set") S[id] = v; else if (n === "marks" && (v === "known" || v === "ignore")) marks[id] = v; else if (n === "saved") saved.add(id); else if (n === "savedSents" && v && v.ph && v.t) sents.push(String(v.t).toLowerCase().split(/\s+/)); }
    try { words.forEach(w => { const k = String(w.word || "").toLowerCase().trim(); if (!/^[a-z][a-z'’-]*$/.test(k)) return; if (w.status === "known") { if (!marks[k]) marks[k] = "known"; saved.delete(k); } else if (!marks[k]) saved.add(k); }); } catch (e) {} // 网站生词本：在学的算「正在学习」，已掌握的算「已知」
    VS_MARKS = marks; VS_SAVED = saved; VS = { S, sents };
    const de = document.documentElement.style; de.setProperty("--vs-ck", S.colKnown); de.setProperty("--vs-cs", S.colSuggest); de.setProperty("--vs-ci", S.colIgnore); de.setProperty("--vs-cp", S.colSpecial);
    const vv = document.getElementById("view-video"); if (vv) vv.classList.toggle("vs-cloze", !!S.cloze);
    vsRedraw();
  }
  function vsRedraw() { if (!listEl) return; if (cur >= 0) showSub(cur); if (cues.length) { const top = listEl.scrollTop; drawCues(); listEl.scrollTop = top; const row = listEl.children[cur]; if (row && row.classList.contains("wt-row")) row.classList.add("cur"); } }
  function vsPh(h) { // 保存过的短语整段带框（同插件）
    if (!VS.sents.length) return h;
    const re = /<span class="vs-w ([^"]*)" data-w="([^"]+)">/g, ws = []; let m; while ((m = re.exec(h))) ws.push(m[2].toLowerCase()); if (ws.length < 2) return h;
    const tag = {};
    VS.sents.forEach(p => { for (let i = 0; i + p.length <= ws.length; i++) { let ok = true; for (let k = 0; k < p.length; k++) if (ws[i + k] !== p[k] && !(k === 0 && vsLemma(ws[i + k]) === vsLemma(p[k]))) { ok = false; break; } if (ok) for (let k = 0; k < p.length; k++) tag[i + k] = "vs-ph" + (k === 0 ? " ph-s" : "") + (k === p.length - 1 ? " ph-e" : ""); } });
    let n = 0; return h.replace(re, (a, cl, w) => { const t = tag[n++]; return t ? '<span class="vs-w ' + cl + " " + t + '" data-w="' + w + '">' : a; });
  }
  function vsHtml(t) {
    const S = VS.S; let h = vsMark(esc(t), S);
    if (S.showGram !== false && /\s/.test(t) && typeof vsGramHtml === "function") h = vsGramHtml(h).replace(/ g-(\w+)(?=[ "])/g, (a, c) => (S["g_" + c] === false ? "" : a));
    return vsPh(h).replace(/<span class="vs-w /g, '<span class="wt-w vs-w ');
  }
  let vsPats = [];
  function vsPatHtml(c) { // 句型 / 习语 / 短语动词 / 口语缩略 / 连读：当前句下面一排小标签（同插件）
    vsPats = []; if (!VS || !c) return "";
    const ws = (c.t.match(VS_WORD_RE) || []), S = VS.S;
    if (S.showPat !== false && typeof vsPatterns === "function") vsPats = vsPatterns(ws, 3, c.t) || [];
    if (typeof vsSentNotes === "function") vsPats = vsPats.concat(vsSentNotes(ws, c.t, S, Math.max(1, 5 - vsPats.length), [].concat(...vsPats.map(p => p.keys))) || []);
    return vsPats.length ? '<div class="vs-p">' + vsPats.map((p, i) => '<span class="vs-pc' + (p.cls ? " " + p.cls : "") + '" data-pi="' + i + '">' + (p.icon || "📐") + " <b>" + esc(p.name) + "</b> " + esc(p.zh) + "</span>").join("") + '</div><div class="vs-pd"></div>' : "";
  }
  function vsPatShow(i) {
    const pd = subEl.querySelector(".vs-pd"), ws = [...subEl.querySelectorAll(".en .vs-w")], p = vsPats[i], chips = subEl.querySelectorAll(".vs-pc");
    const on = p && !(chips[i] && chips[i].classList.contains("on"));
    ws.forEach(w => w.classList.remove("vs-pk")); chips.forEach(x => x.classList.toggle("on", on && +x.dataset.pi === i));
    if (!pd) return; if (!on) { pd.classList.remove("show"); fit(); return; }
    p.keys.forEach(k => ws[k] && ws[k].classList.add("vs-pk"));
    pd.innerHTML = '<div class="hd">' + (p.icon || "📐") + " " + esc(p.name) + " · " + esc(p.zh) + "</div><div>" + esc(p.tip || "") + "</div>" + (p.ex ? '<div class="ex">例：' + esc(p.ex) + "</div>" : "");
    pd.classList.add("show"); fit();
  }
  const vsMarkNow = w => { if (!VS) return ""; const k = w.toLowerCase(); const m = vsMarkOf(k); return m; };
  function vsSheetExtra(w, el) { // 查词卡片里：语法、单词注释、标记按钮（同插件）
    if (!VS) return "";
    const g = el ? [...el.classList].filter(c => /^g-/.test(c)).map(c => typeof VS_GRAM_NAME !== "undefined" && VS_GRAM_NAME[c.slice(2)] && VS_GRAM_NAME[c.slice(2)] + " " + VS_GRAM_ABBR[c.slice(2)]).filter(Boolean) : [];
    const notes = VS.S.n_word !== false && typeof vsWordNotesHtml === "function" && !/\s/.test(w) ? vsWordNotesHtml(w, false) : "", m = vsMarkNow(w);
    return (g.length ? '<div class="gm">语法：' + g.join(" · ") + "</div>" : "") + notes +
      '<div class="mk"><button data-a="mk" data-m="learn" class="' + (m === "learn" ? "on" : "") + '">📌 将要学习</button><button data-a="mk" data-m="known" class="' + (m === "known" ? "on" : "") + '">✅ 已掌握</button><button data-a="mk" data-m="ignore" class="' + (m === "ignore" ? "on" : "") + '">🚫 不学习</button><button data-a="mk" data-m="">↺ 恢复默认</button></div>';
  }
  async function vsSetMark(w, m) { // 和插件右键 / 词典里的标记一样；写回 /api/ext，插件那边同步过去
    const k = w.toLowerCase(), at = Date.now(), ch = {};
    const marks = Object.assign({}, VS_MARKS), saved = new Set(VS_SAVED);
    if (m === "learn") { delete marks[k]; saved.add(k); ch["marks|" + k] = { del: 1, at }; ch["saved|" + k] = { v: k, at }; }
    else { saved.delete(k); ch["saved|" + k] = { del: 1, at }; if (m) { marks[k] = m; ch["marks|" + k] = { v: m, at }; } else { delete marks[k]; ch["marks|" + k] = { del: 1, at }; } }
    VS_MARKS = marks; VS_SAVED = saved;
    try { // 生词本里的掌握状态跟着变
      const e = (state.custom || []).find(x => x && String(x.word || "").toLowerCase() === k);
      if (e && (m === "known" || m === "learn")) { state.progress = state.progress || {}; if (m === "known") state.progress[e.id] = "known"; else delete state.progress[e.id]; refresh(); save(state); loadBook(); }
    } catch (er) {}
    vsRedraw();
    try { await fetch("/api/ext", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes: ch }) }); } catch (er) { tip("没连上网络，标记只在这台设备生效"); }
  }

  /* ---------- 搭界面 ---------- */
  let root, listEl, subEl, enter = () => {};
  function build() {
    const st = document.createElement("style"); st.textContent = css; document.head.append(st);
    const seg = $("#apptabs .seg-wrap"), ven = document.getElementById("view-en"); if (!seg || !ven) return false;
    root = document.createElement("div"); root.id = "watch";
    root.innerHTML = `
      <div class="wt-home">
        <div class="wt-open"><input id="wt-url" inputmode="url" placeholder="粘贴 YouTube 链接…" autocomplete="off" autocapitalize="off"><button class="wt-btn" id="wt-go">打开</button></div>
        <div class="wt-hint">在电脑上用「双语字幕」插件看过的视频会自动出现在这里，带双语字幕，可以点词查词、加入生词本。</div>
        <details class="wt-bm" id="wt-bm"><summary>📱 手机上给任意视频加字幕（不用电脑）</summary>
          <ol>
            <li>点下面的按钮，复制书签代码。</li>
            <li>在 Safari 里把任意网页加入书签（分享 → 添加书签），名字改成「学这个视频」。</li>
            <li>打开书签列表 → 编辑 → 点这个书签，把「地址」整段删掉，粘贴刚才复制的代码，保存。</li>
            <li>以后在 Safari 里打开 YouTube 视频（要用浏览器，不是 YouTube App），点一下播放，再从书签里点「学这个视频」。</li>
          </ol>
          <div class="wt-bma"><button class="wt-btn" id="wt-bmc">复制书签代码</button><a id="wt-bml" class="wt-bml">学这个视频</a></div>
          <p>电脑上可以直接把右边的「学这个视频」拖到书签栏。安卓 Chrome：同样存成书签，然后在 YouTube 页面的地址栏里输入「学这个视频」并点选它。</p>
        </details>
        <div class="wt-tools">
          <label class="wt-q" id="wt-qbox"><input id="wt-q" type="search" placeholder="搜索标题、频道…" autocomplete="off" enterkeyhint="search"><button type="button" id="wt-qx" aria-label="清除搜索">×</button></label>
          <select class="wt-sel" id="wt-sort" aria-label="排序"><option value="add">最近添加</option><option value="watch">最近观看</option><option value="title">标题</option><option value="dur">时长</option></select>
          <button class="wt-ib" id="wt-ref" type="button" aria-label="刷新列表" title="刷新列表">↻</button>
        </div>
        <div class="wt-chips" id="wt-chips"></div>
        <div id="wt-items"></div>
      </div>
      <div class="wt-play">
        <div class="wt-bar"><button id="wt-back" aria-label="返回">‹ 返回</button><b id="wt-title"></b></div>
        <div class="wt-fbar"><span>🎬</span><b id="wt-ftitle"></b><button id="wt-fplay" type="button">⏯</button><button id="wt-fback" type="button" title="回到视频页">↩ 回到视频</button><button id="wt-fx" type="button" title="停止并关掉">✕</button></div><div class="wt-video"><div id="wt-yt"></div></div>
        <div class="wt-sub" id="wt-sub"><div class="en none">点 ▶ 开始播放</div><div class="zh"></div></div>
        <div class="wt-ctl">
          <button id="wt-prev" aria-label="上一句" title="上一句（←）">⏮ 上句</button>
          <button id="wt-rep" aria-label="重播这句" title="重听这句（R）">🔁 重听</button>
          <button id="wt-next" aria-label="下一句" title="下一句（→）">下句 ⏭</button>
          <button id="wt-loop" title="单句循环（L）">🔂 单句</button>
          <button id="wt-ab" title="区间循环：先在起点那句点一下，再在终点那句点一下（B）">A-B</button>
        </div>
        <div class="wt-ctl">
          <button id="wt-ap" title="每句播完自动暂停（P）">逐句停</button>
          <button id="wt-ht" title="模糊中文译文（T）">藏译文</button>
          <button id="wt-he" title="模糊英文原文，练听力（E）">藏原文</button>
          <button id="wt-rate" title="播放速度">1×</button>
          <button id="wt-more2" aria-label="更多">⋯ 更多</button>
        </div>
        <div class="wt-note" id="wt-note" style="display:none"></div>
        <div class="wt-list" id="wt-list"></div>
      </div>`;
    const view = document.createElement("div"); view.id = "view-video"; view.innerHTML = '<div class="wrap"></div>'; view.firstChild.append(root);
    ven.parentNode.insertBefore(view, ven);
    const mask = document.createElement("div"); mask.className = "wt-mask"; mask.id = "wt-mask";
    const sheet = document.createElement("div"); sheet.className = "wt-sheet"; sheet.id = "wt-sheet";
    document.body.append(mask, sheet);
    listEl = $("#wt-list"); subEl = $("#wt-sub");

    // 视频在「📚 英语 → 🎧 听 → 🎬 视频」（index.html 的 enShow('listen','video') 调 videoCore.enter，切到别处调 videoCore.leave）
    const H = document.documentElement;
    const leave = () => { if (!H.classList.contains("show-video")) return; const fl = root.classList.contains("playing") && playing(); H.classList.remove("show-video", "wt-playing"); LS.set("wt:tab", 0); if (fl) { H.classList.add("wt-float"); $("#wt-ftitle").textContent = (doc && doc.title) || ""; } else { try { player && player.pauseVideo && player.pauseVideo(); } catch (e) {} } }; // 正在放：变成右下角悬浮小窗接着放
    const unfloat = () => H.classList.remove("wt-float");
    $("#wt-fx").onclick = () => { try { player && player.pauseVideo && player.pauseVideo(); } catch (e) {} savePos(true); unfloat(); };
    $("#wt-fback").onclick = () => { unfloat(); enter(); };
    $("#wt-fplay").onclick = () => { try { if (playing()) player.pauseVideo(); else player.playVideo(); } catch (e) {} };
    const core = () => {
      H.classList.remove("wt-float"); H.classList.add("show-video"); H.classList.toggle("wt-playing", root.classList.contains("playing"));
      scrollTo(0, 0); $("#wt-bml").href = bookmarklet(); loadBook(); loadList(); fit(); if (VS) vsData(); else vsLoad();
    };
    window.videoCore = { enter: core, leave, pause: () => { try { if (playing()) player.pauseVideo(); } catch (e) {} } }; // pause：别处开始放音频（BBC 听力）时停视频
    enter = () => { if (window.enShow) window.enShow("listen", "video"); else core(); }; // 别的地方（?v=、已保存里的视频）要打开视频：先切到「🎧 听 → 🎬 视频」
    $("#wt-bml").href = bookmarklet(); $("#wt-bml").onclick = e => { e.preventDefault(); tip("把它拖到书签栏；手机上请用「复制书签代码」"); };
    $("#wt-bmc").onclick = async () => { tip(await copyText(bookmarklet()) ? "已复制，按上面第 2、3 步存成书签" : "复制失败，请长按右边的链接复制"); };
    $("#wt-go").onclick = () => openUrl($("#wt-url").value);
    $("#wt-url").addEventListener("keydown", e => { if (e.key === "Enter") openUrl(e.target.value); });
    // 列表：搜索 / 排序 / 筛选 / 刷新 / 每条的「⋯」菜单
    const qi = $("#wt-q"), qb = $("#wt-qbox");
    qi.addEventListener("input", () => { q = qi.value.trim().toLowerCase(); qb.classList.toggle("has", !!qi.value); drawList(); });
    qi.addEventListener("keydown", e => { if (e.key === "Enter") qi.blur(); });
    $("#wt-qx").onclick = e => { e.preventDefault(); qi.value = ""; q = ""; qb.classList.remove("has"); drawList(); };
    $("#wt-sort").value = lv.sort; $("#wt-sort").onchange = e => { lv.sort = e.target.value; LS.set("wt:lv", lv); drawList(); };
    $("#wt-chips").addEventListener("click", e => { const b = e.target.closest("button[data-f]"); if (!b) return; lv.filter = b.dataset.f; LS.set("wt:lv", lv); drawList(); });
    $("#wt-ref").onclick = () => loadList(true);
    $("#wt-items").addEventListener("click", e => {
      const a = e.target.closest("[data-act]"); if (a) { e.stopPropagation(); if (a.dataset.act === "clear") { qi.value = ""; q = ""; qb.classList.remove("has"); lv.filter = "all"; LS.set("wt:lv", lv); drawList(); } else if (a.dataset.act === "bm") { const d = $("#wt-bm"); d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); } else if (a.dataset.act === "retry") loadList(true); return; }
      const m = e.target.closest(".wt-more"); if (m) { menu(m.dataset.v, false); return; }
      const it = e.target.closest(".wt-item,.wt-cont"); if (it) open(it.dataset.v);
    });
    $("#wt-back").onclick = closePlay;
    $("#wt-prev").onclick = () => jump(-1); $("#wt-next").onclick = () => jump(1); $("#wt-rep").onclick = () => jump(0);
    $("#wt-loop").onclick = toggleLoop; $("#wt-ab").onclick = toggleAB;
    $("#wt-ap").onclick = () => { set.autoPause = !set.autoPause; saveSet(); };
    $("#wt-ht").onclick = () => { set.hideTr = !set.hideTr; saveSet(); };
    $("#wt-he").onclick = () => { set.hideEn = !set.hideEn; saveSet(); };
    $("#wt-more2").onclick = () => doc && menu(doc.v, true);
    $("#wt-rate").onclick = () => { const R = [1, 0.75, 0.5, 1.25]; set.rate = R[(R.indexOf(set.rate) + 1) % R.length]; saveSet(); try { player.setPlaybackRate(set.rate); } catch (e) {} };
    subEl.addEventListener("click", e => {
      if (e.target.closest(".rs button")) { fromStart(); return; }
      const en = e.target.closest(".en"); if (en && set.hideEn && !en.classList.contains("rv") && !en.classList.contains("none")) { en.classList.add("rv"); return; } // 藏原文时先点一下才显示
      const pc = e.target.closest(".vs-pc"); if (pc) { vsPatShow(+pc.dataset.pi); return; }
      const w = e.target.closest(".wt-w"); if (w) { lookup(w.dataset.w, cur, w); return; } const z = e.target.closest(".zh"); if (z) z.classList.toggle("rv");
    });
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", e => { if (e.key === " " && root.classList.contains("playing") && e.target && e.target.tagName === "BUTTON" && root.contains(e.target)) e.preventDefault(); }); // 空格已经当作播放/暂停，别再触发按钮
    // 离开页面 / 切到后台时记下看到哪里
    document.addEventListener("visibilitychange", () => { if (document.hidden) savePos(true); });
    addEventListener("pagehide", () => savePos(true));
    listEl.addEventListener("click", e => { if (e.target.closest(".wt-back")) { follow = true; listEl.classList.remove("away"); scrollCur(true); return; } const w = e.target.closest(".wt-w"), row = e.target.closest(".wt-row"); if (!row) return; const i = +row.dataset.i; if (w) { lookup(w.dataset.w, i, w); return; } seek(i); });
    const away = () => { userScroll = Date.now(); follow = false; listEl.classList.add("away"); };
    listEl.addEventListener("touchmove", away, { passive: true }); listEl.addEventListener("wheel", away, { passive: true });
    mask.onclick = closeSheet;
    sheet.addEventListener("click", onSheet);
    addEventListener("resize", fit);
    paintSet();
    return true;
  }
  function saveSet() { LS.set("wt:set", set); paintSet(); }
  function paintSet() {
    $("#wt-ap").classList.toggle("on", set.autoPause); $("#wt-ht").classList.toggle("on", set.hideTr); $("#wt-he").classList.toggle("on", set.hideEn); $("#wt-rate").textContent = set.rate + "×";
    subEl.classList.toggle("hide", set.hideTr); subEl.classList.toggle("hide-en", set.hideEn);
    root.classList.toggle("hide-tr", set.hideTr); root.classList.toggle("hide-en", set.hideEn);
    root.classList.remove("fs0", "fs1", "fs2"); root.classList.add("fs" + set.fs);
  }
  function paintLoop() {
    const single = !!loop && loop.a === loop.b, range = !!loop && loop.a !== loop.b;
    $("#wt-loop").classList.toggle("lp", single);
    const ab = $("#wt-ab"); ab.classList.toggle("lp", range || abA >= 0); ab.textContent = abA >= 0 ? "A→?" : range ? "A-B ✓" : "A-B";
    Array.prototype.forEach.call(listEl.children, (r, i) => { if (r.classList.contains("wt-row")) r.classList.toggle("lp", !!loop && i >= loop.a && i <= loop.b); });
  }
  const curIdx = () => { if (cur >= 0) return cur; const i = find(now()); return i < 0 ? 0 : i; };
  function toggleLoop() {
    if (!cues.length) return; abA = -1;
    if (loop && loop.a === loop.b) { loop = null; tip("已关闭单句循环"); }
    else { const i = curIdx(); loop = { a: i, b: i }; tip("单句循环：第 " + (i + 1) + " 句"); }
    paintLoop();
  }
  function toggleAB() {
    if (!cues.length) return;
    if (loop && loop.a !== loop.b) { loop = null; abA = -1; tip("已关闭区间循环"); }
    else if (abA < 0) { loop = null; abA = curIdx(); tip("起点：第 " + (abA + 1) + " 句。播到终点那句时再点一次 A-B"); }
    else { const i = curIdx(), a = Math.min(abA, i), b = Math.max(abA, i); abA = -1; loop = { a, b }; tip(a === b ? "起点和终点是同一句，改成单句循环" : "循环第 " + (a + 1) + "～" + (b + 1) + " 句"); }
    paintLoop();
  }
  function togglePlay() { if (!ready) return; try { if (playing()) player.pauseVideo(); else player.playVideo(); } catch (e) {} }
  async function copyCur() { const c = cues[cur]; if (!c) { tip("还没有正在播放的句子"); return; } tip(await copyText(c.t + (c.r ? "\n" + c.r : "")) ? "已复制这句" : "复制失败"); }
  function onKey(e) { // 电脑上的快捷键（播放页）
    if (!document.documentElement.classList.contains("show-video") || !root.classList.contains("playing")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target; if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
    if ($("#wt-sheet").classList.contains("on")) { if (e.key === "Escape") { e.preventDefault(); closeSheet(); } return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const act = { " ": togglePlay, k: togglePlay, ArrowLeft: () => jump(-1), ArrowRight: () => jump(1), r: () => jump(0), l: toggleLoop, b: toggleAB, p: () => $("#wt-ap").click(), t: () => $("#wt-ht").click(), e: () => $("#wt-he").click(), s: () => $("#wt-rate").click(), c: copyCur }[k];
    if (!act) return; e.preventDefault(); act();
  }
  function fit() { // 播放页占满一屏：视频、当前字幕、按钮固定，下面的字幕列表自己滚动
    const p = $(".wt-play", root); if (!root.classList.contains("playing") || !document.documentElement.classList.contains("show-video")) return;
    scrollTo(0, 0); const top = p.getBoundingClientRect().top, land = innerWidth > innerHeight && innerHeight < 520; p.style.height = land ? "auto" : Math.max(380, innerHeight - top - 8) + "px";
  }

  /* ---------- 视频列表 ---------- */
  const FILTERS = [["all", "全部"], ["fav", "★ 收藏"], ["ing", "在看"], ["new", "未看"], ["seen", "看过"]];
  const thumb = (x, withDur) => { const p = pctOf(x.v, x), d = durOf(x.v, x); return '<div class="wt-th"><img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + esc(x.v) + '/mqdefault.jpg">' + (withDur && d ? '<div class="dur">' + fmt(d) + "</div>" : "") + (p > 0.005 && p < 1 ? '<div class="pg"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>' : "") + "</div>"; };
  function drawList() {
    const box = $("#wt-items"), items = allItems || [];
    // 筛选按钮带数量
    const cnt = { all: items.length, fav: 0, ing: 0, new: 0, seen: 0 };
    items.forEach(x => { cnt[stOf(x.v, x)]++; if ((M[x.v] || {}).f) cnt.fav++; });
    $("#wt-chips").innerHTML = FILTERS.map(([k, l]) => '<button type="button" data-f="' + k + '" class="' + (lv.filter === k ? "on" : "") + '">' + l + (cnt[k] ? "<em>" + cnt[k] + "</em>" : "") + "</button>").join("");
    if (!items.length) {
      box.innerHTML = listState === "loading" ? '<div class="wt-empty">正在读取视频列表…</div>'
        : listState === "err" ? '<div class="wt-empty">视频列表没读出来（网络问题）。<br><button class="wt-btn" data-act="retry">重试</button></div>'
        : '<div class="wt-empty">还没有视频。有三种方法加进来：<ol><li>电脑上装好「双语字幕」插件，在 YouTube 看任意带字幕的视频约 20 秒，会自动出现在这里。</li><li>手机上用 Safari 书签小工具（见上面「📱 手机上给任意视频加字幕」）。</li><li>上面直接粘贴 YouTube 链接，可以先看视频（暂时没有字幕）。</li></ol><br><button class="wt-btn" data-act="bm">设置手机书签</button></div>';
      return;
    }
    let list = items.filter(x => {
      if (q && (String(x.title || "") + " " + String(x.author || "") + " " + x.v).toLowerCase().indexOf(q) < 0) return false;
      const f = lv.filter; return f === "all" ? true : f === "fav" ? !!(M[x.v] || {}).f : stOf(x.v, x) === f;
    });
    const by = {
      add: (a, b) => (b.at || 0) - (a.at || 0),
      watch: (a, b) => ((M[b.v] || {}).t || 0) - ((M[a.v] || {}).t || 0) || (b.at || 0) - (a.at || 0),
      title: (a, b) => String(a.title || a.v).localeCompare(String(b.title || b.v), "zh"),
      dur: (a, b) => (durOf(a.v, a) || 1e9) - (durOf(b.v, b) || 1e9)
    }[lv.sort] || (() => 0);
    list = list.slice().sort((a, b) => (((M[b.v] || {}).f ? 1 : 0) - ((M[a.v] || {}).f ? 1 : 0)) || by(a, b)); // 收藏的置顶
    // 继续上次：最近看过、还没看完的那个
    let cont = "";
    if (!q && lv.filter === "all") {
      let best = null; items.forEach(x => { const m = M[x.v]; if (m && m.t && stOf(x.v, x) === "ing" && (!best || m.t > M[best.v].t)) best = x; });
      if (best) { const m = M[best.v], d = durOf(best.v, best); cont = '<div class="wt-cont" data-v="' + esc(best.v) + '">' + thumb(best, false) + "<div><small>继续上次</small><b>" + esc(best.title || best.v) + "</b><span>看到 " + fmt(m.p) + (d ? " / " + fmt(d) : "") + '</span></div><div class="go">▶</div></div>'; }
    }
    const head = '<div class="wt-cnt">' + (list.length === items.length ? "共 " + items.length + " 个视频" : "显示 " + list.length + " / " + items.length + " 个") + "</div>";
    if (!list.length) { box.innerHTML = cont + '<div class="wt-empty">' + (q ? "没有找到包含「" + esc($("#wt-q").value.trim()) + "」的视频。" : "这一类里还没有视频。") + '<br><button class="wt-btn" data-act="clear">显示全部</button></div>'; return; }
    box.innerHTML = cont + head + list.map(x => {
      const m = M[x.v] || {}, st = stOf(x.v, x), n = x.n || 0, tr = x.tr == null ? n : x.tr;
      const bits = []; if (x.author) bits.push(esc(x.author)); bits.push(n + " 句");
      if (n && tr < n) bits.push('<em class="tq">译文 ' + Math.floor(tr / n * 100) + "%</em>");
      if (st === "seen") bits.push('<em class="ok">✓ 看过</em>'); else if (st === "ing") bits.push('<em class="ing">看到 ' + (durOf(x.v, x) ? Math.round(pctOf(x.v, x) * 100) + "%" : fmt(m.p)) + "</em>");
      return '<div class="wt-item' + (st === "seen" ? " seen" : "") + '" data-v="' + esc(x.v) + '">' + thumb(x, true) + "<div><b>" + (m.f ? '<em class="st">★</em>' : "") + esc(x.title || x.v) + "</b><span>" + bits.join(" · ") + '</span></div><button type="button" class="wt-more" data-v="' + esc(x.v) + '" aria-label="更多操作">⋯</button></div>';
    }).join("");
  }
  // KV 的列表有几十秒延迟：刚删的视频可能还会被列出来，先在本机藏起来（之后重新抓过字幕的照常显示）
  let gone = LS.get("wt:gone", {}); { const old = Date.now() - 86400e3; let ch = false; for (const k in gone) if (gone[k] < old) { delete gone[k]; ch = true; } if (ch) LS.set("wt:gone", gone); }
  const notGone = list => (list || []).filter(x => !gone[x.v] || (x.at || 0) > gone[x.v]);
  let listSeq = 0;
  async function loadList(manual) {
    const my = ++listSeq; allItems = LS.get("wt:list", []); if (allItems.length) listState = "ok"; drawList();
    const rb = $("#wt-ref"); rb.classList.add("spin");
    try {
      const r = await fetch(API + "?list=1"), j = await r.json(); if (my !== listSeq) return;
      if (j && j.ok) { allItems = notGone(j.items); listState = "ok"; LS.set("wt:list", allItems); drawList(); if (manual) tip("已刷新，共 " + allItems.length + " 个视频"); }
      else throw new Error(j && j.error);
    } catch (e) { if (my !== listSeq) return; if (!allItems.length) { listState = "err"; drawList(); } if (manual) tip("刷新失败，请检查网络"); }
    finally { if (my === listSeq) rb.classList.remove("spin"); }
  }

  /* ---------- 菜单：收藏 / 看过 / YouTube / 复制链接 / 删除（列表和播放页共用） ---------- */
  let menuV = "";
  function menu(v, inPlay) {
    const x = allItems.find(y => y.v === v) || (doc && doc.v === v ? doc : { v }), m = M[v] || {}, sheet = $("#wt-sheet");
    sheetWord = ""; menuV = v;
    const t = inPlay && ready ? Math.floor(now()) : 0;
    sheet.innerHTML = '<div class="wt-mh"><b>' + esc(x.title || v) + "</b><span>" + esc(x.author || "") + (x.author ? " · " : "") + (x.n || (x.cues || []).length || 0) + " 句" + (durOf(v, x) ? " · " + fmt(durOf(v, x)) : "") + "</span></div>" +
      (inPlay ? '<div class="wt-mrow">字号<div class="wt-seg">' + ["小", "中", "大"].map((l, i) => '<button type="button" data-a="fs" data-n="' + i + '" class="' + (set.fs === i ? "on" : "") + '">' + l + "</button>").join("") + "</div></div>" : "") +
      '<div class="wt-menu">' +
      (inPlay ? '<button type="button" data-a="copy">📋 复制当前这句（英文＋中文）</button>' : "") +
      '<button type="button" data-a="fav">' + (m.f ? "☆ 取消收藏" : "★ 收藏（排在最前面）") + "</button>" +
      '<button type="button" data-a="seen">' + (m.w ? "↺ 标为未看（进度清零）" : "✓ 标为看过") + "</button>" +
      '<a data-a="yt" href="https://www.youtube.com/watch?v=' + esc(v) + (t ? "&t=" + t + "s" : "") + '" target="_blank" rel="noopener">▶ 在 YouTube 打开' + (t ? "（从 " + fmt(t) + "）" : "") + "</a>" +
      '<button type="button" data-a="link">🔗 复制视频链接</button>' +
      '<button type="button" data-a="del" class="del">🗑 删除这个视频</button>' +
      "</div>" +
      (inPlay && fineKeys() ? '<div class="wt-keys"><span><kbd>空格</kbd>播放/暂停</span><span><kbd>←</kbd><kbd>→</kbd>上句/下句</span><span><kbd>R</kbd>重听</span><span><kbd>L</kbd>单句循环</span><span><kbd>B</kbd>A-B 循环</span><span><kbd>P</kbd>逐句停</span><span><kbd>T</kbd>藏译文</span><span><kbd>E</kbd>藏原文</span><span><kbd>S</kbd>变速</span><span><kbd>C</kbd>复制本句</span></div><div class="wt-keys" style="margin-top:2px">点过视频画面后快捷键会失灵，点一下字幕区或空白处即可恢复。</div>' : "") +
      '<div class="a"><button data-a="x">关闭</button></div>';
    sheet.classList.add("on"); $("#wt-mask").classList.add("on");
  }
  async function onMenu(a, b) {
    const v = menuV, m = meta(v);
    if (a === "fs") { set.fs = +b.dataset.n; saveSet(); b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); setTimeout(() => { fit(); scrollCur(true); }, 0); return; }
    if (a === "copy") { closeSheet(); copyCur(); return; }
    if (a === "fav") { if (m.f) delete m.f; else m.f = 1; saveMeta(); tip(m.f ? "已收藏" : "已取消收藏"); }
    else if (a === "seen") { if (m.w) { delete m.w; m.p = 0; tip("已标为未看"); } else { m.w = 1; tip("已标为看过"); } saveMeta(); }
    else if (a === "link") { tip(await copyText("https://www.youtube.com/watch?v=" + v) ? "已复制视频链接" : "复制失败"); }
    else if (a === "yt") { try { if (playing()) player.pauseVideo(); } catch (e) {} }
    else if (a === "del") { closeSheet(); del(v); return; }
    closeSheet(); if (!root.classList.contains("playing")) drawList();
  }
  async function del(v) {
    const x = allItems.find(y => y.v === v) || (doc && doc.v === v ? doc : { v });
    if (!confirm("删除「" + (x.title || v) + "」？\n\n字幕会从网站上删除（想再学要重新用插件或书签抓一次字幕）。本机的观看进度和收藏也会一起清掉。")) return;
    try {
      const r = await fetch(API + "?v=" + encodeURIComponent(v), { method: "DELETE" }); let j = null; try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || "HTTP " + r.status);
    } catch (e) { tip("删除失败：" + (e && e.message || "网络问题")); return; }
    gone[v] = Date.now(); LS.set("wt:gone", gone);
    allItems = allItems.filter(y => y.v !== v); LS.set("wt:list", allItems);
    if (doc && doc.v === v) closePlay();
    ["wt:doc:", "wt:tr:", "wt:pos:"].forEach(k => { try { localStorage.removeItem(k + v); } catch (e) {} });
    delete M[v]; saveMeta(); drawList();
    tip("已删除");
  }
  const vid = s => { s = String(s || "").trim(); const m = s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/); return m ? m[1] : ""; };
  function openUrl(s) { const v = vid(s); if (!v) { tip("没认出这个链接，请粘贴 YouTube 视频地址"); return; } open(v); }

  /* ---------- 打开视频 ---------- */
  async function open(v, at) { // at：从第几秒开始（频道地图里的样片用）
    root.classList.add("playing"); document.documentElement.classList.add("wt-playing");
    closeSheet();
    doc = { v, title: "", cues: [] }; cues = []; cur = -1; pausedFor = -1; lock = false; follow = true; listEl.classList.remove("away");
    loop = null; abA = -1; started = false; paintLoop();
    // 续播：上次看到的位置（看完了或只看了开头就从头放）
    const m = meta(v), md = m.d || 0; resumeAt = m.p > 8 && !m.w && (!md || m.p < md - 15) ? Math.max(0, m.p - 2) : 0;
    if (at > 0 && !resumeAt) resumeAt = at;
    m.t = Date.now(); saveMeta();
    note("");
    $("#wt-title").textContent = "加载中…"; listEl.innerHTML = '<div class="wt-empty">正在读取字幕…</div>'; showSub(-1); fit();
    startPlayer(v);
    let d = null;
    try { const r = await fetch(API + "?v=" + v); if (r.ok) d = await r.json(); } catch (e) { d = LS.get("wt:doc:" + v, null); }
    if (!doc || doc.v !== v) return;
    if (d && d.ok && d.cues && d.cues.length) {
      d.cues = tidy(d.cues); doc = d; cues = d.cues; LS.set("wt:doc:" + v, d);
      const tr = LS.get("wt:tr:" + v, {}); cues.forEach(c => { if (!c.r && tr[c.s]) c.r = tr[c.s]; });
      $("#wt-title").textContent = d.title || v; drawCues(); fillTrans(v);
    } else {
      $("#wt-title").textContent = "没有字幕";
      listEl.innerHTML = '<div class="wt-empty">这个视频还没有字幕。<br>在电脑上用插件打开它看约 20 秒，字幕会自动同步过来；视频本身现在就可以播放。</div>';
    }
  }
  function closePlay() { document.documentElement.classList.remove("wt-float"); savePos(true); closeSheet(); loop = null; abA = -1; stopTick(); try { player && player.destroy && player.destroy(); } catch (e) {} player = null; ready = false; doc = null; root.classList.remove("playing"); document.documentElement.classList.remove("wt-playing"); $(".wt-video", root).innerHTML = '<div id="wt-yt"></div>'; loadList(); }
  function drawCues() {
    listEl.innerHTML = cues.map((c, i) => '<div class="wt-row" data-i="' + i + '"><i>' + fmt(c.s) + '</i><span class="t">' + markup(c.t) + '</span><span class="r">' + esc(c.r || "") + "</span></div>").join("") + '<button class="wt-back">↓ 回到当前</button>';
    paintLoop();
  }
  const clean = t => { t = String(t || "").replace(/\[[^\]]*\]|\u266a|>>+|\u00bb|&gt;&gt;/g, " ").replace(/\s+/g, " ").trim(); return /^\([^)]*\)$/.test(t) ? "" : t; };
  const tidy = list => { const o = []; (list || []).forEach(c => { const t = clean(c.t); if (t) o.push({ s: +c.s || 0, e: +c.e || 0, t, r: clean(c.r) }); }); for (let i = 0; i < o.length - 1; i++) if (o[i].e > o[i + 1].s) o[i].e = Math.max(o[i].s + 0.2, o[i + 1].s); return o; };
  const note = (html) => { const n = $("#wt-note"); if (!n) return; n.innerHTML = html || ""; n.style.display = html ? "" : "none"; fit(); };
  async function gtLines(lines, tl) { // 一批句子合并成一次请求；行数对不上就返回 null
    const r = await NET.g("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(lines.map(x => x.replace(/\n/g, " ")).join("\n")));
    if (!r.ok) throw new Error("http " + r.status);
    const j = await r.json(), parts = (j[0] || []).map(x => x[0]).join("").split("\n");
    return parts.length === lines.length ? parts.map(x => x.trim()) : null;
  }
  let fillBusy = false;
  async function fillTrans(v) { // 没有译文的句子：在浏览器里分批翻译、缓存，全部补齐后存回网站
    if (fillBusy) return; const need = []; cues.forEach((c, i) => { if (!c.r) need.push(i); }); if (!need.length) { note(""); return; }
    fillBusy = true; const tl = (doc && doc.tl) || "zh-CN", cache = LS.get("wt:tr:" + v, {}); let done = 0, failed = 0;
    const put = (i, t) => { cues[i].r = t; cache[cues[i].s] = t; const row = listEl.children[i]; if (row && $(".r", row)) $(".r", row).textContent = t; if (i === cur) showSub(cur); };
    try {
      for (let k = 0; k < need.length; k += 20) {
        if (!doc || doc.v !== v) return;
        const idx = need.slice(k, k + 20); note("正在翻译字幕… " + done + " / " + need.length);
        let parts = null, okReq = false;
        for (let a = 0; a < 3 && !okReq; a++) { try { parts = await gtLines(idx.map(i => cues[i].t), tl); okReq = true; } catch (e) { await new Promise(r => setTimeout(r, 900 * (a + 1))); } }
        if (okReq && !parts) { parts = []; for (const i of idx) { try { const one = await gtLines([cues[i].t], tl); parts.push(one ? one[0] : ""); } catch (e) { parts.push(""); } } }
        if (!parts) { failed += idx.length; continue; }
        idx.forEach((i, n) => { if (parts[n]) { put(i, parts[n]); done++; } else failed++; });
        LS.set("wt:tr:" + v, cache);
      }
    } finally { fillBusy = false; }
    if (!doc || doc.v !== v) return;
    if (failed) { note("有 " + failed + " 句没翻译出来（翻译服务暂时拒绝了这个网络的请求）。<button id=\"wt-retry\">重试</button>"); const b = $("#wt-retry"); if (b) b.onclick = () => fillTrans(v); return; }
    note("");
    try { fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v: doc.v, title: doc.title, author: doc.author, lang: doc.lang, tl, cues }) }).catch(() => {}); } catch (e) {}
  }

  /* ---------- 播放器 ---------- */
  function loadApi() {
    if (apiP) return apiP;
    apiP = new Promise(res => { if (window.YT && YT.Player) return res(); const old = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { try { old && old(); } catch (e) {} res(); }; const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.onerror = () => { apiP = null; try { NET.mark("www.youtube.com", 0); } catch (e) {} const vb = root && $(".wt-video", root); if (vb) vb.innerHTML = ytMsg; }; document.head.append(s); });
    return apiP;
  }
  // 🇨🇳 大陆打不开 YouTube：说清楚，别让人对着黑框干等
  const ytMsg = '<div style="padding:28px 18px;text-align:center;line-height:1.7;color:var(--ui-ink-2,#cfd2d6)"><div style="font-size:30px">🚫</div><b>现在的网络连不上 YouTube</b><br>在中国大陆要开 VPN 才能看视频。<br><small style="color:var(--ui-muted,#9aa0a6)">BBC 听力、阅读、口语、写作、生词本这些不受影响。</small><br><button type="button" class="ui-btn" style="margin-top:10px" onclick="try{NET.mark(\'www.youtube.com\',1)}catch(e){}location.reload()">已经开了 VPN，重试</button></div>';
  async function startPlayer(v) {
    stopTick(); ready = false; try { player && player.destroy && player.destroy(); } catch (e) {} player = null;
    $(".wt-video", root).innerHTML = '<div id="wt-yt"></div>';
    if (window.NET && NET.isBad("www.youtube.com") && !(window.YT && YT.Player)) { $(".wt-video", root).innerHTML = ytMsg; return; }
    const slow = setTimeout(() => { if (!(window.YT && YT.Player) && doc && doc.v === v) { try { NET.mark("www.youtube.com", 0); } catch (e) {} $(".wt-video", root).innerHTML = ytMsg; } }, 10000); // 10 秒还没连上 YouTube
    await loadApi(); clearTimeout(slow); if (!doc || doc.v !== v) return;
    player = new YT.Player("wt-yt", { videoId: v, playerVars: { playsinline: 1, rel: 0, modestbranding: 1, cc_load_policy: 0, iv_load_policy: 3, start: Math.floor(resumeAt) }, events: {
      onReady: () => { ready = true; try { player.setPlaybackRate(set.rate); } catch (e) {} startTick(); },
      onStateChange: e => {
        if (e.data === 1) { if (lock) { lock = false; } started = true; try { window.smePause && window.smePause(); } catch (er) {} startTick(); if (!cues.length || cur < 0) showSub(cur); }
        else if (e.data === 2) savePos(false);
        else if (e.data === 0 && doc) { const m = meta(doc.v); m.w = 1; m.p = 0; saveMeta(); }
      },
      onError: () => tip("这个视频不允许在站外播放，或暂时无法加载") } });
  }
  const now = () => { try { return player.getCurrentTime() || 0; } catch (e) { return 0; } };
  const playing = () => { try { return player.getPlayerState() === 1; } catch (e) { return false; } };
  function startTick() { if (timer) return; let n = 0; timer = setInterval(() => { tick(); if (++n % 40 === 0) savePos(false); }, 120); }
  function savePos(force) { // 记下看到第几秒；播到 95% 以后算看过
    if (!doc || !ready || !player || (!force && !playing()) || !started) return;
    const t = now(), m = meta(doc.v); let d = 0; try { d = player.getDuration() || 0; } catch (e) {}
    if (d > 0) m.d = Math.round(d);
    if (t > 0) { m.p = Math.round(t); m.t = Date.now(); if (d > 0 && t >= d * 0.95) m.w = 1; }
    saveMeta();
  }
  function fromStart() { resumeAt = 0; if (!ready) { tip("播放器还在加载，请稍等"); return; } try { player.seekTo(0, true); player.playVideo(); } catch (e) {} }
  function stopTick() { clearInterval(timer); timer = null; }
  function find(t) { let lo = 0, hi = cues.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].s <= t + 0.05) { a = m; lo = m + 1; } else hi = m - 1; } return a; }
  const endOf = i => Math.min(cues[i].e || cues[i].s + 4, cues[i + 1] ? Math.max(cues[i + 1].s, cues[i].s + 0.3) : Infinity);
  function tick() {
    if (!ready || !cues.length || !started) return;
    const t = now(), on = playing();
    if (lock && !on) return;                      // 逐句停时锁住当前句，不跳到下一句
    const i = find(t);
    if (loop && on && Date.now() - loopAt > 500) { // 循环：播完最后一句跳回第一句；用户把进度条拖到别处就退出循环
      if ((i === loop.b || i === loop.b + 1) && t >= endOf(loop.b) - 0.12) { loopAt = Date.now(); try { player.seekTo(cues[loop.a].s + 0.01, true); } catch (e) {} if (cur !== loop.a) { cur = loop.a; showSub(cur); markRow(); } return; }
      if (i > loop.b + 1 || i < loop.a) { loop = null; abA = -1; paintLoop(); tip("已退出循环"); }
    }
    if (!loop && set.autoPause && on && cur >= 0 && pausedFor !== cur && i >= cur && t >= endOf(cur) - 0.14) { pausedFor = cur; lock = true; try { player.pauseVideo(); } catch (e) {} return; }
    if (i !== cur) { cur = i; showSub(i); markRow(); }
  }
  function showSub(i) {
    const c = cues[i];
    subEl.innerHTML = c ? '<div class="en">' + markup(c.t) + '</div><div class="zh">' + esc(c.r || "") + "</div>" + vsPatHtml(c)
      : '<div class="en none">' + (!started && resumeAt > 0 ? "点 ▶ 从上次的 " + fmt(resumeAt) + " 继续" + '<span class="rs"><button type="button">从头开始</button></span>' : started && cues.length ? "…" : "点 ▶ 开始播放") + '</div><div class="zh"></div>';
  }
  function markRow() {
    const old = $(".wt-row.cur", listEl); if (old) old.classList.remove("cur");
    const row = listEl.children[cur]; if (!row || !row.classList.contains("wt-row")) return; row.classList.add("cur");
    if (!follow && Date.now() - userScroll > 6000) { follow = true; listEl.classList.remove("away"); }
    scrollCur(false);
  }
  function scrollCur(force) { const row = listEl.children[cur]; if (!row || (!follow && !force)) return; listEl.scrollTo({ top: Math.max(0, row.offsetTop - listEl.clientHeight * 0.3), behavior: "smooth" }); }
  function seek(i) {
    if (!cues[i] || !ready) return;
    if (loop && (i < loop.a || i > loop.b)) { if (loop.a === loop.b) loop = { a: i, b: i }; else { loop = null; tip("已退出区间循环"); } paintLoop(); } // 单句循环跟着换句
    loopAt = Date.now(); lock = false; pausedFor = -1; cur = i; showSub(i); follow = true; listEl.classList.remove("away"); markRow(); try { player.seekTo(cues[i].s + 0.01, true); player.playVideo(); } catch (e) {} }
  function jump(d) { if (!cues.length) return; const base = cur < 0 ? find(now()) : cur; seek(Math.max(0, Math.min(cues.length - 1, (base < 0 ? 0 : base) + d))); }

  /* ---------- 查词 ---------- */
  const dc = {};
  async function gword(w) {
    const k = w.toLowerCase(); if (dc[k]) return dc[k];
    const c = LS.get("wt:w:" + k, null); if (c) return dc[k] = c;
    const o = { zh: [], phon: "", en: "" };
    try {
      const j = await (await NET.g("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" + encodeURIComponent((VS && VS.S.target) || "zh-CN") + "&dt=t&dt=bd&q=" + encodeURIComponent(k))).json();
      const add = x => { x = String(x || "").trim(); if (x && x.toLowerCase() !== k && !o.zh.includes(x)) o.zh.push(x); };
      add((j[0] || []).map(x => x[0]).join("")); (j[1] || []).forEach(e => (e[1] || []).slice(0, 4).forEach(add));
      o.pos = (j[1] || []).slice(0, 3).map(e => ({ p: e[0], w: (e[1] || []).slice(0, 4) }));
    } catch (e) {}
    if (!/\s/.test(k)) try {
      const r = await NET.fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(k)); if (r.ok) { const j = await r.json(); const e = j[0] || {}; o.phon = e.phonetic || ((e.phonetics || []).find(p => p.text) || {}).text || ""; const d = ((e.meanings || [])[0] || {}).definitions; o.en = (d && d[0] && d[0].definition) || ""; }
    } catch (e) {}
    if (o.zh.length) LS.set("wt:w:" + k, o);
    return dc[k] = o;
  }
  const POS = { noun: "名", verb: "动", adjective: "形", adverb: "副", preposition: "介", pronoun: "代", conjunction: "连", interjection: "叹" };
  let sheetCtx = null;
  async function lookup(w, ci, el) {
    try { if (playing()) player.pauseVideo(); } catch (e) {}
    sheetWord = w; const c = cues[ci], sheet = $("#wt-sheet"), st = statusOf(w);
    sheetCtx = c ? { t: c.t, r: c.r || "" } : null;
    const ctxHtml = c ? '<div class="x">' + esc(c.t).replace(new RegExp("\\b(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i"), "<b>$1</b>") + "<span>" + esc(c.r || "") + "</span></div>" : "";
    sheet.innerHTML = "<h3>" + esc(w) + '<small id="wt-ph"></small></h3><div class="m" id="wt-m">查询中…</div><div class="p" id="wt-p"></div><div class="d" id="wt-d"></div>' + vsSheetExtra(w, el) + ctxHtml +
      '<div class="a"><button data-a="say">🔊 发音</button><button data-a="add" class="add' + (st ? " in" : "") + '">' + (st ? (st === "kn" ? "已掌握" : "已在生词本") : "＋ 加入生词本") + '</button><button data-a="x">关闭</button></div>';
    sheet.classList.add("on"); $("#wt-mask").classList.add("on");
    try { speak(w); } catch (e) {}
    const g = await gword(w); if (sheetWord !== w) return;
    $("#wt-m").textContent = g.zh.slice(0, 4).join("；") || "（没查到释义）";
    $("#wt-p").innerHTML = (g.pos || []).map(p => "<b>" + esc(POS[p.p] || p.p) + ".</b> " + esc(p.w.join("，"))).join("　");
    $("#wt-ph").textContent = g.phon || ""; $("#wt-d").textContent = g.en || "";
  }
  function closeSheet() { sheetWord = ""; $("#wt-sheet").classList.remove("on"); $("#wt-mask").classList.remove("on"); }
  async function onSheet(e) {
    const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a, w = sheetWord;
    if (a === "x") return closeSheet();
    if (!w) return onMenu(a, b);
    if (a === "say") { try { speak(w); } catch (er) {} return; }
    if (a === "mk") { const m = b.dataset.m; b.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b && !!m)); await vsSetMark(w, m); tip(w + " → " + ({ learn: "将要学习", known: "已掌握", ignore: "不学习", "": "恢复默认" })[m]); if (m === "learn") { const ab = $("#wt-sheet [data-a=add]"); if (ab && !ab.classList.contains("in")) ab.click(); } return; } // 将要学习 = 同时加进生词本
    if (a === "add") {
      if (b.classList.contains("in")) return;
      const lw = w.toLowerCase(), g = await gword(w), id = "v_" + lw.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const ex = sheetCtx ? [[sheetCtx.t.replace(/\s+/g, " ").replace(new RegExp("\\b(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i"), "{$1}"), sheetCtx.r]] : [];
      const entry = { id, type: /\s/.test(lw) ? "phrase" : "word", word: lw, phon: g.phon || "", en: g.en || "", zh: g.zh.slice(0, 4).join("；") || "(未查到，可手动补)", tag: "视频", date: new Date().toISOString().slice(0, 10), forms: [], examples: ex, tip: "" };
      try {
        state.custom = state.custom || []; state.deleted = (state.deleted || []).filter(x => x !== id);
        if (!state.custom.some(x => x && (x.id === id || String(x.word || "").toLowerCase() === lw))) state.custom.push(entry);
        refresh(); save(state); loadBook();
        b.classList.add("in"); b.textContent = "已在生词本"; tip("已加入生词本：" + lw);
        if (VS && vsMarkNow(lw) !== "learn") { vsSetMark(lw, "learn"); const lb = $("#wt-sheet [data-m=learn]"); if (lb) { lb.parentNode.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === lb)); } }
        // 重新上色
        if (cur >= 0) showSub(cur); const top = listEl.scrollTop; drawCues(); listEl.scrollTop = top; const row = listEl.children[cur]; if (row && row.classList.contains("wt-row")) row.classList.add("cur");
      } catch (er) { tip("保存失败"); }
    }
  }

  function init() { if (!build()) return; { const q = new URLSearchParams(location.search).get("v"); if (q && /^[\w-]{11}$/.test(q)) { try { history.replaceState(null, "", location.pathname); } catch (e) {} enter(); open(q); window.__wt = { open, enter: () => enter(), state: () => ({ cur, n: cues.length, lock, follow, set }) }; return; } } if (window.__wantVideo && !document.documentElement.classList.contains("collect-mode")) window.videoCore.enter(); window.__wt = { open, enter: () => enter(), state: () => ({ cur, n: cues.length, lock, follow, set }) }; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
