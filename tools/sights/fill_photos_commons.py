# 第二轮补照片：在维基共享资源里按「景点名 + 城市」搜图片（只要 jpg，去掉地图 / 标志 / 人物这类），记 photo_from="commons-search"
# 用法：python3 fill_photos_commons.py <景点 json>…（只改 photo 为空的；搜到的要再看一遍缩略图）
import json,sys,subprocess,time,re
UA='ban-life-trip-pages/1.0 (personal site)'
BAD=re.compile(r'(map|location|locator|flag|emblem|seal|logo|icon|portrait|地图|位置|区划|旗|徽|标志|示意)',re.I)
def search(q):
    for t in range(4):
        out=subprocess.run(['curl','-s','-G','https://commons.wikimedia.org/w/api.php','--data-urlencode','action=query','--data-urlencode','format=json','--data-urlencode','list=search','--data-urlencode','srnamespace=6','--data-urlencode','srlimit=5','--data-urlencode','srsearch='+q,'-A',UA],capture_output=True,text=True).stdout
        try: return [x['title'][5:] for x in json.loads(out)['query']['search']]
        except Exception: time.sleep(20)
    return []
for f in sys.argv[1:]:
    j=json.load(open(f,encoding='utf-8'));city=j['city']['zh'];n=0
    for x in j['sights']:
        if x.get('photo'): continue
        name=re.sub(r'（.*?）|\(.*?\)','',x['zh']).split('·')[0].split(' / ')[0].strip()
        for q in ('%s %s'%(city,name),x.get('en','').split('(')[0].split('·')[0].strip()):
            if not q.strip(): continue
            hit=[t for t in search(q) if re.search(r'\.jpe?g$',t,re.I) and not BAD.search(t)]
            time.sleep(1.5)
            if hit: x['photo']=hit[0];x['photo_from']='commons-search:'+q;n+=1;break
    json.dump(j,open(f,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    print(f,'filled',n,'still none',sum(1 for x in j['sights'] if not x.get('photo')))
