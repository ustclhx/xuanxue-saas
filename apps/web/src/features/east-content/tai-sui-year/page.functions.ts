import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { Branch } from '@xuanxue/bazi'
import { allTaiSuiYears } from 'content-collections'
import { z } from 'zod'
import { templateConfig } from '../../../server/template-config.ts'
import { pageHead } from '../../seo/metadata.ts'
import { breadcrumbData } from '../../seo/structured-data.ts'
import { ALMANAC_TOOL_PATHS } from '../almanac/paths.ts'
import { TAI_SUI_COPY } from './copy.ts'
import { TAI_SUI_YEAR_LOCALE, TAI_SUI_YEARS, taiSuiYearPath } from './paths.ts'

type AlmanacEngine = typeof import('@xuanxue/bazi/almanac')

/** 出生年份列的范围：起自 1930 年，止于目标年 */
const FIRST_BIRTH_YEAR = 1930

export type TaiSuiRelation = 'zhi' | 'chong' | 'xing' | 'hai' | 'po' | 'sixCombine' | 'triad'

export interface TaiSuiRow {
  readonly branch: Branch
  /** 太歲关系在前（值、沖、刑、害、破），再列六合、三合；都没有时为空 */
  readonly relations: readonly TaiSuiRelation[]
  readonly years: readonly number[]
}

/**
 * 纯计算部分（单测直接调用）：`zodiacYearFacts` 的 12 行加上各生肖 1930 年起至目标年的出生年份（`zodiacYears`）。
 * 出生年份按年支对应的国历年列出；立春前出生的人生肖属前一年，页面另有说明。
 */
export function taiSuiRows(engine: AlmanacEngine, year: number): TaiSuiRow[] {
  const facts = engine.zodiacYearFacts(year)
  return facts.rows.map((row) => {
    const relations: TaiSuiRelation[] = [...row.taiSui]
    if (row.relations.includes('sixCombine')) relations.push('sixCombine')
    if (row.relations.includes('triad')) relations.push('triad')
    return {
      branch: row.branch,
      relations,
      years: engine
        .zodiacYears(row.branch)
        .map((item) => item.year)
        .filter((value) => value >= FIRST_BIRTH_YEAR && value <= year),
    }
  })
}

/**
 * 年度太歲页数据（只在服务端执行）：撰写文字来自内容集合，表格由引擎计算；页面构建期预渲染，不访问数据库。
 */
export const getTaiSuiYearPage = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ year: z.number().int() }))
  .handler(async ({ data }) => {
    if (!templateConfig.marketing.enabled) throw notFound()
    if (!TAI_SUI_YEARS.includes(data.year as 2027)) throw notFound()
    const entry = allTaiSuiYears.find(
      (item) => item.locale === TAI_SUI_YEAR_LOCALE && item.year === data.year,
    )
    if (!entry) throw notFound()
    const engine = await import('@xuanxue/bazi/almanac')
    const facts = engine.zodiacYearFacts(data.year)
    const target = engine.zodiacYears(facts.branch).find((item) => item.year === data.year)
    const path = taiSuiYearPath(data.year)
    const copy = TAI_SUI_COPY
    const crumbs = [
      { name: copy.home, path: '/' },
      { name: copy.almanacCrumb, path: ALMANAC_TOOL_PATHS[TAI_SUI_YEAR_LOCALE] },
      { name: copy.crumb(data.year), path },
    ]
    const head = pageHead(
      { path, locale: TAI_SUI_YEAR_LOCALE, title: entry.title, description: entry.description },
      '',
      [
        breadcrumbData(crumbs, TAI_SUI_YEAR_LOCALE),
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: entry.faq.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        },
      ],
    )
    return {
      head,
      content: {
        year: data.year,
        heading: entry.heading,
        lede: entry.lede,
        tableNote: entry.table_note,
        html: entry.html,
        faq: entry.faq,
        stem: facts.stem,
        branch: facts.branch,
        nayinIndex: target?.nayinIndex ?? null,
        lichun: target ? { month: target.lichun.month, day: target.lichun.day } : null,
        lunarNewYear: target
          ? { month: target.lunarNewYear.month, day: target.lunarNewYear.day }
          : null,
        rows: taiSuiRows(engine, data.year),
      },
    }
  })

export type TaiSuiYearPageData = Awaited<ReturnType<typeof getTaiSuiYearPage>>['content']
