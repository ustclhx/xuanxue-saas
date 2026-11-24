import { type DefinedPrompt, definePrompt } from '@xuanxue/evals'
import { readingDefinition, readingMessages } from '../../apps/web/src/features/readings/catalog.ts'
import {
  READING_MAX_OUTPUT_TOKENS,
  type ReadingSampleInput,
  type ResolvedReading,
} from '../readings/prompts.ts'

/**
 * 出生星盘完整解读的评测提示词（content-growth-v2-tools 第 23 组、design 决策 17、19）。
 * 独立套件的理由同 `readings-east-en`：已有套件的版本锁与门槛按各自样本集计算，新组合另起套件，已有录制一字不动。
 *
 * - `readings-natal@v1` → catalog 中 `natal-full.v1`（en 代码默认版本），system 与用户消息与线上 `readingMessages` 逐字相同。
 */

export const NATAL_COMBOS = ['natal-full.en'] as const
export const CANDIDATE_VERSION = 'readings-natal@v1'

export const comboOf = (input: Pick<ReadingSampleInput, 'kind' | 'locale'>) =>
  `${input.kind}.${input.locale}`

/** 套件版本 → 真实提示词版本 */
export function realVersion(promptVersion: string, input: ReadingSampleInput): string {
  const combo = comboOf(input)
  if (!(NATAL_COMBOS as readonly string[]).includes(combo))
    throw new Error(`Unsupported reading combo ${combo}`)
  if (promptVersion === CANDIDATE_VERSION) return 'natal-full.v1'
  throw new Error(`Unknown readings-natal prompt version ${promptVersion}`)
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

export const readingsNatalV1: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>({
  id: 'readings-natal',
  version: 'v1',
  system: (input) => renderReading(CANDIDATE_VERSION, input).system,
  user: (input) => renderReading(CANDIDATE_VERSION, input).user,
  maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
})
