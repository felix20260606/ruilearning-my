import json,os,sys,re,unicodedata,hashlib,urllib.parse
RAW=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw')  # 查回来的原始数据留底在 tools/cn-data/raw/
P=json.load(open(os.path.join(RAW,'data_all.json'),encoding='utf-8'))
# 每个省的封面图：手挑一个代表景点（covers.json：省名 → [景点, Commons 文件名]），省页大图和中国页目录卡片都用它
COV=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'covers.json'),encoding='utf-8'))
SLUG={'北京市':'beijing','天津市':'tianjin','河北省':'hebei','山西省':'shanxi','内蒙古自治区':'neimenggu','辽宁省':'liaoning','吉林省':'jilin','黑龙江省':'heilongjiang',
'上海市':'shanghai','江苏省':'jiangsu','浙江省':'zhejiang','安徽省':'anhui','福建省':'fujian','江西省':'jiangxi','山东省':'shandong','河南省':'henan','湖北省':'hubei','湖南省':'hunan',
'广东省':'guangdong','广西壮族自治区':'guangxi','海南省':'hainan','重庆市':'chongqing','四川省':'sichuan','贵州省':'guizhou','云南省':'yunnan','西藏自治区':'xizang',
'陕西省':'shaanxi','甘肃省':'gansu','青海省':'qinghai','宁夏回族自治区':'ningxia','新疆维吾尔自治区':'xinjiang','香港':'hongkong','澳门':'macau','台湾':'taiwan'}
REG=[('华北',['北京市','天津市','河北省','山西省','内蒙古自治区']),('东北',['辽宁省','吉林省','黑龙江省']),('华东',['上海市','江苏省','浙江省','安徽省','福建省','江西省','山东省']),
('华中',['河南省','湖北省','湖南省']),('华南',['广东省','广西壮族自治区','海南省']),('西南',['重庆市','四川省','贵州省','云南省','西藏自治区']),('西北',['陕西省','甘肃省','青海省','宁夏回族自治区','新疆维吾尔自治区']),('港澳台',['香港','澳门','台湾'])]
SHORT={'北京市':'京','天津市':'津','河北省':'冀','山西省':'晋','内蒙古自治区':'蒙','辽宁省':'辽','吉林省':'吉','黑龙江省':'黑','上海市':'沪','江苏省':'苏','浙江省':'浙','安徽省':'皖','福建省':'闽','江西省':'赣','山东省':'鲁','河南省':'豫','湖北省':'鄂','湖南省':'湘','广东省':'粤','广西壮族自治区':'桂','海南省':'琼','重庆市':'渝','四川省':'川','贵州省':'黔','云南省':'滇','西藏自治区':'藏','陕西省':'陕','甘肃省':'甘','青海省':'青','宁夏回族自治区':'宁','新疆维吾尔自治区':'新','香港':'港','澳门':'澳','台湾':'台'}
# 已经做好的页面：省级 / 城市级挂上去（go = tabs.js 认的名字）
PGO={'浙江省':[('hzsights','🍵 杭州景点大全')],'重庆市':[('cqsights','🌶 重庆景点大全'),('cq','✈️ 重庆中转 · 半天')],'辽宁省':[('db','🚗 东北三省自驾')],'吉林省':[('db','🚗 东北三省自驾')],'黑龙江省':[('db','🚗 东北三省自驾')]}
CGO={'杭州市':('hzsights','🍵 杭州景点大全'),'渝中区':('cqsights','🌶 重庆景点大全')}
BYZH={p['zh']:p for p in P.values()}
NAMEFIX={'澳門半島':'澳门半岛','路環':'路环','路氹城':'路氹城（填海区）'}  # 维基数据里只有繁体的几个名字
import glob
CITYPG={}
for f in glob.glob(os.path.join(sys.argv[1],'city','*.json')):
    j=json.load(open(f,encoding='utf-8'));CITYPG[(j.get('provZh'),j['zh'])]=('city:'+j['slug'],'🏙 %s景点大全'%j['zh'].rstrip('市'))
out=sys.argv[1];os.makedirs(out,exist_ok=True)
idx=[]
for reg,names in REG:
    for zh in names:
        p=BYZH[zh];slug=SLUG[zh]
        MUNI4=zh[:2] in ('北京','上海','天津','重庆')
        for x in p['cities'].values():
            x['zh']=NAMEFIX.get(x['zh'],x['zh'])
            if MUNI4: x['cap']=False  # 直辖市不标「省会」：距离都是从市中心算的
        cities=sorted(p['cities'].values(),key=lambda x:(not x['cap'],x['km'] if x['km'] is not None else 9999))
        C=[];used=set()
        def cslug(en,zhn):
            en2=unicodedata.normalize('NFKD',en or '').encode('ascii','ignore').decode()  # Ürümqi → Urumqi
            w=[re.sub('[^a-z]','',t.lower()) for t in re.split(r'[\s\-]+',en2) if re.sub('[^a-z]','',t.lower())]
            w=[t for t in w if t not in ('city','district','county','prefecture','autonomous','league','area','special','administrative','region')] or w or ['c']
            k=w[0];i=1
            if len(k)<4 and len(w)>1: k=k+w[1];i=2  # Wan Chai → wanchai
            if k in used: k=''.join(re.sub('[^a-z]','',t.lower()) for t in re.split(r'[\s\-]+',en2))  # 重名（新竹县 / 新竹市）：用完整英文名
            while k in used: k=k+'x'
            used.add(k);return slug+'-'+k
        for x in cities:
            d=dict(id='cn-'+x['id'],slug=cslug(x['en'],x['zh']),zh=x['zh'],en=x['en'],desc=x['desc'],img=x['img'],lat=round(x['coord'][0],5),lng=round(x['coord'][1],5),km=x['km'],cap=x['cap'],wiki=x['zhw'])
            if x['zh'] in CGO: d['go'],d['goT']=CGO[x['zh']]
            elif (zh,x['zh']) in CITYPG: d['go'],d['goT']=CITYPG[(zh,x['zh'])]
            C.append(d)
        if zh in COV: p['img']=COV[zh][1]
        if not p['img'] and C: p['img']=C[0]['img']
        doc=dict(slug=slug,qid=('Q865' if zh=='台湾' else p['id']),zh=zh,short=SHORT[zh],en=p['en'],region=reg,cap='' if MUNI4 else (p['cap'] or ''),desc=p['desc'],img=p['img'],lat=round(p['coord'][0],5),lng=round(p['coord'][1],5),wiki=p['zhw'],go=PGO.get(zh,[]),cities=C)
        json.dump(doc,open(os.path.join(out,slug+'.json'),'w'),ensure_ascii=False,separators=(',',':'))
        idx.append(dict(slug=slug,zh=zh,short=SHORT[zh],en=p['en'],region=reg,cap='' if MUNI4 else (p['cap'] or ''),img=p['img'],n=len(C),desc=p['desc'][:60]))
TREE=[]
for reg,names in REG:
    for zh in names:
        d=json.load(open(os.path.join(out,SLUG[zh]+'.json'),encoding='utf-8'))
        def th(f):  # 维基共享资源缩略图的直接路径（a/ab/文件名），页面拼成 upload.wikimedia.org/…/thumb/<th>/<宽>px-文件名，省掉一次跳转
            if not f or not re.search(r'\.(jpe?g|png|webp)$',f,re.I): return ''
            n=f.replace(' ','_');h=hashlib.md5(n.encode('utf-8')).hexdigest();return h[0]+'/'+h[:2]+'/'+urllib.parse.quote(n)
        def cinfo(c):  # 城市页里有几个景点 + 缩略图（城市页里最好的那个有照片的景点；没有就用城市自己的照片）
            f=os.path.join(out,'city',c['slug']+'.json')
            if not os.path.exists(f): return 0,c.get('img','')
            S=json.load(open(f,encoding='utf-8'))['sights'];ph=sorted([x for x in S if x.get('photo')],key=lambda x:-int(x.get('rate') or 1))
            return len(S),(ph[0]['photo'] if ph else c.get('img',''))
        TREE.append(dict(slug=d['slug'],zh=d['zh'],short=d['short'],region=reg,img=d['img'],th=th(d['img']),cover=COV.get(zh,['',''])[0],cap=d['cap'],
                         cities=[dict(id=c['id'],zh=c['zh'],slug=c['slug'],go=c.get('go',''),n=cinfo(c)[0],img=cinfo(c)[1],th=th(cinfo(c)[1])) for c in d['cities']]))
json.dump(TREE,open(os.path.join(out,'index.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))  # 中国页三级目录：地区 → 省 → 市
print(len(idx),'provinces',sum(i['n'] for i in idx),'cities')
for i in idx: print(i['region'],i['zh'],i['n'],bool(i['img']))
