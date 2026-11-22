const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof7', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  const events=[{tStartMs:500,dDurationMs:2000,segs:[{utf8:'pulling two all-nighters -- humans are'}]},{tStartMs:2500,dDurationMs:1500,segs:[{utf8:'not supposed to pull two.'}]},{tStartMs:4000,dDurationMs:1500,segs:[{utf8:'(Laughter)'}]},{tStartMs:6000,dDurationMs:2000,segs:[{utf8:'And they say, "Is this Tim Urban?"'}]}];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body><div id="movie_player" style="position:relative;width:700px;height:300px;background:#333"><video class="html5-main-video" width=700 height=300 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),300)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis/, r=>r.fulfill({contentType:'application/json',body:JSON.stringify([[["译文","x"]],null,"en"])}));
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForTimeout(1200);
  const res=[]; await p.evaluate(()=>document.querySelector('video').play()); const t0=Date.now();
  for (const t of [1.2,3.3,4.7,6.8]) { await p.waitForTimeout(Math.max(0,t*1000-(Date.now()-t0)));
    res.push({ct:await p.evaluate(()=>document.querySelector('video').currentTime.toFixed(1)), text:await p.evaluate(()=>{const o=document.querySelector('#vs-sub .vs-o');return o?o.textContent:null}), tr:await p.evaluate(()=>document.querySelector('#vs-sub .vs-t').textContent), words:await p.$$eval('.vs-w',e=>e.map(x=>x.textContent).join('|')), note:await p.$$eval('.vs-note',e=>e.length)}); }
  console.log(JSON.stringify(res,null,0));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
