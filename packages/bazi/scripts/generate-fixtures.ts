#!/usr/bin/env node
/**
 * 生成 test/fixtures/charts.json：每个样例分别用引擎（tyme4ts）与 lunar-javascript 计算，
 * 只有两边逐字段一致的样例进入 cases；不一致的进入 disagreements 并保留两边结果供人工取舍。
 * 用法：node packages/bazi/scripts/generate-fixtures.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { SolarTerm } from 'tyme4ts'
import { computeChart } from '../src/chart.ts'
import type { BirthInput } from '../src/input.ts'
import { engineRecord, lunarRecord } from '../test/oracle.ts'

const REFERENCE_YEAR = 2026

type Case = { id: string; note: string; input: BirthInput }

const solar = (
  year: number,
  month: number,
  day: number,
  time: [number, number] | null,
  gender: 'male' | 'female',
  location: BirthInput['location'],
  extra: Partial<BirthInput> = {},
): BirthInput => ({
  calendar: 'solar',
  year,
  month,
  day,
  time: time === null ? null : { hour: time[0], minute: time[1] },
  gender,
  location,
  ...extra,
})

const taipei = { city: 'taipei' } as const
const seoul = { city: 'seoul' } as const
const busan = { city: 'busan' } as const

/** 节气交接时刻（北京时间）前后各一分钟的当地时间（台北/上海与北京同为 UTC+8）。 */
function aroundTerm(
  year: number,
  name: string,
): {
  before: [number, number, number, number, number]
  after: [number, number, number, number, number]
} {
  const t = SolarTerm.fromName(year, name).getJulianDay().getSolarTime()
  const ms = Date.UTC(
    t.getYear(),
    t.getMonth() - 1,
    t.getDay(),
    t.getHour(),
    t.getMinute(),
    t.getSecond(),
  )
  const floor = Math.floor((ms - 60_000) / 60_000) * 60_000
  const ceil = Math.ceil((ms + 60_000) / 60_000) * 60_000
  const parts = (v: number): [number, number, number, number, number] => {
    const d = new Date(v)
    return [
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
    ]
  }
  return { before: parts(floor), after: parts(ceil) }
}

const cases: Case[] = [
  {
    id: 'sample-1990-taipei-male',
    note: '回归首例：庚午 辛巳 庚辰 辛巳，起运 7 岁 3 个月，首步大运壬午（1997），日空申酉',
    input: solar(1990, 5, 15, [10, 30], 'male', taipei),
  },
]

// 立春与其他「节」交接前后一分钟（年柱/月柱切换）
for (const [year, term, city, gender] of [
  [1985, '立春', 'taipei', 'male'],
  [2000, '立春', 'taipei', 'female'],
  [2024, '立春', 'shanghai', 'male'],
  [1962, '立春', 'hongKong', 'female'],
  [2010, '惊蛰', 'taipei', 'female'],
  [1995, '芒种', 'beijing', 'male'],
  [2019, '大雪', 'taipei', 'male'],
] as const) {
  const { before, after } = aroundTerm(year, term)
  for (const [label, t] of [
    ['before', before],
    ['after', after],
  ] as const) {
    cases.push({
      id: `term-${year}-${label}`,
      note: `${year} ${term}交接${label === 'before' ? '前' : '后'}一分钟（${city}）`,
      input: solar(t[0], t[1], t[2], [t[3], t[4]], gender, { city }),
    })
  }
}

cases.push(
  // 子时跨日：23 点起换日
  {
    id: 'zi-2001-2259',
    note: '22:59 亥时，日柱不变',
    input: solar(2001, 3, 10, [22, 59], 'male', taipei),
  },
  {
    id: 'zi-2001-2300',
    note: '23:00 起换日（晚子时日柱取次日）',
    input: solar(2001, 3, 10, [23, 0], 'male', taipei),
  },
  {
    id: 'zi-2001-2345',
    note: '23:45 子时跨日',
    input: solar(2001, 3, 10, [23, 45], 'female', taipei),
  },
  {
    id: 'zi-2001-0015',
    note: '00:15 早子时',
    input: solar(2001, 3, 11, [0, 15], 'female', taipei),
  },
  {
    id: 'zi-1999-month-end',
    note: '月末 23:30 跨月换日',
    input: solar(1999, 12, 31, [23, 30], 'male', taipei),
  },
  // 农历输入与闰月
  {
    id: 'lunar-2020-leap4',
    note: '农历 2020 闰四月十五',
    input: {
      ...solar(2020, 4, 15, [8, 0], 'female', taipei),
      calendar: 'lunar',
      isLeapMonth: true,
    },
  },
  {
    id: 'lunar-2023-leap2',
    note: '农历 2023 闰二月初十',
    input: { ...solar(2023, 2, 10, [14, 20], 'male', seoul), calendar: 'lunar', isLeapMonth: true },
  },
  {
    id: 'lunar-1995-leap8',
    note: '农历 1995 闰八月廿九',
    input: { ...solar(1995, 8, 29, [6, 5], 'male', taipei), calendar: 'lunar', isLeapMonth: true },
  },
  {
    id: 'lunar-1984-1-1',
    note: '农历 1984 正月初一（春节早于立春）',
    input: { ...solar(1984, 1, 1, [12, 0], 'female', taipei), calendar: 'lunar' },
  },
  // 台湾夏令时
  {
    id: 'tw-dst-1975',
    note: '台湾夏令时：10:30 → 标准时间 09:30',
    input: solar(1975, 7, 1, [10, 30], 'male', taipei),
  },
  {
    id: 'tw-dst-1979',
    note: '台湾 1979 夏令时',
    input: solar(1979, 8, 1, [0, 30], 'female', taipei),
  },
  {
    id: 'tw-dst-1950',
    note: '台湾 1950 夏令时',
    input: solar(1950, 6, 15, [12, 40], 'male', taipei),
  },
  {
    id: 'tw-1940-jst',
    note: '台湾 1937–1945 使用 UTC+9',
    input: solar(1940, 3, 8, [7, 0], 'female', taipei),
  },
  // 韩国夏令时与 UTC+8:30
  {
    id: 'kr-dst-1987',
    note: '韩国 1987 夏令时',
    input: solar(1987, 7, 15, [14, 0], 'male', seoul),
  },
  {
    id: 'kr-dst-1988',
    note: '韩国 1988 夏令时',
    input: solar(1988, 6, 1, [0, 40], 'female', seoul),
  },
  {
    id: 'kr-dst-1957',
    note: '韩国 1957 夏令时（标准 UTC+8:30）',
    input: solar(1957, 7, 1, [6, 0], 'male', seoul),
  },
  {
    id: 'kr-0830-1958',
    note: '韩国 1954–1961 标准时间 UTC+8:30',
    input: solar(1958, 1, 10, [23, 20], 'female', busan),
  },
  {
    id: 'kr-1949-dst',
    note: '韩国 1949 夏令时 UTC+10',
    input: solar(1949, 7, 1, [9, 0], 'male', seoul),
  },
  {
    id: 'kr-modern',
    note: '首尔 2005 普通样例',
    input: solar(2005, 11, 23, [17, 45], 'female', seoul),
  },
  // 无时辰
  { id: 'nohour-1990', note: '不知道时辰：三柱', input: solar(1990, 5, 15, null, 'male', taipei) },
  {
    id: 'nohour-1972-female',
    note: '不知道时辰：女命',
    input: solar(1972, 9, 9, null, 'female', seoul),
  },
  {
    id: 'nohour-lunar-2006',
    note: '不知道时辰 + 农历闰七月',
    input: { ...solar(2006, 7, 3, null, 'male', taipei), calendar: 'lunar', isLeapMonth: true },
  },
  // 真太阳时
  {
    id: 'tst-seoul-1993',
    note: '首尔真太阳时（东经 126.98°，约慢 32 分钟）',
    input: solar(1993, 3, 3, [11, 10], 'male', seoul, { trueSolarTime: true }),
  },
  {
    id: 'tst-kaohsiung-2011',
    note: '高雄真太阳时',
    input: solar(2011, 11, 3, [7, 0], 'female', { city: 'kaohsiung' }, { trueSolarTime: true }),
  },
  // 其他城市与手选偏移
  {
    id: 'la-dst-1998',
    note: '洛杉矶夏令时',
    input: solar(1998, 8, 20, [21, 15], 'male', { city: 'losAngeles' }),
  },
  {
    id: 'ny-winter-1980',
    note: '纽约冬令',
    input: solar(1980, 1, 5, [4, 30], 'female', { city: 'newYork' }),
  },
  {
    id: 'london-bst-2002',
    note: '伦敦夏令时',
    input: solar(2002, 6, 30, [13, 0], 'male', { city: 'london' }),
  },
  {
    id: 'sydney-dst-2015',
    note: '悉尼夏令时（南半球）',
    input: solar(2015, 1, 20, [10, 0], 'female', { city: 'sydney' }),
  },
  {
    id: 'shanghai-dst-1988',
    note: '中国 1986–1991 夏令时',
    input: solar(1988, 7, 1, [8, 30], 'male', { city: 'shanghai' }),
  },
  {
    id: 'tokyo-2010',
    note: '东京 UTC+9',
    input: solar(2010, 10, 10, [10, 10], 'female', { city: 'tokyo' }),
  },
  { id: 'hk-1968', note: '香港', input: solar(1968, 4, 4, [16, 50], 'male', { city: 'hongKong' }) },
  {
    id: 'manual-offset-2003',
    note: '手选 UTC+7（曼谷）',
    input: solar(2003, 5, 5, [5, 5], 'female', { utcOffsetMinutes: 420, longitude: 100.5 }),
  },
  // 年份边界
  {
    id: 'edge-1900',
    note: '1900 年（范围下限）',
    input: solar(1900, 3, 1, [9, 0], 'male', taipei),
  },
  {
    id: 'edge-2100',
    note: '2100 年（范围上限）',
    input: solar(2100, 12, 1, [18, 0], 'female', taipei),
  },
  {
    id: 'female-backward-1991',
    note: '阴年男命逆排（辛未年）',
    input: solar(1991, 9, 9, [9, 9], 'male', taipei),
  },
  {
    id: 'female-forward-1993',
    note: '阴年女命顺排（癸酉年）',
    input: solar(1993, 2, 28, [15, 30], 'female', taipei),
  },
)

const agreed: unknown[] = []
const disagreements: unknown[] = []
for (const c of cases) {
  const chart = computeChart(c.input, { referenceYear: REFERENCE_YEAR })
  const engine = engineRecord(chart)
  const lunar = lunarRecord(c.input)
  const engineOnly = {
    shensha: chart.shensha.map(
      (s) => `${s.key}/${s.basis}:${s.targets.join(',')}=>${s.pillars.join(',')}`,
    ),
    startAfter: chart.fortune.startAfter,
    weight: chart.weight,
    strength: chart.strength.verdict,
    favorable: chart.useful.favorable,
  }
  if (isDeepStrictEqual(engine, lunar)) {
    agreed.push({ id: c.id, note: c.note, input: c.input, expected: engine, engineOnly })
  } else {
    const fields = Object.keys(engine).filter(
      (k) => !isDeepStrictEqual(engine[k as keyof typeof engine], lunar[k as keyof typeof lunar]),
    )
    disagreements.push({ id: c.id, note: c.note, input: c.input, fields, engine, lunar })
  }
}

writeFileSync(
  join(import.meta.dirname, '../test/fixtures/charts.json'),
  `${JSON.stringify({ referenceYear: REFERENCE_YEAR, cases: agreed, disagreements }, null, 2)}\n`,
)
console.log(`一致 ${agreed.length} 个，不一致 ${disagreements.length} 个`)
for (const d of disagreements as { id: string; fields: string[] }[]) {
  console.log(`  - ${d.id}: ${d.fields.join(', ')}`)
}
