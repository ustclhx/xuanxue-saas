import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import type { AlmanacPayload } from './almanac.functions.ts'
import { almanacCopy } from './copy.ts'
import { ALMANAC_TOOL_PATHS, almanacMonthPath } from './paths.ts'

/** 带 `?date=` 的工具页结果（含非法日期的错误态）不进索引（seo「查询参数结果页不进索引」） */
export const ALMANAC_QUERY_ROBOTS = 'noindex, follow'

function faqData(faq: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
}

/**
 * head：canonical 恒为不带参数的规范地址（工具页 `/zh-hans/黄历`、`/zh-hant/農民曆`，月份页加 `/N月`），
 * hreflang 为 zh-hans 黄历与 zh-hant 農民曆（注册表同一条目）。月份页 Title 与 H1 带所显示的年份。
 */
export function almanacHead(payload: AlmanacPayload) {
  const { locale } = payload
  const copy = almanacCopy(locale)
  const toolPath = ALMANAC_TOOL_PATHS[locale]
  const home = { name: copy.home, path: '/' }
  const tool = { name: copy.toolCrumb, path: toolPath }
  if (payload.kind === 'tool') {
    const head = pageHead(
      {
        path: toolPath,
        locale,
        title: payload.title,
        description: payload.description,
      },
      '',
      [faqData(payload.faq), breadcrumbData([home, tool], locale)],
    )
    return payload.query
      ? { ...head, meta: [...head.meta, { name: 'robots', content: ALMANAC_QUERY_ROBOTS }] }
      : head
  }
  const { year, month } = payload.view
  const path = almanacMonthPath(month, locale)
  return pageHead(
    {
      path,
      locale,
      title: copy.monthTitle(year, month, payload.terms),
      description: copy.monthDescription(year, month, payload.terms),
    },
    '',
    [
      faqData(payload.faq),
      breadcrumbData([home, tool, { name: copy.monthLabel(month), path }], locale),
    ],
  )
}
