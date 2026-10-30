import { z } from 'zod'
import type { ShareInput } from '../tools/share.ts'

/**
 * 解锁意图保留（add-reading-monetization design 决策 5）：点击解锁时把 `{kind, share, returnTo}`
 * 签名后写入 `unlock` 查询参数，登录与 Checkout 的回跳地址都带上它；回到结果页时据此恢复输入并
 * 自动生成。`share` 与 `#r=` 分享片段相同（不含姓名等个人信息字段），令牌正文只签名不加密。
 * 纯函数，浏览器与服务端都可使用；签名与验签只在服务端执行（密钥不进浏览器）。
 */
export const UNLOCK_PARAM = 'unlock'
/** 留出登录、收邮件验证码与完成支付的时间 */
export const UNLOCK_TTL_MS = 6 * 60 * 60_000
const SCOPE = 'reading-unlock'

const shareValue = z.union([z.string().max(256), z.number(), z.boolean(), z.null()])

export const unlockPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.string().min(1).max(64),
  share: z.record(z.string().max(64), shareValue),
  /** 结果页的本站路径（不含查询串与片段） */
  returnTo: z.string().max(512),
  exp: z.number().int().positive(),
})
export type UnlockPayload = z.infer<typeof unlockPayloadSchema>

/** 浏览器端只读取正文用于恢复表单；是否自动生成仍以服务端验签结果为准 */
export function peekUnlockToken(token: string): UnlockPayload | null {
  const [body] = token.split('.')
  if (!body || token.length > 1024) return null
  try {
    const base64 = body.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    const json = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    )
    return unlockPayloadSchema.parse(JSON.parse(json))
  } catch {
    return null
  }
}

/** 当前地址 `?unlock=` 中令牌携带的分享输入；没有或无法解析时返回 null */
export function unlockShareOf(search: string): ShareInput | null {
  const token = new URLSearchParams(search).get(UNLOCK_PARAM)
  return token ? (peekUnlockToken(token)?.share ?? null) : null
}

/** `returnTo` 加上 `unlock` 参数：登录 redirect 与 Checkout returnTo 使用同一个地址 */
export function unlockReturnPath(returnTo: string, token: string): string {
  return `${returnTo}?${UNLOCK_PARAM}=${token}`
}

export async function signUnlockToken(
  secret: string,
  input: Omit<UnlockPayload, 'v' | 'exp'>,
  now = Date.now(),
): Promise<string> {
  const { signHmacToken } = await import('../growth/tokens.ts')
  return signHmacToken(secret, SCOPE, { v: 1, ...input, exp: now + UNLOCK_TTL_MS })
}

/** 签名无效或已过期时返回 null */
export async function verifyUnlockToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<UnlockPayload | null> {
  const { verifyHmacToken } = await import('../growth/tokens.ts')
  const payload = await verifyHmacToken(secret, SCOPE, token, unlockPayloadSchema)
  return payload && payload.exp > now ? payload : null
}

/**
 * 付款回跳后等待 webhook 入账的轮询间隔（毫秒）：前 30 秒每 2 秒，之后每 5 秒，共约 5 分钟。
 * PayPal 的 capture 回调可能晚到数分钟，只轮询 30 秒会让已付款的用户停在「确认中」。
 */
export const PAYMENT_POLL_DELAYS: readonly number[] = [
  ...Array<number>(15).fill(2000),
  ...Array<number>(54).fill(5000),
]
