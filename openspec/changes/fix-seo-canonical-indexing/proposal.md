# Proposal

## Why

Google Search Console 报告两站各有一类索引问题（2026-11-05 抓取，2026-11-10 用 curl 复核线上响应）：

- 东方站 `https://ganjiday.com/zh-hant` 被判为「重复网页，Google 选择的规范网页与用户指定的不同」，Google 选择了 `https://ganjiday.com/`。线上 `/` 302 到 `/zh-hant/`（带斜杠），`/zh-hant` 与 `/zh-hant/` 都返回 200，canonical 指向无斜杠版本；东方站全部页面（含站点地图 `zh-hant.xml` 的 100 个条目）的 `x-default` 都指向会跳转的根路径 `/`；裸路径 `/pricing` 302 到首页而不是对应语言页；HTTP 请求直接返回 200，没有升级到 HTTPS。
- 西方站 `arcanumber.com/login?redirect=<公开页路径>` 一类地址出现在「重复网页，用户未选定规范网页」（11 个）与「软 404」（5 个）中。登录页可被抓取，既没有 canonical 也没有 noindex；公共页头的登录入口在水合后被改写成 `/login?redirect=<当前页面>`，每个公开页面都会产生一个新的登录地址变体。

规范地址信号互相矛盾（跳转目标、canonical、hreflang 与站点地图各指一处），同时登录页变体持续扩张抓取面，需要一次收敛。

## What Changes

- 东方站首页的唯一规范地址定为 `https://ganjiday.com/zh-hant`（无斜杠，与现有 canonical、站内链接和站点地图一致）。
- 根路径 `/`：没有指向其他东方站语言的偏好（爬虫、繁体或其他语言浏览器）时 301 到 `/zh-hant`；手动选择或浏览器语言指向简体或韩语时保持 302 到对应语言首页。跳转目标不再带结尾斜杠。
- 公开地址统一收敛：非根路径的结尾斜杠 301 到无斜杠地址；已登记站点域名的 HTTP 请求 301（非 GET/HEAD 为 308）到 HTTPS；收敛与站点跳转合并为一次跳转，保留路径与查询参数。
- 东方站的无前缀公开路径（如 `/pricing`、`/privacy`）301 到繁体中文的同一路径，不再跳到首页。西方站带默认语言前缀的地址（`/en/...`）由 307 改为 301。
- hreflang：`x-default` 指向同一页面在站点默认语言（东方站繁体中文、西方站英语）下的版本，该版本不存在时按站点语言顺序取第一个存在的版本；不再统一指向东方站根路径。页面 `<link rel=alternate>` 与站点地图使用同一规则。
- 认证页（登录、注册、找回密码、重置密码、邮箱验证、接受邀请，两站全部语言，含 `?redirect=` 等查询参数变体）输出 `X-Robots-Tag: noindex, nofollow` 与 `<meta name="robots" content="noindex, nofollow">`，canonical 指向不带查询参数的同语言认证页地址；robots.txt 不禁止抓取认证页。
- 公共页头的登录入口 `href` 固定为不带参数的登录页并加 `rel="nofollow"`，点击时才附上当前页面作为回跳地址，登录后的去向不变。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `seo`：修改「多语言关联」的 x-default 规则；新增「规范地址收敛」与「认证页不进索引」两项要求。
- `multi-site`：修改「东方站入口页」，根路径改为按偏好跳转到语言首页，无偏好时永久跳转到繁体中文首页。

## Impact

- 代码：`apps/web/src/features/site/gate.ts`（收敛与站点跳转）、`features/i18n/east-home.ts`（根路径）、`src/server.ts`（入口调用顺序与认证页响应头）、`features/seo/metadata.ts`（x-default、认证页 head）、`features/marketing/east-english/head.ts`（东方站 `/en` 的 x-default）、`features/site/account-menu.tsx`（页头登录入口）、`routes/(auth)/*.tsx`（head）。
- 测试：对应单元测试与受影响的 e2e（`dual-site-seo`、`i18n-routing`、`production/smoke`）。
- 外部：部署后需要 Google 重新抓取才能确认 GSC 状态变化；Cloudflare 区域的「Always Use HTTPS」是否开启不在本次代码范围内，应用内已处理已登记域名的 HTTP 请求。
- 无数据库、依赖或接口契约变更。
