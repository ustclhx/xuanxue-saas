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
  ELEMENT_TEXT,
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
 * 五行色只作辅助，每处都同时给出文字标签（视觉规范「设计 token」）。
 */
export type EastLocale = 'zh-Hant' | 'zh-Hans' | 'ko'

const serif = 'font-heading'

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

/** 一柱：天干、地支（五行色 + 文字），十神与藏干 */
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
  const glyph = cn(
    serif,
    ko ? 'text-[30px] leading-tight' : 'text-[36px] leading-tight sm:text-[44px]',
  )
  const sub = cn('text-xs', isDay ? 'text-on-inverse/80' : 'text-ink-subtle')
  return (
    <div
      data-pillar={k}
      className={cn(
        'flex min-w-0 flex-col items-center gap-0.5 rounded-xl text-center',
        ko ? 'px-1 py-2.5' : 'p-3 sm:p-4',
        isDay ? 'bg-inverse text-on-inverse' : 'border border-line bg-surface',
      )}
    >
      <span
        className={cn('text-xs sm:text-[13px]', isDay ? 'text-on-inverse/80' : 'text-ink-subtle')}
      >
        {ko ? PILLAR_LABEL[k]() : label}
      </span>
      {pillar ? (
        <>
          <span className={cn(glyph, !isDay && ELEMENT_TEXT[STEM_ELEMENT[pillar.stem]])}>
            {STEM_HANZI[pillar.stem]}
          </span>
          <span className={sub}>
            {ko ? `${STEM_HANGUL[pillar.stem]} · ` : ''}
            {ELEMENT_LABEL[STEM_ELEMENT[pillar.stem]]()}
          </span>
          <span className={cn(glyph, !isDay && ELEMENT_TEXT[BRANCH_ELEMENT[pillar.branch]])}>
            {BRANCH_HANZI[pillar.branch]}
          </span>
          <span className={sub}>
            {ko ? `${BRANCH_HANGUL[pillar.branch]} · ` : ''}
            {ELEMENT_LABEL[BRANCH_ELEMENT[pillar.branch]]()}
          </span>
          {ko && !isDay && pillar.tenGod && (
            <span className={cn(sub, 'mt-1')}>{TEN_GOD_LABEL[pillar.tenGod]()}</span>
          )}
        </>
      ) : (
        <span className="flex min-h-24 items-center px-1 text-ink-subtle text-sm">
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
    <div id="ten-gods" className="scroll-mt-6 overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-center text-sm">
        <caption className="sr-only">
          {m.bazi_hidden_stems()} · {m.bazi_ten_gods()}
        </caption>
        <thead>
          <tr className="text-ink-subtle text-xs">
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
            <th scope="row" className="py-2 text-left font-normal text-ink-subtle text-xs">
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
                          <span className={cn(serif, ELEMENT_TEXT[STEM_ELEMENT[h.stem]])}>
                            {STEM_HANZI[h.stem]}
                          </span>{' '}
                          <span className="text-ink-muted text-xs">
                            {TEN_GOD_LABEL[h.tenGod]()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-ink-subtle text-xs">—</span>
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

const byScore = (chart: BaziChart) => [...chart.strength.elements].sort((a, b) => b.score - a.score)

/** 繁中：五行横向条形图（按加权分数占比，数字为个数） */
export function ElementBars({ chart }: { chart: BaziChart }) {
  const max = Math.max(...chart.strength.elements.map((e) => e.percent), 1)
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
      {byScore(chart).map((e) => (
        <li key={e.element} data-element={e.element} className="flex items-center gap-3">
          <span className={cn('w-6 shrink-0 font-heading', ELEMENT_TEXT[e.element])}>
            {ELEMENT_LABEL[e.element]()}
          </span>
          <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className={cn('block h-full rounded-full', ELEMENT_BG[e.element])}
              style={{ width: `${(e.percent / max) * 100}%` }}
            />
          </span>
          <span className="w-24 shrink-0 text-right text-ink-muted text-sm tabular-nums">
            {e.count} · {e.percent}%
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 韩语：五行堆叠条（占比过小的段不放文字），下方列出全部五行 */
export function ElementStack({ chart }: { chart: BaziChart }) {
  const elements = byScore(chart)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-7 gap-1 overflow-hidden rounded-md" aria-hidden="true">
        {elements
          .filter((e) => e.percent > 0)
          .map((e) => (
            <span
              key={e.element}
              className={cn(
                'flex min-w-1 items-center justify-center rounded-md text-[13px] text-white',
                ELEMENT_BG[e.element],
              )}
              style={{ flexGrow: e.percent, flexBasis: 0 }}
            >
              {e.percent >= 12 ? `${ELEMENT_LABEL[e.element]()} ${e.count}` : ''}
            </span>
          ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-ink-muted text-sm">
        {elements.map((e) => (
          <li key={e.element} data-element={e.element} className="tabular-nums">
            <span className={ELEMENT_TEXT[e.element]}>●</span> {ELEMENT_LABEL[e.element]()}{' '}
            {e.count} ({e.percent}%)
          </li>
        ))}
      </ul>
    </div>
  )
}

export function StrengthBody({ chart, compact = false }: { chart: BaziChart; compact?: boolean }) {
  const { strength, dayMaster } = chart
  const verdict = strength.verdict === 'strong' ? m.bazi_strength_strong() : m.bazi_strength_weak()
  return (
    <div className="flex flex-col gap-2">
      <p className={cn('m-0 text-ink', compact ? 'text-[15px]' : 'text-base')}>
        {m.bazi_day_master()}{' '}
        <strong className={cn(serif, ELEMENT_TEXT[STEM_ELEMENT[dayMaster]])}>
          {STEM_HANZI[dayMaster]}
          {ELEMENT_LABEL[STEM_ELEMENT[dayMaster]]()}
        </strong>{' '}
        ·{' '}
        <strong data-verdict={strength.verdict} className={cn(serif, 'text-lg')}>
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
      <p className="m-0 text-ink-muted text-sm leading-relaxed">
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
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
        muted ? 'border-line text-ink-subtle' : 'border-line-strong text-ink',
      )}
    >
      <span className={cn('size-2 rounded-full', ELEMENT_BG[element])} aria-hidden="true" />
      {ELEMENT_LABEL[element]()}
    </span>
  )
}

export function UsefulBody({ chart }: { chart: BaziChart }) {
  const [primary, secondary] = chart.useful.favorable
  return (
    <div className="flex flex-col gap-2.5">
      {primary && (
        <p className="m-0 font-heading text-ink text-lg">
          {m.bazi_useful_primary({
            primary: ELEMENT_LABEL[primary](),
            secondary: secondary ? ELEMENT_LABEL[secondary]() : '—',
          })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-subtle">{m.bazi_useful_favorable()}</span>
        {chart.useful.favorable.map((e) => (
          <ElementChip key={e} element={e} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
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
 * 并链接到大运概念页。目前所在的一步以朱砂框标出。
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
      <p className="m-0 text-ink-muted text-sm">
        {m.bazi_current_year({
          year: String(chart.currentYear.year),
          gz: ganzhi(chart.currentYear.stem, chart.currentYear.branch),
          tenGod: TEN_GOD_LABEL[chart.currentYear.tenGod](),
        })}
      </p>
      <ol
        className={cn(
          'm-0 list-none p-0',
          ko
            ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1'
            : 'grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2',
        )}
      >
        {chart.fortune.decades.map((d) => {
          const isCurrent = d.index === current
          const isOpen = d.index === open
          return (
            <li key={d.index} className={ko ? 'shrink-0' : undefined}>
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
                  'flex w-full flex-col items-center justify-center gap-1 rounded-[10px] border text-ink transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  ko ? 'min-h-[72px] w-[76px]' : 'min-h-[84px]',
                  isCurrent ? 'border-2 border-brand bg-brand/8' : 'border-line bg-surface',
                  isOpen && 'bg-surface-2 ring-2 ring-ink/20',
                )}
              >
                <span className={cn(serif, ko ? 'text-lg' : 'text-[22px]')}>
                  {ganzhi(d.stem, d.branch)}
                </span>
                <span className={cn('text-xs', isCurrent ? 'text-brand-ink' : 'text-ink-subtle')}>
                  {m.bazi_luck_age({ age: String(d.startAge) })}
                  {ko ? '' : ` · ${d.startYear}`}
                </span>
                {isCurrent && (
                  <span className="text-brand-ink text-xs font-semibold">
                    {m.bazi_luck_current()}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <div id={panelId} hidden={!selected} className="rounded-[10px] bg-surface-2 p-4">
        {selected && (
          <div className="flex flex-col gap-3" data-decade-panel={selected.index}>
            <p className="m-0 font-heading text-ink">
              {m.bazi_luck_detail({
                gz: ko
                  ? `${ganzhi(selected.stem, selected.branch)}(${ganzhiHangul(selected.stem, selected.branch)})`
                  : ganzhi(selected.stem, selected.branch),
                tenGod: TEN_GOD_LABEL[selected.tenGod](),
                start: String(selected.startYear),
                end: String(selected.endYear),
              })}
            </p>
            <h3 className="m-0 font-normal text-ink-subtle text-sm">{m.bazi_luck_years()}</h3>
            <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1.5 p-0 text-sm">
              {selected.years.map((y) => (
                <li
                  key={y.year}
                  className={cn(
                    'flex flex-col rounded-lg bg-surface px-2 py-1.5',
                    y.year === chart.currentYear.year && 'outline-2 outline-brand',
                  )}
                >
                  <span className="text-ink-subtle text-xs tabular-nums">{y.year}</span>
                  <span>
                    <span className="font-heading">{ganzhi(y.stem, y.branch)}</span>{' '}
                    <span className="text-ink-muted text-xs">{TEN_GOD_LABEL[y.tenGod]()}</span>
                  </span>
                </li>
              ))}
            </ol>
            {conceptHref && (
              <a
                href={conceptHref}
                className="inline-flex min-h-11 items-center text-brand-ink text-sm"
              >
                {m.bazi_luck_concept_link()}
              </a>
            )}
          </div>
        )}
      </div>
      {chart.fortune.approximate && (
        <p className="m-0 text-ink-subtle text-xs">{m.bazi_luck_approximate()}</p>
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
              'scroll-mt-6 rounded-full px-3 py-1.5 text-sm',
              hit ? 'bg-inverse text-on-inverse' : 'border border-line-strong text-ink',
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
              'flex scroll-mt-6 items-start justify-between gap-3 rounded-lg px-3 py-2.5',
              hit ? 'bg-on-inverse/20 ring-1 ring-on-inverse/40' : 'bg-on-inverse/10',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{SHENSHA_LABEL[s.key]()}</span>
              <span className="text-xs opacity-75">{BASIS_LABEL[s.basis]()}</span>
            </span>
            <span className="flex flex-col items-end text-right">
              <span className="font-heading">
                {branchesText(s.targets)} ({s.targets.map((t) => BRANCH_HANGUL[t]).join('')})
              </span>
              <span className="text-xs opacity-75">
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
      <p data-weight="requires-hour" className="m-0 text-ink-muted leading-relaxed">
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
      <p data-weight={weight.totalQian} className="m-0 font-heading text-[32px] text-ink">
        {m.bazi_weight_value({ liang: String(weight.liang), qian: String(weight.qian) })}
      </p>
      <p className="m-0 text-ink-subtle text-sm">
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
    <a href={href} className="inline-flex min-h-11 items-center self-start text-brand-ink text-sm">
      {children}
    </a>
  )
}
