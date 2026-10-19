import { z } from 'zod'

const payloadSchema = z.object({
  purpose: z.enum(['waitlist', 'confirm', 'unsubscribe']),
  id: z.uuid(),
  nonce: z.uuid(),
  expires: z.number().int().positive().nullable(),
})
type Payload = z.infer<typeof payloadSchema>
const encoder = new TextEncoder()
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
const decode = (value: string) =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
const key = (secret: string, scope: string) =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(`${scope}:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )

/**
 * `<base64url(JSON)>.<base64url(HMAC)>`；`scope` 参与密钥派生，不同用途的令牌不能互相冒用。
 * 正文只做签名不加密，不要放入敏感信息。
 */
export async function signHmacToken(
  secret: string,
  scope: string,
  payload: unknown,
): Promise<string> {
  const body = encode(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await key(secret, scope), encoder.encode(body))
  return `${body}.${encode(new Uint8Array(signature))}`
}

/** 签名无效、格式不符或超长时返回 null；有效期等业务判断由调用方完成 */
export async function verifyHmacToken<T>(
  secret: string,
  scope: string,
  token: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  if (token.length > 1024) return null
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra !== undefined) return null
  let bytes: Uint8Array<ArrayBuffer>
  let payload: T
  try {
    bytes = decode(signature)
    payload = schema.parse(JSON.parse(new TextDecoder().decode(decode(body))))
  } catch {
    return null
  }
  return (await crypto.subtle.verify('HMAC', await key(secret, scope), bytes, encoder.encode(body)))
    ? payload
    : null
}

export function signGrowthToken(secret: string, payload: Payload): Promise<string> {
  return signHmacToken(secret, 'growth', payload)
}

export async function verifyGrowthToken(
  secret: string,
  token: string,
  purpose: Payload['purpose'],
): Promise<Payload | null> {
  const payload = await verifyHmacToken(secret, 'growth', token, payloadSchema)
  if (!payload || payload.purpose !== purpose) return null
  if (payload.expires !== null && payload.expires <= Date.now()) return null
  return payload
}
