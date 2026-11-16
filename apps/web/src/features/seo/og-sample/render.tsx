import type { BirthInput } from '@xuanxue/bazi'
import { computeZiwei } from '@xuanxue/bazi/ziwei'
import { lifePath } from '@xuanxue/numerology'
import type { JSX, ReactElement } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale, type Locale, overwriteGetLocale } from '../../../paraglide/runtime.js'
import type { ShareCardBrand } from '../../share-cards/site.ts'
import type { ChartColors } from '../../tools/charts/colors.ts'
import { DigitGridChart } from '../../tools/charts/digit-grid-chart.tsx'
import { LifePathChart } from '../../tools/charts/life-path-chart.tsx'
import { PillarsChart } from '../../tools/charts/pillars-chart.tsx'
import { renderChartMarkup } from '../../tools/charts/render-static.ts'
import { SAMPLE_BAZI_PILLARS, SAMPLE_BIRTH_DATE } from '../../tools/charts/samples.ts'
import { ZiweiBoard } from '../../tools/charts/ziwei-chart.tsx'
import { birthDigits, digitCounts } from '../../tools/numerology/calc.ts'
import { ogSampleLayout } from './layout.tsx'
import type { OgSampleChart } from './pages.ts'
import { splitChartText } from './svg-text.ts'

// 样例 OG 图的构建期入口（design D6、tasks 8.1）。图形组件依赖 Paraglide 文案（src/paraglide 由 vite 插件在构建开始时生成），
// 而 vite 配置加载时它可能还不存在，所以 scripts/og-images.ts 在 generateBundle 中经 vite runnerImport 加载本模块，
// 不在配置中静态导入。全部数据都是虚构样例（1990-05-15 10:30 台北 男，与首页样例一致），不使用访客数据。

const SAMPLE_ZIWEI_INPUT: BirthInput = {
  calendar: 'solar',
  year: SAMPLE_BIRTH_DATE.year,
  month: SAMPLE_BIRTH_DATE.month,
  day: SAMPLE_BIRTH_DATE.day,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
  trueSolarTime: false,
}

function chartElement(chart: OgSampleChart, locale: Locale, colors: ChartColors): ReactElement {
  switch (chart) {
    case 'pillars':
      return (
        <PillarsChart
          pillars={SAMPLE_BAZI_PILLARS}
          locale={locale === 'ko' ? 'ko' : locale === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant'}
          colors={colors}
        />
      )
    case 'ziwei': {
      const result = computeZiwei(SAMPLE_ZIWEI_INPUT)
      if (result.status !== 'ok') throw new Error('og-sample: 紫微样例命盘排盘失败')
      return <ZiweiBoard chart={result} variant="compact" colors={colors} />
    }
    case 'life-path':
      return (
        <LifePathChart
          result={lifePath(SAMPLE_BIRTH_DATE)}
          date={SAMPLE_BIRTH_DATE}
          colors={colors}
        />
      )
    case 'digit-grid':
      return (
        <DigitGridChart
          counts={digitCounts(birthDigits(SAMPLE_BIRTH_DATE))}
          caption={m.numerology_chart_birth_grid()}
          colors={colors}
        />
      )
  }
}

export interface OgSampleInput {
  readonly chart: OgSampleChart
  readonly locale: Locale
  readonly title: string
  readonly meta: string
  readonly brand: ShareCardBrand
  readonly host: string
  /** brand.css 在该站点主题下解析出的颜色（scripts/brand-tokens.ts） */
  readonly colors: ChartColors
}

/** 样例 OG 图的 satori 元素；文案按页面语言渲染（构建期逐页串行调用） */
export function ogSampleElement(input: OgSampleInput): JSX.Element {
  const previous = getLocale
  overwriteGetLocale(() => input.locale)
  try {
    const markup = renderChartMarkup(chartElement(input.chart, input.locale, input.colors))
    return ogSampleLayout(
      {
        title: input.title,
        meta: input.meta,
        brand: input.brand,
        host: input.host,
        badge: m.chart_sample_badge(),
        chart: splitChartText(markup),
      },
      input.colors,
    )
  } finally {
    overwriteGetLocale(previous)
  }
}
