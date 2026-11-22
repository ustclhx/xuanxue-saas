import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allAlmanacs } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { type CivilDate, dateKey, referenceDate } from '../../daily/date.ts'
import {
  type AlmanacEngine,
  type AlmanacMonthView,
  type AlmanacToolDay,
  displayYear,
  monthView,
  parseAlmanacDate,
  toolDay,
} from './model.ts'
import { ALMANAC_LOCALE, ALMANAC_MONTHS } from './paths.ts'
import { MONTH_TERM_NAMES } from './routes.ts'

const ENGINE = () => import('@xuanxue/bazi/almanac') as Promise<AlmanacEngine>

type Faq = { q: string; a: string }

export type AlmanacToolPayload = {
  kind: 'tool'
  title: string
  description: string
  intro: string
  html: string
  faq: Faq[]
  /** 参考日期（北京时间的今天） */
  today: string
  /** 带合法或非法 `?date=` 时为 true：head 输出 noindex, follow */
  query: boolean
  /** 原样的 `?date=` 值（错误态时回填到日期字段） */
  requested: string | null
  /** 所选日期；参数非法或超出范围时为 null（错误态） */
  result: AlmanacToolDay | null
  /** 正文链接的当月与次月 */
  months: { current: number; next: number }
}

export type AlmanacMonthPayload = {
  kind: 'month'
  month: number
  lede: string
  termsNote: string[]
  html: string
  faq: Faq[]
  today: string
  view: AlmanacMonthView
  terms: readonly string[]
  /** 相邻月份及其当前显示的年份 */
  previous: { month: number; year: number }
  next: { month: number; year: number }
}

export type AlmanacPayload = AlmanacToolPayload | AlmanacMonthPayload

/** 纯计算部分（单测直接调用，不经 server function） */
export async function almanacPayload(
  id: string,
  rawDate: string | undefined,
  now: Date,
  engine: AlmanacEngine,
): Promise<AlmanacPayload | null> {
  const today: CivilDate = referenceDate(ALMANAC_LOCALE, now)
  const entry = allAlmanacs.find((page) => page.locale === ALMANAC_LOCALE && page.key === id)
  if (!entry) return null
  const faq = entry.faq
  if (id === 'tool') {
    const query = rawDate !== undefined
    const selected = query ? parseAlmanacDate(rawDate) : today
    const next = (today.month % 12) + 1
    return {
      kind: 'tool',
      title: entry.title ?? '',
      description: entry.description ?? '',
      intro: entry.intro ?? '',
      html: entry.html,
      faq,
      today: dateKey(today),
      query,
      requested: rawDate ?? null,
      result: selected ? toolDay(engine, selected) : null,
      months: { current: today.month, next },
    }
  }
  const month = Number(id)
  if (!ALMANAC_MONTHS.includes(month as 1)) return null
  const year = displayYear(month, today)
  const previousMonth = month === 1 ? 12 : month - 1
  const nextMonth = month === 12 ? 1 : month + 1
  return {
    kind: 'month',
    month,
    lede: entry.lede ?? '',
    termsNote: entry.termsNote,
    html: entry.html,
    faq,
    today: dateKey(today),
    view: monthView(engine, year, month, today),
    terms: MONTH_TERM_NAMES[month] ?? [],
    previous: { month: previousMonth, year: displayYear(previousMonth, today) },
    next: { month: nextMonth, year: displayYear(nextMonth, today) },
  }
}

/**
 * 黄历页数据（openspec content-growth-phase2 决策 5）：按参考日期（北京时间）现算，只读构建期文案，
 * 不访问数据库与会话；SSR 结果由边缘缓存按日缓存（features/daily/page-cache.ts）。
 */
export const getAlmanacPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      id: z.string().min(1).max(8),
      date: z.string().max(32).optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const payload = await almanacPayload(data.id, data.date, new Date(), await ENGINE())
    if (!payload) throw notFound()
    return payload
  })
