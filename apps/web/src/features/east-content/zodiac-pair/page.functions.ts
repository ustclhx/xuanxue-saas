import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allZodiacPairs } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import { getPageLinks } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { EASTERN_PAGES } from '../../tools/bazi/eastern-routes.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { mainToolPath, TOOL_ROUTES } from '../../tools/registry.ts'
import { pairFacts, pairMarks, relatedPairs, seriesOf, signYears } from './data.ts'
import {
  pairBranches,
  ZODIAC_PAIR_KEYS,
  ZODIAC_PAIR_PUBLISHED,
  type ZodiacPairKey,
  type ZodiacPairLocale,
  zodiacPairPath,
} from './paths.ts'
import { zodiacPairSeoPages } from './seo-pages.ts'

/** 显示年份所用的时区偏移（分钟）：本年按该语言用户所在地的公历年 */
const UTC_OFFSET: Readonly<Record<ZodiacPairLocale, number>> = {
  'zh-Hans': 480,
  ko: 540,
  en: 0,
}

/**
 * 页尾合盘入口（design 决策 9「用八字看两个人」）：本语言的合盘工具已在注册表发布时链接合盘，
 * 否则链接八字排盘（合盘的多语言版由第 12 组发布，发布前 zh-hans 合盘地址为 404）。
 */
function actionOf(locale: ZodiacPairLocale): { kind: 'compat' | 'chart'; path: string } {
  const slug = EASTERN_PAGES.find((page) => page.id === 'gunghap' && page.locale === locale)?.slug
  const compat = slug ? `/${slug}` : undefined
  if (
    compat &&
    TOOL_ROUTES.some((route) => route.site === 'east' && route.paths[locale] === compat)
  )
    return { kind: 'compat', path: compat }
  return { kind: 'chart', path: mainToolPath(locale, undefined, 'east') ?? '/' }
}

/**
 * 生肖配对页数据（只在服务端执行）：本页正文、引擎事实、面包屑、相关配对与 head。
 * 页面构建期预渲染；客户端路由跳转时经 server function 读取，不访问数据库。
 */
export const getZodiacPairPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      locale: z.enum(['zh-Hans', 'ko', 'en']),
      id: z.enum(['index', ...ZODIAC_PAIR_KEYS] as [string, ...string[]]),
    }),
  )
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const locale = data.locale as ZodiacPairLocale
    if (!ZODIAC_PAIR_PUBLISHED.includes(locale)) throw notFound()
    const entry = allZodiacPairs.find((item) => item.locale === locale && item.key === data.id)
    if (!entry) throw notFound()
    const key = data.id as ZodiacPairKey | 'index'
    const path = zodiacPairPath(locale, key)
    const [seo] = zodiacPairSeoPages([entry, ...allZodiacPairs.filter((item) => item !== entry)])
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
      heading: entry.heading,
      lede: entry.lede,
      sections: entry.sections,
      faq: entry.faq,
      breadcrumb: links.breadcrumb,
      action: actionOf(locale),
    }
    if (key === 'index')
      return { head, content: { kind: 'hub' as const, ...common, marks: pairMarks() } }
    const calendarYear = new Date(Date.now() + UTC_OFFSET[locale] * 60_000).getUTCFullYear()
    const [a, b] = pairBranches(key)
    const marks = pairMarks()
    const series = seriesOf(key)
    return {
      head,
      content: {
        kind: 'pair' as const,
        ...common,
        key,
        relationsNote: entry.relations_note ?? '',
        facts: pairFacts(key),
        years: (a === b ? [a] : [a, b]).map((branch) => ({
          branch,
          years: signYears(branch, calendarYear),
        })),
        related: relatedPairs(key).map((other) => ({ key: other, mark: marks[other] })),
        previous: series.previous,
        next: series.next,
      },
    }
  })

export type ZodiacPairPageData = Awaited<ReturnType<typeof getZodiacPairPage>>['content']
export type ZodiacPairHubData = Extract<ZodiacPairPageData, { kind: 'hub' }>
export type ZodiacPairChildData = Extract<ZodiacPairPageData, { kind: 'pair' }>
