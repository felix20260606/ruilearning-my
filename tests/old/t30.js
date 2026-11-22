const { chromium } = require('playwright');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof30', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const SENT={complicate:[['Is that so complicated?','有这么复杂吗？'],['Why is it so complicated?','为什么这么复杂？']],apple:[['I have a lot more apples than you.','我的苹果比你的多得多。'],['She ate an apple.','她吃了一个苹果。']],deadline:[['We missed the deadline.','我们错过了最后期限。'],['The deadline is tomorrow.','截止日期是明天。']]};
  await ctx.route(/tatoeba\.org/, r=>{const q=new URL(r.request().url()).searchParams.get('query'); r.fulfill({contentType:'application/json',body:JSON.stringify({paging:{},results:(SENT[q]||[]).map(x=>({text:x[0],translations:[[{text:x[1],lang:'cmn',script:'Hans'}],[]]}))})})});
  await ctx.route(/translate\.googleapis/, r=>{const q=new URL(r.request().url()).searchParams.get('q')||''; r.fulfill({contentType:'application/json',body:JSON.stringify([[['译:'+q,q]],null,'en'])})});
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message)); await p.setViewportSize({width:1200,height:720});
  await p.goto(`chrome-extension://${id}/review.html`); await p.waitForTimeout(300);
  console.log('空状态:', await p.evaluate(()=>!document.getElementById('empty').hidden+' 按钮禁用='+document.getElementById('start').disabled));
  await p.evaluate(()=>new Promise(r=>chrome.storage.local.set({savedSents:[{k:'ph|a week later',v:'v1',s:3,t:'a week later',tr:'一周后',ph:1,ctx:'She finished the paper a week later.',at:5}],saved:['complicate','apple','deadline','squint'],savedCtx:{squint:{t:'If you squint, you can still see it.',at:1}},sugg:{monkey:{t:'The monkey grabs the wheel.',v:'x',s:1,n:5,at:2}},reviewOpt:{quiz:true,listen:true,sugg:true,num:10,newPct:100,speak:false}},r)));
  await p.reload(); await p.waitForTimeout(400); await p.screenshot({path:'/tmp/t30a.png'});
  console.log('首页:', await p.evaluate(()=>document.querySelector('.stats').innerText.replace(/\n+/g,' ')+' | '+document.getElementById('cnt').textContent));
  await p.click('#start'); await p.waitForSelector('#bD',{timeout:10000});
  const st=()=>p.evaluate(()=>document.getElementById('pn').textContent+' '+document.getElementById('hint').innerText.slice(0,5)+' | '+document.querySelector('#card .en').innerText.replace(/\n/g,' ')+' | 原文隐藏='+!!document.querySelector('#card .en.hid')+' 翻译隐藏='+!!document.querySelector('#card .zh.hid'));
  console.log('第1张:', await st()); await p.keyboard.press('e'); console.log('按E:', await st()); await p.keyboard.press('e'); console.log('再按E:', await st()); await p.screenshot({path:'/tmp/t30b.png'});
  // 走完听力卡，直到遇到填空
  let guard=0; while(!(await p.$('#inp')) && guard++<12) { await p.keyboard.press('d'); await p.waitForTimeout(120); }
  console.log('填空卡:', await st()); await p.screenshot({path:'/tmp/t30c.png'});
  const ans=await p.evaluate(()=>{const en=document.querySelector('#card .en'); return en.innerText});
  // 第一个填空故意答错，其余用正确答案（从例句表里反查）
  await p.fill('#inp','wrongword'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); console.log('答错后:', await p.evaluate(()=>document.getElementById('ans').textContent+' 输入框='+document.getElementById('inp').className)); await p.screenshot({path:'/tmp/t30d.png'});
  await p.click('#bD');
  let sawSug=false; guard=0; while(!(await p.$('.done')) && guard++<40) { await p.waitForSelector('#bD, .done',{timeout:15000}); if(await p.$('#sg')){ sawSug=true; await p.keyboard.press('w'); await p.waitForTimeout(80);}  const inp=await p.$('#inp:not([disabled])'); if(inp){ const full=await p.evaluate(()=>{const en=document.querySelector('#card .en');const pre=en.childNodes[0]?.textContent||'';const post=en.childNodes[2]?.textContent||'';return [pre,post]}); const all=[].concat(...Object.values(SENT)).map(x=>x[0]).concat(['If you squint, you can still see it.','squint','The monkey grabs the wheel.','She finished the paper a week later.']); const s=all.find(x=>x.startsWith(full[0])&&x.endsWith(full[1])&&x.length>=full[0].length+full[1].length); const w=s?s.slice(full[0].length,s.length-full[1].length):'x'; await p.fill('#inp',w); await p.keyboard.press('Enter'); await p.waitForTimeout(100); await p.click('#bD'); } else { await p.click('#bD'); } await p.waitForTimeout(100); }
  console.log('建议词卡片出现过:', sawSug); console.log('结束:', await p.evaluate(()=>document.querySelector('.done')?.innerText.replace(/\n+/g,' | ').slice(0,60)));
  console.log('记录:', JSON.stringify(await p.evaluate(()=>new Promise(r=>chrome.storage.local.get(['srs','reviewDay'],v=>r({srs:Object.fromEntries(Object.entries(v.srs).map(([k,x])=>[k,'b'+x.b+' '+Math.round((x.due-Date.now())/3600000)+'h'])),day:v.reviewDay.n}))))));
  await p.click('#again'); await p.waitForTimeout(300); console.log('回首页:', await p.evaluate(()=>document.querySelector('.stats').innerText.replace(/\n+/g,' ')+' | '+document.getElementById('cnt').textContent+' | 今天 '+document.getElementById('tdn').textContent));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
