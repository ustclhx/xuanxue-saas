import { getSetting, type ReadingKind, type SettingsContext } from '@xuanxue/db'

/** 某种详批当前的运营配置（运行时设置 `readings.<kind>.*`，后台修改后最多 60 秒生效） */
export interface ReadingConfig {
  readonly enabled: boolean
  readonly credits: number
  /** `ai_model.key`；空字符串表示尚未选定模型 */
  readonly modelKey: string
}

export async function readingConfig(
  ctx: SettingsContext,
  kind: ReadingKind,
): Promise<ReadingConfig> {
  const [enabled, credits, modelKey] = await Promise.all([
    getSetting(ctx, `readings.${kind}.enabled`),
    getSetting(ctx, `readings.${kind}.credits`),
    getSetting(ctx, `readings.${kind}.modelKey`),
  ])
  return { enabled, credits, modelKey }
}

/**
 * 关闭或未选定模型的详批在前台隐藏解锁入口，接口也拒绝生成。
 * 平台管理员（`adminPreview`）忽略 `enabled` 开关，便于上线前用真实模型实测；未选定模型仍不可用。
 */
export function readingAvailable(config: ReadingConfig, options: { adminPreview?: boolean } = {}) {
  if (config.modelKey === '' || config.credits <= 0) return false
  return config.enabled || options.adminPreview === true
}
