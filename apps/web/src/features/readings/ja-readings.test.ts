import { computeChart } from '@xuanxue/bazi'
import { log } from '@xuanxue/shared/log'
import { CARD_MEANINGS } from '@xuanxue/tarot'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HUB_SAMPLE_SECTIONS } from '../marketing/home-hub/sample.ts'
import {
  READING_EVAL_PENDING,
  readingDefinition,
  readingEvalPassed,
  resolveReadingDefinition,
} from './catalog.ts'
import { checkCompliance } from './compliance.ts'
import { followUpQuestions } from './follow-up-questions.ts'
import { japaneseChartExtras, twelveStage } from './ja-chart.ts'

// openspec add-locales-eu-ja tasks 4.8：日语详批的提示词登记、附加数据、合规规则与评测门槛开关

afterEach(() => vi.restoreAllMocks())

const NOW = new Date('2026-06-15T00:00:00Z')
const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'tokyo' },
} as const

describe('日语提示词登记', () => {
  it('四柱推命、紫微、塔罗都登记了 ja，八字 / 紫微为 v4 的 ja 语言，运行时选 v4 时不回退', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {})
    const bazi = readingDefinition('bazi-full', 'ja')
    expect(bazi?.prompt.version).toBe('bazi-full.v4')
    expect(bazi?.prompt.dataProfile).toBe('annual')
    expect(resolveReadingDefinition('bazi-full', 'ja', 'bazi-full.v4')?.prompt).toBe(bazi?.prompt)
    expect(resolveReadingDefinition('ziwei-full', 'ja', 'ziwei-full.v4')?.prompt.version).toBe(
      'ziwei-full.v4',
    )
    expect(readingDefinition('tarot-spread', 'ja')?.prompt.version).toBe('tarot-spread.v3')
    expect(warn).not.toHaveBeenCalled()
    // 繁中 / 简中 v4 原样保留（已发布版本不可改）
    expect(
      readingDefinition('bazi-full', 'zh-Hant', { promptVersion: 'bazi-full.v4' })?.prompt.sections,
    ).toContain('流年逐年')
  })

  it('八字 ja 的章节与首页样例一致；健康章节带日语就医提示', () => {
    const bazi = readingDefinition('bazi-full', 'ja')
    expect(bazi?.prompt.sections).toEqual(HUB_SAMPLE_SECTIONS.ja)
    expect(bazi?.healthSection?.title).toBe('健康と生活習慣')
    expect(bazi?.prompt.system).toContain(bazi?.healthSection?.notice)
    const ziwei = readingDefinition('ziwei-full', 'ja')
    expect(ziwei?.prompt.sections).toContain('大限と年運')
    expect(ziwei?.prompt.system).toContain(ziwei?.healthSection?.notice)
  })

  it('提示词使用日本四柱推命与塔罗用语，输出固定为です・ます', () => {
    const bazi = readingDefinition('bazi-full', 'ja')?.prompt.system ?? ''
    for (const term of ['命式', '通変星', '蔵干', '十二運星', '天中殺', '身強', '身弱', '大運'])
      expect(bazi).toContain(term)
    const ziwei = readingDefinition('ziwei-full', 'ja')?.prompt.system ?? ''
    for (const term of ['命盤', '命宮', '身宮', '四化', '化権']) expect(ziwei).toContain(term)
    const tarot = readingDefinition('tarot-spread', 'ja')?.prompt.system ?? ''
    for (const term of ['正位置', '逆位置', 'ワンド', 'カップ', 'ソード', 'ペンタクル'])
      expect(tarot).toContain(term)
    for (const system of [bazi, ziwei, tarot]) expect(system).toContain('です・ます')
  })

  it('合规声明含术语表要求的日语表述，且通过合规检查', () => {
    for (const kind of ['bazi-full', 'ziwei-full', 'tarot-spread']) {
      const disclaimer = readingDefinition(kind, 'ja')?.disclaimer ?? ''
      expect(disclaimer).toContain('参考情報です')
      expect(disclaimer).toContain('未来を予言するものではありません')
      expect(checkCompliance(disclaimer, 'ja').violations).toEqual([])
    }
  })
})

describe('评测门槛开关', () => {
  it('日语三个组合未通过评测，其他已开放组合不受影响', () => {
    expect([...READING_EVAL_PENDING].sort()).toEqual([
      'bazi-full.ja',
      'tarot-spread.ja',
      'ziwei-full.ja',
    ])
    expect(readingEvalPassed('bazi-full', 'ja')).toBe(false)
    expect(readingEvalPassed('tarot-spread', 'ja')).toBe(false)
    expect(readingEvalPassed('bazi-full', 'zh-Hant')).toBe(true)
    expect(readingEvalPassed('tarot-spread', 'en')).toBe(true)
  })

  it('待评测的组合仍可取定义（评测与已有报告收尾用）', () => {
    for (const entry of READING_EVAL_PENDING) {
      const [kind = '', locale = ''] = entry.split('.')
      expect(readingDefinition(kind, locale)).toBeDefined()
    }
  })
})

describe('十二運星与天中殺', () => {
  it('阳干顺行、阴干逆行（戊同丙、己同丁）', () => {
    expect(twelveStage('geng', 'si')).toBe('changSheng')
    expect(twelveStage('geng', 'chen')).toBe('yang')
    expect(twelveStage('geng', 'you')).toBe('diWang')
    expect(twelveStage('yi', 'wu')).toBe('changSheng')
    expect(twelveStage('yi', 'si')).toBe('muYu')
    expect(twelveStage('jia', 'mao')).toBe('diWang')
    expect(twelveStage('gui', 'zi')).toBe('jianLu')
    expect(twelveStage('wu', 'yin')).toBe('changSheng')
    expect(twelveStage('ji', 'you')).toBe('changSheng')
  })

  it('ja 复算附加十二運星与天中殺，版本加 jp 后缀；其他语言不变', () => {
    const ja = readingDefinition('bazi-full', 'ja')?.recompute(BIRTH, NOW)
    const hant = readingDefinition('bazi-full', 'zh-Hant', {
      promptVersion: 'bazi-full.v4',
    })?.recompute(BIRTH, NOW)
    expect(ja?.engineVersion).toMatch(/\+annual\.2\+jp\.1$/)
    expect(hant?.engineVersion).toMatch(/\+annual\.2$/)
    expect(hant?.result).not.toHaveProperty('twelveStages')
    const { twelveStages: _a, decadeTwelveStages: _b, tenchusatsu: _c, ...rest } = ja?.result ?? {}
    expect(rest).toEqual(hant?.result)
    // 示例命盘：庚辰日、巳月 → 月柱长生、日柱养
    expect(ja?.result.twelveStages).toMatchObject({ month: 'changSheng', day: 'yang' })
  })

  it('天中殺取日柱旬空，列出命中的柱与窗口内的年份', () => {
    const chart = computeChart(BIRTH, { referenceYear: 2026 })
    const extras = japaneseChartExtras(chart, [
      { year: 2026, branch: 'wu' },
      { year: 2030, branch: 'xu' },
      { year: 2031, branch: 'hai' },
    ])
    const expected = chart.shensha.find((s) => s.key === 'kongWang' && s.basis === 'dayPillar')
    expect(extras.tenchusatsu.branches).toEqual(expected?.targets)
    expect(extras.tenchusatsu.branches).toHaveLength(2)
    // 庚辰日属甲戌旬，旬空申酉
    expect(extras.tenchusatsu.branches).toEqual(['shen', 'you'])
    expect(extras.tenchusatsu.years).toEqual([])
    expect(extras.decadeTwelveStages).toHaveLength(chart.fortune.decades.length)
  })
})

describe('日语塔罗复算', () => {
  it('牌名与牌位取自塔罗包的 ja 数据', () => {
    const result = readingDefinition('tarot-spread', 'ja')?.recompute(
      { reading: 'three-card:major-09,pentacles-08,wands-01r', question: '転職を考えています' },
      NOW,
    ).result as { cards: { card: string; reversed: boolean; position: string }[] }
    expect(result.cards.map((c) => c.card)).toEqual([
      CARD_MEANINGS.ja['major-09']?.name,
      CARD_MEANINGS.ja['pentacles-08']?.name,
      CARD_MEANINGS.ja['wands-01']?.name,
    ])
    expect(result.cards[2]?.reversed).toBe(true)
    expect(result.cards[0]?.position).toMatch(/[ぁ-んァ-ヶ一-龠]/)
  })
})

describe('日语合规规则', () => {
  it('具体月日 + 断定、病名、投资标的整段替换', () => {
    const text = [
      '2027年3月15日に必ず転機が訪れます。',
      '胃癌に注意が必要です。',
      '投資信託を始めるとよいでしょう。',
      'がんばりすぎず、株式会社での仕事も前半はペースを守りましょう。',
    ].join('\n\n')
    const { violations, content } = checkCompliance(text, 'ja')
    expect(violations.map((v) => v.rule)).toEqual(['date-prediction', 'medical', 'investment'])
    expect(content).toContain('気になる症状があれば医療機関にご相談ください。')
    expect(content).toContain('がんばりすぎず')
  })

  it('年份区间与季节表述不算日期预言', () => {
    expect(
      checkCompliance('2026年から2035年の大運では、春は新しいことを始めやすいでしょう。', 'ja')
        .violations,
    ).toEqual([])
  })

  it('开场推荐问题有日语，且通过合规检查', () => {
    for (const kind of ['bazi-full', 'ziwei-full', 'tarot-spread', 'numerology-full']) {
      const questions = followUpQuestions(kind, 'ja')
      expect(questions.join('')).toMatch(/[ぁ-ん]/)
      for (const q of questions) expect(checkCompliance(q, 'ja').violations).toEqual([])
    }
  })
})
