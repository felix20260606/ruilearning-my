const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof19', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const ev=tr=>[[1000,1500,'First sentence.'],[4000,1500,'Second sentence.']].map((x,i)=>({tStartMs:x[0],dDurationMs:x[1],segs:[{utf8:tr?'译'+i:x[2]}]}));
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:ev(u.includes('tlang='))})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:600px;height:400px;background:#333"><video class="html5-main-video" width=600 height=400 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForTimeout(600); await p.evaluate(()=>document.querySelector('video').play());
  const st=()=>p.evaluate(()=>{const b=document.querySelector('#vs-sub .vs-box'),o=document.querySelector('#vs-sub .vs-o');return (b&&b.style.display!=='none'&&o?o.textContent:'(无)')+' @'+document.querySelector('video').currentTime.toFixed(1)});
  const at=async t=>{await p.waitForFunction(x=>document.querySelector('video').currentTime>=x,t,{timeout:20000}); return st()};
  console.log('第一句之前:', await at(0.5)); console.log('第一句中:', await at(1.5)); console.log('第一句结束后的空隙:', await at(3.2)); console.log('第二句开始:', await at(4.3)); console.log('第二句结束后:', await at(6.5));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
