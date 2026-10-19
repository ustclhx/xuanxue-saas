# Proposal

## Why

用户决定 v1 加入塔罗抽牌（2026-10-19）。`tarot reading` 本身是红海（KD 59.9），不做首页主词；但抽牌工具能显著拉高停留时长与浏览页数（对标 `tirage.net` 的 6.1 页 / 4 分 7 秒），78 张牌义页是低成本的长尾矩阵，也为 v2 的德/荷/意牌阵站（TASK-04）打好组件基础。

## What Changes

- 新增 `@xuanxue/tarot` 数据与抽牌包：78 张 Rider–Waite–Smith 牌（22 大阿卡纳 + 56 小阿卡纳）的结构化数据，正逆位，牌阵定义（每日一张、是/否、三张牌、凯尔特十字），使用加密安全随机数完成洗牌/切牌/抽牌。
- 抽牌页面（en、zh-Hant、ko 三语）：首屏铺牌，洗牌、切牌动画（尊重 reduced-motion），点选翻牌；牌阵互导；「可以问的问题模板」与「不能问的三类问题」（具体姓名/数字/日期、是非绝对化、健康）。
- 78 张牌义页 × 3 语言：正位/逆位、爱情/事业/建议，每张 `<img>` 写本语言 alt。
- 牌面图片使用公有领域的 1909 年 RWS 扫描版，记录来源与许可。

## Capabilities

### New Capabilities
- `tarot-draw`: 牌组、牌阵、洗牌与抽牌的随机性与可复现性规则。
- `tarot-pages`: 抽牌工具页与牌义页的结构、问句模板、互链与图片可访问性。

### Modified Capabilities
（无）

## Impact

- 新包 `packages/tarot`；`apps/web/public/tarot/`（78 张 WebP，约 3MB）；`features/tools/tarot/`；`messages/<locale>/tarot.json` 与 `content/tarot/<locale>/*.mdx`。
- 依赖 `add-dual-site-foundation`。tarot 页在东方站使用 `/zh-hant/塔羅/`、`/ko/타로/` 路径，在西方站使用 `/tarot/`。
