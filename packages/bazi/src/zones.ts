import { ZONE_DATA } from './zones.data.ts'

type Period = { start: number; offset: number; std: number }

const cache = new Map<string, Period[]>()

function periods(zone: string): Period[] {
  let list = cache.get(zone)
  if (!list) {
    const data = ZONE_DATA[zone]
    if (data === undefined) throw new RangeError(`Unknown zone ${zone}`)
    list = data.split(';').map((item) => {
      const [start, offset, std] = item.split(',').map((n) => Number.parseInt(n, 36))
      return { start: (start as number) * 60_000, offset: offset as number, std: std as number }
    })
    cache.set(zone, list)
  }
  return list
}

/** 某一 UTC 时刻的总偏移与标准偏移（秒）。 */
export function zoneOffsetAt(zone: string, utcMs: number): { offset: number; std: number } {
  const list = periods(zone)
  let lo = 0
  let hi = list.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((list[mid] as Period).start <= utcMs) lo = mid
    else hi = mid - 1
  }
  const period = list[lo] as Period
  return { offset: period.offset, std: period.std }
}

/**
 * 当地钟表时间（按 UTC 编码的毫秒数）→ UTC 时刻。
 * 重叠时段（夏令时结束回拨）取较早的夏令时解释；不存在的时段（开始拨快）按切换前的偏移解释。
 */
export function wallToUtc(zone: string, wallMs: number): number {
  const day = 86_400_000
  const candidates = new Set(
    [wallMs - day, wallMs, wallMs + day].map((t) => zoneOffsetAt(zone, t).offset),
  )
  const valid = [...candidates].filter(
    (offset) => zoneOffsetAt(zone, wallMs - offset * 1000).offset === offset,
  )
  if (valid.length > 0) return wallMs - Math.max(...valid) * 1000
  return wallMs - zoneOffsetAt(zone, wallMs - day).offset * 1000
}
