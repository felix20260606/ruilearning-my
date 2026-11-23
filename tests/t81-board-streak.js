// 🏆 家庭排行（/api/board）+ 🛡 断签保护（stats.js 的 streakOf）
const path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  const S = require(path.join(__dirname, "..", "web", "stats.js"));
  const now = Date.parse("2026-11-28T12:00:00+08:00"), D = {}; ["2026-11-23", "2026-11-24", "2026-11-26", "2026-11-27", "2026-11-28"].forEach(d => (D[d] = { n: 5 }));
  ok(S.streakOf(D, now) === 3, "no freeze: gap breaks the streak");
  const used = []; ok(S.streakOf(D, now, { set: new Set(), add: d => used.push(d) }) === 5 && used.join() === "2026-11-25", "one missed day uses a freeze automatically");
  ok(S.streakOf(D, now, { set: new Set(["2026-11-25"]) }) === 5, "stored freeze keeps the streak (others' boards, no auto-use)");
  const D2 = {}; ["2026-11-20", "2026-11-22", "2026-11-24", "2026-11-26", "2026-11-28"].forEach(d => (D2[d] = { n: 1 })); const u2 = [];
  ok(S.streakOf(D2, now, { set: new Set(), add: d => u2.push(d) }) === 3 && u2.length === 2, "at most 2 per month");
  const D3 = { "2026-11-20": { n: 1 }, "2026-11-22": { n: 1 } }; ok(S.streakOf(D3, Date.parse("2026-11-22T12:00:00+08:00"), { set: new Set(), add() {} }) === 1, "no freezes before the feature started");
  ok(S.bestStreak(D) === 3 && S.frzLeft(new Set(["2026-11-25"]), "2026-11") === 1, "best streak / freezes left");
  // 后台
  const W = (await import(path.join(__dirname, "..", "web", "_worker.js"))).default, kv = new Map();
  const KV = { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => kv.set(k, String(v)), delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) };
  kv.set("users", JSON.stringify([{ id: "", name: "Ray" }, { id: "u2", name: "Bob" }]));
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  kv.set("ext", JSON.stringify({ ver: 1, items: { ["stat|" + today]: { v: { n: 40 }, at: 1 }, "stat|2000-01-01": { v: { n: 9 }, at: 1 }, "saved|x": { v: "x", at: 1 } } }));
  kv.set("u/u2/ext", JSON.stringify({ ver: 1, items: { ["stat|" + today]: { v: { n: 12 }, at: 1 } } }));
  kv.set("u/u2/mine:daily", JSON.stringify({ items: { ["frz:" + today]: { v: 1, at: 1 } } }));
  const r = await W.fetch(new Request("https://x.test/api/board"), { CAPTIONS: KV }), j = await r.json();
  ok(j.ok && j.users.length === 2 && j.users[0].days[today] === 40 && !j.users[0].days["2000-01-01"] && j.users[1].days[today] === 12 && j.users[1].frz[0] === today, "board: cards per day (last 60 days) + freezes " + JSON.stringify(j).slice(0, 200));
  const r2 = await W.fetch(new Request("https://x.test/api/board?lang=xx"), { CAPTIONS: KV }); ok(r2.status === 400, "bad lang");
  console.log(fail ? fail + " FAILED" : "t81 board + streak: all ok"); process.exit(fail ? 1 : 0);
})();
