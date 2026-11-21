import { type DefinedPrompt, definePrompt } from '@xuanxue/evals'
import { readingDefinition, readingMessages } from '../../apps/web/src/features/readings/catalog.ts'
import {
  READING_MAX_OUTPUT_TOKENS,
  type ReadingSampleInput,
  type ResolvedReading,
} from '../readings/prompts.ts'

/**
 * 东方站英文详批的评测提示词（add-locales-eu-ja design 决策 7、tasks 5b.3）。
 *
 * 为什么是独立套件而不是在 `readings` 中加版本：模板的版本锁对「每个套件版本 × 每个样本」渲染，
 * `readings@pre-v4` / `readings@v4` 无法渲染东方站英文样本（英文没有 v4 之前的版本），
 * 而且 `readings` 的门槛按 48 个样本整批与基线对比。把新组合放进同一套件会改变已有版本的样本集与门槛，
 * 因此另起套件，已有套件版本、样本与录制一字不动；检查、转换与评分维度复用 `readings` 的实现。
 *
 * - `readings-east-en@v2`：两个组合都用 catalog 中登记为 `<kind>.v4` 的英文提示词，
 *   system 与用户消息与线上 `readingMessages` 逐字相同。
 *   v1（2026-11-21 真实录制，未发布、录制未提交）因八字准确度未达门槛、两个组合补准确度约束而作废。
 */

/** 评测覆盖的组合（每组合 ≥ 8 个样本，gates.ts） */
export const EAST_EN_COMBOS = ['bazi-full.en', 'ziwei-full.en'] as const
export type EastEnCombo = (typeof EAST_EN_COMBOS)[number]

export const CANDIDATE_VERSION = 'readings-east-en@v2'

export const comboOf = (input: Pick<ReadingSampleInput, 'kind' | 'locale'>) =>
  `${input.kind}.${input.locale}`

/** 套件版本 → 该样本组合的真实提示词版本 */
export function realVersion(promptVersion: string, input: ReadingSampleInput): string {
  const combo = comboOf(input)
  if (!(EAST_EN_COMBOS as readonly string[]).includes(combo))
    throw new Error(`Unsupported reading combo ${combo}`)
  if (promptVersion === CANDIDATE_VERSION) return `${input.kind}.v4`
  throw new Error(`Unknown readings-east-en prompt version ${promptVersion}`)
}

/** 按样本固定请求时间复算（纯函数、可重复）；提示词、转换与检查共用 */
export function resolveReading(promptVersion: string, input: ReadingSampleInput): ResolvedReading {
  const version = realVersion(promptVersion, input)
  const definition = readingDefinition(input.kind, input.locale, { promptVersion: version })
  if (!definition) throw new Error(`${version} is not registered for ${input.locale}`)
  const recomputed = definition.recompute(input.request, new Date(input.requestDate))
  return { version, definition, recomputed }
}

export function renderReading(promptVersion: string, input: ReadingSampleInput) {
  const { definition, recomputed } = resolveReading(promptVersion, input)
  const [system, user] = readingMessages(definition, recomputed)
  if (!system || !user) throw new Error('readingMessages must return system and user messages')
  return { system: system.text, user: user.text }
}

export const readingsEastEnV2: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>(
  {
    id: 'readings-east-en',
    version: 'v2',
    system: (input) => renderReading(CANDIDATE_VERSION, input).system,
    user: (input) => renderReading(CANDIDATE_VERSION, input).user,
    maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
  },
)
