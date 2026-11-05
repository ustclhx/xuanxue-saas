## MODIFIED Requirements

### Requirement: 注册即创建个人空间
每个新用户注册成功后 SHALL 自动拥有一个个人空间，用户为其唯一 owner，且该空间具有自动生成、全局唯一、用户可修改的 slug。个人空间 SHALL 与用户属于同一站点，只能在该站点访问。

#### Scenario: 新用户注册
- **WHEN** 用户完成注册
- **THEN** 存在一个属于该用户的个人空间，用户角色为 owner，访问 `/app` 会被重定向到 `/app/<该空间 slug>`

#### Scenario: 在另一站访问空间地址
- **WHEN** 在西方站访问一个东方站空间的 `/app/<slug>`
- **THEN** 返回 404，不显示该空间的任何内容

## ADDED Requirements

### Requirement: 团队成员限同站用户
团队空间 SHALL 属于创建它的站点；邀请、加入与成员管理 MUST 只针对同一站点的账户，按邮箱邀请时 MUST 只在本站点内匹配账户。

#### Scenario: 邀请另一站的邮箱
- **WHEN** 东方站团队空间邀请一个只在西方站注册过的邮箱
- **THEN** 邀请发往该邮箱，接受时需要在东方站登录或注册，不会把西方站账户加入团队
