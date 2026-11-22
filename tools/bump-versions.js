// 🔢 自动更新版本号：网页里引用本站文件的 ?v=（<script src="x.js?v=…">、<link href="theme.css?v=…">、js 里写死的 "pron-real.json?v=…"）
// 一律改成「文件内容的哈希前 8 位」：文件一改版本号就跟着变（手机、Cloudflare 不会拿旧缓存），没改的不变（缓存照样用）
// 用法：改完网站文件后跑一次   node tools/bump-versions.js
//       只检查不改（自动测试用）：node tools/bump-versions.js --check   有没跟上的就列出来、退出码 1
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const WEB = path.join(__dirname, "..", "web"), check = process.argv.includes("--check");
const hashOf = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
const H = {};
const hash = rel => { const f = path.join(WEB, rel.replace(/^\//, "")); if (!(rel in H)) H[rel] = fs.existsSync(f) && fs.statSync(f).isFile() ? hashOf(f) : null; return H[rel]; };
// html 里：src / href="本站文件?v=…"；js 里："本站文件?v=…"（字符串里写死的）。外站网址（http…、//…）不管
const RE_HTML = /\b(src|href)="((?!https?:|\/\/)[^"?#]+)\?v=([^"&#]*)"/g, RE_JS = /"((?!https?:|\/\/)[\w./-]+\.(?:js|json|css|svg|png|ico))\?v=([\w.-]*)"/g;
let stale = [], changed = 0;
// 先改 js（js 里引用的文件改了版本号，js 自己的内容也变了），再算哈希改 html
const NAMES = fs.readdirSync(WEB).filter(n => /\.(html|js)$/.test(n) && n !== "_worker.js").sort((a, b) => (/\.js$/.test(b) ? 1 : 0) - (/\.js$/.test(a) ? 1 : 0));
let lastJs = true;
for (const name of NAMES) {
  if (lastJs && /\.html$/.test(name)) { lastJs = false; for (const k in H) delete H[k]; } // js 都改完了：哈希重算
  const f = path.join(WEB, name), s = fs.readFileSync(f, "utf8");
  const out = /\.html$/.test(name)
    ? s.replace(RE_HTML, (a, attr, rel, v) => { const h = hash(rel); if (!h || h === v) return a; stale.push(name + " → " + rel + "（" + v + " → " + h + "）"); return attr + '="' + rel + "?v=" + h + '"'; })
    : s.replace(RE_JS, (a, rel, v) => { const h = hash(rel); if (!h || h === v) return a; stale.push(name + " → " + rel + "（" + v + " → " + h + "）"); return '"' + rel + "?v=" + h + '"'; });
  if (out !== s && !check) { fs.writeFileSync(f, out); changed++; }
}
if (check) {
  if (stale.length) { console.log("✗ 版本号没跟上（跑一次 node tools/bump-versions.js 再提交）：\n  " + stale.join("\n  ")); process.exit(1); }
  console.log("✓ 版本号都是最新的");
} else console.log(stale.length ? "已更新 " + stale.length + " 处（" + changed + " 个文件）：\n  " + stale.join("\n  ") : "版本号都是最新的，不用改");
