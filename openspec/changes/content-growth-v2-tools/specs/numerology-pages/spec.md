## ADDED Requirements

### Requirement: personal year 计算器与年份数页

西方站 SHALL 在 en 与 es 提供 personal year 计算器页与 9 个年份数页（1–9），es 按西语主词另写。计算器 SHALL 按出生月日与目标年份计算，显示每一步；年份数页的「年份」组件段 SHALL 逐数字撰写，满足组内相似度门槛。计算器与已有的逐年个人年数序列使用同一计算规则。

#### Scenario: 计算步骤

- **WHEN** 访客输入 7 月 14 日并选择 2027 年
- **THEN** 页面显示 7+1+4+2+0+2+7 的逐步约简，并链接到对应的年份数页

#### Scenario: 与详批数据一致

- **WHEN** 测试比较计算器与数字命理详批的逐年个人年数
- **THEN** 同一输入得到相同结果
