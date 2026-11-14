import type { ModelMessage, wrapLanguageModel } from 'ai'

type CallOptions = Parameters<ReturnType<typeof wrapLanguageModel>['doStream']>[0]
export type TextThinkingParams = Pick<CallOptions, 'reasoning' | 'providerOptions'>

export interface TextProviderCapabilities {
  readonly supportsThinking: boolean
  applyThinking<T extends TextThinkingParams>(params: T, on: boolean): T & TextThinkingParams
  continuation?: {
    buildPrefix(messages: ModelMessage[], partial: string): ModelMessage[]
  }
}

const defaults: TextProviderCapabilities = {
  supportsThinking: false,
  applyThinking: (params) => params,
}

const deepseek: TextProviderCapabilities = {
  supportsThinking: true,
  applyThinking: (params, on) => ({
    ...params,
    reasoning: on ? 'high' : 'none',
    providerOptions: {
      ...params.providerOptions,
      deepseek: {
        ...params.providerOptions?.deepseek,
        thinking: { type: on ? 'enabled' : 'disabled' },
      },
    },
  }),
  continuation: {
    buildPrefix: (messages, partial) => [
      ...messages,
      {
        role: 'assistant',
        content: partial,
        providerOptions: { deepseek: { prefix: true } },
      },
    ],
  },
}

const capabilities = new Map<string, TextProviderCapabilities>([['deepseek', deepseek]])

/** 同时接受注册表 provider 与 SDK 的 deepseek.chat 标识。 */
export function getTextProviderCapabilities(provider: string): TextProviderCapabilities {
  return capabilities.get(provider.split('.')[0] ?? provider) ?? defaults
}

/** 模型缺省跟随适配器；显式 true 仍需 Provider 可控，false 始终禁用。 */
export function supportsTextThinking(provider: string, thinkingOverride?: boolean): boolean {
  return thinkingOverride !== false && getTextProviderCapabilities(provider).supportsThinking
}

/**
 * 实际发给 Provider 的 thinking 设置。可控 Provider 上模型配置 thinking=false 时显式禁用：
 * 不发送任何设置时 DeepSeek V4（如 deepseek-flash）默认开启推理，推理 token 计入输出上限，长文会被截断。
 * 不可控 Provider 返回 undefined（不附带参数）；其余情况跟随请求或缺省值。
 */
export function resolveTextThinking(
  provider: string,
  thinkingOverride: boolean | undefined,
  requested: boolean,
): boolean | undefined {
  if (!getTextProviderCapabilities(provider).supportsThinking) return undefined
  if (thinkingOverride === false) return false
  return requested
}
