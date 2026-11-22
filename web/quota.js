/* 🔋 AI 额度面板（「📅 每日」最上面）：Workers AI 免费额度每天 1 万 neurons，00:00 UTC（北京 / 吉隆坡早上 8 点）重置。
   数字来自 GET /api/usage：src = "cf" 时模型用量是 Cloudflare 自己记的精确数字（Pages 配了 CF_API_TOKEN + CF_ACCOUNT_ID）；
   否则是 _worker.js 每次调用 AI 后按官方价格表折算的估算（why 说明为什么没读到 Cloudflare）。功能分布（哪个功能花了多少）一直是网站自己记的。
   显示：今天用了多少 / 还剩多少、多久重置、每个模型用了多少、最近 7 天；所有用到 AI 的功能按「听 · 说 · 读写 · 雅思入门」列出来，
   每张卡写着剩下的额度还能做几次（单次花费优先用最近 7 天实际平均），点一下直接跳到那个功能。
   用法：daily.js 画页面时放 '<div id="dy-quota">' + quotaHtml() + '</div>'；数据回来后这里自己重画那个格子。每次打开页面都是收起的；点「展开」只在这次打开时有效（不记住，不存本机） */
(function () {
  "use strict";
  if (window.quotaHtml) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const LIMIT = 10000;
  const MODELS = [ // 页面上一直列出所有模型（没用到的显示 0）
    ["llama-3.3-70b-instruct-fp8-fast", "Llama 3.3 70B", "写作批改 · AI 陪练 · 出题 · 新闻简单版"],
    ["llama-4-scout-17b-16e-instruct", "Llama 4 Scout", "大模型备用（70B 出错时）"],
    ["aura-1", "Deepgram Aura", "🔊 AI 真人声（句子朗读）"],
    ["whisper-large-v3-turbo", "Whisper Turbo", "听力逐词对时间 · 跟读打分"],
    ["whisper", "Whisper", "语音识别备用"],
    ["m2m100-1.2b", "M2M100", "翻译（谷歌翻译不通时）"],
  ];
  // 所有用到 AI 的地方：[功能（/api/usage 的 f）, 图标, 名字, 单位, 没有实测时的单次估计（按官方价格和平均长度算）, 一次调用几回, 跳到哪]
  const GROUPS = [
    ["🎧 听", [
      ["sme:al", "🎯", "BBC 精听 · 逐词对时间", "期", 47, 6, "sme"],
      ["ai:lquiz", "🧩", "BBC 听后小测", "次", 190, 1, "sme"],
      ["sme:zh", "🀄", "BBC 中文对照（谷歌不通时）", "期", 30, 1, "sme"],
      ["stt", "🎙", "练习课跟读打分", "次", 4, 1, "drill"],
      ["ai:whymiss", "🤔", "为什么没听出来", "次", 50, 1, "drill"],
      ["dw:al", "🇩🇪", "德语慢速新闻对时间", "期", 47, 6, "drill"],
    ]],
    ["🗣 说", [
      ["ai:chat", "🤖", "AI 陪练", "轮", 70, 1, "s:chat"],
      ["ai:chatsum", "📋", "陪练结束总结", "次", 135, 1, "s:chat"],
      ["ai:speak", "🗣", "话题回答点评", "次", 100, 1, "s:topic"],
      ["ai:judge", "⚡", "快问快答判断", "题", 40, 1, "s:quick"],
      ["ai:howto", "🧰", "这句话怎么说", "次", 70, 1, "s:tools"],
      ["tts", "🔊", "AI 语音（新句子）", "句", 80, 1, "s:daily"],
    ]],
    ["📖 读 · ✍️ 写", [
      ["ai:newsimp", "📰", "新闻简单版 + 小测", "篇", 270, 1, "read"],
      ["ai:write", "✍️", "写作批改", "篇", 250, 1, "write"],
      ["ai:useword", "📘", "用生词造句（每日一练）", "句", 50, 1, "useword"],
    ]],
    ["🎓 雅思 · 🌱 入门", [
      ["ai:exam", "📄", "雅思模考出题", "套", 400, 1, "ielts"],
      ["ai:ieltsscript", "🎙", "雅思听力对话 / 独白", "篇", 260, 1, "ielts"],
      ["ai:coach", "🧭", "AI 教练定 7 天计划", "次", 230, 1, "coach"],
    ]],
  ];
  function goTo(g) { // 跳到那个功能（英语的标签：window.enShow(标签, 小标签)）
    const en = (w, sub) => { if (typeof window.enShow === "function") window.enShow(w, sub); try { window.scrollTo(0, 0); } catch (e) {} };
    if (g.startsWith("s:")) { // 口语页：切过去以后点那一栏的按钮（同 daily.js 的 toSpeak）
      const sec = g.slice(2); try { localStorage.setItem("speak:sec", JSON.stringify(sec)); } catch (e) {} en("speak");
      let n = 0; const t = setInterval(() => { const b = document.querySelector('#view-speak [data-sec="' + sec + '"]'); if (b) { if (!b.classList.contains("on")) b.click(); clearInterval(t); } else if (++n > 30) clearInterval(t); }, 100);
      return;
    }
    if (g === "sme" || g === "drill") return en("listen", g);
    if (g === "coach") return en("basic", "speak");
    if (g === "useword") { const el = document.querySelector("#view-daily [data-sent]"); if (el) el.scrollIntoView({ block: "center" }); return; }
    en(g);
  }
  const FEAT = { tts: "🔊 AI 语音", stt: "🎙 跟读打分", "sme:al": "🎯 BBC 对时间", "sme:zh": "🀄 BBC 中文", "dw:al": "🇩🇪 DW 对时间", "dw:zh": "🇩🇪 DW 中文", "ai:write": "✍️ 写作批改", "ai:newsimp": "📰 简单版", "ai:chat": "🤖 陪练", "ai:chatsum": "🤖 陪练总结", "ai:speak": "🗣 话题点评", "ai:judge": "⚡ 快问快答", "ai:coach": "🧭 AI 教练", "ai:howto": "🧰 怎么说", "ai:useword": "📘 用生词", "ai:exam": "🎓 出题", "ai:lquiz": "🎧 听力题", "ai:ieltsscript": "🎓 听力模考", "ai:whymiss": "🤔 为什么没听出", "ai:tr": "🀄 翻译" };
  const CSS = `
  .qa{background:linear-gradient(140deg,color-mix(in srgb,var(--ui-pur) 16%,var(--ui-surface)) 0%,var(--ui-surface) 55%);border:1px solid color-mix(in srgb,var(--ui-pur) 38%,var(--ui-line));border-radius:18px;padding:14px 16px;margin:6px 0 14px}
  .qa-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.qa-h b{font-size:16px}.qa-h small{color:var(--ui-muted);font-size:12.5px}.qa-h .sp{flex:1}
  .qa-tg{border:1px solid var(--ui-line-2);background:transparent;color:var(--ui-ink-2);border-radius:999px;font:inherit;font-size:12.5px;padding:3px 10px;cursor:pointer}
  .qa-hero{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;align-items:end;margin-top:10px}
  .qa-big{font-size:40px;font-weight:900;line-height:1;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.qa-big small{font-size:14px;font-weight:700;color:var(--ui-muted);margin-left:6px;letter-spacing:0}
  .qa-cap{color:var(--ui-muted);font-size:12.5px;margin-top:4px}
  .qa-side{font-size:13px;color:var(--ui-ink-2);line-height:1.7;text-align:right}.qa-side b{color:var(--ui-ink);font-variant-numeric:tabular-nums}
  .qa-bar{grid-column:1/-1;position:relative;height:12px;border-radius:999px;background:var(--ui-surface-3,#3a3d43);overflow:hidden;margin-top:6px}
  .qa-bar u{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--ui-pur);transition:width .4s}.qa-bar.warn u{background:var(--ui-orange)}.qa-bar.full u{background:var(--ui-red)}
  .qa-scale{grid-column:1/-1;display:flex;justify-content:space-between;font-size:11px;color:var(--ui-muted);font-variant-numeric:tabular-nums}
  .qa-st{grid-column:1/-1;font-size:13px;font-weight:700}.qa-st.warn{color:var(--ui-orange)}.qa-st.full{color:var(--ui-red)}
  .qa-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:14px;margin-top:14px}
  .qa-box{background:color-mix(in srgb,var(--ui-surface-2) 70%,transparent);border:1px solid var(--ui-line);border-radius:14px;padding:12px 13px}
  .qa-box h4{margin:0 0 8px;font-size:13.5px;display:flex;align-items:baseline;gap:6px}.qa-box h4 small{color:var(--ui-muted);font-weight:500;font-size:12px}
  .qa-m{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:6px 0;border-top:1px solid var(--ui-line)}.qa-m:first-of-type{border-top:0}
  .qa-m b{font-size:13.5px}.qa-m small{display:block;color:var(--ui-muted);font-size:11.5px;line-height:1.45}.qa-m .v{text-align:right;font-size:13.5px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}.qa-m .v small{font-weight:500;display:inline;font-size:12px;color:var(--ui-muted)}
  .qa-m .tr{grid-column:1/-1;height:5px;border-radius:3px;background:var(--ui-surface-3,#3a3d43);overflow:hidden}.qa-m .tr u{display:block;height:100%;border-radius:3px;background:var(--ui-pur)}
  .qa-m.zero{opacity:.55}
  .qa-wk{display:flex;align-items:flex-end;gap:6px;height:96px;position:relative;padding-top:4px}
  .qa-wk .lim{position:absolute;left:0;right:0;border-top:1px dashed var(--ui-line-2)}.qa-wk .lim span{position:absolute;right:0;top:-15px;font-size:10.5px;color:var(--ui-muted)}
  .qa-wk i{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-style:normal;cursor:default}
  .qa-wk i u{display:block;width:100%;max-width:26px;min-height:2px;border-radius:4px 4px 0 0;background:color-mix(in srgb,var(--ui-pur) 55%,transparent)}.qa-wk i.td u{background:var(--ui-pur)}
  .qa-wk i em{font-style:normal;font-size:11px;color:var(--ui-muted);margin-top:4px}.qa-wk i.td em{color:var(--ui-ink);font-weight:800}
  .qa-wk i:hover u{outline:2px solid var(--ui-pur-line)}
  .qa-wks{font-size:12px;color:var(--ui-muted);margin-top:8px;line-height:1.6}
  .qa-grp{margin-top:14px}.qa-grp h5{margin:0 0 6px;font-size:13px;color:var(--ui-ink-2);font-weight:800}
  .qa-acts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .qa-act{position:relative;display:block;text-align:left;width:100%;background:var(--ui-surface-2);border:1px solid var(--ui-line);border-radius:12px;padding:9px 26px 9px 11px;color:inherit;font:inherit;cursor:pointer}
  .qa-act:hover{border-color:var(--ui-pur-line)}.qa-act::after{content:"›";position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--ui-muted);font-size:18px}
  .qa-act .u{font-size:11px;color:var(--ui-pur-text);margin-top:2px}
  .qa-src{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:1px 9px;font-size:11.5px;font-weight:800}.qa-src.cf{background:color-mix(in srgb,var(--ui-green) 20%,transparent);color:var(--ui-green)}.qa-src.est{background:var(--ui-surface-3,#3a3d43);color:var(--ui-ink-2)}
  .qa-set{margin-top:12px;background:var(--ui-surface-2);border:1px dashed var(--ui-line-2);border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.7;color:var(--ui-ink-2)}.qa-set summary{cursor:pointer;font-weight:800;color:var(--ui-ink)}.qa-set ol{margin:6px 0 0;padding-left:20px}.qa-set code{color:var(--ui-orange)}.qa-set a{color:var(--ui-pur-text)}
  .qa-act .n{font-size:22px;font-weight:900;font-variant-numeric:tabular-nums}.qa-act .n small{font-size:12px;font-weight:600;color:var(--ui-muted);margin-left:3px}
  .qa-act .t{font-size:13px;margin-top:1px}.qa-act .c{font-size:11.5px;color:var(--ui-muted);margin-top:2px}
  .qa-ft{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:10px;font-size:12px;color:var(--ui-muted)}.qa-ft span{background:var(--ui-surface-2);border-radius:999px;padding:2px 9px}
  .qa-note{font-size:12px;color:var(--ui-muted);line-height:1.65;margin-top:10px}.qa-note a{color:var(--ui-pur-text)}
  @media(max-width:640px){.qa-grid{grid-template-columns:1fr}.qa-big{font-size:34px}.qa-hero{grid-template-columns:1fr}.qa-side{text-align:left}}`;

  let J = null, at = 0, busy = false, err = "";
  let opened = false; const isOpen = () => opened; // 默认收起，不记住
  function load(force) {
    if (busy || (!force && Date.now() - at < 60e3)) return; busy = true;
    fetch("/api/usage").then(r => r.json()).then(j => { if (j && j.ok) { J = j; err = ""; } else err = "读不到用量"; }).catch(() => { err = "读不到用量（网络不通）"; })
      .then(() => { busy = false; at = Date.now(); paint(); });
  }
  function paint() { const el = document.getElementById("dy-quota"); if (el) el.innerHTML = html(); }
  const day = (j, d) => (j.days && j.days[d]) || { m: {}, f: {}, e: 0 };
  const sum = o => Object.values(o || {}).reduce((a, x) => a + (+x[1] || 0), 0);
  function left(reset) { const ms = Math.max(0, reset - Date.now()), h = Math.floor(ms / 3.6e6), m = Math.floor(ms % 3.6e6 / 6e4); return (h ? h + " 小时 " : "") + m + " 分"; }
  function resetClock(reset) { const d = new Date(reset); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function html() {
    let C = document.getElementById("qa-css"); if (!C) { C = document.createElement("style"); C.id = "qa-css"; C.textContent = CSS; document.head.append(C); }
    load();
    const open = isOpen();
    const badge = J ? (J.src === "cf" ? '<span class="qa-src cf" title="模型用量来自 Cloudflare 后台（几分钟延迟）">✓ Cloudflare 精确</span>' : '<span class="qa-src est" title="' + esc(J.why === "notset" ? "还没接 Cloudflare：展开后看怎么接" : "读 Cloudflare 出错：" + (J.why || "")) + '">估算</span>') : "";
    const head = (t, extra) => '<div class="qa-h"><b>🔋 AI 额度</b>' + badge + '<small>' + t + '</small><span class="sp"></span>' + (extra || "") + '<button class="qa-tg" data-qa="tg">' + (open ? "收起" : "展开 ▾") + "</button></div>";
    if (!J) return '<div class="qa">' + head(err || "正在读今天的用量…") + "</div>";
    const T = day(J, J.today), used = sum(T.m), rest = Math.max(0, LIMIT - used), pct = Math.min(100, used / LIMIT * 100);
    const lv = pct >= 100 ? "full" : pct >= 80 ? "warn" : "";
    const side = '<div class="qa-side">总量 <b>' + fmt(LIMIT) + "</b> / 天<br>已用 <b>" + fmt(used) + "</b>（" + Math.round(pct) + "%）<br>" + resetClock(J.reset) + " 重置 · 还有 " + left(J.reset) + "</div>";
    if (!open) return '<div class="qa">' + head('今天还剩 <b style="color:var(--ui-ink);font-size:14px">' + fmt(rest) + "</b> / " + fmt(LIMIT) + " · " + left(J.reset) + "后重置") + '<div class="qa-bar ' + lv + '" style="margin-top:8px"><u style="width:' + pct + '%"></u></div></div>';
    // 每个模型
    const ML = MODELS.concat(Object.keys(T.m).filter(k => !MODELS.some(m => m[0] === k)).map(k => [k, k, "其它模型"]));
    const maxM = Math.max(1, ...ML.map(m => (T.m[m[0]] || [0, 0])[1]));
    const models = ML.map(([k, n, s]) => { const x = T.m[k] || [0, 0]; return '<div class="qa-m' + (x[1] ? "" : " zero") + '"><div><b>' + esc(n) + "</b><small>" + esc(s) + '</small></div><div class="v">' + fmt(x[1]) + "<small> · " + x[0] + ' 次</small></div><div class="tr"><u style="width:' + (x[1] / maxM * 100) + '%"></u></div></div>'; }).join("");
    // 最近 7 天
    const ds = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(J.today + "T00:00:00Z") - (6 - i) * 864e5).toISOString().slice(0, 10));
    const vals = ds.map(d => sum(day(J, d).m)), top = Math.max(LIMIT, ...vals) * 1.05, WD = "日一二三四五六";
    const avg = vals.slice(0, 6).filter(Boolean), avgN = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : 0;
    const wk = '<div class="qa-wk"><div class="lim" style="bottom:' + (LIMIT / top * 100) + '%"><span>1 万</span></div>' + ds.map((d, i) => '<i class="' + (d === J.today ? "td" : "") + '" title="' + d + "（UTC）：" + fmt(vals[i]) + " neurons" + (day(J, d).e ? "，" + day(J, d).e + " 次失败" : "") + '"><u style="height:' + (vals[i] / top * 100) + '%"></u><em>' + (d === J.today ? "今天" : WD[new Date(d + "T12:00:00Z").getUTCDay()]) + "</em></i>").join("") + "</div>";
    // 剩下的还能做几次：单次花费 = 最近 7 天实际平均（至少 2 次才用），没有就用估计值
    const F7 = {}; ds.forEach(d => { const f = day(J, d).f; for (const k in f) { const a = F7[k] || (F7[k] = [0, 0]); a[0] += f[k][0]; a[1] += f[k][1]; } });
    const TF = T.f || {};
    const acts = GROUPS.map(([gt, L]) => '<div class="qa-grp"><h5>' + gt + '</h5><div class="qa-acts">' + L.map(([k, ic, t, unit, def, mul, go]) => { const a = F7[k], real = a && a[0] >= 2 && a[1] > 0, per = (real ? a[1] / a[0] : def) * (mul || 1), td = TF[k]; return '<button class="qa-act" data-qgo="' + go + '" title="去' + esc(t) + '"><div class="n">' + fmt(Math.floor(rest / Math.max(1, per))) + "<small>" + unit + '</small></div><div class="t">' + ic + " " + esc(t) + '</div><div class="c">每' + unit + "约 " + fmt(per) + (real ? "（实测）" : "（估计）") + "</div>" + (td && td[1] >= 1 ? '<div class="u">今天用了 ' + fmt(td[1]) + " · " + td[0] + " 次</div>" : "") + "</button>"; }).join("") + "</div></div>").join("");
    const setup = J.src === "cf" ? "" : '<details class="qa-set"' + (J.why && J.why !== "notset" ? " open" : "") + '><summary>' + (J.why === "notset" ? "🔌 接上 Cloudflare 精确数据（现在是网站自己估的）" : "⚠️ 读 Cloudflare 数据出错，暂时用估算：" + esc(J.why)) + "</summary><ol>" +
      '<li>打开 <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener">Cloudflare → 我的个人资料 → API 令牌</a> →「创建令牌」→ 最下面「创建自定义令牌」</li>' +
      "<li>权限选 <b>帐户 · 帐户分析 · 读取</b>（Account · Account Analytics · Read），帐户资源选你的帐户，其它都不用加 → 创建，复制令牌（只显示一次）</li>" +
      "<li>帐户 ID：Cloudflare 首页「Workers 和 Pages」右边能看到「帐户 ID」，复制</li>" +
      "<li>Pages 项目 → 设置 → 变量和机密 → 添加两个：<code>CF_API_TOKEN</code>（类型选「机密」，填令牌）、<code>CF_ACCOUNT_ID</code>（填帐户 ID）→ 保存</li>" +
      "<li>重新部署一次（部署记录里最新那条点「重试部署」，或者随便推一个提交）就生效，这里的标签会变成「✓ Cloudflare 精确」</li></ol>" +
      '<div style="margin-top:6px;color:var(--ui-muted);font-size:12px">令牌只能读用量统计，改不了任何东西；只存在 Cloudflare 的机密里，网页和代码里都看不到。</div></details>';
    const fs = Object.entries(T.f || {}).filter(x => x[1][1] >= 1).sort((a, b) => b[1][1] - a[1][1]).slice(0, 8);
    const feats = fs.length ? '<div class="qa-ft">今天花在：' + fs.map(([k, x]) => "<span>" + esc(FEAT[k] || k) + " " + fmt(x[1]) + "</span>").join("") + "</div>" : "";
    return '<div class="qa">' + head("Workers AI 免费额度 · 每天 " + resetClock(J.reset) + " 重置") +
      '<div class="qa-hero"><div><div class="qa-big">' + fmt(rest) + "<small>neurons 今天还剩</small></div><div class=\"qa-cap\">" + (J.src === "cf" ? "Cloudflare 后台的数字（有几分钟延迟）" : "网站按官方价格估算") + " · 每分钟刷新</div></div>" + side +
      '<div class="qa-bar ' + lv + '"><u style="width:' + pct + '%"></u></div><div class="qa-scale"><span>0</span><span>5,000</span><span>10,000</span></div>' +
      (lv ? '<div class="qa-st ' + lv + '">' + (lv === "full" ? "⛔ 今天的额度用完了：AI 批改、AI 语音这些会失败，" + resetClock(J.reset) + " 以后恢复（已录好的语音、文稿、练习都还能用）" : "⚠️ 快用完了：先做不花额度的（背单词、听已对好时间的节目、读文章）") + "</div>" : "") +
      (T.e ? '<div class="qa-st warn">今天有 ' + T.e + " 次 AI 调用失败（多半是额度用完）</div>" : "") + "</div>" +
      acts + feats +
      '<div class="qa-grid"><div class="qa-box"><h4>每个模型今天用了多少<small>neurons · 次数' + (J.src === "cf" ? " · Cloudflare 数据" : " · 估算") + "</small></h4>" + models + "</div>" +
      '<div class="qa-box"><h4>最近 7 天<small>按 UTC 日期，虚线 = 每天 1 万</small></h4>' + wk + '<div class="qa-wks">前 6 天平均每天 ' + fmt(avgN) + "（" + Math.round(avgN / LIMIT * 100) + "%）。每天早上 6:30 GitHub 会自动预先生成 AI 语音（最多约 5,000），算在当天的额度里；白天练习最好留在 5,000 以内，加起来就不会超过 1 万。</div></div></div>" +
      '<div class="qa-note">「还能做几次」= 今天剩下的 ÷ 每次大约花多少，点卡片直接去做；已经生成过的（AI 语音、BBC 对过时间、新闻简单版、出过的题）再打开不花额度。' + (J.src === "cf" ? "模型用量是 Cloudflare 记的；「今天用了」和单次花费是网站自己按功能记的估算，加起来和 Cloudflare 的数可能差一点。" : '数字是网站后台按 <a href="https://developers.cloudflare.com/workers-ai/platform/pricing/" target="_blank" rel="noopener">官方价格</a> 估的。') + "</div>" + setup + "</div>";
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-qa],[data-qgo]"); if (!b) return;
    if (b.dataset.qgo) { goTo(b.dataset.qgo); return; }
    if (b.dataset.qa === "tg") { opened = !opened; paint(); }
  });
  setInterval(() => { if (!document.hidden && document.getElementById("dy-quota") && document.documentElement.classList.contains("show-daily")) { load(); paint(); } }, 60e3);
  window.quotaHtml = html;
})();
