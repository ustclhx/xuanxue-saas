import type { Element, ElementStat } from '@xuanxue/bazi'
import type { Box, ChartSize } from './geometry.ts'

// 五行分布图形布局（openspec redesign-home-chart-visuals tasks 4.2，「命盘图形」画布 ② 五行分佈）：
// 每个五行一行：五行名、条形轨道与填充、数值（个数 · 占比）。顺序与原条形图一致（按加权分数从高到低），
// 条长按占比相对最大值，数值直接取引擎的 strength.elements，不重新计算。

export const ELEMENTS_SIZE: ChartSize = { width: 480, height: 230 }

const ROW_HEIGHT = 46
const NAME_WIDTH = 52
const VALUE_WIDTH = 132
const TRACK_HEIGHT = 14

export interface ElementRow {
  element: Element
  count: number
  percent: number
  /** 五行名与数值的文字基线 */
  baseline: number
  track: Box
  fill: Box
  /** 「4 · 33.3%」 */
  value: string
}

export interface ElementsLayout {
  size: ChartSize
  nameX: number
  valueX: number
  rows: ElementRow[]
}

export function elementValueText(stat: Pick<ElementStat, 'count' | 'percent'>): string {
  return `${stat.count} · ${stat.percent}%`
}

export function layoutElements(elements: readonly ElementStat[]): ElementsLayout {
  const sorted = [...elements].sort((a, b) => b.score - a.score)
  const max = Math.max(...sorted.map((e) => e.percent), 1)
  const trackX = NAME_WIDTH
  const trackWidth = ELEMENTS_SIZE.width - NAME_WIDTH - VALUE_WIDTH
  return {
    size: ELEMENTS_SIZE,
    nameX: 0,
    valueX: ELEMENTS_SIZE.width,
    rows: sorted.map((stat, index) => {
      const center = index * ROW_HEIGHT + ROW_HEIGHT / 2
      const track = {
        x: trackX,
        y: center - TRACK_HEIGHT / 2,
        width: trackWidth,
        height: TRACK_HEIGHT,
      }
      return {
        element: stat.element,
        count: stat.count,
        percent: stat.percent,
        baseline: center + 8,
        track,
        fill: { ...track, width: (trackWidth * stat.percent) / max },
        value: elementValueText(stat),
      }
    }),
  }
}
