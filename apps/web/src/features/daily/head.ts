import type { AnyRouteMatch } from '@tanstack/react-router'
import { notFound } from '@tanstack/react-router'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { absoluteUrl, localizedPath, originFromMatches, pageHead } from '../seo/metadata.ts'
import { localeOrigin } from '../seo/origins.ts'
import { ganzhiText } from './copy.ts'
import { type DailyLocale, formatDate, parseDateKey } from './date.ts'
import type { EastDailyData } from './east-page.tsx'
import { DAILY_PATHS } from './routes.ts'
import type { WestDailyData } from './west-page.tsx'

/** 每个语言的每日页只在自己的语言下存在，其他语言前缀返回 404 */
export function requireDailyLocale(locale: DailyLocale) {
  if (getLocale() !== locale) throw notFound()
}

type Matches = readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[]

/**
 * head：title 与描述含日期（design D9），canonical 为不带查询参数的规范地址，hreflang 由工具注册表生成
 * （东方站三语互指，西方站只声明英语）。结构化数据为 WebPage + dateModified。
 */
function dailyHead(
  locale: DailyLocale,
  date: string,
  copy: { title: string; description: string },
  matches: Matches,
) {
  const path = DAILY_PATHS[locale]
  const head = pageHead({ path, locale, ...copy }, originFromMatches(matches))
  const url = absoluteUrl(localeOrigin(locale), localizedPath(path, locale))
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.title,
    description: copy.description,
    url,
    inLanguage: locale,
    dateModified: date,
  }
  return {
    ...head,
    scripts: [
      ...head.scripts,
      { type: 'application/ld+json', children: JSON.stringify(webPage).replace(/</g, '\\u003c') },
    ],
  }
}

export function eastDailyHead(
  locale: 'zh-Hant' | 'zh-Hans' | 'ko',
  data: EastDailyData,
  matches: Matches,
) {
  const date = parseDateKey(data.date)
  const dateText = date ? formatDate(date, locale) : data.date
  const ganzhi = ganzhiText(locale, data.facts.stem, data.facts.branch)
  return dailyHead(
    locale,
    data.date,
    {
      title: m.daily_east_seo_title({ date: dateText, ganzhi }),
      description: m.daily_east_seo_description({ date: dateText, ganzhi }),
    },
    matches,
  )
}

export function westDailyHead(data: WestDailyData, matches: Matches) {
  const date = parseDateKey(data.date)
  const dateText = date ? formatDate(date, 'en') : data.date
  const value = String(data.facts.universal.value)
  return dailyHead(
    'en',
    data.date,
    {
      title: m.daily_west_seo_title({ date: dateText, value }),
      description: m.daily_west_seo_description({ date: dateText, value }),
    },
    matches,
  )
}
