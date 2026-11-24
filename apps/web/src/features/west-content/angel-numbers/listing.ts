import { ANGEL_NUMBERS, type AngelLocale } from './paths.ts'

// 枢纽与相邻数字的列表（纯函数，单测直接引用；数据来自内容集合，文件存在即已发布）

/** 数字页「相邻数字」格子的数量（含当前数字） */
const NEARBY_SHOWN = 6

export interface AngelGridItem {
  readonly number: string
  readonly theme: string
}

/** 某语言已发布的数字页（内容集合），按 paths.ts 的顺序；未登记的数字排在最后 */
export function publishedNumbers(
  entries: readonly { locale: string; key: string; theme?: string | undefined }[],
  locale: AngelLocale,
): AngelGridItem[] {
  const order: readonly string[] = ANGEL_NUMBERS[locale]
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length)
  return entries
    .filter((entry) => entry.locale === locale && entry.key !== 'index')
    .sort((a, b) => rank(a.key) - rank(b.key) || Number(a.key) - Number(b.key))
    .map((entry) => ({ number: entry.key, theme: entry.theme ?? '' }))
}

/** 当前数字前后的已发布数字（含自身），列表两端时向另一侧补足 */
export function nearbyNumbers(items: readonly AngelGridItem[], number: string): AngelGridItem[] {
  const index = items.findIndex((item) => item.number === number)
  if (index < 0) return []
  const start = Math.max(
    0,
    Math.min(index - Math.floor((NEARBY_SHOWN - 1) / 2), items.length - NEARBY_SHOWN),
  )
  return items.slice(start, start + NEARBY_SHOWN)
}
