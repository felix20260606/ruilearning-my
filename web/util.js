/* 🧰 全站共用的小工具（window.U）：以前每个页面各抄一份，现在都从这里拿，行为一致
   U.esc(s)        转义成能放进 html 的文字（& < > "）
   U.LG(k, 默认)    读本机存储（JSON），读不到 / 坏了给默认值
   U.LS(k, v)      写本机存储（JSON），成功 true，存满 / 不让存 false
   U.tip(文字)      页面底部的小提示（index.html 的 toast）
   U.json(网址, 选项) fetch 再解析 JSON；网络不通 / 不是 JSON 都不抛错，返回 { ok:false, error, status }
   📅 日期：全站的「今天」都按吉隆坡 / 北京时间（UTC+8）算，换设备、出门在外各页面也对得上（以前有的页面按手机时区、有的按 UTC）
     U.day(时间戳) → "2026-11-22"（不传 = 现在）；U.dayAgo("2026-11-22", n) → n 天前（n 是负数 = n 天后）
     U.dayStart(时间戳) → 那天 0 点的时间戳；U.daysBetween(a, b) → 从 a 到 b 隔几天（b 晚就是正数）
     U.streak(这天算不算数) → 连续天数：从今天往前数，今天还没做不算断（从昨天开始数）
   ✅ 弹窗（代替浏览器自带的 confirm / prompt，和网站一样的深色主题，手机上从底部弹出）：
     await U.ask(问题, {ok: "确定", cancel: "取消", danger: true 红色按钮}) → true / false（Enter = 确定，Esc / 点外面 = 取消）
     await U.input(问题, 默认值, {ok, cancel, placeholder}) → 输入的文字 / null（取消）
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
  const TZ = 8 * 3600e3, DAYMS = 864e5;
  const day = t => new Date((t == null ? Date.now() : +t) + TZ).toISOString().slice(0, 10);
  const dayStart = t => { const x = (t == null ? Date.now() : +t) + TZ; return x - (((x % DAYMS) + DAYMS) % DAYMS) - TZ; };
  const keyMs = k => Date.parse(String(k).slice(0, 10) + "T00:00:00Z") - TZ; // 那天 0 点（UTC+8）
  const dayAgo = (k, n) => day(keyMs(k) + 12 * 3600e3 - (n || 0) * DAYMS);
  const daysBetween = (a, b) => Math.round((keyMs(b) - keyMs(a)) / DAYMS);
  function streak(has, from) { let k = from || day(), n = 0; if (!has(k)) k = dayAgo(k, 1); while (has(k) && n < 5000) { n++; k = dayAgo(k, 1); } return n; }
  const ASK_CSS = `#u-ask{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px}#u-ask.on{display:flex}
  #u-ask .bx{width:100%;max-width:420px;background:var(--ui-surface,#26282c);border:1px solid var(--ui-line-2,#454950);border-radius:16px;padding:20px 18px 16px;box-shadow:0 18px 50px rgba(0,0,0,.5);color:var(--ui-ink,#E6E8EB)}
  #u-ask .q{font-size:15.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
  #u-ask input{width:100%;box-sizing:border-box;margin-top:12px;min-height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--ui-line-2,#454950);background:var(--ui-surface-2,#2d2f34);color:inherit;font:inherit;font-size:16px}
  #u-ask .bt{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}#u-ask .bt .ui-btn.dg{background:var(--ui-red-deep,#a8443a);border-color:var(--ui-red-deep,#a8443a);color:#fff}
  @media(max-width:600px){#u-ask{align-items:flex-end;padding:0}#u-ask .bx{max-width:none;border-radius:18px 18px 0 0;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}#u-ask .bt .ui-btn{flex:1}}`;
  let askBox = null, askDone = null;
  function dialog(q, o, withInput, def) {
    o = o || {};
    if (askDone) askDone(null); // 上一个没回答的当取消
    if (!askBox) {
      const st = document.createElement("style"); st.textContent = ASK_CSS; document.head.append(st);
      askBox = document.createElement("div"); askBox.id = "u-ask"; askBox.setAttribute("role", "dialog"); askBox.setAttribute("aria-modal", "true"); document.body.append(askBox);
      askBox.addEventListener("click", e => { if (e.target === askBox) askDone && askDone(null); const b = e.target.closest("[data-r]"); if (b) askDone && askDone(b.dataset.r === "1" ? "ok" : null); });
      document.addEventListener("keydown", e => { // 弹窗开着：Enter 确定、Esc 取消，别的页面快捷键不触发
        if (!askBox.classList.contains("on") || e.isComposing) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); askDone && askDone(null); }
        else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const fb = document.activeElement && document.activeElement.closest && document.activeElement.closest("#u-ask [data-r]"); askDone && askDone(!fb || fb.dataset.r === "1" ? "ok" : null); } // 焦点在「取消」上按回车 = 取消
        else if (!/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || "")) e.stopPropagation();
      }, true);
    }
    askBox.innerHTML = '<div class="bx"><div class="q">' + esc(q) + "</div>" + (withInput ? '<input type="text" value="' + esc(def || "") + '" placeholder="' + esc(o.placeholder || "") + '">' : "") +
      '<div class="bt"><button type="button" class="ui-btn" data-r="0">' + esc(o.cancel || "取消") + '</button><button type="button" class="ui-btn pri' + (o.danger ? " dg" : "") + '" data-r="1">' + esc(o.ok || "确定") + "</button></div></div>";
    askBox.classList.add("on");
    const inp = askBox.querySelector("input"), okb = askBox.querySelector('[data-r="1"]');
    setTimeout(() => { try { (inp || okb).focus(); if (inp) inp.select(); } catch (e) {} }, 30);
    return new Promise(res => {
      askDone = r => { askDone = null; askBox.classList.remove("on"); const v = inp ? inp.value : ""; askBox.innerHTML = ""; log("ask", (r ? "✓ " : "✗ ") + String(q).slice(0, 40)); res(withInput ? (r ? v : null) : !!r); };
    });
  }
  const ask = (q, o) => dialog(q, o, false);
  const input = (q, def, o) => dialog(q, o, true, def);
  window.U = { esc, LG, LS, tip, log, logs, json, day, dayStart, dayAgo, daysBetween, streak, ask, input };
})();
