const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof15', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300);
  const ev=(a,b)=>[{tStartMs:0,dDurationMs:30000,segs:[{utf8:a}]},{tStartMs:30000,dDurationMs:30000,segs:[{utf8:b}]}];
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:u.includes('tlang=')?ev('第一句翻译','第二句翻译'):ev('First sentence here.','Second sentence here.')})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:900px;height:500px;background:#333"><video class="html5-main-video" width=900 height=500 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),300)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1000,height:600}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForSelector('#vs-sub .vs-w',{timeout:8000}); await p.waitForFunction(()=>document.querySelector('#vs-sub .vs-t').textContent);
  const st=()=>p.evaluate(()=>{const h=s=>document.querySelector('#vs-sub '+s).classList.contains('hid')?'模糊':'清晰'; return '原文'+h('.vs-o')+' 翻译'+h('.vs-t')+(document.querySelector('video').paused?' (暂停)':'')});
  const away=async()=>{await p.mouse.move(950,30); await p.waitForTimeout(250)};
  const mode=async m=>{await pp.selectOption('[data-k=hideMode]',m); await p.bringToFront(); await p.waitForTimeout(500); await p.evaluate(()=>{document.querySelector('video').currentTime=1}); await p.waitForTimeout(400); /* 强制换句重置 */ await p.keyboard.press('d'); await p.waitForTimeout(600); await p.keyboard.press('a'); await p.waitForTimeout(600); await away();};
  for (const m of ['trans','orig','transFirst','origFirst']) {
    await mode(m); const r=[m+':', '初始 '+await st()];
    await p.evaluate(()=>document.querySelector('video').pause()); await p.waitForTimeout(300); r.push('暂停后 '+await st());
    await p.keyboard.press('e'); await p.waitForTimeout(250); r.push('E×1 '+await st());
    await p.keyboard.press('e'); await p.waitForTimeout(250); r.push('E×2 '+await st());
    console.log(r.join(' | '));
  }
  await mode('transFirst'); const r2=['transFirst 鼠标:', '初始 '+await st()];
  await p.hover('#vs-sub .vs-t'); await p.waitForTimeout(250); r2.push('移到翻译 '+await st()); await away(); r2.push('移开 '+await st());
  await p.hover('#vs-sub .vs-o'); await p.waitForTimeout(250); r2.push('移到原文 '+await st());
  await away(); await p.keyboard.press('d'); await p.waitForTimeout(700); r2.push('鼠标移开后换下一句 '+await st());
  await p.keyboard.press('e'); await p.keyboard.press('e'); await p.hover('#vs-sub .vs-o'); await p.waitForTimeout(200); await p.keyboard.press('a'); await p.waitForTimeout(700); r2.push('鼠标停在字幕上换句 '+await st());
  console.log(r2.join(' | '));
  await mode('off'); console.log('off: '+await st());
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
