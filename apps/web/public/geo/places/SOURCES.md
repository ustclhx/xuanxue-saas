# 出生地数据来源

`v2/<首字母>.json` 由 [GeoNames](https://www.geonames.org/) 的 `cities15000`（人口 ≥15000 的居民点）、`admin1CodesASCII` 与 `alternateNamesV2`（检索别名）生成，
许可为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。使用这些数据的页面须显示署名
「Place names and coordinates from GeoNames, licensed under CC BY 4.0」（来源与许可链接见 `@xuanxue/astro/places` 的 `PLACE_ATTRIBUTION`，各语言文案由页面提供）。

| 文件 | 下载 URL | 服务端 Last-Modified | 下载日期（UTC） | SHA-256 |
| --- | --- | --- | --- | --- |
| cities15000.txt（解压自 cities15000.zip） | https://download.geonames.org/export/dump/cities15000.zip | 2026-11-24 02:55:25 GMT | 2026-11-24 | 4114c051a8b80cdf1428c49a36f8fdc9a4d00dd9c4d2eb98492235813ec1ccb3 |
| alternateNamesV2.txt（解压自 alternateNamesV2.zip） | https://download.geonames.org/export/dump/alternateNamesV2.zip | 2026-11-24 03:00:36 GMT | 2026-11-24 | e65aaa034748c30e5e89ac3486669f207873cac1fdee2743de00cc7668661882 |
| admin1CodesASCII.txt | https://download.geonames.org/export/dump/admin1CodesASCII.txt | 2026-11-24 02:55:25 GMT | 2026-11-24 | 2e4867f5397acb056ea26377601b57af37cb4c81399770225018e9e439e91ad3 |

生成结果：34,221 个地名（去掉历史、废弃、被毁居民点 22 个，名称首字符不是拉丁字母的 1 个），另有 8,134 个检索别名：
GeoNames ASCII 名、英文别名（isolanguage=en，非俗称），以及人口 ≥10 万城市的未标语言纯字母旧称（如 Peking、Bombay）；
每地最多 4 个，删去被主名或更长别名前缀覆盖者；带其他语言标记（含 es）的名称不收。地名进入主名与各别名首字母的切片，
26 个切片共 37,387 行、约 2.13 MB（gzip 约 0.86 MB），最大切片 `s.json` 约 235 KB（gzip 约 93 KB）。
每行为 `[名称, 一级行政区, 国家代码, 纬度, 经度, 时区下标, 别名?]`，按人口降序；坐标保留 4 位小数。

复现：下载上表三个文件（zip 需解压）到同一目录，在仓库根运行 `node scripts/geonames-places.mjs <目录>`，
脚本输出地名数与 SHA-256，按输出更新本表。切片按 `/geo/*` 一年 immutable 缓存，**任何重新生成（含只更新数据）都须升 `PLACE_DATA_VERSION`**，目录随之改名。
