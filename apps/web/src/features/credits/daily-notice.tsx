import { Link } from '@tanstack/react-router'
import { Button } from '@xuanxue/ui'
import { useEffect, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { siteAccountNames } from '../auth/site-account-names.ts'
import { siteOfLocale } from '../site/site.ts'
import type { DailyCreditsCheck } from './daily.server.ts'

type Granted = Extract<DailyCreditsCheck, { status: 'granted' }>

/** 到期时间按界面语言与浏览器时区显示；通知只在客户端 effect 后渲染，不产生水合差异 */
function formatExpiry(expiresAt: string) {
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return expiresAt
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  )
}

/** 由 UI 设计任务替换展示，领取和去重仍归 App 数据层。 */
export function DailyGrantNotice({
  credits,
  daysThisMonth,
  maxDaysPerMonth,
  expiresAt,
  onDismiss,
}: Omit<Granted, 'status' | 'grantId' | 'day'> & { onDismiss(): void }) {
  return (
    <section role="status" className="grid gap-2 rounded-xl border border-line p-4 text-sm">
      <p className="m-0">{m.daily_credits_granted({ credits, daysThisMonth, maxDaysPerMonth })}</p>
      <p className="m-0 text-ink-muted">
        {m.daily_credits_expiry({ expiresAt: formatExpiry(expiresAt) })}
      </p>
      <Button type="button" variant="outline" onClick={onDismiss}>
        {m.daily_credits_dismiss()}
      </Button>
    </section>
  )
}

export function DailyCreditsNotice({ result }: { result: DailyCreditsCheck | null }) {
  const [notice, setNotice] = useState<Granted | null>(null)
  useEffect(() => {
    if (result?.status !== 'granted') return
    // sessionStorage 不可用时保留本次通知，避免影响 App 的其他功能。
    try {
      const key = `daily-credits-notice:${result.grantId}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, 'shown')
    } catch {
      // 浏览器隐私策略可能拒绝存储。
    }
    setNotice(result)
  }, [result])

  if (result?.status === 'unverified')
    return (
      <p role="status">
        <Link to="/account" className="underline">
          {m.daily_credits_verify()}
        </Link>
      </p>
    )
  // 已领取 / 本月已满只在当天首次检查时返回（之后 KV 返回 cached），因此每天至多提示一次；
  // 同一邮箱两站共享额度（enable-subscriptions-daily-credits D6），提示中说明原因
  if (result?.status === 'already_claimed' || result?.status === 'monthly_limit') {
    const locale = getLocale()
    const names = siteAccountNames(siteOfLocale(locale, templateConfig) ?? 'west', locale)
    return (
      <p role="status" className="m-0 text-ink-muted text-sm">
        {result.status === 'already_claimed'
          ? m.daily_credits_already_claimed()
          : m.daily_credits_monthly_limit()}{' '}
        {m.daily_credits_shared_note(names)}
      </p>
    )
  }
  return notice ? <DailyGrantNotice {...notice} onDismiss={() => setNotice(null)} /> : null
}
