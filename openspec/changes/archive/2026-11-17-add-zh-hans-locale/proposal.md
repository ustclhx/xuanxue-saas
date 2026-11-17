# Proposal

## Why

东方站目前只有繁体中文（`zh-Hant`）。大陆及使用简体的访客看到的是繁体界面和繁体报告，阅读门槛高，也影响详批等付费内容的转化。运营方希望为东方站增加简体中文，让简体访客以简体浏览页面、接收邮件并生成简体详批。

需要注意：2026-10-19 的 `add-dual-site-foundation` 变更曾经**有意移除**简体 `zh`（BREAKING），把现有文案转为繁体，并在 i18n 规范中加入「已移除的简体前缀」场景（`/zh/` 返回 404）。本变更是对该决定的反转，需要在评审时明确确认。

## What Changes

- 东方站的语言集合增加 `zh-Hans`，URL 前缀为小写 `/zh-hans/`，与 `zh-Hant`、`ko` 同属东方站。
- 浏览器语言偏好：`zh-CN`、`zh-SG` 等简体标签归入 `zh-Hans`；`zh-TW`、`zh-HK`、`zh-MO` 继续归入 `zh-Hant`；未明确标注的 `zh` 归入 `zh-Hant`，保持现有行为。
- 新增 `messages/zh-Hans` 的全部用户可见文案（营销、工具、认证、账户、计费、邮件、错误提示），由繁体文案转换并保持术语一致，由运营方抽检。
- 详批：简体访客生成简体报告；提示词按语言选择输出语言，简体语言不再经过繁体转换函数。繁体访客行为不变。
- 结果页「即将开放，敬请期待」占位在 `zh-Hans` 下显示简体文案。
- SEO：东方站页面声明 `zh-Hans` 的 hreflang、sitemap 条目与 canonical，与 `zh-Hant` 互相引用，`x-default` 保持现有规则。
- **BREAKING**（相对 `add-dual-site-foundation`）：`/zh-hans/` 成为有效前缀；`/zh/` 仍返回 404。
- **不在本次范围**：
  - 新增第三个站点或域名；
  - 博客、法律页、塔罗牌义、工具内容集合的全量简体版本。法律页与现有繁体一样显示英文原文并附简体提示；其他内容集合在简体下的回退规则以现有繁体行为为准；
  - 西方站的任何变化。

## Capabilities

### New Capabilities

无。简体语言属于现有的语言与站点能力，不新增独立能力。

### Modified Capabilities

- `i18n`：v1 语言集合从 `en`、`zh-Hant`、`ko` 扩展为包含 `zh-Hans`；语言路由、浏览器偏好匹配与文案回退需要补充简体规则；「已移除的简体前缀」场景改为仅限 `/zh/`。
- `multi-site`：`zh-Hans` 属于东方站，东方站的语言入口与自动跳转规则随之更新。
- `seo`：东方站的 hreflang、sitemap 与 canonical 需要包含 `zh-Hans`。
- `paid-readings`：详批报告的生成语言随访客语言变化，简体访客得到简体报告。

## Impact

- 配置：`template.config.ts`、`packages/config/src/template.ts`（语言类型 `DefaultLocale` 与默认配置）、东方站 `locales`。
- 语言运行时：`apps/web/project.inlang/settings.json` 增加 `zh-Hans` 文件；`apps/web/messages/zh-Hans/*.json` 全部新增。
- 路由与偏好：`apps/web/src/features/i18n/`（`preference.ts`、`url-prefix.ts`、`routing.ts`）、`site/` 与 `switch-path.ts`；`switch-path` 中按语言的路由别名需要为简体提供路径（如「八字排盘」）。
- SEO：`apps/web/src/features/seo/`（hreflang、sitemap、metadata）。
- 详批：`apps/web/src/features/readings/prompts/`（当前 `tarot-spread` 等只有 `en` / `zh-Hant` / `ko` 三份）、`toTraditional` 调用点、`unlock-card.tsx` 文案。
- 测试：i18n、site、seo、readings 的既有测试与快照需要包含 `zh-Hans`（如 `site.test.ts`、`seo.test.tsx`、`switch-path.test.ts`、`packages/email` 快照）。
- 运营：简体译文需要运营方抽检；不涉及密钥、数据库结构或支付。
- 风险：简体与繁体页面内容相似，需要 canonical 与 hreflang 正确，避免搜索引擎判为重复内容。
