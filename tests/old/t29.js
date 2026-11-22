const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof29', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const reqs=[];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) { const q=new URL(u).searchParams; reqs.push('lang='+q.get('lang')+' tlang='+(q.get('tlang')||'-')); const tl=q.get('tlang'); return r.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:0,dDurationMs:19000,segs:[{utf8: tl==='en'?'I came to Kuala Lumpur.':'我来到吉隆坡'}]}]})}); }
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:`<html><body style="margin:0"><div id="movie_player" style="position:relative;width:700px;height:420px;background:#333"><video class="html5-main-video" width=700 height=420 src="/tv.webm" muted></video></div><script>const pl=document.getElementById("movie_player"); pl.getPlayerResponse=()=>({captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:"zh-Hans",baseUrl:"/api/timedtext?v=abc&lang=zh-Hans",name:{simpleText:"中文（简体）"}}]}}}); pl.getOption=()=>({languageCode:"zh-Hans"}); pl.setOption=()=>{}; setTimeout(()=>fetch("/api/timedtext?v=abc&lang=zh-Hans"),200)</script></body></html>`}); });
  await ctx.route(/translate\.googleapis|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-w',{timeout:15000}); await p.waitForTimeout(800);
  console.log('原文:', await p.evaluate(()=>document.querySelector('#vs-sub .vs-o').textContent), '| 翻译:', await p.evaluate(()=>document.querySelector('#vs-sub .vs-t').textContent));
  console.log('请求:', reqs.join(' ; '));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
