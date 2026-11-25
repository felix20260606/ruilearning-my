# 湖南 14 个市州景点（手写详细版）

- 每个市州一个 `<城市后缀>.json`（长沙 湘潭 株洲 益阳 娄底 岳阳 衡阳 常德 邵阳 永州 张家界 郴州 怀化 湘西），格式见 `tools/sights/CITY-GUIDE.md`。
- `_auto/`：做手写版之前的维基数据自动版留底；生成时手写里没有的景点会追加在后面（已去掉和手写重复的）。
- 省会长沙 `from_t` 是「从机场 / 高铁站进城」，其它城市是「从长沙去」。
- 照片：先复用 `_auto` 里维基数据的图（`photo_from="wikidata-auto:…"`），再跑 `fill_photos.py` / `fill_photos_commons.py`，全部人工看过 250px 缩略图（`photo_checked`）。
- 门票、开放时间多数来自 2025–2026 年票务平台和新闻，都写了「以官方为准」；查不到的写「以现场为准」。

重新生成：

```bash
python3 tools/cn-data/make_city.py web hunan tools/sights/hunan
```
