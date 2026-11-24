import type { PointKey } from '@xuanxue/astro/chart'
import * as chartEngine from '@xuanxue/astro/chart'
import { isValidTimeZone, localToUtc, utcOffsetSeconds } from '@xuanxue/astro/places'
import { AppError } from '@xuanxue/shared'
import { z } from 'zod'
import { aspectName, houseOrdinal, pointName, signName } from '../west-content/natal-chart/copy.ts'
import {
  balance,
  computeNatal,
  formatDegree,
  MIN_YEAR,
  type NatalInput,
} from '../west-content/natal-chart/model.ts'

/**
 * 出生星盘完整解读（`natal-full`，content-growth-v2-tools 第 23 组、design 决策 19）的服务端复算：
 * 只收出生资料（日期、可选时间、出生地坐标与 IANA 时区、宫位制），按服务端的 Intl 时区数据换算 UTC 后
 * 用 `@xuanxue/astro/chart` 重新计算；浏览器算出的星盘一律不采用（协调者 2026-11-24：时刻换算以服务端为准）。
 * 进入提示词的结果只含星座、度数、宫位与相位等结论，并已写成英文标签，不含出生日期、地名或坐标。
 */

/** 引擎或复算口径变化时递增（报告保存 engineVersion） */
export const NATAL_ENGINE_VERSION = 'astro-chart@1'

const int = z.number().int()
const natalInputSchema = z
  .object({
    year: int.min(MIN_YEAR).max(9999),
    month: int.min(1).max(12),
    day: int.min(1).max(31),
    hour: int.min(0).max(23).optional(),
    minute: int.min(0).max(59).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timeZone: z.string().min(1).max(64),
    houseSystem: z.enum(['placidus', 'whole-sign']).default('placidus'),
  })
  .refine((value) => (value.hour === undefined) === (value.minute === undefined), {
    message: 'hour and minute go together',
  })

function invalid(field: string, code: string): never {
  throw new AppError('INVALID_READING_INPUT', 'Invalid reading input', {
    status: 400,
    details: { issues: [{ field, code }] },
  })
}

const round4 = (value: number) => Math.round(value * 10_000) / 10_000

const timeEngine = { localToUtc, utcOffsetSeconds }

/** 进入提示词的星盘（英文标签，模型照抄，不自行换算） */
export function natalReadingResult(input: NatalInput) {
  const result = computeNatal(input, chartEngine, timeEngine)
  const keys = chartEngine.POINT_KEYS
  if (result.kind === 'timed') {
    const { chart } = result
    const planetSigns = chartEngine.PLANET_KEYS.map((key) => chart.points[key].sign)
    const counts = balance(planetSigns)
    const houseCounts = new Map<number, string[]>()
    for (const key of chartEngine.PLANET_KEYS) {
      const house = chart.points[key].house
      houseCounts.set(house, [...(houseCounts.get(house) ?? []), pointName(key)])
    }
    return {
      birthTimeKnown: true,
      houseSystem: chart.houses.system === 'placidus' ? 'Placidus' : 'Whole sign',
      houseSystemNote: chart.houses.highLatitudeFallback
        ? 'Born above 66° latitude, so whole-sign houses are used instead of Placidus.'
        : null,
      bigThree: {
        sun: signName(chart.points.sun.sign),
        moon: signName(chart.points.moon.sign),
        rising: signName(chart.ascendant.sign),
      },
      angles: {
        ascendant: `${formatDegree(chart.ascendant.degree)} ${signName(chart.ascendant.sign)}`,
        midheaven: `${formatDegree(chart.midheaven.degree)} ${signName(chart.midheaven.sign)}`,
      },
      points: keys.map((key) => {
        const point = chart.points[key]
        return {
          point: pointName(key),
          sign: signName(point.sign),
          degree: formatDegree(point.degree),
          house: houseOrdinal(point.house),
          motion: motionOf(key, point.retrograde),
        }
      }),
      houseCusps: chart.houses.cusps.map((cusp, i) => {
        const position = chartEngine.zodiacPosition(cusp)
        return {
          house: houseOrdinal(i + 1),
          cusp: `${formatDegree(position.degree)} ${signName(position.sign)}`,
        }
      }),
      planetsByHouse: [...houseCounts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([house, planets]) => ({ house: houseOrdinal(house), planets })),
      aspects: chart.aspects.map(aspectRow),
      countsNote: null,
      elements: counts.elements.map(({ key, count }) => ({
        element: capital(key),
        planets: count,
      })),
      modalities: counts.modalities.map(({ key, count }) => ({
        modality: capital(key),
        planets: count,
      })),
    }
  }
  const moonChange = result.changes.moon
  const known = chartEngine.PLANET_KEYS.filter((key) => !(key === 'moon' && moonChange))
  const counts = balance(known.map((key) => result.positions[key].sign))
  return {
    birthTimeKnown: false,
    houseSystem: null,
    houseSystemNote:
      'No birth time: positions are for local noon; the rising sign, Midheaven and houses are unknown.',
    bigThree: {
      sun: signsText(result.changes.sun?.signs ?? [result.positions.sun.sign]),
      moon: signsText(moonChange?.signs ?? [result.positions.moon.sign]),
      rising: null,
    },
    angles: null,
    points: keys.map((key) => {
      const point = result.positions[key]
      const change = result.changes[key]
      return {
        point: pointName(key),
        sign: signsText(change?.signs ?? [point.sign]),
        degree: change ? 'depends on the birth time' : formatDegree(point.degree),
        house: null,
        motion: motionOf(key, point.retrograde),
      }
    }),
    houseCusps: null,
    planetsByHouse: null,
    aspects: result.aspects.map(aspectRow),
    countsNote: moonChange
      ? 'Element and modality counts cover nine planets: the Moon is left out because its sign depends on the birth time.'
      : null,
    elements: counts.elements.map(({ key, count }) => ({ element: capital(key), planets: count })),
    modalities: counts.modalities.map(({ key, count }) => ({
      modality: capital(key),
      planets: count,
    })),
  }
}

function motionOf(key: PointKey, retrograde: boolean) {
  if (key === 'meanNode') return 'mean node'
  return retrograde ? 'retrograde' : 'direct'
}

function aspectRow(aspect: chartEngine.ChartAspect) {
  return {
    between: `${pointName(aspect.a)} and ${pointName(aspect.b)}`,
    aspect: aspectName(aspect.aspect),
    orb: formatDegree(aspect.orb),
  }
}

const capital = (key: string) => key.charAt(0).toUpperCase() + key.slice(1)
const signsText = (signs: readonly chartEngine.SignKey[]) => signs.map(signName).join(' or ')

/** 校验出生资料并复算；日期须在 1900 年至请求时刻（出生地当地日期，留一天余量）之间 */
export function recomputeNatal(raw: unknown, now: Date) {
  const parsed = natalInputSchema.safeParse(raw)
  if (!parsed.success) invalid('input', 'schema')
  const data = parsed.data
  if (!isValidTimeZone(data.timeZone)) invalid('timeZone', 'unknown')
  const check = new Date(Date.UTC(data.year, data.month - 1, data.day))
  if (check.getUTCMonth() !== data.month - 1 || check.getUTCDate() !== data.day)
    invalid('birthDate', 'invalid')
  if (check.getTime() > now.getTime() + 86_400_000) invalid('birthDate', 'future')
  const input: NatalInput = {
    year: data.year,
    month: data.month,
    day: data.day,
    time: data.hour === undefined ? null : { hour: data.hour, minute: data.minute ?? 0 },
    place: {
      name: '',
      admin1: '',
      country: '',
      latitude: round4(data.latitude),
      longitude: round4(data.longitude),
      timeZone: data.timeZone,
    },
    houseSystem: data.houseSystem,
  }
  return {
    input: {
      year: input.year,
      month: input.month,
      day: input.day,
      ...(input.time ? { hour: input.time.hour, minute: input.time.minute } : {}),
      latitude: input.place.latitude,
      longitude: input.place.longitude,
      timeZone: input.place.timeZone,
      houseSystem: input.houseSystem,
    },
    engineVersion: NATAL_ENGINE_VERSION,
    result: natalReadingResult(input),
  }
}
