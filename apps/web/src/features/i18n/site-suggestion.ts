import type { SiteId } from '@xuanxue/config'
import { locales } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { SUGGESTABLE_LOCALES } from './suggestion.ts'
import { prefixLocale } from './url-prefix.ts'

/**
 * 本页可建议的语言（模板 0.5.11 的 suggestableLocales），根路由的首帧脚本与 LanguageSuggestion 共用，
 * 两处由同一站点与路径得出同一个值：
 * - 两站分开经营（D5）：已登记站点只建议本站语言（否则切换后落到本站 404）；
 * - 未登记的预览 Host 沿用模板默认（SUGGESTABLE_LOCALES，全部非默认语言）；
 * - 带语言前缀的页面（东方站英文入口页 `/en`）不建议。
 */
export function siteSuggestableLocales(
  site: { id: SiteId; known: boolean },
  pathname: string,
): readonly string[] | undefined {
  if (prefixLocale(pathname, locales)) return []
  return site.known ? templateConfig.sites[site.id].locales : SUGGESTABLE_LOCALES
}
