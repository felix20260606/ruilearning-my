/* 🤖 全站共用的「调 AI」（window.AI）：所有页面请后台 /api/ai 都走这里，出错提示一致，方便排查
   AI.ask(任务, 内容, 选项) → Promise<结果>，永远不抛错：
     任务 = 后台的 task（chat、speak、write、whymiss、exam……），内容 = 其它字段（会和 task 合成一个 JSON 发过去）
     选项：timeout 毫秒（默认 90 秒）、signal（自己的 AbortController）、tip true 出错时直接弹提示
     结果：后台回的 JSON；出错时 { ok:false, error 原始原因, msg 给人看的中文 }
       error："noai"（后台没开 Workers AI）、"quota"（今天免费额度用完）、"net"（网络不通）、"timeout"（太慢）、"abort"（自己取消）、其它 = 后台原话
   AI.msg(结果, 默认文字) → 出错时给人看的中文
   每次调用记进 U.log("ai", …)（任务、用时、成没成）；调完发 "ai-used" 事件，「📅 每日」上面的 AI 用量面板会刷新 */
(function () {
  "use strict";
  if (window.AI) return;
  const log = (m, d) => { if (window.U) U.log("ai", m, d); };
  const MSG = {
    noai: "AI 没开：要在 Cloudflare 打开 Workers AI",
    quota: "今天的免费 AI 额度用完了，北京时间 08:00 恢复",
    net: "网络不通，等会儿再试",
    timeout: "AI 太慢了，再点一次",
    abort: "已取消",
  };
  function kind(j) {
    const e = String((j && j.error) || "");
    if (e === "noai") return "noai";
    if ((j && j.status === 429) || /4006|neuron|daily free allocation|quota|rate limit|too many/i.test(e)) return "quota";
    if (e === "net" || e === "timeout" || e === "abort") return e;
    return e || "fail";
  }
  function msg(j, d) { if (j && j.ok) return ""; const k = kind(j); return MSG[k] || d || "AI 没回上来，再试一次"; }
  async function ask(task, body, o) {
    o = o || {}; const t0 = Date.now(), ctl = new AbortController(), ms = o.timeout || 90000;
    let timedOut = false; const tm = setTimeout(() => { timedOut = true; ctl.abort(); }, ms);
    if (o.signal) { if (o.signal.aborted) ctl.abort(); else o.signal.addEventListener("abort", () => ctl.abort()); }
    let j = await U.json("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ task }, body || {})), signal: ctl.signal });
    clearTimeout(tm);
    if (!j.ok) { if (j.error === "abort" && timedOut) j.error = "timeout"; const k = kind(j); if (MSG[k]) j.error = k; j.msg = msg(j); }
    log(task + (j.ok ? " ✓" : " ✗ " + j.error), { ms: Date.now() - t0, cached: !!j.cached, model: j.model || "" });
    try { document.dispatchEvent(new CustomEvent("ai-used", { detail: { task, ok: !!j.ok } })); } catch (e) {}
    if (!j.ok && o.tip && j.error !== "abort") U.tip(j.msg);
    return j;
  }
  window.AI = { ask, msg, MSG };
})();
