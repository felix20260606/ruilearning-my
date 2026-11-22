const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof34', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.evaluate(()=>chrome.storage.sync.set({merge:false,hoverPause:false,level:700,ratio:2})); await pp.waitForTimeout(200);
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:[{tStartMs:0,dDurationMs:19000,segs:[{utf8:u.includes('tlang=')?'译':'He reinvented himself and wrote it; they reinvent things, write papers, and Tim ate 90 apples.'}]}]})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#fff"><div id="movie_player" style="position:relative;width:900px;height:440px;background:#333"><video class="html5-main-video" width=900 height=440 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis|wiktionary|datamuse|tatoeba/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1300,height:700}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-w',{timeout:8000}); await p.waitForTimeout(500);
  const box=w=>p.evaluate(w=>[...document.querySelectorAll('#vs-sub .vs-w')].filter(x=>x.dataset.w===w).map(x=>x.classList.contains('vs-lo')?'有框':'无框').join('/'),w);
  const rc=async w=>{await p.click(`#vs-sub .vs-w[data-w="${w}"]`,{button:'right'}); await p.waitForTimeout(350)};
  let bad=0; const chk=async(label,w,exp)=>{const g=await box(w); if(g!==exp) bad++; console.log(label, w+'='+g, g===exp?'✓':'✗ 应为'+exp)};
  for (const w of ['reinvented','wrote','Tim','90','apples','himself','it','they']) { await rc(w); await chk('右键一次', w, '有框'); }
  await chk('同词其他词形', 'reinvent', '有框'); await chk('同词其他词形', 'write', '有框');
  await rc('reinvent'); await chk('在另一个词形上右键取消', 'reinvent', '无框'); await chk('　原词形也取消', 'reinvented', '无框');
  await rc('write'); await chk('在另一个词形上右键取消', 'wrote', '无框');
  for (const w of ['Tim','90','apples']) { await rc(w); await chk('再右键取消', w, '无框'); }
  for (const w of ['reinvent','write','papers']) { await rc(w); await chk('再右键加回', w, '有框'); }
  console.log('不符合预期的次数:', bad);
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
