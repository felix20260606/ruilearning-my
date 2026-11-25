# 海南 19 个市县景点详细版（数据源）

每个市县一个 `<后缀>.json`（如 `sanya.json` → 城市页 `cn-city.html?c=hainan-sanya`），格式和做法见 `tools/sights/CITY-GUIDE.md`。
改完重跑：`python3 tools/cn-data/make_city.py web hainan tools/sights/hainan`（`_auto/` 是维基数据自动版留底，手写里没有的会追加在后面）。

- 海口的 `from_t` 是「从机场 / 高铁站进城」，其余都是「从海口去」（环岛高铁东段 / 西段；中部山区县不通铁路，写中线高速和班车）。
- 环岛高铁是浮动票价（公布价 6.6 折到全价），所以票价都写成区间，以 12306 为准。
- `_auto/ledong.json` 原来的「灵照墓」「美榔双塔」「陈道叙周氏墓」其实在澄迈县金江镇美榔村（中文维基「美榔双塔」条目），维基数据归错县，已清空；澄迈手写版里写了美榔双塔。
- 照片：`photo_checked` 有值的都人工看过 250px 缩略图；`photo_from` 记来源（`wikidata-auto:` 自动版原有、`province-city-img` 省页城市卡片图、`zhwiki:` 中文维基首图、`commons-search` Commons 搜索后人工挑）。
- 2026-11 写的时候拿不准、标了「以现场为准 / 以官方为准」或 `warn` 的：石花水洞、椰子大观园（平台显示暂停营业）、天涯海角（2023-06 起免费预约）、屯昌卧龙山、白沙红坎瀑布、东方俄贤岭等小县景点的门票和开放时间。
