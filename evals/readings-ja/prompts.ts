import { type DefinedPrompt, definePrompt } from '@xuanxue/evals'
import {
  JA_SUITE_VERSION,
  READING_MAX_OUTPUT_TOKENS,
  type ReadingSampleInput,
  renderReading,
} from '../readings/prompts.ts'

/**
 * 日语详批套件的唯一版本 `readings-ja@v1`：按样本 kind 分派到 catalog.ts 中 `ja` 语言的真实版本
 * （八字 bazi-full.v4、紫微 ziwei-full.v4、塔罗 tarot-spread.v3，见 readings/prompts.ts `JA_VERSIONS`），
 * system 与用户消息与线上 `readingMessages` 逐字相同。日语提示词改版时加 `readings-ja@v2`，不改本版本。
 */
export const readingsJaV1: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>({
  id: 'readings-ja',
  version: 'v1',
  system: (input) => renderReading(JA_SUITE_VERSION, input).system,
  user: (input) => renderReading(JA_SUITE_VERSION, input).user,
  maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
})
