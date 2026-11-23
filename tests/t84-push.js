// 🔔 手机推送（/api/push）：生成 VAPID 钥匙、订阅、取要显示的话、到点推（一天一条、练够了不打扰、订阅没了就删）；推送服务是假的（不联网）
const path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default, kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => kv.set(k, String(v)), delete: async k => kv.delete(k), list: async ({ prefix }) => ({ keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
  const env = { CAPTIONS: KV }, call = async (p, body) => { const r = await W.fetch(new Request("https://x.test" + p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}), env); return { status: r.status, j: await r.json() }; };
  let r = await call("/api/push?key=1"); ok(r.j.ok && /^[A-Za-z0-9_-]{80,}$/.test(r.j.key) && kv.has("push:vapid"), "VAPID public key");
  const r2 = await call("/api/push?key=1"); ok(r2.j.key === r.j.key, "same key next time");
  const bj = new Date(Date.now() + 8 * 3600e3), hm = m => new Date(bj.getTime() + m * 60e3).toISOString().slice(11, 16), day = bj.toISOString().slice(0, 10);
  r = await call("/api/push", { sub: { endpoint: "https://push.example/aaa", keys: { p256dh: "x", auth: "y" } }, u: "", time: hm(-10) }); ok(r.j.ok && /^[0-9a-f]{16}$/.test(r.j.id), "subscribe");
  const idA = r.j.id;
  await call("/api/push", { sub: { endpoint: "https://push.example/bbb" }, u: "u2", time: hm(30) }); // 还没到点
  await call("/api/push", { sub: { endpoint: "https://push.example/gone" }, u: "", time: hm(-5) });
  r = await call("/api/push?peek=" + idA); ok(r.j.ok && /还没练/.test(r.j.title), "peek: not practiced yet");
  const sent = [], of = globalThis.fetch;
  globalThis.fetch = async (u, o) => { sent.push({ u: String(u), auth: o.headers.Authorization }); return new Response("", { status: /gone/.test(u) ? 410 : 201 }); };
  r = await call("/api/push", { send: 1 });
  ok(r.j.sent === 1 && r.j.gone === 1 && sent.length === 2 && /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(sent[0].auth), "sends to due one (VAPID JWT), deletes gone one: " + JSON.stringify(r.j));
  ok(![...kv.keys()].some(k => k.startsWith("push/") && JSON.parse(kv.get(k)).sub.endpoint.includes("gone")), "gone subscription removed");
  r = await call("/api/push", { send: 1 }); ok(r.j.sent === 0, "once a day");
  // 练够了不打扰
  kv.set("ext", JSON.stringify({ ver: 1, items: { ["stat|" + day]: { v: { n: 25 }, at: 1 } } }));
  await call("/api/push", { sub: { endpoint: "https://push.example/ccc" }, u: "", time: hm(-1) });
  r = await call("/api/push", { send: 1 }); ok(r.j.skip === 1 && r.j.sent === 0, "practiced enough today → skip");
  const idC = JSON.parse(kv.get([...kv.keys()].find(k => k.startsWith("push/") && JSON.parse(kv.get(k)).sub.endpoint.endsWith("ccc")))).sub.endpoint;
  r = await call("/api/push?peek=" + idA); ok(/练了 25 张/.test(r.j.title), "peek after practising: " + r.j.title);
  r = await call("/api/push", { endpoint: idC, off: 1 }); ok(r.j.ok && ![...kv.keys()].some(k => k.startsWith("push/") && kv.get(k).includes("ccc")), "unsubscribe");
  globalThis.fetch = of;
  r = await call("/api/push", { sub: { endpoint: "http://insecure" } }); ok(r.status === 400, "bad subscription refused");
  console.log(fail ? fail + " FAILED" : "t84 push: all ok"); process.exit(fail ? 1 : 0);
})();
