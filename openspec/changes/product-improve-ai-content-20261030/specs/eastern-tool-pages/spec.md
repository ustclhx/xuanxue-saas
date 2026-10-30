# Spec Delta

## ADDED Requirements

### Requirement: 简体概念页语种一致
简体概念页的正文与内链 SHALL 使用简体中文用语并指向 `/zh-hans/` 下的页面，MUST NOT 链接到繁体页面；所有语言的概念页正文 MUST NOT 出现内部标识（如 `useful-god`、`ten-gods`、`luck`）。

#### Scenario: 喜用神简体页
- **WHEN** 访客打开 `/zh-hans/八字/喜用神`
- **THEN** 延伸阅读与正文链接均指向 `/zh-hans/`，正文中没有英文内部标识

### Requirement: 简体路径的繁体别名
在 `/zh-hans/` 下用繁体字 slug 访问概念页时，系统 SHALL 以 301 重定向到对应的简体 slug，MUST NOT 返回 404。

#### Scenario: 繁体 slug
- **WHEN** 访客请求 `/zh-hans/八字/大運`
- **THEN** 返回 301，跳转到 `/zh-hans/八字/大运`
