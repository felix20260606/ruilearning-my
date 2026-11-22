const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof12', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const lp = await ctx.newPage(); await lp.goto(`chrome-extension://${id}/level.html`); await lp.click('.row[data-r="1000"]'); await lp.click('#save'); await lp.waitForTimeout(300);
  const events=[{tStartMs:200,dDurationMs:40000,segs:[{utf8:'and got it in just at the deadline.'}]},{tStartMs:41000,dDurationMs:3000,segs:[{utf8:'They all have deadlines.'}]},{tStartMs:45000,dDurationMs:3000,segs:[{utf8:'He wakes up anytime a deadline gets too close.'}]},{tStartMs:49000,dDurationMs:3000,segs:[{utf8:'Nothing else here.'}]}];
  let reqs={lite:0,wik:0};
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:1050px;height:590px;background:#333"><video class="html5-main-video" width=1050 height=590 src="/tv.webm" muted></video></div><div id="secondary" style="position:absolute;left:1070px;top:0;width:400px"><div id="secondary-inner"></div></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),300)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis/, r=>{const u=new URL(r.request().url()); const bd=u.searchParams.getAll('dt').includes('bd'); if(bd) reqs.lite++; r.fulfill({contentType:'application/json',body:JSON.stringify(bd?[[["限期","x"]],[["noun",["截止日期","最后期限","限期","死线"],[],"x",1]],"en"]:[[["在截止日期前交稿了。","x"]],null,"en"])})});
  await ctx.route(/wiktionary/, r=>{reqs.wik++; r.fulfill({contentType:'application/json',body:JSON.stringify({en:[{partOfSpeech:'Noun',definitions:[{definition:'A time limit by which something must be completed.',examples:['I must make this deadline.']}]}]})})});
  await ctx.route(/datamuse/, r=>r.fulfill({status:404,body:'[]'}));
  const p = await ctx.newPage(); await p.setViewportSize({width:1500,height:700}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForTimeout(1000);
  await p.evaluate(()=>document.querySelector('video').play()); await p.waitForSelector('#vs-sub .vs-w');
  await p.hover('#vs-sub .vs-w[data-w="deadline"]'); await p.waitForFunction(()=>{const m=document.querySelector('#vs-mini .ms');return m&&m.textContent!=='…'});
  console.log('HOVER mini:', (await p.innerText('#vs-mini')).replace(/\n/g,' / '), '| dict open:', await p.locator('#vs-tip').count(), '| paused:', await p.evaluate(()=>document.querySelector('video').paused), '| wiktionary calls:', reqs.wik);
  await p.screenshot({path:'/tmp/mini.png',clip:{x:300,y:330,width:700,height:260}});
  await p.click('#vs-sub .vs-w[data-w="deadline"]'); await p.waitForFunction(()=>document.querySelectorAll('#vs-tip .ex').length>1); await p.waitForTimeout(500);
  console.log('CLICK dict examples:', (await p.$$eval('#vs-tip .ex .tx',e=>e.map(x=>x.textContent))).join(' | '));
  console.log('hits:', await p.$$eval('#vs-tip .vs-w.hit',e=>e.map(x=>x.textContent).join(',')), '| links:', await p.$$eval('#vs-tip .lk a',e=>e.map(x=>x.textContent).join(' ')), '| rank:', await p.textContent('#vs-tip .rk'));
  await p.mouse.move(600,100); await p.screenshot({path:'/tmp/dict.png',clip:{x:0,y:0,width:1050,height:590}});
  // 词典里右键标记例句中的词 → 外面字幕联动
  await p.evaluate(()=>document.querySelector('#vs-tip .ex .vs-w[data-w="deadline"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))); await p.waitForTimeout(500);
  console.log('after mark in dict -> subtitle class:', await p.evaluate(()=>document.querySelector('#vs-sub .vs-w[data-w="deadline"]').className), '| dict btn on:', await p.$$eval('#vs-tip .mk a.on',e=>e.map(x=>x.dataset.m).join(',')), '| panel:', await p.evaluate(()=>document.querySelector('#vs-panel .vs-w[data-w="deadline"]').className));
  await p.click('#vs-tip .mk a[data-m=learn]'); await p.waitForTimeout(400); console.log('learn -> subtitle:', await p.evaluate(()=>document.querySelector('#vs-sub .vs-w[data-w="deadline"]').className));
  // 点例句里的另一个词 → 词典切换
  await p.click('#vs-tip .ex .vs-w[data-w="wakes"]'); await p.waitForTimeout(700); console.log('switched to:', await p.evaluate(()=>document.querySelector('#vs-tip .w').firstChild.textContent));
  // 例句星标 / 播放
  await p.click('#vs-tip .ex .st'); await p.waitForTimeout(200); console.log('example starred:', await p.locator('#vs-tip .ex .st.on').count());
  await p.click('#vs-tip [data-a=x]'); await p.waitForTimeout(300); console.log('closed:', await p.locator('#vs-tip').count()===0, '| resumed:', await p.evaluate(()=>!document.querySelector('video').paused));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
