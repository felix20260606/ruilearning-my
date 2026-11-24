# 🇨🇳 中国省份 / 城市数据（web/cn/*.json）怎么生成

旅游中心「🇨🇳 中国」的 34 个省级行政区页面（`web/cn-prov.html?p=<拼音>`）读 `web/cn/<拼音>.json`。数据来自维基数据 + 中文维基百科，2026-11 生成。

原始数据全部留底在 `raw/`（`q*.json` 查询结果、`cities_raw.json`、`data_all.json`、`datav-cn.json` 地图边界），改页面数据一般直接从第 3 步重跑就行，不用重查。

1. （要重查时）在 `raw/` 里跑三条 SPARQL（维基数据查询服务，记得带 User-Agent）：
   ```bash
   for q in q2 q4 q5; do curl -s -G https://query.wikidata.org/sparql --data-urlencode "query@$q.rq" -H "Accept: application/sparql-results+json" -A "ban-life-trip-pages/1.0" > $q.json; done
   ```
   - `q2.rq`：32 个省 / 自治区 / 直辖市 / 香港的下辖（P150，去掉已撤销的）
   - `q4.rq`：台湾的县市、澳门的几个区（这两个在维基数据里不挂 P150）
   - `q5.rq`：省级本身（名字、照片、坐标、省会）
2. `python3 prep_raw.py`（q2.json → cities_raw.json），然后 `python3 build_data.py`：拉中文维基开头两句（简体）、首图补照片、算离省会直线距离 → `data_all.json`
3. `python3 make_files.py ../../web/cn`（读 `raw/data_all.json`）：按地区排好，写出 34 个 `<拼音>.json` + `index.json`（中国页的三级目录：地区 → 省 → 市），并挂上已经做好的攻略页（杭州 / 重庆景点大全、重庆中转、东北自驾）和所有城市页

城市网址名（slug）= `<省拼音>-<城市英文名>`（如 `zhejiang-ningbo`、`taiwan-newtaipei`），全国不重复；城市的状态 id = `cn-<维基数据编号>`。

城市页：每个城市的景点放一个 `<拼音>.json`（格式见 `make_city.py` 开头），跑 `python3 make_city.py ../../web <省拼音> <景点目录>` → 写出 `web/cn/city/<拼音>.json`，并给省页那张城市卡片挂上「🏙 … 景点大全 ›」（tabs.js 认 `city:<拼音>` → `cn-city.html?c=<拼音>`）。`make_files.py` 重新生成省页数据时会读 `web/cn/city/` 保留这些链接。

**手工详细版**（浙江 10 个城市，景点源文件在 `tools/sights/zj/`）：交通、门票、时间、建议都有。

**自动版**（其余所有城市）：`python3 make_auto_cities.py ../../web [省拼音 …]`。景点 = 世界遗产 + 国家 5A 级景区 + 全国重点文物保护单位（维基数据），带照片、坐标、中文维基开头两句；查回来的原始结果存 `auto-raw/<省>.json`，再跑会直接用（删掉对应文件才重查）。不到 8 个景点的城市（港台、直辖市的区、偏远地区）再补查一轮：任何文物 / 古迹等级（香港法定古迹、台湾古迹、省级文保…）或者旅游景点 / 博物馆 / 公园 / 游乐园 / 动物园等，必须有中文维基条目，结果存 `auto-raw/<省>-extra.json`；名字没有简体的用中文维基的简体标题。生成的文件带 `"auto": true`，页面上会提示「自动整理」；手工版（没有 auto）不会被覆盖。想把某个城市细化：照浙江的做法写 `tools/sights/<目录>/<城市>.json` 跑 `make_city.py`。

全部重新生成的顺序：`make_auto_cities.py` → `make_files.py` → `make_map.py raw/datav-cn.json ../../web`。

## 🗺 中国足迹地图（web/cn/map.json）

「🇨🇳 中国」最上面那张地图（`web/cn-map.js`）读 `web/cn/map.json`：省界简化成 SVG 路径 + 496 个城市点 + 景点前缀对应的城市（勾了杭州景点大全里任何一个景点，杭州就算去过）。

```bash
curl -s -o 100000_full.json https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json   # 阿里云 DataV 标准中国地图边界（含港澳台、南海诸岛九段线）
python3 make_map.py raw/datav-cn.json ../../web   # 已经留底，不用重新下载
```

南海诸岛按标准地图画法放在右下角的小框里。新做了城市页（景点 id 新前缀）要在 `make_map.py` 末尾的 alias 里加一行。

**默认足迹**：用户告诉 Claude 去过 / 想去哪些城市，把城市 id（`cn-<维基数据编号>`，在 `web/cn/<省>.json` 里查）写进 `web/cn/visited.json` 的 `been` / `want`；网站里点过的以点的为准。
