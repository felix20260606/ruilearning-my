// 测试用：index.html 的「完整源码」——从 index.html 拆出去的几段（boot / net / vocab / tabs / mine-sync，base / index / ielts / mobile 样式）
// 按原来的位置拼回 <script>…</script> / <style>…</style>，老测试照样能在里面找代码（比如找含 mineSyncPull 的那段脚本）
const fs = require("fs"), path = require("path");
const WEB = path.join(__dirname, "..", "..", "web");
const PARTS = ["boot.js", "net.js", "vocab.js", "tabs.js", "mine-sync.js", "base.css", "index.css", "ielts.css", "mobile.css"];
const strip = t => t.replace(/^\/\* 从 index\.html 原样搬出来的[^\n]*\*\/\n/, ""); // 去掉搬家时加的第一行说明
function html() {
  return fs.readFileSync(path.join(WEB, "index.html"), "utf8")
    .replace(/<script src="([\w-]+\.js)\?v=\w+"><\/script>/g, (a, f) => (PARTS.includes(f) ? "<script>\n" + strip(fs.readFileSync(path.join(WEB, f), "utf8")) + "</script>" : a))
    .replace(/<link rel="stylesheet" href="([\w-]+\.css)\?v=\w+">/g, (a, f) => (PARTS.includes(f) ? "<style>\n" + strip(fs.readFileSync(path.join(WEB, f), "utf8")) + "</style>" : a));
}
module.exports = { html, PARTS };
