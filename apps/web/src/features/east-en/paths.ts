import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'

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

/** 东方站英文页面的对外地址（不含 `/`）：注册表中东方站的 `en` 路径与共用静态页 */
export function isEastEnglishPath(pathname: string, tools: readonly ToolRoute[] = TOOL_ROUTES) {
  const path = clean(pathname)
  return (
    (EAST_ENGLISH_STATIC_PATHS as readonly string[]).includes(path) ||
    routePaths(tools, 'east').has(path)
  )
}

/** 只属于东方站英文的地址（西方站没有同路径页面）：西方站上返回 404，预渲染不按西方站抓取 */
export function isEastEnglishOnlyPath(pathname: string, tools: readonly ToolRoute[] = TOOL_ROUTES) {
  const path = clean(pathname)
  return routePaths(tools, 'east').has(path) && !routePaths(tools, 'west').has(path)
}
