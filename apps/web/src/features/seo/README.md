# 公开页面 SEO

公开页面通过 `pageHead` 输出标题、描述、canonical、Open Graph、Twitter 与 hreflang。
构建时从站点注册表及 `EAST_URL` / `WEST_URL` 固化站点地址；`/app`、`/account`、`/admin`、`/api` 禁止索引。
`/sitemap.xml` 按 Host 输出本站的语言子地图（`/sitemap/zh-hant.xml`、`/sitemap/ko.xml` 或 `/sitemap/en.xml`）。
robots 对 `AI_CRAWLERS` 中的 AI 爬虫逐个输出 `Allow: /` 分组，并在每组重复私有路径的 Disallow；`/llms.txt` 按 Host 列出站点简介与本站核心工具、定价、`/faq` 的规范地址，未知 Host 返回 404。
静态页标题与描述在 `metadata.ts` 的 `staticCopy` 中按全部语言必填，缺少语言时类型检查报错。
站点地图与 OG 接口共用 `publicPages`，只收录功能开关已开启的页面、已发布的文章，排除草稿与未来文章。
默认语言无前缀，其他语言使用 `/<locale>`，缺少译文时沿用内容模块已有的默认语言回退。

## 构建与部署

预渲染 HTML 中的绝对地址在构建时固化，每个环境需要分别构建。`EAST_URL` / `WEST_URL` 未设置时使用站点注册表的首个 Host；`WEST_URL` 还兼容既有 `APP_URL` 构建参数。根 Turbo build 已将三项变量纳入环境与缓存键。

```sh
EAST_URL=https://east.example.com WEST_URL=https://west.example.com pnpm build
```

生产域名还须与 `template.config.ts` 的 hosts 一致；运行时 Host 只选站点，不改写 HTML 中的绝对地址。
每个语言首页与 `TOOL_ROUTES` 注册页均作为爬取入口，其余公开内容通过链接发现；定价仍使用既有快照策略。
注册工具时沿用 `{ id, site, paths, titles, descriptions? }`，paths 为不含语言前缀的路径；异名翻译通过同一条记录互指。x-default 指向同一页面的站点默认语言版本（西方站英语、东方站繁体中文），缺少时按站点语言顺序取第一个存在的版本，不指向会跳转的东方站根路径；页面 head 与站点地图共用 `alternateLinks`，`indexing.test.ts` 用实际内容集合核对二者一致。

西方入口保存为 `dist/client/index.html`；东方站根路径不再有静态入口，GET/HEAD 由站点守卫跳到语言首页（`features/i18n/east-home.ts`）：没有其他东方站语言偏好时（含爬虫）301 到规范首页 `/zh-hant`，手动选择或浏览器语言为简体、韩语时 302。构建 preview 通过仅写入本地 `.dev.vars` 的随机令牌识别爬取请求，将各语言请求改写成所属站点 Host，确保 `data-site`、主题和 SEO 一致。该令牌不进入 Worker vars 或客户端产物。
生产 HTML 请求先执行站点守卫，再经 ASSETS 绑定读取对应 HTML；东方 `/` 先跳转（不经静态文件）；直接访问 `/_site/*` 返回 404。
站点守卫先做地址规范化（`features/site/gate.ts` 的 `canonicalUrl`）：已登记域名的 HTTP 升级为 HTTPS，GET/HEAD 的非根路径去掉结尾斜杠（`/api/`、`_` 内部路径除外），并与站点跳转合并为一次 301（其他方法 308）；东方站无前缀公开路径 301 到 `/zh-hant` 的同一路径，西方站 `/en/*` 301 到无前缀地址。构建期预渲染请求不做规范化。
认证页（登录、注册、找回 / 重置密码、邮箱验证、接受邀请，两站全部语言）带 `X-Robots-Tag: noindex, nofollow` 与 robots meta，canonical 为不带查询参数的同语言地址；robots.txt 不禁止它们，便于爬虫读到 noindex。页头登录链接固定为无参数的 `/login` 并带 `rel="nofollow"`，回跳地址在点击时附加。JS、字体、图片、OG 等资源走 assets 直通。
未知 Host 走 SSR 并保持西方品牌、noindex；`?r=` 分享兼容链接带 X-Robots-Tag，robots 同时禁止抓取分享查询。`#r=` 不发送到服务端。
数据库不可达时公告/会话装饰降级，套餐沿用现有构建快照与运行时缓存。

## 分享图片

使用 `cf-workers-og@3.0.1` 的 Node 入口（satori + resvg-wasm）在构建期为每个公开页面、各语言版本生成
1200×630 PNG，包含定价、候补名单和通讯等未预渲染路由。图片输出到 `dist/client/og/`，
页面 `og:image` 指向静态资源；`_headers` 配置一天的公共缓存，不需要 Worker 运行时生成与 Cache API。
草稿与未到发布时间的文章不生成图片，定时文章到期后需要重新部署以更新预渲染列表、分享图与内容。
本地开发使用同一生成器，仅对清单中的公开页面响应图片。

运行时分享卡片（项目注册的结果卡片、通用分享页 `/s/<类型>/<令牌>`、到期、失效与缓存）见
[分享卡片与分享页](../../../../../docs/share-cards.md)。构建期分享图的版式与运行时分享卡片共用 `features/share-cards/layout.tsx` 的默认版式（设计稿
`docs/design-system/prototypes/share-cards/Card.dc.html` 的 `default` 变体，浅色主题 token），
渲染经 `src/node/share-card-renderer.ts`。
本项目的站点解析在 `features/share-cards/share-cards.sites.ts`：构建期按页面语言（东方站英文入口页按路径），
运行时按请求域名，换用站点品牌、规范域名（ganjiday.com / arcanumber.com）与 brand.css 对应的配色。

字体保存在 `apps/web/public/fonts/share-card/`，作为静态资源发布（`_headers` 长期缓存与 `noindex`）：

- CJK：Noto Sans SC Regular 的完整简体中文子集 OTF，仅一个字重，原始体积 8,331,336 字节。构建期与 Node 从本地文件读取；
  Workers 只在待渲染文本含 CJK 时经 `ASSETS.fetch` 读取，不进入 Worker 包。
  源文件：https://github.com/notofonts/noto-cjk/blob/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf ，
  许可证 `NOTO-LICENSE`（SIL OFL 1.1）。
- 西文：Inter Latin 400/600 woff（`@fontsource/inter@5.2.8`，satori 不支持 woff2），扩展名为 `.woff.bin`，
  以便 Workers 作为 Data 模块随渲染器打包；许可证 `INTER-LICENSE`（SIL OFL 1.1）。

文字支持范围（分享卡片与构建期分享图共用，`features/share-cards/text.ts`）：

- 文本含 Inter Latin 子集之外的字符时才加载 Noto Sans SC：中日文、基本西里尔与基本希腊字母、拼音声调字母。
- emoji（含 ZWJ 序列、变体选择符、肤色修饰与旗帜）在渲染前去除，没有 emoji 字体。
- 两种字体都缺字的带附加符号字母降级为基本字母（如 `Ą`→`A`、`ά`→`α`）。
- **模板字体不支持**：谚文（韩文）、泰文、老挝文、高棉文、缅甸文，以及 Noto 简体子集之外的扩展西里尔字母（如乌克兰文 `і`、`ї`）。
  这些字符显示为方框；项目在 `features/share-cards/share-cards.fonts.ts` 登记回退字体后正常显示，构建期分享图同样生效，见 [分享卡片 §7.1](../../../../../docs/share-cards.md#71-项目回退字体)。
- 本项目登记了 Noto Sans KR Regular（`NotoSansKR-Regular.otf`，许可证同 `NOTO-LICENSE`），韩语页面的分享图显示完整谚文。
- 副标题为「应用名 · 首页 SEO 标题」（按页面语言），多站点项目可按站点覆盖，见 [分享卡片 §6.1](../../../../../docs/share-cards.md#61-多站点)。

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
