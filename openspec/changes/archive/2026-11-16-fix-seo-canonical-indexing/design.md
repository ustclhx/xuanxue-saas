# Design

## Context

动机见 proposal.md。2026-11-10 的线上只读响应（证据存于被忽略的 `test-results/evidence/seo-before-*`）与源码对照如下：

| 现象 | 生成位置 | 判定 |
|---|---|---|
| `/` 302 → `/zh-hant/`（相对地址、带斜杠，`Vary: accept-language, cookie`） | `features/i18n/east-home.ts` | 已确认 |
| `/zh-hant` 与 `/zh-hant/` 都 200 | 生产 HTML 由 `features/site/static-pages.ts` 去掉结尾斜杠后读取同一个预渲染文件；`wrangler.jsonc` 的 `html_handling: none` | 已确认 |
| SSR 页面 `/pricing/` 307 → `/pricing` | TanStack Router 自身的结尾斜杠处理（临时跳转） | 已确认 |
| 东方站全部 hreflang 的 x-default = `https://ganjiday.com/` | `features/seo/metadata.ts` 的 `alternateLinks`：站点无默认语言时固定用根路径；站点地图 `crawlers.ts` 复用同一函数 | 已确认（zh-hant 子图 100/100 条） |
| 东方站 `/en` 的 x-default 同为根路径 | `features/marketing/east-english/head.ts` | 已确认 |
| 东方站 `/pricing`、`/blog` 302 → `https://ganjiday.com/` | `features/site/gate.ts` 的 `routeSite` 末尾分支 | 已确认 |
| `http://` 请求直接 200 | Cloudflare 区域未开启 Always Use HTTPS；Worker 未处理 | 已确认（应用内可处理） |
| 认证页无 canonical、无 robots | `routes/(auth)/*.tsx` 的 head 只有 title；入口没有响应头 | 已确认 |
| 每个公开页都有一个 `/login?redirect=<该页路径>` | `features/site/account-menu.tsx` 在 useEffect 中把页头登录链接改写为带当前路径的地址；SSR HTML 为 `/login`，Googlebot 渲染 JS 后看到改写后的链接 | 已确认来源；GSC 样本路径（`/tarot`、`/blog/`、`/life-path-number/22`、`/tarot/cards/ace-of-wands`）与公开页一一对应 |

假设（未证实，需重新抓取后观察）：Google 把 `/` 选为 `/zh-hant` 的规范网页，与 302（临时跳转倾向保留源地址）、全站 x-default 指向 `/`、跳转目标 `/zh-hant/` 与 canonical `/zh-hant` 不一致这几项信号叠加有关。hreflang 不是规范化信号，不能断言它是直接原因。

## Goals / Non-Goals

**Goals:**
- 每个公开页面只有一个可索引地址，跳转、canonical、站内链接、hreflang 与站点地图指向同一处。
- 登录类页面全部 noindex，不再因公开页面数量增加而产生新的登录地址。

**Non-Goals:**
- 不调整 robots.txt 的禁止规则，不对正常公开内容批量 noindex。
- 不修改 Cloudflare 区域设置（Always Use HTTPS、页面规则）；仅在 PR 中给出建议。
- 不处理西方站访问东方站语言前缀返回 404 这一与 multi-site 主规格不一致的既有行为。
- 不在 Worker 中判断无前缀路径对应的页面是否存在（见决策 4）。

## Decisions

### 1. 规范地址形式：无结尾斜杠

站内链接（`localizeHref`）、canonical、站点地图与 hreflang 已经全部使用无斜杠地址（`/zh-hant`、`/zh-hant/pricing`），唯一的带斜杠来源是根路径跳转。因此选无斜杠为规范形式，只需改跳转，不改动已被索引页面的 canonical。
备选：改为带斜杠目录形式。拒绝：要同时改 canonical、站点地图与全部站内链接，并让已索引的 112 个西方站页面换地址。

### 2. 收敛在站点守卫里一次完成

`gateSiteRequest` 先把请求地址规范化（已登记域名的 `http:` → `https:`；GET/HEAD 的非根路径去掉结尾斜杠，`/api/` 与 `_` 开头的内部路径除外），再用规范化后的地址做站点判定；东方站根路径的语言跳转也移入守卫。这样 `http://ganjiday.com/pricing/` 一次 301 到 `https://ganjiday.com/zh-hant/pricing`，不产生跳转链。
- 只有站点判定不跳转、而地址被规范化时才返回规范化跳转：GET/HEAD 用 301，其他方法用 308（保留方法与请求体）。
- 协议升级只认 `template.config.ts` 中登记的域名，`*.localhost`、`*.workers.dev` 与构建期预渲染请求（入口传 `canonicalize: false`）不受影响。
- 认证回调等接口在 `/api/` 下，不做结尾斜杠处理，避免改变第三方回调。

### 3. 东方站根路径：无其他偏好时 301，否则 302

`eastLocale()` 结果为东方站第一个语言（繁体中文）时返回 301 到 `/zh-hant`；手动选择或浏览器语言指向简体或韩语时返回 302。两者都带 `Vary: accept-language, cookie` 与 `Cache-Control: private, no-store`，避免浏览器或中间缓存把一个访客的跳转复用给另一个访客。Googlebot 抓取通常不带 Accept-Language 与 Cookie，因此始终看到同一个永久跳转，`/` 的信号合并到 `/zh-hant`。
备选 A：保留 302 并把 `/` 作为首页 x-default。拒绝：这正是现状，`/` 已被 Google 选为规范网页。
备选 B：`/` 无条件 301 到 `/zh-hant`。拒绝：会去掉已上线的「韩语浏览器直接进入韩语首页」行为（e2e `dual-site-seo.spec.ts` 覆盖）。
备选 C：`/` 直接输出繁体首页内容。拒绝：东方站没有无前缀默认语言，与现有路由与预渲染架构冲突。

### 4. 东方站无前缀路径：301 到繁体中文同一路径

`routeSite` 对东方站无前缀的公开路径（含原来单独处理的裸法律页）统一 301 到 `/zh-hant` + 原路径 + 查询参数。繁体中文是东方站默认导航语言；无前缀地址不是站内链接产生的，用永久跳转合并外部链接与手输地址最直接。目标页不存在时由路由器返回 404，不再跳首页（跳首页会被视为软 404）。
备选：在 Worker 中按路由表判断页面是否存在，不存在时直接 404。拒绝：需要在守卫中复制路由与内容集合，收益只是少一次跳转。

### 5. x-default 规则

`alternateLinks` 的 x-default 改为：站点默认语言（东方站取站点第一个语言 zh-Hant，西方站 en）在该页面语言集合中的版本；不存在时按站点语言顺序取第一个存在的版本。页面 head 与站点地图共用该函数，规则自然一致。东方站 `/en` 入口页的 x-default 同样改为 `/zh-hant`。
西方站只有英语，结果与现状相同。

### 6. 认证页 noindex 与 canonical

- 响应头：Worker 入口对认证页（去掉语言前缀后匹配 `AUTH_PAGE_PATHS`）的所有响应设置 `X-Robots-Tag: noindex, nofollow`，与分享结果链接相同的写法；不依赖页面 head 是否执行。
- 页面：认证路由的 head 输出 robots meta 与 canonical（当前语言、不带查询参数的绝对地址，`localeOrigin` + `localizedPath`）。`?redirect=` 变体与无参数页面声明同一 canonical，二者都 noindex，信号一致。
- robots.txt 保持不禁止认证页，Google 才能读到 noindex。

### 7. 页头登录入口

`AccountMenu` 的链接 `href` 固定为当前语言的 `/login`，加 `rel="nofollow"`；点击（无修饰键的左键）时阻止默认跳转，改为 `window.location.assign('/login?redirect=<当前路径与查询>')`。登录后回到发起页面的行为保持不变；用修饰键或新标签打开时进入无参数登录页，登录后回到语言首页。
备选：只给现有链接加 nofollow。拒绝：nofollow 只是提示，渲染出的地址仍随页面变化。

## Risks / Trade-offs

- [301 被浏览器缓存后，访客偏好变化仍走旧跳转] → 跳转带 `Cache-Control: private, no-store` 与 `Vary`。
- [`/en/...` 由 307 改为 301 后不可撤回] → 该前缀在西方站从来不是规范地址，永久跳转符合语义。
- [Google 未必立即改选规范网页] → 部署后在 GSC 用网址检查重新抓取 `/zh-hant` 与 `/`，观察数周；PR 中不承诺时限。
- [与进行中的 change 的 seo 增量冲突] → `add-zh-hans-locale`、`product-improve-ai-content-20261030` 也修改了「多语言关联」。本 change 的文本以当前实现（同站互指、D5）为基础，归档时由协调者合并，以最后归档的文本为准。
- [生产环境是否能在 Worker 中看到 `http:` 协议] → 安全头已依赖 `request.url` 的协议判断 HSTS；部署后用 curl 复核，若 Cloudflare 已在边缘升级则该分支不会触发，无副作用。

## Migration Plan

部署 web 即生效，无数据迁移。回滚为重新部署上一版本；已发出的 301 会被搜索引擎记住，但目标地址在旧版本中仍返回 200，不会产生死链。部署后的人工复核步骤列在 PR 描述中。
