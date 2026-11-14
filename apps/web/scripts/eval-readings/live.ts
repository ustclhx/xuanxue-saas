import { readFileSync } from 'node:fs'
import {
  type AvailableModel,
  defaultLanguageModelFactory,
  getTextProviderCapabilities,
  type TextModelEnv,
} from '@xuanxue/ai'
import { type ModelMessage, streamText } from 'ai'
import type { ModelRef } from './args.ts'
import type { ChatMessage, TextGenerator } from './runner.ts'

/**
 * 真实调用（只在 `--live` 下由 CLI 动态导入）：经 `@xuanxue/ai` 的文本模型工厂构造模型，
 * 服务商密钥与 Gateway 配置读取 apps/web/.dev.vars，与本地 wrangler dev 同一来源；密钥不打印。
 */

const ENV_KEYS = [
  'AI_TEXT_EGRESS',
  'OPENAI_BASE_URL',
  'AI_GATEWAY_ACCOUNT_ID',
  'AI_GATEWAY_ID',
  'AI_GATEWAY_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'DEEPSEEK_API_KEY',
] as const

/** 解析 .dev.vars（KEY=VALUE，允许引号与注释），只取文本模型需要的变量 */
export function parseDevVars(source: string): TextModelEnv {
  const env: Record<string, string> = {}
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    const [, key, raw = ''] = match
    if (!(ENV_KEYS as readonly string[]).includes(key as string)) continue
    env[key as string] = raw.replace(/^(['"])(.*)\1$/, '$2')
  }
  return env as TextModelEnv
}

export function loadTextEnv(): TextModelEnv {
  const file = new URL('../../.dev.vars', import.meta.url)
  return { ...parseDevVars(readFileSync(file, 'utf8')) }
}

export function createLiveGenerator(
  ref: ModelRef,
  env: TextModelEnv,
  thinking: boolean | null = null,
): TextGenerator {
  // 与 text-stream.ts 相同：只有显式开 / 关时才经 Provider 适配器写入思考参数
  const thinkingParams =
    thinking === null ? {} : getTextProviderCapabilities(ref.provider).applyThinking({}, thinking)
  // 工厂只用 provider 与 providerModelId；其余字段是评测外的计费与授权信息
  const model = defaultLanguageModelFactory(
    {
      id: 'eval',
      key: `${ref.provider}:${ref.providerModelId}`,
      kind: 'text',
      provider: ref.provider,
      providerModelId: ref.providerModelId,
      tags: [],
      paramsSchema: null,
      sort: 0,
    } as unknown as AvailableModel,
    env,
  )
  return {
    async generate(messages: readonly ChatMessage[], maxOutputTokens: number) {
      const started = Date.now()
      const result = streamText({
        model,
        // 与线上 text-stream.ts 一致：固定 system 前缀放在 messages 中（带缓存标记），ai v7 需显式允许
        allowSystemInMessages: true,
        maxRetries: 0,
        messages: messages as ModelMessage[],
        maxOutputTokens,
        ...thinkingParams,
      })
      let text = ''
      for await (const delta of result.textStream) text += delta
      const usage = await result.usage
      return {
        text,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        durationMs: Date.now() - started,
      }
    },
  }
}
