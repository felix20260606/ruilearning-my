/* ☁️ 全站共用的「换设备同步」（window.CLOUD）：错题本、每日、口语、听力、考试……各自的记录都存到后台 /api/mine?k=<名字>（按家人分开）
   以前每个页面各写一遍「排队 → 1.5 秒后一起发 → 失败放回去 → 关页面用 sendBeacon 发完 → 拉下来合并」，现在都用这一套：
   const C = CLOUD.chan("err")
   C.put(id, 值, at)   记一条改动（at = 改动时间，默认现在；后台同一 id 以 at 新的为准），1.5 秒内的改动合成一次发
   C.del(id, at)       删一条（留删除记号，别的设备拉到会删掉）
   C.send({id: {v, at} | {del:1, at}, …}) 一批改动马上发
   C.flush()           马上发
   C.get(maxAge) → Promise<后台的 items>：只读不合并（几个地方同时要只请求一次，maxAge 毫秒内读过的直接给，默认 5 秒）；读不到 reject（不是空的 {}）
   插件同步（单词标记、收藏的词和句子、设置、练习统计）用 CLOUD.chan("ext")：发到 /api/ext（格式 {changes}，没有 k），读用 C.get()
   C.pull({force, every}) → Promise<后台的 items | null>：every 毫秒内（默认 60 秒）只拉一次，force 不管；拉不到给 null
   失败怎么办：断网、后台出错（5xx）、太频繁（429）→ 放回队列，越等越久再发（最多 5 分钟）（同一 id 有更新的改动就不放回）；其它（4xx，发了也不会成功）丢掉并记日志
   关页面 / 切到后台（pagehide）：还没发的用 sendBeacon 发出去
   CLOUD.media(k) → Promise<记录 | null>：卡片配图、原声、口语录音存档（/api/media?k=），同一条只请求一次
   出错都记进 U.log("cloud", …) */
(function () {
  "use strict";
  if (window.CLOUD) return;
  const log = (m, d) => { if (window.U) U.log("cloud", m, d); };
  const CH = {};
  function chan(k, opt) {
    if (CH[k]) return CH[k];
    opt = opt || {}; const delay = opt.delay || 1500, ext = k === "ext", url = ext ? "/api/ext" : "/api/mine", body = ch => JSON.stringify(ext ? { changes: ch } : { k, changes: ch });
    let Q = {}, T = 0, pulledAt = 0, pulling = null, fails = 0, inflight = null;
    // 发失败（断网、后台出错、被限流）：等的时间一次比一次长（1.5 秒 → 3 → 6 … 最多 5 分钟），不再每 1.5 秒一直打后台；有新改动、连上网、切回页面时马上再试
    const wait = () => (fails ? Math.min(delay * Math.pow(2, fails), 300e3) : delay);
    const later = () => { clearTimeout(T); T = setTimeout(flush, wait()); };
    function put(id, v, at) { Q[id] = { v, at: +at || Date.now() }; fails = Math.min(fails, 1); later(); }
    function del(id, at) { Q[id] = { del: 1, at: +at || Date.now() }; fails = Math.min(fails, 1); later(); }
    function send(changes) { for (const id in changes || {}) { const x = changes[id]; if (!Q[id] || +Q[id].at <= +x.at) Q[id] = x; } return flush(); } // 一批改动马上发
    async function flush() {
      clearTimeout(T); const ch = Q; Q = {}; const n = Object.keys(ch).length; if (!n) return true;
      inflight = ch; // 正在发的这一批：关页面时 beacon 也一起补发
      let r = null; try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body(ch) }); } catch (e) {}
      inflight = null;
      if (r && r.ok) { fails = 0; return true; }
      const st = r ? r.status : 0;
      if (!r || st >= 500 || st === 429) { for (const id in ch) if (!(id in Q)) Q[id] = ch[id]; fails++; log(k + " 没发出去，等下次再发", { 条数: n, status: st, 秒后再试: Math.round(wait() / 1000) }); later(); }
      else log(k + " 后台不收（丢掉）", { 条数: n, status: st });
      return false;
    }
    function pull(o) {
      o = o || {}; const every = o.every == null ? 60e3 : o.every;
      if (pulling) return pulling;
      if (!o.force && pulledAt && Date.now() - pulledAt < every) return Promise.resolve(null);
      pulledAt = Date.now();
      pulling = U.json("/api/mine?k=" + encodeURIComponent(k), { cache: "no-store" }).then(j => {
        pulling = null;
        if (!j || !j.ok) { log(k + " 拉不下来", j && j.error); return null; }
        return j.items || {};
      });
      return pulling;
    }
    let gotAt = 0, got = null, getting = null;
    function get(maxAge) { // 读后台的全部 items（几个页面同时要只请求一次；maxAge 毫秒内读过的直接给，默认 5 秒）；读不到给 {}
      if (got && Date.now() - gotAt < (maxAge == null ? 5000 : maxAge)) return Promise.resolve(got);
      if (getting) return getting;
      getting = U.json(ext ? "/api/ext" : "/api/mine?k=" + encodeURIComponent(k), { cache: "no-store" }).then(j => {
        getting = null; if (!j || !j.ok && !j.items) { log(k + " 读不到", j && j.error); throw new Error("cloud get " + k + ": " + ((j && j.error) || "net")); } // 读不到 ≠ 没有数据：调用的地方别当成空的（不缓存，下次再读）
        got = j.items || {}; gotAt = Date.now(); return got;
      });
      return getting;
    }
    function beacon() { const all = Object.assign({}, inflight || {}, Q); if (!Object.keys(all).length) return; try { if (navigator.sendBeacon(url, new Blob([body(all)], { type: "application/json" }))) { Q = {}; clearTimeout(T); } } catch (e) {} }
    function retry() { if (Object.keys(Q).length) { fails = Math.min(fails, 1); later(); } }
    return (CH[k] = { k, put, del, send, flush, pull, get, beacon, retry, pending: () => Object.keys(Q).length });
  }
  window.addEventListener("pagehide", () => { for (const k in CH) CH[k].beacon(); });
  if (window.addEventListener) window.addEventListener("online", () => { for (const k in CH) CH[k].retry(); });
  if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") for (const k in CH) CH[k].retry(); });
  // 卡片配图、原声、录音存档（后台 /api/media?k=…）：几个页面要同一条只请求一次；取不到给 null（下次再取）
  const MED = new Map();
  function media(k) {
    if (MED.has(k)) return MED.get(k);
    const p = U.json("/api/media?k=" + encodeURIComponent(k)).then(j => { if (!j.ok && !j.rec) { MED.delete(k); if (j.status !== 404) log("配图 / 原声取不到：" + k, j.error); return null; } return j.rec || null; });
    MED.set(k, p); return p;
  }
  window.CLOUD = { chan, media };
})();
