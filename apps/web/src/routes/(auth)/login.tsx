import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, useAppForm } from '@xuanxue/ui'
import { useState } from 'react'
import { z } from 'zod'
import {
  authClient,
  goAfterSignIn,
  signInCallbackURL,
  signInErrorCallbackURL,
} from '../../features/auth/auth-client.ts'
import {
  AuthDivider,
  AuthLayout,
  authLinkClassName,
  FormAlert,
  StatusAlert,
} from '../../features/auth/auth-layout.tsx'
import { authErrorMessage } from '../../features/auth/errors.ts'
import { OAuthButton } from '../../features/auth/oauth-button.tsx'
import { getAuthUiOptions } from '../../features/auth/options.functions.ts'
import type { AuthUiOptions } from '../../features/auth/options.ts'
import { SignInFailure } from '../../features/auth/site-accounts.tsx'
import { useTurnstile } from '../../features/auth/turnstile.tsx'
import { useAuthRequest } from '../../features/auth/use-auth-request.ts'
import { authPageHead } from '../../features/seo/metadata.ts'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'

/** 按当前请求或页面语言读取文案，避免在模块初始化时固定语言。 */
const COPY = {
  get metaTitle() {
    return m.auth_sign_in()
  },
  get title() {
    return m.auth_sign_in()
  },
  get description() {
    return m.auth_welcome_back_choose_how_you_want_to_sign()
  },
  get email() {
    return m.auth_email()
  },
  get password() {
    return m.auth_password()
  },
  get code() {
    return m.auth_verification_code()
  },
  get forgotPassword() {
    return m.auth_forgot_password_link()
  },
  get signIn() {
    return m.auth_sign_in()
  },
  get signingIn() {
    return m.auth_signing_in()
  },
  get sendCode() {
    return m.auth_send_code()
  },
  get sendingCode() {
    return m.auth_sending()
  },
  codeSent: (email: string) => m.auth_we_sent_a_6_digit_code_to_it({ email: email }),
  get useAnotherEmail() {
    return m.auth_use_a_different_email()
  },
  get sendLink() {
    return m.auth_send_magic_link()
  },
  get sendingLink() {
    return m.auth_sending()
  },
  linkSent: (email: string) => m.auth_check_for_a_sign_in_link({ email: email }),
  get or() {
    return m.auth_or()
  },
  modes: {
    get password() {
      return m.auth_sign_in_with_password()
    },
    get otp() {
      return m.auth_sign_in_with_email_code()
    },
    get magicLink() {
      return m.auth_sign_in_with_magic_link()
    },
  },
  get noAccount() {
    return m.auth_don_t_have_an_account()
  },
  get register() {
    return m.auth_sign_up()
  },
  get noMethods() {
    return m.auth_sign_in_is_not_available_right_now()
  },
  get invalidEmail() {
    return m.auth_enter_a_valid_email_address()
  },
  get passwordRequired() {
    return m.auth_enter_your_password()
  },
  get invalidCode() {
    return m.auth_enter_the_6_digit_code()
  },
} as const

type Mode = keyof typeof COPY.modes

export const Route = createFileRoute('/(auth)/login')({
  // OAuth / 魔法链接失败时 Better Auth 把错误码放在 ?error= 中带回登录页
  validateSearch: z.object({ error: z.string().optional(), redirect: z.string().optional() }),
  loader: () => getAuthUiOptions(),
  head: () => authPageHead('/login', getLocale(), COPY.metaTitle),
  component: LoginPage,
})

function enabledModes(options: AuthUiOptions): Mode[] {
  return [
    ...(options.emailPassword ? (['password'] as const) : []),
    ...(options.emailOtp ? (['otp'] as const) : []),
    ...(options.magicLink ? (['magicLink'] as const) : []),
  ]
}

function LoginPage() {
  const options = Route.useLoaderData()
  const { error: callbackError } = Route.useSearch()
  const modes = enabledModes(options)
  const [mode, setMode] = useState<Mode | undefined>(modes[0])
  const otherModes = modes.filter((m) => m !== mode)
  const hasAny = modes.length > 0 || options.oauth.length > 0

  return (
    <AuthLayout
      title={COPY.title}
      description={COPY.description}
      footer={
        options.emailPassword ? (
          <p>
            {COPY.noAccount}{' '}
            <Link to="/register" className={authLinkClassName}>
              {COPY.register}
            </Link>
          </p>
        ) : null
      }
    >
      {callbackError ? <FormAlert message={authErrorMessage(callbackError)} /> : null}
      {!hasAny ? <FormAlert message={COPY.noMethods} /> : null}

      {/* 第三方登录放在最上方：一键入口优先，邮箱表单作为备选 */}
      {options.oauth.length > 0 ? (
        <div className="grid gap-2">
          {options.oauth.map((provider) => (
            <OAuthButton key={provider} provider={provider} />
          ))}
        </div>
      ) : null}
      {options.oauth.length > 0 && mode !== undefined ? (
        <AuthDivider>{m.auth_divider_email()}</AuthDivider>
      ) : null}

      {mode === 'password' ? <PasswordSignIn siteKey={options.turnstileSiteKey} /> : null}
      {mode === 'otp' ? <OtpSignIn siteKey={options.turnstileSiteKey} /> : null}
      {mode === 'magicLink' ? <MagicLinkSignIn siteKey={options.turnstileSiteKey} /> : null}

      {otherModes.length > 0 ? (
        <>
          <AuthDivider>{COPY.or}</AuthDivider>
          <div className="grid gap-2">
            {otherModes.map((other) => (
              <Button key={other} type="button" variant="outline" onClick={() => setMode(other)}>
                {COPY.modes[other]}
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </AuthLayout>
  )
}

const emailSchema = () => z.email(COPY.invalidEmail)

function PasswordSignIn({ siteKey }: { siteKey: string | null }) {
  const turnstile = useTurnstile(siteKey, 'sign-in')
  const { error, failure, run } = useAuthRequest(turnstile)
  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: {
      onSubmit: z.object({
        email: emailSchema(),
        password: z.string().min(1, COPY.passwordRequired),
      }),
    },
    onSubmit: async ({ value }) => {
      const data = await run((headers) =>
        authClient().signIn.email({
          ...value,
          // Verification links and successful sign-in resume the same local destination.
          callbackURL: signInCallbackURL(),
          fetchOptions: { headers },
        }),
      )
      if (data) goAfterSignIn()
    },
  })
  return (
    <form.AppForm>
      <form.Form aria-label={COPY.modes.password}>
        <SignInFailure message={error} failure={failure} />
        <form.AppField name="email">
          {(field) => <field.TextField label={COPY.email} type="email" autoComplete="email" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={COPY.password}
              type="password"
              autoComplete="current-password"
            />
          )}
        </form.AppField>
        {/* 忘记密码贴在密码框下方右侧，比放在页脚更容易被找到 */}
        <div className="-mt-2 flex justify-end">
          <Link
            to="/forgot-password"
            className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            {COPY.forgotPassword}
          </Link>
        </div>
        {turnstile.widget}
        <form.SubmitButton pendingLabel={COPY.signingIn} disabled={!turnstile.ready}>
          {COPY.signIn}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}

function OtpSignIn({ siteKey }: { siteKey: string | null }) {
  const [email, setEmail] = useState<string | null>(null)
  return email === null ? (
    <OtpRequest siteKey={siteKey} onSent={setEmail} />
  ) : (
    <OtpVerify siteKey={siteKey} email={email} onBack={() => setEmail(null)} />
  )
}

function OtpRequest({
  siteKey,
  onSent,
}: {
  siteKey: string | null
  onSent: (email: string) => void
}) {
  const turnstile = useTurnstile(siteKey, 'send-otp')
  const { error, run } = useAuthRequest(turnstile)
  const form = useAppForm({
    defaultValues: { email: '' },
    validators: { onSubmit: z.object({ email: emailSchema() }) },
    onSubmit: async ({ value }) => {
      const data = await run((headers) =>
        authClient().emailOtp.sendVerificationOtp({
          email: value.email,
          type: 'sign-in',
          fetchOptions: { headers },
        }),
      )
      if (data) onSent(value.email)
    },
  })
  return (
    <form.AppForm>
      <form.Form aria-label={COPY.modes.otp}>
        <FormAlert message={error} />
        <form.AppField name="email">
          {(field) => <field.TextField label={COPY.email} type="email" autoComplete="email" />}
        </form.AppField>
        {turnstile.widget}
        <form.SubmitButton pendingLabel={COPY.sendingCode} disabled={!turnstile.ready}>
          {COPY.sendCode}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}

function OtpVerify({
  siteKey,
  email,
  onBack,
}: {
  siteKey: string | null
  email: string
  onBack: () => void
}) {
  const turnstile = useTurnstile(siteKey, 'sign-in-otp')
  const { error, run } = useAuthRequest(turnstile)
  const form = useAppForm({
    defaultValues: { otp: '' },
    validators: { onSubmit: z.object({ otp: z.string().regex(/^\d{6}$/, COPY.invalidCode) }) },
    onSubmit: async ({ value }) => {
      const data = await run((headers) =>
        authClient().signIn.emailOtp({ email, otp: value.otp, fetchOptions: { headers } }),
      )
      if (data) goAfterSignIn()
    },
  })
  return (
    <form.AppForm>
      <form.Form aria-label={COPY.modes.otp}>
        <StatusAlert>{COPY.codeSent(email)}</StatusAlert>
        <FormAlert message={error} />
        <form.AppField name="otp">
          {(field) => (
            <field.TextField
              label={COPY.code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          )}
        </form.AppField>
        {turnstile.widget}
        <form.SubmitButton pendingLabel={COPY.signingIn} disabled={!turnstile.ready}>
          {COPY.signIn}
        </form.SubmitButton>
        <Button type="button" variant="link" onClick={onBack}>
          {COPY.useAnotherEmail}
        </Button>
      </form.Form>
    </form.AppForm>
  )
}

function MagicLinkSignIn({ siteKey }: { siteKey: string | null }) {
  const turnstile = useTurnstile(siteKey, 'magic-link')
  const { error, run } = useAuthRequest(turnstile)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { email: '' },
    validators: { onSubmit: z.object({ email: emailSchema() }) },
    onSubmit: async ({ value }) => {
      const data = await run((headers) =>
        authClient().signIn.magicLink({
          email: value.email,
          callbackURL: signInCallbackURL(),
          errorCallbackURL: signInErrorCallbackURL(),
          fetchOptions: { headers },
        }),
      )
      if (data) setSentTo(value.email)
    },
  })
  if (sentTo !== null) return <StatusAlert>{COPY.linkSent(sentTo)}</StatusAlert>
  return (
    <form.AppForm>
      <form.Form aria-label={COPY.modes.magicLink}>
        <FormAlert message={error} />
        <form.AppField name="email">
          {(field) => <field.TextField label={COPY.email} type="email" autoComplete="email" />}
        </form.AppField>
        {turnstile.widget}
        <form.SubmitButton pendingLabel={COPY.sendingLink} disabled={!turnstile.ready}>
          {COPY.sendLink}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
