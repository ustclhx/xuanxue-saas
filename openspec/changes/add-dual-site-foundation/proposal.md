# Proposal

## Why

设计交接文档（`doc/design.md` §0、§1 P0、TASK-01）要求两个主域名（东方站、西方站）+ 语言子目录 + 全量 hreflang，后续所有工具页都依赖这套骨架。模板目前只有单域名与 `en`/`zh` 两种语言，且没有「首屏零等待、不注册即出结果」的工具页契约。台湾（八字）与韩国（만세력）的季节峰从 11 月中开始爬升，骨架必须本周就位。

## What Changes

- 新增站点注册表：东方站（`zh-Hant`、`ko`，后续 `ja`）与西方站（`en` 为默认无前缀，后续 `fr`/`de`/`nl`/`it`），同一个 Worker 按请求 Host 识别站点；域名在 `template.config.ts` 中配置，v1 用占位域名。
- 语言集合由 `en`/`zh` 改为 `en`/`zh-Hant`/`ko`（**BREAKING**：移除简体 `zh`，现有 zh 文案转换为繁体并补齐韩语），URL 前缀为小写 `/zh-hant/`、`/ko/`；语言前缀出现在不属于它的站点时 301 到正确站点。
- 东方站根路径 `/` 为双语入口页；西方站根路径为英语首页。
- hreflang 跨域互指 + `x-default` 指向西方站英语版；站点地图与 robots 按站点分别输出。
- 新增工具页通用外壳：首屏表单内联、计算在浏览器本地完成、结果区块化、可分享结果链接（noindex）、统一合规声明、行为埋点事件；工具页构建期预渲染。
- 品牌与视觉：两站各自的站名、主题色与字体栈（CJK 字体子集按需加载），遵循 `docs/design/` 的视觉规范。

## Capabilities

### New Capabilities
- `multi-site`: 按 Host 识别东方/西方站点、站点与语言的归属、跨站重定向、各站品牌与入口页。
- `tool-pages`: 所有占卜/命理工具页共享的行为契约：零等待本地出结果、无需注册、结果区块、分享链接、合规声明与行为埋点。

### Modified Capabilities
- `i18n`: 语言路由改为「语言归属站点」，新增 zh-Hant/ko、移除 zh，默认语言无前缀只适用于其所属站点。
- `seo`: hreflang 改为跨域互指并固定 x-default；站点地图与 robots 按站点输出。

## Impact

- `template.config.ts`、`packages/config`（新增 `sites` 配置与校验）、`apps/web` 的 i18n 路由/中间件、Paraglide 配置（`scripts/i18n-project.ts`）、`features/seo`、`features/marketing`（预渲染范围、站点外壳）、`messages/*`（新增 zh-Hant、ko，删除 zh）、`packages/email`（邮件语言）。
- Better Auth 的 trustedOrigins / OAuth 回调、Stripe 回跳地址需要同时支持两个 Host（见 design 决策 4）。
- Cloudflare：web Worker 绑定两个自定义域名（上线 change 处理）。
