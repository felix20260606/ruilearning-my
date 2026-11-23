/* 🇩🇪 德语的词形还原（window.DE_FORMS.keys(词) → 这个词可能的原形，含它自己，都是小写）
   用在：生词本里收了一个词，它的其它形式也框起来（同英语的 vsKeys：三单、过去式、复数……），学德语（window.VL === "de"）时 word.js 用它
   只从「文章里的词」往「原形」推：生词本里的词按原样比，所以不会把两个不同的原形连到一起（Rose ≠ Rost）
   - 名词：复数 / 格的词尾 -e -en -n -er -ern -es -s，带变音的复数（Häuser → Haus、Mütter → Mutter、Äpfel → Apfel）
   - 形容词：-e -en -er -es -em，比较级 -er、最高级 -st(e)（größer / größte → groß、schönste → schön）
   - 动词：人称词尾 -e -st -t -en -et -est，过去式 -te -test -ten -tet，过去分词 ge…t / ge…en（含 an-ge-kommen 这种可分动词）、zu 不定式
     （fährt / läuft 这种变音的也能推回 fahren / laufen）
   - 常用不规则动词（sein、haben、werden、情态动词、强变化动词）：下面 IRR 表，原形:变形,变形…
   依赖：无（纯函数，node 里也能 require） */
(function (root) {
  "use strict";
  const IRR_SRC =
    "sein:bin,bist,ist,sind,seid,war,warst,waren,wart,gewesen,sei,wäre,wären|haben:habe,hast,hat,habt,hatte,hattest,hatten,hattet,gehabt,hätte,hätten|" +
    "werden:werde,wirst,wird,werdet,wurde,wurdest,wurden,wurdet,geworden,würde,würden,würdest|können:kann,kannst,könnt,konnte,konntest,konnten,gekonnt,könnte,könnten|" +
    "müssen:muss,musst,müsst,musste,musstest,mussten,gemusst,müsste,müssten|wollen:will,willst,wollt,wollte,wolltest,wollten,gewollt|sollen:soll,sollst,sollt,sollte,solltest,sollten,gesollt|" +
    "dürfen:darf,darfst,dürft,durfte,durftest,durften,gedurft,dürfte|mögen:mag,magst,mögt,mochte,mochtest,mochten,gemocht,möchte,möchtest,möchten,möchtet|wissen:weiß,weißt,wisst,wusste,wusstest,wussten,gewusst|" +
    "gehen:ging,gingst,gingen,gegangen|kommen:kam,kamst,kamen,gekommen|sehen:sieht,siehst,sah,sahen,gesehen|geben:gibt,gibst,gab,gaben,gegeben|nehmen:nimmt,nimmst,nahm,nahmen,genommen|" +
    "essen:isst,aß,aßen,gegessen|fahren:fährt,fährst,fuhr,fuhren,gefahren|lesen:liest,las,lasen,gelesen|sprechen:spricht,sprichst,sprach,sprachen,gesprochen|finden:fand,fanden,gefunden|" +
    "bleiben:blieb,blieben,geblieben|schreiben:schrieb,schrieben,geschrieben|trinken:trank,tranken,getrunken|tun:tue,tust,tut,tat,taten,getan|stehen:stand,standen,gestanden|liegen:lag,lagen,gelegen|" +
    "sitzen:saß,saßen,gesessen|laufen:läuft,läufst,lief,liefen,gelaufen|schlafen:schläft,schläfst,schlief,schliefen,geschlafen|helfen:hilft,hilfst,half,halfen,geholfen|treffen:trifft,triffst,traf,trafen,getroffen|" +
    "denken:dachte,dachten,gedacht|bringen:brachte,brachten,gebracht|kennen:kannte,kannten,gekannt|nennen:nannte,nannten,genannt|rufen:rief,riefen,gerufen|halten:hält,hältst,hielt,hielten,gehalten|" +
    "lassen:lässt,ließ,ließen,gelassen|fallen:fällt,fällst,fiel,fielen,gefallen|fangen:fängt,fängst,fing,fingen,gefangen|tragen:trägt,trägst,trug,trugen,getragen|waschen:wäscht,wäschst,wusch,wuschen,gewaschen|" +
    "vergessen:vergisst,vergaß,vergaßen|sterben:stirbt,stirbst,starb,starben,gestorben|werfen:wirft,wirfst,warf,warfen,geworfen|ziehen:zog,zogen,gezogen|fliegen:flog,flogen,geflogen|verlieren:verlor,verloren|" +
    "beginnen:begann,begannen,begonnen|gewinnen:gewann,gewannen,gewonnen|singen:sang,sangen,gesungen|springen:sprang,sprangen,gesprungen|schwimmen:schwamm,schwammen,geschwommen|verstehen:verstand,verstanden|" +
    "bekommen:bekam,bekamen|heißen:hieß,hießen,geheißen|scheinen:schien,schienen,geschienen|schließen:schloss,schlossen,geschlossen|wachsen:wächst,wuchs,wuchsen,gewachsen|vergleichen:verglich,verglichen|" +
    "steigen:stieg,stiegen,gestiegen|treiben:trieb,trieben,getrieben|leiden:litt,litten,gelitten|greifen:griff,griffen,gegriffen|schneiden:schnitt,schnitten,geschnitten|bitten:bat,baten,gebeten|" +
    "sitzen:saß|lügen:log,logen,gelogen|biegen:bog,bogen,gebogen|frieren:fror,froren,gefroren|wenden:wandte,wandten,gewandt|senden:sandte,sandten,gesandt|brennen:brannte,brannten,gebrannt|rennen:rannte,rannten,gerannt|" +
    "gut:besser,beste,besten,bester,bestes,bestem,am besten|viel:mehr,meiste,meisten|gern:lieber,liebste,liebsten|hoch:höher,höchste,höchsten,hohe,hohen,hoher,hohes|nah:näher,nächste,nächsten";
  const IRR = new Map();
  IRR_SRC.split("|").forEach(g => { const [l, fs] = g.split(":"); (fs || "").split(",").forEach(f => { const k = f.trim(); if (!k) return; if (!IRR.has(k)) IRR.set(k, []); if (!IRR.get(k).includes(l)) IRR.get(k).push(l); }); });
  const deUml = s => s.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/äu/g, "au");
  const SEP = /^(an|auf|aus|ein|mit|nach|vor|zu|ab|weg|zurück|fern|los|her|hin|fest|frei|statt|teil|vorbei|zusammen|weiter|um|bei|dar|wieder)/;
  const N = ["ern", "en", "er", "es", "em", "e", "n", "s"]; // 名词复数 / 格、形容词词尾
  const SUP = ["sten", "ster", "stes", "stem", "ste", "st", "ten", "ter", "tes", "tem", "te"]; // 最高级（größte → größ + te）
  const V = ["test", "teten", "tet", "ten", "te", "est", "et", "st", "t", "e", "en", "n"]; // 动词人称、弱变化过去式
  function keys(w) {
    const t = String(w || "").normalize("NFC").toLowerCase().replace(/[’']/g, "").trim(), out = new Set();
    if (!t) return [];
    const add = s => { if (s && s.length >= 2) { out.add(s); if (/[äöü]/.test(s)) out.add(deUml(s)); } };
    add(t);
    (IRR.get(t) || []).forEach(l => out.add(l));
    if (t.length < 4) return [...out];
    const cut = (s, suf) => (s.endsWith(suf) && s.length - suf.length >= 3 ? s.slice(0, -suf.length) : null);
    N.forEach(s => add(cut(t, s)));
    SUP.forEach(s => add(cut(t, s)));
    V.forEach(s => { const st = cut(t, s); if (!st) return; [st, deUml(st)].forEach(x => { out.add(x + "en"); if (/[elr]$/.test(x)) out.add(x + "n"); }); });
    // 过去分词 ge…t / ge…et / ge…en（可分动词：an-ge-kommen → ankommen）、zu 不定式（anzurufen → anrufen）
    const m = /^(.*?)ge(.{2,}?)(et|t|en)$/.exec(t);
    if (m && (m[1] === "" || SEP.test(m[1]))) { const x = m[1] + m[2]; out.add(x + "en"); if (/[elr]$/.test(x)) out.add(x + "n"); if (m[3] === "en") out.add(x + "en"); }
    const z = /^(.+?)zu(.{3,}en)$/.exec(t); if (z && SEP.test(z[1])) out.add(z[1] + z[2]);
    return [...out];
  }
  const API = { keys, IRR };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.DE_FORMS = API;
})(typeof window !== "undefined" ? window : this);
