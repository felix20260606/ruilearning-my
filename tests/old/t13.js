const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof13', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  const events=[{tStartMs:200,dDurationMs:60000,segs:[{utf8:'and got it in just at the deadline.'}]}];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:1050px;height:590px;background:#333"><video class="html5-main-video" width=1050 height=590 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),300)</script></body></html>'}); });
  const TR={'got it':'明白了','got it in':'得到它了','got':'得到','a week later':'一周后','week':'周','wake up':'醒来','woke':'醒来','slow motion':'慢动作','slow':'慢','later':'之后'};
  await ctx.route(/translate\.googleapis/, r=>{const u=new URL(r.request().url()); const q=u.searchParams.get('q'); const bd=u.searchParams.getAll('dt').includes('bd'); r.fulfill({contentType:'application/json',body:JSON.stringify([[[TR[q]||('译:'+q),q]], bd&&q==='week'?[["noun",["周","星期","礼拜"],[],"x",1]]:null,"en"])})});
  let asked=[];
  await ctx.route(/wiktionary\.org\/w\/api\.php/, r=>{ const t=new URL(r.request().url()).searchParams.get('titles').split('|'); asked.push(t.length); const ex=new Set(['got it','got it in','get it in']); const pages={}; t.forEach((x,i)=>pages[ex.has(x)?String(100+i):String(-1-i)]=ex.has(x)?{title:x,pageid:1}:{title:x,missing:''}); r.fulfill({contentType:'application/json',body:JSON.stringify({query:{pages}})}); });
  await ctx.route(/datamuse|rest_v1/, r=>r.fulfill({status:404,body:'[]'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1200,height:700}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForTimeout(1000);
  await p.evaluate(()=>document.querySelector('video').play()); await p.waitForSelector('#vs-sub .vs-w');
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300);
  for (const pos of [11, 78]) {
    await pp.evaluate(v=>{const e=document.querySelector('[data-k=posBottom]');e.value=v;e.dispatchEvent(new Event('input'))},pos); await p.bringToFront(); await p.waitForTimeout(600);
    for (const w of ['got','deadline']) { await p.mouse.move(5,300); await p.waitForTimeout(400); await p.hover(`#vs-sub .vs-w[data-w="${w}"]`); await p.waitForTimeout(1500);
      const g=await p.evaluate(w=>{const m=document.getElementById('vs-mini').getBoundingClientRect(),b=document.querySelector('#vs-sub .vs-box').getBoundingClientRect(),pl=document.getElementById('movie_player').getBoundingClientRect(); return {overlapBox:!(m.bottom<=b.top||m.top>=b.bottom||m.right<=b.left||m.left>=b.right), inside:m.top>=pl.top&&m.bottom<=pl.bottom, below:document.getElementById('vs-mini').classList.contains('dn'), bar:document.querySelector('#vs-mini .fb i').style.width}},w);
      console.log('pos',pos,w.padEnd(8),'=>',(await p.innerText('#vs-mini')).replace(/\n+/g,' / '),JSON.stringify(g)); if(pos===78&&w==='got') await p.screenshot({path:'/tmp/phrase.png',clip:{x:150,y:0,width:700,height:330}}); } }
  console.log('wiktionary batch sizes:', asked.join(','));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
