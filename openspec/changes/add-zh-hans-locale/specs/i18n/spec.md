# Spec Delta

## MODIFIED Requirements

### Requirement: 语言路由
每种已配置语言 SHALL 归属于一个站点；站点的默认语言使用无前缀地址，其他语言使用小写语言前缀地址（如 `/zh-hant/`、`/zh-hans/`、`/ko/`）；东方站没有无前缀的默认语言。未配置的语言前缀 MUST 返回 404；属于其他站点的语言前缀 SHALL 301 到所属站点。`/zh/` 不是有效前缀，MUST 返回 404。

#### Scenario: 访问中文定价页
- **WHEN** 访客在东方站打开 `/zh-hant/pricing`
- **THEN** 页面以繁体中文显示

#### Scenario: 访问繁中排盘页
- **WHEN** 访客在东方站打开 `/zh-hant/八字排盤/`
- **THEN** 页面以繁体中文显示

#### Scenario: 访问简体排盘页
- **WHEN** 访客在东方站打开 `/zh-hans/八字排盘/`
- **THEN** 页面以简体中文显示

#### Scenario: 未配置的语言
- **WHEN** 访客打开 `/fr/`，而 `fr` 未配置
- **THEN** 返回 404

#### Scenario: 已移除的简体前缀
- **WHEN** 访客打开 `/zh/pricing`
- **THEN** 返回 404

### Requirement: v1 语言集合
v1 SHALL 提供 `en`（西方站默认）、`zh-Hant`、`zh-Hans`、`ko` 四种语言的全部用户可见文案（营销、工具、认证、账户、计费、邮件、错误提示）；后台文案缺失时允许回退到英语。`zh-Hans` 的文案 SHALL 由繁体文案转换并经运营方抽检后上线。

#### Scenario: 韩语用户收到验证邮件
- **WHEN** 语言设置为 `ko` 的用户请求邮箱验证码
- **THEN** 收到韩语邮件

#### Scenario: 简体用户收到重置密码邮件
- **WHEN** 语言设置为 `zh-Hans` 的用户请求重置密码
- **THEN** 收到简体中文的重置密码邮件

## ADDED Requirements

### Requirement: 简体与繁体的偏好归属
浏览器语言偏好匹配时，简体中文标签（如 `zh-CN`、`zh-SG`）SHALL 匹配到 `zh-Hans`；繁体中文标签（如 `zh-TW`、`zh-HK`、`zh-MO`）SHALL 匹配到 `zh-Hant`；只有主语言 `zh` 而没有地区标签时 SHALL 匹配到 `zh-Hant`，与变更前的行为保持一致。

#### Scenario: 简体浏览器首次访问东方站
- **WHEN** 浏览器的 Accept-Language 为 `zh-CN,zh;q=0.9` 的访客首次访问东方站无前缀入口
- **THEN** 系统建议切换到 `zh-Hans`，不自动跳转

#### Scenario: 繁体浏览器首次访问东方站
- **WHEN** 浏览器的 Accept-Language 为 `zh-TW` 的访客首次访问东方站无前缀入口
- **THEN** 系统建议切换到 `zh-Hant`
