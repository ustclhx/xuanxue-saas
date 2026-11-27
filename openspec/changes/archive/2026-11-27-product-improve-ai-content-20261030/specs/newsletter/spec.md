# Spec Delta

## ADDED Requirements

### Requirement: 订阅表单首屏可用
电子报页与页脚的订阅表单 SHALL 在服务端渲染的 HTML 中直接输出邮箱输入框与提交按钮，MUST NOT 以「加载中」作为首屏内容；人机验证等依赖客户端的组件 SHALL 在水合后补充，加载失败时表单 SHALL 显示本语言的错误说明。

#### Scenario: 无脚本抓取
- **WHEN** 爬虫或禁用脚本的访客请求电子报页
- **THEN** 返回的 HTML 中包含邮箱输入框，不出现「载入中」「Loading」作为唯一内容

#### Scenario: 验证组件加载失败
- **WHEN** 人机验证配置读取失败
- **THEN** 表单仍然可见，并在提交区显示本语言的暂不可用说明
