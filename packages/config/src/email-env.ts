import { z } from 'zod'

/**
 * 邮件发送通道的环境变量（apps/jobs 的 EMAIL_QUEUE 消费者，docs/07-infrastructure.md §4）：
 * - `EMAIL_TRANSPORT=log`（默认）：不调用外部服务，只记录收件人与模板名；没有 Resend 凭据时使用；
 * - `EMAIL_TRANSPORT=resend`：经 Resend 发送，此时 `RESEND_API_KEY` 必填。
 *   发件人与回复地址由消息语言所属站点决定（`emailSender`），不再使用环境变量。
 */
export const EMAIL_TRANSPORTS = ['log', 'resend'] as const
export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number]

export const emailEnvShape = {
  EMAIL_TRANSPORT: z.enum(EMAIL_TRANSPORTS).default('log'),
  /** Secret */
  RESEND_API_KEY: z.string().min(1).optional(),
}

type EmailEnvShape = typeof emailEnvShape

/**
 * 在 app 的 env schema 上加入邮件通道变量；`resend` 通道缺少 `RESEND_API_KEY` 时，
 * 由 `loadEnv` 按变量名报告（不含取值）。
 */
export function withEmailEnv<Shape extends z.core.$ZodShape>(schema: z.ZodObject<Shape>) {
  return schema.extend(emailEnvShape).superRefine((env, ctx) => {
    // 泛型 Shape 下 TS 无法展开合并后的输出类型，这里只读取本函数加入的字段
    const values = env as z.output<z.ZodObject<EmailEnvShape>>
    if (values.EMAIL_TRANSPORT !== 'resend') return
    if (values.RESEND_API_KEY === undefined) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'required' })
    }
  })
}

export type EmailTransportConfig =
  | { readonly transport: 'log' }
  | { readonly transport: 'resend'; readonly apiKey: string }

/** 把已校验的 env 收窄为发送通道配置。 */
export function emailTransportConfig(
  env: z.output<z.ZodObject<EmailEnvShape>>,
): EmailTransportConfig {
  if (env.EMAIL_TRANSPORT === 'log') return { transport: 'log' }
  if (env.RESEND_API_KEY === undefined) {
    // withEmailEnv 已校验；直接传入未校验的对象时才会走到这里
    throw new TypeError('EMAIL_TRANSPORT=resend requires RESEND_API_KEY')
  }
  return { transport: 'resend', apiKey: env.RESEND_API_KEY }
}
