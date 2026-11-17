# Tasks

> **执行约定**
> - **负责人**：
>   - 【Claude】设计稿、路由与 SEO 迁移、落地页与工具页 UI、评审；
>   - 【Codex】简单改动（内链批量替换、e2e 断言更新）、浏览器核对（截图、Lighthouse、跳转检查、Search Console 操作）与部署；
>   - 【用户】决策、文案确认与授权；
>   - 【协调者】设计关卡登记、合并顺序与外部动作的执行安排。
> - **worktree 与波次**：每个带 `WT-x` 标记的组一个 worktree（`orca worktree create --base-branch origin/main`）、一个 PR。
>   - 波次 0：第 1 组（与 `refresh-visual-system-warm` 第 1 组同一设计会话）；
>   - 波次 A：第 2 组（路由与 SEO），第 1 组 1.3 文案确认后即可开工，不依赖新视觉；第 3 组（内链与测试）依赖 2；
>   - 波次 B：第 4 组（落地页）与第 5 组（工具页改版）并行，依赖本 change 第 2 组，以及 `refresh-visual-system-warm` 第 3、4、5 组全部合并；
>   - 第 6 组为验收、发布与监测。
>   - **第 2、3 组合并后、第 4 组合并前不得发布生产**（staging 上首页与工具页会短暂重复主词，design.md D8）。
> - **共享文件冲突点**（合并时按 `docs/09-parallel-plan.md` §3 处理）：
>   - `features/tools/registry.ts`、`bazi/eastern-routes.ts`、`numerology/routes.ts`：只由第 2 组修改；
>   - `routes/$slug.tsx`：第 2 组改路由，`refresh-visual-system-warm` 第 6 组改样式，后合并方 rebase；
>   - `routes/life-path-number/$number.tsx`：第 2 组加面包屑，`refresh-visual-system-warm` 第 7 组改样式，后合并方 rebase；
>   - `routes/index.tsx`、`features/marketing/home-hub/`：只由第 4 组修改；
>   - `bazi/bazi-home.tsx`、`bazi/manseryeok-home.tsx`、`numerology/home.tsx`：只由第 5 组修改（第 2 组只在新路由中引用，不改文件）；
>   - `features/seo/structured-data.ts`、`home-copy.ts`、`og-sample/pages.ts`、`features/site/gate.ts`：只由第 2 组修改；
>   - `content/`、`daily/`、`profiles/`、`readings/` 中的链接：只由第 3 组修改；`add-birth-profiles-daily-horoscope` 与 `adopt-subject-chat-readings` 也改 `daily/`、`profiles/`、`readings/`，由协调者安排先后；
>   - 文案：新建 `apps/web/messages/<locale>/landing.json`（四语齐全，第 4 组），其余文案只追加；
>   - `scripts/check-ui.allow.local.json` 与 `check-type-roles` 允许名单：只删除自己文件的条目。
> - **不涉及**：迁移、密钥、Stripe 价格。验收证据写入 `EVIDENCE_DIR`，PR 只引用；生产发布、Search Console 操作与两周检查不在 PR 中预先勾选。

## 1. 设计稿与决策（与 refresh-visual-system-warm 第 1 组同一会话）

依赖：无。产出：原型索引行与副本、已确认的文案，是第 4、5 组的开工条件；1.3 是第 2 组的开工条件。

- [x] 1.1 【协调者】按 `ui-design` 第 1–2 步记录判断（§8.1「新增路由文件」「增删或重排页面的顶层区块」→ 需要设计稿）与页面清单：东方站 `/zh-hant`、`/zh-hans`、`/ko` 落地页、西方站 `/` 落地页、`/zh-hant/八字排盤`、`/ko/만세력`、`/life-path-number` 工具页、`/life-path-number/7`（面包屑）。验证：记录写入 design.md D8 下方
- [x] 1.2 【Claude】在 `refresh-visual-system-warm` 的画布中产出「落地页」画板：两站落地页桌面 1440 / 手机 390 × 浅 / 深，异常态包括每日运势页未上线（无今日条）、无可售方案（价格行只显示免费说明），以及三个工具页（紧凑布局、长文在结果后）。验证：画布链接可打开，画板矩阵完整，区块顺序与 `home-hub`「品牌落地页结构」一致
- [x] 1.3 【用户】确认四语首页 Title、H1 品牌承诺、副标题、主按钮文案与精选入口（design.md OQ4、OQ5），并答复 OQ1–3、OQ6–8（默认方案可整体采纳）。验证：使用者原话与结论写回 design.md，删去已定的 OQ；`openspec validate separate-landing-homepage --strict` 通过
- [x] 1.4 【用户】确认 1.2 的画板（可与 `refresh-visual-system-warm` 1.4 同一次确认）。【协调者】随该 change 1.5 保存副本并登记索引行，所属 change 填本 change。验证：索引行与副本存在

## 2. 路由、注册表与 SEO（WT-routes，【Claude】）

依赖：1.3。冲突点见执行约定。

- [x] 2.1 按 design.md D1 增加 `EASTERN_PAGES` 的三条 `bazi`，`$slug.tsx` 改为按 id 懒加载，并把 `bazi` 渲染为八字 / 만세력工具组件（不带 `hub`）；`easternPageCopy('home')` 改为 `'bazi'`；`registry.ts` 中 `bazi.paths` 改为三个关键词 slug。验证：单测断言三个地址可解析、`/ko/八字排盤` 与 `/zh-hant/만세력` 返回 404、Title 与迁移前首页一致；紫微页的静态脚本闭包不含八字主页组件（构建产物检查）
- [x] 2.2 新增 `routes/life-path-number/index.tsx`（长文与 FAQ 在结果之后），`numerologyContentPath('life-path-number')` 与 `life-path.paths.en` 改为 `/life-path-number`；`$number.tsx` 加面包屑与父页链接。验证：单测与 `numerology.spec.ts` 中对应用例改到新地址后通过；canonical 为 `https://arcanumber.com/life-path-number`（无结尾斜杠）
- [x] 2.3 在 `structured-data.ts` 新增 `webApplicationData` 与 `breadcrumbData`，按 D3 接入四个主工具页与 12 个数字页；两站首页 head 改为 `staticPage('/')` + Organization + WebSite，`home-copy.ts` 改用 1.3 确认的品牌标题。更新首页 head 对照测试的快照（Title 与 JSON-LD 类型有意改变，canonical / hreflang / robots 不变），并新增工具页 head 快照。验证：`seo` 单测、`seo.spec.ts` 与 head 对照测试通过；JSON-LD 中的 `url` 等于 canonical
- [x] 2.4 按 D4 在 `features/site/gate.ts` 新增 `legacyHomeRedirect`（`unlock` / `checkout` → 301 到主工具页并保留查询；东方站 `/` 直接一次跳转；UTM 不跳转），并实现落地页 `#r=` 片段跳转的内联脚本生成函数（构建期写入工具页地址，由第 4 组挂到首页 head）。验证：单测覆盖四个语言首页 × 有 / 无工具参数 × UTM、HEAD 请求、东方站 `/?unlock=`；脚本函数单测断言只在 hash 含 `r=` 时替换
- [x] 2.5 补注册表驱动功能的测试：预渲染清单、站点地图（新地址与 hreflang、首页仍在）、`llms.txt`、语言切换（`八字排盤` ↔ `八字排盘` ↔ `만세력`）、页头导航、OG 样例图挂到工具页、报告空态链接、optin 邮件链接。验证：`pnpm --filter @xuanxue/web test` 通过；`pnpm --filter @xuanxue/web build` 产物含三个新工具页与 `/life-path-number` 的 HTML 与 OG 图
- [x] 2.6 按 design.md D3a 实现页面 title 规则：`pageHead` 按语言选择分隔符与站名显示名、首页不追加站名、已含站名不重复；认证页、账户页、应用区各页与后台改为经同一函数生成标题；分享页改用当前站点的站名。验证：单测覆盖四种语言、首页与重复站名；`seo.spec.ts` 抽查两站工具页、定价页、法律页与登录页的标题；`pnpm --filter @xuanxue/web test` 通过

## 3. 站内链接与测试迁移（WT-links，【Codex】，评审【Claude】）

依赖：2。冲突点见执行约定。

- [ ] 3.1 按 design.md D5 表把站内仍指向首页工具的链接改为主工具页：
  - `bazi/common.tsx` 的 `pageHref('home')` 及其调用处（ziwei、mingpan、gunghap、concept 页），锚文本用关键词；
  - `numerology/copy.ts`；
  - `content/numerology/en/*.mdx` 中 14 处 `[Life Path calculator](/)`；
  - `content/concepts|guides|blog` 中以语言首页为排盘入口的链接；
  - `daily/today.server.ts`、`daily/east-page.tsx`、`profiles/profiles-page.tsx` 的 `#r=` 链接；
  - `east-english/page.tsx` 加主工具页链接（OQ7）。

  验证：`check-content` 新增规则（西方站内容不得以 `/` 作为计算器链接）并通过；全站预渲染 HTML 中没有锚文本为工具关键词、目标为语言首页的链接（脚本扫描结果写入 PR）
- [ ] 3.2 实现 D4 的 `legacyToolPath`，接入显示临时上下文「返回结果」链接的地方。验证：单测覆盖四个语言首页映射与其他路径原样返回
- [ ] 3.3 把在首页填写表单或断言首页 H1 / Title 的 e2e 改到工具 URL，首页改为断言落地页。涉及 `bazi`、`numerology`、`reading-unlock`、`reading-optin`、`analytics`、`ai-chat`、`i18n-preference`、`floating-controls`、`theme` 各 spec，以及 `staging/smoke`、`production/smoke`。新增 e2e：旧 `/#r=` 与 `/zh-hant#r=` 分享链接打开后显示结果；`/zh-hant?unlock=<测试令牌>` 跳到工具页并恢复输入。验证：本地离线 e2e 通过；冒烟用例在本组分支的 staging 预览上通过（如可用）

## 4. 落地页（WT-landing，【Claude】）

依赖：1.4、本 change 第 2 组，以及 `refresh-visual-system-warm` 第 3、4、5 组合并。冲突点：`routes/index.tsx`、`features/marketing/home-hub/`、`messages/<locale>/landing.json` 只由本组修改。

- [ ] 4.1 按 D2 改写 `routes/index.tsx` 为两站落地页：
  - loader 不再预载工具组件，删除 `TemplateHome` 回退，保留 `data-testid="version"`；
  - head 中挂上 2.4 的片段跳转脚本。

  验证：预渲染 HTML 不含表单输入控件；`check-home-bundle.mjs` 新增工具代码禁止标记后通过；`homeScriptGzipBudget` 检查通过，四个首页的实测体积写入 PR
- [ ] 4.2 按设计稿实现以下区块（复用 `Section`、站点插画与模板 `Steps`）：
  - 品牌主视觉；
  - 精选工具入口（`hubTools` 加精选清单与上限）；
  - 样例报告；
  - 一行价格（免费工具 + 每份详批积分数 + 每日赠送积分数，design.md D2a）；
  - 信任说明；
  - 品牌级 FAQ（不输出 FAQPage）。

  新增四语 `landing.json`。验证：
  - 组件测试断言区块顺序、入口 3–4 个、主按钮唯一且指向主工具页；
  - 价格行起价与定价页快照一致、无可售方案时无金额；
  - `readings/compliance.ts` 检查样例与首页文案（免费区块无 AI 字样）
- [ ] 4.3 按 D6 实现今日条：
  - 服务端只输出骨架；
  - 浏览器内计算东方站当日干支 / 西方站 Number of the Day；
  - 每日运势页未登记时不渲染。

  验证：纯函数与 `packages/bazi` 的 `dayPillarOf` 对拍 1,000 天一致；组件测试覆盖有 / 无运势页；Playwright 断言填入前后今日条尺寸不变
- [ ] 4.4 【Codex】按副本对照截图（两站落地页 390 / 1440 × 浅 / 深，加上两个异常态），运行 `refresh-visual-system-warm` 的 `visual-rules.spec.ts` 启用四个首页，并做 axe 检查。验证：截图与结果存入 `EVIDENCE_DIR`；度量规则全部通过，差异逐项交 4.2 修正或记为使用者确认的偏离

## 5. 工具页改版（WT-tool-pages，【Claude】）

依赖：同第 4 组。冲突点：`bazi/bazi-home.tsx`、`bazi/manseryeok-home.tsx`、`numerology/home.tsx`、`numerology/content-page.tsx`（长文位置）只由本组修改。

- [ ] 5.1 三个工具组件去掉 `hub` 属性（文件可改名，并同步两份允许名单），按 `tool-pages`「工具页紧凑布局」与设计稿改版：
  - H1 + 简介 + 表单；
  - 结果；
  - 内链与长文 / FAQ 放在结果之后；
  - 替换原始字号与任意值。

  验证：`visual-rules.spec.ts` 启用 `/zh-hant/八字排盤`、`/ko/만세력`、`/life-path-number`；390×844 首屏可见提交按钮；`bazi.test.tsx`、数字命理单测与 e2e 通过；本组条目从允许名单删除
- [ ] 5.2 【Codex】按副本对照截图（三个工具页 390 / 1440 × 浅 / 深 + 打印预览），并做 axe 检查。验证：同 4.4

## 6. 验收、发布与监测（协调者；外部动作需使用者授权）

依赖：2–5 全部合并。

- [ ] 6.1 【Codex】在 main 本地生产预览上按 design.md D7 测 Lighthouse：四个落地页与四个主工具页，基线为 `refresh-visual-system-warm` 2.1 的首页数值。同时检查：禁用 JavaScript 时首页与工具页含 H1、表单标签与区块文字；数据库不可达时完整显示。验证：
  - 工具页 LCP 中位数不高于基线的 110%；
  - 落地页 LCP 不高于基线；
  - CLS 中位数 < 0.1；
  - 记录存入 `EVIDENCE_DIR`
- [ ] 6.2 【Codex】【需使用者授权】部署 staging 后逐项核对：
  - 旧首页 `?unlock=` 与 `?checkout=` 跳转为 301 且保留查询，UTM 不跳转；
  - 旧 `#r=` 链接（四个语言首页）显示结果；
  - 四个首页与工具页的 canonical、hreflang、JSON-LD；
  - 站点地图与 `llms.txt`；
  - 语言切换；
  - 页头与页脚链接；
  - 手机实机走查落地页 → 工具页 → 结果 → 解锁回跳。

  验证：核对表存入 `EVIDENCE_DIR`
- [ ] 6.3 【用户】上线前一周内导出 Search Console 基线（design.md D9 的查询清单，近 28 天，两站），也可授权【Codex】在使用者已登录的浏览器中导出。验证：基线文件存入 `EVIDENCE_DIR`
- [ ] 6.4 【用户】审阅 6.1–6.3 证据，授权生产发布。验证：使用者在会话中确认
- [ ] 6.5 【协调者】随常规版本发布生产（与 `refresh-visual-system-warm` 同批或之后），确认 main 部署流水线成功、两站 `/api/health` 版本 SHA、发布流水线的 IndexNow 提交日志；【Codex】在 Search Console 提交站点地图，并对三个新工具页与 `/life-path-number` 请求编入索引。验证：发布记录、健康检查与 IndexNow 日志存入 `EVIDENCE_DIR`
- [ ] 6.6 【Codex】上线两周后按 D9 对照基线检查：新 URL 收录、落地 URL、主词展示与排名、首页与工具页是否争同一查询。【协调者】把结论写入项目日志（`kb_journal`），未达标时提出内链与文案调整（不做首页跳转）。验证：对照表存入 `EVIDENCE_DIR`，日志条目存在
- [ ] 6.7 【协调者】`redesign-home-chart-visuals` 归档后再归档本 change（`home-hub` 主规格须先存在）。验证：`openspec archive` 成功，主规格 `home-hub`、`eastern-tool-pages`、`numerology-pages`、`seo` 含本 change 的要求
