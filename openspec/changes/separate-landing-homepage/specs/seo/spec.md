# Spec Delta

## MODIFIED Requirements

### Requirement: 多语言关联
存在多语言版本的公开页面 SHALL 只在同一站点内声明全部语言版本之间的 hreflang 关联（使用绝对地址，包含页面自身），并包含 `x-default`；MUST NOT 声明另一站点的页面。`x-default` SHALL 指向同一页面在站点默认语言（东方站繁体中文、西方站英语）下的版本，该版本不存在时取站点语言顺序中第一个存在的版本；hreflang 与 `x-default` 的目标 MUST 是直接返回 200 且可索引的规范地址，MUST NOT 是会跳转的地址。站点地图中的语言关联 SHALL 与页面声明一致。

#### Scenario: 定价页的语言版本
- **WHEN** 搜索引擎抓取西方站英文定价页
- **THEN** 页面只声明西方站英文定价页自身与指向自身的 x-default，不出现东方站地址

#### Scenario: 繁中八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hant/八字排盤`
- **THEN** 页面声明东方站 `/zh-hans/八字排盘`（hreflang=zh-Hans）与 `/ko/만세력`（hreflang=ko）的绝对地址，x-default 为该繁中页自身

#### Scenario: 东方站内页的 x-default
- **WHEN** 搜索引擎抓取东方站 `/ko/pricing`
- **THEN** 页面声明 `/zh-hant/pricing`、`/zh-hans/pricing`、`/ko/pricing` 三个语言版本，x-default 为 `https://ganjiday.com/zh-hant/pricing`，不是东方站根路径

#### Scenario: 东方站首页的 x-default
- **WHEN** 搜索引擎抓取东方站 `/ko`
- **THEN** x-default 为 `https://ganjiday.com/zh-hant`，东方站 `/en` 入口页的 x-default 同样为该地址

#### Scenario: 站点地图与页面一致
- **WHEN** 搜索引擎读取东方站 `/sitemap/zh-hant.xml`
- **THEN** 每个条目的 hreflang 与 x-default 与该页面 `<link rel="alternate">` 相同，没有条目的 x-default 指向东方站根路径

#### Scenario: 简体八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hans/八字排盘`
- **THEN** 页面声明东方站 `/zh-hant/八字排盤`（hreflang=zh-Hant）与 `/ko/만세력`（hreflang=ko）的绝对地址

### Requirement: 结构化数据
两站各语言首页 SHALL 提供组织（Organization）与网站（WebSite）的结构化数据；主工具页（`/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력`、`/life-path-number`）SHALL 提供 `WebApplication`（免费 `offers`）、`BreadcrumbList` 与该工具的 `FAQPage`；博客文章 SHALL 提供文章结构化数据，定价页 SHALL 提供产品与价格的结构化数据。结构化数据中的地址 SHALL 与页面 canonical 一致。

#### Scenario: 博客文章结构化数据
- **WHEN** 搜索引擎抓取一篇博客文章
- **THEN** 页面中包含作者、发布日期与标题的文章结构化数据

#### Scenario: 东方站首页
- **WHEN** 请求东方站 `/zh-hant` 的预渲染 HTML
- **THEN** 包含 Organization 与 WebSite 两段 JSON-LD，不含 FAQPage

#### Scenario: Life Path 工具页
- **WHEN** 请求西方站 `/life-path-number` 的预渲染 HTML
- **THEN** 包含 WebApplication、BreadcrumbList 与 FAQPage，其中的 `url` 与 canonical 相同；西方站 `/` 不再输出 FAQPage

## ADDED Requirements

### Requirement: 首页主词迁移
迁移前由首页承接的工具主词 SHALL 随工具迁到关键词 URL：工具页的 Title、description 与 H1 沿用迁移前首页的值，工具页自引用 canonical（编码后的地址、不带结尾斜杠）。站点地图 SHALL 列出新工具页并刷新首页与新页的 `lastmod`；站内导航、页脚、工具入口、概念页、数字页、指南、博客、报告页、邮件与 `llms.txt` 中指向该工具的链接 SHALL 指向新 URL。首页 MUST NOT 被重定向。

#### Scenario: 站点地图包含新地址
- **WHEN** 读取东方站 `/sitemap/ko.xml`
- **THEN** 包含 `https://ganjiday.com/ko/%EB%A7%8C%EC%84%B8%EB%A0%A5`，其 hreflang 与页面声明一致

#### Scenario: 站内链接
- **WHEN** 爬取西方站全部预渲染页面中指向 Life Path 计算器的链接
- **THEN** 链接目标为 `/life-path-number`，没有以 `/` 作为计算器入口、锚文本为「Life Path Number Calculator」的链接

#### Scenario: llms.txt
- **WHEN** 请求东方站 `/llms.txt`
- **THEN** 繁中「八字排盤」条目的地址为 `https://ganjiday.com/zh-hant/%E5%85%AB%E5%AD%97%E6%8E%92%E7%9B%A4`，不再是 `https://ganjiday.com/zh-hant`
