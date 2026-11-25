# 🏅 全国 5A 景区汇总：5a.json（维基列表，parse_5a.py 生成）+ new-2026.txt（文旅部最新公示）→ web/cn/5a.json
# 每个景区尽量对到已有的城市页（web/cn/city/<slug>.json）和里面的同名景点：
#   对上景点 → id 用那个景点的 id（「去过 / 想去」和城市页是同一条记录），照片也用它的；
#   只对上城市 → 链接到城市页；都对不上 → 链接到省页。
# 用法：python3 tools/cn-data/5a/make_5a.py web
import json,os,re,sys,hashlib,math
H=os.path.dirname(os.path.abspath(__file__));W=sys.argv[1] if len(sys.argv)>1 else 'web'
T=json.load(open(os.path.join(W,'cn/index.json'),encoding='utf-8'))
PV={p['zh']:p for p in T};ORD={p['zh']:i for i,p in enumerate(T)}
WI=json.load(open(os.path.join(H,'wiki-img.json'),encoding='utf-8')) if os.path.exists(os.path.join(H,'wiki-img.json')) else {}  # wiki_img.py 查到的维基条目首图
def th(f):
    if not f: return ''
    import urllib.parse as U
    n=f.replace(' ','_');h=hashlib.md5(n.encode()).hexdigest();return '%s/%s/%s'%(h[0],h[:2],U.quote(n))
STRIP=r'(国家|旅游|文化|风景名胜|风景|生态|度假|景区|名胜区|旅游区|景点|区|公园|森林公园|·|-|—|\s)'
def key(s): return re.sub(STRIP,'',re.sub(r'[（(].*?[）)]','',s))
rows=[r for r in json.load(open(os.path.join(H,'5a.json'),encoding='utf-8')) if not r['removed']]
for l in open(os.path.join(H,'new-2026.txt'),encoding='utf-8'):
    l=l.strip()
    if not l or l.startswith('#'): continue
    p,c,n=l.split('|');rows.append(dict(prov=p,city=c,county='',name=n,wiki='',date='2026/11/05',new=1))
def stem(s): return re.sub(r'(黎族苗族|黎族|苗族|土家族|蒙古族藏族|藏族羌族|回族|彝族|白族|傣族|壮族|朝鲜族|哈萨克|蒙古)?(自治州|自治县|地区|盟|市|区|县)$','',s)
import glob
CN=os.path.join(H,'..')
GZ={}  # 坐标库：省 slug → [(名字 key, lat, lng)]，来自维基数据原始结果（auto-raw）、城市页 / 自动版留底里带坐标的景点
def gz(ps):
    if ps in GZ: return GZ[ps]
    L=[]
    for f in glob.glob(os.path.join(CN,'auto-raw',ps+'*.json')):
        try: rows=json.load(open(f,encoding='utf-8'))
        except Exception: continue
        if not isinstance(rows,list): continue
        for r in rows:
            m=re.search(r'Point\(([-\d.]+) ([-\d.]+)\)',(r.get('coord') or {}).get('value',''));nm=(r.get('xlz') or r.get('xl') or {}).get('value','')
            if m and nm: L.append((key(nm),float(m.group(2)),float(m.group(1))))
    for f in glob.glob(os.path.join(W,'cn/city',ps+'-*.json'))+glob.glob(os.path.join(CN,'../sights',ps,'_auto','*.json')):
        try: J=json.load(open(f,encoding='utf-8'))
        except Exception: continue
        for x in (J.get('sights',[]) if isinstance(J,dict) else J):
            if x.get('lat') and x.get('lng'): L.append((key(x['zh']),x['lat'],x['lng']))
    GZ[ps]=[t for t in L if len(t[0])>=2];return GZ[ps]
def locate(ps,names,c0=None):  # 先找名字完全一样的，再找包含的；有好几个候选时取离所在城市中心最近的（auto-raw 里有省外的同名景点）
    ks=[key(n) for n in names if n and len(key(n))>=2]
    near=lambda L:min(L,key=lambda t:(t[1]-c0[0])**2+(t[2]-c0[1])**2) if c0 else L[0]
    for f in (lambda t,k:t[0]==k, lambda t,k:len(t[0])>=3 and (t[0] in k or k in t[0])):
        L=[t for k in ks for t in gz(ps) if f(t,k)]
        if L: t=near(L);return [round(t[1],4),round(t[2],4)]
    return None
PC={}  # 城市中心：省 slug → {城市名: [lat,lng]}
def ccenter(ps,zh):
    if ps not in PC: PC[ps]={c['zh']:[c['lat'],c['lng']] for c in json.load(open(os.path.join(W,'cn',ps+'.json'),encoding='utf-8'))['cities']}
    return PC[ps].get(zh)
CACHE={}
def city_json(slug):
    if slug not in CACHE:
        f=os.path.join(W,'cn/city/%s.json'%slug);CACHE[slug]=json.load(open(f,encoding='utf-8')) if os.path.exists(f) else None
    return CACHE[slug]
out=[];stat={'sight':0,'city':0,'prov':0};USED=set()  # 一个城市页景点只给一个 5A 用（不然两张卡片共用一条「去过」记录）
for r in rows:
    p=PV.get(r['prov']);
    if not p: print('no prov',r);continue
    cands=[x for x in (r['city'],r['county']) if x]
    city=None
    for c in p['cities']:
        if any(c['zh']==x or stem(c['zh'])==stem(x) for x in cands): city=c;break
    d=dict(id='',n=r['name'],p=p['zh'],ps=p['slug'],r=p['region'],c=(r['city'] or r['county']),k=r['county'] if r['city'] else '',y=r['date'][:10],w=r['wiki'],img='',go='prov:'+p['slug'])
    if r.get('new'): d['new']=1
    hit=None
    if city:
        d['go']=city.get('go') or 'city:'+city['slug'];d['cz']=city['zh']
        J=city_json(city['slug'])
        if J:
            k=key(r['name']);kw=key(r['wiki']) if r['wiki'] else ''
            for s in J['sights']:
                ks=key(s['zh'])
                if len(ks)<2 or ks==stem(city['zh']) or s['id'] in USED: continue
                if ks in k or k in ks or (kw and len(ks)>=3 and kw!=r['city'] and stem(kw)!=stem(city['zh']) and (ks in kw or kw in ks)): hit=s;break
    if hit:
        d['id']=hit['id'];d['img']=hit.get('photo') or '';d['sz']=hit['zh'];stat['sight']+=1;USED.add(hit['id'])
    else:
        d['id']='5a-'+hashlib.md5((p['zh']+r['name']).encode()).hexdigest()[:10];stat['city' if city else 'prov']+=1
    if not d['img'] and WI.get(r['wiki']): d['img']=WI[r['wiki']]
    ll=locate(p['slug'],[r['name'],r['wiki'],d.get('sz','')],ccenter(p['slug'],city['zh']) if city else None)
    if ll: d['ll']=ll;stat['ll']=stat.get('ll',0)+1
    elif city and ccenter(p['slug'],city['zh']):
        c0=ccenter(p['slug'],city['zh']);hh=int(hashlib.md5(r['name'].encode()).hexdigest()[:4],16)  # 城市中心 + 一点偏移（同城几个不重叠），la=1 表示大概位置
        d['ll']=[round(c0[0]+((hh%17)-8)*0.012,4),round(c0[1]+((hh//17%17)-8)*0.012,4)];d['la']=1;stat['ll~']=stat.get('ll~',0)+1
    else:
        pj=json.load(open(os.path.join(W,'cn',p['slug']+'.json'),encoding='utf-8'));d['ll']=[pj['lat'],pj['lng']];d['la']=1
    lat,lng=d['ll'];d['xy']=[round((lng-73.0)*math.cos(math.radians(36))*20.0,1),round((54.0-lat)*20.0,1)]  # 地图坐标：和 make_map.py 的 P() 同一个投影
    d['th']=th(d['img'])
    out.append(d)
out.sort(key=lambda x:(ORD[x['p']],x['y']))
SEEN={}
for x in out:  # 跨省的同一个景区（如黄河壶口瀑布：山西、陕西各列一次）第二次标 dup，总数只算一处；同名但不是一处的（浙江 / 四川天台山，维基条目不同）不算
    w0=SEEN.get(x['n'])
    if w0 is not None and x['w'] and w0 and (w0 in x['w'] or x['w'] in w0): x['dup']=1
    SEEN.setdefault(x['n'],x['w'])
json.dump(out,open(os.path.join(W,'cn/5a.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(len(out),'5A →',os.path.join(W,'cn/5a.json'),stat,'有照片',sum(1 for x in out if x['img']))
