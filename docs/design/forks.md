# 模板文件定制登记

记录衍生项目对模板文件的定制，template-sync 遇到冲突时据此合并（流程见 `ui-design` 与 `template-sync` 技能）。

## 复制到 `packages/ui/src/project/` 的模板组件

暂无。

## 模板文件中的项目挂载点

| 模板文件 | 改动 | 项目文件 | 来源 change | 合并要点 |
|---|---|---|---|---|
| `apps/web/src/routes/app/$slug/index.tsx` | 路由选项加 `validateSearch`、`loaderDeps`、`loader`（今日面板数据），页面顶部插入 `<TodayPanel />`；共 1 个 import 与 5 行 | `apps/web/src/features/daily/mount.tsx`、`today-panel.tsx`、`today.functions.ts` | add-birth-profiles-daily-horoscope（design D10） | 采纳模板改动后重新插入这几行；`?profile=` 查询参数只由面板使用 |
| `packages/config/src/template.ts` | `emailSender` 的发件人显示名改为收件人语言下的品牌名（`siteBrandName(config, site, locale)`；语言不属于该站点时用站点品牌名）；约 4 行 | `template.config.ts` 的 `sites.east.brand.names`；`apps/jobs/src/queues/email.ts` 的发件人缓存改按完整 `from` 取键 | separate-landing-homepage（design D3a：韩语站名「간지데이」、中文「干支日」） | 采纳模板改动后保留按语言取显示名；模板若自行支持按语言的发件人名则改用模板实现 |
| `apps/web/src/features/ai/subject-chat.tsx` | 临时上下文对话页的「返回结果」链接改为 `legacyToolPath(page.returnTo)`；1 个 import 与 1 行 | `apps/web/src/features/tools/tool-href.ts` 的 `legacyToolPath` | separate-landing-homepage（design D4「已存的返回地址」） | 采纳模板改动后保留这一处映射：迁移前签发的 `returnTo` 可能是语言首页，须落到主工具页 |
| `apps/web/scripts/check-critical-css.mjs` | `shot()` 中在建页前加一段 `context.addInitScript`，把 `localStorage.theme` 写成与 `colorScheme` 相同的值；共 7 行 | `apps/web/src/features/site/theme.ts`（`siteThemeScript`：西方站首次到访固定浅色） | refresh-visual-system-warm（任务 3.5） | 采纳模板改动后重新插入；没有它时西方站的 dark 截图仍是浅色，矩阵少一个主题 |
| `apps/web/src/routes/__root.tsx` | `RootDocument` 的 `floatingControls` 固定传 `false`（主题切换不再浮动），页面末尾的 `SiteSettings` 去掉 `md:hidden`；head 脚本在 `themeInitScript()` 之前插入 `siteThemeScript()` | `apps/web/src/features/theme/site-settings.tsx`、`features/site/theme.ts` | refresh-visual-system-warm（design D3、D4） | 模板改动 head 脚本顺序或浮动控件时，保持 `siteThemeScript` 在模板主题脚本之前、浮动主题控件关闭 |
| `apps/web/src/routes/__root.tsx`（404 标题） | 未找到页的 `title` 由 `` `${m.common_not_found_title()} \| ${rootBrand(...)}` `` 改为 `titleWithSite(m.common_not_found_title(), getLocale(), site)`；1 处 import 与 1 行 | `apps/web/src/features/seo/metadata.ts` 的 `titleWithSite` | separate-landing-homepage（design D3a） | 采纳模板改动后保留：按语言取分隔符与站名，东方站韩语为「간지데이」 |
| `apps/web/src/routes/account/index.tsx`、`admin/route.tsx`、`app/$slug/route.tsx`、`app/$slug/chat/index.tsx`、`app/$slug/chat/$conversationId.tsx`、`app/$slug/chat/context.tsx`、`app/$slug/media/new.tsx`、`app/$slug/tasks/index.tsx`、`app/$slug/tasks/$taskId.tsx` | `head` 改为 `({ matches }) => …`，标题外包一层 `siteTitle(<原标题>, matches)`；每个文件 1 个 import 与 head 中 1–4 行 | `apps/web/src/features/seo/site-title.ts`（按当前站点与语言追加站名） | separate-landing-homepage（design D3a、tasks 2.6） | 采纳模板改动后在新的标题外重新包 `siteTitle`；模板自行支持标题带站名时改用模板实现 |
| `apps/web/src/routes/(auth)/accept-invitation.tsx` | `authPageHead` 增加第 3 个参数 `m.auth_accept_invitation()`（标题）；1 行 | `apps/web/src/features/seo/metadata.ts` 的 `authPageHead` / `titleWithSite` | separate-landing-homepage（tasks 2.6） | 采纳模板改动后保留标题参数，否则邀请页没有标题与站名 |
| `apps/web/src/routes/s.$type.$token.tsx` | 分享页标题由 `` `${title} \| ${templateConfig.app.name}` `` 改为 `siteTitle(title, matches)`，删去 `templateConfig` 导入；约 3 行 | `apps/web/src/features/seo/site-title.ts` | separate-landing-homepage（design D3a） | 采纳模板改动后保留：东方站分享页不得显示西方站名 |
| `apps/web/src/features/seo/metadata.ts` | 新增 `titleWithSite`（按语言选分隔符与站名，已含站名不重复）；`pageHead`、`authPageHead` 的标题改经它生成；约 30 行 | `packages/config` 的 `siteBrandName`、`sites.*.brand.names` | separate-landing-homepage（design D3a） | 采纳模板改动后保留 `titleWithSite` 与两处调用；模板改标题格式时以 D3a 的分隔符与站名规则为准 |
| `apps/web/src/features/seo/home-copy.ts` | 首页标题改为「品牌名 + 主词」（四语，使用者 2026-11-17 确认）；增加第 3 列标语与 `homeTagline()`；约 30 行 | `apps/web/src/features/share-cards/layout.tsx`、`apps/web/scripts/og-images.ts`（改用 `homeTagline`） | separate-landing-homepage（design D3） | 本文件即项目文案挂载点：采纳模板改动时保留项目文案与 `homeTagline`，只合并结构变化 |
| `apps/web/src/features/seo/structured-data.ts` | `websiteData` 增加可选 `url` 参数；新增 `webApplicationData`、`breadcrumbData`（地址与 canonical 同算法）；约 45 行 | `apps/web/src/routes/$slug.tsx`、`life-path-number/index.tsx`、`life-path-number/$number.tsx`、`routes/index.tsx` | separate-landing-homepage（design D3） | 采纳模板改动后保留两个新函数与 `url` 参数；模板新增同类函数时改用模板实现 |
| `apps/web/src/routes/index.tsx` | 首页 head 改为 `staticPage('/')` + Organization + WebSite（`url` 为该语言首页 canonical），去掉东方站工具 head 与西方站 FAQPage；约 30 行 | `features/seo/home-copy.ts`、`structured-data.ts` | separate-landing-homepage（design D3） | 本文件已是项目首页（工具 / 落地页），采纳模板改动时以项目版本为准，只移植 head 的结构变化 |
| `apps/web/src/features/share-cards/layout.tsx`、`share-page.tsx` | 默认分享图副标题改用 `homeTagline`；分享页文案中的站名改为当前站点、当前语言的品牌名（`siteBrandName` + `useSiteId`）；约 15 行 | `features/seo/home-copy.ts`、`features/site/context.tsx` | separate-landing-homepage（design D3a） | 采纳模板改动后保留按站点取站名，东方站分享页不得显示 Arcanumber |
| `apps/web/scripts/og-images.ts` | 默认图标语改用 `homeTagline`；开发中间件先 `decodeURIComponent` 再匹配 `/og/` 路径（CJK 文件名）；约 10 行 | `features/seo/home-copy.ts` | separate-landing-homepage（tasks 2.5） | 采纳模板改动后保留解码，否则 `/og/zh-hant/八字排盤.png` 在开发环境 404 |
| `apps/web/scripts/check-home-bundle.mjs`、`check-home-bundle.d.mts` | 增加 `TOOL_PAGES`（四个主工具页 head 与快照对照）与 `SPLIT_PAGES`（紫微页静态闭包不含八字 / 만세력主页组件）及其报告；约 110 行 | `apps/web/scripts/home-head.snapshot.json` 等快照 | separate-landing-homepage（tasks 2.1、2.3） | 采纳模板改动后重新接入这两组检查；模板改动首页检查结构时一并调整 |
| `apps/jobs/src/queues/email.ts` | 发件人缓存由按站点改为按完整 `from` 取键（显示名随收件人语言变化）；约 5 行 | `packages/config/src/template.ts` 的 `emailSender`（见上方该行） | separate-landing-homepage（design D3a） | 与 `template.ts` 一行同时保留；只按站点缓存会让韩语邮件沿用中文显示名 |
| 测试：`apps/web/e2e/seo.spec.ts`、`apps/web/src/features/seo/seo.test.tsx`、`features/marketing/prerender.test.ts`、`features/share-cards/layout.test.tsx`、`share-page.test.tsx`、`apps/web/scripts/check-home-bundle.test.ts`、`apps/jobs/test/email-queue.test.ts`、`email-queue.unit.test.ts` | 断言改为带站名的标题、关键词 URL 的工具页、首页品牌 head、按语言的发件人显示名 | 上述各行 | separate-landing-homepage（第 2 组） | 采纳模板改动时保留项目断言，只合并模板新增的用例 |
