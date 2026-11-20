## MODIFIED Requirements

### Requirement: 通用分享页
模板 SHALL 提供公开分享页路由 `/s/<类型>/<令牌>`：对有效分享显示卡片图片、项目注册的标题与描述，以及前往站点的入口；无效、已撤销或已到期时返回 404 页面。分享页 SHALL 输出指向分享卡片的元数据，robots meta 与 `X-Robots-Tag` MUST 为 `noindex, follow`（不进索引、跟随页内链接），MUST NOT 进入站点地图或 `llms.txt`；robots.txt MUST NOT 因此禁止抓取分享页，已收录的分享页靠 noindex 退出索引。分享卡片图片地址 `/share-card/*` 不是 HTML，只以响应头 `X-Robots-Tag: noindex` 声明。项目 SHALL 能对某个类型关闭通用分享页，改用自己的页面并使用同一个元数据工具。

#### Scenario: 打开有效分享页
- **WHEN** 访客打开一个有效分享的分享页
- **THEN** 页面显示卡片图片、标题、描述与站点入口，不要求登录

#### Scenario: 分享页已到期
- **WHEN** 访客打开一个已到期的分享页
- **THEN** 返回 404 页面，不显示任何资源信息

#### Scenario: 项目关闭通用分享页
- **WHEN** 项目对某个类型关闭通用分享页
- **THEN** 该类型的 `/s/<类型>/<令牌>` 返回 404，卡片地址不受影响

#### Scenario: 搜索引擎抓取分享页
- **WHEN** 搜索引擎抓取一个有效分享页
- **THEN** 页面 robots meta 与响应头 `X-Robots-Tag` 都是 `noindex, follow`，页面中前往站点的链接可被跟随
