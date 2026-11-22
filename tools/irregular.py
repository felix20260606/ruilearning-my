#!/usr/bin/env python3
"""不规则变化：一份数据（tools/irregular_data.py）生成两样东西
  1) extension/vlevel.js 里 // <IRR> … // </IRR> 之间的 VS_IRR（词形 → 原形）、VS_IRR2（一个词形对应几个原形：lay = lie 的过去式 / lay 本身）、VS_ADJ
     → 字幕、视频、阅读、练习里「收了原形，变形也框出来」（vsMarkOf / vsKeys）就按这份表；改完跑 bash tools/sync-shared.sh 同步到网站
  2) --cards：打印生词本「📐 规律」里的不规则变化卡片（JSON，POST /api/vocab {add:[…]} 加进去）
用法：python3 tools/irregular.py            # 改 vlevel.js
      python3 tools/irregular.py --cards    # 打印卡片 JSON"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from irregular_data import V, N, SAME, A, ADJ, EXTRA
ROOT = os.path.join(os.path.dirname(__file__), "..")
# 本身也是常用词 / 一个词形有几个原形：只当「额外的原形」，不改它自己的原形（不影响按词频上色）
MULTI = {"lay": ["lie"], "lives": ["life", "live"], "leaves": ["leaf", "leave"], "bases": ["basis", "base"], "ground": ["grind"], "wound": ["wind"],
         "people": ["person"], "data": ["datum"], "media": ["medium"], "born": ["bear"]}

def forms(s): return [x for x in s.split("/") if x]

def build():
    irr, irr2 = {}, {k: list(v) for k, v in MULTI.items()}
    for base, past, pp, zh in V:
        for f in forms(past) + forms(pp):
            if f == base or f in MULTI: continue
            if f in irr and irr[f] != base: irr2.setdefault(f, []).append(base); continue
            irr[f] = base
    for sg, pl, zh in N:
        if pl not in MULTI: irr[pl] = sg
    for bases, cmp_, sup, zh in A:
        B = forms(bases)
        for f in forms(cmp_) + forms(sup):
            if re.fullmatch(B[0] + "e?r|" + B[0] + "e?st", f): continue  # older / oldest 是规则变化
            irr2[f] = B
    irr.update(EXTRA)
    return irr, irr2

def patch_vlevel():
    p = os.path.join(ROOT, "extension", "vlevel.js"); s = open(p, encoding="utf8").read()
    old = json.loads(re.search(r"var VS_IRR = (\{.*?\});", s).group(1))
    irr, irr2 = build()
    merged = dict(old); merged.update(irr)
    for k in irr2:
        if k in merged and k in MULTI: merged.pop(k)  # lives 等改成「几个原形」
    block = ("// <IRR> 由 tools/irregular.py 从 tools/irregular_data.py 生成（和生词本「📐 规律」里的不规则变化卡片同一份数据），别手改\n"
             "var VS_IRR = " + json.dumps(dict(sorted(merged.items())), ensure_ascii=False, separators=(", ", ": ")) + ";\n"
             "var VS_IRR2 = " + json.dumps(dict(sorted(irr2.items())), ensure_ascii=False, separators=(", ", ": ")) + "; // 一个词形对应几个原形（只用来匹配，不改它自己的原形）\n"
             "var VS_ADJ = new Set(" + json.dumps(" ".join(ADJ)) + '.split(" ")); // 比较级 / 最高级只认这些形容词\n'
             "// </IRR>")
    if "// <IRR>" in s: s = re.sub(r"// <IRR>.*?// </IRR>", lambda m: block, s, flags=re.S)
    else: s = re.sub(r"var VS_IRR = \{.*?\};", lambda m: block, s, count=1, flags=re.S)
    open(p, "w", encoding="utf8").write(s)
    print("vlevel.js：VS_IRR", len(merged), "个，VS_IRR2", len(irr2), "个，形容词", len(ADJ), "个")

def cards():
    def vtype(b, p, pp):
        P, PP = forms(p), forms(pp)
        if b in P and b in PP: return "AAA"
        if b in PP: return "ABA"
        if set(P) & set(PP): return "ABB"
        return "ABC"
    groups = {"AAA": [], "ABB": [], "ABC": [], "ABA": []}
    for b, p, pp, zh in V: groups[vtype(b, p, pp)].append([b, p.replace("/", " / ") + "  ·  " + pp.replace("/", " / "), zh])
    meta = {
        "AAA": ("不规则动词 · AAA 型（原形 = 过去式 = 过去分词）", "三个形式一模一样，多是 -t / -d 结尾的短词：cut–cut–cut。", "以 t / d 结尾的单音节动词最常见（cut, put, hit, let, set, cost）；read 写法不变，过去式读 /red/。", [["Yesterday I {cut} my finger.", "我昨天切到了手指。"], ["She has {put} the keys on the table.", "她把钥匙放在桌上了。"]]),
        "ABB": ("不规则动词 · ABB 型（过去式 = 过去分词）", "过去式和过去分词一样，只要多记一个词：buy–bought–bought。", "按读音分组：-ought（bought, brought, thought, fought, sought）、-aught（caught, taught）、-ept（kept, slept, swept, wept）、-ent（sent, spent, lent, bent）、-ung（hung, swung, stung, clung）。", [["I {bought} a new bike last week.", "我上周买了辆新自行车。"], ["Have you {heard} the news?", "你听说那个消息了吗？"]]),
        "ABC": ("不规则动词 · ABC 型（三个都不一样）", "原形、过去式、过去分词各不相同，要成组背：write–wrote–written。", "按元音变化分组：i–a–u（begin, drink, ring, sing, sink, swim）、-ow / -ew / -own（blow, grow, know, throw, fly）、-ear / -ore / -orn（bear, swear, tear, wear）、-ake / -ook / -aken（take, shake, mistake）。", [["She {wrote} me a letter.", "她给我写了一封信。"], ["I have never {eaten} sushi.", "我从没吃过寿司。"]]),
        "ABA": ("不规则动词 · ABA 型（过去分词 = 原形）", "只有过去式变，过去分词和原形一样：come–came–come。", "就这几个：come, become, overcome, run；记住「过去分词回到原形」。", [["He {became} a doctor.", "他成了医生。"], ["Prices have {become} higher.", "物价变高了。"]]),
    }
    out = []
    for k in ["AAA", "ABB", "ABC", "ABA"]:
        word, zh, tip, ex = meta[k]
        out.append({"id": "irr_verbs_" + k.lower(), "type": "pattern", "word": word, "zh": zh, "tag": "拼写规律",
                    "forms": [[b, f, z] for b, f, z in groups[k]], "examples": ex, "tip": tip})
    out.append({"id": "irr_plurals", "type": "pattern", "word": "不规则名词复数（全表）", "zh": "不加 -s 的复数：改元音、-en、-f→-ves，以及拉丁 / 希腊来的 -is→-es、-on→-a、-us→-i、-um→-a。",
                "tag": "拼写规律", "forms": [[sg, "→", pl + "：" + zh] for sg, pl, zh in N] + [[w, "同形", "单复数一样"] for w in SAME],
                "examples": [["Two {women} and three {children} came in.", "进来了两个女人和三个孩子。"], ["These {criteria} are too strict.", "这些标准太严了。"]],
                "tip": "man→men、foot→feet 改元音；-f / -fe 多变 -ves；学术词 crisis→crises、phenomenon→phenomena、stimulus→stimuli。"})
    out.append({"id": "irr_comparatives", "type": "pattern", "word": "不规则比较级和最高级（全表）", "zh": "不加 -er / -est、也不用 more / most 的几组，要整组背。",
                "tag": "拼写规律", "forms": [[b.replace("/", " / "), "→", c.replace("/", " / ") + "  ·  " + s.replace("/", " / ") + "：" + zh] for b, c, s, zh in A],
                "examples": [["Your English is getting {better}.", "你的英语越来越好了。"], ["This is the {worst} day ever.", "这是有史以来最糟的一天。"]],
                "tip": "good / well → better → best，bad → worse → worst，many / much → more → most，little → less → least。"})
    return out

if __name__ == "__main__":
    if "--cards" in sys.argv: print(json.dumps(cards(), ensure_ascii=False, indent=1))
    else: patch_vlevel()
