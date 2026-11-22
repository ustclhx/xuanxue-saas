import { useNavigate } from '@tanstack/react-router'
import { cn } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { type FormEvent, useEffect, useId, useState } from 'react'
import { type CivilDate, dateKey, parseDateKey } from '../../daily/date.ts'
import { DateField } from '../../tools/date-field.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import type { AlmanacToolPayload } from './almanac.functions.ts'
import { ALMANAC_COPY as copy, monthTitleMain } from './copy.ts'
import { ALMANAC_YEAR_RANGE, type AlmanacToolDay, parseAlmanacDate } from './model.ts'
import {
  AlmanacDisclaimer,
  AlmanacHeader,
  AlmanacProse,
  bodyLink,
  Mark,
  secondaryButton,
  Tile,
  TodayTag,
} from './parts.tsx'
import { ALMANAC_LOCALE, ALMANAC_MONTHS, ALMANAC_TOOL_PATH, almanacMonthPath } from './paths.ts'

const href = (path: string) => toolHref(path, ALMANAC_LOCALE)

function shiftDate(date: CivilDate, days: number): string {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return dateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })
}

const readable = (key: string) => {
  const date = parseDateKey(key)
  return date ? `${date.year} 年 ${date.month} 月 ${date.day} 日` : key
}

/**
 * 黄历工具页（设计稿 content-growth-phase2/AlmanacTool、AlmanacToolStates）：日期选择写入 `?date=`，
 * 服务端按北京时间计算并输出结果；带参数时 head 为 noindex, follow（head.ts）。表单是 GET 表单，
 * 禁用脚本时也能查询；有脚本时经路由导航，只重跑 loader，结果区显示骨架块。
 */
export function AlmanacToolPage({ payload }: { payload: AlmanacToolPayload }) {
  const navigate = useNavigate()
  const errorId = useId()
  const { result } = payload
  const selected = result?.date ?? payload.today
  const [pending, setPending] = useState<string | null>(null)
  const [clientError, setClientError] = useState(false)
  // 新结果到达后结束加载态
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在结果日期变化时重置
  useEffect(() => {
    setPending(null)
    setClientError(false)
  }, [selected, payload.query])

  const go = (date: string) => {
    if (!parseAlmanacDate(date)) {
      setClientError(true)
      return
    }
    setClientError(false)
    setPending(date)
    void navigate({
      to: '.',
      search: (date === payload.today ? {} : { date }) as never,
      resetScroll: false,
    }).catch(() => setPending(null))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    go(String(new FormData(event.currentTarget).get('date') ?? ''))
  }
  const base = parseDateKey(selected)
  const invalid = clientError || result === null

  return (
    <PageWidth className="flex flex-col gap-10 pb-16 sm:gap-14 sm:pb-28">
      <AlmanacHeader
        crumbs={[{ name: copy.home, href: href('/') }, { name: copy.toolCrumb }]}
        title={copy.toolH1}
      >
        <p className="m-0">{payload.intro}</p>
      </AlmanacHeader>

      <form
        method="get"
        action={href(ALMANAC_TOOL_PATH)}
        aria-label={copy.dateLabel}
        onSubmit={submit}
        className="flex max-w-190 flex-col gap-3 rounded-object bg-surface p-5 shadow-raise sm:p-6"
      >
        <div className="flex flex-wrap items-end gap-3">
          <DateField
            key={selected}
            label={copy.dateLabel}
            name="date"
            defaultValue={result ? selected : (payload.requested ?? selected)}
            invalid={invalid}
            describedBy={invalid ? errorId : undefined}
            className="min-w-55 flex-1 basis-55"
          />
          <div className="flex w-full gap-3 sm:w-auto">
            <button
              type="button"
              className={cn(secondaryButton, 'flex-1 sm:flex-none')}
              disabled={!base}
              onClick={() => base && go(shiftDate(base, -1))}
            >
              {copy.previousDay}
            </button>
            <button
              type="button"
              className={cn(secondaryButton, 'flex-1 sm:flex-none')}
              disabled={!base}
              onClick={() => base && go(shiftDate(base, 1))}
            >
              {copy.nextDay}
            </button>
            <button
              type="submit"
              className="inline-flex min-h-12 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-primary px-5 font-medium text-body text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:flex-none"
            >
              {copy.submit}
            </button>
          </div>
        </div>
        {invalid && (
          <p id={errorId} role="alert" className="m-0 flex gap-1.5 text-caption text-danger">
            {copy.invalid(ALMANAC_YEAR_RANGE[0], ALMANAC_YEAR_RANGE[1])}
          </p>
        )}
        <p className="m-0 text-caption text-ink-subtle">{copy.hint}</p>
      </form>

      {pending ? (
        <ResultSkeleton date={readable(pending)} />
      ) : result ? (
        <ToolResult day={result} today={payload.today} query={payload.query} />
      ) : (
        <section aria-label={copy.errorAlert} className="flex max-w-190 flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-field bg-surface-2 px-4 py-3 text-body text-ink">
            <p className="m-0">{copy.errorAlert}</p>
          </div>
          <a href={href(ALMANAC_TOOL_PATH)} className={cn(bodyLink, 'min-h-11 content-center')}>
            {copy.backToToday}
          </a>
        </section>
      )}

      <article className="flex max-w-180 flex-col gap-5">
        <AlmanacProse html={payload.html} />
        <p className="m-0 text-body text-ink-muted">
          {(() => {
            const text = copy.monthLinks(
              monthTitleMain(payload.months.current),
              monthTitleMain(payload.months.next),
            )
            return (
              <>
                {text.before}
                <a href={href(almanacMonthPath(payload.months.current))} className={bodyLink}>
                  {text.current}
                </a>
                {text.middle}
                <a href={href(almanacMonthPath(payload.months.next))} className={bodyLink}>
                  {text.next}
                </a>
                {text.after}
              </>
            )
          })()}
        </p>
      </article>

      <section aria-labelledby="almanac-months" className="flex max-w-190 flex-col gap-5">
        <h2 id="almanac-months" className="m-0 text-balance font-heading text-ink text-title">
          {copy.monthsTitle}
        </h2>
        <p className="m-0 max-w-180 text-body text-ink-muted">{copy.monthsIntro}</p>
        {/* 月份网格是枢纽列表（模板区块），不计入正文内链 */}
        <nav
          aria-label={copy.monthsNav}
          data-link-zone="related"
          className="grid grid-cols-4 gap-2 sm:grid-cols-6"
        >
          {ALMANAC_MONTHS.map((month) => {
            const current = month === payload.months.current
            return (
              <a
                key={month}
                href={href(almanacMonthPath(month))}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'flex min-h-14 items-center justify-center rounded-field bg-surface font-medium text-body text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  current && 'ring-1 ring-mark ring-inset',
                )}
              >
                {month}月
              </a>
            )
          })}
        </nav>
      </section>

      <ToolFaq
        title={copy.faqTitle}
        items={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      />
    </PageWidth>
  )
}

function ToolResult({ day, today, query }: { day: AlmanacToolDay; today: string; query: boolean }) {
  const [copied, setCopied] = useState(false)
  const isToday = day.date === today
  const copyLink = () => {
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('date', day.date)
    void navigator.clipboard?.writeText(url.href).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }
  const separator = '、'
  return (
    <section
      data-locale-fixed
      aria-label={copy.resultLabel}
      aria-live="polite"
      className="flex max-w-190 flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-ink-subtle">
          <span>{day.caption}</span>
          {isToday && <TodayTag />}
        </p>
        <h2 className="m-0 font-heading text-ink text-title">{`${day.pillars.day}日`}</h2>
        <div className="grid w-full max-w-90 grid-cols-3 gap-2">
          {(
            [
              [copy.pillarYear, day.pillars.year],
              [copy.pillarMonth, day.pillars.month],
              [copy.pillarDay, day.pillars.day],
            ] as const
          ).map(([label, value], index) => (
            <div
              key={label}
              className={cn(
                'flex flex-col items-center gap-1 rounded-field bg-surface-2 px-1 py-3',
                index === 2 && 'ring-1 ring-mark ring-inset',
              )}
            >
              <span className="text-caption text-ink-subtle">{label}</span>
              <span className="font-bold font-heading text-ink text-title">{value}</span>
            </div>
          ))}
        </div>
        {query && !isToday && (
          <p className="m-0 flex flex-wrap items-center gap-x-3 text-body text-ink-muted">
            <span>{copy.queryNote}</span>
            <a href={href(ALMANAC_TOOL_PATH)} className={cn(bodyLink, 'min-h-11 content-center')}>
              {copy.backToToday}
            </a>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-object bg-surface p-5">
          <h3 className="m-0 font-heading text-ink text-subtitle">{copy.yi}</h3>
          <p
            className={cn(
              'm-0 text-body',
              day.recommends.length ? 'text-ink-muted' : 'text-ink-subtle',
            )}
          >
            {day.recommends.join(separator) || copy.empty}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-object bg-surface p-5">
          <h3 className="m-0 font-heading text-ink text-subtitle">{copy.ji}</h3>
          <p
            className={cn(
              'm-0 text-body',
              day.avoids.length ? 'text-ink-muted' : 'text-ink-subtle',
            )}
          >
            {day.avoids.join(separator) || copy.empty}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Tile label={copy.dutyLabel} value={copy.dutyValue(day.duty.name)}>
          {day.duty.gloss}
        </Tile>
        <Tile
          label={copy.starLabel}
          value={
            <>
              <span>{day.star.name}</span>
              <Mark>{day.star.ecliptic}</Mark>
            </>
          }
        >
          {day.star.gloss}
        </Tile>
        <Tile label={copy.clashLabel} value={copy.clashValue(day.clash.zodiac, day.clash.sha)}>
          {day.clash.gloss}
        </Tile>
        <Tile
          label={copy.termLabel}
          value={
            <>
              <span>{day.term.name}</span>
              {day.marks.map((mark) => (
                <Mark key={mark}>{mark}</Mark>
              ))}
            </>
          }
        >
          {day.termNote}
        </Tile>
      </div>

      <div className="flex flex-col items-start gap-1">
        <button type="button" className={secondaryButton} onClick={copyLink}>
          {copied ? copy.copied : copy.copyLink}
        </button>
        <p className="m-0 text-caption text-ink-subtle">{copy.copyHint}</p>
      </div>
      <AlmanacDisclaimer />
    </section>
  )
}

function ResultSkeleton({ date }: { date: string }) {
  const block = 'block rounded-object bg-surface-2'
  return (
    <section
      aria-busy="true"
      aria-label={copy.loading(date)}
      className="flex max-w-190 flex-col gap-6"
    >
      <p className="m-0 text-caption text-ink-subtle">{copy.loading(date)}</p>
      <span className="block h-10 w-40 rounded-field bg-surface-2" />
      <span className="block h-26 w-full max-w-90 rounded-field bg-surface-2" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <span className={cn(block, 'h-37')} />
        <span className={cn(block, 'h-37')} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((key) => (
          <span key={key} className={cn(block, 'h-33')} />
        ))}
      </div>
    </section>
  )
}
