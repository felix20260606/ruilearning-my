/* 🗺 旅游页共用的「去过 / 想去」记录（window.TRIPST）：导航页（马来西亚那几张卡片的去过）、吉隆坡 / 重庆 / 杭州景点大全都用这一套，改一处别处跟着变
   在网站里（旅游中心的 iframe）：用外面页面的 U（本机存储按家人分开）和 CLOUD.chan("trip")（存到后台 /api/mine?k=trip，换设备也在）
   单独打开（不在网站里）：只存这台设备的 localStorage
   TRIPST.get(id) → 记录的值 {been, want} 或 null（没改过，用页面上写的默认）
   TRIPST.set(id, {been, want}) 改一条（本机马上存、1.5 秒后同步到后台），然后通知 on() 登记的函数
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
  window.TRIPST = { get: get, set: set, on: on, sync: sync, all: all, cloud: !!C };
})();
