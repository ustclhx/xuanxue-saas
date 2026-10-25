import { SITE_IDS, type TemplateConfig } from '@xuanxue/config'
import { localePrefix, prefixLocale } from '../i18n/url-prefix.ts'
import { TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'

export const PRERENDERED_PREFIXES = [
  '/blog',
  '/docs',
  '/privacy',
  '/terms',
  '/disclaimer',
  '/refund',
] as const

export function isPrerenderedPath(
  path: string,
  locales: readonly string[],
  tools: readonly ToolRoute[] = TOOL_ROUTES,
): boolean {
  const pathname = decodeURI(path.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/'
  const locale = prefixLocale(pathname, locales)
  const delocalized = locale ? pathname.slice(localePrefix(locale).length) || '/' : pathname
  if (delocalized === '/') return true
  return (
    PRERENDERED_PREFIXES.some(
      (prefix) => delocalized === prefix || delocalized.startsWith(`${prefix}/`),
    ) ||
    tools.some((tool) =>
      Object.entries(tool.paths).some(([language, route]) => {
        if (locale ? language !== locale : language !== 'en') return false
        const prefix = route?.replace(/\/+$/, '')
        return Boolean(prefix) && (prefix === delocalized || delocalized.startsWith(`${prefix}/`))
      }),
    )
  )
}

/** 两站入口分开保存；各工具显式注册，避免只能通过首页链接发现。 */
export function prerenderEntryPages(
  config: Pick<TemplateConfig, 'sites' | 'i18n'>,
  tools: readonly ToolRoute[] = TOOL_ROUTES,
): { path: string }[] {
  const paths = new Set<string>()
  for (const id of SITE_IDS) {
    const site = config.sites[id]
    for (const locale of site.locales) {
      if (!config.i18n.enabled && locale !== config.i18n.defaultLocale) continue
      const prefix =
        !config.i18n.enabled || site.defaultLocale === locale ? '' : localePrefix(locale)
      paths.add(prefix || '/')
      for (const tool of tools) {
        const path = tool.paths[locale]
        if (tool.site === id && path) paths.add(`${prefix}${path === '/' ? '' : path}` || '/')
      }
    }
  }
  return [...paths].map((path) => ({ path }))
}
