import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allYearlies } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import { getPageLinks } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { mainToolHref, toolHref } from '../../tools/tool-href.ts'
import { EAST_CONTENT_ROUTES } from '../routes.ts'
import { childFacts, hubFacts, YEARLY_UTC_OFFSET } from './data.ts'
import {
  parseYearlyRouteId,
  YEARLY_KEYS,
  type YearlyKey,
  type YearlyLocale,
  type YearlyYear,
  yearlyPath,
  yearlyTitle,
} from './paths.ts'
import { yearlySeoPages } from './seo-pages.ts'
import { unlinkUnpublished, YEARLY_TOOL_PLANNED_PATHS, yearlyToolPath } from './tool-link.ts'

/**
 * 年度生肖页数据（只在服务端执行）：本页正文、引擎事实、面包屑与同组链接，以及完整 head。
 * 页面构建期预渲染；客户端路由跳转时经 server function 读取，不访问数据库。
 */
export const getYearlyPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      locale: z.enum(['zh-Hans', 'zh-Hant', 'ko', 'en']),
      id: z.string().regex(/^\d{4}\/[a-z]+$/),
    }),
  )
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const parsed = parseYearlyRouteId(data.id)
    if (!parsed) throw notFound()
    const { year, key } = parsed
    const locale = data.locale as YearlyLocale
    const entry = allYearlies.find(
      (item) => item.locale === locale && item.year === year && item.key === key,
    )
    const path = yearlyPath(locale, year, key)
    if (!entry || !path) throw notFound()
    const [seo] = yearlySeoPages([entry, ...allYearlies.filter((item) => item !== entry)])
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

    const toolPath = yearlyToolPath(locale)
    const planned = toolHref(YEARLY_TOOL_PLANNED_PATHS[locale], locale)
    const unpublished = toolPath && toolHref(toolPath, locale) === planned ? [] : [planned]
    const offset = YEARLY_UTC_OFFSET[locale]
    const now = Date.now()
    const common = {
      locale,
      path,
      year: year as YearlyYear,
      title: entry.title,
      heading: entry.heading,
      lede: entry.lede,
      sections: entry.sections.map((section) => ({
        title: section.title,
        html: unlinkUnpublished(section.html, unpublished),
      })),
      faq: entry.faq,
      breadcrumb: links.breadcrumb,
      hubTitle: yearlyTitle(locale, year, 'index'),
      // 工具页未上线时，转化带改指八字排盘
      toolHref: toolPath ? toolHref(toolPath, locale) : null,
      baziHref: mainToolHref(locale, 'east'),
    }
    if (key === 'index') {
      const facts = hubFacts(year, offset)
      return {
        head,
        content: {
          kind: 'hub' as const,
          ...common,
          facts,
          archived: now >= facts.year.endsAt,
          children: YEARLY_KEYS.map((child) => ({
            key: child,
            href: toolHref(yearlyPath(locale, year, child) as string, locale),
          })),
        },
      }
    }
    const facts = childFacts(year, key as YearlyKey, offset)
    // 次年同类页已登记时，过季提示链接过去
    const next = EAST_CONTENT_ROUTES.find(
      (route) =>
        route.collection === 'yearly' &&
        route.locale === locale &&
        route.id === `${year + 1}/${key}`,
    )
    return {
      head,
      content: {
        kind: 'child' as const,
        ...common,
        key: key as YearlyKey,
        relationsNote: entry.relations_note ?? '',
        yearsNote: entry.years_note ?? '',
        focus: entry.focus,
        facts,
        archived: now >= facts.year.endsAt,
        next: next
          ? {
              href: toolHref(next.path, locale),
              title: yearlyTitle(locale, (year + 1) as YearlyYear, key as YearlyKey),
            }
          : null,
        hubHref: toolHref(yearlyPath(locale, year, 'index') as string, locale),
        siblings: YEARLY_KEYS.map((child) => ({
          key: child,
          href: toolHref(yearlyPath(locale, year, child) as string, locale),
        })),
      },
    }
  })

export type YearlyPageData = Awaited<ReturnType<typeof getYearlyPage>>['content']
export type YearlyHubData = Extract<YearlyPageData, { kind: 'hub' }>
export type YearlyChildData = Extract<YearlyPageData, { kind: 'child' }>
