import { computeChart, computeCompatibility } from '@xuanxue/bazi'
import { computeZiwei } from '@xuanxue/bazi/ziwei'
import { describe, expect, it } from 'vitest'
import {
  chartSummary,
  ensureHealthNotice,
  missingSections,
  readingDefinition,
  readingInputHash,
  readingMessages,
  withDisclaimer,
  ziweiSummary,
} from './catalog.ts'

// tasks.md 2.1：服务端复算忽略篡改的命盘、章节齐全检查、提示词结构。
const NOW = new Date('2026-10-19T00:00:00Z')
const INPUT = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 17,
  time: { hour: 8, minute: 30 },
  gender: 'female',
  location: { city: 'taipei' },
} as const

const bazi = () => {
  const definition = readingDefinition('bazi-full')
  if (!definition) throw new Error('bazi-full missing')
  return definition
}

describe('详批注册表', () => {
  it('每种详批的报告语言；未知类型或不支持的语言返回 undefined', () => {
    expect(readingDefinition('bazi-full')?.locales).toEqual(['zh-Hant', 'zh-Hans'])
    expect(readingDefinition('saju-full')?.locales).toEqual(['ko'])
    expect(readingDefinition('ziwei-full')?.locales).toEqual(['zh-Hant', 'zh-Hans'])
    expect(readingDefinition('saju-compat')?.locales).toEqual(['ko'])
    expect(readingDefinition('numerology-full')?.locales).toEqual(['en'])
    expect(readingDefinition('tarot-spread')?.locales).toEqual(['en', 'zh-Hant', 'zh-Hans', 'ko'])
    expect(readingDefinition('bazi-full', 'zh-Hans')?.prompt.version).toBe('bazi-full.v3')
    expect(readingDefinition('tarot-spread', 'zh-Hans')?.prompt.version).toBe('tarot-spread.v3')
    expect(readingDefinition('tarot-spread', 'ko')?.prompt.sections[0]).toBe('전체 흐름')
    expect(readingDefinition('bazi-full', 'ko')).toBeUndefined()
    expect(readingDefinition('__proto__')).toBeUndefined()
  })

  it('篡改的命盘被忽略：提示词只含服务端按原始输入复算的结果', () => {
    const tampered = {
      ...INPUT,
      chart: { dayMaster: 'gui', pillars: { day: { stem: 'gui', branch: 'hai' } } },
      dayMaster: 'gui',
    }
    const recomputed = bazi().recompute(tampered, NOW)
    expect(recomputed.input).not.toHaveProperty('chart')
    expect(recomputed.input).not.toHaveProperty('dayMaster')
    const expected = chartSummary(computeChart(INPUT, { referenceYear: 2026 }))
    expect(recomputed.result).toEqual(expected)
    expect(expected.dayMaster).not.toBe('gui')
    const [system, user] = readingMessages(bazi(), recomputed)
    expect(JSON.parse(user?.text ?? '')).toEqual({ kind: 'bazi-full', chart: expected })
    // 用户内容不进入固定前缀，前缀带 prompt caching 标记
    expect(system?.role).toBe('system')
    expect(system?.text).toBe(bazi().prompt.system)
    expect(system?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  it('提示词不携带出生日期等原始输入', () => {
    const [, user] = readingMessages(bazi(), bazi().recompute(INPUT, NOW))
    expect(user?.text).not.toContain('1990')
    expect(user?.text).not.toContain('taipei')
  })

  it('非法输入返回 400，引擎的字段级问题放在 details', () => {
    expect(() => bazi().recompute({ ...INPUT, month: 'May' }, NOW)).toThrow(
      expect.objectContaining({ code: 'INVALID_READING_INPUT', status: 400 }),
    )
    expect(() => bazi().recompute({ ...INPUT, month: 2, day: 30 }, NOW)).toThrow(
      expect.objectContaining({
        status: 400,
        details: { issues: [{ field: 'day', code: 'invalid_date' }] },
      }),
    )
  })

  it('输入哈希与字段顺序无关，输入不同则不同', async () => {
    const a = await readingInputHash({ year: 1990, month: 5, location: { city: 'taipei' } })
    const b = await readingInputHash({ location: { city: 'taipei' }, month: 5, year: 1990 })
    const c = await readingInputHash({ year: 1990, month: 6, location: { city: 'taipei' } })
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(b)
    expect(c).not.toBe(a)
  })
})

describe('章节检查', () => {
  const full = bazi()
    .prompt.sections.map((title, i) => `## ${i === 0 ? `一、${title}` : title}\n\n內容 ${i}`)
    .join('\n\n')

  it('章节齐全时没有缺失，标题允许带编号前缀', () => {
    expect(missingSections(full, bazi().prompt.sections)).toEqual([])
  })

  it('列出缺失的章节，正文里出现章节名不算', () => {
    const partial = full.replace('## 財運', '財運').replace(/## 建議[\s\S]*$/, '')
    expect(missingSections(partial, bazi().prompt.sections)).toEqual(['財運', '建議'])
  })

  it('健康章节缺少就医提示时补在该章末尾，已有时不重复', () => {
    const patched = ensureHealthNotice(full, bazi())
    const health = patched.split('## 健康作息提示')[1]?.split('## ')[0] ?? ''
    expect(health).toContain('如有不適請諮詢專業醫師。')
    expect(ensureHealthNotice(patched, bazi())).toBe(patched)
  })

  it('保存的正文开头与结尾都有合规声明', () => {
    const saved = withDisclaimer(full, bazi())
    const note = `> ${bazi().disclaimer}`
    expect(saved.startsWith(note)).toBe(true)
    expect(saved.trimEnd().endsWith(note)).toBe(true)
  })
})

describe('其余详批的服务端复算（tasks.md 2.4）', () => {
  const kind = (name: string, locale?: string) => {
    const definition = readingDefinition(name, locale)
    if (!definition) throw new Error(`${name} missing`)
    return definition
  }

  it('紫微：按原始输入排盘，缺少时辰视为非法输入', () => {
    const recomputed = kind('ziwei-full').recompute({ ...INPUT, chart: { palaces: [] } }, NOW)
    const chart = computeZiwei(INPUT)
    if (chart.status !== 'ok') throw new Error('expected ok')
    expect(recomputed.result).toEqual(ziweiSummary(chart))
    expect(recomputed.input).not.toHaveProperty('chart')
    expect(JSON.stringify(recomputed.result)).not.toContain('1990')
    expect(() => kind('ziwei-full').recompute({ ...INPUT, time: null }, NOW)).toThrow(
      expect.objectContaining({ code: 'INVALID_READING_INPUT' }),
    )
  })

  it('궁합：两人分别复算并计分，客户端提交的分数被忽略', () => {
    const b = { ...INPUT, year: 1988, month: 2, day: 3, gender: 'male' } as const
    const recomputed = kind('saju-compat').recompute({ a: INPUT, b, score: 100 }, NOW)
    const expected = computeCompatibility(INPUT, b, { referenceYear: 2026 })
    expect(recomputed.result).toMatchObject({
      a: chartSummary(expected.charts[0]),
      b: chartSummary(expected.charts[1]),
      compatibility: { score: expected.score, base: expected.base },
    })
    expect(recomputed.input).toEqual({ a: INPUT, b })
    expect(() => kind('saju-compat').recompute({ a: INPUT }, NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    )
  })

  it('数字命理：只把数字交给模型，姓名不进入提示词', () => {
    const recomputed = kind('numerology-full').recompute(
      { year: 1987, month: 11, day: 29, name: 'Ada Lovelace', lifePath: 1 },
      NOW,
    )
    expect(recomputed.result).toMatchObject({
      lifePath: { value: 11, master: true },
      currentYear: 2026,
      name: { expression: expect.objectContaining({ value: expect.any(Number) }) },
    })
    const [, user] = readingMessages(kind('numerology-full'), recomputed)
    expect(user?.text).not.toContain('Ada')
    expect(user?.text).not.toContain('1987')
    expect(() => kind('numerology-full').recompute({ year: 2026, month: 2, day: 30 }, NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    )
  })

  it('塔罗：按牌 id 在服务端查本语言牌义，单张牌阵与非法牌组拒绝', () => {
    const tarot = kind('tarot-spread', 'zh-Hant')
    const recomputed = tarot.recompute(
      { reading: 'three-card:major-00,major-01r,major-02', question: ' 工作？ ', cards: [] },
      NOW,
    )
    expect(recomputed.input).toEqual({
      reading: 'three-card:major-00,major-01r,major-02',
      question: '工作？',
    })
    const result = recomputed.result as { cards: { position: string; reversed: boolean }[] }
    expect(result.cards.map((card) => [card.position, card.reversed])).toEqual([
      ['過去', false],
      ['現在', true],
      ['未來', false],
    ])
    expect(() => tarot.recompute({ reading: 'daily:major-00' }, NOW)).toThrow(
      expect.objectContaining({ status: 400 }),
    )
    expect(() =>
      tarot.recompute({ reading: 'three-card:major-00,major-00,major-02' }, NOW),
    ).toThrow(expect.objectContaining({ status: 400 }))
  })

  it('没有健康章节的详批不补就医提示', () => {
    const text = '## 총평\n\n내용'
    expect(ensureHealthNotice(text, kind('saju-compat'))).toBe(text)
  })
})
