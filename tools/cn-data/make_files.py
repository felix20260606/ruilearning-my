import json,os,sys
P=json.load(open('data_all.json'))
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
        C=[]
        for x in cities:
            d=dict(id='cn-'+x['id'],zh=x['zh'],en=x['en'],desc=x['desc'],img=x['img'],lat=round(x['coord'][0],5),lng=round(x['coord'][1],5),km=x['km'],cap=x['cap'],wiki=x['zhw'])
            if x['zh'] in CGO: d['go'],d['goT']=CGO[x['zh']]
            elif (zh,x['zh']) in CITYPG: d['go'],d['goT']=CITYPG[(zh,x['zh'])]
            C.append(d)
        if not p['img'] and C: p['img']=C[0]['img']
        doc=dict(slug=slug,zh=zh,short=SHORT[zh],en=p['en'],region=reg,cap='' if MUNI4 else (p['cap'] or ''),desc=p['desc'],img=p['img'],lat=round(p['coord'][0],5),lng=round(p['coord'][1],5),wiki=p['zhw'],go=PGO.get(zh,[]),cities=C)
        json.dump(doc,open(os.path.join(out,slug+'.json'),'w'),ensure_ascii=False,separators=(',',':'))
        idx.append(dict(slug=slug,zh=zh,short=SHORT[zh],en=p['en'],region=reg,cap='' if MUNI4 else (p['cap'] or ''),img=p['img'],n=len(C),desc=p['desc'][:60]))
json.dump(idx,open('index.json','w'),ensure_ascii=False)
print(len(idx),'provinces',sum(i['n'] for i in idx),'cities')
for i in idx: print(i['region'],i['zh'],i['n'],bool(i['img']))
