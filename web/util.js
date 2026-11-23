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
   💾 本机缓存（统一管理，存储满了不再悄悄丢数据）：
     U.keep(键, id, 值, {max}) 一个键里存一组缓存，只留最近 max 条（默认 20）；U.kept(键, id) 取出来（没有 = undefined）
     U.keepKeys(列表键, id, max, [键前缀…]) 每条单独一个键的缓存（视频字幕、查词）：记最近用过的顺序，超出的连同各自的键一起删
     U.cacheable(键前缀, 名字) 登记「可以丢的缓存」；任何地方 localStorage 存满了（QuotaExceeded）：按登记顺序一组组清掉缓存再试，
       存进去了记日志、提示一次；清完还存不进去照旧抛错（原来的兜底照常走）。生词本、记录这些数据不会被清
   🔗 跳转（页面之间关联起来）：任何元素加 data-to="去哪"，点了（或 Tab 选中按回车）就跳过去；代码里用 U.go("去哪", 元素)
     去哪 = "标签/小标签?条件"：标签 daily notebook listen speak read write ielts basic；小标签同 enShow（生词本 list pump stats saved err，听 drill sme video practice……）
     生词本列表的条件：f=all|learning|known（全部 / 未掌握 / 已掌握）、c=all|word|phrase|sentence|pattern（分类）、q=搜索词；雅思：?sub=lexam|rexam|notes|basics
     "word:单词" = 就地打开这个词的查词卡片
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
  let saveT = 0, persistOff = 0;
  // 存不进去（本机存储满了）：10 分钟内不再试（以前每 1.5 秒重试一次、每次都记一条「存不进去」，把真正的报错挤掉）
  const persist = () => { clearTimeout(saveT); saveT = 0; try { localStorage.setItem(LKEY, JSON.stringify(LOG.slice(-KEEP).map(x => { const y = Object.assign({}, x); delete y.old; return y; }))); persistOff = 0; } catch (e) { persistOff = Date.now(); } };
  function log(mod, msg, data) {
    const x = { t: stamp(), mod: String(mod), msg: String(msg).slice(0, 300) };
    if (data !== undefined) x.data = typeof data === "string" ? data.slice(0, 500) : data;
    LOG.push(x); if (LOG.length > 300) LOG.splice(0, LOG.length - 300);
    if (!saveT && Date.now() - persistOff > 600e3) saveT = setTimeout(persist, 1500);
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
  /* ---------- 💾 本机缓存 ---------- */
  function keep(key, id, value, o) {
    const max = (o && o.max) || 20, A = LG(key, {}) || {};
    let at = Date.now(); for (const k in A) if (A[k] && +A[k].at >= at) at = +A[k].at + 1; // 同一毫秒连存几条：新存的一定排在最前
    A[id] = { v: value, at };
    Object.keys(A).sort((a, b) => (A[b].at || 0) - (A[a].at || 0)).slice(max).forEach(k => delete A[k]);
    return LS(key, A) || LS(key, { [id]: A[id] }); // 还是存不下：只留这一条
  }
  const kept = (key, id) => { const x = (LG(key, {}) || {})[id]; return x && typeof x === "object" && "v" in x ? x.v : undefined; };
  function keepKeys(key, id, n, pre) {
    try {
      let L = JSON.parse(localStorage.getItem(key) || "null");
      if (!Array.isArray(L)) { L = []; for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && pre.some(p => k.startsWith(p)) && !pre.some(p => k === p + id)) localStorage.removeItem(k); } } // 第一次用：以前留下的同类缓存都清掉
      L = [id].concat(L.filter(x => x !== id)); const drop = L.slice(n); L = L.slice(0, n);
      drop.forEach(x => pre.forEach(p => localStorage.removeItem(p + x)));
      localStorage.setItem(key, JSON.stringify(L));
    } catch (e) {}
  }
  // 可以丢的缓存（丢了只是要重新下载 / 翻译，不丢数据），按「最不心疼」排在前面
  const CACHES = [];
  const cacheable = (pre, name) => { if (!CACHES.some(c => c.pre === pre)) CACHES.push({ pre, name }); };
  [["debug:log", "问题记录"], ["wt:doc:", "视频字幕"], ["wt:tr:", "视频字幕译文"], ["wt:recent", "最近看的视频"], ["wt:w:", "视频查过的词"], ["wt:wl", "视频查词列表"], ["wt:list", "视频列表"], ["reader:img", "配图地址"],
    ["sme:zhc", "听力节目的中文"], ["sme:diff", "听力节目难度"], ["reading:newsq", "新闻简单版"], ["reading:news", "今天的新闻"], ["reading:tr", "文章译文"]].forEach(c => cacheable(c[0], c[1]));
  const isQuota = e => !!e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014);
  // 键名算不算这个缓存：前缀以 ":" 结尾的（wt:doc:）按前缀；其它（reading:tr）只认它本身、带家人 / 语言后缀的（@u2、~de）和 ":" 往下的——
  //   不然 reading:tr 会把用户设置 reading:trOn 也当成缓存清掉
  const ofCache = (k, pre) => (/:$/.test(pre) ? k.startsWith(pre) : k === pre || k.startsWith(pre + "@") || k.startsWith(pre + "~") || k.startsWith(pre + ":"));
  function clearCache(c, except) {
    let n = 0;
    const rm = window.__lsRawRemove || (k => localStorage.removeItem(k)); // 按真实键名删（boot.js），带后缀的缓存才真的删得掉
    try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k !== except && ofCache(k, c.pre)) { rm(k); n++; } } } catch (e) {}
    return n;
  }
  let fullTipped = false;
  try {
    const SP = Storage.prototype, orig = SP.setItem; // 包在 index.html 的「按家人分开存」外面
    SP.setItem = function (k, v) {
      try { return orig.call(this, k, v); } catch (e) {
        if (!isQuota(e) || this !== window.localStorage) throw e;
        if (k === LKEY) throw e; // 问题记录自己就是缓存：存不下就不存，不为它清别的、也不再记一条
        for (const c of CACHES) {
          if (!clearCache(c, k)) continue;
          try { const r = orig.call(this, k, v); log("store", "本机存储满了：清掉「" + c.name + "」缓存后存进去了", k); if (!fullTipped) { fullTipped = true; tip("本机存储快满了，已经清掉一些缓存（字幕、翻译之类，用到时会重新下载）"); } return r; }
          catch (e2) { if (!isQuota(e2)) throw e2; }
        }
        log("store", "本机存储满了，清了缓存也存不进去", k); throw e;
      }
    };
  } catch (e) {}

  /* ---------- 🔗 跳转 ---------- */
  function go(spec, el) {
    spec = String(spec || ""); const qi = spec.indexOf("?"), path = qi < 0 ? spec : spec.slice(0, qi), p = new URLSearchParams(qi < 0 ? "" : spec.slice(qi + 1));
    log("go", spec);
    if (/^word:/.test(path)) { const w = path.slice(5); if (window.WORD && w) WORD.open(w, el || document.body, { sent: p.get("sent") || "" }); return; }
    const [tab, sub] = path.split("/");
    if (typeof window.enShow !== "function") { log("go", "跳不了：enShow 还没准备好", spec); return; }
    window.enShow(tab, sub || undefined);
    const click = sel => { const b = document.querySelector(sel); if (b && !b.classList.contains("on")) b.click(); };
    if (tab === "notebook" && sub) { const b = document.querySelector('.modes button[data-mode="' + sub + '"]'); if (b && !b.classList.contains("on")) b.click(); } // 生词本的模式（列表、练习、统计、已保存、错题）：enShow 只管切到生词本，模式这里点
    setTimeout(() => {
      if (tab === "notebook" && (!sub || sub === "list")) {
        if (p.has("c")) click('#list-cats [data-c="' + p.get("c") + '"]');
        if (p.has("f")) click('.filters button[data-f="' + p.get("f") + '"]');
        if (p.has("q")) { const q = document.getElementById("q"); if (q) { q.value = p.get("q"); q.dispatchEvent(new Event("input", { bubbles: true })); } }
        const lv = document.getElementById("list-view"); if (lv && (p.has("f") || p.has("c") || p.has("q"))) try { lv.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) {}
      }
      if (tab === "ielts" && p.has("sub") && window.ieltsSub) window.ieltsSub(p.get("sub"));
    }, 60);
  }
  try {
    document.addEventListener("click", e => { const t = e.target.closest && e.target.closest("[data-to]"); if (!t || e.defaultPrevented) return; e.preventDefault(); e.stopPropagation(); go(t.dataset.to, t); }, true);
    document.addEventListener("keydown", e => { if (e.key !== "Enter" || !e.target.closest) return; const t = e.target.closest("[data-to]"); if (!t || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)) return; e.preventDefault(); go(t.dataset.to, t); });
    const st = document.createElement("style"); st.textContent = "[data-to]{cursor:pointer}[data-to]:not(button):not(a):hover{filter:brightness(1.18)}[data-to]:focus-visible{outline:2px solid var(--ui-pur,#9C3FD0);outline-offset:2px}";
    (document.head || document.documentElement).append(st);
  } catch (e) {}

  const ask = (q, o) => dialog(q, o, false);
  const input = (q, def, o) => dialog(q, o, true, def);
  window.U = { esc, LG, LS, tip, log, logs, json, day, dayStart, dayAgo, daysBetween, streak, ask, input, copy, download, sents, showLogs, clearLogs, report, keep, kept, keepKeys, cacheable, go };
})();
