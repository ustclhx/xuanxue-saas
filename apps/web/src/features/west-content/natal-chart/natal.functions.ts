import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allNatalCharts } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead } from '../../seo/metadata.ts'
import type { PageLink } from '../../seo/page-links.ts'
import { getPageLinks, getPublicPage } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { NATAL_LOCALE, NATAL_PAGE_IDS, NATAL_PATHS, type NatalPageId } from './paths.ts'

type Faq = { q: string; a: string }
type Section = { title: string; html: string }

export interface NatalPayload {
  readonly id: NatalPageId
  readonly path: string
  readonly heading: string
  readonly lede: string
  readonly sections: readonly Section[]
  readonly faq: readonly Faq[]
  readonly breadcrumb: readonly PageLink[]
  readonly related: readonly PageLink[]
}

/** 相关区块（data-link-zone="related"，设计稿 Main / NatalChart 的「Related」）：另一工具、星座枢纽与今日月相 */
const RELATED: Record<NatalPageId, readonly string[]> = {
  'rising-sign-calculator': [NATAL_PATHS['birth-chart'], '/zodiac-signs', '/moon-phase-today'],
  'birth-chart': [NATAL_PATHS['rising-sign-calculator'], '/zodiac-signs', '/zodiac-compatibility'],
}

/**
 * 三巨头计算器与出生星盘的页面数据（只在服务端执行）：逐页正文、面包屑、相关链接与完整 head。
 * 计算全在浏览器，页面构建期预渲染，不访问数据库与会话。
 */
export const getNatalPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.enum(NATAL_PAGE_IDS as [NatalPageId, ...NatalPageId[]]) }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const entry = allNatalCharts.find(
      (item) => item.locale === NATAL_LOCALE && item.key === data.id,
    )
    if (!entry) throw notFound()
    const path = NATAL_PATHS[data.id]
    const { breadcrumb } = getPageLinks(path, NATAL_LOCALE)
    const titleOf = (target: string) => {
      const page = getPublicPage(target, NATAL_LOCALE)
      return page?.titleMain ?? page?.title ?? target
    }
    const head = pageHead(
      { path, locale: NATAL_LOCALE, title: entry.title, description: entry.description },
      '',
      [
        breadcrumbData(
          [...breadcrumb, { href: path, label: entry.heading }].map((item) => ({
            name: item.label,
            path: item.href,
          })),
          NATAL_LOCALE,
        ),
        faqPageData(entry.faq.map(({ q, a }) => ({ question: q, answer: a }))),
      ],
    )
    const content: NatalPayload = {
      id: data.id,
      path,
      heading: entry.heading,
      lede: entry.lede,
      sections: entry.sections,
      faq: entry.faq,
      breadcrumb,
      related: RELATED[data.id]
        .filter((target) => getPublicPage(target, NATAL_LOCALE))
        .map((href) => ({ href, label: titleOf(href) })),
    }
    return { head, content }
  })
