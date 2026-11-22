const { chromium } = require('playwright');
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-prof25', { channel:'chromium', headless: true, args: ['--disable-extensions-except=/home/claude/ext','--load-extension=/home/claude/ext','--no-sandbox'] });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker'); const id = sw.url().split('/')[2];
  const p = await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message)); await p.setViewportSize({width:420,height:1500}); await p.goto(`chrome-extension://${id}/popup.html`); await p.waitForTimeout(400);
  await p.screenshot({path:'/tmp/t25a.png'});
  await p.click('.inf >> nth=1'); for (const d of await p.$$('details')) await d.evaluate(x=>x.open=true); await p.waitForTimeout(200);
  await p.screenshot({path:'/tmp/t25b.png',fullPage:true});
  await p.click('[data-k=g_art]'); await p.click('[data-k=autoPause]'); await p.selectOption('[data-k=hideMode]','trans'); await p.waitForTimeout(200);
  console.log('保存:', JSON.stringify(await p.evaluate(()=>new Promise(r=>chrome.storage.sync.get(['autoPause','hideMode','g_art','g_pa'],r)))), '说明展开:', await p.evaluate(()=>document.querySelectorAll('.hint.on').length));
  await ctx.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
