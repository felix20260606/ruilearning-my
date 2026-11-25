# 解析中文维基「国家5A级旅游景区」页面的总表 → 5a.json（省、地级、县级、景区名、维基条目、公布日期）
# 用法：curl 下载 5a-zhwiki.html（https://zh.wikipedia.org/zh-cn/国家5A级旅游景区）后 python3 parse_5a.py
import re,html,json
from html.parser import HTMLParser
s=open('5a-zhwiki.html',encoding='utf-8').read()
t=re.findall(r'<table class="wikitable.*?</table>',s,re.S)[0]
class P(HTMLParser):
    def __init__(s):
        super().__init__();s.rows=[];s.cell=None;s.row=None;s.depth=0
    def handle_starttag(s,tag,a):
        a=dict(a)
        if tag=='tr': s.row=[]
        elif tag in('td','th') and s.row is not None: s.cell={'t':'','rs':int(re.sub(r'\D','',a.get('rowspan','1')) or 1),'links':[],'del':False,'th':tag=='th'}
        elif tag=='a' and s.cell is not None and a.get('href','').startswith('/wiki/'): s.cell['links'].append([a.get('title',''),''])
        elif tag in('s','del') and s.cell is not None: s.cell['del']=True
        elif tag=='sup' and s.cell is not None: s.depth+=1
    def handle_endtag(s,tag):
        if tag in('td','th') and s.cell is not None: s.cell['t']=re.sub(r'\s+',' ',s.cell['t']).strip();s.row.append(s.cell);s.cell=None
        elif tag=='tr' and s.row is not None: s.rows.append(s.row);s.row=None
        elif tag=='sup' and s.depth: s.depth-=1
    def handle_data(s,d):
        if s.cell is not None and not s.depth:
            s.cell['t']+=d
            if s.cell['links'] and not s.cell['links'][-1][1]: s.cell['links'][-1][1]=d
p=P();p.feed(t)
NC=6  # 省级 | 个数 | 地级 | 县级 | 景点名称 | 批次
grid=[];pend={}
for r in p.rows[1:]:
    out=[None]*NC;it=iter(r);c=0
    for c in range(NC):
        if c in pend and pend[c][1]>0:
            out[c]=pend[c][0];pend[c][1]-=1
        else:
            x=next(it,None)
            if x is None: break
            out[c]=x
            if x['rs']>1: pend[c]=[x,x['rs']-1]
    grid.append(out)
res=[]
for g in grid:
    if any(v is None for v in g): print('skip',[v and v['t'] for v in g]);continue
    pv,_,ci,co,nm,dt=g
    title=nm['links'][0][0] if nm['links'] else ''
    res.append(dict(prov=pv['t'],city=ci['t'],county=co['t'],name=nm['t'],wiki=title,date=re.sub(r'\[.*?\]','',dt['t']).strip(),removed=nm['del']))
json.dump(res,open('5a.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
print(len(res),'rows; removed',sum(r['removed'] for r in res))
from collections import Counter;print(Counter(r['prov'] for r in res).most_common())
