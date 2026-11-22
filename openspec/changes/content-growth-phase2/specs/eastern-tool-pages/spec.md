## ADDED Requirements

### Requirement: 第二批八字概念页（zh-hans）

东方站 zh-hans SHALL 在现有 8 篇概念页之外新增 6–8 篇，沿用现有版式与 `/zh-hans/八字/<slug>` 路径：
- A 档（有引擎表格）：天干地支、藏干、十二长生、纳音、合冲刑害、太岁；
- B 档（只有文字）：格局、调候。

每篇 SHALL 满足「长尾概念页」要求，并且：
- 本语言正文 ≥1,500 字；
- A 档的表格 SHALL 由引擎生成并在构建时核对；
- B 档 MUST NOT 声称排盘工具会计算该项。

没有 zh-hant 与 ko 版本的概念 MUST NOT 出现在这两种语言的 hreflang 中。

#### Scenario: 纳音页的表格

- **WHEN** 访客打开 `/zh-hans/八字/纳音`
- **THEN** 页面列出六十甲子纳音表，每一项都与引擎一致；页面嵌入八字排盘组件

#### Scenario: 格局页不冒称计算

- **WHEN** 访客阅读 `/zh-hans/八字/格局`
- **THEN** 页面说明格局的传统取法与判断思路，并写明本站排盘不自动判定格局

#### Scenario: 只有简中版本

- **WHEN** 检查 `/zh-hans/八字/十二长生` 的 hreflang
- **THEN** 只含 zh-hans 自身，没有 zh-hant 或 ko 地址

### Requirement: 概念页作为入链枢纽

每篇第二批概念页 SHALL 在正文中链接到八字排盘主工具页，并按主题链接到相关的生肖页或概念页。正文链接每页 2–5 条。概念页之间的同组链接 SHALL 让每篇至少有 3 条同组入链。

#### Scenario: 太岁页链接生肖

- **WHEN** 访客阅读 `/zh-hans/八字/太岁`
- **THEN** 正文链接八字排盘与生肖枢纽页，正文链接总数在 2–5 条之间
