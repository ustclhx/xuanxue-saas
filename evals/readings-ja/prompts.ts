import { type DefinedPrompt, definePrompt } from '@xuanxue/evals'
import {
  JA_SUITE_VERSION,
  READING_MAX_OUTPUT_TOKENS,
  type ReadingSampleInput,
  renderReading,
} from '../readings/prompts.ts'

/**
 * 日语详批套件的当前版本 `readings-ja@v2`：按样本 kind 分派到 catalog.ts 中 `ja` 语言的真实版本
 * （八字 bazi-full.v4、紫微 ziwei-full.v4、塔罗 tarot-spread.v3，见 readings/prompts.ts `JA_VERSIONS`），
 * system 与用户消息与线上 `readingMessages` 逐字相同。日语提示词改版时加新版本，不改本版本。
 * v1（2026-11-21 真实录制，未发布、录制未提交）因八字补上逐年建议而作废，锁文件保留其条目作为历史。
 */
export const readingsJaV2: DefinedPrompt<ReadingSampleInput> = definePrompt<ReadingSampleInput>({
  id: 'readings-ja',
  version: 'v2',
  system: (input) => renderReading(JA_SUITE_VERSION, input).system,
  user: (input) => renderReading(JA_SUITE_VERSION, input).user,
  maxOutputTokens: READING_MAX_OUTPUT_TOKENS,
})
