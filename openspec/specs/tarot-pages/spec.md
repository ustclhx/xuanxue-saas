# tarot-pages Specification

## Purpose
规定塔罗抽牌页与牌义页的内容结构、合规问句引导与互链，让抽牌工具与 78 张牌义页互相导流，并保证图片可访问。

## Requirements

### Requirement: 抽牌页结构
每个牌阵页 SHALL 依次包含：H1 与导语（适用的问题类型）、首屏铺牌与洗牌/切牌交互、牌阵互导矩阵（四个牌阵互相链接）、可直接使用的问句模板（至少 6 条，点击后填入问题框）、「不能问的问题」三类说明、牌位说明、FAQ。

#### Scenario: 使用问句模板
- **WHEN** 访客点击一条问句模板
- **THEN** 问题框被填入该问句，并可直接开始洗牌

### Requirement: 动效与可访问性
洗牌与翻牌动画在系统开启「减少动态效果」时 SHALL 改为淡入；所有牌可用键盘选择；每张牌图 SHALL 有本语言 alt（牌名 + 正/逆位）。

#### Scenario: 减少动态效果
- **WHEN** 系统开启 prefers-reduced-motion 后抽牌
- **THEN** 不播放洗牌动画，牌直接淡入显示

### Requirement: 牌义页
每张牌在每种语言 SHALL 有一个牌义页，包含牌面图、关键词、正位与逆位含义、爱情/事业/建议三个维度、相关牌阵入口与「抽一张试试」组件，并链接同花色/同序号的相邻牌。

#### Scenario: 打开牌义页
- **WHEN** 访客打开「权杖王牌」英语牌义页
- **THEN** 页面显示图片、正逆位含义、三个维度，以及指向权杖二与其他王牌的链接

### Requirement: 图片来源合规
牌面图片 MUST 仅使用公有领域或已获授权的版本，仓库 SHALL 记录每张图片的来源 URL 与许可说明。

#### Scenario: 核对来源
- **WHEN** 审阅者查看图片来源清单
- **THEN** 78 张图片均有来源 URL 与公有领域说明

### Requirement: 牌义页组件段逐牌撰写

西方站（en、es）牌义页上由组件输出、而非来自长文的三段 SHALL 使用逐牌撰写的本语言文案：H1 下的导语、「抽一张」面板说明、延伸牌义区块的说明句。同语言 78 页之间，每段的渲染相似度（词二元组 Dice，按段标题对齐、两两平均）SHALL ≤0.30。
H1、Title、meta description、速览中的事实（分组、是非倾向、关键词）、4 条延伸牌义链接的目标与锚文本 MUST 保持不变。其他语言没有逐牌文案时 SHALL 沿用现有通用文案。

#### Scenario: 两张牌的抽一张面板不同

- **WHEN** 访客先后打开 `/tarot/cards/the-sun` 与 `/tarot/cards/five-of-swords`
- **THEN** 两页「Try a one-card draw」面板的说明句不同，且都与本牌的主题相关；按钮文字与抽牌功能不变

#### Scenario: 组件段相似度门槛

- **WHEN** 构建后对 en 与 es 的 78 个牌义页测量导语、抽一张、延伸牌义三段
- **THEN** 每种语言每段的平均 Dice ≤0.30

#### Scenario: 链接与 SEO 字段不变

- **WHEN** 比较改动前后的牌义页
- **THEN** 延伸牌义的 4 条链接目标与锚文本、转化条链接、Title、H1、meta description、canonical 与 hreflang 逐页一致

### Requirement: 塔罗入口页负责免费塔罗主词

各语言的塔罗入口页（三张牌抽牌页，路径不变）SHALL 负责本语言的免费塔罗主词：en「free tarot reading」、zh-hans「免费塔罗占卜」、zh-hant「免費塔羅牌占卜」、ko「무료 타로」、es「tarot gratis」、ja「無料タロット占い」。主词 SHALL 出现在该页 Title 开头、H1 与导航名中。三张牌作为本页副词保留在 H1 或导语里。

#### Scenario: 英文入口页

- **WHEN** 访客打开 `/tarot`
- **THEN** Title 以「Free Tarot Reading」开头，H1 含「Free Tarot Reading」，页面仍是三张牌抽牌工具

#### Scenario: 繁体不是字形转换

- **WHEN** 比较 `/zh-hant/塔羅` 与 `/zh-hans/塔罗` 的 Title、Description 与 H1
- **THEN** 两者措辞不同，繁体主词为「免費塔羅牌占卜」，不是简体版逐字转换的结果

### Requirement: 免费塔罗主词不被其他牌阵页争夺

单张、是非、凯尔特十字三个牌阵页与牌义索引页 SHALL 保留各自的主词，Title 与 H1 MUST NOT 以免费塔罗主词开头。站内指向入口页的锚文本每种语言 SHALL 不超过 2 种表述：免费塔罗主词，以及三张牌名称。

#### Scenario: 是非牌阵页

- **WHEN** 访客打开 `/tarot/yes-or-no`
- **THEN** Title 与 H1 的主词仍为「Yes or No Tarot」

#### Scenario: 指向入口页的锚文本

- **WHEN** 构建后运行站内链接审计
- **THEN** 指向各语言塔罗入口页的正文锚文本最多两种：免费塔罗主词与三张牌名称
