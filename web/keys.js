/* ⌨️ 全站共用的快捷键（window.KEYS）：以前每个页面各自监听键盘、各自判断「是不是我这页、是不是在打字」，漏判就会在别的页面误触发
   KEYS.on(名字, { when, prio }, (键, 事件) => 处理了返回 true)
     when()：这页现在能不能用快捷键（一般是「这页看得见、在某个画面」）；prio：优先级（盖在上面的弹层用大的，默认 0）
     键（统一成小写的名字）：字母 / 数字原样小写（"a" "r" "1"），空格 "space"，方向 "left" "right" "up" "down"，"esc"，"enter"
   统一的规则（每页不用再写）：
     - 按着 Ctrl / ⌘ / Alt、正在用输入法打字（isComposing）、焦点在输入框 / 文本框 / 下拉框 / 可编辑区域里：都不触发
     - 查词卡片开着（#wd-pop.on）：不触发（Esc 由卡片自己关）
     - 好几页都 when() 为真时，从 prio 大的往下问（一样大就后登记的先问），谁返回 true 就停；{ modal: true } 的不管处没处理都不再往下传
     - 处理了就 preventDefault；空格处理了，松开时也拦住（焦点在按钮上时别再「点」一下那个按钮）
   KEYS.visible(元素) → 元素现在在页面上看得见（不在隐藏的标签里）
   出错记进 U.log("keys", …) */
(function () {
  "use strict";
  if (window.KEYS) return;
  const L = [];
  const NAME = { " ": "space", Spacebar: "space", ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Escape: "esc", Esc: "esc", Enter: "enter" };
  const norm = k => NAME[k] || (String(k).length === 1 ? String(k).toLowerCase() : String(k).toLowerCase());
  const typing = t => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""));
  const visible = el => !!(el && el.isConnected && el.getClientRects().length);
  let spaceDown = false;
  function on(name, o, fn) {
    const i = L.findIndex(x => x.name === name); const x = { name, when: o.when || (() => true), prio: o.prio || 0, modal: !!o.modal, fn, n: L.length };
    if (i >= 0) L[i] = x; else L.push(x);
  }
  document.addEventListener("keydown", e => {
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (document.querySelector("#wd-pop.on, #u-ask.on")) return; // 查词卡片、确认弹窗开着
    const k = norm(e.key);
    const live = L.filter(x => { try { return x.when(); } catch (er) { return false; } }).sort((a, b) => b.prio - a.prio || b.n - a.n);
    if (!live.length) return;
    // 从优先级高的往下问，谁处理了（返回 true）就停：盖在上面的弹层不管的键（比如它只管 Esc），下面的页面照样能用
    let done = false;
    for (const x of live) { try { done = x.fn(k, e) === true; } catch (er) { if (window.U) U.log("keys", x.name + " 快捷键出错：" + k, String(er && er.message || er)); } if (done || x.modal) break; } // modal：整屏盖住的（阅读器），它不管的键也不往下传
    if (done) { e.preventDefault(); e.stopPropagation(); if (k === "space") spaceDown = true; }
  });
  document.addEventListener("keyup", e => { if (spaceDown && norm(e.key) === "space") { spaceDown = false; e.preventDefault(); } });
  window.KEYS = { on, visible, norm };
})();
