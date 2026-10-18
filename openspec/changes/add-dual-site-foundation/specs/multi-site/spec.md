# Spec Delta

## Purpose

让同一套应用以「东方站」与「西方站」两个主域名对外服务，每个站点拥有自己的语言集合、品牌与入口页，访客总是落在其语言所属的站点上。

## ADDED Requirements

### Requirement: 按域名识别站点
系统 SHALL 根据请求的 Host 识别当前站点（东方站或西方站）；未配置的 Host（如 `*.workers.dev` 预览地址）SHALL 视为西方站并对全部页面输出 noindex。

#### Scenario: 访问东方站
- **WHEN** 访客请求东方站域名的 `/zh-hant/`
- **THEN** 页面以东方站品牌与繁体中文显示

#### Scenario: 预览地址
- **WHEN** 访客请求 staging 的 `*.workers.dev` 地址
- **THEN** 页面按西方站渲染，且带 `noindex`

### Requirement: 语言归属站点
每种语言 SHALL 只属于一个站点：v1 中 `zh-Hant`、`ko` 属于东方站，`en` 属于西方站；访问不属于当前站点的语言前缀时 SHALL 301 重定向到该语言所属站点的同一路径。

#### Scenario: 在西方站访问韩语路径
- **WHEN** 访客请求西方站的 `/ko/manseryeok/`
- **THEN** 返回 301，跳转到东方站的 `/ko/manseryeok/`

### Requirement: 东方站入口页
东方站根路径 `/` SHALL 显示列出其全部语言版本入口的轻量页面，MUST NOT 依据 Accept-Language 对爬虫自动跳转；对浏览器访客 SHALL 突出显示与其浏览器语言匹配的入口。

#### Scenario: 韩语浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `ko-KR` 的访客打开东方站 `/`
- **THEN** 页面显示繁中与韩语两个入口，韩语入口被突出显示，且没有自动跳转

### Requirement: 账号与付费跨站可用
登录、账户、积分购买与应用区 SHALL 在两个站点上都可用，并以访客当前站点的语言显示；完成登录或支付后 SHALL 回到发起操作的站点与页面。

#### Scenario: 韩国用户付费后回跳
- **WHEN** 在东方站 `/ko/` 结果页发起购买并完成支付
- **THEN** 浏览器回到东方站发起购买的结果页，界面为韩语
