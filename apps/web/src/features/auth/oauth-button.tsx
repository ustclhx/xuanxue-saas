import { Button } from '@xuanxue/ui'
import { type ReactNode, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { authClient, signInCallbackURL, signInErrorCallbackURL } from './auth-client.ts'
import { FormAlert } from './auth-layout.tsx'
import { authErrorMessage } from './errors.ts'
import type { AuthUiOptions } from './options.ts'

export function OAuthButton({ provider }: { provider: AuthUiOptions['oauth'][number] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const onClick = async () => {
    setPending(true)
    setError(null)
    // OAuth callbacks use the same validated destination as password and OTP sign-in.
    const { data, error } = await authClient().signIn.social({
      provider,
      callbackURL: signInCallbackURL(),
      errorCallbackURL: signInErrorCallbackURL(),
    })
    if (data?.url) {
      window.location.assign(data.url)
      return
    }
    setPending(false)
    setError(authErrorMessage(error))
  }
  return (
    <>
      <Button type="button" variant="outline" disabled={pending} onClick={onClick}>
        {OAUTH_ICONS[provider]}
        {provider === 'google' ? m.auth_continue_with_google() : m.auth_continue_with_github()}
      </Button>
      <FormAlert message={error} />
    </>
  )
}

// 提供方标识用内联 SVG，避免为两个图标引入图标库；aria-hidden，按钮名称仍取文字
const OAUTH_ICONS: Record<AuthUiOptions['oauth'][number], ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3Z" />
    </svg>
  ),
}
