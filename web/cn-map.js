/* 🗺 中国足迹地图（window.CNMAP）：旅游中心「🇨🇳 中国」最上面那张，trip-nav.html?r=cn 时自动画
   数据：cn/map.json（省界 SVG 路径 + 496 个城市点，tools/cn-data/make_map.py 生成）+ cn/visited.json（默认足迹：用户告诉 Claude 去过哪，写在这里）
   状态：trip-state.js（TRIPST）——省页 / 城市页勾的「去过 / 想去」（id = cn-<维基数据编号>），景点大全里勾了某个城市的任何景点也算去过这个城市（map.json 的 alias：hz- → 杭州 …）
   省：有去过的城市 = 绿；只有想去 = 金；都没有 = 灰。点省 / 点城市弹出小卡片：改去过 / 想去、打开省页 / 城市页
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
    ".cm-p{fill:#2b2f38;stroke:#5a6070;stroke-width:.7;vector-effect:non-scaling-stroke}.cm-p:hover{stroke:#c59bef;stroke-width:1.6}.cm-p.been{fill:rgba(47,191,113,.62)}.cm-p.want{fill:rgba(255,201,77,.42)}.cm-p.sel{stroke:#c59bef;stroke-width:2.2}" +
    ".cm-jd{fill:#7a8090;stroke:#7a8090;stroke-width:.6;vector-effect:non-scaling-stroke}.cm-in{fill:none;stroke:#4a5060;stroke-width:1;vector-effect:non-scaling-stroke}" +
    ".cm-c{fill:#8b93a7;opacity:.5;cursor:pointer}.cm-c.been{fill:#7ce3b8;opacity:1}.cm-c.want{fill:#ffc94d;opacity:1}.cm-c.cap{opacity:.8}.cm-c.sel{stroke:#fff;stroke-width:1.5;vector-effect:non-scaling-stroke}" +
    ".cm-l{font-family:sans-serif;font-weight:700;fill:#c8ccd6;pointer-events:none;text-anchor:middle;paint-order:stroke;stroke:#14161b}.cm-l.been{fill:#fff}" +
    ".cm-ctl{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:5px}.cm-ctl button{width:32px;height:32px;border-radius:9px;border:1px solid #3a3f4a;background:rgba(20,22,27,.85);color:#fff;font:700 16px sans-serif;cursor:pointer}" +
    ".cm-tip{position:absolute;pointer-events:none;background:rgba(20,22,27,.92);color:#fff;border:1px solid #3a3f4a;border-radius:8px;padding:3px 8px;font-size:12px;white-space:nowrap;display:none}" +
    ".cm-lg{position:absolute;left:8px;bottom:8px;display:flex;gap:8px;font-size:11px;color:#c8ccd6;background:rgba(20,22,27,.7);border-radius:8px;padding:3px 8px}.cm-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:3px;vertical-align:-1px}" +
    ".cm-pn{padding:10px 14px;border-top:1px solid var(--line);display:none}.cm-pn.on{display:block}.cm-pn b{font-size:15px}.cm-pn small{color:var(--soft);font-size:12.5px;margin-left:6px}" +
    ".cm-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cm-acts button,.cm-acts a{font:inherit;font-size:12.5px;font-weight:800;border-radius:999px;padding:4px 12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;text-decoration:none}" +
    ".cm-acts .on-b{background:#1f7a55;border-color:#1f7a55;color:#fff}.cm-acts .on-w{background:#b98410;border-color:#b98410;color:#fff}.cm-acts .pri{background:var(--ui-pur,#8b5cf6);border-color:var(--ui-pur,#8b5cf6);color:#fff}" +
    ".cm-bot{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:8px 14px 12px;border-top:1px solid var(--line);font-size:12.5px;color:var(--soft)}.cm-bot label{cursor:pointer}.cm-bot button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:999px;padding:3px 11px;cursor:pointer}" +
    ".cm-rec{padding:0 14px 12px;font-size:12.5px;color:var(--soft)}.cm-rec a{color:var(--ink);text-decoration:none;cursor:pointer;margin-right:10px;white-space:nowrap}.cm-rec a:hover{color:#c59bef}";

  function init(host) {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    host.innerHTML = '<div class="cm"><div class="cm-top"><h2>🗺 我的中国足迹</h2><div class="cm-st" id="cm-st"></div></div>' +
      '<div class="cm-box" id="cm-box"><div class="cm-ctl"><button type="button" data-z="1.5" title="放大">＋</button><button type="button" data-z="0.667" title="缩小">－</button><button type="button" data-z="0" title="回到全国">⟲</button></div>' +
      '<div class="cm-tip" id="cm-tip"></div><div class="cm-lg"><span><i style="background:rgba(47,191,113,.8)"></i>去过</span><span><i style="background:rgba(255,201,77,.7)"></i>想去</span><span><i style="background:#2b2f38;border:1px solid #5a6070"></i>还没去</span></div></div>' +
      '<div class="cm-pn" id="cm-pn"></div>' +
      '<div class="cm-bot"><label><input type="checkbox" id="cm-dots" checked> 城市点</label><label><input type="checkbox" id="cm-only"> 只看去过的城市</label><label><input type="checkbox" id="cm-lab" checked> 省名</label><span style="margin-left:auto"></span><button type="button" id="cm-png">📷 导出图片</button></div>' +
      '<div class="cm-rec" id="cm-rec"></div></div>';
    var $ = function (id) { return document.getElementById(id); };
    Promise.all([fetch("cn/map.json").then(function (r) { return r.json(); }), fetch("cn/visited.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })]).then(function (res) {
      var M = res[0], DEF = res[1] || {}, BY = {}, PV = {}, sel = null;
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
          if (BY[id]) { S[id] = { been: !!v.been, want: !!v.want, at: A[id].at, src: "城市" }; continue; }
          for (k in M.alias || {}) if (id.indexOf(k) === 0 && M.alias[k] && v.been) { var c = M.alias[k], o = S[c] || {}; if (!o.been || (A[id].at > (o.at || 0) && o.src !== "城市")) S[c] = { been: true, want: false, at: Math.max(A[id].at, o.at || 0), src: o.src === "城市" ? "城市" : "景点" }; }
        }
        return S;
      }
      var S = {};
      function paint() {
        S = state();
        var only = $("cm-only").checked, dots = $("cm-dots").checked, nb = 0, nw = 0, pb = {}, pw = {};
        M.cities.forEach(function (c) { var s = S[c.id] || {}; c.el.setAttribute("class", "cm-c" + (c.cap ? " cap" : "") + (s.been ? " been" : s.want ? " want" : "") + (sel === c.id ? " sel" : ""));
          c.el.style.display = !dots || (only && !s.been) ? "none" : ""; if (s.been) { nb++; pb[c.p] = (pb[c.p] || 0) + 1; } else if (s.want) { nw++; pw[c.p] = 1; } });
        var np = 0; M.prov.forEach(function (p) { var b = pb[p.slug]; if (b) np++; p.el.setAttribute("class", "cm-p" + (b ? " been" : pw[p.slug] ? " want" : "") + (sel === p.slug ? " sel" : "")); p.lab.setAttribute("class", "cm-l" + (b ? " been" : "")); p.lab.style.display = $("cm-lab").checked ? "" : "none"; p.nb = b || 0; });
        $("cm-st").innerHTML = '<span><b>' + np + '</b>/ 34 个省</span><span><b>' + nb + '</b>个城市去过</span><span><b>' + nw + '</b>个想去</span>';
        var R = Object.keys(S).filter(function (id) { return S[id].been && S[id].at; }).sort(function (a, b) { return S[b].at - S[a].at; }).slice(0, 10);
        $("cm-rec").innerHTML = R.length ? "🕘 最近标记：" + R.map(function (id) { var c = BY[id], d = new Date(S[id].at); return '<a data-c="' + id + '">' + esc(c.zh.replace(/市$/, "")) + ' <small>' + (d.getMonth() + 1) + "/" + d.getDate() + "</small></a>"; }).join("") :
          "还没有标记：点地图上的城市点就能标「去过」，省页、城市页、景点大全里勾的也会自动出现在这里 · 也可以直接告诉 Claude 去过哪";
        if (sel) panel(sel);
      }
      function panel(key) {
        var pn = $("cm-pn"), c = BY[key], p = c ? PV[c.p] : PV[key]; if (!p) { pn.className = "cm-pn"; return; }
        if (c) {
          var s = S[c.id] || {};
          pn.innerHTML = "<b>" + esc(c.zh) + "</b><small>" + esc(p.zh) + (s.been ? " · ✅ 去过" + (s.src === "景点" ? "（景点大全里勾过）" : s.src === "默认" ? "（默认足迹）" : "") : s.want ? " · ⭐ 想去" : "") + "</small>" +
            '<div class="cm-acts"><button type="button" data-k="been" class="' + (s.been ? "on-b" : "") + '">' + (s.been ? "✅ 已去过" : "☐ 去过") + '</button><button type="button" data-k="want" class="' + (s.want ? "on-w" : "") + '">' + (s.want ? "⭐ 想去" : "☆ 想去") + "</button>" +
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
        if (t.dataset.k && BY[sel]) { var s = S[sel] || {}, v = { been: !!s.been, want: !!s.want }; v[t.dataset.k] = !v[t.dataset.k]; if (t.dataset.k === "been" && v.been) v.want = false; TRIPST.set(sel, v); return; }
        if (t.dataset.c && !t.dataset.k) { sel = t.dataset.c; var c = BY[sel]; zoomProv(c.p); paint(); return; }
        if (t.dataset.go) { e.preventDefault(); go(t.dataset.go, t.getAttribute("href")); }
        if (t.id === "cm-png") exportPng();
      });
      ["cm-dots", "cm-only", "cm-lab"].forEach(function (id) { $(id).addEventListener("change", paint); });
      // ---- 导出图片：把当前地图（全国）画成 PNG 下载 ----
      function exportPng() {
        var cl = svg.cloneNode(true); cl.setAttribute("viewBox", "0 0 " + M.w + " " + M.h); cl.setAttribute("width", M.w * 2); cl.setAttribute("height", M.h * 2 + 120);
        var css = document.createElementNS(NS, "style"); css.textContent = ".cm-p{fill:#2b2f38;stroke:#5a6070;stroke-width:.7}.cm-p.been{fill:rgba(47,191,113,.75)}.cm-p.want{fill:rgba(255,201,77,.5)}.cm-jd{fill:#7a8090;stroke:#7a8090}.cm-in{fill:none;stroke:#4a5060}.cm-c{fill:#8b93a7;opacity:.45}.cm-c.been{fill:#7ce3b8;opacity:1}.cm-c.want{fill:#ffc94d;opacity:1}.cm-l{font-family:sans-serif;font-weight:700;fill:#c8ccd6;text-anchor:middle;paint-order:stroke;stroke:#14161b}.cm-l.been{fill:#fff}";
        cl.insertBefore(css, cl.firstChild); cl.querySelectorAll("circle").forEach(function (e) { e.setAttribute("r", e.classList.contains("cap") ? 3.4 : 2.4); }); cl.querySelectorAll("text").forEach(function (t) { t.setAttribute("font-size", 15); t.setAttribute("stroke-width", 3.5); });
        var txt = new XMLSerializer().serializeToString(cl), img = new Image(), cv = document.createElement("canvas"); cv.width = M.w * 2; cv.height = M.h * 2 + 120;
        img.onload = function () { var x = cv.getContext("2d"); x.fillStyle = "#14161b"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 120, M.w * 2, M.h * 2);
          x.fillStyle = "#fff"; x.font = "bold 44px sans-serif"; x.fillText("🗺 我的中国足迹", 40, 70); x.font = "26px sans-serif"; x.fillStyle = "#c8ccd6"; x.fillText($("cm-st").textContent.replace(/\s+/g, " "), 40, 108);
          var UU = window.U || (function () { try { return parent.U; } catch (e) { return null; } })(); // 存文件用全站共用的 U.download（在网站里是外面页面的）
          cv.toBlob(function (b) { if (UU && UU.download) UU.download("我的中国足迹.png", b, "png"); else window.open(URL.createObjectURL(b), "_blank"); }, "image/png"); };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt);
      }
      paint(); TRIPST.on(paint); TRIPST.sync();
    }).catch(function (e) { host.innerHTML = '<div class="cm" style="padding:14px;color:var(--soft)">地图没加载出来（' + esc(e) + '）</div>'; });
  }
  window.CNMAP = { init: init };
})();
