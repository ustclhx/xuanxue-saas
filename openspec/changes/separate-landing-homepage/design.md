# Design

## Context

动机见 proposal.md，竞品与本站数据见调研简报（仓库外 `~/workspace/xuanxue-saas-evidence/landing-redesign-research/brief.md` §A、§C「Dedicated URLs」「SEO migration notes」）。与做法相关的现状：

- **首页即工具**：`apps/web/src/routes/index.tsx` 按语言懒加载 `BaziHome`（zh-Hant / zh-Hans）、`ManseryeokHome`（ko）、`LifePathHome`（en，内容来自 `content/numerology/en/life-path-number.mdx`），并把 `HomeHub` 作为 `hub` 属性塞进工具组件之后。head：东方站用 `easternToolHead({ path: '/', ...easternPageCopy('home') })`（不输出 JSON-LD）；西方站输出 `Organization`、`WebSite` 与长文 FAQ 生成的 `FAQPage`。
- **东方站工具路由**：`routes/$slug.tsx` 通过 `features/tools/bazi/eastern-routes.ts` 的 `EASTERN_PAGES` 把 slug 映射到 `ziwei | mingpan | gunghap`，静态导入三个页面组件；未登记的 slug 返回 404。`/八字/$slug`、`/사주/$slug` 是两段路径的概念页；`/八字`、`/사주` 是概念页基路径，没有索引页。已核对 `/zh-hant/八字排盤`、`/zh-hans/八字排盘`、`/ko/만세력` 与现有路由不冲突，2026-11-17 线上均为 404。
- **西方站数字页**：`routes/life-path-number/$number.tsx` 是独立的平级路由，没有 `life-path-number/index.tsx` 或布局路由；`numerologyContentPath('life-path-number')` 返回 `/`。
- **注册表驱动**：`features/tools/registry.ts` 的 `TOOL_ROUTES` 驱动预渲染（`features/marketing/prerender.ts`）、站点地图（`features/seo/pages.ts`）、hreflang（`metadata.ts`）、页头导航与内链（`toolsForLocale`）、语言切换（`features/i18n/switch-path.ts`）、`llms.txt`（`features/seo/crawlers.ts`）、OG 样例图（`features/seo/og-sample/pages.ts`）、首页工具矩阵（`home-hub/data.ts`）、报告空态链接（`readings/report-page.tsx`）与 optin 邮件链接（`readings/optin-email.ts`）。`bazi` 与 `life-path` 两条的 `paths` 为 `/`。
- **请求路径**：`wrangler.jsonc` 的 `run_worker_first` 让所有 HTML 先经过 Worker；`features/site/gate.ts` 的站点守卫已在地址规范化之后处理东方站根路径跳转（`features/i18n/east-home.ts`，保留查询参数）。旧首页查询跳转放在同一位置。
- **结果状态的携带方式**：分享链接是 `#r=` 片段（`features/tools/share.ts`，服务器看不到）；解锁 / 结账回跳是 `?unlock=<签名令牌>`（`readings/unlock.ts`，`returnTo` 为签发时的页面路径，有效 6 小时），回到页面后 `unlock-card.tsx` 清掉 `unlock`、`checkout` 参数。今日面板（`daily/today.server.ts`）、出生档案（`profiles/profiles-page.tsx`）生成 `<语言首页>#r=` 链接。
- **性能门槛**：`apps/web/scripts/check-home-bundle.mjs` 检查四个语言首页的静态脚本闭包与禁止标记，`template.config.ts` 的 `homeScriptGzipBudget: 352174`；`redesign-home-chart-visuals` 2.3 的首页 head 对照测试断言首页 canonical / hreflang / robots / JSON-LD 类型不变（本 change 有意改变 JSON-LD 与 Title，须同步更新快照）。
- **视觉**：`refresh-visual-system-warm` 正在把两站改为「温暖、简洁」（新 token、字号角色、`Section` / `Prose`、页头、插画）。本 change 的页面在它的同一设计会话中出稿。

## Goals / Non-Goals

**Goals:**

- 工具迁到关键词 URL，主词（Title / description / H1 / FAQ / 长文）随之迁移，旧的分享、解锁、档案与站内链接全部继续可用。
- 首页成为品牌落地页：首屏一个主任务，3–4 个精选入口，样例报告，今日条，一行价格，信任与短 FAQ。
- SEO 信号清晰：首页与工具页 Title / H1 不重复，结构化数据各归其位，站点地图、hreflang、内链一致，不做首页跳转。

**Non-Goals:**

- 不改排盘、数字命理、塔罗的计算与结果区块内容；不新增工具或详批类型。
- 不改其他已有工具 URL（`/紫微斗數排盤`、`/命盤查詢`、`/사주궁합`、每日运势、塔罗、`/numerology-calculator` 等）。
- 不改东方站根路径跳转规则与首页 hreflang 簇（`multi-site`「东方站入口页」不变）。
- 视觉 token、页头与共享组件由 `refresh-visual-system-warm` 负责；本 change 只使用它们。

## Decisions

### D1 新 URL 与路由

- **东方站**：`EasternPageId` 增加 `'bazi'`，`EASTERN_PAGES` 追加 `{ id: 'bazi', locale: 'zh-Hant', slug: '八字排盤' }`、`{ id: 'bazi', locale: 'zh-Hans', slug: '八字排盘' }`、`{ id: 'bazi', locale: 'ko', slug: '만세력' }`。
  - `$slug.tsx` 的页面组件改为按 id 懒加载（`lazyRouteComponent` + loader 预载，沿用 `routes/index.tsx` 现有做法），避免紫微页下载八字主页代码；`bazi` 在 ko 渲染만세력组件，在中文渲染八字组件。
  - head 用 `easternPageCopy('bazi')`，沿用现有 `bazi_home_seo_title` / `bazi_home_description` 文案键（文字不变，键名不改以免四语文案重排）。
  - `eastern-routes.ts` 顶部「首页不在这里」的注释改写。
- **西方站**：新增 `routes/life-path-number/index.tsx`，loader 读取 `getNumerologyPage({ slug: 'life-path-number' })`，渲染原 `LifePathHome` 的工具与长文（长文与 FAQ 在结果之后）。`numerologyContentPath('life-path-number')` 改为 `/life-path-number`；`NUMEROLOGY_ROUTES` 中 `life-path` 的 `paths.en` 改为 `/life-path-number`。`$number.tsx` 保持平级路由，加面包屑与指向父页的链接。按 `trailingSlash: 'never'`，canonical 为 `/life-path-number`。
- **注册表**：`bazi.paths` 改为 `{ 'zh-Hant': '/八字排盤', 'zh-Hans': '/八字排盘', ko: '/만세력' }`。注册表驱动的预渲染、站点地图、hreflang、语言切换、页头导航、`llms.txt`、OG 样例图、报告空态与 optin 邮件链接随之迁移，只需补测试。
- **组件改名**：`bazi-home.tsx`、`manseryeok-home.tsx`、`numerology/home.tsx` 去掉 `hub` 属性，成为工具页组件；文件是否改名由实现时决定（改名须同步 `check-ui.allow.local.json` 与 `check-type-roles` 允许名单的路径）。

### D2 落地页组成

`routes/index.tsx` 改为按站点渲染 `LandingPage`，区块与数据来源：

| 区块 | 组件 | 数据来源 |
|---|---|---|
| 品牌主视觉 | 新建 `home-hub/hero.tsx`：H1 品牌承诺、一句副标题、主按钮（指向主工具页）、至多一个次要文字链接、站点线描插画 | `messages/<locale>/landing.json`；插画来自 `refresh-visual-system-warm` 的 `features/illustrations/` |
| 工具入口（3–4 个） | 复用 `home-hub` 工具矩阵，改为精选条目（OQ5） | `hubTools` 增加精选清单与数量上限，仍从注册表取路径与标题 |
| 样例报告 | 复用 `home-hub` 样例区块与 `sample-chart-east/west.tsx` | `readings/catalog` 已审定样例（现状不变） |
| 今日条 | 新建 `home-hub/today-strip.tsx`（D6） | 每日运势页登记 + 浏览器内计算当日公共信息 |
| 三步说明 | 模板 `Steps` | `landing.json` |
| 一行价格 | 复用 `home-hub` 价格数据，只取最低起价 | 构建期价格快照（与定价页同源） |
| 信任说明 | 复用 `home-hub` 事实型背书 | 项目常量 |
| 品牌级 FAQ（3–4 条） | 复用 `features/tools/faq.tsx` 的展示，不输出 `FAQPage` | `landing.json` |

- loader 不再预载工具组件。西方站首页不再依赖内容集合：删除 `TemplateHome` 回退分支（长文缺失只影响 `/life-path-number`，该页按 `numerology-pages` 现有缺失处理返回 404 / 构建失败）。
- 保留 `data-testid="version"`（生产冒烟依赖）。
- 页面区块全部静态预渲染，不查库，数据库不可达时完整显示。

### D3 首页与工具页的 head

- **首页**：两站都用 `pageHead(staticPage('/', locale), origin, [organizationData, websiteData])`。Title / description 来自 `features/seo/home-copy.ts`，改为品牌名加品类主词：
  - 「干支日｜免費八字排盤、紫微斗數與塔羅」
  - 「干支日｜免费八字排盘、紫微斗数与塔罗」
  - 「간지데이 | 무료 만세력·사주·타로」
  - 「Arcanumber — Free Life Path Number Calculator, Numerology & Tarot」

  最终文案由使用者确认（OQ4）。该文件同时是默认分享图副标题来源，分享图随之更新。首页 canonical 与 hreflang 簇不变。
- **工具页**：Title / description / H1 原样沿用迁移前首页。结构化数据：
  - 新增 `webApplicationData`（`applicationCategory: 'LifestyleApplication'`、`offers` 价格 0、`url` = canonical、`inLanguage`）；
  - 新增 `breadcrumbData`（首页 › 工具；西方站数字页为首页 › Life Path Number › n）；
  - 加上该页 FAQ 生成的 `FAQPage`。东方站用原首页 `bazi_home_faq_*`，西方站用长文 frontmatter 的 FAQ。

  helper 放 `features/seo/structured-data.ts`。
- `redesign-home-chart-visuals` 2.3 的首页 head 对照测试更新快照：首页 Title 与 JSON-LD 类型按本设计改变，canonical / hreflang / robots 不变；新增工具页 head 快照。

### D4 旧链接兼容

- **查询参数（服务端）**：`features/site/gate.ts` 新增 `legacyHomeRedirect`，放在 `eastHomeRedirect` 之前。条件全部满足时返回 301：
  - GET / HEAD；
  - 路径是本站某语言首页：东方站 `/zh-hant`、`/zh-hans`、`/ko`、带工具参数的 `/`，西方站 `/`；
  - 查询中含 `LEGACY_TOOL_PARAMS = ['unlock', 'checkout']` 之一。

  Location 为该语言主工具页的编码地址加原查询串。东方站 `/` 按 `eastLocale` 选语言后直接跳到工具页，不经过两次跳转。只含 `utm_*`、`gclid` 等参数时不跳转。

  这覆盖已签发、`returnTo` 为语言首页的解锁令牌（6 小时内的结账与登录回跳）。新令牌的 `returnTo` 已是工具页路径（由 `returnPath()` 取当前路径）。
- **片段（客户端）**：语言首页的 head 中加一段内联脚本，约 200 B，在首帧前执行：`location.hash` 含 `r=` 时 `location.replace(<主工具页>+location.hash)`。工具页地址在构建期写入脚本，不依赖水合。只在落地页输出，工具页与其他页面不受影响。脚本计入 HTML，不计入首页脚本预算。
- **站内仍生成旧形式链接的地方**：改为直接指向工具页，不依赖跳转。包括今日面板 `daily/today.server.ts`、`daily/east-page.tsx`、出生档案 `profiles/profiles-page.tsx`、`bazi/common.tsx` 的 `pageHref('home')`（见 D5 表）。
- **已存的返回地址**：临时上下文（`readings/chart-result-context.ts` → `issueSubjectContext` 的 `returnTo`）若为语言首页，打开时落到落地页；不迁移数据。显示「返回结果」链接的地方加一个纯函数 `legacyToolPath(path)`，把语言首页映射到主工具页（不改存量记录）。

### D5 假设「工具 = `/`」的文件清单

| 文件 | 现状假设 | 本 change 的处理 |
|---|---|---|
| `features/tools/registry.ts` | `bazi.paths` 三语均为 `/` | 改为三个关键词 slug |
| `features/tools/numerology/routes.ts` | `life-path.paths.en = '/'`；`numerologyContentPath('life-path-number') = '/'` | 改为 `/life-path-number` |
| `features/tools/bazi/eastern-routes.ts` | 注释「首页不在这里」；无 `bazi` 条目 | 追加三条 `bazi`，`EasternPageId` 加 `'bazi'` |
| `routes/$slug.tsx` | 只渲染 ziwei / mingpan / gunghap | 按 id 懒加载，增加 `bazi` |
| `routes/index.tsx` | 渲染工具组件 + hub；head 为工具 head 或长文 FAQ | 改为落地页与品牌 head（D2、D3） |
| 新增 `routes/life-path-number/index.tsx` | 不存在 | 新建（D1） |
| `routes/life-path-number/$number.tsx` | 计算器为页内嵌入，无父页 | 加面包屑与父页链接、`BreadcrumbList` |
| `features/tools/bazi/head.ts` | `easternPageCopy('home')` | 改为 `'bazi'`（`'home'` 删除） |
| `features/tools/bazi/common.tsx` | `pageHref('home')` → `toolHref('/')` | 改为 `pageHref('bazi')` |
| `features/tools/bazi/{ziwei-page,mingpan-page,gunghap-page,concept-page}.tsx` | 「回到八字排盤」链接 `pageHref('home')` | 改指 `bazi`，锚文本用关键词 |
| `features/tools/bazi/{bazi-home,manseryeok-home}.tsx`、`numerology/home.tsx` | 接收 `hub` 属性，作为首页 | 去掉 `hub`，成为工具页 |
| `features/tools/numerology/copy.ts` | 内链 `{ href: '/', title: numerology_home_title }` | 改为 `/life-path-number` |
| `features/tools/numerology/seo.ts` | 首页 FAQ 生成 `FAQPage` | 用于 `/life-path-number` |
| `content/numerology/en/*.mdx`（14 个文件） | `[Life Path calculator](/)` | 改为 `/life-path-number`；`check-content` 增加规则：西方站内容不得以 `/` 作为计算器链接 |
| `content/concepts/`、`content/guides/`、`content/blog/` | 可能以语言首页作为排盘入口 | 逐个核对，改指工具页 |
| `features/marketing/home-hub/data.ts` | 工具矩阵从注册表取所有工具；首页即八字时排除自身 | 精选 3–4 个，八字 / Life Path 作为入口之一 |
| `features/marketing/east-english/page.tsx` | 语言入口链接 `toolHref('/')`（即「排盤」） | 保留语言首页链接，另加主工具页链接（OQ7） |
| `features/marketing/prerender.ts` | 首页始终预渲染；工具路径来自注册表 | 无需改动，补测试断言新页面在预渲染清单中 |
| `features/seo/pages.ts`、`metadata.ts` | 首页 `staticPage('/')` + 注册表页面 | 补测试：新工具页入站点地图且 hreflang 正确，首页仍在 |
| `features/seo/home-copy.ts` | 首页标题为品类描述 | 改为品牌 + 主词（D3） |
| `features/seo/structured-data.ts` | 只有 Organization / WebSite / Article / Product / FAQ | 新增 WebApplication、BreadcrumbList |
| `features/seo/og-sample/pages.ts` | 注释「首页八字 / 西方站首页」；按注册表路径匹配 | 改注释；样例 OG 随注册表迁到工具页，首页改用默认分享图（或品牌插画版，以设计稿为准） |
| `features/seo/crawlers.ts`（`llms.txt`） | 注册表驱动 | 无需改动，补测试 |
| `features/i18n/switch-path.ts` | 未登记路径回退 `/` | 注册表驱动，补测试：`/zh-hant/八字排盤` ↔ `/zh-hans/八字排盘` ↔ `/ko/만세력`，`/life-path-number` 只在西方站 |
| `features/site/gate.ts`、`features/i18n/east-home.ts` | 东方站 `/` 跳语言首页并保留查询 | 新增旧首页查询跳转（D4） |
| `features/readings/unlock.ts`、`unlock-card.tsx` | `returnTo` 为当前路径（迁移前是语言首页） | 不改；旧令牌由 D4 跳转兜底 |
| `features/readings/report-page.tsx`、`optin-email.ts` | 注册表路径为 `/` 时链接到语言首页 | 注册表驱动，补测试；`optin-email.ts` 中 `path === '/'` 分支保留给未来 |
| `features/readings/chart-result-context.ts` 及显示返回链接处 | 存量 `returnTo` 可能是语言首页 | `legacyToolPath` 映射（D4） |
| `features/daily/today.server.ts`、`daily/east-page.tsx` | `toolHref('/')#r=…` | 改为主工具页 |
| `features/profiles/profiles-page.tsx` | `pageHref('home')#r=…` | 改为主工具页 |
| `features/tools/numerology/use-shared-input.ts` | 读取当前页 `#r=` / `?unlock=` | 无需改动（在工具页上运行） |
| `apps/web/scripts/check-home-bundle.mjs` | 首页闭包含工具代码；禁止标记为阅读器 / 分享图 | 新增禁止标记：八字引擎、数字命理计算、出生表单（落地页不得含工具代码）；记录新的实测体积 |
| `apps/web/e2e/bazi.spec.ts`、`numerology.spec.ts`、`reading-unlock.spec.ts`、`reading-optin.spec.ts`、`analytics.spec.ts`、`ai-chat.spec.ts`、`i18n-preference.spec.ts`、`floating-controls.spec.ts`、`theme.spec.ts`、`seo.spec.ts` | 在 `/`、`/zh-hant`、`/ko` 上填写表单或断言 H1 / Title | 改到工具 URL；首页改断言落地页 |
| `apps/web/e2e/staging/smoke.spec.ts`、`e2e/production/smoke.spec.ts` | 首页 H1 / 表单 / Title | 改为首页落地页断言 + 工具页表单断言 |
| `features/tools/bazi/bazi.test.tsx` 等单测 | head 以 `path: '/'` 构造 | 改为新路径 |

### D5a 内链锚文本

页头工具下拉、落地页主按钮、工具入口、页脚、概念页与数字页指向主工具页的链接，锚文本用关键词（「八字排盤」「免費八字排盤」「만세력」「Life Path Number Calculator」）。落地页主按钮文字由设计稿与 OQ4 确认。

### D6 今日条

- 预渲染首页是静态 HTML，不能在构建期写入「今日」。今日条在服务端只输出固定尺寸的骨架和链接文字，水合后在浏览器内计算并填入：东方站当日干支用纯算术（60 甲子循环，基准日常量，几十行），西方站 Number of the Day 用当日日期数字和。
- 宜忌、建除等需要历表的内容只在每日运势页显示，首页不显示，避免把历法库带进首页包。
- 计算函数放 `features/daily/` 的纯函数，带单测，并与 `packages/bazi` 的 `dayPillarOf` 对拍 1,000 天。
- 填入前后尺寸不变（固定行高、等宽数字），CLS 为 0。
- 每日运势页未登记时，按 `home-hub`「每日运势入口」不渲染今日条。

### D7 性能与包体积

- 落地页不含表单与引擎，首页水合闭包应明显变小。`homeScriptGzipBudget` 不放宽，实测值写入 PR；工具页的体积与迁移前首页相当，由 Lighthouse 覆盖。
- `check-home-bundle.mjs` 的页面清单仍为四个语言首页，新增工具代码的禁止标记。
- Lighthouse 按 `redesign-home-chart-visuals` 10.1 的命令测：四个落地页与四个新工具页。口径：
  - 新工具页对比迁移前首页的基线；
  - 落地页 LCP 不高于该基线；
  - 两者 CLS 中位数均 < 0.1。

### D8 顺序与依赖

1. **设计**：落地页与三个工具页的画板在 `refresh-visual-system-warm` 1.3 的同一画布中出稿，与其一同由使用者确认（本 change 1.2、1.3）。
2. **路由与 SEO（第 2、3 组）**：不依赖新视觉，可在设计确认文案（OQ4–OQ7）后开发。合并后 staging 上首页与工具页会短暂重复主词，因此不得在第 4 组合并前发布生产。
3. **落地页（第 4 组）与工具页改版（第 5 组）**：依赖 `refresh-visual-system-warm` 第 3、4、5 组（token、外壳、表单与插画）合并，以及本 change 第 2 组合并。
4. **发布**：与 `refresh-visual-system-warm` 同批或之后发布生产。上线前一周内由使用者导出 Search Console 基线。
5. **归档**：`redesign-home-chart-visuals` 先归档（`home-hub` 主规格由它创建），然后本 change 归档。若 `refresh-visual-system-warm` 与本 change 同批归档，两者无同名 requirement 冲突。

### D9 监测

- **上线前**：导出两站 Search Console 近 28 天查询基线，重点是「免費八字排盤」「八字排盤」「八字排盘」「만세력」「무료 만세력」「life path number calculator」「life path number」，包括展示、点击、平均排名与落地 URL，存入 `EVIDENCE_DIR`。
- **上线当天**：在 Search Console 对三个新工具页与 `/life-path-number` 请求编入索引，提交站点地图。IndexNow 由发布流水线自动提交。
- **上线后两周**：对照同一组查询，检查：
  1. 新 URL 是否已收录、成为落地 URL；
  2. 主词总展示与排名是否回到基线的 80% 以上；
  3. 首页与工具页是否在同一查询上互相竞争。

  未达标时只调整内链与文案，不做首页跳转。结论写入项目日志（`kb_journal`）。

## Risks / Trade-offs

- **主词排名在迁移期下降**：调研预期 Google 需时间把主词归到新 URL。缓解方式：
  - Title / H1 / FAQ / 长文原样迁移；
  - 首页保留含主词的品牌标题；
  - 首页主按钮、页头、页脚、概念页使用关键词锚文本内链；
  - 站点地图 + IndexNow + 手动请求编入索引；
  - 两周检查（D9）。
- **首页与工具页互相蚕食**：Title / H1 强制不同（spec 场景），首页不输出 FAQPage、不含长文。
- **旧分享链接与解锁回跳中断**：服务端处理查询（301），客户端处理片段；e2e 覆盖两种旧形式；令牌 6 小时有效期过后自然消失。
- **跳转误伤广告与 UTM 落地**：只对 `unlock` / `checkout` 跳转，测试覆盖 UTM。
- **路由合并与落地页合并之间的重复内容窗口**：只在 staging；生产发布等待第 4 组合并（D8）。
- **与 `refresh-visual-system-warm` 在同一文件上冲突**：
  - `routes/$slug.tsx`：对方只改样式，本 change 改路由，后合并方 rebase；
  - `bazi-home.tsx` 等三个工具组件：对方明确不改；
  - `home-hub/`、`routes/index.tsx`：只由本 change 修改。
- **与其他进行中 change 冲突**：
  - `add-birth-profiles-daily-horoscope` 改 `daily/`、`profiles/`；
  - `adopt-subject-chat-readings` 改 `chart-result-context.ts`。

  由协调者安排顺序，后合并方 rebase。
- **今日条在服务端与客户端不一致导致水合警告**：服务端只输出骨架，计算放在 effect 中，不在渲染时读 `Date`。

## Migration Plan

- 无数据迁移、密钥或外部配置。存量 `returnTo` 不迁移，由 D4 映射与跳转兜底。
- **上线步骤**：
  1. 第 1 组设计确认。
  2. 第 2、3 组合并到 main（只上 staging）。
  3. `refresh-visual-system-warm` 第 3–5 组合并。
  4. 第 4、5 组合并。
  5. 第 6 组 staging 验收。
  6. 使用者导出 Search Console 基线并授权发布。
  7. 生产发布、请求编入索引。
  8. 两周检查。
- **回滚**：回退 PR 并重新部署，注册表路径回到 `/`。新 URL 在回滚后返回 404，会产生 Search Console 覆盖错误。若上线后一周内需回滚，改为把新 URL 301 回语言首页，而不是直接 404。

## Open Questions

1. **西方站首页是否保留单个日期输入**：调研认为可接受（提交后跳到 `/life-path-number` 并带上日期）。默认不保留，首页只有主按钮。
2. **旧首页查询跳转用 301 还是 302**：默认 301（首页今后不会再使用 `unlock` 参数）。
3. **首页可见 FAQ 是否输出 `FAQPage`**：默认不输出，FAQ 结构化数据只在工具页。
4. **首页 Title、H1 品牌承诺、副标题与主按钮文案**：
   - 四语均需使用者确认；
   - 初稿：「用千年命理，安靜地認識自己」、「Numbers and cards for quiet self-reflection」；
   - Title 初稿见 D3；
   - 须符合合规语境：免费工具不提 AI，不以娱乐定位。
5. **精选工具入口**：
   - 中文默认「八字排盤、紫微斗數、三張牌塔羅、命盤查詢」，今日运势单独成条；
   - 韩语「만세력、사주궁합、쓰리 카드 타로、오늘의 운세」；
   - 西方站「Life Path、Numerology Calculator、Three-Card Tarot」+ Compatibility 文字链接。
6. **今日条的内容**：默认只显示当日干支 / Number of the Day 加链接（D6）；是否需要宜忌（需要时改为边缘计算并评估成本）。
7. **东方站 `/en` 入口页**：默认链接各语言落地页，同时加各语言主工具页链接。
8. **样例 OG 图**：首页原用八字 / Life Path 样例 OG 图，迁移后改为默认分享图还是品牌插画版（以设计稿为准）。
