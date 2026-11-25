# 安徽 16 个市景点（手写详细版）

- 每个市一个 `<城市后缀>.json`（合肥 淮南 六安 马鞍山 滁州 铜陵 芜湖 蚌埠 池州 安庆 宣城 阜阳 宿州 淮北 黄山 亳州），格式见 `tools/sights/CITY-GUIDE.md`。宿州是 `suzhou.json`（安徽宿州，别和江苏苏州弄混）。
- `_auto/`：做手写版之前的维基数据自动版留底；生成时手写里没有的景点会追加在后面（已去掉和手写重复的，如 垓下遗址、琅琊寺、姥山塔、寿县孔庙、芜湖海关旧址；还清掉了华龙洞遗址错挂的恐龙化石照片）。
- 省会合肥 `from_t` 是「从机场 / 高铁站进城」，其它城市是「从合肥去」。
- 照片：先复用 `_auto` 里维基数据的图（`photo_from="wikidata-auto:…"`），其余从 zh.wikipedia 条目图和 Commons 搜索里挑候选，全部人工看过 250px 缩略图（`photo_checked`）。
- 门票、开放时间多数来自 2025–2026 年票务平台和新闻，都写了「以官方为准」；查不到的写「以现场为准」。

重新生成：

```bash
python3 tools/cn-data/make_city.py web anhui tools/sights/anhui
```
