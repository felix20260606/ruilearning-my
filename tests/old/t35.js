const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof35', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.evaluate(()=>chrome.storage.sync.set({merge:false,hoverPause:false,level:700,ratio:2})); await pp.waitForTimeout(200);
  const L=[[800,3000,'The fisherman repaired the harbour nets.'],[3800,3000,'Every procrastinator knows the monkey.'],[6800,3000,'A deadline scares everybody here.'],[9800,3000,'The wheel keeps turning again.'],[12800,5000,'We were here.']];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:L.map((x,i)=>({tStartMs:x[0],dDurationMs:x[1],segs:[{utf8:u.includes('tlang=')?'译'+i:x[2]}]}))})});
    if(u.endsWith('tv.webm')) { const buf=fs.readFileSync('/tmp/tva.webm'), rg=/bytes=(\d+)-(\d*)/.exec(r.request().headers()['range']||''); if(rg){ const a=+rg[1], b=rg[2]?+rg[2]:buf.length-1; return r.fulfill({status:206,headers:{'content-type':'video/webm','accept-ranges':'bytes','content-range':`bytes ${a}-${b}/${buf.length}`,'content-length':String(b-a+1)},body:buf.subarray(a,b+1)}); } return r.fulfill({status:200,headers:{'content-type':'video/webm','accept-ranges':'bytes','content-length':String(buf.length)},body:buf}); }
    r.fulfill({contentType:'text/html',body:'<html><head><meta charset="utf-8"><title>测试视频 - YouTube</title></head><body style="margin:0;background:#fff"><div id="movie_player" style="position:relative;width:700px;height:420px;background:#333"><video class="html5-main-video" width=700 height=420 src="/tv.webm"></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis|tatoeba|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1240,height:700}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-panel .it.sb',{timeout:8000});
  const med=()=>pp.evaluate(()=>new Promise(r=>chrome.storage.local.get(null,v=>r(Object.keys(v).filter(k=>k.startsWith('med:')).map(k=>k.slice(4,30)+' aud='+Math.round((v[k].aud||'').length/1024)+'KB')))));
  const vt=()=>p.evaluate(()=>{const v=document.querySelector('video');return v.currentTime.toFixed(1)+(v.paused?' 暂停':' 播放')+(v.muted?' 静音':'')});
  // A：视频一秒都没播，直接在列表里右键第 3 句里的词
  console.log('A 开始:', await vt());
  await p.click('#vs-panel .it.sb:nth-child(3) .vs-w[data-w=deadline]',{button:'right'});
  await p.waitForTimeout(600); console.log('A 补录中:', await vt());
  await p.waitForFunction(()=>{const t=document.querySelector('#vs-toast');return t&&/已保存|没有录到/.test(t.textContent)},null,{timeout:15000}); await p.waitForTimeout(400);
  console.log('A 结束:', await vt(), '|', (await med()).join(' ; '));
  // B：播放中保存后面还没播到的一句里的词，然后暂停
  await p.evaluate(()=>document.querySelector('video').play()); await p.waitForFunction(()=>document.querySelector('video').currentTime>1.5);
  await p.click('#vs-panel .it.sb:nth-child(4) .vs-w[data-w=wheel]',{button:'right'}); await p.waitForTimeout(500); console.log('B 播放中保存:', await vt(), '|', (await med()).join(' ; '));
  await p.evaluate(()=>document.querySelector('video').pause());
  await p.waitForFunction(()=>{const t=document.querySelector('#vs-toast');return t&&/已保存|没有录到/.test(t.textContent)},null,{timeout:20000}); await p.waitForTimeout(500);
  console.log('B 暂停后补录:', await vt(), '|', (await med()).join(' ; '));
  // C：从句子中间开始播（没从头），保存这一句里的词
  await p.evaluate(()=>{const v=document.querySelector('video'); v.currentTime=5.2;}); await p.waitForTimeout(300); await p.evaluate(()=>document.querySelector('video').play()); await p.waitForTimeout(700);
  await p.evaluate(()=>document.querySelector('video').pause()); await p.waitForTimeout(300);
  const has=await p.$('#vs-sub .vs-w[data-w=monkey]'); if(has){ await p.click('#vs-sub .vs-w[data-w=monkey]',{button:'right'}); await p.waitForFunction(()=>{const t=document.querySelector('#vs-toast');return t&&/已保存|没有录到/.test(t.textContent)},null,{timeout:20000}); await p.waitForTimeout(500); }
  console.log('C 中途开始的句子:', await vt(), '|', (await med()).join(' ; '));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
