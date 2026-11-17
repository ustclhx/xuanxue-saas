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
存在多语言版本的公开页面 SHALL 只在同一站点内声明全部语言版本之间的 hreflang 关联（使用绝对地址，包含页面自身），并包含 `x-default`；MUST NOT 声明另一站点的页面。`x-default` SHALL 指向同一页面在站点默认语言（东方站繁体中文、西方站英语）下的版本，该版本不存在时取站点语言顺序中第一个存在的版本；hreflang 与 `x-default` 的目标 MUST 是直接返回 200 且可索引的规范地址，MUST NOT 是会跳转的地址。站点地图中的语言关联 SHALL 与页面声明一致。

#### Scenario: 定价页的语言版本
- **WHEN** 搜索引擎抓取西方站英文定价页
- **THEN** 页面只声明西方站英文定价页自身与指向自身的 x-default，不出现东方站地址

#### Scenario: 繁中八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hant/八字排盤`
- **THEN** 页面声明东方站 `/ko` 对应页（hreflang=ko）的绝对地址，x-default 为该繁中页自身

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
- **THEN** 页面声明东方站繁中对应页（hreflang=zh-Hant）与 `/ko` 对应页（hreflang=ko）的绝对地址

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

### Requirement: llms.txt
启用营销站时站点 SHALL 提供 `/llms.txt`，列出站点名称与公开、已发布页面，地址 MUST 属于当前环境 APP_URL。

#### Scenario: 读取 llms.txt
- **WHEN** 请求 `/llms.txt`
- **THEN** 返回 200 的纯文本，其中的链接都指向本站

#### Scenario: 不含私有路径
- **WHEN** 读取 `/llms.txt`
- **THEN** 不包含 `/app`、`/admin` 与 `/api`

### Requirement: IndexNow 提交
配置 IndexNow 密钥后，站点 SHALL 在 `/indexnow.txt` 公开该密钥，生产发布后 SHALL 提交站点地图中的本站地址；提交失败 MUST NOT 使发布失败。未配置时 `/indexnow.txt` MUST 返回 404，MUST NOT 提交。密钥 MUST NOT 写入仓库。

#### Scenario: 未配置密钥
- **WHEN** 没有配置 `INDEXNOW_KEY`
- **THEN** `/indexnow.txt` 返回 404，发布步骤跳过提交

#### Scenario: 提交失败
- **WHEN** IndexNow 服务返回错误
- **THEN** 记录警告，发布继续

### Requirement: 规范地址收敛
已登记站点的公开页面 SHALL 只有一个可索引地址：非根路径不带结尾斜杠，协议为 HTTPS。其他形式的请求 SHALL 以永久跳转（GET/HEAD 用 301，其他方法用 308）一次到达规范地址，保留路径与查询参数，MUST NOT 形成循环。未登记的预览 Host 与本地开发地址不做协议升级。

#### Scenario: 结尾斜杠
- **WHEN** 请求东方站 `https://ganjiday.com/zh-hant/?a=1`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant?a=1`

#### Scenario: HTTP 请求
- **WHEN** 请求 `http://arcanumber.com/login?redirect=/tarot`
- **THEN** 返回 301，Location 为 `https://arcanumber.com/login?redirect=/tarot`

#### Scenario: 东方站无前缀公开路径
- **WHEN** 请求东方站 `/pricing?ref=x`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant/pricing?ref=x`，不跳到首页

#### Scenario: 西方站默认语言前缀
- **WHEN** 请求西方站 `/en/pricing`
- **THEN** 返回 301，Location 为 `https://arcanumber.com/pricing`

#### Scenario: 规范地址直接返回
- **WHEN** 请求 `https://ganjiday.com/zh-hant` 或 `https://arcanumber.com/tarot`
- **THEN** 直接返回 200，无需登录

### Requirement: 认证页不进索引
登录、注册、找回密码、重置密码、邮箱验证与接受邀请页面（两站、全部语言、带任意查询参数）SHALL 同时以 `X-Robots-Tag` 响应头和 robots meta 声明 `noindex`，canonical SHALL 指向不带查询参数的同语言认证页；robots.txt MUST NOT 禁止抓取这些页面。公开页面的登录入口链接 MUST NOT 携带随页面变化的回跳参数，回跳地址在用户点击时才附加。

#### Scenario: 带回跳参数的登录页
- **WHEN** 搜索引擎抓取 `https://arcanumber.com/login?redirect=/life-path-number/22`
- **THEN** 返回 200，响应头含 `X-Robots-Tag: noindex, nofollow`，页面含 robots noindex 与 canonical `https://arcanumber.com/login`

#### Scenario: 东方站语言前缀的认证页
- **WHEN** 搜索引擎抓取 `https://ganjiday.com/ko/register`
- **THEN** 响应与页面声明 noindex，canonical 为 `https://ganjiday.com/ko/register`

#### Scenario: 公开页面的登录入口
- **WHEN** 匿名访客或爬虫渲染西方站 `/tarot`
- **THEN** 页头登录链接为不带查询参数的 `/login` 且带 `rel="nofollow"`；访客点击后进入 `/login?redirect=/tarot`，登录后回到 `/tarot`
