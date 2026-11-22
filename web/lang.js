/* 🌐 学习语言：现在学哪种语言（英语 / 德语 …），顶栏「👤」左边的按钮切换
   - 每个家人各选各的：存在 localStorage「lang」（index.html 的 MINE 按人分开存）；只存在这台设备上
   - 切换后发 "lang-change" 事件、<html data-lang="de">；跟着语言换内容的页面自己监听
   - 目前跟着换的：🎧 听 → 🧩 练习课（drill.js）。其它页面还是英语内容
   - 加一门语言：在下面 LANGS 里加一项，再给 drill.js 的 PROV 加这门语言的素材来源
   window.LANG = { cur(), set(code), cfg(code?), list(), words(s), check(typed, right, code?), stop }
   check() 判填空：忽略标点和多余空格；英语不分大小写；德语允许 ae / oe / ue / ss 代替 ä / ö / ü / ß，名词没大写算对但提醒 */
(function () {
  "use strict";
  if (window.LANG) return;
  const LANGS = {
    en: { code: "en", name: "英语", flag: "🇬🇧", bcp: "en-GB", ready: true, caseMatters: false, alt: {},
      stop: "a an the and or but if of to in on at for with from by as is are was were be been am do does did have has had i you he she it we they me him her us them my your his its our their this that these those there here so not no yes oh ok okay yeah well just very really what which who when where why how all some any can could will would should may might must shall then than too also about up down out into over".split(" ") },
    de: { code: "de", name: "德语", flag: "🇩🇪", bcp: "de-DE", ready: false, caseMatters: true, alt: { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" },
      stop: "der die das den dem des ein eine einen einem einer eines und oder aber wenn von zu in im an am auf für mit aus bei nach als ist sind war waren sein bin bist hat haben hatte ich du er sie es wir ihr mich dich ihn uns euch mein dein sein unser nicht kein keine ja nein so auch noch nur schon sehr doch mal was wer wie wo wann warum dass da hier dort".split(" ") },
  };
  const KEY = "lang";
  let cur = "en";
  try { const v = localStorage.getItem(KEY); if (LANGS[v]) cur = v; } catch (e) {}
  const H = document.documentElement;
  H.setAttribute("data-lang", cur);

  const cfg = c => LANGS[c || cur] || LANGS.en;
  // 词：字母（含 ä ö ü ß é …）、数字、词中间的撇号 / 连字符
  const words = s => String(s || "").normalize("NFC").replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu) || [];
  const fold = (s, c) => { let t = s.toLowerCase(); for (const k in c.alt) t = t.split(k).join(c.alt[k]); return t; };
  // 编辑距离（只用来说「差一个字母」）
  function dist(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // → { ok, note }：ok 算不算对；note 给用户看的一句提示（可能为空）
  function check(typed, right, code) {
    const c = cfg(code), A = words(typed).join(" "), B = words(right).join(" ");
    if (!A) return { ok: false, note: "" };
    if (A === B) return { ok: true, note: "" };
    if (A.toLowerCase() === B.toLowerCase()) return { ok: true, note: c.caseMatters && A !== B ? "注意大小写：" + B : "" };
    if (fold(A, c) === fold(B, c)) return { ok: true, note: "标准写法：" + B };
    if (B.length >= 5 && dist(fold(A, c), fold(B, c)) === 1) return { ok: false, note: "差一个字母" };
    return { ok: false, note: "" };
  }
  function set(code) {
    if (!LANGS[code] || code === cur) return;
    cur = code; try { localStorage.setItem(KEY, code); } catch (e) {}
    H.setAttribute("data-lang", code); paint();
    try { window.dispatchEvent(new CustomEvent("lang-change", { detail: code })); } catch (e) {}
  }
  window.LANG = { cur: () => cur, set, cfg, list: () => Object.values(LANGS), words, check, stop: c => new Set(cfg(c).stop) };

  // ---------- 顶栏按钮 + 菜单（样式和「👤」一样） ----------
  let btn = null, menu = null;
  function paint() { if (btn) btn.innerHTML = cfg().flag + ' <b class="ln">' + cfg().name + "</b> ▾"; }
  function open() {
    menu.innerHTML = Object.values(LANGS).map(x => '<button data-l="' + x.code + '" class="' + (x.code === cur ? "on" : "") + '">' + x.flag + " " + x.name + (x.ready ? "" : ' <small style="color:var(--ui-muted)">（准备中）</small>') + "</button>").join("") +
      '<div class="who-tip">每个家人各自选，只记在这台设备上。<br>现在跟着换语言的：🎧 听 → 🧩 练习课。其它页面还是英语内容。</div>';
    const r = btn.getBoundingClientRect(); menu.classList.add("on");
    const w = menu.offsetWidth; menu.style.left = Math.max(16, Math.min(r.left, innerWidth - w - 16)) + "px"; menu.style.top = (r.bottom + 6) + "px";
  }
  function mount() {
    const who = document.getElementById("who"); if (!who || btn) return;
    btn = document.createElement("button"); btn.type = "button"; btn.id = "lang-btn"; btn.className = "who lang"; btn.title = "学哪种语言：点这里切换";
    who.parentNode.insertBefore(btn, who); paint();
    menu = document.createElement("div"); menu.className = "who-menu"; document.body.append(menu);
    const close = () => menu.classList.remove("on");
    btn.onclick = e => { e.stopPropagation(); menu.classList.contains("on") ? close() : open(); };
    menu.onclick = e => {
      e.stopPropagation(); const b = e.target.closest("button[data-l]"); if (!b) return; close();
      const c = b.dataset.l; if (c === cur) return; set(c);
      const t = window.toast || (() => {});
      t(cfg().ready ? "已切换到" + cfg().name : "已切换到" + cfg().name + "：素材还在准备，练习课页暂时是空的");
    };
    document.addEventListener("click", close); window.addEventListener("resize", close);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
