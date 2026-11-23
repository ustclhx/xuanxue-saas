# Spec Delta

## Purpose

规定东方站十二生肖两两配对页与 12×12 总表：地址、引擎计算的地支关系、逐组撰写的正文、语言范围，以及不做婚恋判定的约束。

## ADDED Requirements

### Requirement: 配对总表与 78 组配对页

东方站 SHALL 在 zh-Hans 提供 1 个生肖配对总表页与 78 个配对页（12 组同生肖加 66 组不同生肖）；ko 与根路径英文 SHALL 各自另写同样的集合。每组配对只有一个规范地址，生肖顺序按地支顺序；反序地址 SHALL 301 到规范地址。总表 SHALL 以 12×12 网格链接全部 78 页。

#### Scenario: 反序地址

- **WHEN** 访客请求属牛与属鼠的反序配对地址
- **THEN** 返回 301 到属鼠与属牛的规范地址

#### Scenario: 总表链接完整

- **WHEN** 构建后检查 zh-Hans 配对总表
- **THEN** 总表中有 78 个不重复的配对页链接，每个配对页至少有总表与一个同组区块入链

### Requirement: 配对事实由引擎计算

每个配对页 SHALL 显示两个地支之间的关系（六合、三合、六冲、相刑、相害、相破或无特定关系）与两者五行生克，由引擎计算并在构建检查中复算。正文 SHALL 逐组撰写，并 SHALL 说明年支只是八字的一部分，链接到双人合盘工具做完整计算。

#### Scenario: 鼠与马

- **WHEN** 访客打开属鼠与属马配对页
- **THEN** 页面标明子午相冲，引擎复算一致，正文有链接引导用完整八字合盘

### Requirement: 配对页不给判定

配对页 MUST NOT 出现「属 X 不能嫁属 Y」「最佳婚配」「必然分手」或等价判定，也 MUST NOT 对某个生肖整体作贬损性描述。配对页 SHALL 写成传统说法与相处建议，并带合规说明。

#### Scenario: 相冲组合的写法

- **WHEN** 撰写相冲组合的配对页
- **THEN** 正文描述节奏差异与磨合方式，判定词审计为 0

### Requirement: 语言范围与上线次序

zh-Hans 集合 SHALL 先上线。ko（띠궁합）与 en（Chinese zodiac compatibility）集合 SHALL 按本语言搜索词另写，不由 zh-Hans 翻译；未写完的语言整组不发布，hreflang 只列已发布语言。

#### Scenario: en 集合未完成

- **WHEN** zh-Hans 78 页已上线而 en 集合尚未合并
- **THEN** zh-Hans 配对页的 hreflang 不含 en，en 配对地址返回 404
