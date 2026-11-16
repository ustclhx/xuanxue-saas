# Tasks

## 1. 规范地址与跳转

- [x] 1.1 `features/site/gate.ts` 增加地址规范化（已登记域名 HTTP→HTTPS、GET/HEAD 去结尾斜杠，排除 `/api/` 与 `_` 内部路径），与站点判定合并为一次跳转；GET/HEAD 用 301、其他方法 308；预渲染请求可关闭。验证：`site.test.ts` 覆盖斜杠、HTTP、POST 308、预览与本地 Host 不升级、跳转合并为一跳。
- [x] 1.2 东方站无前缀公开路径（含裸法律页）301 到 `/zh-hant` 同一路径并保留查询；西方站 `/en/...` 改为 301。验证：`site.test.ts` 中 `/pricing`、`/blog/x?a=1`、`/privacy`、`/en/pricing` 的期望。
- [x] 1.3 `features/i18n/east-home.ts` 根路径：繁体中文 301、其他东方站语言 302，绝对地址、无结尾斜杠、`Vary` 与 `Cache-Control: private, no-store`；移入站点守卫，`server.ts` 不再单独调用。验证：`east-home.test.ts` 与 `site.test.ts` 的 gateSiteRequest 用例（含 `http://ganjiday.com/` 一跳到 `https://ganjiday.com/zh-hant`）。

## 2. hreflang 与站点地图

- [x] 2.1 `features/seo/metadata.ts` 的 x-default 改为同页默认语言版本（缺失时按站点语言顺序取第一个），东方站 `/en` 入口页同步。验证：`seo.test.tsx` 中东方站内页、首页与 `/en` 的 x-default，以及全部公开页的页面 alternate 与站点地图条目逐一一致、目标不是根路径、自身包含在内且互指。
- [x] 2.2 更新 `features/seo/README.md` 中 x-default 与东方站根路径的描述。验证：文档与 2.1、1.3 行为一致。

## 3. 认证页与登录入口

- [x] 3.1 认证路由 head 输出 robots `noindex, nofollow` 与不带查询参数的同语言 canonical；Worker 入口为认证页响应设置 `X-Robots-Tag: noindex, nofollow`。验证：单元测试覆盖两站各语言的 canonical、`?redirect=` 变体与响应头判定；robots.txt 不含认证页。
- [x] 3.2 页头登录入口 `href` 固定为不带参数的登录页并加 `rel="nofollow"`，点击时附加当前页面为回跳地址。验证：组件渲染测试断言链接无查询参数与 nofollow，回跳地址拼接函数有单测。

## 4. 回归与集成

- [x] 4.1 更新受影响的 e2e（`dual-site-seo`、`i18n-routing`、`production/smoke`）的跳转期望，并补充：东方站根路径 301、结尾斜杠 301、登录页 noindex 与 canonical、匿名访问公开内容 200。验证：`pnpm exec playwright test --list` 能解析，能运行的用例本地通过或在 PR 中说明未运行原因。
- [x] 4.2 全量检查：`pnpm exec biome check` 改动文件、`pnpm typecheck`、web 相关 vitest、`pnpm --filter @xuanxue/web build`（含预渲染）通过；构建产物中东方站页面的 x-default 不再指向根路径。
