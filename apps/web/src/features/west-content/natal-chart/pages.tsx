import type { HouseSystem, PointKey, SignKey } from '@xuanxue/astro/chart'
import {
  createPlaceSearch,
  isValidTimeZone,
  localToUtc,
  PLACE_ATTRIBUTION,
  PLACE_DATA_VERSION,
  type Place,
  type PlaceSearch,
  type PlaceSlice,
  utcOffsetSeconds,
} from '@xuanxue/astro/places'
import { Alert, AlertDescription, cn, LinkCard } from '@xuanxue/ui'
import {
  ChartWheel,
  type ChartWheelAspect,
  type FactColumn,
  FactTable,
  PlaceCombobox,
  type PlaceOption,
} from '@xuanxue/ui/project'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import { RichContent } from '../../marketing/rich-content.tsx'
import { NATAL_READING_LOCALES } from '../../readings/release.ts'
import { ReadingComingSoon, ReadingUnlock } from '../../readings/unlock-card.tsx'
import type { PageLink } from '../../seo/page-links.ts'
import { Breadcrumb } from '../../tools/breadcrumb.tsx'
import { DateField, TimeField } from '../../tools/date-field.tsx'
import { CheckboxField, ChoiceGroup, SubmitButton, ToolForm } from '../../tools/form.tsx'
import { readShareFragment, type ShareInput } from '../../tools/share.ts'
import { toolHref } from '../../tools/tool-href.ts'
import { ToolPage } from '../../tools/tool-page.tsx'
import {
  aspectName,
  aspectReading,
  NATAL_COPY as copy,
  elementName,
  houseOrdinal,
  isHardAspect,
  modalityName,
  pointGlyph,
  pointName,
  SIGN_GLYPHS,
  signName,
} from './copy.ts'
import {
  type BirthPlace,
  balance,
  type ChartEngine,
  computeNatal,
  type FieldErrorKey,
  formatClock,
  formatCoordinates,
  formatDegree,
  formatLocalDate,
  formatOffset,
  formatOrb,
  formatUtc,
  formatZonedClock,
  type NatalInput,
  type NatalResult,
  parseNatalForm,
  SIGN_ORDER,
  type TimeEngine,
} from './model.ts'
import type { NatalPayload } from './natal.functions.ts'
import { NATAL_LOCALE, NATAL_PATHS } from './paths.ts'

/**
 * 三巨头计算器与出生星盘（设计稿 docs/design/prototypes/content-growth-v2-batch2/Main.dc.html、NatalChart.dc.html、
 * Wheel.dc.html，使用者 2026-11-24 确认；默认 B1–B5）。只用 @xuanxue/ui 组件与设计 token。
 *
 * 表单、正文与 FAQ 构建期预渲染；访客提交后才动态加载 `@xuanxue/astro/chart`（astronomy-engine），在浏览器计算。
 * 地名按首字母加载 `/geo/places/v<n>/<字母>.json` 静态切片，不查数据库；历史时差由浏览器的 Intl 求得。
 * 付费详批 `natal-full` 由服务端复算（features/readings/catalog.ts），评测通过并经使用者审阅前显示「即将开放」（B5）。
 */

const href = (path: string) => toolHref(path, NATAL_LOCALE)
const h2 = 'm-0 text-balance font-heading text-ink text-title'
const h3 = 'm-0 font-heading text-ink text-subtitle'
const muted = 'm-0 max-w-180 text-body text-ink-muted'
const caption = 'm-0 text-caption text-ink-subtle'
const inlineLink = 'text-brand-ink underline underline-offset-4 hover:decoration-2'
const tile = 'flex min-w-0 flex-col gap-3 rounded-object bg-surface p-5 sm:p-6'

// localToUtc 与地名检索同属 places 子入口（体积很小、不含星历），随本页静态引入
const timeEngine: TimeEngine = { localToUtc, utcOffsetSeconds }

let enginePromise: Promise<ChartEngine> | null = null
function loadChartEngine(): Promise<ChartEngine> {
  enginePromise ??= import('@xuanxue/astro/chart').catch((error: unknown) => {
    enginePromise = null
    throw error
  })
  return enginePromise
}

let searchInstance: PlaceSearch | null = null
function placeSearch(): PlaceSearch {
  searchInstance ??= createPlaceSearch(async (key) => {
    const response = await fetch(`/geo/places/v${PLACE_DATA_VERSION}/${key}.json`)
    if (!response.ok) throw new Error(`Place slice ${key}: ${response.status}`)
    return (await response.json()) as PlaceSlice
  })
  return searchInstance
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()
const countryName = (code: string) => regionNames?.of(code) ?? code

function placeLabel(place: Pick<Place, 'name' | 'admin1' | 'country'>): string {
  const parts = [place.name]
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1)
  parts.push(countryName(place.country))
  return parts.join(', ')
}

function placeOption(place: Place, index: number): PlaceOption {
  return {
    value: `${index}:${place.latitude},${place.longitude}`,
    label: placeLabel(place),
    name: place.alias ? `${place.name} (${place.alias})` : place.name,
    detail: [place.admin1, countryName(place.country)].filter(Boolean).join(', '),
  }
}

/** `#r=` 分享片段与解锁回跳：日期、时间、出生地坐标与时区（不含地名以外的个人信息） */
function shareOf(input: NatalInput, label: string): ShareInput {
  return {
    date: `${input.year}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}`,
    time: input.time
      ? `${String(input.time.hour).padStart(2, '0')}:${String(input.time.minute).padStart(2, '0')}`
      : '',
    lat: input.place.latitude,
    lon: input.place.longitude,
    tz: input.place.timeZone,
    place: label,
    house: input.houseSystem,
  }
}

function placeFromShare(shared: ShareInput): (BirthPlace & { label: string }) | null {
  const { lat, lon, tz, place } = shared
  if (typeof lat !== 'number' || typeof lon !== 'number' || typeof tz !== 'string') return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || !isValidTimeZone(tz)) return null
  const label = typeof place === 'string' ? place.slice(0, 120) : formatCoordinates(lat, lon)
  return {
    name: label,
    admin1: '',
    country: '',
    latitude: lat,
    longitude: lon,
    timeZone: tz,
    label,
  }
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

type Phase =
  | { readonly name: 'idle' }
  | { readonly name: 'loading' }
  | { readonly name: 'failed' }
  | { readonly name: 'done'; readonly result: NatalResult; readonly label: string }

interface FormState {
  readonly date: string
  readonly time: string
  readonly unknownTime: boolean
  readonly house: HouseSystem
}

export function NatalPage({ payload }: { payload: NatalPayload }) {
  const chartPage = payload.id === 'birth-chart'
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [errors, setErrors] = useState<{
    [K in 'date' | 'time' | 'place']?: FieldErrorKey | undefined
  }>({})
  const [form, setForm] = useState<FormState>({
    date: '',
    time: '',
    unknownTime: false,
    house: 'placidus',
  })
  // 分享片段恢复时重新挂载分段输入（非受控），带入默认值
  const [formKey, setFormKey] = useState(0)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<{ option: PlaceOption; place: BirthPlace }[]>([])
  const [placeStatus, setPlaceStatus] = useState<'short' | 'loading' | 'none' | 'failed' | 'ok'>(
    'short',
  )
  const [selected, setSelected] = useState<{
    value: string
    place: BirthPlace
    label: string
  } | null>(null)
  const latestQuery = useRef('')

  const onQueryChange = useCallback((text: string) => {
    setQuery(text)
    latestQuery.current = text
    setSelected(null)
    if (text.trim().length < 2) {
      setOptions([])
      setPlaceStatus('short')
      return
    }
    setPlaceStatus('loading')
    placeSearch()(text, 8).then(
      (places) => {
        if (latestQuery.current !== text) return
        setOptions(
          places.map((place, i) => ({
            option: placeOption(place, i),
            place: {
              name: place.name,
              admin1: place.admin1,
              country: place.country,
              latitude: place.latitude,
              longitude: place.longitude,
              timeZone: place.timeZone,
            },
          })),
        )
        setPlaceStatus(places.length > 0 ? 'ok' : 'none')
      },
      () => {
        if (latestQuery.current === text) setPlaceStatus('failed')
      },
    )
  }, [])

  const items = useMemo(() => {
    const list = options.map((item) => item.option)
    // 已选地名始终留在列表中，输入框才能显示它的文字
    if (selected && !list.some((item) => item.value === selected.value))
      list.unshift({
        value: selected.value,
        label: selected.label,
        name: selected.label,
        detail: '',
      })
    return list
  }, [options, selected])

  const onPick = (value: string) => {
    if (!value) {
      setSelected(null)
      return
    }
    const hit = options.find((item) => item.option.value === value)
    if (hit) {
      setSelected({ value, place: hit.place, label: hit.option.label })
      setErrors((current) => ({ ...current, place: undefined }))
    }
  }

  // 最近一次通过校验的提交：切换宫位制只重算这份输入，不带入之后改动但未提交的日期或地名
  const submitted = useRef<{
    state: FormState
    place: (BirthPlace & { label: string }) | null
  } | null>(null)

  const run = useCallback(
    async (state: FormState, place: (BirthPlace & { label: string }) | null) => {
      const parsed = parseNatalForm(
        {
          date: state.date,
          time: state.time,
          unknownTime: state.unknownTime,
          place,
          houseSystem: state.house,
        },
        todayKey(),
      )
      if (!parsed.ok) {
        setErrors(parsed.errors)
        return
      }
      setErrors({})
      submitted.current = { state, place }
      setPhase({ name: 'loading' })
      try {
        const engine = await loadChartEngine()
        const result = computeNatal(parsed.input, engine, timeEngine)
        setPhase({ name: 'done', result, label: place?.label ?? '' })
        requestAnimationFrame(() =>
          document.getElementById('result')?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
        )
      } catch {
        setPhase({ name: 'failed' })
      }
    },
    [],
  )

  const selectedPlace = selected ? { ...selected.place, label: selected.label } : null

  const submit = (data: FormData) => {
    const state: FormState = {
      date: String(data.get('date') ?? ''),
      time: String(data.get('time') ?? ''),
      unknownTime: form.unknownTime,
      house: data.get('house') === 'whole-sign' ? 'whole-sign' : 'placidus',
    }
    setForm(state)
    void run(state, selectedPlace)
  }

  // 结果出现后切换宫位制：立即重算
  const onFormChange = (data: FormData) => {
    const house: HouseSystem = data.get('house') === 'whole-sign' ? 'whole-sign' : 'placidus'
    if (house === form.house) return
    setForm((current) => ({ ...current, house }))
    const last = submitted.current
    if (last && phase.name === 'done' && phase.result.kind === 'timed')
      void run({ ...last.state, house }, last.place)
  }

  // 打开分享链接（`#r=`）时恢复输入并直接出结果；只在挂载时读取一次
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    const shared = readShareFragment(window.location.hash)
    if (!shared) return
    const place = placeFromShare(shared)
    const date = typeof shared.date === 'string' ? shared.date : ''
    const time = typeof shared.time === 'string' ? shared.time : ''
    const state: FormState = {
      date,
      time,
      unknownTime: time === '',
      house: shared.house === 'whole-sign' ? 'whole-sign' : 'placidus',
    }
    setForm(state)
    setFormKey((key) => key + 1)
    if (place) setSelected({ value: 'shared', place, label: place.label })
    void runRef.current(state, place)
  }, [])

  const zoneHint = useMemo(() => {
    if (!selected) return undefined
    const zone = selected.place.timeZone
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.date)
    if (!parsed) return copy.zoneHintUndated(zone)
    const [, y, m, d] = parsed
    try {
      const local = { year: Number(y), month: Number(m), day: Number(d), hour: 12, minute: 0 }
      const resolved = localToUtc(local, zone)
      return copy.zoneHint(zone, formatOffset(resolved.offsetSeconds))
    } catch {
      return copy.zoneHintUndated(zone)
    }
  }, [selected, form.date])

  const emptyText =
    placeStatus === 'loading'
      ? copy.placeLoading
      : placeStatus === 'none'
        ? copy.placeNone
        : placeStatus === 'failed'
          ? copy.placeFailed
          : copy.placeTypeMore

  const result = phase.name === 'done' ? phase.result : null
  const unlockOpen = NATAL_READING_LOCALES.includes(NATAL_LOCALE)
  const formEl = (
    <ToolForm
      key={formKey}
      label={copy.formLabel}
      onSubmit={submit}
      {...(chartPage ? { onChange: onFormChange } : {})}
    >
      <DateField
        label={copy.date}
        name="date"
        defaultValue={form.date}
        required
        error={errors.date ? copy.errors[errors.date] : undefined}
        onValueChange={(date) => setForm((current) => ({ ...current, date }))}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <TimeField
          label={copy.time}
          name="time"
          defaultValue={form.time}
          disabled={form.unknownTime}
          error={errors.time && !form.unknownTime ? copy.errors[errors.time] : undefined}
        />
        <CheckboxField
          label={copy.unknownTime}
          name="unknownTime"
          checked={form.unknownTime}
          onChange={(event) => {
            const unknownTime = event.currentTarget.checked
            setForm((current) => ({ ...current, unknownTime }))
            setErrors((current) => ({ ...current, time: undefined }))
          }}
        />
      </div>
      <PlaceCombobox
        className="col-span-full"
        label={copy.place}
        placeholder={copy.placePlaceholder}
        items={items}
        value={selected?.value ?? ''}
        onValueChange={onPick}
        onQueryChange={onQueryChange}
        emptyText={query.trim().length < 2 ? copy.placeTypeMore : emptyText}
        hint={zoneHint ?? copy.placeTypeMore}
        error={errors.place ? copy.errors.place : undefined}
        clearLabel={copy.placeClear}
      />
      {chartPage && !form.unknownTime ? (
        <ChoiceGroup
          className="col-span-full sm:max-w-80"
          legend={copy.houseSystem}
          name="house"
          defaultValue={form.house}
          options={[
            { value: 'placidus', label: copy.placidus },
            { value: 'whole-sign', label: copy.wholeSign },
          ]}
        />
      ) : null}
      <div className="col-span-full flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-5">
        <p className={caption}>{copy.browserNote}</p>
        <SubmitButton className="sm:col-span-1">
          {chartPage ? copy.submitChart : copy.submitBigThree}
        </SubmitButton>
      </div>
    </ToolForm>
  )

  const resultEl =
    phase.name === 'loading' ? (
      <p aria-busy="true" className={caption}>
        {copy.loading}
      </p>
    ) : phase.name === 'failed' ? (
      <Alert variant="destructive" className="max-w-190">
        <AlertDescription>{copy.engineFailed}</AlertDescription>
      </Alert>
    ) : result ? (
      chartPage ? (
        <ChartResult result={result} />
      ) : (
        <BigThreeResult result={result} />
      )
    ) : null

  return (
    <MarketingShell>
      <ToolPage
        tool={payload.id}
        title={payload.heading}
        intro={<p className="m-0">{payload.lede}</p>}
        breadcrumb={
          <Breadcrumb
            items={[
              ...payload.breadcrumb.map((item) => ({ name: item.label, href: href(item.href) })),
              { name: payload.heading },
            ]}
          />
        }
        form={formEl}
        result={resultEl}
        faq={payload.faq.map(({ q, a }) => ({ question: q, answer: a }))}
        article={payload.sections.map((section) => (
          <ProseSection key={section.title} title={section.title} html={section.html} />
        ))}
        nav={<Related items={payload.related} />}
      >
        {chartPage && result ? unlockOpen ? null : <ReadingComingSoon kind="natal-full" /> : null}
        {chartPage && unlockOpen ? (
          <ReadingUnlock kind="natal-full" request={result ? natalUnlock(result, phase) : null} />
        ) : null}
      </ToolPage>
      <PageAttribution />
    </MarketingShell>
  )
}

/** 解锁请求：`POST /api/readings` 只收出生资料，星盘由服务端复算（不采用浏览器的计算结果） */
function natalUnlock(result: NatalResult, phase: Phase) {
  const { input } = result
  const label = phase.name === 'done' ? phase.label : ''
  return {
    input: {
      year: input.year,
      month: input.month,
      day: input.day,
      ...(input.time ? { hour: input.time.hour, minute: input.time.minute } : {}),
      latitude: input.place.latitude,
      longitude: input.place.longitude,
      timeZone: input.place.timeZone,
      houseSystem: input.houseSystem,
    },
    share: shareOf(input, label),
  }
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

function Related({ items }: { items: readonly PageLink[] }) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <nav data-link-zone="related" aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="m-0 font-heading text-heading text-ink">
        {copy.relatedTitle}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.href} className="flex min-w-0">
            <LinkCard href={href(item.href)} title={item.label} className="w-full" />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function PageAttribution() {
  return (
    <p className={cn(caption, 'mx-auto w-full max-w-300 px-4 pb-10 sm:px-6')}>
      {copy.attribution.before}
      <a href={PLACE_ATTRIBUTION.url} className={inlineLink} rel="noopener">
        {PLACE_ATTRIBUTION.source}
      </a>
      {copy.attribution.middle}
      <a href={PLACE_ATTRIBUTION.licenseUrl} className={inlineLink} rel="noopener license">
        {PLACE_ATTRIBUTION.license}
      </a>
      {copy.attribution.after}
    </p>
  )
}

// ---------------------------------------------------------------------------
// 结果区
// ---------------------------------------------------------------------------

type Untimed = Extract<NatalResult, { kind: 'untimed' }>
type Timed = Extract<NatalResult, { kind: 'timed' }>

/** 无时间态某点的星座文字：跨座时为「X or Y」 */
function untimedSign(result: Untimed, key: PointKey): string {
  const change = result.changes[key]
  return change ? copy.either(change.signs.map(signName)) : signName(result.positions[key].sign)
}

function changeClock(result: Untimed, key: PointKey): string | null {
  const change = result.changes[key]
  return change ? formatZonedClock(change.atMs, result.input.place.timeZone, timeEngine) : null
}

function SignTile({
  label,
  sign,
  glyph,
  detail,
  text,
  link,
}: {
  label: string
  sign: string
  glyph: string
  detail: string
  text: string
  link?: { href: string; label: string } | undefined
}) {
  return (
    <div className={tile}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="font-heading text-display text-mark leading-none">
          {glyph}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className={caption}>{label}</span>
          <span className="font-heading text-ink text-title">{sign}</span>
        </div>
      </div>
      <p className={caption}>{detail}</p>
      <p className="m-0 text-body text-ink-muted">{text}</p>
      {link ? (
        <a href={link.href} className={cn(inlineLink, 'text-body')}>
          {link.label}
        </a>
      ) : null}
    </div>
  )
}

const signLink = (sign: SignKey) => ({
  href: href(`/zodiac-signs/${sign}`),
  label: copy.aboutSign(signName(sign)),
})

function BigThreeResult({ result }: { result: NatalResult }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <h2 id={titleId} className={h2}>
        {copy.bigThreeTitle}
      </h2>
      {result.kind === 'timed' ? (
        <BigThreeTimed result={result} />
      ) : (
        <BigThreeUntimed result={result} />
      )}
      <div className="flex max-w-190 flex-col items-start gap-4 rounded-object bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex flex-col gap-2">
          <h3 className={h3}>{copy.seeChartTitle}</h3>
          <p className={muted}>{copy.seeChartText}</p>
        </div>
        <a
          href={href(NATAL_PATHS['birth-chart'])}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-field-border px-6 font-medium text-body text-ink hover:bg-surface-2"
        >
          {copy.seeChartLink}
        </a>
      </div>
    </section>
  )
}

function BigThreeTimed({ result }: { result: Timed }) {
  const { chart } = result
  const sun = chart.points.sun
  const moon = chart.points.moon
  const asc = chart.ascendant
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SignTile
          label={copy.sunSign}
          sign={signName(sun.sign)}
          glyph={SIGN_GLYPHS[signIndex(sun.sign)] ?? ''}
          detail={copy.placeLine(`${Math.floor(sun.degree)}°`, signName(sun.sign), sun.house)}
          text={copy.sunText}
          link={signLink(sun.sign)}
        />
        <SignTile
          label={copy.moonSign}
          sign={signName(moon.sign)}
          glyph={SIGN_GLYPHS[signIndex(moon.sign)] ?? ''}
          detail={copy.placeLine(`${Math.floor(moon.degree)}°`, signName(moon.sign), moon.house)}
          text={copy.moonText}
          link={signLink(moon.sign)}
        />
        <SignTile
          label={copy.risingSign}
          sign={signName(asc.sign)}
          glyph={SIGN_GLYPHS[signIndex(asc.sign)] ?? ''}
          detail={copy.placeLine(`${Math.floor(asc.degree)}°`, signName(asc.sign), null)}
          text={copy.risingText}
          link={signLink(asc.sign)}
        />
      </div>
      <HowCalculated result={result} />
    </>
  )
}

function BigThreeUntimed({ result, chart = false }: { result: Untimed; chart?: boolean }) {
  const sun = result.changes.sun
  const moon = result.changes.moon
  const sunClock = changeClock(result, 'sun')
  const moonClock = changeClock(result, 'moon')
  return (
    <>
      <Alert className="max-w-190">
        <AlertDescription>
          {(chart ? copy.noTimeChart : copy.noTimeBigThree)(Boolean(moon))}
        </AlertDescription>
      </Alert>
      <div className={cn('grid grid-cols-1 gap-4', chart ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
        <SignTile
          label={copy.sunSign}
          sign={untimedSign(result, 'sun')}
          glyph={sun ? '☉︎' : (SIGN_GLYPHS[signIndex(result.positions.sun.sign)] ?? '')}
          detail={
            sun && sunClock
              ? copy.changedAt(sunClock)
              : copy.allDay(signName(result.positions.sun.sign))
          }
          text={
            sun && sunClock
              ? copy.bornBeforeAfter(
                  sunClock,
                  signName(sun.signs[0] as SignKey),
                  signName(sun.signs[1] as SignKey),
                )
              : copy.sunText
          }
          link={sun ? undefined : signLink(result.positions.sun.sign)}
        />
        <SignTile
          label={copy.moonSign}
          sign={untimedSign(result, 'moon')}
          glyph={moon ? '☽︎' : (SIGN_GLYPHS[signIndex(result.positions.moon.sign)] ?? '')}
          detail={
            moon && moonClock
              ? copy.changedAt(moonClock)
              : copy.allDay(signName(result.positions.moon.sign))
          }
          text={
            moon && moonClock
              ? copy.bornBeforeAfter(
                  moonClock,
                  signName(moon.signs[0] as SignKey),
                  signName(moon.signs[1] as SignKey),
                )
              : copy.moonText
          }
          link={moon ? undefined : signLink(result.positions.moon.sign)}
        />
        {chart ? null : (
          <SignTile
            label={copy.risingSign}
            sign={copy.needsTime}
            glyph="?"
            detail={copy.notCalculated}
            text={copy.risingNoTime}
          />
        )}
      </div>
    </>
  )
}

const signIndex = (sign: SignKey) => SIGN_ORDER.indexOf(sign)

interface StepRow {
  readonly step: string
  readonly value: string
  readonly note: string
}

function HowCalculated({ result }: { result: Timed }) {
  const titleId = useId()
  const { moment, input, chart } = result
  const local = `${formatLocalDate(moment.local)}, ${formatClock(moment.local.hour, moment.local.minute)}`
  const zoneNote =
    moment.status === 'ambiguous'
      ? copy.ambiguousNote
      : moment.status === 'nonexistent'
        ? copy.skippedNote
        : copy.zoneNote
  const rows: StepRow[] = [
    { step: copy.localTime, value: local, note: copy.localTimeNote },
    {
      step: copy.timeZone,
      value: `${input.place.timeZone}, ${formatOffset(moment.offsetSeconds)}`,
      note: zoneNote,
    },
    { step: copy.universalTime, value: formatUtc(moment.utcMs), note: copy.universalNote },
    {
      step: copy.coordinates,
      value: formatCoordinates(input.place.latitude, input.place.longitude),
      note: copy.coordinatesNote,
    },
    {
      step: copy.houses,
      value: chart.houses.system === 'placidus' ? copy.placidus : copy.wholeSign,
      note: chart.houses.highLatitudeFallback ? copy.highLatitude : copy.housesNote,
    },
  ]
  const columns: FactColumn<StepRow>[] = [
    { key: 'step', header: copy.step, cell: (row) => row.step, kind: 'key' },
    {
      key: 'value',
      header: copy.value,
      cell: (row) => row.value,
      kind: 'nowrap',
      stacked: 'label',
    },
    { key: 'note', header: copy.note, cell: (row) => row.note, stacked: 'full' },
  ]
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h3 id={titleId} className={h3}>
        {copy.howTitle}
      </h3>
      <FactTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.step}
        caption={copy.howCaption}
        stack
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// 出生星盘
// ---------------------------------------------------------------------------

interface PlanetRow {
  readonly key: string
  readonly name: string
  readonly sign: string
  readonly degree: string
  readonly house: string
  readonly motion: string
}

const ASPECTS_SHOWN = 8
const WHEEL_ASPECTS = 10

function ChartResult({ result }: { result: NatalResult }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-8">
      <h2 id={titleId} className={h2}>
        {copy.chartTitle}
      </h2>
      {result.kind === 'timed' ? (
        <TimedChartResult result={result} />
      ) : (
        <BigThreeUntimed result={result} chart />
      )}
    </section>
  )
}

function TimedChartResult({ result }: { result: Timed }) {
  const tableId = useId()
  const { chart } = result
  const positions = chart.points
  const planetKeys: PointKey[] = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'meanNode',
  ]
  const rows: PlanetRow[] = planetKeys.map((key) => {
    const point = positions[key]
    return {
      key,
      name: pointName(key),
      sign: signName(point.sign),
      degree: formatDegree(point.degree),
      house: houseOrdinal(point.house),
      motion: key === 'meanNode' ? copy.meanNode : point.retrograde ? copy.retrograde : copy.direct,
    }
  })
  rows.push(
    {
      key: 'asc',
      name: copy.ascendant,
      sign: signName(chart.ascendant.sign),
      degree: formatDegree(chart.ascendant.degree),
      house: chart.houses.system === 'placidus' ? copy.cuspLabel(1) : '—',
      motion: '—',
    },
    {
      key: 'mc',
      name: copy.midheaven,
      sign: signName(chart.midheaven.sign),
      degree: formatDegree(chart.midheaven.degree),
      house: chart.houses.system === 'placidus' ? copy.cuspLabel(10) : '—',
      motion: '—',
    },
  )
  const columns: FactColumn<PlanetRow>[] = [
    { key: 'name', header: copy.planet, cell: (row) => row.name, kind: 'key' },
    { key: 'sign', header: copy.sign, cell: (row) => row.sign, kind: 'nowrap', stacked: 'label' },
    {
      key: 'degree',
      header: copy.degree,
      cell: (row) => row.degree,
      kind: 'nowrap',
      stacked: 'label',
    },
    {
      key: 'house',
      header: copy.house,
      cell: (row) => row.house,
      kind: 'nowrap',
      stacked: 'label',
    },
    { key: 'motion', header: copy.motion, cell: (row) => row.motion, stacked: 'label' },
  ]
  const tenSigns = planetKeys.filter((key) => key !== 'meanNode').map((key) => positions[key].sign)
  const { elements, modalities } = balance(tenSigns)
  return (
    <>
      {chart.houses.highLatitudeFallback ? (
        <Alert className="max-w-190">
          <AlertDescription>{copy.highLatitude}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className={cn(tile, 'gap-4')}>
          <h3 className={h3}>{copy.wheelTitle}</h3>
          <ChartWheel
            ascendant={chart.ascendant.longitude}
            midheaven={chart.midheaven.longitude}
            cusps={chart.houses.cusps}
            points={planetKeys.map((key) => ({
              key,
              glyph: pointGlyph(key),
              longitude: chart.points[key].longitude,
            }))}
            aspects={chart.aspects.slice(0, WHEEL_ASPECTS).map(
              (aspect): ChartWheelAspect => ({
                a: aspect.a,
                b: aspect.b,
                hard: isHardAspect(aspect.aspect),
              }),
            )}
            signGlyphs={SIGN_GLYPHS}
            axisLabels={copy.axisLabels}
            label={copy.wheelLabel(signName(chart.ascendant.sign))}
            describedBy={tableId}
          />
          <p className={caption}>
            {copy.wheelKey}{' '}
            <span
              aria-hidden="true"
              className="inline-block w-7 border-illus border-t align-middle"
            />{' '}
            {copy.wheelSoft} ·{' '}
            <span
              aria-hidden="true"
              className="inline-block w-7 border-illus border-t border-dashed align-middle"
            />{' '}
            {copy.wheelHard}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className={tile}>
            <p className={caption}>{copy.bigThreeTile}</p>
            <dl className="m-0 grid grid-cols-3 gap-3">
              <Fact label={copy.sun}>{signName(chart.points.sun.sign)}</Fact>
              <Fact label={copy.moon}>{signName(chart.points.moon.sign)}</Fact>
              <Fact label={copy.rising}>{signName(chart.ascendant.sign)}</Fact>
            </dl>
          </div>
          <div className={tile}>
            <p className={caption}>{copy.elementsTile}</p>
            <Chips items={elements.map((item) => `${elementName(item.key)} ${item.count}`)} />
            <p className={caption}>{copy.modalitiesTile}</p>
            <Chips items={modalities.map((item) => `${modalityName(item.key)} ${item.count}`)} />
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby={`${tableId}-title`}>
        <h3 id={`${tableId}-title`} className={h3}>
          {copy.planetsTitle}
        </h3>
        <div id={tableId}>
          <FactTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.key}
            caption={copy.planetsCaption}
            stack
          />
        </div>
        <Cusps result={result} />
      </section>

      <AspectsTable aspects={chart.aspects} />
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className={caption}>{label}</dt>
      <dd className="m-0 font-heading text-ink text-subtitle">{children}</dd>
    </div>
  )
}

function Chips({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-surface-2 px-3 py-1 text-caption text-ink">
          {item}
        </li>
      ))}
    </ul>
  )
}

function Cusps({ result }: { result: Timed }) {
  const system = result.chart.houses.system === 'placidus' ? copy.placidus : copy.wholeSign
  return (
    <details className="max-w-190">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-body text-ink">
        {copy.cuspsTitle(system)}
      </summary>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0 pt-2">
        {result.chart.houses.cusps.map((cusp, i) => {
          const sign = signName(zodiacOf(cusp))
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: 宫位序号即身份
            <li key={i} className="rounded-full bg-surface-2 px-3 py-1 text-caption text-ink">
              {`${i + 1} · ${Math.floor(cusp % 30)}° ${sign}`}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

const zodiacOf = (longitude: number) =>
  SIGN_ORDER[Math.floor((((longitude % 360) + 360) % 360) / 30) % 12] as SignKey

interface AspectRow {
  readonly key: string
  readonly pair: string
  readonly aspect: string
  readonly orb: string
  readonly reading: string
}

function AspectsTable({
  aspects,
}: {
  aspects: readonly {
    a: PointKey
    b: PointKey
    aspect: Parameters<typeof aspectName>[0]
    orb: number
  }[]
}) {
  const titleId = useId()
  const [all, setAll] = useState(false)
  const rows: AspectRow[] = aspects.map((item) => ({
    key: `${item.a}-${item.b}`,
    pair: `${pointName(item.a)} · ${pointName(item.b)}`,
    aspect: aspectName(item.aspect),
    orb: formatOrb(item.orb),
    reading: aspectReading(item.a, item.b, item.aspect),
  }))
  const shown = all ? rows : rows.slice(0, ASPECTS_SHOWN)
  const columns: FactColumn<AspectRow>[] = [
    { key: 'pair', header: copy.planets, cell: (row) => row.pair, kind: 'key' },
    {
      key: 'aspect',
      header: copy.aspect,
      cell: (row) => row.aspect,
      kind: 'nowrap',
      stacked: 'label',
    },
    { key: 'orb', header: copy.orb, cell: (row) => row.orb, kind: 'nowrap', stacked: 'label' },
    { key: 'reading', header: copy.reading, cell: (row) => row.reading, stacked: 'full' },
  ]
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h3 id={titleId} className={h3}>
        {copy.aspectsTitle}
      </h3>
      {rows.length > 0 ? (
        <FactTable
          columns={columns}
          rows={shown}
          rowKey={(row) => row.key}
          caption={copy.aspectsCaption}
          stack
        />
      ) : (
        <p className={muted}>{copy.noAspects}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {rows.length > ASPECTS_SHOWN ? (
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((value) => !value)}
            className={cn(inlineLink, 'min-h-11 text-body')}
          >
            {all ? copy.showFewer : copy.showAll(rows.length)}
          </button>
        ) : null}
        <span className={caption}>{copy.orbs}</span>
      </div>
    </section>
  )
}
