import type { Branch, Element } from '@xuanxue/bazi'
import {
  cn,
  LinkCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SeriesNav,
} from '@xuanxue/ui'
import { FactTable, PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useId, useMemo, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { ELEMENT_LABEL } from '../../tools/bazi/labels.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolContext } from '../../tools/context.tsx'
import { Disclaimer } from '../../tools/disclaimer.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { fieldControl, fieldLabel } from '../../tools/form.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import { ELEMENT_DOT, elementHanzi, glyph, zodiacName } from '../zodiac/labels.ts'
import { ZODIAC_KEYS, type ZodiacKey } from '../zodiac/paths.ts'
import { type PairMark, TRIAD_GROUPS } from './constants.ts'
import type { PairFactsView, PairRelation } from './data.ts'
import type { ZodiacPairChildData, ZodiacPairHubData } from './page.functions.ts'
import {
  isZodiacPairLocale,
  ZODIAC_PAIR_HUB_TITLES,
  type ZodiacPairKey,
  type ZodiacPairLocale,
  zodiacPairKey,
  zodiacPairPath,
  zodiacPairSlug,
} from './paths.ts'

/**
 * 生肖配对总表与配对页（设计稿 docs/design/prototypes/content-growth-v2-tools/ZodiacPair.dc.html、
 * ZodiacGrid.dc.html、ZodiacGridMobile.dc.html 与 Proposals「PairGrid」，使用者 2026-11-23 确认）。
 * 组件不写死语言：文案取 messages/<locale>/zodiac-pair.json 与 zodiac.json，地址取 paths.ts；
 * ko、en（第 17 组）只加内容与文案。地支关系、五行与年份都来自服务端引擎计算，本页只渲染。
 * 配对页的小标题按 design 决策 9（两支关系、相处的节奏、彼此能学的、需要磨合的地方、用八字看两个人、FAQ），
 * 设计稿的「逐项关系」表放在「两支关系」段，年份表与合盘入口放在单独的数据表段。
 */

const pairLocale = (locale: string): ZodiacPairLocale =>
  isZodiacPairLocale(locale) ? locale : 'zh-Hans'
const pairHref = (locale: string, key: ZodiacPairKey | 'index') =>
  toolHref(zodiacPairPath(pairLocale(locale), key), locale)

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'

const RELATION_LABEL: Readonly<Record<PairRelation, () => string>> = {
  sixCombine: m.zodiac_pair_rel_six,
  triad: m.zodiac_pair_rel_triad,
  clash: m.zodiac_pair_rel_clash,
  punish: m.zodiac_pair_rel_punish,
  harm: m.zodiac_pair_rel_harm,
  break: m.zodiac_pair_rel_break,
}

const MARK_LABEL: Readonly<Record<PairMark, () => string>> = {
  same: m.zodiac_pair_mark_same,
  sixCombine: m.zodiac_pair_mark_six,
  triad: m.zodiac_pair_mark_triad,
  clash: m.zodiac_pair_mark_clash,
  harm: m.zodiac_pair_mark_harm,
  none: m.zodiac_pair_mark_none,
}
const markKind = (mark: PairMark) =>
  mark === 'sixCombine' || mark === 'triad'
    ? 'combine'
    : mark === 'clash' || mark === 'harm'
      ? 'clash'
      : 'other'

/** 一对地支的关系名（本页事实表与速览）：自刑写「自刑」，没有关系时写「无特定关系」 */
function relationNames(facts: PairFactsView): string[] {
  const [a, b] = facts.branches
  return facts.relations.map((relation) =>
    relation === 'punish' && a === b ? m.zodiac_pair_rel_self_punish() : RELATION_LABEL[relation](),
  )
}

const triadName = (index: number) => {
  const group = TRIAD_GROUPS[index]
  return group
    ? { triad: group.branches.map(glyph).join(''), element: elementHanzi(group.element) }
    : { triad: '', element: '' }
}

function elementValue(facts: PairFactsView): string {
  const [a, b] = facts.branches
  const [ea, eb] = facts.elements
  const side = (branch: Branch, element: Element) => ({
    glyph: glyph(branch),
    element: elementHanzi(element),
  })
  const x = side(a, ea)
  const y = side(b, eb)
  switch (facts.elementRelation) {
    case 'same':
      return m.zodiac_pair_element_same({ a: x.glyph, b: y.glyph, element: x.element })
    case 'aGeneratesB':
    case 'bGeneratesA': {
      const [from, to] = facts.elementRelation === 'aGeneratesB' ? [x, y] : [y, x]
      return m.zodiac_pair_element_generates({
        from: from.glyph,
        fromElement: from.element,
        to: to.glyph,
        toElement: to.element,
      })
    }
    default: {
      const [from, to] = facts.elementRelation === 'aOvercomesB' ? [x, y] : [y, x]
      return m.zodiac_pair_element_overcomes({
        from: from.glyph,
        fromElement: from.element,
        to: to.glyph,
        toElement: to.element,
      })
    }
  }
}

function Shell({ tool, locale, children }: { tool: string; locale: string; children: ReactNode }) {
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        {/* 韩文按词断行（同生肖页），避免在音节之间换行 */}
        <PageWidth
          className={cn(
            'flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28',
            locale === 'ko' && 'break-keep',
          )}
        >
          {children}
        </PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

function PageHeader({
  locale,
  breadcrumb,
  current,
  heading,
  lede,
}: {
  locale: string
  breadcrumb: readonly PageLink[]
  current: string
  heading: string
  lede: string
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      <Breadcrumb
        items={[
          ...breadcrumb.map((item) => ({ name: item.label, href: toolHref(item.href, locale) })),
          { name: current },
        ]}
      />
      <h1 className="m-0 text-balance font-heading text-ink text-title">{heading}</h1>
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

function ElementMark({ element }: { element: Element }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', ELEMENT_DOT[element])}
      />
      {ELEMENT_LABEL[element]()}
    </span>
  )
}

/** 页尾入口：合盘已发布时链接合盘，否则链接八字排盘（page.functions.ts 的 actionOf） */
function ActionBand({ action, locale }: { action: ZodiacPairChildData['action']; locale: string }) {
  const compat = action.kind === 'compat'
  return (
    <div className="flex max-w-190 flex-col gap-1 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
      <p className="m-0 text-body text-ink-muted">
        {compat ? m.zodiac_pair_action_compat_text() : m.zodiac_pair_action_chart_text()}
      </p>
      <a
        data-link-zone="action"
        href={toolHref(action.path, locale)}
        className={cn('shrink-0 text-body', inlineLink)}
      >
        {compat ? m.zodiac_pair_action_compat_link() : m.zodiac_pair_action_chart_link()}
      </a>
    </div>
  )
}

export function ZodiacPairPage({ page }: { page: ZodiacPairChildData }) {
  const { facts, locale } = page
  const [a, b] = facts.branches
  const nameA = zodiacName(a)
  const nameB = zodiacName(b)
  const [relations, ...articles] = page.sections
  const relationsId = useId()
  const yearsId = useId()
  const relatedId = useId()
  const names = relationNames(facts)
  const rows = [
    {
      key: 'relations',
      label: m.zodiac_pair_row_relations(),
      value:
        names.length === 0
          ? m.zodiac_pair_relation_none()
          : names
              .map((relation) =>
                m.zodiac_pair_relation_value({ a: glyph(a), b: glyph(b), relation }),
              )
              .join(m.zodiac_pair_year_separator()),
    },
    { key: 'elements', label: m.zodiac_pair_row_elements(), value: elementValue(facts) },
    {
      key: 'triads',
      label: m.zodiac_pair_row_triads(),
      value:
        facts.triads[0] === facts.triads[1]
          ? m.zodiac_pair_triad_same(triadName(facts.triads[0]))
          : m.zodiac_pair_triad_apart({
              a: glyph(a),
              b: glyph(b),
              triadA: triadName(facts.triads[0]).triad,
              elementA: triadName(facts.triads[0]).element,
              triadB: triadName(facts.triads[1]).triad,
              elementB: triadName(facts.triads[1]).element,
            }),
    },
  ]
  const slugOf = (key: ZodiacPairKey) => zodiacPairSlug(pairLocale(locale), key)
  return (
    <Shell tool="zodiac-pair" locale={locale}>
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={slugOf(page.key)}
        heading={page.heading}
        lede={page.lede}
      />

      <section
        aria-label={m.zodiac_pair_quick_label()}
        className="flex max-w-190 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8"
      >
        <div aria-hidden="true" className="flex shrink-0 items-center gap-3">
          {[a, b].map((branch, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 同生肖配对两格同字
              key={index}
              className="flex size-20 items-center justify-center rounded-object bg-surface-2 font-bold font-heading text-display text-mark"
            >
              {glyph(branch)}
            </span>
          ))}
        </div>
        <dl className="m-0 grid w-full min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {[
            [
              m.zodiac_pair_fact_relation(),
              names.length ? names.join(m.zodiac_pair_year_separator()) : m.zodiac_pair_rel_none(),
            ],
            [
              m.zodiac_pair_fact_sign({ name: nameA, glyph: glyph(a) }),
              <ElementMark key="a" element={facts.elements[0]} />,
            ],
            ...(a === b
              ? []
              : [
                  [
                    m.zodiac_pair_fact_sign({ name: nameB, glyph: glyph(b) }),
                    <ElementMark key="b" element={facts.elements[1]} />,
                  ],
                ]),
          ].map(([label, value]) => (
            <div key={String(label)} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-caption text-ink-subtle">{label}</dt>
              <dd className="m-0 text-body text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {relations && (
        <section aria-labelledby={relationsId} className="flex flex-col gap-5">
          <h2 id={relationsId} className={h2}>
            {relations.title}
          </h2>
          <p className={muted}>{page.relationsNote}</p>
          <FactTable
            caption={m.zodiac_pair_table_caption({ a: nameA, b: nameB })}
            rows={rows}
            rowKey={(row) => row.key}
            stack
            narrow
            containerProps={{ 'data-locale-fixed': true }}
            columns={[
              {
                key: 'item',
                header: m.zodiac_pair_col_item(),
                kind: 'key',
                cell: (row) => row.label,
              },
              {
                key: 'value',
                header: m.zodiac_pair_col_value(),
                stacked: 'full',
                cell: (row) => row.value,
              },
            ]}
          />
          <RichContent html={relations.html} className="max-w-180" />
        </section>
      )}

      {articles.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}

      {/* 年份表段：逐行引擎数据，组内相似度只报告（data-table-section）；合盘入口放在本段末尾 */}
      <section data-table-section aria-labelledby={yearsId} className="flex flex-col gap-5">
        <h2 id={yearsId} className={h2}>
          {m.zodiac_pair_years_title()}
        </h2>
        <FactTable
          caption={m.zodiac_pair_years_caption({
            names: a === b ? nameA : m.zodiac_pair_cross({ a: nameA, b: nameB }),
          })}
          rows={page.years}
          rowKey={(row) => row.branch}
          narrow
          containerProps={{ 'data-locale-fixed': true }}
          columns={[
            {
              key: 'sign',
              header: m.zodiac_pair_col_sign(),
              kind: 'key',
              cell: (row) => zodiacName(row.branch),
            },
            {
              key: 'branch',
              header: m.zodiac_pair_col_branch(),
              kind: 'glyph',
              cell: (row) => glyph(row.branch),
            },
            {
              key: 'years',
              header: m.zodiac_pair_col_years(),
              cell: (row) => row.years.join(m.zodiac_pair_year_separator()),
            },
          ]}
        />
        <p className={muted}>{m.zodiac_pair_years_note()}</p>
        <ActionBand action={page.action} locale={locale} />
      </section>

      <ToolFaq items={page.faq.map(({ q, a: answer }) => ({ question: q, answer }))} />

      <Disclaimer />

      {/* 相关配对是模板区块：用 nav 地标，不属于正文 */}
      <nav data-link-zone="related" aria-labelledby={relatedId} className="flex flex-col gap-3">
        <h2 id={relatedId} className={h2}>
          {m.zodiac_pair_related_title()}
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:gap-3 lg:grid-cols-4">
          {page.related.map((item) => (
            <li key={item.key} className="flex min-w-0">
              <LinkCard
                href={pairHref(locale, item.key)}
                title={slugOf(item.key)}
                description={MARK_LABEL[item.mark]()}
                className="w-full"
              />
            </li>
          ))}
          <li className="flex min-w-0">
            <LinkCard
              href={pairHref(locale, 'index')}
              title={ZODIAC_PAIR_HUB_TITLES[pairLocale(locale)]}
              description={m.zodiac_pair_related_all_note()}
              className="w-full"
            />
          </li>
        </ul>
      </nav>

      <SeriesNav
        label={m.zodiac_pair_series_label()}
        previous={
          page.previous
            ? {
                href: pairHref(locale, page.previous),
                title: slugOf(page.previous),
                label: m.zodiac_pair_previous(),
              }
            : null
        }
        next={
          page.next
            ? {
                href: pairHref(locale, page.next),
                title: slugOf(page.next),
                label: m.zodiac_pair_next(),
              }
            : null
        }
      />
    </Shell>
  )
}

const markOf = (marks: ZodiacPairHubData['marks'], a: ZodiacKey, b: ZodiacKey) =>
  marks[zodiacPairKey(a, b)]

const cellLabel = (a: ZodiacKey, b: ZodiacKey, mark: PairMark) =>
  m.zodiac_pair_cell_label({
    a: zodiacName(a),
    b: zodiacName(b),
    mark: mark === 'none' ? m.zodiac_pair_cell_none() : MARK_LABEL[mark](),
  })

/**
 * 12×12 网格（设计稿 PairGrid）：每格是指向规范配对页的链接，≥ 44px 高；合类用 surface-2 填充，冲类用
 * line-strong 描边，其余为 surface；区分靠填充、描边与文字，不靠色相。只在 ≥ 640px 显示。
 */
export function PairGrid({ page }: { page: ZodiacPairHubData }) {
  const { locale, marks } = page
  return (
    <nav aria-label={m.zodiac_pair_grid_label()} className="grid grid-cols-13 gap-1 max-sm:hidden">
      <span
        aria-hidden="true"
        className="flex min-h-11 items-center justify-center text-caption text-ink-subtle"
      >
        ×
      </span>
      {ZODIAC_KEYS.map((key) => (
        <span
          key={key}
          aria-hidden="true"
          className="flex min-h-11 items-center justify-center font-heading font-medium text-body text-ink"
        >
          {zodiacName(key)}
        </span>
      ))}
      {ZODIAC_KEYS.flatMap((row) => [
        <span
          key={`${row}-head`}
          aria-hidden="true"
          className="flex min-h-11 items-center justify-center font-heading font-medium text-body text-ink"
        >
          {zodiacName(row)}
        </span>,
        ...ZODIAC_KEYS.map((column) => {
          const mark = markOf(marks, row, column)
          const kind = markKind(mark)
          return (
            <a
              key={`${row}-${column}`}
              href={pairHref(locale, zodiacPairKey(row, column))}
              aria-label={cellLabel(row, column, mark)}
              className={cn(
                'flex min-h-11 items-center justify-center rounded-field text-caption text-ink no-underline transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-ring',
                kind === 'combine' && 'bg-surface-2',
                kind === 'clash' && 'border border-line-strong bg-surface',
                kind === 'other' && 'bg-surface text-ink-subtle',
              )}
            >
              {MARK_LABEL[mark]()}
            </a>
          )
        }),
      ])}
    </nav>
  )
}

/** 手机：两个选择框加一个生肖的 12 行列表（设计稿 ZodiacGridMobile；使用者 2026-11-23 确认的默认） */
function PairPicker({ page }: { page: ZodiacPairHubData }) {
  const { locale, marks } = page
  const [first, setFirst] = useState<ZodiacKey>('zi')
  const [second, setSecond] = useState<ZodiacKey>('chou')
  const firstId = useId()
  const secondId = useId()
  const listId = useId()
  const options = ZODIAC_KEYS.map((key) => ({ value: key, label: zodiacName(key) }))
  const field = (id: string, label: string, value: ZodiacKey, set: (key: ZodiacKey) => void) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <Select value={value} onValueChange={(next) => set(next as ZodiacKey)}>
        <SelectTrigger
          id={id}
          placeholder={label}
          valueLabel={zodiacName(value)}
          className={cn(fieldControl, 'justify-between')}
        />
        <SelectContent>
          {options.map((option, index) => (
            <SelectItem key={option.value} index={index} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
  const name = zodiacName(first)
  return (
    <div className="flex flex-col gap-4 sm:hidden">
      <h3 className="m-0 font-heading text-ink text-subtitle">{m.zodiac_pair_pick_title()}</h3>
      <div className="grid grid-cols-2 gap-3">
        {field(firstId, m.zodiac_pair_pick_a(), first, setFirst)}
        {field(secondId, m.zodiac_pair_pick_b(), second, setSecond)}
      </div>
      <a
        href={pairHref(locale, zodiacPairKey(first, second))}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 font-medium text-body text-primary-foreground no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {m.zodiac_pair_pick_go({ a: name, b: zodiacName(second) })}
      </a>
      <h3 id={listId} className="m-0 mt-3 font-heading text-ink text-subtitle">
        {m.zodiac_pair_pick_list({ name })}
      </h3>
      <ul
        aria-labelledby={listId}
        className="m-0 flex list-none flex-col divide-y divide-line rounded-object bg-surface p-0"
      >
        {ZODIAC_KEYS.map((other) => {
          const mark = markOf(marks, first, other)
          const kind = markKind(mark)
          return (
            <li key={other}>
              <a
                href={pairHref(locale, zodiacPairKey(first, other))}
                className="flex min-h-12 items-center justify-between gap-3 px-4 text-body text-ink no-underline hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span>{m.zodiac_pair_cross({ a: name, b: zodiacName(other) })}</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-caption',
                    kind === 'combine' && 'bg-surface-2 text-ink',
                    kind === 'clash' && 'border border-line-strong text-ink',
                    kind === 'other' && 'text-ink-subtle',
                  )}
                >
                  {mark === 'none' ? m.zodiac_pair_mark_none_list() : MARK_LABEL[mark]()}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ZodiacPairHubPage({ page }: { page: ZodiacPairHubData }) {
  const { locale } = page
  const gridId = useId()
  return (
    <Shell tool="zodiac-pair" locale={locale}>
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={ZODIAC_PAIR_HUB_TITLES[pairLocale(locale)]}
        heading={page.heading}
        lede={page.lede}
      />
      <section aria-labelledby={gridId} className="flex flex-col gap-4">
        <h2 id={gridId} className={h2}>
          {m.zodiac_pair_grid_title()}
        </h2>
        <p className="m-0 flex flex-wrap gap-x-5 gap-y-2 text-caption text-ink-muted max-sm:hidden">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-3.5 rounded-sm bg-surface-2" />
            {m.zodiac_pair_legend_combine()}
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-3.5 rounded-sm border border-line-strong" />
            {m.zodiac_pair_legend_clash()}
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-3.5 rounded-sm bg-surface" />
            {m.zodiac_pair_legend_other()}
          </span>
        </p>
        {/* 网格与手机列表都是模板区块（锚文本是关系名或固定格式），正文内链另由下方正文提供 */}
        <div data-link-zone="related" className="flex flex-col gap-4">
          <PairGrid page={page} />
          <PairPicker page={page} />
        </div>
        <p className="m-0 max-w-180 text-caption text-ink-subtle max-sm:hidden">
          {m.zodiac_pair_grid_note()}
        </p>
      </section>
      {page.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />
      <Disclaimer />
    </Shell>
  )
}
