import { describe, expect, it } from 'vitest'
import {
  deliveredReadingText,
  fixYears,
  type GuardYear,
  guardApplies,
  guardReading,
  readingGuardYears,
  toSimplified,
  yearGanzhi,
} from './guard.ts'
import { HANS_PAIRS } from './hans-chars.ts'
import { HANT_PAIRS } from './hant-chars.ts'

// readings-prompt-v4-yearly tasks 4.3：v4 生成后兜底（rev2 评测的两处硬性失败与易错写法）

const pairs = (table: string) =>
  Array.from({ length: table.length / 2 }, (_, i) => [table.charAt(2 * i), table.charAt(2 * i + 1)])

const ganzhiYears = (start: number, count = 5): GuardYear[] =>
  Array.from({ length: count }, (_, i) => ({ year: start + i, ganzhi: yearGanzhi(start + i) }))

const V4 = { promptVersion: 'ziwei-full.v4', years: ganzhiYears(2026) }

describe('简中繁体字兜底', () => {
  it('常用仅繁体字换成简体，包括 rev2 失败样本中的「變」', () => {
    const { text, count } = toSimplified('變化與為運會時歲財歷關後發餘')
    expect(text).toBe('变化与为运会时岁财历关后发余')
    expect(count).toBe(13)
  })

  it('只对 zh-Hans 生效；zh-Hant、ko、en 原样保留', () => {
    const source = '大限變化與財運'
    expect(guardReading(source, { ...V4, locale: 'zh-Hans' }).text).toBe('大限变化与财运')
    for (const locale of ['zh-Hant', 'ko', 'en'])
      expect(guardReading(source, { ...V4, locale }).text).toBe(source)
  })

  it('对照表只收无歧义的字：繁体一侧都不是合法简体字，转换后再查不出繁体', () => {
    const simplified = new Set(pairs(HANT_PAIRS).map(([s]) => s))
    const traditional = new Set(pairs(HANT_PAIRS).map(([, t]) => t))
    const table = pairs(HANS_PAIRS)
    expect(new Set(table.map(([t]) => t)).size).toBe(table.length)
    for (const [t, s] of table) {
      expect(simplified.has(t as string), t).toBe(false)
      expect(t).not.toBe(s)
    }
    // 与评测字形检查（hant-chars 繁体集合）一致：转换结果不含任何被判为繁体的字
    const converted = toSimplified(table.map(([t]) => t).join('')).text
    expect([...converted].filter((char) => traditional.has(char))).toEqual([])
    // 不收繁简同形或一繁多简的字
    for (const char of '著乾藉鍊') expect(table.some(([t]) => t === char)).toBe(false)
  })
})

describe('年份干支兜底', () => {
  it('流年干支按六十甲子推算（与引擎数据的逐样本对照见 eval-readings.test.ts）', () => {
    expect(yearGanzhi(1984)).toEqual({ hanzi: '甲子', hangul: '갑자' })
    expect(yearGanzhi(2043)).toEqual({ hanzi: '癸亥', hangul: '계해' })
    expect(yearGanzhi(2027)).toEqual({ hanzi: '丁未', hangul: '정미' })
    expect(yearGanzhi(1900).hanzi).toBe('庚子')
  })

  it('标题干支写错时按数据改正（rev2 ziwei-hant-01：2027 丁未写成丁酉）', () => {
    const result = guardReading('### 2026 丙午\n\n內容\n\n### 2027 丁酉\n\n內容', {
      ...V4,
      locale: 'zh-Hant',
    })
    expect(result.text).toBe('### 2026 丙午\n\n內容\n\n### 2027 丁未\n\n內容')
    expect(result.report).toMatchObject({ ganzhi: 1, unresolved: 0 })
  })

  it('韩文标题：韩文干支与括号内汉字分别改正（rev2 saju-ko 中出现过「2030 경진(庚戌)」）', () => {
    const result = guardReading('### 2030 경진(庚戌)\n### 2027 정유(丁酉)', {
      ...V4,
      locale: 'ko',
    })
    expect(result.text).toBe('### 2030 경술(庚戌)\n### 2027 정미(丁未)')
    expect(result.report.ganzhi).toBe(3)
  })

  it('标题只有年份时补上干支；有其他文字但没有干支时不猜，计为 unresolved', () => {
    expect(fixYears('### 2027', V4.years, 'zh-Hans').text).toBe('### 2027 丁未')
    expect(fixYears('### 2027 년', V4.years, 'ko').text).toBe('### 2027 정미(丁未)')
    const unclear = fixYears('### 2027：稳中求进', V4.years, 'zh-Hans')
    expect(unclear.text).toBe('### 2027：稳中求进')
    expect(unclear.unresolved).toBe(1)
  })

  it('标题有两个不同干支且都不对时不改，计为 unresolved；含正确干支时不动', () => {
    const ambiguous = fixYears('### 2027 丁酉 / 己酉', V4.years, 'zh-Hans')
    expect(ambiguous.text).toBe('### 2027 丁酉 / 己酉')
    expect(ambiguous.unresolved).toBe(1)
    const fine = fixYears('### 2027 丁未（庚申大运）', V4.years, 'zh-Hans')
    expect(fine.text).toBe('### 2027 丁未（庚申大运）')
    expect(fine.ganzhi + fine.unresolved).toBe(0)
  })

  it('大运 / 大限、区间与窗口外年份不改', () => {
    const text = [
      '### 2027 庚申大運',
      '### 2021–2030 庚申',
      '### 2035 丁酉',
      '2027年庚申大运开始，2029년 계축(癸丑) 대운',
      '大运（2021–2030）庚申，1990年（己巳）出生',
    ].join('\n')
    const result = fixYears(text, V4.years, 'ko')
    expect(result.text).toBe(text)
    expect(result.ganzhi + result.unresolved).toBe(0)
  })

  it('正文中紧跟年份的干支改正，常见写法都覆盖', () => {
    const text = '2027年（丁酉）宜守，2028 年己酉要稳，丁酉年（2027）收尾。'
    const result = fixYears(text, V4.years, 'zh-Hans')
    expect(result.text).toBe('2027年（丁未）宜守，2028 年戊申要稳，丁未年（2027）收尾。')
    expect(result.ganzhi).toBe(3)
  })

  it('韩文正文：干支后接「년」或括号时改正，普通词（갑자기、임신）不动', () => {
    const result = fixYears(
      '2027년 정유년에는, 2028년(무오년), 2029년 기사(己巳)는. 2027년 갑자기 2028년 임신 계획',
      V4.years,
      'ko',
    )
    expect(result.text).toBe(
      '2027년 정미년에는, 2028년(무신년), 2029년 기유(己酉)는. 2027년 갑자기 2028년 임신 계획',
    )
    expect(result.ganzhi).toBe(4)
  })

  it('数字命理：标题与正文的个人年数按数据改正', () => {
    const years = [
      { year: 2026, personalYear: 7 },
      { year: 2027, personalYear: 8 },
    ]
    const result = guardReading(
      '### 2026 · Personal Year 7\n### 2027 · Personal Year 6\n\n2027 (Personal Year 6) rewards focus.',
      { locale: 'en', promptVersion: 'numerology-full.v4', years },
    )
    expect(result.text).toBe(
      '### 2026 · Personal Year 7\n### 2027 · Personal Year 8\n\n2027 (Personal Year 8) rewards focus.',
    )
    expect(result.report.personalYear).toBe(2)
  })

  it('线上期望年份：干支详批按公历年推算，数字命理按出生日期算个人年；输入不完整时为空', () => {
    expect(readingGuardYears('ziwei-full', 2026, {}).map((y) => y.ganzhi?.hanzi)).toEqual([
      '丙午',
      '丁未',
      '戊申',
      '己酉',
      '庚戌',
    ])
    const numerology = readingGuardYears('numerology-full', 2026, { year: 1990, month: 5, day: 17 })
    expect(numerology).toHaveLength(5)
    expect(numerology.every((y) => typeof y.personalYear === 'number')).toBe(true)
    expect(readingGuardYears('numerology-full', 2026, { month: 5 })).toEqual([])
    expect(readingGuardYears('tarot-spread', 2026, {})).toEqual([])
  })
})

describe('适用范围', () => {
  it('只对 v4 起的提示词生效，v1–v3 原样返回', () => {
    expect(guardApplies('ziwei-full.v4')).toBe(true)
    expect(guardApplies('bazi-full.v3')).toBe(false)
    expect(guardApplies('')).toBe(false)
    const source = '### 2027 丁酉\n\n變化'
    const old = guardReading(source, {
      locale: 'zh-Hans',
      promptVersion: 'ziwei-full.v3',
      years: V4.years,
    })
    expect(old.text).toBe(source)
    expect(old.report).toEqual({ glyphs: 0, ganzhi: 0, personalYear: 0, unresolved: 0 })
  })

  it('可重复调用：已修正的正文再次兜底不变', () => {
    const source = '## 大限与流年\n\n### 2027 丁酉\n\n2027年（丁酉）變化'
    const once = deliveredReadingText(source, { ...V4, locale: 'zh-Hans' })
    expect(once.text).toBe('## 大限与流年\n\n### 2027 丁未\n\n2027年（丁未）变化')
    const twice = deliveredReadingText(once.text, { ...V4, locale: 'zh-Hans' })
    expect(twice.text).toBe(once.text)
    expect(twice.report).toEqual({ glyphs: 0, ganzhi: 0, personalYear: 0, unresolved: 0 })
  })

  it('繁中先补字形（所有版本原有行为）再兜底', () => {
    const result = deliveredReadingText('### 2027 丁酉\n\n财运', { ...V4, locale: 'zh-Hant' })
    expect(result.text).toBe('### 2027 丁未\n\n財運')
  })
})
