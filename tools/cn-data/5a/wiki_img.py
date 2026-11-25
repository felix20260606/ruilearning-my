# 给没对上城市页照片的 5A 景区补照片：按维基条目名批量查 pageimage（每次 50 个），结果存 wiki-img.json（make_5a.py 读）
import json,os,subprocess,time,re
H=os.path.dirname(os.path.abspath(__file__))
C=json.load(open(os.path.join(H,'wiki-img.json'))) if os.path.exists(os.path.join(H,'wiki-img.json')) else {}
d=json.load(open(os.path.join(H,'../../../web/cn/5a.json'),encoding='utf-8'))
need=sorted({x['w'] for x in d if x['w'] and not x['img'] and x['w'] not in C})
BAD=re.compile(r'(map|location|locator|flag|emblem|seal|logo|icon|\.svg$|地图|位置|区划|旗|徽|标志)',re.I)
for i in range(0,len(need),50):
    ts=need[i:i+50]
    out=subprocess.run(['curl','-s','https://zh.wikipedia.org/w/api.php','--data-urlencode','titles='+'|'.join(ts),'-d','action=query','-d','format=json','-d','prop=pageimages','-d','piprop=name','-d','redirects=1','-A','ban-life-trip-pages/1.0'],capture_output=True,text=True).stdout
    try: q=json.loads(out)['query']
    except Exception: print('rate limited',out[:60]);break
    rd={x['from']:x['to'] for x in q.get('redirects',[])+q.get('normalized',[])}
    pi={p['title']:p.get('pageimage','') for p in q['pages'].values()}
    for t in ts:
        im=pi.get(rd.get(t,t),'') or pi.get(rd.get(rd.get(t,t),''),'')
        C[t]=im.replace('_',' ') if im and not BAD.search(im) else ''
    time.sleep(3)
json.dump(C,open(os.path.join(H,'wiki-img.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print('cached',len(C),'with image',sum(1 for v in C.values() if v))
