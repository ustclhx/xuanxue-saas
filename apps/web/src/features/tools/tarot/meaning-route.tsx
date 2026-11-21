import { type AnyRouteMatch, notFound } from '@tanstack/react-router'
import { getLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'
import { originFromMatches, pageHead } from '../../seo/metadata.ts'
import { faqItems, faqPageData } from '../numerology/seo.ts'
import type { TarotMeaningPage } from './meaning.functions.ts'
import { tarotIndexSeo, tarotMeaningSeoPages } from './meaning-routes.ts'
import { type TarotLocale, tarotSite } from './routes.ts'

/** 牌义索引页的 head：Title、description、canonical 与同站 hreflang（与牌阵页相同的写法） */
export function tarotIndexHead(
  locale: TarotLocale,
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
) {
  // 现有牌义索引页：en 为西方站，其他语言为东方站（东方站英文 as feelings 索引见 features/east-en）
  return pageHead(tarotIndexSeo(locale, tarotSite(locale)), originFromMatches(matches))
}

export function requireMeaningLocale(locale: TarotLocale) {
  if (!templateConfig.marketing.enabled || getLocale() !== locale) throw notFound()
}

export function tarotMeaningHead(
  page: TarotMeaningPage,
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
) {
  const seo = tarotMeaningSeoPages([page])[0]
  return seo ? pageHead(seo, originFromMatches(matches), [faqPageData(faqItems(page.faq))]) : {}
}
