// 站点适配：插件在哪个视频网站上运行（YouTube / 哔哩哔哩），各自提供找播放器和 video、视频 id、浮层挂在哪、右侧栏、全屏位置，
// 以及 B 站字幕列表 / 字幕文件的解析、链接回原视频。content.js 只通过 VS_SITE 碰这些和网站有关的东西。
// 这个文件只定义函数、不改页面：saved.html 也加载它（用 vsVidUrl 生成「出处」链接），Node 单测也直接加载（tests/t51-bili.js）
(function (G) {
  const q = s => document.querySelector(s);
  const base = l => String(l || "").toLowerCase().split(/[-_]/)[0];

  // ---------- 视频 id ----------
  // YouTube：11 位（如 dQw4w9WgXcQ）；B 站普通视频：BV 号，分 P 加「?p=2」（如 BV1Gf4y1y7wc?p=2）；番剧：ep123 / ss123
  const BV = /^(BV[0-9A-Za-z]{10})(?:\?p=(\d+))?$/, EP = /^(ep|ss)(\d+)$/;
  const vsVidSite = v => (BV.test(String(v || "")) || EP.test(String(v || "")) ? "bili" : "yt");
  // 链接回原视频，从 s 秒开始
  function vsVidUrl(v, s) {
    v = String(v || ""); const t = Math.max(0, Math.floor(+s || 0)); let m;
    if ((m = BV.exec(v))) return "https://www.bilibili.com/video/" + m[1] + "/?" + (m[2] && m[2] !== "1" ? "p=" + m[2] + "&" : "") + "t=" + t;
    if (EP.test(v)) return "https://www.bilibili.com/bangumi/play/" + v + "?t=" + t;
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(v) + "&t=" + t + "s";
  }
  // B 站地址 → 视频 id。地址可能带语言前缀（/zh-Hans/video/BV…），分 P 在 ?p= 里
  function vsBiliVid(loc) {
    const path = String(loc && loc.pathname || ""), sp = new URLSearchParams(String(loc && loc.search || "")); let m;
    if ((m = /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/)?video\/(BV[0-9A-Za-z]{10})(?:\/|$)/.exec(path))) { const p = parseInt(sp.get("p"), 10) || 1; return m[1] + (p > 1 ? "?p=" + p : ""); }
    if ((m = /^\/(?:[a-z]{2}(?:-[A-Za-z]{2,4})?\/)?bangumi\/play\/(ep|ss)(\d+)/.exec(path))) return m[1] + m[2];
    return "";
  }
  // 页面脚本报来的播放器信息（getManifest：bvid、p、episodeId）是不是当前这个视频的：B 站切换视频时地址先变，播放器后换，对不上就等一会儿再问
  function vsBiliSame(vid, info) {
    if (!vid || !info || !info.cid) return false; let m;
    if ((m = BV.exec(vid))) return info.bvid === m[1] && (+info.p || 1) === (+m[2] || 1);
    if ((m = /^ep(\d+)$/.exec(vid))) return !info.ep || String(info.ep) === m[1];
    return true; // ss 开头的番剧地址：只知道是哪一季，不知道哪一集，信播放器
  }

  // ---------- B 站字幕 ----------
  // 字幕列表（x/player/wbi/v2 或 x/v2/dm/view 的 data.subtitle.subtitles）→ [{lang, kind, name, url}]，kind "asr" = AI 自动生成
  function vsBiliTracks(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach(t => {
      if (!t) return; let url = String(t.subtitle_url || t.subtitle_url_v2 || "").trim(); if (!url) return;
      if (url.startsWith("//")) url = "https:" + url; url = url.replace(/^http:\/\//, "https://");
      const lan = String(t.lan || ""), ai = /^ai-/i.test(lan) || t.type === 1 || /自动生成|AI/.test(String(t.lan_doc || ""));
      const lang = lan.replace(/^ai-/i, "");
      if (!lang || out.some(x => x.url.split("?")[0] === url.split("?")[0] && x.lang === lang)) return;
      out.push({ lang, kind: ai ? "asr" : "", name: String(t.lan_doc || lan), url });
    });
    return out;
  }
  // 学习语言的候选轨，按先后试：人工字幕在前，AI 字幕在后（同一种语言里精确匹配的在前，如 en-US 之于 en）
  function vsBiliCands(tracks, lang) {
    const want = base(lang), c = (tracks || []).filter(t => base(t.lang) === want), ex = t => (t.lang.toLowerCase() === String(lang).toLowerCase() ? 0 : 1);
    return c.slice().sort((a, b) => (a.kind ? 1 : 0) - (b.kind ? 1 : 0) || ex(a) - ex(b));
  }
  // 翻译语言的字幕轨：ai = true 要 AI 生成的（当机器翻译用），false 要人工的（当人工翻译用）；简体 / 繁体按目标语言挑
  function vsBiliTrack(tracks, target, ai) {
    const want = base(target), c = (tracks || []).filter(t => base(t.lang) === want && !!t.kind === !!ai); if (!c.length) return null;
    const tl = String(target).toLowerCase(), hant = /tw|hk|hant/.test(tl), sc = t => { const l = t.lang.toLowerCase(); return l === tl ? 0 : want === "zh" ? (/tw|hk|hant/.test(l) === hant ? 1 : 2) : 1; };
    return c.slice().sort((a, b) => sc(a) - sc(b))[0];
  }
  // 字幕文件 {body:[{from, to, content}]} → [{s, e, t}]（还没清洗）
  const vsBiliLines = j => ((j && Array.isArray(j.body)) ? j.body : []).filter(x => x && x.content != null && isFinite(+x.from)).map(x => ({ s: +x.from, e: Math.max(+x.to || 0, +x.from), t: String(x.content) }));
  // 这些字幕真是这种语言吗（B 站常有上传者标错语言：标成英语的其实是中文）：中日韩文字占比看一眼
  function vsLooksLang(lines, lang) {
    const txt = (lines || []).slice(0, 80).map(x => x.t).join(" "), all = txt.replace(/[\s\d\p{P}\p{S}]/gu, "").length; if (!all) return false;
    const cjk = (txt.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length / all, b = base(lang);
    return b === "zh" || b === "ja" || b === "ko" ? cjk > 0.3 : cjk < 0.2;
  }

  // ---------- 两个网站的页面结构 ----------
  const YT = {
    id: "yt", name: "YouTube", capSync: true,
    isWatch: () => /\/watch/.test(location.pathname),
    vid: () => new URLSearchParams(location.search).get("v") || "",
    video: () => q("video.html5-main-video") || q("video"),
    player: () => document.getElementById("movie_player"),        // 字幕浮层、按钮、词典挂在这里面（全屏时也在）
    ctlLeft: () => q(".ytp-left-controls"),                         // 播放器控制条左边：插件的开关按钮
    below: () => q("#below"),                                       // 「字幕放在视频下面」时放在它前面
    side: () => q("#secondary-inner") || q("#secondary"),           // 字幕栏停靠在视频右侧这一栏
    wide: () => { const f = q("ytd-watch-flexy"), fb = q("#full-bleed-container"); return YT.isWatch() && f && fb && (f.hasAttribute("theater") || f.hasAttribute("fullscreen") || !!document.fullscreenElement) && fb.offsetWidth > 0 && fb.contains(YT.player()) ? fb : null; }, // 影院 / 全屏：字幕栏放在视频右边
    title: () => document.title.replace(/^\(\d+\)\s*/, "").replace(/ - YouTube$/, ""),
    channel: () => { const ch = q("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, #upload-info a"); return ch ? ch.textContent.trim() : ""; },
    ad: () => !!q(".ad-showing")
  };
  // B 站页面是 Vue 服务端渲染、浏览器里再「水合」：水合完成前往它的节点里插东西，Vue 会把插件的节点当成它自己的（改掉 class、报错）。
  // 所以右侧栏、视频下方这些 Vue 管的地方，要等页面加载完、右侧栏的内容出来以后再放
  let loadAt = 0; if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("load", () => (loadAt = Date.now()));
  const biliReady = () => (loadAt || (document.readyState === "complete" && (loadAt = Date.now()))) && Date.now() - loadAt > 1500 && !!q(".right-container-inner .up-panel-container, .right-container-inner .rcmd-tab, .right-container-inner .recommend-list-v1, .plp-r .recommend-list-container");
  const BILI = {
    id: "bili", name: "哔哩哔哩", capSync: false, // 网站「🎬 视频」页只能放 YouTube，B 站的字幕不传
    isWatch: () => !!vsBiliVid(location),
    vid: () => vsBiliVid(location),
    video: () => q("#bilibili-player video") || q("#bilibili-player bwp-video") || q(".bpx-player-video-wrap video") || q(".bpx-player-video-wrap bwp-video"),
    player: () => q("#bilibili-player .bpx-player-video-area") || q(".bpx-player-video-area"),
    ctlLeft: () => q(".bpx-player-control-bottom-left"),
    below: () => (biliReady() ? q("#arc_toolbar_report") || q(".video-toolbar-container") : null), // 播放器下面的点赞投币那一条
    side: () => q(".right-container-inner") || q(".right-container") || q(".plp-r"),
    sideWait: () => !biliReady(),                                   // 还不能往右侧栏里放：字幕栏先不显示，等一会儿
    wide: () => { const c = q("#bilibili-player .bpx-player-container") || q(".bpx-player-container"); return c && /^(full|web)$/.test(c.dataset.screen || "") && c.contains(BILI.player()) ? c : null; }, // 全屏 / 网页全屏
    title: () => document.title.replace(/_哔哩哔哩_bilibili$/, "").replace(/_?bilibili$/i, "").trim(),
    channel: () => { const a = q(".up-detail-top .up-name") || q(".up-info-container .up-name") || q(".up-name"); return a ? a.textContent.trim() : ""; },
    ad: () => false
  };
  Object.assign(G, { vsVidSite, vsVidUrl, vsBiliVid, vsBiliSame, vsBiliTracks, vsBiliCands, vsBiliTrack, vsBiliLines, vsLooksLang, VS_SITES: { yt: YT, bili: BILI } });
  G.VS_SITE = typeof location !== "undefined" && /(^|\.)bilibili\.com$/.test(location.hostname) ? BILI : YT;
})(typeof globalThis !== "undefined" ? globalThis : this);
