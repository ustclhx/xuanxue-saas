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
import type { ZodiacAnnual, ZodiacRelation, ZodiacYearRow } from './data.ts'
import {
  animal,
  annualChips,
  branchLabel,
  branchName,
  branchPosition,
  direction,
  ELEMENT_DOT,
  elementHanzi,
  elementLabel,
  ganzhi,
  ganzhiHangul,
  ganzhiLabel,
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
import {
  isZodiacLocale,
  ZODIAC_HUB_TITLES,
  type ZodiacKey,
  type ZodiacLocale,
  zodiacPath,
} from './paths.ts'

/**
 * 生肖枢纽与子页（设计稿 docs/design/prototypes/content-growth-phase2/Main.dc.html、ZodiacPage.dc.html、
 * ZodiacStates.dc.html，使用者 2026-11-22 确认）。只用 @xuanxue/ui 组件与设计 token。
 * 年份表、关系表、流年关系与查询边界都来自服务端引擎计算；本页只渲染。
 */

/** 枢纽正文中插入组件的段（按小标题定位；缺少时组件排在正文之后） */
const HUB_SLOTS: Readonly<Record<string, { table: string; relations: string }>> = {
  'zh-Hans': { table: '十二生肖总表', relations: '三合、六合与六冲' },
  ko: { table: '열두 띠 표', relations: '삼합·육합·육충' },
}

/**
 * 按语言的版式差异：ko 依设计稿 ZodiacPageKoMobile（使用者 2026-11-22 确认）——速览第四格为方位，
 * 年份表新年份在前并加「만 나이」列，表下注明韩国标准时与历史时区。
 * 设计稿流年段的通用导语未采用：12 页相同的句子会抬高该段组内相似度，免责说明见页尾。
 */
interface ZodiacLayout {
  readonly quickFourth: 'hour' | 'direction'
  readonly newestFirst: boolean
  readonly ageColumn: boolean
  readonly timeNote: boolean
}
const LAYOUTS: Readonly<Record<ZodiacLocale, ZodiacLayout>> = {
  'zh-Hans': {
    quickFourth: 'hour',
    newestFirst: false,
    ageColumn: false,
    timeNote: false,
  },
  ko: {
    quickFourth: 'direction',
    newestFirst: true,
    ageColumn: true,
    timeNote: true,
  },
}
const zodiacLocale = (locale: string): ZodiacLocale => (isZodiacLocale(locale) ? locale : 'zh-Hans')
const layoutOf = (locale: string) => LAYOUTS[zodiacLocale(locale)]

/** 文案中的链接占位：消息按此切开，在中间插入链接（中文文案不含 {link} 时原样输出） */
const LINK_SLOT = '\u0000'
function withLink(text: string, link: ReactNode): ReactNode {
  const [before, ...rest] = text.split(LINK_SLOT)
  return rest.length === 0 ? (
    text
  ) : (
    <>
      {before}
      {link}
      {rest.join('')}
    </>
  )
}

/** 만 나이（按公历年计）：未出生的年份为「—」，当年为 0 岁，其余为生日前后两个数 */
function ageText(row: ZodiacYearRow, calendarYear: number): string {
  if (row.year > calendarYear) return m.zodiac_age_future()
  if (row.year === calendarYear) return m.zodiac_age_zero()
  const high = calendarYear - row.year
  return m.zodiac_age_range({ low: high - 1, high })
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

function ElementMark({ element, locale }: { element: Element; locale: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', ELEMENT_DOT[element])}
      />
      {elementLabel(locale, element)}
    </span>
  )
}

function Shell({ tool, locale, children }: { tool: string; locale: string; children: ReactNode }) {
  const track = useToolEvents(tool)
  const context = useMemo(() => ({ tool, track }), [tool, track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        {/* 韩文按词断行（与塔罗 ko 标题相同的 break-keep），避免在音节之间换行 */}
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

/**
 * 关系表「传统规则」列。中文文案用 other / animal / branches / others / glyph；
 * ko 文案只写对方地支与띠、方位或局名（otherLabel、members、natalDir 等），不用整句：
 * 12 页共用的模板字越少，组内相似度越能反映逐页撰写的正文（design Risks「减少表格中重复的标签文字」）。
 */
const relationRule = (relation: ZodiacRelation, natal: Branch, locale: string): string => {
  const [other] = relation.branches
  const separator = m.zodiac_rule_list_separator()
  const member = (branch: Branch) => `${branchLabel(locale, branch)} · ${animal(branch)}`
  const one = (branch: Branch | undefined) =>
    branch
      ? {
          other: glyph(branch),
          otherLabel: branchLabel(locale, branch),
          animal: animal(branch),
          natalDir: direction(natal),
          otherDir: direction(branch),
        }
      : { other: '', otherLabel: '', animal: '', natalDir: '', otherDir: '' }
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
        branches: relation.branches.map(glyph).join(separator),
        element: triad ? ELEMENT_LABEL[triad.element]() : '',
        elementHanzi: triad ? elementHanzi(triad.element) : '',
      })
    }
    case 'punish':
      return other === natal
        ? m.zodiac_rule_punish_self({ glyph: glyph(natal) })
        : m.zodiac_rule_punish({
            others: relation.branches
              .map((branch) => `${glyph(branch)}（${animal(branch)}）`)
              .join(separator),
            members: relation.branches.map(member).join(', '),
          })
  }
}

const relationBranches = (relation: ZodiacRelation, natal: Branch, locale: string) => {
  const branches =
    relation.type === 'triad'
      ? relation.branches
      : [
          natal,
          ...relation.branches.filter((branch) => branch !== natal || relation.type === 'punish'),
        ]
  // ko 用「자·축」，中文用「子 丑」
  return locale === 'ko'
    ? branches.map((branch) => branchName(locale, branch)).join('·')
    : branches.map(glyph).join(' ')
}

/** 本年 / 次年卡片：引擎算出的太岁与地支关系；缺少撰写文字时只列关系名，不用模板句（zodiac-pages 规格「本年与次年的流年主题」） */
export function AnnualCard({
  annual,
  natal,
  text,
  locale = 'zh-Hans',
}: {
  annual: ZodiacAnnual
  natal: Branch
  text: string | undefined
  locale?: string
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
        {m.zodiac_annual_heading({
          year: annual.year,
          ganzhi: label,
          ganzhiK: ganzhiHangul(annual.stem, annual.branch),
        })}
      </h3>
      <ul
        aria-label={m.zodiac_annual_relations({
          ganzhi: ganzhiLabel(locale, annual.stem, annual.branch),
          glyph: branchLabel(locale, natal),
        })}
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
  const layout = layoutOf(locale)
  const years = layout.newestFirst ? [...facts.years].reverse() : facts.years
  const baziLink = (
    <a href={mainToolHref(locale, 'east')} className={inlineLink}>
      {m.bazi_link_home()}
    </a>
  )
  return (
    <Shell tool={`zodiac-${page.key}`} locale={locale}>
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
            [
              m.zodiac_fact_element(),
              <ElementMark key="element" element={facts.element} locale={locale} />,
            ],
            [
              m.zodiac_fact_polarity(),
              facts.polarity === 'yang' ? m.zodiac_polarity_yang() : m.zodiac_polarity_yin(),
            ],
            layout.quickFourth === 'direction'
              ? [m.zodiac_fact_direction(), direction(natal)]
              : [
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
          {m.zodiac_years_title({ name })}
        </h2>
        <p className={muted}>{page.yearsNote}</p>
        <FactTable
          caption={m.zodiac_years_caption({ name })}
          rows={years}
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
                  {m.zodiac_year_value({ year: row.year })}
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
              cell: (row) => ganzhiLabel(locale, row.stem, row.branch),
            },
            ...(layout.ageColumn
              ? [
                  {
                    key: 'age',
                    header: m.zodiac_col_age(),
                    kind: 'nowrap' as const,
                    stacked: 'label' as const,
                    cell: (row: ZodiacYearRow) => ageText(row, facts.calendarYear),
                  },
                ]
              : []),
            {
              key: 'nayin',
              header: m.zodiac_col_nayin(),
              stacked: layout.ageColumn ? 'label' : 'full',
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
        {layout.ageColumn && (
          <p className={muted}>
            {m.zodiac_age_note({ year: facts.calendarYear })}
            {layout.timeNote && ` ${m.zodiac_time_note()}`}
          </p>
        )}
        <p className={muted}>{m.zodiac_years_rule({ glyph: branchLabel(locale, natal), name })}</p>
        {example && (
          <p className={noteBox}>
            {withLink(
              (example.order === 'after'
                ? m.zodiac_years_example_after
                : example.order === 'same'
                  ? m.zodiac_years_example_same
                  : m.zodiac_years_example_before)({
                year: example.year,
                lichun: monthDayTime(example.lichun),
                newYear: monthDay(example.newYear),
                name,
                previous: zodiacName(example.previous),
                link: LINK_SLOT,
              }),
              baziLink,
            )}
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
            caption={m.zodiac_relations_caption({ glyph: branchLabel(locale, natal) })}
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
                cell: (row) => relationBranches(row, natal, locale),
              },
              {
                key: 'rule',
                header: m.zodiac_col_rule(),
                stacked: 'full',
                cell: (row) => relationRule(row, natal, locale),
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
              locale={locale}
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
                      glyph: branchLabel(locale, branch),
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

function lookupValue(result: LookupYear, locale: string) {
  return m.zodiac_lookup_value({
    name: zodiacName(result.branch),
    ganzhi: ganzhiLabel(locale, result.stem, result.branch),
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
    href: toolHref(zodiacPath(zodiacLocale(locale), branch as ZodiacKey), locale),
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
              : lookupValue(byLichun, locale)
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
          value={lookupValue(newYear.result, locale)}
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
            setResult(
              lookupZodiac(
                String(data.get('birthDate') ?? ''),
                page.facts.boundaries,
                page.facts.offsetMinutes,
              ),
            )
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
              <a
                href={toolHref(zodiacPath(zodiacLocale(locale), row.key), locale)}
                className={inlineLink}
              >
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
          // ko「자(子)」不在括号前断行
          cell: (row) => (
            <span className="whitespace-nowrap">{branchLabel(locale, row.branch)}</span>
          ),
        },
        {
          key: 'element',
          header: m.zodiac_hub_col_element(),
          kind: 'nowrap',
          cell: (row) => <ElementMark element={row.element} locale={locale} />,
        },
        {
          key: 'triad',
          header: m.zodiac_hub_col_triad(),
          desktopOnly: true,
          cell: (row) => {
            const triad = TRIADS[row.triad]
            return triad
              ? m.zodiac_triad_value({
                  branches: triad.branches.map((branch) => branchName(locale, branch)).join(''),
                  element: ELEMENT_LABEL[triad.element](),
                })
              : ''
          },
        },
        {
          key: 'recent',
          header: m.zodiac_hub_col_recent(),
          kind: 'nowrap',
          cell: (row) =>
            row.recent
              .map((year) => m.zodiac_year_value({ year }))
              .join(m.zodiac_year_list_separator()),
        },
      ]}
    />
  )
}

function HubRelations({ locale }: { locale: string }) {
  const korean = locale === 'ko'
  const pairs = (list: readonly (readonly [Branch, Branch])[]) => (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {list.map(([a, b]) => (
        <li key={a} className={chip}>
          {korean
            ? `${branchName(locale, a)}${branchName(locale, b)}(${glyph(a)}${glyph(b)})`
            : `${glyph(a)} ${glyph(b)}`}
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
                {korean
                  ? `${triad.branches.map((branch) => branchName(locale, branch)).join('·')} (${triad.branches.map(animal).join('·')})`
                  : `${triad.branches.map(glyph).join(' ')}（${triad.branches.map(animal).join(' ')}）`}
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
        {isRelations && <HubRelations locale={locale} />}
      </div>
    )
  })
  const bazi = mainToolHref(locale, 'east')
  return (
    <Shell tool="zodiac" locale={locale}>
      <PageHeader
        locale={locale}
        breadcrumb={page.breadcrumb}
        current={ZODIAC_HUB_TITLES[zodiacLocale(locale)]}
        heading={page.heading}
        lede={page.lede}
      />
      <ZodiacLookup page={page} />
      {body}
      {!inserted.table && <HubTable page={page} />}
      {!inserted.relations && <HubRelations locale={locale} />}
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
