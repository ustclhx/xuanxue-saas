import {
  annualOutlook,
  type BaziChart,
  BaziInputError,
  type BirthInput,
  BRANCHES,
  computeChart,
  computeCompatibility,
  decadeDetails,
  ENGINE_VERSION,
} from '@xuanxue/bazi'
import {
  computeZiwei,
  type ZiweiChart,
  type ZiweiHoroscope,
  ziweiHoroscope,
} from '@xuanxue/bazi/ziwei'
import type { ReadingKind } from '@xuanxue/db'
import {
  challenges,
  type LifePeriod,
  numerologyChart,
  personalYears,
  pinnacles,
} from '@xuanxue/numerology'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { CARD_MEANINGS, CARDS, decodeReading, spreadPositions } from '@xuanxue/tarot'
import { z } from 'zod'
import type { AppLocale } from '../i18n/locales.ts'
import { birthInputSchema } from '../profiles/schema.ts'
import { JA_DATA_VERSION, japaneseChartExtras } from './ja-chart.ts'
import { BAZI_FULL_V4_EN } from './prompts/bazi-full.en.v4.ts'
import { BAZI_FULL_V2 } from './prompts/bazi-full.v2.ts'
import { BAZI_FULL_V3 } from './prompts/bazi-full.v3.ts'
import { BAZI_FULL_V4_JA } from './prompts/bazi-full.v4.ja.ts'
import { BAZI_FULL_V4 } from './prompts/bazi-full.v4.ts'
import { NUMEROLOGY_FULL_V3 } from './prompts/numerology-full.v3.ts'
import { NUMEROLOGY_FULL_V4 } from './prompts/numerology-full.v4.ts'
import { NUMEROLOGY_FULL_V5 } from './prompts/numerology-full.v5.ts'
import { NUMEROLOGY_FULL_V6 } from './prompts/numerology-full.v6.ts'
import { SAJU_COMPAT_V2 } from './prompts/saju-compat.v2.ts'
import { SAJU_FULL_V2 } from './prompts/saju-full.v2.ts'
import { SAJU_FULL_V4 } from './prompts/saju-full.v4.ts'
import { TAROT_SPREAD_V2 } from './prompts/tarot-spread.v2.ts'
import { TAROT_SPREAD_V3_JA } from './prompts/tarot-spread.v3.ja.ts'
import { TAROT_SPREAD_V3 } from './prompts/tarot-spread.v3.ts'
import { TAROT_SPREAD_V4 } from './prompts/tarot-spread.v4.ts'
import { ZIWEI_FULL_V4_EN } from './prompts/ziwei-full.en.v4.ts'
import { ZIWEI_FULL_V2 } from './prompts/ziwei-full.v2.ts'
import { ZIWEI_FULL_V3 } from './prompts/ziwei-full.v3.ts'
import { ZIWEI_FULL_V4_JA } from './prompts/ziwei-full.v4.ja.ts'
import { ZIWEI_FULL_V4 } from './prompts/ziwei-full.v4.ts'
import { READING_SAMPLES } from './samples.ts'
import { JA_READING_SAMPLES } from './samples-ja.ts'

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
  /**
   * 进入用户消息的数据档（readings-prompt-v4-yearly tasks.md 3.1）：省略为 `base`，即 v1–v3 的摘要，
   * 保证回滚与基线评测时模型看到的数据与改动前一致；`annual` 在其上增加流年窗口等逐年数据。
   */
  readonly dataProfile?: ReadingDataProfile
}

export type ReadingDataProfile = 'base' | 'annual'

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
  /**
   * 解锁卡的样例段落（product-improve-ai-content design 决策 5、D11）：人工撰写、基于虚构命盘或牌阵，
   * 不调用模型、不引用访客数据；须通过 `checkCompliance`，由 catalog.test.ts 检查。
   * 全文在 samples.ts；是否对访客渲染由其中的审定开关 `SAMPLES_APPROVED` 决定（见 readings.functions.ts）。
   */
  readonly sample: string
}

export interface ReadingDefinition extends ReadingVariant {
  readonly kind: ReadingKind
  /** 报告语言即站点语言；其他语言的请求拒绝 */
  readonly locales: readonly string[]
  recompute(raw: unknown, now: Date): RecomputedReading
}

interface ReadingEntry {
  readonly kind: ReadingKind
  /** 第一个语言为默认；各语言的 `prompt` 为代码默认版本（运行时设置为空时使用） */
  readonly variants: Readonly<Record<string, ReadingVariant>>
  /**
   * 默认版本之外可经运行时设置 `readings.<kind>.promptVersion` 切换的提示词（版本号 → 语言 → 提示词，
   * readings-prompt-v4-yearly design 决策 4）。旧版本文件永久保留，供回滚与已生成报告的收尾。
   */
  readonly versions?: Readonly<Record<string, Readonly<Record<string, ReadingPrompt>>>>
  /** 塔罗按报告语言查牌义，其余详批的复算与语言无关；数据档由所选提示词版本决定 */
  recompute(raw: unknown, now: Date, locale: string, profile: ReadingDataProfile): RecomputedReading
}

const int = z.number().int()

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

/**
 * 流年窗口年数（design 决策 2）：起点为请求时的 UTC 年（与 `currentYear` 一致），含当年共 5 年。
 * 改动年数只影响本常量、v4 提示词的规则与评测样本。
 */
export const READING_ANNUAL_YEARS = 5

/**
 * 扩展数据档的算法版本后缀，记入 `reading.engine_version`（如 `1.0.0+annual.1`）；
 * 逐年数据的算法或字段变化时递增，免费结果页的 ENGINE_VERSION 不受影响。
 */
// annual.2：逐年数据加入所属大运干支 `decade`（tasks 4.3 评测中模型按序号回查大运时多次写错干支）
export const ANNUAL_DATA_VERSION = 'annual.2'

/**
 * v4 八字 / 사주摘要：v3 摘要 + 大运地支十神与喜忌 + 命中的神煞所在柱 + 流年窗口逐年数据。
 * 仍不含出生日期与城市（逐年数据只含年份、干支与关系）。
 */
export function annualChartSummary(chart: BaziChart, startYear: number) {
  const base = chartSummary(chart)
  const details = decadeDetails(chart)
  return {
    ...base,
    fortune: {
      ...base.fortune,
      decades: base.fortune.decades.map((d, i) => ({
        ...d,
        endAge: chart.fortune.decades[i]?.endAge,
        branchTenGod: details[i]?.branchTenGod,
        favorable: details[i]?.favorable,
      })),
    },
    // v3 只列神煞 key（每张命盘都相同）；这里只保留命中本命柱的神煞及其所在柱
    shensha: chart.shensha
      .filter((s) => s.pillars.length > 0)
      .map((s) => ({ key: s.key, basis: s.basis, targets: s.targets, pillars: s.pillars })),
    annual: annualOutlook(chart, { startYear, years: READING_ANNUAL_YEARS }),
  }
}

/**
 * 八字与사주共用排盘；参考年取请求时的 UTC 年份，与免费结果页的「当前流年」一致。
 * `ja` 的四柱推命另加十二運星与天中殺（ja-chart.ts），版本后缀 `+jp.N`；其他语言不变。
 */
function recomputeChart(
  raw: unknown,
  now: Date,
  locale: string,
  profile: ReadingDataProfile,
): RecomputedReading {
  const input = parseBirth(raw)
  const year = now.getUTCFullYear()
  const chart = engine(() => computeChart(input, { referenceYear: year }))
  if (profile === 'annual') {
    const result = annualChartSummary(chart, year)
    if (locale === 'ja')
      return {
        input,
        engineVersion: `${ENGINE_VERSION}+${ANNUAL_DATA_VERSION}+${JA_DATA_VERSION}`,
        result: { ...result, ...japaneseChartExtras(chart, result.annual.years) },
      }
    return { input, engineVersion: `${ENGINE_VERSION}+${ANNUAL_DATA_VERSION}`, result }
  }
  return { input, engineVersion: ENGINE_VERSION, result: chartSummary(chart) }
}

/** 紫微必须有出生时辰（免费页同样要求），缺少时辰视为非法输入 */
function recomputeZiwei(
  raw: unknown,
  now: Date,
  _locale: string,
  profile: ReadingDataProfile,
): RecomputedReading {
  const input = parseBirth(raw)
  const chart = engine(() => computeZiwei(input))
  if (chart.status !== 'ok') invalidInput([{ field: 'time', code: 'required' }])
  if (profile !== 'annual')
    return { input, engineVersion: chart.engineVersion, result: ziweiSummary(chart) }
  const horoscope = engine(() =>
    ziweiHoroscope(input, { startYear: now.getUTCFullYear(), years: READING_ANNUAL_YEARS }),
  )
  if (horoscope.status !== 'ok') invalidInput([{ field: 'time', code: 'required' }])
  return {
    input,
    engineVersion: `${chart.engineVersion}+${ZIWEI_ANNUAL_DATA_VERSION}`,
    result: ziweiAnnualSummary(chart, horoscope),
  }
}

/**
 * 紫微 v4 数据档后缀：annual.2 在十二宫上加对宫与空宫借星（4.3 评测中模型多次自行推错对宫）。
 * 八字 / 사주的逐年数据未变，仍用 ANNUAL_DATA_VERSION。
 */
export const ZIWEI_ANNUAL_DATA_VERSION = 'annual.2'

type ZiweiOkChart = Extract<ZiweiChart, { status: 'ok' }>

/**
 * 十二宫加 `opposite`（地支相隔六位的对宫）；没有主星的空宫再加 `borrowedStars`（对宫主星与亮度）。
 * 由服务端按地支派生，模型只需引用，不再自行推算对宫。
 */
export function palacesWithOpposite(palaces: ZiweiOkChart['palaces']) {
  const byBranch = new Map(palaces.map((p) => [p.branch, p]))
  return palaces.map((palace) => {
    const branch = BRANCHES[(BRANCHES.indexOf(palace.branch) + 6) % 12]
    const opposite = branch === undefined ? undefined : byBranch.get(branch)
    if (!opposite) throw new Error(`Missing opposite palace for ${palace.key}`)
    return {
      ...palace,
      opposite: opposite.key,
      ...(palace.majorStars.length === 0
        ? {
            borrowedStars: opposite.majorStars.map((s) => ({
              star: s.star,
              brightness: s.brightness,
            })),
          }
        : {}),
    }
  })
}

/** v4 紫微摘要：v3 摘要（十二宫加对宫）+ 六吉六煞落宫 + 大限区间、当前 / 下一大限与逐年流年（不含出生日期） */
export function ziweiAnnualSummary(
  chart: ZiweiOkChart,
  horoscope: Extract<ZiweiHoroscope, { status: 'ok' }>,
) {
  return {
    ...ziweiSummary(chart),
    palaces: palacesWithOpposite(chart.palaces),
    auxiliaryStars: horoscope.auxiliaryStars,
    horoscope: {
      decades: horoscope.decades,
      currentDecade: horoscope.currentDecade,
      nextDecade: horoscope.nextDecade,
      years: horoscope.years,
    },
  }
}

/** 궁합：两人分别排盘后计分；摘要沿用八字命盘摘要，不含出生信息 */
function recomputeCompat(raw: unknown, now: Date): RecomputedReading {
  // 궁합不在本次 v4 范围，各版本都用同一摘要
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
export const NUMEROLOGY_ENGINE_VERSION = 'numerology@2'
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
function recomputeNumerology(
  raw: unknown,
  now: Date,
  _locale: string,
  profile: ReadingDataProfile,
): RecomputedReading {
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
  const result = {
    lifePath: number(chart.lifePath),
    birthday: number(chart.birthday),
    personalYear: number(chart.personalYear),
    currentYear,
    name: chart.name && {
      expression: number(chart.name.expression),
      soulUrge: number(chart.name.soulUrge),
      personality: number(chart.name.personality),
    },
  }
  const input = name ? { ...date, name } : date
  if (profile !== 'annual') return { input, engineVersion: NUMEROLOGY_ENGINE_VERSION, result }
  // 只标出当年所处的巅峰 / 挑战阶段，不输出年龄，避免由年龄反推出生年份
  const age = currentYear - date.year
  const period = (p: LifePeriod) => ({
    value: p.value,
    master: p.master,
    startAge: p.startAge,
    endAge: p.endAge,
    current: p.startAge <= age && (p.endAge === null || age < p.endAge),
  })
  return {
    input,
    engineVersion: `${NUMEROLOGY_ENGINE_VERSION}+years.1`,
    result: {
      ...result,
      personalYears: personalYears(date, currentYear, READING_ANNUAL_YEARS),
      pinnacles: pinnacles(date).map(period),
      challenges: challenges(date).map(period),
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
  const tarotLocale = locale as AppLocale
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

// 东方站英文（add-locales-eu-ja 5b.3）：与西方站数字命理同一句就医提示
const EN_HEALTH = {
  title: 'Wellbeing Habits',
  notice: 'If you feel unwell, please consult a qualified healthcare professional.',
}

/**
 * 西班牙语合规声明（术语表 compliance.required 三项：según métodos tradicionales、solo como referencia、
 * no predice el futuro；不用「entretenimiento」定位）
 */
const ES_NUMEROLOGY_DISCLAIMER =
  'Este informe se elabora según métodos tradicionales de numerología, con interpretación asistida por IA, y se ofrece solo como referencia para la reflexión personal. No predice el futuro ni constituye asesoría médica, legal ni de inversión.'
const ES_TAROT_DISCLAIMER =
  'Esta lectura se elabora según métodos tradicionales de interpretación del tarot, con interpretación asistida por IA, y se ofrece solo como referencia para la reflexión personal. No predice el futuro ni constituye asesoría médica, legal ni de inversión.'
const JA_HEALTH = {
  title: '健康と生活習慣',
  notice: '気になる症状があれば医療機関にご相談ください。',
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
        sample: READING_SAMPLES['bazi-full']['zh-Hant'],
      },
      'zh-Hans': {
        prompt: BAZI_FULL_V3,
        disclaimer:
          '本报告依传统命理推算，仅供参考与自我探索，不构成医疗、法律或投资建议，也不预言任何具体事件。',
        healthSection: ZH_HEALTH_HANS,
        sample: READING_SAMPLES['bazi-full']['zh-Hans'],
      },
      // 东方站根路径英文；八字只在东方站，`en` 不会与西方站混淆。英文没有 v4 之前的版本，代码默认即 v4；评测通过前不开放（READING_EVAL_PENDING）
      en: {
        prompt: BAZI_FULL_V4_EN,
        disclaimer:
          'This report follows the traditional rules of BaZi (Four Pillars) astrology, with AI-assisted interpretation, and is for reference and self-reflection only. It does not predict the future and is not medical, legal or financial advice.',
        healthSection: EN_HEALTH,
        sample: READING_SAMPLES['bazi-full'].en,
      },
      // 日语只有 v4 一代（annual 数据档 + 十二運星 / 天中殺），代码默认即 v4；评测通过前不开放（READING_EVAL_PENDING）
      ja: {
        prompt: BAZI_FULL_V4_JA.ja,
        disclaimer:
          '本鑑定は四柱推命の伝統的な方法に基づいて算出した参考情報です。医療・法律・投資の助言ではなく、未来を予言するものではありません。',
        healthSection: JA_HEALTH,
        sample: JA_READING_SAMPLES['bazi-full'],
      },
    },
    // v4 的英文是新增的语言，已有的繁中 / 简中 v4 文本不变
    versions: { 'bazi-full.v4': { ...BAZI_FULL_V4, en: BAZI_FULL_V4_EN } },
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
        sample: READING_SAMPLES['saju-full'].ko,
      },
    },
    versions: { 'saju-full.v4': SAJU_FULL_V4 },
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
        sample: READING_SAMPLES['ziwei-full']['zh-Hant'],
      },
      'zh-Hans': {
        prompt: ZIWEI_FULL_V3,
        disclaimer:
          '本报告依紫微斗数传统推算，仅供参考与自我探索，不构成医疗、法律或投资建议，也不预言任何具体事件。',
        healthSection: ZH_HEALTH_HANS,
        sample: READING_SAMPLES['ziwei-full']['zh-Hans'],
      },
      en: {
        prompt: ZIWEI_FULL_V4_EN,
        disclaimer:
          'This report follows the traditional rules of Zi Wei Dou Shu (Purple Star Astrology), with AI-assisted interpretation, and is for reference and self-reflection only. It does not predict the future and is not medical, legal or financial advice.',
        healthSection: EN_HEALTH,
        sample: READING_SAMPLES['ziwei-full'].en,
      },
      ja: {
        prompt: ZIWEI_FULL_V4_JA.ja,
        disclaimer:
          '本鑑定は紫微斗数の伝統的な方法に基づいて算出した参考情報です。医療・法律・投資の助言ではなく、未来を予言するものではありません。',
        healthSection: JA_HEALTH,
        sample: JA_READING_SAMPLES['ziwei-full'],
      },
    },
    versions: { 'ziwei-full.v4': { ...ZIWEI_FULL_V4, en: ZIWEI_FULL_V4_EN } },
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
        sample: READING_SAMPLES['saju-compat'].ko,
      },
    },
    recompute: recomputeCompat,
  },
  'numerology-full': {
    kind: 'numerology-full',
    variants: {
      en: {
        prompt: NUMEROLOGY_FULL_V3,
        disclaimer:
          'This report is based on traditional numerology methods, with AI-assisted interpretation, and is for reference and self-reflection only. It is not medical, legal or financial advice and does not predict specific events.',
        healthSection: {
          title: 'Wellbeing Habits',
          notice: 'If you feel unwell, please consult a qualified healthcare professional.',
        },
        sample: READING_SAMPLES['numerology-full'].en,
      },
      // add-locales-eu-ja tasks 5.8：评测门槛通过前不出售（READING_EVAL_PENDING）；
      // v6 在 v5 上加防重复规则（v5 可读性未过门槛），v5 仍可经运行时设置选用
      es: {
        prompt: NUMEROLOGY_FULL_V6.es,
        disclaimer: ES_NUMEROLOGY_DISCLAIMER,
        healthSection: {
          title: 'Hábitos de bienestar',
          notice: 'Si no te sientes bien, consulta a un profesional de la salud.',
        },
        sample: READING_SAMPLES['numerology-full'].es,
      },
    },
    versions: {
      'numerology-full.v4': NUMEROLOGY_FULL_V4,
      'numerology-full.v5': NUMEROLOGY_FULL_V5,
    },
    recompute: recomputeNumerology,
  },
  'tarot-spread': {
    kind: 'tarot-spread',
    variants: {
      en: {
        prompt: TAROT_SPREAD_V2.en,
        disclaimer:
          'This reading follows traditional tarot symbolism, with AI-assisted interpretation, and is for reference and self-reflection only. It is not medical, legal or financial advice and does not predict specific events.',
        healthSection: null,
        sample: READING_SAMPLES['tarot-spread'].en,
      },
      'zh-Hant': {
        prompt: TAROT_SPREAD_V2['zh-Hant'],
        disclaimer:
          '本報告依塔羅牌的象徵意義整理，僅供參考與自我反思，不構成醫療、法律或投資建議，也不預言任何具體事件。',
        healthSection: null,
        sample: READING_SAMPLES['tarot-spread']['zh-Hant'],
      },
      'zh-Hans': {
        prompt: TAROT_SPREAD_V3['zh-Hans'],
        disclaimer:
          '本报告依塔罗牌的象征意义整理，仅供参考与自我反思，不构成医疗、法律或投资建议，也不预言任何具体事件。',
        healthSection: null,
        sample: READING_SAMPLES['tarot-spread']['zh-Hans'],
      },
      ko: {
        prompt: TAROT_SPREAD_V2.ko,
        disclaimer:
          '이 리딩은 타로 카드의 상징에 따른 참고 자료이며 의료·법률·투자 조언이 아니고, 구체적인 사건을 예언하지 않습니다.',
        healthSection: null,
        sample: READING_SAMPLES['tarot-spread'].ko,
      },
      // add-locales-eu-ja tasks 5.8：评测门槛通过前不出售（READING_EVAL_PENDING）
      es: {
        prompt: TAROT_SPREAD_V4.es,
        disclaimer: ES_TAROT_DISCLAIMER,
        healthSection: null,
        sample: READING_SAMPLES['tarot-spread'].es,
      },
      ja: {
        prompt: TAROT_SPREAD_V3_JA.ja,
        disclaimer:
          '本リーディングはタロットカードの伝統的な象徴に基づいてまとめた参考情報です。医療・法律・投資の助言ではなく、未来を予言するものではありません。',
        healthSection: null,
        sample: JA_READING_SAMPLES['tarot-spread'],
      },
    },
    recompute: recomputeTarot,
  },
} satisfies Record<ReadingKind, ReadingEntry>

export type AvailableReadingKind = keyof typeof entries

/**
 * 尚未通过提示词评测门槛的「详批类型 × 语言」（`<kind>.<locale>`；openspec add-locales-eu-ja D-10、
 * specs/paid-readings「报告内容约束」）：提示词已登记、可供评测与已有报告收尾，但对访客不开放——
 * 解锁卡、定价页与 `POST /api/readings` 都经 `readingEvalPassed` 判定（平台管理员预览除外）。
 * 真实评测（`pnpm eval:prompts --suite readings-ja … --live|--record`）全部门槛通过并记入私有验收记录后，
 * 由协调者在这里删掉对应项（随 PR 合入），即对该语言开放解锁卡。
 */
export const READING_EVAL_PENDING: ReadonlySet<string> = new Set([
  // ja（readings-ja@v2）与 es（readings@es-v2）2026-11-21 真实评测全部必需门槛通过，已删去；
  // 报告在私有验收目录 locales-eu-ja/live-evals/prompt-evals/。
  // add-locales-eu-ja 5b.3：东方站英文八字 / 紫微 readings-east-en@v2 真实评测准确度未达门槛
  // （八字 3.875、紫微 3.250，需 ≥ 4），改进前不开放
  'bazi-full.en',
  'ziwei-full.en',
])

/** 某「详批 × 语言」是否已通过评测门槛、可以对访客开放（只判定评测，不含运营开关与模型配置） */
export function readingEvalPassed(kind: string, locale: string): boolean {
  return !READING_EVAL_PENDING.has(`${kind}.${locale}`)
}

/** kind → version → locale 注册表：代码默认版本与 `versions` 中登记的版本合并 */
function promptRegistry(entry: ReadingEntry): Map<string, Map<string, ReadingPrompt>> {
  const registry = new Map<string, Map<string, ReadingPrompt>>()
  const add = (locale: string, prompt: ReadingPrompt) => {
    const locales = registry.get(prompt.version) ?? new Map<string, ReadingPrompt>()
    locales.set(locale, prompt)
    registry.set(prompt.version, locales)
  }
  for (const [locale, variant] of Object.entries(entry.variants)) add(locale, variant.prompt)
  for (const prompts of Object.values(entry.versions ?? {}))
    for (const [locale, prompt] of Object.entries(prompts)) add(locale, prompt)
  return registry
}

function entryOf(kind: string): ReadingEntry | undefined {
  return Object.hasOwn(entries, kind) ? entries[kind as AvailableReadingKind] : undefined
}

export interface ReadingDefinitionOptions {
  /**
   * 提示词版本号（如 `bazi-full.v4`）；省略或空字符串表示代码默认版本。
   * 指定的版本未在该语言注册时返回 undefined，调用方决定回退（见 `resolveReadingDefinition`）。
   */
  readonly promptVersion?: string | null | undefined
}

/**
 * 某种详批的定义；省略 `locale` 时取默认语言。类型不存在、不支持该语言或该语言没有指定的
 * 提示词版本时返回 undefined。
 */
export function readingDefinition(
  kind: string,
  locale?: string,
  options: ReadingDefinitionOptions = {},
): ReadingDefinition | undefined {
  const entry = entryOf(kind)
  if (!entry) return undefined
  const locales = Object.keys(entry.variants)
  const chosen = locale ?? locales[0] ?? ''
  if (!Object.hasOwn(entry.variants, chosen)) return undefined
  const variant = entry.variants[chosen] as ReadingVariant
  let prompt = variant.prompt
  if (options.promptVersion) {
    const registered = promptRegistry(entry).get(options.promptVersion)?.get(chosen)
    if (!registered) return undefined
    prompt = registered
  }
  return {
    kind: entry.kind,
    locales,
    ...variant,
    prompt,
    recompute: (raw, now) => entry.recompute(raw, now, chosen, prompt.dataProfile ?? 'base'),
  }
}

/** 按指定数据档复算（测试与评测用；线上由所选提示词版本的 `dataProfile` 决定） */
export function recomputeReading(
  kind: string,
  raw: unknown,
  now: Date,
  options: { locale?: string; profile: ReadingDataProfile },
): RecomputedReading {
  const entry = entryOf(kind)
  const locale = options.locale ?? Object.keys(entry?.variants ?? {})[0]
  if (!entry || !locale || !Object.hasOwn(entry.variants, locale)) invalidInput()
  return entry.recompute(raw, now, locale, options.profile)
}

/**
 * 按版本取定义，版本未注册或该语言没有该版本时回退到代码默认版本并告警
 * （spec「提示词版本的运行时切换」）。类型或语言不存在时返回 undefined。
 */
export function resolveReadingDefinition(
  kind: string,
  locale: string,
  promptVersion: string | null | undefined,
): ReadingDefinition | undefined {
  const fallback = readingDefinition(kind, locale)
  if (!fallback || !promptVersion) return fallback
  const chosen = readingDefinition(kind, locale, { promptVersion })
  if (chosen) return chosen
  log.warn('readings.prompt_version_fallback', {
    kind,
    locale,
    promptVersion,
    fallback: fallback.prompt.version,
  })
  return fallback
}

/** 某种详批已注册的提示词版本与支持的语言（后台选项与保存校验） */
export function readingPromptVersions(
  kind: string,
): { readonly version: string; readonly locales: readonly string[] }[] {
  const entry = entryOf(kind)
  if (!entry) return []
  return [...promptRegistry(entry)]
    .map(([version, locales]) => ({ version, locales: [...locales.keys()] }))
    .sort((a, b) => a.version.localeCompare(b.version, 'en', { numeric: true }))
}

/** 运行时设置的取值是否合法：空字符串（代码默认）或该详批已注册的版本 */
export function isReadingPromptVersion(kind: string, version: string): boolean {
  return version === '' || readingPromptVersions(kind).some((item) => item.version === version)
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
