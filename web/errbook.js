/* ❌ 错题本：各模块做错的自动收进来，按间隔复习（「📖 词汇」→「❌ 错题」）
   来源（各模块调 window.ERR.add([...])）：
     ✍️ 写作批改：LanguageTool 挑出的语法 / 拼写错误（错的写法 → 建议改法，带原句）
     📰 读后小测、🎓 听力 / 阅读模考：答错的题（题目、选项、正确答案、出处原文）
     🗣 口语模拟考：AI 考官指出的问题（原话 → 更好的说法）
     🎯 跟读：没读出来的词
   每条：{id, src 来源, kind: fix 改错 | mcq 选择 | gap 填空 | say 跟读, q 题目, ctx 原句, wrong, right, why 中文说明, opts, ans, at 收进来的时间, lv 0–5, due 下次复习, u 修改时间, done 已掌握}
   复习间隔：答对 lv+1，间隔 [当天, 1, 3, 7, 16, 35] 天；lv 5 再答对 = 已掌握（不再出现，列表里还看得到）；答错回到 lv 0、本轮最后再出一次
   本机存 localStorage「err:items」（按家人分开，见 index.html 的 MINE），同步到后台 /api/mine k=err（同一条以 u 新的为准）
   入口：window.errShow(el) 把界面画进 el；window.ERR = {add, all, due, remove}；有新错题时发 "err-change" 事件（每日一练用来更新数字） */
(function () {
  "use strict";
  if (window.ERR) return;
  const KEY = "err:items", DAY = 864e5, IV = [0, 1, 3, 7, 16, 35];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const LS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const tip = m => { try { (window.toast || (() => {}))(m); } catch (e) {} };
  const say = t => { try { if (typeof window.speak === "function") window.speak(t); } catch (e) {} };
  const norm = s => String(s || "").normalize("NFC").toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim(); // 字母含 ä ö ü ß é…（德语等其它学习语言的错题也能判）
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
  const SRC = { write: "✍️ 写作", read: "📰 阅读小测", exam: "🎓 模考", speak: "🗣 口语", pron: "🎯 跟读", listen: "🎧 精听", other: "📌 其它" };
  const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

  function all() { const o = LG(KEY, {}); return o && typeof o === "object" ? o : {}; }
  function save(o) { LS(KEY, o); try { window.dispatchEvent(new Event("err-change")); } catch (e) {} }
  function stamp(x) { x.u = Math.max(Date.now(), (+x.u || 0) + 1); return x; }

  // ---------- 换设备同步：/api/mine k=err ----------
  let syQ = {}, syT = 0, pulled = 0;
  function put(x) { syQ[x.id] = x.del ? { del: 1, at: x.u } : { v: x, at: x.u }; clearTimeout(syT); syT = setTimeout(flush, 1500); }
  function flush() { const ch = syQ; syQ = {}; if (!Object.keys(ch).length) return; fetch("/api/mine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: "err", changes: ch }) }).then(r => { if (!r.ok) throw 0; }).catch(() => { Object.assign(syQ, ch); }); }
  window.addEventListener("pagehide", () => { if (Object.keys(syQ).length) try { navigator.sendBeacon("/api/mine", new Blob([JSON.stringify({ k: "err", changes: syQ })], { type: "application/json" })); syQ = {}; } catch (e) {} });
  function pull(force) {
    if (!force && Date.now() - pulled < 60e3) return Promise.resolve(); pulled = Date.now();
    return fetch("/api/mine?k=err", { cache: "no-store" }).then(r => r.json()).then(j => {
      if (!j || !j.ok) return; const o = all(); let ch = false;
      for (const id in j.items || {}) {
        const x = j.items[id], cur = o[id]; if (!x || !(+x.at)) continue;
        if (cur && +cur.u >= +x.at) continue;
        if (x.del) { if (cur) { o[id] = { id, del: 1, u: +x.at }; ch = true; } continue; }
        if (x.v && typeof x.v === "object") { o[id] = Object.assign({}, x.v, { id, u: +x.at }); ch = true; }
      }
      // 50 天前的删除记号：后台 60 天后会清掉，本机也丢掉（不然后台没有了、这里每次拉都再传一遍，白写一次 KV）
      for (const id in o) if (o[id] && o[id].del && Date.now() - (+o[id].u || 0) > 50 * 86400e3 && !(j.items || {})[id]) { delete o[id]; ch = true; }
      // 本机有、后台没有的（离线时加的）补传
      for (const id in o) if (!(j.items || {})[id] || +j.items[id].at < +o[id].u) put(o[id]);
      if (ch) { save(o); if (root && root.isConnected) draw(); }
    }).catch(() => {});
  }

  // ---------- 收错题 ----------
  // add([{src, kind, q, ctx, wrong, right, why, opts, ans}]) → 新收了几条（同一道错题不重复收；已掌握的又错了 → 重新开始复习）
  function add(list, quiet) {
    const o = all(), now = Date.now(); let n = 0;
    (Array.isArray(list) ? list : [list]).forEach(it => {
      if (!it || !(it.right || it.opts)) return;
      const kind = ["fix", "mcq", "gap", "say"].includes(it.kind) ? it.kind : "fix";
      const x = { src: SRC[it.src] ? it.src : "other", kind, q: clip(it.q, 400), ctx: clip(it.ctx, 600), wrong: clip(it.wrong, 200), right: clip(it.right, 300), why: clip(it.why, 400) };
      if (kind === "mcq") { x.opts = (it.opts || []).slice(0, 6).map(s => clip(s, 200)); x.ans = +it.ans || 0; if (x.opts.length < 2 || !x.opts[x.ans]) return; x.right = x.right || x.opts[x.ans]; }
      if (it.alts) x.alts = (it.alts || []).slice(0, 6).map(s => clip(s, 100));
      const id = "e" + hash(x.src + "|" + kind + "|" + norm(x.q) + "|" + norm(x.wrong) + "|" + norm(x.right) + "|" + (kind === "fix" ? "" : norm(x.ctx).slice(0, 80)));
      const cur = o[id];
      if (cur && !cur.del && !cur.done) { if (cur.lv > 0) { cur.lv = 0; cur.due = now; put(stamp(cur)); } return; }
      o[id] = stamp(Object.assign(x, { id, at: now, lv: 0, due: now, ok: 0, bad: cur && cur.bad ? cur.bad : 0 })); put(o[id]); n++;
    });
    if (n) { save(o); if (!quiet) tip("❌ 收进错题本 " + n + " 条（「📖 词汇 → ❌ 错题」复习）"); }
    return n;
  }
  const live = () => Object.values(all()).filter(x => x && !x.del && x.id);
  const due = () => live().filter(x => !x.done && (+x.due || 0) <= Date.now());
  function remove(id) { const o = all(); if (!o[id]) return; o[id] = stamp({ id, del: 1, u: o[id].u }); save(o); put(o[id]); }
  function grade(id, good) {
    const o = all(), x = o[id]; if (!x || x.del) return;
    if (good) { x.ok = (x.ok || 0) + 1; if (x.lv >= 5) x.done = Date.now(); else { x.lv = (x.lv || 0) + 1; x.due = Date.now() + IV[x.lv] * DAY - 3 * 3600e3; } }
    else { x.bad = (x.bad || 0) + 1; x.lv = 0; x.due = Date.now(); delete x.done; }
    save(o); put(stamp(x));
  }
  window.ERR = { add, all: live, due, remove, pull };

  // ---------- 界面 ----------
  const CSS = `
  #errbox{max-width:820px;margin:0 auto;padding:6px 0 60px;color:var(--ui-ink);font-family:var(--ui-font);overflow-wrap:anywhere}
  #errbox .eb-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:2px 0 12px}#errbox .eb-top .sp{flex:1}
  #errbox .eb-n{display:flex;gap:8px;flex-wrap:wrap}#errbox .eb-n span{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:999px;padding:5px 12px;font-size:13px;color:var(--ui-ink-2)}#errbox .eb-n b{color:var(--ui-ink)}
  #errbox .eb-card{background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:16px;padding:16px 18px;margin:0 0 12px}
  #errbox .eb-src{font-size:12.5px;color:var(--ui-pur-text);font-weight:800;margin-bottom:6px}
  #errbox .eb-q{font-size:17px;line-height:1.6;margin:0 0 10px;font-weight:700}
  #errbox .eb-ctx{font-size:16px;line-height:1.75;margin:0 0 10px;color:var(--ui-ink-2)}
  #errbox .eb-ctx mark{background:var(--ui-red-soft);color:var(--ui-red-deep,var(--ui-ink));border-bottom:2px solid var(--ui-red);padding:0 2px;border-radius:3px}
  #errbox .eb-opts{display:grid;gap:8px;margin:8px 0}#errbox .eb-opts button{text-align:left;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:12px;padding:10px 12px;font:inherit;font-size:15px;cursor:pointer}
  #errbox .eb-opts button.ok{border-color:var(--ui-green);background:var(--ui-green-soft)}#errbox .eb-opts button.no{border-color:var(--ui-red);background:var(--ui-red-soft)}
  #errbox input.eb-in{width:100%;box-sizing:border-box;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);border-radius:12px;padding:11px 12px;font:inherit;font-size:16px;margin:4px 0 10px}
  #errbox .eb-ans{border-top:1px dashed var(--ui-line-2);margin-top:10px;padding-top:10px;font-size:15px;line-height:1.7}
  #errbox .eb-ans .r{color:var(--ui-green-deep,var(--ui-green));font-weight:800}#errbox .eb-ans .w{color:var(--ui-red);text-decoration:line-through}
  #errbox .eb-ans .why{color:var(--ui-ink-2);font-size:14px;margin-top:4px}
  #errbox .eb-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  #errbox .eb-li{display:flex;gap:10px;align-items:flex-start;padding:10px 2px;border-bottom:1px solid var(--ui-line)}#errbox .eb-li .t{flex:1;min-width:0;font-size:14px;line-height:1.55}#errbox .eb-li small{color:var(--ui-muted);display:block}
  #errbox .eb-li button{border:0;background:none;color:var(--ui-muted);cursor:pointer;font-size:15px;padding:2px 6px}
  #errbox .eb-empty{text-align:center;color:var(--ui-muted);padding:30px 10px;line-height:1.8}
  #errbox .eb-seg{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 6px}#errbox .eb-seg button{border:1px solid var(--ui-line-2);background:var(--ui-surface);color:var(--ui-ink-2);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}#errbox .eb-seg button.on{background:var(--ui-pur);border-color:var(--ui-pur);color:#fff}
  `;
  let root = null, queue = [], cur = null, shown = false, pick = null, typed = "", view = "do", filt = "all", sess = { ok: 0, bad: 0 };
  function ensureCss() { if (document.getElementById("errbook-css")) return; const s = document.createElement("style"); s.id = "errbook-css"; s.textContent = CSS; document.head.appendChild(s); }
  function mark(ctx, wrong) {
    const c = esc(ctx); if (!wrong) return c; const w = esc(wrong), i = c.toLowerCase().indexOf(w.toLowerCase());
    return i < 0 ? c : c.slice(0, i) + "<mark>" + c.slice(i, i + w.length) + "</mark>" + c.slice(i + w.length);
  }
  function nextCard() {
    if (!queue.length) { const d = due().sort((a, b) => (a.lv - b.lv) || (a.due - b.due)); queue = d.map(x => x.id); }
    const o = all(); cur = null;
    while (queue.length && !cur) { const x = o[queue.shift()]; if (x && !x.del && !x.done && x.due <= Date.now()) cur = x; }
    shown = false; pick = null; typed = "";
  }
  function answerHtml(x, good) {
    let s = '<div class="eb-ans">' + (good == null ? "" : good ? "✅ 对了！" : "❌ 还没对。") + " 正确：<span class=\"r\">" + esc(x.right) + "</span>" + (x.wrong ? "　（不是 <span class=\"w\">" + esc(x.wrong) + "</span>）" : "");
    if (x.alts && x.alts.length) s += '<div class="why">也算对：' + x.alts.map(esc).join(" / ") + "</div>";
    if (x.why) s += '<div class="why">' + esc(x.why) + "</div>";
    return s + "</div>";
  }
  function cardHtml(x) {
    let s = '<div class="eb-card"><div class="eb-src">' + (SRC[x.src] || "") + "　·　第 " + ((x.ok || 0) + (x.bad || 0) + 1) + " 次</div>";
    if (x.kind === "fix") {
      s += '<div class="eb-q">' + esc(x.q || "这句里标红的地方错了，应该怎么写？") + "</div>";
      if (x.ctx) s += '<div class="eb-ctx">' + mark(x.ctx, x.wrong) + "</div>";
      else if (x.wrong) s += '<div class="eb-ctx"><mark>' + esc(x.wrong) + "</mark></div>";
      if (!shown) s += '<input class="eb-in" id="eb-in" placeholder="写出正确的说法（可以不写，直接看答案）" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(typed) + '">';
    } else if (x.kind === "mcq") {
      s += '<div class="eb-q">' + esc(x.q) + "</div>" + (x.ctx ? '<div class="eb-ctx">' + esc(x.ctx) + "</div>" : "");
      s += '<div class="eb-opts">' + x.opts.map((o, i) => '<button data-o="' + i + '" class="' + (pick == null ? "" : i === x.ans ? "ok" : i === pick ? "no" : "") + '">' + String.fromCharCode(65 + i) + ". " + esc(o) + "</button>").join("") + "</div>";
    } else if (x.kind === "gap") {
      s += '<div class="eb-q">' + esc(x.q) + "</div>" + (x.ctx ? '<div class="eb-ctx">' + esc(x.ctx) + "</div>" : "");
      if (!shown) s += '<input class="eb-in" id="eb-in" placeholder="填空" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(typed) + '">';
    } else { // say
      s += '<div class="eb-q">' + esc(x.q || "听一遍，再大声读出来") + '</div><div class="eb-ctx">' + mark(x.ctx || x.right, x.wrong) + ' <button class="ui-btn" data-a="say">🔊</button></div>';
    }
    if (!shown) s += '<div class="eb-btns">' + (x.kind === "mcq" ? "" : '<button class="ui-btn pri" data-a="show">' + (x.kind === "say" ? "读完了" : "看答案") + "</button>") + '<button class="ui-btn" data-a="skip">跳过</button></div>';
    else {
      const auto = x.kind === "mcq" ? pick === x.ans : (x.kind === "fix" || x.kind === "gap") && typed ? okTyped(x, typed) : null;
      s += answerHtml(x, auto) + (x.right && /\p{L}/u.test(x.right) && !/[\u4e00-\u9fff]/.test(x.right) ? ' <button class="ui-btn" data-a="sayr">🔊 读正确的</button>' : "");
      s += '<div class="eb-btns">' + (auto == null ? '<button class="ui-btn" data-g="0">❌ 没想到</button><button class="ui-btn pri" data-g="1">✅ 想对了</button>' : '<button class="ui-btn pri" data-g="' + (auto ? 1 : 0) + '">下一题 →</button>' + (auto ? "" : '<button class="ui-btn" data-g="1">其实我想对了</button>')) + "</div>";
    }
    return s + "</div>";
  }
  function okTyped(x, t) { const a = norm(t); if (!a) return false; return [x.right].concat(x.alts || []).some(r => norm(r) === a || (x.kind === "fix" && x.ctx && norm(r).length > 0 && norm(x.ctx.replace(x.wrong, r)) === a)); }
  function listHtml() {
    const L = live().filter(x => filt === "all" ? true : filt === "done" ? x.done : x.src === filt).sort((a, b) => b.at - a.at);
    const srcs = [...new Set(live().map(x => x.src))];
    let s = '<div class="eb-seg">' + [["all", "全部"]].concat(srcs.map(k => [k, SRC[k] || k]), [["done", "✓ 已掌握"]]).map(([k, t]) => '<button data-f="' + k + '" class="' + (filt === k ? "on" : "") + '">' + t + "</button>").join("") + "</div>";
    if (!L.length) return s + '<div class="eb-empty">没有</div>';
    return s + L.slice(0, 300).map(x => '<div class="eb-li"><div class="t">' + (x.wrong ? '<span style="color:var(--ui-red);text-decoration:line-through">' + esc(x.wrong) + "</span> → " : "") + "<b>" + esc(x.right) + "</b>" + (x.q && x.kind !== "fix" ? "<small>" + esc(x.q) + "</small>" : x.ctx ? "<small>" + esc(x.ctx.slice(0, 140)) + "</small>" : "") + "<small>" + (SRC[x.src] || "") + " · " + (x.done ? "已掌握" : "第 " + (x.lv || 0) + " / 5 级") + " · 错过 " + ((x.bad || 0) + 1) + " 次</small></div><button data-del=\"" + x.id + '" title="删掉">✕</button></div>').join("") + (L.length > 300 ? '<div class="eb-empty">只显示最近 300 条</div>' : "");
  }
  function draw() {
    if (!root) return; ensureCss();
    const L = live(), D = due().length, M = L.filter(x => x.done).length;
    let s = '<div class="eb-top"><div class="eb-n"><span>今天要复习 <b>' + D + "</b></span><span>在复习 <b>" + (L.length - M) + "</b></span><span>已掌握 <b>" + M + '</b></span></div><span class="sp"></span><button class="ui-btn" data-a="view">' + (view === "do" ? "📋 全部错题" : "← 去复习") + "</button></div>";
    if (view === "list") s += listHtml();
    else {
      if (!cur || cur.del || cur.done || cur.due > Date.now()) nextCard();
      if (cur) s += cardHtml(cur);
      else s += '<div class="eb-empty">' + (sess.ok + sess.bad ? "🎉 今天的错题复习完了（这轮答对 " + sess.ok + "，答错 " + sess.bad + "）<br>" : "") + (L.length ? "今天没有要复习的错题。" : "还没有错题。<br>写作批改、读后小测、雅思模考、口语模拟考里做错的，会自动收到这里，按 1 / 3 / 7 / 16 / 35 天复习。") + "</div>";
    }
    root.innerHTML = '<div id="errbox">' + s + "</div>";
    const inp = root.querySelector("#eb-in"); if (inp) { inp.oninput = () => (typed = inp.value); inp.onkeydown = e => { if (e.key === "Enter") { typed = inp.value; shown = true; draw(); } }; }
  }
  function onClick(e) {
    const b = e.target.closest("button"); if (!b || !root.contains(b)) return;
    const a = b.dataset.a;
    if (a === "view") { view = view === "do" ? "list" : "do"; return draw(); }
    if (b.dataset.f) { filt = b.dataset.f; return draw(); }
    if (b.dataset.del) { remove(b.dataset.del); return draw(); }
    if (!cur) return;
    if (a === "show") { const inp = root.querySelector("#eb-in"); if (inp) typed = inp.value; shown = true; if (cur.kind === "say") say(cur.right); return draw(); }
    if (a === "skip") { queue.push(cur.id); cur = null; nextCard(); return draw(); }
    if (a === "say") return say(cur.ctx || cur.right);
    if (a === "sayr") return say(cur.kind === "fix" && cur.ctx && cur.wrong ? cur.ctx.replace(cur.wrong, cur.right) : cur.right);
    if (b.dataset.o != null && pick == null) { pick = +b.dataset.o; shown = true; return draw(); }
    if (b.dataset.g != null) { const g = b.dataset.g === "1"; grade(cur.id, g); g ? sess.ok++ : sess.bad++; if (!g) queue.push(cur.id); cur = null; nextCard(); return draw(); }
  }
  window.errShow = function (el) {
    if (!el) return; if (root !== el) { root = el; el.addEventListener("click", onClick); }
    draw(); pull().then(() => { if (!cur && root && root.isConnected) draw(); });
  };
  // 打开网页时停在「❌ 错题」（index.html 先恢复了模式，这个文件后加载）：补画一次
  if (document.documentElement.getAttribute("data-mode") === "err") { const ew = document.getElementById("errwrap"); if (ew && ew.style.display !== "none") window.errShow(ew); }
  // 打开网站一会儿后拉一次后台（换设备也能看到错题数）
  setTimeout(() => pull(), 4000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
})();
