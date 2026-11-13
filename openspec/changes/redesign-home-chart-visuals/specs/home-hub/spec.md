# Spec Delta

## Purpose

规定两站语言首页在工具区之后的枢纽区块：把访客从首页工具引导到站内其他工具、样例详批、每日运势与定价，同时保持首页的主词、预渲染与加载性能。

## ADDED Requirements

### Requirement: 工具优先的首页结构
东方站各语言首页与西方站首页 SHALL 先显示原有工具区（H1、表单、结果与说明长文），枢纽区块 SHALL 位于工具结果之后、FAQ 之前；枢纽区块 MUST NOT 出现在首屏表单之上，MUST NOT 改变首页 Title、H1 与主词。

#### Scenario: 首屏仍是工具
- **WHEN** 访客在 390px 宽的手机上打开 `/zh-hant`
- **THEN** 首屏可见 H1 与排盘表单，枢纽区块在工具结果区之后

#### Scenario: 西方站标题不变
- **WHEN** 请求 `https://arcanumber.com/` 的预渲染 HTML
- **THEN** Title 与 H1 仍以「life path number」为主词，与改版前一致

### Requirement: 工具矩阵
首页 SHALL 显示本站的工具矩阵：只列出当前站点、当前语言存在页面的工具，每项含名称、一句说明与链接；数据 SHALL 来自工具路由注册表，MUST NOT 列出另一站点的工具或链接到另一站点的域名。

#### Scenario: 韩语首页的工具
- **WHEN** 访客打开 `/ko`
- **THEN** 工具矩阵包含 사주궁합 等有韩语页面的工具，不包含只有中文页面的工具

#### Scenario: 西方站不出现东方工具
- **WHEN** 访客打开 arcanumber.com 首页
- **THEN** 工具矩阵只含数字命理与塔罗工具，没有八字、紫微或指向 ganjiday.com 的链接

### Requirement: 样例详批展示
首页 SHALL 展示一份标明「示例」的详批样例：基于虚构样例命盘的命盘图形、详批章节大纲与一段样例段落，并链接到对应工具。样例文本 SHALL 复用详批 catalog 中经使用者审定的样例段落（product-improve 3.2 / D11，截至 2026-11-13 尚待审定）；样例未审定前该区块 MUST NOT 渲染，且 MUST NOT 调用模型或引用访客数据。

#### Scenario: 样例来自 catalog
- **WHEN** 构建预渲染东方站繁中首页
- **THEN** 样例区块的大纲与段落与八字详批 catalog 的繁中样例一致，并带「示例」标记

### Requirement: 每日运势入口
每日运势公开页已在当前站点与语言上线时，首页 SHALL 显示每日运势入口卡片并链接到该页；未上线时 MUST NOT 显示该卡片或任何「即将开放」占位。入口卡片 MUST NOT 在首页渲染时实时计算或查询个人运势。

#### Scenario: 运势页未上线
- **WHEN** 当前语言没有每日运势公开页
- **THEN** 首页不渲染每日运势入口，也不出现「即将开放」文案

#### Scenario: 运势页已上线
- **WHEN** 每日运势公开页已登记在当前站点与语言
- **THEN** 首页显示入口卡片，链接指向该页

### Requirement: 定价与订阅入口
首页 SHALL 显示定价入口：列出当前可购买的积分包与订阅方案的名称和价格并链接到定价页；价格 SHALL 与定价页使用同一份构建期价格快照。没有可购买方案时 SHALL 只显示「免费工具」说明与定价页链接，MUST NOT 显示占位价格。

#### Scenario: 价格与定价页一致
- **WHEN** 构建预渲染首页
- **THEN** 首页定价入口中的每个价格与同一构建的定价页一致

#### Scenario: 无可售方案
- **WHEN** 价格快照中没有可购买的方案
- **THEN** 首页定价入口只显示免费说明与定价页链接，没有金额

### Requirement: 信任背书只用真实数据
首页信任背书 SHALL 只包含可核实的事实（如结果在浏览器内计算、公开计算步骤、详批失败自动退回积分）或带来源与统计日期的数值；没有带来源的数值时 MUST NOT 渲染数值条，MUST NOT 出现虚构的用户数、评分或评价。

#### Scenario: 无统计来源
- **WHEN** 项目未配置带来源的统计数值
- **THEN** 首页不渲染数值条，只显示事实型背书

### Requirement: 首页枢纽不依赖数据库
首页枢纽区块 SHALL 在构建期预渲染，主体内容 MUST NOT 依赖运行时数据库查询或外部请求；数据库不可达时首页 SHALL 完整显示。

#### Scenario: 数据库不可达
- **WHEN** 数据库暂时不可达，访客打开首页
- **THEN** 工具区与全部枢纽区块正常显示

### Requirement: 首页性能与包体积不退化
首页改版后，两站各语言首页的首页包检查 SHALL 通过且静态脚本 gzip 总量不超过设定预算；以同一 Lighthouse 方法测得的 LCP 与 CLS 中位数 MUST NOT 劣于改版前基线，CLS SHALL 小于 0.1。

#### Scenario: 构建时检查
- **WHEN** 运行 web 生产构建
- **THEN** 首页包检查覆盖西方站首页与东方站各语言首页，任一页面出现禁止代码或超出预算时构建失败

#### Scenario: 性能对照
- **WHEN** 改版前后各测三次首页 Lighthouse
- **THEN** 改版后 LCP、CLS 中位数不高于改版前，CLS 小于 0.1

### Requirement: 首页元数据与结构化数据不变
首页改版 MUST NOT 改变首页的 canonical、hreflang、x-default、robots 指令与已有结构化数据类型；枢纽区块中的链接 SHALL 为同站、同语言的普通链接。

#### Scenario: 元数据对照
- **WHEN** 对比改版前后首页预渲染 HTML 的 head
- **THEN** canonical、hreflang、robots 与 JSON-LD 类型一致
