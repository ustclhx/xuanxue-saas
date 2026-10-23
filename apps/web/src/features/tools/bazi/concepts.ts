import { pageHead } from '../../seo/metadata.ts'
import { toolHref } from '../tool-href.ts'
import type { ConceptKey } from './eastern-routes.ts'

export interface ConceptPage {
  title: string
  description: string
  slug: string
  locale: 'zh-Hant' | 'zh-Hans' | 'ko'
  conceptKey: Exclude<ConceptKey, 'base'>
  block: string
  html: string
  faq: { q: string; a: string }[]
}

/** 页面使用 frontmatter slug，文件名只负责组织内容。 */
export function conceptPagePath(page: Pick<ConceptPage, 'locale' | 'slug'>) {
  return `/${page.locale === 'ko' ? '사주' : '八字'}/${page.slug}`
}

export function conceptPageData(pages: readonly ConceptPage[], page: ConceptPage) {
  return {
    ...page,
    path: conceptPagePath(page),
    alternates: Object.fromEntries(
      pages
        .filter((entry) => entry.conceptKey === page.conceptKey)
        .map((entry) => [entry.locale, conceptPagePath(entry)]),
    ),
    links: pages
      .filter((entry) => entry.locale === page.locale && entry.conceptKey !== page.conceptKey)
      .map((entry) => ({
        href: toolHref(conceptPagePath(entry), entry.locale),
        title: entry.slug,
        target: `bazi-concept-${entry.conceptKey}`,
      })),
  }
}

export type ConceptPageData = ReturnType<typeof conceptPageData>

export function conceptHead(page: ConceptPageData, appUrl: string) {
  return pageHead(page, appUrl, [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ])
}
