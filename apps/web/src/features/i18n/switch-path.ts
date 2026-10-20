import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'
import { localePrefix, prefixLocale } from './url-prefix.ts'

/**
 * 切换语言后的目标路径（不含语言前缀）。工具页在各语言下路径不同（`/tarot` ↔ `/塔羅` ↔ `/타로`），
 * 只换语言前缀会落到不存在的页面：按工具注册表换成目标语言的对应页面，目标语言没有该页面时回到
 * 目标语言首页。不在注册表中的共用页面（定价、博客、法律页等）保留原路径。
 * `pathname` 可以是已编码的浏览器地址。
 */
export function switchLocalePath(
  pathname: string,
  next: string,
  locales: readonly string[],
  tools: readonly ToolRoute[] = TOOL_ROUTES,
): string {
  const decoded = decodeURI(pathname)
  const current = prefixLocale(decoded, locales)
  const rest = current ? decoded.slice(localePrefix(current).length) || '/' : decoded
  const path = rest.replace(/(.)\/+$/, '$1')
  const tool = tools.find((item) =>
    Object.entries(item.paths).some(
      ([language, route]) => route === path && (current ? language === current : true),
    ),
  )
  if (!tool) return path
  return tool.paths[next] ?? '/'
}
