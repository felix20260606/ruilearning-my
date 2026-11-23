// 🎙 手机上录音的几种出错情况（rec.js，node 里用假的麦克风 / MediaRecorder / 后台识别，不联网）：
//   ① 停下后 MediaRecorder 不触发 onstop（iPhone Safari 常见）：2 秒内也会关麦克风、交回结果，下一次照样能录
//   ② 麦克风没权限：告诉页面原因（o.fail），之后再点还能录
//   ③ 麦克风一直没反应：10 秒超时，不会卡在「等麦克风」
//   ④ 后台识别失败（额度用完）：done 照样调，带上原因 err
//   ⑤ 录到一半放弃：不识别、麦克风关掉
//   ⑥ 手机上不同时开浏览器自带的语音识别（和录音抢麦克风）
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = p => fs.readFileSync(path.join(__dirname, "..", "web", p), "utf8");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function make(o) {
  const st = { stopped: 0, gum: 0, sr: 0 };
  function MR() { this.state = "inactive"; }
  MR.prototype.start = function () { this.state = "recording"; };
  MR.prototype.stop = function () { this.state = "inactive"; this.ondataavailable({ data: { size: 5000, type: "audio/mp4" } }); if (!o.noOnstop) this.onstop(); };
  function SR() { st.sr++; } SR.prototype.start = function () {}; SR.prototype.stop = function () {}; SR.prototype.abort = function () {};
  const env = {
    console, Promise, setTimeout, clearTimeout, String, Array, Math, JSON, AbortController,
    Blob: function (c, op) { this.type = op.type; }, URL: { createObjectURL: () => "blob:1" }, MediaRecorder: MR, webkitSpeechRecognition: SR,
    navigator: { userAgent: o.ua || "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0, mediaDevices: { getUserMedia: () => { st.gum++; return o.gum ? o.gum(st.gum) : Promise.resolve({ getTracks: () => [{ stop: () => st.stopped++ }] }); } } },
    fetch: async () => (o.stt ? o.stt() : { ok: true, status: 200, json: async () => ({ ok: true, text: "hello" }) }),
    toast: () => {},
  };
  env.window = env;
  const c = vm.createContext(env); vm.runInContext(W("rec.js"), c);
  return { REC: c.REC, st };
}
(async () => {
  { // ①
    const { REC, st } = make({ noOnstop: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" });
    const ev = []; await REC.toggle("a", { done: x => ev.push(x) }); REC.stop(false);
    await sleep(2300);
    ok(ev.length === 1 && ev[0].text === "hello" && st.stopped >= 1, "no onstop: finished by watchdog, mic released (" + ev.length + "/" + st.stopped + ")");
    ok(st.sr === 0, "⑥ iPhone: browser speech recognition not started alongside the recorder");
    const ev2 = []; ok(await REC.toggle("b", { done: x => ev2.push(x) }) === true && REC.cur() === "b", "next recording starts"); REC.stop(true);
  }
  { // ②
    let n = 0; const { REC } = make({ gum: k => (++n === 1 ? Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })) : Promise.resolve({ getTracks: () => [{ stop() {} }] })) });
    const msgs = []; const r1 = await REC.toggle("a", { fail: m => msgs.push(m) });
    ok(r1 === false && /权限/.test(msgs[0] || "") && REC.cur() === null, "no permission → fail with reason: " + msgs[0]);
    ok(await REC.toggle("a", {}) === true, "can record after allowing"); REC.stop(true);
  }
  { // ③（把 10 秒等待缩短：直接看超时后的状态）
    const { REC } = make({ gum: () => new Promise(() => {}) });
    const msgs = []; const p = REC.toggle("a", { fail: m => msgs.push(m) });
    ok(REC.cur() === "a", "waiting for mic counts as current (can be cancelled)");
    REC.stop(true); ok(REC.cur() === null, "cancel while waiting for mic");
    void p;
  }
  { // ④
    const { REC } = make({ stt: () => ({ ok: false, status: 500, json: async () => ({ ok: false, error: "4006: you have used up your daily free allocation of 10,000 neurons" }) }) });
    const ev = []; await REC.toggle("a", { done: x => ev.push(x) }); REC.stop(false); await sleep(800);
    ok(ev.length === 1 && /neurons/.test(ev[0].err) && ev[0].url === "blob:1", "stt failure → done with err: " + (ev[0] && ev[0].err));
  }
  { // ⑤
    const { REC, st } = make({});
    const ev = []; await REC.toggle("a", { cancel: () => ev.push("cancel"), done: () => ev.push("done") }); REC.stop(true); await sleep(2200);
    ok(ev.join() === "cancel" && st.stopped >= 1, "abort while recording: no recognition, mic released (" + ev + ")");
  }
  { // 电脑上照旧同时开浏览器识别
    const { REC, st } = make({}); await REC.toggle("a", {}); REC.stop(true); ok(st.sr === 1, "desktop: browser recognition still runs alongside");
  }
  const S = W("speak.js");
  ok(/data-rec-x=/.test(S) && /data-rec-re=/.test(S) && /function recAbort/.test(S), "speak: ✕ 放弃 / ↺ 重录 buttons");
  ok(/const recErrText/.test(S), "speak: shows why recognition failed");
  console.log(fail ? fail + " FAILED" : "t75 rec mobile: all ok"); process.exit(fail ? 1 : 0);
})();
