/* 📥 导入词表（「📖 词汇 → 📖 列表」回收站旁边的按钮）：一次加很多词，每个词自动查词典生成词条（同「＋ 加词」）
   支持：
   - 一行一个词 / 短语（也可以逗号、顿号、分号隔开）
   - CSV / TSV（扇贝、墨墨、欧路、Anki 等导出）：第一列是词；后面哪一列像含这个词的英文句子，就当例句带上
   - Kindle 的 My Clippings.txt：取 1–4 个词的标注当生词（整句的长标注跳过）
   Excel 请先另存为 CSV。一次最多 300 个；已经在生词本里的会标出来、默认不勾
   依赖 index.html 的全局：words、quickAdd(word, sentence)、refresh、toast */
(function () {
  "use strict";
  const { esc } = U; // 全站共用的小工具（util.js）
  const MAX = 300;
  const clean = w => String(w || "").replace(/^[\s"'“”‘’(\[]+|[\s"'“”‘’)\].,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
  const isWord = w => /^[A-Za-z][A-Za-z'’ -]{0,48}[A-Za-z]$|^[A-Za-z]$/.test(w) && w.split(" ").length <= 5;
  function splitCsv(line, sep) { // 简单的 CSV：支持双引号包起来的字段
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ""; } else cur += c; }
    out.push(cur); return out;
  }
  // → [{w, s}]（s = 例句，可能空）+ 跳过了几条
  function parse(text) {
    text = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    const out = [], seen = new Set(); let skip = 0;
    const push = (w, s) => { w = clean(w); if (!isWord(w)) { if (w) skip++; return; } const k = w.toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ w, s: s && new RegExp("\\b" + w.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(s) ? s.trim().slice(0, 300) : "" }); };
    if (/^==========$/m.test(text)) { // Kindle My Clippings.txt
      for (const block of text.split(/^==========$/m)) { const L = block.split("\n").map(x => x.trim()).filter(Boolean); if (L.length < 3 || !/^- /.test(L[1])) continue; const h = L.slice(2).join(" "); if (h.split(/\s+/).length <= 4) push(h); else skip++; }
      return { items: out.slice(0, MAX), skip, more: Math.max(0, out.length - MAX), kind: "Kindle 标注" };
    }
    const lines = text.split("\n").filter(x => x.trim()), tab = lines.filter(x => x.includes("\t")).length > lines.length / 2, csv = !tab && lines.filter(x => /,/.test(x)).length > lines.length / 2 && lines.some(x => splitCsv(x, ",").slice(1).some(c => /[\u4e00-\u9fff]/.test(c) || c.trim().split(/\s+/).length >= 3)); // 后面的列有中文或整句才算表格；「a, b, c」这种是词表
    if (tab || csv) {
      for (const line of lines) { const C = splitCsv(line, tab ? "\t" : ",").map(x => x.trim()); if (/^(word|单词|词|term|front)$/i.test(C[0])) continue; const w = clean(C[0]); push(w, C.slice(1).find(c => /[A-Za-z]{2,}\s+[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(c) && c.toLowerCase().includes(w.toLowerCase().split(" ")[0])) || ""); }
      return { items: out.slice(0, MAX), skip, more: Math.max(0, out.length - MAX), kind: tab ? "表格（TSV）" : "表格（CSV）" };
    }
    for (const line of lines) for (const part of line.split(/[,，、;；|]/)) { const p = part.replace(/^\s*\d+[.)、]\s*/, "").replace(/\s+[-–—:：]\s+.*$/, "").replace(/\s+[一-鿿].*$/, ""); push(p); } // 「1. word - 中文」「word 中文」只取英文
    return { items: out.slice(0, MAX), skip, more: Math.max(0, out.length - MAX), kind: "词表" };
  }

  const CSS = `
  .imp-mask{position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.5);display:flex;align-items:flex-start;justify-content:center;padding:60px 12px 20px;overflow:auto}
  .imp-box{width:640px;max-width:100%;background:var(--ui-surface,#26282c);border:1px solid var(--ui-line-2,#454950);border-radius:16px;padding:16px;color:var(--ui-ink,#e6e8eb);font-family:var(--ui-font);box-shadow:0 24px 60px rgba(0,0,0,.5)}
  .imp-box h3{margin:0 0 4px;font-size:18px}.imp-box .sm{color:var(--ui-muted);font-size:13px;line-height:1.55}
  .imp-box textarea{width:100%;min-height:150px;margin-top:10px;border-radius:12px;border:1px solid var(--ui-line-2);background:var(--ui-surface-2);color:var(--ui-ink);padding:10px 12px;font:inherit;font-size:14.5px;resize:vertical;box-sizing:border-box}
  .imp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}.imp-row .sp{flex:1}
  .imp-list{max-height:42vh;overflow:auto;margin-top:10px;border:1px solid var(--ui-line);border-radius:12px;padding:6px 10px}
  .imp-list label{display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--ui-line);font-size:14.5px;cursor:pointer}.imp-list label:last-child{border:0}.imp-list small{color:var(--ui-muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
  .imp-list .have{color:var(--ui-muted)}.imp-prog{height:6px;border-radius:4px;background:var(--ui-surface-3,#3a3d43);overflow:hidden;margin-top:10px}.imp-prog u{display:block;height:100%;width:0;background:var(--ui-pur)}`;
  let box = null, res = null, busy = false;
  const have = () => new Set((typeof words !== "undefined" ? words : []).map(w => String(w.word || "").toLowerCase()));
  function draw() {
    if (!box) return; const H = have();
    box.innerHTML = '<div class="imp-box"><h3>📥 导入词表</h3><div class="sm">粘贴单词（一行一个，或用逗号隔开），或者选一个文件：<b>txt / csv / tsv</b>（扇贝、墨墨、欧路、Anki 导出的都行，第一列是词；Excel 请先另存为 CSV），也可以选 Kindle 的 <b>My Clippings.txt</b>。每个词会自动查词典生成词条，一次最多 ' + MAX + " 个。</div>" +
      (res ? "" : '<textarea id="imp-text" placeholder="serendipity\nbreak the ice\nmeticulous, reluctant, vivid"></textarea><div class="imp-row"><label class="ui-btn" style="cursor:pointer">📄 选文件<input id="imp-file" type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" hidden></label><span class="sp"></span><button class="ui-btn" data-a="x">取消</button><button class="ui-btn pri" data-a="parse">下一步 →</button></div>') +
      (res ? '<div class="sm" style="margin-top:8px">认出 ' + esc(res.kind) + " <b>" + res.items.length + "</b> 个词" + (res.skip ? "，跳过 " + res.skip + " 条（不是英文词，或者是整句）" : "") + (res.more ? "，超过上限没算的 " + res.more + " 个" : "") + "。灰色的是生词本里已经有的。</div>" +
        '<div class="imp-list">' + res.items.map((x, i) => { const h = H.has(x.w.toLowerCase()); return '<label class="' + (h ? "have" : "") + '"><input type="checkbox" data-i="' + i + '"' + (h ? "" : " checked") + (busy ? " disabled" : "") + "><b>" + esc(x.w) + "</b><small>" + esc(x.s) + "</small></label>"; }).join("") + "</div>" +
        '<div class="imp-prog" id="imp-prog" style="display:none"><u></u></div><div class="imp-row"><span class="sm" id="imp-msg"></span><span class="sp"></span>' + (busy ? "" : '<button class="ui-btn" data-a="back">← 重新选</button><button class="ui-btn" data-a="x">取消</button>') + '<button class="ui-btn pri" data-a="go"' + (busy ? " disabled" : "") + ">" + (busy ? "导入中…" : "导入选中的") + "</button></div>" : "") + "</div>";
  }
  async function run() {
    const pick = [...box.querySelectorAll("input[data-i]:checked")].map(x => res.items[+x.dataset.i]); if (!pick.length) { toast("没有选中的词"); return; }
    if (typeof quickAdd !== "function") { toast("这一页不能导入"); return; }
    busy = true; draw(); const pg = box.querySelector("#imp-prog"), bar = pg.firstElementChild, msg = box.querySelector("#imp-msg"); pg.style.display = "block";
    let added = 0, dup = 0;
    for (let i = 0; i < pick.length; i++) { if (!box) return; msg.textContent = (i + 1) + " / " + pick.length + "：" + pick[i].w; try { if (await quickAdd(pick[i].w, pick[i].s)) added++; else dup++; } catch (e) {} bar.style.width = Math.round((i + 1) / pick.length * 100) + "%"; }
    busy = false; toast("导入完成：新加 " + added + " 个" + (dup ? "，跳过 " + dup + " 个重复" : "")); close();
  }
  async function close() { if (busy && !(await U.ask("还在导入，关掉会停在这里（已经加的会留着）。确定关掉？", { ok: "关掉" }))) return; busy = false; if (box) box.remove(); box = null; res = null; }
  function open() {
    if (box) return; box = document.createElement("div"); box.className = "imp-mask"; document.body.append(box); draw();
    box.addEventListener("click", e => {
      if (e.target === box) { close(); return; }
      const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
      if (a === "x") close();
      else if (a === "back") { res = null; draw(); }
      else if (a === "parse") { res = parse((box.querySelector("#imp-text") || {}).value); if (!res.items.length) { res = null; toast("没认出英文单词"); return; } draw(); }
      else if (a === "go") run();
    });
    box.addEventListener("change", e => {
      if (e.target.id !== "imp-file" || !e.target.files[0]) return; const f = e.target.files[0];
      if (/\.xlsx?$/i.test(f.name)) { toast("Excel 请先另存为 CSV 再选"); return; }
      const r = new FileReader(); r.onload = () => { res = parse(String(r.result || "")); if (!res.items.length) { res = null; toast("这个文件里没认出英文单词"); return; } draw(); }; r.readAsText(f);
    });
  }
  function init() {
    const tb = document.getElementById("trash-btn"); if (!tb || document.getElementById("import-btn")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    const b = document.createElement("button"); b.id = "import-btn"; b.className = "trash-btn"; b.type = "button"; b.title = "一次加很多词：粘贴词表，或选 txt / csv / Kindle 标注文件"; b.textContent = "📥 导入"; b.onclick = open; b.style.marginLeft = "auto";
    tb.before(b); tb.style.marginLeft = "6px";
  }
  window.vocabImportParse = parse; // 测试用
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
