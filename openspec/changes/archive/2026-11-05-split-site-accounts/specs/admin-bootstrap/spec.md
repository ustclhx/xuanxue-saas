## MODIFIED Requirements

### Requirement: 已验证邮箱名单提升
系统 SHALL 将可选 BOOTSTRAP_ADMIN_EMAILS 按逗号分割、去除两侧空白并忽略大小写；名单对两个站点都适用，但只作用于各站点内名单内、emailVerified=true 且未封禁的账户，这些账户 MUST 被提升为平台 admin。一个站点的账户被提升，MUST NOT 使另一站点的同邮箱账户获得 admin。未配置或空名单 MUST 禁用引导。

#### Scenario: 已验证名单账号
- **WHEN** 用户邮箱匹配含空白及大小写变化的名单且已验证、未封禁
- **THEN** 用户成为平台 admin

#### Scenario: 不符合信任条件
- **WHEN** 用户邮箱未验证、未在名单、已封禁，或名单为空
- **THEN** 用户角色不因引导改变

#### Scenario: 只在一站验证
- **WHEN** 名单内的邮箱只在东方站注册并验证
- **THEN** 只有东方站账户成为 admin；该邮箱在西方站注册并验证前，西方站没有对应的 admin
