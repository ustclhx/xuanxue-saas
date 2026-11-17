# Proposal

## Why

两站首页现在是「工具 + 枢纽」：东方站 `/zh-hant`、`/zh-hans`、`/ko` 首屏是 11 个输入的八字 / 만세력表单，西方站 `/` 是 Life Path 计算器加约 1,800 词长文，之后才是 `redesign-home-chart-visuals` 加的枢纽区块。2026-11-17 调研（仓库外 `~/workspace/xuanxue-saas-evidence/landing-redesign-research/brief.md`）显示：认真做品牌的同类站点（FateMaster、OpenFate、Co–Star、ziwei.pub、Numerology.com）都不把完整表单放在首页，首页 H1 是品牌或品类承诺，工具在自己的关键词 URL 上（如 OpenFate `/en/bazi-chart`、Numerology.com 的 life-path calculator 文章页）。我方首页因此既是工具页又是导航页：手机首屏没有任何 CTA，西方站手机 10.8 屏，同一组工具链接在一屏半内出现三次。

`redesign-home-chart-visuals` 当时以「主词迁移风险」为由否决了「枢纽型首页、工具迁往独立 URL」（其 design.md D1）。使用者 2026-11-17 改为采纳该方案，并确定了新 URL。本 change 规定迁移方式，使主词随工具迁到新 URL，首页变为落地 / 导览页。

## What Changes

- **工具迁往关键词 URL**：
  - 东方站：`/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력`。作为 `EASTERN_PAGES` 的新条目经现有 `routes/$slug.tsx` 渲染（已核对：`/八字/$slug`、`/사주/$slug` 是两段路径，`/사주궁합` 是另一 slug，均不冲突；`/八字` 本身留给概念页基路径，不使用）。
  - 西方站：`/life-path-number`。新增 `routes/life-path-number/index.tsx`，现有 `/life-path-number/<n>` 成为它的子页（面包屑「Home › Life Path Number › 7」）。
  - 工具注册表 `bazi` 与 `life-path` 两条的 `paths` 从 `/` 改为新地址，canonical、hreflang、站点地图、页头导航、语言切换随注册表迁移。
- **首页改为落地页**，区块顺序按调研：页头 → 品牌主视觉（H1 品牌承诺、一句副标题、一个主按钮指向工具页，至多一个次要文字链接，线描插画）→ 3–4 个工具入口 → 样例报告 → 今日条 → 三步说明 → 一行价格 → 信任说明 → 3–4 条品牌级 FAQ → 页脚。尽量复用 `features/marketing/home-hub/` 已有区块与数据层。首页不再含工具表单（西方站是否保留单个日期输入为待定问题）。
- **SEO 迁移**：
  - 当前首页的 Title、description、H1 原样迁到工具 URL。
  - 首页改用含品类主词的品牌标题，例如「干支日｜免費八字排盤、紫微斗數與塔羅」「간지데이 | 무료 만세력·사주·타로」「Arcanumber — Free Life Path Number Calculator, Numerology & Tarot」；H1 改为品牌承诺，与工具页 H1 不重复。
  - `/` 继续返回 200，不做跳转；首页仍自引用 canonical，首页 hreflang 簇不变。
  - 结构化数据：工具页加 `WebApplication`、`BreadcrumbList`、工具 `FAQPage`；两站首页都输出 `Organization` + `WebSite`（东方站首页目前没有）；西方站的 `FAQPage` 从 `/` 移到 `/life-path-number`。
  - 站点地图加入新地址并刷新 `/` 的 `lastmod`，发布后照常提交 IndexNow。
  - 站内链接改指工具 URL，锚文本用关键词：概念页、数字页、指南、博客、报告页、邮件、`llms.txt`、东方站 `/en` 入口页。
- **旧链接兼容**：
  - 带工具状态查询参数的旧首页地址（解锁 / 结账回跳的 `?unlock=`）由站点守卫 301 到工具 URL，保留全部查询参数。
  - 旧的 `#r=` 结果分享链接（片段不到服务器）由首页的极小内联脚本在客户端 `location.replace` 到工具 URL，保留片段。
  - UTM 等普通查询参数不触发跳转。
- **监测**：上线前记录 Search Console 查询基线；上线两周后检查新旧 URL 的展示、排名与覆盖。
- **依赖与顺序**：落地页与迁移后的工具页在 `refresh-visual-system-warm` 的同一设计会话中出稿；实现必须等该 change 的 token 与共享组件（其第 3、4、5 组）合并后进行。路由与 SEO 迁移本身不依赖视觉，但为避免首页改两遍，与落地页同批上线。

## Capabilities

### New Capabilities

无。首页相关要求并入 `home-hub`。

### Modified Capabilities

- `home-hub`:
  - 删除「工具优先的首页结构」「首页元数据与结构化数据不变」两条，改为「品牌落地页结构」「首页标题与 H1」「首页主操作指向工具页」「旧首页链接迁移」；
  - 修改「工具矩阵」（3–4 个精选入口）、「定价与订阅入口」（一行价格加链接）、「每日运势入口」（今日条）。
  - 该 capability 由 `redesign-home-chart-visuals` 引入，归档顺序见 design.md。
- `eastern-tool-pages`：「首页主词工具页」改为「八字主词工具页」（新 URL）；「同组件多入口」「长尾概念页」中的首页引用改为八字工具页。
- `numerology-pages`：「首页」改为「Life Path 工具页」（`/life-path-number`）；「数字页」改为该页的子页，带面包屑与指向父页的链接。
- `seo`：「多语言关联」场景改为新地址；「结构化数据」覆盖两站首页与工具页；新增「首页主词迁移」。

## Impact

- 路由与注册表：
  - `apps/web/src/routes/index.tsx`
  - `routes/$slug.tsx`
  - 新增 `routes/life-path-number/index.tsx`
  - `features/tools/registry.ts`
  - `features/tools/bazi/eastern-routes.ts`、`bazi/head.ts`
  - `features/tools/numerology/routes.ts`、`numerology/seo.ts`
- 首页与内容：
  - `features/marketing/home-hub/`
  - `features/tools/bazi/bazi-home.tsx`、`manseryeok-home.tsx`、`numerology/home.tsx`（改为工具页组件）
  - `content/numerology/en/life-path-number.mdx` 的归属
- SEO：
  - `features/seo/{metadata.ts,pages.ts,structured-data.ts,home-copy.ts,og-sample/pages.ts}`
  - `routes/llms[.]txt.ts`
  - `features/marketing/prerender.ts`
- 兼容：
  - `features/site/gate.ts`（旧首页查询跳转）
  - 首页内联脚本（`#r=` 片段跳转）
  - `features/i18n/switch-path.ts`
  - `features/readings/{report-page.tsx,optin-email.ts,chart-result-context.ts}`
- 测试：
  - `e2e/bazi.spec.ts`、`numerology.spec.ts`、`reading-unlock.spec.ts`、`analytics.spec.ts`、`i18n-preference.spec.ts`、`ai-chat.spec.ts`、`floating-controls.spec.ts`、`theme.spec.ts`
  - `e2e/staging/smoke.spec.ts`、`e2e/production/smoke.spec.ts`
  - `seo.spec.ts`、首页 head 对照测试、`check-home-bundle.mjs` 页面清单与预算
- 文案：新增 `apps/web/messages/<locale>/landing.json`；工具页沿用 `bazi_home_*` 等现有文案键。
- 数据与外部：
  - 不新增表、迁移、密钥、依赖或 Stripe 价格。
  - 首页与工具页继续预渲染、不查库。
  - 上线后需人工检查 Search Console；IndexNow 沿用发布流水线。
