import { Solar } from 'lunar-javascript'
import { Duty, Taboo } from 'tyme4ts'
import { describe, expect, it } from 'vitest'
import { computeChart } from '../src/chart.ts'
import { BRANCHES, STEMS } from '../src/constants.ts'
import {
  DAILY_RULES_VERSION,
  type DailyNatal,
  DUTY_KEYS,
  dailyBranchRelations,
  dailyRelations,
  dayPillarOf,
} from '../src/daily.ts'
import { BaziInputError } from '../src/input.ts'
import { isHarm } from '../src/relations.ts'

const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const ganZhi = (p: { stem: string; branch: string }) =>
  `${STEM_HANZI[STEMS.indexOf(p.stem as never)]}${BRANCH_HANZI[BRANCHES.indexOf(p.branch as never)]}`

/** 民间常用的已知日柱（万年历），另以 lunar-javascript 交叉校验 */
const KNOWN: [string, string][] = [
  ['2026-11-13', '辛卯'],
  ['2000-01-01', '戊午'],
  ['1900-01-31', '甲辰'],
  ['1949-10-01', '甲子'],
  ['2024-02-10', '甲辰'], // 2024 春节
  ['2023-12-31', '癸亥'], // 跨年前
  ['2024-01-01', '甲子'], // 跨年后
  ['2023-03-22', '己卯'], // 2023 闰二月初一
  ['2023-04-20', '戊申'], // 2023 闰二月后的三月初一
  ['2025-07-25', '乙未'], // 2025 闰六月初一
  ['2100-12-31', '丁未'],
]

const ymd = (text: string) => {
  const [year, month, day] = text.split('-').map(Number) as [number, number, number]
  return { year, month, day }
}

describe('dayPillarOf', () => {
  it.each(KNOWN)('%s 日柱为 %s，农历、建除与宜忌与 lunar-javascript 一致', (text, expected) => {
    const date = ymd(text)
    const day = dayPillarOf(date)
    expect(day.rulesVersion).toBe(DAILY_RULES_VERSION)
    expect(ganZhi(day)).toBe(expected)
    const lunar = Solar.fromYmd(date.year, date.month, date.day).getLunar()
    expect(ganZhi(day)).toBe(lunar.getDayInGanZhi())
    expect(day.lunar).toEqual({
      year: lunar.getYear(),
      month: Math.abs(lunar.getMonth()),
      day: lunar.getDay(),
      isLeapMonth: lunar.getMonth() < 0,
    })
    expect(Duty.fromIndex(DUTY_KEYS.indexOf(day.duty)).getName()).toBe(lunar.getZhiXing())
    const names = (ids: number[]) => ids.map((i) => Taboo.fromIndex(i).getName())
    expect(names(day.recommends)).toEqual(lunar.getDayYi())
    expect(names(day.avoids)).toEqual(lunar.getDayJi())
  })

  it('2026-11-13：农历十月初五、定日，结果只含 key 与序号', () => {
    const day = dayPillarOf({ year: 2026, month: 11, day: 13 })
    expect(day).toMatchObject({
      stem: 'xin',
      branch: 'mao',
      cycleIndex: 27,
      lunar: { year: 2026, month: 10, day: 5, isLeapMonth: false },
      duty: 'ding',
    })
    expect(day.recommends.every(Number.isInteger)).toBe(true)
  })

  it('2023 闰二月内的日期标为闰月', () => {
    expect(dayPillarOf({ year: 2023, month: 4, day: 1 }).lunar).toEqual({
      year: 2023,
      month: 2,
      day: 11,
      isLeapMonth: true,
    })
  })

  it('民用日界：同一公历日不论几点都是同一日柱；排盘 23:30 已换到次日', () => {
    const day = dayPillarOf({ year: 2026, month: 11, day: 13 })
    const next = dayPillarOf({ year: 2026, month: 11, day: 14 })
    const chart = computeChart(
      {
        calendar: 'solar',
        year: 2026,
        month: 11,
        day: 13,
        time: { hour: 23, minute: 30 },
        gender: 'male',
        location: { city: 'beijing' },
      },
      { referenceYear: 2026 },
    )
    // 排盘按 23 点子初换日，流日不跟随
    expect(ganZhi(chart.pillars.day)).toBe(ganZhi(next))
    expect(ganZhi(day)).toBe('辛卯')
  })

  it('非法日期抛 BaziInputError', () => {
    expect(() => dayPillarOf({ year: 2026, month: 2, day: 29 })).toThrow(BaziInputError)
    expect(() => dayPillarOf({ year: 1899, month: 12, day: 31 })).toThrow(BaziInputError)
    expect(() => dayPillarOf({ year: 2026, month: 13, day: 1 })).toThrow(BaziInputError)
  })
})

const natal = (branches: [string, string, string, string | null], dayMaster = 'geng') =>
  ({
    dayMaster,
    pillars: {
      year: { branch: branches[0] },
      month: { branch: branches[1] },
      day: { branch: branches[2] },
      hour: branches[3] === null ? null : { branch: branches[3] },
    },
  }) as DailyNatal

describe('dailyRelations', () => {
  it('六害：子未、丑午、寅巳、卯辰、申亥、酉戌', () => {
    const pairs = ['zi-wei', 'chou-wu', 'yin-si', 'mao-chen', 'shen-hai', 'you-xu']
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        const key = `${BRANCHES[a]}-${BRANCHES[b]}`
        const reverse = `${BRANCHES[b]}-${BRANCHES[a]}`
        expect(isHarm(a, b), key).toBe(pairs.includes(key) || pairs.includes(reverse))
      }
    }
  })

  it('辰戌冲：本命日支辰、当日日支戌', () => {
    // 2026-11-08 为丙戌日
    const result = dailyRelations(natal(['wu', 'si', 'chen', 'si']), {
      year: 2026,
      month: 11,
      day: 8,
    })
    expect(result.day.branch).toBe('xu')
    expect(result.relations).toContainEqual({ natal: 'day', natalBranch: 'chen', kind: 'clash' })
  })

  it('子丑合', () => {
    expect(dailyBranchRelations(0, 1)).toEqual(['combine'])
  })

  it('寅巳申刑：寅巳同时为刑与害，寅申为冲与刑', () => {
    expect(dailyBranchRelations(2, 5)).toEqual(['punish', 'harm'])
    expect(dailyBranchRelations(2, 8)).toEqual(['clash', 'punish'])
    expect(dailyBranchRelations(5, 8)).toEqual(['combine', 'punish'])
  })

  it('子未害', () => {
    expect(dailyBranchRelations(0, 7)).toEqual(['harm'])
  })

  it('十神：庚日主遇丙日为七杀；日支本气十神', () => {
    // 2026-11-08 为丙戌日
    const day = dayPillarOf({ year: 2026, month: 11, day: 8 })
    expect(day.stem).toBe('bing')
    const result = dailyRelations(natal(['wu', 'si', 'chen', 'si']), day)
    expect(result.tenGod).toBe('qiSha')
    // 戌本气戊，对庚为偏印
    expect(result.branchTenGod).toBe('pianYin')
    expect(result.rulesVersion).toBe(DAILY_RULES_VERSION)
  })

  it('时辰未知时只比较年、月、日三支，不报错', () => {
    // 戌日：本命四支均为辰时会有四条冲；无时柱时只有三条
    const day = { year: 2026, month: 11, day: 8 }
    const full = dailyRelations(natal(['chen', 'chen', 'chen', 'chen']), day)
    const noHour = dailyRelations(natal(['chen', 'chen', 'chen', null]), day)
    expect(full.relations.filter((r) => r.kind === 'clash').map((r) => r.natal)).toEqual([
      'year',
      'month',
      'day',
      'hour',
    ])
    expect(noHour.relations.map((r) => r.natal)).toEqual(['year', 'month', 'day'])
  })

  it('可直接接受 computeChart 的命盘', () => {
    const chart = computeChart(
      {
        calendar: 'solar',
        year: 1990,
        month: 5,
        day: 15,
        time: null,
        gender: 'male',
        location: { city: 'taipei' },
      },
      { referenceYear: 2026 },
    )
    const result = dailyRelations(chart, { year: 2026, month: 11, day: 13 })
    expect(result.dayMaster).toBe(chart.dayMaster)
    expect(result.relations.every((r) => r.natal !== 'hour')).toBe(true)
  })
})
