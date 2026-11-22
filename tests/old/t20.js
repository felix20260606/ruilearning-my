const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof20', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.uncheck('[data-k=hoverPause]');
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:0,dDurationMs:19000,segs:[{utf8:u.includes('tlang=')?'渔夫修理了港口的网':'The fisherman repaired the harbour nets.'}]}]})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:900px;height:500px;background:#333"><video class="html5-main-video" width=900 height=500 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  let n=0, failUntil=99;
  await ctx.route(/translate\.googleapis/, r=>{ n++; const q=new URL(r.request().url()).searchParams.get('q')||''; if(n<=failUntil) return r.fulfill({status:429,body:'x'}); r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify([[['译:'+q,q]],null,'en'])})});
  await ctx.route(/wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1000,height:600}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-w',{timeout:8000}); await p.waitForTimeout(1500);
  const hov=async w=>{await p.mouse.move(950,30); await p.waitForTimeout(400); await p.hover(`#vs-sub .vs-w[data-w=${w}]`); await p.waitForTimeout(1800); return p.evaluate(()=>{const m=document.querySelector('#vs-mini');return m?m.querySelector('.ms').innerText:'无气泡'})};
  console.log('接口全部失败时:', await hov('fisherman'), '请求数', n);
  failUntil=0;
  console.log('接口恢复后再次悬停:', await hov('fisherman'));
  // 模拟后台不可用：只让页面自己的请求成功
  failUntil=0; const before=n; console.log('另一个词:', await hov('harbour'), '新增请求', n-before);
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
