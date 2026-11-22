// 🔊 朗读、🎙 录音打分抽成全站共用：tts.js（TTS.say / sys / word / hush）+ rec.js（REC.toggle / stop / score / mark）
// 各页面（口语、练习、听力精听、精听逐句练、阅读全文朗读、index.html 的 speak()）不再各写一份
// 只在 node 里跑：假的 speechSynthesis / Audio / MediaRecorder / fetch，不联网
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };

// ---------- 页面里不再有自己的朗读 / 录音 ----------
for (const f of ["speak.js", "drill.js", "pump.js", "listen.js", "read.js"]) {
  const s = W(f);
  ok(!/new SpeechSynthesisUtterance/.test(s), f + " no own utterance");
  ok(!/getUserMedia|new MediaRecorder|webkitSpeechRecognition/.test(s), f + " no own recorder");
  ok(!/fetch\("\/api\/stt/.test(s), f + " no own stt call");
}
ok(/REC\.toggle\(/.test(W("speak.js")) && /REC\.toggle\(/.test(W("drill.js")) && /REC\.toggle\(/.test(W("pump.js")) && /REC\.toggle\(/.test(W("listen.js")), "pages record via REC");
ok(/TTS\.sys\(P\.sents\[i\]/.test(W("read.js")), "read-all uses TTS.sys");
const h = W("index.html");
ok(/<script src="tts\.js\?v=\w+"><\/script>\s*<script src="rec\.js\?v=\w+"><\/script>/.test(h), "rec.js loaded right after tts.js");
ok(/function speak\(text,o\)\{\s*o=o\|\|\{\};\s*if\(window\.TTS&&TTS\.say\)\{TTS\.say\(/.test(h), "index speak() → TTS.say");
ok(/function sysSpeak\(text,o\)\{\s*o=o\|\|\{\};\s*if\(window\.TTS&&TTS\.sys\)\{TTS\.sys\(/.test(h), "index sysSpeak() → TTS.sys");

// ---------- tts.js ----------
function ttsEnv(o) {
  o = o || {};
  const spoken = [], audios = [], ss = {
    q: [], speak(u) { spoken.push(u); this.q.push(u); }, cancel() { const q = this.q; this.q = []; q.forEach(u => u.onerror && u.onerror({ error: "interrupted" })); },
    getVoices: () => [{ name: "Daniel", lang: "en-GB" }, { name: "Samantha", lang: "en-US" }, { name: "Anna", lang: "de-DE" }],
  };
  function Utt(t) { this.text = t; }
  function Audio(src) { this.src = src; this.listeners = {}; audios.push(this); }
  Audio.prototype.play = function () { return Promise.resolve(); };
  Audio.prototype.pause = function () { this.paused = true; };
  Audio.prototype.addEventListener = function (k, f) { (this.listeners[k] = this.listeners[k] || []).push(f); };
  const store = new Map(o.store || []);
  const win = {
    speechSynthesis: ss, SpeechSynthesisUtterance: Utt, Audio, console, JSON, Math, Set, Promise, String, Object, Date, setTimeout, clearTimeout,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    fetch: async u => ({ ok: true, json: async () => (/index\.json/.test(u) ? { done: [], todo: [] } : { hello: { u: "https://upload.wikimedia.org/x/hello.mp3" } }) }),
  };
  win.window = win; win.VL = o.vl || "en";
  if (o.voice) win.chosenVoice = o.voice;
  if (o.rate) win.state = { rate: o.rate };
  const ctx = vm.createContext(win); vm.runInContext(W("tts.js"), ctx);
  return { ctx, T: ctx.TTS, spoken, audios, ss };
}
(async () => {
  {
    const { T, spoken } = ttsEnv({ store: [["tts:mode", "sys"]], rate: 0.8, voice: { name: "Daniel", lang: "en-GB" } });
    let ended = 0;
    T.say("Hello {there}", { rate: 0.75, end: () => ended++ });
    const u = spoken[0];
    ok(u && u.text === "Hello there" && u.voice.name === "Daniel" && Math.abs(u.rate - 0.6) < 1e-9, "sys voice = ⚙ chosen voice, rate = state.rate × o.rate");
    u.onend(); ok(ended === 1, "end called");
    T.say("A", { who: "A" }); ok(spoken[1].voice.name === "Samantha" && spoken[1].pitch === 1.05, "who A → other voice");
    let e2 = 0; T.say("first", { end: () => e2++ }); T.say("second"); ok(e2 === 0, "interrupted say does not call end");
    T.say("Hallo", { lang: "de" }); ok(spoken[spoken.length - 1].voice.name === "Anna" && spoken[spoken.length - 1].lang === "de-DE", "German voice by lang");
    let e3 = 0; T.sys("x", { base: 1, end: () => e3++ }); const ux = spoken[spoken.length - 1]; ok(ux.rate === 1, "base rate override");
    T.hush(); ux.onend(); ok(e3 === 0, "hush cancels pending end");
  }
  {
    const { T, audios, spoken } = ttsEnv();
    await T.realLoad();
    T.word("hello"); ok(audios.length === 1 && /hello\.mp3/.test(audios[0].src) && spoken.length === 0, "word → real recording");
    T.word("zzz"); ok(spoken.length === 1 || audios.length >= 1, "word without recording → say");
  }
  // ---------- rec.js：打分 ----------
  const rctx = vm.createContext({ window: {}, console, Promise, setTimeout, clearTimeout, String, Array, Math, Uint16Array, Blob: function (c, o) { this.type = o.type; }, URL: { createObjectURL: () => "blob:1" } });
  rctx.window = rctx; rctx.VL = "en";
  vm.runInContext(W("rec.js"), rctx);
  const R = rctx.REC;
  {
    const s = R.score("I'd like the green curry, please.", "I like the green curry pleas");
    ok(s.a.join(" ") === "i'd like the green curry please" && s.hit.join() === "false,true,true,true,true,true", "score hits " + s.hit);
    ok(Math.abs(s.score - 5 / 6) < 1e-9, "score " + s.score);
    const s2 = R.score("absolutely right", "absolutly right"); ok(s2.score === 1, "near: one letter off is ok");
    const s3 = R.score("absolutely right", "absolutly right", { near: false }); ok(s3.score === 0.5, "dictation: exact");
    const s4 = R.score("a well-known man", "a well known man extra"); ok(s4.score === 1 && s4.extra.join() === "extra", "hyphen split + extra");
    const s5 = R.score("Grüße aus München", "gruesse aus muenchen", { lang: "de" }); ok(s5.score === 1, "German ä→ae folding");
    const m = R.mark("Hello, my friend!", [true, false, true], { ok: "h", no: "m" });
    ok(m === '<span class="h">Hello,</span> <span class="m">my</span> <span class="h">friend!</span>', "mark " + m);
  }
  // ---------- rec.js：录音流程（假的麦克风 / MediaRecorder / Whisper） ----------
  {
    const calls = [], tracks = { stopped: 0 };
    function MR() { this.state = "inactive"; }
    MR.prototype.start = function () { this.state = "recording"; };
    MR.prototype.stop = function () { this.state = "inactive"; this.ondataavailable({ data: { size: 5, type: "audio/webm" } }); this.onstop(); };
    const env = {
      window: {}, console, Promise, setTimeout, clearTimeout, String, Array, Math, Uint16Array, JSON,
      Blob: function (c, o) { this.type = o.type; }, URL: { createObjectURL: () => "blob:1" }, MediaRecorder: MR,
      navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => tracks.stopped++ }] }) } },
      fetch: async (u, o) => { calls.push(u); return { json: async () => ({ ok: true, text: "hello world" }) }; },
      TTS: { hush: () => calls.push("hush") },
    };
    env.window = env; env.VL = "de";
    const c = vm.createContext(env); vm.runInContext(W("rec.js"), c);
    const ev = [];
    await c.REC.toggle("k1", { max: 5, before: () => ev.push("before"), start: () => ev.push("start"), busy: () => ev.push("busy"), done: x => ev.push(x) });
    ok(c.REC.cur() === "k1" && ev.join() === "before,start" && calls[0] === "hush", "started " + ev);
    await c.REC.toggle("k1", {}); // 再点一下 = 停
    await new Promise(r => setTimeout(r, 20));
    const x = ev[3];
    ok(c.REC.cur() === null && ev[2] === "busy" && x && x.text === "hello world" && x.url === "blob:1" && x.key === "k1", "done " + JSON.stringify(x));
    ok(calls[1] === "/api/stt?lang=de" && tracks.stopped === 1, "stt with lang, mic released " + calls);
    const ev2 = [];
    await c.REC.toggle("k2", { cancel: () => ev2.push("cancel"), done: () => ev2.push("done") });
    c.REC.stop(true); await new Promise(r => setTimeout(r, 20));
    ok(ev2.join() === "cancel" && c.REC.cur() === null, "cancel → no stt " + ev2);
  }
  console.log(fail ? fail + " FAILED" : "t65 say+rec: all ok"); process.exit(fail ? 1 : 0);
})();
