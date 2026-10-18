import { type AnyRouteMatch, notFound } from '@tanstack/react-router'
import { getLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'
import { originFromMatches, pageHead } from '../../seo/metadata.ts'
import { faqItems, faqPageData } from '../numerology/seo.ts'
import type { TarotMeaningPage } from './meaning.functions.ts'
import { tarotMeaningSeoPages } from './meaning-routes.ts'
import type { TarotLocale } from './routes.ts'

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
