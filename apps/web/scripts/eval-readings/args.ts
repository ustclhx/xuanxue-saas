/**
 * 评测命令行参数（readings-prompt-v4-yearly design 决策 6）。默认离线读取录制输出；
 * 真实调用必须显式 `--live` 并同时给出调用次数与估算费用上限（spec「证据输出与调用保护」）。
 */

export class EvalUsageError extends Error {}

/** `provider:providerModelId`，如 `deepseek:deepseek-chat`；评测不读数据库，模型直接在命令行给出 */
export interface ModelRef {
  readonly provider: string
  readonly providerModelId: string
}

export interface LiveOptions {
  readonly model: ModelRef
  readonly maxCalls: number
  readonly maxUsd: number
  /** 美元 / 1k token；`ai_model.pricing` 以积分计价，换算不出美元，因此由使用者按服务商价目表给出 */
  readonly priceIn: number
  readonly priceOut: number
  readonly maxOutputTokens: number
  readonly record: boolean
  /** 评委模型；应与生成模型不同 */
  readonly judge: ModelRef | null
}

export interface EvalOptions {
  readonly kinds: readonly string[]
  readonly locales: readonly string[]
  /** `default` 表示各语言的代码默认版本 */
  readonly baseline: string
  /** 完整版本号或 `vN` 简写（按详批展开为 `<kind>.vN`）；null 表示只评测基线 */
  readonly candidate: string | null
  readonly live: LiveOptions | null
  readonly help: boolean
}

/** 与 generate.ts 的 READING_MAX_OUTPUT_TOKENS 保持一致（不直接导入，避免把 Workers 运行时依赖带进脚本） */
export const DEFAULT_MAX_OUTPUT_TOKENS = 12000

export const USAGE = `用法：pnpm eval:readings [选项]

  --kind <kind>            只评测某种详批（可重复）
  --locale <locale>        只评测某种语言（可重复）
  --baseline <version>     基线版本，默认 default（各语言的代码默认版本）
  --candidate <version>    候选版本，如 bazi-full.v4 或 v4（按详批展开）
  --recorded               离线模式（默认）：读取 EVIDENCE_DIR/eval-readings/recordings/
  --live                   真实调用模型，必须同时给出 --max-calls 与 --max-usd
    --model <provider:id>  生成模型，如 deepseek:deepseek-chat
    --max-calls <n>        真实调用次数上限（含评委）
    --max-usd <x>          估算费用上限（美元）
    --price-in <x>         输入价格（美元 / 1k token）
    --price-out <x>        输出价格（美元 / 1k token）
    --max-output-tokens <n> 默认 ${DEFAULT_MAX_OUTPUT_TOKENS}
    --record               把真实输出保存为录制，供离线复跑
    --judge <provider:id>  评委模型（只在 --live 下调用）
`

function modelRef(value: string, flag: string): ModelRef {
  const index = value.indexOf(':')
  if (index <= 0 || index === value.length - 1)
    throw new EvalUsageError(`${flag} 应为 provider:providerModelId`)
  return { provider: value.slice(0, index), providerModelId: value.slice(index + 1) }
}

function positive(value: string | undefined, flag: string, integer = false): number {
  const number = Number(value)
  if (value === undefined || !Number.isFinite(number) || number <= 0)
    throw new EvalUsageError(`${flag} 需要正数`)
  if (integer && !Number.isInteger(number)) throw new EvalUsageError(`${flag} 需要整数`)
  return number
}

const VALUE_FLAGS = new Set([
  '--kind',
  '--locale',
  '--baseline',
  '--candidate',
  '--model',
  '--max-calls',
  '--max-usd',
  '--price-in',
  '--price-out',
  '--max-output-tokens',
  '--judge',
])
const BOOLEAN_FLAGS = new Set(['--recorded', '--live', '--record', '--help', '-h'])

export function parseArgs(argv: readonly string[]): EvalOptions {
  const values = new Map<string, string[]>()
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (BOOLEAN_FLAGS.has(arg)) {
      flags.add(arg)
      continue
    }
    if (!VALUE_FLAGS.has(arg)) throw new EvalUsageError(`未知参数 ${arg}`)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new EvalUsageError(`${arg} 缺少取值`)
    values.set(arg, [...(values.get(arg) ?? []), value])
    i++
  }
  const one = (flag: string) => values.get(flag)?.at(-1)
  const help = flags.has('--help') || flags.has('-h')
  if (flags.has('--live') && flags.has('--recorded'))
    throw new EvalUsageError('--live 与 --recorded 不能同时使用')
  const liveOnly = ['--model', '--max-calls', '--max-usd', '--judge', '--price-in', '--price-out']
  if (!flags.has('--live') && (flags.has('--record') || liveOnly.some((flag) => values.has(flag))))
    throw new EvalUsageError('--record、--judge 与预算参数只能与 --live 一起使用')
  let live: LiveOptions | null = null
  if (flags.has('--live')) {
    // 预算上限缺一不可：没有上限的真实调用可能产生不可控的费用
    if (!values.has('--max-calls') || !values.has('--max-usd'))
      throw new EvalUsageError('--live 必须同时给出 --max-calls 与 --max-usd')
    const model = one('--model')
    if (!model) throw new EvalUsageError('--live 需要 --model provider:providerModelId')
    const judge = one('--judge')
    live = {
      model: modelRef(model, '--model'),
      maxCalls: positive(one('--max-calls'), '--max-calls', true),
      maxUsd: positive(one('--max-usd'), '--max-usd'),
      priceIn: positive(one('--price-in'), '--price-in'),
      priceOut: positive(one('--price-out'), '--price-out'),
      maxOutputTokens: values.has('--max-output-tokens')
        ? positive(one('--max-output-tokens'), '--max-output-tokens', true)
        : DEFAULT_MAX_OUTPUT_TOKENS,
      record: flags.has('--record'),
      judge: judge ? modelRef(judge, '--judge') : null,
    }
    if (
      live.judge &&
      live.judge.provider === live.model.provider &&
      live.judge.providerModelId === live.model.providerModelId
    )
      throw new EvalUsageError('评委模型应与生成模型不同')
  }
  return {
    kinds: values.get('--kind') ?? [],
    locales: values.get('--locale') ?? [],
    baseline: one('--baseline') ?? 'default',
    candidate: one('--candidate') ?? null,
    live,
    help,
  }
}

/**
 * 预算保护：按「本次输入 token + 输出上限」的最坏情况估算下一次调用，超过次数或金额上限即停止，
 * 已完成调用按实际用量累计。
 */
export class Budget {
  calls = 0
  spentUsd = 0
  // 不用构造参数属性：node 直接剥离类型运行脚本，不支持需要转译的语法
  readonly limits: Pick<LiveOptions, 'maxCalls' | 'maxUsd' | 'priceIn' | 'priceOut'>
  constructor(limits: Pick<LiveOptions, 'maxCalls' | 'maxUsd' | 'priceIn' | 'priceOut'>) {
    this.limits = limits
  }

  cost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * this.limits.priceIn + outputTokens * this.limits.priceOut) / 1000
  }

  /** 下一次调用是否仍在上限内 */
  allows(estimatedInputTokens: number, maxOutputTokens: number): boolean {
    if (this.calls >= this.limits.maxCalls) return false
    return this.spentUsd + this.cost(estimatedInputTokens, maxOutputTokens) <= this.limits.maxUsd
  }

  record(inputTokens: number, outputTokens: number) {
    this.calls++
    this.spentUsd += this.cost(inputTokens, outputTokens)
  }
}
