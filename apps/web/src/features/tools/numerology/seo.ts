import type { AnyRouteMatch } from '@tanstack/react-router'
import { notFound } from '@tanstack/react-router'
import { getLocale } from '../../../paraglide/runtime.js'
import { originFromMatches, pageHead } from '../../seo/metadata.ts'
import { NUMEROLOGY_LOCALE } from './routes.ts'

export interface QA {
  readonly question: string
  readonly answer: string
}

/** FAQPage 结构化数据：问答须与页面上可见的 FAQ 一致（同一份 frontmatter / 文案） */
export function faqPageData(items: readonly QA[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/** content-collections 的 `{ q, a }` → ToolFaq 条目 */
export function faqItems(faq: readonly { q: string; a: string }[]): QA[] {
  return faq.map(({ q, a }) => ({ question: q, answer: a }))
}

/** 数字命理页只属于西方站英语：其他语言前缀（`/ko/numerology-calculator`）返回 404 */
export function requireNumerologyLocale() {
  if (getLocale() !== NUMEROLOGY_LOCALE) throw notFound()
}

/** 页面 head：Title / description / canonical / hreflang，附 FAQPage */
export function numerologyHead(
  page: { path: string; title: string; description: string },
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
  faq: readonly QA[] = [],
) {
  return pageHead(
    { ...page, locale: NUMEROLOGY_LOCALE },
    originFromMatches(matches),
    faq.length ? [faqPageData(faq)] : [],
  )
}
