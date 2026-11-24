# 云南 16 个市州景点详细版（数据源）

每个市州一个 `<后缀>.json`（如 `dali.json` → 城市页 `cn-city.html?c=yunnan-dali`），格式和做法见 `tools/sights/CITY-GUIDE.md`。
改完重跑：`python3 tools/cn-data/make_city.py web yunnan tools/sights/yunnan`（`_auto/` 是维基数据自动版留底，手写里没有的会追加在后面）。

- 昆明的 `from_t` 是「从机场 / 高铁站进城」，其余都是「从昆明去」。
- 照片：2026-11 做的时候维基共享资源 API 被好几个会话一起请求、一直 429，所以除了 `fill_photos.py`（中文维基首图），其余是用 Commons 网页版全文搜索（`commons.wikimedia.org/w/index.php?search=…&ns6=1&fulltext=1`）找候选，再下载 250px 缩略图逐张人工挑。
  `photo_checked` 有值的都人工看过；`photo_from` 写「commons-search（人工挑选）」的是人工从候选里挑的。
- `_auto/nujiang.json` 里「三江并流保护区」原来的照片是地图（png），已清空。
