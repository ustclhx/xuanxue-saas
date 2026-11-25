// 项目自有运行时设置（模板 0.9.0 起 settings.ts 改为定义表，项目键在此登记，template-sync 保留本文件）。
// 读取时按 schema 校验（含数据库中已有的值），schema 须接受后台已写入的规范化值。
import { z } from 'zod'
import { READING_KINDS, type ReadingKind } from './schema/readings.ts'
import { defineSetting, type SettingDefinition } from './setting-definition.ts'

/**
 * 默认关闭的详批：评测与使用者审阅样例之前不开放。natal-full（content-growth-v2-tools 第 23 组）
 * 已由使用者 2026-11-24 审阅样例，随波次 B 改为默认开启；生产不写设置行，直接取这里的代码默认值。
 */
const READING_KINDS_OFF_BY_DEFAULT: readonly ReadingKind[] = []

const readingEnabled = z.boolean()
/**
 * 详批价格种子：1 次详批 = 10 积分（2026-11-17「版本 A」，原 design 决策 4 为 100），后台可改。
 * 读取时允许 0：零积分的详批视为未开放（web 端 readings/availability.ts），后台表单仍要求至少 1。
 */
const readingCredits = z.number().int().min(0).max(100_000)
/** ai_model.key；空字符串表示沿用同站其他详批的模型（web 端 readings/config.ts） */
const readingModelKey = z.string().trim().max(200)
/** 提示词版本号（如 `bazi-full.v4`）；空字符串表示代码默认版本，取值由 web 端注册表校验 */
const readingPromptVersion = z.string().trim().max(64)

/** 每种付费详批的开关、积分价格、模型与提示词版本 */
type ReadingSettingDefinitions = {
  [K in ReadingKind as `readings.${K}.enabled`]: SettingDefinition<typeof readingEnabled>
} & {
  [K in ReadingKind as `readings.${K}.credits`]: SettingDefinition<typeof readingCredits>
} & {
  [K in ReadingKind as `readings.${K}.modelKey`]: SettingDefinition<typeof readingModelKey>
} & {
  [K in ReadingKind as `readings.${K}.promptVersion`]: SettingDefinition<
    typeof readingPromptVersion
  >
}

const readingSettings = Object.fromEntries(
  READING_KINDS.flatMap((kind) => [
    [
      `readings.${kind}.enabled`,
      defineSetting({
        schema: readingEnabled,
        default: !READING_KINDS_OFF_BY_DEFAULT.includes(kind),
        description: `是否开放付费详批 ${kind}`,
      }),
    ],
    [
      `readings.${kind}.credits`,
      defineSetting({
        schema: readingCredits,
        default: 10,
        description: `付费详批 ${kind} 每次消耗的积分`,
      }),
    ],
    [
      `readings.${kind}.modelKey`,
      defineSetting({
        schema: readingModelKey,
        default: '',
        description: `付费详批 ${kind} 使用的文本模型 key，空字符串表示沿用同站其他详批的模型`,
      }),
    ],
    [
      `readings.${kind}.promptVersion`,
      defineSetting({
        schema: readingPromptVersion,
        default: '',
        description: `付费详批 ${kind} 的提示词版本，空字符串表示代码默认版本`,
      }),
    ],
  ]),
) as ReadingSettingDefinitions

/**
 * 通用 webhook 无法限定服务商域名：只允许公网 HTTPS 域名的默认端口，拒绝 IP 字面量、本机与内网后缀。
 * 后台表单与管理员 MCP 写入都按此校验，运行时设置不能成为任意出站请求的入口。
 */
const publicHttpsUrl = z
  .url()
  .max(2048)
  .refine((value) => {
    // packages/db 不带 DOM / Node 类型，按文本拆出主机：不允许用户信息（@）、端口（:）与片段（#）
    const host = /^https:\/\/([^/?#@:]+)(?:[/?][^#]*)?$/i.exec(value)?.[1]?.toLowerCase()
    return (
      host !== undefined &&
      /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) &&
      !/(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet)$/.test(host)
    )
  })

export default {
  ...readingSettings,
  /** 通用 HTTPS webhook（如 Grok Bot routine）；与密钥同时配置才投递，密钥以 Bearer 发送。 */
  'operations.webhookUrl': defineSetting({
    schema: z.union([z.literal(''), publicHttpsUrl]),
    default: '',
    description: '运营通知使用的通用 HTTPS Webhook 地址，与密钥同时配置才投递，空字符串表示清除',
    secret: true,
  }),
  'operations.webhookSecret': defineSetting({
    // 作为 Bearer 放入请求头，只接受可见 ASCII。
    schema: z.union([z.literal(''), z.string().regex(/^[\x21-\x7E]{8,512}$/)]),
    default: '',
    description: '通用 Webhook 的 Bearer 密钥，空字符串表示清除',
    secret: true,
  }),
}
