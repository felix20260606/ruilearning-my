# 中国地图（旅游中心「🇨🇳 中国」最上面那张）：省界 GeoJSON → 简化成 SVG 路径 + 城市点 → web/cn/map.json
# 用法：python3 make_map.py <阿里云 DataV 100000_full.json> <web 目录>
#   省界来自 https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json（含港澳台、南海诸岛九段线）
#   南海诸岛（北纬 17.5° 以南的岛和九段线）按标准地图画法放在右下角的小框里
import json,math,os,sys,glob
src,web=sys.argv[1],sys.argv[2]
G=json.load(open(src,encoding='utf-8'))
S=20.0;K=math.cos(math.radians(36));LNG0,LAT0=73.0,54.0;CUT=17.5
INS=dict(lng0=105.0,lat0=24.5,s=0.42)  # 南海小框：从 (105E,24.5N) 开始缩小
def P(lng,lat):
    return ((lng-LNG0)*K*S,(LAT0-lat)*S)
MW,MH=P(135.2,CUT)[0],P(LNG0,CUT)[1]
IW,IH=(125.5-INS['lng0'])*K*S*INS['s'],(INS['lat0']-3.5)*S*INS['s']
IX,IY=MW-IW-6,MH-IH-4  # 小框放在右下角（台湾东边的海面上）
def PI(lng,lat):
    x,y=((lng-INS['lng0'])*K*S*INS['s'],(INS['lat0']-lat)*S*INS['s']);return (IX+x,IY+y)
def dp(pts,eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1];dx,dy=b[0]-a[0],b[1]-a[1];n=math.hypot(dx,dy) or 1e-9
    i,dm=0,0
    for k in range(1,len(pts)-1):
        d=abs(dy*pts[k][0]-dx*pts[k][1]+b[0]*a[1]-b[1]*a[0])/n
        if d>dm: i,dm=k,d
    if dm>eps: return dp(pts[:i+1],eps)[:-1]+dp(pts[i:],eps)
    return [a,b]
def ring(r,small):
    south=all(lat<CUT for lng,lat in r)
    proj=PI if south else P
    pts=[proj(lng,lat) for lng,lat in r]
    eps=0.25 if small or south else 0.9
    if len(pts)>3 and pts[0]==pts[-1]: pts=pts[:-1]
    m=len(pts)//2  # 闭合的一圈：首尾是同一个点，直接简化会整圈删光，从中间切成两段分别简化
    pts=dp(pts[:m+1],eps)[:-1]+dp(pts[m:]+[pts[0]],eps)[:-1]
    if len(pts)<3: return '',south
    return 'M'+'L'.join('%.1f,%.1f'%p for p in pts)+'Z',south
NAME={}
for f in glob.glob(os.path.join(web,'cn','*.json')):
    if os.path.basename(f) in ('map.json',): continue
    j=json.load(open(f,encoding='utf-8'))
    if 'cities' in j: NAME[j['zh']]=j
out=dict(w=round(MW+4),h=round(MH+2),inset=[round(IX),round(IY),round(IW),round(IH)],prov=[],jd='',cities=[])
for f in G['features']:
    p=f['properties'];g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    nm=p.get('name') or '';small=nm[:2] in ('香港','澳门','上海','北京','天津')
    d=''
    for poly in polys:
        for r in poly[:1]:  # 只要外圈
            s_,south=ring(r,small)
            d+=s_
    if p.get('adcode')=='100000_JD': out['jd']=d;continue
    key=[k for k in NAME if k[:2]==nm[:2]]
    if not key: print('?',nm);continue
    j=NAME[key[0]];cx,cy=P(*p['center']) if p.get('center') else (0,0)
    out['prov'].append(dict(slug=j['slug'],zh=j['zh'],short=j['short'],d=d,cx=round(cx,1),cy=round(cy,1)))
    for c in j['cities']:
        x,y=(PI if c['lat']<CUT else P)(c['lng'],c['lat'])
        out['cities'].append(dict(id=c['id'],zh=c['zh'],p=j['slug'],x=round(x,1),y=round(y,1),cap=c.get('cap',False),go=c.get('go','')))
# 景点大全 / 城市页的景点 id 前缀 → 算到哪个城市（勾了任何一个景点，这个城市就算去过）
def cid(prov,zh):
    for c in NAME.get(prov,{}).get('cities',[]):
        if c['zh'].rstrip('市')==zh: return c['id']
out['alias']={k:cid(p,z) for k,(p,z) in {'hz-':('浙江省','杭州'),'cq-':('重庆市','渝中区'),'nb-':('浙江省','宁波'),'zs-':('浙江省','舟山'),'wz-':('浙江省','温州'),'ls-':('浙江省','丽水'),
  'sx-':('浙江省','绍兴'),'jh-':('浙江省','金华'),'hu-':('浙江省','湖州'),'jx-':('浙江省','嘉兴'),'tz-':('浙江省','台州'),'qz-':('浙江省','衢州')}.items()}
json.dump(out,open(os.path.join(web,'cn','map.json'),'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('w',out['w'],'h',out['h'],'prov',len(out['prov']),'cities',len(out['cities']),'size',os.path.getsize(os.path.join(web,'cn','map.json')),'alias',out['alias'])
