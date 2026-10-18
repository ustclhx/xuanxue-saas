import { computeChart } from '@xuanxue/bazi'
import { describe, expect, it } from 'vitest'
import {
  chartSummary,
  ensureHealthNotice,
  missingSections,
  readingDefinition,
  readingInputHash,
  readingMessages,
  withDisclaimer,
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
  it('只暴露已实现的类型，未知或未实现的类型返回 undefined', () => {
    expect(readingDefinition('bazi-full')?.locales).toEqual(['zh-Hant'])
    expect(readingDefinition('saju-full')?.locales).toEqual(['ko'])
    expect(readingDefinition('tarot-spread')).toBeUndefined()
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
