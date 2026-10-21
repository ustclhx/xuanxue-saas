import { z } from 'zod'

/**
 * 邮件发送通道的环境变量（apps/jobs 的 EMAIL_QUEUE 消费者，docs/07-infrastructure.md §4）：
 * - `EMAIL_TRANSPORT=log`（默认）：不调用外部服务，只记录收件人与模板名；没有 Resend 凭据时使用；
 * - `EMAIL_TRANSPORT=resend`：经 Resend 发送，每站一个 key（只能限定单个域名），两站 key 都必填。
 *   发件人与回复地址由消息语言所属站点决定（`emailSender`），不再使用环境变量。
 */
export const EMAIL_TRANSPORTS = ['log', 'resend'] as const
export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number]

export const emailEnvShape = {
  EMAIL_TRANSPORT: z.enum(EMAIL_TRANSPORTS).default('log'),
  /** Secret：东方站（ganjiday.com）发件 key，仅限 mail.ganjiday.com */
  RESEND_API_KEY_EAST: z.string().min(1).optional(),
  /** Secret：西方站（arcanumber.com）发件 key，仅限 mail.arcanumber.com */
  RESEND_API_KEY_WEST: z.string().min(1).optional(),
}

type EmailEnvShape = typeof emailEnvShape

/**
 * 在 app 的 env schema 上加入邮件通道变量；`resend` 通道缺少任一站点 key 时，
 * 由 `loadEnv` 按变量名报告（不含取值）。
 */
export function withEmailEnv<Shape extends z.core.$ZodShape>(schema: z.ZodObject<Shape>) {
  return schema.extend(emailEnvShape).superRefine((env, ctx) => {
    // 泛型 Shape 下 TS 无法展开合并后的输出类型，这里只读取本函数加入的字段
    const values = env as z.output<z.ZodObject<EmailEnvShape>>
    if (values.EMAIL_TRANSPORT !== 'resend') return
    for (const key of ['RESEND_API_KEY_EAST', 'RESEND_API_KEY_WEST'] as const) {
      if (values[key] === undefined)
        ctx.addIssue({ code: 'custom', path: [key], message: 'required' })
    }
  })
}

export type EmailTransportConfig =
  | { readonly transport: 'log' }
  | {
      readonly transport: 'resend'
      readonly apiKeys: { readonly east: string; readonly west: string }
    }

/** 把已校验的 env 收窄为发送通道配置。 */
export function emailTransportConfig(
  env: z.output<z.ZodObject<EmailEnvShape>>,
): EmailTransportConfig {
  if (env.EMAIL_TRANSPORT === 'log') return { transport: 'log' }
  if (env.RESEND_API_KEY_EAST === undefined || env.RESEND_API_KEY_WEST === undefined) {
    // withEmailEnv 已校验；直接传入未校验的对象时才会走到这里
    throw new TypeError(
      'EMAIL_TRANSPORT=resend requires RESEND_API_KEY_EAST and RESEND_API_KEY_WEST',
    )
  }
  return {
    transport: 'resend',
    apiKeys: { east: env.RESEND_API_KEY_EAST, west: env.RESEND_API_KEY_WEST },
  }
}
