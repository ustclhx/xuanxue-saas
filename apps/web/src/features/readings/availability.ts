import { type LanguageModelFactory, type TextModelEnv, textProviderConfigured } from '@xuanxue/ai'
import {
  type AiModel,
  aiModel,
  type Database,
  type ReadingKind,
  type SettingsContext,
} from '@xuanxue/db'
import { and, eq } from 'drizzle-orm'
import { type ReadingConfig, readingAvailable, readingConfig } from './config.ts'

/**
 * 详批是否对访客开放的唯一判定（结果页解锁卡、定价页、应用区计费页与 `POST /api/readings` 共用）。
 * 开放必须同时满足：运行时设置 `readings.<kind>.enabled` 打开（平台管理员可预览）、
 * 选定了模型且积分大于 0、`ai_model` 中该模型为启用的文本模型、部署配置能构造该模型的 Provider。
 * 任一条件不满足时，前台只说明「尚未开放」，不出售也不承诺可以解锁。
 */
export type ReadingBlocker =
  /** 未选定模型或积分为 0 */
  | 'not-configured'
  /** 运营开关关闭 */
  | 'switched-off'
  /** 选定的模型不存在、已停用或不是文本模型 */
  | 'model-missing'
  /** 缺 Provider 密钥 / Gateway，或当前目标未装配 AI 能力 */
  | 'provider-not-configured'

export interface ReadingAvailabilityInput {
  readonly config: ReadingConfig
  readonly model: Pick<AiModel, 'provider' | 'providerModelId'> | null
  /** 未装配 AI 能力时为 null */
  readonly env: TextModelEnv | null
  readonly adminPreview?: boolean | undefined
  /** 测试注入的模型工厂；生产使用默认工厂 */
  readonly languageModelFactory?: LanguageModelFactory | undefined
}

export type ReadingAvailabilityResult =
  | { readonly available: true; readonly blocker: null }
  | { readonly available: false; readonly blocker: ReadingBlocker }

export function evaluateReadingAvailability(
  input: ReadingAvailabilityInput,
): ReadingAvailabilityResult {
  const { config } = input
  if (config.modelKey === '' || config.credits <= 0)
    return { available: false, blocker: 'not-configured' }
  if (!readingAvailable(config, { adminPreview: input.adminPreview }))
    return { available: false, blocker: 'switched-off' }
  if (!input.model) return { available: false, blocker: 'model-missing' }
  if (!input.env || !textProviderConfigured(input.model, input.env, input.languageModelFactory))
    return { available: false, blocker: 'provider-not-configured' }
  return { available: true, blocker: null }
}

export interface ReadingAvailabilityDeps {
  readonly settings: SettingsContext
  /** 读取 `ai_model`；公开页面用允许短暂陈旧的连接即可 */
  readonly db: Database
  readonly aiEnv: TextModelEnv | null
  readonly languageModelFactory?: LanguageModelFactory | undefined
}

export type ReadingAvailability = ReadingAvailabilityResult & {
  readonly config: ReadingConfig
  readonly model: AiModel | null
}

/** 读取设置与模型后判定；开关或模型未配置时不查询 `ai_model` */
export async function loadReadingAvailability(
  deps: ReadingAvailabilityDeps,
  kind: ReadingKind,
  options: { readonly adminPreview?: boolean | undefined } = {},
): Promise<ReadingAvailability> {
  const config = await readingConfig(deps.settings, kind)
  let model: AiModel | null = null
  if (readingAvailable(config, options)) {
    const [row] = await deps.db
      .select()
      .from(aiModel)
      .where(
        and(eq(aiModel.key, config.modelKey), eq(aiModel.kind, 'text'), eq(aiModel.enabled, true)),
      )
      .limit(1)
    model = row ?? null
  }
  const result = evaluateReadingAvailability({
    config,
    model,
    env: deps.aiEnv,
    adminPreview: options.adminPreview,
    languageModelFactory: deps.languageModelFactory,
  })
  return { ...result, config, model }
}

/**
 * 结果页「用这个结果问 AI」是否可用：至少一个启用的文本模型能构造 Provider。
 * 没有可用模型时入口隐藏，不再提示「每则消息按积分计费」。
 */
export async function textChatAvailable(db: Database, env: TextModelEnv | null): Promise<boolean> {
  if (!env) return false
  const models = await db
    .select({ provider: aiModel.provider, providerModelId: aiModel.providerModelId })
    .from(aiModel)
    .where(and(eq(aiModel.kind, 'text'), eq(aiModel.enabled, true)))
  return models.some((model) => textProviderConfigured(model, env))
}
