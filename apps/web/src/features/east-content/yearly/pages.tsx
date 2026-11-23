import type { Branch, Element } from '@xuanxue/bazi'
import { Alert, AlertDescription, Badge, cn } from '@xuanxue/ui'
import { FactTable, PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useId, useMemo } from 'react'
import { m } from '../../../paraglide/messages.js'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolContext } from '../../tools/context.tsx'
import { Disclaimer } from '../../tools/disclaimer.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import type { YearlyBirthRow, YearlyRow, YearlyYearFacts } from './data.ts'
import {
  branchLabel,
  dateText,
  dayBefore,
  ELEMENT_DOT,
  elementName,
  elementRelationText,
  ganzhiLabel,
  glyph,
  nayinName,
  relationText,
  stemLabel,
  taiSuiText,
  timeText,
  triadBranches,
  zodiacName,
} from './labels.ts'
import type { YearlyChildData, YearlyHubData } from './page.functions.ts'

/**
 * 年度枢纽与年度生肖页（设计稿 docs/design/prototypes/content-growth-v2-tools/Year2027Sign.dc.html、
 * Year2027SignArchived.dc.html，使用者 2026-11-23 确认）。只用 @xuanxue/ui 组件与设计 token。
 * 关系表、出生年份与纳音、立春与春节都来自服务端引擎计算；本页只渲染。组件不按语言分支，
 * 各语言的差异都在 messages/<locale>/yearly.json 与内容文件里（第 9、10、11 组复用）。
 *
 * 子页 H2 顺序（design 决策 6）：起算日（数据段）→ 与流年的关系（正文第 1 段 + 关系表）→
 * 三个主题段 → 纳音的读法（years_note）→ 出生年份表（数据段）→ 用完整八字看（正文第 2 段 + 转化带）→ 常见问题。
 * 设计稿「传统上怎么看这一年」并入正文第 1 段；关系表不写「传统说法」整句列，12 页共用的模板字越少，
 * 组内相似度越能反映逐页撰写的正文（design Risks「减少表格中重复的标签文字」）。
 */

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const tile = 'flex min-w-0 flex-col gap-1.5 rounded-object bg-surface p-5'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'

function Shell({ tool, locale, children }: { tool: string; locale: string; children: ReactNode }) {
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        {/* 韩文按词断行（与生肖页相同的 break-keep），避免在音节之间换行 */}
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
  year,
  archived,
}: {
  locale: string
  breadcrumb: readonly PageLink[]
  current: string
  heading: string
  lede: string
  year: number
  archived: boolean
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      <Breadcrumb
        items={[
          ...breadcrumb.map((item) => ({ name: item.label, href: toolHref(item.href, locale) })),
          { name: current },
        ]}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="m-0 text-balance font-heading text-ink text-title">{heading}</h1>
        {/* 年份小标在下一年立春后不再显示（设计稿 hide-archived） */}
        {!archived && (
          <Badge color="accent" className="shrink-0">
            {m.yearly_badge({ year })}
          </Badge>
        )}
      </div>
      <p className="m-0 text-body text-ink-muted">{lede}</p>
    </header>
  )
}

/** 过季提示（设计稿 Year2027SignArchived）：下一年立春后显示，次年同类页已上线时附链接 */
function ArchivedNotice({
  locale,
  year,
  next,
}: {
  locale: string
  year: YearlyYearFacts
  next: { href: string; title: string } | null
}) {
  return (
    <Alert className="max-w-180">
      <AlertDescription>
        {m.yearly_archived({
          ganzhi: ganzhiLabel(locale, year.stem, year.branch),
          date: dateText(year.nextLichun),
        })}{' '}
        {next && (
          <a href={next.href} className={inlineLink}>
            {m.yearly_archived_next({ title: next.title })}
          </a>
        )}
      </AlertDescription>
    </Alert>
  )
}

function ElementMark({ element, label }: { element: Element; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', ELEMENT_DOT[element])}
      />
      {label}
    </span>
  )
}

function QuickFacts({
  glyphText,
  items,
}: {
  glyphText: string
  items: readonly (readonly [string, ReactNode])[]
}) {
  return (
    <section
      aria-label={m.yearly_quick_label()}
      data-locale-fixed
      className="flex max-w-190 flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8"
    >
      <span
        aria-hidden="true"
        className="flex size-24 shrink-0 items-center justify-center rounded-object bg-surface-2 font-bold font-heading text-display text-mark"
      >
        {glyphText}
      </span>
      <dl className="m-0 grid w-full min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption text-ink-subtle">{label}</dt>
            <dd className="m-0 text-body text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const yearElements = (locale: string, year: YearlyYearFacts) => (
  <span className="inline-flex flex-wrap gap-x-3">
    <ElementMark
      element={year.stemElement}
      label={m.yearly_glyph_element({
        glyph: stemLabel(locale, year.stem),
        element: elementName(year.stemElement),
      })}
    />
    <ElementMark
      element={year.branchElement}
      label={m.yearly_glyph_element({
        glyph: branchLabel(locale, year.branch),
        element: elementName(year.branchElement),
      })}
    />
  </span>
)

/** 起算日：立春与春节两种口径（数据段，组内相似度只报告） */
function RangeSection({ locale, year }: { locale: string; year: YearlyYearFacts }) {
  const id = useId()
  return (
    <section data-table-section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className={h2}>
        {m.yearly_range_title({ ganzhi: ganzhiLabel(locale, year.stem, year.branch) })}
      </h2>
      <div data-locale-fixed className="grid max-w-190 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={tile}>
          <p className="m-0 text-caption text-ink-subtle">{m.yearly_range_lichun_label()}</p>
          <p className="m-0 font-heading text-ink text-subtitle">
            {m.yearly_range_span({
              start: dateText(year.lichun),
              end: dateText(year.nextLichun),
            })}
          </p>
          <p className="m-0 text-body text-ink-muted">
            {m.yearly_range_lichun_note({
              date: dateText(year.lichun),
              time: timeText(year.lichun),
            })}
          </p>
        </div>
        <div className={tile}>
          <p className="m-0 text-caption text-ink-subtle">{m.yearly_range_new_year_label()}</p>
          <p className="m-0 font-heading text-ink text-subtitle">
            {m.yearly_range_span({
              start: dateText(year.newYear),
              end: dateText(dayBefore(year.nextNewYear)),
            })}
          </p>
          <p className="m-0 text-body text-ink-muted">
            {m.yearly_range_new_year_note({
              date: dateText(year.newYear),
              next: dateText(year.nextNewYear),
            })}
          </p>
        </div>
      </div>
    </section>
  )
}

function ProseSection({
  title,
  html,
  children,
  before,
}: {
  title: string
  html: string
  children?: ReactNode
  before?: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      {before}
      <RichContent html={html} className="max-w-180" />
      {children}
    </section>
  )
}

/** 转化带：个人年度工具已上线时指向工具，否则指向八字排盘（转化层，不计正文内链） */
function Band({
  locale,
  year,
  toolHref: tool,
  baziHref,
}: {
  locale: string
  year: YearlyYearFacts
  toolHref: string | null
  baziHref: string
}) {
  const ganzhi = ganzhiLabel(locale, year.stem, year.branch)
  return (
    <div
      data-link-zone="action"
      className="flex max-w-190 flex-col gap-1 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8"
    >
      <p className="m-0 text-body text-ink-muted">
        {tool ? m.yearly_band_text({ ganzhi }) : m.yearly_band_fallback_text({ ganzhi })}
      </p>
      <a href={tool ?? baziHref} className={cn('shrink-0 text-body', inlineLink)}>
        {tool ? m.yearly_band_tool({ year: year.year }) : m.yearly_band_fallback_link()}
      </a>
    </div>
  )
}

const FOCUS_TITLE = {
  work: m.yearly_focus_work,
  relationships: m.yearly_focus_relationships,
  self: m.yearly_focus_self,
} as const

function FocusSection({
  theme,
  paragraphs,
}: {
  theme: keyof typeof FOCUS_TITLE
  paragraphs: readonly string[]
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex max-w-180 flex-col gap-5">
      <h2 id={id} className={h2}>
        {FOCUS_TITLE[theme]()}
      </h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="m-0 text-body text-ink-muted">
          {paragraph}
        </p>
      ))}
    </section>
  )
}

function YearsSection({
  locale,
  natal,
  year,
  rows,
  note,
}: {
  locale: string
  natal: Branch
  year: number
  rows: readonly YearlyBirthRow[]
  note: string
}) {
  const noteId = useId()
  const id = useId()
  const name = zodiacName(natal)
  const first = rows[0]?.year ?? year
  const last = rows.at(-1)?.year ?? year
  // 撰写的纳音读法单列一段（按正文段验收），年份表另成数据段（组内相似度只报告）：
  // 12 页的年份、干支与纳音列高度重合，与导语放在同一段会掩盖逐页撰写的差异（第 1 组估算建议）
  return (
    <>
      <section aria-labelledby={noteId} className="flex max-w-180 flex-col gap-5">
        <h2 id={noteId} className={h2}>
          {m.yearly_nayin_title()}
        </h2>
        <p className={muted}>{note}</p>
      </section>
      <section data-table-section aria-labelledby={id} className="flex flex-col gap-5">
        <h2 id={id} className={h2}>
          {m.yearly_years_title()}
        </h2>
        <FactTable
          caption={m.yearly_years_caption({ name, from: first, to: last })}
          rows={rows}
          rowKey={(row) => String(row.year)}
          stack
          narrow
          containerProps={{ 'data-locale-fixed': true }}
          columns={[
            {
              key: 'year',
              header: m.yearly_col_birth_year(),
              kind: 'key',
              cell: (row) => row.year,
            },
            {
              key: 'pillar',
              header: m.yearly_col_pillar(),
              kind: 'glyph',
              cell: (row) => ganzhiLabel(locale, row.stem, row.branch),
            },
            {
              key: 'nayin',
              header: m.yearly_col_nayin(),
              stacked: 'label',
              cell: (row) => nayinName(row.nayinIndex),
            },
            {
              key: 'age',
              header: m.yearly_col_age({ year }),
              kind: 'nowrap',
              stacked: 'label',
              cell: (row) => row.age,
            },
          ]}
        />
        <p className="m-0 max-w-180 text-caption text-ink-subtle">
          {m.yearly_years_note({ year })}
        </p>
      </section>
    </>
  )
}

/** 关系表：地支关系与太岁、地支与天干的五行生克、三合局（引擎 zodiacYearFacts） */
function RelationTable({ page }: { page: YearlyChildData }) {
  const { facts, locale } = page
  const { year, branch: natal } = facts
  const natalGlyph = branchLabel(locale, natal)
  const yearGlyph = branchLabel(locale, year.branch)
  const rows: readonly { key: string; item: string; value: string }[] = [
    {
      key: 'branch',
      item: m.yearly_row_branch({ natal: natalGlyph, year: yearGlyph }),
      value: relationText(facts.row.relations),
    },
    { key: 'taisui', item: m.yearly_row_taisui(), value: taiSuiText(facts.row.taiSui) },
    {
      key: 'branch-element',
      item: m.yearly_row_branch_element({
        natal: m.yearly_glyph_element({ glyph: natalGlyph, element: elementName(facts.element) }),
        year: m.yearly_glyph_element({
          glyph: yearGlyph,
          element: elementName(year.branchElement),
        }),
      }),
      value: elementRelationText(facts.branchElementRelation, facts.element, year.branchElement),
    },
    {
      key: 'stem-element',
      item: m.yearly_row_stem_element({
        natal: m.yearly_glyph_element({ glyph: natalGlyph, element: elementName(facts.element) }),
        stem: m.yearly_glyph_element({
          glyph: stemLabel(locale, year.stem),
          element: elementName(year.stemElement),
        }),
      }),
      value: elementRelationText(facts.stemElementRelation, facts.element, year.stemElement),
    },
    {
      key: 'triad',
      item: m.yearly_row_triad(),
      value: `${m.yearly_triad_value({
        branches: triadBranches(locale, facts.triad),
        element: elementName(facts.triadElement),
      })} · ${
        facts.triadHasYear
          ? m.yearly_triad_in({ year: yearGlyph })
          : m.yearly_triad_out({ year: yearGlyph })
      }`,
    },
  ]
  return (
    <FactTable
      caption={m.yearly_rel_caption({
        name: zodiacName(natal),
        ganzhi: ganzhiLabel(locale, year.stem, year.branch),
      })}
      rows={rows}
      rowKey={(row) => row.key}
      stack
      narrow
      containerProps={{ 'data-locale-fixed': true }}
      columns={[
        { key: 'item', header: m.yearly_col_item(), kind: 'key', cell: (row) => row.item },
        {
          key: 'value',
          header: m.yearly_col_value(),
          stacked: 'label',
          cell: (row) => row.value,
        },
      ]}
    />
  )
}

export function YearlyChildPage({ page }: { page: YearlyChildData }) {
  const { facts, locale } = page
  const { year } = facts
  const natal = facts.branch
  const [relations, fullChart] = page.sections
  const othersId = useId()
  const name = zodiacName(natal)
  return (
    <Shell tool={`yearly-${page.year}-${page.key}`} locale={locale}>
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={name}
        heading={page.heading}
        lede={page.lede}
        year={page.year}
        archived={page.archived}
      />
      {page.archived && <ArchivedNotice locale={locale} year={year} next={page.next} />}
      <QuickFacts
        glyphText={glyph(natal)}
        items={[
          [m.yearly_fact_ganzhi(), ganzhiLabel(locale, year.stem, year.branch)],
          [m.yearly_fact_nayin(), nayinName(year.nayinIndex)],
          [
            m.yearly_fact_pair({
              natal: branchLabel(locale, natal),
              year: branchLabel(locale, year.branch),
            }),
            relationText(facts.row.relations),
          ],
          [m.yearly_fact_elements(), yearElements(locale, year)],
        ]}
      />
      <RangeSection locale={locale} year={year} />
      {relations && (
        <ProseSection
          title={relations.title}
          html={relations.html}
          before={
            <>
              <p className={muted}>{page.relationsNote}</p>
              <RelationTable page={page} />
            </>
          }
        />
      )}
      {page.focus.map((item) => (
        <FocusSection key={item.theme} theme={item.theme} paragraphs={item.paragraphs} />
      ))}
      <YearsSection
        locale={locale}
        natal={natal}
        year={page.year}
        rows={facts.births}
        note={page.yearsNote}
      />
      {fullChart && (
        <ProseSection title={fullChart.title} html={fullChart.html}>
          <Band locale={locale} year={year} toolHref={page.toolHref} baziHref={page.baziHref} />
        </ProseSection>
      )}
      <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />
      {/* 同组区块是导航：用 nav 地标，不属于正文（设计稿「其他生肖的 2027 年」12 格） */}
      <nav data-link-zone="siblings" aria-labelledby={othersId} className="flex flex-col gap-3">
        <h2 id={othersId} className={h2}>
          {m.yearly_others_title({ year: page.year })}
        </h2>
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-6">
          {page.siblings.map((item) => {
            const current = item.key === page.key
            return (
              <li key={item.key} className="flex min-w-0">
                <a
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-center rounded-field border border-line px-3 text-body text-ink transition-colors hover:bg-surface-2',
                    current && 'border-transparent bg-surface-2 font-medium',
                  )}
                >
                  {zodiacName(item.key as Branch)}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <Disclaimer />
    </Shell>
  )
}

function HubTable({ page }: { page: YearlyHubData }) {
  const { facts, locale } = page
  const { year } = facts
  const hrefOf = new Map(page.children.map((child) => [child.key as string, child.href]))
  return (
    <FactTable
      caption={m.yearly_hub_table_caption({ ganzhi: ganzhiLabel(locale, year.stem, year.branch) })}
      rows={facts.rows}
      rowKey={(row) => row.branch}
      isCurrent={(row) => row.taiSui.includes('zhi')}
      containerProps={{ 'data-locale-fixed': true }}
      columns={[
        {
          key: 'animal',
          header: m.yearly_hub_col_animal(),
          kind: 'key',
          cell: (row: YearlyRow) => (
            <a href={hrefOf.get(row.branch)} className={inlineLink}>
              {m.yearly_hub_link({ name: zodiacName(row.branch), year: year.year })}
            </a>
          ),
        },
        {
          key: 'branch',
          header: m.yearly_hub_col_branch(),
          kind: 'glyph',
          cell: (row) => (
            <span className="whitespace-nowrap">{branchLabel(locale, row.branch)}</span>
          ),
        },
        {
          key: 'relation',
          header: m.yearly_hub_col_relation({ year: branchLabel(locale, year.branch) }),
          cell: (row) => relationText(row.relations),
        },
        {
          key: 'taisui',
          header: m.yearly_hub_col_taisui(),
          kind: 'nowrap',
          cell: (row) => taiSuiText(row.taiSui),
        },
      ]}
    />
  )
}

/** 枢纽正文中插入总表的段序号（第 2 段：十二生肖与流年的关系） */
const HUB_TABLE_SECTION = 1

export function YearlyHubPage({ page }: { page: YearlyHubData }) {
  const { facts, locale } = page
  const { year } = facts
  return (
    <Shell tool={`yearly-${page.year}`} locale={locale}>
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={page.hubTitle}
        heading={page.heading}
        lede={page.lede}
        year={page.year}
        archived={page.archived}
      />
      {page.archived && <ArchivedNotice locale={locale} year={year} next={null} />}
      <QuickFacts
        glyphText={glyph(year.branch)}
        items={[
          [m.yearly_fact_ganzhi(), ganzhiLabel(locale, year.stem, year.branch)],
          [m.yearly_fact_nayin(), nayinName(year.nayinIndex)],
          [m.yearly_fact_lichun(), `${dateText(year.lichun)} ${timeText(year.lichun)}`],
          [m.yearly_fact_new_year(), dateText(year.newYear)],
        ]}
      />
      {page.sections.map((section, index) => (
        <ProseSection key={section.title} title={section.title} html={section.html}>
          {index === HUB_TABLE_SECTION && <HubTable page={page} />}
        </ProseSection>
      ))}
      <Band locale={locale} year={year} toolHref={page.toolHref} baziHref={page.baziHref} />
      <ToolFaq items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))} />
      <Disclaimer />
    </Shell>
  )
}
