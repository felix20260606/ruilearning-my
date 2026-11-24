# 全国城市页（自动版）：每个城市的景点从维基数据自动整理 → web/cn/city/<网址名>.json（城市页 cn-city.html?c=<网址名> 读）
# 景点 = 这个城市里的 世界遗产（P1435 Q9259）/ 国家 5A 级旅游景区（P31 Q6838244）/ 全国重点文物保护单位（P1435 Q1188574），按 P131 一路往上归到城市
# 每个景点：名字、英文名、照片（P18）、坐标、中文维基开头两句、维基链接；星级：世界遗产 / 5A = ★★★，有照片和条目的国保 = ★★，其它 ★
# 已经有手工详细版的城市（文件里没有 "auto": true）不覆盖；杭州、重庆渝中这种挂了别的页面的也跳过
# 用法：python3 make_auto_cities.py <web 目录> [省拼音 …]（不写省就全部；每个省一次 SPARQL，中间歇几秒；原始结果存 tools/cn-data/auto-raw/<省>.json 留底）
import json,os,sys,re,time,subprocess,glob,math
UA='ban-life-trip-pages/1.0 (personal site)'
web=sys.argv[1];only=set(sys.argv[2:])
HERE=os.path.dirname(os.path.abspath(__file__));RAW=os.path.join(HERE,'auto-raw');os.makedirs(RAW,exist_ok=True)
os.makedirs(os.path.join(web,'cn','city'),exist_ok=True)
def sparql(q):
    for t in range(5):
        out=subprocess.run(['curl','-s','-m','170','-G','https://query.wikidata.org/sparql','--data-urlencode','query='+q,'-H','Accept: application/sparql-results+json','-A',UA],capture_output=True,text=True).stdout
        try: return json.loads(out)['results']['bindings']
        except Exception: time.sleep(20*(t+1))
    raise SystemExit('SPARQL 一直失败')
def zhapi(params):
    for t in range(5):
        out=subprocess.run(['curl','-s','-G','https://zh.wikipedia.org/w/api.php']+sum([['--data-urlencode','%s=%s'%(k,v)] for k,v in params.items()],[])+['-A',UA],capture_output=True,text=True).stdout
        try: return json.loads(out)
        except Exception: time.sleep(15*(t+1))
    return {}
SEL='''SELECT ?city ?x ?xl ?xlz ?xen ?coord ?img ?zhw ?kind ?tl WHERE {
  { ?x wdt:P1435 wd:Q9259 . BIND("wh" AS ?kind) } UNION { ?x wdt:P31 wd:Q6838244 . BIND("5a" AS ?kind) } UNION { ?x wdt:P1435 wd:Q1188574 . BIND("gb" AS ?kind) }
  %s
  OPTIONAL { ?x rdfs:label ?xl FILTER(lang(?xl)="zh-cn") } OPTIONAL { ?x rdfs:label ?xlz FILTER(lang(?xlz)="zh") } OPTIONAL { ?x rdfs:label ?xen FILTER(lang(?xen)="en") }
  OPTIONAL { ?x wdt:P625 ?coord } OPTIONAL { ?x wdt:P18 ?img }
  OPTIONAL { ?zhw schema:about ?x ; schema:isPartOf <https://zh.wikipedia.org/> }
  OPTIONAL { ?x wdt:P31 ?t . ?t rdfs:label ?tl FILTER(lang(?tl)="zh-cn") }
}'''
Q_CITY=SEL%'VALUES ?city { %s } ?x wdt:P131+ ?city .'   # 归得到市的（P131 一路往上到某个市）
Q_PROV=SEL%'?x wdt:P131 wd:%s .'                        # 直接挂在省下面的（黄山、泰山这种跨区县的大景区）：后面放进最近的城市
def fname(u): return __import__('urllib.parse').parse.unquote(u.split('/')[-1]).replace('_',' ') if u else ''
def title(u): return __import__('urllib.parse').parse.unquote(u.split('/wiki/')[-1]).replace('_',' ') if u else ''
def coord(s):
    m=re.match(r'Point\(([-\d.]+) ([-\d.]+)\)',s or '');return (float(m.group(2)),float(m.group(1))) if m else None
CAT=[('宗教建筑',r'寺|庙|宫观|道观|观$|塔|教堂|清真寺|禅|庵|祠|佛'),('博物馆',r'博物馆|纪念馆|美术馆|陈列馆|展览馆'),('街区',r'古镇|古村|村落|街|民居|古城|城墙|镇$|村$|里$|巷'),
     ('公园自然',r'山|湖|公园|峡谷|瀑布|森林|湿地|风景|海|岛|洞|河|江|泉|园林|园$'),('地标','.')]
def cat(name,types):
    s=name+' '+' '.join(types)
    for c,p in CAT:
        if re.search(p,s): return c
    return '地标'
for pf in sorted(glob.glob(os.path.join(web,'cn','*.json'))):
    if os.path.basename(pf) in ('map.json','index.json','visited.json'): continue
    P=json.load(open(pf,encoding='utf-8'))
    if only and P['slug'] not in only: continue
    cities={'wd:'+c['id'][3:]:c for c in P['cities']}
    rawf=os.path.join(RAW,P['slug']+'.json')
    if os.path.exists(rawf): B=json.load(open(rawf,encoding='utf-8'))
    else:
        B=sparql(Q_CITY.replace('%s',' '.join(cities),1));time.sleep(4);B+=sparql(Q_PROV.replace('%s',P['qid'],1));json.dump(B,open(rawf,'w',encoding='utf-8'),ensure_ascii=False);time.sleep(6)
    per={};items={}
    for b in B:
        x=b['x']['value'].split('/')[-1]
        d=items.setdefault(x,{'id':x,'zh':b.get('xl',{}).get('value') or b.get('xlz',{}).get('value') or '','en':b.get('xen',{}).get('value',''),'coord':coord(b.get('coord',{}).get('value')),
            'img':fname(b.get('img',{}).get('value')),'zhw':title(b.get('zhw',{}).get('value')),'kinds':set(),'types':set(),'cities':set()})
        d['kinds'].add(b['kind']['value'])
        if 'tl' in b: d['types'].add(b['tl']['value'])
        if 'city' in b: d['cities'].add('wd:'+b['city']['value'].split('/')[-1])
    owner={}
    for x,d in items.items():
        if not d['coord']: continue
        cand=list(d['cities']) or list(cities)   # 查不到属于哪个市：全省的城市里挑最近的
        best=min(cand,key=lambda c:math.hypot(d['coord'][0]-cities[c]['lat'],(d['coord'][1]-cities[c]['lng'])*math.cos(math.radians(d['coord'][0]))))
        owner[x]=(best,0);per.setdefault(best,{})[x]=d
    # 中文维基开头两句（简体），20 个一批
    titles=sorted({d['zhw'] for xs in per.values() for d in xs.values() if d['zhw']})
    EX={}
    for i in range(0,len(titles),20):
        j=zhapi({'action':'query','format':'json','prop':'extracts','exintro':1,'explaintext':1,'exsentences':2,'exlimit':20,'titles':'|'.join(titles[i:i+20]),'variant':'zh-cn','redirects':1})
        q=j.get('query',{});norm={n['to']:n['from'] for n in q.get('normalized',[])};red={n['to']:n['from'] for n in q.get('redirects',[])}
        for pg in q.get('pages',{}).values():
            t=pg['title'];t=norm.get(red.get(t,t),red.get(t,t));EX[t]=pg.get('extract','')
        time.sleep(0.6)
    made=0
    for c,cc in cities.items():
        if cc.get('go') and not cc['go'].startswith('city:'): continue   # 杭州 → 杭州景点大全、渝中 → 重庆景点大全
        out=os.path.join(web,'cn','city',cc['slug']+'.json')
        if os.path.exists(out) and not json.load(open(out,encoding='utf-8')).get('auto'): continue  # 手工详细版不覆盖
        S=[]
        for x,d in per.get(c,{}).items():
            if owner[x][0]!=c or not d['zh'] or not d['coord']: continue
            k=d['kinds'];rate=3 if ('wh' in k or '5a' in k) else (2 if (d['img'] and d['zhw']) else 1)
            ex=re.sub(r'\s+',' ',re.sub(r'（[^（）]*）|\([^()]*\)','',EX.get(d['zhw'],''))).strip()  # 去掉括号和换行
            if len(ex)>140: m=ex.find('。',60);ex=ex[:m+1] if 0<m<170 else ex[:140]+'…'
            tag=' · '.join(t for t,f in (('世界遗产','wh'),('国家 5A 级景区','5a'),('全国重点文物保护单位','gb')) if f in k)
            S.append(dict(id='w-'+x,zh=d['zh'],en=d['en'],cat=cat(d['zh'],d['types']),area=tag,addr='',transit='',hours='',price='',dur='',desc=ex,tips='',
                          q=cc['zh'].rstrip('市')+' '+d['zh'],src=('https://zh.wikipedia.org/zh-cn/'+d['zhw'].replace(' ','_')) if d['zhw'] else 'https://www.wikidata.org/wiki/'+x,
                          rate=rate,photo=d['img'],lat=round(d['coord'][0],5),lng=round(d['coord'][1],5)))
        S.sort(key=lambda s:(-s['rate'],not s['photo'],s['zh']));S=S[:60]
        doc=dict(slug=cc['slug'],zh=cc['zh'],en=cc['en'],prov=P['slug'],provZh=P['zh'],desc=cc.get('desc',''),img=cc.get('img',''),wiki=cc.get('wiki',''),lat=cc['lat'],lng=cc['lng'],
                 auto=True,from_hz='',local='',tips='',sights=S)
        json.dump(doc,open(out,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'));made+=1
    print(P['slug'],'cities',len(cities),'made',made,'sights',sum(len(v) for v in per.values()),flush=True)
