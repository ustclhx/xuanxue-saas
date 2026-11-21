import type { PreparedOutput, PrepareOutput } from '@xuanxue/evals'
import { withDisclaimer } from '../../apps/web/src/features/readings/catalog.ts'
import { prepareReading } from '../readings/prepare.ts'
import { type ReadingSampleInput, resolveReading } from '../readings/prompts.ts'

/**
 * 日语被评正文：与 readings 套件相同的 `deliveredReadingText`（v4 兜底），再加上线上保存时的
 * 开头 / 结尾合规声明（catalog.ts `withDisclaimer`），使「合规声明」检查与评委看到的就是保存的正文。
 * 合规整段替换与就医提示补写仍不做，理由同 readings/prepare.ts。
 */
export const PREPARE_JA_VERSION = 'guard.v4-disclaimer.1'

export function prepareJaReading(
  rawOutput: string,
  promptVersion: string,
  input: ReadingSampleInput,
): PreparedOutput {
  const prepared = prepareReading(rawOutput, promptVersion, input)
  const { definition } = resolveReading(promptVersion, input)
  return {
    output: withDisclaimer(prepared.output, definition),
    annotations: { ...prepared.annotations, disclaimer: true },
  }
}

export const prepareJaOutput: PrepareOutput = {
  version: PREPARE_JA_VERSION,
  run: ({ rawOutput, sample, prompt }) =>
    prepareJaReading(
      rawOutput,
      prompt.promptVersion,
      sample.input as unknown as ReadingSampleInput,
    ),
}
