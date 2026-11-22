// 🔊 发音：最小对立词用真人录音（web/pron-real.json，tools/gen-pron.mjs 从维基词典 / Wikimedia Commons 找的）
// 只读文件检查（不联网）
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const R = JSON.parse(W("pron-real.json")), sp = W("speak.js");
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(W("speak-data.js"), ctx);
const words = [...new Set(ctx.window.SPEAK_DATA.pron.pairs.flatMap(p => p.words.flat()).map(w => w.toLowerCase()))];
const have = words.filter(w => R[w]);
ok(have.length >= words.length * 0.9, "most pair words have a real recording " + have.length + "/" + words.length);
ok(Object.values(R).every(x => /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(transcoded\/)?\w\/\w\w\/.+\.(mp3|wav)$/.test(x.u) && /^File:/.test(x.f) && /^(us|uk|au|ll)$/.test(x.a)), "entries are Commons mp3/wav with file + accent");
ok(/live-verb/.test(R.live.f) && /lead-guide/.test(R.lead.f), "one-word-two-sounds picks the right recording (live /lɪv/, lead /liːd/)");
ok(/data-word="/.test(sp) && /const wd = t\.closest\("\[data-word\]"\); if \(wd\) \{ sayWord\(/.test(sp), "pair buttons play real audio");
ok(/setTimeout\(\(\) => sayWord\(w\[ans\]/.test(sp) && /qz-again"\) \{ if \(QZ && QZ\.cur\) sayWord\(/.test(sp), "quiz uses real audio");
ok(/realOf\(w\[0\]\) && realOf\(w\[1\]\)/.test(sp), "quiz avoids real-vs-AI giveaway pairs");
{ const tt = W("tts.js"); ok(/fetch\("pron-real\.json\?v=\w+"\)/.test(tt) && /NET\.audio\(a\)/.test(tt) && /TTS\.word\(w,/.test(sp), "loads map, China fallback via NET（真人录音的播放挪到全站共用的 tts.js：TTS.word）"); }
ok(/录音来源：维基词典 \/ Wikimedia Commons/.test(sp), "credits shown");
console.log(fail ? fail + " FAILED" : "t59 pron real: all ok"); process.exit(fail ? 1 : 0);
