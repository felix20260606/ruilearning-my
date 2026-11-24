# 城市 / 区县景点详细版：怎么做（所有省通用）

旅游中心「🇨🇳 中国」的城市页 = 模板 `web/cn-city.html?c=<slug>` + 数据 `web/cn/city/<slug>.json`。
浙江（`tools/sights/zj/`）、重庆（`tools/sights/cq-dist/`）已经是手写详细版，其余是维基数据自动版（文件里有 `"auto": true`）。
这份说明给「把某个省做成详细版」的会话用。

## 1. 数据源文件（留底，以后批量改就改这里再重跑）

每个省一个目录 `tools/sights/<省拼音>/`，每个城市一个 `<城市后缀>.json`（后缀 = 城市 slug 去掉「<省拼音>-」，比如 `sichuan-chengdu` → `chengdu.json`；城市列表看 `web/cn/<省拼音>.json` 的 `cities[].slug`）。
格式和 `tools/sights/zj/ningbo.json`、`tools/sights/cq-dist/wulong.json` 一样：

```json
{
  "city": {
    "slug": "chengdu", "zh": "成都市", "en": "Chengdu",
    "from_t": "从机场 / 高铁站进城",
    "from_hz": "怎么去：省会写「从机场 / 高铁站进城」；其它城市写从省会怎么去（from_t 写「从成都去」）：高铁 / 动车 / 大巴 / 自驾，时间和大概票价（以 12306 为准）",
    "local": "市内 / 县里怎么走：地铁几号线、公交、景区专线、打车",
    "tips": "季节、一日 / 两日怎么排、避坑"
  },
  "sights": [ {
    "id": "sichuan-chengdu-kuanzhai",
    "zh": "宽窄巷子", "en": "Kuanzhai Alley",
    "cat": "街区", "area": "青羊 · 少城",
    "addr": "详细地址", "transit": "公共交通怎么到（地铁几号线哪站几号口 / 公交）",
    "hours": "开放时间（以官方为准）", "price": "门票（以官方为准）", "dur": "1–2 小时",
    "desc": "两三句：是什么、看点", "tips": "一两句实用建议",
    "rate": 3, "photo": "", "q": "高德搜索关键词（景点全名）", "src": "查到信息的来源网址"
  } ]
}
```

- 直辖市（北京、上海、天津）、香港、澳门：一个区一个文件，`from_t` 写「从天安门去」「从人民广场去」「从天津站去」「从中环去」「从澳门半岛去」这类。
- `id`：`<省拼音>-<城市后缀>-<景点拼音>`，全国不重复。
- `cat` 只用：地标、街区、博物馆、公园自然、宗教建筑、美食夜市、徒步、周边一日、亲子游乐、温泉。
- `rate`：3 必去，2 值得，1 有空再去。
- 每个城市 8–15 个景点（热门城市多写，小城市写主要的）；真实存在、现在开放的；**查不到的写「以现场为准」，绝不编**。
- 照片 `photo`：维基共享资源（Commons）文件名，不带 `File:`。只填确认存在、拍的就是这个景点的。
- 参考候选：`web/cn/city/<slug>.json` 里的自动版（维基数据的世界遗产 / 5A / 国保）。

## 2. 照片

1. `python3 tools/sights/fill_photos.py tools/sights/<省>/*.json`，再 `python3 tools/sights/fill_photos_commons.py tools/sights/<省>/*.json`（只填空的，跳过有 `photo_checked` 的）。
2. **新填的必须人工看**：下载 250px 缩略图（`https://upload.wikimedia.org/wikipedia/commons/thumb/<md5[0]>/<md5[:2]>/<文件名>/250px-<文件名>`，文件名空格换下划线，md5 取文件名的 md5），拼成预览图，自己逐张看。重庆那轮自动补的 62 张里有 52 张是错的（人物照、地图、外省或国外同名地方）。
3. 不对的清空，写 `"photo_checked": "自动找到的不对，留空（人工看过）"`；对的写 `"photo_checked": "ok（人工看过缩略图）"`。
4. 请求要慢（间隔 1 秒以上），带 User-Agent `ban-life-trip-pages/1.0`；Commons 容易 429 限流。

## 3. 生成和检查

```bash
mkdir -p tools/sights/<省>/_auto && python3 - <<'EOF'   # 先把自动版留底（只做一次）：手写里没有的景点会追加在后面
import json,glob
for f in glob.glob('web/cn/city/<省>-*.json'):
    d=json.load(open(f))
    if d.get('auto'): json.dump(d['sights'],open('tools/sights/<省>/_auto/%s.json'%d['slug'].split('-',1)[1],'w'),ensure_ascii=False,indent=0)
EOF
python3 tools/cn-data/make_city.py web <省> tools/sights/<省>
```

- **不要**跑 `make_files.py` / `make_map.py`，也不要提交 `web/cn/index.json` / `web/cn/map.json`：好几个省同时在做，总目录和地图由发起的会话每批结束后统一重新生成。
- 本地看页面：`python3 -m http.server <端口> --directory web`，打开 `http://127.0.0.1:<端口>/cn-city.html?c=<slug>`，确认景点数、照片都能加载。不要在线上网站测（会写进真实存档）；测完清掉测试浏览器的 localStorage。

## 4. 网页搜索额度

每个会话只有 200 次网页搜索，子任务也共用这个额度。所以要省着用：先用维基百科、Wikivoyage、新闻网站，搜索用来查门票、开放时间、交通。子任务最多开 2–3 个，或者自己做。携程、马蜂窝、去哪儿、百度百科经常打不开。

## 5. 提交

- **好几个会话共用同一个文件夹（`cloudflare/`）同时在做**，别的省的文件随时在变。所以：
  - 不要 `git stash`、`git reset`、`git checkout .`、`git add -A`、`git add .`、`git rebase`、`git pull --rebase`；
  - 遇到 `index.lock` 就等几秒重试，不要删它。
- 提交前跑 `node tools/bump-versions.js`、`sh tools/lint.sh`、`node tools/check-syntax.js`，以及 `for t in tests/t*.js; do node $t; done`。
- 只 `git add` 自己的文件（写全路径）：`tools/sights/<省>/`、`web/cn/city/<省>-*.json`、`web/cn/<省>.json`（如果变了）。然后 `git commit -m … -- <这些路径>`。
- 推送：`git pull --no-rebase --no-edit origin main && git push origin main`。别的会话改的是别的文件，合并不会冲突；推不上就再来一次。
- 等 GitHub CI 通过（`gh run list` / `gh run watch`）。
- 仓库保持公开，不用提醒设私有。回复用户用中文。
