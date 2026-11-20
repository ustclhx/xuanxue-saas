## ADDED Requirements

### Requirement: 扩展语言集合
在 v1 语言之外，系统 SHALL 支持以下语言并按期发布：第一期 `ja`（东方站）与 `es`（西方站）；第二期 `pt-BR`、`fr`（西方站）；第三期 `de`、`it`（西方站）。每种语言的 URL 前缀 SHALL 为小写语言 id（`/ja`、`/es`、`/pt-br`）。语言菜单 SHALL 以各语言自己的写法显示语言名（日本語、Español、Português (Brasil)、Français、Deutsch、Italiano）。

#### Scenario: 访问日语首页
- **WHEN** `ja` 已发布，访客在东方站打开 `/ja`
- **THEN** 页面以日语显示，语言菜单中出现「日本語」

#### Scenario: 巴西葡萄牙语前缀
- **WHEN** `pt-BR` 已发布，访客在西方站打开 `/pt-br`
- **THEN** 页面以巴西葡萄牙语显示；`/pt-BR` 与 `/pt` 不是有效前缀，返回 404

### Requirement: 新语言的浏览器语言匹配
浏览器语言偏好匹配时，`ja`、`ja-JP` SHALL 匹配到 `ja`；`es` 及任何 `es-*` 地区标签 SHALL 匹配到 `es`；`pt-BR` 与只有主语言的 `pt` SHALL 匹配到 `pt-BR`，`pt-PT` 在没有 `pt-PT` 语言时 MUST NOT 匹配到 `pt-BR`；其余新语言按主语言匹配。匹配只用于建议与认证页，MUST NOT 让爬虫被自动跳转。

#### Scenario: 墨西哥西班牙语浏览器
- **WHEN** 浏览器语言为 `es-MX` 的访客首次打开西方站首页
- **THEN** 系统建议切换到 `es`，不自动跳转

#### Scenario: 葡萄牙的浏览器
- **WHEN** 浏览器语言为 `pt-PT` 的访客首次打开西方站首页
- **THEN** 系统不建议切换到 `pt-BR`

### Requirement: 新语言公开页面文案完整
对标记为严格的语言（全部新语言），公开页面、认证、账户、计费与邮件所用的文案在该语言中缺失时，构建 SHALL 失败并列出缺失项，MUST NOT 以默认语言回退显示；后台文案缺失时仍允许回退到英语。

#### Scenario: 日语缺一条工具页文案
- **WHEN** `messages/ja/bazi.json` 缺少英文中存在的一条键
- **THEN** 构建失败并指出该语言、文件与键名
