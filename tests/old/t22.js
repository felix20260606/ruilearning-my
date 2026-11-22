const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof22', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:0,dDurationMs:19000,segs:[{utf8:u.includes('tlang=')?'译':'Hello there world.'}]}]})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#fff"><div id="movie_player" style="position:relative;width:600px;height:400px;background:#333"><video class="html5-main-video" width=600 height=400 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1100,height:600}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-panel.show',{timeout:8000});
  const st=()=>p.evaluate(()=>{const P=document.querySelector('#vs-panel');return 'show='+P.classList.contains('show')+' min='+P.classList.contains('min')+' 高='+P.offsetHeight+' 文字='+P.innerText.replace(/\n+/g,'|').slice(0,40)});
  console.log('初始:', await st()); await p.click('#vs-px'); await p.waitForTimeout(1500); console.log('点 ✕ 后:', await st()); await p.screenshot({path:'/tmp/t22.png'});
  await p.reload(); await p.waitForSelector('#vs-panel.show',{timeout:8000}); await p.waitForTimeout(500); console.log('刷新后:', await st());
  await p.click('#vs-panel .mn'); await p.waitForTimeout(300); console.log('点展开后:', await st());
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
