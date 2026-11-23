// 🎧 通勤模式（commute.js）+ 🏅 词量里程碑（stats.js）：node 里跑排队、静音音频；源码检查几条规则
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const ctx = { console, Date, Math, JSON, String, Array, Object, Uint8Array, DataView, Blob: function (p, o) { this.size = p[0].length; this.type = o.type; }, URL: { createObjectURL: b => "blob:" + b.size },
  U: { esc: s => s, LG: (k, d) => d, LS() {}, day: () => "2026-11-23" }, document: { createElement: () => ({}), head: { append() {} }, body: { append() {} }, documentElement: { style: {} } }, navigator: {},
  words: [{ id: "a", word: "resilient", zh: "有韧性的；坚韧", examples: [["A {resilient} kid.", "坚强的孩子"]] }, { id: "b", word: "known one", zh: "x" }, { id: "c", word: "规律", type: "pattern" }, { id: "d", word: "due", zh: "到期" }],
  state: { srs: { d: { due: 1 } } }, masteryOf: w => (w.id === "b" ? 1.2 : 0.2) };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(W("commute.js"), ctx);
const Q = ctx.COMMUTE.build();
ok(Q.length === 2 && Q[0].en === "due" && Q[1].en === "resilient", "due first, known & patterns skipped: " + Q.map(x => x.en));
ok(Q[1].zh === "有韧性的" && Q[1].ex === "A resilient kid." && Q[1].exzh === "坚强的孩子", "meaning / example cleaned");
ok(ctx.COMMUTE.silence(3) === "blob:" + (44 + 24000), "3 s silent wav");
const C = W("commute.js");
ok(/TTS\.srcOf\(t, ""\); if \(s && s\.indexOf\("\/tts\/"\) === 0\)/.test(C), "uses pre-generated AI voice files first (no live AI quota)");
ok(/setActionHandler/.test(C) && /MediaMetadata/.test(C), "lock-screen controls");
ok(/x\.n = \(\+x\.n \|\| 0\) \+ 1; x\.ls = \(\+x\.ls \|\| 0\) \+ 1/.test(C) && /CLOUD\.chan\("ext"\)\.send\(\{ \["stat\|" \+ d\]/.test(C), "counts as listening cards (n + ls, synced to stat|)");
ok(/commute: \{ src: "commute\.js/.test(W("lazy.js")) && /pp-commute/.test(W("pump.js")), "entry in 🔊 练习, lazy-loaded");
const S = W("stats.js");
ok(/const MS = \[50, 100, 250, 500, 1000/.test(S) && /if \(!total \|\| !dailyOK\) return;/.test(S) && /C\.put\("kn:" \+ day/.test(S), "milestones + daily known count (synced, not recorded before notebook loads)");
ok(/\|vocab:kn\|vocab:ms\|/.test(W("boot.js")), "milestone keys per user + language");
console.log(fail ? fail + " FAILED" : "t79 commute + milestones: all ok"); process.exit(fail ? 1 : 0);
