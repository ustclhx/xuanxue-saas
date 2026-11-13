# Spec Delta

## ADDED Requirements

### Requirement: 删号清除出生档案
删除账号时，系统 SHALL 在账号匿名化完成之前，从数据库删除该用户的全部出生档案。删号 MUST NOT 影响另一站点同邮箱账户的档案。

#### Scenario: 删号后档案消失
- **WHEN** 有 3 份档案的用户删除账号
- **THEN** 数据库中不再有属于该用户的档案行

#### Scenario: 另一站的档案保留
- **WHEN** 用户在西方站删号，而同一邮箱在东方站有档案
- **THEN** 东方站的档案保持不变
