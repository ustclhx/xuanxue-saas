import { defineSuite, z } from '@xuanxue/evals'
import { READING_JA_COMBOS } from '../readings/prompts.ts'
import readings from '../readings/suite.ts'
import { readingJaChecks } from './checks.ts'
import { evaluateReadingsJa } from './gates.ts'
import { prepareJaOutput } from './prepare.ts'
import { readingsJaV1 } from './prompts.ts'
import { readingsJaRubric } from './rubric.ts'

/**
 * 日语详批提示词评测（openspec add-locales-eu-ja tasks 4.8，`pnpm eval:prompts --suite readings-ja`）：
 * 四柱推命、紫微斗数、塔罗三个 `ja` 组合各 8 个虚构样本。生成与评委模型、单价、评委参数与 readings 套件相同
 * （直接取自 evals/readings/suite.ts，避免两处单价不一致）；检查为 readings 套件全部检查 + 日语检查，
 * 门槛见 gates.ts。说明、命令与录制来源见 README.md。
 */
export default defineSuite({
  name: 'readings-ja',
  prompts: [readingsJaV1],
  defaultPrompt: 'readings-ja@v1',
  inputSchema: z
    .strictObject({
      kind: z.enum(['bazi-full', 'ziwei-full', 'tarot-spread']),
      locale: z.literal('ja'),
      requestDate: z.iso.datetime(),
      request: z.record(z.string(), z.unknown()),
      data: z.record(z.string(), z.unknown()),
    })
    .refine(
      (input) => (READING_JA_COMBOS as readonly string[]).includes(`${input.kind}.${input.locale}`),
      { message: 'kind and locale must be one of the evaluated ja combos' },
    ),
  models: readings.models,
  generator: readings.generator,
  judge: {
    model: readings.judge?.model ?? 'deepseek-v4-pro',
    rubric: readingsJaRubric,
    maxOutputTokens: readings.judge?.maxOutputTokens ?? 16000,
    thinking: readings.judge?.thinking ?? true,
  },
  checks: readingJaChecks,
  prepareOutput: prepareJaOutput,
  evaluateRun: evaluateReadingsJa,
})
