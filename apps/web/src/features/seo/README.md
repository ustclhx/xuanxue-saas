# 公开页面 SEO

公开页面通过 `pageHead` 输出标题、描述、canonical、Open Graph、Twitter 与 hreflang。
构建时从站点注册表及 `EAST_URL` / `WEST_URL` 固化站点地址；`/app`、`/account`、`/admin`、`/api` 禁止索引。
`/sitemap.xml` 按 Host 输出本站的语言子地图（`/sitemap/zh-hant.xml`、`/sitemap/ko.xml` 或 `/sitemap/en.xml`）。
站点地图与 OG 接口共用 `publicPages`，只收录功能开关已开启的页面、已发布的文章，排除草稿与未来文章。
默认语言无前缀，其他语言使用 `/<locale>`，缺少译文时沿用内容模块已有的默认语言回退。

## 构建与部署

预渲染 HTML 中的绝对地址在构建时固化，每个环境需要分别构建。`EAST_URL` / `WEST_URL` 未设置时使用站点注册表的首个 Host；`WEST_URL` 还兼容既有 `APP_URL` 构建参数。根 Turbo build 已将三项变量纳入环境与缓存键。

```sh
EAST_URL=https://east.example.com WEST_URL=https://west.example.com pnpm build
```

生产域名还须与 `template.config.ts` 的 hosts 一致；运行时 Host 只选站点，不改写 HTML 中的绝对地址。
每个语言首页与 `TOOL_ROUTES` 注册页均作为爬取入口，其余公开内容通过链接发现；定价仍使用既有快照策略。
注册工具时沿用 `{ id, site, paths, titles, descriptions? }`，paths 为不含语言前缀的路径；异名翻译通过同一条记录互指，没有英语版本时 x-default 指向所属站点 `/`。

西方入口保存为 `dist/client/index.html`；东方站根路径不再有静态入口，GET/HEAD 直接 302 到语言首页（`features/i18n/east-home.ts`）。构建 preview 通过仅写入本地 `.dev.vars` 的随机令牌识别爬取请求，将各语言请求改写成所属站点 Host，确保 `data-site`、主题和 SEO 一致。该令牌不进入 Worker vars 或客户端产物。
生产 HTML 请求先执行站点守卫，再经 ASSETS 绑定读取对应 HTML；东方 `/` 先跳转（不经静态文件）；直接访问 `/_site/*` 返回 404。JS、字体、图片、OG 等资源走 assets 直通。
未知 Host 走 SSR 并保持西方品牌、noindex；`?r=` 分享兼容链接带 X-Robots-Tag，robots 同时禁止抓取分享查询。`#r=` 不发送到服务端。
数据库不可达时公告/会话装饰降级，套餐沿用现有构建快照与运行时缓存。

## 分享图片

使用 `cf-workers-og@3.0.1` 的 Node 入口（satori + resvg-wasm）在构建期为每个公开页面、各语言版本生成
1200×630 PNG，包含定价、候补名单和通讯等未预渲染路由。图片输出到 `dist/client/og/`，
页面 `og:image` 指向静态资源；`_headers` 配置一天的公共缓存，不需要 Worker 运行时生成与 Cache API。
草稿与未到发布时间的文章不生成图片，定时文章到期后需要重新部署以更新预渲染列表、分享图与内容。
本地开发使用同一生成器，仅对清单中的公开页面响应图片。

字体同时加载 Noto Sans SC Regular 与 Noto Sans KR Regular 的语言子集 OTF（各一个字重），覆盖中韩文分享标题。
完整字形支持后续新增中文文章标题；字体保存在 `apps/web/scripts/seo/`，只供 Node 构建工具读取，
不会进入 Worker 或客户端静态资源包；WASM 同样仅留在构建阶段。
源文件：https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf 。
再分发许可证见 `apps/web/scripts/seo/FONT-LICENSE`（SIL OFL 1.1）。

## 验证

```sh
pnpm --filter @xuanxue/web test --project unit src/features/seo
pnpm --filter @xuanxue/web test:e2e seo.spec.ts
pnpm --filter @xuanxue/web build
cd apps/web
pnpm exec wrangler deploy --dry-run --outdir /tmp/seo-worker
```

离线单元测试解析 JSON-LD，检查 Organization、WebSite、BlogPosting、Product、Offer 的关键字段与套餐价格、货币。
页面测试检查实际各语言路由的唯一标题/canonical、客户端导航、发布过滤以及 静态 PNG 格式和尺寸。

人工复核：部署后打开 https://search.google.com/test/rich-results ，分别输入首页、博客文章与定价页地址。
也可粘贴预渲染 HTML；检查解析出的 BlogPosting、Product/Offer 与页面文案和价格一致。
Organization/WebSite 不一定获得富媒体展示资格，可同时用 https://validator.schema.org/ 检查其结构。
空套餐目录不输出产品，人工复核定价页应使用已有真实套餐数据的环境。
