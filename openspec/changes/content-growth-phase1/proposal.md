# 内容增长第 1 阶段：修存量与抢主词

## Why

content growth 规划 v1（2026-11-22 使用者确认，证据目录 `content-growth/plan-v1-20261122.md`）把第 1 阶段定为「修存量与抢主词，基本不新增网址」。
当前两站的问题有两类：

- 收录差：西方站 41 页、东方站 193 页处于「已抓取-尚未编入索引」。西方站牌义页与数字页上有组件固定输出的段落，渲染相似度 0.49–1.0（门槛 0.30）。两站的空 `/blog` 列表页可以被收录。
- 主词无归属：「free tarot reading / 免费塔罗占卜 / 무료 타로」「what is numerology」两组词没有页面负责，见 `content-growth/keyword-gaps-20261120.md`。

12-02 复查 SEO 修复效果之前先做完存量修复，第 2 阶段（东方站新集群）才有干净的基线。

## What Changes

- **1.1 西方站组件段按页改写（en、es）**：牌义页的导语、「Try a one-card draw / Saca una carta」、「Related card meanings / Significados relacionados」说明，以及数字页首屏计算器样例、「Explore the other numbers / Explora los otros números」，都改为按牌、按数字分别撰写的文案。每段渲染相似度 ≤0.30（按段标题对齐测量）。链接目标、锚文本、Title、H1 与 Description 不变。
- **1.2 空博客列表不进索引（两站全部语言）**：该语言没有已发布文章时，`/blog` 输出 `noindex, follow`。站点地图与页脚本来就会隐藏空博客，本次补测试固定这一行为。
- **1.3 「免费塔罗占卜」主词归属**：由各语言的塔罗入口页（即三张牌抽牌页，路径不变）负责。
  - 主词：en「free tarot reading」、zh-hans「免费塔罗占卜」、zh-hant「免費塔羅牌占卜」（另写，不是字形转换）、ko「무료 타로」。
  - 改动范围：Title、Description、H1、导航名／主词（titleMain）与锚文本。
  - 三张牌退为本页的副词。单张、是非、凯尔特十字三个牌阵页保留各自的主词。
  - es「tarot gratis」与 ja「無料タロット占い」已经归属入口页，只核对、不改。
- **1.4 数字命理入门页（西方站 en、es）**：新增 `/numerology`（en，主词「what is numerology」）与 `/es/numerologia`（es，主词「qué es la numerología」），套用现有数字命理枢纽页版式。
  - 正文链接到部分计算器，「相关」区块列出全部 7 个计算器。
  - 首页不以这个词为目标，并从现成句子链接到入门页。
- **测量工具**：`measure-locale-similarity` 增加按段标题对齐的组件段报告（en、es），作为 1.1 的合并门槛。
- **主词归属表**：新主词上线前登记到私有证据目录的关键词归属表（一个词只归一个页面）。

不在本次范围：

- 规划 v1 的 1.5「中文八字合婚」已由使用者取消（2026-11-22）。产品原则是不做婚姻、配对类的专门命理工具或详批，每个工具都是一项通用工具的广泛应用（见 design「约束」）。现有 ko 사주궁합页保持原样，不扩展。
- 塔罗入口页等薄页的正文扩写（需要新增区块与设计稿），可作为后续小 change。
- 第 2 阶段（生肖、黄历、紫微十四主星、八字概念补齐）与第 3 阶段（angel numbers、personal year、牌阵页、es 跟进），各自另开 change。
- ja 只维护；不改任何现有网址、canonical 规则与 robots.txt。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `tarot-pages`：新增「牌义页组件段逐牌撰写」与「塔罗入口页负责免费塔罗主词」两条要求。
- `numerology-pages`：新增「数字页组件段逐数字撰写」与「数字命理入门页」两条要求。
- `marketing-site`：新增「空博客列表不进索引」要求。
- `seo`：新增「主词唯一归属」要求（新主词上线前登记、站内锚文本与 Title/H1 一致）。

## Impact

- 代码：
  - 塔罗：`apps/web/src/features/tools/tarot/`（`meaning-page.tsx`、`meaning.functions.ts`、`routes.ts`、`meaning-routes.ts`）。
  - 数字命理：`apps/web/src/features/tools/numerology/`（`content-page.tsx`、`parts.tsx`、`life-path-calculator.tsx`、`routes.ts`、`slug-route.ts`、`slug-page.tsx`）。
  - 注册表：`apps/web/src/features/tools/registry.ts`（入门页条目）。
  - 博客：`apps/web/src/routes/blog/index.tsx`（模板交付文件，见 design 决策 5）。
  - 内容配置：`apps/web/content-collections.ts`。
- 内容与文案：
  - `apps/web/content/tarot/{en,es}/*.mdx`（156 篇 frontmatter）、`apps/web/content/numerology/{en,es}/life-path-*.mdx`（24 篇），新增 `numerology.mdx`（en、es）。
  - `apps/web/messages/{en,zh-Hans,zh-Hant,ko}/tarot.json`，以及 `apps/web/i18n/glossary/es.json` 的锚文本。
- 工具：`apps/web/scripts/measure-locale-similarity.mjs`、`locale-similarity.mjs` 及其测试。
- 不涉及数据库、迁移、计费、密钥与外部服务；不改网址。新页面在构建后自动进入站点地图、IndexNow 与 llms.txt。
- 需要使用者确认的设计稿：1.4 入门页（docs/design-system.md §8.1）。
