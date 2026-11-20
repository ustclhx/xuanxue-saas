## Why

arcanumber.com 与 ganjiday.com 的 GSC 数据显示页面能排出来但排不上去（arcanumber 平均排名 68.9），首页与主工具页抢同一个词，
两站首页 H1 不含主词，分享页被收录，内链锚文本集中在单一表述、钱页入链不足。使用者 2026-11-19 的 SEO 修复任务
（`~/workspace/xuanxue-saas-evidence/seo-fix-20261119/task.md`，以下简称 task.md）第 1、2 步已在 #231 完成，
本变更完成第 3、6、7 步与第 5 节的内链验收（A 部分）；第 4 步已被使用者作废，第 5 步由另一个变更处理。

## What Changes

- **首页抢词（第 3 步）**：arcanumber 首页 Title 改为 `Numerology & Tarot Calculators, Free | Arcanumber`，由 `/life-path-number` 独占「Life Path Number Calculator」。
- **分享页（第 6 步）**：`/s/*` 分享页的 robots meta 与 `X-Robots-Tag` 改为 `noindex, follow`；`/share-card/*` 是 PNG 图片，没有 HTML，维持响应头 `X-Robots-Tag: noindex`；robots.txt 不变。
- **全站 TDK（第 7 步）**：四个首页 H1 换成含主词的说法；东方站繁、简首页 Description 各写一版（70–80 字、句序与说法不同）；
  arcanumber 78 张牌义页 Description 从约 122 补到约 150 字符（Title 不动）；超出上限的 3 个 Description 压到上限内；
  `/daily-numerology` 与东方站 `/en` 的 H1 补主词。其余页面逐页核对后不改，见 design.md 的 TDK 表。
- **内链验收（第 5 节）**：新增项目自有的审计脚本 `pnpm --filter @xuanxue/web audit:seo`（复用 check:links 的抓取与解析），
  检查孤岛、死链、每页正文内链 2–5、钱页入链 ≥3、同一目标页锚文本 ≤2 种且 top1 ≤70%；按 task.md §3 修正违规：
  首页工具卡片的锚文本只包住工具名、转化按钮与转化条标为 `action` 区域、牌义页延伸牌义两种表述各半、概念页同组链接改为 3 条、
  牌阵互导与少数正文句子的锚文本补出第二种表述、通讯页由隐私政策的现成句子链接、钱页 `/destiny-number` 补足入链。
- `template.config.ts` 的 `seo.linking.moneyPages` 登记 18 个钱页。
- 不改 canonical、hreflang、站点地图与 robots.txt；不改页头；不让两站互链。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `share-cards`：通用分享页的 robots 声明由 `noindex` 改为 `noindex, follow`。
- `seo-internal-linking`：新增项目验收审计与锚文本表述规则（≤2 种、入链 ≥5 条时 top1 ≤70%），转化按钮与转化条使用 `action` 区域。
- `seo`：首页 H1 必须含主词；各语言 Title／Description 的长度口径。

## Impact

- 代码：`apps/web/src/features/{marketing/home-hub,seo,share-cards,tools/{tarot,bazi,numerology},marketing/east-english}`、
  `apps/web/src/routes/s.$type.$token.tsx`、新脚本 `apps/web/scripts/audit-seo.mjs`、`scripts/check-content-concepts.mjs`（正则放宽）。
- 文案：`apps/web/messages/*/{landing,tarot,daily}.json`、`content/tarot/en/*.mdx` frontmatter、少量 numerology 与法律页 MDX 链接。
- 测试：页面标题、分享页、牌阵链接、概念页链接、首页 e2e 与生产冒烟断言随文案更新。
- 不影响数据库、计费与部署配置；落地页 HTML 仍在约 105KB 预算内，首页脚本预算不变。
