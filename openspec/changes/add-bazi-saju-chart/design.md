# Design

## Context

依赖 `add-dual-site-foundation` 的站点路由、`features/tools` 外壳与 `TOOL_ROUTES` 预渲染注册点。设计文档对标 `suanzhun.net` 与 `manseryeok.com`：工具 + 大量解释内容，靠停留与页数取胜。

## Goals / Non-Goals

**Goals:** 可信的排盘准确度（节气、时区、夏令时）、浏览器/服务端一致、引擎可被 AI 详批复用。
**Non-Goals:** 不做古籍全文库与文章库（后续内容 change）；不做 60 일주独立页（v1.1）；喜用神不追求流派完备，仅扶抑法参考值。

## Decisions

### 1. 历法底层用 `tyme4ts`，紫微用 `iztro`
`tyme4ts`（6tail，MIT，持续维护）提供公历/农历/节气/干支/童限；自研只做五行计分、身强弱、喜用神、神煞表、称骨。用 `lunar-javascript` 作为测试期交叉校验 oracle（devDependency），不进入运行时。备选：完全自研历法 —— 拒绝，节气精度成本高。

### 2. 输出为版本化 JSON
`computeChart(input): BaziChart`，`BaziChart` 只含结构化数据（干支 id、数值、布尔、标签 key），不含文案；文案由页面按 `messages/<locale>/bazi.json` 渲染。服务端 AI 详批直接使用同一 JSON。`ENGINE_VERSION` 写入结果。

### 3. 时区数据
内置精简历史时区表：台湾（含 1945–1979 夏令时）、韩国（含 1948–1960、1987–1988 夏令时与 1954–1961 UTC+8:30）、香港、中国大陆、日本、美西/美东/英国等 20 个常用城市；其他地点用户手选 UTC 偏移。经度用于真太阳时（默认关闭；韩国页面默认提示「진태양시」开关）。

### 4. 身强弱与喜用神
五行计分：天干 1.0、地支藏干按本气/中气/余气 0.6/0.3/0.1，月令加权 ×1.5；日主同党（比劫+印）占比 ≥ 50% 判身强。喜用神按扶抑：身强取克泄耗，身弱取生扶；结果附分数明细供展示与 AI 使用，页面标注「參考」。规则写入 `packages/bazi/README.md`。

### 5. 测试样例
`packages/bazi/test/fixtures/charts.json`：≥ 40 个样例，覆盖立春/节气交接前后 1 分钟、子时跨日（早晚子时按「23 点换日」默认规则）、闰月、两地夏令时、无时辰；期望值由 `tyme4ts` 与 `lunar-javascript` 双源一致生成，再人工抽查 10 个与公开万年历比对。

### 6. 引擎体积与加载
引擎在客户端通过 `import()` 懒加载，目标 gzip < 80KB（tyme4ts 按需引入）；表单与说明文字先渲染，CI 加体积检查。

### 7. 中文/韩文 URL
路由文件用 `$slug` 参数，`eastern-routes.ts` 维护 slug ↔ 页面映射（`八字排盤` 等直接使用 Unicode，生成链接时 `encodeURI`）；概念页 slug：`/zh-hant/八字/<概念>/`、`/ko/사주/<개념>/`。

## Risks / Trade-offs

- [喜用神流派争议] → 标注参考、展示分数依据、FAQ 说明方法。
- [时区表不全] → 手选 UTC 偏移兜底；结果显示「排盘所用时间」，用户可自查。
- [紫微范围膨胀] → v1 只出十二宫+主星+四化，不做流年盘。
