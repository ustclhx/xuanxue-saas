import { PageWidth } from '@xuanxue/ui/project'
import { useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { DateField } from '../tools/date-field.tsx'
import { dateValueComplete } from '../tools/date-parts.ts'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { parseBirthDate } from '../tools/numerology/calc.ts'
import { LIFE_PATH_TOOL_PATH, NUMEROLOGY_TOOLS } from '../tools/numerology/routes.ts'
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
import type { WestDailyData } from './load.ts'
import { PersonalNumbers } from './personal-numbers.tsx'
import { DAILY_NUMBERS, type WestRules } from './rules/types.ts'

export { loadWestDaily, type WestDailyData } from './load.ts'

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
 * 西方站公开每日数字页（设计稿 warm-refresh/DailyWest.dc.html）：宇宙日数与算式、个人日计算器（只在浏览器中计算）、
 * 1–9 与 11、22 的个人日含义、计算说明与正文内链。水合后按访客本地日期重算，numerology 代码很小，直接打包。
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
    <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
      <header className="flex flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
        <p role="note" className="m-0 text-caption text-ink-subtle" data-testid="daily-date">
          {formatLongDate(date, 'en')} · {local ? m.daily_local_note() : m.daily_reference_note()}
        </p>
        <h1 id="daily-h1" className="m-0 text-balance font-heading text-ink text-title">
          {m.daily_west_h1()}
        </h1>
        <div className="mt-2 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
          {/* 数字环与 Life Path 结果卡同一画法：两道插画线同心环，数字用 display */}
          <span className="relative flex size-33 shrink-0 items-center justify-center rounded-full border border-illus">
            <span
              aria-hidden="true"
              className="absolute inset-3 rounded-full border border-illus/55"
            />
            <span className="font-bold font-heading text-display text-ink">{value}</span>
          </span>
          <div className="flex min-w-0 max-w-180 flex-col gap-2">
            <p className="m-0 font-heading text-ink text-subtitle">
              {m.daily_west_universal({ value: String(value) })} ·{' '}
              {rules.number[value as keyof WestRules['number']]?.keyword}
            </p>
            <div
              className="flex flex-col wrap-anywhere text-caption text-ink-subtle tabular-nums"
              data-testid="daily-steps"
            >
              {universalSteps(facts).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <p className="m-0 text-body text-ink-muted">
              {universalLine(rules, value, facts.date)}
            </p>
          </div>
        </div>
      </header>

      <PersonalDayCalculator rules={rules} date={facts.date} />

      <section aria-labelledby="daily-meanings" className="flex flex-col gap-6">
        <h2 id="daily-meanings" className="m-0 text-balance font-heading text-ink text-title">
          {m.daily_west_meanings_title()}
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {DAILY_NUMBERS.map((number) => {
            const tip = personalTip(rules, number, facts.date)
            return (
              <li
                key={number}
                id={`personal-day-${number}`}
                className="flex flex-col gap-1.5 rounded-object bg-surface p-6"
              >
                <strong className="font-medium text-body text-ink">
                  {m.daily_west_number_heading({
                    value: String(number),
                    keyword: rules.number[number].keyword,
                  })}
                </strong>
                <span className="text-body text-ink">{tip.theme}</span>
                <span className="text-body text-ink-muted">{tip.advice}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 正文内链（设计稿 warm-refresh/DailyWest.dc.html）：H2 之后的一段话里链接三个相关页面，不另设链接行 */}
      <article className="flex max-w-180 flex-col gap-5">
        <h2 className="m-0 text-balance font-heading text-ink text-title">
          {m.daily_west_how_title()}
        </h2>
        <p className="m-0 text-body text-ink-muted">{m.daily_west_how_body()}</p>
        <h2 className="m-0 mt-5 text-balance font-heading text-ink text-title">
          {m.daily_more_title()}
        </h2>
        <p className="m-0 text-body text-ink-muted">
          {m.daily_west_go_1()}
          <a href={toolHref(LIFE_PATH_TOOL_PATH, 'en')} className={bodyLink}>
            {m.daily_west_go_life_path()}
          </a>
          {m.daily_west_go_2()}
          <a
            href={toolHref(NUMEROLOGY_TOOLS['numerology-calculator'].path, 'en')}
            className={bodyLink}
          >
            {m.daily_west_go_calculator()}
          </a>
          {m.daily_west_go_3()}
          <a href={toolHref(tarotPath('daily', 'en'), 'en')} className={bodyLink}>
            {m.daily_west_go_tarot()}
          </a>
          {m.daily_west_go_4()}
        </p>
      </article>

      <div className="flex flex-col gap-3">
        <Disclaimer />
        <p role="note" className="m-0 max-w-180 text-caption text-ink-subtle">
          {m.daily_west_rules_note()}
        </p>
      </div>
    </PageWidth>
  )
}

/** 正文内链接：与正文同色并始终带下划线（text-brand-ink 的 <a> 由 brand.css 加下划线） */
const bodyLink = 'text-brand-ink hover:decoration-2'

/** 个人日计算器：出生日期只在浏览器中使用，不提交到服务器 */
function PersonalDayCalculator({ rules, date }: { rules: WestRules; date: string }) {
  const inputId = useId()
  const errorId = useId()
  const [birth, setBirth] = useState('')
  const today = parseDateKey(date)
  const parsed = parseBirthDate(birth)
  let result: WestPersonalFacts | null = null
  // 三段都填了却解析不出（如 13 月）也提示，与日期不存在一致
  let invalid = !parsed && dateValueComplete(birth)
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
      className="flex max-w-190 flex-col gap-4 rounded-object bg-surface p-6 shadow-raise sm:p-8"
    >
      <h2 id={`${inputId}-title`} className="m-0 font-heading text-ink text-subtitle">
        {m.daily_west_pd_title()}
      </h2>
      <form
        aria-label={m.daily_west_pd_title()}
        method="post"
        onSubmit={(event) => event.preventDefault()}
      >
        <DateField
          label={m.daily_west_pd_label()}
          name="birthDate"
          onValueChange={setBirth}
          invalid={invalid}
          describedBy={errorId}
          inputClassName="bg-background"
        />
      </form>
      <p id={errorId} className="m-0 text-caption text-danger empty:hidden">
        {invalid ? m.daily_form_invalid() : null}
      </p>
      {result && today ? (
        <PersonalResult rules={rules} result={result} today={today} />
      ) : (
        <p role="note" className="m-0 text-caption text-ink-subtle">
          {m.daily_west_pd_hint()}
        </p>
      )}
      {/* 设计稿中这一句是说明文字，不放链接：登录入口在页头 */}
      <p role="note" className="m-0 text-caption text-ink-subtle">
        {m.daily_profile_cta()}
      </p>
    </section>
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
      <div className="flex flex-col wrap-anywhere text-caption text-ink-subtle tabular-nums">
        <span>{year}</span>
        <span>{month}</span>
        <span>{day}</span>
      </div>
      <p className="m-0 text-body text-ink">
        <strong className="font-medium">
          {m.daily_west_number_heading({
            value: String(result.personalDay.value),
            keyword:
              rules.number[result.personalDay.value as keyof WestRules['number']]?.keyword ?? '',
          })}
        </strong>{' '}
        {tip.theme}
      </p>
      <p className="m-0 text-body text-ink-muted">
        {tip.advice} {tip.caution}
      </p>
    </div>
  )
}
