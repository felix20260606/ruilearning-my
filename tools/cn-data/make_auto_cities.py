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
def sparql(q,tries=5,need=True):
    for t in range(tries):
        out=subprocess.run(['curl','-s','-m','170','-G','https://query.wikidata.org/sparql','--data-urlencode','query='+q,'-H','Accept: application/sparql-results+json','-A',UA],capture_output=True,text=True).stdout
        try: return json.loads(out)['results']['bindings']
        except Exception: time.sleep(20*(t+1))
    if need: raise SystemExit('SPARQL 一直失败')
    print('  查询失败，跳过',flush=True);return []
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
# 补充：上面查出来不到 THIN 个景点的城市（港台、直辖市的区、偏远地区）再查一轮——任何文物 / 古迹等级（省级文保、香港法定古迹、台湾古迹…）
# 或者是旅游景点 / 博物馆 / 公园 / 美术馆 / 园林 / 游乐园 / 主题公园 / 动物园 / 水族馆，而且必须有中文维基条目；原始结果存 auto-raw/<省>-extra.json
# 兜底：维基数据里很多景点还挂在撤县设区以前的旧「县」下面（重庆的区县最多），按新城市查不到。办法：全国的世界遗产 / 5A / 国保只查编号和坐标（很轻，
# 存 auto-raw/_national.json），用省界（raw/datav-cn.json）判断在哪个省，没归到城市的放进省内最近的城市；详细信息用 VALUES 补查，存 auto-raw/<省>-all.json
Q_NAT={'gb':'?x wdt:P1435 wd:Q1188574 .','5a':'?x wdt:P31 wd:Q6838244 .','wh':'?x wdt:P1435 wd:Q9259 . ?x wdt:P17 ?cn . VALUES ?cn { wd:Q148 wd:Q865 }'}
Q_DET=(SEL%'').replace('{ ?x wdt:P1435 wd:Q9259 . BIND("wh" AS ?kind) } UNION { ?x wdt:P31 wd:Q6838244 . BIND("5a" AS ?kind) } UNION { ?x wdt:P1435 wd:Q1188574 . BIND("gb" AS ?kind) }','VALUES ?x { %s } BIND("" AS ?kind)')
THIN=8
EXTYPE={'洞穴','山','瀑布','湖泊','峡谷','温泉','国家森林公园','旅游景点','博物馆','公园','城市公园','美术馆','园林','中国园林','国家公园','郊野公园','历史博物馆','游乐园','主题公园','动物园','水族馆','海洋公园'}
TYPES='wd:Q570116 wd:Q33506 wd:Q22698 wd:Q207694 wd:Q1107656 wd:Q2065736 wd:Q194195 wd:Q2416723 wd:Q43501 wd:Q2281788'
# 第二种补充：按城市边界框查（维基数据的 wikibase:box），再用边界多边形筛——挂在旧县下面、P131 查不到的也能找到（原始结果存 auto-raw/<省>-box.json）
Q_BOX='''SELECT ?x ?xl ?xlz ?xen ?coord ?img ?zhw ?tl ?hl WHERE {
  SERVICE wikibase:box { ?x wdt:P625 ?coord . bd:serviceParam wikibase:cornerSouthWest "Point(%s %s)"^^geo:wktLiteral ; wikibase:cornerNorthEast "Point(%s %s)"^^geo:wktLiteral . }
  { ?x wdt:P1435 ?h . OPTIONAL { ?h rdfs:label ?hl FILTER(lang(?hl)="zh-cn") } } UNION { VALUES ?t0 { %s wd:Q35509 wd:Q34038 wd:Q46169 wd:Q8502 wd:Q39816 wd:Q23397 } ?x wdt:P31 ?t0 . }
  ?zhw schema:about ?x ; schema:isPartOf <https://zh.wikipedia.org/> .
  OPTIONAL { ?x rdfs:label ?xl FILTER(lang(?xl)="zh-cn") } OPTIONAL { ?x rdfs:label ?xlz FILTER(lang(?xlz)="zh") } OPTIONAL { ?x rdfs:label ?xen FILTER(lang(?xen)="en") }
  OPTIONAL { ?x wdt:P18 ?img } OPTIONAL { ?x wdt:P31 ?t . ?t rdfs:label ?tl FILTER(lang(?tl)="zh-cn") }
}'''
Q_EXTRA='''SELECT ?city ?x ?xl ?xlz ?xen ?coord ?img ?zhw ?tl ?hl WHERE {
  VALUES ?city { %s }
  { ?x wdt:P1435 ?h . OPTIONAL { ?h rdfs:label ?hl FILTER(lang(?hl)="zh-cn") } } UNION { VALUES ?t0 { wd:Q570116 wd:Q33506 wd:Q22698 wd:Q207694 wd:Q1107656 wd:Q2065736 wd:Q194195 wd:Q2416723 wd:Q43501 wd:Q2281788 } ?x wdt:P31 ?t0 . }
  ?x wdt:P131+ ?city . ?zhw schema:about ?x ; schema:isPartOf <https://zh.wikipedia.org/> . ?x wdt:P625 ?coord .
  OPTIONAL { ?x rdfs:label ?xl FILTER(lang(?xl)="zh-cn") } OPTIONAL { ?x rdfs:label ?xlz FILTER(lang(?xlz)="zh") } OPTIONAL { ?x rdfs:label ?xen FILTER(lang(?xen)="en") }
  OPTIONAL { ?x wdt:P18 ?img } OPTIONAL { ?x wdt:P31 ?t . ?t rdfs:label ?tl FILTER(lang(?tl)="zh-cn") }
}'''
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
natf=os.path.join(RAW,'_national.json')
if os.path.exists(natf): NAT=json.load(open(natf,encoding='utf-8'))
else:
    NAT={}
    for k,q in Q_NAT.items():
        for b in sparql('SELECT ?x ?coord WHERE { %s ?x wdt:P625 ?coord . }'%q):
            x=b['x']['value'].split('/')[-1];c=coord(b['coord']['value'])
            if c: NAT.setdefault(x,{'c':c,'k':[]})['k'].append(k)
        time.sleep(3)
    json.dump(NAT,open(natf,'w',encoding='utf-8'),ensure_ascii=False)
GEO={}
for ft in json.load(open(os.path.join(HERE,'raw','datav-cn.json'),encoding='utf-8'))['features']:
    nm=ft['properties'].get('name','')
    if nm and ft['geometry']: GEO[nm]=ft['geometry']['coordinates'] if ft['geometry']['type']=='MultiPolygon' else [ft['geometry']['coordinates']]
def inside(lat,lng,polys):
    for poly in polys:
        ring=poly[0];n=len(ring);ins=False;j=n-1
        for i in range(n):
            xi,yi=ring[i];xj,yj=ring[j]
            if (yi>lat)!=(yj>lat) and lng<(xj-xi)*(lat-yi)/(yj-yi)+xi: ins=not ins
            j=i
        if ins: return True
    return False
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
        d=items.setdefault(x,{'id':x,'cn':'xl' in b,'zh':b.get('xl',{}).get('value') or b.get('xlz',{}).get('value') or '','en':b.get('xen',{}).get('value',''),'coord':coord(b.get('coord',{}).get('value')),
            'img':fname(b.get('img',{}).get('value')),'zhw':title(b.get('zhw',{}).get('value')),'kinds':set(),'types':set(),'cities':set()})
        d['kinds'].add(b['kind']['value'])
        if 'tl' in b: d['types'].add(b['tl']['value'])
        if 'city' in b: d['cities'].add('wd:'+b['city']['value'].split('/')[-1])
    allf=os.path.join(RAW,P['slug']+'-all.json')
    if os.path.exists(allf): A=json.load(open(allf,encoding='utf-8'))
    else:
        polys=next(v for k,v in GEO.items() if k.startswith(P['zh'][:2]))
        miss=sorted(x for x,v in NAT.items() if x not in items and inside(v['c'][0],v['c'][1],polys))
        A=[]
        for i in range(0,len(miss),80):
            for b in sparql(Q_DET%' '.join('wd:'+m for m in miss[i:i+80])):
                x=b['x']['value'].split('/')[-1]
                for kd in NAT[x]['k']: b2=dict(b);b2['kind']={'value':kd};A.append(b2)
            time.sleep(3)
        json.dump(A,open(allf,'w',encoding='utf-8'),ensure_ascii=False)
    for b in A:
        x=b['x']['value'].split('/')[-1]
        d=items.setdefault(x,{'id':x,'cn':'xl' in b,'zh':b.get('xl',{}).get('value') or b.get('xlz',{}).get('value') or '','en':b.get('xen',{}).get('value',''),'coord':coord(b.get('coord',{}).get('value')),
            'img':fname(b.get('img',{}).get('value')),'zhw':title(b.get('zhw',{}).get('value')),'kinds':set(),'types':set(),'cities':set()})
        d['kinds'].add(b['kind']['value'])
        if 'tl' in b: d['types'].add(b['tl']['value'])
    # 市 / 区县边界（raw/datav/<省代码>.json，阿里云 DataV）：查不到归属的景点按坐标落在哪个市就归哪个市
    CG={}
    adc=next((ft['properties']['adcode'] for ft in json.load(open(os.path.join(HERE,'raw','datav-cn.json'),encoding='utf-8'))['features'] if ft['properties'].get('name','').startswith(P['zh'][:2])),None)
    gf=os.path.join(HERE,'raw','datav','%s.json'%adc)
    if adc and os.path.exists(gf) and os.path.getsize(gf)>1000:
        for ft in json.load(open(gf,encoding='utf-8'))['features']:
            nm=ft['properties'].get('name','');g=ft.get('geometry')
            if not nm or not g: continue
            c=next((c for c,cc in cities.items() if cc['zh']==nm),None) or next((c for c,cc in cities.items() if cc['zh'][:2]==nm[:2]),None)
            if c: CG[c]=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    def incity(lat,lng): return [c for c,pl in CG.items() if inside(lat,lng,pl)]
    owner={}
    for x,d in items.items():
        if not d['coord']: continue
        cand=list(d['cities']) or incity(*d['coord']) or list(cities)   # 查不到属于哪个市：看坐标落在哪个市的边界里，还不行就挑最近的
        best=min(cand,key=lambda c:math.hypot(d['coord'][0]-cities[c]['lat'],(d['coord'][1]-cities[c]['lng'])*math.cos(math.radians(d['coord'][0]))))
        owner[x]=(best,0);per.setdefault(best,{})[x]=d
    # 景点太少的城市：补充查询
    def made_here(c): cc=cities[c];return not (cc.get('go') and not cc['go'].startswith('city:'))
    thin=[c for c in cities if made_here(c) and sum(1 for x in per.get(c,{}) if items[x]['zh'])<THIN]
    if thin:
        exf=os.path.join(RAW,P['slug']+'-extra.json')
        if os.path.exists(exf): E=json.load(open(exf,encoding='utf-8'))
        else:
            E=[]
            for c in thin: E+=sparql(Q_EXTRA%c,3,False);time.sleep(2)   # 一次一个城市（一次查好几个会超时）
            json.dump(E,open(exf,'w',encoding='utf-8'),ensure_ascii=False)
        bxf=os.path.join(RAW,P['slug']+'-box.json')
        if os.path.exists(bxf): BX=json.load(open(bxf,encoding='utf-8'))
        else:
            BX=[]
            for c in thin:
                if c in CG: pts=[p for poly in CG[c] for p in poly[0]];w,e_,s_,n=min(p[0] for p in pts),max(p[0] for p in pts),min(p[1] for p in pts),max(p[1] for p in pts)
                else: w,e_,s_,n=cities[c]['lng']-.12,cities[c]['lng']+.12,cities[c]['lat']-.1,cities[c]['lat']+.1   # 没有边界的（兵团城市等）：中心附近一小块
                for b in sparql(Q_BOX%(w,s_,e_,n,TYPES),3,False): b['city']={'value':c[3:]};BX.append(b)
                time.sleep(2)
            json.dump(BX,open(bxf,'w',encoding='utf-8'),ensure_ascii=False)
        E=E+[b for b in BX if not ('wd:'+b['city']['value'] in CG and not inside(*coord(b['coord']['value']),CG['wd:'+b['city']['value']]))]
        for b in E:
            x=b['x']['value'].split('/')[-1];c='wd:'+b['city']['value'].split('/')[-1]
            if x in owner or c not in thin or not coord(b.get('coord',{}).get('value')): continue
            d=items.setdefault(x,{'id':x,'cn':'xl' in b,'zh':b.get('xl',{}).get('value') or b.get('xlz',{}).get('value') or '','en':b.get('xen',{}).get('value',''),'coord':coord(b.get('coord',{}).get('value')),
                'img':fname(b.get('img',{}).get('value')),'zhw':title(b.get('zhw',{}).get('value')),'kinds':{'ex'},'types':set(),'cities':set(),'heritage':set()})
            if 'tl' in b: d['types'].add(b['tl']['value'])
            if 'hl' in b: d['heritage'].add(b['hl']['value'])
            d['cities'].add(c)
        for x,d in items.items():
            if x in owner or not d['coord'] or 'ex' not in d['kinds']: continue
            best=min(d['cities'],key=lambda c:math.hypot(d['coord'][0]-cities[c]['lat'],d['coord'][1]-cities[c]['lng']))  # 一般只有一个；区和市都在的话挑近的
            owner[x]=(best,0);per.setdefault(best,{})[x]=d
    # 中文维基开头两句（简体），20 个一批
    titles=sorted({d['zhw'] for xs in per.values() for d in xs.values() if d['zhw']})
    EX={};VT={}   # VT：条目的简体标题（维基数据没有简体名的，比如港台，用它）
    for i in range(0,len(titles),20):
        j=zhapi({'action':'query','format':'json','prop':'extracts|info','inprop':'varianttitles','exintro':1,'explaintext':1,'exsentences':2,'exlimit':20,'titles':'|'.join(titles[i:i+20]),'variant':'zh-cn','redirects':1})
        q=j.get('query',{});norm={n['to']:n['from'] for n in q.get('normalized',[])};red={n['to']:n['from'] for n in q.get('redirects',[])}
        for pg in q.get('pages',{}).values():
            t=pg['title'];t=norm.get(red.get(t,t),red.get(t,t));EX[t]=pg.get('extract','');VT[t]=pg.get('varianttitles',{}).get('zh-cn','')
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
            if 'ex' in k: rate=2 if (any(re.search(r'法定古迹|古迹|文物保护单位',h) for h in d['heritage']) or d['types']&EXTYPE) else 1   # 补充的：古迹 / 景点 / 博物馆 / 公园 ★★，其它（普通历史建筑）★
            nm=d['zh'] if d.get('cn',True) else (re.sub(r'\s*\(.*\)$','',VT.get(d['zhw'],'')) or d['zh'])
            ex=re.sub(r'\s+',' ',re.sub(r'（[^（）]*）|\([^()]*\)','',EX.get(d['zhw'],''))).strip()  # 去掉括号和换行
            if len(ex)>140: m=ex.find('。',60);ex=ex[:m+1] if 0<m<170 else ex[:140]+'…'
            tag=' · '.join([t for t,f in (('世界遗产','wh'),('国家 5A 级景区','5a'),('全国重点文物保护单位','gb')) if f in k]+sorted(d.get('heritage',()))[:2])
            S.append(dict(id='w-'+x,zh=nm,en=d['en'],cat=cat(nm,d['types']),area=tag,addr='',transit='',hours='',price='',dur='',desc=ex,tips='',
                          q=cc['zh'].rstrip('市')+' '+nm,src=('https://zh.wikipedia.org/zh-cn/'+d['zhw'].replace(' ','_')) if d['zhw'] else 'https://www.wikidata.org/wiki/'+x,
                          rate=rate,photo=d['img'],lat=round(d['coord'][0],5),lng=round(d['coord'][1],5)))
        S.sort(key=lambda s:(-s['rate'],not s['photo'],s['zh']));S=S[:60]
        if len(S)<THIN: print('  少：',cc['zh'],len(S),flush=True)
        doc=dict(slug=cc['slug'],zh=cc['zh'],en=cc['en'],prov=P['slug'],provZh=P['zh'],desc=cc.get('desc',''),img=cc.get('img',''),wiki=cc.get('wiki',''),lat=cc['lat'],lng=cc['lng'],
                 auto=True,from_hz='',local='',tips='',sights=S)
        json.dump(doc,open(out,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'));made+=1
    print(P['slug'],'cities',len(cities),'made',made,'sights',sum(len(v) for v in per.values()),flush=True)
