import json,re,math,time,urllib.parse as U,subprocess,os
UA='ban-life-trip-pages/1.0 (personal site)'
def coord(s):
    if not s: return None
    m=re.match(r'Point\(([-\d.]+) ([-\d.]+)\)',s); return (float(m.group(2)),float(m.group(1))) if m else None
def fname(url):
    return U.unquote(url.split('/')[-1]).replace('_',' ') if url else ''
def title(url): return U.unquote(url.split('/wiki/')[-1]).replace('_',' ') if url else ''
# provinces
P={}
for b in json.load(open('q5.json'))['results']['bindings']:
    q=b['p']['value'].split('/')[-1]
    P[q]=dict(id=q,zh=b.get('pl',{}).get('value') or b.get('plz',{}).get('value'),en=b.get('pen',{}).get('value',''),coord=coord(b.get('coord',{}).get('value')),
      img=fname(b.get('img',{}).get('value')),zhw=title(b.get('zhw',{}).get('value')),cap=b.get('capl',{}).get('value'),capcoord=coord(b.get('capcoord',{}).get('value')),cities={})
P['Q57251']['zh']='台湾'
# cities
raw=json.load(open('cities_raw.json'))
for p,cs in raw.items():
    for c,v in cs.items():
        P[p]['cities'][c]=dict(id=c,zh=v['zh'],en=v['en'] or '',coord=coord(v['coord']),img=fname(v['img']),zhw=title(v['zhw']),types=v['types'])
for b in json.load(open('q4.json'))['results']['bindings']:
    p=b['p']['value'].split('/')[-1];c=b['c']['value'].split('/')[-1]
    if c in P[p]['cities']: continue
    P[p]['cities'][c]=dict(id=c,zh=b.get('cl',{}).get('value') or b.get('clz',{}).get('value'),en=b.get('cen',{}).get('value',''),coord=coord(b.get('coord',{}).get('value')),img=fname(b.get('img',{}).get('value')),zhw=title(b.get('zhw',{}).get('value')),types=[])
DROP={'两江新区','宁夏农垦','中沙群岛','台湾地区'}
for p in P.values():
    for c in list(p['cities']):
        x=p['cities'][c]
        if x['zh'] in DROP or c=='Q141978883' or not x['coord']: del p['cities'][c]
# extracts + pageimages from zhwiki
titles=[]
for p in P.values():
    if p['zhw']: titles.append(p['zhw'])
    for x in p['cities'].values():
        if x['zhw']: titles.append(x['zhw'])
EX={}
for i in range(0,len(titles),20):
    chunk=titles[i:i+20]
    out=subprocess.run(['curl','-s','-G','https://zh.wikipedia.org/w/api.php','--data-urlencode','action=query','--data-urlencode','prop=extracts|pageimages','--data-urlencode','exintro=1','--data-urlencode','explaintext=1','--data-urlencode','exsentences=2','--data-urlencode','exlimit=20','--data-urlencode','piprop=name','--data-urlencode','titles='+'|'.join(chunk),'--data-urlencode','variant=zh-cn','--data-urlencode','format=json','-A',UA],capture_output=True,text=True).stdout
    try: j=json.loads(out)
    except Exception: time.sleep(10); j=json.loads(subprocess.run(['curl','-s','-G','https://zh.wikipedia.org/w/api.php','--data-urlencode','action=query','--data-urlencode','prop=extracts|pageimages','--data-urlencode','exintro=1','--data-urlencode','explaintext=1','--data-urlencode','exsentences=2','--data-urlencode','exlimit=20','--data-urlencode','piprop=name','--data-urlencode','titles='+'|'.join(chunk),'--data-urlencode','variant=zh-cn','--data-urlencode','format=json','-A',UA],capture_output=True,text=True).stdout)
    norm={n['to']:n['from'] for n in j['query'].get('normalized',[])}
    for pg in j['query']['pages'].values():
        t=norm.get(pg['title'],pg['title'])
        EX[t]=(pg.get('extract',''),pg.get('pageimage',''))
    time.sleep(0.5)
BAD=re.compile(r'(map|location|locator|flag|emblem|seal|logo|\.svg$|地图|位置|区划|行政|旗|徽)',re.I)
def clean(t):
    t=re.sub(r'（[^（）]*）|\([^()]*\)','',t).strip()
    t=re.sub(r'\s+',' ',t)
    if len(t)>130:
        k=t.find('。',60); t=t[:k+1] if 0<k<160 else t[:130]+'…'
    return t
def hav(a,b):
    if not a or not b: return None
    la1,lo1,la2,lo2=map(math.radians,[a[0],a[1],b[0],b[1]])
    h=math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return round(2*6371*math.asin(math.sqrt(h)))
MUNI={'Q956','Q8686','Q11736','Q11725','Q8646','Q14773','Q57251'}
stats=[0,0]
for p in P.values():
    ex,pi=EX.get(p['zhw'],('',''))
    p['desc']=clean(ex)
    if not p['img'] or BAD.search(p['img']): p['img']=pi.replace('_',' ') if pi and not BAD.search(pi) else ''
    ref=p['coord'] if p['id'] in MUNI else (p['capcoord'] or p['coord'])
    if p['id']=='Q57251':
        tp=[x for x in p['cities'].values() if x['zh']=='台北市']; ref=tp[0]['coord'] if tp else ref
    for x in p['cities'].values():
        ex,pi=EX.get(x['zhw'],('',''))
        x['desc']=clean(ex)
        if not x['img'] or BAD.search(x['img']):
            x['img']=pi.replace('_',' ') if pi and not BAD.search(pi) else ''
        if not x['img']: stats[1]+=1
        stats[0]+=1
        x['km']=hav(ref,x['coord'])
        x['cap']=bool(p['cap'] and x['zh']==p['cap'])
json.dump(P,open('data_all.json','w'),ensure_ascii=False)
print('cities',stats[0],'noimg',stats[1],'extracts',sum(1 for v in EX.values() if v[0]))
