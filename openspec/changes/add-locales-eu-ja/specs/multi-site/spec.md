## MODIFIED Requirements

### Requirement: 语言归属站点
每个站点 SHALL 独立维护自己提供的语言：东方站提供 `zh-Hant`、`zh-Hans`、`ko`、`ja` 与根路径英文 `en`；西方站提供 `en`、`es`，后续的 `pt-BR`、`fr`、`de`、`it` 也属于西方站。访问当前站点未提供的语言前缀或路径时 SHALL 返回本站风格的 404，MUST NOT 跨站重定向。尚未发布的语言在正式域名上按「语言发布状态」返回 404。未配置的 Host（预览地址）不受此限制。

#### Scenario: 在西方站访问韩语路径
- **WHEN** 访客请求西方站的 `/ko/manseryeok/`
- **THEN** 返回西方站风格的 404，不跳转到东方站

#### Scenario: 简体前缀出现在西方站
- **WHEN** 访客在西方站打开 `/zh-hans/pricing`
- **THEN** 返回 404，不跳转到东方站

#### Scenario: 东方站的英文路径
- **WHEN** 访客在东方站打开 `/en/pricing`
- **THEN** 301 到东方站不带前缀的英文地址 `/pricing`，不跳转到西方站

#### Scenario: 日语前缀出现在西方站
- **WHEN** 访客在西方站打开 `/ja/pricing`
- **THEN** 返回西方站风格的 404，不跳转到东方站

#### Scenario: 西班牙语前缀出现在东方站
- **WHEN** 访客在东方站打开 `/es/tarot`
- **THEN** 返回东方站风格的 404，不跳转到西方站

### Requirement: 东方站入口页
（使用者 2026-11-20 重定网址规则，取代此前「根路径按浏览器语言跳转」；多语言 SEO 规范 ML-01、ML-02）
两站的根路径 `/` SHALL 都是英文首页、直接返回 200，MUST NOT 按 Accept-Language、Cookie 或 IP 跳转。其他语言各占小写语言前缀（`/zh-hant`、`/zh-hans`、`/ko`、`/ja`），地址不变、不合并。东方站完整英文页面上线前，`/` 显示原英文入口页的内容；旧地址 `/en` SHALL 301 到 `/`（保留查询参数），东方站其他 `/en/*` SHALL 301 到去掉前缀的同一路径。东方站英文页面放在根路径下（`/four-pillars…` 等，按关键词地图定），MUST NOT 放在 `/en/…` 下。

#### Scenario: 韩语浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `ko-KR` 的访客打开东方站 `/`
- **THEN** 返回 200 英文首页，不跳转；页面在客户端提示有韩语版本，访客点击后才进入 `/ko`

#### Scenario: 简体浏览器访问东方站根路径
- **WHEN** 浏览器语言为 `zh-CN` 的访客打开东方站 `/`
- **THEN** 返回 200 英文首页，不跳转；页面在客户端提示有简体中文版本，访客点击后才进入 `/zh-hans`

#### Scenario: 爬虫访问东方站根路径
- **WHEN** 不带 Accept-Language 与 Cookie 的请求访问 `https://ganjiday.com/`
- **THEN** 返回 200，canonical 为 `https://ganjiday.com/`，响应与带任何 Accept-Language 时相同

#### Scenario: 旧英文入口页地址
- **WHEN** 访客打开 `https://ganjiday.com/en?utm_source=x`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/?utm_source=x`

#### Scenario: 无前缀认证页
- **WHEN** 访客打开东方站 `/login`（东方站英文认证页上线前）
- **THEN** 固定 302 到 `/zh-hant/login`，与浏览器语言和 Cookie 无关

## REMOVED Requirements

### Requirement: 东方站英文入口页
**Reason**: 东方站英文改为根路径下的完整英文页面（`/` 为英文首页），`/en` 301 到 `/`，见「东方站入口页」（使用者 2026-11-20 重定网址规则）。
**Migration**: 旧 `/en` 链接经 301 到 `/`；东方站英文页面使用根路径地址。
