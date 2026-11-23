import type { SeoPage } from '../../seo/metadata.ts'
import {
  COMPAT_LOCALES,
  COMPAT_TOOL_PATHS,
  type CompatPageLocale,
  type CompatScenarioKey,
  compatScenarioPath,
  isCompatLocale,
  isCompatScenarioKey,
} from './paths.ts'

/** 内容集合条目中 SEO 清单需要的字段（content-collections.ts 的 compat 集合） */
export interface CompatSeoEntry {
  readonly locale: string
  readonly page: string
  readonly title: string
  readonly description: string
  readonly short: string
}

/**
 * 合盘工具页与场景页进入公开页面清单（站点地图、hreflang、内链区块）：标题与描述取内容集合。
 * 层级为 首页 › 合盘工具 › 场景，场景页同组（group 为工具页地址）。ko 工具页没有集合条目，沿用注册表。
 * hreflang 列出全部五种语言的同一场景（注册表 `saju-gunghap-<场景>` 的 paths）。
 */
export function compatSeoPages(entries: readonly CompatSeoEntry[]): SeoPage[] {
  return entries.flatMap((entry): SeoPage[] => {
    if (!isCompatLocale(entry.locale)) return []
    const locale: CompatPageLocale = entry.locale
    const tool = COMPAT_TOOL_PATHS[locale]
    const site = locale === 'en' ? ({ site: 'east' } as const) : {}
    if (entry.page === 'index') {
      return [
        {
          path: tool,
          locale,
          ...site,
          title: entry.title,
          description: entry.description,
          titleMain: entry.short,
          parent: '/',
          alternates: COMPAT_TOOL_PATHS,
        },
      ]
    }
    if (!isCompatScenarioKey(entry.page)) return []
    const key: CompatScenarioKey = entry.page
    return [
      {
        path: compatScenarioPath(locale, key),
        locale,
        ...site,
        title: entry.title,
        description: entry.description,
        titleMain: entry.short,
        parent: tool,
        group: tool,
        alternates: Object.fromEntries(
          COMPAT_LOCALES.map((other) => [other, compatScenarioPath(other, key)]),
        ),
      },
    ]
  })
}
