import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { authClient } from '../auth/auth-client.ts'
import { claimSignupBonus } from './signup.functions.ts'

export function SignupBonusSection({
  verified,
  email,
  credits,
}: {
  email: string
  verified: boolean
  credits: number
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (credits <= 0) return null
  async function claim() {
    setBusy(true)
    setMessage('')
    try {
      if (!verified) {
        const result = await authClient().sendVerificationEmail({ email, callbackURL: '/account' })
        if (result.error)
          throw new Error(result.error.message ?? 'Unable to send verification email')
        setMessage(m.billing_signup_verification_sent())
      } else {
        const result = await claimSignupBonus()
        setMessage(
          result.status === 'granted'
            ? m.billing_signup_granted({ credits: result.credits })
            : result.status === 'already_claimed'
              ? m.billing_signup_already_claimed()
              : result.status === 'blacklisted'
                ? m.billing_signup_blacklisted()
                : result.status === 'unverified'
                  ? m.billing_signup_unverified()
                  : m.billing_signup_unavailable(),
        )
      }
    } catch {
      setMessage(m.billing_signup_error())
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border p-6">
      <h2 className="font-semibold">{m.billing_signup_title()}</h2>
      <p>
        {verified
          ? m.billing_signup_verified_notice()
          : m.billing_signup_verification_notice({ credits })}
      </p>
      <Button type="button" disabled={!ready || busy} onClick={() => void claim()}>
        {busy
          ? m.billing_signup_wait()
          : verified
            ? m.billing_signup_claim()
            : m.billing_signup_verify({ credits })}
      </Button>
      {message && <p role="status">{message}</p>}
    </section>
  )
}
