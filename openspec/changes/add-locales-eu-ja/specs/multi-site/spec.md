## MODIFIED Requirements

### Requirement: 语言归属站点
每种语言 SHALL 只属于一个站点：`zh-Hant`、`zh-Hans`、`ko`、`ja` 属于东方站，`en`、`es`、`pt-BR`、`fr`、`de`、`it` 属于西方站；访问不属于当前站点的语言前缀时 SHALL 301 重定向到该语言所属站点的同一路径。尚未发布的语言在正式域名上按「语言发布状态」返回 404，不做跨站跳转。

#### Scenario: 在西方站访问韩语路径
- **WHEN** 访客请求西方站的 `/ko/manseryeok/`
- **THEN** 返回 301，跳转到东方站的 `/ko/manseryeok/`

#### Scenario: 简体前缀出现在西方站
- **WHEN** 访客在西方站打开 `/zh-hans/pricing`
- **THEN** 301 重定向到东方站的 `/zh-hans/pricing`

#### Scenario: 日语前缀出现在西方站
- **WHEN** `ja` 已发布，访客在西方站打开 `/ja/pricing`
- **THEN** 301 重定向到东方站的 `/ja/pricing`

#### Scenario: 西班牙语前缀出现在东方站
- **WHEN** `es` 已发布，访客在东方站打开 `/es/tarot`
- **THEN** 301 重定向到西方站的 `/es/tarot`

### Requirement: 东方站入口页
东方站根路径 `/` SHALL 跳转到某个东方站语言的首页，不再展示单独的语言选择页。东方站内的手动选择或浏览器语言指向繁体中文以外的已发布东方站语言（含 `ja`）时 SHALL 302 到该语言首页；其余情况（含不带 Accept-Language 的爬虫）SHALL 301 到繁体中文首页 `/zh-hant`。跳转目标 MUST 是不带结尾斜杠的规范地址，保留查询参数，响应 MUST NOT 被缓存为跨访客共享的结果。

#### Scenario: 韩语浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `ko-KR` 且没有手动选择的访客打开东方站 `/`
- **THEN** 返回 302，跳转到 `/ko`

#### Scenario: 日语浏览器访问东方站根路径
- **WHEN** `ja` 已发布，浏览器语言为 `ja-JP` 且没有手动选择的访客打开东方站 `/`
- **THEN** 返回 302，跳转到 `/ja`

#### Scenario: 爬虫访问东方站根路径
- **WHEN** 不带 Accept-Language 与 Cookie 的请求访问 `https://ganjiday.com/`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant`，该地址直接返回 200

#### Scenario: 简体浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `zh-CN` 且没有手动选择的访客打开东方站 `/`
- **THEN** 返回 302，跳转到 `/zh-hans`
