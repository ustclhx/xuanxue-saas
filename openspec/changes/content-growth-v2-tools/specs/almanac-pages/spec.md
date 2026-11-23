## ADDED Requirements

### Requirement: zh-Hant 農民曆

东方站 SHALL 在 zh-Hant 提供農民曆工具页与 12 个月份页（地址见 design 决策 2），复用黄历引擎，另外显示胎神占方。正文 SHALL 按台湾、香港用语与惯例另写，MUST NOT 是 zh-Hans 黄历的字形转换；同文字变体门槛为整页 ≤0.60、整句 ≤0.15、FAQ ≤0.40。

#### Scenario: 同文字变体门槛

- **WHEN** 对 zh-Hant 農民曆页与 zh-Hans 黄历页运行 `measure-locale-similarity --opencc`
- **THEN** 整页、整句与 FAQ 相似度都在门槛内

#### Scenario: 胎神

- **WHEN** 访客在農民曆工具页查看某日
- **THEN** 页面显示当日胎神占方，与引擎复算一致

### Requirement: 農民曆不做擇日判定

農民曆页 SHALL 沿用黄历的约束：宜忌按传统原样列出，不按嫁娶、入宅、开市等事项筛选或汇总吉日，不建擇日页面。日期查询结果 SHALL 输出 `noindex, follow`，canonical 指向工具页。

#### Scenario: 不提供擇日筛选

- **WHEN** 访客浏览農民曆月份页
- **THEN** 页面没有按事项筛选吉日的控件或汇总段落
