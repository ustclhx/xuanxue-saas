import { type AnyRouteMatch, notFound } from '@tanstack/react-router'
import type { SpreadId } from '@xuanxue/tarot'
import { getLocale } from '../../../paraglide/runtime.js'
import { originFromMatches, pageHead } from '../../seo/metadata.ts'
import {
  spreadForSlug,
  type TarotLocale,
  tarotAlternates,
  tarotDescription,
  tarotPath,
  tarotSeoTitle,
  tarotSite,
} from './routes.ts'

/**
 * `/tarot/…` 路径段由英语与西班牙语共用（西班牙语带 `/es` 前缀，牌阵子路径各自本地化）：按当前语言取，
 * 其他语言按英语处理，随后由 resolveTarotRoute 返回 404。
 */
export function sharedTarotLocale(): Extract<TarotLocale, 'en' | 'es'> {
  return getLocale() === 'es' ? 'es' : 'en'
}

/**
 * 牌阵页的文件路由共用逻辑：`/tarot/…` 只服务英语，`/塔羅/…` 只服务繁中，`/타로/…` 只服务韩语；
 * 语言与路径不匹配（如 `/zh-hant/tarot`）或子路径不是本语言的牌阵时返回 404。
 */
export function resolveTarotRoute(locale: TarotLocale, slug?: string): SpreadId {
  const spread = getLocale() === locale ? spreadForSlug(locale, slug) : undefined
  if (!spread) throw notFound()
  return spread
}

export function tarotHead(
  locale: TarotLocale,
  slug: string | undefined,
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
) {
  const spread = spreadForSlug(locale, slug)
  if (!spread) return {}
  return pageHead(
    {
      path: tarotPath(spread, locale),
      locale,
      title: tarotSeoTitle(spread, locale),
      description: tarotDescription(spread, locale),
      // 按语言所在站点取各语言地址（东方站页面的 en 指向根路径英文 /tarot-spreads，5b）
      alternates: tarotAlternates(spread, tarotSite(locale)),
    },
    originFromMatches(matches),
  )
}
