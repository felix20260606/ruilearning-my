const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof26', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.uncheck('[data-k=hoverPause]'); await pp.selectOption('[data-k=panelTrans]','inline');
  const ev=(a,b)=>[{tStartMs:0,dDurationMs:6000,segs:[{utf8:a}]},{tStartMs:6000,dDurationMs:14000,segs:[{utf8:b}]}];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:u.includes('tlang=')?ev('即使我们知道现在','第二句翻译'):ev('see it even though we know it is a little bit less','Second sentence here now.')})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#fff"><div id="movie_player" style="position:relative;width:600px;height:400px;background:#333"><video class="html5-main-video" width=600 height=400 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis/, r=>{const q=new URL(r.request().url()).searchParams.get('q')||''; r.fulfill({contentType:'application/json',body:JSON.stringify([[[q==='know'?'知道':'译:'+q,q]],null,'en',null,null,null,null,null,null,null,null,null,q==='know'?[["verb",["知道","认识","了解"],[["知道",["know"],null,0.5],["认识",["know"],null,0.2],["了解",["know"],null,0.1]],"know",2]]:null])})});
  await ctx.route(/wiktionary/, r=>r.fulfill({contentType:'application/json',body:JSON.stringify({query:{pages:[{title:'we know',pageid:1}]}})}));
  await ctx.route(/datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1100,height:600}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-w',{timeout:8000});
  if(!await p.$('#vs-panel.show')) await p.evaluate(()=>document.querySelector('#vs-pill .ic, #vs-pill')&&0);
  console.log('面板:', await p.evaluate(()=>{const P=document.querySelector('#vs-panel');return P?P.className+' rows='+P.querySelectorAll('.it.sb').length:'无'}));
  if(!await p.$('#vs-panel.show')) { await p.keyboard.press('l'); await p.waitForTimeout(300); console.log('show?', !!(await p.$('#vs-panel.show'))); }
  await p.hover('#vs-panel .it.sb .vs-w[data-w=know]'); await p.waitForTimeout(900);
  console.log('列表里的翻译:', await p.evaluate(()=>{const t=document.querySelector('#vs-panel .it.sb .tr');return t.textContent+' 可见='+(getComputedStyle(t).display!=='none')})); console.log('悬停单词:', await p.evaluate(()=>{const s=document.querySelector('#vs-side');return s?s.innerText.replace(/\n/g,' / '):'无'}));
  await p.screenshot({path:'/tmp/t26.png'});
  const bb = await p.evaluate(()=>{const a=document.querySelector('#vs-side').getBoundingClientRect(),b=document.querySelector('#vs-panel').getBoundingClientRect();return [a.right|0,b.left|0]}); console.log('气泡右缘/面板左缘:', bb);
  const box = await (await p.$('#vs-panel .it.sb:nth-child(1)')).boundingBox(); await p.mouse.move(box.x+box.width-60, box.y+box.height-4); await p.waitForTimeout(400);
  console.log('悬停行空白:', await p.evaluate(()=>{const s=document.querySelector('#vs-side');return s?s.innerText.replace(/\n/g,' / '):'无'}));
  await p.mouse.move(100,500); await p.waitForTimeout(300); console.log('移开:', await p.evaluate(()=>!!document.querySelector('#vs-side')));
  await p.click('#vs-panel .it.sb:nth-child(1) .pl',{force:true}); await p.waitForTimeout(500); console.log('点播放后时间:', await p.evaluate(()=>document.querySelector('video').currentTime.toFixed(1)));
  await p.click('#vs-panel .it.sb .vs-w[data-w=know]'); await p.waitForTimeout(600); console.log('点词出词典:', await p.evaluate(()=>!!document.querySelector('#vs-tip')));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
