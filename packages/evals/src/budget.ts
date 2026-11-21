import {
  AI_PROVIDER_NOT_CONFIGURED,
  DEFAULT_TOKENS_PER_CHAR,
  estimateInputTokens,
} from '@xuanxue/ai'
import { APICallError } from 'ai'
import { EvalConfigError } from './errors.ts'
import type { ModelSpec } from './suite.ts'

/**
 * 美元预算（design D10）：每次调用前按「输入估算 + 最大输出」与套件单价估算上限，
 * 已花费 + 在途预留 + 本次估算超过上限即不发出；并发时先预留再调用。
 */
export type Price = NonNullable<ModelSpec['priceUsd']>

export interface CallEstimate {
  readonly inputTokens: number
  readonly maxOutputTokens: number
  readonly usd: number
}

/** 真实与录制模式要求两项单价都为正数：单价为 0 时预算形同虚设 */
export function requirePrice(key: string, model: ModelSpec): Price {
  const price = model.priceUsd
  if (!price)
    throw new EvalConfigError(`model ${key} has no priceUsd; live and record modes need prices`)
  if (!(price.inputPerMTok > 0 && price.outputPerMTok > 0))
    throw new EvalConfigError(
      `model ${key} priceUsd must be positive for live and record modes (inputPerMTok and outputPerMTok > 0)`,
    )
  return price
}

export function usdFor(price: Price, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1e6
}

/** 调用前估算：输入按码点保守估算（含每条消息的格式开销），输出按上限 */
export function estimateCall(
  model: ModelSpec,
  texts: readonly string[],
  maxOutputTokens: number,
): CallEstimate {
  const inputTokens = estimateInputTokens(
    texts.map((text) => ({ text })),
    model.tokensPerChar ?? DEFAULT_TOKENS_PER_CHAR,
  )
  return {
    inputTokens,
    maxOutputTokens,
    usd: model.priceUsd ? usdFor(model.priceUsd, inputTokens, maxOutputTokens) : 0,
  }
}

export interface Usage {
  readonly inputTokens?: number | undefined
  readonly outputTokens?: number | undefined
}

/** 实际费用；缺失的用量按调用前估算值记账 */
export function settledUsd(price: Price, estimate: CallEstimate, usage: Usage | undefined): number {
  return usdFor(
    price,
    usage?.inputTokens ?? estimate.inputTokens,
    usage?.outputTokens ?? estimate.maxOutputTokens,
  )
}

/**
 * 失败调用是否确定未计费：出口未配置（请求未发出），或服务商已以 HTTP 错误状态拒绝（4xx / 5xx 不产生用量）。
 * 网络中断、超时等无法确认服务商是否已生成的失败返回 false，仍按预留额记账（宁高勿低）。
 */
export function failureNotBilled(error: unknown): boolean {
  if ((error as { code?: unknown } | null)?.code === AI_PROVIDER_NOT_CONFIGURED) return true
  return APICallError.isInstance(error) && error.statusCode !== undefined
}

/** 失败调用的记账金额：确定未计费为 0，否则为预留额 */
export function failedCallUsd(error: unknown, reservation: Reservation): number {
  return failureNotBilled(error) ? 0 : reservation.usd
}

export interface Reservation {
  readonly usd: number
}

export class BudgetLedger {
  spent = 0
  reserved = 0
  exhausted = false

  readonly limitUsd: number

  // 不用参数属性：命令行经 Node 类型剥离运行，参数属性不是可剥离语法
  constructor(limitUsd: number) {
    this.limitUsd = limitUsd
    if (!(Number.isFinite(limitUsd) && limitUsd > 0))
      throw new EvalConfigError('--budget-usd must be a positive number')
  }

  /** 预留成功返回凭据；超额时返回 null，并且之后的所有预留都被拒绝 */
  reserve(usd: number): Reservation | null {
    if (this.exhausted || this.spent + this.reserved + usd > this.limitUsd) {
      this.exhausted = true
      return null
    }
    this.reserved += usd
    return { usd }
  }

  /**
   * 调用结束后结算：释放预留并记入实际费用（失败调用由调用方按 failedCallUsd 传入：确定未计费记 0，否则按预留额）。
   * 实际费用超过预留（估算偏低）或已花费达到上限时，账本标记为触顶，之后不再发出新调用；
   * 因此总超支不超过「已在途调用」的估算误差之和。
   */
  settle(reservation: Reservation, actualUsd: number = reservation.usd) {
    this.reserved -= reservation.usd
    this.spent += actualUsd
    if (actualUsd > reservation.usd || this.spent >= this.limitUsd) this.exhausted = true
  }
}
