import { Alert, AlertDescription, cn, LinkCard } from '@xuanxue/ui'
import {
  type FactColumn,
  FactTable,
  HubToc,
  PageWidth,
  RetroTimeline,
  ToolLabel,
} from '@xuanxue/ui/project'
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { BUILD_DATE } from '../../tools/build-date.ts'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { isValidTimeZone, longDate, UTC, zonedDateKey } from '../moon/model.ts'
import { RETRO_COPY as copy } from './copy.ts'
import {
  activePeriods,
  dateRelative,
  dateWithYear,
  daysUntil,
  inListedYears,
  isActive,
  lastPeriod,
  nextAfterYear,
  nextPeriod,
  PLANET_ORDER,
  type RetroData,
  type RetrogradePlanet,
  type RetroPeriod,
  todayPosition,
  yearPeriods,
  yearSpan,
} from './model.ts'
import { RETROGRADE_LOCALE, RETROGRADE_NEW_UNTIL } from './paths.ts'
import { type RetroPayload, resolveFaq } from './retrograde.functions.ts'

/**
 * 逆行日历（设计稿 docs/design/prototypes/content-growth-v2-batch2/RetroCalendar*.dc.html 与 ProposalsB 提议 A3、
 * 默认 B7，使用者 2026-11-24 确认）。只用 @xuanxue/ui 组件与设计 token。
 *
 * 数据是构建期预计算的停滞表（服务端经内容集合下发）：HTML 预渲染为构建时刻的 UTC 视图（标注 as of），
 * 水合后按访客时区与此刻重算日期、当前逆行与时间条，浏览器不加载 astronomy-engine。
 */

const href = (path: string) => toolHref(path, RETROGRADE_LOCALE)
const h2 = 'm-0 text-balance font-heading text-ink text-title'
const h3 = 'm-0 font-heading text-heading text-ink'
const caption = 'm-0 text-caption text-ink-subtle'

interface Clock {
  readonly timeZone: string
  readonly nowMs: number
  /** initial：服务端与水合首帧（UTC 构建时刻）；local：已按访客时区；utc：读不到时区 */
  readonly state: 'initial' | 'local' | 'utc'
}

function useVisitorClock(payload: RetroPayload): Clock {
  const [clock, setClock] = useState<Clock>({
    timeZone: UTC,
    nowMs: payload.nowMs,
    state: 'initial',
  })
  useEffect(() => {
    let zone: unknown
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      zone = undefined
    }
    setClock(
      isValidTimeZone(zone)
        ? { timeZone: zone, nowMs: Date.now(), state: 'local' }
        : { timeZone: UTC, nowMs: Date.now(), state: 'utc' },
    )
  }, [])
  return clock
}

export function RetrogradePage({ payload }: { payload: RetroPayload }) {
  const clock = useVisitorClock(payload)
  const faq = useMemo(
    () => resolveFaq(payload.faq, payload.data, clock.nowMs, clock.timeZone),
    [payload, clock],
  )
  const [year, next] = payload.data.years as [number, number]
  return (
    <MarketingShell>
      <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
        <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
          <Breadcrumb
            items={[
              ...payload.breadcrumb.map((item) => ({ name: item.label, href: href(item.href) })),
              { name: payload.heading },
            ]}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 text-balance font-heading text-ink text-title">{payload.heading}</h1>
            {BUILD_DATE <= RETROGRADE_NEW_UNTIL ? (
              <ToolLabel kind="new">{copy.newBadge}</ToolLabel>
            ) : null}
          </div>
          <p className="m-0 text-body text-ink-muted">{payload.lede}</p>
        </header>
        <HubToc
          label={copy.tocLabel}
          items={[
            { href: '#rc-now', label: copy.tocNow },
            { href: `#rc-${year}`, label: String(year) },
            { href: `#rc-${next}`, label: String(next) },
            { href: '#rc-how', label: copy.tocHow },
          ]}
        />
        {clock.state === 'utc' ? (
          <Alert className="max-w-190">
            <AlertDescription>{copy.utcAlert}</AlertDescription>
          </Alert>
        ) : null}
        <div data-locale-fixed="" className="contents">
          <RightNow data={payload.data} clock={clock} asOf={payload.asOf} />
          {[year, next].map((value, index) => (
            <YearSection
              key={value}
              year={value}
              data={payload.data}
              clock={clock}
              notes={index === 0}
            />
          ))}
        </div>
        <article id="rc-how" className="flex max-w-180 scroll-mt-6 flex-col gap-8">
          {payload.sections.map((section) => (
            <ProseSection key={section.title} title={section.title} html={section.html} />
          ))}
        </article>
        <ToolFaq
          title={copy.faqTitle}
          items={faq.map(({ q, a }) => ({ question: q, answer: a }))}
        />
        <Related items={payload.related} />
        <p role="note" className={cn(caption, 'max-w-180')}>
          {copy.disclaimer}
        </p>
      </PageWidth>
    </MarketingShell>
  )
}

function ProseSection({ title, html }: { title: string; html: string }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <RichContent html={html} />
    </section>
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className={caption}>{label}</dt>
      <dd className="m-0 font-heading text-heading text-ink">{children}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 「Right now」：此刻逆行的行星、水星现状与下一次水星逆行
// ---------------------------------------------------------------------------

function RightNow({ data, clock, asOf }: { data: RetroData; clock: Clock; asOf: string }) {
  const { nowMs, timeZone } = clock
  const active = activePeriods(data, nowMs)
  const mercury = active.find((period) => period.planet === 'mercury')
  const last = lastPeriod(data, 'mercury', nowMs)
  const upcoming = nextPeriod(data, 'mercury', nowMs)
  const zone = clock.state === 'local' ? copy.localNote : copy.utcNote
  return (
    <section
      id="rc-now"
      aria-labelledby="rc-now-h"
      className="flex max-w-190 scroll-mt-6 flex-col gap-4 rounded-object bg-surface p-6 sm:p-8"
    >
      <p className={caption}>
        {clock.state === 'initial'
          ? copy.asOf(longDate(asOf))
          : copy.today(longDate(zonedDateKey(nowMs, timeZone)), zone)}
      </p>
      <h2 id="rc-now-h" className={h3}>
        {copy.nowTitle}
      </h2>
      {inListedYears(data, nowMs, timeZone) ? null : <p className={caption}>{copy.outOfRange}</p>}
      {active.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {active.map((period) => (
            <li
              key={period.planet}
              className="inline-flex min-h-8 items-center rounded-sm bg-surface-2 px-3 text-caption text-ink"
            >
              {copy.until(copy.planet(period.planet), dateRelative(period.endMs, nowMs, timeZone))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-body text-ink-muted">{copy.noneNow}</p>
      )}
      <dl className="m-0 mt-2 grid grid-cols-2 gap-x-6 gap-y-4">
        <Fact label={copy.mercury}>
          {mercury
            ? copy.mercuryRetro(dateRelative(mercury.endMs, nowMs, timeZone))
            : last
              ? copy.mercuryDirect(dateRelative(last.endMs, nowMs, timeZone))
              : copy.mercuryDirectPlain}
        </Fact>
        {upcoming ? (
          <Fact label={copy.nextMercury}>
            {copy.inDays(
              dateWithYear(upcoming.startMs, timeZone),
              daysUntil(upcoming.startMs, nowMs, timeZone),
            )}
          </Fact>
        ) : null}
      </dl>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 年度分区：时间条（提议 A3）+ 水星表 + 其余七颗行星表
// ---------------------------------------------------------------------------

interface PlanetRow {
  readonly planet: RetrogradePlanet
  readonly periods: readonly RetroPeriod[]
  readonly next: RetroPeriod | undefined
}

/** 同一行星同年有两段逆行时，每段占一行（设计稿以换行分隔） */
function Lines({
  periods,
  text,
}: {
  periods: readonly RetroPeriod[]
  text: (period: RetroPeriod) => string
}) {
  return (
    <>
      {periods.map((period) => (
        <span key={period.startMs} className="block">
          {text(period)}
        </span>
      ))}
    </>
  )
}

function YearSection({
  year,
  data,
  clock,
  notes,
}: {
  year: number
  data: RetroData
  clock: Clock
  notes: boolean
}) {
  const { timeZone, nowMs } = clock
  const today = todayPosition(nowMs, year, timeZone)
  const rows: PlanetRow[] = PLANET_ORDER.map((planet) => ({
    planet,
    periods: yearPeriods(data, planet, year, timeZone),
    next: nextAfterYear(data, planet, year, timeZone),
  }))
  const [mercury, ...others] = rows
  const date = (utcMs: number) => dateWithYear(utcMs, timeZone)
  const mercuryRows = (mercury?.periods ?? []).map((period, index) => ({ period, index }))
  const mercuryColumns: FactColumn<(typeof mercuryRows)[number]>[] = [
    { key: 'period', header: copy.colPeriod, cell: (row) => copy.ordinal(row.index), kind: 'key' },
    {
      key: 'start',
      header: copy.colStart,
      stackLabel: copy.stackStart,
      stacked: 'label',
      kind: 'nowrap',
      cell: (row) => date(row.period.startMs),
    },
    {
      key: 'end',
      header: copy.colEnd,
      stackLabel: copy.stackEnd,
      stacked: 'label',
      kind: 'nowrap',
      cell: (row) => date(row.period.endMs),
    },
    {
      key: 'signs',
      header: copy.colSigns,
      stackLabel: copy.stackSigns,
      stacked: 'label',
      cell: (row) => copy.signs(row.period.signs),
    },
  ]
  const otherColumns: FactColumn<PlanetRow>[] = [
    { key: 'planet', header: copy.colPlanet, cell: (row) => copy.planet(row.planet), kind: 'key' },
    {
      key: 'start',
      header: copy.colStart,
      stackLabel: copy.stackStart,
      stacked: 'label',
      kind: 'nowrap',
      cell: (row) => <Lines periods={row.periods} text={(period) => date(period.startMs)} />,
    },
    {
      key: 'end',
      header: copy.colEnd,
      stackLabel: copy.stackEnd,
      stacked: 'label',
      kind: 'nowrap',
      cell: (row) => <Lines periods={row.periods} text={(period) => date(period.endMs)} />,
    },
    {
      key: 'signs',
      header: copy.colSigns,
      stackLabel: copy.stackSigns,
      stacked: 'label',
      cell: (row) => <Lines periods={row.periods} text={(period) => copy.signs(period.signs)} />,
    },
  ]
  const live = clock.state !== 'initial' || inListedYears(data, nowMs, timeZone)
  return (
    <section
      id={`rc-${year}`}
      aria-labelledby={`rc-${year}-h`}
      className="flex scroll-mt-6 flex-col gap-5"
    >
      <h2 id={`rc-${year}-h`} className={h2}>
        {copy.yearTitle(year)}
      </h2>
      <div className="flex max-w-190 flex-col gap-4 rounded-object bg-surface p-5 sm:p-6">
        <RetroTimeline
          label={copy.timelineLabel(year)}
          months={copy.months}
          today={live ? today : undefined}
          rows={rows.map((row) => ({
            key: row.planet,
            label: copy.planet(row.planet),
            bars: row.periods.map((period) => yearSpan(period, year, timeZone)),
          }))}
        />
        <p className={caption}>{copy.timelineCaption(live && today !== undefined)}</p>
      </div>
      <h3 className={h3}>{copy.mercuryTitle(year)}</h3>
      <FactTable
        narrow
        stack
        caption={copy.mercuryCaption(year)}
        columns={mercuryColumns}
        rows={mercuryRows}
        rowKey={(row) => String(row.period.startMs)}
        isCurrent={(row) => isActive(row.period, nowMs)}
      />
      <h3 className={h3}>{copy.othersTitle(year)}</h3>
      <FactTable
        narrow
        stack
        caption={copy.othersCaption(year)}
        columns={otherColumns}
        rows={others}
        rowKey={(row) => row.planet}
        isCurrent={(row) => row.periods.some((period) => isActive(period, nowMs))}
        rowNote={(row) =>
          row.periods.length > 0
            ? null
            : row.next
              ? copy.noneNext(year, date(row.next.startMs))
              : copy.none(year)
        }
      />
      {notes ? (
        <p className={caption}>{copy.tableNote(clock.state === 'local' ? 'local' : 'utc', live)}</p>
      ) : null}
    </section>
  )
}
