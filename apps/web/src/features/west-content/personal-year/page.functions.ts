import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { allPersonalYears } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead, type SeoPage } from '../../seo/metadata.ts'
import type { PageLink } from '../../seo/page-links.ts'
import { getPageLinks, getPublicPage } from '../../seo/pages.server.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { faqPageData } from '../../tools/numerology/seo.ts'
import { ANGEL_HUB_PATHS, ANGEL_NUMBERS } from '../angel-numbers/paths.ts'
import {
  PERSONAL_YEAR_LOCALES,
  PERSONAL_YEAR_PATHS,
  type PersonalYearLocale,
  type PersonalYearNumber,
  personalYearNumberPath,
} from './paths.ts'

type Faq = { q: string; a: string }
type Section = { title: string; html: string }

export interface PersonalYearEntry {
  readonly locale: string
  readonly key: string
  readonly title: string
  readonly heading: string
  readonly description: string
  readonly lede: string
  readonly questions?: readonly string[] | undefined
  readonly faq: readonly Faq[]
  readonly sections: readonly Section[]
}

export interface PersonalYearPayload {
  readonly kind: 'calculator' | 'number'
  readonly locale: PersonalYearLocale
  /** 年份数页的数字；计算器页为 null */
  readonly number: PersonalYearNumber | null
  readonly path: string
  readonly heading: string
  readonly lede: string
  readonly sections: readonly Section[]
  readonly questions: readonly string[]
  readonly faq: readonly Faq[]
  readonly breadcrumb: readonly PageLink[]
  readonly related: readonly PageLink[]
}

/**
 * 相关区块（设计稿「Related」）：只列 main 上已有的页面。计算器页含 Angel Numbers 枢纽（第 26 组）；
 * 设计稿中的 Solar Return（第 25 组）上线后再补（PR 记 TODO）。年份数页列计算器、同数字的 Life Path 页、
 * 同数字三连的 angel number 页（设计稿 5 号页的「Angel Number 555」），再补一张计算器类页面。
 */
const RELATED: Readonly<Record<PersonalYearLocale, readonly string[]>> = {
  en: ['/life-path-number', '/numerology-calculator', ANGEL_HUB_PATHS.en, '/daily-numerology'],
  es: ['/numero-de-vida', '/calculadora-numerologia', ANGEL_HUB_PATHS.es, '/numerologia'],
}
const LIFE_PATH_BASE: Readonly<Record<PersonalYearLocale, string>> = {
  en: '/life-path-number',
  es: '/numero-de-vida',
}

export function relatedPaths(locale: PersonalYearLocale, number: PersonalYearNumber | null) {
  if (number === null) return RELATED[locale]
  const triple = String(number).repeat(3)
  const angel = (ANGEL_NUMBERS[locale] as readonly string[]).includes(triple)
    ? [`${ANGEL_HUB_PATHS[locale]}/${triple}`]
    : []
  return [
    PERSONAL_YEAR_PATHS[locale],
    `${LIFE_PATH_BASE[locale]}/${number}`,
    ...angel,
    ...RELATED[locale].filter((path) => path !== LIFE_PATH_BASE[locale]),
  ].slice(0, 4)
}

/**
 * 纯计算部分（单测直接调用，不经 server function）：按语言与页面 id 取内容条目，生成 SEO 与页面数据。
 * hreflang 只列两种语言里都有内容条目的对应页。
 */
export function personalYearPage(
  locale: PersonalYearLocale,
  id: string,
  entries: readonly PersonalYearEntry[],
  links: (path: string) => { breadcrumb: readonly PageLink[]; titleOf: (path: string) => string },
): { seo: SeoPage; payload: PersonalYearPayload } | null {
  const entry = entries.find((item) => item.locale === locale && item.key === id)
  if (!entry) return null
  const number = id === 'index' ? null : (Number(id) as PersonalYearNumber)
  const pathOf = (target: PersonalYearLocale) =>
    number === null ? PERSONAL_YEAR_PATHS[target] : personalYearNumberPath(target, number)
  const path = pathOf(locale)
  const alternates = Object.fromEntries(
    PERSONAL_YEAR_LOCALES.filter((target) =>
      entries.some((item) => item.locale === target && item.key === id),
    ).map((target) => [target, pathOf(target)]),
  )
  const { breadcrumb, titleOf } = links(path)
  return {
    seo: {
      path,
      locale,
      site: 'west',
      title: entry.title,
      description: entry.description,
      alternates,
    },
    payload: {
      kind: number === null ? 'calculator' : 'number',
      locale,
      number,
      path,
      heading: entry.heading,
      lede: entry.lede,
      sections: entry.sections,
      questions: entry.questions ?? [],
      faq: entry.faq,
      breadcrumb,
      related: relatedPaths(locale, number).map((href) => ({ href, label: titleOf(href) })),
    },
  }
}

/**
 * personal year 页数据（只在服务端执行）：逐页正文来自内容集合，数字与算式由页面在浏览器里计算。
 * 不访问数据库与会话；页面构建期预渲染。
 */
export const getPersonalYearPage = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ locale: z.enum(PERSONAL_YEAR_LOCALES), id: z.string().regex(/^(index|[1-9])$/) }),
  )
  .handler(({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    const page = personalYearPage(data.locale, data.id, allPersonalYears, (path) => ({
      breadcrumb: getPageLinks(path, data.locale).breadcrumb,
      titleOf: (target) => {
        const found = getPublicPage(target, data.locale)
        return found?.titleMain ?? found?.title ?? target
      },
    }))
    if (!page) throw notFound()
    const { seo, payload } = page
    const head = pageHead(seo, '', [
      breadcrumbData(
        [...payload.breadcrumb, { href: payload.path, label: payload.heading }].map((item) => ({
          name: item.label,
          path: item.href,
        })),
        data.locale,
      ),
      faqPageData(payload.faq.map(({ q, a }) => ({ question: q, answer: a }))),
    ])
    return { head, content: payload }
  })
