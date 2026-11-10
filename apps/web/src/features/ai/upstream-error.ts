import { AppError } from '@xuanxue/shared'
import { APICallError } from 'ai'

export type UpstreamErrorCategory =
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'upstream_5xx'
  | 'bad_request'
  | 'network'
  | 'empty_reply'
  | 'unknown'

export interface UpstreamErrorSummary {
  category: UpstreamErrorCategory
  status?: number
  /** 上游错误码 / 类型或异常名，已截断脱敏；不含响应正文 */
  detail?: string
}

/** 近似密钥特征：上游错误码里偶尔回显密钥前缀，日志前一律替换。 */
const KEY_LIKE = /\b(?:sk|rk|whsec)[-_][A-Za-z0-9_]+/g

export function sanitizeErrorDetail(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const text = String(value)
    .replace(/\p{Cc}/gu, ' ')
    .replace(KEY_LIKE, '[redacted]')
    .trim()
    .slice(0, 120)
  return text || undefined
}

function statusCategory(status: number): UpstreamErrorCategory {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status === 408 || status === 504) return 'timeout'
  if (status >= 500) return 'upstream_5xx'
  return 'bad_request'
}

/** OpenAI 兼容服务商常见 `{ error: { code, type } }`；只取短码，不取 message 以免回显提示词。 */
function upstreamCode(data: unknown): unknown {
  if (!data || typeof data !== 'object') return undefined
  const error = (data as { error?: unknown }).error
  if (!error || typeof error !== 'object') return undefined
  const { code, type } = error as { code?: unknown; type?: unknown }
  return code ?? type
}

/**
 * 把最终失败归类为不含敏感信息的日志字段：生产事故中上游 401 不重试也未记录，
 * 浏览器只看到通用失败文案，需要按类别直接定位到密钥、限流或上游故障。
 */
export function classifyUpstreamError(error: unknown): UpstreamErrorSummary {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode
    const detail = sanitizeErrorDetail(upstreamCode(error.data) ?? error.name)
    return {
      category: status === undefined ? 'network' : statusCategory(status),
      ...(status === undefined ? {} : { status }),
      ...(detail ? { detail } : {}),
    }
  }
  if (error instanceof AppError) {
    const category =
      error.code === 'AI_UPSTREAM_TIMEOUT'
        ? 'timeout'
        : error.code === 'AI_EMPTY_REPLY'
          ? 'empty_reply'
          : 'unknown'
    return { category, status: error.status, detail: error.code }
  }
  if (error instanceof Error) {
    const detail = sanitizeErrorDetail(error.name)
    const category =
      error.name === 'AbortError' || error.name === 'TimeoutError'
        ? 'timeout'
        : // fetch 连接失败在 Workers / Node 中均抛 TypeError
          error instanceof TypeError
          ? 'network'
          : 'unknown'
    return { category, ...(detail ? { detail } : {}) }
  }
  return { category: 'unknown' }
}
