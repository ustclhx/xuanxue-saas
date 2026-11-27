# Spec Delta

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
