import { Badge, LinkCard } from '@xuanxue/ui'
import { useEffect, useId, useState } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { BUILD_DATE } from '../../tools/build-date.ts'
import { useSpreadDraw } from '../../tools/tarot/draw-state.ts'
import { SpreadDrawPanel, TarotResult } from '../../tools/tarot/tarot-page.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { ToolPage } from '../../tools/tool-page.tsx'
import { MOON_COPY } from '../moon/copy.ts'
import {
  fullDate,
  isValidTimeZone,
  isWaxing,
  moonDay,
  nextEvent,
  parseDateKey,
  UTC,
  zonedDateKey,
} from '../moon/model.ts'
import { MoonPhaseIcon } from '../moon/pages.tsx'
import { MOON_PATHS } from '../moon/paths.ts'
import type { RelatedSpread, SpreadMoon, TarotSpreadPayload } from './page.functions.ts'
import { TAROT_SPREAD_LOCALE, TAROT_SPREAD_NEW_UNTIL, TAROT_TOPIC_TITLES } from './paths.ts'

/**
 * 主题牌阵页（openspec content-growth-v2-tools 第 28 组；设计稿 docs/design/prototypes/content-growth-v2-batch2/
 * Spread*.dc.html，使用者 2026-11-24 确认，默认 B11：爱情 5 张、事业 4 张、满月 4 张，无付费解读）。
 * 复用塔罗牌阵页的抽牌面板与结果（features/tools/tarot），只换牌位与逐页文案；满月牌阵在表单前加月相框，
 * 数据是构建期预计算表，水合后按访客时区重算。只用 @xuanxue/ui 组件与设计 token。
 */

const href = (path: string) => toolHref(path, TAROT_SPREAD_LOCALE)
const h2 = 'm-0 mt-5 text-balance font-heading text-ink text-title first:mt-0'
const caption = 'm-0 text-caption text-ink-subtle'
const muted = 'm-0 text-body text-ink-muted'
const textLink =
  'inline-flex min-h-11 items-center text-body text-brand-ink underline underline-offset-4 hover:decoration-2'

const COPY = {
  positions: (count: number) => `The ${count === 5 ? 'five' : 'four'} positions`,
  newBadge: 'New',
  related: 'More spreads',
  source:
    'Card meanings follow the Rider–Waite–Smith tradition. The cards do not describe another person’s feelings.',
  moonLabel: 'Today’s moon phase',
  asOf: (date: string) => `As of ${date} · changes to today’s date when the page loads`,
  localNote: 'your local time',
  fullToday: (name: string) => `Full moon today · ${name}`,
  notFull: (phase: string, percent: number) => `Today’s moon: ${phase}, ${percent}% lit`,
  afterThis: (date: string) => `The next full moon after this one is ${date}.`,
  nextFull: (date: string, name: string) => `The next full moon is on ${date}, the ${name}.`,
  anyTime: 'You can draw this spread at any time. The full moon is a reminder to reflect.',
  outOfRange:
    'Today is outside the moon calendar’s current range. You can still draw the spread; check the moon pages for the latest dates.',
} as const

export function TarotSpreadRoute({ payload }: { payload: TarotSpreadPayload }) {
  return (
    <MarketingShell>
      <TarotTopicSpreadPage payload={payload} />
    </MarketingShell>
  )
}

export function TarotTopicSpreadPage({ payload }: { payload: TarotSpreadPayload }) {
  const { id, positions } = payload
  const [question, setQuestion] = useState('')
  const draw = useSpreadDraw(id)
  const { reading, complete } = draw
  const current = TAROT_TOPIC_TITLES[id]
  return (
    <ToolPage
      tool={`tarot-${id}`}
      breadcrumb={
        <Breadcrumb
          items={[
            ...payload.breadcrumb.map((item) => ({ name: item.label, href: href(item.href) })),
            { name: current },
          ]}
        />
      }
      title={payload.heading}
      titleBadge={
        BUILD_DATE <= TAROT_SPREAD_NEW_UNTIL ? (
          <Badge size="compact">{COPY.newBadge}</Badge>
        ) : undefined
      }
      intro={<p className="m-0">{payload.lede}</p>}
      form={
        <>
          {id === 'full-moon' && <MoonBox moon={payload.moon} />}
          <SpreadDrawPanel
            draw={draw}
            spread={id}
            positions={positions}
            locale={TAROT_SPREAD_LOCALE}
            question={question}
            onQuestion={setQuestion}
            templates={payload.templates}
          />
        </>
      }
      result={
        complete && reading ? (
          <>
            <TarotResult
              reading={reading}
              positions={positions}
              locale={TAROT_SPREAD_LOCALE}
              question={question}
              columns={2}
            />
            <p className={caption}>{COPY.source}</p>
          </>
        ) : null
      }
      article={
        <article className="flex max-w-180 flex-col gap-5 text-body text-ink-muted">
          <h2 id="tarot-positions" className={h2}>
            {COPY.positions(positions.length)}
          </h2>
          <ol className="m-0 flex list-decimal flex-col gap-3 pl-6">
            {positions.map((position) => (
              <li key={position.name}>
                <strong className="font-medium text-ink">{position.name}.</strong>{' '}
                {position.meaning}
              </li>
            ))}
          </ol>
          {payload.sections.map((section) => (
            <Section key={section.title} title={section.title} html={section.html} />
          ))}
        </article>
      }
      faq={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      nav={<MoreSpreads items={payload.related} />}
    />
  )
}

function Section({ title, html }: { title: string; html: string }) {
  return (
    <>
      <h2 className={h2}>{title}</h2>
      <RichContent html={html} />
    </>
  )
}

/** 「More spreads」：模板区块（data-link-zone="related"），锚文本为目标页主词 */
function MoreSpreads({ items }: { items: readonly RelatedSpread[] }) {
  const id = useId()
  return (
    <nav data-link-zone="related" aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 font-heading text-heading text-ink">
        {COPY.related}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.href} className="flex min-w-0">
            <LinkCard
              href={href(item.href)}
              title={item.label}
              description={item.summary}
              className="w-full"
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface Clock {
  readonly timeZone: string
  readonly nowMs: number
  readonly today: string
  /** initial：服务端与水合首帧（UTC 构建日）；local：已按访客时区；utc：读不到时区 */
  readonly state: 'initial' | 'local' | 'utc'
}

function useVisitorClock(moon: SpreadMoon | null): Clock {
  const [clock, setClock] = useState<Clock>({
    timeZone: UTC,
    nowMs: moon?.nowMs ?? 0,
    today: moon?.asOf ?? '',
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

/** 日期键（YYYY-MM-DD）的「November 24, 2026」写法 */
const dayText = (key: string) => fullDate((parseDateKey(key) ?? 0) + 43_200_000, UTC)

/** 满月月相框（设计稿 SpreadMoon）：按访客的当地日期显示当日相位、下一次满月与传统月名 */
function MoonBox({ moon }: { moon: SpreadMoon | null }) {
  const clock = useVisitorClock(moon)
  const headingId = useId()
  const view = moon ? moonDay(moon.table, clock.today, clock.timeZone) : null
  const fullToday = view?.quarter?.phase === 'full-moon' ? view.quarter : null
  const next =
    moon && view
      ? nextEvent(moon.table, 'full-moon', fullToday ? fullToday.utcMs + 1 : clock.nowMs)
      : null
  const nameOf = (utcMs: number) =>
    MOON_COPY.moonName(Number(zonedDateKey(utcMs, clock.timeZone).slice(5, 7)))
  const zone = clock.state === 'local' ? COPY.localNote : MOON_COPY.utcNote
  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-190 flex-col items-start gap-4 rounded-object bg-surface p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8"
    >
      {view && (
        <MoonPhaseIcon
          illumination={view.illumination}
          waxing={isWaxing(view)}
          label={`${MOON_COPY.phase(view.phase)}, ${Math.round(view.illumination * 100)}% illuminated`}
          className="size-24"
        />
      )}
      <div className="flex min-w-0 flex-col gap-2">
        {view && (
          <p className={caption}>
            {clock.state === 'initial'
              ? COPY.asOf(dayText(clock.today))
              : `${dayText(clock.today)} · ${zone}`}
          </p>
        )}
        <h2 id={headingId} className="m-0 text-balance font-heading text-heading text-ink">
          {view
            ? fullToday
              ? COPY.fullToday(nameOf(fullToday.utcMs))
              : COPY.notFull(MOON_COPY.phase(view.phase), Math.round(view.illumination * 100))
            : COPY.moonLabel}
        </h2>
        <p className={muted}>
          {view && next
            ? `${
                fullToday
                  ? COPY.afterThis(fullDate(next.utcMs, clock.timeZone))
                  : COPY.nextFull(fullDate(next.utcMs, clock.timeZone), nameOf(next.utcMs))
              } ${COPY.anyTime}`
            : COPY.outOfRange}
        </p>
        {/* 模板区块：两个月相页的主词链接，不计入正文内链 */}
        <div data-link-zone="related" className="flex flex-wrap gap-x-6">
          <a href={href(MOON_PATHS.today)} className={textLink}>
            Moon Phase Today
          </a>
          <a href={href(MOON_PATHS['full-moon-calendar'])} className={textLink}>
            Full Moon Calendar
          </a>
        </div>
      </div>
    </section>
  )
}
