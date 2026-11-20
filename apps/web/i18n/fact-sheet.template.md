# 写作事实单：{{title}}

| 项 | 值 |
|---|---|
| 语言 / 站点 | `{{locale}}` / {{site}} |
| 路径 | `{{path}}` |
| 页面类型 | {{kind}} |
| hreflang 对应页（只用于对应关系，不要阅读其正文） | {{counterparts}} |
| 术语表 | `apps/web/i18n/glossary/{{locale}}.json`（{{glossaryStatus}}） |
| 生成 | {{generatedAt}} · `generate-locale-fact-sheet.mjs` |

> 本事实单只给事实、关键词、术语与约束，**不含任何源语言正文**。请直接用本语言为本地读者写作，
> 不要打开、翻译或改写其他语言版本的页面（design 决策 10）。

## 1. 引擎事实（必须与页面计算结果一致）

{{engineFacts}}

## 2. 关键词

{{keywords}}

## 3. 本地问题来源（FAQ）

每页至少 2 问（不足 3 问时至少一半）取自本语言用户的真实问法，并在内容源中标注 `origin: local`；
其余标 `adapted`。记录来源以便审阅抽查。

{{questionSources}}

| # | 问题（本语言） | 来源（平台与链接） | origin |
|---|---|---|---|
| 1 |  |  | local |
| 2 |  |  | local |
| 3 |  |  |  |

## 4. 术语（以术语表为准，禁用写法会让 `pnpm check` 失败）

{{terms}}

## 5. 合规表述

{{compliance}}

## 6. 内链与锚文本

正文 2–5 条内链；同一目标页的锚文本只用下列写法（每个目标 ≤2 种）；两站互不链接。

{{anchors}}

## 7. 示例（须本地化并经引擎复算）

{{examples}}

## 8. 写作约束与验收

{{constraints}}
