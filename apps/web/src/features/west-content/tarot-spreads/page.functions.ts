import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { TopicSpreadId } from '@xuanxue/tarot'
import { allMoonData, allTarotSpreads } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import type { PageLink } from '../../seo/page-links.ts'
import { getPageLinks, getPublicPage } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { addDays, dateKeyOf, type MoonTable, parseDateKey } from '../moon/model.ts'
import type { MoonData } from '../moon/moon.functions.ts'
import {
  TAROT_SPREAD_LOCALE,
  TAROT_TOPIC_SPREADS,
  TAROT_TOPIC_SUMMARIES,
  TAROT_TOPIC_TITLES,
  tarotTopicPath,
} from './paths.ts'

type Faq = { q: string; a: string }

export interface TarotSpreadEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly lede: string
  readonly positions: readonly { name: string; meaning: string }[]
  readonly templates: readonly string[]
  readonly faq: readonly Faq[]
  readonly sections: readonly { title: string; html: string }[]
}

/** 满月牌阵的月相框：参考日前后的逐日行与主要月相（水合后按访客时区与当天重算） */
export interface SpreadMoon {
  readonly asOf: string
  readonly nowMs: number
  readonly table: MoonTable
}

export interface RelatedSpread extends PageLink {
  readonly summary: string
}

export interface TarotSpreadPayload {
  readonly id: TopicSpreadId
  readonly path: string
  readonly heading: string
  readonly lede: string
  readonly positions: TarotSpreadEntry['positions']
  readonly templates: readonly string[]
  readonly sections: TarotSpreadEntry['sections']
  readonly faq: readonly Faq[]
  readonly breadcrumb: readonly PageLink[]
  readonly related: readonly RelatedSpread[]
  readonly moon: SpreadMoon | null
}

const DAY_MS = 86_400_000
// 逐日行覆盖参考日前 2 天至后 45 天（访客时区最多偏离 UTC 一天）；事件多取一个朔望月，保证「下一次满月之后的那次」也在表内
const MOON_DAYS_BEFORE = 2
const MOON_DAYS = 48
const MOON_EVENT_DAYS = 80

/** 截取满月牌阵月相框用的一段表；参考日不在构建期预计算表内时返回 null（框内显示超出范围提示） */
export function spreadMoon(data: MoonData, now: Date): SpreadMoon | null {
  const asOf = dateKeyOf(now.getTime())
  const from = addDays(asOf, -MOON_DAYS_BEFORE)
  const offset = Math.round(
    ((parseDateKey(from) ?? 0) - (parseDateKey(data.startDate) ?? 0)) / DAY_MS,
  )
  if (offset < 0 || offset >= data.days.length) return null
  const lo = parseDateKey(from) ?? 0
  const hi = lo + MOON_EVENT_DAYS * DAY_MS
  return {
    asOf,
    nowMs: now.getTime(),
    table: {
      startDate: from,
      days: data.days.slice(offset, offset + MOON_DAYS),
      events: data.events.filter((event) => event.utcMs >= lo && event.utcMs < hi),
    },
  }
}

/** 「More spreads」区块：另外两个主题牌阵与三张牌入口页（设计稿 Spread「More spreads」） */
const THREE_CARD_PATH = '/tarot'
const THREE_CARD_SUMMARY = 'Past, present and future.'

/** 纯计算部分（单测直接调用，不经 server function）。不查数据库 */
export function tarotSpreadPage(
  id: TopicSpreadId,
  now: Date,
  entries: readonly TarotSpreadEntry[],
  moonData: MoonData | undefined,
  links: (path: string) => { breadcrumb: readonly PageLink[]; titleOf: (path: string) => string },
): { seo: SeoPage; payload: TarotSpreadPayload } | null {
  const entry = entries.find((item) => item.locale === TAROT_SPREAD_LOCALE && item.key === id)
  if (!entry) return null
  const path = tarotTopicPath(id)
  const { breadcrumb, titleOf } = links(path)
  const related: RelatedSpread[] = [
    ...TAROT_TOPIC_SPREADS.filter((other) => other !== id).map((other) => ({
      href: tarotTopicPath(other),
      label: titleOf(tarotTopicPath(other)),
      summary: TAROT_TOPIC_SUMMARIES[other],
    })),
    { href: THREE_CARD_PATH, label: titleOf(THREE_CARD_PATH), summary: THREE_CARD_SUMMARY },
  ]
  return {
    seo: { path, locale: TAROT_SPREAD_LOCALE, title: entry.title, description: entry.description },
    payload: {
      id,
      path,
      heading: entry.heading,
      lede: entry.lede,
      positions: entry.positions,
      templates: entry.templates,
      sections: entry.sections,
      faq: entry.faq,
      breadcrumb,
      related,
      moon: id === 'full-moon' && moonData ? spreadMoon(moonData, now) : null,
    },
  }
}

/**
 * 主题牌阵页数据（只在服务端执行）：逐页文案来自内容集合，满月牌阵另附构建期预计算的月相表，
 * 不访问数据库与会话。页面构建期预渲染；客户端路由跳转经本函数读取。
 */
export const getTarotSpreadPage = createServerFn({ method: 'GET' })
  .validator(
    z.object({ id: z.enum(TAROT_TOPIC_SPREADS as unknown as [TopicSpreadId, ...TopicSpreadId[]]) }),
  )
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const page = tarotSpreadPage(data.id, new Date(), allTarotSpreads, allMoonData[0], (path) => ({
      breadcrumb: getPageLinks(path, TAROT_SPREAD_LOCALE).breadcrumb,
      titleOf: (target) => {
        const found = getPublicPage(target, TAROT_SPREAD_LOCALE)
        return found?.titleMain ?? found?.title ?? target
      },
    }))
    if (!page) throw notFound()
    const { seo, payload } = page
    const head = pageHead(seo, '', [
      breadcrumbData(
        [...payload.breadcrumb, { href: payload.path, label: TAROT_TOPIC_TITLES[data.id] }].map(
          (item) => ({ name: item.label, path: item.href }),
        ),
        TAROT_SPREAD_LOCALE,
      ),
      faqPageData(payload.faq.map(({ q, a }) => ({ question: q, answer: a }))),
    ])
    return { head, content: payload }
  })
