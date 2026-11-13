# Spec Delta

## MODIFIED Requirements

### Requirement: 首页主词工具页
东方站 `/zh-hant/` SHALL 为八字排盤工具页，Title 为「免費八字排盤｜生辰八字命盤查詢、大運流年與喜用神線上解析」；`/ko/` SHALL 为만세력工具页，Title 为「만세력 - 무료 사주 만세력 조회 (사주팔자 · 대운 · 신살)」。结果区块顺序 SHALL 分别遵循设计文档 §2 P1（7 区块）与 P2（6 区块，신살·귀인·공망 区块为最详细的一块）。四柱与五行区块 SHALL 以图形加文字呈现（见 chart-visuals）；工具区之后 SHALL 显示首页枢纽区块（见 home-hub），且 MUST NOT 改变上述 Title 与 H1。

#### Scenario: 繁中首页结构
- **WHEN** 访客在 `/zh-hant/` 提交排盘
- **THEN** 依次显示四柱、五行强弱条形图、身強身弱、喜用神、大運十年轴、神煞、八字重量七个区块

#### Scenario: 枢纽区块在工具之后
- **WHEN** 访客打开 `/zh-hant/` 并向下滚动
- **THEN** 工具区与结果说明之后依次出现首页枢纽区块，Title 与 H1 与改版前相同
