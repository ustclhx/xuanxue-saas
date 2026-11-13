# Spec Delta

## MODIFIED Requirements

### Requirement: 首页
西方站 `/` SHALL 为 Life Path Number 计算器：H1 与 Title 以「life path number」为主词，首屏只要求出生日期，结果显示数字、计算步骤与该数字的摘要，并链接到对应数字页；计算步骤 SHALL 以推导图形加文字呈现（见 chart-visuals）。首页 MUST NOT 平铺塔罗等其他体系的大词作为主标题；工具区之后 SHALL 显示首页枢纽区块（见 home-hub），其中的其他工具只以工具矩阵条目出现。

#### Scenario: 首页出结果
- **WHEN** 访客在首页输入出生日期并提交
- **THEN** 同页显示生命灵数、计算步骤与「Read the full meaning of Life Path N」链接

#### Scenario: 塔罗只出现在工具矩阵
- **WHEN** 请求西方站首页的预渲染 HTML
- **THEN** 塔罗只作为工具矩阵中的条目出现，H1 与各 h2 不以塔罗为主词
