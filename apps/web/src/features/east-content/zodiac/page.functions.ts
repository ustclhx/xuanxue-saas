import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allZodiacs } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import { getPageLinks } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { childFacts, hubFacts, ZODIAC_UTC_OFFSET } from './data.ts'
import { ZODIAC_KEYS, type ZodiacKey, type ZodiacLocale, zodiacPath } from './paths.ts'
import { zodiacSeoPages } from './seo-pages.ts'

/** 同组区块显示的其他生肖数（设计稿 ZodiacPage「其他生肖」四张卡片） */
const SIBLINGS_SHOWN = 4

/**
 * 生肖页数据（只在服务端执行）：本页正文、引擎事实、面包屑与同组链接，以及完整 head。
 * 页面构建期预渲染；客户端路由跳转时经 server function 读取，不访问数据库。
 */
export const getZodiacPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      locale: z.enum(['zh-Hans', 'ko']),
      id: z.enum(['index', ...ZODIAC_KEYS]),
    }),
  )
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const entry = allZodiacs.find((item) => item.locale === data.locale && item.key === data.id)
    if (!entry) throw notFound()
    const locale = data.locale as ZodiacLocale
    const path = zodiacPath(locale, data.id as ZodiacKey | 'index')
    const [seo] = zodiacSeoPages([entry, ...allZodiacs.filter((item) => item !== entry)])
    const page: SeoPage = { ...(seo as SeoPage) }
    const links = getPageLinks(path, locale)
    const trail = [...links.breadcrumb, { href: path, label: page.titleMain ?? page.title }]
    const head = pageHead(page, '', [
      breadcrumbData(
        trail.map((item) => ({ name: item.label, path: item.href })),
        locale,
      ),
      faqPageData(entry.faq.map(({ q, a }) => ({ question: q, answer: a }))),
    ])
    const common = {
      locale,
      path,
      title: entry.title,
      heading: entry.heading,
      lede: entry.lede,
      sections: entry.sections,
      faq: entry.faq,
      breadcrumb: links.breadcrumb,
    }
    const now = Date.now()
    const offset = ZODIAC_UTC_OFFSET[locale]
    if (data.id === 'index') {
      return { head, content: { kind: 'hub' as const, ...common, facts: hubFacts(now, offset) } }
    }
    const siblings = (links.group?.items ?? []).slice(0, SIBLINGS_SHOWN).map((item) => ({
      ...item,
      key: ZODIAC_KEYS.find((key) => zodiacPath(locale, key) === decodeURI(item.href)) ?? 'zi',
    }))
    return {
      head,
      content: {
        kind: 'child' as const,
        ...common,
        key: data.id as ZodiacKey,
        yearsNote: entry.years_note ?? '',
        relationsNote: entry.relations_note ?? '',
        annualText: entry.annual,
        facts: childFacts(data.id as ZodiacKey, now, offset),
        siblings,
      },
    }
  })

export type ZodiacPageData = Awaited<ReturnType<typeof getZodiacPage>>['content']
export type ZodiacHubData = Extract<ZodiacPageData, { kind: 'hub' }>
export type ZodiacChildData = Extract<ZodiacPageData, { kind: 'child' }>
