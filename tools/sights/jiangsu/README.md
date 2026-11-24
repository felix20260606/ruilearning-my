# 江苏 13 个市景点详细版（数据源）

每个市一个 `<后缀>.json`（如 `suzhou.json` → 城市页 `cn-city.html?c=jiangsu-suzhou`），格式和做法见 `tools/sights/CITY-GUIDE.md`。
改完重跑：`python3 tools/cn-data/make_city.py web jiangsu tools/sights/jiangsu`（`_auto/` 是维基数据自动版留底，手写里没有的会追加在后面）。

- 南京的 `from_t` 是「从机场 / 高铁站进城」，其余都是「从南京去」。
- 门票：2026-11 查的多是携程 / 去哪儿 / 大河票务这类平台价，写成「约 ¥X（以官方为准）」；查不到的只写「收费（以官方为准）」，没有编数字。
- 交通：北沿江高铁、宁淮城际、宁扬城际 2026-11 都还在建（报道说宁淮预计 2027 年前后开通），写交通时按现有线路。
- 照片：维基共享资源 API 被好几个会话一起请求、常 429，所以用 Commons 网页版全文搜索（`commons.wikimedia.org/w/index.php?search=…&ns6=1&fulltext=1`）找候选，
  再下载 250px 缩略图拼图逐张人工挑；自动版里维基数据 P18 的照片也一起放进候选看过。
  `photo_checked` 有值的都人工看过；`photo_from` 写明来源（`commons-search（人工挑选）` 或 `wikidata-auto:<条目>`）。
