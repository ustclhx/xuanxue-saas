# Spec Delta

## MODIFIED Requirements

### Requirement: 图形主题与打印
图形颜色 SHALL 只来自站点设计 token，在东方站浅色与深色、西方站浅色与深色下均可读；打印时图形 SHALL 使用浅底深字并保留五行文字标签，结果区块 MUST NOT 被截断在两页之间无标题地显示。

#### Scenario: 东方站深色
- **WHEN** 东方站切换为深色模式
- **THEN** 图形背景、线条与文字随 token 切换，文字对比度不低于 4.5:1

#### Scenario: 西方站浅色与深色
- **WHEN** 访客在西方站 `/numerology-chart` 出结果后在浅色与深色之间切换
- **THEN** 推导图形与数字网格的线条与文字随 token 切换，两种主题下文字对比度均不低于 4.5:1

#### Scenario: 打印结果
- **WHEN** 访客打印八字结果页
- **THEN** 打印稿中四柱图形为浅底深字，五行文字标签可见
