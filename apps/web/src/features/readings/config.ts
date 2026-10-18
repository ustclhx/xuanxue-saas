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

/** 关闭或未选定模型的详批在前台隐藏解锁入口，接口也拒绝生成 */
export function readingAvailable(config: ReadingConfig): boolean {
  return config.enabled && config.modelKey !== '' && config.credits > 0
}
