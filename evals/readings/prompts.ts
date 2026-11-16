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
}

export const comboOf = (input: Pick<ReadingSampleInput, 'kind' | 'locale'>) =>
  `${input.kind}.${input.locale}`

/** 套件版本 → 该样本组合的真实提示词版本 */
export function realVersion(promptVersion: string, input: ReadingSampleInput): string {
  const combo = comboOf(input)
  if (!(READING_COMBOS as readonly string[]).includes(combo))
    throw new Error(`Unsupported reading combo ${combo}`)
  if (promptVersion === 'readings@v4') return `${input.kind}.v4`
  if (promptVersion === 'readings@pre-v4') return PRE_V4_VERSIONS[combo as ReadingCombo]
  throw new Error(`Unknown readings prompt version ${promptVersion}`)
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
