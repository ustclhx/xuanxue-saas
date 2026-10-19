# Design

## Context

依赖站点外壳。抽牌页的价值在交互与留存；牌义内容量大（78 × 3 语言）。

## Goals / Non-Goals

**Goals:** 流畅的抽牌交互（60fps、移动端优先）、可复现、三语牌义矩阵。
**Non-Goals:** 不做 AI 实时解牌（并入 `add-reading-monetization` 的付费详批）；不做 Lenormand 与 52 张扑克牌义（v2）。

## Decisions

1. **图片**：来源为 Wikimedia Commons 上 1909 年 RWS 扫描（Pamela Colman Smith 画作，已进入公有领域）；转为 WebP 两种尺寸（240w/480w），`srcset` 懒加载，`apps/web/public/tarot/SOURCES.md` 记录每张图的 URL。备选：AI 生成牌面 —— 拒绝，用户对 AI 塔罗存在不信任（design.md §5）。
2. **随机**：`crypto.getRandomValues` 做 Fisher–Yates；切牌 = 访客点选位置后旋转数组；结果编码 `spread:cardId[r]` 序列放在 `#r=` 片段中。
3. **动画**：纯 CSS transform + `requestAnimationFrame`，不引入动画库；牌背 SVG 内联。
4. **内容**：牌义基础数据（关键词、正逆位短义、是否映射）放 `packages/tarot/src/data/<locale>.ts`，供工具与 AI 使用；长文放 `content/tarot/<locale>/<slug>.mdx`。英语由 worker 起草，zh-Hant/ko 由英语翻译后本地化（术语表：`packages/tarot/GLOSSARY.md`）。
5. **路由**：西方站 `/tarot/`（三张牌，主牌阵）、`/tarot/daily/`、`/tarot/yes-or-no/`、`/tarot/celtic-cross/`、`/tarot/cards/<slug>/`；东方站 `/zh-hant/塔羅/…`、`/ko/타로/…`，三语页面 hreflang 互指（跨站）。

## Risks / Trade-offs

- [78×3 内容的质量] → 先完成英语并审阅，再批量翻译；FAQ 与合规表述纳入审阅清单。
- [图片体积影响 LCP] → 首屏只加载牌背 SVG，牌面在翻牌时才加载并预取。
