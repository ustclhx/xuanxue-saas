# Spec Delta

## MODIFIED Requirements

### Requirement: 语言归属站点
每种语言 SHALL 只属于一个站点：v1 中 `zh-Hant`、`zh-Hans`、`ko` 属于东方站，`en` 属于西方站；访问不属于当前站点的语言前缀时 SHALL 301 重定向到该语言所属站点的同一路径。

#### Scenario: 在西方站访问韩语路径
- **WHEN** 访客请求西方站的 `/ko/manseryeok/`
- **THEN** 返回 301，跳转到东方站的 `/ko/manseryeok/`

#### Scenario: 简体前缀出现在西方站
- **WHEN** 访客在西方站打开 `/zh-hans/pricing`
- **THEN** 301 重定向到东方站的 `/zh-hans/pricing`

### Requirement: 东方站入口页
东方站根路径 `/` SHALL 显示列出其全部语言版本入口的轻量页面，MUST NOT 依据 Accept-Language 对爬虫自动跳转；对浏览器访客 SHALL 突出显示与其浏览器语言匹配的入口。

#### Scenario: 韩语浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `ko-KR` 的访客打开东方站 `/`
- **THEN** 页面显示繁中、简体与韩语三个入口，韩语入口被突出显示，且没有自动跳转

#### Scenario: 简体浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `zh-CN` 的访客打开东方站 `/`
- **THEN** 页面显示繁中、简体与韩语三个入口，简体入口被突出显示，且没有自动跳转
