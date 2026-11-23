/* 🎵 跟读语调对比（对标 ELSA / Speechling）：把你的录音和原声的音高曲线画在一起，看哪里该升调、哪里该重读、停顿和语速差多少
   全在浏览器里算（不花 AI 额度）：
   - 解码音频（AudioContext.decodeAudioData）→ 混成单声道、降到 16 kHz
   - 每 10 ms 一帧（窗口 40 ms）：音量太小算没声音；有声音的帧用归一化自相关找基频（70–400 Hz），再做 5 帧中值滤波
   - 去掉开头结尾的静音；两条曲线都换成「相对自己中位数的半音」（男声女声也能比），时间拉成一样长
   - 相似度 = 两条曲线（都有声音的地方）的相关系数；起伏 = 半音的标准差；语速 = 你的时长 / 原声时长
   window.PITCH = { contour(音频 | 网址 | Blob) → Promise<{f:[半音|null], dur 秒, sd 起伏}>, compare(原声, 我的) → Promise<结果>, html(结果) → SVG + 文字 }
   用在：口语页跟读（speak.js）。依赖：无 */
(function () {
  "use strict";
  if (window.PITCH) return;
  const SR = 16000, HOP = 160, WIN = 640, FMIN = 70, FMAX = 400;
  let AC = null; const ac = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
  async function decode(src) {
    let buf;
    if (src instanceof ArrayBuffer) buf = src;
    else if (src && typeof src.arrayBuffer === "function" && !(typeof src === "string")) buf = await src.arrayBuffer();
    else { const r = await fetch(src); if (!r.ok) throw new Error("audio " + r.status); buf = await r.arrayBuffer(); }
    const a = await new Promise((res, rej) => { try { const p = ac().decodeAudioData(buf.slice(0), res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } });
    return mono16k(a);
  }
  function mono16k(a) { // AudioBuffer → Float32Array，16 kHz 单声道（线性插值降采样）
    const n = a.length, ch = a.numberOfChannels, m = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = a.getChannelData(c); for (let i = 0; i < n; i++) m[i] += d[i] / ch; }
    const r = a.sampleRate / SR, out = new Float32Array(Math.floor(n / r));
    for (let i = 0; i < out.length; i++) { const x = i * r, j = Math.floor(x), f = x - j; out[i] = m[j] * (1 - f) + (m[j + 1] || 0) * f; }
    return out;
  }
  // 一帧的基频：归一化自相关，找 70–400 Hz 里最大的峰（> 0.45 才算有音高）
  function f0(x, s) {
    let e = 0; for (let i = 0; i < WIN; i++) e += x[s + i] * x[s + i];
    if (e < 1e-6) return 0;
    const lo = Math.floor(SR / FMAX), hi = Math.floor(SR / FMIN); let best = 0, bl = 0;
    for (let l = lo; l <= hi; l++) { let c = 0, e2 = 0; for (let i = 0; i < WIN - l; i++) { c += x[s + i] * x[s + i + l]; e2 += x[s + i + l] * x[s + i + l]; } const r = c / Math.sqrt(e * e2 + 1e-12); if (r > best) { best = r; bl = l; } }
    return best > 0.45 ? SR / bl : 0;
  }
  function track(x) {
    const N = Math.max(0, Math.floor((x.length - WIN) / HOP)), hz = new Array(N), en = new Array(N);
    for (let k = 0; k < N; k++) { const s = k * HOP; let e = 0; for (let i = 0; i < WIN; i++) e += x[s + i] * x[s + i]; en[k] = Math.sqrt(e / WIN); }
    const emax = Math.max(1e-4, ...en), th = emax * 0.08;
    for (let k = 0; k < N; k++) hz[k] = en[k] > th ? f0(x, k * HOP) : 0;
    // 去掉开头、结尾的静音
    let a = en.findIndex(v => v > th), b = N - 1; while (b > a && en[b] <= th) b--;
    if (a < 0) return { f: [], dur: 0, sd: 0 };
    const seg = hz.slice(a, b + 1), med5 = seg.map((v, i) => { const w = seg.slice(Math.max(0, i - 2), i + 3).filter(Boolean).sort((p, q) => p - q); return v && w.length ? w[w.length >> 1] : 0; });
    const vs = med5.filter(Boolean).sort((p, q) => p - q), med = vs.length ? vs[vs.length >> 1] : 0;
    // 换成半音；去掉认错八度的跳点：离中位数超过 10 个半音、或者和前后 7 帧的中位数差 5 个半音以上的，换成周围的中位数 / 当没声音
    const f0s = med5.map(v => (v && med ? 12 * Math.log2(v / med) : null)).map(v => (v != null && Math.abs(v) > 10 ? null : v));
    const f = f0s.map((v, i) => { if (v == null) return null; const w = f0s.slice(Math.max(0, i - 3), i + 4).filter(z => z != null).sort((p, q) => p - q), m = w[w.length >> 1]; return Math.abs(v - m) > 5 ? m : v; }), ok = f.filter(v => v != null), mean = ok.reduce((s, v) => s + v, 0) / (ok.length || 1);
    const sd = Math.sqrt(ok.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (ok.length || 1));
    return { f, dur: (b - a + 1) * HOP / SR, sd };
  }
  async function contour(src) { return track(await decode(src)); }
  const resample = (f, n) => Array.from({ length: n }, (_, i) => f.length ? f[Math.min(f.length - 1, Math.round(i / (n - 1) * (f.length - 1)))] : null);
  async function compare(ref, mine) {
    const [A, B] = await Promise.all([contour(ref), contour(mine)]);
    const n = 120, a = resample(A.f, n), b = resample(B.f, n), both = a.map((v, i) => (v != null && b[i] != null ? [v, b[i]] : null)).filter(Boolean);
    let sim = null; if (both.length >= 10) { const ma = both.reduce((s, p) => s + p[0], 0) / both.length, mb = both.reduce((s, p) => s + p[1], 0) / both.length; let c = 0, va = 0, vb = 0; both.forEach(([x, y]) => { c += (x - ma) * (y - mb); va += (x - ma) ** 2; vb += (y - mb) ** 2; }); sim = va && vb ? c / Math.sqrt(va * vb) : 0; }
    return { ref: A, mine: B, a, b, sim, rate: A.dur ? B.dur / A.dur : null };
  }
  const tips = r => {
    const t = [];
    if (r.sim != null) t.push(r.sim >= 0.7 ? "语调和原声很像 👍" : r.sim >= 0.4 ? "语调有点像：看看紫线高的地方（重读）你有没有跟上" : "语调差别比较大：先多听几遍原声，注意哪里升、哪里降");
    if (r.ref.sd && r.mine.sd < r.ref.sd * 0.6) t.push("你的声音比较平：重读的词再提高一点、拖长一点");
    if (r.rate) t.push(r.rate > 1.35 ? "比原声慢不少（" + Math.round(r.rate * 100) + "%），可以连起来读、少停顿" : r.rate < 0.75 ? "比原声快（" + Math.round(r.rate * 100) + "%），放慢一点、每个词读清楚" : "语速和原声差不多");
    return t;
  };
  function html(r) {
    const W = 600, H = 110, all = r.a.concat(r.b).filter(v => v != null), lo = Math.min(-6, ...all), hi = Math.max(6, ...all), y = v => H - 8 - (v - lo) / (hi - lo) * (H - 16), x = i => i / (r.a.length - 1) * W;
    const path = arr => { let d = "", pen = false; arr.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; pen = true; }); return d; };
    return '<div class="pt"><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" style="width:100%;height:' + H + 'px;display:block;background:color-mix(in srgb,var(--ui-surface-2,#2d2f34) 70%,transparent);border-radius:10px">' +
      '<line x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="rgba(150,150,150,.35)" stroke-dasharray="4 4"/>' +
      '<path d="' + path(r.a) + '" fill="none" stroke="#b07cff" stroke-width="3" stroke-linecap="round"/><path d="' + path(r.b) + '" fill="none" stroke="#3ecf8e" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--ui-muted,#9aa0a6);margin-top:4px"><span><b style="color:#b07cff">━</b> 原声</span><span><b style="color:#3ecf8e">━</b> 你</span>' +
      (r.sim != null ? "<span>语调相似度 <b style=\"color:var(--ui-ink,#eee)\">" + Math.max(0, Math.round(r.sim * 100)) + "%</b></span>" : "<span>声音太短或太小，算不出相似度</span>") +
      "<span>起伏：原声 ±" + r.ref.sd.toFixed(1) + " · 你 ±" + r.mine.sd.toFixed(1) + " 半音</span></div>" +
      '<div style="font-size:13px;color:var(--ui-ink-2,#cfd3d8);margin-top:4px;line-height:1.6">' + tips(r).map(s => "• " + s).join("<br>") + "</div></div>";
  }
  window.PITCH = { contour, compare, html, track, mono16k }; // track / mono16k：测试用
})();
