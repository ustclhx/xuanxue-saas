import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type BirthInput, computeChart } from '@xuanxue/bazi'
import { computeZiwei } from '@xuanxue/bazi/ziwei'
import { lifePath } from '@xuanxue/numerology'
import { describe, expect, it, vi } from 'vitest'
import { CHART_COLOR_SLOTS, type ChartColors } from '../charts/colors.ts'
import { estimateTextWidth } from '../charts/layout/pillars.ts'
import { renderChartMarkup } from '../charts/render-static.ts'
import { ZiweiBoard } from '../charts/ziwei-chart.tsx'
import { prepareChartMarkup, viewBoxSize } from './chart-markup.ts'
import { CARD_HEIGHT, CARD_WIDTH, type DrawOp, layoutShareCard, wrapText } from './layout.ts'
import type { ShareCardModel } from './model.ts'
import { baziShareCard } from './sources-bazi.ts'
import { lifePathShareCard } from './sources-life-path.ts'
import { ziweiShareCard } from './sources-ziwei.ts'

// openspec redesign-home-chart-visuals tasks 7.2：分享图默认不含出生日期，任何情况下不含姓名与出生地；
// 生成模块只能经 import() 加载（首页包检查依赖源码中的特征字符串）。

const messages = vi.hoisted(() => ({ locale: 'zh-Hant' }))
vi.mock('../../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

const SAMPLE: BirthInput = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
  trueSolarTime: false,
}

const colors = Object.fromEntries(
  CHART_COLOR_SLOTS.map((slot) => [slot, `color-${slot}`]),
) as ChartColors
const env = {
  colors,
  measure: (text: string, size: number) => estimateTextWidth(text, size),
}

const texts = (ops: DrawOp[]) => ops.flatMap((op) => (op.op === 'text' ? [op.text] : [])).join('\n')

// 姓名与出生地不在模型里；出生地（台北）的各语言写法都不应出现
const PLACE = /台北|臺北|타이베이|Taipei/

function zhChart() {
  messages.locale = 'zh-Hant'
  return computeChart(SAMPLE, { referenceYear: 2026 })
}

describe('分享图模型与版式', () => {
  it('八字：四柱、日主与用神来自结果；默认不含出生日期与出生地，勾选后才出现出生日期', () => {
    const model = baziShareCard(zhChart(), 'bazi', 'zh-Hant')
    expect(model.title).toBe('干支日 · 我的八字')
    expect(model.domain).toBe('ganjiday.com')
    expect(model.body).toMatchObject({ kind: 'pillars' })
    if (model.body.kind !== 'pillars') throw new Error('expected pillars')
    expect(model.body.pillars.map((p) => `${p.stem}${p.branch}`)).toEqual([
      '庚午',
      '辛巳',
      '庚辰',
      '辛巳',
    ])
    expect(model.body.pillars.find((p) => p.day)?.label).toBe('日柱')
    expect(model.headline).toContain('庚金')

    const plain = texts(layoutShareCard(model, { includeBirth: false }, env))
    expect(plain).not.toContain('1990')
    expect(plain).not.toMatch(PLACE)
    expect(plain).toContain('ganjiday.com')
    expect(plain).toContain('不預測未來')

    const withBirth = texts(layoutShareCard(model, { includeBirth: true }, env))
    expect(withBirth).toContain('1990-05-15 10:30')
    expect(withBirth).not.toMatch(PLACE)
  })

  it('만세력：柱序为시일월연并带韩文读音，时辰未知时时柱为空格', () => {
    messages.locale = 'ko'
    const model = baziShareCard(
      computeChart({ ...SAMPLE, time: null }, { referenceYear: 2026 }),
      'manseryeok',
      'ko',
    )
    if (model.body.kind !== 'pillars') throw new Error('expected pillars')
    expect(model.body.pillars.map((p) => p.label)).toEqual(['시주', '일주', '월주', '연주'])
    expect(model.body.pillars[0]).toMatchObject({ stem: null, branch: null })
    expect(model.body.pillars[1]).toMatchObject({ stem: '庚', stemReading: '경' })
    expect(model.birth).toBe('1990-05-15')
    const ops = layoutShareCard(model, { includeBirth: false }, env)
    expect(ops.some((op) => op.op === 'rect' && op.dashed)).toBe(true)
    expect(texts(ops)).not.toContain('1990')
  })

  it('生命灵数：大号数字与主题词，默认不含出生日期', () => {
    messages.locale = 'en'
    const date = { year: 1990, month: 5, day: 15 }
    const model = lifePathShareCard(lifePath(date), date)
    expect(model.title).toBe('Arcanumber')
    expect(model.body).toEqual({ kind: 'life-path', value: 3, master: null })
    expect(model.headline).toBe('Expression')
    const plain = texts(layoutShareCard(model, { includeBirth: false }, env))
    expect(plain).toContain('MY LIFE PATH')
    expect(plain).toContain('No birth date shown')
    expect(plain).not.toContain('1990')
    const withBirth = layoutShareCard(model, { includeBirth: true }, env)
    expect(texts(withBirth)).toContain('1990-05-15')
    expect(texts(withBirth)).toContain('No name or birthplace shown')
  })

  it('所有绘制指令都在 1080×1350 画布内，文字不超出左右边距', () => {
    messages.locale = 'zh-Hant'
    const date = { year: 1987, month: 11, day: 29 }
    messages.locale = 'en'
    const west = lifePathShareCard(lifePath(date), date)
    messages.locale = 'zh-Hant'
    const east = baziShareCard(zhChart(), 'bazi', 'zh-Hant')
    for (const model of [west, east] as ShareCardModel[]) {
      for (const op of layoutShareCard(model, { includeBirth: true }, env)) {
        if (op.op === 'text') {
          expect(op.y).toBeLessThanOrEqual(CARD_HEIGHT)
          const width = estimateTextWidth(op.text, op.size)
          const left =
            op.align === 'left' ? op.x : op.align === 'right' ? op.x - width : op.x - width / 2
          expect(left).toBeGreaterThanOrEqual(0)
          expect(left + width).toBeLessThanOrEqual(CARD_WIDTH)
        }
      }
    }
  })

  it('断行：中韩按字、拉丁按词，超出行数时以省略号结尾', () => {
    const width = (value: string) => value.length * 10
    expect(wrapText('甲乙丙丁戊己', 30, width)).toEqual(['甲乙丙', '丁戊己'])
    expect(wrapText('alpha beta gamma', 100, width)).toEqual(['alpha beta', 'gamma'])
    const cut = wrapText('一二三四五六七八九', 30, width, 2)
    expect(cut).toHaveLength(2)
    expect(cut[1]?.endsWith('…')).toBe(true)
  })
})

describe('紫微盘克隆', () => {
  function ziwei() {
    messages.locale = 'zh-Hant'
    const chart = computeZiwei(SAMPLE)
    if (chart.status !== 'ok') throw new Error('expected ok')
    return chart
  }

  it('未勾选时移除中宫出生时间，颜色与字体变量换成实际值，按目标尺寸输出', () => {
    const chart = ziwei()
    const markup = renderChartMarkup(<ZiweiBoard chart={chart} variant="compact" />)
    expect(markup).toContain('1990-05-15')
    const size = viewBoxSize(markup)
    expect(size).toEqual({ width: 716, height: 616 })
    const options = {
      colors,
      fonts: { heading: '"Noto Serif TC", serif', body: '-apple-system, sans-serif' },
      width: 1432,
      height: 1232,
    }
    const plain = prepareChartMarkup(markup, { ...options, includeBirth: false })
    expect(plain).not.toContain('1990-05-15')
    expect(plain).not.toContain('var(--')
    expect(plain).not.toMatch(/<title|class=/)
    expect(plain).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(plain).toMatch(/^<svg[^>]* width="1432" height="1232">/)
    expect(plain).toContain("font-family:'Noto Serif TC', serif")
    expect(prepareChartMarkup(markup, { ...options, includeBirth: true })).toContain('1990-05-15')
  })

  it('紫微模型：结论为五行局与命身宫，图形取页面中的十二宫盘', () => {
    const model = ziweiShareCard(ziwei())
    expect(model.body).toEqual({ kind: 'chart', chart: 'ziwei-palaces' })
    expect(model.headline).toMatch(/命宮在.+身宮在/)
    const ops = layoutShareCard(
      model,
      { includeBirth: false },
      { ...env, chartSize: { width: 716, height: 616 } },
    )
    const chartOp = ops.find((op) => op.op === 'chart')
    expect(chartOp).toBeDefined()
    if (chartOp?.op !== 'chart') throw new Error('expected chart op')
    expect(chartOp.width / chartOp.height).toBeCloseTo(716 / 616, 3)
    expect(texts(ops)).not.toContain('1990')
  })
})

describe('按需加载', () => {
  const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')

  it('生成模块保留首页包检查的特征字符串，结果页静态引用的文件不含它也不静态导入生成模块', () => {
    expect(read('./render.ts')).toContain("'xuanxue-share-card'")
    for (const file of [
      './share-card-action.tsx',
      './model.ts',
      './common.ts',
      './sources-bazi.ts',
      './sources-ziwei.ts',
      './sources-life-path.ts',
    ]) {
      const source = read(file)
      expect(source).not.toContain('xuanxue-share-card')
      expect(source).not.toMatch(/^import[^\n]*from '\.\/(render|layout|chart-markup)\.ts'/m)
    }
    expect(read('./share-card-action.tsx')).toContain("import('./render.ts')")
  })
})
