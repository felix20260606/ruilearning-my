/* 🗺 中国足迹地图（window.CNMAP）：旅游中心「🇨🇳 中国」最上面那张，trip-nav.html?r=cn 时自动画
   数据：cn/map.json（省界 SVG 路径 + 496 个城市点，tools/cn-data/make_map.py 生成）+ cn/visited.json（默认足迹：用户告诉 Claude 去过哪，写在这里）
   状态：trip-state.js（TRIPST）——省页 / 城市页勾的「去过 / 想去 / 计划（算想去）/ 不想去（不上色）/ 评价 / 再去」（id = cn-<维基数据编号>），景点大全里勾了某个城市的任何景点也算去过这个城市（map.json 的 alias：hz- → 杭州 …）
   省：有去过的城市 = 绿；只有路过 = 青；只有想去 = 金；都没有 = 灰。点省 / 点城市弹出小卡片：改去过 / 想去、打开省页 / 城市页
   操作：拖动、滚轮 / 双指缩放、＋ − ⟲；只看去过；城市点开关；最近标记；导出图片（PNG） */
(function () {
  "use strict";
  if (window.CNMAP) return;
  var NS = "http://www.w3.org/2000/svg";
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function go(g, href) { if (window.parent && window.parent !== window) { try { parent.postMessage({ tripGo: g }, "*"); } catch (e) {} } else location.href = href; }
  function provHref(s) { return "cn-prov.html?p=" + s; }
  function cityHref(c) { return /^city:/.test(c.go) ? "cn-city.html?c=" + c.go.slice(5) : c.go === "hzsights" ? "hz-sights.html" : c.go === "cqsights" ? "cq-sights.html" : provHref(c.p); }
  var CSS = ".cm{background:var(--paper);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:4px 0 18px}" +
    ".cm-top{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:12px 14px 8px}.cm-top h2{font-size:16px;font-weight:900;margin-right:auto}" +
    ".cm-st{display:flex;flex-wrap:wrap;gap:6px}.cm-st span{font-size:12px;color:var(--soft);background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:3px 10px}.cm-st b{color:var(--ink);font-size:14px;margin-right:2px}" +
    ".cm-box{position:relative;background:#14161b;touch-action:none;user-select:none;-webkit-user-select:none}.cm-box svg{display:block;width:100%;height:auto;max-height:70vh;cursor:grab}.cm-box svg.drag{cursor:grabbing}" +
    ".cm-p{fill:#2b2f38;stroke:#5a6070;stroke-width:.7;vector-effect:non-scaling-stroke}.cm-p:hover{stroke:#c59bef;stroke-width:1.6}.cm-p.been{fill:rgba(47,191,113,.62)}.cm-p.pass{fill:rgba(31,160,160,.45)}.cm-p.want{fill:rgba(255,201,77,.42)}.cm-p.sel{stroke:#c59bef;stroke-width:2.2}" +
    ".cm-jd{fill:#7a8090;stroke:#7a8090;stroke-width:.6;vector-effect:non-scaling-stroke}.cm-in{fill:none;stroke:#4a5060;stroke-width:1;vector-effect:non-scaling-stroke}" +
    ".cm-c{fill:#8b93a7;opacity:.5;cursor:pointer}.cm-c.been{fill:#7ce3b8;opacity:1}.cm-c.want{fill:#ffc94d;opacity:1}.cm-c.pass{fill:#5fd6d6;opacity:1}.cm-c.cap{opacity:.8}.cm-c.sel{stroke:#fff;stroke-width:1.5;vector-effect:non-scaling-stroke}" +
    ".cm-l{font-family:sans-serif;font-weight:700;fill:#c8ccd6;pointer-events:none;text-anchor:middle;paint-order:stroke;stroke:#14161b}.cm-l.been{fill:#fff}" +
    ".cm-ctl{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:5px}.cm-ctl button{width:32px;height:32px;border-radius:9px;border:1px solid #3a3f4a;background:rgba(20,22,27,.85);color:#fff;font:700 16px sans-serif;cursor:pointer}" +
    ".cm-tip{position:absolute;pointer-events:none;background:rgba(20,22,27,.92);color:#fff;border:1px solid #3a3f4a;border-radius:8px;padding:3px 8px;font-size:12px;white-space:nowrap;display:none}" +
    ".cm-lg{position:absolute;left:8px;bottom:8px;display:flex;gap:8px;font-size:11px;color:#c8ccd6;background:rgba(20,22,27,.7);border-radius:8px;padding:3px 8px}.cm-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:3px;vertical-align:-1px}" +
    ".cm-pn{padding:10px 14px;border-top:1px solid var(--line);display:none}.cm-pn.on{display:block}.cm-pn b{font-size:15px}.cm-pn small{color:var(--soft);font-size:12.5px;margin-left:6px}" +
    ".cm-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cm-acts button,.cm-acts a{font:inherit;font-size:12.5px;font-weight:800;border-radius:999px;padding:4px 12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;text-decoration:none}" +
    ".cm-acts .on-b{background:#1f7a55;border-color:#1f7a55;color:#fff}.cm-acts .on-w{background:#b98410;border-color:#b98410;color:#fff}.cm-acts .pri{background:var(--ui-pur,#8b5cf6);border-color:var(--ui-pur,#8b5cf6);color:#fff}" +
    ".cm-bot{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:8px 14px 12px;border-top:1px solid var(--line);font-size:12.5px;color:var(--soft)}.cm-bot label{cursor:pointer}.cm-bot button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:3px 11px;cursor:pointer}" +
".ct-h{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:22px 2px 4px}.ct-h h2{font-family:var(--display);font-size:16px;font-weight:900;margin:0 auto 0 0;letter-spacing:.02em}" +
    ".ct-q{font:inherit;font-size:13.5px;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:7px 14px;min-width:0;flex:0 1 220px;outline:none}.ct-q:focus{border-color:rgba(197,155,239,.6)}" +
    ".ct-sum{font-size:12.5px;color:var(--soft);margin:0 2px 2px;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center}.ct-sum i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}" +
    ".ct-rh{display:flex;align-items:baseline;gap:8px;margin:20px 2px 10px;font-family:var(--display);font-weight:900;font-size:14px;color:var(--ink)}.ct-rh:before{content:\"\";width:4px;height:15px;border-radius:2px;background:#c59bef;align-self:center}.ct-rh small{font-family:inherit;font-weight:700;font-size:12px;color:var(--soft)}" +
    ".ct-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}" +
    ".ct-k{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:border-color .15s,box-shadow .15s}.ct-k:hover{border-color:rgba(197,155,239,.45);box-shadow:0 6px 22px rgba(0,0,0,.28)}.ct-k.been{border-color:rgba(47,191,113,.5)}" +
    ".ct-ph{position:relative;display:block;height:124px;overflow:hidden;background:#20232b;text-decoration:none;color:#fff}.ct-ph img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}.ct-k:hover .ct-ph img{transform:scale(1.05)}" +
    ".ct-ph:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.78))}" +
    ".ct-nm{position:absolute;left:13px;bottom:11px;z-index:1;display:flex;align-items:center;gap:7px;font-size:18px;font-weight:900;text-shadow:0 1px 8px rgba(0,0,0,.6)}.ct-nm i{font-style:normal;font-size:11px;font-weight:800;border:1px solid rgba(255,255,255,.55);border-radius:6px;padding:0 5px;text-shadow:none}" +
    ".ct-pr{position:absolute;right:12px;bottom:12px;z-index:1;font-size:12px;font-weight:800;text-shadow:0 1px 6px rgba(0,0,0,.6)}.ct-pr b{color:#7ce3b8}.ct-cv{position:absolute;right:9px;top:8px;z-index:1;font-size:10.5px;background:rgba(0,0,0,.45);border-radius:999px;padding:2px 8px;opacity:.85}" +
    ".ct-bar{position:absolute;left:0;right:0;bottom:0;height:3px;z-index:1;background:rgba(255,255,255,.12);display:flex}.ct-bar span{display:block;height:100%}" +
    ".ct-cs{display:flex;flex-wrap:wrap;gap:6px;padding:11px 12px 13px}" +
    ".ct-c{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:700;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--ink);background:var(--bg);text-decoration:none;transition:border-color .12s}.ct-c:hover{border-color:#c59bef}.ct-c small{font-size:10.5px;font-weight:600;color:var(--soft)}.ct-c.cap{border-color:rgba(197,155,239,.5)}" +
    ".ct-c.been{background:rgba(47,191,113,.22);border-color:rgba(47,191,113,.7)}.ct-c.pass{background:rgba(31,160,160,.2);border-color:rgba(31,160,160,.7)}.ct-c.want{background:rgba(255,201,77,.17);border-color:rgba(255,201,77,.7)}.ct-c.skip{opacity:.45}.ct-none{color:var(--soft);font-size:13px;padding:14px 2px}" +
    "@media(max-width:520px){.ct-g{grid-template-columns:1fr}.ct-ph{height:112px}.ct-q{flex:1 1 100%}}" +
    ".cm-rec{padding:0 14px 12px;font-size:12.5px;color:var(--soft)}.cm-rec a{color:var(--ink);text-decoration:none;cursor:pointer;margin-right:10px;white-space:nowrap}.cm-rec a:hover{color:#c59bef}";

  function init(host) {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); if (TRIPST.S) TRIPST.S.css();
    host.innerHTML = '<div class="cm"><div class="cm-top"><h2>🗺 我的中国足迹</h2><div class="cm-st" id="cm-st"></div></div>' +
      '<div class="cm-box" id="cm-box"><div class="cm-ctl"><button type="button" data-z="1.5" title="放大">＋</button><button type="button" data-z="0.667" title="缩小">－</button><button type="button" data-z="0" title="回到全国">⟲</button></div>' +
      '<div class="cm-tip" id="cm-tip"></div><div class="cm-lg"><span><i style="background:rgba(47,191,113,.8)"></i>去过</span><span><i style="background:rgba(31,160,160,.7)"></i>路过</span><span><i style="background:rgba(255,201,77,.7)"></i>想去</span><span><i style="background:#2b2f38;border:1px solid #5a6070"></i>还没去</span></div></div>' +
      '<div class="cm-pn" id="cm-pn"></div>' +
      '<div class="cm-bot"><label><input type="checkbox" id="cm-dots" checked> 城市点</label><label><input type="checkbox" id="cm-only"> 只看去过 / 路过的城市</label><label><input type="checkbox" id="cm-lab" checked> 省名</label><span style="margin-left:auto"></span><button type="button" id="cm-png">📷 导出图片</button></div>' +
      '<div class="cm-rec" id="cm-rec"></div></div>';
    // 📂 全国目录（省卡片 + 下面所有城市）：页面里有 #cntree 就放那里，没有就接在地图下面
    var tw = document.getElementById("cntree"); if (!tw) { tw = document.createElement("div"); host.appendChild(tw); }
    tw.innerHTML = '<div class="ct-h"><h2>🗺 全国 34 个省级行政区 · 所有城市</h2><input class="ct-q" id="ct-q" type="search" placeholder="🔍 搜城市 / 省…" autocomplete="off"></div>' +
      '<div class="ct-sum" id="ct-sum"></div><div id="ct-body"></div>';
    var $ = function (id) { return document.getElementById(id); };
    Promise.all([fetch("cn/map.json").then(function (r) { return r.json(); }), fetch("cn/visited.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }), fetch("cn/index.json").then(function (r) { return r.json(); }).catch(function () { return []; })]).then(function (res) {
      var M = res[0], DEF = res[1] || {}, TREE = res[2] || [], BY = {}, PV = {}, sel = null;
      var defBeen = {}, defWant = {};
      (DEF.been || []).forEach(function (id) { defBeen[id] = 1; }); (DEF.want || []).forEach(function (id) { defWant[id] = 1; });
      M.cities.forEach(function (c) { BY[c.id] = c; });
      M.prov.forEach(function (p) { PV[p.slug] = p; });
      var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 " + M.w + " " + M.h);
      var gP = document.createElementNS(NS, "g"), gC = document.createElementNS(NS, "g"), gL = document.createElementNS(NS, "g");
      M.prov.forEach(function (p) { var e = document.createElementNS(NS, "path"); e.setAttribute("d", p.d); e.setAttribute("class", "cm-p"); e.dataset.p = p.slug; p.el = e; gP.appendChild(e); });
      var jd = document.createElementNS(NS, "path"); jd.setAttribute("d", M.jd); jd.setAttribute("class", "cm-jd"); gP.appendChild(jd);
      var ins = document.createElementNS(NS, "rect"); ins.setAttribute("x", M.inset[0]); ins.setAttribute("y", M.inset[1]); ins.setAttribute("width", M.inset[2]); ins.setAttribute("height", M.inset[3]); ins.setAttribute("class", "cm-in"); gP.appendChild(ins);
      M.cities.forEach(function (c) { var e = document.createElementNS(NS, "circle"); e.setAttribute("cx", c.x); e.setAttribute("cy", c.y); e.setAttribute("r", c.cap ? 3.4 : 2.4); e.setAttribute("class", "cm-c" + (c.cap ? " cap" : "")); e.dataset.c = c.id; c.el = e; gC.appendChild(e); });
      M.prov.forEach(function (p) { var t = document.createElementNS(NS, "text"); t.setAttribute("x", p.cx); t.setAttribute("y", p.cy - 5); t.setAttribute("class", "cm-l"); t.setAttribute("font-size", 15); t.setAttribute("stroke-width", 3.5); t.textContent = p.short; p.lab = t; gL.appendChild(t); });
      svg.appendChild(gP); svg.appendChild(gC); svg.appendChild(gL); $("cm-box").insertBefore(svg, $("cm-box").firstChild);

      // ---- 状态：城市 = TRIPST 记录（没有就看默认足迹）+ 景点前缀（勾了这个城市任何一个景点）----
      function state() {
        var A = TRIPST.all ? TRIPST.all() : {}, S = {}, id, k;
        for (id in defBeen) S[id] = { been: true, at: 0, src: "默认" }; for (id in defWant) if (!S[id]) S[id] = { want: true, at: 0, src: "默认" };
        for (id in A) {
          var v = A[id].v || {};
          if (BY[id]) { S[id] = { been: !!v.been, pass: !!v.pass && !v.been, want: !!(v.want || v.plan), skip: !!v.skip, rate: v.rate || "", again: !!v.again, raw: v, at: A[id].at, src: "城市" }; continue; } // 计划也算想去（金色）；不想去不上色
          for (k in M.alias || {}) if (id.indexOf(k) === 0 && M.alias[k] && v.been) { var c = M.alias[k], o = S[c] || {}; if (!o.been || (A[id].at > (o.at || 0) && o.src !== "城市")) S[c] = { been: true, want: false, at: Math.max(A[id].at, o.at || 0), src: o.src === "城市" ? "城市" : "景点" }; }
        }
        return S;
      }
      var S = {};
      function base(id) { var r = TRIPST.get(id); if (r) return r; var s = S[id] || {}; return { been: !!s.been, want: !!s.want }; } // 这个城市现在的记录（没点过就用默认足迹 / 景点算出来的）
      function paint() {
        S = state();
        var only = $("cm-only").checked, dots = $("cm-dots").checked, nb = 0, nw = 0, nt = 0, pb = {}, pw = {}, pt = {};
        M.cities.forEach(function (c) { var s = S[c.id] || {}; c.el.setAttribute("class", "cm-c" + (c.cap ? " cap" : "") + (s.been ? " been" : s.pass ? " pass" : s.want ? " want" : "") + (sel === c.id ? " sel" : ""));
          c.el.style.display = !dots || (only && !s.been && !s.pass) ? "none" : ""; if (s.been) { nb++; pb[c.p] = (pb[c.p] || 0) + 1; } else if (s.pass) { nt++; pt[c.p] = 1; if (s.want) { nw++; pw[c.p] = 1; } } else if (s.want) { nw++; pw[c.p] = 1; } });
        var np = 0; M.prov.forEach(function (p) { var b = pb[p.slug]; if (b) np++; p.el.setAttribute("class", "cm-p" + (b ? " been" : pt[p.slug] ? " pass" : pw[p.slug] ? " want" : "") + (sel === p.slug ? " sel" : "")); p.lab.setAttribute("class", "cm-l" + (b ? " been" : "")); p.lab.style.display = $("cm-lab").checked ? "" : "none"; p.nb = b || 0; });
        $("cm-st").innerHTML = '<span><b>' + np + '</b>/ 34 个省</span><span><b>' + nb + '</b>个城市去过</span>' + (nt ? '<span><b>' + nt + '</b>个路过</span>' : '') + '<span><b>' + nw + '</b>个想去</span>';
        var R = Object.keys(S).filter(function (id) { return S[id].been && S[id].at; }).sort(function (a, b) { return S[b].at - S[a].at; }).slice(0, 10);
        $("cm-rec").innerHTML = R.length ? "🕘 最近标记：" + R.map(function (id) { var c = BY[id], d = new Date(S[id].at); return '<a data-c="' + id + '">' + esc(c.zh.replace(/市$/, "")) + ' <small>' + (d.getMonth() + 1) + "/" + d.getDate() + "</small></a>"; }).join("") :
          "还没有标记：点地图上的城市点就能标「去过」，省页、城市页、景点大全里勾的也会自动出现在这里 · 也可以直接告诉 Claude 去过哪";
        if (sel) panel(sel);
      }
      function panel(key) {
        var pn = $("cm-pn"), c = BY[key], p = c ? PV[c.p] : PV[key]; if (!p) { pn.className = "cm-pn"; return; }
        if (c) {
          var s = S[c.id] || {};
          pn.innerHTML = "<b>" + esc(c.zh) + "</b><small>" + esc(p.zh) + (s.been ? " · ✅ 去过" + (s.rate ? " " + TRIPST.S.RATE[s.rate] : "") + (s.again ? " · 🔁 还想再去" : "") + (s.src === "景点" ? "（景点大全里勾过）" : s.src === "默认" ? "（默认足迹）" : "") : s.pass ? " · 🚶 路过" + (s.want ? " · ⭐ 想去" : "") : s.want ? " · ⭐ 想去" : s.skip ? " · 🚫 不想去" : "") + "</small>" +
            '<div class="cm-acts">' + TRIPST.S.btns(base(c.id)) +
            (c.go ? '<a class="pri" href="' + esc(cityHref(c)) + '" data-go="' + esc(c.go) + '">🏙 城市页 ›</a>' : "") + '<a href="' + esc(provHref(c.p)) + '" data-go="prov:' + esc(c.p) + '">' + esc(p.zh) + ' ›</a><button type="button" data-zoom="' + esc(c.p) + '">🔍 放大这个省</button></div>';
        } else {
          var n = M.cities.filter(function (x) { return x.p === p.slug; }).length;
          pn.innerHTML = "<b>" + esc(p.zh) + "</b><small>去过 " + (p.nb || 0) + " / " + n + " 个城市</small>" +
            '<div class="cm-acts"><a class="pri" href="' + esc(provHref(p.slug)) + '" data-go="prov:' + esc(p.slug) + '">打开省页 ›</a><button type="button" data-zoom="' + esc(p.slug) + '">🔍 放大</button><button type="button" data-close="1">关闭</button></div>';
        }
        pn.className = "cm-pn on"; pn.dataset.key = key;
      }
      // ---- 缩放 / 拖动（改 viewBox）----
      var vb = [0, 0, M.w, M.h];
      function setVB(v) { var w = Math.max(M.w / 12, Math.min(M.w, v[2])), h = w * M.h / M.w; vb = [Math.max(-M.w * 0.1, Math.min(M.w * 1.1 - w, v[0])), Math.max(-M.h * 0.1, Math.min(M.h * 1.1 - h, v[1])), w, h]; svg.setAttribute("viewBox", vb.join(" ")); var k = M.w / w; gC.querySelectorAll("circle").forEach(function (e) { e.setAttribute("r", (e.classList.contains("cap") ? 3.4 : 2.4) / Math.sqrt(k)); }); gL.querySelectorAll("text").forEach(function (t) { t.setAttribute("font-size", 15 / k); t.setAttribute("stroke-width", 3.5 / k); }); } // 放大后字和点在屏幕上保持差不多大
      function zoomAt(f, cx, cy) { if (!f) return setVB([0, 0, M.w, M.h]); var w = vb[2] / f; setVB([cx - (cx - vb[0]) / f, cy - (cy - vb[1]) / f, w, w * M.h / M.w]); }
      function toSvg(ev) { var r = svg.getBoundingClientRect(); return [vb[0] + (ev.clientX - r.left) / r.width * vb[2], vb[1] + (ev.clientY - r.top) / r.height * vb[3]]; }
      function zoomProv(slug) { var b = PV[slug].el.getBBox(), pad = Math.max(b.width, b.height) * 0.25, w = Math.max(b.width + pad * 2, (b.height + pad * 2) * M.w / M.h); setVB([b.x + b.width / 2 - w / 2, b.y + b.height / 2 - w * M.h / M.w / 2, w]); }
      svg.addEventListener("wheel", function (e) { e.preventDefault(); var p = toSvg(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p[0], p[1]); }, { passive: false });
      var ptr = {}, drag = null, moved = 0;
      svg.addEventListener("pointerdown", function (e) { ptr[e.pointerId] = [e.clientX, e.clientY]; moved = 0; drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; svg.setPointerCapture(e.pointerId); svg.classList.add("drag"); });
      svg.addEventListener("pointermove", function (e) {
        var ids = Object.keys(ptr); if (ptr[e.pointerId]) { var old = ptr[e.pointerId]; ptr[e.pointerId] = [e.clientX, e.clientY];
          if (ids.length === 2) { var o = ids.map(function (i) { return i == e.pointerId ? old : ptr[i]; }), n = ids.map(function (i) { return ptr[i]; }); var d0 = Math.hypot(o[0][0] - o[1][0], o[0][1] - o[1][1]), d1 = Math.hypot(n[0][0] - n[1][0], n[0][1] - n[1][1]); if (d0 > 0) { var mid = toSvg({ clientX: (n[0][0] + n[1][0]) / 2, clientY: (n[0][1] + n[1][1]) / 2 }); zoomAt(d1 / d0, mid[0], mid[1]); } moved += 10; return; }
          if (drag) { var r = svg.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width * vb[2], dy = (e.clientY - drag.y) / r.height * vb[3]; moved = Math.max(moved, Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y)); if (moved > 4) setVB([drag.vb[0] - dx, drag.vb[1] - dy, vb[2]]); } }
        // 提示
        var t = e.target, tip = $("cm-tip"), txt = "";
        if (t.dataset && t.dataset.c) { var c = BY[t.dataset.c], s = S[c.id] || {}; txt = c.zh + (s.been ? " ✅" : s.want ? " ⭐" : ""); } else if (t.dataset && t.dataset.p) { var p = PV[t.dataset.p]; txt = p.zh + " · 去过 " + (p.nb || 0) + " 城"; }
        if (txt && e.pointerType === "mouse") { var br = $("cm-box").getBoundingClientRect(); tip.textContent = txt; tip.style.display = "block"; tip.style.left = (e.clientX - br.left + 12) + "px"; tip.style.top = (e.clientY - br.top + 10) + "px"; } else tip.style.display = "none";
      });
      function up(e) { delete ptr[e.pointerId]; svg.classList.remove("drag"); if (!Object.keys(ptr).length) {
          if (moved <= 4 && drag) { var t = document.elementFromPoint(e.clientX, e.clientY); if (t && t.dataset && t.dataset.c) { sel = t.dataset.c; paint(); } else if (t && t.dataset && t.dataset.p) { sel = t.dataset.p; paint(); } }
          drag = null; } }
      svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up); svg.addEventListener("pointerleave", function () { $("cm-tip").style.display = "none"; });
      host.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("button,a"); if (!t) return;
        if (t.dataset.z != null) { var f = +t.dataset.z; zoomAt(f, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2); return; }
        if (t.dataset.zoom) { zoomProv(t.dataset.zoom); return; }
        if (t.dataset.close) { sel = null; $("cm-pn").className = "cm-pn"; paint(); return; }
        if (t.dataset.k && BY[sel]) { TRIPST.set(sel, TRIPST.S.toggle(base(sel), t.dataset.k)); return; }
        if (t.dataset.c && !t.dataset.k) { sel = t.dataset.c; var c = BY[sel]; zoomProv(c.p); paint(); return; }
        if (t.dataset.go) { e.preventDefault(); go(t.dataset.go, t.getAttribute("href")); }
        if (t.id === "cm-png") exportPng();
      });
      ["cm-dots", "cm-only", "cm-lab"].forEach(function (id) { $(id).addEventListener("change", paint); });
      // ---- 导出图片：把当前地图（全国）画成 PNG 下载 ----
      function exportPng() {
        var cl = svg.cloneNode(true); cl.setAttribute("viewBox", "0 0 " + M.w + " " + M.h); cl.setAttribute("width", M.w * 2); cl.setAttribute("height", M.h * 2 + 120);
        var css = document.createElementNS(NS, "style"); css.textContent = ".cm-p{fill:#2b2f38;stroke:#5a6070;stroke-width:.7}.cm-p.been{fill:rgba(47,191,113,.75)}.cm-p.pass{fill:rgba(31,160,160,.5)}.cm-p.want{fill:rgba(255,201,77,.5)}.cm-jd{fill:#7a8090;stroke:#7a8090}.cm-in{fill:none;stroke:#4a5060}.cm-c{fill:#8b93a7;opacity:.45}.cm-c.been{fill:#7ce3b8;opacity:1}.cm-c.want{fill:#ffc94d;opacity:1}.cm-c.pass{fill:#5fd6d6;opacity:1}.cm-l{font-family:sans-serif;font-weight:700;fill:#c8ccd6;text-anchor:middle;paint-order:stroke;stroke:#14161b}.cm-l.been{fill:#fff}";
        cl.insertBefore(css, cl.firstChild); cl.querySelectorAll("circle").forEach(function (e) { e.setAttribute("r", e.classList.contains("cap") ? 3.4 : 2.4); }); cl.querySelectorAll("text").forEach(function (t) { t.setAttribute("font-size", 15); t.setAttribute("stroke-width", 3.5); });
        var txt = new XMLSerializer().serializeToString(cl), img = new Image(), cv = document.createElement("canvas"); cv.width = M.w * 2; cv.height = M.h * 2 + 120;
        img.onload = function () { var x = cv.getContext("2d"); x.fillStyle = "#14161b"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 120, M.w * 2, M.h * 2);
          x.fillStyle = "#fff"; x.font = "bold 44px sans-serif"; x.fillText("🗺 我的中国足迹", 40, 70); x.font = "26px sans-serif"; x.fillStyle = "#c8ccd6"; x.fillText($("cm-st").textContent.replace(/\s+/g, " "), 40, 108);
          var UU = window.U || (function () { try { return parent.U; } catch (e) { return null; } })(); // 存文件用全站共用的 U.download（在网站里是外面页面的）
          cv.toBlob(function (b) { if (UU && UU.download) UU.download("我的中国足迹.png", b, "png"); else window.open(URL.createObjectURL(b), "_blank"); }, "image/png"); };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt);
      }
      // ---- 📂 全国目录：地区 → 省（封面照片卡）→ 城市（全部平铺），颜色跟地图一样；点照片进省页，点城市进城市页 ----
      var q = "";
      function cityGo(c, p) { return c.go || "prov:" + p.slug; }  // 还没有城市页的 → 省页
      function cHref(c, p) { var g = cityGo(c, p); return /^city:/.test(g) ? "cn-city.html?c=" + g.slice(5) : g === "hzsights" ? "hz-sights.html" : g === "cqsights" ? "cq-sights.html" : provHref(p.slug); }
      function img(f) { return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f) + "?width=560"; }
      function tree() {
        var body = $("ct-body"); if (!body) return; var regs = [], byR = {}, ql = q.toLowerCase(), all = 0, nb = 0, np = 0, nw = 0;
        TREE.forEach(function (p) { if (!byR[p.region]) { byR[p.region] = []; regs.push(p.region); } byR[p.region].push(p);
          p.cities.forEach(function (c) { var s = S[c.id] || {}; all++; if (s.been) nb++; else if (s.pass) np++; else if (s.want || s.plan) nw++; }); });
        $("ct-sum").innerHTML = '<span>' + TREE.length + ' 个省级 · ' + all + ' 个城市</span><span><i style="background:#2fbf71"></i>去过 ' + nb + '</span><span><i style="background:#1fa0a0"></i>路过 ' + np + '</span><span><i style="background:#ffc94d"></i>想去 ' + nw + '</span><span style="opacity:.8">点照片进省页 · 点城市进城市页（小数字 = 景点数）</span>';
        body.innerHTML = regs.map(function (r) {
          var cards = byR[r].map(function (p) {
            var hitP = !ql || p.zh.indexOf(q) >= 0 || p.slug.indexOf(ql) >= 0;
            var cs = hitP ? p.cities : p.cities.filter(function (c) { return c.zh.indexOf(q) >= 0 || c.slug.indexOf(ql) >= 0; }); if (!cs.length) return "";
            var b = 0, ps = 0, w = 0, n = p.cities.length; p.cities.forEach(function (c) { var s = S[c.id] || {}; if (s.been) b++; else if (s.pass) ps++; else if (s.want || s.plan) w++; });
            var pct = function (x) { return (x / n * 100).toFixed(1) + "%"; };
            return '<div class="ct-k' + (b ? " been" : "") + '"><a class="ct-ph" href="' + provHref(p.slug) + '" data-go="prov:' + p.slug + '" title="打开' + esc(p.zh) + '省页">' +
              (p.img ? '<img loading="lazy" alt="" src="' + esc(img(p.img)) + '">' : "") + (p.cover ? '<span class="ct-cv">📷 ' + esc(p.cover) + "</span>" : "") +
              '<span class="ct-nm">' + esc(p.zh) + "<i>" + esc(p.short) + '</i></span><span class="ct-pr">' + (b ? "去过 <b>" + b + "</b> / " + n : n + " 个城市") + " ›</span>" +
              '<span class="ct-bar"><span style="width:' + pct(b) + ';background:#2fbf71"></span><span style="width:' + pct(ps) + ';background:#1fa0a0"></span><span style="width:' + pct(w) + ';background:#ffc94d"></span></span></a>' +
              '<div class="ct-cs">' + cs.map(function (c) { var s = S[c.id] || {};
                return '<a class="ct-c' + (s.been ? " been" : s.pass ? " pass" : s.want || s.plan ? " want" : s.skip ? " skip" : "") + (c.zh === p.cap ? " cap" : "") + '" href="' + esc(cHref(c, p)) + '" data-go="' + esc(cityGo(c, p)) + '"' + (c.zh === p.cap ? ' title="省会"' : "") + ">" +
                  (c.zh === p.cap ? "★ " : "") + esc(c.zh.replace(/(市|地区)$/, "")) + (c.n ? "<small>" + c.n + "</small>" : "") + "</a>"; }).join("") + "</div></div>";
          }).join("");
          return cards ? '<div class="ct-rh">' + r + "<small>" + byR[r].length + " 个</small></div><div class=\"ct-g\">" + cards + "</div>" : "";
        }).join("") || '<div class="ct-none">没有符合的城市</div>';
      }
      $("ct-q").addEventListener("input", function (e) { q = e.target.value.trim(); tree(); });
      if (tw !== host) tw.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest("a[data-go]"); if (t) { e.preventDefault(); go(t.dataset.go, t.getAttribute("href")); } });
      function paintAll() { paint(); tree(); }
      paintAll(); TRIPST.on(paintAll); TRIPST.sync();
    }).catch(function (e) { host.innerHTML = '<div class="cm" style="padding:14px;color:var(--soft)">地图没加载出来（' + esc(e) + '）</div>'; });
  }
  window.CNMAP = { init: init };
})();
