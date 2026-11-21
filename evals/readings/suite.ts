import { defineSuite, z } from '@xuanxue/evals'
import { readingChecks } from './checks.ts'
import { evaluateReadings } from './gates.ts'
import { prepareOutput } from './prepare.ts'
import {
  ALL_READING_COMBOS,
  readingsEsV1,
  readingsEsV2,
  readingsPreV4,
  readingsV4,
} from './prompts.ts'
import { readingsRubric } from './rubric.ts'

/**
 * 付费详批提示词评测（readings-prompt-v4-yearly，`pnpm eval:prompts --suite readings`）。
 * 取代 apps/web/scripts/eval-readings/：同一批 48 个虚构样本（6 个「详批 × 语言」× 8），
 * 生成与评委都评线上保存的正文（prepare.ts），门槛见 gates.ts。说明与录制来源见 README.md。
 * add-locales-eu-ja tasks 5.8 追加西班牙语两个组合（各 8 个样本）与套件版本 `readings@es-v1`，
 * 之后数字命理 es 改版为 `readings@es-v2`（numerology-full.v6）。
 *
 * 单价（美元 / 百万 token）：DeepSeek 官方价目 https://api-docs.deepseek.com/quick_start/pricing ，
 * 2026-11-14 读取的高峰价、缓存未命中（非高峰为一半），按高峰价保守填写；真实或录制前请按当前价目核对。
 */
export default defineSuite({
  name: 'readings',
  prompts: [readingsPreV4, readingsV4, readingsEsV1, readingsEsV2],
  defaultPrompt: 'readings@v4',
  // 西班牙语样本只属于 readings@es-v1 / es-v2（加入 es 之后的版本）：v4 / pre-v4 的整套回放不含它们，不因缺少录制而失败
  appliesTo: (sample, promptVersion) =>
    promptVersion === 'readings@es-v1' ||
    promptVersion === 'readings@es-v2' ||
    (sample.input as { locale?: string } | undefined)?.locale !== 'es',
  inputSchema: z
    .strictObject({
      kind: z.enum(['bazi-full', 'saju-full', 'ziwei-full', 'numerology-full', 'tarot-spread']),
      locale: z.enum(['zh-Hant', 'zh-Hans', 'ko', 'en', 'es']),
      requestDate: z.iso.datetime(),
      request: z.record(z.string(), z.unknown()),
      data: z.record(z.string(), z.unknown()),
      preV4Fields: z.record(z.string(), z.unknown()).optional(),
      judgeNotes: z.string().min(1).optional(),
    })
    .refine((input) => ALL_READING_COMBOS.includes(`${input.kind}.${input.locale}`), {
      message: 'kind and locale must be one of the evaluated combos',
    }),
  models: {
    // 与 staging 详批同一模型；thinking 关闭与模型行 x-text.thinking=false 一致（rev4 录制同样关闭）
    'deepseek-flash': {
      provider: 'deepseek',
      providerModelId: 'deepseek-flash',
      priceUsd: { inputPerMTok: 0.3, outputPerMTok: 1.2 },
      thinking: false,
    },
    'deepseek-v4-pro': {
      provider: 'deepseek',
      providerModelId: 'deepseek-v4-pro',
      priceUsd: { inputPerMTok: 1.32, outputPerMTok: 3.96 },
    },
  },
  generator: 'deepseek-flash',
  judge: {
    // 2026-11-14 批准：评委 deepseek-v4-pro（与生成模型不同）
    model: 'deepseek-v4-pro',
    rubric: readingsRubric,
    // 与旧脚本相同：推理 token 计入上限，16000 避免评委在输出 JSON 前耗尽
    maxOutputTokens: 16000,
    // 旧脚本评委按服务商默认（DeepSeek V4 默认开启思考），保持一致
    thinking: true,
  },
  checks: readingChecks,
  prepareOutput,
  evaluateRun: evaluateReadings,
})
