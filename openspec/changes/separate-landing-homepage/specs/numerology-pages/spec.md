# Spec Delta

## REMOVED Requirements

### Requirement: 首页
**Reason**: Life Path Number 计算器从西方站首页迁到 `/life-path-number`，首页改为品牌落地页（separate-landing-homepage）。
**Migration**: 计算器要求见本 capability 新增的「Life Path 工具页」；首页要求见 home-hub「品牌落地页结构」「首页标题与 H1」。原 Title、description、H1、说明长文与 FAQ 迁到 `/life-path-number`。

## ADDED Requirements

### Requirement: Life Path 工具页
西方站 `/life-path-number` SHALL 为 Life Path Number 计算器：Title 与 H1 沿用迁移前首页的文案（以「life path number」为主词），首屏只要求出生日期，结果显示数字、以推导图形加文字呈现的计算步骤与该数字的摘要，并链接到对应数字页。说明长文与 FAQ SHALL 位于结果区之后；页面 MUST NOT 平铺塔罗等其他体系的大词作为主标题。

#### Scenario: 工具页出结果
- **WHEN** 访客在 `/life-path-number` 输入出生日期并提交
- **THEN** 同页显示生命灵数、计算步骤与「Read the full meaning of Life Path N」链接

#### Scenario: 标题沿用
- **WHEN** 请求 `/life-path-number` 的预渲染 HTML
- **THEN** Title 为「Life Path Number Calculator: Free, With Every Step Shown」，H1 为「Life Path Number Calculator」

## MODIFIED Requirements

### Requirement: 数字页
`/life-path-number/<n>/` SHALL 为 1–9、11、22、33 各一页，包含性格、爱情、事业、相性、计算样例与 FAQ（不写无法核实的名人生日），页面内嵌 Life Path 计算器；每页 SHALL 链接到其他 11 个数字页，并以面包屑「Home › Life Path Number › <n>」与正文链接指向父页 `/life-path-number`。

#### Scenario: 访问大师数页
- **WHEN** 访客打开 `/life-path-number/22/`
- **THEN** 页面含 22 的完整说明、嵌入的计算器与其他数字页链接

#### Scenario: 面包屑指向父页
- **WHEN** 请求 `/life-path-number/7` 的预渲染 HTML
- **THEN** 可见面包屑第二级链接到 `/life-path-number`，且页面输出对应的 `BreadcrumbList` 结构化数据
