# seo-internal-linking Specification

## Purpose

约束公开页面之间的站内链接：页面声明层级与主词，模板生成固定内链区块，构建后对实际渲染的链接图做检查，使批量生成的页面不会成为孤岛，内链结构可在 CI 中验收。

## Requirements

### Requirement: 页面层级与主词声明
每个可索引的公开页面 SHALL 声明 `url`、`titleMain`；除首页外 MUST 声明 `parent`，且 `parent` MUST 指向存在的可索引页面。`url` 全站（同一语言内）MUST 唯一。缺失或指向不存在的页面时构建 MUST 失败。

#### Scenario: 程序化页面缺少 parent
- **WHEN** 项目新增一批详情页，其中一页没有声明 `parent`
- **THEN** 构建失败，并指出该页的地址

#### Scenario: parent 指向不存在的页面
- **WHEN** 某页的 `parent` 是 `/tarot`，但站点没有 `/tarot` 页面
- **THEN** 构建失败，并指出该页与缺失的上级地址

#### Scenario: 主词重复
- **WHEN** 同一语言中两页的 `titleMain` 相同
- **THEN** 构建输出警告并列出两页，构建不失败

### Requirement: 可选字段与默认值
页面 MAY 声明 `anchorShort`（一个短锚文本变体）、`group`（同级分组）、`related`（相关页地址列表）、`indexable`（默认 `true`）与 `priority`（`'money'` 表示钱页）。`group` 与 `related` 中的地址 MUST 指向存在的可索引页面，否则构建 MUST 失败。

#### Scenario: related 指向不可索引页
- **WHEN** 某页的 `related` 包含一个 `indexable: false` 的页面
- **THEN** 构建失败，并指出该页与目标地址

### Requirement: 面包屑
除首页外的每个可索引公开页面 SHALL 显示面包屑：沿 `parent` 链列出全部上级，每级是真实的 `<a href>`，并输出与之一致的 BreadcrumbList 结构化数据。

#### Scenario: 博客文章的面包屑
- **WHEN** 抓取一篇博客文章的 HTML
- **THEN** 页面包含「首页 › 博客 › 文章」的链接，以及内容一致的 BreadcrumbList JSON-LD

### Requirement: 列表页列出下级
被其他页面声明为 `parent` 的页面（hub）SHALL 链接到其全部可索引下级；下级超过项目配置的单页上限（默认 100）时 MUST 分页，每个分页 MUST 可以从 hub 首页经链接到达。

#### Scenario: 下级数量超出上限
- **WHEN** 某 hub 有 150 个下级，上限为 100
- **THEN** hub 第一页列出 100 个并链接到第二页，第二页列出剩余 50 个

### Requirement: 详情页的同级与相关区块
声明了 `group` 的页面 SHALL 显示同组的其他页面（数量由项目配置，默认 3–5 个）；声明了 `related` 的页面 SHALL 显示相关区块。未声明时 MUST NOT 显示对应区块。

#### Scenario: 没有 related 的页面
- **WHEN** 某页没有声明 `related`
- **THEN** 页面上没有「相关」区块

### Requirement: 系列页的上一篇与下一篇
项目声明为有序系列的同组页面 SHALL 显示上一篇与下一篇链接；系列的第一页没有上一篇，最后一页没有下一篇。

#### Scenario: 系列中间的一页
- **WHEN** 打开有序系列的第 5 页
- **THEN** 页面链接到第 4 页与第 6 页

### Requirement: 锚文本来源
模板区块生成的站内链接 SHALL 使用目标页的 `titleMain` 或 `anchorShort` 作为锚文本，MUST NOT 接受自由文本。全站任何站内链接的锚文本 MUST NOT 是项目配置的禁用词（默认含「点击这里」「了解更多」「查看详情」「here」「read more」「learn more」），出现时构建 MUST 失败。只含图片的链接 MUST 带非空 `alt`。

#### Scenario: 正文中写了「点击这里」
- **WHEN** 一篇文章正文的链接文字是「点击这里」
- **THEN** 构建失败，并指出文章地址与链接目标

### Requirement: 只有真实链接计入链接图
链接图 SHALL 只计入 `<a href>` 元素；按钮、`onclick` 与脚本跳转 MUST NOT 计入。

#### Scenario: 用按钮跳转的入口
- **WHEN** 某页唯一的入口是一个用脚本跳转的按钮
- **THEN** 该页按没有入链处理

### Requirement: 构建后链接图检查
构建 SHALL 读取实际产出的公开页面 HTML，按以下规则检查并输出报告；失败级规则不满足时 MUST 以非零状态退出：
- 失败：可索引页没有站内入链（站点地图不计）；站内死链；可索引页正文或区块链接到不可索引页（导航层与转化入口 `action` 区域除外）；禁用锚文本；违反姊妹站链接约束；可索引页的 `<h1>` 不是恰好一个。
- 警告：同一语言中两页的 `<h1>` 文本相同；页头频道链接数不在阈值范围内（默认 3–7）；声明了 `group` 的详情页正文链接少于阈值（默认 2）；从首页出发的最短点击深度超过阈值（默认 3）；钱页站内入链少于阈值（默认 3）；页脚链接数超过阈值（默认 10）；主词重复。

#### Scenario: 孤岛页
- **WHEN** 某可索引页只出现在站点地图中，没有任何站内页面链接到它
- **THEN** 构建失败，报告列出该页

#### Scenario: 深度超出阈值
- **WHEN** 某页从首页最少需要点击 4 次才能到达
- **THEN** 构建成功，报告中有该页的深度警告

### Requirement: 阈值与规则由项目配置
项目 SHALL 能够配置各阈值、禁用词、钱页列表、sister 域名列表、系列定义，以及检查模式（`report` 只报告、`enforce` 按级别失败）。未配置时为 `report`，模板仓库自身配置为 `enforce`。

#### Scenario: 衍生项目先用报告模式
- **WHEN** 项目把检查模式设为 `report`
- **THEN** 失败级问题只出现在报告中，构建成功

### Requirement: 姊妹站链接约束
项目 SHALL 能够声明 sister 域名列表（同模板生成的其他站点，包括同一部署中的其他站点域名）。指向这些域名的链接 MUST 带 `rel="nofollow"`；MUST NOT 出现在导航层（页头、页脚、面包屑）；MUST NOT 指向与当前页相同路径的镜像页面。违反任一条时构建 MUST 失败。正文中带 nofollow 的普通姊妹站链接允许。

#### Scenario: 正文中的姊妹站链接
- **WHEN** 东站一篇文章正文链接到西站的另一篇文章，并带 `rel="nofollow"`
- **THEN** 检查通过

#### Scenario: 缺少 nofollow
- **WHEN** 东站某页链接到西站，没有 `rel="nofollow"`
- **THEN** 构建失败，并指出该链接

#### Scenario: 页脚放姊妹站链接
- **WHEN** 东站页脚链接到西站首页，即使带 nofollow
- **THEN** 构建失败，指出这是导航层的姊妹站链接

#### Scenario: 镜像互指
- **WHEN** 东站 `/tarot/the-fool` 链接到西站 `/tarot/the-fool`
- **THEN** 构建失败，指出这是镜像链接

### Requirement: 不可索引页不参与链接图
`indexable: false` 的页面以及应用区、账户、后台、分享页、带查询参数的地址 SHALL 输出 noindex，MUST NOT 出现在站点地图，且不作为链接图中的检查对象。

#### Scenario: 分享结果页
- **WHEN** 构建产物中存在分享页 `/s/<类型>/<令牌>`
- **THEN** 它不在站点地图中，也不因没有入链而报告为孤岛

### Requirement: 多语言检查
构建后的链接图检查 SHALL 对公开页面同时检查多语言规则；失败级规则的处理与链接图检查相同（`report` 只报告，`enforce` 以非零状态退出）。
- 失败：
  - 可索引页的 canonical 不指向自身；
  - hreflang 未双向互指、跨域名、指向不可访问或不可索引的地址，或 x-default 不是恰好一条；
  - `<html lang>` 与页面在 hreflang 组中声明的语言不一致；
  - 以不同 Accept-Language 请求同一公开地址时状态、`Location` 或正文语言不同；
  - 公开页响应带有语言相关的 `Set-Cookie`；
  - 站内链接使用 `?lang=` 一类语言查询参数；
  - 带默认语言前缀的地址未 301 到无前缀地址；
  - 服务端 HTML 中出现语言提示。

#### Scenario: hreflang 单向
- **WHEN** 英文页的 hreflang 列出了中文页，而中文页的 hreflang 没有列出英文页
- **THEN** 检查报告该页对的 hreflang 失败

#### Scenario: 按浏览器语言跳转
- **WHEN** 项目在 `/` 上按 Accept-Language 返回 302 到 `/zh`
- **THEN** 检查报告失败，`enforce` 模式下以非零状态退出

#### Scenario: 模板自身
- **WHEN** 模板仓库构建后运行检查
- **THEN** 多语言规则没有失败项

### Requirement: 项目内链验收审计
项目 SHALL 提供可复跑的审计命令（`pnpm --filter @xuanxue/web audit:seo`），对生产构建按站点抓取站点地图全部地址与语言首页，检查：孤岛页为 0、站内死链为 0、每页正文内链 2–5（正文为未标记区域，按不同目标计数；首页与 hub 页不设上限，超过 5 的非 hub 页只提示）、钱页正文与区块入链来源 ≥3、同一目标页的正文锚文本 ≤2 种，以及正文入链 ≥5 条的目标页 top1 锚文本占比 ≤70%。没有能自然带出链接的现成句子的页面 SHALL 登记为例外并在报告中单独列出，MUST NOT 为补足链接数新造句子。审计 SHALL 同时输出每页 Title、Description、H1 及其长度（英文按字符，中文与韩文按全角宽度、半角计 0.5）。

#### Scenario: 某目标页锚文本出现第三种表述
- **WHEN** 一个工具页的正文入链出现三种不同的锚文本
- **THEN** 审计报告列出该目标页、三种表述与各自来源页，并计入违规

#### Scenario: 入链不足 5 条的目标页
- **WHEN** 一个目标页只有 3 条正文入链且表述相同
- **THEN** 审计只在提示栏列出 top1 占比，不计入违规；若表述超过 2 种仍计入违规

### Requirement: 转化入口使用 action 区域
首屏主按钮、页尾转化条与「用本站工具算你的」一类转化入口 SHALL 标记 `data-link-zone="action"`，不计入正文内链数与锚文本统计；工具卡片的链接 SHALL 只包住工具名，锚文本为目标页主词，整张卡片仍可点击。

#### Scenario: 首页工具卡片
- **WHEN** 搜索引擎读取首页工具入口区块
- **THEN** 每张卡片的 `<a>` 文本只是工具名，说明文字与行动文字在链接之外
