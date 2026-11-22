## ADDED Requirements

### Requirement: 空博客列表不进索引

某语言没有已发布文章时（草稿与未到发布日期的文章不计），该语言的博客列表页 SHALL 输出 `noindex, follow`。它 MUST NOT 出现在站点地图中，页头、页脚与正文 MUST NOT 链接到它。该语言有了已发布文章后，列表页 SHALL 自动恢复可索引，并重新进入站点地图与页脚。

#### Scenario: 两站当前的空博客

- **WHEN** 访客打开 `/blog`、`/es/blog`、`/zh-hans/blog`、`/zh-hant/blog`、`/ko/blog` 或 `/ja/blog`，且该语言只有草稿文章
- **THEN** 页面返回 200，并带 `<meta name="robots" content="noindex, follow">`；站点地图与页脚都不包含该地址

#### Scenario: 发布第一篇文章

- **WHEN** 某语言出现第一篇已发布文章
- **THEN** 该语言的博客列表不再输出 noindex，并出现在站点地图与页脚中
