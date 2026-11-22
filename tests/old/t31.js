const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof31', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.evaluate(()=>chrome.storage.sync.set({merge:false,hoverPause:false,level:700,ratio:2})); await pp.waitForTimeout(200);
  const L=[[800,3000,'The fisherman repaired the harbour nets.','渔夫修理了港口的网。'],[3800,3000,'Every procrastinator knows the monkey.','每个拖延者都认识那只猴子。'],[6800,9000,'We were here.','我们就在这里。']];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:L.map(x=>({tStartMs:x[0],dDurationMs:x[1],segs:[{utf8:u.includes('tlang=')?x[3]:x[2]}]}))})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tva.webm')});
    r.fulfill({contentType:'text/html',body:'<html><head><title>(3) 测试视频标题 - YouTube</title></head><body style="margin:0;background:#fff"><div id="movie_player" style="position:relative;width:700px;height:420px;background:#333"><video class="html5-main-video" width=700 height=420 src="/tv.webm"></video></div><div id="owner"><ytd-channel-name><a>测试频道</a></ytd-channel-name></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis/, r=>{const q=new URL(r.request().url()).searchParams.get('q')||''; r.fulfill({contentType:'application/json',body:JSON.stringify([[['译:'+q,q]],null,'en'])})});
  await ctx.route(/tatoeba|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1240,height:700}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForTimeout(900); await p.evaluate(()=>document.querySelector('video').play());
  await p.waitForFunction(()=>document.querySelector('#vs-sub .vs-w[data-w=fisherman]'),null,{timeout:10000});
  await p.click('#vs-sub .vs-w[data-w=fisherman]',{button:'right'});      // 句子播放中保存：原声应在这句播完后补上
  const get=k=>pp.evaluate(k=>new Promise(r=>chrome.storage.local.get(k,v=>{const o=v[k];r(o?{t:o.t,tr:o.tr,title:o.title,ch:o.ch,s:o.s,img:(o.img||'').slice(0,22)+' '+(o.img||'').length,aud:(o.aud||'').slice(0,24)+' '+(o.aud||'').length}:null)})),k);
  console.log('刚保存:', JSON.stringify(await get('med:w:fisherman')));
  await p.evaluate(()=>document.querySelector('video').pause()); await p.waitForTimeout(900); await p.evaluate(()=>document.querySelector('video').play());   // 模拟悬停查词：句子中途暂停再继续
  await p.waitForFunction(()=>document.querySelector('#vs-sub .vs-w[data-w=procrastinator]'),null,{timeout:10000}); await p.waitForTimeout(700);
  console.log('这句播完后:', JSON.stringify(await get('med:w:fisherman')));
  await p.waitForFunction(()=>document.querySelector('video').currentTime>7.3,null,{timeout:10000});
  await p.hover('#vs-panel .it.sb:nth-child(2)'); await p.click('#vs-panel .it.sb:nth-child(2) .st',{force:true}); await p.waitForTimeout(400);   // 收藏已播完的上一句：直接带原声
  const sk=await pp.evaluate(()=>new Promise(r=>chrome.storage.local.get(null,v=>r(Object.keys(v).filter(k=>k.startsWith('med:s:'))))));
  console.log('收藏句子:', sk.length, JSON.stringify(await get(sk[0])));
  // 复习页
  await pp.evaluate(()=>new Promise(r=>chrome.storage.local.set({reviewOpt:{quiz:true,listen:true,sugg:false,num:10,newPct:100,speak:true}},r)));
  const rv=await ctx.newPage(); rv.on('pageerror',e=>console.log('PAGEERR',e.message)); await rv.setViewportSize({width:1200,height:760}); await rv.goto(`chrome-extension://${id}/review.html`); await rv.waitForTimeout(400);
  await rv.click('#start'); await rv.waitForSelector('#bD',{timeout:10000}); await rv.waitForTimeout(600);
  console.log('复习卡:', await rv.evaluate(()=>({img:!!document.querySelector('#card .shot'), src:document.querySelector('#card .src')?.textContent, href:document.querySelector('#card a.src')?.getAttribute('href'), playing:!!(window.player||0)})));
  console.log('在播原声:', await rv.evaluate(()=>{try{return !!player && !player.paused && player.src.startsWith('data:audio')}catch(e){return 'x'}}));
  await rv.keyboard.press('e'); await rv.keyboard.press('e'); await rv.screenshot({path:'/tmp/t31.png'});
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
