## ADDED Requirements

### Requirement: 首页标题与 H1 的主词
两站各语言首页的 H1 SHALL 含本站主词（西方站数字命理与塔罗；东方站八字排盘或만세력／사주、塔罗，中文另含紫微斗数），西方站首页 Title SHALL 为 `Numerology & Tarot Calculators, Free | Arcanumber`，MUST NOT 含「Life Path Number Calculator」（该词由 `/life-path-number` 独占）。东方站繁体与简体首页的 Description SHALL 各为 70–80 字，且句序与用词不同，MUST NOT 只是字形转换。

#### Scenario: 西方站首页
- **WHEN** 搜索引擎抓取 arcanumber.com 首页
- **THEN** Title 为 `Numerology & Tarot Calculators, Free | Arcanumber`，H1 为 `Numerology & Tarot, Calculated Step by Step`

#### Scenario: 东方站简体首页
- **WHEN** 搜索引擎抓取 ganjiday.com `/zh-hans`
- **THEN** H1 为「免费八字排盘、紫微斗数与塔罗占卜」，Description 为 70–80 字，与繁体首页的 Description 不是逐字对应

### Requirement: Title 与 Description 的长度口径
公开页面的 Title 与 Description SHALL 以下列长度为上限参考：英文 Title 60 字符、Description 160 字符；中文与韩文按全角宽度（半角字符计 0.5）Title 30、Description 80。Description 超出上限时 SHALL 压到上限内；Title 只在关键词归属错误（两页抢同一个词）或 H1 不含任何主词时修改，字数本身 MUST NOT 作为修改 Title 的理由。

#### Scenario: 动态日期页的描述
- **WHEN** `/daily-numerology` 的描述带上最长的英文日期
- **THEN** 描述仍不超过 160 字符
