## ADDED Requirements

### Requirement: 跨站主题归属

两站都能承载的主题，其每种语言的主词 SHALL 只归一个站点，并登记在关键词归属表。中国生肖的英文主词（如 chinese zodiac、year of the goat 2027、chinese zodiac compatibility）归东方站根路径英文；西方站 MUST NOT 新建以这些词为 Title 或 H1 目标的页面。两站之间 MUST NOT 互相链接。

#### Scenario: 西方站不建生肖页

- **WHEN** 构建后审计西方站全部可索引页的 Title 与 H1
- **THEN** 没有以 chinese zodiac 系列主词为目标的页面，也没有指向东方站的链接

### Requirement: 带年份页面的时效

Title 或 H1 带具体年份的页面 SHALL 在发布时登记年份与复查日期。年份过去后，该页 SHALL 按使用者裁定保留、301 到次年同类页或改为 noindex，不得在原地址改写为其他年份的内容。

#### Scenario: 年度复查

- **WHEN** 次年同类页面准备发布
- **THEN** 证据目录有上一年页面的处理决定，站点地图与之一致

### Requirement: 关系类页面的判定词审计

合盘、配对与关系场景页面（东西两站）构建后 SHALL 对 Title、H1、H2、FAQ、正文与锚文本做判定词审计。判定词表按语言维护，至少包括「宜结婚」「不宜结婚」「会离婚」「克夫」「克妻」「注定分手」及其 ko、ja、en、es 对应说法；命中时检查 SHALL 以非零状态退出，页面不得合并上线。

#### Scenario: 审计命中

- **WHEN** 某配对页 FAQ 出现「不宜结婚」
- **THEN** 审计以非零状态退出并列出该页与位置
