# Design

## Context

- 模板是 TanStack Start + Cloudflare Workers 单应用，i18n 由 Paraglide（`url` + `baseLocale` 策略，`scripts/i18n-project.ts`）实现，默认语言无前缀；营销页通过 `features/marketing/prerender.ts` 预渲染，SEO 由 `features/seo`（`pageHead`、`publicPages`、OG 图）统一输出。
- 设计文档要求「纯静态、无框架」，用户已决定（2026-10-19）采用「模板单仓 + 预渲染」：保留框架，但工具页构建期输出完整 HTML，首屏不依赖水合即可阅读，计算逻辑在客户端运行。
- 域名未定，v1 用占位：东方站 `xuanxue-east.example`，西方站 `xuanxue-west.example`（`app.url` 指向西方站）。

## Goals / Non-Goals

**Goals:** 一个 Worker 服务两个 Host；语言归属站点；跨域 hreflang；工具页外壳组件；zh-Hant/ko 全量文案。

**Non-Goals:** 不做子域名；不做 `ja`/`fr`/`de`/`nl`/`it` 文案（只在站点注册表中预留）；不做真实域名与 DNS（见 `launch-v1-production`）。

## Decisions

### 1. 站点注册表放在 `template.config.ts`
新增 `sites: { east: { hosts, locales, defaultLocale?: null, brand }, west: { hosts, locales, defaultLocale: 'en', brand } }`，`@xuanxue/config` 校验每种语言恰好属于一个站点、`i18n.locales` 等于各站语言并集。运行时 `resolveSite(host)` 是纯函数，放 `apps/web/src/features/site/`。备选：环境变量配置 Host —— 拒绝，站点结构属于产品形态，应与代码一起评审。

### 2. Paraglide 语言 id 与 URL 前缀
语言 id 使用 BCP 47 `zh-Hant`，URL 前缀小写 `zh-hant`，通过 Paraglide `urlPatterns` 显式映射；`en` 无前缀只对西方站成立。站点校验放在 `src/server.ts` 的 paraglide 中间件之前：先解析站点，再校验前缀归属，不属于时 301。东方站无前缀路径（除 `/`、`/app`、`/account`、`/api`、认证路由外）302 到入口页。

### 3. 预渲染按站点进行
构建期为每个站点分别爬取：入口页列表来自站点注册表，`isPrerenderedPath` 增加工具页前缀（由各工具 change 注册到 `TOOL_ROUTES` 常量）。绝对地址在构建时固化（与现有 `APP_URL` 约定一致），新增 `EAST_URL`/`WEST_URL` 构建变量；运行时 Host 只用于选择站点，不改写已预渲染 HTML。

### 4. 认证与支付跨 Host
优先方案：两个 Host 各自持有会话 Cookie（同一数据库），Better Auth `trustedOrigins` 包含两站，`baseURL` 按请求 Host 动态取值；Google OAuth 登记两个回调地址；Stripe Checkout 的 success/cancel URL 由请求 Host 生成。任务 3.1 先做 spike 验证 Better Auth 动态 baseURL；若不可行，回退方案为「账号中心固定在西方站 `/account`，东方站通过带签名 state 的跳转完成登录与支付后回跳」，spec 行为不变。

**Spike 结论（2026-10-19，任务 3.1）：可行，采用「两站各自登录」，不实施回退方案。** OAuth 只启用 Google。
- Better Auth 1.7.7 原生支持动态 baseURL：`baseURL: { allowedHosts, fallback, protocol }`。每个请求按 `Host` 匹配 allowedHosts 得到本请求的 baseURL，并把 allowedHosts 全部加入 trustedOrigins；不匹配的 Host（预览地址等）回退到 `APP_URL`。不信任 `x-forwarded-host`（未开启 `trustedProxyHeaders`）。
- 实现：`createAuth` 的 `hosts` 依赖（`packages/auth/src/auth.ts` 的 `baseURLOption`），web 传入站点注册表全部域名（`features/site/site.ts` 的 `siteHosts`；`APP_URL` 指向本机时再加入 `east.localhost` / `west.localhost`）。`protocol` 固定取 `APP_URL` 的协议，Cookie 的 `__Secure-` 前缀与单站点时一致，也不额外信任 http 来源。
- 本地验证（`east.localhost:27070`、`west.localhost:27070`，同一数据库）：两个 Host 分别完成邮箱验证码登录并取得会话；会话 Cookie 为 host-only，东方站 Cookie 在西方站 `get-session` 为 `null`；`sign-in/social` 生成的 Google `redirect_uri` 分别为各自 Host 的 `/api/auth/callback/google`；`Origin` 为未登记来源时返回 403。
- 上线要求：Google OAuth 客户端登记两个回调 `https://<东方站>/api/auth/callback/google`、`https://<西方站>/api/auth/callback/google`（随 `launch-v1-production` 的真实域名配置）。两站会话互不共享，用户在另一站点需要重新登录，账号、积分与订单仍是同一份数据。
- 回跳：登录后的 `redirect` 允许本站公开页面路径；Stripe success/cancel 地址由请求所在站点生成，`billing-return` 校验 `returnTo` 后跳回发起页面（任务 3.2）。

### 5. 工具页外壳
`features/tools/`：`ToolPage`（H1、导语、内联表单、结果区插槽、内链矩阵、FAQ、合规声明）、`ResultBlock`（可折叠区块，带锚点 id）、`ShareLink`（结果输入编码为 base64url JSON 放在 `#r=` 片段：片段不发往服务器，天然不被索引；页面再额外输出 noindex 仅对 `?r=` 兼容形式）、`useToolEvents`（埋点）。计算引擎是纯 TS 包，在客户端动态 import，表单本身不等待引擎下载（提交时若引擎未就绪显示 <300ms 的骨架）。
埋点复用 `features/analytics`，事件名固定：`tool_submit`、`result_view`、`block_open`、`tool_link_click`、`optin_submit`、`unlock_click`。

### 6. 文案迁移
现有 `messages/zh/*` 用 OpenCC（s2twp）脚本一次性转换为 `messages/zh-Hant/*` 后人工校对术语；韩语由 worker 翻译。邮件模板语言列表 `EMAIL_LOCALES` 同步改为 `en`/`zh-Hant`/`ko`。

### 7. 视觉规范
`docs/design/visual-system.md` 与 `docs/design/prototype.html` 是 UI 的依据（由协调者产出）：东方站「墨色 + 朱砂 + 金」、西方站「夜蓝 + 星金」，统一 4/8 间距与组件形态；CJK 字体使用系统字体栈，不打包 webfont，保证 LCP。

## Risks / Trade-offs

- [Better Auth 动态 baseURL 不支持] → 决策 4 回退方案，spike 结论写入本文件。
- [移除 zh 破坏模板测试] → 同一任务内更新所有引用 `zh` 的测试与 e2e。
- [预渲染两站导致构建时间翻倍] → 页面量 v1 < 1000，可接受；超出时改为按站点分开构建。
- [中文 URL 段] → 路由使用 slug 参数 + 工具注册表映射，链接生成统一 `encodeURI`，测试覆盖。

## Migration Plan

新项目无线上数据；`zh` 用户偏好字段迁移为 `zh-Hant`（一次性 SQL，若表中无数据可跳过）。
