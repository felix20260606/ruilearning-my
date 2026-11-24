# 给没有照片的景点补照片：用中文维基百科搜景点名（加城市名），取条目首图（pageimage），去掉地图 / 标志 / 徽章这类
# 用法：python3 fill_photos.py <景点 json>…（只改 photo 为空的；改过的记一个 photo_from="zhwiki:<条目>" 方便核对）
import json,sys,subprocess,time,re,urllib.parse as U
UA='ban-life-trip-pages/1.0 (personal site)'
BAD=re.compile(r'(map|location|locator|flag|emblem|seal|logo|icon|\.svg$|地图|位置|区划|行政|旗|徽|标志)',re.I)
def api(params):
    for i in range(3):
        out=subprocess.run(['curl','-s','-G','https://zh.wikipedia.org/w/api.php']+sum([['--data-urlencode','%s=%s'%(k,v)] for k,v in params.items()],[])+['-A',UA],capture_output=True,text=True).stdout
        try: return json.loads(out)
        except Exception: time.sleep(5)
    return {}
for f in sys.argv[1:]:
    j=json.load(open(f,encoding='utf-8'));city=j['city']['zh'];n=0
    for x in j['sights']:
        if x.get('photo') or x.get('photo_checked'): continue  # photo_checked：人工看过（不对的留空），不再自动填
        name=re.sub(r'（.*?）|\(.*?\)','',x['zh']).split('·')[0].split(' / ')[0].strip()
        r=api({'action':'query','format':'json','generator':'search','gsrsearch':'%s %s'%(name,city),'gsrlimit':'3','prop':'pageimages','piprop':'name','variant':'zh-cn'})
        pages=sorted((r.get('query') or {}).get('pages',{}).values(),key=lambda p:p.get('index',9))
        for p in pages:
            im=p.get('pageimage','')
            if im and not BAD.search(im) and (name[:2] in p['title'] or p['title'][:2] in name):
                x['photo']=im.replace('_',' ');x['photo_from']='zhwiki:'+p['title'];n+=1;break
        time.sleep(0.4)
    json.dump(j,open(f,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    print(f.split('/')[-1],'filled',n,'still none',sum(1 for x in j['sights'] if not x.get('photo')),'/',len(j['sights']))
