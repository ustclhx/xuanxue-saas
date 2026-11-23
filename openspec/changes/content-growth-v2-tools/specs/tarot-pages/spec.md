## ADDED Requirements

### Requirement: 牌阵说明页

西方站 SHALL 在 en 新增 3–4 个牌阵页（如爱情牌阵、事业牌阵、满月牌阵），每页 SHALL 有一个可直接使用的牌阵、各位置的含义说明与逐页撰写的正文。牌阵页 MUST NOT 与已有的是非、凯尔特十字、三张牌页面重复，也 MUST NOT 争夺「free tarot reading」主词。

#### Scenario: 爱情牌阵

- **WHEN** 访客打开爱情牌阵页并抽牌
- **THEN** 页面按位置显示牌与含义；Title 与 H1 以该牌阵主词为目标，不以 free tarot reading 开头

#### Scenario: 不给关系决策

- **WHEN** 构建后对牌阵页做判定词审计
- **THEN** 命中数为 0
