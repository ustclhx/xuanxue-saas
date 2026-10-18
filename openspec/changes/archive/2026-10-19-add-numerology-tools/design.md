# Design

## Context

依赖站点外壳与 `TOOL_ROUTES`（`add-dual-site-foundation`）。引擎逻辑简单，难点在内容量（12 个数字页 + 枢纽页）与英语文案质量。

## Goals / Non-Goals

**Goals:** 可解释的计算步骤；数字页内容达到对标站内页的深度；引擎可被法语站直接复用。
**Non-Goals:** 不做迦勒底体系；不做 angel numbers 内容矩阵（v2）；不做法语页面。

## Decisions

1. **引擎输出结构化结果 + 步骤数组**：`{ value, master: boolean, steps: Step[] }`，页面把步骤渲染为算式，AI 详批也使用同一结构。
2. **内容来源**：数字页正文（不列名人生日，避免不可核实的事实）放在 `apps/web/content/numerology/en/<n>.mdx`（content-collections，已有管线），frontmatter 含 title/description/faq；由 worker 起草，协调者审阅事实与合规表述（不预测未来、不做健康断言）。备选：放 JSON 文案 —— 拒绝，长文更适合 MDX。
3. **首页结构**对齐 `seventhlifepath.com` 的焦点首页：H1 → 计算器 → 结果 → 1–33 数字网格 → 「What is a life path number」长文 → FAQ → 完整计算器入口。
4. **相性表**为 12×12 固定矩阵，写入 `packages/numerology/src/compatibility.ts`，注释说明来源为常见流派的综合，页面标注娱乐用途。

## Risks / Trade-offs

- [首页从模板营销首页改为工具页] → 原营销首页的「定价/功能」板块移到 `/pricing` 与页脚，避免首页主词被稀释。
- [内容同质化] → 每个数字页要求包含计算样例与 FAQ，审阅时检查与常见站点的差异化。
