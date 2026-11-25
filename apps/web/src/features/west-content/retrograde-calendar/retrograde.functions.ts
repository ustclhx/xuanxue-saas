import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allRetrogradeCalendars, allRetrogradeData } from 'content-collections'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import type { PageLink } from '../../seo/page-links.ts'
import { getPageLinks, getPublicPage } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { UTC } from '../moon/model.ts'
import { fillYears, MERCURY_NOW_TOKEN, mercuryNowAnswer } from './copy.ts'
import type { RetroData } from './model.ts'
import { RETROGRADE_LOCALE, RETROGRADE_PAGE_ID, RETROGRADE_PATH } from './paths.ts'

type Faq = { q: string; a: string }
type Section = { title: string; html: string }

export interface RetroEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly lede: string
  readonly faq: readonly Faq[]
  readonly sections: readonly Section[]
}

export interface RetroPayload {
  readonly path: string
  readonly heading: string
  readonly lede: string
  readonly sections: readonly Section[]
  /** FAQ 原文：`{mercury-now}` 由页面按访客当天与时区替换 */
  readonly faq: readonly Faq[]
  /** 参考时刻：预渲染时为构建时刻，水合后页面换成访客的此刻 */
  readonly nowMs: number
  readonly asOf: string
  readonly data: RetroData
  readonly breadcrumb: readonly PageLink[]
  readonly related: readonly PageLink[]
}

export interface RetroPage {
  readonly seo: SeoPage
  readonly payload: RetroPayload
}

/**
 * 相关区块（data-link-zone="related"，设计稿 RetroCalendar「Related」）：出生星盘、土星回归、今日月相、年度满月表；
 * 土星回归未上线时由星座枢纽补位，最多 4 张。
 */
const RELATED = [
  '/birth-chart',
  '/saturn-return',
  '/moon-phase-today',
  '/full-moon-calendar',
  '/zodiac-signs',
] as const

/** FAQ 的答案按参考时刻填好（结构化数据与预渲染 HTML 用 UTC） */
export function resolveFaq(
  faq: readonly Faq[],
  data: RetroData,
  nowMs: number,
  timeZone: string,
): Faq[] {
  return faq.map(({ q, a }) => ({
    q,
    a: a.includes(MERCURY_NOW_TOKEN)
      ? a.replace(MERCURY_NOW_TOKEN, mercuryNowAnswer(data, nowMs, timeZone))
      : a,
  }))
}

/** 纯计算部分（单测直接调用，不经 server function）。不查数据库；`now` 只决定参考时刻。 */
export function retrogradePage(
  now: Date,
  data: RetroData,
  entries: readonly RetroEntry[],
  links: (path: string) => {
    breadcrumb: readonly PageLink[]
    titleOf: (path: string) => string | undefined
  },
): RetroPage | null {
  const entry = entries.find(
    (item) => item.locale === RETROGRADE_LOCALE && item.key === RETROGRADE_PAGE_ID,
  )
  if (!entry) return null
  const { breadcrumb, titleOf } = links(RETROGRADE_PATH)
  const related = RELATED.flatMap((href) => {
    const label = titleOf(href)
    return label ? [{ href, label }] : []
  }).slice(0, 4)
  return {
    seo: {
      path: RETROGRADE_PATH,
      locale: RETROGRADE_LOCALE,
      title: fillYears(entry.title, data.years),
      description: fillYears(entry.description, data.years),
    },
    payload: {
      path: RETROGRADE_PATH,
      heading: fillYears(entry.heading, data.years),
      lede: entry.lede,
      sections: entry.sections,
      faq: entry.faq,
      nowMs: now.getTime(),
      asOf: now.toISOString().slice(0, 10),
      data,
      breadcrumb,
      related,
    },
  }
}

export function retrogradeHead(page: RetroPage) {
  const { payload, seo } = page
  return pageHead(seo, '', [
    breadcrumbData(
      [...payload.breadcrumb, { href: payload.path, label: payload.heading }].map((item) => ({
        name: item.label,
        path: item.href,
      })),
      RETROGRADE_LOCALE,
    ),
    faqPageData(
      resolveFaq(payload.faq, payload.data, payload.nowMs, UTC).map(({ q, a }) => ({
        question: q,
        answer: a,
      })),
    ),
  ])
}

/**
 * 逆行日历页数据（只在服务端执行）：构建期预计算的停滞表与正文都来自内容集合，不访问数据库与会话，
 * 不加载 astronomy-engine。页面构建期预渲染；客户端路由跳转经本函数读取。
 */
export const getRetrogradePage = createServerFn({ method: 'GET' }).handler(() => {
  if (!templateConfig.marketing.enabled) throw notFound()
  const [data] = allRetrogradeData
  if (!data) throw notFound()
  const page = retrogradePage(new Date(), data, allRetrogradeCalendars, (path) => ({
    breadcrumb: getPageLinks(path, RETROGRADE_LOCALE).breadcrumb,
    titleOf: (target) => {
      const found = getPublicPage(target, RETROGRADE_LOCALE)
      return found ? (found.titleMain ?? found.title) : undefined
    },
  }))
  if (!page) throw notFound()
  return { head: retrogradeHead(page), content: page.payload }
})
