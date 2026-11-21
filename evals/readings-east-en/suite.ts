import { defineSuite, z } from '@xuanxue/evals'
import { createPrepareOutput } from '../readings/prepare.ts'
import readings from '../readings/suite.ts'
import { eastEnChecks } from './checks.ts'
import { evaluateEastEn } from './gates.ts'
import { EAST_EN_COMBOS, readingsEastEnV2, resolveReading } from './prompts.ts'
import { eastEnRubric } from './rubric.ts'

/**
 * 东方站根路径英文的八字与紫微详批评测（add-locales-eu-ja tasks 5b.3，`pnpm eval:prompts --suite readings-east-en`）。
 * 16 个虚构样本（2 个组合 × 8），被评正文与线上相同（readings 的 `guard.v4` 转换），
 * 生成与评委模型、单价与 `readings` 套件相同。说明、命令与费用估算见 README.md。
 */
export default defineSuite({
  name: 'readings-east-en',
  prompts: [readingsEastEnV2],
  defaultPrompt: 'readings-east-en@v2',
  inputSchema: z
    .strictObject({
      kind: z.enum(['bazi-full', 'ziwei-full']),
      locale: z.literal('en'),
      requestDate: z.iso.datetime(),
      request: z.record(z.string(), z.unknown()),
      data: z.record(z.string(), z.unknown()),
    })
    .refine(
      (input) => (EAST_EN_COMBOS as readonly string[]).includes(`${input.kind}.${input.locale}`),
      { message: 'kind and locale must be one of the evaluated combos' },
    ),
  models: readings.models,
  generator: readings.generator,
  judge: {
    model: 'deepseek-v4-pro',
    rubric: eastEnRubric,
    maxOutputTokens: 16000,
    thinking: true,
  },
  checks: eastEnChecks,
  prepareOutput: createPrepareOutput(resolveReading),
  evaluateRun: evaluateEastEn,
})
