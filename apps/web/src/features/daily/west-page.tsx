import type { NumberResult } from '@xuanxue/numerology'
import { cn } from '@xuanxue/ui'
import { useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { parseBirthDate } from '../tools/numerology/calc.ts'
import { tarotPath } from '../tools/tarot/routes.ts'
import { toolHref } from '../tools/tool-href.ts'
import { personalTip, reductionLines, universalLine } from './copy.ts'
import {
  browserDate,
  type CivilDate,
  dateKey,
  formatLongDate,
  parseDateKey,
  sameDate,
} from './date.ts'
import {
  type WestDayFacts,
  type WestPersonalFacts,
  westDayFacts,
  westPersonalFacts,
} from './facts.ts'
import { DAILY_NUMBERS, type WestRules } from './rules/types.ts'

export interface WestDailyData {
  readonly date: string
  readonly facts: WestDayFacts
}

/** 页面 loader：只由日期计算，不访问数据库与会话 */
export function loadWestDaily(date: CivilDate): WestDailyData {
  return { date: dateKey(date), facts: westDayFacts(date) }
}

/** 宇宙日的算式行（年、月、日分别归约后相加） */
export function universalSteps(facts: WestDayFacts): string[] {
  const date = parseDateKey(facts.date)
  if (!date) return []
  return reductionLines(facts.universal, [
    { phase: 'year', label: m.daily_west_step_year(), raw: date.year },
    { phase: 'month', label: m.daily_west_step_month(), raw: date.month },
    { phase: 'day', label: m.daily_west_step_day(), raw: date.day },
  ])
}

/**
 * 西方站公开每日数字页（原型 DailyMobile.dc.html）：宇宙日数与算式、个人日计算器（只在浏览器中计算）、
 * 1–9 与 11、22 的个人日含义。水合后按访客本地日期重算，numerology 代码很小，直接打包。
 */
export function WestDailyPage({ rules, data }: { rules: WestRules; data: WestDailyData }) {
  const [facts, setFacts] = useState(data.facts)
  const [local, setLocal] = useState(false)
  const date = parseDateKey(facts.date) ?? { year: 1970, month: 1, day: 1 }

  useEffect(() => {
    const today = browserDate()
    const reference = parseDateKey(data.date)
    if (!reference || sameDate(today, reference)) return
    setFacts(westDayFacts(today))
    setLocal(true)
  }, [data.date])

  const value = facts.universal.value
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pt-10 pb-16 sm:px-6">
      <section aria-labelledby="daily-h1" className="flex flex-col items-center gap-3 text-center">
        <p className="m-0 text-ink-subtle text-sm" data-testid="daily-date">
          {formatLongDate(date, 'en')} · {local ? m.daily_local_note() : m.daily_reference_note()}
        </p>
        <h1 id="daily-h1" className="m-0 font-heading font-semibold text-5xl text-ink">
          {m.daily_west_h1()}
        </h1>
        <div className="flex size-30 items-center justify-center rounded-full border-2 border-brand font-heading text-6xl text-brand">
          {value}
        </div>
        <p className="m-0 font-semibold text-ink">
          {m.daily_west_universal({ value: String(value) })} ·{' '}
          {rules.number[value as keyof WestRules['number']]?.keyword}
        </p>
        <div
          className="flex flex-col text-ink-muted text-sm tabular-nums"
          data-testid="daily-steps"
        >
          {universalSteps(facts).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <p className="m-0 max-w-xl text-base text-ink leading-relaxed">
          {universalLine(rules, value, facts.date)}
        </p>
      </section>

      <PersonalDayCalculator rules={rules} date={facts.date} />

      <section aria-labelledby="daily-meanings" className="flex flex-col gap-4">
        <h2 id="daily-meanings" className="m-0 font-heading font-semibold text-3xl text-ink">
          {m.daily_west_meanings_title()}
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {DAILY_NUMBERS.map((number) => {
            const tip = personalTip(rules, number, facts.date)
            return (
              <li
                key={number}
                id={`personal-day-${number}`}
                className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4"
              >
                <strong className="text-ink">
                  {m.daily_west_number_heading({
                    value: String(number),
                    keyword: rules.number[number].keyword,
                  })}
                </strong>
                <span className="text-ink text-sm leading-relaxed">{tip.theme}</span>
                <span className="text-ink-muted text-sm leading-relaxed">{tip.advice}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-label={m.daily_more_title()} className="flex flex-col gap-3">
        <MoreRow href={toolHref(tarotPath('daily', 'en'), 'en')}>
          {m.daily_west_more_tarot()}
        </MoreRow>
        <MoreRow href={toolHref('/numerology-calculator', 'en')}>
          {m.daily_west_more_reading()}
        </MoreRow>
      </section>

      <div className="flex flex-col gap-3">
        <Disclaimer />
        <p className="m-0 text-ink-subtle text-xs leading-relaxed">{m.daily_west_rules_note()}</p>
      </div>
    </div>
  )
}

function MoreRow({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-ink no-underline transition-colors hover:border-line-strong"
    >
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </a>
  )
}

/** 个人日计算器：出生日期只在浏览器中使用，不提交到服务器 */
function PersonalDayCalculator({ rules, date }: { rules: WestRules; date: string }) {
  const inputId = useId()
  const errorId = useId()
  const [birth, setBirth] = useState('')
  const today = parseDateKey(date)
  const parsed = parseBirthDate(birth)
  let result: WestPersonalFacts | null = null
  let invalid = false
  if (parsed && today) {
    try {
      result = westPersonalFacts(parsed, today)
    } catch {
      invalid = true
    }
  }
  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <h2 id={`${inputId}-title`} className="m-0 font-heading font-semibold text-3xl text-ink">
        {m.daily_west_pd_title()}
      </h2>
      <form
        aria-label={m.daily_west_pd_title()}
        method="post"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={inputId} className="flex flex-col gap-1.5 text-ink-muted text-sm">
          {m.daily_west_pd_label()}
          <input
            id={inputId}
            name="birthDate"
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={birth}
            onChange={(event) => setBirth(event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={errorId}
            className="min-h-11 w-full rounded-lg border border-line-strong bg-background px-3 text-base text-ink"
          />
        </label>
      </form>
      <p id={errorId} className="m-0 text-brand-ink text-sm empty:hidden">
        {invalid ? m.daily_form_invalid() : null}
      </p>
      {result && today ? (
        <PersonalResult rules={rules} result={result} today={today} />
      ) : (
        <p className="m-0 text-ink-muted text-sm">{m.daily_west_pd_hint()}</p>
      )}
      <p className="m-0 text-ink-subtle text-sm">
        {m.daily_profile_cta()}{' '}
        <a href="/app" className="font-semibold text-brand-ink">
          {m.daily_profile_cta_link()}
        </a>
      </p>
    </section>
  )
}

export function PersonalNumbers({
  result,
  className,
}: {
  result: WestPersonalFacts
  className?: string
}) {
  const tiles: [string, NumberResult, boolean][] = [
    [m.daily_west_personal_year(), result.personalYear, false],
    [m.daily_west_personal_month(), result.personalMonth, false],
    [m.daily_west_personal_day(), result.personalDay, true],
  ]
  return (
    <div className={cn('grid grid-cols-3 gap-2 text-center', className)}>
      {tiles.map(([label, value, current]) => (
        <div
          key={label}
          className={cn(
            'flex flex-col gap-0.5 rounded-xl bg-background px-1 py-3',
            current && 'border border-brand',
          )}
        >
          <span className="text-ink-subtle text-xs">{label}</span>
          <span className="font-heading text-3xl text-brand">{value.value}</span>
        </div>
      ))}
    </div>
  )
}

function PersonalResult({
  rules,
  result,
  today,
}: {
  rules: WestRules
  result: WestPersonalFacts
  today: CivilDate
}) {
  const tip = personalTip(rules, result.personalDay.value, dateKey(today))
  // 个人年 = 出生月 + 出生日 + 本年（各自归约）；个人月 = 个人年 + 本月；个人日 = 个人月 + 本日
  const year = `${m.daily_west_personal_year()}: ${reductionLines(result.personalYear, []).join(' → ')}`
  const month = `${m.daily_west_personal_month()}: ${reductionLines(result.personalMonth, []).join(' → ')}`
  const day = `${m.daily_west_personal_day()}: ${reductionLines(result.personalDay, []).join(' → ')}`
  return (
    <div className="flex flex-col gap-3" data-testid="daily-personal">
      <PersonalNumbers result={result} />
      <div className="flex flex-col text-ink-muted text-sm tabular-nums">
        <span>{year}</span>
        <span>{month}</span>
        <span>{day}</span>
      </div>
      <p className="m-0 text-base text-ink leading-relaxed">
        <strong>
          {m.daily_west_number_heading({
            value: String(result.personalDay.value),
            keyword:
              rules.number[result.personalDay.value as keyof WestRules['number']]?.keyword ?? '',
          })}
        </strong>{' '}
        {tip.theme}
      </p>
      <p className="m-0 text-ink-muted text-sm leading-relaxed">
        {tip.advice} {tip.caution}
      </p>
    </div>
  )
}
