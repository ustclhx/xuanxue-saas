# multi-site Specification

## Purpose
让同一套应用以「东方站」与「西方站」两个主域名对外服务，每个站点拥有自己的语言集合、品牌与入口页，访客总是落在其语言所属的站点上。

## Requirements

### Requirement: 按域名识别站点
系统 SHALL 根据请求的 Host 识别当前站点（东方站或西方站）；未配置的 Host（如 `*.workers.dev` 预览地址）SHALL 以西方站品牌服务全部语言（不做跨站跳转，便于 staging 验收东方站页面），并对全部页面输出 noindex。

#### Scenario: 访问东方站
- **WHEN** 访客请求东方站域名的 `/zh-hant/`
- **THEN** 页面以东方站品牌与繁体中文显示

#### Scenario: 预览地址
- **WHEN** 访客请求 staging 的 `*.workers.dev` 地址
- **THEN** 页面按西方站渲染，且带 `noindex`

#### Scenario: 预览地址访问韩语页
- **WHEN** 访客请求 staging 预览地址的 `/ko/`
- **THEN** 直接返回韩语页面，不跳转到东方站域名，且带 `noindex`

### Requirement: 语言归属站点
每种语言 SHALL 只属于一个站点：v1 中 `zh-Hant`、`zh-Hans`、`ko` 属于东方站，`en` 属于西方站；访问不属于当前站点的语言前缀时 SHALL 301 重定向到该语言所属站点的同一路径。

#### Scenario: 在西方站访问韩语路径
- **WHEN** 访客请求西方站的 `/ko/manseryeok/`
- **THEN** 返回 301，跳转到东方站的 `/ko/manseryeok/`

#### Scenario: 简体前缀出现在西方站
- **WHEN** 访客在西方站打开 `/zh-hans/pricing`
- **THEN** 301 重定向到东方站的 `/zh-hans/pricing`

### Requirement: 东方站入口页
东方站根路径 `/` SHALL 跳转到某个东方站语言的首页，不再展示单独的语言选择页。东方站内的手动选择或浏览器语言指向繁体中文以外的东方站语言时 SHALL 302 到该语言首页；其余情况（含不带 Accept-Language 的爬虫）SHALL 301 到繁体中文首页 `/zh-hant`。跳转目标 MUST 是不带结尾斜杠的规范地址，保留查询参数，响应 MUST NOT 被缓存为跨访客共享的结果。

#### Scenario: 韩语浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `ko-KR` 且没有手动选择的访客打开东方站 `/`
- **THEN** 返回 302，跳转到 `/ko`

#### Scenario: 爬虫访问东方站根路径
- **WHEN** 不带 Accept-Language 与 Cookie 的请求访问 `https://ganjiday.com/`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant`，该地址直接返回 200

#### Scenario: 简体浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `zh-CN` 且没有手动选择的访客打开东方站 `/`
- **THEN** 返回 302，跳转到 `/zh-hans`

### Requirement: 账号与付费跨站可用
登录、账户、积分购买与应用区 SHALL 在两个站点上各自可用，并以访客当前站点的语言显示；完成登录或支付后 SHALL 回到发起操作的站点与页面。两个站点的账户、积分余额、购买、付款、退款申请与报告 MUST 彼此独立：在一个站点的操作与记录 MUST NOT 出现在另一个站点，一个站点签发的会话 MUST NOT 能在另一个站点使用。

#### Scenario: 韩国用户付费后回跳
- **WHEN** 在东方站 `/ko/` 结果页发起购买并完成支付
- **THEN** 浏览器回到东方站发起购买的结果页，界面为韩语

#### Scenario: 两站余额互不可见
- **WHEN** 用户在东方站购买 100 积分，再用同一邮箱登录西方站
- **THEN** 西方站显示的余额、付款与退款申请列表不包含东方站的这笔购买

#### Scenario: 会话不能跨站使用
- **WHEN** 把东方站登录得到的会话凭据用于西方站的请求
- **THEN** 西方站视该请求为未登录
