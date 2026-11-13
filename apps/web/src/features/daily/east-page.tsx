import type { Stem } from '@xuanxue/bazi'
import { cn } from '@xuanxue/ui'
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { loadBazi } from '../tools/bazi/engine.ts'
import { TEN_GOD_LABEL } from '../tools/bazi/labels.ts'
import { Disclaimer } from '../tools/disclaimer.tsx'
import { tarotPath } from '../tools/tarot/routes.ts'
import { toolHref } from '../tools/tool-href.ts'
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
import {
  browserDate,
  type CivilDate,
  dateKey,
  formatLongDate,
  parseDateKey,
  sameDate,
} from './date.ts'
import {
  type EastDayFacts,
  type EastPersonalFacts,
  eastDayFacts,
  eastPersonalFacts,
  type NatalSummary,
  tenGodFor,
} from './facts.ts'
import type { EastRules } from './rules/types.ts'

/** 流日引擎按需加载：tyme4ts 较大，不进首屏包（design D8） */
export const loadDailyEngine = () => import('@xuanxue/bazi/daily')

export interface EastDailyData {
  /** 参考日期（`YYYY-MM-DD`） */
  readonly date: string
  readonly facts: EastDayFacts
}

/** 页面 loader：只由日期与规则表计算，不访问数据库与会话（daily-horoscope spec「公开页不查库且可缓存」） */
export async function loadEastDaily(date: CivilDate): Promise<EastDailyData> {
  const engine = await loadDailyEngine()
  return { date: dateKey(date), facts: eastDayFacts(engine, date) }
}

/** 东方站页面标题用的「甲子日」 */
export function eastHeading(locale: string, facts: EastDayFacts): string {
  return m.daily_east_h1({ ganzhi: ganzhiText(locale, facts.stem, facts.branch) })
}

type Personal = { natal: NatalSummary; facts: EastPersonalFacts; date: string }

const card = 'flex flex-col gap-1 rounded-xl bg-surface-2 p-4'
const cardLabel = 'text-ink-subtle text-sm'

/**
 * 东方站公开每日运势页（原型 DailyPublic.dc.html）：今日干支、宜忌与建除，十个日主的今日提示，
 * 以及在浏览器本地计算的个人化入口。服务端输出参考日期的全部规则内容；水合后若访客本地日期不同，
 * 在本地重算并替换日期相关的区块，不发网络请求（引擎 chunk 除外）。
 */
export function EastDailyPage({
  locale,
  rules,
  data,
}: {
  locale: 'zh-Hant' | 'zh-Hans' | 'ko'
  rules: EastRules
  data: EastDailyData
}) {
  const [facts, setFacts] = useState(data.facts)
  const [localDate, setLocalDate] = useState<CivilDate | null>(null)
  const [selected, setSelected] = useState<Stem>('jia')
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-10 pb-16 sm:px-6">
      <section aria-labelledby="daily-h1" className="flex flex-wrap items-center gap-8">
        <div className="flex gap-2">
          <div className="flex h-30 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-2 px-2 text-center">
            <span className="text-ink-subtle text-xs">{m.daily_lunar_label()}</span>
            <span className="font-heading text-ink text-lg leading-snug">
              {lunarText(locale, facts.lunar)}
            </span>
          </div>
          <div className="flex h-38 w-30 flex-col items-center justify-center rounded-xl bg-inverse text-on-inverse">
            <span className="text-xs">{m.daily_today_label()}</span>
            <span className="font-heading text-5xl leading-tight">
              {stemText(locale, facts.stem)}
            </span>
            <span className="font-heading text-5xl leading-tight">
              {branchText(locale, facts.branch)}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 basis-96 flex-col gap-4">
          <p className="m-0 text-ink-subtle text-sm" data-testid="daily-date">
            {formatLongDate(date, locale)} ·{' '}
            {localDate ? m.daily_local_note() : m.daily_reference_note()}
          </p>
          <h1 id="daily-h1" className="m-0 font-bold font-heading text-4xl text-ink">
            {m.daily_east_h1({ ganzhi: ganzhiText(locale, facts.stem, facts.branch) })}
          </h1>
          <dl className="m-0 flex flex-col gap-2 text-base">
            <Row term={m.daily_yi()} termClass="text-brand-ink">
              {recommends.join(m.daily_list_separator()) || '—'}
            </Row>
            <Row term={m.daily_ji()}>{avoids.join(m.daily_list_separator()) || '—'}</Row>
            <Row term={m.daily_duty()}>
              {m.daily_duty_value({ name: duty.name })}
              {duty.gloss}
            </Row>
          </dl>
          {glosses.length > 0 && (
            <details className="text-ink-muted text-sm">
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
        </div>
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

      <section aria-labelledby="daily-more" className="grid gap-4 sm:grid-cols-3">
        <h2 id="daily-more" className="m-0 font-semibold text-ink text-lg sm:col-span-3">
          {m.daily_more_title()}
        </h2>
        <MoreLink
          href={toolHref('/', locale)}
          title={m.daily_more_chart()}
          body={m.daily_more_chart_body()}
        />
        <MoreLink
          href={toolHref(tarotPath('daily', locale), locale)}
          title={m.daily_more_tarot()}
          body={m.daily_more_tarot_body()}
        />
        <MoreLink
          href={toolHref('/pricing', locale)}
          title={m.daily_more_reading()}
          body={m.daily_more_reading_body()}
        />
      </section>

      <div className="flex flex-col gap-3">
        <Disclaimer />
        <p className="m-0 text-ink-subtle text-xs leading-relaxed">
          {m.daily_rules_note({ version: facts.rulesVersion })}
        </p>
      </div>
    </div>
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
      <dt className={cn('w-12 shrink-0 font-bold', termClass)}>{term}</dt>
      <dd className="m-0 min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  )
}

function MoreLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <a
      href={href}
      className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-5 text-ink no-underline transition-colors hover:border-line-strong"
    >
      <strong>{title}</strong>
      <span className="text-ink-muted text-sm">{body}</span>
    </a>
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
  locale: 'zh-Hant' | 'zh-Hans' | 'ko'
  rules: EastRules
  facts: EastDayFacts
  selected: Stem
  onSelect: (stem: Stem) => void
  personal: Personal | null
  onPersonal: (personal: Personal) => void
}) {
  const baseId = useId()
  const [formOpen, setFormOpen] = useState(false)
  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id={`${baseId}-title`} className="m-0 font-bold font-heading text-2xl text-ink">
          {m.daily_mine_title()}
        </h2>
        <span className="text-ink-subtle text-sm">{m.daily_mine_privacy()}</span>
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
                'size-13 rounded-lg border font-heading text-xl transition-colors',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line-strong bg-transparent text-ink hover:bg-surface-2',
              )}
            >
              {stemText(locale, stem)}
            </button>
          )
        })}
        <button
          type="button"
          aria-expanded={formOpen}
          onClick={() => setFormOpen((open) => !open)}
          className="min-h-13 rounded-lg border border-line-strong border-dashed bg-transparent px-4 text-ink text-sm"
        >
          {m.daily_unknown_master()}
        </button>
      </div>
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
            <h3 className="m-0 font-semibold text-base text-ink">
              {m.daily_master_heading({ master: stemWithElement(locale, stem) })}
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className={card}>
                <span className={cardLabel}>{m.daily_card_stem()}</span>
                <strong className="text-2xl text-ink">{TEN_GOD_LABEL[tenGod]()}</strong>
                <span className="text-ink-muted text-sm">{rules.tenGodKeyword[tenGod]}</span>
              </div>
              <div className={card}>
                <span className={cardLabel}>{m.daily_card_branch()}</span>
                <strong className="text-2xl text-ink">
                  {branchWithElement(locale, facts.branch)}
                </strong>
                <span className="text-ink-muted text-sm">
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
                <p className="m-0 text-base text-ink leading-relaxed">{tip.theme}</p>
              </div>
            </div>
            <dl className="m-0 flex flex-col gap-2 text-base leading-relaxed">
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
                  <li key={line} className="rounded-lg bg-surface-2 px-4 py-3 text-ink">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      <p className="m-0 text-ink-muted text-sm">
        {m.daily_profile_cta()}{' '}
        <a href="/app" className="font-semibold text-brand-ink">
          {m.daily_profile_cta_link()}
        </a>
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
  locale: 'zh-Hant' | 'zh-Hans' | 'ko'
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
    const time = /^(\d{2}):(\d{2})$/.exec(String(form.get('birthTime') ?? ''))
    const today = parseDateKey(date)
    if (!birth || !today) {
      setError(m.daily_form_invalid())
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
          location: { city: locale === 'ko' ? 'seoul' : 'taipei' },
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
      className="grid gap-4 rounded-xl border border-line bg-surface-2 p-4 sm:grid-cols-3 sm:items-end"
    >
      <label className="flex flex-col gap-1.5 text-ink-muted text-sm">
        {m.daily_form_date()}
        <input
          name="birthDate"
          type="date"
          required
          min="1900-01-01"
          max="2100-12-31"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-ink-muted text-sm">
        {m.daily_form_time()}
        <input
          name="birthTime"
          type="time"
          className="min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        aria-busy={busy || undefined}
        className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-on-brand disabled:opacity-70"
      >
        {m.daily_form_submit()}
      </button>
      <p id={errorId} className="m-0 text-brand-ink text-sm empty:hidden sm:col-span-3">
        {error}
      </p>
    </form>
  )
}
