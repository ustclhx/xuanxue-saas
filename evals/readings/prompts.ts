import { type DefinedPrompt, definePrompt } from '@xuanxue/evals'
import {
  type ReadingDefinition,
  type RecomputedReading,
  readingDefinition,
  readingMessages,
} from '../../apps/web/src/features/readings/catalog.ts'

/**
 * 详批评测的提示词（readings-prompt-v4-yearly tasks 4.7）：套件只有一组版本，
 * 而线上每种「详批 × 语言」各有自己的版本，因此这里的两个版本按样本的 kind / locale 分派到
 * catalog.ts 注册的真实版本，system 与用户消息与线上 `readingMessages` 逐字相同。
 *
 * - `readings@v4`：六个组合都用 `<kind>.v4`。
 * - `readings@pre-v4`：v4 之前的代码默认版本，保留真实版本号（不把 v2 记成 v3）：
 *   八字 / 紫微 zh-Hant 为 v2、zh-Hans 为 v3，사주 ko 为 v2，数字命理 en 为 v3。
 *   报告里每个样本的真实版本见 `prepared.annotations.promptVersion`。
 * - `readings@es-v1`（add-locales-eu-ja tasks 5.8）：西班牙语两个组合用各自的首个 es 版本
 *   （`ES_VERSIONS`），其余组合与 `readings@v4` 相同。评测 es 时用 `--tag es` 只跑 es 样本。
 *
 * 版本锁要求每个套件版本都能渲染全部样本：es 组合在 v4 之前没有任何版本，`readings@v4` 与
 * `readings@pre-v4` 遇到 es 样本时渲染与 `readings@es-v1` 相同的 es 提示词，只为锁能覆盖全部样本；
 * 不在这两个历史版本下录制或评测 es 样本，它们的门槛也只计原来六个组合（gates.ts）。
 */

/** 评测覆盖的六个组合（design 决策 7 的样本量门槛按它计） */
export const READING_COMBOS = [
  'bazi-full.zh-Hant',
  'bazi-full.zh-Hans',
  'saju-full.ko',
  'ziwei-full.zh-Hant',
  'ziwei-full.zh-Hans',
  'numerology-full.en',
] as const
export type ReadingCombo = (typeof READING_COMBOS)[number]

/** 西班牙语组合（add-locales-eu-ja design 决策 7；门槛逐组合判定，见 gates.ts） */
export const ES_READING_COMBOS = ['numerology-full.es', 'tarot-spread.es'] as const
export type EsReadingCombo = (typeof ES_READING_COMBOS)[number]

/** 每个 es 组合的真实提示词版本（catalog.ts 的 es 变体） */
export const ES_VERSIONS: Readonly<Record<EsReadingCombo, string>> = {
  'numerology-full.es': 'numerology-full.v5',
  'tarot-spread.es': 'tarot-spread.v4',
}

/** 样本可用的全部组合 */
export const ALL_READING_COMBOS: readonly string[] = [...READING_COMBOS, ...ES_READING_COMBOS]

/**
 * 日语详批（openspec add-locales-eu-ja tasks 4.8）由独立套件 `readings-ja` 评测（evals/readings-ja/），
 * 样本不进本套件：本套件的门槛按上面六个组合整批计算，混入日语样本会改变已录制版本的分母。
 * 两个套件共用这里的复算、渲染、检查与被评正文转换；套件版本 `readings-ja@v1` 只接受日语组合。
 */
export const READING_JA_COMBOS = ['bazi-full.ja', 'ziwei-full.ja', 'tarot-spread.ja'] as const
export type ReadingJaCombo = (typeof READING_JA_COMBOS)[number]
export const JA_SUITE_VERSION = 'readings-ja@v1'
/** `readings-ja@v1` 中每个组合的真实提示词版本（catalog.ts 的 ja 语言） */
export const JA_VERSIONS: Readonly<Record<ReadingJaCombo, string>> = {
  'bazi-full.ja': 'bazi-full.v4',
  'ziwei-full.ja': 'ziwei-full.v4',
  'tarot-spread.ja': 'tarot-spread.v3',
}

/** 每个组合在 `readings@pre-v4` 中的真实版本（= 引入 v4 前的代码默认版本，readings.test.ts 对照） */
export const PRE_V4_VERSIONS: Readonly<Record<ReadingCombo, string>> = {
  'bazi-full.zh-Hant': 'bazi-full.v2',
  'bazi-full.zh-Hans': 'bazi-full.v3',
  'saju-full.ko': 'saju-full.v2',
  'ziwei-full.zh-Hant': 'ziwei-full.v2',
  'ziwei-full.zh-Hans': 'ziwei-full.v3',
  'numerology-full.en': 'numerology-full.v3',
}

/**
 * 与 apps/web/src/features/readings/generate.ts 的 READING_MAX_OUTPUT_TOKENS 相同
 * （不直接导入：generate.ts 依赖 Workers 运行时；readings.test.ts 按源码对照）。
 */
export const READING_MAX_OUTPUT_TOKENS = 12000

/** 样本输入：与前台提交相同的原始输入 + 固定请求时间（决定流年窗口）+ 评委用的复算数据 */
export interface ReadingSampleInput {
  readonly kind: string
  readonly locale: string
  /** 模拟请求时间（UTC），流年窗口起点取其 UTC 年；不读当前时间 */
  readonly requestDate: string
  /** 与前台提交相同的原始输入（虚构） */
  readonly request: unknown
  /**
   * 服务端按 v4 数据档复算的结构化数据，只给评委核对「数据准确」（模板评委只看得到样本输入）。
   * 生成仍按所评版本的数据档现场复算；readings.test.ts 断言此字段与复算结果一致。
   */
  readonly data: Record<string, unknown>
  /**
   * v1–v3 数据档中与 `data` 不同的顶层字段（目前只有八字 / 사주的 `shensha`：旧档为神煞 key 列表，
   * v4 为命中的神煞与所在柱）。`{ ...data, ...preV4Fields }` 覆盖旧数据档（readings.test.ts 断言），
   * 评委据此核对没有逐年章节的旧版本报告。
   */
  readonly preV4Fields?: Record<string, unknown>
  /**
   * 只给评委的补充说明（目标语言与该详批的核对口径），评委在样本输入中看到；不进入生成提示词。
   * 新语言样本用它注明目标语言，避免改动评分标准（改 rubric 版本会让已有评委录制全部过期）。
   */
  readonly judgeNotes?: string
}

export const comboOf = (input: Pick<ReadingSampleInput, 'kind' | 'locale'>) =>
  `${input.kind}.${input.locale}`

const KNOWN_VERSIONS = ['readings@pre-v4', 'readings@v4', 'readings@es-v1']

/** 套件版本 → 该样本组合的真实提示词版本 */
export function realVersion(promptVersion: string, input: ReadingSampleInput): string {
  const combo = comboOf(input)
  if (promptVersion === JA_SUITE_VERSION) {
    if (!(READING_JA_COMBOS as readonly string[]).includes(combo))
      throw new Error(`Unsupported reading combo ${combo} for ${JA_SUITE_VERSION}`)
    return JA_VERSIONS[combo as ReadingJaCombo]
  }
  if (!ALL_READING_COMBOS.includes(combo)) throw new Error(`Unsupported reading combo ${combo}`)
  if (!KNOWN_VERSIONS.includes(promptVersion))
    throw new Error(`Unknown readings prompt version ${promptVersion}`)
  if (Object.hasOwn(ES_VERSIONS, combo)) return ES_VERSIONS[combo as EsReadingCombo]
  if (promptVersion === 'readings@v4' || promptVersion === 'readings@es-v1')
    return `${input.kind}.v4`
  return PRE_V4_VERSIONS[combo as ReadingCombo]
}

export interface ResolvedReading {
  readonly version: string
  readonly definition: ReadingDefinition
  readonly recomputed: RecomputedReading
}

/** 按样本固定请求时间复算（纯函数、可重复）；提示词、转换与检查共用 */
export function resolveReading(promptVersion: string, input: ReadingSampleInput): ResolvedReading {
  const version = realVersion(promptVersion, input)
  const definition = readingDefinition(input.kind, input.locale, { promptVersion: version })
  if (!definition) throw new Error(`${version} is not registered for ${input.locale}`)
  const recomputed = definition.recompute(input.request, new Date(input.requestDate))
  return { version, definition, recomputed }
}

/** 与线上 `readingMessages` 相同的 system 与用户消息（服务端复算后的结构化 JSON） */
export function renderReading(promptVersion: string, input: ReadingSampleInput) {
  const { definition, recomputed } = resolveReading(promptVersion, input)
  const [system, user] = readingMessages(definition, recomputed)
  if (!system || !user) throw new Error('readingMessages must return system and user messages')
  return { system: system.text, user: user.text }
}

/**
 * 不声明 `sections`：各组合章节不同，章节检查由 checks.ts 按真实版本的章节表执行
 * （与旧脚本一致，评委也不看期望章节）。
 */
export const readingsV4: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>({
  id: 'readings',
  version: 'v4',
  system: (input) => renderReading('readings@v4', input).system,
  user: (input) => renderReading('readings@v4', input).user,
  maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
})

export const readingsPreV4: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>({
  id: 'readings',
  version: 'pre-v4',
  system: (input) => renderReading('readings@pre-v4', input).system,
  user: (input) => renderReading('readings@pre-v4', input).user,
  maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
})

export const readingsEsV1: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>({
  id: 'readings',
  version: 'es-v1',
  system: (input) => renderReading('readings@es-v1', input).system,
  user: (input) => renderReading('readings@es-v1', input).user,
  maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
})
