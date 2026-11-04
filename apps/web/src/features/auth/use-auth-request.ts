import { useCallback, useState } from 'react'
import { AUTH_ERROR_MESSAGES, type AuthErrorLike, authErrorMessage } from './errors.ts'
import type { TurnstileState } from './turnstile.tsx'

type AuthResult<T> = { data: T | null; error: AuthErrorLike | null }

/**
 * 调用受 Turnstile 保护的认证接口：没有令牌时不发请求；请求带上 `x-turnstile-token`，
 * 结束后（无论成败）换新令牌；失败时按错误码给出提示文案。
 * 返回接口的 data，失败返回 `null`（错误文案在 `error` 中）。
 */
export function useAuthRequest(turnstile: TurnstileState) {
  const [error, setError] = useState<string | null>(null)
  // 接口返回的原始错误（错误码 / 状态），供需要按错误类型调整展示的表单使用（如登录失败的两站账户提示）
  const [failure, setFailure] = useState<AuthErrorLike | null>(null)

  const run = useCallback(
    async <T>(request: (headers: Record<string, string>) => Promise<AuthResult<T>>) => {
      if (!turnstile.ready) {
        setError(AUTH_ERROR_MESSAGES.TURNSTILE_PENDING)
        return null
      }
      setError(null)
      setFailure(null)
      try {
        const result = await request(turnstile.headers())
        if (result.error) {
          setFailure(result.error)
          setError(authErrorMessage(result.error))
          return null
        }
        return result.data
      } catch {
        setError(AUTH_ERROR_MESSAGES.UNKNOWN)
        return null
      } finally {
        if (turnstile.enabled) turnstile.reset()
      }
    },
    [turnstile],
  )

  return { error, failure, setError, run }
}
