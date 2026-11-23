import type { TojeongResult } from '@xuanxue/bazi/tojeong'
import { cn, LinkCard } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { ToolContext } from '../../tools/context.tsx'
import { DatePart } from '../../tools/date-field.tsx'
import { ToolFaq } from '../../tools/faq.tsx'
import {
  CheckboxField,
  ChoiceGroup,
  FieldError,
  fieldLabel,
  SelectField,
  SubmitButton,
  ToolForm,
} from '../../tools/form.tsx'
import { toolHref } from '../../tools/tool-href.ts'
import { useToolEvents } from '../../tools/use-tool-events.ts'
import { AlmanacProse, bodyLink, secondaryButton } from '../almanac/parts.tsx'
import { TOJEONG_COPY as copy } from './copy.ts'
import { type GwaeEntry, loadGwae } from './gwae.ts'
import type { TojeongPageData } from './page.functions.ts'
import {
  isGwaeNumber,
  TOJEONG_DEFAULT_YEAR,
  TOJEONG_LOCALE,
  TOJEONG_PATH,
  TOJEONG_YEARS,
} from './paths.ts'

const href = (path: string) => toolHref(path, TOJEONG_LOCALE)

type Calendar = 'solar' | 'lunar'
type FormError = 'date' | 'leap' | 'target'

/** 结果：自己计算（带出生资料换算与中间数）或经分享链接打开（只有괘 번호与年份） */
type Outcome =
  | { kind: 'computed'; calendar: Calendar; result: TojeongResult }
  | { kind: 'shared'; gwae: number; year: number }

const toInt = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim()
  return /^\d{1,4}$/.test(text) ? Number(text) : Number.NaN
}

/** 读取分享参数：괘 번호合法、年份在可选范围内才显示，否则当作没有参数 */
export function sharedOutcome(search: string): Extract<Outcome, { kind: 'shared' }> | null {
  const params = new URLSearchParams(search)
  const gwae = Number(params.get('gwae'))
  const year = Number(params.get('year') ?? TOJEONG_DEFAULT_YEAR)
  if (!isGwaeNumber(gwae) || !(TOJEONG_YEARS as readonly number[]).includes(year)) return null
  return { kind: 'shared', gwae, year }
}

/** 表单值 → 引擎计算；引擎在提交时按需加载（个人工具，首屏不加载 tyme4ts） */
export async function computeTojeong(
  data: FormData,
): Promise<{ ok: true; outcome: Outcome } | { ok: false; error: FormError }> {
  const calendar: Calendar = data.get('calendar') === 'lunar' ? 'lunar' : 'solar'
  const birth = {
    year: toInt(data.get('year')),
    month: toInt(data.get('month')),
    day: toInt(data.get('day')),
  }
  const target = Number(data.get('target') ?? TOJEONG_DEFAULT_YEAR)
  if (!Object.values(birth).every(Number.isInteger)) return { ok: false, error: 'date' }
  const { tojeongGwae } = await import('@xuanxue/bazi/tojeong')
  try {
    const result = tojeongGwae(
      { birth, calendar, leapMonth: calendar === 'lunar' && data.get('leap') === 'on' },
      target,
    )
    return { ok: true, outcome: { kind: 'computed', calendar, result } }
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, error: 'target' }
    const issues = (error as { issues?: readonly { field: string }[] }).issues
    if (issues?.some((issue) => issue.field === 'leapMonth')) return { ok: false, error: 'leap' }
    return { ok: false, error: 'date' }
  }
}

const ERROR_TEXT: Readonly<Record<FormError, string>> = {
  date: copy.invalidDate,
  leap: copy.invalidLeap,
  target: copy.invalidTarget,
}

/**
 * ko 토정비결工具页（设计稿 content-growth-v2-tools/Tojeong、TojeongError）：
 * 表单在浏览器本地计算，结果只在客户端显示；解读按상괘分块按需加载。
 * 分享链接只带괘 번호与年份（`?gwae=463&year=2027`），该地址 noindex、canonical 指向工具页。
 */
export function TojeongToolPage({ page }: { page: TojeongPageData }) {
  const track = useToolEvents('tojeong')
  const context = useMemo(() => ({ tool: 'tojeong', track }), [track])
  const errorId = useId()
  const [calendar, setCalendar] = useState<Calendar>('solar')
  const [error, setError] = useState<FormError | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  // 分享链接：预渲染 HTML 不含结果，水合后按地址栏参数显示
  useEffect(() => {
    const shared = sharedOutcome(window.location.search)
    if (shared) setOutcome(shared)
  }, [])
  useEffect(() => {
    if (outcome) track('result_view')
  }, [outcome, track])

  const submit = async (data: FormData) => {
    const computed = await computeTojeong(data)
    if (!computed.ok) {
      setError(computed.error)
      return
    }
    setError(null)
    setOutcome(computed.outcome)
    // 自己计算后去掉地址栏中的分享参数，避免复制到旧结果
    if (window.location.search) window.history.replaceState(null, '', href(TOJEONG_PATH))
    requestAnimationFrame(() =>
      document.getElementById('result')?.scrollIntoView({ block: 'start' }),
    )
  }

  return (
    <ToolContext value={context}>
      <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
        <header className="flex max-w-180 flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
          <Breadcrumb items={[{ name: copy.home, href: href('/') }, { name: copy.toolCrumb }]} />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-balance font-heading text-ink text-title">{page.heading}</h1>
            <span className="inline-flex min-h-6 items-center rounded-full bg-brand px-2.5 text-caption text-on-brand">
              {TOJEONG_DEFAULT_YEAR}
            </span>
          </div>
          <p className="m-0 text-body text-ink-muted">{page.lede}</p>
        </header>

        <div data-locale-fixed className="contents">
          <ToolForm
            label={copy.formLabel}
            onSubmit={(data) => void submit(data)}
            onChange={(data) => setCalendar(data.get('calendar') === 'lunar' ? 'lunar' : 'solar')}
          >
            <fieldset
              className="col-span-full m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0"
              aria-describedby={error ? errorId : undefined}
            >
              <legend className="sr-only">{copy.birthDate}</legend>
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span aria-hidden="true" className={fieldLabel}>
                  {copy.birthDate}
                </span>
                <ChoiceGroup
                  compact
                  legend={copy.calendar}
                  name="calendar"
                  defaultValue="solar"
                  options={[
                    { value: 'solar', label: copy.solar },
                    { value: 'lunar', label: copy.lunar },
                  ]}
                />
              </div>
              <div className="grid grid-cols-7 gap-2">
                <DatePart
                  label={copy.year}
                  name="year"
                  placeholder="1990"
                  maxLength={4}
                  invalid={error === 'date' || error === 'target'}
                  className="col-span-3"
                />
                <DatePart
                  label={copy.month}
                  name="month"
                  placeholder="5"
                  maxLength={2}
                  invalid={error === 'date' || error === 'leap'}
                  className="col-span-2"
                />
                <DatePart
                  label={copy.day}
                  name="day"
                  placeholder="15"
                  maxLength={2}
                  invalid={error === 'date'}
                  className="col-span-2"
                />
              </div>
              {calendar === 'lunar' && <CheckboxField label={copy.leapMonth} name="leap" />}
              <FieldError id={errorId} alert error={error ? ERROR_TEXT[error] : undefined} />
            </fieldset>
            <SelectField
              label={copy.targetYear}
              name="target"
              defaultValue={String(TOJEONG_DEFAULT_YEAR)}
              options={TOJEONG_YEARS.map((year) => ({
                value: String(year),
                label: copy.targetYearOption(year),
              }))}
            />
            <p className="col-span-full m-0 text-caption text-ink-subtle">{copy.hint}</p>
            <SubmitButton>{copy.submit}</SubmitButton>
          </ToolForm>
        </div>

        <section
          data-locale-fixed
          id="result"
          aria-label={copy.resultTitle(TOJEONG_DEFAULT_YEAR)}
          aria-live="polite"
          className="flex max-w-190 scroll-mt-6 flex-col gap-6 empty:hidden"
        >
          {outcome && <TojeongResultView key={resultKey(outcome)} outcome={outcome} />}
        </section>

        <article className="flex max-w-180 flex-col gap-5">
          <AlmanacProse html={page.html} />
          {page.yearlyLink && (
            <p className="m-0 text-body text-ink-muted">
              {copy.yearlyLink.before}
              <a href={href(page.yearlyLink)} className={bodyLink}>
                {copy.yearlyLink.anchor}
              </a>
              {copy.yearlyLink.after}
            </p>
          )}
        </article>

        <ToolFaq
          title={copy.faqTitle}
          items={page.faq.map(({ q, a }) => ({ question: q, answer: a }))}
        />

        {page.related.length > 0 && (
          // 关联工具卡是模板区块（data-link-zone="related"），不计入正文内链
          <nav
            data-link-zone="related"
            aria-labelledby="tojeong-related"
            className="flex flex-col gap-3"
          >
            <h2 id="tojeong-related" className="m-0 font-heading text-ink text-title">
              {copy.relatedTitle}
            </h2>
            <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 md:gap-3 lg:grid-cols-4">
              {page.related.map((item) => (
                <li key={item.path} className="flex min-w-0">
                  <LinkCard
                    href={href(item.path)}
                    title={item.title}
                    description={item.note}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <p role="note" className="m-0 max-w-180 text-caption text-ink-subtle">
          {copy.disclaimer}
        </p>
      </PageWidth>
    </ToolContext>
  )
}

const resultKey = (outcome: Outcome) =>
  outcome.kind === 'shared'
    ? `s${outcome.gwae}-${outcome.year}`
    : `c${outcome.result.gwae}-${outcome.result.targetLunar.year}-${outcome.result.birthLunar.year}${outcome.result.birthLunar.month}${outcome.result.birthLunar.day}`

function TojeongResultView({ outcome }: { outcome: Outcome }) {
  const gwae = outcome.kind === 'shared' ? outcome.gwae : outcome.result.gwae
  const year = outcome.kind === 'shared' ? outcome.year : outcome.result.targetLunar.year
  const [entry, setEntry] = useState<GwaeEntry | null | 'error'>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let live = true
    loadGwae(gwae).then(
      (loaded) => live && setEntry(loaded ?? 'error'),
      () => live && setEntry('error'),
    )
    return () => {
      live = false
    }
  }, [gwae])

  const digits = [Math.floor(gwae / 100), Math.floor(gwae / 10) % 10, gwae % 10] as const
  const copyLink = () => {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('gwae', String(gwae))
    url.searchParams.set('year', String(year))
    void navigator.clipboard?.writeText(url.href).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <>
      <h2 className="m-0 font-heading text-ink text-title">{copy.resultTitle(year)}</h2>
      <div className="flex flex-col gap-4 rounded-object bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <p className="m-0 flex flex-col">
            <span className="text-caption text-ink-subtle">{copy.gwaeLabel}</span>
            <span className="font-bold font-heading text-ink text-title">{gwae}</span>
          </p>
          <dl className="m-0 grid flex-1 grid-cols-3 gap-2 sm:max-w-90">
            {(
              [
                [copy.sang, copy.sangBasis, digits[0]],
                [copy.jung, copy.jungBasis, digits[1]],
                [copy.ha, copy.haBasis, digits[2]],
              ] as const
            ).map(([label, basis, value]) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 rounded-field bg-surface-2 px-1 py-3"
              >
                <dt className="text-caption text-ink-subtle">{`${label} (${basis})`}</dt>
                <dd className="m-0 font-bold font-heading text-ink text-subtitle">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {outcome.kind === 'computed' ? (
          <ComputedNotes calendar={outcome.calendar} result={outcome.result} />
        ) : (
          <p className="m-0 text-caption text-ink-subtle">{copy.sharedNote(year)}</p>
        )}
      </div>

      {entry === null ? (
        <p className="m-0 text-body text-ink-muted" aria-busy="true">
          {copy.loading}
        </p>
      ) : entry === 'error' ? (
        <p role="alert" className="m-0 text-body text-danger">
          {copy.loadFailed}
        </p>
      ) : (
        <GwaeReading entry={entry} />
      )}

      <div className="flex flex-col items-start gap-1">
        <button type="button" className={secondaryButton} onClick={copyLink}>
          {copied ? copy.copied : copy.copyLink}
        </button>
        <p className="m-0 text-caption text-ink-subtle">{copy.copyHint}</p>
      </div>
    </>
  )
}

function ComputedNotes({ calendar, result }: { calendar: Calendar; result: TojeongResult }) {
  const { birthLunar, targetLunar } = result
  const note = calendar === 'solar' ? copy.solarNote : copy.lunarNote
  const lines: ReactNode[] = [
    note(birthLunar.year, birthLunar.month, birthLunar.day, birthLunar.isLeapMonth),
    `${copy.ageLabel(targetLunar.year)}: ${copy.ageValue(result.countingAge)}`,
  ]
  if (birthLunar.isLeapMonth) lines.push(copy.leapNote)
  if (targetLunar.day < birthLunar.day)
    lines.push(copy.shortMonthNote(targetLunar.year, targetLunar.month))
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-caption text-ink-muted">
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 固定顺序的说明行
          <li key={index}>{line}</li>
        ))}
      </ul>
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-brand-ink text-caption underline underline-offset-4 [&::-webkit-details-marker]:hidden">
          {copy.workingsTitle}
        </summary>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-caption text-ink-muted">
          {copy.workings({ ...result, day: targetLunar.day }).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function GwaeReading({ entry }: { entry: GwaeEntry }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="m-0 font-heading text-ink text-subtitle">
          {copy.summaryTitle} · {entry.title}
        </h3>
        <p className="m-0 text-body text-ink-muted">{entry.summary}</p>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="m-0 font-heading text-ink text-subtitle">{copy.themesTitle}</h3>
        <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['work', 'people', 'self'] as const).map((key) => (
            <div key={key} className={cn('flex flex-col gap-1 rounded-object bg-surface p-4')}>
              <dt className="text-caption text-ink-subtle">{copy.themes[key]}</dt>
              <dd className="m-0 text-body text-ink-muted">{entry.themes[key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
