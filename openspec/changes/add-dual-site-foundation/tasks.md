# Tasks

## 1. 站点注册表与语言集合

- [ ] 1.1 在 `@xuanxue/config` 增加 `sites` 配置类型、默认值与校验（每种语言恰好属于一个站点、默认语言属于本站），`template.config.ts` 写入占位域名的东西两站；验证：`pnpm --filter @xuanxue/config test` 新增用例通过
- [ ] 1.2 把 i18n 语言集合改为 `en`/`zh-Hant`/`ko`：Paraglide urlPatterns（`/zh-hant/`、`/ko/`）、OpenCC 转换 `messages/zh` → `messages/zh-Hant`、删除 `zh`、新增 `messages/ko` 全量翻译、`EMAIL_LOCALES` 与邮件模板同步；验证：`pnpm typecheck`、`pnpm test` 通过，构建日志无缺失文案（admin 除外）
- [ ] 1.3 实现 `resolveSite(host)` 与请求中间件：站点识别、语言归属 301、东方站无前缀路径 302 到入口页、未知 Host noindex；验证：`features/site` 单元测试覆盖 spec `multi-site` 全部场景

## 2. SEO 与预渲染

- [ ] 2.1 `pageHead` 改为跨站 hreflang（绝对地址）+ x-default 规则，`publicPages` 按站点过滤；验证：`features/seo` 单元测试覆盖 spec `seo` 两个修改的场景
- [ ] 2.2 站点地图索引 + 按语言子站点地图、robots 按 Host 输出，禁止抓取 `/app`、`/admin`、`/api` 与分享链接；验证：单元测试 + `curl -H 'Host: xuanxue-east.example' localhost:$WEB_PORT/sitemap.xml` 输出符合场景
- [ ] 2.3 预渲染按站点进行：入口页来自站点注册表，新增 `TOOL_ROUTES` 注册点，`EAST_URL`/`WEST_URL` 构建变量；验证：`pnpm build` 后 `dist/client` 下两站入口页与 hreflang 绝对地址正确，`prerender.test.ts` 更新通过
- [ ] 2.4 东方站入口页（双语卡片、按浏览器语言高亮、无自动跳转）；验证：e2e 用 `ko-KR` locale 打开东方站 `/`，断言无跳转且韩语入口高亮

## 3. 跨站认证与支付

- [ ] 3.1 Spike：Better Auth 按请求 Host 动态 baseURL + 双 trustedOrigins，结论与选定方案写入本 change 的 design.md 决策 4；验证：本地以两个 Host 分别完成邮箱验证码登录
- [ ] 3.2 按 3.1 结论实现：两站登录/OAuth 回调/Stripe success&cancel 回跳到发起站点与页面；验证：e2e（Stripe 离线模拟）从东方站 `/ko/` 发起购买后回到同一页面且界面为韩语

## 4. 工具页外壳与视觉

- [ ] 4.1 按 `docs/design/visual-system.md` 实现两站主题 token（Tailwind theme，按站点切换）、站点 header/footer 与品牌；验证：两站首页截图与原型一致，暗色模式无闪烁测试仍通过
- [ ] 4.2 `features/tools`：ToolPage / ResultBlock / ShareLink（`#r=` 片段编码，无姓名明文）/ Disclaimer（三语）/ 内链矩阵 / FAQ 组件，配 Storybook 式 demo 路由 `/dev/tools`（仅本地）；验证：组件单元测试 + 禁用 JS 请求 demo 页含 H1 与表单标签
- [ ] 4.3 `useToolEvents` 埋点接入 `features/analytics`，六个事件名固定且不含个人信息；验证：单元测试断言事件载荷字段白名单
