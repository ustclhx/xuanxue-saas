import { defineSuite, z } from '@xuanxue/evals'
import { createPrepareOutput } from '../readings/prepare.ts'
import readings from '../readings/suite.ts'
import { natalChecks } from './checks.ts'
import { evaluateNatal } from './gates.ts'
import { NATAL_COMBOS, readingsNatalV1, resolveReading } from './prompts.ts'
import { natalRubric } from './rubric.ts'

/**
 * 出生星盘完整解读评测（content-growth-v2-tools 第 23 组，`pnpm eval:prompts --suite readings-natal`）。
 * 6 个虚构样本，被评正文与线上相同（readings 的 `guard.v4` 转换，星盘版本不做逐年兜底）；
 * 生成模型与单价同 `readings`。说明、命令与费用见 README.md。
 */
export default defineSuite({
  name: 'readings-natal',
  prompts: [readingsNatalV1],
  defaultPrompt: 'readings-natal@v1',
  inputSchema: z
    .strictObject({
      kind: z.literal('natal-full'),
      locale: z.literal('en'),
      requestDate: z.iso.datetime(),
      request: z.record(z.string(), z.unknown()),
      data: z.record(z.string(), z.unknown()),
    })
    .refine(
      (input) => (NATAL_COMBOS as readonly string[]).includes(`${input.kind}.${input.locale}`),
      { message: 'kind and locale must be one of the evaluated combos' },
    ),
  models: readings.models,
  generator: readings.generator,
  judge: {
    model: 'deepseek-v4-pro',
    rubric: natalRubric,
    maxOutputTokens: 16000,
    thinking: true,
  },
  checks: natalChecks,
  prepareOutput: createPrepareOutput(resolveReading),
  evaluateRun: evaluateNatal,
})
