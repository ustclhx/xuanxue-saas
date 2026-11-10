# Spec Delta

## MODIFIED Requirements

### Requirement: 多语言关联
存在多语言版本的公开页面 SHALL 只在同一站点内声明全部语言版本之间的 hreflang 关联（使用绝对地址，包含页面自身），并包含 `x-default`；MUST NOT 声明另一站点的页面。`x-default` SHALL 指向同一页面在站点默认语言（东方站繁体中文、西方站英语）下的版本，该版本不存在时取站点语言顺序中第一个存在的版本；hreflang 与 `x-default` 的目标 MUST 是直接返回 200 且可索引的规范地址，MUST NOT 是会跳转的地址。站点地图中的语言关联 SHALL 与页面声明一致。

#### Scenario: 定价页的语言版本
- **WHEN** 搜索引擎抓取西方站英文定价页
- **THEN** 页面只声明西方站英文定价页自身与指向自身的 x-default，不出现东方站地址

#### Scenario: 繁中八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hant/八字排盤`
- **THEN** 页面声明东方站 `/ko` 对应页（hreflang=ko）的绝对地址，x-default 为该繁中页自身

#### Scenario: 东方站内页的 x-default
- **WHEN** 搜索引擎抓取东方站 `/ko/pricing`
- **THEN** 页面声明 `/zh-hant/pricing`、`/zh-hans/pricing`、`/ko/pricing` 三个语言版本，x-default 为 `https://ganjiday.com/zh-hant/pricing`，不是东方站根路径

#### Scenario: 东方站首页的 x-default
- **WHEN** 搜索引擎抓取东方站 `/ko`
- **THEN** x-default 为 `https://ganjiday.com/zh-hant`，东方站 `/en` 入口页的 x-default 同样为该地址

#### Scenario: 站点地图与页面一致
- **WHEN** 搜索引擎读取东方站 `/sitemap/zh-hant.xml`
- **THEN** 每个条目的 hreflang 与 x-default 与该页面 `<link rel="alternate">` 相同，没有条目的 x-default 指向东方站根路径

#### Scenario: 简体八字页的语言版本
- **WHEN** 搜索引擎抓取东方站 `/zh-hans/八字排盘`
- **THEN** 页面声明东方站繁中对应页（hreflang=zh-Hant）与 `/ko` 对应页（hreflang=ko）的绝对地址

## ADDED Requirements

### Requirement: 规范地址收敛
已登记站点的公开页面 SHALL 只有一个可索引地址：非根路径不带结尾斜杠，协议为 HTTPS。其他形式的请求 SHALL 以永久跳转（GET/HEAD 用 301，其他方法用 308）一次到达规范地址，保留路径与查询参数，MUST NOT 形成循环。未登记的预览 Host 与本地开发地址不做协议升级。

#### Scenario: 结尾斜杠
- **WHEN** 请求东方站 `https://ganjiday.com/zh-hant/?a=1`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant?a=1`

#### Scenario: HTTP 请求
- **WHEN** 请求 `http://arcanumber.com/login?redirect=/tarot`
- **THEN** 返回 301，Location 为 `https://arcanumber.com/login?redirect=/tarot`

#### Scenario: 东方站无前缀公开路径
- **WHEN** 请求东方站 `/pricing?ref=x`
- **THEN** 返回 301，Location 为 `https://ganjiday.com/zh-hant/pricing?ref=x`，不跳到首页

#### Scenario: 西方站默认语言前缀
- **WHEN** 请求西方站 `/en/pricing`
- **THEN** 返回 301，Location 为 `https://arcanumber.com/pricing`

#### Scenario: 规范地址直接返回
- **WHEN** 请求 `https://ganjiday.com/zh-hant` 或 `https://arcanumber.com/tarot`
- **THEN** 直接返回 200，无需登录

### Requirement: 认证页不进索引
登录、注册、找回密码、重置密码、邮箱验证与接受邀请页面（两站、全部语言、带任意查询参数）SHALL 同时以 `X-Robots-Tag` 响应头和 robots meta 声明 `noindex`，canonical SHALL 指向不带查询参数的同语言认证页；robots.txt MUST NOT 禁止抓取这些页面。公开页面的登录入口链接 MUST NOT 携带随页面变化的回跳参数，回跳地址在用户点击时才附加。

#### Scenario: 带回跳参数的登录页
- **WHEN** 搜索引擎抓取 `https://arcanumber.com/login?redirect=/life-path-number/22`
- **THEN** 返回 200，响应头含 `X-Robots-Tag: noindex, nofollow`，页面含 robots noindex 与 canonical `https://arcanumber.com/login`

#### Scenario: 东方站语言前缀的认证页
- **WHEN** 搜索引擎抓取 `https://ganjiday.com/ko/register`
- **THEN** 响应与页面声明 noindex，canonical 为 `https://ganjiday.com/ko/register`

#### Scenario: 公开页面的登录入口
- **WHEN** 匿名访客或爬虫渲染西方站 `/tarot`
- **THEN** 页头登录链接为不带查询参数的 `/login` 且带 `rel="nofollow"`；访客点击后进入 `/login?redirect=/tarot`，登录后回到 `/tarot`
