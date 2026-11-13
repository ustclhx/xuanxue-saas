import { getSetting, type ReadingKind, type SettingsContext } from '@xuanxue/db'
import { log } from '@xuanxue/shared/log'
import { isReadingPromptVersion } from './catalog.ts'

/** 某种详批当前的运营配置（运行时设置 `readings.<kind>.*`，后台修改后最多 60 秒生效） */
export interface ReadingConfig {
  readonly enabled: boolean
  readonly credits: number
  /** `ai_model.key`；空字符串表示尚未选定模型 */
  readonly modelKey: string
  /** 提示词版本（`readings.<kind>.promptVersion`）；空字符串为代码默认版本，非法值已回退为空 */
  readonly promptVersion: string
}

/** 可用性判定只看开关、积分与模型，与提示词版本无关 */
export type ReadingSwitches = Pick<ReadingConfig, 'enabled' | 'credits' | 'modelKey'>

export async function readingConfig(
  ctx: SettingsContext,
  kind: ReadingKind,
): Promise<ReadingConfig> {
  const [enabled, credits, modelKey, rawVersion] = await Promise.all([
    getSetting(ctx, `readings.${kind}.enabled`),
    getSetting(ctx, `readings.${kind}.credits`),
    getSetting(ctx, `readings.${kind}.modelKey`),
    getSetting(ctx, `readings.${kind}.promptVersion`),
  ])
  // 后台保存时已校验；数据库中仍有非法值（手工写入、版本被移除）时用代码默认版本，不阻断生成
  let promptVersion = typeof rawVersion === 'string' ? rawVersion : ''
  if (!isReadingPromptVersion(kind, promptVersion)) {
    log.warn('readings.prompt_version_invalid', { kind, promptVersion })
    promptVersion = ''
  }
  return { enabled, credits, modelKey, promptVersion }
}

/**
 * 关闭或未选定模型的详批在前台隐藏解锁入口，接口也拒绝生成。
 * 平台管理员（`adminPreview`）忽略 `enabled` 开关，便于上线前用真实模型实测；未选定模型仍不可用。
 */
export function readingAvailable(
  config: ReadingSwitches,
  options: { adminPreview?: boolean | undefined } = {},
) {
  if (config.modelKey === '' || config.credits <= 0) return false
  return config.enabled || options.adminPreview === true
}
