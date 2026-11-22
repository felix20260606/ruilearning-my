const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof28', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.evaluate(()=>chrome.storage.sync.set({merge:false,hoverPause:false,level:700,ratio:2})); await pp.waitForTimeout(200);
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:0,dDurationMs:1900,segs:[{utf8:'(Applause)'}]},{tStartMs:9000,dDurationMs:3000,segs:[{utf8:u.includes('tlang=')?'你好':'Hello there.'}]}]})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#fff"><div id="movie_player" style="position:relative;width:760px;height:440px;background:#333"><video class="html5-main-video" width=760 height=440 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis/, r=>{const q=new URL(r.request().url()).searchParams.get('q')||''; r.fulfill({contentType:'application/json',body:JSON.stringify([[['掌声',q]],null,'en'])})});
  await ctx.route(/wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1240,height:700}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-note .vs-w',{timeout:8000});
  await p.hover('#vs-sub .vs-note .vs-w'); await p.waitForTimeout(800); console.log('悬停:', await p.evaluate(()=>document.querySelector('#vs-mini')?.innerText.replace(/\n/g,' / ')));
  await p.click('#vs-sub .vs-note .vs-w',{button:'right'}); await p.waitForTimeout(500);
  console.log('右键后:', await p.evaluate(()=>new Promise(r=>chrome?.storage?r(0):r(document.querySelector('#vs-sub .vs-note .vs-w').className+' | 列表里='+document.querySelector('#vs-panel .it.sb .nt .vs-w').className))));
  await p.click('#vs-panel .tabs b[data-t=saved]'); await p.waitForTimeout(400); console.log('已保存:', await p.evaluate(()=>document.querySelector('#vs-panel .ls').innerText.replace(/\n+/g,'|').slice(0,60)));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
