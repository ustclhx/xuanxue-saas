## Context

依据：使用者任务 `~/workspace/xuanxue-saas-evidence/seo-fix-20261119/task.md`（2026-11-19 原文与文末补充决定，下称 task.md），
内链规范见 task.md §3 与使用者记忆 internal-link-rules。第 1、2 步（牌义索引、相关牌链接、生命灵数总览与相邻数字）已在 #231 完成，
模板 0.7.4（#235）已配置 `seo.linking.sites`，`check:links` 按站点分图报告。本变更是 A 部分：第 3、6、7 步与 §5 验收。

使用者决定（作为约束，不再讨论）：

- 第 4 步（zh-hant canonical 指向 zh-hans）**作废**：canonical、hreflang、站点地图与 robots.txt 一律不动，繁简重复靠第 5、7 步的真实差异解决。
- 纯文本提到另一站名称（FAQ、法律页运营方段落）可以保留；只禁止两站互链。
- 页头频道链接 12 个（`header-links` 警告，建议 3–7）是导航设计问题，本变更不改页头，只记录。
- 第 5 步（繁简内容差异化）由另一个变更处理，本变更只写繁简首页 Description。

## Goals / Non-Goals

**Goals：** 首页不再抢 `/life-path-number` 的词；四个首页 H1 含主词；分享页不进索引但跟随链接；全站 Title／Description 按口径核对，
只改违规项；两站内链验收（task.md §5）有可复跑的脚本并清零。

**Non-Goals：** 不改 URL、canonical、hreflang、站点地图、robots.txt 与页头；不新增页面与语言；不为插链接新造句子。

## Decisions

### 1. 字数口径（task.md §2.7）

字数只是上限参考，不是改 Title 的理由。

| 语言 | Title | Description | 计数方式 |
|---|---|---|---|
| 英文 | 40–60 字符 | 140–160 字符 | 字符数 |
| 中文（繁、简） | 20–30 字 | 70–80 字 | 全角宽度：汉字与全角标点计 1，ASCII 与空格计 0.5 |
| 韩文 | 同中文 | 同中文 | 同中文：谚文音节按全角计 1，空格与 ASCII 计 0.5 |

韩文规则的理由：一个谚文音节与一个汉字在搜索结果中的显示宽度相同，词间空格是半角；按此口径韩文与中文共用 20–30／70–80。
脚本实现为 `audit-seo.mjs` 的 `cjkWidth()`。

改动规则：
- **Title** 只在两种情况下改：关键词归属错（两页抢同一个词），或 H1 不含任何主词（此时改 H1）。
- **Description** 超出上限的压到上限内；低于下限的不改，除非 task.md 点名（东方站繁简首页、arcanumber 牌义页）。
- task.md 点名不改的：arcanumber 首页 Description（144）、`/life-path-number` Description（155）、牌义页 Title。

### 2. 分享页 noindex, follow

`/s/<类型>/<令牌>` 的 robots meta 与 `X-Robots-Tag`（含 404 与 429）改为 `noindex, follow`：不进索引，但页内指向站点的链接可被跟随。
`/share-card/<类型>/<文件>` 是 PNG 图片路由，没有 HTML，保持响应头 `X-Robots-Tag: noindex`。工具页的 `?r=` 分享兼容链接属于 tool-pages 规范
（`noindex, nofollow`），不在第 6 步范围内，不动。robots.txt 不变，已收录的分享页靠 noindex 自然退出。

### 3. 首页 Title、H1 与繁简 Description

- arcanumber Title：`Numerology & Tarot Calculators, Free | Arcanumber`（品类主词在前、站名在后；`pageHead` 见到站名不再追加）。
- H1：arcanumber `Numerology & Tarot, Calculated Step by Step`；简体 `免费八字排盘、紫微斗数与塔罗占卜`；繁体 `免費八字排盤、紫微斗數與塔羅占卜`；
  韩语 `무료 사주 만세력, 궁합과 타로`。韩语站没有자미두수页面（东方站韩语只有만세력、사주궁합、타로与오늘의 운세），
  H1 写入자미두수会承诺一个不存在的工具，因此改用韩语站实际的主词：사주、만세력、궁합、타로。
- 繁简 Description 各写一版：简体以「干支日提供……：输入……，按传统规则排出……」的陈述句；繁体以「想讀懂自己的命盤？」设问开头，
  再写输入、排出与抽牌；用词与句序都不同，两版都保留合规表述「仅供参考与潜意识探索」。
- 东方站首页 Title（`干支日｜免费八字排盘、紫微斗数与塔罗`，18 字）低于 20 字但不违规，不改。东方站首页与 `/八字排盘` Title 都含「免费八字排盘」：
  与使用者指定的首页 H1 一致，视为使用者接受的品牌页写法，不按抢词处理（PR 中列为判断项）。

### 4. TDK 全站核对结果（改动）

| 页面 | 项 | 改前 | 改后 | 理由 |
|---|---|---|---|---|
| west `/` | Title | Arcanumber — Free Life Path Number Calculator, Numerology & Tarot（65） | Numerology & Tarot Calculators, Free \| Arcanumber（49） | 抢 `/life-path-number` 主词（task.md 第 3 步） |
| west `/` | H1 | Know your numbers | Numerology & Tarot, Calculated Step by Step | H1 不含主词（task.md 第 7 步指定） |
| east `/zh-hans` | H1 | 排一张命盘，读懂自己 | 免费八字排盘、紫微斗数与塔罗占卜 | 同上 |
| east `/zh-hant` | H1 | 排一張命盤，讀懂自己 | 免費八字排盤、紫微斗數與塔羅占卜 | 同上 |
| east `/ko` | H1 | 내 사주를 차분히 읽어 보세요 | 무료 사주 만세력, 궁합과 타로 | 同上（见决策 3） |
| east `/zh-hans` | Desc | 41 字 | 78 字（新写） | task.md 指定 70–80 且繁简不同 |
| east `/zh-hant` | Desc | 41 字 | 74 字（新写） | 同上 |
| west `/tarot/cards/*`（78 页） | Desc | 约 119–133 字符的同一模板 | 145–158 字符：牌名主词 + 正逆位关键词 + 覆盖面 | task.md 指定补到约 150 |
| west `/daily-numerology` | Desc | 183 | 148（最长日期 152） | 超上限 160 |
| west `/daily-numerology` | H1 | Your Number Today | Your Number of the Day | H1 不含主词「Number of the Day」 |
| west `/numerology-calculator` | Desc | 175 | 158 | 超上限 |
| east `/en` | Desc | 174 | 150 | 超上限（英文页按英文口径） |
| east `/en` | H1 | Chinese and Korean birth charts, explained in English | Bazi, Zi Wei and Saju birth charts, explained in English | H1 不含 Title 的任何主词 |

未改动（逐页核对后保留）：

- **Title 超过 60 字符／30 字但不改**（105 页）：西方站数字页、牌义页、工具页带站名后多在 65–79 字符；东方站 `/八字排盘`（32）、`/ko/만세력`（33）、
  `/ko/사주궁합`（32）、`/ko/오늘의-운세`（36）及 2 张韩语牌义页。字数不是改 Title 的理由，且这些页面主词都在最前。
- **Title 低于下限但不改**：法律页、FAQ、定价、通讯、牌阵页等（如 `Card of the Day | Arcanumber`）。`/tarot/daily` 的 Title 未含 Tarot，但 H1
  `Tarot Card of the Day` 含主词，按规则不改 Title。
- **关键词归属核对**：`/八字排盘` 的 Title「免費八字排盤｜生辰八字命盤查詢、…」含「命盤查詢」，与 `/命盤查詢` 页的主词重叠；该 Title 由
  - 使用者 2026-11-20 选择去掉「命盤查詢」：简体改为「免费八字排盘｜在线生辰八字排盘、大运流年与喜用神解析」，繁体另写为「免費八字排盤｜線上排出四柱八字，看大運流年與喜用神」；主词「命盘查询」归 `/命盘查询` 页。
  `openspec/specs/eastern-tool-pages` 的「首页主词工具页」要求逐字规定，本变更不越过既有规范修改，列为待使用者决定的建议。
  其余页面主词不重叠（数字页按数字区分；`/name-numerology`、`/numerology-calculator`、`/destiny-number`、`/soul-urge-number` 只在次要词上重叠）。
- **Description 低于下限但不改**：法律页、定价、FAQ、通讯、东方站概念页与牌义页（中文 41–46 字）、韩语页面等，不在 task.md 点名范围。

### 5. 内链验收口径与锚文本表述策略

审计脚本 `apps/web/scripts/audit-seo.mjs`（项目自有，复用 `check-links.mjs` 的 `hostRequest` 与 `check-links-graph.mjs` 的解析，
按 `seo.linking.sites` 分站抓取站点地图全部地址与语言首页）：

| 检查 | 口径 |
|---|---|
| 孤岛 = 0 | 与 check:links 相同：可索引页没有任何站内入链（任何区域，站点地图不计） |
| 死链 = 0 | 站内链接目标 4xx/5xx |
| 每页正文内链 2–5 | 正文 = 未标记区域（docs/seo-internal-linking.md §3），按不同目标计数；首页与被面包屑当作上级的 hub 页不设上限；超过 5 的非 hub 页只提示（「已有 5 个的不再加」） |
| 钱页入链 ≥3 | 来源页数，计正文与模板区块，不计导航层（页头、页脚、面包屑）与转化入口；首页按全部区域计 |
| 锚文本 ≤2 种 | 同一目标页全站正文锚文本（忽略大小写与首尾箭头）；同一来源页对同一目标的同一表述只计一次 |
| top1 ≤70% | 目标页正文入链 ≥5 条时检查；3–4 条只提示 |

top1 门槛取 5 条的理由：在 ≤2 种表述下，3 条入链最多 2:1（67%），4 条必须 2:2，一条锚文本就让占比摆动 25–33 个百分点；
5 条起才能以 3:2 稳定满足，且不必为凑比例造锚文本。

正文内链下限的已记录例外：`/privacy`、`/refund`、`/disclaimer`、`/newsletter`（四种语言共 16 页）。法律页与通讯页只有 0–1 句能自然带出站内链接的现成句子，
按「不为插链接新造句子」跳过；`/terms` 有 4 条，满足。

区域与锚文本修正（都在服务端输出的真实 `<a>` 上）：

1. **转化入口标 `action`**：首页首屏唯一主按钮、牌义页与数字页页尾的转化条（`LinkBand`）、概念页的「用本站工具算你的」（`ContentFunnel`）。
   这三类是 docs/seo-internal-linking.md §3 定义的转化入口，不计入正文内链数与锚文本统计。牌义页正文因此是 4 条延伸牌义，数字页是 2–3 条相邻数字加相性链接。
2. **首页工具卡片**：链接只包住工具名（`h3 > a`，伪元素铺满卡片，整卡仍可点、焦点环画在卡片外沿），锚文本是目标主词，不再是整张卡片的文字。
3. **牌义页延伸牌义两种表述各半**：每张牌恰好被 4 张牌链接；按来源牌顺序，第 1、3 个来源用「<牌名> tarot card meaning」，第 2、4 个来源用牌义索引的
   「<牌名> Tarot」（四种语言同一规则）。加索引页 1 条，每张牌 5 条入链为 2:3。
4. **概念页同组链接 3 条**：同语言 8 个概念首尾相接，每页链接其后 3 页（每个概念恰好 3 条同组入链）；正文内链由 8 条降为 4 条（主工具页 + 3 个概念）。
5. **第二种表述只移动方括号或补一个字，不改句意**：牌阵互导句（`three-card tarot spread`、`tarot card of the day`、`三张牌塔罗占卜`、`每日一张塔罗牌`、
   `쓰리 카드 타로 배열`、`오늘의 타로`）；数字页相性句「[life path compatibility matrix]」（2、4、6、8、11 号与 Soul Urge 页）；
   繁中每日运势「可以在紫微斗數裡看流年」。
6. **第三种表述去掉**：`/life-path-number` 正文「compatibility calculator」去掉链接保留文字（页尾工具列表已链接）；西方站首页「更多工具」链接改为
   `Life path compatibility →`。
7. **通讯页孤岛**：四种语言隐私政策「电子邮件订阅」一节的现成句子「如果你订阅电子邮件更新……」把「电子邮件更新」链接到本语言 `/newsletter`；
   不改页脚（页脚属于导航层，且 task.md 要求链接放正文）。

### 6. 钱页（task.md §4）

登记在 `template.config.ts` 的 `seo.linking.moneyPages`（地址不带语言前缀；东方站只有首页命中）：

`/`、`/destiny-number`、`/name-numerology`、`/numerology-calculator`、`/life-path-number/11`、`/tarot/cards/` 下的 the-sun、the-magician、death、judgement、
the-hermit、the-world、eight-of-pentacles、strength、the-devil、knight-of-pentacles、the-moon、five-of-swords、the-high-priestess。

`/destiny-number` 原来只有 2 个正文来源。数字命理计算器的结果含 Expression（Destiny）数，其页尾相关工具由「Life path compatibility」换成
「Destiny (expression) number」，补足第 3 个来源；相性页仍有十余条入链。

## Risks / Trade-offs

- [首页卡片结构变化影响视觉] → 卡片样式移到 `li`，链接只改包裹范围；整卡点击、悬停底色与焦点环保持；首页 HTML 与脚本预算由 build 检查。
- [延伸牌义同一列表中出现两种锚文本写法] → 两种都是使用者确认过的表述（延伸牌义与牌义索引），只是按来源分配。
- [概念页同组链接减少] → 每个概念仍有 3 条同组入链；主工具页与命盘查询页另以问题式锚文本链接其中 4 个概念。
- [top1 门槛与例外是本变更的判断] → 在设计与 PR 中列明，3–4 条入链的目标页与 16 个例外页都在审计报告的提示栏中可见。
