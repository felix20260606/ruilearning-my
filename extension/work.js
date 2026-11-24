// 🙈 上班模式（YouTube / B 站视频页）：在公司不方便看视频时，换个不显眼的方式学
// 画面（视频本身怎么藏）和大小可以随意搭配，选好后每个视频页自动生效：
//   画面：清楚 / 🧊 毛玻璃 / 🌑 暗屏 / 📋 遮罩（表格 / 文档 / 代码盖在画面上，字幕照常在最上面）/ 💬 只留字幕
//   大小：原样 / 🔳 小框（播放器缩到屏幕角落，大中小三档、四个角）；可选「鼠标停在画面上时看清」
//   🎬 视频小窗：浏览器自带的画中画，视频浮在所有软件上面
// 另外三种方式，也都能换样子（皮肤），选择存在插件设置（chrome.storage.sync）里：
//   ① 📌 字幕小窗：Chrome 的「文档画中画」——一个永远在最上层、可以拖到角落的小窗，只显示当前字幕（原文 + 中文）和上一句 / 暂停 / 下一句；
//      视频在后台标签页里照常放（戴耳机听），你在别的软件里工作，余光看字幕。皮肤：聊天通知 / 终端日志 / 便签
//   ② 📄 伪装阅读：视频画面整个盖住，字幕一句句排成代码 / 文档 / 表格的样子（中文像注释），当前句高亮，点哪句从哪句放
//   ③ 🙈 老板键：按一下（默认 ` 键，可在设置里换成 F2 / 连按两下 Esc），立刻暂停、静音、关掉小窗，整页盖上一个像在工作的界面
//      （代码编辑器 / 表格 / 文档），标签页标题和图标也跟着换；再按一下回到原样（声音、播放状态恢复）
// 播放器控制栏 BAN 开关旁边的 🙈 打开菜单；任意网页的生词复习卡在 page.js。
// 依赖 content.js 的 window.VS_WORK（字幕、译文、当前句、跳句）
(function () {
  "use strict";
  if (window.__vsWork) return; window.__vsWork = true;
  const API = () => window.VS_WORK || null;
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W = { workBoss: "code", workPip: "chat", workRead: "code", workKey: "`", workBtn: true, workLook: "clear", workCover: "sheet", workSize: "full", workMini: "m", workCorner: "br", workPeek: false };
  const load = () => { if (alive()) try { chrome.storage.sync.get(W, v => { W = Object.assign(W, v || {}); paintBtn(); }); } catch (e) {} };
  const setW = (k, v) => { W[k] = v; if (alive()) try { chrome.storage.sync.set({ [k]: v }); } catch (e) {} };
  load(); try { chrome.storage.onChanged.addListener((c, a) => { if (a !== "sync") return; for (const k in c) if (k in W) W[k] = c[k].newValue; paintBtn(); }); } catch (e) {}

  // ---------- 字幕：当前是哪一句（直接按视频时间算，后台标签页定时器变慢也准） ----------
  function curCue() {
    const A = API(); if (!A) return null; const cues = A.cues(), v = A.video(); if (!cues || !cues.length || !v) return null;
    const i = A.find(v.currentTime); if (i < 0) return { i: -1, c: null, zh: "" };
    const tr = A.trans(); if (tr[i] === undefined) A.fetchTrans(i, 6);
    return { i, c: cues[i], zh: tr[i] || "" };
  }
  const playPause = () => { const v = API() && API().video(); if (!v) return; if (v.paused) v.play(); else v.pause(); };
  const seekTo = i => { const A = API(), cues = A && A.cues(), v = A && A.video(); if (!v || !cues[i]) return; v.currentTime = cues[i].s + 0.01; if (v.paused) v.play(); };

  // ---------- ① 字幕小窗（文档画中画） ----------
  const PIP_SKINS = { chat: "💬 聊天通知", term: "🖥 终端日志", note: "📝 便签" };
  const PIP_CSS = {
    chat: "body{margin:0;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#1d1c1d}.w{display:flex;gap:10px;padding:10px 12px}.av{flex:0 0 34px;height:34px;border-radius:6px;background:#4a154b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}.hd{font-size:13px}.hd b{margin-right:6px}.hd span{color:#616061;font-size:12px}.en{margin-top:2px}.zh{color:#616061;font-size:13px;margin-top:2px}.bar{position:fixed;right:6px;bottom:4px;display:flex;gap:2px;opacity:.25}.bar:hover{opacity:1}button{border:0;background:#f4f4f4;border-radius:5px;font-size:12px;padding:2px 6px;cursor:pointer;color:#1d1c1d}",
    term: "body{margin:0;font:12.5px/1.5 Menlo,Consolas,monospace;background:#0c0c0c;color:#cccccc}.w{padding:8px 10px}.p{color:#16c60c}.en::before{content:'[INFO]  ';color:#3b78ff}.zh::before{content:'[DEBUG] ';color:#767676}.zh{color:#9a9a9a}.hd{color:#767676}.bar{position:fixed;right:6px;bottom:4px;display:flex;gap:2px;opacity:.2}.bar:hover{opacity:1}button{border:1px solid #333;background:#1a1a1a;color:#ccc;border-radius:3px;font:inherit;font-size:11px;padding:1px 5px;cursor:pointer}",
    note: "body{margin:0;font:15px/1.5 'Comic Sans MS','Chalkboard SE','Kaiti SC',cursive;background:#fff7a8;color:#3a3a2a}.w{padding:10px 14px}.hd{font-size:12px;color:#8a8456}.en{margin-top:2px}.zh{color:#6d6a4c;font-size:13.5px;margin-top:2px}.bar{position:fixed;right:6px;bottom:4px;display:flex;gap:2px;opacity:.25}.bar:hover{opacity:1}button{border:0;background:#f1e58a;border-radius:4px;font:inherit;font-size:12px;padding:1px 6px;cursor:pointer;color:#3a3a2a}",
  };
  let pip = null, pipT = 0, pipLast = "", pipZh = true;
  function pipHtml(skin, x) {
    const en = x && x.c ? esc(x.c.t) : "…", zh = pipZh && x && x.zh ? esc(x.zh) : "";
    const now = new Date(), hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    if (skin === "term") return '<div class="w"><div class="hd"><span class="p">$</span> tail -f logs/app.log</div><div class="en">' + en + "</div>" + (zh ? '<div class="zh">' + zh + "</div>" : "") + "</div>";
    if (skin === "note") return '<div class="w"><div class="hd">待办 · ' + hm + '</div><div class="en">' + en + "</div>" + (zh ? '<div class="zh">' + zh + "</div>" : "") + "</div>";
    return '<div class="w"><div class="av">PM</div><div><div class="hd"><b>Project Bot</b><span>' + hm + '</span></div><div class="en">' + en + "</div>" + (zh ? '<div class="zh">' + zh + "</div>" : "") + "</div></div>";
  }
  async function pipOpen() {
    if (pip) { pipClose(); return; }
    if (!window.documentPictureInPicture) { toast("这个浏览器不支持置顶小窗（需要 Chrome / Edge 116 以上）：可以用「伪装阅读」"); return; }
    if (!(API() && API().cues().length)) { toast("这个视频还没有字幕"); return; }
    try { pip = await window.documentPictureInPicture.requestWindow({ width: 460, height: W.workPip === "term" ? 120 : 110 }); }
    catch (e) { pip = null; toast("小窗没打开：" + (e && e.message || e)); return; }
    const d = pip.document;
    const st = d.createElement("style"); st.textContent = PIP_CSS[W.workPip] || PIP_CSS.chat; d.head.append(st);
    d.body.innerHTML = '<div id="c"></div><div class="bar"><button data-a="prev" title="上一句">⏮</button><button data-a="pp" title="暂停 / 继续">⏯</button><button data-a="rep" title="这句再听">🔁</button><button data-a="next" title="下一句">⏭</button><button data-a="zh" title="中文 显示 / 隐藏">中</button><button data-a="skin" title="换样子">🎨</button></div>';
    d.addEventListener("click", e => {
      const b = e.target.closest("button[data-a]"); if (!b) return; const a = b.dataset.a, A = API(); if (!A) return;
      if (a === "prev") A.jump(-1); else if (a === "next") A.jump(1); else if (a === "rep") A.replay(); else if (a === "pp") playPause();
      else if (a === "zh") { pipZh = !pipZh; pipLast = ""; }
      else if (a === "skin") { const ks = Object.keys(PIP_SKINS), nx = ks[(ks.indexOf(W.workPip) + 1) % ks.length]; setW("workPip", nx); st.textContent = PIP_CSS[nx]; pipLast = ""; }
    });
    d.addEventListener("keydown", onKey, true); // 小窗在前台时也能按老板键
    pip.addEventListener("pagehide", () => { pip = null; clearInterval(pipT); paintBtn(); });
    const draw = () => { if (!pip) return; const x = curCue(), h = pipHtml(W.workPip, x); if (h !== pipLast) { pipLast = h; const c = d.getElementById("c"); if (c) c.innerHTML = h; } };
    pipT = pip.setInterval(draw, 250); draw(); paintBtn();
  }
  function pipClose() { if (pip) try { pip.close(); } catch (e) {} pip = null; clearInterval(pipT); paintBtn(); }

  // ---------- ② 伪装阅读 ----------
  const READ_SKINS = { code: "💻 代码", doc: "📄 文档", sheet: "📊 表格" };
  let rd = null, rdT = 0, rdLast = -2;
  const READ_CSS = `
  #vs-wk-read{position:fixed;inset:0;z-index:2147483600;overflow:auto;display:flex;flex-direction:column}
  #vs-wk-read .tb{position:sticky;top:0;display:flex;align-items:center;gap:6px;padding:6px 10px;font:12px -apple-system,sans-serif;z-index:2}
  #vs-wk-read .tb .sp{flex:1}#vs-wk-read .tb button{border:0;border-radius:4px;padding:3px 8px;font:inherit;cursor:pointer}
  #vs-wk-read .bd{flex:1;padding:10px 0 60vh}
  #vs-wk-read.code{background:#1e1e1e;color:#d4d4d4;font:13.5px/1.65 Menlo,Consolas,'Courier New',monospace}
  #vs-wk-read.code .tb{background:#252526;color:#ccc}#vs-wk-read.code .tb button{background:#3a3d41;color:#ddd}
  #vs-wk-read.code .ln{display:flex;cursor:pointer;padding:0 14px}#vs-wk-read.code .ln:hover{background:#2a2d2e}#vs-wk-read.code .ln.on{background:#264f78}
  #vs-wk-read.code .no{width:42px;flex:0 0 42px;color:#858585;text-align:right;padding-right:16px}#vs-wk-read.code .kw{color:#569cd6}#vs-wk-read.code .fn{color:#dcdcaa}#vs-wk-read.code .str{color:#ce9178}#vs-wk-read.code .cm{color:#6a9955}
  #vs-wk-read.doc{background:#f1f3f4;color:#202124;font:15px/1.75 Arial,'PingFang SC',sans-serif}
  #vs-wk-read.doc .tb{background:#fff;border-bottom:1px solid #dadce0;color:#444}#vs-wk-read.doc .tb button{background:#f1f3f4;color:#333}
  #vs-wk-read.doc .bd{max-width:760px;margin:16px auto;background:#fff;padding:40px 56px 60vh;box-shadow:0 1px 3px rgba(60,64,67,.3)}
  #vs-wk-read.doc .ln{cursor:pointer;margin:0 0 10px;border-radius:3px}#vs-wk-read.doc .ln.on{background:#e8f0fe}#vs-wk-read.doc .zh{color:#5f6368;font-size:13.5px}
  #vs-wk-read.sheet{background:#fff;color:#202124;font:13px Arial,'PingFang SC',sans-serif}
  #vs-wk-read.sheet .tb{background:#f8f9fa;border-bottom:1px solid #dadce0;color:#444}#vs-wk-read.sheet .tb button{background:#e8eaed;color:#333}
  #vs-wk-read.sheet table{border-collapse:collapse;width:100%}#vs-wk-read.sheet td,#vs-wk-read.sheet th{border:1px solid #e2e3e3;padding:3px 8px;text-align:left;vertical-align:top}
  #vs-wk-read.sheet th{background:#f8f9fa;color:#5f6368;font-weight:400}#vs-wk-read.sheet tr.ln{cursor:pointer}#vs-wk-read.sheet tr.on td{background:#e8f0fe}#vs-wk-read.sheet td.n{background:#f8f9fa;color:#5f6368;width:36px;text-align:center}`;
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  function readBody(skin, cues, tr) {
    if (skin === "doc") return cues.map((c, i) => '<div class="ln" data-i="' + i + '">' + esc(c.t) + (tr[i] ? '<div class="zh">' + esc(tr[i]) + "</div>" : "") + "</div>").join("");
    if (skin === "sheet") return '<table><tr><th></th><th>时间</th><th>Text</th><th>备注</th></tr>' + cues.map((c, i) => '<tr class="ln" data-i="' + i + '"><td class="n">' + (i + 1) + "</td><td>" + fmt(c.s) + "</td><td>" + esc(c.t) + "</td><td>" + esc(tr[i] || "") + "</td></tr>").join("") + "</table>";
    return '<div class="ln"><span class="no">1</span><span><span class="kw">const</span> notes = [</span></div>' + cues.map((c, i) => '<div class="ln" data-i="' + i + '"><span class="no">' + (i + 2) + '</span><span>&nbsp;&nbsp;<span class="fn">line</span>(<span class="str">"' + esc(c.t).replace(/"/g, "\\&quot;") + '"</span>),' + (tr[i] ? ' <span class="cm">// ' + esc(tr[i]) + "</span>" : "") + "</span></div>").join("") + '<div class="ln"><span class="no">' + (cues.length + 2) + "</span><span>];</span></div>";
  }
  function readOpen() {
    if (rd) { readClose(); return; }
    const A = API(); if (!(A && A.cues().length)) { toast("这个视频还没有字幕"); return; }
    if (!document.getElementById("vs-wk-read-css")) { const s = document.createElement("style"); s.id = "vs-wk-read-css"; s.textContent = READ_CSS; document.documentElement.append(s); }
    rd = document.createElement("div"); rd.id = "vs-wk-read"; document.documentElement.append(rd);
    rd.addEventListener("click", e => {
      const b = e.target.closest("button[data-a]"); if (b) { const a = b.dataset.a; if (a === "x") readClose(); else if (a === "pp") playPause(); else if (a === "prev") API().jump(-1); else if (a === "next") API().jump(1); else if (a === "skin") { const ks = Object.keys(READ_SKINS); setW("workRead", ks[(ks.indexOf(W.workRead) + 1) % ks.length]); readPaint(true); } return; }
      const ln = e.target.closest("[data-i]"); if (ln) seekTo(+ln.dataset.i);
    });
    readPaint(true); rdT = setInterval(() => readPaint(false), 300); paintBtn();
  }
  function readPaint(full) {
    if (!rd) return; const A = API(); if (!A) return; const cues = A.cues(), tr = A.trans(), x = curCue(), i = x ? x.i : -1;
    if (full || rd.dataset.n !== String(cues.length) || rd.dataset.tr !== String(tr.filter(Boolean).length)) {
      rd.className = W.workRead in READ_SKINS ? W.workRead : "code"; rd.dataset.n = cues.length; rd.dataset.tr = tr.filter(Boolean).length;
      const title = { code: "notes.ts — workspace", doc: "会议纪要 - 文档", sheet: "数据汇总 - 表格" }[rd.className];
      rd.innerHTML = '<div class="tb"><b>' + title + '</b><span class="sp"></span><button data-a="prev" title="上一句">⏮</button><button data-a="pp" title="暂停 / 继续">⏯</button><button data-a="next" title="下一句">⏭</button><button data-a="skin" title="换样子">🎨</button><button data-a="x" title="退出">✕</button></div><div class="bd">' + readBody(rd.className, cues, tr) + "</div>";
      rdLast = -2; if (cues.length) A.fetchTrans(Math.max(0, i), 30);
    }
    if (i !== rdLast) { rdLast = i; rd.querySelectorAll(".ln.on").forEach(el => el.classList.remove("on")); const el = i >= 0 && rd.querySelector('[data-i="' + i + '"]'); if (el) { el.classList.add("on"); const r = el.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 40) el.scrollIntoView({ block: "center" }); } }
  }
  function readClose() { clearInterval(rdT); if (rd) rd.remove(); rd = null; paintBtn(); }

  // ---------- ③ 老板键 ----------
  const BOSS_SKINS = { code: "💻 代码编辑器", sheet: "📊 表格", doc: "📄 文档" };
  let boss = null;
  const ICON = { code: "#0078d4", sheet: "#0f9d58", doc: "#4285f4" };
  function bossHtml(skin) {
    if (skin === "sheet") {
      const cols = ["", "A", "B", "C", "D", "E", "F", "G"], hdr = ["项目", "负责人", "Q3", "Q4", "完成率", "状态", "备注"], rows = [["接口重构", "Ray", "38", "52", "72%", "进行中", "下周评审"], ["性能优化", "Lin", "21", "30", "88%", "进行中", ""], ["报表导出", "Tan", "12", "12", "100%", "已完成", "已上线"], ["权限改造", "Ray", "17", "25", "45%", "进行中", "等确认"], ["单元测试", "Wong", "64", "80", "61%", "进行中", ""], ["日志平台", "Lee", "9", "15", "30%", "未开始", "排期中"], ["数据迁移", "Ray", "33", "33", "100%", "已完成", ""], ["监控告警", "Lin", "18", "26", "54%", "进行中", ""]];
      let t = '<table><tr>' + cols.map(c => "<th>" + c + "</th>").join("") + '</tr><tr><th>1</th>' + hdr.map(h => "<td><b>" + h + "</b></td>").join("") + "</tr>";
      rows.forEach((r, i) => { t += "<tr><th>" + (i + 2) + "</th>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>"; });
      for (let i = rows.length + 2; i < 36; i++) t += "<tr><th>" + i + "</th>" + "<td></td>".repeat(7) + "</tr>";
      return '<div class="bar s">文件　编辑　查看　插入　格式　数据　工具</div><div class="fx s">fx　=AVERAGE(E2:E9)</div><div class="grid">' + t + "</table></div>";
    }
    if (skin === "doc") return '<div class="bar d">文件　编辑　查看　插入　格式　工具</div><div class="page"><h1>项目周会纪要</h1><p class="m">时间：本周四 10:00　参会：产品、后端、前端、测试</p><h2>一、上周进展</h2><p>接口重构已完成 70%，剩余的订单模块预计下周三提测；性能优化方面，首页加载时间从 2.4 秒降到 1.6 秒，主要来自缓存和图片懒加载。</p><h2>二、本周计划</h2><p>1. 完成订单模块重构并补齐单元测试；2. 和测试一起确认回归范围；3. 整理监控告警的阈值，减少误报。</p><h2>三、风险和需要支持的事项</h2><p>权限改造依赖安全团队的评审结论，目前还在等待；如果本周没有结论，需要调整排期。数据迁移脚本已在预发环境跑通，等运维确认窗口。</p><h2>四、待办</h2><p>□ Ray：周三前提交订单模块 PR<br>□ Lin：整理性能对比数据<br>□ Tan：确认报表导出的字段口径</p></div>';
    const code = ["import { db } from \"./db\";", "import { cache } from \"./cache\";", "", "export async function getOrders(userId: string, page = 1) {", "  const key = `orders:${userId}:${page}`;", "  const hit = await cache.get(key);", "  if (hit) return hit;", "", "  const rows = await db.orders.findMany({", "    where: { userId, deleted: false },", "    orderBy: { createdAt: \"desc\" },", "    skip: (page - 1) * 20,", "    take: 20,", "  });", "", "  await cache.set(key, rows, { ttl: 60 });", "  return rows;", "}", "", "export function summarize(rows: Order[]) {", "  return rows.reduce((acc, r) => {", "    acc.total += r.amount;", "    acc.count += 1;", "    return acc;", "  }, { total: 0, count: 0 });", "}"];
    return '<div class="bar c"><span>orders.ts — backend</span></div><div class="side">EXPLORER<br><br>▾ src<br>&nbsp;&nbsp;cache.ts<br>&nbsp;&nbsp;db.ts<br>&nbsp;&nbsp;<b>orders.ts</b><br>&nbsp;&nbsp;users.ts<br>▸ tests<br>package.json<br>tsconfig.json</div><div class="ed">' + code.map((l, i) => '<div><span class="no">' + (i + 1) + "</span>" + esc(l).replace(/\b(import|from|export|async|function|const|await|return|if)\b/g, '<span class="kw">$1</span>').replace(/(&quot;[^&]*&quot;|`[^`]*`)/g, '<span class="str">$1</span>') + "</div>").join("") + "</div>";
  }
  const BOSS_CSS = `
  #vs-wk-boss{position:fixed;inset:0;z-index:2147483647;overflow:hidden;cursor:default}
  #vs-wk-boss.code{background:#1e1e1e;color:#d4d4d4;font:13.5px/1.6 Menlo,Consolas,monospace;display:grid;grid-template-columns:220px 1fr;grid-template-rows:32px 1fr}
  #vs-wk-boss.code .bar{grid-column:1/3;background:#3c3c3c;color:#ccc;font:12px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center}
  #vs-wk-boss.code .side{background:#252526;color:#ccc;font:12.5px/1.9 -apple-system,sans-serif;padding:10px 14px}#vs-wk-boss.code .ed{padding:10px 0;white-space:pre;overflow:auto}
  #vs-wk-boss.code .no{display:inline-block;width:44px;color:#858585;text-align:right;padding-right:18px}#vs-wk-boss.code .kw{color:#c586c0}#vs-wk-boss.code .str{color:#ce9178}
  #vs-wk-boss.sheet{background:#fff;color:#202124;font:13px Arial,'PingFang SC',sans-serif;display:flex;flex-direction:column}
  #vs-wk-boss .bar.s,#vs-wk-boss .bar.d{background:#f9fbfd;border-bottom:1px solid #dadce0;padding:10px 16px;color:#444}#vs-wk-boss .fx{padding:6px 16px;border-bottom:1px solid #dadce0;color:#444}
  #vs-wk-boss .grid{overflow:auto;flex:1}#vs-wk-boss table{border-collapse:collapse}#vs-wk-boss th{background:#f8f9fa;color:#5f6368;font-weight:400;border:1px solid #e2e3e3;min-width:36px;padding:3px 6px}#vs-wk-boss td{border:1px solid #e2e3e3;min-width:96px;height:21px;padding:2px 6px}
  #vs-wk-boss.doc{background:#f1f3f4;color:#202124;font:15px/1.8 Arial,'PingFang SC',sans-serif;overflow:auto}
  #vs-wk-boss .page{max-width:780px;margin:18px auto;background:#fff;padding:56px 72px;box-shadow:0 1px 3px rgba(60,64,67,.3);min-height:100vh}#vs-wk-boss h1{font-size:24px;margin:0 0 6px}#vs-wk-boss h2{font-size:16px;margin:22px 0 6px}#vs-wk-boss .m{color:#5f6368;font-size:13px}`;
  const COVER_CSS = BOSS_CSS.replace(/#vs-wk-boss/g, ":is(#vs-wk-boss,#vs-wk-cover)");
  // ---------- 画面 / 大小 ----------
  const LOOKS = { clear: "清楚", blur: "🧊 毛玻璃", dim: "🌑 暗屏", cover: "📋 遮罩", sub: "💬 只留字幕" };
  const COVER_SKINS = { sheet: "📊 表格", doc: "📄 文档", code: "💻 代码" };
  const SIZES = { full: "原样", mini: "🔳 小框" }, MINIS = { s: "小", m: "中", l: "大" }, CORNERS = { br: "↘", bl: "↙", tr: "↗", tl: "↖" };
  const LOOK_CSS = `
  html.vs-lk-blur .vs-pl video{filter:blur(18px) saturate(.6)!important}
  html.vs-lk-dim .vs-pl video{filter:brightness(.08)!important}
  html.vs-lk-sub .vs-pl video{opacity:0!important}
  .vs-pl video{transition:filter .25s,opacity .25s}html.vs-lk-blur .vs-pl video{clip-path:inset(0)} /* 模糊不要溢出画面边缘 */
  #vs-wk-cover{position:absolute!important;inset:0!important;z-index:55!important;pointer-events:none;overflow:hidden!important;transition:opacity .25s}
  html.vs-bili #vs-wk-cover{z-index:110!important}
  #vs-wk-cover .page{margin:0 auto!important;padding:28px 40px!important}#vs-wk-cover.code{grid-template-columns:180px 1fr!important}
  html.vs-peek .vs-pl:hover video{filter:none!important;opacity:1!important}html.vs-peek .vs-pl:hover #vs-wk-cover{opacity:0}
  html.vs-sz-mini #movie_player.vs-pl,html.vs-sz-mini.vs-bili .bpx-player-container{position:fixed!important;z-index:2100!important;width:var(--vs-mw,400px)!important;height:calc(var(--vs-mw,400px) * .5625)!important;top:auto;left:auto;right:auto;bottom:auto;border-radius:10px!important;overflow:hidden!important;box-shadow:0 10px 30px rgba(0,0,0,.45)!important;margin:0!important}
  html.vs-sz-mini #movie_player.vs-pl video.html5-main-video{left:0!important;top:0!important;width:100%!important;height:100%!important;object-fit:contain}
  html.vs-sz-mini #movie_player.vs-pl .html5-video-container{width:100%;height:100%}
  html.vs-sz-mini.vs-bili .bpx-player-container video{width:100%!important;height:100%!important;object-fit:contain}
  html.vs-ms-s{--vs-mw:300px}html.vs-ms-m{--vs-mw:400px}html.vs-ms-l{--vs-mw:540px}
  html.vs-cn-br :is(#movie_player.vs-pl,.bpx-player-container){right:16px!important;bottom:16px!important;top:auto!important;left:auto!important}
  html.vs-cn-bl :is(#movie_player.vs-pl,.bpx-player-container){left:16px!important;bottom:16px!important;top:auto!important;right:auto!important}
  html.vs-cn-tr :is(#movie_player.vs-pl,.bpx-player-container){right:16px!important;top:72px!important;bottom:auto!important;left:auto!important}
  html.vs-cn-tl :is(#movie_player.vs-pl,.bpx-player-container){left:16px!important;top:72px!important;bottom:auto!important;right:auto!important}
  html.vs-sz-mini .vs-pl #vs-sub{width:94%!important;bottom:15%!important}html.vs-sz-mini .vs-pl #vs-sub .vs-box{padding:3px 8px!important;border-radius:7px!important}
  html.vs-sz-mini .vs-pl #vs-sub .vs-o{font-size:calc(14px * var(--vs-os,1))!important;line-height:1.35!important}
  html.vs-sz-mini .vs-pl #vs-sub :is(.vs-t,.vs-h){font-size:calc(12px * var(--vs-ts,1))!important}`;
  function ensureCss() { if (document.getElementById("vs-wk-css")) return; const s = document.createElement("style"); s.id = "vs-wk-css"; s.textContent = COVER_CSS + LOOK_CSS; document.documentElement.append(s); }
  let miniOn = false;
  function applyLook(on) {
    const H = document.documentElement.classList, lk = on && W.workLook in LOOKS ? W.workLook : "clear";
    for (const k in LOOKS) H.toggle("vs-lk-" + k, k === lk && k !== "clear");
    H.toggle("vs-peek", on && !!W.workPeek && lk !== "clear");
    const mini = on && W.workSize === "mini" && !document.fullscreenElement;
    for (const x in MINIS) H.toggle("vs-ms-" + x, mini && (W.workMini in MINIS ? W.workMini : "m") === x);
    for (const x in CORNERS) H.toggle("vs-cn-" + x, mini && (W.workCorner in CORNERS ? W.workCorner : "br") === x);
    if (mini !== miniOn) { miniOn = mini; H.toggle("vs-sz-mini", mini); setTimeout(() => window.dispatchEvent(new Event("resize")), 60); } // 让 YouTube 按新大小重排控制栏
    if (lk !== "clear" || mini) ensureCss();
    let c = document.getElementById("vs-wk-cover"); const p = document.querySelector(".vs-pl");
    if (lk === "cover" && p) {
      const skin = W.workCover in COVER_SKINS ? W.workCover : "sheet";
      if (!c) { c = document.createElement("div"); c.id = "vs-wk-cover"; }
      if (c.parentNode !== p) p.append(c);
      if (c.dataset.s !== skin) { c.dataset.s = skin; c.className = skin; c.innerHTML = bossHtml(skin); }
    } else if (c) c.remove();
  }
  document.addEventListener("fullscreenchange", () => paintBtn());
  function pipVideo() {
    const v = API() && API().video(); if (!v) return;
    if (document.pictureInPictureElement) { document.exitPictureInPicture().catch(() => {}); return; }
    if (!document.pictureInPictureEnabled || !v.requestPictureInPicture) { toast("这个浏览器不支持视频小窗"); return; }
    v.requestPictureInPicture().catch(e => toast("视频小窗没打开：" + (e && e.message || e)));
  }
  function setFav(href) { let l = document.querySelector('link[rel~="icon"]'); const old = l ? l.href : ""; if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.append(l); } l.href = href; return old; }
  function bossToggle() {
    if (boss) { // 回到原样
      boss.el.remove(); document.title = boss.title; if (boss.fav) setFav(boss.fav);
      const v = API() && API().video(); if (v) { v.muted = boss.muted; if (boss.playing) v.play(); }
      if (boss.read) readOpen();
      boss = null; return;
    }
    const v = API() && API().video(); const st = { title: document.title, muted: v ? v.muted : false, playing: v ? !v.paused : false, read: !!rd };
    if (v) { v.pause(); v.muted = true; } pipClose(); if (rd) readClose(); hideMenu();
    ensureCss();
    const skin = W.workBoss in BOSS_SKINS ? W.workBoss : "code", el = document.createElement("div"); el.id = "vs-wk-boss"; el.className = skin; el.innerHTML = bossHtml(skin);
    document.documentElement.append(el);
    document.title = { code: "orders.ts — backend — Visual Studio Code", sheet: "项目进度 - 表格", doc: "项目周会纪要 - 文档" }[skin];
    st.fav = setFav("data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="' + ICON[skin] + '"/></svg>'));
    st.el = el; boss = st;
  }
  const KEYS = { "`": e => e.key === "`" && !e.ctrlKey && !e.metaKey && !e.altKey, F2: e => e.key === "F2", "Esc×2": null };
  let escAt = 0;
  function onKey(e) {
    if (!alive()) return;
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const k = W.workKey in KEYS ? W.workKey : "`";
    let hit = false;
    if (k === "Esc×2") { if (e.key === "Escape") { const now = Date.now(); hit = now - escAt < 450; escAt = hit ? 0 : now; } }
    else hit = !typing && KEYS[k](e);
    if (!hit) return;
    e.preventDefault(); e.stopPropagation(); bossToggle();
  }
  window.addEventListener("keydown", onKey, true);

  // ---------- 🙈 菜单：入口在播放器控制栏的 BAN 开关旁边（齿轮左边） ----------
  let menu = null, anchor = null;
  function toast(m) { const t = document.createElement("div"); t.textContent = m; t.style.cssText = "position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:2147483646;background:rgba(32,33,36,.92);color:#fff;padding:9px 16px;border-radius:10px;font:14px -apple-system,sans-serif;max-width:80vw"; (document.fullscreenElement || document.documentElement).append(t); setTimeout(() => t.remove(), 2600); }
  function hideMenu() { if (menu) menu.style.display = "none"; }
  function paintBtn() {
    const A = API(), on = !!(A && A.enabled() && A.isWatch()), show = on && W.workBtn !== false;
    document.documentElement.classList.toggle("vs-wk-on", show); applyLook(on);
    if (!show) { hideMenu(); return; }
    if (menu && menu.style.display !== "none") drawMenu();
  }
  document.addEventListener("click", e => { if (menu && menu.style.display !== "none" && !menu.contains(e.target) && !(e.target.closest && e.target.closest('[data-a="wk"]'))) hideMenu(); }, true);
  window.VS_WK = { menu: el => { anchor = el; toggleMenu(); } };
  function toggleMenu() { if (!menu) { menu = document.createElement("div"); menu.id = "vs-wk-menu"; menu.addEventListener("click", onMenu); } const host = document.fullscreenElement || document.documentElement; if (menu.parentNode !== host) host.append(menu); if (menu.style.display === "block") { hideMenu(); return; } drawMenu(); menu.style.display = "block"; }
  function drawMenu() {
    const r = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : { left: 10, top: innerHeight - 52 }; menu.style.cssText = "display:block;position:fixed;left:" + Math.max(8, Math.min(innerWidth - 330, r.left - 150)) + "px;bottom:" + Math.max(8, innerHeight - r.top + 12) + "px;z-index:2147483001;width:320px;max-height:calc(100vh - 90px);overflow:auto;background:#26282c;color:#eee;border:1px solid #454950;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.45);padding:10px 12px 12px;font:13.5px/1.5 -apple-system,'PingFang SC',sans-serif";
    const chip = (k, x, label, on) => '<button data-set="' + k + '" data-v="' + x + '" style="border:1px solid ' + (on ? "#9c6ade" : "#454950") + ";background:" + (on ? "rgba(156,106,222,.3)" : "#2d2f34") + ';color:#eee;border-radius:999px;padding:3px 10px;margin:4px 5px 0 0;font:inherit;font-size:13px;cursor:pointer">' + label + "</button>";
    const chips = (k, L) => Object.keys(L).map(x => chip(k, x, L[x], W[k] === x)).join("");
    const hd = t => '<div style="margin-top:10px;color:#9aa0a6;font-size:12px">' + t + "</div>";
    const act = (a, t, on) => '<button data-a="' + a + '" style="border:1px solid ' + (on ? "#9c6ade" : "#454950") + ";background:" + (on ? "rgba(156,106,222,.3)" : "#2d2f34") + ';color:#eee;border-radius:9px;padding:5px 10px;margin:5px 5px 0 0;font:inherit;font-size:13px;cursor:pointer">' + t + "</button>";
    const lk = W.workLook in LOOKS ? W.workLook : "clear", mini = W.workSize === "mini";
    menu.innerHTML = '<b style="font-size:14.5px">🙈 上班模式</b><span style="color:#9aa0a6;font-size:12px">　选好后每个视频都这样</span>' +
      hd("画面（字幕照常显示）") + chips("workLook", LOOKS) +
      (lk === "cover" ? hd("遮罩的样子") + chips("workCover", COVER_SKINS) : "") +
      (lk !== "clear" ? '<label style="display:block;margin-top:6px;font-size:12.5px;cursor:pointer"><input type="checkbox" data-set="workPeek"' + (W.workPeek ? " checked" : "") + ' style="vertical-align:-2px"> 鼠标停在画面上时看清</label>' : "") +
      hd("大小") + chips("workSize", SIZES) +
      (mini ? '<div>' + Object.keys(MINIS).map(x => chip("workMini", x, MINIS[x], (W.workMini || "m") === x)).join("") + '<span style="display:inline-block;width:8px"></span>' + Object.keys(CORNERS).map(x => chip("workCorner", x, CORNERS[x], (W.workCorner || "br") === x)).join("") + "</div>" : "") +
      hd("更多") + act("vpip", "🎬 视频小窗（浮在所有软件上）", !!document.pictureInPictureElement) + act("pip", pip ? "📌 关掉字幕小窗" : "📌 字幕小窗", !!pip) + act("read", rd ? "📄 退出伪装阅读" : "📄 伪装阅读", !!rd) + act("boss", "🙈 老板键", false) +
      hd("字幕小窗样子") + chips("workPip", PIP_SKINS) +
      hd("伪装阅读样子") + chips("workRead", READ_SKINS) +
      hd("老板键样子 · 快捷键") + chips("workBoss", BOSS_SKINS) + '<div>' + Object.keys(KEYS).map(k => chip("workKey", k, esc(k), W.workKey === k)).join("") + "</div>" +
      '<div style="margin-top:8px;color:#9aa0a6;font-size:12px">任意网页定时弹生词卡：在插件设置「🙈 上班模式」里打开</div>';
  }
  function onMenu(e) {
    const b = e.target.closest("button,input[data-set]"); if (!b) return; e.stopPropagation();
    if (b.dataset.set) {
      const k = b.dataset.set; setW(k, b.type === "checkbox" ? b.checked : b.dataset.v);
      if (k === "workRead" && rd) readPaint(true); applyLook(true); drawMenu(); return;
    }
    const a = b.dataset.a; hideMenu();
    if (a === "pip") pipOpen(); else if (a === "vpip") pipVideo(); else if (a === "read") readOpen(); else if (a === "boss") bossToggle();
  }
  setInterval(paintBtn, 1500); paintBtn();
})();
