import type { Stem } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { PageWidth } from '@xuanxue/ui/project'
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { ALMANAC_LOCALE, ALMANAC_TOOL_PATH } from '../east-content/almanac/paths.ts'
import type { EastV1Locale } from '../i18n/locales.ts'
import { defaultPlace } from '../tools/bazi/birth-form-state.ts'
import { loadBazi } from '../tools/bazi/engine.ts'
import { TEN_GOD_LABEL } from '../tools/bazi/labels.ts'
import { DateField, TimeField } from '../tools/date-field.tsx'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { TOOL_ROUTES } from '../tools/registry.ts'
import { tarotPath } from '../tools/tarot/routes.ts'
import { mainToolHref, toolHref } from '../tools/tool-href.ts'
import {
  branchText,
  branchWithElement,
  ganzhiText,
  lunarText,
  relationLabel,
  relationLines,
  stemOrder,
  stemText,
  stemWithElement,
  tabooGlosses,
  tabooNames,
  tenGodTip,
} from './copy.ts'
import { browserDate, type CivilDate, formatLongDate, parseDateKey, sameDate } from './date.ts'
import {
  type EastDayFacts,
  type EastPersonalFacts,
  eastDayFacts,
  eastPersonalFacts,
  type NatalSummary,
  tenGodFor,
} from './facts.ts'
import { type EastDailyData, loadDailyEngine } from './load.ts'
import type { EastRules } from './rules/types.ts'

export { type EastDailyData, loadDailyEngine, loadEastDaily } from './load.ts'

/** 东方站页面标题用的「甲子日」 */
export function eastHeading(locale: string, facts: EastDayFacts): string {
  return m.daily_east_h1({ ganzhi: ganzhiText(locale, facts.stem, facts.branch) })
}

type Personal = { natal: NatalSummary; facts: EastPersonalFacts; date: string }

const card = 'flex flex-col gap-1 rounded-field bg-surface-2 p-4'
const cardLabel = 'text-caption text-ink-subtle'
const cardValue = 'font-bold font-heading text-ink text-subtitle'
/** 页首的农历 / 今日干支格（设计稿 `.pillar`）：surface-2 底、6px 圆角 */
const pillar =
  'flex flex-col items-center justify-center gap-1 rounded-field bg-surface-2 px-2 py-3'
/** 正文内链接：与正文同色并始终带下划线（text-brand-ink 的 <a> 由 brand.css 加下划线） */
const bodyLink = 'text-brand-ink hover:decoration-2'

/**
 * 东方站公开每日运势页（设计稿 warm-refresh/DailyEast.dc.html）：今日干支、宜忌与建除，十个日主的今日提示，
 * 以及在浏览器本地计算的个人化入口。服务端输出参考日期的全部规则内容；水合后若访客本地日期不同，
 * 在本地重算并替换日期相关的区块，不发网络请求（引擎 chunk 除外）。
 */
export function EastDailyPage({
  locale,
  rules,
  data,
}: {
  locale: EastV1Locale
  rules: EastRules
  data: EastDailyData
}) {
  const [facts, setFacts] = useState(data.facts)
  const [localDate, setLocalDate] = useState<CivilDate | null>(null)
  // 未选日主、未填生日时只显示通用部分（设计稿状态表），不默认展开某个日主
  const [selected, setSelected] = useState<Stem | null>(null)
  const [personal, setPersonal] = useState<Personal | null>(null)
  const date = parseDateKey(facts.date) ?? { year: 1970, month: 1, day: 1 }

  // 水合后按访客本地日期校正（spec「参考时区与访客本地日期」）
  useEffect(() => {
    const local = browserDate()
    const reference = parseDateKey(data.date)
    if (!reference || sameDate(local, reference)) return
    let active = true
    void loadDailyEngine().then(
      (engine) => {
        if (!active) return
        setFacts(eastDayFacts(engine, local))
        setLocalDate(local)
      },
      () => {
        // 引擎加载失败时保留参考日期的内容
      },
    )
    return () => {
      active = false
    }
  }, [data.date])

  // 日期变化后（本地校正）重算个人关系
  useEffect(() => {
    if (!personal || personal.date === facts.date) return
    const current = parseDateKey(facts.date)
    if (!current) return
    let active = true
    void loadDailyEngine().then((engine) => {
      if (!active) return
      setPersonal({
        natal: personal.natal,
        facts: eastPersonalFacts(engine, personal.natal, current),
        date: facts.date,
      })
    })
    return () => {
      active = false
    }
  }, [facts.date, personal])

  const recommends = tabooNames(rules, facts.recommends)
  const avoids = tabooNames(rules, facts.avoids)
  const glosses = tabooGlosses(rules, [...facts.recommends, ...facts.avoids])
  const duty = rules.duty[facts.duty]

  const ziwei = TOOL_ROUTES.find((route) => route.id === 'ziwei')?.paths[locale]

  return (
    <PageWidth className="flex flex-col gap-8 pb-16 sm:gap-10 sm:pb-28">
      <header className="flex flex-col gap-2 pt-5 sm:gap-3 sm:pt-10">
        <p role="note" className="m-0 text-caption text-ink-subtle" data-testid="daily-date">
          {formatLongDate(date, locale)} ·{' '}
          {localDate ? m.daily_local_note() : m.daily_reference_note()}
        </p>
        <h1 id="daily-h1" className="m-0 text-balance font-heading text-ink text-title">
          {m.daily_east_h1({ ganzhi: ganzhiText(locale, facts.stem, facts.branch) })}
        </h1>
        {/* 农历与今日干支两格（设计稿的年 / 月 / 日三柱需要年柱、月柱，流日引擎只给日柱） */}
        <div className="mt-2 grid w-full max-w-90 grid-cols-2 gap-2">
          <div className={pillar}>
            <span className="text-caption text-ink-subtle">{m.daily_lunar_label()}</span>
            <span className="text-center font-bold font-heading text-ink text-subtitle">
              {lunarText(locale, facts.lunar)}
            </span>
          </div>
          <div className={cn(pillar, 'ring-1 ring-mark ring-inset')}>
            <span className="text-caption text-ink-subtle">{m.daily_today_label()}</span>
            <span className="font-bold font-heading text-ink text-title">
              {stemText(locale, facts.stem)}
              {branchText(locale, facts.branch)}
            </span>
          </div>
        </div>
      </header>

      <section
        aria-label={`${m.daily_yi()} / ${m.daily_ji()}`}
        className="flex max-w-190 flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-object bg-surface p-5">
            <h2 className="m-0 font-heading text-ink text-subtitle">{m.daily_yi()}</h2>
            <p className="m-0 text-body text-ink-muted">
              {recommends.join(m.daily_list_separator()) || '—'}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-object bg-surface p-5">
            <h2 className="m-0 font-heading text-ink text-subtitle">{m.daily_ji()}</h2>
            <p className="m-0 text-body text-ink-muted">
              {avoids.join(m.daily_list_separator()) || '—'}
            </p>
          </div>
        </div>
        <p className="m-0 text-body text-ink-muted">
          <strong className="font-medium text-ink">
            {m.daily_duty()} · {m.daily_duty_value({ name: duty.name })}
          </strong>
          {duty.gloss}
        </p>
        {glosses.length > 0 && (
          <details className="text-caption text-ink-subtle">
            <summary className="min-h-11 cursor-pointer content-center">
              {m.daily_gloss_title()}
            </summary>
            <dl className="m-0 flex flex-col gap-1">
              {glosses.map((item) => (
                <Row key={item.name} term={item.name} termClass="text-ink">
                  {item.gloss}
                </Row>
              ))}
            </dl>
          </details>
        )}
      </section>

      <DayMasterSection
        locale={locale}
        rules={rules}
        facts={facts}
        selected={selected}
        onSelect={setSelected}
        personal={personal}
        onPersonal={(next) => {
          setPersonal(next)
          setSelected(next.natal.dayMaster)
        }}
      />

      {/* 正文内链（设计稿 warm-refresh/DailyEast.dc.html）：H2 之后的一段话里链接相关工具，不另设卡片行 */}
      <article className="flex max-w-180 flex-col gap-5">
        <h2 className="m-0 text-balance font-heading text-ink text-title">{m.daily_how_title()}</h2>
        <p className="m-0 text-body text-ink-muted">{m.daily_how_body()}</p>
        <h2 id="daily-more" className="m-0 mt-5 text-balance font-heading text-ink text-title">
          {m.daily_more_title()}
        </h2>
        <p className="m-0 text-body text-ink-muted">
          {m.daily_east_more_lead()}
          {/* 韩语没有紫微页：不为放链接另造目标，这一句整句省略 */}
          {ziwei ? (
            <>
              {m.daily_east_more_ziwei_before()}
              <a href={toolHref(ziwei, locale)} className={bodyLink}>
                {m.daily_east_more_ziwei_link()}
              </a>
              {m.daily_east_more_ziwei_after()}
            </>
          ) : (
            ' '
          )}
          {m.daily_east_more_tarot_before()}
          <a href={toolHref(tarotPath('daily', locale), locale)} className={bodyLink}>
            {m.daily_east_more_tarot_link()}
          </a>
          {m.daily_east_more_tarot_after()}
        </p>
      </article>

      <div className="flex flex-col gap-3">
        <Disclaimer />
        <p role="note" className="m-0 max-w-180 text-caption text-ink-subtle">
          <RulesNote locale={locale} version={facts.rulesVersion} />
        </p>
      </div>
    </PageWidth>
  )
}

/**
 * 规则说明：简中页把现成句子里的「黄历」链接到黄历工具页（openspec content-growth-phase2 决策 12，
 * 只在现成句子中加链、不新造句子）；繁中与韩语没有黄历页，原样输出。
 */
function RulesNote({ locale, version }: { locale: EastV1Locale; version: string }) {
  const text = m.daily_rules_note({ version })
  const word = '黄历'
  const at = locale === ALMANAC_LOCALE ? text.indexOf(word) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <a href={toolHref(ALMANAC_TOOL_PATH, locale)} className={bodyLink}>
        {word}
      </a>
      {text.slice(at + word.length)}
    </>
  )
}

/** 定义列表的一行：标签固定宽度，内容可折行 */
function Row({
  term,
  termClass = 'text-ink-subtle',
  children,
}: {
  term: string
  termClass?: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3">
      <dt className={cn('min-w-12 shrink-0 whitespace-nowrap font-medium', termClass)}>{term}</dt>
      <dd className="m-0 min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  )
}

function DayMasterSection({
  locale,
  rules,
  facts,
  selected,
  onSelect,
  personal,
  onPersonal,
}: {
  locale: EastV1Locale
  rules: EastRules
  facts: EastDayFacts
  selected: Stem | null
  onSelect: (stem: Stem) => void
  personal: Personal | null
  onPersonal: (personal: Personal) => void
}) {
  const baseId = useId()
  const [formOpen, setFormOpen] = useState(false)
  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="flex max-w-190 flex-col gap-5 rounded-object bg-surface p-6 shadow-raise sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${baseId}-title`} className="m-0 font-heading text-ink text-subtitle">
          {m.daily_mine_title()}
        </h2>
        <span className="text-caption text-ink-subtle">{m.daily_mine_privacy()}</span>
      </div>
      <div role="tablist" aria-label={m.daily_pick_label()} className="flex flex-wrap gap-2">
        {stemOrder().map((stem) => {
          const active = stem === selected
          return (
            <button
              key={stem}
              type="button"
              role="tab"
              id={`${baseId}-tab-${stem}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${stem}`}
              onClick={() => onSelect(stem)}
              className={cn(
                'size-12 rounded-field font-bold font-heading text-subtitle transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                active ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink hover:bg-background',
              )}
            >
              {stemText(locale, stem)}
            </button>
          )
        })}
      </div>
      {/* 「输入生日」不是页签：放在页签列表之外（tablist 里只能有 tab） */}
      <button
        type="button"
        aria-expanded={formOpen}
        onClick={() => setFormOpen((open) => !open)}
        className="min-h-12 self-start rounded-field border border-field-border bg-transparent px-4 text-body text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        {m.daily_unknown_master()}
      </button>
      {selected === null && (
        <p className="m-0 text-body text-ink-muted" data-testid="daily-master-neutral">
          {m.daily_master_neutral()}
        </p>
      )}
      {formOpen && <PersonalForm locale={locale} date={facts.date} onResult={onPersonal} />}
      {stemOrder().map((stem) => {
        const tenGod = tenGodFor(stem, facts.stem)
        const tip = tenGodTip(rules, tenGod, facts.date)
        const mine = personal && personal.natal.dayMaster === stem ? personal.facts : null
        return (
          <div
            key={stem}
            role="tabpanel"
            id={`${baseId}-panel-${stem}`}
            aria-labelledby={`${baseId}-tab-${stem}`}
            hidden={stem !== selected}
            className="flex flex-col gap-4"
            data-stem={stem}
          >
            <h3 className="m-0 font-medium text-body text-ink">
              {m.daily_master_heading({ master: stemWithElement(locale, stem) })}
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className={card}>
                <span className={cardLabel}>{m.daily_card_stem()}</span>
                <strong className={cardValue}>{TEN_GOD_LABEL[tenGod]()}</strong>
                <span className="text-caption text-ink-subtle">{rules.tenGodKeyword[tenGod]}</span>
              </div>
              <div className={card}>
                <span className={cardLabel}>{m.daily_card_branch()}</span>
                <strong className={cardValue}>{branchWithElement(locale, facts.branch)}</strong>
                <span className="text-caption text-ink-subtle">
                  {mine
                    ? mine.relations.length > 0
                      ? mine.relations
                          .map((relation) => relationLabel(rules, facts.branch, relation))
                          .join('、')
                      : m.daily_no_relation()
                    : m.daily_branch_hint()}
                </span>
              </div>
              <div className={card}>
                <span className={cardLabel}>{m.daily_card_tip()}</span>
                <p className="m-0 text-body text-ink">{tip.theme}</p>
              </div>
            </div>
            <dl className="m-0 flex flex-col gap-2 text-body">
              <Row term={m.daily_tip_advice()} termClass="text-ink">
                <span className="text-ink-muted">{tip.advice}</span>
              </Row>
              <Row term={m.daily_tip_caution()} termClass="text-ink">
                <span className="text-ink-muted">{tip.caution}</span>
              </Row>
            </dl>
            {mine && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="daily-relations">
                {relationLines(rules, mine.relations, facts.date).map((line) => (
                  <li
                    key={line}
                    className="rounded-field bg-surface-2 px-4 py-3 text-body text-ink"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      {/* 不知道日主的访客先去排盘：本页唯一指向主工具的正文链接 */}
      <p role="note" className="m-0 text-caption text-ink-subtle">
        {m.daily_master_hint_before()}
        <a href={mainToolHref(locale)} className={bodyLink}>
          {m.daily_more_chart()}
        </a>
        {m.daily_master_hint_after()}
      </p>
      {/* 设计稿中这一句是说明文字，不放链接：登录入口在页头 */}
      <p role="note" className="m-0 text-caption text-ink-subtle">
        {m.daily_profile_cta()}
      </p>
    </section>
  )
}

/** 本地个人化：出生日期（与可选时间）只在浏览器中排盘，不发送到服务器 */
function PersonalForm({
  locale,
  date,
  onResult,
}: {
  locale: EastV1Locale
  date: string
  onResult: (personal: Personal) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const errorId = useId()
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const birth = parseDateKey(String(form.get('birthDate') ?? ''))
    const timeText = String(form.get('birthTime') ?? '')
    const time = /^(\d{2}):(\d{2})$/.exec(timeText)
    const today = parseDateKey(date)
    if (!birth || !today) {
      setError(m.daily_form_invalid())
      return
    }
    // 时间可不填；填了但不完整（如只填时）时提示，避免静默按无时辰排盘
    if (timeText && !time) {
      setError(m.date_field_time_invalid())
      return
    }
    setBusy(true)
    setError(null)
    try {
      const bazi = await loadBazi()
      // 日主与四支不受性别影响；出生地按页面语言取默认城市，只用于时辰换算
      const chart = bazi.computeChart(
        {
          calendar: 'solar',
          year: birth.year,
          month: birth.month,
          day: birth.day,
          time: time ? { hour: Number(time[1]), minute: Number(time[2]) } : null,
          gender: 'female',
          location: { city: defaultPlace(locale) },
          trueSolarTime: false,
        },
        { referenceYear: today.year },
      )
      const natal: NatalSummary = {
        dayMaster: chart.dayMaster,
        branches: {
          year: chart.pillars.year.branch,
          month: chart.pillars.month.branch,
          day: chart.pillars.day.branch,
          ...(chart.pillars.hour ? { hour: chart.pillars.hour.branch } : {}),
        },
      }
      onResult({ natal, facts: eastPersonalFacts(bazi, natal, today), date })
    } catch {
      setError(m.daily_form_invalid())
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      aria-label={m.daily_form_label()}
      method="post"
      onSubmit={(event) => void submit(event)}
      className="grid gap-4 rounded-field bg-surface-2 p-4 sm:grid-cols-3 sm:items-end"
    >
      <DateField
        label={m.daily_form_date()}
        name="birthDate"
        required
        invalid={Boolean(error)}
        describedBy={errorId}
      />
      <TimeField label={m.daily_form_time()} name="birthTime" />
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy || undefined}
        className="min-h-11 rounded-full bg-brand px-5 font-medium text-body text-on-brand focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3 disabled:opacity-70"
      >
        {m.daily_form_submit()}
      </button>
      <p id={errorId} className="m-0 text-caption text-danger empty:hidden sm:col-span-3">
        {error}
      </p>
    </form>
  )
}
