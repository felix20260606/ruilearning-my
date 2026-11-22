const { chromium } = require('playwright'); const fs=require('fs');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof32', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  await ctx.route(/translate\.googleapis/, r=>{const q=new URL(r.request().url()).searchParams.get('q')||''; r.fulfill({contentType:'application/json',body:JSON.stringify([[['译'+q,q]],[["名词",["甲"+q.length,"乙"],[]]],'en'])})});
  await ctx.route(/tatoeba/, r=>r.fulfill({status:404,body:'{}'}));
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message)); await p.setViewportSize({width:1400,height:800});
  await p.goto(`chrome-extension://${id}/saved.html`); await p.waitForTimeout(300);
  console.log('空:', await p.evaluate(()=>document.querySelector('.empty')?.textContent.slice(0,20)));
  const img='data:image/gif;base64,R0lGODlhAQABAIAAAP8AAAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
  await p.evaluate(img=>new Promise(r=>{const now=Date.now(); chrome.storage.sync.set({level:700,ratio:2}); chrome.storage.local.set({saved:['grant','tuition','squint','monkey'],marks:{easy:'known',blah:'ignore'},savedCtx:{grant:{t:'The average grant for those students is over 60 000.',v:'vid1',s:83,at:now-3*864e5},tuition:{t:"I've read your tuition, your list price is high.",v:'vid1',s:120,at:now-3*864e5}},
    'med:w:squint':{t:'If you squint, you can still see it.',tr:'如果你眯着眼，还能看见。',v:'vid2',s:605,e:608,title:'LeBron Is Still LeBron',ch:'Mind the Game',img,aud:'',at:now},
    srs:{grant:{b:2,due:now+2*864e5,n:3},squint:{b:0,due:now-1000,n:1}},
    savedSents:[{k:'vid2|That would be the plan.',v:'vid2',s:30,t:'That would be the plan.',tr:'计划就是这样。',at:now}]},r)}),img);
  await p.reload(); await p.waitForTimeout(900); await p.screenshot({path:'/tmp/t32a.png'});
  console.log('单词页:', await p.evaluate(()=>[...document.querySelectorAll('#wrap tr[data-w]')].map(tr=>tr.dataset.w+'|'+tr.querySelector('.t').textContent+'|'+tr.querySelector('.r').textContent+'|'+tr.querySelector('.st').textContent+'|img='+!!tr.querySelector('img')).join(' ; ')));
  console.log('分组:', await p.evaluate(()=>[...document.querySelectorAll('.day')].map(d=>d.textContent).join(' / ')));
  await p.fill('#q','squ'); await p.waitForTimeout(500); console.log('搜索 squ:', await p.evaluate(()=>[...document.querySelectorAll('#wrap tr[data-w]')].map(t=>t.dataset.w).join(',')));
  await p.fill('#q',''); await p.waitForTimeout(500);
  await p.click('#sort b[data-v=freq]'); await p.waitForTimeout(300); console.log('按频率:', await p.evaluate(()=>[...document.querySelectorAll('#wrap tr[data-w]')].map(t=>t.dataset.w).join(',')));
  await p.click('tr[data-w=monkey] input'); await p.click('#sel button[data-b=known]'); await p.waitForTimeout(400);
  console.log('标为已知后:', await p.evaluate(()=>document.querySelector('.chips').innerText.replace(/\n+/g,' ')));
  await p.click('.chip[data-f=known]'); await p.waitForTimeout(300); console.log('已知列表:', await p.evaluate(()=>[...document.querySelectorAll('#wrap tr[data-w]')].map(t=>t.dataset.w).join(',')));
  await p.click('.tabs b[data-t=sents]'); await p.waitForTimeout(300); await p.screenshot({path:'/tmp/t32b.png'}); console.log('短语页:', await p.evaluate(()=>document.querySelector('#wrap table')?.innerText.replace(/\s+/g,' ').slice(0,90)));
  await p.click('.tabs b[data-t=all]'); await p.waitForTimeout(500); await p.screenshot({path:'/tmp/t32c.png'}); console.log('所有单词:', await p.evaluate(()=>document.querySelector('.chips').innerText.replace(/\n+/g,' ')+' | 段数='+document.querySelectorAll('.sec').length));
  await p.click('.lr .vs-w[data-w=about]',{button:'right'}); await p.waitForTimeout(500); console.log('右键 about:', await p.evaluate(()=>document.querySelector('.lr .vs-w[data-w=about]').className+' | '+document.querySelector('.chip.l b').textContent));
  await p.click('#aview b[data-v=row]'); await p.waitForTimeout(400); console.log('行视图:', await p.evaluate(()=>document.querySelectorAll('.wr').length+' 行, 首行='+document.querySelector('.wr').innerText.replace(/\s+/g,' ')));
  await p.click('#asort b[data-v=az]'); await p.waitForTimeout(500); console.log('A–Z:', await p.evaluate(()=>[...document.querySelectorAll('.sec')].slice(0,4).map(x=>x.textContent).join(' ')));
  await p.screenshot({path:'/tmp/t32e.png'});
  await p.click('.tabs b[data-t=words]'); await p.waitForTimeout(400); await p.click('.chip[data-f=learn]'); await p.waitForTimeout(300); await p.click('tr[data-w=grant] input'); await p.click('#sel button[data-c=r]'); await p.waitForTimeout(400);
  await p.click('.chip[data-tg=r]'); await p.waitForTimeout(400); console.log('红色标签筛选:', await p.evaluate(()=>[...document.querySelectorAll('#wrap tr[data-w]')].map(t=>t.dataset.w+(t.querySelector('i.tg')?'(有点)':'')).join(',')));
  await p.click('.chip[data-tg=r]'); await p.waitForTimeout(300); await p.screenshot({path:'/tmp/t32a.png'});
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
