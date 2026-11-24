import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allAngelNumbers } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import { getPageLinks } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { nearbyNumbers, publishedNumbers } from './listing.ts'
import { isAngelLocale } from './paths.ts'
import { angelSeoPages } from './seo-pages.ts'

/**
 * angel numbers 页数据（只在服务端执行）：逐页正文、面包屑、已发布数字列表与完整 head。
 * 各位数字、排列与根数由页面组件按 numbers.ts 计算。构建期预渲染，不访问数据库。
 */
export const getAngelNumberPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ locale: z.string(), id: z.string().regex(/^(?:index|\d{3,4})$/) }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled || !isAngelLocale(data.locale)) throw notFound()
    const locale = data.locale
    const entry = allAngelNumbers.find((item) => item.locale === locale && item.key === data.id)
    if (!entry) throw notFound()
    const [seo] = angelSeoPages([entry, ...allAngelNumbers.filter((item) => item !== entry)])
    if (!seo) throw notFound()
    const page: SeoPage = { ...seo }
    const links = getPageLinks(page.path, locale)
    const trail = [...links.breadcrumb, { href: page.path, label: page.titleMain ?? page.title }]
    const head = pageHead(page, '', [
      breadcrumbData(
        trail.map((item) => ({ name: item.label, path: item.href })),
        locale,
      ),
      faqPageData(entry.faq.map(({ q, a }) => ({ question: q, answer: a }))),
    ])
    const numbers = publishedNumbers(allAngelNumbers, locale)
    return {
      head,
      content: {
        kind: entry.key === 'index' ? ('hub' as const) : ('number' as const),
        locale,
        key: entry.key,
        path: page.path,
        heading: entry.heading,
        lede: entry.lede,
        question: entry.question ?? '',
        sections: entry.sections,
        faq: entry.faq.map(({ q, a }) => ({ q, a })),
        breadcrumb: links.breadcrumb,
        numbers: entry.key === 'index' ? numbers : nearbyNumbers(numbers, entry.key),
      },
    }
  })

export type AngelNumberPageData = Awaited<ReturnType<typeof getAngelNumberPage>>['content']
