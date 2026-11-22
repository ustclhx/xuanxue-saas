## ADDED Requirements

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
