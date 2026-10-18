# seo Specification

## Purpose

让公开页面能被搜索引擎正确抓取与索引、在社交平台上有正确的分享预览，同时避免应用区与后台被索引。
统一页面元数据、多语言关联、站点地图、结构化数据与默认分享图，使公开内容的搜索发现与分享展示保持一致。

## Requirements

### Requirement: 页面元数据
每个公开页面 SHALL 具有唯一的标题与描述、规范链接（canonical）以及社交分享所需的 Open Graph 与 Twitter 卡片信息。

#### Scenario: 分享博客文章
- **WHEN** 有人在社交平台分享一篇博客文章链接
- **THEN** 预览显示该文章的标题、摘要与封面图

### Requirement: 多语言关联
存在多语言版本的公开页面 SHALL 声明全部语言版本之间的 hreflang 关联（含跨站点的绝对地址），并包含指向西方站英语版本的 `x-default`；没有英语对应页的页面 SHALL 把 `x-default` 指向本页所在站点的入口页。

#### Scenario: 定价页的语言版本
- **WHEN** 搜索引擎抓取西方站英文定价页
- **THEN** 页面声明东方站 zh-Hant 与 ko 定价页的绝对地址与 x-default

#### Scenario: 繁中八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hant/八字排盤/`
- **THEN** 页面声明东方站 `/ko/` 对应页（hreflang=ko）与 x-default 的绝对地址

### Requirement: 站点地图与抓取规则
每个站点 SHALL 提供只包含本站点公开、已发布页面的站点地图索引（按语言拆分子站点地图）与 robots 规则；应用区（`/app`）、后台（`/admin`）、接口路径与分享结果链接 MUST 被禁止抓取或带 noindex。

#### Scenario: 站点地图内容
- **WHEN** 搜索引擎读取西方站站点地图
- **THEN** 其中包含首页、定价、已发布博客文章、工具页与法律页的英语地址，不包含 `/app` 与 `/admin`

#### Scenario: 东方站的站点地图
- **WHEN** 搜索引擎读取东方站 `/sitemap.xml`
- **THEN** 其中只列出 `zh-hant` 与 `ko` 的子站点地图，不含西方站页面与 `/app`、`/admin`

### Requirement: 结构化数据
首页 SHALL 提供组织与网站的结构化数据，博客文章 SHALL 提供文章结构化数据，定价页 SHALL 提供产品与价格的结构化数据。

#### Scenario: 博客文章结构化数据
- **WHEN** 搜索引擎抓取一篇博客文章
- **THEN** 页面中包含作者、发布日期与标题的文章结构化数据

### Requirement: 动态分享图
没有指定封面的公开页面 SHALL 自动生成包含站点名称与页面标题的分享图片。

#### Scenario: 法律页分享
- **WHEN** 分享没有封面图的服务条款页面
- **THEN** 预览图显示站点名称与「服务条款」标题
