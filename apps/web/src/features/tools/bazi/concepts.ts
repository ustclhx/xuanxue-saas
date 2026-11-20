import type { EastV1Locale } from '../../i18n/locales.ts'
import { pageHead } from '../../seo/metadata.ts'
import { toolHref } from '../tool-href.ts'
import type { ConceptKey } from './eastern-routes.ts'

export interface ConceptPage {
  title: string
  description: string
  slug: string
  locale: EastV1Locale
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
    links: siblingConcepts(pages, page).map((entry) => ({
      href: toolHref(conceptPagePath(entry), entry.locale),
      title: entry.slug,
      target: `bazi-concept-${entry.conceptKey}`,
    })),
  }
}

/** 每页列出的同组概念数：加上主工具页，正文内链为 4 条（每页 2–5 条，openspec seo-fix-tdk-links 决策 5） */
export const SIBLING_CONCEPTS = 3

/**
 * 同语言概念页按内容集合顺序首尾相接，每页链接其后的 3 页：每个概念恰好有 3 条同组入链，
 * 页尾链接矩阵不再列出全部 7 个概念（7 条同名锚文本会让目标页的单一表述超过 70%）。
 */
export function siblingConcepts<T extends Pick<ConceptPage, 'locale' | 'conceptKey'>>(
  pages: readonly T[],
  page: T,
): T[] {
  const ring = pages.filter((entry) => entry.locale === page.locale)
  const index = ring.findIndex((entry) => entry.conceptKey === page.conceptKey)
  if (index < 0) return []
  return Array.from(
    { length: Math.min(SIBLING_CONCEPTS, ring.length - 1) },
    (_, offset) => ring[(index + offset + 1) % ring.length] as T,
  )
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
