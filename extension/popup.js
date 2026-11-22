const D = { showPat: true, n_phrase: true, n_spoken: true, n_link: true, n_word: true, cloze: false, gramLabel: "abbr", capSync: true, savePhrase: true, saveMedia: true, panelTrans: "popup", showGram: true, g_pa: true, g_pf: true, g_pg: true, g_md: true, g_pv: true, g_s3: true, g_pl: true, g_art: true, g_cmp: true, g_neg: true, enabled: true, srcLang: "en", target: "zh-CN", engine: "youtube", showTrans: true, showHuman: true, hideMode: "off", merge: true, showMarks: true, hoverPause: true, speakOnClick: true, dictUrls: "", autoPause: false, rate: 1, ctlHidden: false, hideBar: false, panelOpen: true, below: false, arrowKeys: false, font: "", origSize: 100, trSize: 100, trColor: "#FFD77A", bgColor: "#0E141C", bgOpacity: 78, posBottom: 12, level: -1 };
const LOOK = ["font", "origSize", "trSize", "trColor", "bgColor", "bgOpacity", "posBottom"];
const $ = id => document.getElementById(id), els = [...document.querySelectorAll("[data-k]")];
let V = Object.assign({}, D);
function rgba(h, o) { h = h.replace("#", ""); const n = parseInt(h, 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + o / 100 + ")"; }
function paint() {
  document.body.classList.toggle("nogram", !V.showGram);
  $("pvin").style.background = rgba(V.bgColor, V.bgOpacity); $("pvin").style.fontFamily = V.font || "";
  $("pvo").style.fontSize = 16 * V.origSize / 100 + "px"; $("pvt").style.fontSize = 14 * V.trSize / 100 + "px"; $("pvt").style.color = V.trColor;
  els.forEach(el => { if (el.type === "range") el.nextElementSibling.textContent = el.value + "%"; });
  $("sizePreset").value = V.origSize === V.trSize && [70, 85, 100, 125, 150].includes(V.origSize) ? String(V.origSize) : "";
  $("lvn").textContent = V.level >= 0 ? "（约 " + V.level + " 词）" : "（未设置）";
}
function show() {
  els.forEach(el => { const k = el.dataset.k, v = V[k]; if (el.type === "checkbox") el.checked = el.dataset.inv ? !v : !!v; else el.value = v; });
  paint();
}
function val(el) { if (el.type === "checkbox") return el.dataset.inv ? !el.checked : el.checked; if (el.type === "range" || el.dataset.num) return +el.value; return el.value; }
els.forEach(el => { const h = () => { V[el.dataset.k] = val(el); chrome.storage.sync.set({ [el.dataset.k]: V[el.dataset.k] }); paint(); }; el.addEventListener(el.type === "range" || el.type === "color" || el.tagName === "TEXTAREA" ? "input" : "change", h); });
$("sizePreset").onchange = e => { if (!e.target.value) return; V.origSize = V.trSize = +e.target.value; chrome.storage.sync.set({ origSize: V.origSize, trSize: V.trSize }); show(); };
$("rst").onclick = () => { const o = {}; LOOK.forEach(k => (o[k] = V[k] = D[k])); chrome.storage.sync.set(o); show(); };
$("lv").onclick = () => chrome.runtime.openOptionsPage();
$("sv").onclick = e => { e.preventDefault(); chrome.tabs.create({ url: "https://ruilearning-my.pages.dev/?go=saved" }); }; // 已保存统一从网站生词本进（里面嵌的就是插件页面）
chrome.storage.sync.get(D, v => { V = v; show(); });
chrome.storage.onChanged.addListener((c, a) => { if (a !== "sync") return; for (const k in c) if (k in V) V[k] = c[k].newValue; show(); });
chrome.storage.local.get({ saved: [], trackLangs: [] }, v => {
  $("n").textContent = v.saved.length;
  const has = new Set(v.trackLangs.map(l => l.toLowerCase())), base = new Set(v.trackLangs.map(l => l.toLowerCase().split(/[-_]/)[0]));
  [...$("target").options].forEach(o => { const l = o.value.toLowerCase(); if (has.has(l) || base.has(l.split("-")[0])) o.textContent += " [人工翻译]"; });
});
chrome.storage.local.get({ audioTracks: [] }, v => { v.audioTracks.forEach((n, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = n; $("audio").append(o); }); });
$("audio").onchange = e => chrome.storage.local.set({ audioPick: { i: e.target.value === "" ? -1 : +e.target.value, at: Date.now() } });

document.addEventListener("click", e => { const i = e.target.closest(".inf"); if (!i) return; e.preventDefault(); const h = i.closest("label").nextElementSibling; if (h && h.classList.contains("hint")) h.classList.toggle("on"); });

$("sy").onclick = e => { e.preventDefault(); $("syr").textContent = "同步中…"; chrome.runtime.sendMessage({ type: "syncAll", tl: V.target }, r => { $("syr").textContent = !r || !r.cloud ? "同步失败（未配置或网络问题）" : "新增 " + (r.added || 0) + " 个，网站共 " + r.total + " 个自定义词条"; }); };
// 生词本用户（家人）：名单从网站取；切换交给后台（先传完当前的人的数据再换）
chrome.storage.local.get({ siteUser: "" }, v => {
  const sel = $("siteUser"), cur = v.siteUser || "";
  const fill = L => { sel.innerHTML = ""; L.forEach(x => { const o = document.createElement("option"); o.value = x.id; o.textContent = x.name; sel.append(o); }); if (!L.some(x => x.id === cur)) { const o = document.createElement("option"); o.value = cur; o.textContent = cur; sel.append(o); } sel.value = cur; };
  fill([{ id: "", name: "Ray" }]);
  fetch("https://ruilearning-my.pages.dev/api/users").then(r => r.json()).then(j => { if (j && j.ok) fill(j.users); }).catch(() => {});
  sel.onchange = () => {
    const id = sel.value, name = sel.options[sel.selectedIndex].textContent;
    if (!confirm("这台电脑的插件改成同步「" + name + "」的数据？\n会先把现在的数据传到云端，再换成「" + name + "」的已保存、标记和录音截图。")) { sel.value = cur; return; }
    sel.disabled = true; $("sur").style.display = ""; $("sur").textContent = "切换中…（录音截图多的话要一会儿）";
    chrome.runtime.sendMessage({ type: "setSiteUser", id }, r => {
      sel.disabled = false;
      if (r && r.ok) { $("sur").textContent = "已切换到「" + name + "」，打开的视频页面刷新一下"; chrome.storage.local.get({ saved: [] }, x => ($("n").textContent = x.saved.length)); }
      else { $("sur").textContent = "没有切换：" + ((r && r.error) || "出错了"); sel.value = cur; }
    });
  };
});
$("rv").onclick = e => { e.preventDefault(); chrome.tabs.create({ url: "https://ruilearning-my.pages.dev/?go=pump" }); }; // 复习统一用网站「🔊 练习」
