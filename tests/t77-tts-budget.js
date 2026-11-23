// 🔋 每天预先生成 AI 语音只用「当天剩下的额度」（tools/gen-tts.mjs 的 letterBudget）；额度面板过了 8 点重置会自己重新读（不联网）
const fs = require("fs"), path = require("path");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
(async () => {
  const { letterBudget } = await import(path.join(__dirname, "..", "tools", "gen-tts.mjs"));
  let b = letterBudget(5044, 3600, 22, false); ok(b.letters > 2500 && b.letters < 3600, "uses only leftover: " + b.letters);
  b = letterBudget(9800, 3600, 23, false); ok(b.letters === 0, "nothing left → 0");
  b = letterBudget(15445, 3600, 23, false); ok(b.letters === 0, "over the limit → 0");
  b = letterBudget(100, 3600, 0, false); ok(b.letters === 0, "GitHub ran late (new UTC day) → skip");
  b = letterBudget(100, 3600, 3, true); ok(b.letters === 3600, "manual run (--force) still capped by budget");
  b = letterBudget(0, 3600, 23, false); ok(b.letters === 3600, "budget cap");
  const yml = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "tts.yml"), "utf8");
  ok(/cron: "0 22 \* \* \*"/.test(yml) && /--force/.test(yml), "workflow: 22:00 UTC, manual = --force");
  const q = fs.readFileSync(path.join(__dirname, "..", "web", "quota.js"), "utf8");
  ok(/Date\.now\(\) > J\.reset && forcedFor !== J\.reset\) \{ force = true; forcedFor = J\.reset; \}/.test(q) && !/if \(J && Date\.now\(\) > J\.reset\) force = true/.test(q) && /visibilitychange/.test(q), "quota panel reloads after reset / when page comes back");
  console.log(fail ? fail + " FAILED" : "t77 tts budget: all ok"); process.exit(fail ? 1 : 0);
})();
