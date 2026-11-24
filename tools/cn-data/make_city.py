# 城市景点 → web/cn/city/<拼音>.json（城市页 cn-city.html?c=<拼音> 读）
# 用法：python3 make_city.py <web 目录> <省拼音> <景点 json 目录>
#   景点 json：每个城市一个 <拼音>.json，{"city":{slug,zh,en,from_hz,local,tips},"sights":[…景点大全同样的字段…]}
#   景点目录下有 _auto/<同名>.json（自动版留底）时，手写里没有的景点追加在后面
#   城市的照片、简介、坐标、维基链接从 web/cn/<省>.json 里按名字对上；写完再给省页那张城市卡片挂上「🏙 … 景点大全 ›」
import json,os,sys,glob
web,prov,src=sys.argv[1],sys.argv[2],sys.argv[3]
P=json.load(open(os.path.join(web,'cn',prov+'.json'),encoding='utf-8'))
os.makedirs(os.path.join(web,'cn','city'),exist_ok=True)
KEYS=['id','zh','en','cat','area','addr','transit','hours','price','dur','desc','tips','q','src','warn']
done=[]
for f in sorted(glob.glob(os.path.join(src,'*.json'))):
    try: j=json.load(open(f,encoding='utf-8'))
    except Exception as e: print('skip',f,e); continue
    if not isinstance(j,dict) or 'city' not in j: continue
    c=j['city'];zh=c['zh'].rstrip('市')
    m=[x for x in P['cities'] if x['zh'].rstrip('市')==zh]
    base=m[0] if m else {}
    slug=base.get('slug') or c['slug']  # 网址名以省页数据为准（<省拼音>-<市拼音>）
    S=[]
    seen=set()
    for x in j['sights']:
        if x['id'] in seen: continue
        seen.add(x['id']);ph=(x.get('photo') or '');ph=ph[5:] if ph.startswith('File:') else ph
        d={k:x.get(k,'') for k in KEYS};d.update(rate=int(x.get('rate') or 1),photo=ph);S.append(d)
    # 景点目录里有 _auto/<后缀>.json（自动版留底：维基数据的世界遗产 / 5A / 国保…）：手写里没有的追加在后面，景点少的县也不会空
    af=os.path.join(src,'_auto',os.path.basename(f))
    if os.path.exists(af):
        import re
        key=lambda t:re.sub(r'[（(].*|景区|风景区|旅游区|遗址|旧址|公园|古镇|博物馆|$','',t)[:3]
        hn=[x['zh'] for x in S];hp={x['photo'] for x in S if x['photo']};added=0
        for x in json.load(open(af,encoding='utf-8')):
            if any(x['zh'] in h or h in x['zh'] or key(x['zh'])==key(h) for h in hn) or (x.get('photo') and x['photo'] in hp): continue
            S.append(x);hn.append(x['zh']);added+=1
    doc=dict(slug=slug,zh=base.get('zh',c['zh']),en=c.get('en') or base.get('en',''),prov=P['slug'],provZh=P['zh'],desc=base.get('desc',''),img=base.get('img',''),
             wiki=base.get('wiki',''),lat=base.get('lat'),lng=base.get('lng'),from_hz=c.get('from_hz',''),from_t=c.get('from_t',''),local=c.get('local',''),tips=c.get('tips',''),sights=S)
    json.dump(doc,open(os.path.join(web,'cn','city',slug+'.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    if base and not base.get('go'):
        base['go']='city:'+slug;base['goT']='🏙 %s景点大全'%zh
    done.append((slug,len(S),bool(base)))
json.dump(P,open(os.path.join(web,'cn',prov+'.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
for d in done: print(d)
