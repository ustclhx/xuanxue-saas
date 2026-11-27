## 1. 基线与审计脚本

- [x] 1.1 在 origin/main 构建上记录 canonical／hreflang／站点地图／robots 快照（复用 template-sync-0.7.4 的 seo-snapshot.mjs）
- [x] 1.2 新增 `apps/web/scripts/audit-seo.mjs`（`audit:seo`）：复用 check:links 的抓取与解析，检查孤岛、死链、正文内链 2–5、钱页入链、锚文本表述与 top1 占比，输出 TDK 长度；补类型声明与单元测试
- [x] 1.3 `template.config.ts` 登记 18 个钱页（`seo.linking.moneyPages`）
- [x] 1.4 在 main 构建上运行审计并保存改前报告

## 2. 首页、分享页与 TDK

- [x] 2.1 arcanumber 首页 Title 改为 `Numerology & Tarot Calculators, Free | Arcanumber`
- [x] 2.2 四个首页 H1 换成含主词的说法（韩语按韩语站实际工具取词）
- [x] 2.3 东方站繁、简首页 Description 各写一版，70–80 字、句序与用词不同，保留合规表述
- [x] 2.4 arcanumber 78 张牌义页 Description 补到 145–158 字符，Title 不动
- [x] 2.5 超上限的 Description（`/daily-numerology`、`/numerology-calculator`、东方站 `/en`）压到上限内；`/daily-numerology` 与 `/en` 的 H1 补主词
- [x] 2.6 `/s/*` 分享页 robots meta 与 `X-Robots-Tag` 改为 `noindex, follow`；robots.txt 不变
- [x] 2.7 全站 TDK 核对表（改动与保留理由）写入 design.md 决策 4

## 3. 内链修正

- [x] 3.1 首页工具卡片的链接只包住工具名；首屏主按钮、转化条与内容漏斗标 `action` 区域
- [x] 3.2 牌义页延伸牌义两种表述各半（`relatedAnchorIsShort`）
- [x] 3.3 概念页同组链接改为首尾相接的 3 条
- [x] 3.4 牌阵互导句、数字页相性句、繁中每日运势的锚文本补出第二种表述；去掉第三种表述
- [x] 3.5 四种语言隐私政策的现成句子链接通讯页，消除 `/newsletter` 孤岛
- [x] 3.6 数字命理计算器相关工具改链 `/destiny-number`，钱页入链补到 3

## 4. 验证

- [x] 4.1 `pnpm check`、`pnpm typecheck`、web 单元测试；更新断言旧标题、H1 与链接文字的测试
- [x] 4.2 `pnpm build`：首页脚本预算未上调，落地页 HTML 低于约 105KB
- [x] 4.3 `check-tool-links`、两站 `check:links`、审计脚本改后报告（违规 0）
- [x] 4.4 canonical、hreflang、站点地图与 robots.txt 与 main 逐字节一致
- [x] 4.5 e2e：`seo.spec.ts`、`dual-site-seo.spec.ts` 及受影响的页面用例（隔离库）
