import { Alert, AlertDescription, cn, LinkCard, SeriesNav } from '@xuanxue/ui'
import { FactTable, PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { MOON_COPY as copy, PHASE_ORDER } from './copy.ts'
import {
  type CivilMonth,
  clockTime,
  daysBetween,
  fullDate,
  fullMoons,
  isValidTimeZone,
  isWaxing,
  longDate,
  type MoonDayView,
  type MoonPhaseKey,
  type MoonQuarterEvent,
  type MoonTable,
  monthEvents,
  monthGrid,
  moonAgeAt,
  moonDay,
  moonLitPath,
  nextEvent,
  shortDate,
  UTC,
  zonedDateKey,
} from './model.ts'
import type { MoonPayload } from './moon.functions.ts'
import { MOON_LOCALE, MOON_YEAR_PARAM, moonMonthPath } from './paths.ts'

/**
 * 月相页（设计稿 docs/design/prototypes/content-growth-v2-tools/MoonToday.dc.html、MoonTodayEdge.dc.html 与
 * Proposals.dc.html「MoonPhase、MonthGrid」，使用者 2026-11-23 确认）。只用 @xuanxue/ui 组件与设计 token。
 *
 * 数据是构建期预计算表（服务端经内容集合下发）：HTML 预渲染为构建日的 UTC 视图，水合后按访客时区与当天重算，
 * 浏览器不加载 astronomy-engine。时区读不到时保留 UTC 并提示（设计稿 UTC 回退态）。
 */

const href = (path: string) => toolHref(path, MOON_LOCALE)
const h2 = 'm-0 text-balance font-heading text-ink text-title'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const caption = 'm-0 text-caption text-ink-subtle'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'
const badge = 'rounded-full border border-line px-2 py-0.5 text-caption text-ink-subtle'

interface Clock {
  readonly timeZone: string
  readonly nowMs: number
  readonly today: string
  /** initial：服务端与水合首帧（UTC 构建日）；local：已按访客时区；utc：读不到时区 */
  readonly state: 'initial' | 'local' | 'utc'
}

function useVisitorClock(payload: MoonPayload): Clock {
  const [clock, setClock] = useState<Clock>({
    timeZone: UTC,
    nowMs: payload.nowMs,
    today: payload.asOf,
    state: 'initial',
  })
  useEffect(() => {
    let zone: unknown
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      zone = undefined
    }
    const nowMs = Date.now()
    const timeZone = isValidTimeZone(zone) ? zone : UTC
    setClock({
      timeZone,
      nowMs,
      today: zonedDateKey(nowMs, timeZone),
      state: isValidTimeZone(zone) ? 'local' : 'utc',
    })
  }, [])
  return clock
}

/** 月相图（设计稿 MoonPhase）：暗面 surface-2 描边 line-strong，亮面 mark（西方站为黄铜色） */
export function MoonPhaseIcon({
  illumination,
  waxing,
  label,
  className,
}: {
  illumination: number
  waxing: boolean
  label?: string
  className?: string
}) {
  const lit = moonLitPath(illumination, waxing)
  const shapes = (
    <>
      <circle
        cx="70"
        cy="70"
        r="60"
        className="fill-surface-2 stroke-line-strong"
        strokeWidth={1}
      />
      {lit === 'full' ? (
        <circle cx="70" cy="70" r="60" className="fill-mark" />
      ) : lit ? (
        <path d={lit} className="fill-mark" />
      ) : null}
    </>
  )
  return label ? (
    <svg viewBox="0 0 140 140" role="img" className={cn('block shrink-0', className)}>
      <title>{label}</title>
      {shapes}
    </svg>
  ) : (
    <svg viewBox="0 0 140 140" aria-hidden="true" className={cn('block shrink-0', className)}>
      {shapes}
    </svg>
  )
}

function phaseLabel(view: Pick<MoonDayView, 'phase' | 'illumination'>) {
  return `${copy.phase(view.phase)}, ${Math.round(view.illumination * 100)}% illuminated`
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <PageWidth className="flex flex-col gap-10 pb-16 sm:gap-14 sm:pb-28">{children}</PageWidth>
    </MarketingShell>
  )
}

function Header({
  breadcrumb,
  heading,
  lede,
}: {
  breadcrumb: readonly PageLink[]
  heading: string
  lede: string
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      <Breadcrumb
        items={[
          ...breadcrumb.map((item) => ({ name: item.label, href: href(item.href) })),
          { name: heading },
        ]}
      />
      <h1 className="m-0 text-balance font-heading text-ink text-title">{heading}</h1>
      <p className="m-0 text-body text-ink-muted">{lede}</p>
    </header>
  )
}

function UtcAlert({ clock }: { clock: Clock }) {
  if (clock.state !== 'utc') return null
  return (
    <Alert className="max-w-190">
      <AlertDescription>{copy.utcAlert}</AlertDescription>
    </Alert>
  )
}

function ProseSection({ title, html }: { title: string; html: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex max-w-180 flex-col gap-5">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <RichContent html={html} />
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className={caption}>{label}</dt>
      <dd className="m-0 font-heading text-heading text-ink">{children}</dd>
    </div>
  )
}

function Related({ items }: { items: readonly PageLink[] }) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <nav data-link-zone="related" aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 font-heading text-heading text-ink">
        {copy.relatedTitle}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.href} className="flex min-w-0">
            <LinkCard href={href(item.href)} title={item.label} className="w-full" />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer({ payload }: { payload: MoonPayload }) {
  return (
    <>
      <ToolFaq
        title={copy.faqTitle}
        items={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      />
      <Related items={payload.related} />
      <p role="note" className={cn(caption, 'max-w-180')}>
        {copy.disclaimer}
      </p>
    </>
  )
}

/** 当地日期的说明行：首帧为构建日（UTC），之后为访客当天 */
function DateLine({ clock }: { clock: Clock }) {
  const zone = clock.state === 'local' ? copy.localNote : copy.utcNote
  return (
    <p className={caption}>
      {clock.state === 'initial' ? copy.asOf(longDate(clock.today)) : longDate(clock.today)}
      {` · ${zone}`}
    </p>
  )
}

function eventWhen(event: MoonQuarterEvent | null, clock: Clock): string {
  if (!event) return '—'
  const days = daysBetween(clock.today, zonedDateKey(event.utcMs, clock.timeZone))
  return `${shortDate(event.utcMs, clock.timeZone)} · ${copy.inDays(days)}`
}

// ---------------------------------------------------------------------------
// 月历网格（设计稿 MonthGrid）
// ---------------------------------------------------------------------------

function MonthGrid({ table, month, clock }: { table: MoonTable; month: CivilMonth; clock: Clock }) {
  const { leading, cells } = monthGrid(table, month, clock.timeZone)
  const title = `${copy.month(month.month)} ${month.year}`
  return (
    <div data-locale-fixed="" className="flex max-w-190 flex-col gap-1">
      <div aria-hidden="true" className="grid grid-cols-7 gap-1">
        {copy.weekdays.map((day) => (
          <span
            key={day}
            className="flex min-h-7 items-center justify-center text-caption text-ink-subtle sm:min-h-8"
          >
            {day}
          </span>
        ))}
      </div>
      <ol
        aria-label={copy.monthCalendarLabel(title)}
        className="m-0 grid list-none grid-cols-7 gap-1 p-0"
      >
        {Array.from({ length: leading }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 占位格没有身份
          <li key={`lead-${i}`} aria-hidden="true" />
        ))}
        {cells.map((cell) => {
          const view = cell.view
          const today = cell.date === clock.today
          const quarter = view?.quarter ? copy.quarterShort[view.quarter.phase] : undefined
          return (
            <li
              key={cell.date}
              aria-current={today ? 'date' : undefined}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-field bg-surface px-0.5 py-1.5 text-center text-caption text-ink-subtle sm:min-h-17',
                quarter && 'bg-surface-2 text-ink',
                today && 'ring-1 ring-mark ring-inset',
              )}
            >
              <b className="font-medium text-body text-ink">{cell.day}</b>
              {view && (
                <MoonPhaseIcon
                  illumination={view.illumination}
                  waxing={isWaxing(view)}
                  className="size-4 sm:size-5"
                />
              )}
              <span aria-hidden="true" className="min-h-4 leading-tight">
                {quarter ?? (today ? copy.todayTag : '')}
              </span>
              {view && <span className="sr-only">{`, ${phaseLabel(view)}`}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function QuarterList({
  events,
  clock,
  label,
}: {
  events: readonly MoonQuarterEvent[]
  clock: Clock
  label: string
}) {
  return (
    <dl
      aria-label={label}
      className="m-0 grid max-w-190 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"
    >
      {events.map((event) => (
        <Fact key={`${event.phase}-${event.utcMs}`} label={copy.phase(event.phase)}>
          <span className="block">{shortDate(event.utcMs, clock.timeZone)}</span>
          <span className="block font-sans text-caption text-ink-muted">
            {clockTime(event.utcMs, clock.timeZone)}
          </span>
        </Fact>
      ))}
    </dl>
  )
}

function ZoneNote({ clock }: { clock: Clock }) {
  return (
    <p className={caption}>
      {clock.state === 'local' ? copy.yearNoteLocal(clock.timeZone) : copy.yearNoteUtc}
    </p>
  )
}

// ---------------------------------------------------------------------------
// 满月表
// ---------------------------------------------------------------------------

interface FullMoonTableRow {
  readonly utcMs: number
  readonly month: number
  readonly supermoon: boolean
  readonly blueMoon: boolean
  readonly newMoons: readonly number[]
}

function fullMoonTableRows(
  table: MoonTable,
  clock: Clock,
  filter: (row: { year: number; utcMs: number }) => boolean,
): FullMoonTableRow[] {
  const newMoons = table.events.filter((event) => event.phase === 'new-moon')
  return fullMoons(table, clock.timeZone)
    .filter(filter)
    .map((row) => ({
      ...row,
      newMoons: newMoons
        .filter((event) => {
          const key = zonedDateKey(event.utcMs, clock.timeZone)
          return Number(key.slice(0, 4)) === row.year && Number(key.slice(5, 7)) === row.month
        })
        .map((event) => event.utcMs),
    }))
}

function Flags({ row }: { row: Pick<FullMoonTableRow, 'supermoon' | 'blueMoon'> }) {
  if (!row.supermoon && !row.blueMoon) return null
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
      {row.supermoon && <span className={badge}>{copy.supermoon}</span>}
      {row.blueMoon && <span className={badge}>{copy.blueMoon}</span>}
    </span>
  )
}

function FullMoonTable({
  rows,
  clock,
  label,
  withNewMoon = true,
}: {
  rows: readonly FullMoonTableRow[]
  clock: Clock
  label: string
  withNewMoon?: boolean
}) {
  return (
    <FactTable
      caption={label}
      rows={rows}
      rowKey={(row) => String(row.utcMs)}
      isCurrent={(row) => zonedDateKey(row.utcMs, clock.timeZone) === clock.today}
      stack
      narrow
      containerProps={{ 'data-locale-fixed': true }}
      columns={[
        {
          key: 'month',
          header: copy.colMonth,
          kind: 'key',
          cell: (row) => copy.month(row.month),
        },
        {
          key: 'full',
          header: copy.colFull,
          kind: 'nowrap',
          stacked: 'label',
          stackLabel: copy.stackFull,
          cell: (row) => shortDate(row.utcMs, clock.timeZone),
        },
        {
          key: 'time',
          header: copy.colTime,
          kind: 'nowrap',
          stacked: 'label',
          stackLabel: copy.stackTime,
          cell: (row) => clockTime(row.utcMs, clock.timeZone),
        },
        {
          key: 'name',
          header: copy.colName,
          stacked: 'full',
          cell: (row) => (
            <>
              {copy.moonName(row.month)}
              <Flags row={row} />
            </>
          ),
        },
        ...(withNewMoon
          ? [
              {
                key: 'new',
                header: copy.colNew,
                kind: 'nowrap' as const,
                stacked: 'label' as const,
                stackLabel: copy.stackNew,
                cell: (row: FullMoonTableRow) =>
                  row.newMoons.map((ms) => shortDate(ms, clock.timeZone)).join(', ') || '—',
              },
            ]
          : []),
      ]}
    />
  )
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

type Kind<K extends MoonPayload['kind']> = Extract<MoonPayload, { kind: K }>

export function MoonPage({ payload }: { payload: MoonPayload }) {
  switch (payload.kind) {
    case 'today':
      return <TodayPage payload={payload} />
    case 'full-moon':
      return <FullMoonPage payload={payload} />
    case 'year':
      return <YearPage payload={payload} />
    case 'calendar':
      return <CalendarPage payload={payload} />
    case 'month':
      return <MonthPage payload={payload} />
  }
}

function TodayPage({ payload }: { payload: Kind<'today'> }) {
  const clock = useVisitorClock(payload)
  const view = moonDay(payload.table, clock.today, clock.timeZone)
  const age = moonAgeAt(payload.table, clock.nowMs) ?? view?.ageDays ?? 0
  const nextFull = nextEvent(payload.table, 'full-moon', clock.nowMs)
  const nextNew = nextEvent(payload.table, 'new-moon', clock.nowMs)
  const current = { year: Number(clock.today.slice(0, 4)), month: Number(clock.today.slice(5, 7)) }
  const [phases, ...rest] = payload.sections
  const phasesId = useId()
  const calendarId = useId()
  const aheadId = useId()
  const upcoming = fullMoonTableRows(payload.table, clock, (row) => row.utcMs >= clock.nowMs).slice(
    0,
    12,
  )
  return (
    <Shell>
      <Header breadcrumb={payload.breadcrumb} heading={payload.heading} lede={payload.lede} />
      <UtcAlert clock={clock} />
      <section
        aria-label={copy.phasesLabel}
        className="max-w-190 rounded-object bg-surface p-6 sm:p-8"
      >
        {view ? (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
            <MoonPhaseIcon
              illumination={view.illumination}
              waxing={isWaxing(view)}
              label={phaseLabel(view)}
              className="size-32 sm:size-42"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <DateLine clock={clock} />
              <p className="m-0 font-bold font-heading text-display text-ink">
                {copy.phase(view.phase)}
              </p>
              <dl className="m-0 mt-2 grid grid-cols-2 gap-x-6 gap-y-4">
                <Fact label={copy.illumination}>{Math.round(view.illumination * 100)}%</Fact>
                <Fact label={copy.moonAge}>{copy.ageValue(age)}</Fact>
                <Fact label={copy.nextFull}>{eventWhen(nextFull, clock)}</Fact>
                <Fact label={copy.nextNew}>{eventWhen(nextNew, clock)}</Fact>
              </dl>
            </div>
          </div>
        ) : (
          <p className={muted}>{copy.outOfRange}</p>
        )}
      </section>

      {phases && (
        <section aria-labelledby={phasesId} className="flex max-w-180 flex-col gap-5">
          <h2 id={phasesId} className={h2}>
            {phases.title}
          </h2>
          <ul aria-label={copy.phasesLabel} className="m-0 flex list-none flex-wrap gap-2 p-0">
            {PHASE_ORDER.map((key: MoonPhaseKey) => (
              <li
                key={key}
                aria-current={view?.phase === key ? 'true' : undefined}
                className={cn(
                  'rounded-full bg-surface-2 px-3 py-1 text-caption text-ink',
                  view?.phase === key && 'ring-1 ring-mark ring-inset',
                )}
              >
                {copy.phase(key)}
              </li>
            ))}
          </ul>
          <RichContent html={phases.html} />
        </section>
      )}

      <section data-table-section="" aria-labelledby={calendarId} className="flex flex-col gap-5">
        <h2 id={calendarId} className={h2}>
          {`${copy.month(current.month)} ${current.year}`}
        </h2>
        <MonthGrid table={payload.table} month={current} clock={clock} />
        <p className={muted}>
          <a href={href(moonMonthPath(current.month))} className={inlineLink}>
            {copy.monthLink(current.month)}
          </a>
        </p>
      </section>

      <section data-table-section="" aria-labelledby={aheadId} className="flex flex-col gap-5">
        <h2 id={aheadId} className={h2}>
          {copy.ahead}
        </h2>
        <ZoneNote clock={clock} />
        <FullMoonTable rows={upcoming} clock={clock} label={copy.ahead} />
      </section>

      {rest.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Footer payload={payload} />
    </Shell>
  )
}

function FullMoonPage({ payload }: { payload: Kind<'full-moon'> }) {
  const clock = useVisitorClock(payload)
  const view = moonDay(payload.table, clock.today, clock.timeZone)
  const tonight = view?.quarter?.phase === 'full-moon' ? view.quarter : null
  const next = tonight ?? nextEvent(payload.table, 'full-moon', clock.nowMs)
  const rows = fullMoonTableRows(
    payload.table,
    clock,
    (row) => row.utcMs >= (next?.utcMs ?? clock.nowMs),
  )
  const first = rows[0]
  const aheadId = useId()
  return (
    <Shell>
      <Header breadcrumb={payload.breadcrumb} heading={payload.heading} lede={payload.lede} />
      <UtcAlert clock={clock} />
      <section
        aria-label={copy.nextFull}
        className="max-w-190 rounded-object bg-surface p-6 sm:p-8"
      >
        {view && next && first ? (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
            <MoonPhaseIcon
              illumination={view.illumination}
              waxing={isWaxing(view)}
              label={phaseLabel(view)}
              className="size-32 sm:size-42"
            />
            <div className="flex min-w-0 flex-col gap-2">
              <DateLine clock={clock} />
              <p className="m-0 font-bold font-heading text-display text-ink">
                {tonight ? copy.tonightFull : copy.tonightNot}
              </p>
              <p className={muted}>
                {tonight
                  ? copy.tonightFullNote(clockTime(tonight.utcMs, clock.timeZone))
                  : copy.tonightNotNote(
                      Math.round(view.illumination * 100),
                      fullDate(next.utcMs, clock.timeZone),
                    )}
              </p>
              <dl className="m-0 mt-2 grid grid-cols-2 gap-x-6 gap-y-4">
                <Fact label={copy.nextName}>
                  {copy.moonName(first.month)}
                  <Flags row={first} />
                </Fact>
                <Fact label={copy.fullAt}>
                  {`${shortDate(next.utcMs, clock.timeZone)}, ${clockTime(next.utcMs, clock.timeZone)}`}
                </Fact>
              </dl>
            </div>
          </div>
        ) : (
          <p className={muted}>{copy.outOfRange}</p>
        )}
      </section>

      <section data-table-section="" aria-labelledby={aheadId} className="flex flex-col gap-5">
        <h2 id={aheadId} className={h2}>
          {copy.ahead}
        </h2>
        <ZoneNote clock={clock} />
        <FullMoonTable
          rows={rows.slice(0, 13)}
          clock={clock}
          label={copy.ahead}
          withNewMoon={false}
        />
      </section>

      {payload.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Footer payload={payload} />
    </Shell>
  )
}

function YearPage({ payload }: { payload: Kind<'year'> }) {
  const clock = useVisitorClock(payload)
  const [first, ...rest] = payload.sections
  return (
    <Shell>
      <Header breadcrumb={payload.breadcrumb} heading={payload.heading} lede={payload.lede} />
      <UtcAlert clock={clock} />
      {payload.years.map((year) => (
        <YearSection key={year} year={year} table={payload.table} clock={clock} />
      ))}
      {first && <ProseSection title={first.title} html={first.html} />}
      {rest.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Footer payload={payload} />
    </Shell>
  )
}

function YearSection({ year, table, clock }: { year: number; table: MoonTable; clock: Clock }) {
  const id = useId()
  const rows = fullMoonTableRows(table, clock, (row) => row.year === year)
  return (
    <section data-table-section="" aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className={h2}>
        {copy.yearTitle(year)}
      </h2>
      <ZoneNote clock={clock} />
      <FullMoonTable rows={rows} clock={clock} label={copy.yearCaption(year)} />
    </section>
  )
}

function CalendarPage({ payload }: { payload: Kind<'calendar'> }) {
  const clock = useVisitorClock(payload)
  const current = { year: Number(clock.today.slice(0, 4)), month: Number(clock.today.slice(5, 7)) }
  const gridId = useId()
  const monthsId = useId()
  const names = fullMoons(payload.table, clock.timeZone)
  return (
    <Shell>
      <Header breadcrumb={payload.breadcrumb} heading={payload.heading} lede={payload.lede} />
      <UtcAlert clock={clock} />
      <section data-table-section="" aria-labelledby={gridId} className="flex flex-col gap-5">
        <h2 id={gridId} className={h2}>
          {`${copy.month(current.month)} ${current.year}`}
        </h2>
        <MonthGrid table={payload.table} month={current} clock={clock} />
        <QuarterList
          events={monthEvents(payload.table, current, clock.timeZone)}
          clock={clock}
          label={copy.keyDatesLabel}
        />
      </section>

      <section data-table-section="" aria-labelledby={monthsId} className="flex flex-col gap-5">
        <h2 id={monthsId} className={h2}>
          {copy.calendarMonthsTitle}
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {payload.months.map((item) => {
            const full = names.find((row) => row.year === item.year && row.month === item.month)
            return (
              <li key={item.month} className="flex min-w-0">
                <div className="flex w-full flex-col gap-1 rounded-object bg-surface p-5">
                  <a
                    href={href(moonMonthPath(item.month))}
                    className="font-heading font-medium text-body text-ink underline-offset-4 hover:underline"
                  >
                    {copy.monthLink(item.month)}
                  </a>
                  <p className={caption}>
                    {copy.calendarMonthNote(
                      item.year,
                      full ? shortDate(full.utcMs, clock.timeZone) : null,
                      copy.moonName(item.month),
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {payload.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Footer payload={payload} />
    </Shell>
  )
}

function MonthPage({ payload }: { payload: Kind<'month'> }) {
  const clock = useVisitorClock(payload)
  const { view } = payload
  const monthName = copy.month(view.month)
  const events = monthEvents(payload.table, view, clock.timeZone)
  const full = events.find((event) => event.phase === 'full-moon')
  const daysId = useId()
  const isCurrent = payload.current.year === view.year && payload.current.month === view.month
  return (
    <Shell>
      <Header breadcrumb={payload.breadcrumb} heading={payload.heading} lede={payload.lede} />
      <UtcAlert clock={clock} />
      <section data-table-section="" aria-labelledby={daysId} className="flex flex-col gap-5">
        <h2 id={daysId} className={h2}>
          {copy.daysTitle}
        </h2>
        <p className={caption}>
          {isCurrent
            ? copy.monthRollover(monthName, view.year, view.year + 1)
            : copy.monthFuture(monthName, view.year)}
          {/* 其他年份的入口只在水合后出现：预渲染抓取不跟随 `?year=`，静态页不被查询结果覆盖 */}
          {payload.otherYear !== null && clock.state !== 'initial' && (
            <>
              {' '}
              <a
                data-link-zone="action"
                rel="nofollow"
                href={
                  payload.otherYear === payload.defaultYear
                    ? href(moonMonthPath(view.month))
                    : `${href(moonMonthPath(view.month))}?${MOON_YEAR_PARAM}=${payload.otherYear}`
                }
                className={inlineLink}
              >
                {payload.otherYear === payload.defaultYear
                  ? copy.backToCurrent(monthName, payload.otherYear)
                  : copy.otherYear(monthName, payload.otherYear)}
              </a>
            </>
          )}
        </p>
        <MonthGrid table={payload.table} month={view} clock={clock} />
        <QuarterList events={events} clock={clock} label={copy.keyDatesLabel} />
        {full && <p className={muted}>{copy.fullMoonOf(copy.moonName(view.month))}</p>}
        <ZoneNote clock={clock} />
        <p role="note" className={cn(caption, 'max-w-180')}>
          {copy.disclaimer}
        </p>
      </section>

      {payload.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}

      <SeriesNav
        label={copy.seriesLabel}
        className="max-w-180"
        previous={{
          href: href(moonMonthPath(payload.previous.month)),
          title: copy.monthLink(payload.previous.month),
          label: copy.previous,
        }}
        next={{
          href: href(moonMonthPath(payload.next.month)),
          title: copy.monthLink(payload.next.month),
          label: copy.next,
        }}
      />

      <ToolFaq
        title={copy.faqTitle}
        items={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      />
      <Related items={payload.related} />
    </Shell>
  )
}
