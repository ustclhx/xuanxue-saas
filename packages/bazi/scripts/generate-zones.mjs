#!/usr/bin/env node
// 从 Node 自带的 IANA tzdata 生成精简历史时区表 src/zones.data.ts。
// 运行时不依赖 Intl 时区数据：浏览器与服务端 tzdata 版本不同会导致结果不一致。
// 用法：node packages/bazi/scripts/generate-zones.mjs
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ZONES = [
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Hong_Kong',
  'Asia/Macau',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/New_York',
  'America/Toronto',
  'Europe/London',
  'Australia/Sydney',
]

const START = Date.UTC(1899, 11, 1)
const END = Date.UTC(2101, 1, 1)
const HOUR = 3_600_000
const MAX_DST_DAYS = 300

function offsetSeconds(formatter, ms) {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  )
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 1000)
}

function periods(zone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const result = [{ start: START, offset: offsetSeconds(formatter, START) }]
  // 以 6 小时步长扫描，再二分到分钟；tzdata 中两次切换的间隔都远大于 6 小时
  for (let t = START; t < END; t += 6 * HOUR) {
    const next = t + 6 * HOUR
    const before = offsetSeconds(formatter, t)
    if (offsetSeconds(formatter, next) === before) continue
    let lo = t
    let hi = next
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000
      if (offsetSeconds(formatter, mid) === before) lo = mid
      else hi = mid
    }
    result.push({ start: hi, offset: offsetSeconds(formatter, hi) })
  }
  // 夏令时判定：短于 300 天、且比前后两段都快的时段；标准偏移取前一段
  return result.map((period, i) => {
    const prev = result[i - 1]
    const next = result[i + 1]
    const days = ((next?.start ?? END) - period.start) / (24 * HOUR)
    const dst =
      prev !== undefined &&
      next !== undefined &&
      days < MAX_DST_DAYS &&
      period.offset > prev.offset &&
      period.offset > next.offset
    return { ...period, std: dst ? prev.offset : period.offset }
  })
}

const encode = (n) => n.toString(36)
const lines = ZONES.map((zone) => {
  const encoded = periods(zone)
    .map((p) => [encode(Math.round(p.start / 60_000)), encode(p.offset), encode(p.std)].join(','))
    .join(';')
  return `  '${zone}': '${encoded}',`
})

const file = `// 由 scripts/generate-zones.mjs 从 IANA tzdata（Node ${process.versions.node}，tz ${process.versions.tz}）生成，勿手改。
// 每段为「起点 UTC 分钟（Unix 纪元起）,总偏移秒,标准偏移秒」，均为 base36。
export const TZ_VERSION = '${process.versions.tz}'

export const ZONE_DATA: Record<string, string> = {
${lines.join('\n')}
}
`
writeFileSync(join(import.meta.dirname, '../src/zones.data.ts'), file)
console.log(`已生成 ${ZONES.length} 个时区，tz ${process.versions.tz}`)
