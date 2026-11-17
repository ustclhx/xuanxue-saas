# Spec Delta

## REMOVED Requirements

### Requirement: 工具优先的首页结构
**Reason**: 首页不再承载工具，改为品牌落地页（使用者 2026-11-17 决定，推翻 redesign-home-chart-visuals D1）。
**Migration**: 首页结构见本 capability「品牌落地页结构」；工具页见 eastern-tool-pages「八字主词工具页」与 numerology-pages「Life Path 工具页」。

### Requirement: 首页元数据与结构化数据不变
**Reason**: 首页 Title、H1 与结构化数据按主词迁移方案有意改变。
**Migration**: 首页元数据要求见本 capability「首页标题与 H1」与 seo「结构化数据」「首页主词迁移」；canonical 与首页 hreflang 簇保持不变的约束并入「首页标题与 H1」。

## ADDED Requirements

### Requirement: 品牌落地页结构
东方站各语言首页与西方站首页 SHALL 按以下顺序组成：页头、品牌主视觉、3–4 个工具入口、样例报告、今日条（每日运势页已上线时）、三步说明、一行价格、信任说明、3–4 条品牌级 FAQ、页脚。首页 MUST NOT 含工具表单与结果区、MUST NOT 含「延伸閱讀」类重复链接块，工具专属 FAQ 与说明长文 MUST NOT 出现在首页。

#### Scenario: 区块顺序
- **WHEN** 请求 `/zh-hant` 的预渲染 HTML
- **THEN** 顶层区块按上述顺序出现，文档中没有排盘表单输入控件

#### Scenario: 西方站长文不在首页
- **WHEN** 请求西方站 `/` 的预渲染 HTML
- **THEN** 不含「What is a life path number」等说明长文章节，这些章节出现在 `/life-path-number`

### Requirement: 首页主操作指向工具页
首页品牌主视觉 SHALL 只有一个主按钮，指向本语言的主工具页（`/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력`、`/life-path-number`），锚文本含该工具关键词；至多再有一个次要文字链接。首屏 SHALL 满足 site-visual-system「首屏只有一个主任务」。

#### Scenario: 繁中首页主按钮
- **WHEN** 访客在 390×844 打开 `/zh-hant`
- **THEN** 首屏可见唯一主按钮，链接到 `/zh-hant/八字排盤`，文字含「八字排盤」

#### Scenario: 韩语首页主按钮
- **WHEN** 访客打开 `/ko`
- **THEN** 主按钮链接到 `/ko/만세력`，文字含「만세력」

### Requirement: 首页标题与 H1
首页 Title SHALL 为品牌名加品类主词（如「干支日｜免費八字排盤、紫微斗數與塔羅」），H1 SHALL 为品牌承诺；首页的 Title 与 H1 MUST NOT 与任何工具页相同。首页 SHALL 继续返回 200、自引用 canonical，首页 hreflang 簇（`/zh-hant`、`/zh-hans`、`/ko`、东方站 `/en`、x-default）MUST NOT 改变；robots 指令不变。

#### Scenario: 首页与工具页不重复
- **WHEN** 对比 `/zh-hant` 与 `/zh-hant/八字排盤` 的预渲染 HTML
- **THEN** 两页 Title 与 H1 都不相同，首页 Title 含「八字排盤」

#### Scenario: 首页不跳转
- **WHEN** 不带查询参数与片段请求西方站 `/`
- **THEN** 返回 200 与落地页内容，canonical 为 `https://arcanumber.com/`

### Requirement: 旧首页链接迁移
带工具状态查询参数（`unlock` 或 `checkout`）的语言首页请求 SHALL 以 301 跳转到该语言的主工具页并保留全部查询参数；只带营销参数（如 `utm_*`、`gclid`）的请求 MUST NOT 跳转。带 `#r=` 结果片段打开首页时，页面 SHALL 在客户端立即替换到主工具页并保留片段，访客看到与迁移前相同的结果。

#### Scenario: 结账回跳
- **WHEN** 访客从结账返回 `/zh-hant?unlock=<令牌>&checkout=success`
- **THEN** 返回 301，Location 为 `/zh-hant/%E5%85%AB%E5%AD%97%E6%8E%92%E7%9B%A4?unlock=<令牌>&checkout=success`，到达后自动恢复输入并继续解锁流程

#### Scenario: 旧分享链接
- **WHEN** 访客打开迁移前分享的 `https://arcanumber.com/#r=<编码>`
- **THEN** 地址被替换为 `https://arcanumber.com/life-path-number#r=<编码>`，页面显示分享的结果

#### Scenario: 广告参数不跳转
- **WHEN** 请求 `/ko?utm_source=newsletter`
- **THEN** 返回 200 与落地页内容

## MODIFIED Requirements

### Requirement: 工具矩阵
首页 SHALL 显示 3–4 个精选工具入口（东方站中文：八字排盤、紫微斗數、三張牌塔羅、命盤查詢或每日運勢；韩语：만세력、사주궁합、쓰리 카드 타로、오늘의 운세；西方站：Life Path、Numerology Calculator、Three-Card Tarot，Compatibility 为文字链接），每项含名称、一句说明与链接，顺序与条目以设计稿为准；条目 SHALL 只取当前站点、当前语言存在页面的工具，数据 SHALL 来自工具路由注册表，MUST NOT 列出另一站点的工具或链接到另一站点的域名。

#### Scenario: 韩语首页的工具
- **WHEN** 访客打开 `/ko`
- **THEN** 工具入口包含만세력与사주궁합，不包含只有中文页面的工具

#### Scenario: 入口数量
- **WHEN** 请求任一语言首页的预渲染 HTML
- **THEN** 工具入口为 3 或 4 个，每个链接到本站关键词工具页

### Requirement: 每日运势入口
每日运势公开页已在当前站点与语言上线时，首页 SHALL 显示一条今日条并链接到该页；未上线时 MUST NOT 显示该条或任何「即将开放」占位。今日条可显示当日的公共信息（东方站当日干支、西方站 Number of the Day），这些信息 MUST NOT 依赖数据库，MUST NOT 因预渲染而显示过期日期，填入时 MUST NOT 引起布局位移；首页 MUST NOT 计算或查询个人运势。

#### Scenario: 运势页未上线
- **WHEN** 当前语言没有每日运势公开页
- **THEN** 首页不渲染今日条，也不出现「即将开放」文案

#### Scenario: 运势页已上线
- **WHEN** 每日运势公开页已登记在当前站点与语言
- **THEN** 首页显示今日条，链接指向该页

#### Scenario: 隔日访问预渲染首页
- **WHEN** 首页于前一日构建，访客今日打开东方站首页
- **THEN** 今日条显示的是访客当日的干支或不显示日期相关内容，不出现前一日的干支

### Requirement: 定价与订阅入口
首页 SHALL 以一行文字显示定价入口：说明免费工具，并给出当前可购买方案中的最低起价，链接到定价页；价格 SHALL 与定价页使用同一份构建期价格快照。首页 MUST NOT 显示套餐对比表。没有可购买方案时 SHALL 只显示「免费工具」说明与定价页链接，MUST NOT 显示占位价格。

#### Scenario: 价格与定价页一致
- **WHEN** 构建预渲染首页
- **THEN** 首页定价入口中的起价等于同一构建的定价页中最低的可购买价格

#### Scenario: 无可售方案
- **WHEN** 价格快照中没有可购买的方案
- **THEN** 首页定价入口只显示免费说明与定价页链接，没有金额
