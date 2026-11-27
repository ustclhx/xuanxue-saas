# Spec Delta

## ADDED Requirements

### Requirement: 博客为空时隐藏入口
当前语言没有已发布的博客文章时，页头与页脚 MUST NOT 显示博客入口，博客列表页 MUST NOT 出现在站点地图中；有已发布文章后入口 SHALL 恢复显示。

#### Scenario: 无文章
- **WHEN** 西方站英文没有已发布文章
- **THEN** 页头不显示 Blog 入口，`/blog` 不在英文站点地图中

### Requirement: 内容词典页连接工具与详批
牌义页、生命灵数含义页与八字概念页末尾 SHALL 显示「用本站工具算你的」入口（指向对应工具页），对应详批可用时 SHALL 另外显示解锁结合个人命盘的 AI 详批入口。

#### Scenario: 牌义页末尾
- **WHEN** 塔罗详批可用时访客读完一张牌的牌义页
- **THEN** 页面末尾显示前往三张牌工具的入口与塔罗详批入口
