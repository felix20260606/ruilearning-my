/* 🗺 中国足迹地图（window.CNMAP）：旅游中心「🇨🇳 中国」最上面那张，trip-nav.html?r=cn 时自动画
   数据：cn/map.json（省界 + 市 / 区县边界的 SVG 路径 + 城市点，tools/cn-data/make_map.py 生成）+ cn/visited.json（默认足迹）+ cn/index.json（目录：封面、缩略图）
   状态：trip-state.js（TRIPST）——省页 / 城市页勾的「去过 / 路过 / 想去 / 计划（算想去）/ 不想去 / 评价 / 再去」（id = cn-<维基数据编号>），
         景点大全 / 城市页里勾了某个城市的任何景点也算去过这个城市（map.json 的 alias：按最长前缀对到一个城市）
   画法：去过哪个市就点亮哪一块（绿）、路过（青）、想去（金）；有去过的省整省带一点绿；去过的城市在全国视图上有发光的小点，再小的区也看得见
   操作：点省 → 平滑放大到这个省、右边列出所有城市；放大后点城市 → 标去过 / 想去、打开城市页；拖动、滚轮 / 双指缩放、双击放大、⟲ / Esc 回全国；导出图片（PNG） */
(function () {
  "use strict";
  if (window.CNMAP) return;
  var NS = "http://www.w3.org/2000/svg";
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function go(g, href) { if (window.parent && window.parent !== window) { try { parent.postMessage({ tripGo: g }, "*"); } catch (e) {} } else location.href = href; }
  function provHref(s) { return "cn-prov.html?p=" + s; }
  function cityHref(c) { return /^city:/.test(c.go) ? "cn-city.html?c=" + c.go.slice(5) : c.go === "hzsights" ? "hz-sights.html" : c.go === "cqsights" ? "cq-sights.html" : provHref(c.p); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  var COL = { been: "#2fbf71", pass: "#1fa0a0", want: "#ffc94d" };
  var CSS = ".cm{background:var(--paper);border:1px solid var(--line);border-radius:20px;overflow:hidden;margin:4px 0 18px;box-shadow:0 10px 30px rgba(0,0,0,.25)}" +
    ".cm-top{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;padding:14px 16px 12px}.cm-top h2{font-family:var(--display);font-size:17px;font-weight:900;margin:0}.cm-sub{font-size:12px;color:var(--soft);margin-top:3px}" +
    ".cm-st{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}.cm-n{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:6px 12px 7px;min-width:78px}.cm-n b{display:block;font-size:20px;font-weight:900;line-height:1.1}.cm-n b small{font-size:12px;color:var(--soft);font-weight:700;margin-left:2px}" +
    ".cm-n span{font-size:11px;color:var(--soft)}.cm-n.g b{color:#7ce3b8}.cm-n.t b{color:#5fd6d6}.cm-n.y b{color:#ffd36b}.cm-pg{height:4px;background:rgba(255,255,255,.07);display:flex}.cm-pg span{display:block;height:100%;transition:width .4s}" +
    ".cm-box{position:relative;background:#101217;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}.cm-box svg{display:block;width:100%;height:auto;max-height:72vh;cursor:grab}.cm-box svg.drag{cursor:grabbing}" +
    ".cm-pv{fill:#242936;transition:fill .25s}.cm-pv.been{fill:#22352f}.cm-pv.foc{fill:#2a3042}.cm-ln{fill:none;stroke:#4a5166;stroke-width:.9;vector-effect:non-scaling-stroke;pointer-events:none;stroke-linejoin:round}.cm-ln.foc{stroke:#c59bef;stroke-width:2}" +
    ".cm-cp{fill:#000;fill-opacity:0;stroke:#ffffff;stroke-opacity:.07;stroke-width:.5;vector-effect:non-scaling-stroke;cursor:pointer;transition:fill-opacity .2s,fill .2s}.cm-box svg.z2 .cm-cp{stroke-opacity:.18}" +
    ".cm-cp.been{fill:#2fbf71;fill-opacity:.82}.cm-cp.pass{fill:#1fa0a0;fill-opacity:.7}.cm-cp.want{fill:#ffc94d;fill-opacity:.5}.cm-cp.skip{fill:#000;fill-opacity:.25}" +
    ".cm-cp:hover{fill:#c59bef;fill-opacity:.35;stroke-opacity:.9}.cm-cp.been:hover{fill:#46d98a;fill-opacity:.95}.cm-cp.want:hover{fill-opacity:.7}.cm-cp.sel{stroke:#fff;stroke-opacity:1;stroke-width:2}" +
    ".cm-halo{fill:#7c5cd6;opacity:.38;pointer-events:none}.cm-box svg.drag .cm-halo{display:none}" +
    ".cm-jd{fill:#6a7080;stroke:#6a7080;stroke-width:.6;vector-effect:non-scaling-stroke;pointer-events:none}.cm-in{fill:#151821;stroke:#3a4052;stroke-width:1;vector-effect:non-scaling-stroke;pointer-events:none}" +
    ".cm-dot{fill:#9aa2b5;opacity:.55;cursor:pointer;stroke:#101217;stroke-width:.6;vector-effect:non-scaling-stroke}.cm-dot.been{fill:#2fbf71;opacity:1}.cm-dot.pass{fill:#1fa0a0;opacity:1}.cm-dot.want{fill:#ffc94d;opacity:1}.cm-dot.sel{stroke:#fff;stroke-width:2}" +
    ".cm-pin{pointer-events:none;fill:#7ce3b8;stroke:rgba(124,227,184,.35);vector-effect:non-scaling-stroke}.cm-pin.pass{fill:#5fd6d6;stroke:rgba(95,214,214,.35)}.cm-pin.want{fill:#ffd36b;stroke:rgba(255,211,107,.3)}" +
    ".cm-l{font-family:var(--display,sans-serif);font-weight:800;fill:#aab1c2;pointer-events:none;text-anchor:middle;paint-order:stroke;stroke:#101217;stroke-linejoin:round;font-size:calc(var(--fs) * 1px);stroke-width:calc(var(--fs) * .22px)}.cm-l.been{fill:#fff}" +
    ".cm-cl{display:none;font-family:sans-serif;font-weight:700;fill:#d4d8e2;pointer-events:none;text-anchor:middle;paint-order:stroke;stroke:#101217;stroke-linejoin:round;font-size:calc(var(--fc) * 1px);stroke-width:calc(var(--fc) * .25px)}.cm-cl.been{fill:#b9f5d8}" +
    ".cm-box svg.z2 .cm-cl.on{display:block}.cm-box svg.z2 .cm-l{display:none}.cm-box svg.nol .cm-l,.cm-box svg.nocl .cm-cl{display:none!important}" +
    ".cm-ctl{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px}.cm-ctl button{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(16,18,23,.75);backdrop-filter:blur(6px);color:#fff;font:700 16px sans-serif;cursor:pointer}.cm-ctl button:hover{border-color:#c59bef}" +
    ".cm-crumb{position:absolute;left:10px;top:10px;display:flex;gap:4px;align-items:center;font-size:12.5px;font-weight:800}.cm-crumb a{color:#fff;background:rgba(16,18,23,.75);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:4px 11px;cursor:pointer;text-decoration:none}.cm-crumb a:hover{border-color:#c59bef}.cm-crumb i{font-style:normal;color:#8a90a0}" +
    ".cm-tip{position:absolute;pointer-events:none;display:none;align-items:center;gap:8px;background:rgba(16,18,23,.94);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:5px 10px 5px 5px;font-size:12.5px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.4);z-index:3}" +
    ".cm-tip img{width:38px;height:38px;border-radius:8px;object-fit:cover;background:#2a2e38}.cm-tip b{display:block;font-size:13.5px}.cm-tip small{color:#a8afbf}" +
    ".cm-lg{position:absolute;left:10px;bottom:10px;display:flex;gap:10px;font-size:11.5px;color:#c8ccd6;background:rgba(16,18,23,.72);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:4px 11px}.cm-lg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:0}" +
    ".cm-pn{position:absolute;right:54px;top:10px;width:300px;max-height:calc(100% - 20px);overflow:auto;background:rgba(22,25,32,.94);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.45);display:none;z-index:2;color:var(--ink)}.cm-pn.on{display:block;animation:cmIn .22s ease}" +
    "@keyframes cmIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
    ".cm-ph{position:relative;height:110px;background:#20232b}.cm-ph img{width:100%;height:100%;object-fit:cover;display:block}.cm-ph:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.75))}" +
    ".cm-ph b{position:absolute;left:12px;bottom:9px;z-index:1;font-size:18px;font-weight:900;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6)}.cm-x{position:absolute;right:8px;top:8px;z-index:2;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.5);color:#fff;font-size:14px;cursor:pointer}" +
    ".cm-pb{padding:10px 12px 12px}.cm-pb .meta{font-size:12.5px;color:var(--soft);margin-bottom:8px}.cm-pb .meta b{color:var(--ink)}.cm-hd{display:flex;align-items:center;gap:10px;padding:12px 12px 0}.cm-hd img{width:54px;height:54px;border-radius:12px;object-fit:cover;background:#2a2e38}.cm-hd b{font-size:17px;font-weight:900;display:block}.cm-hd small{font-size:12px;color:var(--soft)}" +
    ".cm-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cm-acts button,.cm-acts a{font:inherit;font-size:12.5px;font-weight:800;border-radius:999px;padding:5px 12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;text-decoration:none}" +
    ".cm-acts .pri{background:var(--ui-pur,#8b5cf6);border-color:var(--ui-pur,#8b5cf6);color:#fff}" +
    ".cm-cs{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.cm-cs a{font-size:12px;font-weight:700;border:1px solid var(--line);border-radius:999px;padding:3px 9px;color:var(--ink);background:var(--bg);cursor:pointer;text-decoration:none}.cm-cs a:hover{border-color:#c59bef}" +
    ".cm-cs a.been{background:rgba(47,191,113,.22);border-color:rgba(47,191,113,.7)}.cm-cs a.pass{background:rgba(31,160,160,.2);border-color:rgba(31,160,160,.7)}.cm-cs a.want{background:rgba(255,201,77,.16);border-color:rgba(255,201,77,.7)}" +
    ".cm-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.08);display:flex;overflow:hidden;margin:6px 0 2px}.cm-bar span{display:block;height:100%}" +
    ".cm-bot{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;padding:9px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--soft)}.cm-bot label{cursor:pointer}.cm-bot button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:4px 12px;cursor:pointer;margin-left:auto}" +
    ".cm-rec{padding:0 16px 13px;font-size:12.5px;color:var(--soft)}.cm-rec a{color:var(--ink);text-decoration:none;cursor:pointer;margin-right:10px;white-space:nowrap}.cm-rec a:hover{color:#c59bef}" +
    ".cm-shot{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:rgba(8,9,12,.82);backdrop-filter:blur(4px);padding:14px}.cm-shot.on{display:flex}.cm-sh{max-width:100%;max-height:100%;text-align:center;color:#fff;font-size:13px}" +
    ".cm-sh img{display:block;max-width:100%;max-height:calc(72vh - 110px);margin:0 auto;border-radius:12px;border:1px solid rgba(255,255,255,.15);-webkit-touch-callout:default;user-select:auto}.cm-sht{color:#a8afbf;font-size:12px;margin:8px 0 2px}" +
    "@media(max-width:640px){.cm-pn{position:static;width:auto;max-height:none;border-radius:0;border-left:0;border-right:0;box-shadow:none;background:var(--paper);backdrop-filter:none}.cm-st{margin-left:0;width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:6px}.cm-n{min-width:0;padding:5px 8px 6px}.cm-n b{font-size:17px;white-space:nowrap}.cm-n b small{font-size:10.5px}.cm-n span{font-size:10.5px;white-space:nowrap}.cm-lg{font-size:10.5px;gap:7px}}" +
".ct-h{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:22px 2px 4px}.ct-h h2{font-family:var(--display);font-size:16px;font-weight:900;margin:0 auto 0 0;letter-spacing:.02em}" +
    ".ct-q{font:inherit;font-size:13.5px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:7px 14px;min-width:0;flex:0 1 220px;outline:none}.ct-q:focus{border-color:rgba(197,155,239,.6)}" +
    ".ct-sum{font-size:12.5px;color:var(--soft);margin:0 2px 2px;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}.ct-sum i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}" +
    ".ct-rh{display:flex;align-items:baseline;gap:8px;margin:20px 2px 10px;font-family:var(--display);font-weight:900;font-size:14px;color:var(--ink)}.ct-rh:before{content:\"\";width:4px;height:15px;border-radius:2px;background:#c59bef;align-self:center}.ct-rh small{font-family:inherit;font-weight:700;font-size:12px;color:var(--soft)}" +
    ".ct-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}" +
    ".ct-k{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:border-color .15s,box-shadow .15s}.ct-k:hover{border-color:rgba(197,155,239,.45);box-shadow:0 6px 22px rgba(0,0,0,.28)}.ct-k.been{border-color:rgba(47,191,113,.5)}" +
    ".ct-ph{position:relative;display:block;height:124px;overflow:hidden;background:#20232b;text-decoration:none;color:#fff}.ct-ph img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}.ct-k:hover .ct-ph img{transform:scale(1.05)}" +
    ".ct-ph:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.78))}" +
    ".ct-nm{position:absolute;left:13px;bottom:11px;z-index:1;display:flex;align-items:center;gap:7px;font-size:18px;font-weight:900;text-shadow:0 1px 8px rgba(0,0,0,.6)}.ct-nm i{font-style:normal;font-size:11px;font-weight:800;border:1px solid rgba(255,255,255,.55);border-radius:6px;padding:0 5px;text-shadow:none}" +
    ".ct-pr{position:absolute;right:12px;bottom:12px;z-index:1;font-size:12px;font-weight:800;text-shadow:0 1px 6px rgba(0,0,0,.6)}.ct-pr b{color:#7ce3b8}.ct-cv{position:absolute;right:9px;top:8px;z-index:1;font-size:10.5px;background:rgba(0,0,0,.45);border-radius:999px;padding:2px 8px;opacity:.85}" +
    ".ct-bar{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:1;background:rgba(255,255,255,.12);display:flex}.ct-bar span{display:block;height:100%}" +
    ".ct-dp{background:var(--paper);border:1px solid rgba(197,155,239,.35);border-radius:14px;padding:10px 13px 11px;margin:0 0 10px}.ct-dp h4{margin:0 0 7px;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;font-size:13.5px;font-weight:900;color:var(--ink)}.ct-dp h4 b{font-family:var(--display);font-size:20px;color:#c59bef}.ct-dp h4 small{font-size:12px;font-weight:700;color:var(--soft)}" +
    ".ct-dpb{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;display:flex}.ct-dpb span{display:block;height:100%;background:linear-gradient(90deg,#8e5fd6,#c59bef)}.ct-dpb span+span{background:rgba(255,201,77,.55)}.ct-dp p{margin:7px 0 0;font-size:12px;color:var(--soft);line-height:1.6}.ct-dp p em{font-style:normal;color:#ffc94d;font-weight:800}" +
    ".ct-dt{position:absolute;left:9px;top:8px;z-index:1;font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px;background:rgba(0,0,0,.5)}.ct-dt.ok{background:rgba(142,95,214,.85)}.ct-dt.wip{background:rgba(255,201,77,.9);color:#2a2000}.ct-dt.no{opacity:.75;font-weight:600}" +
    ".ct-cs{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:7px;padding:11px 11px 13px}" +
    ".ct-c{display:flex;align-items:center;gap:8px;min-width:0;padding:4px 8px 4px 4px;border:1px solid var(--line);border-radius:12px;color:var(--ink);background:var(--bg);text-decoration:none;transition:border-color .12s,transform .12s}.ct-c:hover{border-color:#c59bef;transform:translateY(-1px)}.ct-c{position:relative}.ct-c.dt:after{content:\"✓\";position:absolute;right:4px;top:3px;width:14px;height:14px;border-radius:50%;background:#8e5fd6;color:#fff;font-size:9px;font-weight:900;line-height:14px;text-align:center}.ct-c.dt b{padding-right:12px}" +
    ".ct-c img,.ct-c .ni{flex:none;width:40px;height:40px;border-radius:9px;object-fit:cover;background:#2a2e38;display:flex;align-items:center;justify-content:center;font-size:17px}.ct-c span{min-width:0;display:flex;flex-direction:column;line-height:1.25}" +
    ".ct-c b{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ct-c small{font-size:10.5px;font-weight:600;color:var(--soft);white-space:nowrap}.ct-c.cap{border-color:rgba(197,155,239,.55)}" +
    ".ct-c.been{background:rgba(47,191,113,.16);border-color:rgba(47,191,113,.7)}.ct-c.been small{color:#7ce3b8}.ct-c.pass{background:rgba(31,160,160,.15);border-color:rgba(31,160,160,.7)}.ct-c.want{background:rgba(255,201,77,.12);border-color:rgba(255,201,77,.7)}.ct-c.skip{opacity:.45}.ct-none{color:var(--soft);font-size:13px;padding:14px 2px}" +
    "@media(max-width:520px){.ct-g{grid-template-columns:1fr}.ct-ph{height:112px}.ct-q{flex:1 1 100%}}";

  function init(host) {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); if (TRIPST.S) TRIPST.S.css();
    host.innerHTML = '<div class="cm"><div class="cm-top"><div><h2>🗺 我的中国足迹</h2><div class="cm-sub">点省份放大 · 点城市标记 · 滚轮 / 双指缩放</div></div><div class="cm-st" id="cm-st"></div></div><div class="cm-pg" id="cm-pg"></div>' +
      '<div class="cm-stage" style="position:relative"><div class="cm-box" id="cm-box"><div class="cm-ctl"><button type="button" data-z="1.6" title="放大">＋</button><button type="button" data-z="0.625" title="缩小">－</button><button type="button" data-z="0" title="回到全国（Esc）">⟲</button></div>' +
      '<div class="cm-crumb" id="cm-crumb"></div><div class="cm-tip" id="cm-tip"></div>' +
      '<div class="cm-lg"><span><i style="background:' + COL.been + '"></i>去过</span><span><i style="background:' + COL.pass + '"></i>路过</span><span><i style="background:' + COL.want + '"></i>想去</span><span><i style="background:#2a3042;border:1px solid #4a5166"></i>还没去</span></div></div>' +
      '<div class="cm-pn" id="cm-pn"></div></div>' +
      '<div class="cm-bot"><label><input type="checkbox" id="cm-lab" checked> 省名</label><label><input type="checkbox" id="cm-cl" checked> 城市名（放大后）</label><button type="button" id="cm-png">📷 导出图片</button></div>' +
      '<div class="cm-rec" id="cm-rec"></div></div>';
    // 📂 全国目录（省卡片 + 下面所有城市）：页面里有 #cntree 就放那里，没有就接在地图下面
    var tw = document.getElementById("cntree"); if (!tw) { tw = document.createElement("div"); host.appendChild(tw); }
    tw.innerHTML = '<div class="ct-h"><h2>🗺 全国 34 个省级行政区 · 所有城市</h2><input class="ct-q" id="ct-q" type="search" placeholder="🔍 搜城市 / 省…" autocomplete="off"></div>' +
      '<div class="ct-dp" id="ct-dp"></div><div class="ct-sum" id="ct-sum"></div><div id="ct-body"></div>';
    var $ = function (id) { return document.getElementById(id); };
    Promise.all([fetch("cn/map.json").then(function (r) { return r.json(); }), fetch("cn/visited.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }), fetch("cn/index.json").then(function (r) { return r.json(); }).catch(function () { return []; })]).then(function (res) {
      var M = res[0], DEF = res[1] || {}, TREE = res[2] || [], BY = {}, PV = {}, TC = {}, TP = {}, sel = null, foc = null;
      var defBeen = {}, defWant = {};
      (DEF.been || []).forEach(function (id) { defBeen[id] = 1; }); (DEF.want || []).forEach(function (id) { defWant[id] = 1; });
      M.cities.forEach(function (c) { BY[c.id] = c; });
      M.prov.forEach(function (p) { PV[p.slug] = p; p.cs = []; });
      M.cities.forEach(function (c) { if (PV[c.p]) PV[c.p].cs.push(c); });
      TREE.forEach(function (p) { TP[p.slug] = p; p.cities.forEach(function (c) { TC[c.id] = c; }); });
      function pic(x, w) { return !x || !(x.th || x.img) ? "" : x.th ? "https://upload.wikimedia.org/wikipedia/commons/thumb/" + x.th + "/" + w + "px-" + x.th.split("/").pop() : "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(x.img) + "?width=" + w; }

      // ---- 画：海面 → 光晕 → 省底色 → 市块 → 省界 → 九段线 / 南海小框 → 发光点 → 省名 / 市名 ----
      var svg = el("svg", { viewBox: "0 0 " + M.w + " " + M.h });
      var defs = el("defs", {}, svg);
      defs.innerHTML = '<radialGradient id="cm-sea" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#1b1f2b"/><stop offset="1" stop-color="#0e1015"/></radialGradient>' +
        '<filter id="cm-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>';
      el("rect", { x: -M.w, y: -M.h, width: M.w * 3, height: M.h * 3, fill: "url(#cm-sea)" }, svg);
      var gH = el("g", { filter: "url(#cm-blur)" }, svg), gP = el("g", {}, svg), gC = el("g", {}, svg), gB = el("g", {}, svg), gD = el("g", {}, svg), gL = el("g", {}, svg);
      M.prov.forEach(function (p) {
        el("path", { d: p.d, "class": "cm-halo" }, gH);
        p.el = el("path", { d: p.d, "class": "cm-pv" }, gP); p.el.dataset.p = p.slug;
        p.ln = el("path", { d: p.d, "class": "cm-ln" }, gB);
      });
      el("path", { d: M.jd, "class": "cm-jd" }, gB);
      var ins = M.inset; gP.insertBefore(el("rect", { x: ins[0], y: ins[1], width: ins[2], height: ins[3], rx: 4, "class": "cm-in" }), gP.firstChild); // 南海小框垫在最底下
      M.cities.forEach(function (c) {
        if (c.d) { c.el = el("path", { d: c.d, "class": "cm-cp" }, gC); }
        else { c.el = el("circle", { cx: c.x, cy: c.y, r: 2.6, "class": "cm-dot" }, gD); } // 没有边界的（台湾、几个兵团城市）画点
        c.el.dataset.c = c.id;
        c.pin = el("circle", { cx: c.x, cy: c.y, r: 2, "class": "cm-pin" }, gD); c.pin.style.display = "none";
        c.lab = el("text", { x: c.x, y: c.y, "class": "cm-cl", dy: "-0.45em" }, gL); c.lab.textContent = c.zh.replace(/^(.+?)(?:[一-龥]{1,5}?族)+自治(州|县|旗)$/, "$1$2").replace(/(市|地区)$/, ""); // 黔东南苗族侗族自治州 → 黔东南州
      });
      M.prov.forEach(function (p) { p.lab = el("text", { x: p.cx, y: p.cy - 5, "class": "cm-l" }, gL); p.lab.textContent = p.short; });
      $("cm-box").insertBefore(svg, $("cm-box").firstChild);

      // ---- 状态：城市 = TRIPST 记录（没有就看默认足迹）+ 景点前缀（勾了这个城市任何一个景点）----
      function state() {
        var A = TRIPST.all ? TRIPST.all() : {}, S = {}, id, k;
        for (id in defBeen) S[id] = { been: true, at: 0, src: "默认" }; for (id in defWant) if (!S[id]) S[id] = { want: true, at: 0, src: "默认" };
        for (id in A) {
          var v = A[id].v || {};
          if (BY[id]) { S[id] = { been: !!v.been, pass: !!v.pass && !v.been, want: !!(v.want || v.plan), skip: !!v.skip, rate: v.rate || "", again: !!v.again, raw: v, at: A[id].at, src: "城市" }; continue; } // 计划也算想去（金色）
          var best = ""; for (k in M.alias || {}) if (id.indexOf(k) === 0 && M.alias[k] && k.length > best.length) best = k; // 最长的前缀：cq- 是渝中，cq-ciqikou 这种单独对到沙坪坝
          if (best && v.been) { var c = M.alias[best], o = S[c] || {}; if (!o.been || (A[id].at > (o.at || 0) && o.src !== "城市")) S[c] = { been: true, want: false, at: Math.max(A[id].at, o.at || 0), src: o.src === "城市" ? "城市" : "景点" }; }
        }
        return S;
      }
      var S = {};
      function base(id) { var r = TRIPST.get(id); if (r) return r; var s = S[id] || {}; return { been: !!s.been, want: !!s.want }; }
      function stOf(id) { var s = S[id] || {}; return s.been ? "been" : s.pass ? "pass" : s.want ? "want" : s.skip ? "skip" : ""; }
      function bar(b, t, w, n) { var f = function (x) { return (x / Math.max(n, 1) * 100).toFixed(1) + "%"; }; return '<span style="width:' + f(b) + ';background:' + COL.been + '"></span><span style="width:' + f(t) + ';background:' + COL.pass + '"></span><span style="width:' + f(w) + ';background:' + COL.want + '"></span>'; }
      function paint() {
        S = state();
        var nb = 0, nw = 0, nt = 0, np = 0;
        M.prov.forEach(function (p) { p.nb = p.nt = p.nw = 0; });
        M.cities.forEach(function (c) { var s = stOf(c.id), p = PV[c.p];
          c.el.setAttribute("class", (c.d ? "cm-cp" : "cm-dot") + (s ? " " + s : "") + (sel === c.id ? " sel" : ""));
          c.pin.style.display = s && s !== "skip" ? "" : "none"; c.pin.setAttribute("class", "cm-pin " + s);
          c.lab.setAttribute("class", "cm-cl" + (s === "been" ? " been" : "") + (foc === c.p || s === "been" ? " on" : ""));
          if (s === "been") { nb++; p.nb++; } else if (s === "pass") { nt++; p.nt++; } else if (s === "want") { nw++; p.nw++; } });
        M.prov.forEach(function (p) { if (p.nb) np++; p.el.setAttribute("class", "cm-pv" + (p.nb ? " been" : "") + (foc === p.slug ? " foc" : "")); p.ln.setAttribute("class", "cm-ln" + (foc === p.slug ? " foc" : "")); p.lab.setAttribute("class", "cm-l" + (p.nb ? " been" : "")); });
        gB.appendChild(PV[foc] ? PV[foc].ln : gB.lastChild); // 选中的省界画在最上面
        svg.classList.toggle("nol", !$("cm-lab").checked); svg.classList.toggle("nocl", !$("cm-cl").checked);
        var N = M.cities.length;
        $("cm-st").innerHTML = '<div class="cm-n g"><b>' + np + '<small>/ ' + M.prov.length + '</small></b><span>个省去过</span></div><div class="cm-n g"><b>' + nb + '<small>/ ' + N + '</small></b><span>个城市去过</span></div>' +
          (nt ? '<div class="cm-n t"><b>' + nt + '</b><span>个路过</span></div>' : "") + '<div class="cm-n y"><b>' + nw + '</b><span>个想去</span></div>';
        $("cm-pg").innerHTML = bar(nb, nt, nw, N);
        var R = Object.keys(S).filter(function (id) { return S[id].been && S[id].at && BY[id]; }).sort(function (a, b) { return S[b].at - S[a].at; }).slice(0, 10);
        $("cm-rec").innerHTML = R.length ? "🕘 最近标记：" + R.map(function (id) { var c = BY[id], d = new Date(S[id].at); return '<a data-c="' + id + '">' + esc(c.zh.replace(/市$/, "")) + ' <small>' + (d.getMonth() + 1) + "/" + d.getDate() + "</small></a>"; }).join("") :
          "还没有标记：点地图上的省份放大，再点城市就能标「去过」；省页、城市页、景点大全里勾的也会自动算进来 · 也可以直接告诉 Claude 去过哪";
        crumb(); if (sel || foc) panel();
      }
      function crumb() { $("cm-crumb").innerHTML = foc || vb[2] < M.w * 0.98 ? '<a data-z="0">⟲ 全国</a>' + (foc ? '<i>›</i><a data-zoom="' + foc + '">' + esc(PV[foc].zh) + "</a>" : "") : ""; }
      // ---- 卡片：选中城市 → 城市卡；只选了省 → 省卡（封面 + 进度 + 所有城市）----
      function panel() {
        var pn = $("cm-pn"), c = sel && BY[sel], p = c ? PV[c.p] : PV[foc]; if (!p) { pn.className = "cm-pn"; return; }
        var tp = TP[p.slug] || {};
        if (c) {
          var s = S[c.id] || {}, tc = TC[c.id] || {}, im = pic(tc, 120);
          pn.innerHTML = '<button type="button" class="cm-x" data-close="1" title="关闭" style="top:10px">✕</button><div class="cm-hd">' + (im ? '<img alt="" src="' + esc(im) + '">' : "") + "<div><b>" + esc(c.zh) + "</b><small>" + esc(p.zh) + (tc.n ? " · " + tc.n + " 个景点" : "") + "</small></div></div>" +
            '<div class="cm-pb"><div class="meta">' + (s.been ? "✅ 去过" + (s.rate ? " " + TRIPST.S.RATE[s.rate] : "") + (s.again ? " · 🔁 还想再去" : "") + (s.src === "景点" ? "（景点里勾过）" : s.src === "默认" ? "（默认足迹）" : "") : s.pass ? "🚶 路过" + (s.want ? " · ⭐ 想去" : "") : s.want ? "⭐ 想去" : s.skip ? "🚫 不想去" : "还没去") + "</div>" +
            '<div class="cm-acts">' + TRIPST.S.btns(base(c.id)) + "</div>" +
            '<div class="cm-acts">' + (c.go ? '<a class="pri" href="' + esc(cityHref(c)) + '" data-go="' + esc(c.go) + '">🏙 城市页 ›</a>' : "") + '<a href="' + esc(provHref(c.p)) + '" data-go="prov:' + esc(c.p) + '">' + esc(p.zh) + " ›</a>" + (foc !== c.p ? '<button type="button" data-zoom="' + esc(c.p) + '">🔍 放大这个省</button>' : '<button type="button" data-back="1">‹ 城市列表</button>') + "</div></div>";
        } else {
          var n = p.cs.length;
          pn.innerHTML = '<div class="cm-ph">' + (tp.img ? '<img alt="" src="' + esc(pic(tp, 500)) + '">' : "") + "<b>" + esc(p.zh) + '</b><button type="button" class="cm-x" data-close="1" title="关闭">✕</button></div>' +
            '<div class="cm-pb"><div class="meta">去过 <b>' + p.nb + "</b> / " + n + " 个城市" + (p.nt ? " · 路过 " + p.nt : "") + (p.nw ? " · 想去 " + p.nw : "") + '</div><div class="cm-bar">' + bar(p.nb, p.nt, p.nw, n) + "</div>" +
            '<div class="cm-cs">' + p.cs.map(function (x) { return '<a class="' + stOf(x.id) + '" data-c="' + x.id + '">' + (x.cap ? "★ " : "") + esc(x.zh.replace(/(市|地区)$/, "")) + "</a>"; }).join("") + "</div>" +
            '<div class="cm-acts" style="margin-top:12px"><a class="pri" href="' + esc(provHref(p.slug)) + '" data-go="prov:' + esc(p.slug) + '">打开省页 ›</a><button type="button" data-z="0">⟲ 全国</button></div></div>';
        }
        pn.className = "cm-pn on";
      }

      // ---- 缩放 / 拖动（改 viewBox，带动画）----
      var vb = [0, 0, M.w, M.h], anim = null;
      function clampVB(v) { var w = Math.max(M.w / 16, Math.min(M.w * 1.05, v[2])), h = w * M.h / M.w; return [Math.max(-M.w * 0.15, Math.min(M.w * 1.15 - w, v[0])), Math.max(-M.h * 0.15, Math.min(M.h * 1.15 - h, v[1])), w, h]; }
      function setVB(v) { vb = clampVB(v); svg.setAttribute("viewBox", vb.join(" ")); var k = M.w / vb[2];
        svg.style.setProperty("--fs", (15 / Math.pow(k, 0.85)).toFixed(3)); svg.style.setProperty("--fc", (11.5 / k).toFixed(3)); svg.classList.toggle("z2", k >= 2.2);
        var r = 2.6 / Math.sqrt(k), rp = 2.4 / Math.pow(k, 0.7); M.cities.forEach(function (c) { if (!c.d) c.el.setAttribute("r", r); c.pin.setAttribute("r", rp); c.pin.setAttribute("stroke-width", 5); }); }
      function animTo(v, ms) { v = clampVB(v); if (anim) cancelAnimationFrame(anim); var a = vb.slice(), t0 = performance.now(); ms = ms || 520;
        (function step(t) { var x = Math.min(1, (t - t0) / ms), e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; setVB([0, 1, 2].map(function (i) { return a[i] + (v[i] - a[i]) * e; })); if (x < 1) anim = requestAnimationFrame(step); else { anim = null; crumb(); } })(t0); }
      function zoomAt(f, cx, cy, animate) { if (!f) { foc = null; sel = null; paint(); return animTo([0, 0, M.w]); } var w = vb[2] / f, v = [cx - (cx - vb[0]) / f, cy - (cy - vb[1]) / f, w]; if (animate) animTo(v, 300); else setVB(v); crumb(); }
      function toSvg(ev) { var r = svg.getBoundingClientRect(); return [vb[0] + (ev.clientX - r.left) / r.width * vb[2], vb[1] + (ev.clientY - r.top) / r.height * vb[3]]; }
      function focus(slug) { var p = PV[slug]; if (!p) return; foc = slug; sel = null; var b = p.el.getBBox(), wide = window.innerWidth > 640 ? 1.5 : 1, pad = Math.max(b.width, b.height) * 0.18;
        var w = Math.max((b.width + pad * 2) * wide, (b.height + pad * 2) * M.w / M.h, M.w / 14); animTo([b.x + b.width / 2 - w / 2 + (wide > 1 ? w * 0.13 : 0), b.y + b.height / 2 - w * M.h / M.w / 2, w]); paint(); }
      svg.addEventListener("wheel", function (e) { e.preventDefault(); var p = toSvg(e); zoomAt(Math.pow(1.0018, -e.deltaY), p[0], p[1]); }, { passive: false });
      svg.addEventListener("dblclick", function (e) { e.preventDefault(); var p = toSvg(e); zoomAt(2, p[0], p[1], true); });
      var ptr = {}, drag = null, moved = 0;
      svg.addEventListener("pointerdown", function (e) { if (anim) { cancelAnimationFrame(anim); anim = null; } ptr[e.pointerId] = [e.clientX, e.clientY]; moved = 0; drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; svg.setPointerCapture(e.pointerId); });
      svg.addEventListener("pointermove", function (e) {
        var ids = Object.keys(ptr); if (ptr[e.pointerId]) { var old = ptr[e.pointerId]; ptr[e.pointerId] = [e.clientX, e.clientY];
          if (ids.length === 2) { var o = ids.map(function (i) { return i == e.pointerId ? old : ptr[i]; }), n = ids.map(function (i) { return ptr[i]; }); var d0 = Math.hypot(o[0][0] - o[1][0], o[0][1] - o[1][1]), d1 = Math.hypot(n[0][0] - n[1][0], n[0][1] - n[1][1]); if (d0 > 0) { var mid = toSvg({ clientX: (n[0][0] + n[1][0]) / 2, clientY: (n[0][1] + n[1][1]) / 2 }); zoomAt(d1 / d0, mid[0], mid[1]); } moved += 10; return; }
          if (drag) { var r = svg.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width * vb[2], dy = (e.clientY - drag.y) / r.height * vb[3]; moved = Math.max(moved, Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y)); if (moved > 4) { svg.classList.add("drag"); setVB([drag.vb[0] - dx, drag.vb[1] - dy, vb[2]]); } } }
        tip(e);
      });
      // 悬停提示：缩略图 + 名字 + 状态
      var tipKey = "";
      function tip(e) {
        var t = e.target, box = $("cm-tip"), key = "", h = "";
        if (e.pointerType !== "mouse" || svg.classList.contains("drag")) { box.style.display = "none"; return; }
        if (t.dataset && t.dataset.c) { var c = BY[t.dataset.c], s = S[c.id] || {}, tc = TC[c.id] || {}, im = pic(tc, 120); key = c.id;
          h = (im ? '<img alt="" src="' + esc(im) + '">' : "") + "<span><b>" + esc(c.zh) + "</b><small>" + esc(PV[c.p].zh) + " · " + (s.been ? "✅ 去过" : s.pass ? "🚶 路过" : s.want ? "⭐ 想去" : "还没去") + (tc.n ? " · " + tc.n + " 个景点" : "") + "</small></span>"; }
        else if (t.dataset && t.dataset.p) { var p = PV[t.dataset.p]; key = p.slug; h = "<span><b>" + esc(p.zh) + "</b><small>去过 " + p.nb + " / " + p.cs.length + " 个城市</small></span>"; }
        if (!key) { box.style.display = "none"; tipKey = ""; return; }
        if (key !== tipKey) { box.innerHTML = h; tipKey = key; }
        var br = $("cm-box").getBoundingClientRect(), x = e.clientX - br.left + 14, y = e.clientY - br.top + 12; box.style.display = "flex";
        if (x + box.offsetWidth > br.width - 6) x = e.clientX - br.left - box.offsetWidth - 12; box.style.left = x + "px"; box.style.top = Math.min(y, br.height - box.offsetHeight - 6) + "px";
      }
      function pick(id) { var c = BY[id]; if (!c) return; if (foc !== c.p) focus(c.p); sel = id; paint(); }
      function up(e) { delete ptr[e.pointerId]; svg.classList.remove("drag"); if (!Object.keys(ptr).length) {
          if (moved <= 4 && drag) { var t = document.elementFromPoint(e.clientX, e.clientY), k = M.w / vb[2];
            if (t && t.dataset && (t.dataset.c || t.dataset.p)) { var slug = t.dataset.c ? BY[t.dataset.c].p : t.dataset.p;
              if (k < 1.8 && foc !== slug) focus(slug); // 全国视图：先放大到这个省
              else if (t.dataset.c) { sel = t.dataset.c; if (foc !== slug) foc = slug; paint(); }
              else focus(slug); }
            else if (foc || sel) { sel = null; paint(); } }
          drag = null; } }
      svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up); svg.addEventListener("pointerleave", function () { $("cm-tip").style.display = "none"; tipKey = ""; });
      if (window.KEYS) KEYS.on("cnmap", { when: function () { return KEYS.visible(host) && !!(foc || sel); } }, function (k) { if (k !== "esc") return false; if (sel) { sel = null; paint(); } else zoomAt(0); return true; }); // Esc：先关城市卡，再回全国
      host.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("button,a"); if (!t) return;
        if (t.dataset.z != null) { var f = +t.dataset.z; if (!f) zoomAt(0); else zoomAt(f, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, true); return; }
        if (t.dataset.zoom) { focus(t.dataset.zoom); return; }
        if (t.dataset.back) { sel = null; paint(); return; }
        if (t.dataset.close) { sel = null; foc = null; $("cm-pn").className = "cm-pn"; paint(); return; }
        if (t.dataset.k && BY[sel]) { TRIPST.set(sel, TRIPST.S.toggle(base(sel), t.dataset.k)); return; }
        if (t.dataset.c && !t.dataset.k) { pick(t.dataset.c); return; }
        if (t.dataset.go) { e.preventDefault(); go(t.dataset.go, t.getAttribute("href")); }
        if (t.id === "cm-png") exportPng();
      });
      ["cm-lab", "cm-cl"].forEach(function (id) { $(id).addEventListener("change", paint); });
      setVB(vb);
      // ---- 导出图片：把全国地图画成 PNG 下载（样式内联进去）----
      function exportPng() {
        var cl = svg.cloneNode(true), W = M.w * 2, H = M.h * 2; cl.setAttribute("viewBox", "0 0 " + M.w + " " + M.h); cl.setAttribute("width", W); cl.setAttribute("height", H);
        cl.style.setProperty("--fs", "15"); cl.style.setProperty("--fc", "8"); cl.classList.remove("z2");
        var css = document.createElementNS(NS, "style"); css.textContent = ".cm-pv{fill:#242936}.cm-pv.been{fill:#22352f}.cm-ln{fill:none;stroke:#4a5166;stroke-width:.8}.cm-cp{fill-opacity:0;stroke:#fff;stroke-opacity:.06;stroke-width:.3}.cm-cp.been{fill:#2fbf71;fill-opacity:.85}.cm-cp.pass{fill:#1fa0a0;fill-opacity:.7}.cm-cp.want{fill:#ffc94d;fill-opacity:.5}.cm-cp.skip{fill-opacity:0}" +
          ".cm-halo{fill:#7c5cd6;opacity:.38}.cm-jd{fill:#6a7080;stroke:#6a7080;stroke-width:.6}.cm-in{fill:#151821;stroke:#3a4052}.cm-dot{fill:#9aa2b5;opacity:.5}.cm-dot.been{fill:#2fbf71;opacity:1}.cm-dot.want{fill:#ffc94d;opacity:1}.cm-dot.pass{fill:#1fa0a0;opacity:1}" +
          ".cm-pin{fill:#7ce3b8;stroke:rgba(124,227,184,.35)}.cm-pin.want{fill:#ffd36b;stroke:rgba(255,211,107,.3)}.cm-pin.pass{fill:#5fd6d6}.cm-l{font:800 15px sans-serif;fill:#aab1c2;text-anchor:middle;paint-order:stroke;stroke:#101217;stroke-width:3.3}.cm-l.been{fill:#fff}.cm-cl{display:none}" + (svg.classList.contains("nol") ? ".cm-l{display:none}" : "");
        cl.insertBefore(css, cl.firstChild); cl.querySelectorAll(".cm-dot").forEach(function (e) { e.setAttribute("r", 2.6); }); cl.querySelectorAll(".cm-pin").forEach(function (e) { e.setAttribute("r", 2.4); });
        var txt = new XMLSerializer().serializeToString(cl), img = new Image(), cv = document.createElement("canvas"); cv.width = W; cv.height = H + 150;
        img.onload = function () { var x = cv.getContext("2d"), g = x.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7); g.addColorStop(0, "#1b1f2b"); g.addColorStop(1, "#0e1015"); x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 150, W, H);
          x.fillStyle = "#fff"; x.font = "bold 46px sans-serif"; x.fillText("🗺 我的中国足迹", 44, 76); x.font = "26px sans-serif"; x.fillStyle = "#c8ccd6";
          x.fillText([].map.call($("cm-st").querySelectorAll(".cm-n"), function (n) { return n.textContent.replace(/\s+/g, ""); }).join(" · "), 44, 120);
          cv.toBlob(function (b) { URL.revokeObjectURL(su); if (!b) return shot(null, "图片生成失败"); shot(b); }, "image/png"); };
        img.onerror = function () { URL.revokeObjectURL(su); shot(null, "地图转成图片失败"); };
        var su = URL.createObjectURL(new Blob([txt], { type: "image/svg+xml;charset=utf-8" })); img.src = su; shot(null, "");
      }
      // 导出结果：弹一层预览（手机上长按图片就能存）+「下载」（全站共用的 U.download）+「分享 / 存到相册」（系统分享，手机上最好用）
      function shot(b, err) {
        var ov = $("cm-shot"); if (!ov) { ov = document.createElement("div"); ov.id = "cm-shot"; ov.className = "cm-shot"; $("cm-box").appendChild(ov); }
        if (!b) { ov.innerHTML = '<div class="cm-sh">' + (err ? "⚠️ " + esc(err) + '，再试一次？<div class="cm-acts" style="justify-content:center"><button type="button" data-shot="close">关闭</button></div>' : "📷 正在生成图片…") + "</div>"; ov.className = "cm-shot on"; return; }
        var u = URL.createObjectURL(b), f = null; try { f = new File([b], "我的中国足迹.png", { type: "image/png" }); } catch (e) {}
        var share = f && navigator.canShare && navigator.canShare({ files: [f] });
        ov.innerHTML = '<div class="cm-sh"><img alt="我的中国足迹" src="' + u + '"><div class="cm-sht">手机上长按图片也能保存</div><div class="cm-acts" style="justify-content:center">' +
          (share ? '<button type="button" class="pri" data-shot="share">📤 分享 / 存到相册</button>' : "") + '<button type="button"' + (share ? "" : ' class="pri"') + ' data-shot="dl">💾 下载</button><button type="button" data-shot="close">关闭</button></div></div>';
        ov.className = "cm-shot on";
        ov.onclick = function (e) { var t = e.target.closest && e.target.closest("[data-shot]"); if (!t && e.target !== ov) return; var k = t ? t.dataset.shot : "close";
          if (k === "share") navigator.share({ files: [f], title: "我的中国足迹" }).catch(function () {});
          else if (k === "dl") { var UU = window.U || (function () { try { return parent.U; } catch (er) { return null; } })(); // 全站共用的 U.download（在网站里是外面页面的）
            if (UU && UU.download) UU.download("我的中国足迹.png", b, "png"); else window.open(u, "_blank"); }
          else { ov.className = "cm-shot"; URL.revokeObjectURL(u); } };
      }
      // ---- 📂 全国目录：地区 → 省（封面照片卡）→ 城市（全部平铺），颜色跟地图一样；点照片进省页，点城市进城市页 ----
      var q = "";
      function cityGo(c, p) { return c.go || "prov:" + p.slug; }  // 还没有城市页的 → 省页
      function cHref(c, p) { var g = cityGo(c, p); return /^city:/.test(g) ? "cn-city.html?c=" + g.slice(5) : g === "hzsights" ? "hz-sights.html" : g === "cqsights" ? "cq-sights.html" : provHref(p.slug); }
      function cw(x, w) { return x.th ? "https://upload.wikimedia.org/wikipedia/commons/thumb/" + x.th + "/" + w + "px-" + x.th.split("/").pop() : "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(x.img) + "?width=" + w; }
      function tree() {
        var body = $("ct-body"); if (!body) return; var regs = [], byR = {}, ql = q.toLowerCase(), all = 0, nb = 0, np = 0, nw = 0;
        TREE.forEach(function (p) { if (!byR[p.region]) { byR[p.region] = []; regs.push(p.region); } byR[p.region].push(p);
          p.cities.forEach(function (c) { var s = S[c.id] || {}; all++; if (s.been) nb++; else if (s.pass) np++; else if (s.want || s.plan) nw++; }); });
        var dc = 0, pd = 0, wipN = 0, wipL = []; TREE.forEach(function (p) { var k = p.cities.filter(function (c) { return c.d; }).length; dc += k; if (k === p.cities.length) pd++; else if (p.wip) { wipL.push(p.zh.replace(/(壮族|回族|维吾尔)?(自治区|特别行政区|省|市)$/, "")); wipN += p.cities.length - k; } });
        $("ct-dp").innerHTML = '<h4>📝 城市详细版进度 <b>' + Math.round(dc / all * 100) + '%</b><small>' + dc + ' / ' + all + ' 个城市 · ' + pd + ' / ' + TREE.length + ' 个省级做完</small></h4>' +
          '<div class="ct-dpb"><span style="width:' + (dc / all * 100).toFixed(1) + '%"></span><span style="width:' + (wipN / all * 100).toFixed(1) + '%"></span></div>' +
          '<p>城市右上角 <b style="color:#c59bef">✓</b> = 手写详细版（交通、门票、开放时间、照片都整理过）；没有 ✓ 的是维基数据自动版' + (wipL.length ? '　·　<em>整理中：' + wipL.map(esc).join("、") + '</em>（黄条）' : "") + '</p>';
        $("ct-sum").innerHTML = '<span>' + TREE.length + ' 个省级 · ' + all + ' 个城市</span><span><i style="background:#2fbf71"></i>去过 ' + nb + '</span><span><i style="background:#1fa0a0"></i>路过 ' + np + '</span><span><i style="background:#ffc94d"></i>想去 ' + nw + '</span><span style="opacity:.8">点大图进省页 · 点城市进城市页</span>';
        body.innerHTML = regs.map(function (r) {
          var cards = byR[r].map(function (p) {
            var hitP = !ql || p.zh.indexOf(q) >= 0 || p.slug.indexOf(ql) >= 0;
            var cs = hitP ? p.cities : p.cities.filter(function (c) { return c.zh.indexOf(q) >= 0 || c.slug.indexOf(ql) >= 0; }); if (!cs.length) return "";
            var b = 0, ps = 0, w = 0, n = p.cities.length; p.cities.forEach(function (c) { var s = S[c.id] || {}; if (s.been) b++; else if (s.pass) ps++; else if (s.want || s.plan) w++; });
            var pct = function (x) { return (x / n * 100).toFixed(1) + "%"; };
            return '<div class="ct-k' + (b ? " been" : "") + '"><a class="ct-ph" href="' + provHref(p.slug) + '" data-go="prov:' + p.slug + '" title="打开' + esc(p.zh) + '省页">' +
              (p.img ? '<img alt="" data-src="' + esc(cw(p, 500)) + '">' : "") + (p.cover ? '<span class="ct-cv">📷 ' + esc(p.cover) + "</span>" : "") +
              (function () { var k = p.cities.filter(function (c) { return c.d; }).length; return k === n ? '<span class="ct-dt ok">✓ 详细版</span>' : p.wip ? '<span class="ct-dt wip">🛠 整理中' + (k ? " " + k + "/" + n : "") + "</span>" : k ? '<span class="ct-dt">详细版 ' + k + "/" + n + "</span>" : '<span class="ct-dt no">自动版</span>'; })() +
              '<span class="ct-nm">' + esc(p.zh) + "<i>" + esc(p.short) + '</i></span><span class="ct-pr">' + (b ? "去过 <b>" + b + "</b> / " + n : n + " 个城市") + " ›</span>" +
              '<span class="ct-bar"><span style="width:' + pct(b) + ';background:#2fbf71"></span><span style="width:' + pct(ps) + ';background:#1fa0a0"></span><span style="width:' + pct(w) + ';background:#ffc94d"></span></span></a>' +
              '<div class="ct-cs">' + cs.map(function (c) { var s = S[c.id] || {};
                var st = s.been ? "去过" : s.pass ? "路过" : s.want || s.plan ? "想去" : "";
                return '<a class="ct-c' + (c.d ? " dt" : "") + (s.been ? " been" : s.pass ? " pass" : s.want || s.plan ? " want" : s.skip ? " skip" : "") + (c.zh === p.cap ? " cap" : "") + '" href="' + esc(cHref(c, p)) + '" data-go="' + esc(cityGo(c, p)) + '" title="' + esc(c.zh) + '">' +
                  (c.img ? '<img alt="" data-src="' + esc(cw(c, 120)) + '">' : '<i class="ni">🏙</i>') + "<span><b>" + (c.zh === p.cap ? "★ " : "") + esc(c.zh.replace(/(市|地区)$/, "")) + "</b><small>" +
                  [st, c.zh === p.cap ? "省会" : "", c.n ? c.n + " 个景点" : (c.go && !/^city:/.test(c.go) ? "景点大全" : "")].filter(Boolean).join(" · ") + "</small></span></a>"; }).join("") + "</div></div>";
          }).join("");
          return cards ? '<div class="ct-rh">' + r + "<small>" + byR[r].length + " 个</small></div><div class=\"ct-g\">" + cards + "</div>" : "";
        }).join("") || '<div class="ct-none">没有符合的城市</div>';
        lazy(body);
      }
      // 图片：滚到附近才加载，同时最多 6 张，失败的隔几秒重试（维基共享资源一下子请求太多会限流）；加载过的直接用
      var DONE = {}, QUE = [], busy = 0, io = window.IntersectionObserver ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); QUE.push(e.target); pump(); } }); }, { rootMargin: "300px" }) : null;
      function pump() {
        while (busy < 6 && QUE.length) { (function (im) { var u = im.getAttribute("data-src"), n = +(im.getAttribute("data-try") || 0); if (!im.isConnected) return; busy++;
          im.onload = function () { busy--; DONE[u] = 1; pump(); };
          im.onerror = function () { busy--; if (n < 3) { im.setAttribute("data-try", n + 1); im.removeAttribute("src"); setTimeout(function () { QUE.push(im); pump(); }, 2500 * (n + 1)); } else if (im.closest(".ct-c")) { var ni = document.createElement("i"); ni.className = "ni"; ni.textContent = "🏙"; im.replaceWith(ni); } else im.remove(); pump(); };
          im.src = u; })(QUE.shift()); }
      }
      function lazy(root) { root.querySelectorAll("img[data-src]").forEach(function (im) { var u = im.getAttribute("data-src"); if (DONE[u] || !io) im.src = u; else io.observe(im); }); }
      $("ct-q").addEventListener("input", function (e) { q = e.target.value.trim(); tree(); });
      if (tw !== host) tw.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest("a[data-go]"); if (t) { e.preventDefault(); go(t.dataset.go, t.getAttribute("href")); } });
      function paintAll() { paint(); tree(); }
      paintAll(); TRIPST.on(paintAll); TRIPST.sync();
    }).catch(function (e) { host.innerHTML = '<div class="cm" style="padding:14px;color:var(--soft)">地图没加载出来（' + esc(e) + '）</div>'; });
  }
  window.CNMAP = { init: init };
})();
