## ADDED Requirements

### Requirement: 主词唯一归属

同一站点同一语言内，每个主词 SHALL 只归属一个可索引页面。只有归属页的 Title 与 H1 可以以该主词为目标，站内指向归属页的锚文本 SHALL 用该主词或其自然变体（每个目标最多两种表述）。新主词或新页面上线前 SHALL 登记到关键词归属表，并核对没有其他页面已经以该词为目标。

#### Scenario: 新增入门页前核对归属

- **WHEN** 新增以「what is numerology」为主词的页面
- **THEN** 关键词归属表登记该词归属 `/numerology`；西方站 en 其他页面的 Title 与 H1 不以该词为目标

#### Scenario: 主词换页

- **WHEN** 「free tarot reading」改由 `/tarot` 负责
- **THEN** 归属表更新；其他页面指向 `/tarot` 的锚文本改用新主词或「three-card tarot」，最多两种表述
