import type { Branch, Element, Pillar, PillarKey, Pillars, Stem, TenGod } from '@xuanxue/bazi'
import { BRANCH_ELEMENT, BRANCH_HANZI, STEM_ELEMENT, STEM_HANZI } from '../../bazi/glyphs.ts'
import type { Box, ChartSize } from './geometry.ts'

// 四柱图形布局（openspec redesign-home-chart-visuals tasks 4.1，「命盘图形」画布 ① 四柱命盤）：
// 左侧行名一栏，右侧四柱各一列；自上而下为柱名、十神、天干格、地支格、藏干。
// 只消费引擎已算好的 Pillars，不推算干支；文字标签（柱名、十神、五行名）由组件按当前语言取文案。

/** 年月日時（繁简）或시일월연（韩语）；命盘查询页与其表格同用時日月年 */
export const PILLAR_ORDER = {
  chinese: ['year', 'month', 'day', 'hour'],
  korean: ['hour', 'day', 'month', 'year'],
} as const satisfies Record<string, readonly PillarKey[]>

export const PILLARS_SIZE: ChartSize = { width: 640, height: 404 }

const LABEL_WIDTH = 76
const GAP = 12
const ROW = {
  header: { y: 0, height: 36 },
  tenGod: { y: 36, height: 36 },
  stem: { y: 80, height: 128 },
  branch: { y: 220, height: 128 },
  hidden: { y: 356, height: 48 },
} as const

export type PillarsRow = keyof typeof ROW

export interface GlyphCell {
  box: Box
  glyph: string
  /** 天干或地支（本气）的五行，组件同时写五行文字，不只靠颜色 */
  element: Element
  key: Stem | Branch
}

export interface PillarColumn {
  key: PillarKey
  /** 列中心 x */
  x: number
  isDay: boolean
  /** 天干十神；日柱为 'dayMaster'；时辰未知时为 null */
  tenGod: TenGod | 'dayMaster' | null
  stem: GlyphCell | null
  branch: GlyphCell | null
  /** 时辰未知时合并天干、地支两格的占位框（虚线，写「需要出生時辰」） */
  placeholder: Box | null
  hidden: string[]
}

export interface PillarsLayout {
  size: ChartSize
  /** 左侧行名的 x（右对齐）与各行文字基线 */
  labelX: number
  rows: Record<PillarsRow, { y: number; height: number; baseline: number }>
  columns: PillarColumn[]
}

const baseline = (row: { y: number; height: number }, size = 24) =>
  row.y + row.height / 2 + size * 0.36

/** 由引擎的 Pillars 与柱序得到四柱图形的几何与文字 */
export function layoutPillars(
  pillars: Pillars,
  order: readonly PillarKey[] = PILLAR_ORDER.chinese,
): PillarsLayout {
  const columnWidth = (PILLARS_SIZE.width - LABEL_WIDTH - GAP * (order.length - 1)) / order.length
  const rows = Object.fromEntries(
    Object.entries(ROW).map(([key, row]) => [key, { ...row, baseline: baseline(row) }]),
  ) as PillarsLayout['rows']
  const columns = order.map((key, index): PillarColumn => {
    const left = LABEL_WIDTH + index * (columnWidth + GAP)
    const pillar: Pillar | null = pillars[key]
    const cell = (row: PillarsRow): Box => ({
      x: left,
      y: ROW[row].y,
      width: columnWidth,
      height: ROW[row].height,
    })
    const isDay = key === 'day'
    return {
      key,
      x: left + columnWidth / 2,
      isDay,
      tenGod: isDay ? 'dayMaster' : (pillar?.tenGod ?? null),
      stem: pillar
        ? {
            box: cell('stem'),
            glyph: STEM_HANZI[pillar.stem],
            element: STEM_ELEMENT[pillar.stem],
            key: pillar.stem,
          }
        : null,
      branch: pillar
        ? {
            box: cell('branch'),
            glyph: BRANCH_HANZI[pillar.branch],
            element: BRANCH_ELEMENT[pillar.branch],
            key: pillar.branch,
          }
        : null,
      placeholder: pillar
        ? null
        : {
            x: left,
            y: ROW.stem.y,
            width: columnWidth,
            height: ROW.branch.y + ROW.branch.height - ROW.stem.y,
          },
      hidden: pillar ? pillar.hiddenStems.map((h) => STEM_HANZI[h.stem]) : [],
    }
  })
  return { size: PILLARS_SIZE, labelX: LABEL_WIDTH - 14, rows, columns }
}

/**
 * 估算一行文字在 viewBox 中的宽度：汉字、韩文按 1 个字号，ASCII 与间隔号按 0.55。
 * 只用于把「● 五行」这类短标签居中，不追求精确排版。
 */
export function estimateTextWidth(text: string, size: number): number {
  let width = 0
  // U+2E80 之后为 CJK 部首、汉字与韩文等全角字形
  for (const char of text) width += (char.codePointAt(0) ?? 0) < 0x2e80 ? 0.55 : 1
  return width * size
}
