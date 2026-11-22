/* 🧰 全站共用的小工具（window.U）：以前每个页面各抄一份，现在都从这里拿，行为一致
   U.esc(s)        转义成能放进 html 的文字（& < > "）
   U.LG(k, 默认)    读本机存储（JSON），读不到 / 坏了给默认值
   U.LS(k, v)      写本机存储（JSON），成功 true，存满 / 不让存 false
   U.tip(文字)      页面底部的小提示（index.html 的 toast）
   U.json(网址, 选项) fetch 再解析 JSON；网络不通 / 不是 JSON 都不抛错，返回 { ok:false, error, status }
   🐞 排查：U.log(模块, 事情, 详情) 记一条（只在内存里，最多 300 条）；在浏览器控制台打 U.logs() 看全部，U.logs("ai") 只看一个模块
     AI、翻译、同步、录音、朗读这些公用模块出错都会记在这里，有问题先看这个 */
(function () {
  "use strict";
  if (window.U) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const LS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { log("store", "存不进本机：" + k, String(e && e.name || e)); return false; } };
  const tip = m => { try { if (typeof window.toast === "function") window.toast(m); else if (typeof toast === "function") toast(m); else console.log("[tip]", m); } catch (e) {} };
  const LOG = [];
  function log(mod, msg, data) {
    const x = { t: new Date().toTimeString().slice(0, 8), mod: String(mod), msg: String(msg) };
    if (data !== undefined) x.data = data;
    LOG.push(x); if (LOG.length > 300) LOG.splice(0, LOG.length - 300);
    try { if (window.localStorage && localStorage.getItem("debug") === "1") console.debug("[" + x.mod + "]", x.msg, data === undefined ? "" : data); } catch (e) {}
  }
  function logs(mod) { const L = mod ? LOG.filter(x => x.mod === mod) : LOG.slice(); try { console.table(L.map(x => ({ 时间: x.t, 模块: x.mod, 事情: x.msg, 详情: x.data === undefined ? "" : typeof x.data === "string" ? x.data : JSON.stringify(x.data) }))); } catch (e) {} return L; }
  async function json(url, opt) {
    let r;
    try { r = await fetch(url, opt); } catch (e) { const ab = e && e.name === "AbortError"; return { ok: false, error: ab ? "abort" : "net", status: 0 }; }
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!j || typeof j !== "object") return { ok: false, error: "http " + r.status, status: r.status };
    if (!r.ok && j.ok == null) j.ok = false;
    j.status = r.status; return j;
  }
  window.U = { esc, LG, LS, tip, log, logs, json };
})();
