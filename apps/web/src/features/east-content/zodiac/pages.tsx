import type { Branch, Element } from '@xuanxue/bazi'
import { cn, LinkCard } from '@xuanxue/ui'
import { FactTable, PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useId, useMemo, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { ELEMENT_LABEL } from '../../tools/bazi/labels.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolContext } from '../../tools/context.tsx'
import { DateField } from '../../tools/date-field.tsx'
import { Disclaimer } from '../../tools/disclaimer.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { SubmitButton, ToolForm } from '../../tools/form.tsx'
import { mainToolHref, toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import { CLASH_PAIRS, SIX_COMBINE_PAIRS, TRIADS } from './constants.ts'
import type { ZodiacAnnual, ZodiacRelation } from './data.ts'
import {
  animal,
  annualChips,
  branchPosition,
  ELEMENT_DOT,
  ganzhi,
  glyph,
  hourRange,
  monthDay,
  monthDayTime,
  nayinName,
  RELATION_LABEL,
  zodiacName,
} from './labels.ts'
import { type LookupResult, type LookupYear, lookupZodiac } from './lookup.ts'
import type { ZodiacChildData, ZodiacHubData } from './page.functions.ts'
import { ZODIAC_HUB_TITLES, type ZodiacKey, zodiacPath } from './paths.ts'

/**
 * 生肖枢纽与子页（设计稿 docs/design/prototypes/content-growth-phase2/Main.dc.html、ZodiacPage.dc.html、
 * ZodiacStates.dc.html，使用者 2026-11-22 确认）。只用 @xuanxue/ui 组件与设计 token。
 * 年份表、关系表、流年关系与查询边界都来自服务端引擎计算；本页只渲染。
 */

/** 枢纽正文中插入组件的段（按小标题定位；缺少时组件排在正文之后） */
const HUB_SLOTS: Readonly<Record<string, { table: string; relations: string }>> = {
  'zh-Hans': { table: '十二生肖总表', relations: '三合、六合与六冲' },
}

const BRANCH_INDEX: Readonly<Record<Branch, number>> = {
  zi: 0,
  chou: 1,
  yin: 2,
  mao: 3,
  chen: 4,
  si: 5,
  wu: 6,
  wei: 7,
  shen: 8,
  you: 9,
  xu: 10,
  hai: 11,
}

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const noteBox = 'm-0 max-w-180 rounded-object bg-surface px-6 py-5 text-body text-ink-muted'
const tile = 'flex min-w-0 flex-col gap-1.5 rounded-object bg-surface p-5'
const chip = 'rounded-full bg-surface-2 px-3 py-1 text-caption text-ink'
const tag =
  'ml-2 rounded-full border border-line px-2 py-0.5 font-normal text-caption text-ink-subtle'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'

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

const relationRule = (relation: ZodiacRelation, natal: Branch): string => {
  const [other] = relation.branches
  const one = (branch: Branch | undefined) =>
    branch ? { other: glyph(branch), animal: animal(branch) } : { other: '', animal: '' }
  switch (relation.type) {
    case 'sixCombine':
      return m.zodiac_rule_six(one(other))
    case 'clash':
      return m.zodiac_rule_clash(one(other))
    case 'harm':
      return m.zodiac_rule_harm(one(other))
    case 'triad': {
      const triad = TRIADS.find((entry) => entry.branches.includes(natal))
      return m.zodiac_rule_triad({
        branches: relation.branches.map(glyph).join(m.zodiac_rule_list_separator()),
        element: triad ? ELEMENT_LABEL[triad.element]() : '',
      })
    }
    case 'punish':
      return other === natal
        ? m.zodiac_rule_punish_self({ glyph: glyph(natal) })
        : m.zodiac_rule_punish({
            others: relation.branches
              .map((branch) => `${glyph(branch)}（${animal(branch)}）`)
              .join(m.zodiac_rule_list_separator()),
          })
  }
}

const relationBranches = (relation: ZodiacRelation, natal: Branch) =>
  relation.type === 'triad'
    ? relation.branches.map(glyph).join(' ')
    : [
        natal,
        ...relation.branches.filter((branch) => branch !== natal || relation.type === 'punish'),
      ]
        .map(glyph)
        .join(' ')

/** 本年 / 次年卡片：引擎算出的太岁与地支关系；缺少撰写文字时只列关系名，不用模板句（zodiac-pages 规格「本年与次年的流年主题」） */
export function AnnualCard({
  annual,
  natal,
  text,
}: {
  annual: ZodiacAnnual
  natal: Branch
  text: string | undefined
}) {
  const label = ganzhi(annual.stem, annual.branch)
  return (
    <div className={cn(tile, 'gap-2')}>
      <p className="m-0 text-caption text-ink-subtle">
        {m.zodiac_annual_since({
          year: annual.year,
          month: annual.lichun.month,
          day: annual.lichun.day,
        })}
      </p>
      <h3 className="m-0 font-heading text-ink text-subtitle">
        {m.zodiac_annual_heading({ year: annual.year, ganzhi: label })}
      </h3>
      <ul
        aria-label={m.zodiac_annual_relations({ ganzhi: label, glyph: glyph(natal) })}
        className="m-0 flex list-none flex-wrap gap-2 p-0"
      >
        {annualChips(annual, natal).map((name) => (
          <li key={name} className={chip}>
            {name}
          </li>
        ))}
      </ul>
      {text ? <p className="m-0 text-body text-ink-muted">{text}</p> : null}
    </div>
  )
}

export function ZodiacChildPage({ page }: { page: ZodiacChildData }) {
  const { facts, locale } = page
  const natal = facts.branch
  const index = BRANCH_INDEX[natal]
  const name = zodiacName(natal)
  const [relations, ...articles] = page.sections
  const yearsId = useId()
  const relationsId = useId()
  const annualId = useId()
  const othersId = useId()
  const example = facts.example
  return (
    <Shell tool={`zodiac-${page.key}`}>
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={name}
        heading={page.heading}
        lede={page.lede}
      />
      <section
        aria-label={m.zodiac_quick_label()}
        className="flex max-w-190 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8"
      >
        <span
          aria-hidden="true"
          className="flex size-24 shrink-0 items-center justify-center rounded-object bg-surface-2 font-bold font-heading text-display text-mark"
        >
          {glyph(natal)}
        </span>
        <dl className="m-0 grid w-full min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {[
            [m.zodiac_fact_branch(), branchPosition(locale, index)],
            [m.zodiac_fact_element(), <ElementMark key="element" element={facts.element} />],
            [
              m.zodiac_fact_polarity(),
              facts.polarity === 'yang' ? m.zodiac_polarity_yang() : m.zodiac_polarity_yin(),
            ],
            [
              m.zodiac_fact_hour(),
              m.zodiac_hour_value({ glyph: glyph(natal), range: hourRange(index) }),
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-caption text-ink-subtle">{label}</dt>
              <dd className="m-0 text-body text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 年份表段：逐行引擎数据，组内相似度只报告（data-table-section，seo 规格「程序化页面集合的组内相似度门槛」） */}
      <section data-table-section aria-labelledby={yearsId} className="flex flex-col gap-5">
        <h2 id={yearsId} className={h2}>
          {m.zodiac_years_title()}
        </h2>
        <p className={muted}>{page.yearsNote}</p>
        <FactTable
          caption={m.zodiac_years_caption({ name })}
          rows={facts.years}
          rowKey={(row) => String(row.year)}
          isCurrent={(row) => row.year === facts.currentYear}
          stack
          narrow
          containerProps={{ 'data-locale-fixed': true }}
          columns={[
            {
              key: 'year',
              header: m.zodiac_col_year(),
              kind: 'key',
              cell: (row) => (
                <>
                  {row.year}
                  {row.year === facts.currentYear && (
                    <span className={tag}>{m.zodiac_current_tag()}</span>
                  )}
                </>
              ),
            },
            {
              key: 'ganzhi',
              header: m.zodiac_col_ganzhi(),
              kind: 'glyph',
              cell: (row) => ganzhi(row.stem, row.branch),
            },
            {
              key: 'nayin',
              header: m.zodiac_col_nayin(),
              stacked: 'full',
              cell: (row) => nayinName(row.nayinIndex),
            },
            {
              key: 'lichun',
              header: m.zodiac_col_lichun(),
              kind: 'nowrap',
              stacked: 'label',
              stackLabel: m.zodiac_col_lichun_short(),
              cell: (row) => monthDayTime(row.lichun),
            },
            {
              key: 'new-year',
              header: m.zodiac_col_new_year(),
              kind: 'nowrap',
              stacked: 'label',
              cell: (row) => monthDay(row.newYear),
            },
          ]}
        />
        <p className={muted}>{m.zodiac_years_rule({ glyph: glyph(natal), name })}</p>
        {example && (
          <p className={noteBox}>
            {(example.order === 'after'
              ? m.zodiac_years_example_after
              : example.order === 'same'
                ? m.zodiac_years_example_same
                : m.zodiac_years_example_before)({
              year: example.year,
              lichun: monthDayTime(example.lichun),
              newYear: monthDay(example.newYear),
              name,
              previous: zodiacName(example.previous),
            })}
          </p>
        )}
      </section>

      {relations && (
        <section aria-labelledby={relationsId} className="flex flex-col gap-5">
          <h2 id={relationsId} className={h2}>
            {relations.title}
          </h2>
          <p className={muted}>{page.relationsNote}</p>
          <FactTable
            caption={m.zodiac_relations_caption({ glyph: glyph(natal) })}
            rows={facts.relations}
            rowKey={(row) => row.type}
            stack
            narrow
            containerProps={{ 'data-locale-fixed': true }}
            columns={[
              {
                key: 'relation',
                header: m.zodiac_col_relation(),
                kind: 'key',
                cell: (row) => RELATION_LABEL[row.type](),
              },
              {
                key: 'branches',
                header: m.zodiac_col_branches(),
                kind: 'glyph',
                cell: (row) => relationBranches(row, natal),
              },
              {
                key: 'rule',
                header: m.zodiac_col_rule(),
                stacked: 'full',
                cell: (row) => relationRule(row, natal),
              },
            ]}
          />
          <RichContent html={relations.html} className="max-w-180" />
        </section>
      )}

      {articles.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}

      <section aria-labelledby={annualId} className="flex flex-col gap-5">
        <h2 id={annualId} className={h2}>
          {m.zodiac_annual_title()}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {facts.annual.map((annual) => (
            <AnnualCard
              key={annual.year}
              annual={annual}
              natal={natal}
              text={page.annualText[ganzhi(annual.stem, annual.branch)]}
            />
          ))}
        </div>
      </section>

      <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />

      {page.siblings.length > 0 && (
        // 同组区块是导航：用 nav 地标，不属于正文
        <nav data-link-zone="siblings" aria-labelledby={othersId} className="flex flex-col gap-3">
          <h2 id={othersId} className={h2}>
            {m.zodiac_others_title()}
          </h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:gap-3 lg:grid-cols-4">
            {page.siblings.map((item) => {
              const branch = item.key as Branch
              const triad = TRIADS.find((entry) => entry.branches.includes(branch))
              return (
                <li key={item.href} className="flex min-w-0">
                  <LinkCard
                    href={toolHref(decodeURI(item.href), locale)}
                    title={item.label}
                    description={m.zodiac_sibling_note({
                      glyph: glyph(branch),
                      element: ELEMENT_LABEL[ELEMENT_OF[branch]](),
                      triad: triad ? triad.branches.map(glyph).join('') : '',
                    })}
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

const ELEMENT_OF: Readonly<Record<Branch, Element>> = {
  zi: 'water',
  chou: 'earth',
  yin: 'wood',
  mao: 'wood',
  chen: 'earth',
  si: 'fire',
  wu: 'fire',
  wei: 'earth',
  shen: 'metal',
  you: 'metal',
  xu: 'earth',
  hai: 'water',
}

function LookupTile({
  label,
  value,
  note,
  link,
}: {
  label: string
  value: string
  note: string
  link: { href: string; text: string } | null
}) {
  return (
    <div className={tile}>
      <p className="m-0 text-caption text-ink-subtle">{label}</p>
      <p className="m-0 font-bold font-heading text-ink text-subtitle">{value}</p>
      <p className="m-0 text-body text-ink-muted">{note}</p>
      {link && (
        <a href={link.href} className={cn('self-start text-body', inlineLink)}>
          {link.text}
        </a>
      )}
    </div>
  )
}

function lookupValue(result: LookupYear) {
  return m.zodiac_lookup_value({
    name: zodiacName(result.branch),
    ganzhi: ganzhi(result.stem, result.branch),
  })
}

function LookupResultView({
  result,
  locale,
}: {
  result: Extract<LookupResult, { kind: 'ok' }>
  locale: string
}) {
  const { lichun, newYear, year } = result
  const lichunText = m.zodiac_month_day_time({
    month: lichun.month,
    day: lichun.day,
    time: lichun.time,
  })
  const childLink = (branch: Branch) => ({
    href: toolHref(zodiacPath('zh-Hans', branch as ZodiacKey), locale),
    text: m.zodiac_lookup_link({ name: zodiacName(branch) }),
  })
  const byLichun = lichun.state === 'before' ? lichun.before : lichun.after
  const differ = lichun.state !== 'same' && byLichun.branch !== newYear.result.branch
  return (
    <>
      <div className="grid max-w-190 grid-cols-1 gap-3 sm:grid-cols-2">
        <LookupTile
          label={m.zodiac_lookup_by_lichun()}
          value={
            lichun.state === 'same'
              ? m.zodiac_lookup_value_either({
                  after: zodiacName(lichun.after.branch),
                  before: zodiacName(lichun.before.branch),
                })
              : lookupValue(byLichun)
          }
          note={
            lichun.state === 'same'
              ? m.zodiac_lookup_lichun_same({
                  year,
                  lichun: lichunText,
                  time: lichun.time,
                  after: zodiacName(lichun.after.branch),
                  before: zodiacName(lichun.before.branch),
                })
              : (lichun.state === 'after'
                  ? m.zodiac_lookup_lichun_after
                  : m.zodiac_lookup_lichun_before)({
                  year,
                  lichun: lichunText,
                })
          }
          link={lichun.state === 'same' ? null : childLink(byLichun.branch)}
        />
        <LookupTile
          label={m.zodiac_lookup_by_new_year()}
          value={lookupValue(newYear.result)}
          note={(newYear.state === 'after'
            ? m.zodiac_lookup_new_year_after
            : m.zodiac_lookup_new_year_before)({
            year,
            date: m.zodiac_month_day({ month: newYear.month, day: newYear.day }),
          })}
          link={childLink(newYear.result.branch)}
        />
      </div>
      {differ && <p className={noteBox}>{m.zodiac_lookup_differ()}</p>}
    </>
  )
}

function ZodiacLookup({ page }: { page: ZodiacHubData }) {
  const [result, setResult] = useState<LookupResult | null>(null)
  const hintId = useId()
  const error =
    result?.kind === 'required'
      ? m.zodiac_lookup_required()
      : result?.kind === 'invalid'
        ? m.zodiac_lookup_invalid()
        : result?.kind === 'range'
          ? m.zodiac_lookup_range()
          : undefined
  return (
    <>
      <div data-locale-fixed className="contents">
        <ToolForm
          label={m.zodiac_lookup_label()}
          onSubmit={(data) =>
            setResult(lookupZodiac(String(data.get('birthDate') ?? ''), page.facts.boundaries))
          }
        >
          <div className="flex flex-col gap-2">
            <DateField
              label={m.zodiac_lookup_date()}
              name="birthDate"
              invalid={Boolean(error)}
              describedBy={hintId}
              error={error}
            />
            <p id={hintId} className="m-0 text-caption text-ink-subtle">
              {m.zodiac_lookup_hint()}
            </p>
          </div>
          <SubmitButton className="sm:col-span-1 sm:mt-7 sm:w-full sm:self-start">
            {m.zodiac_lookup_submit()}
          </SubmitButton>
        </ToolForm>
      </div>
      <section
        data-locale-fixed
        aria-label={m.tools_results_label()}
        aria-live="polite"
        className="flex flex-col gap-3 empty:hidden"
      >
        {result?.kind === 'ok' ? <LookupResultView result={result} locale={page.locale} /> : null}
      </section>
    </>
  )
}

function HubTable({ page }: { page: ZodiacHubData }) {
  const { facts, locale } = page
  return (
    <FactTable
      caption={m.zodiac_hub_table_caption()}
      rows={facts.rows}
      rowKey={(row) => row.key}
      isCurrent={(row) => row.branch === facts.currentBranch}
      containerProps={{ 'data-locale-fixed': true }}
      columns={[
        {
          key: 'animal',
          header: m.zodiac_hub_col_animal(),
          kind: 'key',
          cell: (row) => (
            <>
              <a href={toolHref(zodiacPath('zh-Hans', row.key), locale)} className={inlineLink}>
                {zodiacName(row.branch)}
              </a>
              {row.branch === facts.currentBranch && (
                <span className={tag}>{m.zodiac_current_tag()}</span>
              )}
            </>
          ),
        },
        {
          key: 'branch',
          header: m.zodiac_hub_col_branch(),
          kind: 'glyph',
          cell: (row) => glyph(row.branch),
        },
        {
          key: 'element',
          header: m.zodiac_hub_col_element(),
          kind: 'nowrap',
          cell: (row) => <ElementMark element={row.element} />,
        },
        {
          key: 'triad',
          header: m.zodiac_hub_col_triad(),
          desktopOnly: true,
          cell: (row) => {
            const triad = TRIADS[row.triad]
            return triad
              ? m.zodiac_triad_value({
                  branches: triad.branches.map(glyph).join(''),
                  element: ELEMENT_LABEL[triad.element](),
                })
              : ''
          },
        },
        {
          key: 'recent',
          header: m.zodiac_hub_col_recent(),
          kind: 'nowrap',
          cell: (row) => row.recent.join(m.zodiac_year_list_separator()),
        },
      ]}
    />
  )
}

function HubRelations() {
  const pairs = (list: readonly (readonly [Branch, Branch])[]) => (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {list.map(([a, b]) => (
        <li key={a} className={chip}>
          {glyph(a)} {glyph(b)}
        </li>
      ))}
    </ul>
  )
  return (
    <div data-locale-fixed className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className={tile}>
        <h3 className="m-0 font-heading text-ink text-subtitle">{m.zodiac_hub_triad_title()}</h3>
        <p className="m-0 text-caption text-ink-subtle">{m.zodiac_hub_triad_note()}</p>
        <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0 text-body text-ink-muted">
          {TRIADS.map((triad) => (
            <li key={triad.element} className="flex flex-wrap items-center gap-x-3">
              <span className="inline-flex items-center gap-1.5 text-ink">
                <span
                  aria-hidden="true"
                  className={cn('size-2 rounded-full', ELEMENT_DOT[triad.element])}
                />
                {m.zodiac_element_ju({ element: ELEMENT_LABEL[triad.element]() })}
              </span>
              <span>
                {triad.branches.map(glyph).join(' ')}（{triad.branches.map(animal).join(' ')}）
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={tile}>
        <h3 className="m-0 font-heading text-ink text-subtitle">{m.zodiac_hub_six_title()}</h3>
        <p className="m-0 text-caption text-ink-subtle">{m.zodiac_hub_six_note()}</p>
        {pairs(SIX_COMBINE_PAIRS)}
      </div>
      <div className={tile}>
        <h3 className="m-0 font-heading text-ink text-subtitle">{m.zodiac_hub_clash_title()}</h3>
        <p className="m-0 text-caption text-ink-subtle">{m.zodiac_hub_clash_note()}</p>
        {pairs(CLASH_PAIRS)}
      </div>
    </div>
  )
}

export function ZodiacHubPage({ page }: { page: ZodiacHubData }) {
  const { locale } = page
  const slots = HUB_SLOTS[locale]
  const inserted = { table: false, relations: false }
  const body = page.sections.map((section) => {
    const isTable = section.title === slots?.table
    const isRelations = section.title === slots?.relations
    if (isTable) inserted.table = true
    if (isRelations) inserted.relations = true
    return (
      <div key={section.title} className="flex flex-col gap-5">
        <ProseSection title={section.title} html={section.html} />
        {isTable && <HubTable page={page} />}
        {isRelations && <HubRelations />}
      </div>
    )
  })
  const bazi = mainToolHref(locale, 'east')
  return (
    <Shell tool="zodiac">
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={ZODIAC_HUB_TITLES['zh-Hans']}
        heading={page.heading}
        lede={page.lede}
      />
      <ZodiacLookup page={page} />
      {body}
      {!inserted.table && <HubTable page={page} />}
      {!inserted.relations && <HubRelations />}
      <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />
      <div
        data-link-zone="action"
        className="flex max-w-190 flex-col gap-1 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8"
      >
        <p className="m-0 text-body text-ink-muted">{m.zodiac_band_text()}</p>
        <a href={bazi} className={cn('shrink-0 text-body', inlineLink)}>
          {m.zodiac_band_link({ tool: m.bazi_link_home() })}
        </a>
      </div>
      <Disclaimer />
    </Shell>
  )
}
