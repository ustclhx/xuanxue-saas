import {
  Badge,
  Button,
  cn,
  LinkCard,
  LinkCardGrid,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SeriesNav,
} from '@xuanxue/ui'
import { FactTable, PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useId, useMemo, useState } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolContext } from '../../tools/context.tsx'
import { Disclaimer } from '../../tools/disclaimer.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import {
  ASPECT_LABEL,
  ZODIAC_COPY as C,
  dateRange,
  ELEMENT_LABEL,
  GRID_LABEL,
  MODALITY_LABEL,
  PLANET_LABEL,
  traditionNote,
} from './copy.ts'
import {
  type AspectTone,
  PAIRS,
  type PairFact,
  pairFacts,
  parsePairSlug,
  SIGN_KEYS,
  SIGNS,
  type SignFact,
  type SignKey,
  signOf,
} from './facts.ts'
import type { WesternZodiacPageData } from './page.functions.ts'
import { pairName, pairPath, signName, signPath, ZODIAC_COMPAT_PATH } from './paths.ts'

/**
 * 星座枢纽、档案页、配对总表与配对页（设计稿 docs/design/prototypes/content-growth-v2-tools/WestPair、
 * WestGrid、WestGridMobile 与 Proposals「PairGrid」，使用者 2026-11-23 确认）。只用 @xuanxue/ui 组件与设计 token。
 * 事实（元素、模式、守护星、角距）由 facts.ts 计算，正文来自内容集合。
 * 组内相似度按 H2 段测量：事实表与链接列表所在的段标 data-table-section（只报告），模板导航放在 nav 中。
 */

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'
const LOCALE = 'en'
const href = (path: string) => toolHref(path, LOCALE)
const NEW_UNTIL = '2027-02-28'

const planetText = (sign: SignFact) =>
  sign.modernRuler
    ? `${PLANET_LABEL[sign.ruler]} (${C.modernRuler(PLANET_LABEL[sign.modernRuler])})`
    : PLANET_LABEL[sign.ruler]

function Shell({ tool, children }: { tool: string; children: ReactNode }) {
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">{children}</PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

function PageHeader({
  breadcrumb,
  current,
  heading,
  lede,
  badge,
}: {
  breadcrumb: readonly PageLink[]
  current: string
  heading: string
  lede: string
  badge?: string | undefined
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      <Breadcrumb
        items={[
          ...breadcrumb.map((item) => ({ name: item.label, href: href(item.href) })),
          { name: current },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-balance font-heading text-ink text-title">{heading}</h1>
        {badge && <Badge size="compact">{badge}</Badge>}
      </div>
      <p className="m-0 text-body text-ink-muted">{lede}</p>
    </header>
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

function Faq({ page }: { page: WesternZodiacPageData }) {
  return <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />
}

function Glyph({ sign, small = false }: { sign: SignFact; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-object bg-surface-2 font-bold font-heading text-mark',
        small ? 'size-16 text-title' : 'size-24 text-display',
      )}
    >
      {sign.glyph}
    </span>
  )
}

function FactList({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="m-0 grid w-full min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-caption text-ink-subtle">{label}</dt>
          <dd className="m-0 text-body text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const aspectWithAngle = (fact: PairFact) =>
  `${ASPECT_LABEL[fact.aspect]} (${C.degrees(fact.angle)})`

// ---------------------------------------------------------------------------
// 枢纽
// ---------------------------------------------------------------------------

export function HubPage({ page }: { page: WesternZodiacPageData }) {
  const tableId = useId()
  return (
    <Shell tool="western-zodiac-signs">
      <PageHeader
        breadcrumb={page.breadcrumb}
        current={C.hubCrumb}
        heading={page.heading}
        lede={page.lede}
      />
      <section data-table-section aria-labelledby={tableId} className="flex flex-col gap-5">
        <h2 id={tableId} className={h2}>
          {C.hubTableTitle}
        </h2>
        <FactTable
          caption={C.hubTableCaption}
          rows={SIGNS}
          rowKey={(sign) => sign.key}
          stack
          containerProps={{ 'data-locale-fixed': true }}
          columns={[
            {
              key: 'sign',
              header: C.colSign,
              kind: 'key',
              cell: (sign) => (
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="font-heading text-mark">
                    {sign.glyph}
                  </span>
                  <a href={href(signPath(sign.key))} className={inlineLink}>
                    {signName(sign.key)}
                  </a>
                </span>
              ),
            },
            {
              key: 'dates',
              header: C.dates,
              kind: 'nowrap',
              stacked: 'label',
              cell: (sign) => dateRange(sign.start, sign.end),
            },
            {
              key: 'element',
              header: C.element,
              stacked: 'label',
              cell: (sign) => ELEMENT_LABEL[sign.element],
            },
            {
              key: 'modality',
              header: C.modality,
              stacked: 'label',
              cell: (sign) => MODALITY_LABEL[sign.modality],
            },
            {
              key: 'ruler',
              header: C.ruler,
              stacked: 'label',
              cell: planetText,
            },
          ]}
        />
        <p className={muted}>{C.hubTableNote}</p>
      </section>
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Faq page={page} />
      <Disclaimer />
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// 档案页
// ---------------------------------------------------------------------------

interface PairRow {
  readonly other: SignKey
  readonly fact: PairFact
}

const rowsOf = (key: SignKey): PairRow[] =>
  SIGN_KEYS.map((other) => ({ other, fact: pairFacts(key, other) }))

export function SignPage({ page }: { page: WesternZodiacPageData }) {
  const key = page.key as SignKey
  const sign = signOf(key)
  const name = signName(key)
  const rowId = useId()
  const othersId = useId()
  return (
    <Shell tool={`western-zodiac-sign-${key}`}>
      <PageHeader
        breadcrumb={page.breadcrumb}
        current={name}
        heading={page.heading}
        lede={page.lede}
      />
      <section
        aria-label={C.quickLabel}
        className="flex max-w-190 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8"
      >
        <Glyph sign={sign} />
        <FactList
          items={[
            [C.dates, dateRange(sign.start, sign.end)],
            [C.element, ELEMENT_LABEL[sign.element]],
            [C.modality, MODALITY_LABEL[sign.modality]],
            [C.ruler, planetText(sign)],
          ]}
        />
      </section>
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      {/* 12 行配对一览：引擎数据与链接列表，组内相似度只报告；链接属于相关区块 */}
      <section data-table-section aria-labelledby={rowId} className="flex flex-col gap-5">
        <h2 id={rowId} className={h2}>
          {C.rowTitle(name)}
        </h2>
        <p className={muted}>{page.compatNote}</p>
        <div data-link-zone="related" className="contents">
          <FactTable
            caption={C.rowCaption(name)}
            rows={rowsOf(key)}
            rowKey={(row) => row.other}
            stack
            narrow
            containerProps={{ 'data-locale-fixed': true }}
            columns={[
              {
                key: 'pair',
                header: C.colPair,
                kind: 'key',
                cell: (row) => (
                  <a href={href(pairPath(row.fact.first, row.fact.second))} className={inlineLink}>
                    {pairName(row.fact.first, row.fact.second)}
                  </a>
                ),
              },
              {
                key: 'aspect',
                header: C.colAspect,
                kind: 'nowrap',
                stacked: 'label',
                cell: (row) => aspectWithAngle(row.fact),
              },
              {
                key: 'elements',
                header: C.colElements,
                stacked: 'label',
                cell: (row) =>
                  `${ELEMENT_LABEL[sign.element]} and ${ELEMENT_LABEL[signOf(row.other).element].toLowerCase()}`,
              },
            ]}
          />
        </div>
      </section>
      <Faq page={page} />
      {page.siblings.length > 0 && (
        <nav data-link-zone="siblings" aria-labelledby={othersId} className="flex flex-col gap-3">
          <h2 id={othersId} className={h2}>
            {C.othersTitle}
          </h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:gap-3 lg:grid-cols-4">
            {page.siblings.map((item) => {
              const other = SIGNS.find((entry) => signPath(entry.key) === item.href)
              return (
                <li key={item.href} className="flex min-w-0">
                  <LinkCard
                    href={href(item.href)}
                    title={item.label}
                    description={
                      other
                        ? `${other.glyph} ${ELEMENT_LABEL[other.element]} · ${MODALITY_LABEL[other.modality]}`
                        : undefined
                    }
                    className="w-full"
                  />
                </li>
              )
            })}
          </ul>
        </nav>
      )}
      <Disclaimer />
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// 总表
// ---------------------------------------------------------------------------

const TONE_CELL: Readonly<Record<AspectTone, string>> = {
  harmonious: 'bg-surface-2 font-medium text-ink',
  challenging: 'bg-surface text-ink ring-1 ring-line-strong ring-inset',
  neutral: 'bg-surface text-ink-subtle',
}
const TONE_BADGE: Readonly<Record<AspectTone, string>> = {
  harmonious: 'bg-surface-2 text-ink',
  challenging: 'text-ink ring-1 ring-line-strong ring-inset',
  neutral: 'text-ink-subtle',
}

const cellLabel = (a: SignKey, b: SignKey, fact: PairFact) =>
  `${pairName(a, b)}: ${ASPECT_LABEL[fact.aspect].toLowerCase()}${
    fact.aspect === 'semisextile' || fact.aspect === 'quincunx' ? ', no major aspect' : ''
  }`

/** 桌面 12×12 网格：每格是指向规范配对页的链接，≥44px 高；和谐填充、紧张描边、其余平底（不靠色相区分） */
export function PairGrid() {
  return (
    <nav aria-label={C.gridLabel} className="grid grid-cols-13 gap-1">
      <span
        aria-hidden="true"
        className="flex min-h-11 items-center justify-center text-ink-subtle"
      >
        ×
      </span>
      {SIGN_KEYS.map((key) => (
        <span
          key={key}
          aria-hidden="true"
          className="flex min-h-11 items-center justify-center font-bold font-heading text-caption text-ink"
        >
          {signName(key).slice(0, 3)}
        </span>
      ))}
      {SIGN_KEYS.map((row) => [
        <span
          key={row}
          aria-hidden="true"
          className="flex min-h-11 items-center justify-center font-bold font-heading text-caption text-ink"
        >
          {signName(row).slice(0, 3)}
        </span>,
        ...SIGN_KEYS.map((column) => {
          const fact = pairFacts(row, column)
          return (
            <a
              key={`${row}-${column}`}
              href={href(pairPath(fact.first, fact.second))}
              aria-label={cellLabel(row, column, fact)}
              className={cn(
                'flex min-h-11 items-center justify-center rounded-sm px-0.5 text-center text-caption hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring',
                TONE_CELL[fact.tone],
              )}
            >
              {GRID_LABEL[fact.aspect]}
            </a>
          )
        }),
      ])}
    </nav>
  )
}

function SignSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: SignKey
  onChange: (value: SignKey) => void
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-ink-subtle">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as SignKey)}>
        <SelectTrigger
          id={id}
          placeholder={label}
          valueLabel={signName(value)}
          className="w-full justify-between"
        />
        <SelectContent>
          {SIGN_KEYS.map((key, index) => (
            <SelectItem key={key} index={index} value={key}>
              {signName(key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** 手机：两个选择框加所选第一个星座的 12 行列表（格子小于 44px 触控目标，设计稿 WestGridMobile） */
function PairPicker() {
  const [first, setFirst] = useState<SignKey>('aries')
  const [second, setSecond] = useState<SignKey>('leo')
  const listId = useId()
  const chosen = pairFacts(first, second)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SignSelect label={C.firstSign} value={first} onChange={setFirst} />
        <SignSelect label={C.secondSign} value={second} onChange={setSecond} />
      </div>
      <Button asChild size="lg" className="w-full">
        <a href={href(pairPath(chosen.first, chosen.second))}>
          {C.see(pairName(chosen.first, chosen.second))}
        </a>
      </Button>
      <h3 id={listId} className="m-0 mt-3 font-heading text-ink text-subtitle">
        {C.withEvery(signName(first))}
      </h3>
      <ul aria-labelledby={listId} className="m-0 flex list-none flex-col border-line border-t p-0">
        {rowsOf(first).map(({ other, fact }) => (
          <li key={other} className="border-line border-b">
            <a
              href={href(pairPath(fact.first, fact.second))}
              className="flex min-h-12 items-center justify-between gap-3 text-body text-ink"
            >
              <span>{pairName(fact.first, fact.second)}</span>
              <span
                className={cn('rounded-full px-2.5 py-0.5 text-caption', TONE_BADGE[fact.tone])}
              >
                {ASPECT_LABEL[fact.aspect]}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChartPage({ page }: { page: WesternZodiacPageData }) {
  const gridId = useId()
  const isNew = new Date().toISOString().slice(0, 10) <= NEW_UNTIL
  return (
    <Shell tool="western-zodiac-compatibility">
      <PageHeader
        breadcrumb={page.breadcrumb}
        current={C.chartCrumb}
        heading={page.heading}
        lede={page.lede}
        badge={isNew ? 'New' : undefined}
      />
      <section data-table-section aria-labelledby={gridId} className="flex flex-col gap-5">
        <h2 id={gridId} className={h2}>
          {C.gridTitle}
        </h2>
        <div data-link-zone="related" data-locale-fixed className="flex flex-col gap-5">
          <div className="hidden flex-col gap-4 md:flex">
            <ul
              aria-label={C.keyLabel}
              className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-caption text-ink-muted"
            >
              {(
                [
                  ['harmonious', C.keyHarmonious],
                  ['challenging', C.keyChallenging],
                  ['neutral', C.keyNeutral],
                ] as const
              ).map(([tone, label]) => (
                <li key={tone} className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className={cn('size-3.5 rounded-sm', TONE_CELL[tone])} />
                  {label}
                </li>
              ))}
            </ul>
            <PairGrid />
            <p className="m-0 text-caption text-ink-subtle">{C.gridCaption}</p>
          </div>
          <div className="md:hidden">
            <PairPicker />
            <p className="m-0 mt-4 text-caption text-ink-subtle">{C.mobileNote}</p>
          </div>
        </div>
      </section>
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Faq page={page} />
      <Disclaimer />
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// 配对页
// ---------------------------------------------------------------------------

const ASPECT_ORDER = [
  'trine',
  'sextile',
  'opposition',
  'square',
  'conjunction',
  'semisextile',
  'quincunx',
] as const

export function PairPage({ page }: { page: WesternZodiacPageData }) {
  const [first, second] = parsePairSlug(page.key) ?? ['aries', 'aries']
  const fact = pairFacts(first, second)
  const a = signOf(first)
  const b = signOf(second)
  const tableId = useId()
  const index = PAIRS.findIndex(([x, y]) => x === first && y === second)
  const previous = PAIRS[index - 1]
  const next = PAIRS[index + 1]
  const adjacent = new Set([previous, next].map((pair) => pair && pairPath(...pair)))
  // 「More Aries pairs」：本组第一个星座的其他配对，按相位种类挑 3 组，不与上一组、下一组重复
  const more = rowsOf(first)
    .filter(({ fact: other }) => {
      const path = pairPath(other.first, other.second)
      return path !== page.path && !adjacent.has(path)
    })
    .sort((x, y) => ASPECT_ORDER.indexOf(x.fact.aspect) - ASPECT_ORDER.indexOf(y.fact.aspect))
    .slice(0, 3)
  const describe = (other: PairFact) =>
    `${ASPECT_LABEL[other.aspect]} · ${ELEMENT_LABEL[signOf(other.first).element].toLowerCase()} and ${ELEMENT_LABEL[signOf(other.second).element].toLowerCase()}`
  return (
    <Shell tool="western-zodiac-compatibility">
      <PageHeader
        breadcrumb={page.breadcrumb}
        current={pairName(first, second)}
        heading={page.heading}
        lede={page.lede}
      />
      <section
        aria-label={C.quickLabel}
        className="flex max-w-190 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6"
      >
        <span className="flex items-center gap-3">
          <Glyph sign={a} small />
          <span aria-hidden="true" className="text-ink-subtle text-title">
            ×
          </span>
          <Glyph sign={b} small />
        </span>
        <FactList
          items={[
            [C.aspect, ASPECT_LABEL[fact.aspect]],
            [C.signsApart, String(fact.distance)],
            [signName(first), dateRange(a.start, a.end)],
            ...(first === second ? [] : ([[signName(second), dateRange(b.start, b.end)]] as const)),
          ]}
        />
      </section>
      <section data-table-section aria-labelledby={tableId} className="flex flex-col gap-5">
        <h2 id={tableId} className={h2}>
          {C.signBySign}
        </h2>
        <p className={muted}>{C.signBySignNote}</p>
        <FactTable
          caption={`${pairName(first, second)}: ${C.signBySign}`}
          narrow
          stack
          containerProps={{ 'data-locale-fixed': true }}
          rows={[
            {
              key: 'element',
              label: C.element,
              a: ELEMENT_LABEL[a.element],
              b: ELEMENT_LABEL[b.element],
              note: traditionNote.element(fact.elementRelation),
            },
            {
              key: 'modality',
              label: C.modality,
              a: MODALITY_LABEL[a.modality],
              b: MODALITY_LABEL[b.modality],
              note: traditionNote.modality(a.modality, b.modality),
            },
            {
              key: 'ruler',
              label: C.ruler,
              a: planetText(a),
              b: planetText(b),
              note: traditionNote.ruler(a.ruler, b.ruler),
            },
            {
              key: 'aspect',
              label: C.aspect,
              a: aspectWithAngle(fact),
              b: `${fact.distance} ${fact.distance === 1 ? 'sign' : 'signs'} apart`,
              note: traditionNote.aspect(fact.aspect),
            },
          ]}
          rowKey={(row) => row.key}
          columns={[
            { key: 'factor', header: C.factor, kind: 'key', cell: (row) => row.label },
            {
              key: 'a',
              header: signName(first),
              stacked: 'label',
              cell: (row) => row.a,
            },
            {
              key: 'b',
              header: first === second ? C.betweenThem : signName(second),
              stacked: 'label',
              cell: (row) => row.b,
            },
            { key: 'note', header: C.inTradition, stacked: 'full', cell: (row) => row.note },
          ]}
        />
      </section>
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Faq page={page} />
      <div
        data-link-zone="action"
        className="flex max-w-190 flex-col gap-1 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8"
      >
        <p className="m-0 text-body text-ink-muted">{C.bandText}</p>
        <a href={href('/life-path-compatibility')} className={cn('shrink-0 text-body', inlineLink)}>
          {C.bandLink}
        </a>
      </div>
      <LinkCardGrid
        data-table-section=""
        title={C.moreTitle(signName(first))}
        columns={2}
        items={[
          ...more.map(({ fact: other }) => ({
            href: href(pairPath(other.first, other.second)),
            title: pairName(other.first, other.second),
            description: describe(other),
          })),
          { href: href(ZODIAC_COMPAT_PATH), title: C.allPairs, description: C.allPairsNote },
        ]}
      />
      <SeriesNav
        label={C.seriesLabel}
        previous={
          previous
            ? { href: href(pairPath(...previous)), title: pairName(...previous), label: C.previous }
            : null
        }
        next={
          next ? { href: href(pairPath(...next)), title: pairName(...next), label: C.next } : null
        }
      />
      <Disclaimer />
    </Shell>
  )
}
