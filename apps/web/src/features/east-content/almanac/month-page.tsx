import { cn, SeriesNav } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import type { ReactNode } from 'react'
import { parseDateKey } from '../../daily/date.ts'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import type { AlmanacMonthPayload } from './almanac.functions.ts'
import { type AlmanacCopy, almanacCopy } from './copy.ts'
import type { AlmanacMonthView } from './model.ts'
import {
  AlmanacDisclaimer,
  AlmanacHeader,
  AlmanacProse,
  bodyLink,
  Mark,
  Tile,
  TodayTag,
} from './parts.tsx'
import { ALMANAC_TOOL_PATHS, almanacMonthPath } from './paths.ts'

const h2 = 'm-0 text-balance font-heading text-ink text-title'

/**
 * 黄历月份页（设计稿 content-growth-phase2/AlmanacMonth、AlmanacMonthMobile）：节气与节令区、逐日表
 * （桌面为表格，md 以下每天一张卡片，宜先显示 4 项、忌 3 项，其余收进 details）、宜忌读法、相邻月份与 FAQ。
 *
 * 组内相似度按 H2 对齐测量（scripts/locale-similarity.mjs）：各月 H2 文字一致；逐日表段以 data-table-section
 * 标记，只报告、不计门槛。合规声明与「黄历查询」入口放在逐日表段内，不混进 FAQ 段。
 * zh-hant 農民曆用同一组件，按 `payload.locale` 换文案，逐日表多一列胎神；没有按事项筛选日子的控件或汇总段。
 */
export function AlmanacMonthPage({ payload }: { payload: AlmanacMonthPayload }) {
  const { view, month, locale } = payload
  const copy = almanacCopy(locale)
  const href = (path: string) => toolHref(path, locale)
  const toolPath = ALMANAC_TOOL_PATHS[locale]
  const today = parseDateKey(payload.today)
  const isCurrent = today?.year === view.year && today.month === month
  return (
    <PageWidth className="flex flex-col gap-10 pb-16 sm:gap-14 sm:pb-28">
      <AlmanacHeader
        crumbs={[
          { name: copy.home, href: href('/') },
          { name: copy.toolCrumb, href: href(toolPath) },
          { name: copy.monthLabel(month) },
        ]}
        title={copy.monthH1(view.year, month)}
      >
        <p className="m-0">{payload.lede}</p>
      </AlmanacHeader>

      <section aria-labelledby="almanac-terms" className="flex flex-col gap-5">
        <h2 id="almanac-terms" className={h2}>
          {copy.termsTitle}
        </h2>
        <TermTiles copy={copy} view={view} />
        {payload.termsNote.map((paragraph) => (
          <p key={paragraph} className="m-0 max-w-180 text-body text-ink-muted">
            {paragraph}
          </p>
        ))}
      </section>

      <section aria-labelledby="almanac-days" data-table-section="" className="flex flex-col gap-5">
        <h2 id="almanac-days" className={h2}>
          {copy.daysTitle}
        </h2>
        <p className="m-0 max-w-180 text-body text-ink-muted">{copy.daysIntro}</p>
        <p className="m-0 max-w-180 text-caption text-ink-subtle">
          {isCurrent
            ? copy.rollover(month, view.year, view.year + 1)
            : copy.rolloverFuture(month, view.year)}
        </p>
        <DayTable copy={copy} view={view} />
        <p className="m-0 flex max-w-180 flex-col gap-1 rounded-object bg-surface-2 p-5 text-body text-ink-muted sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5 sm:p-6">
          <span>{copy.band}</span>
          <span>
            <a href={href(toolPath)} className={bodyLink}>
              {copy.bandLink}
            </a>
            {copy.bandAfter}
          </span>
        </p>
        <AlmanacDisclaimer text={copy.disclaimer} />
      </section>

      <section aria-labelledby="almanac-reading" className="flex max-w-180 flex-col gap-5">
        <h2 id="almanac-reading" className={h2}>
          {copy.readingTitle}
        </h2>
        <AlmanacProse html={payload.html} />
      </section>

      <SeriesNav
        label={copy.seriesLabel}
        className="max-w-180"
        previous={{
          href: href(almanacMonthPath(payload.previous.month, locale)),
          title: copy.monthTitleMain(payload.previous.month),
          label: copy.previousMonth,
        }}
        next={{
          href: href(almanacMonthPath(payload.next.month, locale)),
          title: copy.monthTitleMain(payload.next.month),
          label: copy.nextMonth,
        }}
      />

      <ToolFaq
        title={copy.faqTitle}
        items={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      />
    </PageWidth>
  )
}

function TermTiles({ copy, view }: { copy: AlmanacCopy; view: AlmanacMonthView }) {
  const lunar = view.lunarStarts
  return (
    <div data-locale-fixed className="grid max-w-190 grid-cols-1 gap-3 sm:grid-cols-2">
      {view.terms.map((term) => (
        <Tile key={term.name} label={copy.termTile} value={term.name}>
          {copy.termWhen(term.when, term.time)}
          {term.repeatedDuty ? copy.termRepeat(term.repeatedDuty) : ''}
        </Tile>
      ))}
      {view.monthBranch && (
        <Tile label={copy.branchTile} value={`${view.monthBranch.from} → ${view.monthBranch.to}`}>
          {copy.branchNote(
            view.monthBranch.when,
            view.monthBranch.term,
            view.monthBranch.fromPillar,
            view.monthBranch.toPillar,
          )}
        </Tile>
      )}
      <Tile label={copy.lunarTile} value={lunar.map((start) => start.name).join(' · ') || '—'}>
        {lunar.map((start) => copy.lunarNote(start.when, start.name)).join('')}
        {view.seasonal.length
          ? copy.seasonal(
              view.seasonal.map((item) => `${item.when}${item.names}`).join(copy.seasonalJoin),
            )
          : copy.noSeasonal}
      </Tile>
    </div>
  )
}

/** md 以下：每行是一张两列小卡，单元格前显示列名（表头隐藏） */
function Cell({
  label,
  full,
  nowrap,
  className,
  children,
}: {
  label?: string | undefined
  full?: boolean
  nowrap?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <td
      className={cn(
        'border-line border-b px-3.5 py-3 align-top text-ink-muted max-md:block max-md:border-0 max-md:p-0',
        nowrap && 'md:whitespace-nowrap',
        full && 'max-md:col-span-2',
        className,
      )}
    >
      {label && (
        <span className="font-normal font-sans text-caption text-ink-subtle md:hidden">
          {label}{' '}
        </span>
      )}
      {children}
    </td>
  )
}

function Taboos({
  copy,
  items,
  visible,
}: {
  copy: AlmanacCopy
  items: readonly string[]
  visible: number
}) {
  if (items.length === 0)
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{copy.empty}</span>
      </>
    )
  const shown = items.slice(0, visible)
  const rest = items.slice(visible)
  return (
    <>
      {shown.join(copy.separator)}
      {rest.length > 0 && (
        <details className="group inline">
          <summary className="ml-1.5 inline-flex min-h-7 cursor-pointer list-none items-center whitespace-nowrap text-brand-ink text-caption underline underline-offset-4 max-md:min-h-11 [&::-webkit-details-marker]:hidden">
            {copy.more(rest.length)}
          </summary>
          <span className="block">{rest.join(copy.separator)}</span>
        </details>
      )}
    </>
  )
}

function DayTable({ copy, view }: { copy: AlmanacCopy; view: AlmanacMonthView }) {
  // 繁中：农历并入日期列（台湾农民历的写法），沖煞后多一列胎神；列数与简中相同
  const fetus = copy.fetusLabel !== null
  const columns = copy.columns
  const lunarColumn = copy.lunarColumn
  const [lunarLabel, ganzhiLabel, dutyLabel, starLabel, clashLabel] = columns.slice(
    lunarColumn ? 1 : 0,
  )
  const fetusLabel = fetus ? columns[columns.length - 3] : undefined
  const [yiLabel, jiLabel] = columns.slice(-2)
  return (
    <div className="max-w-full overflow-x-auto rounded-object bg-surface max-md:overflow-visible max-md:rounded-none max-md:bg-transparent">
      <table className="w-full border-collapse text-left text-body max-md:block">
        <thead className="max-md:hidden">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="whitespace-nowrap border-line-strong border-b px-3.5 py-3.5 font-medium text-caption text-ink-subtle"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:flex max-md:flex-col max-md:gap-3">
          {view.days.map((day) => (
            <tr
              key={day.date}
              aria-current={day.today ? 'date' : undefined}
              className={cn(
                'max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1 max-md:rounded-object max-md:bg-surface max-md:px-5 max-md:py-4 [&:last-child>td]:border-b-0',
                day.today &&
                  'bg-surface-2 max-md:bg-surface max-md:ring-1 max-md:ring-mark max-md:ring-inset',
              )}
            >
              <Cell full nowrap className="font-medium text-ink">
                {copy.dayCell(day.month, day.day, day.weekday, day.lunar)}
                {(day.today || day.termMark || day.lunarStart || day.marks.length > 0) && (
                  <span className="mt-1 flex flex-wrap gap-1 max-md:ml-2 max-md:inline-flex max-md:align-middle">
                    {day.today && <TodayTag label={copy.todayTag} />}
                    {day.termMark && <Mark>{day.termMark}</Mark>}
                    {day.lunarStart && <Mark>{day.lunarStart}</Mark>}
                    {day.marks.map((mark) => (
                      <Mark key={mark}>{mark}</Mark>
                    ))}
                  </span>
                )}
              </Cell>
              {lunarColumn && (
                <Cell label={lunarLabel} nowrap>
                  {day.lunar}
                </Cell>
              )}
              <Cell label={ganzhiLabel} nowrap className="font-bold font-heading text-ink">
                {day.pillars.day}
              </Cell>
              <Cell label={dutyLabel} nowrap>
                {day.duty.name}
              </Cell>
              <Cell label={starLabel} nowrap>
                {copy.starCell(day.star.name, day.star.ecliptic)}
              </Cell>
              <Cell label={clashLabel} full={!fetus} nowrap>
                {copy.clashCell(day.clash.zodiac, day.clash.pillar, day.clash.sha)}
              </Cell>
              {fetus && (
                <Cell label={fetusLabel} nowrap>
                  {day.fetus}
                </Cell>
              )}
              <Cell label={yiLabel} full>
                <Taboos copy={copy} items={day.recommends} visible={copy.yiVisible} />
              </Cell>
              <Cell label={jiLabel} full>
                <Taboos copy={copy} items={day.avoids} visible={copy.jiVisible} />
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
