import { natalChart } from '@xuanxue/astro/chart'
import { AppError } from '@xuanxue/shared'
import { describe, expect, it } from 'vitest'
import { readingDefinition, readingEvalPassed, readingMessages } from './catalog.ts'
import { NATAL_ENGINE_VERSION, recomputeNatal } from './natal-chart.ts'
import { NATAL_READING_LOCALES, readingSite } from './release.ts'
import { READING_SAMPLES } from './samples.ts'

const NOW = new Date('2026-11-24T00:00:00Z')
const LISBON = { latitude: 38.7167, longitude: -9.1333, timeZone: 'Europe/Lisbon' }
const TIMED = { year: 1990, month: 5, day: 15, hour: 10, minute: 30, ...LISBON }

describe('natal-full 服务端复算', () => {
  it('按出生地历史时区换算后重算星盘，结果与引擎直接计算一致', () => {
    const { input, engineVersion, result } = recomputeNatal(TIMED, NOW)
    expect(engineVersion).toBe(NATAL_ENGINE_VERSION)
    expect(input).toEqual({ ...TIMED, houseSystem: 'placidus' })
    const direct = natalChart({ utcMs: Date.UTC(1990, 4, 15, 9, 30), ...LISBON })
    expect(result.birthTimeKnown).toBe(true)
    expect(result.bigThree).toEqual({ sun: 'Taurus', moon: 'Capricorn', rising: 'Cancer' })
    expect(result.points[0]).toEqual({
      point: 'Sun',
      sign: 'Taurus',
      degree: `${Math.floor(direct.points.sun.degree)}°${String(Math.floor((direct.points.sun.degree % 1) * 60)).padStart(2, '0')}′`,
      house: '11th',
      motion: 'direct',
    })
    expect(result.aspects).toHaveLength(direct.aspects.length)
    expect(result.aspects[0]?.between).toBe('Jupiter and Uranus')
  })

  it('提示词数据不含出生日期、坐标与时区', () => {
    const { result } = recomputeNatal(TIMED, NOW)
    const text = JSON.stringify(result)
    for (const secret of ['1990', '38.71', '9.13', 'Lisbon', 'Europe'])
      expect(text).not.toContain(secret)
  })

  it('客户端提交的计算结果不被采用（schema 丢弃未声明字段）', () => {
    const forged = { ...TIMED, chart: { bigThree: { sun: 'Leo' } }, result: 'x' }
    expect(recomputeNatal(forged, NOW).result.bigThree.sun).toBe('Taurus')
  })

  it('不知道出生时间：没有上升与宫位，当天跨座的月亮列出两个可能', () => {
    const { input, result } = recomputeNatal({ ...TIMED, hour: undefined, minute: undefined }, NOW)
    expect(input).not.toHaveProperty('hour')
    expect(result).toMatchObject({
      birthTimeKnown: false,
      angles: null,
      houseCusps: null,
      bigThree: { sun: 'Taurus', moon: 'Capricorn or Aquarius', rising: null },
    })
    expect(result.points.every((point) => point.house === null)).toBe(true)
    expect(JSON.stringify(result.aspects)).not.toContain('Moon')
  })

  it('纬度超过 66°：改用整宫制并写明', () => {
    const { result } = recomputeNatal(
      { ...TIMED, latitude: 69.6496, longitude: 18.957, timeZone: 'Europe/Oslo' },
      NOW,
    )
    expect(result.houseSystem).toBe('Whole sign')
    expect(result.houseSystemNote).toMatch(/66°/)
  })

  it('非法输入返回 INVALID_READING_INPUT', () => {
    for (const raw of [
      { ...TIMED, timeZone: 'Mars/Olympus' },
      { ...TIMED, month: 2, day: 30 },
      { ...TIMED, year: 2027 },
      { ...TIMED, year: 1899 },
      { ...TIMED, minute: undefined },
      { ...TIMED, latitude: 91 },
    ]) {
      expect(() => recomputeNatal(raw, NOW), JSON.stringify(raw)).toThrow(AppError)
    }
  })
})

describe('natal-full 注册与开放状态', () => {
  it('只有 en，属于西方站；评测通过前不开放（解锁卡显示即将开放）', () => {
    const definition = readingDefinition('natal-full', 'en')
    expect(definition?.locales).toEqual(['en'])
    expect(readingDefinition('natal-full', 'es')).toBeUndefined()
    expect(readingSite('natal-full', 'en')).toBe('west')
    expect(readingEvalPassed('natal-full', 'en')).toBe(false)
    expect(NATAL_READING_LOCALES).toEqual([])
    expect(definition?.prompt.version).toBe('natal-full.v1')
    expect(definition?.healthSection).toBeNull()
  })

  it('用户消息只有复算后的星盘 JSON；system 为固定前缀', () => {
    const definition = readingDefinition('natal-full', 'en')
    if (!definition) throw new Error('missing natal-full')
    const recomputed = definition.recompute(TIMED, NOW)
    const [system, user] = readingMessages(definition, recomputed)
    expect(system?.text).toBe(definition.prompt.system)
    const message = JSON.parse(user?.text ?? '{}')
    expect(message.kind).toBe('natal-full')
    expect(message.chart.bigThree.rising).toBe('Cancer')
  })

  it('样例段落的度数与宫位与引擎一致（虚构 1990-05-15 10:30 里斯本）', () => {
    const { result } = recomputeNatal(TIMED, NOW)
    const sun = result.points.find((point) => point.point === 'Sun')
    const moon = result.points.find((point) => point.point === 'Moon')
    expect(sun).toMatchObject({ sign: 'Taurus', house: '11th' })
    expect(sun?.degree.startsWith('24°')).toBe(true)
    expect(moon).toMatchObject({ sign: 'Capricorn', house: '7th' })
    expect(moon?.degree.startsWith('25°')).toBe(true)
    expect(result.angles?.ascendant.startsWith('22°')).toBe(true)
    expect(result.angles?.ascendant.endsWith('Cancer')).toBe(true)
    const pairs = result.aspects.map((aspect) => `${aspect.between}:${aspect.aspect}`)
    expect(pairs).toContain('Moon and Saturn:Conjunction (0°)')
    expect(pairs).toContain('Sun and Saturn:Trine (120°)')
    expect(pairs).toContain('Sun and Moon:Trine (120°)')
    const moonSaturn = result.aspects.find((aspect) => aspect.between === 'Moon and Saturn')
    expect(moonSaturn?.orb.startsWith('0°')).toBe(true)
    const sample = READING_SAMPLES['natal-full'].en
    for (const fact of [
      '24° Taurus in the 11th house',
      '25° Capricorn in the 7th',
      'Cancer rises at 22°',
    ])
      expect(sample).toContain(fact)
  })
})
