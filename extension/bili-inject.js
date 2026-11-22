// 运行在 B 站页面环境（MAIN world）：
// 1. 拦播放器自己请求的字幕列表（x/player/wbi/v2）和字幕文件（aisubtitle.hdslb.com / i0.hdslb.com 的 bfs/subtitle、bfs/ai_subtitle），交给 content.js
// 2. content.js 来问「这个视频有哪些字幕」时：从播放器（window.player.getManifest）或 __INITIAL_STATE__ 拿 aid / cid，
//    带着用户的登录 cookie 请求 x/player/wbi/v2（AI 字幕要登录）；没有再试 x/v2/dm/view（不登录也给人工 CC 字幕）
(function () {
  const RE_PL = /\/x\/player\/(?:wbi\/)?v2\?/, RE_SUB = /hdslb\.com\/bfs\/(?:ai_)?subtitle\//;
  const post = m => window.postMessage(Object.assign({ src: "VS" }, m), "*");
  let lastPl = null; // 播放器最近一次拿到的字幕列表 {cid, list, login}
  function seen(url, text) {
    try {
      if (RE_PL.test(url)) {
        const d = JSON.parse(text).data; if (!d || !d.subtitle) return;
        lastPl = { cid: d.cid, list: d.subtitle.subtitles || [], login: !!d.login_mid };
        post({ type: "bili-pl", cid: d.cid, n: lastPl.list.length });
      } else if (RE_SUB.test(url)) {
        const j = JSON.parse(text); if (j && Array.isArray(j.body)) post({ type: "bili-sub", url: new URL(url, location.href).href, body: j.body });
      }
    } catch (e) {}
  }
  const want = u => RE_PL.test(u) || RE_SUB.test(u);
  const open = XMLHttpRequest.prototype.open, send0 = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { try { this.__vsU = String(url); } catch (e) {} return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    try { const u = this.__vsU; if (u && want(u)) this.addEventListener("load", () => { try { seen(u, this.responseType === "json" ? JSON.stringify(this.response) : !this.responseType || this.responseType === "text" ? this.responseText : ""); } catch (e) {} }); } catch (e) {}
    return send0.apply(this, arguments);
  };
  const f = window.fetch;
  window.fetch = function (input) {
    const p = f.apply(this, arguments);
    try { const u = typeof input === "string" ? input : input && input.url; if (u && want(u)) p.then(r => r.clone().text().then(t => seen(u, t))).catch(() => {}); } catch (e) {}
    return p;
  };
  // 当前播放的是哪个视频：播放器的 getManifest 最准（分 P、番剧、页内切换视频都跟着变），没有再看页面初始数据
  function info() {
    try { const m = window.player && window.player.getManifest && window.player.getManifest(); if (m && m.cid) return { aid: m.aid, cid: m.cid, bvid: m.bvid || "", p: m.p || 1, ep: m.episodeId || "" }; } catch (e) {}
    try {
      const s = window.__INITIAL_STATE__ || {}, v = s.videoData || {}, p = +s.p || 1, pg = (v.pages || [])[p - 1], ep = s.epInfo || {};
      if (ep.cid) return { aid: ep.aid, cid: ep.cid, bvid: ep.bvid || "", p: 1, ep: ep.id || ep.ep_id || "" };
      const cid = (pg && pg.cid) || s.cid || v.cid; if (cid) return { aid: s.aid || v.aid, cid, bvid: s.bvid || v.bvid || "", p, ep: "" };
    } catch (e) {}
    return null;
  }
  const getJ = u => fetch(u, { credentials: "include" }).then(r => r.json()).catch(() => null);
  window.addEventListener("message", async e => {
    if (e.source !== window || !e.data || e.data.src !== "VS-C" || e.data.type !== "bili-tracks") return;
    const vid = e.data.vid, i = info(), login = /(^|;\s*)DedeUserID=/.test(document.cookie);
    if (!i) { post({ type: "bili-tracks", vid, info: null, list: [], login }); return; }
    let list = [], lg = login;
    const has = l => l.some(t => t && (t.subtitle_url || t.subtitle_url_v2));
    if (lastPl && lastPl.cid === i.cid && has(lastPl.list)) { list = lastPl.list; lg = lg || lastPl.login; }
    else {
      const id = i.aid ? "aid=" + i.aid : "bvid=" + i.bvid;
      const j = await getJ("https://api.bilibili.com/x/player/wbi/v2?" + id + "&cid=" + i.cid + (i.ep ? "&ep_id=" + i.ep : ""));
      const d = j && j.data; if (d) { list = (d.subtitle && d.subtitle.subtitles) || []; lg = lg || !!d.login_mid; }
      if (!has(list) && i.aid) { const j2 = await getJ("https://api.bilibili.com/x/v2/dm/view?type=1&oid=" + i.cid + "&pid=" + i.aid); list = (j2 && j2.data && j2.data.subtitle && j2.data.subtitle.subtitles) || []; }
    }
    post({ type: "bili-tracks", vid, info: i, list, login: lg });
  });
})();
