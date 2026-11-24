import json,os,sys
D=os.path.dirname(os.path.abspath(__file__))
CATS=["地标","街区","美食夜市","商场","宗教建筑","博物馆","室内","公园自然","动物","徒步","乐园","周边一日"]
SYNC='「✅ 去过」「⭐ 想去」可以勾：在网站里（旅游中心的 iframe）用 trip-state.js（TRIPST）存到后台 /api/mine?k=trip（按家人分开、换设备也在）；单独打开只存本机。\n     景点资料是 2026-11 网上查的（每张卡片有来源链接），开放时间、票价以官方 / 现场为准。照片来自 Wikimedia Commons，点照片看原图和作者。\n     数据在下面 DATA 里，由 tools/sights/build.py 生成（python3 tools/sights/build.py web kl cq hz）'
C={
'kl':dict(files=['landmarks.json','culture.json','nature.json','extra.json'],out='kl-sights.html',title='吉隆坡景点大全 · 去过的打勾',
  k="Kuala Lumpur · Every Sight · Tick What You've Done",h1='📍 吉隆坡景点大全',sub='市区 + 周边当天来回 · {N} 个景点 · 照片、地址、怎么去、开放时间、门票 · 去过的打勾，想去的标星',
  comment='📍 吉隆坡景点大全：吉隆坡市区 + 周边能当天来回的景点，每个都有照片、地址、怎么坐车、开放时间、门票、待多久、介绍和提醒、Google 地图。\n     从旅游中心「🇲🇾 马来西亚」/「🧭 导航」的卡片打开（没有单独的标签）。',
  goto={'genting':'genting-1day.html','ks':'kselangor-1day.html','mel1':'malacca-1day.html','last6':'last6-trip.html'},cfg={'map':'google'}),
'cq':dict(files=['cq/core.json','cq/outer.json'],out='cq-sights.html',title='重庆景点大全 · 去过的打勾',
  k='Chongqing · Every Sight · Tick What You\'ve Done',h1='🌶 重庆景点大全',sub='主城 + 周边一日 · {N} 个景点 · 照片、地址、坐几号线、开放时间、门票 · 去过的打勾，想去的标星 · 地图用高德',
  comment='🌶 重庆景点大全：主城 + 周边一日游的景点，照片、地址、轨道交通、开放时间、门票、待多久、介绍和提醒、高德地图。\n     从旅游中心导航页「中国」那一栏的卡片打开（没有单独的标签）。带「🧭 照着走」的在 11/30 重庆中转的路线里。',
  goto={'cq':'cq-transit.html'},cfg={'map':'amap','city':'重庆'}),
'lk':dict(files=['lk/nature.json','lk/culture.json'],out='lk-sights.html',title='兰卡威景点大全 · 去过的打勾',
  k='Langkawi · Every Sight · Tick What You\'ve Done',h1='🏝 兰卡威景点大全',sub='海滩 · 浮潜跳岛 · 红树林 · 天空之桥 · 夜市免税 · {N} 个景点 · 星级推荐、照片、怎么去（住 Cenang 不租车）、开放时间、门票 · 去过的打勾，想去的标星',
  comment='🏝 兰卡威景点大全：海滩、海岛、红树林、瀑布、缆车、镇上、夜市和免税店，每个都有星级推荐、照片、地址、从 Pantai Cenang 怎么去（按不租车写）、开放时间、门票、待多久、介绍和提醒、Google 地图。\n     从旅游中心「🇲🇾 马来西亚」/「🧭 导航」的卡片打开（没有单独的标签）。带「🧭 照着走」的在 11/25–27 兰卡威行程里。',
  goto={'lk':'langkawi-trip.html'},cfg={'map':'google'}),
'hz':dict(files=['hz/westlake.json','hz/city.json'],out='hz-sights.html',title='杭州景点大全 · 去过的打勾',
  k='Hangzhou · Every Sight · Tick What You\'ve Done',h1='🍵 杭州景点大全',sub='西湖 + 城区 + 周边一日 · {N} 个景点 · 照片、地址、坐几号线、开放时间、门票 · 去过的打勾，想去的标星 · 地图用高德',
  comment='🍵 杭州景点大全：西湖景区、城区和周边一日游的景点，照片、地址、地铁公交、开放时间、门票、待多久、介绍和提醒、高德地图。\n     从旅游中心导航页「中国」那一栏的卡片打开（没有单独的标签）。',
  goto={},cfg={'map':'amap','city':'杭州'}),
}
def build(key,outdir):
    c=C[key];items=[]
    for f in c['files']:
        p=os.path.join(D,f)
        if os.path.exists(p): items+=json.load(open(p,encoding='utf-8'))
    seen=set();out=[]
    for x in items:
        if x['id'] in seen: continue
        seen.add(x['id']);ph=x.get('photo') or ''
        if ph.startswith('File:'): ph=ph[5:]
        d={k:x.get(k,'') for k in ['id','zh','en','cat','area','addr','transit','hours','price','dur','desc','tips','q','src','warn']}
        d.update({'rate':int(x.get('rate') or 1),'photo':ph,'been':bool(x.get('been')),'go':x.get('go','')})
        out.append(d)
    out.sort(key=lambda x:(-x['rate'],CATS.index(x['cat']) if x['cat'] in CATS else 99))
    js=lambda o:json.dumps(o,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
    t=open(os.path.join(D,'tpl.html'),encoding='utf-8').read()
    n=str(len(out))
    for a,b in [('/*DATA*/[]',js(out)),('/*FILES*/{}',js(c['goto'])),('/*CFG*/{}',js(c['cfg'])),('{{TITLE}}',c['title']),('{{K}}',c['k']),('{{H1}}',c['h1']),('{{SUB}}',c['sub'].replace('{N}',n)),('{{COMMENT}}','<!-- '+c['comment']+'\n     '+SYNC+' -->'),('{{N}}',n)]:
        t=t.replace(a,b)
    open(os.path.join(outdir,c['out']),'w',encoding='utf-8').write(t)
    print(key,len(out),'items →',c['out'])
if __name__=='__main__':
    for k in sys.argv[2:] or ['kl']: build(k,sys.argv[1])
