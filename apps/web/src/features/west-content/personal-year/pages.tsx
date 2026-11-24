import { cn, LinkCard, SeriesNav } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { BUILD_DATE } from '../../tools/build-date.ts'
import { ToolContext, useTool } from '../../tools/context.tsx'
import { Disclaimer } from '../../tools/disclaimer.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import {
  FieldError,
  fieldLabel,
  SelectField,
  SubmitButton,
  TextField,
  ToolForm,
} from '../../tools/form.tsx'
import { useSharedInput } from '../../tools/numerology/use-shared-input.ts'
import { encodeShareInput, SHARE_PARAM } from '../../tools/share.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import {
  chainText,
  exampleFor,
  nineYearCycle,
  PERSONAL_YEAR_MAX,
  PERSONAL_YEAR_MIN,
  type PersonalYearResult,
  personalYearOf,
  stepView,
} from './calc.ts'
import { PERSONAL_YEAR_COPY, type PersonalYearCopy } from './copy.ts'
import type { PersonalYearPayload } from './page.functions.ts'
import {
  PERSONAL_YEAR_NUMBERS,
  PERSONAL_YEAR_PATHS,
  type PersonalYearLocale,
  type PersonalYearNumber,
  personalYearNumberPath,
} from './paths.ts'

/**
 * personal year 计算器与 1–9 年份数页（设计稿 docs/design/prototypes/content-growth-v2-batch2/PersonalYear*.dc.html、
 * YearNumber*.dc.html，使用者 2026-11-24 确认；默认 B10：从 1 月 1 日起算、化为 1–9）。只用 @xuanxue/ui 组件与设计 token。
 *
 * 计算在浏览器本地完成（calc.ts 复用 @xuanxue/numerology 的 personalYear），出生月日不发往服务器；
 * 年份数页的小表单把输入放在 `#r=` 片段里打开计算器。预渲染时目标年份取构建年，水合后换成访客本地的当年。
 * 组内相似度按 H2 段测量：1–9 网格与相关链接放在 nav 中，事实面板不含 H2。
 */

const h2 = 'm-0 text-balance font-heading text-ink text-title'
const h3 = 'm-0 font-heading text-ink text-subtitle'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const caption = 'm-0 text-caption text-ink-subtle'
const inlineLink =
  'inline-flex min-h-11 items-center text-body text-brand-ink underline underline-offset-4 hover:decoration-2'

const BUILD_YEAR = Number(BUILD_DATE.slice(0, 4))
const YEAR_OPTIONS = Array.from({ length: PERSONAL_YEAR_MAX - PERSONAL_YEAR_MIN + 1 }, (_, i) =>
  String(PERSONAL_YEAR_MIN + i),
)
const LIFE_PATH_PATHS: Readonly<Record<PersonalYearLocale, string>> = {
  en: '/life-path-number',
  es: '/numero-de-vida',
}

const wrapNumber = (value: number) => (((value - 1 + 9) % 9) + 1) as PersonalYearNumber

function Shell({ children }: { children: ReactNode }) {
  const track = useToolEvents('personal-year')
  const context = useMemo(() => ({ tool: 'personal-year', track }), [track])
  return (
    <MarketingShell>
      <ToolContext value={context}>
        <PageWidth className="flex flex-col gap-10 pb-16 sm:gap-12 sm:pb-28">{children}</PageWidth>
      </ToolContext>
    </MarketingShell>
  )
}

function Header({
  payload,
  current,
  children,
}: {
  payload: PersonalYearPayload
  current: string
  children?: ReactNode
}) {
  return (
    <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
      <Breadcrumb
        items={[
          ...payload.breadcrumb.map((item) => ({
            name: item.label,
            href: toolHref(item.href, payload.locale),
          })),
          { name: current },
        ]}
      />
      <h1 className="m-0 text-balance font-heading text-ink text-title">{payload.heading}</h1>
      <p className="m-0 text-body text-ink-muted">{payload.lede}</p>
      {children}
    </header>
  )
}

function ProseSection({ title, html, after }: { title: string; html: string; after?: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex max-w-180 flex-col gap-5">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <RichContent html={html} />
      {after}
    </section>
  )
}

/** 数字环（与 Life Path 结果卡同一画法：两道插画线同心环，数字用 display） */
function NumberRing({ value, label }: { value: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="relative flex size-33 shrink-0 items-center justify-center rounded-full border border-illus"
    >
      <span aria-hidden="true" className="absolute inset-3 rounded-full border border-illus/55" />
      <span aria-hidden="true" className="font-bold font-heading text-display text-ink">
        {value}
      </span>
    </span>
  )
}

/**
 * 1–9 数字网格（设计稿 A5：数字下加副标签，当前项用站点强调色描边）：桌面 9 列，手机 3 列。
 * 链接属于模板导航（同组区块），不计入正文链接。
 */
export function NumberGrid({
  locale,
  title,
  sub,
  current,
  headingLevel = 'h2',
}: {
  locale: PersonalYearLocale
  title: string
  sub: (value: PersonalYearNumber) => string
  current?: PersonalYearNumber | undefined
  headingLevel?: 'h2' | 'h3'
}) {
  const id = useId()
  const { track } = useTool()
  const Heading = headingLevel
  const copy = PERSONAL_YEAR_COPY[locale]
  return (
    <nav data-link-zone="siblings" aria-labelledby={id} className="flex max-w-190 flex-col gap-4">
      <Heading id={id} className={headingLevel === 'h2' ? h2 : h3}>
        {title}
      </Heading>
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-9">
        {PERSONAL_YEAR_NUMBERS.map((value) => (
          <li key={value} className="flex min-w-0">
            <a
              href={toolHref(personalYearNumberPath(locale, value), locale)}
              aria-label={`${copy.numberName(value)} · ${sub(value)}`}
              aria-current={value === current ? 'true' : undefined}
              onClick={() => track('tool_link_click', { target: `personal-year-${value}` })}
              className="flex min-h-18 w-full flex-col items-center justify-center rounded-field bg-surface px-1 py-2 text-center no-underline transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-[current=true]:ring-1 aria-[current=true]:ring-mark aria-[current=true]:ring-inset"
            >
              <span className="font-bold font-heading text-heading text-ink">{value}</span>
              <span className="text-caption text-ink-muted">{sub(value)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Related({ locale, items }: { locale: PersonalYearLocale; items: readonly PageLink[] }) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <nav data-link-zone="related" aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 font-heading text-heading text-ink">
        {PERSONAL_YEAR_COPY[locale].relatedTitle}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.href} className="flex min-w-0">
            <LinkCard href={toolHref(item.href, locale)} title={item.label} className="w-full" />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Footer({ payload }: { payload: PersonalYearPayload }) {
  const copy = PERSONAL_YEAR_COPY[payload.locale]
  return (
    <>
      <ToolFaq
        title={copy.faqTitle}
        items={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
      />
      <Related locale={payload.locale} items={payload.related} />
      <Disclaimer />
    </>
  )
}

// ---------------------------------------------------------------------------
// 表单
// ---------------------------------------------------------------------------

interface FormValues {
  readonly month: string
  readonly day: string
  readonly year: string
}

/** 读取表单：月、日、年都有效时返回结果，否则返回 null */
function readForm(data: FormData): PersonalYearResult | null {
  const value = (key: string) => {
    const raw = data.get(key)
    return typeof raw === 'string' && /^\d{1,4}$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN
  }
  return personalYearOf({ month: value('month'), day: value('day'), year: value('year') })
}

/** 出生月日（月份下拉 + 日）与目标年份（下拉，1900–2100）；无出生年 */
function BirthdayYearFields({
  copy,
  values,
  invalid,
}: {
  copy: PersonalYearCopy
  values: FormValues
  invalid: boolean
}) {
  const errorId = useId()
  const legendId = useId()
  return (
    <>
      <fieldset
        aria-labelledby={legendId}
        aria-describedby={invalid ? errorId : undefined}
        className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
      >
        <legend id={legendId} className={cn('mb-1.5 p-0', fieldLabel)}>
          {copy.monthDayLegend}
        </legend>
        <div className="grid grid-cols-5 gap-2">
          <SelectField
            key={`month-${values.month}`}
            className="col-span-3"
            label={copy.monthLabel}
            name="month"
            defaultValue={values.month}
            options={copy.months.map((label, i) => ({ value: String(i + 1), label }))}
          />
          <TextField
            key={`day-${values.day}`}
            className="col-span-2"
            label={copy.dayLabel}
            name="day"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            placeholder={copy.dayPlaceholder}
            defaultValue={values.day}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
          />
        </div>
        {invalid ? (
          <FieldError id={errorId} error={copy.monthDayError} alert />
        ) : (
          <p className={caption}>{copy.monthDayHint}</p>
        )}
      </fieldset>
      <div className="flex min-w-0 flex-col gap-1.5">
        <SelectField
          key={`year-${values.year}`}
          label={copy.yearLabel}
          name="year"
          defaultValue={values.year}
          options={YEAR_OPTIONS.map((year) => ({ value: year, label: year }))}
        />
        <p className={caption}>{copy.yearHint}</p>
      </div>
    </>
  )
}

/** 访客本地的当年：预渲染与水合首帧为构建年 */
function useLocalYear(): number {
  const [year, setYear] = useState(BUILD_YEAR)
  useEffect(() => setYear(new Date().getFullYear()), [])
  return year
}

// ---------------------------------------------------------------------------
// 计算器页
// ---------------------------------------------------------------------------

function Steps({ result, copy }: { result: PersonalYearResult; copy: PersonalYearCopy }) {
  const view = stepView(result)
  const label = { month: copy.stepMonth, day: copy.stepDay, year: copy.stepYear }
  const name = {
    month: copy.months[result.month - 1] ?? String(result.month),
    day: String(result.day),
    year: String(result.year),
  }
  const kept = (value: number) => (value > 9 ? ` ${copy.kept}` : '')
  const rows: [string, string][] = [
    ...view.parts.map((part): [string, string] => [
      label[part.phase],
      `${name[part.phase]} → ${part.chain.length > 0 ? chainText(part.chain) : part.value}${kept(part.value)}`,
    ]),
    [
      copy.stepSum,
      `${view.total.operands.join(' + ')} = ${view.total.result}${view.reduce.length === 0 ? kept(view.total.result) : ''}`,
    ],
  ]
  if (view.reduce.length > 0)
    rows.push([copy.stepReduce, `${chainText(view.reduce)}${kept(result.engine.value)}`])
  if (view.root) rows.push([copy.stepRoot, chainText([view.root])])
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {rows.map(([term, text]) => (
        <li
          key={term}
          className="flex gap-3 border-line border-b py-2.5 text-body text-ink tabular-nums last:border-b-0"
        >
          <span className="w-24 shrink-0 text-ink-subtle sm:w-35">{term}</span>
          <span className="min-w-0 wrap-anywhere">{text}</span>
        </li>
      ))}
    </ol>
  )
}

function Result({ result, locale }: { result: PersonalYearResult; locale: PersonalYearLocale }) {
  const copy = PERSONAL_YEAR_COPY[locale]
  const headingId = useId()
  const { track } = useTool()
  const cycle = nineYearCycle(result)
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-6">
      <h2 id={headingId} className={h2}>
        {copy.resultTitle(result.year)}
      </h2>
      <div className="flex max-w-190 flex-col gap-5 rounded-object bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7">
          <NumberRing value={result.value} label={copy.numberName(result.value)} />
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className={h3}>{copy.numberName(result.value)}</h3>
            <p className="m-0 text-body text-ink-muted">{copy.summary[result.value]}</p>
            <a
              href={toolHref(personalYearNumberPath(locale, result.value), locale)}
              onClick={() => track('tool_link_click', { target: `personal-year-${result.value}` })}
              className={inlineLink}
            >
              {copy.readAbout(result.value)}
            </a>
          </div>
        </div>
        <h3 className={cn(h3, 'mt-2')}>{copy.stepsTitle}</h3>
        <Steps result={result} copy={copy} />
        {result.engine.value > 9 && (
          <p className={muted}>{copy.masterNote(result.engine.value, result.value)}</p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <NumberGrid
          locale={locale}
          title={copy.cycleTitle}
          headingLevel="h3"
          current={result.value}
          sub={(value) => String(cycle[value - 1]?.year ?? '')}
        />
        <p className="m-0 max-w-180 rounded-object bg-surface px-6 py-5 text-body text-ink-muted">
          {copy.cycleNote}
        </p>
      </div>
      <div
        data-link-zone="action"
        className="flex max-w-190 flex-col gap-6 rounded-object bg-surface-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-12 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <h3 className={h3}>{copy.otherTitle}</h3>
          <p className="m-0 text-body text-ink-muted">{copy.otherText}</p>
        </div>
        <a
          href={toolHref(LIFE_PATH_PATHS[locale], locale)}
          onClick={() => track('tool_link_click', { target: 'life-path' })}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-line-strong px-6 font-medium text-body text-ink no-underline transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {copy.otherLink}
        </a>
      </div>
    </section>
  )
}

export function CalculatorPage({ payload }: { payload: PersonalYearPayload }) {
  return (
    <Shell>
      <CalculatorBody payload={payload} />
    </Shell>
  )
}

function CalculatorBody({ payload }: { payload: PersonalYearPayload }) {
  const { locale } = payload
  const copy = PERSONAL_YEAR_COPY[locale]
  const { track } = useTool()
  const localYear = useLocalYear()
  const [values, setValues] = useState<FormValues>({ month: '', day: '', year: String(BUILD_YEAR) })
  const [result, setResult] = useState<PersonalYearResult | null>(null)
  const [invalid, setInvalid] = useState(false)

  // 水合后目标年份默认换成访客本地的当年（访客尚未改动时）
  useEffect(() => {
    setValues((current) =>
      current.year === String(BUILD_YEAR) ? { ...current, year: String(localYear) } : current,
    )
  }, [localYear])

  const show = (next: PersonalYearResult | null, form: FormValues) => {
    setValues(form)
    setInvalid(!next)
    setResult(next)
    if (next) track('result_view')
  }

  // 年份数页的小表单：`#r=` 中带月、日、年，挂载时读取一次
  useSharedInput((shared) => {
    const form = {
      month: String(shared.month ?? ''),
      day: String(shared.day ?? ''),
      year: String(shared.year ?? new Date().getFullYear()),
    }
    const data = new FormData()
    for (const [key, value] of Object.entries(form)) data.set(key, value)
    show(readForm(data), form)
  })

  return (
    <>
      <Header payload={payload} current={payload.heading} />
      <ToolForm
        label={copy.formLabel}
        onSubmit={(data) =>
          show(readForm(data), {
            month: String(data.get('month') ?? ''),
            day: String(data.get('day') ?? ''),
            year: String(data.get('year') ?? ''),
          })
        }
      >
        <BirthdayYearFields copy={copy} values={values} invalid={invalid} />
        <div className="col-span-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className={caption}>{copy.privacyHint}</p>
          <SubmitButton className="sm:col-span-1">{copy.calculate}</SubmitButton>
        </div>
      </ToolForm>
      <div aria-live="polite" className="min-w-0 scroll-mt-6">
        {result && <Result result={result} locale={locale} />}
      </div>
      {payload.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <NumberGrid
        locale={locale}
        title={copy.allNumbersTitle}
        sub={(value) => copy.keyword[value]}
      />
      <Footer payload={payload} />
    </>
  )
}

// ---------------------------------------------------------------------------
// 年份数页
// ---------------------------------------------------------------------------

function MiniForm({ locale }: { locale: PersonalYearLocale }) {
  const copy = PERSONAL_YEAR_COPY[locale]
  const localYear = useLocalYear()
  const [values, setValues] = useState<FormValues>({ month: '', day: '', year: String(BUILD_YEAR) })
  const [invalid, setInvalid] = useState(false)
  useEffect(() => {
    setValues((current) =>
      current.year === String(BUILD_YEAR) ? { ...current, year: String(localYear) } : current,
    )
  }, [localYear])
  const open = (data: FormData) => {
    const form = {
      month: String(data.get('month') ?? ''),
      day: String(data.get('day') ?? ''),
      year: String(data.get('year') ?? ''),
    }
    const result = readForm(data)
    setValues(form)
    setInvalid(!result)
    if (!result) return
    const input = { month: result.month, day: result.day, year: result.year }
    window.location.assign(
      `${toolHref(PERSONAL_YEAR_PATHS[locale], locale)}#${SHARE_PARAM}=${encodeShareInput(input)}`,
    )
  }
  return (
    <ToolForm label={copy.formLabel} onSubmit={open}>
      <BirthdayYearFields copy={copy} values={values} invalid={invalid} />
      <div className="col-span-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={caption}>{copy.miniFormLead}</p>
        <SubmitButton className="sm:col-span-1">{copy.calculate}</SubmitButton>
      </div>
    </ToolForm>
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

export function FactPanel({
  locale,
  value,
}: {
  locale: PersonalYearLocale
  value: PersonalYearNumber
}) {
  const copy = PERSONAL_YEAR_COPY[locale]
  const previous = wrapNumber(value - 1)
  const next = wrapNumber(value + 1)
  // 示例用构建年：预渲染与客户端一致；算式由引擎当场计算
  const example = exampleFor(value, BUILD_YEAR)
  const view = stepView(example)
  const sum = `${view.total.operands.join(' + ')} = ${view.total.result}`
  const reduce = view.reduce.length > 0 ? ` → ${chainText(view.reduce)}` : ''
  return (
    <section
      aria-label={copy.numberName(value)}
      className="flex max-w-190 flex-col gap-5 rounded-object bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <NumberRing value={value} label={copy.numberName(value)} />
        <dl className="m-0 grid w-full min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Fact label={copy.factTheme}>{copy.theme[value]}</Fact>
          <Fact label={copy.factPlace}>{copy.place(value)}</Fact>
          <Fact label={copy.factFollows}>{`${previous} · ${copy.keyword[previous]}`}</Fact>
          <Fact label={copy.factLeads}>{`${next} · ${copy.keyword[next]}`}</Fact>
        </dl>
      </div>
      <p className={cn(caption, 'tabular-nums')}>
        {copy.example(copy.monthDay(example.month, example.day), example.year)}{' '}
        {`${view.parts
          .map((part) => (part.chain.length > 0 ? chainText(part.chain) : String(part.value)))
          .join('; ')}; ${sum}${reduce}`}
      </p>
    </section>
  )
}

function Questions({ title, items }: { title: string; items: readonly string[] }) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex max-w-180 flex-col gap-4">
      <h2 id={id} className={h2}>
        {title}
      </h2>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-body text-ink-muted marker:text-ink-subtle">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function NumberPage({ payload }: { payload: PersonalYearPayload }) {
  const { locale } = payload
  const value = payload.number ?? 1
  const copy = PERSONAL_YEAR_COPY[locale]
  const previous = wrapNumber(value - 1)
  const next = wrapNumber(value + 1)
  const link = (target: PersonalYearNumber) => ({
    href: toolHref(personalYearNumberPath(locale, target), locale),
    title: copy.numberName(target),
  })
  return (
    <Shell>
      <Header payload={payload} current={copy.numberName(value)} />
      <MiniForm locale={locale} />
      <FactPanel locale={locale} value={value} />
      {payload.sections.map((section) => (
        <ProseSection key={section.title} title={section.title} html={section.html} />
      ))}
      <Questions title={copy.questionsTitle} items={payload.questions} />
      <SeriesNav
        label={copy.seriesLabel}
        previous={{ ...link(previous), label: copy.previous }}
        next={{ ...link(next), label: copy.next }}
      />
      <NumberGrid
        locale={locale}
        title={copy.allNumbersTitle}
        current={value}
        sub={(item) => copy.keyword[item]}
      />
      <Footer payload={payload} />
    </Shell>
  )
}
