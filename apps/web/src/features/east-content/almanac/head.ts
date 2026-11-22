import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import type { AlmanacPayload } from './almanac.functions.ts'
import { ALMANAC_COPY, monthDescription, monthTitle } from './copy.ts'
import { ALMANAC_LOCALE, ALMANAC_TOOL_PATH, almanacMonthPath } from './paths.ts'

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
 * head：canonical 恒为不带参数的规范地址（工具页 `/zh-hans/黄历`、月份页 `/zh-hans/黄历/N月`），
 * hreflang 只含 zh-hans（注册表只登记了 zh-Hans 路径）。月份页 Title 与 H1 带所显示的年份。
 */
export function almanacHead(payload: AlmanacPayload) {
  const home = { name: ALMANAC_COPY.home, path: '/' }
  const tool = { name: ALMANAC_COPY.toolCrumb, path: ALMANAC_TOOL_PATH }
  if (payload.kind === 'tool') {
    const head = pageHead(
      {
        path: ALMANAC_TOOL_PATH,
        locale: ALMANAC_LOCALE,
        title: payload.title,
        description: payload.description,
      },
      '',
      [faqData(payload.faq), breadcrumbData([home, tool], ALMANAC_LOCALE)],
    )
    return payload.query
      ? { ...head, meta: [...head.meta, { name: 'robots', content: ALMANAC_QUERY_ROBOTS }] }
      : head
  }
  const { year, month } = payload.view
  const path = almanacMonthPath(month)
  return pageHead(
    {
      path,
      locale: ALMANAC_LOCALE,
      title: monthTitle(year, month, payload.terms),
      description: monthDescription(year, month, payload.terms),
    },
    '',
    [
      faqData(payload.faq),
      breadcrumbData([home, tool, { name: `${month}月`, path }], ALMANAC_LOCALE),
    ],
  )
}
