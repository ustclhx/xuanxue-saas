## MODIFIED Requirements

### Requirement: 团队空间开关
当 `multiTenant=false` 时，系统 MUST 拒绝创建团队空间与发送邀请，并 MUST 隐藏团队空间的切换与创建入口；个人空间入口 SHALL 保留。当 `multiTenant=true` 时，用户 SHALL 能在 `maxWorkspacesPerUser` 与套餐权益范围内创建团队空间。开关关闭后，已有团队空间 SHALL 保持只读可访问。

#### Scenario: 关闭开关时创建团队空间
- **WHEN** `multiTenant=false`，客户端直接调用创建团队空间接口
- **THEN** 请求被拒绝

#### Scenario: 关闭开关后访问已有团队空间
- **WHEN** 站点关闭多租户开关，某用户访问其已有团队空间
- **THEN** 可以查看数据，但不能邀请成员或创建新内容

#### Scenario: 关闭开关时的空间入口
- **WHEN** `multiTenant=false`，已登录用户打开页头的账户下拉
- **THEN** 下拉中只出现个人空间，不出现团队空间的切换或创建选项

## ADDED Requirements

### Requirement: 空间入口
已登录用户 SHALL 能从站点页头右上角的账户下拉进入自己的空间：个人空间始终列出；多租户开启时，同时列出用户所属的团队空间。选择某个空间 SHALL 导航到该空间的 `/app/$slug`，不改变其他空间的成员关系或会话中的活跃空间。

#### Scenario: 从页头进入个人空间
- **WHEN** 已登录用户在任意公共页面打开账户下拉并选择个人空间
- **THEN** 浏览器进入该个人空间的 `/app/<slug>`

#### Scenario: 多租户开启时列出团队空间
- **WHEN** `multiTenant=true`，用户属于两个团队空间
- **THEN** 账户下拉同时列出个人空间与这两个团队空间
