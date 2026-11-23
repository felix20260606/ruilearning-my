// 🇩🇪 德语的词形还原（web/de-forms.js）：生词本里收了原形，文章里的变形也框起来（复数、格、形容词词尾、比较级、动词变位、过去分词、不规则动词）
// 只从变形推回原形：两个不同的原形不会连到一起
const D = require("../web/de-forms.js");
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const pos = [["macht", "machen"], ["gemacht", "machen"], ["Häuser", "haus"], ["Kinder", "kind"], ["Frauen", "frau"], ["Tische", "tisch"], ["ging", "gehen"], ["ist", "sein"], ["kleinen", "klein"], ["größer", "groß"], ["größte", "groß"], ["schönste", "schön"],
  ["arbeitete", "arbeiten"], ["gearbeitet", "arbeiten"], ["gefahren", "fahren"], ["fährt", "fahren"], ["läuft", "laufen"], ["liest", "lesen"], ["Mütter", "mutter"], ["Äpfel", "apfel"], ["Bäume", "baum"], ["Hände", "hand"], ["Füße", "fuß"],
  ["Mannes", "mann"], ["Männer", "mann"], ["angekommen", "ankommen"], ["anzurufen", "anrufen"], ["besucht", "besuchen"], ["wohnst", "wohnen"], ["sammelt", "sammeln"], ["besser", "gut"], ["spielten", "spielen"], ["kauft", "kaufen"], ["Mädchen", "mädchen"]];
for (const [f, l] of pos) ok(D.keys(f).includes(l), f + " → " + l + " (" + D.keys(f).join(",") + ")");
const neg = [["rost", "rose"], ["rose", "rost"], ["arm", "armut"], ["see", "seele"], ["hut", "hütte"], ["rat", "ratte"], ["bin", "binden"]];
for (const [f, l] of neg) ok(!D.keys(f).includes(l), f + " must not map to " + l);
// word.js：学德语时按这个比生词本
const W = require("fs").readFileSync(require("path").join(__dirname, "..", "web", "word.js"), "utf8");
ok(/window\.DE_FORMS\.keys\(w\)/.test(W), "word.js uses DE_FORMS for German");
console.log(fail ? fail + " FAILED" : "t74 de forms: all ok"); process.exit(fail ? 1 : 0);
