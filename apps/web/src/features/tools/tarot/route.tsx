import { type AnyRouteMatch, notFound } from '@tanstack/react-router'
import type { SpreadId } from '@xuanxue/tarot'
import { getLocale } from '../../../paraglide/runtime.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { originFromMatches, pageHead } from '../../seo/metadata.ts'
import {
  spreadForSlug,
  TAROT_LOCALES,
  type TarotLocale,
  tarotDescription,
  tarotPath,
  tarotTitle,
} from './routes.ts'
import { TarotSpreadPage } from './tarot-page.tsx'

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
      title: tarotTitle(spread, locale),
      description: tarotDescription(spread, locale),
      alternates: Object.fromEntries(TAROT_LOCALES.map((l) => [l, tarotPath(spread, l)])),
    },
    originFromMatches(matches),
  )
}

export function TarotRoute({ locale, spread }: { locale: TarotLocale; spread: SpreadId }) {
  return (
    <MarketingShell>
      <TarotSpreadPage spread={spread} locale={locale} />
    </MarketingShell>
  )
}
