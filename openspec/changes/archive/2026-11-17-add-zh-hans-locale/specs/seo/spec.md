# Spec Delta

## MODIFIED Requirements

### Requirement: 站点地图与抓取规则
每个站点 SHALL 提供只包含本站点公开、已发布页面的站点地图索引（按语言拆分子站点地图）与 robots 规则；应用区（`/app`）、后台（`/admin`）、接口路径与分享结果链接 MUST 被禁止抓取或带 noindex。

#### Scenario: 站点地图内容
- **WHEN** 搜索引擎读取西方站站点地图
- **THEN** 其中包含首页、定价、已发布博客文章、工具页与法律页的英语地址，不包含 `/app` 与 `/admin`

#### Scenario: 东方站的站点地图
- **WHEN** 搜索引擎读取东方站 `/sitemap.xml`
- **THEN** 其中只列出 `zh-hant`、`zh-hans` 与 `ko` 的子站点地图，不含西方站页面与 `/app`、`/admin`

#### Scenario: 简体内容回退到英文原文的页面
- **WHEN** 搜索引擎抓取东方站 `/zh-hans/` 下尚未有简体版本的法律页
- **THEN** 页面显示英文原文并附简体提示「仅提供英文版本」，声明 `noindex`，且不列入简体站点地图
