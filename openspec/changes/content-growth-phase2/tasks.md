# Tasks

> 并行与共享文件说明（遵守 docs/09-parallel-plan.md §3、§6）：
> - **波次**：
>   - 第一波：第 1、2、3 组可以同时开始。第 4、5、6 组的文案可以立即开写；代码与页面实现要等第 1 组（分发骨架、测量）与第 2 组（引擎）合并，UI 实现还要等第 3 组第一批设计稿确认。
>   - 第 7 组是 12-02 复查关口，由协调者执行。
>   - 第二波：第 8、9、10 组的文案可以提前写，合并在第 7 组裁定之后，按 design 决策 15 裁剪。
>   - 第 11 组由协调者在全部合并后执行。
> - **共享文件**：
>   - `apps/web/src/routes/$slug.tsx`、`apps/web/src/routes/$section/$item.tsx`：只由第 1 组修改。其他组只在 `features/east-content/routes.ts` 追加映射，冲突时合并两边的条目。
>   - `apps/web/content-collections.ts`：
>     - `zodiac` 集合由第 4 组建 schema，第 5、9 组只加内容文件，需要加字段时找第 4 组的 owner 或在 rebase 时合并；
>     - `almanac` 归第 6 组；`ziweiStars` 归第 8 组；`concepts` 的 `conceptKey` 枚举归第 10 组；
>     - 各改各的集合块。
>   - `apps/web/src/features/tools/registry.ts`：第 4、5、6、8、10 组各自追加条目。生肖的 zh-Hans 与 ko 路径放在同一条目里，第 5 组只补 ko 的路径与标题；冲突时合并两边。
>   - `apps/web/src/features/tools/bazi/eastern-routes.ts`（`CONCEPT_SLUGS`）与注册表的 `conceptKeys`：只由第 10 组修改。
>   - `packages/bazi/package.json`（`exports` 子入口）与 `packages/bazi/src/index.ts`：只由第 2 组修改。
>   - `apps/web/src/features/daily/page-cache.ts`、`daily/rules/*.ts`：只由第 6 组修改（缓存泛化、补充释义）；第 4 组不改每日规则。
>   - `apps/web/scripts/locale-similarity.mjs`、`measure-locale-similarity.mjs`：只由第 1 组修改。
>   - `apps/web/messages/<locale>/{zodiac,almanac,ziwei-stars}.json`：按功能新建。如果文案检查要求各语言键齐全，由第 4 组一次建好 zh-Hans 与 ko 两份键，第 5 组只改 ko 的值。
>   - `docs/design/prototypes/README.md`：只由第 3 组登记。
>   - 私有证据目录 `content-growth/keyword-ownership.md`：各组把补登条目写在 `content-growth/phase2/<组号>/keyword-ownership-add.md`，由协调者并入（同第 1 阶段第 5 组做法）。
> - **约束**：不做婚姻、配对类内容（design「约束」）；不改现有 `/ko/사주궁합`。不涉及 schema 与迁移，不改 `pnpm-lock.yaml`。只勾选分配给自己的编号。
> - **建议执行者**：
>   - 第 1、2 组交给 Codex（工具与纯函数，有单测可以把关），由 Claude 审阅；
>   - 第 3 组交给 Claude（ui-design；设计与审美类工作按约定由 Fable 承担）；
>   - 第 4、5、6、8、9、10 组交给 Claude（文案量大、带 UI），zh-hans 文案由 Codex 做事实与合规审阅，ko 与 zh-hant 由 Codex 回译审阅（design 决策 14）。
> - **每组 PR 的通用验收**：
>   - `pnpm check`、`pnpm typecheck`、`pnpm check:deps`、相关单测；
>   - `pnpm --filter @xuanxue/web build`，包括首页包预算；
>   - 构建后 `check:links`、`audit:seo`、`check:i18n-seo` 不比 main 退步；
>   - 婚配类禁用词审计为 0（design「约束」）。
>   - 证据写入私有证据目录 `content-growth/phase2/<组号>/`，PR 只引用路径。

## 1. 测量工具、关键词归属与路由分发骨架

- [x] 1.1 在 `apps/web/scripts/locale-similarity.mjs` 增加东方站程序化集合的定义：`zodiac`（zh-Hans、ko、zh-Hant）、`almanac-month`、`ziwei-star`、`concepts`（新篇）。按 H2 标题对齐，中日韩按字二元组两两平均。标有 `data-table-section` 的段只报告、不计门槛，同时输出整页相似度。补 `measure-locale-similarity.test.mjs` 单测
- [x] 1.2 在 `measure-locale-similarity.mjs` 的报告中输出「东方站集合」表（每集合每段的平均与最差页）。`--enforce zh-Hans,ko` 时任一受约束段 >0.30 以 1 退出。在 main 构建上跑一次，确认现有东方站页面不受影响。报告存证据目录
- [x] 1.3 在私有关键词归属表中，按 design 决策 9 把本 change 的主词登记为「计划」，并用第 1 阶段的核对脚本确认当前没有可索引页以这些词为 Title 或 H1 开头（重点核对每日页与「黄历」、概念页与「太岁」）
- [x] 1.4 新建 `apps/web/src/features/east-content/`：`routes.ts` 是地址到页面 id 的映射，不引用运行时模块，初始为空集合；`route-data.ts` 是按需加载的 loader 与 head 分发。`routes/$slug.tsx` 增加东方内容单段页的懒加载分支；`routes/$section/$item.tsx` 改为按语言与首段分发，en 仍走 east-en 塔罗，东方站 zh-hans、ko 走 `east-content`，其余返回 404（design 决策 2）。单测覆盖未登记地址 404、西方站同路径 404、现有 east-en 与排盘页不变。`check-home-bundle` 记录前后数据，首页包增长 ≤2 KB gzip

## 2. 引擎补充（packages/bazi）

- [x] 2.1 新增子入口 `@xuanxue/bazi/almanac`：`almanacDay(date)`（在 `dayPillarOf` 基础上加黄道十二神与黄道黑道、所冲生肖、煞方、当日节气、节日与节令：三伏、数九、入梅、出梅）与 `almanacMonth(year, month)`（逐日数据、本月两个节气的交节时刻、月建变化日、农历月界）。导出 `ALMANAC_RULES_VERSION`。输出只含稳定 key 与序号
- [x] 2.2 在同一子入口增加 `zodiacYears(branch, { utcOffsetMinutes })`（1924–2043，每行有干支、纳音、立春时刻、春节日期）、`zodiacBoundaries()`（客户端属相查询用的立春与春节边界表）、`nayinTable()`、`terrainTable()`
- [x] 2.3 `@xuanxue/bazi/ziwei` 增加 `majorStarFacts()`：14 主星的五行、阴阳、十二支庙旺、十干四化归属，以及按紫微所在宫推出的同宫主星，数据来自 iztro `data/stars` 与 `data/heavenlyStems`
- [x] 2.4 单测：用 devDependency `lunar-javascript` 交叉核对 1924–2043 每年的立春与春节、六十甲子纳音、2026 全年逐日的建除与冲煞；固定 design Context 中的实测值（2026-11-22 庚子、白虎黑道、冲马煞南；2025 立春 2-03 22:10、春节 1-29）；核对紫微星乙年化科、壬年化权。确认 `@xuanxue/bazi` 主入口不引入新模块（`check-bazi-build` 通过），不改 `pnpm-lock.yaml`

## 3. 设计稿（ui-design）

- [ ] 3.1 第一批：按 `ui-design` 技能在一张「content-growth-phase2」Design 画布上画 design 决策 10 第一批的全部画板（生肖枢纽、生肖子页四态、ko 子页手机、生肖异常态、黄历工具四态与异常态、月份页三块、EastNavVariant），使用 `@xuanxue/ui` 组件与 token。交给使用者确认，记录原话；EastNavVariant 画板必须保留，页头是否加入「黄历」「生肖」由使用者看该画板后决定（使用者 2026-11-22 裁定）。未确认前第 4、5、6 组不开始 UI 实现
- [ ] 3.2 第一批确认后，用 Artifact `read` 取回画板副本，存入 `docs/design/prototypes/content-growth-phase2/`，并在原型索引登记每个页面一行
- [ ] 3.3 第二批：在同一画布追加十四主星枢纽、主星页（桌面、手机）与不知道时辰的状态，交使用者确认并存副本、登记索引。第 7 组裁定暂停第 8 组时，本项标注「随第 8 组暂停」

## 4. 生肖枢纽与 12 生肖页（zh-hans）

- [x] 4.1 在 `content-collections.ts` 新建 `zodiac` 集合，schema 含 `branch`、`slug`、`years_note`、`relations_note`、`annual`（以干支为键）、`faq`。新建 `features/east-content/zodiac/`：子页与枢纽组件、年份表、关系表、「本年与次年」区块（缺少 `annual` 时只列关系名），以及枢纽的属相查询小工具（用 `zodiacBoundaries()`，客户端不加载 tyme4ts）。在 `east-content/routes.ts` 登记 zh-hans 地址；注册表加枢纽与子页条目（导航按 3.1 的结论）；构建期预渲染。单测覆盖：年份表与引擎一致、立春前出生的提示、缺 `annual` 的降级、hreflang 只含已发布语言
- [x] 4.2 Claude 子代理撰写 `content/zodiac/zh-Hans/` 的 `index.mdx` 与 12 篇：按 design 决策 4 的段落结构与决策 11 的 TDK 草案定稿；子页正文 ≥1,500 字，枢纽页 ≥1,000 字；`annual` 写丙午、丁未两年。遵守「约束」，关系段只写一般规则。所有干支、日期、纳音由引擎复算并通过校验
- [x] 4.3 Codex 做 zh-hans 事实与合规审阅，意见与处理记录存证据目录
- [x] 4.4 验收：
  - 组内相似度 `--enforce zh-Hans` 通过（各段 ≤0.30）；
  - 长度下限、TDK 长度通过；
  - `audit:seo` 显示正文内链 2–5、锚文本 ≤2 种、top1 ≤70%（design 决策 12）；
  - `check:links` 无孤岛；
  - 婚配类禁用词审计为 0；
  - 390×844 截图核对年份表与属相查询；
  - 在每日页、八字排盘长文的现成句子中加入链（每页最多 1 条）；（第 4 组：两处 zh-hans 都没有提到「生肖」的现成句子，按不新造句子规则未加；改由概念页「身强身弱」现成句子「不是她的生肖龙」链到属龙）
  - 关键词归属补登

## 5. 生肖页（ko）

- [x] 5.1 补 ko 所需的标签：纳音 30 种的韩语写法、地支关系名、만 나이说明等，写入 `messages/ko/zodiac.json` 或组件文案表。年份表的立春时刻按 UTC+9 显示，并加历史时区表注。在 `east-content/routes.ts` 与注册表补 ko 地址与标题（`/ko/띠`、`/ko/띠/쥐띠` 等）
- [x] 5.2 另一个 Claude 子代理按韩语搜索词直接撰写 `content/zodiac/ko/` 的 `index.mdx` 与 12 篇（主词为「띠」「쥐띠」…，副词如쥐띠 나이、띠 계산），不由中文翻译；不以「띠별 운세」为 Title、H1、H2 或锚文本目标，流年段用「올해 흐름」一类写法（使用者 2026-11-22 裁定）。子页 ≥2,000 字，枢纽 ≥1,300 字，`annual` 写 병오、정미两年。遵守「约束」，不写 궁합 类内容
- [ ] 5.3 Codex 回译审阅：`measure-locale-backtranslation --export-input` 导出，Codex 回译后用 `--from-file` 计算；ko↔zh-hans 跨语言结构直译分在门槛内。意见与处理记录存证据目录
- [x] 5.4 验收：
  - ko 组内相似度 `--enforce ko` 通过；
  - 长度与 TDK 通过；
  - 与 zh-hans 互为 hreflang，canonical 自指；
  - 内链与禁用词审计通过；
  - Title、H1、H2 与锚文本不含「띠별 운세」；
  - 390px 截图核对长韩文标题；
  - 从 `/ko/만세력` 长文的现成句子加入链（最多 1 条）；（第 5 组：만세력长文没有提到「띠」的现成句子，按不新造句子规则未加；改由概念页「일주」「원숭이띠는 연지 신에서」链到원숭이띠、「용신」「띠를 정하는 연지」链到枢纽）
  - 关键词归属补登

## 6. 黄历工具页与 12 个月份页（zh-hans）

- [x] 6.1 泛化 `features/daily/page-cache.ts`，使黄历工具页与月份页使用同一边缘缓存（键为规范 URL、参考日期与部署版本，TTL 为距参考日结束的秒数，最长 3600）。每日页现有单测保持通过，补黄历路径用例
- [x] 6.2 新建 `features/east-content/almanac/`：
  - 工具页：日期选择写入 `?date=`；有参数时输出 `noindex, follow`，canonical 恒为 `/zh-hans/黄历`；错误态。
  - 月份页：年份滚动取最近一次尚未结束的该月；逐日表中宜最多 4 项、忌最多 3 项，其余放入 `<details>`；节气与节令区；系列上一篇、下一篇。
  - 宜忌名称复用 `daily/rules/zh-Hans.ts` 并沿用 `HIDDEN_TABOOS`，嫁娶等词条不加入隐藏列表，按原样作为众多词条之一列出（使用者 2026-11-22 裁定）；补充黄道十二神与煞方的名称与释义。
  - 注册表登记时标 `prerender: false`；站点地图只含 13 个不带参数的地址。
  - 单测覆盖：年份滚动（2026-12-10 打开 1 月显示 2027）、带参数时 noindex、逐日页地址 404、数据库不可达时 200
- [x] 6.3 Claude 子代理撰写：
  - 工具页说明 ≥1,200 字，含建除十二值星、黄道黑道十二神、冲煞的传统含义与读法；
  - `content/almanac/zh-Hans/1.mdx` … `12.mdx`，按 design 决策 5 写每月的 `lede`、节气与节令说明、宜忌读法与 FAQ，正文 ≥600 字。
  - 不写结婚、嫁娶吉日类段落（「约束」）。Codex 做事实与合规审阅
- [x] 6.4 验收：
  - 月份页组内相似度：说明段与 FAQ ≤0.30，逐日表与整页单独报告；
  - TDK 与长度通过，12 个月份页的 Title、H1 两两不同；
  - preview 请求 `?date=` 地址带 noindex、canonical 正确；
  - 第二次请求命中缓存；
  - 内链、禁用词审计通过；
  - 390×844 截图核对月份页的手机卡片；
  - 从每日页「黄历规则」一句加入链；
  - 关键词归属补登

## 7. 12-02 复查关口（协调者）

- [ ] 7.1 12-02 之后读取 GSC（ganjiday）的「已抓取-尚未编入索引」、已编入页数、平均排名与曝光，与 11-18 基线（193 / 111 / 16.7）对比，并列出第一波新页面的抓取与编入状态。报告存证据目录
- [ ] 7.2 按 design 决策 15 的 ±15% 裁剪规则（使用者 2026-11-22 采纳）形成裁剪结论（第 8、9、10 组各自做、缩或停），交使用者裁定。在本文件对应组的标题后注明裁定结果与日期；被裁掉的任务标注「已裁剪（日期，使用者原话）」，不勾选

## 8. 紫微十四主星（zh-hans，第二波）

- [ ] 8.1 在 `content-collections.ts` 新建 `ziweiStars` 集合，schema 含 `star`、`slug`、`brightness_note`、`faq`。新建 `features/east-content/ziwei-stars/`：枢纽与主星页组件（沿用概念页结构）、四张引擎表格（数据来自 `majorStarFacts()`，构建期计算）、嵌入紫微排盘表单，提交后高亮本星所在宫位，不知道时辰时给出提示。iztro 只在主星页按需加载。登记地址与注册表，构建期预渲染。单测覆盖表格与引擎一致、高亮宫位、requiresHour
- [ ] 8.2 Claude 子代理撰写枢纽页（≥1,000 字）与 14 篇主星页（≥1,500 字，按 design 决策 7 的 H2）。夫妻宫按十二宫统一写法带过，不单独展开婚姻推断。Codex 做事实与合规审阅
- [ ] 8.3 验收：
  - 组内相似度 ≤0.30；
  - TDK 与长度通过；
  - 内链：每页链接紫微斗数排盘，枢纽列出 14 页；
  - 禁用词审计通过；
  - 390px 截图核对表格与嵌入表单；
  - 从紫微斗数排盘长文的现成句子加入链；
  - 关键词归属补登

## 9. 生肖页（zh-hant，第二波，可裁）

- [ ] 9.1 按第 7 组裁定执行。另一个 Claude 子代理另写 `content/zodiac/zh-Hant/` 的 `index.mdx` 与 12 篇（`/zh-hant/生肖/屬鼠` 等），不做字形转换；在 `east-content/routes.ts` 与注册表补 zh-hant 地址
- [ ] 9.2 验收：
  - `measure-locale-similarity --opencc` 同文字变体门槛（整页 ≤0.60、整句 ≤0.15、FAQ ≤0.40）；
  - zh-hant 组内相似度 ≤0.30；
  - Codex 回译审阅 TDK；
  - 三种语言互为 hreflang；
  - 内链、禁用词审计通过；
  - 关键词归属补登

## 10. 八字概念补齐（zh-hans，第二波）

- [ ] 10.1 在 `eastern-routes.ts` 的 `CONCEPT_SLUGS['zh-Hans']`、注册表 `conceptKeys` 与 `content-collections.ts` 的 `conceptKey` 枚举中登记第 7 组裁定保留的概念（design 决策 8 的 key 与 slug）。为每篇指定 `block`。确认 zh-hant、ko 的 hreflang 不含新概念
- [ ] 10.2 写一个脚本，从引擎生成 A 档表格的 MDX（纳音表、十二长生表、藏干表、关系表、太岁对照），并扩展 `check-content-concepts` 逐格核对
- [ ] 10.3 Claude 子代理撰写各篇，正文 ≥1,500 字，FAQ 3–4 问：
  - A 档嵌入生成的表格；
  - B 档（格局、调候）写明本站排盘不自动判定；
  - 合冲刑害页遵守「约束」。
  - Codex 做事实与合规审阅
- [ ] 10.4 验收：
  - 新概念组内相似度 ≤0.30；
  - 同组环中每篇 ≥3 条同组入链；
  - 正文内链 2–5（含八字排盘），太岁页链接生肖枢纽；
  - TDK 与长度通过；
  - 禁用词审计通过；
  - 关键词归属补登

## 11. 集成验收（协调者，全部合并后在 main 上执行）

- [ ] 11.1 main 生产构建后运行 `measure-locale-similarity --site east --enforce zh-Hans,ko`，东方站集合全部通过；运行 `check:links`、`audit:seo`、`check:i18n-seo`，孤岛与死链为 0；婚配类禁用词审计为 0。报告存证据目录
- [ ] 11.2 并入各组的关键词归属补登，把状态改为「现行」，并运行核对脚本：冲突为 0，各语言可索引页的 Title、H1 两两不重复
- [ ] 11.3 随统一发版上 staging，抽查 `/zh-hans/生肖/属马`、`/ko/띠/쥐띠`、`/zh-hans/黄历`（带与不带 `?date=`）、`/zh-hans/黄历/1月` 的 TDK、robots、canonical 与缓存头；确认数据库不可达时这些页面仍为 200。生产发版需使用者授权。站点地图重提与请求编入索引并入全部工作完成后交给 Grok bot 的清单（不在本 change 内执行）
- [ ] 11.4 在私有证据目录写年度维护备忘（每年 11 月补次年 `annual`；立春后核对「本年」切换），并在 2–4 周后按集群复查 GSC
