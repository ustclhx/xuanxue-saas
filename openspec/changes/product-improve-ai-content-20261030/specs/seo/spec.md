# Spec Delta

## MODIFIED Requirements

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

#### Scenario: 东方站英文入口页
- **WHEN** 搜索引擎抓取东方站 `/en`
- **THEN** 页面声明东方站 zh-Hant、zh-Hans、ko 首页的 hreflang，不出现西方站地址

## ADDED Requirements

### Requirement: 页面标题使用站点品牌
所有页面（含 404 与错误页）的标题 SHALL 使用当前站点的品牌名（东方站「干支日」、西方站「Arcanumber」），MUST NOT 出现项目内部名称。404 页的标题与正文 SHALL 使用当前语言。

#### Scenario: 西方站 404
- **WHEN** 访客请求西方站不存在的路径
- **THEN** 返回 404，标题含「Arcanumber」，不含 `xuanxue`

### Requirement: 静态页元数据覆盖全部语言
首页、定价、博客、电子报、等候名单等静态页的 title 与 description SHALL 为每种站点语言单独提供，并描述本站点的体系；MUST NOT 回退到其他语言或其他站点的描述。

#### Scenario: 简体定价页
- **WHEN** 访客打开东方站 `/zh-hans/pricing`
- **THEN** title 与 description 为简体中文，提及八字、紫微、塔罗，不出现 numerology

### Requirement: AI 爬虫抓取姿态
每个站点的 robots 规则 SHALL 对主流 AI 爬虫（至少 GPTBot、ClaudeBot、Google-Extended、OAI-SearchBot、PerplexityBot）显式声明允许抓取公开页面，同时保持对应用区、后台、接口与分享链接的禁止规则；每个站点 SHALL 提供 `/llms.txt`，列出站点简介与核心工具页地址。

#### Scenario: robots 内容
- **WHEN** 请求任一站点的 robots.txt
- **THEN** 其中逐个列出上述 AI 爬虫并允许 `/`，且 `/app`、`/api` 等路径仍被禁止

#### Scenario: llms.txt
- **WHEN** 请求东方站 `/llms.txt`
- **THEN** 返回纯文本，包含站点简介与八字、紫微、塔罗工具的规范地址

### Requirement: FAQ 汇总页
每个站点每种语言 SHALL 提供 `/faq` 汇总页，汇集积分、退款、隐私、计算方法等常见问题，输出 FAQPage 结构化数据，并收录在本站点地图中。

#### Scenario: 访问 FAQ
- **WHEN** 访客打开 `/zh-hant/faq`
- **THEN** 返回 200 的繁体 FAQ 页面，含 FAQPage 结构化数据，且该地址出现在 zh-hant 站点地图中
