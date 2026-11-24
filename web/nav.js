/* 🔙 全站页面历史：浏览器「后退 / 前进」和页面里的「← 返回」都回到上一个页面。
   想法：一个「页面」= 各模块当前在哪一页的快照（哪个标签 / 小标签、口语打开了哪篇对话、听力打开了哪一期、阅读打开了哪篇文章……）。
   - 模块用 NAV.reg(名字, get, set) 登记：get() 返回能存进历史的小对象（只放「在哪一页」，不放进度），set(s) 把模块切回那一页（只改状态、能看到时重画）
   - 模块每次换页（画页面）调 NAV.mark()：300 毫秒内的多次变化合成一次，快照和当前历史记录不一样才 pushState 一条
   - 浏览器后退 / 前进（popstate）：把那条记录的快照交给各模块的 set；恢复期间不记新历史
   - 页面里的「← 返回」按钮：NAV.back(没有上一页时怎么办)。这次打开网站以后记过上一页就 history.back()，否则执行原来的返回
   - 别的代码自己 pushState / replaceState（阅读的 #article/、单词阅读器的 #read/）：state 不是我们的就不管；replaceState 时请保留 history.state
   - 记新的一页时网址去掉 #article/、#read/（离开文章 / 单词阅读器后刷新不会再跳回去）；正在显示它们的模块自己把地址加回来
   - 第一次记（打开网页）用 replaceState，不多加一条 */
(function () {
  "use strict";
  if (window.NAV) return;
  const mods = [], DELAY = 300;
  let T = 0, restoring = 0, booted = false, depth = 0, pos = 0, seq = 0;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // 切换学习语言会刷新网页，但浏览器历史还在：另一种语言时记的那几条不恢复（以前学德语时按后退会打开英语的雅思模拟考、英语的听力那期）
  const LANG_NOW = () => window.VL || "en", langOk = n => !n || !n.lang || n.lang === LANG_NOW();
  function snap() { const s = {}; for (const m of mods) { try { const v = m.get(); if (v !== undefined) s[m.k] = v; } catch (e) {} } return s; }
  const st = () => (history.state && history.state.nav) || null;
  function commit() {
    T = 0; if (restoring) return;
    const s = snap(), cur = st();
    if (!booted || !cur) { booted = true; pos = cur ? cur.id : ++seq; seq = Math.max(seq, pos); try { history.replaceState(Object.assign({}, history.state || {}, { nav: { id: pos, s, lang: LANG_NOW() } }), "", location.href); } catch (e) {} return; }
    if (same(cur.s, s)) return;
    pos = ++seq; depth++;
    try { history.pushState({ nav: { id: pos, s, lang: LANG_NOW() } }, "", location.href.replace(/#(read|article)\/.*$/, "")); } catch (e) {} // 新的一页先不带直达地址（#read/ 单词阅读器、#article/ 文章）：显示那一页的模块自己再加，免得离开文章后一刷新又跳回去
  }
  function mark() { if (restoring) return; clearTimeout(T); T = setTimeout(commit, booted ? DELAY : 0); }
  function apply(s) {
    restoring++; clearTimeout(T); T = 0;
    try { for (const m of mods) if (s[m.k] !== undefined) { try { m.set(s[m.k]); } catch (e) { if (window.console) console.warn("NAV", m.k, e); } } }
    finally { setTimeout(() => { restoring--; }, DELAY + 50); } // 模块恢复时可能晚一点才重画（加载数据），这段时间也不记
  }
  window.addEventListener("popstate", e => {
    const n = e.state && e.state.nav; if (!n) return; // 不是我们记的（#read/ 之类）：各自的代码处理
    if (!langOk(n)) { pos = n.id; return; } // 另一种语言时的页面：不恢复
    depth = Math.max(0, depth + (n.id < pos ? -1 : 1)); pos = n.id; seq = Math.max(seq, n.id);
    if (!same(snap(), n.s)) apply(n.s);
  });
  window.NAV = {
    reg(k, get, set) {
      const isNew = !mods.some(m => m.k === k);
      if (isNew) mods.push({ k, get, set }); else { const m = mods.find(x => x.k === k); m.get = get; m.set = set; }
      // 按需加载的页面（lazy.js）晚登记：把它补进当前这条历史（replaceState），不多推一条（以前「后退」要按两次）；
      //   这条历史里本来记着它在哪一页（后退回来时它还没加载）：加载好就切过去
      const cur = booted && st();
      if (isNew && cur) {
        try {
          if (cur.s[k] !== undefined && langOk(cur)) { if (!same(get(), cur.s[k])) { restoring++; try { set(cur.s[k]); } finally { setTimeout(() => { restoring--; }, DELAY + 50); } } return; }
          const v = get(); if (v !== undefined) history.replaceState(Object.assign({}, history.state || {}, { nav: { id: cur.id, s: Object.assign({}, cur.s, { [k]: v }), lang: cur.lang || LANG_NOW() } }), "", location.href);
        } catch (e) {}
        return;
      }
      mark();
    },
    mark,
    back(fallback) { // 页面里的「← 返回」：有上一页就退回上一页，没有就做原来的事
      if (T) { clearTimeout(T); commit(); } // 还没记下的变化先记上
      if (depth > 0) { history.back(); return true; }
      if (typeof fallback === "function") fallback();
      return false;
    },
    get restoring() { return restoring > 0; },
  };
})();
