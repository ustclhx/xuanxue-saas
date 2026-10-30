import { estimateCredits, type Pricing } from '@xuanxue/ai/client'
import { m } from '../../paraglide/messages.js'

/**
 * 预计消耗（docs/06-ai.md §2「展示」）：按次显示确定值，按 token 显示「约 X–Y」区间。
 * 只用于展示；实际预扣额与最大输出由 `POST /api/ai/chat` 按定价快照与余额计算。
 */

/** 选择器展示的模型（`getPickerModels` 的返回项） */
export interface PickerModel {
  readonly id: string
  readonly key: string
  readonly pricing: Pricing
  readonly supportsThinking: boolean
}

export type CreditEstimate =
  | { readonly kind: 'exact'; readonly credits: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number }
  | { readonly kind: 'per_unit'; readonly credits: number; readonly unit: 'image' | 'second' }

/** 模型未声明输出上限时，区间上限采用的最大输出 token 数 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096

export interface EstimateOptions {
  /** 已估算的本轮输入 token 数（估算器由 `packages/ai/src/text` 提供） */
  readonly inputTokens: number
  /** 模型 / 请求允许的最大输出 token 数 */
  readonly maxOutputTokens?: number
  /** 可用积分；提供时上限的输出 token 数按余额压低，与服务端计算 maxOut 的口径一致 */
  readonly balance?: number
  /** 请求参数，按次计费按 `multipliers` 加权 */
  readonly params?: Readonly<Record<string, unknown>>
}

export function creditEstimate(pricing: Pricing, options: EstimateOptions): CreditEstimate {
  switch (pricing.mode) {
    case 'per_call':
      return { kind: 'exact', credits: estimateCredits(pricing, { params: options.params ?? {} }) }
    case 'token': {
      const inputTokens = Math.max(0, Math.ceil(options.inputTokens))
      let maxOut = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
      if (options.balance !== undefined && pricing.outputPer1k > 0) {
        const inputCost = (inputTokens * pricing.inputPer1k) / 1000
        const byBalance = Math.floor(((options.balance - inputCost) * 1000) / pricing.outputPer1k)
        maxOut = Math.min(maxOut, Math.max(0, byBalance))
      }
      // 下限：输入估算 + 0 输出（不低于 minCharge）；上限：输入估算 + 允许的最大输出
      return {
        kind: 'range',
        min: estimateCredits(pricing, { inputTokens, maxOutputTokens: 0 }),
        max: estimateCredits(pricing, { inputTokens, maxOutputTokens: maxOut }),
      }
    }
    case 'per_unit':
      return {
        kind: 'per_unit',
        credits: estimateCredits(pricing, { units: 1 }),
        unit: pricing.unit,
      }
  }
}

/**
 * 对话输入区的「每条预计消耗」采用的典型回复长度（specs/ai-chat「发送前显示预计消耗」）：
 * 只用于展示，按模型单价 × 典型 token 估算；预扣仍按余额与最大输出计算，不受影响。
 */
export const TYPICAL_REPLY_TOKENS = { min: 150, max: 800 } as const

/** 每条消息的典型消耗：输入估算 + 典型回复长度；按次计费为确定值 */
export function typicalMessageEstimate(
  pricing: Pricing,
  options: { readonly inputTokens: number; readonly maxOutputTokens?: number },
): CreditEstimate {
  if (pricing.mode !== 'token') return creditEstimate(pricing, options)
  const inputTokens = Math.max(0, Math.ceil(options.inputTokens))
  const cap = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  return {
    kind: 'range',
    min: estimateCredits(pricing, {
      inputTokens,
      maxOutputTokens: Math.min(cap, TYPICAL_REPLY_TOKENS.min),
    }),
    max: estimateCredits(pricing, {
      inputTokens,
      maxOutputTokens: Math.min(cap, TYPICAL_REPLY_TOKENS.max),
    }),
  }
}

const credits = (n: number) =>
  n === 1 ? m.ai_chat_credit_one() : m.ai_chat_credits({ credits: String(n) })

/** 按次：「5 credits」；按 token：「~3–120 credits」（相等时只显示一个值）；按用量：「2 credits / image」 */
export function formatEstimate(estimate: CreditEstimate): string {
  switch (estimate.kind) {
    case 'exact':
      return credits(estimate.credits)
    case 'range':
      return m.ai_chat_approx({
        value:
          estimate.min === estimate.max
            ? credits(estimate.max)
            : credits(estimate.max).replace(
                String(estimate.max),
                m.ai_chat_range({ min: String(estimate.min), max: String(estimate.max) }),
              ),
      })
    case 'per_unit':
      return estimate.unit === 'image'
        ? m.ai_chat_unit_image({ value: credits(estimate.credits) })
        : m.ai_chat_unit_second({ value: credits(estimate.credits) })
  }
}
