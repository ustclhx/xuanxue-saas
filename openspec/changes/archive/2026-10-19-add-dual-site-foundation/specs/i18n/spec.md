# Spec Delta

## MODIFIED Requirements

### Requirement: 语言路由
每种已配置语言 SHALL 归属于一个站点；站点的默认语言使用无前缀地址，其他语言使用小写语言前缀地址（如 `/zh-hant/`、`/ko/`）；东方站没有无前缀的默认语言。未配置的语言前缀 MUST 返回 404；属于其他站点的语言前缀 SHALL 301 到所属站点。

#### Scenario: 访问中文定价页
- **WHEN** 访客在东方站打开 `/zh-hant/pricing`
- **THEN** 页面以繁体中文显示

#### Scenario: 访问繁中排盘页
- **WHEN** 访客在东方站打开 `/zh-hant/八字排盤/`
- **THEN** 页面以繁体中文显示

#### Scenario: 未配置的语言
- **WHEN** 访客打开 `/fr/`，而 `fr` 未配置
- **THEN** 返回 404

#### Scenario: 已移除的简体前缀
- **WHEN** 访客打开 `/zh/pricing`
- **THEN** 返回 404

## ADDED Requirements

### Requirement: v1 语言集合
v1 SHALL 提供 `en`（西方站默认）、`zh-Hant`、`ko` 三种语言的全部用户可见文案（营销、工具、认证、账户、计费、邮件、错误提示）；后台文案缺失时允许回退到英语。

#### Scenario: 韩语用户收到验证邮件
- **WHEN** 语言设置为 `ko` 的用户请求邮箱验证码
- **THEN** 收到韩语邮件
