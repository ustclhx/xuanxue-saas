# Spec Delta

## MODIFIED Requirements

### Requirement: 多语言关联
存在多语言版本的公开页面 SHALL 声明全部语言版本之间的 hreflang 关联（含跨站点的绝对地址），并包含指向西方站英语版本的 `x-default`；没有英语对应页的页面 SHALL 把 `x-default` 指向本页所在站点的入口页。东方站的繁体、简体与韩语版本 SHALL 彼此互相声明。

#### Scenario: 定价页的语言版本
- **WHEN** 搜索引擎抓取西方站英文定价页
- **THEN** 页面声明东方站 zh-Hant、zh-Hans 与 ko 定价页的绝对地址与 x-default

#### Scenario: 繁中八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hant/八字排盤/`
- **THEN** 页面声明东方站 `/ko/` 对应页（hreflang=ko）与 x-default 的绝对地址

#### Scenario: 简体八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hans/八字排盘/`
- **THEN** 页面声明东方站繁中对应页（hreflang=zh-Hant）与 `/ko/` 对应页（hreflang=ko）的绝对地址

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
