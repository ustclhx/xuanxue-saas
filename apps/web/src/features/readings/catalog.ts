import {
  type BaziChart,
  BaziInputError,
  type BirthInput,
  computeChart,
  computeCompatibility,
  ENGINE_VERSION,
} from '@xuanxue/bazi'
import { computeZiwei, type ZiweiChart } from '@xuanxue/bazi/ziwei'
import type { ReadingKind } from '@xuanxue/db'
import { numerologyChart } from '@xuanxue/numerology'
import { AppError } from '@xuanxue/shared'
import { CARD_MEANINGS, CARDS, decodeReading, spreadPositions } from '@xuanxue/tarot'
import { z } from 'zod'
import { BAZI_FULL_V2 } from './prompts/bazi-full.v2.ts'
import { BAZI_FULL_V3 } from './prompts/bazi-full.v3.ts'
import { NUMEROLOGY_FULL_V2 } from './prompts/numerology-full.v2.ts'
import { SAJU_COMPAT_V2 } from './prompts/saju-compat.v2.ts'
import { SAJU_FULL_V2 } from './prompts/saju-full.v2.ts'
import { TAROT_SPREAD_V2 } from './prompts/tarot-spread.v2.ts'
import { TAROT_SPREAD_V3 } from './prompts/tarot-spread.v3.ts'
import { ZIWEI_FULL_V2 } from './prompts/ziwei-full.v2.ts'
import { ZIWEI_FULL_V3 } from './prompts/ziwei-full.v3.ts'

/**
 * 详批注册表（add-reading-monetization design 决策 1）：每种详批的输入校验、服务端复算、
 * 章节、提示词版本与报告语言。客户端只提交原始输入，计算结果一律在服务端重算（specs/paid-readings
 * 「服务端复算」）；输入 schema 丢弃未声明的字段，请求中携带的命盘不会进入提示词。
 * 积分价格、开关与模型是运行时设置 `readings.<kind>.*`，不在这里。
 */

export interface ReadingPrompt {
  readonly version: string
  /** 固定 system 前缀：角色、合规、章节与语言，不含任何用户内容 */
  readonly system: string
  /** 报告必须包含的 `## ` 章节，顺序即输出顺序 */
  readonly sections: readonly string[]
}

export interface RecomputedReading {
  /** 规范化后的原始输入，存入 `reading.input` 并参与幂等哈希 */
  readonly input: Record<string, unknown>
  readonly engineVersion: string
  /** 进入用户消息的结构化结果 */
  readonly result: Record<string, unknown>
}

/** 某种详批在一种语言下的提示词与固定文案 */
export interface ReadingVariant {
  readonly prompt: ReadingPrompt
  /** 报告开头与结尾的固定合规声明（本语言） */
  readonly disclaimer: string
  /** 健康章节必须出现的就医提示，缺失时生成后补上；没有健康章节的详批为 null */
  readonly healthSection: { readonly title: string; readonly notice: string } | null
}

export interface ReadingDefinition extends ReadingVariant {
  readonly kind: ReadingKind
  /** 报告语言即站点语言；其他语言的请求拒绝 */
  readonly locales: readonly string[]
  recompute(raw: unknown, now: Date): RecomputedReading
}

interface ReadingEntry {
  readonly kind: ReadingKind
  /** 第一个语言为默认 */
  readonly variants: Readonly<Record<string, ReadingVariant>>
  /** 塔罗按报告语言查牌义，其余详批的复算与语言无关 */
  recompute(raw: unknown, now: Date, locale: string): RecomputedReading
}

const int = z.number().int()

/** `@xuanxue/bazi` 的 BirthInput；语义校验（日期存在、闰月、经度）仍由引擎完成。 */
const birthInputSchema = z.object({
  calendar: z.enum(['solar', 'lunar']),
  year: int,
  month: int,
  day: int,
  isLeapMonth: z.boolean().optional(),
  time: z.object({ hour: int, minute: int }).nullable(),
  gender: z.enum(['male', 'female']),
  location: z.union([
    z.object({ city: z.string().max(64) }),
    z.object({ utcOffsetMinutes: int, longitude: z.number().optional() }),
  ]),
  trueSolarTime: z.boolean().optional(),
})

function invalidInput(issues?: unknown): never {
  throw new AppError('INVALID_READING_INPUT', 'Invalid reading input', {
    status: 400,
    ...(issues === undefined ? {} : { details: { issues } }),
  })
}

/**
 * 进入提示词的命盘摘要：只含排盘结论，不含出生日期、城市等原始输入，
 * 减少发给模型服务商的个人信息。
 */
export function chartSummary(chart: BaziChart) {
  const pillar = (p: BaziChart['pillars']['year'] | null) =>
    p && {
      stem: p.stem,
      branch: p.branch,
      tenGod: p.tenGod,
      hiddenStems: p.hiddenStems.map((h) => ({ stem: h.stem, qi: h.qi, tenGod: h.tenGod })),
    }
  return {
    engineVersion: chart.engineVersion,
    gender: chart.input.gender,
    hourKnown: chart.hourKnown,
    pillars: {
      year: pillar(chart.pillars.year),
      month: pillar(chart.pillars.month),
      day: pillar(chart.pillars.day),
      hour: pillar(chart.pillars.hour),
    },
    dayMaster: chart.dayMaster,
    strength: {
      verdict: chart.strength.verdict,
      supportPercent: chart.strength.supportPercent,
      elements: chart.strength.elements.map((e) => ({
        element: e.element,
        count: e.count,
        percent: e.percent,
      })),
    },
    useful: { favorable: chart.useful.favorable, unfavorable: chart.useful.unfavorable },
    fortune: {
      forward: chart.fortune.forward,
      approximate: chart.fortune.approximate,
      decades: chart.fortune.decades.map((d) => ({
        index: d.index,
        stem: d.stem,
        branch: d.branch,
        tenGod: d.tenGod,
        startYear: d.startYear,
        endYear: d.endYear,
        startAge: d.startAge,
      })),
    },
    currentYear: chart.currentYear,
    shensha: chart.shensha.map((s) => s.key),
  }
}

/** 紫微命盘摘要：宫位、主星、四化与五行局，不含出生日期与排盘用时间 */
export function ziweiSummary(chart: Extract<ZiweiChart, { status: 'ok' }>) {
  return {
    engineVersion: chart.engineVersion,
    fiveElementsClass: chart.fiveElementsClass,
    soulPalaceBranch: chart.soulPalaceBranch,
    bodyPalaceBranch: chart.bodyPalaceBranch,
    palaces: chart.palaces,
    mutagens: chart.mutagens,
  }
}

function parseBirth(raw: unknown): BirthInput {
  const parsed = birthInputSchema.safeParse(raw)
  if (!parsed.success) invalidInput()
  return parsed.data as BirthInput
}

/** 引擎的输入错误转为 400；其他异常照常抛出 */
function engine<T>(compute: () => T): T {
  try {
    return compute()
  } catch (error) {
    if (error instanceof BaziInputError) invalidInput(error.issues)
    throw error
  }
}

/** 八字与사주共用排盘；参考年取请求时的 UTC 年份，与免费结果页的「当前流年」一致。 */
function recomputeChart(raw: unknown, now: Date): RecomputedReading {
  const input = parseBirth(raw)
  const chart = engine(() => computeChart(input, { referenceYear: now.getUTCFullYear() }))
  return { input, engineVersion: ENGINE_VERSION, result: chartSummary(chart) }
}

/** 紫微必须有出生时辰（免费页同样要求），缺少时辰视为非法输入 */
function recomputeZiwei(raw: unknown): RecomputedReading {
  const input = parseBirth(raw)
  const chart = engine(() => computeZiwei(input))
  if (chart.status !== 'ok') invalidInput([{ field: 'time', code: 'required' }])
  return { input, engineVersion: chart.engineVersion, result: ziweiSummary(chart) }
}

/** 궁합：两人分别排盘后计分；摘要沿用八字命盘摘要，不含出生信息 */
function recomputeCompat(raw: unknown, now: Date): RecomputedReading {
  const parsed = z.object({ a: birthInputSchema, b: birthInputSchema }).safeParse(raw)
  if (!parsed.success) invalidInput()
  const { a, b } = parsed.data as { a: BirthInput; b: BirthInput }
  const result = engine(() => computeCompatibility(a, b, { referenceYear: now.getUTCFullYear() }))
  return {
    input: { a, b },
    engineVersion: result.engineVersion,
    result: {
      a: chartSummary(result.charts[0]),
      b: chartSummary(result.charts[1]),
      compatibility: {
        score: result.score,
        base: result.base,
        items: result.items.map((item) => ({ key: item.key, delta: item.delta })),
      },
    },
  }
}

/** 数字命理与塔罗引擎没有版本号导出，算法变化时在这里递增 */
export const NUMEROLOGY_ENGINE_VERSION = 'numerology@1'
// tarot@2：牌数据加入 arcana，避免模型自行判断大/小阿尔克那（5.1 抽检）
export const TAROT_ENGINE_VERSION = 'tarot@2'

const numerologyInputSchema = z.object({
  year: int.min(1).max(9999),
  month: int.min(1).max(12),
  day: int.min(1).max(31),
  /** 姓名只用于计算姓名类数字，不进入提示词 */
  name: z.string().trim().max(120).optional(),
})

/** 个人年取请求时的 UTC 年份；姓名非法时姓名类数字为 null，与免费计算器一致 */
function recomputeNumerology(raw: unknown, now: Date): RecomputedReading {
  const parsed = numerologyInputSchema.safeParse(raw)
  if (!parsed.success) invalidInput()
  const { name, ...date } = parsed.data
  const currentYear = now.getUTCFullYear()
  let chart: ReturnType<typeof numerologyChart>
  try {
    chart = numerologyChart(date, currentYear, name)
  } catch (error) {
    if (error instanceof AppError) invalidInput([{ field: 'birthDate', code: error.code }])
    throw error
  }
  const number = (n: { value: number; master: boolean }) => ({ value: n.value, master: n.master })
  return {
    input: name ? { ...date, name } : date,
    engineVersion: NUMEROLOGY_ENGINE_VERSION,
    result: {
      lifePath: number(chart.lifePath),
      birthday: number(chart.birthday),
      personalYear: number(chart.personalYear),
      currentYear,
      name: chart.name && {
        expression: number(chart.name.expression),
        soulUrge: number(chart.name.soulUrge),
        personality: number(chart.name.personality),
      },
    },
  }
}

/** 详批只开放多张牌的牌阵；单张（每日、是否）不提供完整分析 */
export const TAROT_READING_SPREADS = ['three-card', 'celtic-cross'] as const

const tarotInputSchema = z.object({
  /** `encodeReading` 的编码：牌阵、牌与正逆位 */
  reading: z.string().max(256),
  question: z.string().trim().max(200).optional(),
})

/** 塔罗不重抽：校验牌与牌阵后按 id 在服务端查牌名、牌位与牌义，客户端的牌义文本一律不用 */
function recomputeTarot(raw: unknown, _now: Date, locale: string): RecomputedReading {
  const tarotLocale = locale as 'en' | 'zh-Hant' | 'zh-Hans' | 'ko'
  const parsed = tarotInputSchema.safeParse(raw)
  if (!parsed.success) invalidInput()
  let reading: ReturnType<typeof decodeReading>
  try {
    reading = decodeReading(parsed.data.reading)
  } catch (error) {
    if (error instanceof AppError) invalidInput([{ field: 'reading', code: error.code }])
    throw error
  }
  if (!(TAROT_READING_SPREADS as readonly string[]).includes(reading.spread)) invalidInput()
  const positions = spreadPositions(reading.spread, tarotLocale)
  const question = parsed.data.question || undefined
  return {
    input: { reading: parsed.data.reading, ...(question ? { question } : {}) },
    engineVersion: TAROT_ENGINE_VERSION,
    result: {
      spread: reading.spread,
      question: question ?? null,
      cards: reading.cards.map((card, index) => {
        const meaning = CARD_MEANINGS[tarotLocale][card.cardId]
        if (!meaning) return invalidInput()
        return {
          position: positions[index]?.name,
          positionMeaning: positions[index]?.meaning,
          card: meaning.name,
          arcana:
            CARDS.find((item) => item.id === card.cardId)?.suit === 'major' ? 'major' : 'minor',
          reversed: card.reversed,
          keywords: meaning.keywords,
          meaning: card.reversed ? meaning.reversed : meaning.upright,
        }
      }),
    },
  }
}

const ZH_HEALTH = { title: '健康作息提示', notice: '如有不適請諮詢專業醫師。' }
const ZH_HEALTH_HANS = { title: '健康作息提示', notice: '如有不适请咨询专业医师。' }
const KO_HEALTH = {
  title: '건강·생활 습관',
  notice: '불편한 증상이 있으면 전문 의료진과 상담하세요.',
}

const entries = {
  'bazi-full': {
    kind: 'bazi-full',
    variants: {
      'zh-Hant': {
        prompt: BAZI_FULL_V2,
        disclaimer:
          '本報告依傳統命理推算，僅供參考與自我探索，不構成醫療、法律或投資建議，也不預言任何具體事件。',
        healthSection: ZH_HEALTH,
      },
      'zh-Hans': {
        prompt: BAZI_FULL_V3,
        disclaimer:
          '本报告依传统命理推算，仅供参考与自我探索，不构成医疗、法律或投资建议，也不预言任何具体事件。',
        healthSection: ZH_HEALTH_HANS,
      },
    },
    recompute: recomputeChart,
  },
  'saju-full': {
    kind: 'saju-full',
    variants: {
      ko: {
        prompt: SAJU_FULL_V2,
        disclaimer:
          '이 풀이는 전통 명리학에 따른 참고 자료이며 의료·법률·투자 조언이 아니고, 구체적인 사건을 예언하지 않습니다.',
        healthSection: KO_HEALTH,
      },
    },
    recompute: recomputeChart,
  },
  'ziwei-full': {
    kind: 'ziwei-full',
    variants: {
      'zh-Hant': {
        prompt: ZIWEI_FULL_V2,
        disclaimer:
          '本報告依紫微斗數傳統推算，僅供參考與自我探索，不構成醫療、法律或投資建議，也不預言任何具體事件。',
        healthSection: ZH_HEALTH,
      },
      'zh-Hans': {
        prompt: ZIWEI_FULL_V3,
        disclaimer:
          '本报告依紫微斗数传统推算，仅供参考与自我探索，不构成医疗、法律或投资建议，也不预言任何具体事件。',
        healthSection: ZH_HEALTH_HANS,
      },
    },
    recompute: recomputeZiwei,
  },
  'saju-compat': {
    kind: 'saju-compat',
    variants: {
      ko: {
        prompt: SAJU_COMPAT_V2,
        disclaimer:
          '이 궁합 풀이는 전통 명리학에 따른 참고 자료로 관계에 대한 결정을 대신하지 않으며, 의료·법률·투자 조언이 아니고 구체적인 사건을 예언하지 않습니다.',
        healthSection: null,
      },
    },
    recompute: recomputeCompat,
  },
  'numerology-full': {
    kind: 'numerology-full',
    variants: {
      en: {
        prompt: NUMEROLOGY_FULL_V2,
        disclaimer:
          'This report is based on traditional numerology and is for reflection and entertainment only. It is not medical, legal or financial advice and does not predict specific events.',
        healthSection: {
          title: 'Wellbeing Habits',
          notice: 'If you feel unwell, please consult a qualified healthcare professional.',
        },
      },
    },
    recompute: recomputeNumerology,
  },
  'tarot-spread': {
    kind: 'tarot-spread',
    variants: {
      en: {
        prompt: TAROT_SPREAD_V2.en,
        disclaimer:
          'This reading reflects the symbolism of tarot and is for reflection and entertainment only. It is not medical, legal or financial advice and does not predict specific events.',
        healthSection: null,
      },
      'zh-Hant': {
        prompt: TAROT_SPREAD_V2['zh-Hant'],
        disclaimer:
          '本報告依塔羅牌的象徵意義整理，僅供參考與自我反思，不構成醫療、法律或投資建議，也不預言任何具體事件。',
        healthSection: null,
      },
      'zh-Hans': {
        prompt: TAROT_SPREAD_V3['zh-Hans'],
        disclaimer:
          '本报告依塔罗牌的象征意义整理，仅供参考与自我反思，不构成医疗、法律或投资建议，也不预言任何具体事件。',
        healthSection: null,
      },
      ko: {
        prompt: TAROT_SPREAD_V2.ko,
        disclaimer:
          '이 리딩은 타로 카드의 상징에 따른 참고 자료이며 의료·법률·투자 조언이 아니고, 구체적인 사건을 예언하지 않습니다.',
        healthSection: null,
      },
    },
    recompute: recomputeTarot,
  },
} satisfies Record<ReadingKind, ReadingEntry>

export type AvailableReadingKind = keyof typeof entries

/**
 * 某种详批的定义；省略 `locale` 时取默认语言。类型不存在或不支持该语言时返回 undefined。
 */
export function readingDefinition(kind: string, locale?: string): ReadingDefinition | undefined {
  if (!Object.hasOwn(entries, kind)) return undefined
  const entry: ReadingEntry = entries[kind as AvailableReadingKind]
  const locales = Object.keys(entry.variants)
  const chosen = locale ?? locales[0] ?? ''
  if (!Object.hasOwn(entry.variants, chosen)) return undefined
  const variant = entry.variants[chosen] as ReadingVariant
  return {
    kind: entry.kind,
    locales,
    ...variant,
    recompute: (raw, now) => entry.recompute(raw, now, chosen),
  }
}

/** 键排序后的 JSON，使字段顺序不同的同一输入得到同一哈希 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`
  return JSON.stringify(value)
}

/** 规范化输入的 SHA-256（十六进制），与 kind、用户一起构成 10 分钟幂等键 */
export async function readingInputHash(input: Record<string, unknown>): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(input)),
  )
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 发给模型的消息：system 为固定前缀（带 prompt caching 标记），用户消息只有结构化结果 JSON。 */
export function readingMessages(definition: ReadingDefinition, recomputed: RecomputedReading) {
  return [
    {
      role: 'system' as const,
      text: definition.prompt.system,
      // Anthropic（含经 AI Gateway）缓存固定前缀；其他服务商忽略该选项
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    },
    {
      role: 'user' as const,
      text: JSON.stringify({ kind: definition.kind, chart: recomputed.result }),
    },
  ]
}

/** 正文中的 `## ` 二级标题 */
export function sectionTitles(markdown: string): string[] {
  return [...markdown.matchAll(/^##[ \t]+(.+?)[ \t#]*$/gm)].map((match) => (match[1] ?? '').trim())
}

/** 缺失的章节（标题允许带编号等前缀，如「一、總論」） */
export function missingSections(markdown: string, sections: readonly string[]): string[] {
  const titles = sectionTitles(markdown)
  return sections.filter((section) => !titles.some((title) => title.includes(section)))
}

/**
 * 健康章节缺少就医提示时补在该章末尾；章节缺失时不补（由章节检查记录）。
 * 判定只看提示语的核心词，模型换了标点或语气也算已包含。
 */
export function ensureHealthNotice(markdown: string, definition: ReadingDefinition): string {
  if (!definition.healthSection) return markdown
  const { title, notice } = definition.healthSection
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => /^##[ \t]/.test(line) && line.includes(title))
  if (start === -1) return markdown
  const nextOffset = lines.slice(start + 1).findIndex((line) => /^##[ \t]/.test(line))
  const end = nextOffset === -1 ? lines.length : start + 1 + nextOffset
  const core = notice.replace(/[。.!！\s]+$/u, '')
  if (lines.slice(start, end).some((line) => line.includes(core))) return markdown
  let insertAt = end
  while (insertAt > start + 1 && lines[insertAt - 1]?.trim() === '') insertAt--
  lines.splice(insertAt, 0, '', notice)
  return lines.join('\n')
}

/** 保存的报告正文：开头与结尾带本语言合规声明（specs/paid-readings「报告内容约束」） */
export function withDisclaimer(markdown: string, definition: ReadingDefinition): string {
  const note = `> ${definition.disclaimer}`
  return `${note}\n\n${markdown.trim()}\n\n${note}\n`
}
