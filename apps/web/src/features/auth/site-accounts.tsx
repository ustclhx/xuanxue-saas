import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { useSiteId } from '../site/context.tsx'
import { FormAlert } from './auth-layout.tsx'
import { AUTH_ERROR_MESSAGES, type AuthErrorLike } from './errors.ts'
import { siteAccountNames } from './site-account-names.ts'

/**
 * 「两站账户分开」提示（openspec split-site-accounts D3）：两站同一邮箱是两个独立账户，
 * 登录失败与注册页提示用户另一站的账户在本站不能用。提示是固定文案，
 * 不随邮箱变化，不透露该邮箱是否在另一站存在。
 */

export function SiteAccountsHint({ kind }: { kind: 'signin' | 'signup' }) {
  const names = siteAccountNames(useSiteId(), getLocale())
  return (
    <p role="note" className="text-muted-foreground text-sm leading-relaxed">
      {kind === 'signin'
        ? m.auth_site_accounts_signin_hint(names)
        : m.auth_site_accounts_signup_hint(names)}
    </p>
  )
}

/**
 * 账户不存在与密码错误：Better Auth 两种情况都返回 INVALID_EMAIL_OR_PASSWORD
 * （另一站的账户在本站等同于不存在，见 2.2 的隔离测试）；个别插件给出的 USER_NOT_FOUND /
 * INVALID_PASSWORD 也归入同一文案，避免页面文字暴露邮箱是否已注册。
 */
const CREDENTIAL_FAILURES = new Set([
  'INVALID_EMAIL_OR_PASSWORD',
  'USER_NOT_FOUND',
  'INVALID_PASSWORD',
])

export function isCredentialFailure(error: AuthErrorLike | null | undefined): boolean {
  return Boolean(error?.code && CREDENTIAL_FAILURES.has(error.code.toUpperCase()))
}

/** 密码登录的错误提示：凭据错误统一文案并附两站账户提示，其他错误按错误码显示 */
export function SignInFailure({
  message,
  failure,
}: {
  message: string | null
  failure: AuthErrorLike | null
}) {
  if (!isCredentialFailure(failure)) return <FormAlert message={message} />
  return (
    <div className="grid gap-2">
      <FormAlert message={AUTH_ERROR_MESSAGES.INVALID_EMAIL_OR_PASSWORD} />
      <SiteAccountsHint kind="signin" />
    </div>
  )
}
