import {
  type BaziChart,
  BaziInputError,
  type BirthInput,
  computeChart,
  ENGINE_VERSION,
} from '@xuanxue/bazi'
import type { ReadingKind } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { z } from 'zod'
import { BAZI_FULL_V1 } from './prompts/bazi-full.v1.ts'
import { SAJU_FULL_V1 } from './prompts/saju-full.v1.ts'

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

export interface ReadingDefinition {
  readonly kind: ReadingKind
  /** 报告语言即站点语言；其他语言的请求拒绝 */
  readonly locales: readonly string[]
  readonly prompt: ReadingPrompt
  /** 报告开头与结尾的固定合规声明（本语言） */
  readonly disclaimer: string
  /** 健康章节必须出现的就医提示；缺失时生成后补上 */
  readonly healthSection: { readonly title: string; readonly notice: string }
  recompute(raw: unknown, now: Date): RecomputedReading
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

/** 八字与사주共用排盘；参考年取请求时的 UTC 年份，与免费结果页的「当前流年」一致。 */
function recomputeChart(raw: unknown, now: Date): RecomputedReading {
  const parsed = birthInputSchema.safeParse(raw)
  if (!parsed.success) invalidInput()
  const input = parsed.data as BirthInput
  let chart: BaziChart
  try {
    chart = computeChart(input, { referenceYear: now.getUTCFullYear() })
  } catch (error) {
    if (error instanceof BaziInputError) invalidInput(error.issues)
    throw error
  }
  return { input: parsed.data, engineVersion: ENGINE_VERSION, result: chartSummary(chart) }
}

const definitions = {
  'bazi-full': {
    kind: 'bazi-full',
    locales: ['zh-Hant'],
    prompt: BAZI_FULL_V1,
    disclaimer:
      '本報告依傳統命理推算，僅供參考與自我探索，不構成醫療、法律或投資建議，也不預言任何具體事件。',
    healthSection: { title: '健康作息提示', notice: '如有不適請諮詢專業醫師。' },
    recompute: recomputeChart,
  },
  'saju-full': {
    kind: 'saju-full',
    locales: ['ko'],
    prompt: SAJU_FULL_V1,
    disclaimer:
      '이 풀이는 전통 명리학에 따른 참고 자료이며 의료·법률·투자 조언이 아니고, 구체적인 사건을 예언하지 않습니다.',
    healthSection: {
      title: '건강·생활 습관',
      notice: '불편한 증상이 있으면 전문 의료진과 상담하세요.',
    },
    recompute: recomputeChart,
  },
} satisfies Partial<Record<ReadingKind, ReadingDefinition>>

/** 已实现的详批类型；其余类型（tasks.md 2.4）实现前一律视为不存在。 */
export type AvailableReadingKind = keyof typeof definitions

export function readingDefinition(kind: string): ReadingDefinition | undefined {
  return Object.hasOwn(definitions, kind) ? definitions[kind as AvailableReadingKind] : undefined
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
