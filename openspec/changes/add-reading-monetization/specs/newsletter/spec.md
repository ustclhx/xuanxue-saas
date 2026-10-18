# Spec Delta

## ADDED Requirements

### Requirement: 订阅来源与偏好
订阅记录 SHALL 保存来源工具、主题、站点与语言；同一邮箱从不同工具再次订阅时 SHALL 更新偏好而不是新增记录，已确认的订阅 MUST NOT 被要求重新确认。

#### Scenario: 已订阅者再次订阅
- **WHEN** 已确认订阅的邮箱在塔罗结果页再次提交订阅
- **THEN** 偏好更新为塔罗与新主题，不再发送确认邮件，直接发送该次结果的解读邮件
