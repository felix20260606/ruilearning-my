/* 🗺 旅游页共用的「去过 / 想去」记录（window.TRIPST）：导航页（马来西亚那几张卡片的去过）、吉隆坡 / 重庆 / 杭州景点大全都用这一套，改一处别处跟着变
   在网站里（旅游中心的 iframe）：用外面页面的 U（本机存储按家人分开）和 CLOUD.chan("trip")（存到后台 /api/mine?k=trip，换设备也在）
   单独打开（不在网站里）：只存这台设备的 localStorage
   TRIPST.get(id) → 记录的值 {been, want, plan, skip, again, rate} 或 null（没改过，用页面上写的默认）
   TRIPST.set(id, v) 改一条（本机马上存、1.5 秒后同步到后台），然后通知 on() 登记的函数
   TRIPST.on(fn)  有改动（自己改的、从后台拉到的）就调用 fn
   TRIPST.all() → {id: {v, at}} 全部改过的记录（中国地图统计去过几个省 / 城、最近标记）
   TRIPST.sync() → Promise<"ok" | "local" | "fail">：拉后台的记录合并（同一条以改动时间新的为准），本机更新的补发上去；一个页面只拉一次
   id 的写法：景点大全 = 景点 id（lm-… / cu-… / na-… / dt-…）；导航页马来西亚卡片：马六甲 / 云顶 / 瓜雪和景点大全共用 dt-melaka / dt-genting / dt-kselangor，兰卡威 / 槟城 / 新加坡是 foot:langkawi / foot:penang / foot:sg（名字沿用以前「我的足迹」页的） */
(function () {
  "use strict";
  if (window.TRIPST) return;
  var P = null;
  try { if (window.parent && window.parent !== window && window.parent.U && window.parent.CLOUD) P = window.parent; } catch (e) {}
  if (!P && window.U && window.CLOUD) P = window;
  var KEY = "trip:state", C = P ? P.CLOUD.chan("trip") : null, FN = [], synced = null;
  function LG() { try { return (P ? P.U.LG(KEY, {}) : JSON.parse(localStorage.getItem(KEY) || "{}")) || {}; } catch (e) { return {}; } }
  function LS(v) { try { if (P) P.U.LS(KEY, v); else localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  var ST = LG();
  function fire() { FN.forEach(function (f) { try { f(); } catch (e) {} }); }
  function get(id) { var s = ST[id]; return s && s.v ? s.v : null; }
  function set(id, v) { var at = Date.now(); ST[id] = { v: v, at: at }; LS(ST); if (C) C.put(id, v, at); fire(); }
  function on(f) { FN.push(f); }
  function sync() {
    if (!C) return Promise.resolve("local");
    if (synced) return synced;
    synced = C.get(0).then(function (items) {
      var up = {}, n = 0, id;
      for (id in items) { var r = items[id], l = ST[id]; if (!l || +r.at > +l.at) { if (r.del) delete ST[id]; else ST[id] = { v: r.v, at: r.at }; } }
      for (id in ST) { var c = items[id]; if (!c || +ST[id].at > +c.at) { up[id] = { v: ST[id].v, at: ST[id].at }; n++; } }
      LS(ST); if (n) C.send(up); fire(); return "ok";
    }).catch(function () { synced = null; return "fail"; });
    return synced;
  }
  // 别的页面（另一个 iframe）改了：本机存储变了就重新读
  window.addEventListener("storage", function () { ST = LG(); fire(); });
  function all() { var o = {}, id; for (id in ST) if (ST[id] && ST[id].v) o[id] = { v: ST[id].v, at: ST[id].at }; return o; } // 全部记录（中国地图用：统计、最近标记）

  /* ---- 状态（景点大全、省页、城市页、足迹地图共用一套）----
     记录的值 v：{been 去过, pass 路过（中转 / 经过，没好好玩）, want 想去, plan 已排进计划, skip 不想去, again 还想再去, rate "love"|"ok"|"bad" 去过后的评价}
     规则：去过 → 取消路过 / 想去 / 计划 / 不想去；路过 → 取消去过 / 不想去（还能同时想去 / 计划，下次专门去）；不想去 → 取消想去 / 计划 / 路过；评价和「再去」只有去过才有；「还没去」= 没去过、没路过、也没标不想去
     S.toggle(v, k) → 新的 v（k = been / pass / want / plan / skip / again / love / ok / bad）
     S.btns(v) → 卡片上的按钮 html（每个按钮 data-k="…"，页面点了就 TRIPST.set(id, S.toggle(旧的, k))）
     S.mark(v) → 照片角上的小标记 html；S.cls(v) → 卡片的 class（been / pass / want / plan / skip / love）
     S.chips(列表, 取v, 取warn, 当前) → 状态筛选按钮 html（带数量，data-st="…"）；S.match(v, 筛选, warn) → 这张卡要不要显示
     S.css() → 往页面加一次按钮 / 标记的样式 */
  var RATE = { love: "❤️ 喜欢", ok: "👌 一般", bad: "👎 不推荐" };
  function norm(v) { v = v || {}; return { been: !!v.been, pass: !!v.pass && !v.been, want: !!v.want, plan: !!v.plan, skip: !!v.skip, again: !!v.again, rate: RATE[v.rate] ? v.rate : "" }; }
  function toggle(v0, k) {
    var v = norm(v0);
    if (RATE[k]) { if (v.been) v.rate = v.rate === k ? "" : k; return v; }
    if (k === "again") { if (v.been) v.again = !v.again; return v; }
    v[k] = !v[k];
    if (k === "been") { if (v.been) { v.want = v.plan = v.skip = v.pass = false; } else { v.rate = ""; v.again = false; } }
    if (k === "pass" && v.pass) { v.been = v.skip = false; v.rate = ""; v.again = false; }
    if ((k === "want" || k === "plan") && v[k]) v.skip = false;
    if (k === "skip" && v.skip) v.want = v.plan = v.pass = false;
    return v;
  }
  function btn(k, on, txt, cls) { return '<button type="button" class="bt ts-' + cls + (on ? " on" : "") + '" data-k="' + k + '">' + txt + "</button>"; }
  function btns(v0) {
    var v = norm(v0), h = btn("been", v.been, v.been ? "✅ 已去过" : "☐ 去过", "b");
    if (v.been) return h + btn("love", v.rate === "love", "❤️", "r") + btn("ok", v.rate === "ok", "👌", "r") + btn("bad", v.rate === "bad", "👎", "r") + btn("again", v.again, v.again ? "🔁 还想再去" : "🔁 再去", "a");
    return h + btn("pass", v.pass, v.pass ? "🚶 路过" : "🚶 路过", "t") + btn("want", v.want, v.want ? "⭐ 想去" : "☆ 想去", "w") + btn("plan", v.plan, v.plan ? "📅 已排进计划" : "📅 计划", "p") + btn("skip", v.skip, v.skip ? "🚫 不想去" : "🚫", "s");
  }
  function mark(v0) {
    var v = norm(v0), t = v.been ? "✅ 去过" + (v.rate ? " · " + RATE[v.rate].split(" ")[0] : "") + (v.again ? " · 🔁" : "") : v.pass ? "🚶 路过" + (v.plan ? " · 📅" : v.want ? " · ⭐" : "") : v.plan ? "📅 计划" : v.want ? "⭐ 想去" : v.skip ? "🚫 不想去" : "";
    return t ? '<span class="ts-mk ' + cls(v) + '">' + t + "</span>" : "";
  }
  function cls(v0) { var v = norm(v0); return v.been ? "been" + (v.rate === "love" ? " love" : "") : v.pass ? "pass" : v.plan ? "plan" : v.want ? "want" : v.skip ? "skip" : ""; }
  var FIL = [["", "全部", function () { return true; }], ["left", "还没去", function (v) { return !v.been && !v.skip && !v.pass; }], ["want", "⭐ 想去", function (v) { return v.want; }], ["plan", "📅 计划", function (v) { return v.plan; }],
    ["been", "✅ 去过", function (v) { return v.been; }], ["pass", "🚶 路过", function (v) { return v.pass; }], ["love", "❤️ 喜欢", function (v) { return v.been && v.rate === "love"; }], ["again", "🔁 再去", function (v) { return v.been && v.again; }],
    ["skip", "🚫 不想去", function (v) { return v.skip; }], ["closed", "⚠️ 暂时去不了", function (v, w) { return !!w; }]];
  function match(v0, f, warn) { for (var i = 0; i < FIL.length; i++) if (FIL[i][0] === (f || "")) return FIL[i][2](norm(v0), warn); return true; }
  function chips(list, getV, getWarn, cur) {
    return FIL.map(function (F) {
      var n = list.filter(function (x) { return F[2](norm(getV(x)), getWarn ? getWarn(x) : ""); }).length;
      if (F[0] && !n && F[0] !== "left" && cur !== F[0]) return ""; // 没有的状态不显示（「还没去」一直显示）
      return '<button type="button" class="chip' + ((cur || "") === F[0] ? " on" : "") + '" data-st="' + F[0] + '">' + F[1] + (F[0] ? " " + n : "") + "</button>";
    }).join("");
  }
  // 分段进度条：绿 = 去过、青 = 路过、金 = 想去 / 计划、灰 = 不想去；S.bar(列表, 取v) → 进度条 + 一行数字（页面放在顶上和吸顶的筛选栏里）
  function bar(list, getV) {
    var n = list.length || 1, c = { b: 0, t: 0, w: 0, s: 0 };
    list.forEach(function (x) { var v = norm(getV(x)); if (v.been) c.b++; else if (v.pass) c.t++; else if (v.want || v.plan) c.w++; else if (v.skip) c.s++; });
    var seg = function (k, col) { return c[k] ? '<i style="width:' + (c[k] * 100 / n) + "%;background:" + col + '"></i>' : ""; };
    var left = list.length - c.b - c.t - c.s;
    return '<div class="ts-bar">' + seg("b", "#2fbf71") + seg("t", "#1fa0a0") + seg("w", "#ffc94d") + seg("s", "#6b707c") + "</div>" +
      '<div class="ts-bl"><b>' + Math.round(c.b * 100 / n) + "%</b> 去过 " + c.b + "/" + list.length + (c.t ? " · 🚶 路过 " + c.t : "") + (c.w ? " · ⭐ 想去 " + c.w : "") + (c.s ? " · 🚫 " + c.s : "") + " · 还没去 " + left + "</div>";
  }
  var cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true; var s = document.createElement("style");
    s.textContent = ".bt.ts-b.on{background:#1f7a55;border-color:#1f7a55;color:#fff}.bt.ts-w.on{background:#b98410;border-color:#b98410;color:#fff}.bt.ts-p.on{background:#2f6fd0;border-color:#2f6fd0;color:#fff}.bt.ts-s.on{background:#5b5f6a;border-color:#5b5f6a;color:#fff}.bt.ts-t.on{background:#1f8a8a;border-color:#1f8a8a;color:#fff}" +
      ".bt.ts-r{padding-left:9px;padding-right:9px}.bt.ts-r.on{background:rgba(255,120,150,.22);border-color:#ff7896}.bt.ts-a.on{background:#6b3fb0;border-color:#6b3fb0;color:#fff}" +
      ".ts-mk{position:absolute;left:8px;bottom:8px;font-size:12px;font-weight:800;line-height:1.5;padding:2px 10px;border-radius:999px;color:#fff;background:#1f7a55}.ts-mk.want{background:#b98410}.ts-mk.plan{background:#2f6fd0}.ts-mk.skip{background:#5b5f6a}.ts-mk.pass{background:#1f8a8a}.ts-mk.love{background:#c2416a}" +
      ".ts-bar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:rgba(127,127,127,.22)}.ts-bar i{display:block;height:100%;transition:width .3s}.ts-bl{font-size:12px;opacity:.85;margin-top:4px}.ts-bl b{font-size:13px}" +
      ".ts-sticky{flex:1 1 100%}.ts-sticky .ts-bar{height:6px}.ts-sticky .ts-bl{margin-top:3px;font-size:11.5px;color:var(--soft)}" +
      ".card.plan{border-color:rgba(47,111,208,.6)}.card.pass{border-color:rgba(31,138,138,.7)}.card.skip{opacity:.55}.card.skip:hover{opacity:1}.card.love{border-color:rgba(255,120,150,.6)}";
    document.head.appendChild(s);
  }
  var S = { norm: norm, toggle: toggle, btns: btns, mark: mark, cls: cls, chips: chips, match: match, bar: bar, css: css, RATE: RATE };
  window.TRIPST = { get: get, set: set, on: on, sync: sync, all: all, S: S, cloud: !!C };
})();
