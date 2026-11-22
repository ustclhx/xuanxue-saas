# numerology-pages Specification

## Purpose
规定西方站数字命理页面的结构：以单一主词的首页承接最大流量，用计算器、图表与 12 个数字页承接内页词并互相导流。

## Requirements

### Requirement: 首页
西方站 `/` SHALL 为 Life Path Number 计算器：H1 与 Title 以「life path number」为主词，首屏只要求出生日期，结果显示数字、计算步骤与该数字的摘要，并链接到对应数字页；首页 MUST NOT 平铺塔罗等其他体系的大词作为主标题。

#### Scenario: 首页出结果
- **WHEN** 访客在首页输入出生日期并提交
- **THEN** 同页显示生命灵数、计算步骤与「Read the full meaning of Life Path N」链接

### Requirement: 数字页
`/life-path-number/<n>/` SHALL 为 1–9、11、22、33 各一页，包含性格、爱情、事业、相性、计算样例与 FAQ（不写无法核实的名人生日），页面内嵌首页计算器；每页 SHALL 链接到其他 11 个数字页。

#### Scenario: 访问大师数页
- **WHEN** 访客打开 `/life-path-number/22/`
- **THEN** 页面含 22 的完整说明、嵌入的计算器与其他数字页链接

### Requirement: 完整计算器
`/numerology-calculator/` SHALL 接受姓名与出生日期，输出生命灵数、表达数、灵魂数、人格数、生日数、个人年；姓名可留空，留空时只显示基于日期的数字。

#### Scenario: 不填姓名
- **WHEN** 访客只填出生日期
- **THEN** 显示生命灵数、生日数、个人年，姓名类数字显示「Add your name to unlock」提示

### Requirement: 数字页组件段逐数字撰写

西方站（en、es）12 个数字页上由组件输出的两段 SHALL 使用逐数字撰写的本语言文案：首屏计算器的样例结果、「其余数字」一段。同语言 12 页之间，每段的渲染相似度（词二元组 Dice，按段标题对齐、只计组件输出部分）SHALL ≤0.30。
计算步骤 SHALL 由引擎生成；结果区底部的合规声明 SHALL 保留。「其余数字」的链接目标与锚文本 MUST 保持不变。

#### Scenario: 两个数字页的样例结果不同

- **WHEN** 访客打开 `/life-path-number/3` 与 `/life-path-number/8`，没有提交日期
- **THEN** 两页样例结果的说明文字不同，各自解释本数字及其样例日期的约简过程，计算步骤与引擎一致

#### Scenario: 组件段相似度门槛

- **WHEN** 构建后对 en 与 es 的 12 个数字页测量样例结果与「其余数字」两段
- **THEN** 每种语言每段的平均 Dice ≤0.30

#### Scenario: 合规声明仍在结果区底部

- **WHEN** 访客查看任一数字页的样例结果
- **THEN** 结果区底部可见本语言的合规声明

### Requirement: 数字命理入门页

西方站 SHALL 提供数字命理入门页：en 为 `/numerology`，主词「what is numerology」；es 为 `/es/numerologia`，主词「qué es la numerología」；两页互为 hreflang。
页面 SHALL 说明什么是数字命理、核心数字及其计算方法、各计算器分别回答什么问题，并嵌入可直接出结果的 Life Path 计算器。页面 SHALL 有本语言 FAQ 与 FAQPage 结构化数据，正文 ≥1,000 词。es 版 MUST 另写，不得是英文版的直译。

#### Scenario: 入门页链接到全部计算器

- **WHEN** 访客打开 `/numerology`
- **THEN** 正文链接 2–5 个计算器；页面另有一个相关区块，列出全部 7 个计算器页，锚文本为各页主词

#### Scenario: 首页让出入门主词

- **WHEN** 检查西方站 en 与 es 首页
- **THEN** 首页 Title 与 H1 不以「what is numerology / qué es la numerología」为目标；首页正文有一条链接指向本语言入门页

#### Scenario: 西语入门页不是直译

- **WHEN** 对 `/es/numerologia` 与 `/numerology` 运行本地化相似度与回译测量
- **THEN** 结构直译分、数字序列重合度与回译相似度都在门槛内，两页的算例使用不同的虚构人物与日期
