import type { SiteId } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { siteOfLocale } from '../../site/site.ts'
import { TOOL_ROUTES } from '../registry.ts'
import { TOOLS_HUB_ID, TOOLS_HUB_SEO_TITLES, TOOLS_HUB_TITLES, toolsHubPath } from './routes.ts'

/**
 * 「全部工具」枢纽页的 head（specs/tool-directory「全部工具枢纽页」）：canonical 指向自身，hreflang 取注册表中
 * 本站各语言的枢纽页（pageHead 按站点与发布状态筛选），结构化数据为面包屑。TDK 属于免费区，不写 AI。
 * 东方站根路径英文与西方站共用 `/tools`，按页面所属站点区分（SeoPage.site）。
 */
export function toolsHubSeoPage(site: SiteId, locale: string): SeoPage | null {
  const path = toolsHubPath(site, locale)
  const description = TOOL_ROUTES.find((route) => route.site === site && route.id === TOOLS_HUB_ID)
    ?.descriptions?.[locale]
  if (!path || !description) return null
  return {
    path,
    locale,
    title: TOOLS_HUB_SEO_TITLES[site][locale] ?? TOOLS_HUB_TITLES[locale] ?? path,
    description,
    titleMain: TOOLS_HUB_TITLES[locale],
    parent: '/',
    // 另一站点的同语言页面（东方站 en）必须声明站点；其余按语言的归属站点，不必声明
    ...(siteOfLocale(locale, templateConfig) !== site && { site }),
  }
}

export function toolsHubHead(site: SiteId, locale: string) {
  const page = toolsHubSeoPage(site, locale)
  if (!page) return null
  return pageHead(page, '', [
    breadcrumbData(
      [
        { name: m.marketing_nav_home(), path: '/' },
        { name: TOOLS_HUB_TITLES[locale] ?? page.title, path: page.path },
      ],
      locale,
      page.site,
    ),
  ])
}
