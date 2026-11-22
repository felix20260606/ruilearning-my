const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof21', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const pp = await ctx.newPage(); await pp.goto(`chrome-extension://${id}/popup.html`); await pp.waitForTimeout(300); await pp.uncheck('[data-k=hoverPause]'); await pp.evaluate(()=>chrome.storage.sync.set({autoPause:true,merge:false})); await pp.waitForTimeout(200);
  const N=9, ev=tr=>Array.from({length:N},(_,i)=>({tStartMs:500+i*1700,dDurationMs:1700,segs:[{utf8:tr?'译'+i:'Sentence number s'+i+'.'}]}));
  await ctx.route('https://www.youtube.com/**', r => { const u=r.request().url();
    if(u.includes('/api/timedtext')) return r.fulfill({contentType:'application/json',body:JSON.stringify({events:ev(u.includes('tlang='))})});
    if(u.endsWith('tv.webm')) return r.fulfill({contentType:'video/webm',body:fs.readFileSync('/tmp/tv.webm')});
    r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><div id="movie_player" style="position:relative;width:600px;height:400px;background:#333"><video class="html5-main-video" width=600 height=400 src="/tv.webm" muted></video></div><script>setTimeout(()=>fetch("/api/timedtext?v=abc&lang=en"),200)</script></body></html>'}); });
  await ctx.route(/translate\.googleapis|wiktionary|datamuse/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('https://www.youtube.com/watch?v=abc'); await p.waitForTimeout(700); await p.evaluate(()=>document.querySelector('video').play());
  let bad=0, rows=[];
  for(let k=0;k<N-1;k++){
    await p.waitForFunction(()=>{const v=document.querySelector('video');return v.paused&&v.currentTime>0.6},null,{timeout:15000});
    // 暂停后连续观察 1.2 秒，字幕必须一直是第 k 句
    const seen=new Set(); for(let j=0;j<8;j++){ seen.add(await p.evaluate(()=>document.querySelector('#vs-sub .vs-o').textContent.match(/s(\d+)/)[1])); await p.waitForTimeout(150); }
    const t=await p.evaluate(()=>document.querySelector('video').currentTime), end=0.5+(k+1)*1.7;
    const ok=seen.size===1&&seen.has(String(k)); if(!ok) bad++; rows.push(`第${k}句 暂停在${t.toFixed(2)}(句末${end.toFixed(2)}) 显示=${[...seen].join('/')} ${ok?'✓':'✗'}`);
    await p.evaluate(()=>document.querySelector('video').play()); await p.waitForTimeout(250);
  }
  console.log(rows.join('\n')); console.log('出错次数:', bad);
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
