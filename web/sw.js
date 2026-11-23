/* Service Worker（版本 2026-11-20b）
   ① 超市价格清单：图片缓存优先、页面网络优先、字体先用缓存（原来的逻辑，不变）
   ② 网站本体（装到手机桌面后离线兜底）：首页 / 和 /index.html、同源的 .js / .css 网络优先，断网时用上次的缓存
   ③ GET /api/vocab（生词本）网络优先，断网时返回上次的缓存（按完整网址存，家人各自的 ?u= 分开）
   其它 /api/* 和所有非 GET 请求一律不碰，照常走网络
   ④ 每日提醒的通知：点一下打开 /?go=pump */
const IMG = 'kl-img-v1', PAGE = 'kl-page-v1', FONT = 'kl-font-v1';
const APP = 'app-2026-11-20b';               // 网站本体的缓存；改版本名后旧的 app-* 缓存在 activate 时删掉
const KEEP = [IMG, PAGE, FONT, APP];
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => /^app-/.test(k) && !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 网络优先：成功就顺手存一份；断网 / 出错时用缓存（先找完整网址，再忽略 ?v= 之类的参数找）
function netFirst(req, key, ignoreSearchFallback) {
  return fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(APP).then(c => c.put(key || req, cp)).catch(() => {}); }
    return res;
  }).catch(err => caches.open(APP).then(c => c.match(key || req).then(hit => hit || (ignoreSearchFallback ? c.match(key || req, { ignoreSearch: true }) : null))).then(hit => { if (hit) return hit; throw err; }));
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url), same = u.origin === location.origin;
  if (same && /\/shop-(thumbs|photos)\//.test(u.pathname)) {
    e.respondWith(caches.open(IMG).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
  } else if (same && /\/kl-prices\.html$/.test(u.pathname)) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(PAGE).then(c => c.put('kl-prices.html', cp)); } return res; }).catch(() => caches.open(PAGE).then(c => c.match('kl-prices.html')).then(h => h || caches.open(IMG).then(c => c.match('kl-prices.html')))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(FONT).then(c => c.match(req).then(hit => { const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit); return hit || net; })));
  } else if (same && u.pathname === '/api/vocab') {
    e.respondWith(netFirst(req, null, false));   // 生词本：不忽略参数，免得拿到别的家人的缓存
  } else if (same && /^\/api\//.test(u.pathname)) {
    return;                                        // 其它接口不碰
  } else if (same && (u.pathname === '/' || u.pathname === '/index.html')) {
    e.respondWith(netFirst(req, '/', true));       // 首页：/、/?go=pump、/index.html 共用一份缓存
  } else if (same && /\.(js|css)$/.test(u.pathname)) {
    e.respondWith(netFirst(req, null, true));      // 脚本、样式：带 ?v= 的新版本断网时退回上次的旧版本
  }
});
// 🔔 手机推送（_worker.js 的 /api/push）：推送不带内容，收到后用自己订阅的编号去后台取这条要显示的话（今天练了没有、连续几天）
self.addEventListener('push', e => {
  const fallback = { title: '📚 该练英语了', body: '打开练几张卡吧', url: '/?go=pump' };
  e.waitUntil(self.registration.pushManager.getSubscription().then(async sub => {
    let m = fallback;
    try {
      if (sub) { const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub.endpoint)))].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
        const r = await fetch('/api/push?peek=' + h, { cache: 'no-store' }); const j = await r.json(); if (j && j.ok && j.title) m = j; }
    } catch (er) {}
    return self.registration.showNotification(m.title, { body: m.body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'daily-push', data: { url: m.url || '/?go=pump' } });
  }));
});
// 每日提醒的通知（stats.js 用 registration.showNotification 发出）：点一下打开练习页；已经开着就切过去
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/?go=pump';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (new URL(c.url).origin === location.origin && 'focus' in c) { return c.focus().then(w => (w && 'navigate' in w ? w.navigate(url) : w)).catch(() => self.clients.openWindow(url)); } }
    return self.clients.openWindow(url);
  }));
});
