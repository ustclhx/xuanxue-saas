# Spec Delta

## REMOVED Requirements

### Requirement: 首页主词工具页
**Reason**: 八字 / 만세력工具从语言首页迁到关键词 URL，语言首页改为品牌落地页（separate-landing-homepage）。
**Migration**: 工具页要求见本 capability 新增的「八字主词工具页」；首页要求见 home-hub「品牌落地页结构」「首页标题与 H1」。原 Title 文案（末尾按 seo「页面标题带站名」加上站名）与 H1 迁到 `/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력`。

## ADDED Requirements

### Requirement: 八字主词工具页
东方站 `/zh-hant/八字排盤` SHALL 为八字排盤工具页，Title 为「免費八字排盤｜生辰八字命盤查詢、大運流年與喜用神線上解析｜干支日」；`/zh-hans/八字排盘` 为其简体版本；`/ko/만세력` SHALL 为만세력工具页，Title 为「만세력 - 무료 사주 만세력 조회 (사주팔자 · 대운 · 신살) | 간지데이」。Title 中站名之前的部分与迁移前语言首页的 Title 相同，站名按 seo「页面标题带站名」追加。三页 H1 与迁移前语言首页的 H1 相同。结果区块顺序 SHALL 分别遵循设计文档 §2 P1（7 区块）与 P2（6 区块，신살·귀인·공망 区块为最详细的一块）；四柱与五行区块 SHALL 以图形加文字呈现（见 chart-visuals）。三页 SHALL 互为 hreflang 语言版本。

#### Scenario: 繁中工具页结构
- **WHEN** 访客在 `/zh-hant/八字排盤` 提交排盘
- **THEN** 依次显示四柱、五行强弱条形图、身強身弱、喜用神、大運十年轴、神煞、八字重量七个区块

#### Scenario: 工具页标题
- **WHEN** 请求 `/ko/만세력` 的预渲染 HTML
- **THEN** Title 为「만세력 - 무료 사주 만세력 조회 (사주팔자 · 대운 · 신살) | 간지데이」，H1 为迁移前 `/ko` 首页的 H1

#### Scenario: 未登记语言
- **WHEN** 访客打开 `/ko/八字排盤` 或 `/zh-hant/만세력`
- **THEN** 返回 404

## MODIFIED Requirements

### Requirement: 同组件多入口
`/zh-hant/八字排盤`、`/zh-hant/紫微斗數排盤`、`/zh-hant/命盤查詢`（及其简体与韩语对应页）SHALL 共用同一输入表单组件，页面之间切换时 SHALL 保留访客已填写的输入。

#### Scenario: 从八字切到紫微
- **WHEN** 访客在八字页填写信息后点击「紫微斗數排盤」
- **THEN** 紫微页表单已带入相同信息

### Requirement: 长尾概念页
每个概念页 SHALL 有唯一 Title/H1、至少 600 字的本语言说明、嵌入的排盘组件（提交后滚动并高亮对应区块）、FAQ 结构化数据，以及指向八字主词工具页（以关键词为锚文本）与其他概念页的内链矩阵；MUST NOT 以语言首页作为「回到工具」的链接目标。

#### Scenario: 在空亡页排盘
- **WHEN** 访客在 `/zh-hant/八字/空亡/` 提交排盘
- **THEN** 结果滚动到神煞区块并高亮空亡项

#### Scenario: 概念页链接到工具页
- **WHEN** 请求 `/zh-hant/八字/大運` 的预渲染 HTML
- **THEN** 内链矩阵中「八字排盤」链接指向 `/zh-hant/%E5%85%AB%E5%AD%97%E6%8E%92%E7%9B%A4`，没有以 `/zh-hant` 作为排盘入口的链接
