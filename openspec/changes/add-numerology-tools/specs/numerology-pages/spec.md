# Spec Delta

## Purpose

规定西方站数字命理页面的结构：以单一主词的首页承接最大流量，用计算器、图表与 12 个数字页承接内页词并互相导流。

## ADDED Requirements

### Requirement: 首页
西方站 `/` SHALL 为 Life Path Number 计算器：H1 与 Title 以「life path number」为主词，首屏只要求出生日期，结果显示数字、计算步骤与该数字的摘要，并链接到对应数字页；首页 MUST NOT 平铺塔罗等其他体系的大词作为主标题。

#### Scenario: 首页出结果
- **WHEN** 访客在首页输入出生日期并提交
- **THEN** 同页显示生命灵数、计算步骤与「Read the full meaning of Life Path N」链接

### Requirement: 数字页
`/life-path-number/<n>/` SHALL 为 1–9、11、22、33 各一页，包含性格、爱情、事业、相性、名人示例与 FAQ，页面内嵌首页计算器；每页 SHALL 链接到其他 11 个数字页。

#### Scenario: 访问大师数页
- **WHEN** 访客打开 `/life-path-number/22/`
- **THEN** 页面含 22 的完整说明、嵌入的计算器与其他数字页链接

### Requirement: 完整计算器
`/numerology-calculator/` SHALL 接受姓名与出生日期，输出生命灵数、表达数、灵魂数、人格数、生日数、个人年；姓名可留空，留空时只显示基于日期的数字。

#### Scenario: 不填姓名
- **WHEN** 访客只填出生日期
- **THEN** 显示生命灵数、生日数、个人年，姓名类数字显示「Add your name to unlock」提示
