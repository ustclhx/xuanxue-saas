import type { AnyRouteMatch } from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import { getLocale } from '../../paraglide/runtime.js'
import { titleWithSite } from './metadata.ts'

/**
 * 没有 SEO 元数据的页面（应用区、账户页、后台、分享页）的标题：按根 loader 下发的当前站点带站名
 * （openspec separate-landing-homepage design.md D3a）。
 * 独立成模块：metadata.ts 会在 vite 配置加载阶段被构建脚本导入，那时 Paraglide 运行时尚未生成。
 */
export function siteTitle(
  title: string,
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
): string {
  const root = matches.find((match) => match.routeId === '__root__')
  const site = (root?.loaderData as { site?: { id: SiteId; known: boolean } } | undefined)?.site
  // 未登记的 Host（预览环境可浏览全部语言）没有确定的站点，按语言取站名
  return titleWithSite(title, getLocale(), site?.known ? site.id : undefined)
}
