// 🔔 手机推送（/api/push）：VAPID 钥匙、订阅（只认浏览器推送服务、最多 60 组、索引键 push:subs）、peek、到点推（跨零点、一天一条、练够了不打扰、订阅没了就删、401 三次删）、
//    换订阅（renew）、关掉一组（off 只删这一组）、坏请求；推送服务是假的（不联网）
const path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default, kv = new Map(); let lists = 0;
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => kv.set(k, String(v)), delete: async k => kv.delete(k), list: async ({ prefix }) => { lists++; return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; } };
  kv.set("users", JSON.stringify([{ id: "", name: "Rui" }, { id: "u2", name: "妈妈" }]));
  const env = { CAPTIONS: KV }, call = async (p, body, raw) => { const r = await W.fetch(new Request("https://x.test" + p, body != null ? { method: "POST", headers: { "content-type": "application/json" }, body: raw ? body : JSON.stringify(body) } : {}), env); return { status: r.status, j: await r.json() }; };
  const subs = () => JSON.parse(kv.get("push:subs") || "{}"), EP = s => "https://fcm.googleapis.com/fcm/send/" + s;
  const hash16 = async t => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].slice(0, 8).map(x => x.toString(16).padStart(2, "0")).join("");
  let r = await call("/api/push?key=1"); ok(r.j.ok && /^[A-Za-z0-9_-]{80,}$/.test(r.j.key) && kv.has("push:vapid"), "VAPID public key");
  const r2 = await call("/api/push?key=1"); ok(r2.j.key === r.j.key, "same key next time");
  const bj = new Date(Date.now() + 8 * 3600e3), hm = m => new Date(bj.getTime() + m * 60e3).toISOString().slice(11, 16), day = bj.toISOString().slice(0, 10);
  // 坏订阅：不是浏览器推送服务、http、太长、坏 JSON、不认识的人
  for (const ep of ["https://push.example/aaa", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.com/x", EP("x".repeat(1200))]) { r = await call("/api/push", { sub: { endpoint: ep }, u: "", time: "20:00" }); ok(r.status === 400, "refused " + ep.slice(0, 50)); }
  r = await call("/api/push", "{bad", true); ok(r.status === 400, "bad JSON → 400");
  r = await call("/api/push", { sub: { endpoint: EP("zzz") }, u: "nobody" }); ok(r.status === 404, "unknown user");
  ok(!kv.has("push:subs"), "nothing stored for refused ones");
  // 订阅
  r = await call("/api/push", { sub: { endpoint: EP("aaa"), keys: { p256dh: "x", auth: "y" } }, u: "", time: hm(-10) }); ok(r.j.ok && /^[0-9a-f]{16}$/.test(r.j.id), "subscribe");
  const eA = await hash16(EP("aaa"));
  ok(subs()[r.j.id] && subs()[r.j.id].e === eA && subs()[r.j.id].name === "Rui", "stored in index");
  // 同一台手机：妈妈的德语也订（一台设备多组）
  r = await call("/api/push", { sub: { endpoint: EP("aaa") }, u: "u2", lang: "de", time: hm(30) }); ok(r.j.ok && Object.keys(subs()).length === 2, "two combos on one device");
  // 再订一次同样的：不写 KV
  const before = kv.get("push:subs"); let puts = 0; const op = KV.put; KV.put = async (k, v) => { puts++; return op(k, v); };
  await call("/api/push", { sub: { endpoint: EP("aaa") }, u: "", time: hm(-10) }); ok(puts === 0 && kv.get("push:subs") === before, "re-subscribe unchanged → no write");
  KV.put = op;
  await call("/api/push", { sub: { endpoint: EP("gone") }, u: "", time: hm(-5) });
  await call("/api/push", { sub: { endpoint: EP("deny") }, u: "", time: hm(-5) });
  await call("/api/push", { sub: { endpoint: EP("badtime") }, u: "", time: "25:99" });
  ok(Object.values(subs()).find(x => x.ep === EP("badtime")).time === "20:00", "invalid time → 20:00");
  await call("/api/push", { sub: { endpoint: EP("badtime") }, u: "", off: 1 }); ok(!Object.values(subs()).some(x => x.ep === EP("badtime")), "off removes it");
  r = await call("/api/push?peek=" + eA); ok(r.j.ok && /还没练英语/.test(r.j.title) && /^Rui：/.test(r.j.title.replace(/^\S+ /, "")), "peek: not practiced, with name since 2 combos: " + r.j.title);
  r = await call("/api/push?peek=zz"); ok(r.status === 400, "bad peek id");
  // 推送
  const sent = [], of = globalThis.fetch;
  globalThis.fetch = async (u, o) => { sent.push({ u: String(u), auth: o.headers.Authorization }); return new Response("", { status: /gone/.test(u) ? 410 : /deny/.test(u) ? 403 : 201 }); };
  lists = 0; r = await call("/api/push", { send: 1 });
  ok(r.j.sent === 1 && r.j.gone === 1 && r.j.fail === 1 && sent.length === 3 && /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(sent[0].auth), "send: due one sent, gone deleted, 403 counted: " + JSON.stringify(r.j));
  ok(lists === 0, "send uses no KV list");
  ok(!Object.values(subs()).some(x => x.ep === EP("gone")), "gone subscription removed");
  r = await call("/api/push", { send: 1 }); ok(r.j.sent === 0 && r.j.fail === 1, "once a day; 403 retried: " + JSON.stringify(r.j));
  r = await call("/api/push", { send: 1 }); ok(!Object.values(subs()).some(x => x.ep === EP("deny")), "403 three times → removed");
  r = await call("/api/push?peek=" + eA); ok(/Rui/.test(r.j.title) && /英语/.test(r.j.title), "peek picks most recently sent combo: " + r.j.title);
  // 练够了不打扰
  kv.set("ext", JSON.stringify({ ver: 1, items: { ["stat|" + day]: { v: { n: 25 }, at: 1 } } }));
  await call("/api/push", { sub: { endpoint: EP("ccc") }, u: "", time: hm(-1) });
  r = await call("/api/push", { send: 1 }); ok(r.j.skip === 1 && r.j.sent === 0, "practiced enough today → skip");
  r = await call("/api/push?peek=" + eA); ok(/练了 25 张/.test(r.j.title), "peek after practising: " + r.j.title);
  // 换订阅：aaa 下的两组搬到 aaa2
  r = await call("/api/push", { renew: { old: EP("aaa"), sub: { endpoint: EP("aaa2") } } }); ok(r.j.moved === 2 && !Object.values(subs()).some(x => x.ep === EP("aaa")) && Object.values(subs()).filter(x => x.ep === EP("aaa2")).length === 2, "renew moves both combos");
  r = await call("/api/push", { renew: { old: EP("aaa2"), sub: { endpoint: "https://evil.example/x" } } }); ok(!r.j.moved, "renew to non-push host refused");
  // 关掉：只删这一组（妈妈的德语还在）
  r = await call("/api/push", { sub: { endpoint: EP("aaa2") }, u: "", off: 1 }); const left = Object.values(subs()).filter(x => x.ep === EP("aaa2"));
  ok(r.j.ok && left.length === 1 && left[0].u === "u2" && left[0].lang === "de", "off removes only that (user, lang)");
  globalThis.fetch = of;
  // 跨零点：23:30 的提醒在 00:40 还算（算前一天），02:40 之后不算
  const pushDue = W._pushDue;
  if (typeof pushDue === "function") {
    const t = s => Date.parse(s + "+08:00");
    let d = pushDue("23:30", t("2026-11-24T00:40:00")); ok(d.due && d.day === "2026-11-23", "midnight wrap: " + JSON.stringify(d));
    d = pushDue("23:30", t("2026-11-24T02:40:00")); ok(!d.due, "too late after 3h");
    d = pushDue("08:00", t("2026-11-24T07:59:00")); ok(!d.due, "1 min early is not due");
    d = pushDue("08:00", t("2026-11-24T08:10:00")); ok(d.due && d.day === "2026-11-24", "same day");
  } else console.log("(pushDue 没导出，跳过跨零点)");
  // 上限 60 组
  const L = subs(); for (let i = 0; i < 70; i++) L["f" + String(i).padStart(15, "0")] = { e: "x", ep: EP("n" + i), u: "", lang: "en", time: "20:00", exp: Date.now() + 1e9 }; kv.set("push:subs", JSON.stringify(L));
  r = await call("/api/push", { sub: { endpoint: EP("one-more") }, u: "" }); ok(r.status === 429, "cap 60");
  // 过期的组不算
  const L2 = subs(); for (const id in L2) L2[id].exp = 1; kv.set("push:subs", JSON.stringify(L2));
  r = await call("/api/push", { sub: { endpoint: EP("fresh") }, u: "" }); ok(r.j.ok && Object.keys(subs()).length === 1, "expired combos dropped");
  // 过零点补推：23:45 的提醒在 00:07 推，看的是前一天练了没有（那天练够了就不推）
  { kv.clear(); kv.set("users", JSON.stringify([{ id: "", name: "Rui" }])); const realNow = Date.now, T = Date.parse("2026-11-24T00:07:00+08:00"); Date.now = () => T;
    try {
      kv.set("ext", JSON.stringify({ ver: 1, items: { "stat|2026-11-23": { v: { n: 30 }, at: 1 } } }));
      let r = await call("/api/push", { sub: { endpoint: EP("late") }, u: "", time: "23:45" }); ok(r.j.ok, "subscribe 23:45");
      const sent = [], of2 = globalThis.fetch; globalThis.fetch = async u => { sent.push(String(u)); return new Response("", { status: 201 }); };
      r = await call("/api/push", { send: 1 }); ok(r.j.skip === 1 && r.j.sent === 0 && !sent.length, "00:07 run judges the 23rd (30 cards) → no push: " + JSON.stringify(r.j));
      kv.set("ext", JSON.stringify({ ver: 1, items: {} })); const L = JSON.parse(kv.get("push:subs")); for (const id in L) L[id].last = ""; kv.set("push:subs", JSON.stringify(L));
      // 推送过程中有人关掉了另一组：写回时不能把它加回来
      await call("/api/push", { sub: { endpoint: EP("other") }, u: "", time: "23:50" });
      globalThis.fetch = async u => { const S = JSON.parse(kv.get("push:subs")); for (const id in S) if (S[id].ep === EP("other")) delete S[id]; kv.set("push:subs", JSON.stringify(S)); return new Response("", { status: 201 }); };
      r = await call("/api/push", { send: 1 }); const S2 = JSON.parse(kv.get("push:subs"));
      ok(r.j.sent >= 1 && !Object.values(S2).some(x => x.ep === EP("other")), "unsubscribed during send stays unsubscribed");
      globalThis.fetch = of2;
    } finally { Date.now = realNow; } }
  console.log(fail ? fail + " FAILED" : "t84 push: all ok"); process.exit(fail ? 1 : 0);
})();
