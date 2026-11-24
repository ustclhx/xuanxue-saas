import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allMoonData, allMoons } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import type { PageLink } from '../../seo/page-links.ts'
import { getPageLinks, getPublicPage } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { fillYear } from './copy.ts'
import {
  addDays,
  type CivilMonth,
  civilMonthOf,
  dateKeyOf,
  displayYear,
  type MoonTable,
  monthCovered,
  parseDateKey,
  shiftMonth,
} from './model.ts'
import {
  MOON_LOCALE,
  MOON_MONTHS,
  MOON_PAGE_IDS,
  MOON_PATHS,
  type MoonMonthSlug,
  type MoonPageId,
  moonPagePath,
} from './paths.ts'

/** 带 `?year=` 的月份页不进索引（seo「查询参数结果页不进索引」） */
export const MOON_QUERY_ROBOTS = 'noindex, follow'
const DAY_MS = 86_400_000

type Faq = { q: string; a: string }
type Section = { title: string; html: string }

export interface MoonEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly lede: string
  readonly month?: number | undefined
  readonly moon_name?: string | undefined
  readonly faq: readonly Faq[]
  readonly sections: readonly Section[]
}

export interface MoonData {
  readonly buildDate: string
  readonly startDate: string
  readonly endDate: string
  readonly days: MoonTable['days']
  readonly events: MoonTable['events']
  readonly years: readonly number[]
}

interface Common {
  readonly id: MoonPageId
  readonly path: string
  readonly heading: string
  readonly lede: string
  readonly sections: readonly Section[]
  readonly faq: readonly Faq[]
  /** 参考日（UTC）与时刻：预渲染时为构建当天，水合后页面换成访客的当天 */
  readonly asOf: string
  readonly nowMs: number
  readonly table: MoonTable
  readonly breadcrumb: readonly PageLink[]
  readonly related: readonly PageLink[]
  /** 当月月份页（正文入链），今日页与满月页用 */
  readonly current: CivilMonth
}

export type MoonPayload =
  | (Common & { readonly kind: 'today' })
  | (Common & { readonly kind: 'full-moon' })
  | (Common & { readonly kind: 'year'; readonly years: readonly number[] })
  | (Common & {
      readonly kind: 'calendar'
      readonly months: readonly CivilMonth[]
    })
  | (Common & {
      readonly kind: 'month'
      readonly view: CivilMonth
      readonly defaultYear: number
      readonly query: boolean
      readonly otherYear: number | null
      readonly previous: CivilMonth
      readonly next: CivilMonth
    })

export interface MoonPage {
  readonly seo: SeoPage
  readonly payload: MoonPayload
}

/** 截取覆盖 [from, to) 的逐日行与事件（当地时区最多偏离 UTC 一天，两端各留一天） */
function slice(data: MoonData, from: string, to: string): MoonTable {
  const start = [from, data.startDate].sort().at(-1) ?? data.startDate
  const end = [to, data.endDate].sort()[0] ?? data.endDate
  const offset = Math.max(
    0,
    Math.round(((parseDateKey(start) ?? 0) - (parseDateKey(data.startDate) ?? 0)) / DAY_MS),
  )
  const count = Math.max(
    0,
    Math.round(((parseDateKey(end) ?? 0) - (parseDateKey(start) ?? 0)) / DAY_MS),
  )
  const lo = parseDateKey(from) ?? 0
  const hi = parseDateKey(to) ?? 0
  return {
    startDate: start,
    days: data.days.slice(offset, offset + count),
    events: data.events.filter((event) => event.utcMs >= lo && event.utcMs < hi),
  }
}

function monthRange({ year, month }: CivilMonth): [string, string] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const next = shiftMonth({ year, month }, 1)
  const after = `${next.year}-${String(next.month).padStart(2, '0')}-01`
  return [addDays(first, -1), addDays(after, 1)]
}

/** 年度表的主年份：10 月起改以次年为主（「full moon calendar 2027」在上一年秋季开始被搜索） */
export function primaryYear(data: Pick<MoonData, 'years'>, today: CivilMonth): number {
  const [first = today.year, second = first + 1] = data.years
  return today.month >= 10 && today.year === first ? second : first
}

/**
 * 纯计算部分（单测直接调用，不经 server function）。不查数据库；`now` 只决定参考日与滚动年份。
 * `rawYear` 为月份页的 `?year=` 原值：任何取值都输出 noindex，表能覆盖时显示所请求的年份。
 */
export function moonPage(
  id: MoonPageId,
  rawYear: string | undefined,
  now: Date,
  data: MoonData,
  entries: readonly MoonEntry[],
  links: (path: string) => { breadcrumb: readonly PageLink[]; titleOf: (path: string) => string },
): MoonPage | null {
  const entry = entries.find((item) => item.locale === MOON_LOCALE && item.key === id)
  if (!entry) return null
  const asOf = dateKeyOf(now.getTime())
  const today = civilMonthOf(asOf)
  const path = moonPagePath(id)
  const { breadcrumb, titleOf } = links(path)
  const related = relatedOf(id).map((href) => ({ href, label: titleOf(href) }))
  const common = {
    id,
    path,
    lede: entry.lede,
    sections: entry.sections,
    faq: entry.faq,
    asOf,
    nowMs: now.getTime(),
    breadcrumb,
    related,
    current: today,
  }
  const seo = (year: number): SeoPage => ({
    path,
    locale: MOON_LOCALE,
    title: fillYear(entry.title, year),
    description: fillYear(entry.description, year),
  })
  const month = MOON_MONTHS.indexOf(id as MoonMonthSlug) + 1
  if (month > 0) {
    const defaultYear = displayYear(month, today)
    const query = rawYear !== undefined
    const requested = Number(rawYear)
    const view = (year: number): CivilMonth => ({ year, month })
    const covered = (year: number) =>
      Number.isInteger(year) && monthCovered(slice(data, ...monthRange(view(year))), view(year))
    const year = query && requested !== defaultYear && covered(requested) ? requested : defaultYear
    const other = year === defaultYear ? defaultYear + 1 : defaultYear
    const [from, to] = monthRange(view(year))
    const previous = shiftMonth(view(year), -1)
    const next = shiftMonth(view(year), 1)
    return {
      seo: seo(year),
      payload: {
        ...common,
        kind: 'month',
        heading: fillYear(entry.heading, year),
        table: slice(data, from, to),
        view: view(year),
        defaultYear,
        query,
        otherYear: covered(other) ? other : null,
        previous: { month: previous.month, year: displayYear(previous.month, today) },
        next: { month: next.month, year: displayYear(next.month, today) },
      },
    }
  }
  const full: MoonTable = {
    startDate: data.startDate,
    days: data.days,
    events: data.events.filter(
      (event) =>
        event.utcMs >= (parseDateKey(data.startDate) ?? 0) &&
        event.utcMs < (parseDateKey(data.endDate) ?? 0),
    ),
  }
  switch (id) {
    case 'today':
      return {
        seo: seo(today.year),
        payload: { ...common, kind: 'today', heading: entry.heading, table: full },
      }
    case 'full-moon':
      return {
        seo: seo(today.year),
        payload: { ...common, kind: 'full-moon', heading: entry.heading, table: full },
      }
    case 'moon-calendar': {
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        year: displayYear(i + 1, today),
      }))
      return {
        seo: seo(today.year),
        payload: { ...common, kind: 'calendar', heading: entry.heading, table: full, months },
      }
    }
    case 'full-moon-calendar': {
      const primary = primaryYear(data, today)
      const years = [primary, ...data.years.filter((year) => year !== primary)]
      return {
        seo: seo(primary),
        payload: {
          ...common,
          kind: 'year',
          heading: fillYear(entry.heading, primary),
          table: { startDate: data.startDate, days: [], events: data.events },
          years,
        },
      }
    }
    default:
      return null
  }
}

/**
 * 相关区块（data-link-zone="related"）：其余三个月相主页与 The Moon 牌义页（设计稿 MoonToday「Related」）。
 * 今日月相与年度满月表的第四张卡改为满月牌阵（content-growth-v2-tools 第 28 组「满月牌阵与月相页互链」：
 * 两页正文都是天文说明，没有能自然带出牌阵链接的现成句子）。
 */
const FULL_MOON_SPREAD_PATH = '/tarot/full-moon'
function relatedOf(id: MoonPageId): string[] {
  const main = [
    MOON_PATHS.today,
    MOON_PATHS['full-moon'],
    MOON_PATHS['full-moon-calendar'],
    MOON_PATHS['moon-calendar'],
  ]
  const self = moonPagePath(id)
  const tarot =
    id === 'today' || id === 'full-moon-calendar' ? FULL_MOON_SPREAD_PATH : '/tarot/cards/the-moon'
  return [...main.filter((path) => path !== self).slice(0, 3), tarot]
}

export function moonHead(page: MoonPage, trail: readonly PageLink[]) {
  const { payload, seo } = page
  const head = pageHead(seo, '', [
    breadcrumbData(
      [...trail, { href: payload.path, label: payload.heading }].map((item) => ({
        name: item.label,
        path: item.href,
      })),
      MOON_LOCALE,
    ),
    faqPageData(payload.faq.map(({ q, a }) => ({ question: q, answer: a }))),
  ])
  return payload.kind === 'month' && payload.query
    ? { ...head, meta: [...head.meta, { name: 'robots', content: MOON_QUERY_ROBOTS }] }
    : head
}

/**
 * 月相页数据（只在服务端执行）：构建期预计算表与逐页文案都来自内容集合，不访问数据库与会话，
 * 不加载 astronomy-engine。页面构建期预渲染；客户端路由跳转与带 `?year=` 的月份页经本函数读取。
 */
export const getMoonPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      id: z.enum(MOON_PAGE_IDS as [MoonPageId, ...MoonPageId[]]),
      year: z.string().max(8).optional(),
    }),
  )
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const [table] = allMoonData
    if (!table) throw notFound()
    const page = moonPage(data.id, data.year, new Date(), table, allMoons, (path) => ({
      breadcrumb: getPageLinks(path, MOON_LOCALE).breadcrumb,
      titleOf: (target) => {
        const page = getPublicPage(target, MOON_LOCALE)
        return page?.titleMain ?? page?.title ?? target
      },
    }))
    if (!page) throw notFound()
    return { head: moonHead(page, page.payload.breadcrumb), content: page.payload }
  })
