# Spec Delta

## MODIFIED Requirements

### Requirement: 合规声明
每个工具页与每份免费结果 SHALL 显示当前语言的规则引擎声明：「依传统规则计算、仅供娱乐、不预测未来」，MUST NOT 声称由 AI 生成或 AI 辅助；AI 详批的解锁卡、报告、定价页与对话 SHALL 使用「AI 辅助、仅供娱乐、不预测未来」。涉及健康的问题 SHALL 引导访客寻求专业医疗建议。页面标题与 H1 MUST NOT 以 AI 作为卖点。

#### Scenario: 结果区的声明
- **WHEN** 任一工具页显示结果
- **THEN** 结果区底部可见本语言的规则引擎声明，且不含「AI 辅助」「AI-assisted」等表述

#### Scenario: 详批解锁卡的声明
- **WHEN** 访客查看可用的详批解锁卡或已生成的报告
- **THEN** 可见本语言的「AI 辅助、仅供娱乐、不预测未来」声明
