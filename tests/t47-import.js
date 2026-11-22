// 导入词表的解析（web/import.js 的 parse）：一行一个 / 逗号分隔 / 「1. word - 中文」/ CSV 带例句 / TSV / Kindle My Clippings；去重、跳过中文和长句
const fs = require("fs"), path = require("path");
global.window = {}; global.document = { readyState: "complete", getElementById: () => null };
eval(fs.readFileSync(path.join(__dirname, "..", "web", "util.js"), "utf8")); global.U = window.U;
eval(fs.readFileSync(path.join(__dirname, "..", "web", "import.js"), "utf8"));
const P = window.vocabImportParse;
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
let r = P("serendipity\nbreak the ice\nmeticulous, reluctant，vivid\n\nSerendipity\n苹果\n1. abandon - 放弃\nresilient 有韧性的");
ok(r.items.map(x => x.w).join("|") === "serendipity|break the ice|meticulous|reluctant|vivid|abandon|resilient", "plain " + JSON.stringify(r.items.map(x => x.w)));
ok(r.skip >= 1, "chinese skipped");
r = P('word,meaning,example\nhesitate,犹豫,"She hesitated before answering, then smiled."\n"look up",查,Look it up in the dictionary.\n');
ok(r.kind.includes("CSV") && r.items.length === 2 && r.items[0].s.startsWith("She hesitated") && r.items[1].w === "look up" && r.items[1].s === "Look it up in the dictionary.", "csv " + JSON.stringify(r));
r = P("vivid\t生动的\tThe colours were vivid and bright.\nquit\t放弃\t");
ok(r.kind.includes("TSV") && r.items[0].s.includes("vivid") && r.items[1].w === "quit" && !r.items[1].s, "tsv " + JSON.stringify(r));
r = P("﻿Atomic Habits (James Clear)\r\n- Your Highlight on page 12 | Location 180-180 | Added on Monday\r\n\r\ncompound\r\n==========\r\nAtomic Habits (James Clear)\r\n- Your Highlight on page 13 | Location 190 | Added on Monday\r\n\r\nHabits are the compound interest of self-improvement and they matter a lot.\r\n==========\r\nBook\r\n- Your Highlight on Location 5 | Added\r\n\r\nplateau of latent potential\r\n==========\r\n");
ok(r.kind.includes("Kindle") && r.items.map(x => x.w).join("|") === "compound|plateau of latent potential" && r.skip === 1, "kindle " + JSON.stringify(r));
r = P(Array.from({ length: 350 }, (_, i) => "w" + "abcdefghij"[i % 10] + "x".repeat(1 + Math.floor(i / 10))).join("\n"));
ok(r.items.length === 300 && r.more === 50, "cap 300 " + r.items.length + " " + r.more);
console.log(fail ? "t47 FAILED" : "t47 ok"); process.exit(fail ? 1 : 0);
