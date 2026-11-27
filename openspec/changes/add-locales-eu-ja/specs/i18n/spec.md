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
（只用于客户端的语言建议提示，见「语言建议提示」；服务端不按浏览器语言选择或跳转）浏览器语言偏好匹配时，`ja`、`ja-JP` SHALL 匹配到 `ja`；`es` 及任何 `es-*` 地区标签 SHALL 匹配到 `es`；`pt-BR` 与只有主语言的 `pt` SHALL 匹配到 `pt-BR`，`pt-PT` 在没有 `pt-PT` 语言时 MUST NOT 匹配到 `pt-BR`；其余新语言按主语言匹配。匹配只用于客户端提示，MUST NOT 产生任何跳转。

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

### Requirement: 语言建议提示
（使用者 2026-11-20；多语言 SEO 规范 ML-02、ML-03；设计稿 docs/design/prototypes/warm-refresh/LocalePrompt*）
语言 SHALL 只由地址决定，MUST NOT 用 JS 或 Cookie 在同一地址切换语言。公开页面 SHALL 在客户端水合后、浏览器空闲时按 `navigator.languages` 给出语言建议提示：只建议当前页 hreflang 中列出的本站已发布语言（当前页没有该语言版本时不提示），用目标语言书写，「切换」是指向对应语言页面的真实 `<a href hreflang>`，点击后才导航。提示 MUST NOT 出现在服务端或预渲染 HTML 中，固定在视口底部、不占文档流（CLS 不增加）。关闭或切换后在 localStorage 按站点永久记住，MUST NOT 写 Cookie。浏览器语言为不带地区的 `zh` 时并列简体与繁体两个候选。

#### Scenario: 繁中浏览器打开东方站英文首页
- **WHEN** 浏览器语言为 `zh-TW` 的访客打开 `https://ganjiday.com/`
- **THEN** 服务端 HTML 中没有提示；水合后底部出现「本頁有繁體中文版，要切換嗎？」，「切換」链接到 `/zh-hant`

#### Scenario: 当前页没有浏览器语言的版本
- **WHEN** 浏览器语言为英语的访客打开 `/zh-hant/八字排盤`（没有英文版本）
- **THEN** 不出现提示

#### Scenario: 关闭后
- **WHEN** 访客在东方站关闭提示后打开东方站其他页面
- **THEN** 不再出现提示，浏览器中没有新增语言 Cookie

### Requirement: 账号语言的首页跳转（后续任务）
只对已登录、且在语言控件中主动切换过语言的用户，打开站点首页 `/` 时 MAY 跳到其选过的语言首页（多语言 SEO 规范 ML-09）；匿名访客、爬虫与内页 MUST NOT 跳转。现有账号语言字段在注册时也会写入，无法区分「主动切换」，本 change 不实现，记为后续任务。

#### Scenario: 匿名访客打开首页
- **WHEN** 未登录访客或爬虫打开任一站点的 `/`
- **THEN** 返回 200 英文首页，不按账号语言、Accept-Language 或 Cookie 跳转
