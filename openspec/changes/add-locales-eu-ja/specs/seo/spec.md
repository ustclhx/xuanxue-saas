## MODIFIED Requirements

### Requirement: 站点地图与抓取规则
每个站点 SHALL 提供只包含本站点公开、已发布页面的站点地图索引（按已发布语言拆分子站点地图）与 robots 规则；应用区（`/app`）、后台（`/admin`）、接口路径与分享结果链接 MUST 被禁止抓取或带 noindex。未发布语言 MUST NOT 有子站点地图。

#### Scenario: 站点地图内容
- **WHEN** 搜索引擎读取西方站站点地图
- **THEN** 其中包含首页、定价、已发布博客文章、工具页与法律页的英语地址，不包含 `/app` 与 `/admin`

#### Scenario: 东方站的站点地图
- **WHEN** 搜索引擎读取东方站 `/sitemap.xml`，此时 `ja` 已发布
- **THEN** 其中只列出 `zh-hant`、`zh-hans`、`ko` 与 `ja` 的子站点地图，不含西方站页面与 `/app`、`/admin`

#### Scenario: 西方站新增语言后的站点地图
- **WHEN** `es` 已发布、`fr` 尚未发布，搜索引擎读取西方站 `/sitemap.xml`
- **THEN** 其中列出 `en` 与 `es` 的子站点地图，不出现 `fr`

#### Scenario: 简体内容回退到英文原文的页面
- **WHEN** 搜索引擎抓取东方站 `/zh-hans/` 下尚未有简体版本的法律页
- **THEN** 页面显示英文原文并附简体提示「仅提供英文版本」，声明 `noindex`，且不列入简体站点地图

## ADDED Requirements

### Requirement: 新语言不改变既有页面的规范信号
新增语言 MUST NOT 改变既有语言页面的 URL、canonical、Title、Description 与 robots；既有页面的 hreflang 与站点地图 SHALL 只增加指向新语言对应页的条目，且只在新语言已发布且该页存在对应版本时增加。

#### Scenario: 西班牙语发布前后的英文牌义页
- **WHEN** 对比 `es` 发布前后的 `/tarot/cards/the-sun`
- **THEN** canonical、Title、Description 不变，hreflang 只多出 `es` 一条，x-default 仍指向英文页

#### Scenario: 日语没有对应页的繁中工具页
- **WHEN** `ja` 已发布但没有「命盤查詢」对应页
- **THEN** `/zh-hant/命盤查詢` 的 hreflang 不出现 `ja`

### Requirement: hreflang 与 x-default（多语言 SEO 规范 ML-04、ML-05）
每个可索引页面的 canonical SHALL 指向自身绝对地址。hreflang SHALL 只列该页实际存在的同站语言版本（含自身），双向互指、不跨域名，并且只有一条 x-default：页面有英文版本时 x-default 指向英文版本（东方站首页组为 `https://ganjiday.com/`），没有英文版本的东方站页面 x-default 暂指繁体中文同页。未翻译的页面默认不发布：在该语言前缀下返回 404、不进站点地图、不被链接。

#### Scenario: 东方站繁中首页
- **WHEN** 搜索引擎抓取 `https://ganjiday.com/zh-hant`
- **THEN** hreflang 为 `en → https://ganjiday.com/`、`zh-Hant`、`zh-Hans`、`ko` 各自首页与 `x-default → https://ganjiday.com/`，canonical 为自身

### Requirement: 多语言 SEO 验收检查
构建后 SHALL 运行自动检查（`check:i18n-seo`，CI 的 build job）：不同 Accept-Language 访问 `/` 与各语言首页的响应相同且没有 Location；每个可索引页面 canonical 指向自身、hreflang 集合等于存在的语言版本、恰好一条 x-default、双向互指、不跨域名；`<html lang>` 等于页面语言；公开页面没有语言相关的 Set-Cookie、没有 `?lang=` 链接、服务端 HTML 中没有语言提示；站点地图 URL 集合等于可索引页面集合。任一项不满足时检查失败。

#### Scenario: 引入按语言跳转
- **WHEN** 有改动让东方站 `/` 按 Accept-Language 返回 302
- **THEN** `check:i18n-seo` 报告 ML-02 违规并以非零状态退出
