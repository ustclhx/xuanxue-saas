import type { Branch } from '@xuanxue/bazi'
import type { ZiweiPalace } from '@xuanxue/bazi/ziwei'
import type { Box, ChartSize } from './geometry.ts'

// 紫微十二宫盘布局（openspec redesign-home-chart-visuals tasks 5.1、design D4，「命盘图形」与「紫微盘手机版」画布）：
// 4×4 外圈按传统地支方位固定（巳午未申在上、亥子丑寅在下，辰卯在左、酉戌在右），中间 2×2 为中宫。
// 手机端整盘等比缩小：viewBox 宽 716，图形在 390px 屏幕的结果卡内约 332px 宽，
// 因此最小字号取 24（折算约 11px），宫内只列主星，完整内容见图形下方的宫位列表。
// 只消费引擎的 palaces 与命宫 / 身宫地支，不排星。

/**
 * 两种版式：compact 用于手机与平板（整盘等比缩放），wide 用于 lg 以上桌面（「命盘图形」画布 880 宽、每行 120）。
 * 页面同时输出两张，用 CSS 按断点只显示一张；字号与间距随版式变化，几何算法相同。
 */
export const ZIWEI_VARIANTS = {
  compact: {
    size: { width: 716, height: 616 },
    pad: 12,
    star: 30,
    /** 最小字号：332px 显示宽度下折算不低于 11px */
    small: 24,
    name: 26,
    title: 34,
    tagPad: 7,
    lineGap: 8,
    soulStroke: 4,
  },
  wide: {
    size: { width: 880, height: 480 },
    pad: 10,
    star: 17,
    small: 12,
    name: 14,
    title: 20,
    tagPad: 4,
    lineGap: 5,
    soulStroke: 2,
  },
} as const satisfies Record<string, ZiweiMetrics>

export interface ZiweiMetrics {
  size: ChartSize
  pad: number
  star: number
  small: number
  name: number
  title: number
  tagPad: number
  lineGap: number
  soulStroke: number
}

export type ZiweiVariant = keyof typeof ZIWEI_VARIANTS

export const ZIWEI_SIZE: ChartSize = ZIWEI_VARIANTS.compact.size
export const ZIWEI_MIN_FONT = ZIWEI_VARIANTS.compact.small

const COLUMNS = 4

/** 地支 → [列, 行]（从 0 起） */
export const BRANCH_POSITION: Record<Branch, readonly [number, number]> = {
  si: [0, 0],
  wu: [1, 0],
  wei: [2, 0],
  shen: [3, 0],
  you: [3, 1],
  xu: [3, 2],
  hai: [3, 3],
  zi: [2, 3],
  chou: [1, 3],
  yin: [0, 3],
  mao: [0, 2],
  chen: [0, 1],
}

export interface ZiweiPalaceCell {
  palace: ZiweiPalace
  box: Box
  isSoul: boolean
  isBody: boolean
}

export interface ZiweiLayout {
  metrics: ZiweiMetrics
  size: ChartSize
  cells: ZiweiPalaceCell[]
  center: Box
}

export function layoutZiwei(
  palaces: readonly ZiweiPalace[],
  soulBranch: Branch,
  bodyBranch: Branch,
  variant: ZiweiVariant = 'compact',
): ZiweiLayout {
  const metrics = ZIWEI_VARIANTS[variant]
  const CELL_WIDTH = metrics.size.width / COLUMNS
  const CELL_HEIGHT = metrics.size.height / COLUMNS
  return {
    metrics,
    size: metrics.size,
    cells: palaces.map((palace) => {
      const [column, row] = BRANCH_POSITION[palace.branch]
      return {
        palace,
        box: {
          x: column * CELL_WIDTH,
          y: row * CELL_HEIGHT,
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
        },
        isSoul: palace.branch === soulBranch,
        isBody: palace.branch === bodyBranch,
      }
    }),
    center: { x: CELL_WIDTH, y: CELL_HEIGHT, width: CELL_WIDTH * 2, height: CELL_HEIGHT * 2 },
  }
}
