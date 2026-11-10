# Spec Delta

## MODIFIED Requirements

### Requirement: 东方站入口页
东方站根路径 `/` SHALL 跳转到某个东方站语言的首页，不再展示单独的语言选择页。东方站内的手动选择或浏览器语言指向繁体中文以外的东方站语言时 SHALL 302 到该语言首页；其余情况（含不带 Accept-Language 的爬虫）SHALL 301 到繁体中文首页 `/zh-hant`。跳转目标 MUST 是不带结尾斜杠的规范地址，保留查询参数，响应 MUST NOT 被缓存为跨访客共享的结果。

#### Scenario: 韩语浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `ko-KR` 且没有手动选择的访客打开东方站 `/`
- **THEN** 返回 302，跳转到 `/ko`

#### Scenario: 爬虫访问东方站根路径
- **WHEN** 不带 Accept-Language 与 Cookie 的请求访问 `https://ganjiday.com/`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant`，该地址直接返回 200
