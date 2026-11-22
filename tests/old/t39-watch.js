const { chromium, devices } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'web'), OUT = __dirname;
const cues = []; for (let i = 0; i < 40; i++) cues.push({ s: i * 3, e: i * 3 + 2.6, t: i === 1 ? "And one day I woke up with three days" : "This is sentence number " + i + " about procrastination.", r: i % 5 === 4 ? "" : "这是第 " + i + " 句" });
cues[2].t = ">> " + cues[2].t; cues[3].t = "[music] " + cues[3].t; cues[3].r = ">> [音乐] 这是第 3 句"; cues.push({ s: 121, e: 123, t: "[music]", r: "[音乐]" }, { s: 124, e: 126, t: "(Laughter)", r: "" });
let posted = null, gtFail = false;
const DOC = { ok: true, v: "arj7oStGLkU", title: "Inside the Mind of a Master Procrastinator", author: "TED", tl: "zh-CN", cues };
const YT = `window.YT={Player:function(id,o){const el=document.getElementById(id);el.innerHTML='<div style="color:#fff;padding:20px">FAKE PLAYER</div>';let t=o.playerVars.start||0,st=-1,rate=1,last=Date.now();const adv=()=>{if(st===1){t+=(Date.now()-last)/1000*rate*4;}last=Date.now();};setInterval(adv,30);const p={getCurrentTime:()=>t,getPlayerState:()=>st,playVideo(){adv();st=1;o.events.onStateChange({data:1})},pauseVideo(){adv();st=2;o.events.onStateChange({data:2})},seekTo(x){t=x},setPlaybackRate(r){rate=r},destroy(){}};window.__p=p;setTimeout(()=>o.events.onReady(),50);return p;}};setTimeout(()=>window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady(),20);`;
const srv = http.createServer((q, r) => { const u = new URL(q.url, 'http://x'); if (u.pathname === '/api/cap') { r.setHeader('content-type', 'application/json'); if (q.method === 'POST') { let b = ''; q.on('data', x => b += x); q.on('end', () => { posted = JSON.parse(b); r.end('{"ok":true}'); }); return; } if (u.searchParams.get('list')) return r.end(JSON.stringify({ ok: true, items: [{ v: DOC.v, title: DOC.title, author: "TED", n: 40, dur: 120 }] })); if (u.searchParams.get('v') === DOC.v) return r.end(JSON.stringify(DOC)); r.statusCode = 404; return r.end('{"ok":false}'); } const f = path.join(ROOT, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname)); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8'); r.end(d); }); }).listen(0);
(async () => {
  const port = srv.address().port, b = await chromium.launch(); let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
  for (const [name, dev] of [['iphone', devices['iPhone 13']], ['w360', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }], ['desk', { viewport: { width: 1280, height: 800 } }]]) {
    const ctx = await b.newContext(dev), p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', rt => { const u = rt.request().url(); if (u.startsWith('http://localhost')) return rt.continue(); if (u.includes('youtube.com/iframe_api')) return rt.fulfill({ contentType: 'text/javascript', body: YT }); if (u.includes('translate.googleapis.com')) { if (gtFail) return rt.fulfill({ status: 429, headers: { 'access-control-allow-origin': '*' }, body: 'x' }); const q = new URL(u).searchParams.get('q'); return rt.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([q.split('\n').map((x, i, a) => ["译" + x.length + (i < a.length - 1 ? "\n" : ""), x]), [["verb", ["醒来", "觉醒"]]]]) }); } if (u.includes('dictionaryapi')) return rt.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ phonetic: "/wəʊk/", meanings: [{ definitions: [{ definition: "past of wake" }] }] }]) }); return rt.abort(); });
    await p.goto('http://localhost:' + port + '/'); await p.waitForTimeout(800);
    const n0 = await p.evaluate(() => words.length);
    await p.click('#tab-listen'); await p.click('#en-secbar [data-sub=video]'); await p.waitForSelector('.wt-item'); ok(await p.evaluate(()=>getComputedStyle(document.getElementById('subtabs')).display!=='none'&&getComputedStyle(document.getElementById('view-en')).display==='none'&&document.getElementById('tab-listen').classList.contains('on')), name+' video under 🎧 听, other views hidden'); // 2026-11-21 起视频在「📚 英语 → 🎧 听 → 🎬 视频」 ok(await p.evaluate(()=>[...document.querySelectorAll('#apptabs button')].every(b=>{const r=b.getBoundingClientRect();return (innerWidth>640||r.height>=40)&&r.right<=innerWidth&&r.left>=0})), name+' tabs fit');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' home overflow');
    { const bm = await p.evaluate(() => { const c = decodeURIComponent(document.getElementById('wt-bml').href.slice(11)); let okJs = true; try { new Function(c); } catch (e) { okJs = false; } return { okJs, noKey: !/X-Key|var K=/.test(c), site: c.includes('S="' + location.origin + '"'), left: /__KEY__|__SITE__/.test(c) }; }); ok(bm.okJs && bm.noKey && bm.site && !bm.left, name + ' bookmarklet ' + JSON.stringify(bm)); }
    await p.click('#wt-bm summary'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' bm overflow');
    await p.screenshot({ path: OUT + '/' + name + '-home.png' });
    await p.click('.wt-item'); await p.waitForSelector('.wt-row'); await p.waitForTimeout(600);
    ok(await p.locator('.wt-row').count() === 40, name + ' rows');
    { const tx = await p.evaluate(() => [...document.querySelectorAll('.wt-row')].map(r => r.querySelector('.t').textContent + '|' + r.querySelector('.r').textContent).join('\n')); ok(!/>>|\[|\(Laughter\)/.test(tx), name + ' symbols cleaned ' + tx.split('\n').slice(2, 4).join(' / ')); }
    await p.evaluate(() => window.__p.playVideo()); await p.waitForTimeout(1500);
    const s1 = await p.evaluate(() => window.__wt.state()); ok(s1.cur >= 1, name + ' advancing ' + JSON.stringify(s1));
    ok(await p.locator('.wt-row.cur').count() === 1, name + ' cur row');
    await p.waitForTimeout(1500); ok(await p.evaluate(() => [...document.querySelectorAll('.wt-row .r')].every(x => x.textContent)), name + ' translations filled');
    await p.waitForTimeout(500); ok(posted && posted.cues.length === 40 && posted.cues.every(c => c.r) && !/>>|\[/.test(posted.cues.map(c => c.t + c.r).join(' ')), name + ' saved back ' + (posted && posted.cues.length)); ok(await p.evaluate(() => document.getElementById('wt-note').style.display === 'none'), name + ' note hidden');
    // 逐句停：停在当前句，不跳到下一句
    await p.click('#wt-ap'); await p.waitForTimeout(1500);
    const a = await p.evaluate(() => ({ st: window.__p.getPlayerState(), s: window.__wt.state(), t: window.__p.getCurrentTime() }));
    ok(a.st === 2 && a.s.lock, name + ' autopause ' + JSON.stringify(a)); await p.waitForTimeout(400);
    const a2 = await p.evaluate(() => window.__wt.state().cur); ok(a2 === a.s.cur, name + ' locked cue');
    await p.click('#wt-next'); await p.waitForTimeout(300); ok(await p.evaluate(() => window.__wt.state().cur) === a.s.cur + 1, name + ' next');
    await p.click('#wt-ap');
    // 点第二行里的词 → 查词 → 加入生词本
    await p.evaluate(() => window.__p.pauseVideo());
    await p.evaluate(() => document.querySelector('.wt-row[data-i="1"] .wt-w[data-w=woke]').click()); await p.waitForSelector('.wt-sheet.on'); await p.waitForTimeout(500);
    ok((await p.textContent('#wt-m')).includes('醒来'), name + ' meaning ' + await p.textContent('#wt-m'));
    await p.screenshot({ path: OUT + '/' + name + '-sheet.png' });
    await p.click('.wt-sheet [data-a=add]'); await p.waitForTimeout(400);
    const e = await p.evaluate(() => state.custom.find(x => x.id === 'v_woke')); ok(e && e.examples[0][0] === 'And one day I {woke} up with three days' && e.zh.includes('醒来'), name + ' entry ' + JSON.stringify(e));
    ok(await p.evaluate(n => words.length === n + 1, n0), name + ' words+1');
    ok(await p.evaluate(() => document.querySelector('.wt-row[data-i="1"] .wt-w[data-w=woke]').classList.contains('lr')), name + ' recolor');
    await p.click('.wt-sheet [data-a=x]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' play overflow');
    const g = await p.evaluate(() => { const r = x => document.querySelector(x).getBoundingClientRect(); return { h: innerHeight, list: r('#wt-list'), ctl: r('.wt-ctl'), small: [...document.querySelectorAll('.wt-ctl button,.wt-bar button')].filter(b => b.getBoundingClientRect().height < 40).length }; });
    ok(g.ctl.bottom < g.h && g.list.bottom <= g.h + 1 && g.list.height >= 100 && !g.small, name + ' fits ' + JSON.stringify(g));
    await p.screenshot({ path: OUT + '/' + name + '-play.png' });
    // 回到其它模式仍正常
    await p.click('#wt-back'); await p.reload(); await p.waitForTimeout(800); ok(await p.evaluate(()=>document.documentElement.classList.contains('show-video')), name+' tab remembered'); await p.click('#tab-notebook'); await p.waitForTimeout(200); ok(await p.evaluate(()=>!document.documentElement.classList.contains('show-video')&&document.getElementById('l1-en').classList.contains('on')&&document.getElementById('tab-notebook').classList.contains('on')&&getComputedStyle(document.getElementById('view-en')).display!=='none'), name+' back to 词汇'); await p.click('.modes button[data-mode=flash]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.getElementById('flash').classList.contains('on')), name + ' flash works'); await p.click('#l1-life'); await p.waitForTimeout(200); ok(await p.evaluate(()=>document.getElementById('l1-life').classList.contains('on')), name+' life tab'); await p.click('#l1-en');
    await p.click('.modes button[data-mode=list]'); ok(await p.isVisible('#list-view'), name + ' list visible');
    await p.goto('http://localhost:' + port + '/?v=arj7oStGLkU'); await p.waitForSelector('.wt-row'); ok(await p.evaluate(() => document.documentElement.classList.contains('show-video') && !location.search && document.querySelectorAll('.wt-row').length === 40), name + ' deep link');
    ok(!errs.length, name + ' pageerrors ' + errs.join(' | ')); await ctx.close();
  }
  { const ctx = await b.newContext(devices['iPhone 13']), p = await ctx.newPage(); posted = null; gtFail = true;
    await p.route('**/*', rt => { const u = rt.request().url(); if (u.startsWith('http://localhost')) return rt.continue(); if (u.includes('youtube.com/iframe_api')) return rt.fulfill({ contentType: 'text/javascript', body: YT }); if (u.includes('translate.googleapis.com')) { if (gtFail) return rt.fulfill({ status: 429, headers: { 'access-control-allow-origin': '*' }, body: 'x' }); const q = new URL(u).searchParams.get('q'); return rt.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([q.split('\n').map((x, i, a) => ["译" + x.length + (i < a.length - 1 ? "\n" : ""), x]), null]) }); } return rt.abort(); });
    await p.goto('http://localhost:' + port + '/?v=arj7oStGLkU'); await p.waitForSelector('#wt-retry', { timeout: 20000 });
    ok((await p.textContent('#wt-note')).includes('8 句没翻译出来'), 'retry note ' + await p.textContent('#wt-note')); ok(!posted, 'not saved while incomplete');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'note overflow');
    gtFail = false; await p.click('#wt-retry'); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => [...document.querySelectorAll('.wt-row .r')].every(x => x.textContent)) && posted && posted.cues.length === 40, 'retry fills and saves'); await ctx.close(); }
  console.log(fail ? 'FAILED ' + fail : 'watch ok'); await b.close(); srv.close();
})();
