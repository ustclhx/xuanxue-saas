import { COMPAT_EAST_EN_CONTENT_ROUTES } from '../east-content/compat/paths.ts'
import { type EastContentRoute, eastContentRouteOf } from '../east-content/routes.ts'
import { YEARLY_EAST_EN_CONTENT_ROUTES } from '../east-content/yearly/paths.ts'
import { YEARLY_TOOL_EN_ROUTES } from '../east-content/yearly-tool/paths.ts'
import { ZODIAC_EAST_EN_CONTENT_ROUTES } from '../east-content/zodiac/paths.ts'
import { ZODIAC_PAIR_EAST_EN_CONTENT_ROUTES } from '../east-content/zodiac-pair/paths.ts'
import { TOOLS_HUB_EAST_EN_CONTENT_ROUTES } from '../tools/hub/routes.ts'
import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'
import { westContentRouteOf } from '../west-content/routes.ts'

/**
 * 东方站根路径英文页面的地址（openspec add-locales-eu-ja 5b；关键词地图 keyword-maps/east-en.md）。
 *
 * 英语在两站各有一套页面：西方站 arcanumber.com 与东方站 ganjiday.com 都以无前缀地址服务英文。
 * Paraglide 只有一种 `en`，因此「哪一套英文」由请求所在站点决定（features/site/context.tsx、
 * 根 loader 的 `site`），页面、文案与 SEO 都按「站点 × 语言」区分：
 * - 工具页（八字、紫微、塔罗牌阵、78 张 as feelings 牌页）在工具注册表登记为 `site: 'east'` 的 `en` 路径，
 *   与西方站路径互不重叠；
 * - 共用地址的静态页（`/faq`、`/pricing`、法律页）按站点渲染不同内容；
 * - 东方站英文页面的预渲染文件放在 `/en/…` 命名空间（`/faq` → en/faq.html，`/` → en.html），
 *   不与西方站同名文件冲突；对外地址没有 `/en` 前缀，东方站 `/en/*` 一律 404。
 *
 * 纯数据与纯函数（只引用注册表），站点守卫、预渲染配置与构建脚本都可引用。
 */
export const EAST_ENGLISH_STATIC_PATHS = [
  '/faq',
  '/pricing',
  '/privacy',
  '/terms',
  '/refund',
  '/disclaimer',
] as const

/** 东方站英文页面中会预渲染的静态页（定价页读运行时价格，走 SSR） */
export const EAST_ENGLISH_PRERENDERED_STATIC = EAST_ENGLISH_STATIC_PATHS.filter(
  (path) => path !== '/pricing',
)

/** 由各内容组随页面一同登记；塔罗地址仍来自工具注册表。 */
export const EAST_EN_CONTENT_ROUTES: readonly (EastContentRoute & { locale: 'en' })[] = [
  // content-growth-v2-tools 第 7 组：`/bazi-2027`
  ...YEARLY_TOOL_EN_ROUTES,
  // content-growth-v2-tools 第 13 组：`/bazi-compatibility` 正文与 5 个场景页
  ...COMPAT_EAST_EN_CONTENT_ROUTES,
  // content-growth-v2-tools 第 6 组：「All tools」枢纽页 `/tools`（西方站同路径另有自己的一页）
  ...TOOLS_HUB_EAST_EN_CONTENT_ROUTES,
  // content-growth-v2-tools 第 11 组：`/chinese-zodiac` 枢纽与 `/chinese-zodiac-2027` 年度枢纽及 12 页
  ...ZODIAC_EAST_EN_CONTENT_ROUTES,
  ...YEARLY_EAST_EN_CONTENT_ROUTES,
  // content-growth-v2-tools 第 17 组：`/chinese-zodiac-compatibility` 总表与 78 个配对页（发布后才有条目）
  ...ZODIAC_PAIR_EAST_EN_CONTENT_ROUTES,
]

export function eastEnContentRouteOf(path: string) {
  return eastContentRouteOf('en', path, EAST_EN_CONTENT_ROUTES)
}

/** 这些根路径留给东方站英文；未发布的地址由路由器直接返回 404。 */
export function isEastEnglishContentNamespace(pathname: string): boolean {
  return /^\/(?:chinese-zodiac(?:-2027|-compatibility)?|bazi-compatibility|bazi-2027|tools)(?:\/|$)/.test(
    clean(pathname),
  )
}

function clean(pathname: string): string {
  let path = pathname
  try {
    path = decodeURI(pathname)
  } catch {
    // 非法编码按原样比较
  }
  return path.replace(/\/+$/, '') || '/'
}

// 守卫每个请求都会查询：按注册表缓存两站的 en 路径集合
const cache = new WeakMap<readonly ToolRoute[], Record<'east' | 'west', Set<string>>>()
function routePaths(tools: readonly ToolRoute[], site: 'east' | 'west'): Set<string> {
  let entry = cache.get(tools)
  if (!entry) {
    const of = (id: 'east' | 'west') =>
      new Set(
        tools
          .filter((tool) => tool.site === id)
          .map((tool) => tool.paths.en)
          .filter((path): path is string => Boolean(path)),
      )
    entry = { east: of('east'), west: of('west') }
    cache.set(tools, entry)
  }
  return entry[site]
}

/** 东方站英文页面的对外地址（不含 `/`）：已登记的内容、工具与共用静态页 */
export function isEastEnglishPath(pathname: string, tools: readonly ToolRoute[] = TOOL_ROUTES) {
  const path = clean(pathname)
  return (
    (EAST_ENGLISH_STATIC_PATHS as readonly string[]).includes(path) ||
    routePaths(tools, 'east').has(path) ||
    eastEnContentRouteOf(path) !== undefined
  )
}

/** 只属于东方站英文的地址（西方站没有同路径页面）：西方站上返回 404，预渲染不按西方站抓取 */
export function isEastEnglishOnlyPath(pathname: string, tools: readonly ToolRoute[] = TOOL_ROUTES) {
  const path = clean(pathname)
  return (
    (routePaths(tools, 'east').has(path) || eastEnContentRouteOf(path) !== undefined) &&
    !routePaths(tools, 'west').has(path) &&
    westContentRouteOf('en', path) === undefined
  )
}
