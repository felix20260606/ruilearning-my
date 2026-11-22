// 在生词本网站上运行：告诉网页「这台电脑装了插件」、插件的 ID 和插件同步的是哪个家人（data-ban-user，空 = 主人），
// 网站「⭐ 已保存」在同一个人时直接嵌入插件的页面（能编辑），不是同一个人时显示网站版。
// 家人：插件跟着网站走 —— 网站上「👤」切到谁（网站本机 localStorage 的 "vu"），这台电脑的插件就同步给谁（后台 setSiteUser：先传完当前的人再换）
const tell = u => {
  document.documentElement.setAttribute("data-ban-user", u || "");
  document.documentElement.setAttribute("data-ban-ext", chrome.runtime.id);
  window.dispatchEvent(new Event("ban-ext"));
};
chrome.storage.local.get({ siteUser: "" }, v => {
  const cur = (v && v.siteUser) || "";
  let vu = ""; try { vu = localStorage.getItem("vu") || ""; } catch (e) {}
  if (!/^[a-z0-9]{1,12}$/.test(vu)) vu = "";
  tell(cur);
  // 本机 localhost 上随便哪个开发中的网页都会跑到这里（它们的 localStorage 没有 vu = 主人）：不跟着切换家人，免得把插件切回主人
  if (vu !== cur && location.hostname !== "localhost") chrome.runtime.sendMessage({ type: "setSiteUser", id: vu }, r => { if (r && r.ok) tell(vu); });
});
