# q2.json（维基数据查询结果）→ cities_raw.json：每个省下面的城市（名字、英文名、照片、坐标、中文维基条目、类型）
import json,collections
B=json.load(open('q2.json'))['results']['bindings'];by=collections.defaultdict(dict)
for b in B:
    p=b['p']['value'].split('/')[-1];c=b['c']['value'].split('/')[-1]
    d=by[p].setdefault(c,{'zh':b.get('cl',{}).get('value'),'en':b.get('cen',{}).get('value'),'img':b.get('img',{}).get('value'),'coord':b.get('coord',{}).get('value'),'zhw':b.get('zhw',{}).get('value'),'types':set()})
    if 'typeL' in b: d['types'].add(b['typeL']['value'])
json.dump({p:{c:{**v,'types':sorted(v['types'])} for c,v in cs.items()} for p,cs in by.items()},open('cities_raw.json','w'),ensure_ascii=False)
print(sum(len(v) for v in by.values()),'cities')
