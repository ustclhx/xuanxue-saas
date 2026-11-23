import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allWesternZodiacs } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import { getPageLinks } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { westernZodiacSeoPages } from './seo-pages.ts'

/** 档案页同组区块列出的其他星座数 */
const SIBLINGS_SHOWN = 4

/**
 * 西方星座页数据（只在服务端执行）：逐页正文、面包屑与同组链接、完整 head。
 * 元素、模式、守护星与角距由页面组件按事实表（facts.ts）计算。构建期预渲染，不访问数据库。
 */
export const getWesternZodiacPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string().regex(/^[a-z-]+$/) }))
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const key = data.id === 'chart' ? 'compatibility' : data.id
    const entry = allWesternZodiacs.find((item) => item.locale === 'en' && item.key === key)
    if (!entry) throw notFound()
    const [seo] = westernZodiacSeoPages([entry])
    if (!seo) throw notFound()
    const page: SeoPage = { ...seo }
    const links = getPageLinks(page.path, 'en')
    const trail = [...links.breadcrumb, { href: page.path, label: page.titleMain ?? page.title }]
    const head = pageHead(page, '', [
      breadcrumbData(
        trail.map((item) => ({ name: item.label, path: item.href })),
        'en',
      ),
      faqPageData(entry.faq.map(({ q, a }) => ({ question: q, answer: a }))),
    ])
    return {
      head,
      content: {
        kind: entry.kind,
        key: entry.key,
        path: page.path,
        heading: entry.heading,
        lede: entry.lede,
        compatNote: entry.compat_note ?? '',
        sections: entry.sections,
        faq: entry.faq,
        breadcrumb: links.breadcrumb,
        siblings: (links.group?.items ?? []).slice(0, SIBLINGS_SHOWN),
      },
    }
  })

export type WesternZodiacPageData = Awaited<ReturnType<typeof getWesternZodiacPage>>['content']
