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
   📋 await U.copy(文字, {ok: 成功提示（false = 不提示）, manual: false 复制不了时不弹窗}) → true / false
     先用剪贴板，不行用老办法（选中再复制）；都不行弹出文字让你手动复制
   ⬇️ U.download(文件名, 文字或 Blob, 类型)：存成文件（类型默认看后缀：.csv 带 BOM 让 Excel 认中文、.json、.html、.ics、其它当纯文本）
   ✂️ U.sents(文字) → 句子数组：. ! ? … 后面跟空格、下一个字不是小写才断；缩写（Mr.）、人名首字母（J. K.）、e.g. / U.S.、No. 5、小数都不断；有换行先按行分
   🐞 排查：U.log(模块, 事情, 详情) 记一条（内存里最多 300 条，最近 200 条存进这台设备）；在浏览器控制台打 U.logs() 看全部，U.logs("ai") 只看一个模块
     页面上的报错（代码出错、没处理的 Promise 失败）自动记成 "error"；手机上看：生词本「⚙ 设置」→「🐞 问题记录」，或者网址加 ?debug
     U.showLogs() 打开问题记录（能一键复制发给 Claude）；U.clearLogs() 清空
     AI、翻译、同步、录音、朗读这些公用模块出错都会记在这里，有问题先看这个 */
(function () {
  "use strict";
  if (window.U) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const LS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { log("store", "存不进本机：" + k, String(e && e.name || e)); return false; } };
  const tip = m => { try { if (typeof window.toast === "function") window.toast(m); else if (typeof toast === "function") toast(m); else console.log("[tip]", m); } catch (e) {} };
  // 🐞 记录：内存里最多 300 条；最近 200 条也存进这台设备（localStorage「debug:log」），手机上刷新 / 关掉再开也看得到（设置里「🐞 问题记录」）
  const LOG = [], KEEP = 200, LKEY = "debug:log";
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + d.toTimeString().slice(0, 8); };
  try { const old = JSON.parse(localStorage.getItem(LKEY) || "[]"); if (Array.isArray(old)) old.slice(-KEEP).forEach(x => { if (x && x.msg) LOG.push(Object.assign({}, x, { old: 1 })); }); } catch (e) {}
  let saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = 0; try { localStorage.setItem(LKEY, JSON.stringify(LOG.slice(-KEEP).map(x => { const y = Object.assign({}, x); delete y.old; return y; }))); } catch (e) {} };
  function log(mod, msg, data) {
    const x = { t: stamp(), mod: String(mod), msg: String(msg).slice(0, 300) };
    if (data !== undefined) x.data = typeof data === "string" ? data.slice(0, 500) : data;
    LOG.push(x); if (LOG.length > 300) LOG.splice(0, LOG.length - 300);
    if (!saveT) saveT = setTimeout(persist, 1500);
    try { if (window.localStorage && localStorage.getItem("debug") === "1") console.debug("[" + x.mod + "]", x.msg, data === undefined ? "" : data); } catch (e) {}
  }
  function logs(mod) { const L = mod ? LOG.filter(x => x.mod === mod) : LOG.slice(); try { console.table(L.map(x => ({ 时间: x.t, 模块: x.mod, 事情: x.msg, 详情: x.data === undefined ? "" : typeof x.data === "string" ? x.data : JSON.stringify(x.data) }))); } catch (e) {} return L; }
  // 页面上的报错（代码出错、没处理的 Promise 失败）也记下来；图片 / 脚本加载失败不冒泡到 window，不会进来
  const NOISE = /ResizeObserver loop|^Script error\.?$/;
  try {
    window.addEventListener("error", e => { const m = String((e && e.message) || ""); if (!m || NOISE.test(m)) return; log("error", m, String(e.filename || "").split("/").pop().replace(/\?.*$/, "") + ":" + (e.lineno || 0) + ":" + (e.colno || 0)); });
    window.addEventListener("unhandledrejection", e => { const r = e && e.reason, m = String((r && (r.message || r.name)) || r || ""); if (!m || NOISE.test(m) || /AbortError/.test(m)) return; log("error", "没处理的失败：" + m, r && r.stack ? String(r.stack).split("\n").slice(0, 3).join(" | ") : undefined); });
    window.addEventListener("pagehide", () => { if (saveT) persist(); });
  } catch (e) {}
  function report() { // 给人看 / 复制发给 Claude 的文字：最新的在上面
    const L = LOG.slice().reverse(), err = L.filter(x => x.mod === "error").length;
    const head = "🐞 问题记录 · " + stamp() + " · " + location.pathname + location.search + "\n" + navigator.userAgent + "\n共 " + L.length + " 条（报错 " + err + " 条）；「·」开头的是这次打开以前的\n";
    return head + "\n" + L.map(x => (x.old ? "· " : "") + x.t + " [" + x.mod + "] " + x.msg + (x.data === undefined ? "" : " — " + (typeof x.data === "string" ? x.data : JSON.stringify(x.data)))).join("\n");
  }
  async function showLogs() {
    const text = report();
    if (await dialog(LOG.length ? "最近的记录（最新的在上面）。遇到问题时点「复制全部」发给 Claude。" : "还没有记录。用的时候出了问题（AI、翻译、同步没成功，或者页面报错）会记在这里。", { ok: "复制全部", cancel: "关掉", pre: LOG.length ? text : "" })) copy(text, { ok: "已复制，粘贴发给 Claude 就行" });
  }
  function clearLogs() { LOG.length = 0; try { localStorage.removeItem(LKEY); } catch (e) {} }
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
  #u-ask .pre{margin:12px 0 0;max-height:50vh;overflow:auto;background:var(--ui-surface-2,#2d2f34);border-radius:10px;padding:10px 12px;font:12px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-all;color:var(--ui-ink-2,#cfd2d6)}
  #u-ask .bx:has(.pre){max-width:640px}
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
    askBox.innerHTML = '<div class="bx"><div class="q">' + esc(q) + "</div>" + (o.pre ? '<pre class="pre">' + esc(o.pre) + "</pre>" : "") + (withInput ? '<input type="text" value="' + esc(def || "") + '" placeholder="' + esc(o.placeholder || "") + '">' : "") +
      '<div class="bt"><button type="button" class="ui-btn" data-r="0">' + esc(o.cancel || "取消") + '</button><button type="button" class="ui-btn pri' + (o.danger ? " dg" : "") + '" data-r="1">' + esc(o.ok || "确定") + "</button></div></div>";
    askBox.classList.add("on");
    const inp = askBox.querySelector("input"), okb = askBox.querySelector('[data-r="1"]');
    setTimeout(() => { try { (inp || okb).focus(); if (inp) inp.select(); } catch (e) {} }, 30);
    return new Promise(res => {
      askDone = r => { askDone = null; askBox.classList.remove("on"); const v = inp ? inp.value : ""; askBox.innerHTML = ""; log("ask", (r ? "✓ " : "✗ ") + String(q).slice(0, 40)); res(withInput ? (r ? v : null) : !!r); };
    });
  }
  async function copy(text, o) {
    o = o || {}; text = String(text == null ? "" : text); let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) {}
    if (!ok) try { const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0"; document.body.append(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (e) {}
    if (ok) { if (o.ok !== false) tip(o.ok || "已复制"); return true; }
    log("copy", "复制不了（浏览器不让）", text.slice(0, 40));
    if (o.manual !== false) await dialog("复制不了，请长按 / 选中下面的文字手动复制：", { ok: "好了", cancel: "关掉" }, true, text);
    return false;
  }
  const MIME = { csv: "text/csv;charset=utf-8", json: "application/json", html: "text/html;charset=utf-8", ics: "text/calendar;charset=utf-8", txt: "text/plain;charset=utf-8" };
  function download(name, data, type) {
    const ext = (type || (String(name).match(/\.(\w+)$/) || [])[1] || "txt").toLowerCase();
    const blob = data instanceof Blob ? data : new Blob([ext === "csv" ? "\uFEFF" + data : String(data)], { type: MIME[ext] || MIME.txt });
    const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30e3); log("download", name, Math.round(blob.size / 1024) + " KB");
  }
  // 不算句末的缩写（后面跟大写也不断句）："Mr. Lee"、"Dr. Tan"、"St. Paul"
  const ABBR = new Set("mr mrs ms dr prof st jr sr mt vs fig gen col lt sgt capt rev hon inc ltd co corp dept approx jan feb mar apr jun jul aug sep sept oct nov dec al".split(" "));
  // 分句：. ! ? … 后面跟空格、下一个字不是小写时断开；缩写（Mr.）、人名首字母（J. K.）、e.g. / U.S.、No. 5、小数都不断
  function sentsOf(p) {
    p = String(p == null ? "" : p).replace(/\s+/g, " ").trim(); if (!p) return [];
    const out = [], re = /[.!?…]+["'”’)\]]*(?=\s|$)/g; let m, start = 0;
    while ((m = re.exec(p))) {
      const end = m.index + m[0].length, rest = p.slice(end).replace(/^\s+/, "");
      if (!rest) break;
      if (/^[a-z]/.test(rest)) continue; // 下一个字小写：多半不是句末（"Really?" she asked. / Hmm... maybe）
      if (/^\.["'”’)\]]*$/.test(m[0])) { // 只有一个句点：看前面那个词是不是缩写
        const lw = (p.slice(start, m.index).match(/([A-Za-z][A-Za-z.]*)$/) || [])[1] || "";
        if (ABBR.has(lw.toLowerCase())) continue;
        if (/^[A-Z]$/.test(lw)) continue; // 人名首字母 J. K. Rowling
        if (/^([A-Za-z]\.)+[A-Za-z]$/.test(lw)) continue; // e.g. / i.e. / U.S.
        if (/^no$/i.test(lw) && /^\d/.test(rest)) continue; // No. 5
      }
      out.push(p.slice(start, end).trim()); start = end;
    }
    const last = p.slice(start).trim(); if (last) out.push(last);
    return out;
  }
  const sents = t => String(t == null ? "" : t).split(/\n\s*/).flatMap(sentsOf); // 有换行先按行分（每行各自分句）
  const ask = (q, o) => dialog(q, o, false);
  const input = (q, def, o) => dialog(q, o, true, def);
  window.U = { esc, LG, LS, tip, log, logs, json, day, dayStart, dayAgo, daysBetween, streak, ask, input, copy, download, sents, showLogs, clearLogs, report };
})();
