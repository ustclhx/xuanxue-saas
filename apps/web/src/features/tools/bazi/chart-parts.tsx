import type { BaziChart, Element, Pillar, PillarKey, ShenshaEntry, ShenshaKey } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { useId, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { useTool } from '../context.tsx'
import { formatUtcOffset } from './birth-form-state.ts'
import {
  BRANCH_ELEMENT,
  BRANCH_HANGUL,
  BRANCH_HANZI,
  ELEMENT_BG,
  formatDateTime,
  ganzhi,
  ganzhiHangul,
  lunarDateZh,
  STEM_ELEMENT,
  STEM_HANGUL,
  STEM_HANZI,
} from './glyphs.ts'
import {
  BASIS_LABEL,
  CITY_LABEL,
  ELEMENT_LABEL,
  PILLAR_LABEL,
  pillarList,
  SHENSHA_LABEL,
  TEN_GOD_LABEL,
} from './labels.ts'

/**
 * 八字结果的各区块内容（繁中首页 7 区块与韩语만세력 6 区块共用）。
 * 五行色只作色点，每处都同时给出文字标签（视觉规范「设计 token」）；字号只用六个角色类。
 */
export type EastLocale = 'zh-Hant' | 'zh-Hans' | 'ko'

/** 干支等字形用标题字体（无衬线粗体） */
const heading = 'font-heading'

/** 「排盤時間：1990-05-15 10:30（台北，國曆）· 農曆四月廿一」及夏令时 / 真太阳时说明 */
export function usedTimeText(chart: BaziChart, locale: EastLocale): string {
  const { time, input } = chart
  const { year, month, day } = time.used
  const used = chart.hourKnown ? time.used : { year, month, day }
  const place =
    'city' in input.location
      ? CITY_LABEL[input.location.city]()
      : formatUtcOffset(input.location.utcOffsetMinutes)
  const parts = [
    m.bazi_used_time({
      time: chart.hourKnown
        ? formatDateTime(used)
        : `${formatDateTime(used)} · ${m.bazi_hour_unknown()}`,
      place,
      calendar: input.calendar === 'lunar' ? m.bazi_calendar_lunar() : m.bazi_calendar_solar(),
    }),
    m.bazi_lunar_date({
      date:
        locale !== 'ko'
          ? lunarDateZh(time.lunar)
          : `${time.lunar.isLeapMonth ? '윤' : ''}${time.lunar.month}월 ${time.lunar.day}일`,
    }),
  ]
  if (time.dst && chart.hourKnown) parts.push(m.bazi_dst_note())
  if (time.trueSolarCorrectionMinutes !== null)
    parts.push(m.bazi_true_solar_note({ minutes: String(time.trueSolarCorrectionMinutes) }))
  return parts.join(' · ')
}

/** 五行名前的色点：颜色只作辅助，旁边始终有文字 */
function ElementDot({ element }: { element: Element }) {
  return (
    <span className={cn('size-2 shrink-0 rounded-full', ELEMENT_BG[element])} aria-hidden="true" />
  )
}

/**
 * 一柱（设计稿 warm-refresh/ToolBazi.dc.html 的 `.pillar`）：surface-2 底、6px 圆角；干支用 title 字号（小盘），
 * 五行以色点加文字标出；日柱用强调色细框标记，不整块反色。
 */
function PillarCard({
  k,
  pillar,
  locale,
}: {
  k: PillarKey
  pillar: Pillar | null
  locale: EastLocale
}) {
  const isDay = k === 'day'
  const ko = locale === 'ko'
  const label = isDay
    ? `${PILLAR_LABEL[k]()} · ${m.bazi_day_master()}`
    : pillar?.tenGod
      ? `${PILLAR_LABEL[k]()} · ${TEN_GOD_LABEL[pillar.tenGod]()}`
      : PILLAR_LABEL[k]()
  const glyph = cn(heading, 'text-ink text-title')
  const sub = 'inline-flex items-center gap-1 text-caption text-ink-muted'
  return (
    <div
      data-pillar={k}
      data-day-master={isDay || undefined}
      className={cn(
        'flex min-w-0 flex-col items-center gap-1 rounded-field bg-surface-2 px-1 py-3 text-center',
        isDay && 'ring-1 ring-mark ring-inset',
      )}
    >
      <span className={cn('text-caption', isDay ? 'text-ink' : 'text-ink-subtle')}>
        {ko ? PILLAR_LABEL[k]() : label}
      </span>
      {pillar ? (
        <>
          <span className={glyph}>{STEM_HANZI[pillar.stem]}</span>
          <span className={sub}>
            <ElementDot element={STEM_ELEMENT[pillar.stem]} />
            {ko ? `${STEM_HANGUL[pillar.stem]} · ` : ''}
            {ELEMENT_LABEL[STEM_ELEMENT[pillar.stem]]()}
          </span>
          <span className={glyph}>{BRANCH_HANZI[pillar.branch]}</span>
          <span className={sub}>
            <ElementDot element={BRANCH_ELEMENT[pillar.branch]} />
            {ko ? `${BRANCH_HANGUL[pillar.branch]} · ` : ''}
            {ELEMENT_LABEL[BRANCH_ELEMENT[pillar.branch]]()}
          </span>
          {ko && !isDay && pillar.tenGod && (
            <span className="mt-1 text-caption text-ink-subtle">
              {TEN_GOD_LABEL[pillar.tenGod]()}
            </span>
          )}
        </>
      ) : (
        <span className="flex min-h-24 items-center px-1 text-caption text-ink-subtle">
          {m.bazi_requires_hour()}
        </span>
      )}
    </div>
  )
}

/** 四柱：繁中按年月日時由左到右；韩语按시·일·월·연（오른쪽 → 왼쪽 읽기） */
export function PillarsGrid({ chart, locale }: { chart: BaziChart; locale: EastLocale }) {
  const order: PillarKey[] =
    locale === 'ko' ? ['hour', 'day', 'month', 'year'] : ['year', 'month', 'day', 'hour']
  return (
    <div className={cn('grid grid-cols-4', locale === 'ko' ? 'gap-1.5' : 'gap-2 sm:gap-3')}>
      {order.map((k) => (
        <PillarCard key={k} k={k} pillar={chart.pillars[k]} locale={locale} />
      ))}
    </div>
  )
}

/** 藏干与十神表（概念页「十神」锚定到 #ten-gods） */
export function HiddenStemsTable({ chart, locale }: { chart: BaziChart; locale: EastLocale }) {
  const order: PillarKey[] =
    locale === 'ko' ? ['hour', 'day', 'month', 'year'] : ['year', 'month', 'day', 'hour']
  return (
    <div id="ten-gods" className="max-w-2xl scroll-mt-6 overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-center text-body text-ink">
        <caption className="sr-only">
          {m.bazi_hidden_stems()} · {m.bazi_ten_gods()}
        </caption>
        <thead>
          <tr className="text-caption text-ink-subtle">
            <td className="w-14" />
            {order.map((k) => (
              <th key={k} scope="col" className="py-1 font-normal">
                {PILLAR_LABEL[k]()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-line border-t align-top">
            <th scope="row" className="py-2 text-left font-normal text-caption text-ink-subtle">
              {m.bazi_hidden_stems()}
              <br />
              {m.bazi_ten_gods()}
            </th>
            {order.map((k) => {
              const pillar = chart.pillars[k]
              return (
                <td key={k} className="px-0.5 py-2">
                  {pillar ? (
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {pillar.hiddenStems.map((h) => (
                        <li key={h.qi} className="leading-tight">
                          <span className={heading}>{STEM_HANZI[h.stem]}</span>{' '}
                          <span className="text-caption text-ink-muted">
                            {TEN_GOD_LABEL[h.tenGod]()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-caption text-ink-subtle">—</span>
                  )}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function StrengthBody({ chart, compact = false }: { chart: BaziChart; compact?: boolean }) {
  const { strength, dayMaster } = chart
  const verdict = strength.verdict === 'strong' ? m.bazi_strength_strong() : m.bazi_strength_weak()
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-body text-ink">
        {m.bazi_day_master()}
        <ElementDot element={STEM_ELEMENT[dayMaster]} />
        <strong className={heading}>
          {STEM_HANZI[dayMaster]}
          {ELEMENT_LABEL[STEM_ELEMENT[dayMaster]]()}
        </strong>
        <span aria-hidden="true">·</span>
        <strong
          data-verdict={strength.verdict}
          className={cn(heading, compact ? 'text-body' : 'text-subtitle')}
        >
          {verdict}
        </strong>
      </p>
      <div className="relative h-2.5 rounded-full bg-surface-2" aria-hidden="true">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand"
          style={{ width: `${Math.min(100, strength.supportPercent)}%` }}
        />
        <span className="absolute -inset-y-1 left-1/2 w-px bg-ink-subtle" />
      </div>
      <p className="m-0 text-caption text-ink-muted">
        {m.bazi_strength_detail({
          support: String(strength.support),
          total: String(strength.total),
          percent: String(strength.supportPercent),
        })}
      </p>
    </div>
  )
}

function ElementChip({ element, muted = false }: { element: Element; muted?: boolean }) {
  return (
    <span
      className={cn(
        // 设计稿的 `.chip`：surface-2 底、6px 圆角、caption 字号，不画边框
        'inline-flex min-h-8 items-center gap-1.5 rounded-field bg-surface-2 px-3 text-caption',
        muted ? 'text-ink-muted' : 'text-ink',
      )}
    >
      <ElementDot element={element} />
      {ELEMENT_LABEL[element]()}
    </span>
  )
}

export function UsefulBody({ chart }: { chart: BaziChart }) {
  const [primary, secondary] = chart.useful.favorable
  return (
    <div className="flex flex-col gap-2.5">
      {primary && (
        <p className="m-0 font-heading text-body text-ink">
          {m.bazi_useful_primary({
            primary: ELEMENT_LABEL[primary](),
            secondary: secondary ? ELEMENT_LABEL[secondary]() : '—',
          })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <span className="text-ink-subtle">{m.bazi_useful_favorable()}</span>
        {chart.useful.favorable.map((e) => (
          <ElementChip key={e} element={e} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-caption">
        <span className="text-ink-subtle">{m.bazi_useful_unfavorable()}</span>
        {chart.useful.unfavorable.map((e) => (
          <ElementChip key={e} element={e} muted />
        ))}
      </div>
    </div>
  )
}

/** 「7 歲 3 個月起運 · 順排 · 點擊任一步查看流年」；表格页不需要点击提示 */
export function luckAside(chart: BaziChart, withHint = true): string {
  const { startAfter, forward } = chart.fortune
  return [
    m.bazi_luck_start({ years: String(startAfter.years), months: String(startAfter.months) }),
    forward ? m.bazi_luck_forward() : m.bazi_luck_backward(),
    ...(withHint ? [m.bazi_luck_hint()] : []),
  ].join(' · ')
}

/**
 * 大运十年轴（specs/eastern-tool-pages「大运可点进」）：每格是按钮，展开该十年的干支、十神与流年，
 * 并链接到大运概念页。目前所在的一步以强调色细框与「目前」字样标出（设计稿 ToolBazi 的 `.luck`：手机 3 列、桌面 6 列）。
 */
export function LuckAxis({
  chart,
  locale,
  conceptHref,
}: {
  chart: BaziChart
  locale: EastLocale
  conceptHref?: string | undefined
}) {
  const { track } = useTool()
  const [open, setOpen] = useState<number | null>(null)
  const panelId = useId()
  const current = chart.currentYear.decadeIndex
  const ko = locale === 'ko'
  const selected = open === null ? undefined : chart.fortune.decades[open]
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-caption text-ink-muted">
        {m.bazi_current_year({
          year: String(chart.currentYear.year),
          gz: ganzhi(chart.currentYear.stem, chart.currentYear.branch),
          tenGod: TEN_GOD_LABEL[chart.currentYear.tenGod](),
        })}
      </p>
      <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-6">
        {chart.fortune.decades.map((d) => {
          const isCurrent = d.index === current
          const isOpen = d.index === open
          return (
            <li key={d.index}>
              <button
                type="button"
                data-decade={d.index}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => {
                  if (!isOpen) track('block_open', { block: `luck-${d.index}` })
                  setOpen(isOpen ? null : d.index)
                }}
                className={cn(
                  'flex min-h-20 w-full flex-col items-center justify-center gap-0.5 rounded-field px-1 py-2.5 text-ink transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  // 展开的一步改用页面底色（与分段切换的选中项相同）；目前所在的一步始终带强调色细框
                  isOpen ? 'bg-background' : 'bg-surface-2',
                  isCurrent
                    ? 'ring-1 ring-mark ring-inset'
                    : isOpen && 'ring-1 ring-line-strong ring-inset',
                )}
              >
                <span className={cn(heading, 'text-subtitle')}>{ganzhi(d.stem, d.branch)}</span>
                <span className="text-caption text-ink-subtle">
                  {m.bazi_luck_age({ age: String(d.startAge) })}
                  {ko ? '' : ` · ${d.startYear}`}
                </span>
                {isCurrent && (
                  <span className="font-medium text-caption text-ink">{m.bazi_luck_current()}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <div id={panelId} hidden={!selected} className="rounded-field bg-surface-2 p-4">
        {selected && (
          <div className="flex flex-col gap-3" data-decade-panel={selected.index}>
            <p className="m-0 font-heading text-body text-ink">
              {m.bazi_luck_detail({
                gz: ko
                  ? `${ganzhi(selected.stem, selected.branch)}(${ganzhiHangul(selected.stem, selected.branch)})`
                  : ganzhi(selected.stem, selected.branch),
                tenGod: TEN_GOD_LABEL[selected.tenGod](),
                start: String(selected.startYear),
                end: String(selected.endYear),
              })}
            </p>
            <h3 className="m-0 font-normal text-caption text-ink-subtle">{m.bazi_luck_years()}</h3>
            <ol className="m-0 grid list-none grid-cols-3 gap-1.5 p-0 text-body text-ink sm:grid-cols-5">
              {selected.years.map((y) => (
                <li
                  key={y.year}
                  className={cn(
                    'flex flex-col rounded-field bg-surface px-2 py-1.5',
                    y.year === chart.currentYear.year && 'ring-1 ring-mark ring-inset',
                  )}
                >
                  <span className="text-caption text-ink-subtle tabular-nums">{y.year}</span>
                  <span>
                    <span className="font-heading">{ganzhi(y.stem, y.branch)}</span>{' '}
                    <span className="text-caption text-ink-muted">{TEN_GOD_LABEL[y.tenGod]()}</span>
                  </span>
                </li>
              ))}
            </ol>
            {conceptHref && (
              <a
                href={conceptHref}
                className="inline-flex min-h-11 items-center self-start text-body text-brand-ink hover:decoration-2"
              >
                {m.bazi_luck_concept_link()}
              </a>
            )}
          </div>
        )}
      </div>
      {chart.fortune.approximate && (
        <p className="m-0 text-caption text-ink-subtle">{m.bazi_luck_approximate()}</p>
      )}
    </div>
  )
}

/** 同一神煞的多个查法合并：地支去重，命中柱去重 */
function groupShensha(entries: readonly ShenshaEntry[]) {
  const groups = new Map<ShenshaKey, { targets: Set<string>; pillars: Set<PillarKey> }>()
  for (const entry of entries) {
    const group = groups.get(entry.key) ?? { targets: new Set(), pillars: new Set() }
    for (const t of entry.targets) group.targets.add(t)
    for (const p of entry.pillars) group.pillars.add(p)
    groups.set(entry.key, group)
  }
  const order: PillarKey[] = ['year', 'month', 'day', 'hour']
  return [...groups].map(([key, group]) => ({
    key,
    targets: [...group.targets] as ShenshaEntry['targets'],
    pillars: order.filter((p) => group.pillars.has(p)),
  }))
}

const branchesText = (targets: ShenshaEntry['targets']) =>
  targets.map((t) => BRANCH_HANZI[t]).join('')

/** 繁中：神煞胶囊；命盘中出现的用反色块并写明所在柱 */
export function ShenshaChips({ chart }: { chart: BaziChart }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {groupShensha(chart.shensha).map((s) => {
        const hit = s.pillars.length > 0
        return (
          <li
            key={s.key}
            id={s.key === 'kongWang' ? 'void' : undefined}
            data-shensha={s.key}
            data-hit={hit}
            className={cn(
              'scroll-mt-6 rounded-field px-3 py-1.5 text-caption',
              hit ? 'bg-inverse text-on-inverse' : 'bg-surface-2 text-ink',
            )}
          >
            {SHENSHA_LABEL[s.key]()} · {branchesText(s.targets)}
            {hit && <> · {m.bazi_shensha_in({ pillars: pillarList(s.pillars, '、') })}</>}
          </li>
        )
      })}
    </ul>
  )
}

/** 韩语：最详细的一块，逐个查法列出地支（含韩文读音）与是否见于原国 */
export function ShenshaTable({ chart }: { chart: BaziChart }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {chart.shensha.map((s) => {
        const hit = s.pillars.length > 0
        return (
          <li
            key={`${s.key}-${s.basis}`}
            id={s.key === 'kongWang' && s.basis === 'dayPillar' ? 'void' : undefined}
            data-shensha={s.key}
            data-hit={hit}
            className={cn(
              'flex scroll-mt-6 items-start justify-between gap-3 rounded-field px-3 py-2.5 text-body',
              hit ? 'bg-on-inverse/20 ring-1 ring-on-inverse/40' : 'bg-on-inverse/10',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{SHENSHA_LABEL[s.key]()}</span>
              <span className="text-caption opacity-75">{BASIS_LABEL[s.basis]()}</span>
            </span>
            <span className="flex flex-col items-end text-right">
              <span className="font-heading">
                {branchesText(s.targets)} ({s.targets.map((t) => BRANCH_HANGUL[t]).join('')})
              </span>
              <span className="text-caption opacity-75">
                {hit
                  ? m.bazi_shensha_in({ pillars: pillarList(s.pillars, '·') })
                  : m.bazi_shensha_none()}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function WeightBody({ chart }: { chart: BaziChart }) {
  const { weight } = chart
  if (weight.status === 'requiresHour')
    return (
      <p data-weight="requires-hour" className="m-0 text-body text-ink-muted">
        <strong className="text-ink">{m.bazi_requires_hour()}</strong> ·{' '}
        {m.bazi_weight_requires_hour({
          year: String(weight.parts.year),
          month: String(weight.parts.month),
          day: String(weight.parts.day),
        })}
      </p>
    )
  return (
    <div className="flex flex-col gap-1">
      <p data-weight={weight.totalQian} className="m-0 font-heading text-ink text-title">
        {m.bazi_weight_value({ liang: String(weight.liang), qian: String(weight.qian) })}
      </p>
      <p className="m-0 text-caption text-ink-subtle">
        {m.bazi_weight_parts({
          year: String(weight.parts.year),
          month: String(weight.parts.month),
          day: String(weight.parts.day),
          hour: String(weight.parts.hour),
        })}
      </p>
    </div>
  )
}

export function ConceptLink({ href, children }: { href?: string | undefined; children: string }) {
  if (!href) return null
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center self-start text-body text-brand-ink hover:decoration-2"
    >
      {children}
    </a>
  )
}
