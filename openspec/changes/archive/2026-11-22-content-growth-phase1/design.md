# Design

## Context

动机见 proposal.md「Why」。本节只记录决定做法的现状事实，均于 2026-11-22 在 main `3436acb9b` 的生产构建上核实。

### 1.1 组件段的现状与基线

牌义页的组件位于 `apps/web/src/features/tools/tarot/meaning-page.tsx`：

- **导语**：`<header>` 内 H1 下方的 `<p>`，内容是 `content.description`，也就是 frontmatter 的 meta description。en 版是固定句式：「X tarot card meaning: … upright, … reversed. Covers symbolism, love, career, advice and Yes or No.」
- **速览**：`<dl>`，标签固定。
- **抽一张**：`TryOneCard`，标题 `tarot_meaning_try`，说明 `tarot_meaning_try_intro`，按钮 `tarot_meaning_draw`，三者每页逐字相同。
- **延伸牌义**：`RelatedMeanings`，说明句是 `tarot_related_intro_major/minor` 两种句式，每条链接的小字标签也固定。

数字页由 `apps/web/src/routes/life-path-number/$number.tsx`（en）与 `$slug.tsx` → `slug-page.tsx`（es）渲染，版式是 `numerology/content-page.tsx`：

- **首屏样例**：`LifePathCalculator`，样例日期取自 `calc.ts` 的 `exampleDateFor(n)`，结果卡是 `parts.tsx` 的 `LifePathCard`。卡内依次是一句数字摘要、计算步骤（`data-locale-fixed`）、一句短声明「For reference and self-reflection. Not a prediction of the future.」，结果区底部另有 `ToolPage` 的 `<Disclaimer />`。
- **其余数字**：`NeighborNumbers`，文案是 `numerology_neighbors(_master/_root)` 句式，用 `InlineLinks` 输出 2–3 条真实链接。

**基线**：按 `<main>` 中 H2 切段、按段标题对齐（不按位置），词二元组 Dice，同语言两两平均。测量脚本与原始报告存于私有证据目录 `content-growth/phase1/baseline-3436acb9b/`，tasks 1.1 会把同样的口径并入 `measure-locale-similarity`。

| 集合 | 段（en / es 段标题） | en | es |
|---|---|---|---|
| 牌义页（78） | 导语整段 `(intro)` | **0.549** | **0.490** |
| | ├ H1 | 0.722 | 0.740 |
| | ├ 导语句（= meta description） | 0.488 | 0.316 |
| | └ 速览 `<dl>` | 0.560 | 0.630 |
| | Try a one-card draw / Saca una carta | **1.000** | **1.000** |
| | Related card meanings / Significados relacionados | **0.405** | **0.385** |
| 数字页（12） | 首屏样例（H2「Life Path」/「Número de vida」） | **0.736** | 0.296（整段）/ **0.712**（只计组件） |
| | Explore the other numbers / Explora los otros números | **0.677** | **0.729** |

说明：

- es 数字页 MDX 在第一个 H2 之前有约 125–165 词的导语，渲染后落在「Número de vida」段内，把整段拉低到 0.296。只计组件部分是 0.712，与 en 同一问题。
- 现有报告按位置对齐，es 数字页各页 H2 数量不同，会错位（例如 FAQ 只对上 7 页）。因此 1.1 的门槛改用按标题对齐、只计组件部分的口径。
- #247 记录的「计算器样例 0.647、其余数字 0.498」是当时构建的数字。本次在 `3436acb9b` 上复测为 0.736、0.677：此后 `NeighborNumbers` 改为句子内链，句式更固定了。
- MDX 源口径（现有门槛）不受本次影响：en 牌义各段 ≤0.22，en 数字页源文件「Explore the other numbers」0.536（该段在 FAQ 之后，不渲染，#247 已说明不处理）。

**字数下限的估算**：把通用句换成 N 词的逐页独有文字（以该页长文片段代替），重新计算 Dice：

| 段 | N=30 en / es | N=45 | N=60 | N=80 | N=100 |
|---|---|---|---|---|---|
| 牌义导语（H1 与速览不变） | 0.272 / 0.322 | 0.217 / 0.261 | 0.183 / 0.222 | — | — |
| 抽一张（标题与按钮不变） | 0.115 / 0.046 | 0.118 / 0.043 | — | — | — |
| 延伸牌义（标签与关键词不变） | 0.131 / 0.158 | 0.115 / 0.145 | — | — | — |
| 首屏样例（保留短声明与 Disclaimer） | 0.50 | 0.436 | 0.39 | 0.346 | 0.31 |
| 首屏样例（去掉卡内重复的短声明，保留 Disclaimer） | 0.434 | 0.373 | 0.33 | 0.292 | 0.26 |
| 其余数字（链接不变） | 0.306 / 0.373 | 0.252 / 0.304 | 0.215 / 0.263 | — | — |

### 1.2 博客

- `features.blog: true`。en、zh-Hant 只有 4 篇模板示例文章，全部 `draft: true`。
- 站点地图在该语言没有已发布文章时已经不收录 `/blog`（`features/seo/pages.ts`）。页脚经 `blogHasPosts` 隐藏（`site-footer.tsx`，有测试），页头不链接博客。
- 问题在于页面本身可以被收录：`/blog`、`/es/blog`、`/zh-hans/blog`、`/zh-hant/blog`、`/ko/blog`、`/ja/blog` 都返回 200、没有 robots meta、canonical 指向自身。语言切换器在博客页内链到其他语言的 `/blog`。
- `/blog/page/2` 与 `/blog/tags/*` 已经返回 404。
- `apps/web/src/routes/blog/index.tsx` 是模板交付文件（不在 `scripts/template-sync/merge.mjs` 的 `projectOwnedPaths` 中）。项目自己的 `/blog/page/$page.tsx` 已经用「head 末尾追加 robots meta」的写法输出 noindex。

### 1.3 塔罗入口页

- 塔罗入口页就是三张牌抽牌页：`TAROT_ROOTS` 加上空 slug。不存在独立的枢纽页。
- Title 来自 `SEO_TITLES` 或 `TITLES`，导航名、titleMain、面包屑与 78 个牌义页转化条的锚文本都取 `TITLES`（`features/tools/tarot/routes.ts`）。H1 是 `tarot_three_card_h1`（`messages/<locale>/tarot.json`）。

| 语言 | 路径 | 现 Title | 现 H1 | 现 titleMain |
|---|---|---|---|---|
| en | `/tarot` | Three-Card Tarot \| Arcanumber | Free Three-Card Tarot | Three-Card Tarot |
| es | `/es/tarot` | Tarot gratis: pasado, presente y futuro \| Arcanumber | Tarot gratis de 3 cartas | Tarot gratis |
| zh-hans | `/zh-hans/塔罗` | 三张牌塔罗｜干支日 | 免费三张牌塔罗 | 三张牌塔罗 |
| zh-hant | `/zh-hant/塔羅` | 三張牌塔羅｜干支日 | 免費三張牌塔羅 | 三張牌塔羅 |
| ko | `/ko/타로` | 쓰리 카드 타로 \| 간지데이 | 무료 쓰리 카드 타로 | 쓰리 카드 타로 |
| ja | `/ja/タロット` | 無料タロット占い｜スリーカードで過去・現在・未来｜干支日 | 無料タロット占い（スリーカード） | 無料タロット占い |

- 正文偏薄：en `/tarot` 渲染正文约 1,430 字符（约 260 词），zh-hans 约 480 字。
- 东方站中文首页 H1「免费八字排盘、紫微斗数与塔罗占卜」是复合品牌词。es 首页「numerología y tarot gratis」是关键词地图 es 已批准的类目词。

### 1.4 数字命理

- 西方站已有两个枢纽页 `/destiny-number`、`/soul-urge-number`：`NumerologyContentPage` 版式，内嵌计算器，正文来自 `content/numerology/<locale>/<slug>.mdx`，有 FAQ 与 FAQPage。
- es 的单段页经 `$slug.tsx` 与 `numerology/slug-route.ts` 承接。这样做是为了不给每页一个路由文件，避免首页包增大（首页包预算 352,174 B）。
- `features.guides` 为 false。答案页集合 `content/guides/en` 里只有 3 篇模板示例。
- 正文内链上限：每页 2–5 个（`audit-seo.mjs` 的 `BODY_LINKS_MAX`，枢纽页与首页除外）。`ToolLinks` 没有 `data-link-zone` 标记，按正文计；模板的「相关」区块（`data-link-zone="related"`）不计入正文链接数。


## Goals / Non-Goals

**Goals：**
- 1.1 的 5 个组件段在 en、es 上都 ≤0.30，并把测量并入工具、可以重复执行。
- 主词归属清楚：一个词一个页面；Title、H1、导航名与锚文本一致；TDK 落在长度区间内。
- 新页面（1.4）复用现有版式与引擎，不新增网址规则与依赖。

**Non-Goals：**
- 不改牌义页与数字页的 Title、H1、meta description；不改任何现有网址、canonical 与 robots.txt。
- 不处理东方站牌义页的组件段，那是另一组语言与另一套测量。
- 不加长塔罗入口页等薄页的正文（en `/tarot` 约 260 词、zh-hans 约 480 字）。扩写需要为入口页新增 `ToolArticle` 区块，属于区块增加、要出设计稿，可作为后续小 change。
- 不做任何婚姻、配对类工具或详批（见下文「约束」）。不扩展现有 `/ko/사주궁합`，也不为它增加语言、长文或付费详批；代码与 spec 中的现有 ko 页面保持原样。

## 约束：不做婚姻、配对类专门工具

使用者 2026-11-22 决定：「不做具体婚姻类的命理推演，我们的每个工具都是一个具体工具的广泛应用」。本阶段与后续阶段都遵守：

- 不新增以婚姻、合婚、配对、恋爱匹配为主题的工具页、详批或程序化页面（如八字合婚、生肖配对、两人合盘）。
- 新工具 SHALL 是一项通用工具（排盘、计算器、抽牌、黄历等），爱情与关系只作为通用结果中的一个维度出现。
- 现有 `/ko/사주궁합` 与 ko 的 `saju-compat` 详批保持原样，不扩展语言、内容或入口。
- 规划 v1 中依赖合婚的内容（第 1 阶段 1.5、使用者决定第 4 条中「合婚同步做 ko 版」）随之取消，第 2 阶段 change 不再纳入。

## Decisions

### 决策 1：逐页文案放在 MDX frontmatter，不放 messages

- 牌义页在 `content/tarot/{en,es}/*.mdx` 增加三个可选字段：
  - `lede`：H1 下的导语，45–70 词；
  - `try_prompt`：抽一张面板的说明，30–50 词；
  - `related_note`：延伸牌义的说明，30–60 词。
- 数字页在 `content/numerology/{en,es}/life-path-*.mdx` 增加两个可选字段：
  - `sample_note`：首屏样例的说明，100–130 词；
  - `neighbors`：其余数字一段，45–80 词，用 `[锚文本]` 标出链接位置，链接数与顺序沿用现有 `neighborNumbers()`。
- 字段经 `content-collections.ts` 的 schema 校验，经 `meaning.functions.ts` 与 `content.functions.ts` 随 loader 数据下发。字段缺失时组件沿用现有 messages 文案，所以东方站与 ja 不受影响。

理由：

- 312 段牌义文案与 48 段数字文案如果写进 messages，会进入入口包或改变分包。#247 两次试过，都因首页包超预算失败。
- frontmatter 只随页面 loader 下发，`check-content.mjs`、`check-content-concepts.mjs` 与术语表检查可以直接覆盖。

放弃的方案：

- 按牌拼接模板句：仍然是模板。
- 把组件段改成 H3 并入上一段：只是绕开测量，不解决重复。

### 决策 2：牌义页导语显示 `lede`，meta description 不动

- 页头 `<p>` 改为显示 `lede`；没有 `lede` 时仍显示 description。
- H1 与速览不动：H1 是 Title 的主词，seo-fix 规定牌页 Title 不用动；速览是事实。
- 估算显示 45 词独有导语可把整段降到 en 0.217、es 0.261。`lede` 下限 45 词，es 建议 ≥55 词，留出余量。
- 撰写要求：写这张牌最有辨识度的画面或处境，不重复 description 的句式，不以牌名加「tarot card meaning」开头。

### 决策 3：抽一张与延伸牌义的写法

- `try_prompt`：给出抽牌前可以带着的一个与本牌主题相关的问题或心态，例如 The Sun：「想确认一件让你开心的事是否值得公开时…」。不预测结果，不写「AI」。标题与按钮文案不变。
- `related_note`：说明这 4 张牌与本牌的关系（顺序上的前后、同序号的对照、主题呼应），可以提到牌名，但 MUST NOT 新增链接。正文链接仍是服务端输出的 4 条，锚文本规则不变（`relatedAnchorIsShort`）。小字标签「The card before」等保持不变（测量显示标签不是主因）。

### 决策 4：数字页首屏样例去掉卡内重复的短声明，并逐数字写说明

- 数字页的样例卡（`LifePathCard` 的 `example` 状态，只在数字页传入 `note` 时）：
  - 去掉卡内那句与底部 `<Disclaimer />` 重复的短声明；
  - 用 `sample_note`（100–130 词）替换一句话摘要，内容是：本样例日期如何约简到该数字（与引擎步骤一致，日期由 `exampleDateFor(n)` 给出，撰写时先跑引擎核对），以及读这个数字时最容易误解的一点。
- 结果区底部的 `<Disclaimer />` 保留，满足 tool-pages「结果区底部可见本语言的合规声明」。访客提交自己的日期后，结果卡恢复为现有的一句摘要加短声明。`/life-path-number` 工具页不传 `note`，保持不变。
- 估算显示，去掉短声明后需要约 80 词独有文字才能 ≤0.30（0.292），100 词为 0.26，所以下限定为 100 词。

放弃的方案：

- 只加长文案、保留短声明：100 词时仍有 0.31。
- 把 `<Disclaimer />` 移到页尾：违反 tool-pages 合规声明要求，也属于区块重排，需要设计稿。

补充约束：390×844 首屏的表单与提交按钮位置不变（tool-pages「工具页紧凑布局」）。说明较长时只增加样例卡的高度，不改变区块顺序；手机截图核对放进验收。

### 决策 5：空博客 noindex 写在博客列表路由的 head

- 在 `routes/blog/index.tsx` 的 `head` 中读取 `loaderData.posts`，为空时追加 `{ name: 'robots', content: 'noindex, follow' }`。写法与项目自有的 `/blog/page/$page.tsx` 相同，只改一处。
- 这个文件是模板交付文件，同步时会三方合并。所以同时向模板维护者提交同样的改动请求（编号沿用模板需求清单，R7）。模板采纳后，同步就不会产生差异。
- 站点地图与页脚已经满足要求，本次只补测试固定行为：`pages.ts` 的站点地图条件、`site-header.test.tsx` 中已有的页脚断言。

放弃的方案：

- 关闭 `features.blog`：`/blog` 会变成 404，以后写博客还要再开。规划要求的是 noindex。
- 删除模板示例文章：属于模板内容，同步时会回来。

### 决策 6：「免费塔罗占卜」归入口页，三张牌退为副词

入口页本身就是三张牌工具，免费塔罗主词的搜索意图（马上抽牌）与它吻合。牌义索引页的意图是查牌义，不合适；新建枢纽页违反「不改网址、不为页数造页」。

**改动位置**（`features/tools/tarot/routes.ts` 与 `messages/<locale>/tarot.json`）：

- `TITLES['three-card']`：导航名、titleMain、面包屑、转化条锚文本，改为主词，与 es、ja 现有做法一致。
- `SEO_TITLES['three-card']`：补 en、zh-Hans、zh-Hant、ko 的 Title。
- `DESCRIPTIONS['three-card']`：同上四种语言。
- `tarot_three_card_h1`：同上四种语言。

**提议的 TDK**（长度按 `audit-seo.mjs` 的 `tdkLength`：英文按字符，中日韩按全角宽度，均含站名后缀）：

| 语言 | Title（长度） | Description（长度） | H1 | titleMain／导航名 |
|---|---|---|---|---|
| en | Free Tarot Reading: Past, Present and Future \| Arcanumber（57） | Free tarot reading with three cards: shuffle, cut and turn over past, present and future in the Rider–Waite–Smith deck, each card explained. For reflection.（156） | Free Tarot Reading: Three-Card Spread | Free Tarot Reading |
| zh-hans | 免费塔罗占卜：三张牌看过去、现在与未来｜干支日（23） | 免费塔罗占卜，不用注册：默念问题后洗牌、切牌，翻开过去、现在、未来三张伟特塔罗牌，每张附正逆位牌义与关键词；只想问一件事，也可以改抽每日一张。仅供参考。（76） | 免费塔罗占卜（三张牌） | 免费塔罗占卜 |
| zh-hant | 免費塔羅牌占卜｜線上抽三張牌，讀懂過去現在未來｜干支日（27） | 線上免費塔羅牌占卜，不必註冊：在心裡默念想問的事，洗牌、切牌後依序翻開代表過去、現在、未來的三張偉特牌，逐張對照正逆位意義；只問一件事可改抽是非塔羅。（75） | 免費塔羅牌占卜・三張牌陣 | 免費塔羅牌占卜 |
| ko | 무료 타로 \| 쓰리 카드로 보는 과거·현재·미래 \| 간지데이（27） | 무료 타로로 지금 고민을 정리해 보세요. 질문을 떠올린 뒤 셔플·컷하고 과거·현재·미래 세 장을 뒤집으면 카드별 정·역방향 의미를 보여 드립니다. 참고용입니다.（76） | 무료 타로 – 쓰리 카드 리딩 | 무료 타로 |
| es | 不变 | 不变 | 不变 | 不变（Tarot gratis） |
| ja | 不变 | 不变 | 不变 | 不变 |

以上为草案。zh-hant、ko 的终稿由 Claude 文案子代理按本语言习惯定稿，并经 Codex 回译审阅（决策 8）。定稿仍须在长度区间内，主词不变。

**子词保留**：单张（Card of the Day／每日一张塔罗／오늘의 타로 카드）、是非（Yes or No Tarot）、凯尔特十字、牌义索引（Tarot Card Meanings）的 Title 与 H1 不变。它们的描述中「free … tarot」类说法不以免费塔罗主词开头，不做改动。

**锚文本**（每个目标最多 2 种表述）：

| 目标 | 表述 1（主） | 表述 2 | 来源 |
|---|---|---|---|
| `/tarot` | Free Tarot Reading | three-card tarot | 78 个牌义页转化条（取 titleMain）、`tarot_index_intro` 的 `[three-card tarot]`、首页工具卡、牌阵互导矩阵 |
| `/zh-hans/塔罗` | 免费塔罗占卜 | 三张牌塔罗 | 同上（`tarot_index_intro` 为 `[三张牌塔罗]`） |
| `/zh-hant/塔羅` | 免費塔羅牌占卜 | 三張牌塔羅 | 同上 |
| `/ko/타로` | 무료 타로 | 쓰리 카드 타로 | 同上 |

**实现注意**：

- `meaning-routes.ts` 的 `tarotLocalizedSeoPages()` 以「三张牌的 SEO 标题是否不同于导航名」筛选语言。en、zh、ko 补了 SEO 标题后会被纳入覆盖清单，连带单张、是非、凯尔特十字与索引页的条目。必须核对这些页面的 Title、Description 与改动前逐字相同（加单测）。必要时把筛选改为按牌阵判断。
- 页头导航名变长（「免費塔羅牌占卜」「Free Tarot Reading」），需要 390px 截图核对页头不换行、不溢出。

### 决策 7：入门页路径为 `/numerology` 与 `/es/numerologia`，套用数字命理枢纽页版式

**路径**：`/numerology`、`/es/numerologia`。这比 `/what-is-numerology` 短，与站内关键词式 slug 一致，以后也能承接「numerology」大词。Title 与 H1 带「What Is Numerology?」覆盖问句意图。

**承接方式**：

- `numerology/routes.ts` 的 `PATHS` 增加 `numerology` 页面 id：en `/numerology`，es `/numerologia`。
- 正文为 `content/numerology/{en,es}/numerology.mdx`，由 `NumerologyContentPage` 渲染，内嵌 `LifePathCalculator`（满足 tool-pages 首屏出结果）。
- en 也经 `$slug.tsx` 承接：`numerologySlugPage` 对该 id 放开 en。这样不新增路由文件，也不影响首页包，`check-home-bundle` 会验证。
- 注册表 `NUMEROLOGY_ROUTES` 登记 Title、Description、titleMain（en「What is numerology」、es「Qué es la numerología」），父页为首页。

**提议的 TDK**：

| 语言 | Title（长度） | Description（长度） | H1 |
|---|---|---|---|
| en | What Is Numerology? A Beginner's Guide \| Arcanumber（51） | What is numerology? Meet the core numbers (life path, expression, soul urge, personality and birthday), how each is calculated and which free calculator to use.（160） | What Is Numerology? The Core Numbers, Explained |
| es | Qué es la numerología: guía para empezar \| Arcanumber（53） | Qué es la numerología y cómo se calcula: los números principales (vida, destino, alma, personalidad), un ejemplo paso a paso y qué calculadora gratis usar.（155） | ¿Qué es la numerología? Guía de los números principales |

**正文大纲**（en 与 es 各自撰写，≥1,000 词；es 的算例换用另一位虚构人物与日期，避免数字序列重合）：

1. 什么是数字命理：2–3 句可以直接被引用的定义（毕达哥拉斯体系、字母表、约简），兼顾 AI 搜索。
2. 核心数字：life path、expression（destiny）、soul urge、personality、birthday、personal year，分别说明各自回答什么问题、用什么输入。
3. 怎么算：约简规则与大师数 11/22/33，一个由引擎复算的完整算例。
4. 先用哪个计算器：正文链接 2–5 个计算器（life path、numerology calculator、name numerology、compatibility）。
5. 数字命理不做什么：合规表述「依据传统方法推算、仅供参考与潜意识探索、不预测未来」，健康问题请咨询医师。
6. FAQ：3–4 问，与 FAQPage 同源。

**全部计算器的链接**：用模板「相关」区块（SeoPage `related` 声明，`data-link-zone="related"`），列出 7 个计算器页：`/life-path-number`、`/numerology-calculator`、`/name-numerology`、`/numerology-chart`、`/life-path-compatibility`、`/destiny-number`、`/soul-urge-number`。锚文本取各页 titleMain，不计入正文 2–5 条上限，同时为钱页增加入链。

**入链与首页让出**：

- 首页的 Title、H1 本来就不以「what is numerology」为目标，不改。
- 从首页「How we calculate」一行，以及 `/life-path-number` 与 `/numerology-calculator` 长文中已经提到「numerology」的现成句子，链接到入门页，每页最多 1 条。找不到能自然带过去的句子就跳过（不为插链接新造句子），但总入链 ≥2。
- 锚文本：en「what is numerology」、「numerology basics」；es「qué es la numerología」、「numerología para principiantes」。es 两种表述登记进 `i18n/glossary/es.json` 的 `anchors`。

**设计稿**：按 design-system §8.1，套用现有模式的新页面也需要设计稿。入门页没有新版式，只是枢纽页版式加相关区块，所以只需一张 ui-design 画布稿（en 桌面与 390px 各一）给使用者确认即可。

### 决策 8：文案的撰写与交叉审阅

- **en**：Claude 文案子代理撰写。数字与算式一律由引擎复算，`check-content-concepts` 逐行校验。
- **es、zh-hans、zh-hant、ko**：Claude 子代理按本语言搜索词与表达习惯直接撰写，不由 en 翻译。zh-hant 与 zh-hans 分别撰写，不做字形转换。
- **交叉审阅**（使用者 2026-11-20 规则：Claude 写的由 Codex 回译审阅，反之亦然）：
  - es：`measure-locale-backtranslation.mjs --locale es --export-input <证据目录>` 导出，Codex 在自己的会话中回译，再用 `--from-file` 计算。整页 ≤ 校准阈值（默认 0.50），FAQ ≤0.40。
  - zh-hant 对 zh-hans：`measure-locale-similarity --opencc <证据目录中的 opencc-js>` 的同文字变体门槛（整页 ≤0.60、整句 ≤0.15、FAQ ≤0.40）。
  - zh、ko 的 TDK：Codex 回译，Claude 根据回译意见修改。
- **合规**：免费工具页写「依据传统方法推算、仅供参考与潜意识探索、不预测未来」，不得写 AI 生成或 AI 辅助，不使用「娱乐」定位，健康问题引导咨询医师。es 文案按 `i18n/glossary/es.json` 的首选写法与禁用写法撰写。

### 决策 9：测量工具与证据

- `measure-locale-similarity.mjs` 增加「组件段」报告：
  - 按段标题的正则（en/es 对照表）对齐；
  - 只计组件输出部分（es 数字页首屏样例截到结果区声明为止）；
  - 输出每语言每段的平均与最差页。
- `--enforce en,es` 时组件段 >0.30 以 1 退出。正则与截断规则放在 `locale-similarity.mjs`，并补单测。
- 证据（前后测量报告、审计、回译、截图）放在私有证据目录 `content-growth/phase1/`，PR 只引用路径。

## Risks / Trade-offs

- [逐页文案量大：牌义 156 篇各 3 段，约 2.3 万词] → 按花色分 6 批（与 #247 相同）。每批写完先跑组件段测量与 `check-content`，再写下一批。es 与 en 由不同子代理并行撰写，避免「同一底稿翻译」。
- [`sample_note` 让样例卡变长，首屏变矮] → 只在未提交时的样例状态显示；手机 390×844 截图核对表单与提交按钮仍在首屏；超出时把下限降到 80 词，并接受 0.29 左右的余量（仍在门槛内）。
- [塔罗入口页改名牵动面包屑、页头、首页工具卡、78 个转化条的锚文本] → 一次性在同一 PR 内改完。`audit:seo` 核对锚文本种类 ≤2、top1 占比；`check:links` 核对无死链与 h1；首页工具卡与页头 390px 截图。
- [`tarotLocalizedSeoPages()` 的筛选副作用] → 见决策 6，用单测锁定其他牌阵页的 Title 与 Description。
- [`routes/blog/index.tsx` 是模板文件] → 只改一处并同时提交模板请求 R7。template-sync 冲突时按三方合并保留本行为。
- [新页面的薄页风险] → 入门页正文 ≥1,000 词；上线前过 `measure-locale-similarity`、`audit:seo`、`check:links`、`check:i18n-seo`。

## Migration Plan

- 各组按 tasks.md 分别开 PR，合并到 main 后随下一次统一发版上 staging，再上生产（合并与发版都需授权）。
- 不涉及数据迁移。回滚就是还原对应 PR：frontmatter 字段可选，删掉后自动回落到原文案。
- 站点地图重提与请求编入索引，按约定在全部工作完成后一次性交给 Grok bot。发版流水线中的 IndexNow 照常运行。

## Open Questions

无。规划阶段的待确认问题已由使用者裁定（2026-11-22）：

- 中文八字合婚（含付费详批与中文首页入口）：取消，见「约束」。
- 塔罗入口页等薄页的正文扩写：不在第 1 阶段，可作为后续小 change。
- 入门页路径：`/numerology` 与 `/es/numerologia`（决策 7）。
