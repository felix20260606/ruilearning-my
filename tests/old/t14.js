const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof14', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  const events=[{tStartMs:0,dDurationMs:60000,segs:[{utf8:'dove in slow motion,'}]}];
  await ctx.route('https://www.youtube.com/**', async r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) { if(u.includes('tlang=')) await new Promise(z=>setTimeout(z,2500)); return r.fulfill({contentType:'application/json',body:JSON.stringify({events: u.includes('tlang=')?[{tStartMs:0,dDurationMs:60000,segs:[{utf8:'慢动作般地奋力拼搏，最终'}]}]:events})}); }
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:800px;height:420px;background:#333"><video class="html5-main-video" width=800 height=420 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),300)</script></body></html>'}); });
  let g=0; await ctx.route(/translate\.googleapis/, r=>{ g++; r.fulfill({contentType:'application/json',body:JSON.stringify([[["GOOGLE译文","x"]],null,"en"])})});
  await ctx.route(/wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-w',{timeout:8000});
  console.log('before tlang returns:', JSON.stringify(await p.textContent('#vs-sub .vs-t')));
  await p.waitForTimeout(4000);
  console.log('after  tlang returns:', JSON.stringify(await p.textContent('#vs-sub .vs-t')), '| google sentence calls:', g);
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
