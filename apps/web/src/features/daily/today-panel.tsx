import { useNavigate } from '@tanstack/react-router'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@xuanxue/ui'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { BRANCH_HANZI, STEM_HANZI } from '../tools/bazi/glyphs.ts'
import { TEN_GOD_LABEL } from '../tools/bazi/labels.ts'
import { toolHref } from '../tools/tool-href.ts'
import { ganzhiText, stemWithElement } from './copy.ts'
import { browserDate, dateKey, formatShortDate, parseDateKey, sameDate } from './date.ts'
import { eastDayFacts, eastPersonalFacts, westDayFacts, westPersonalFacts } from './facts.ts'
import { dailyPath } from './routes.ts'
import { createDailyChatLink } from './today.functions.ts'
import {
  eastPanelCopy,
  loadEastRules,
  loadWestRules,
  type MissingField,
  type TodayPanelData,
  type TodayProfileOption,
  westPanelCopy,
} from './today.ts'
import { PersonalNumbers } from './west-page.tsx'

type OkPanel = Extract<TodayPanelData, { state: 'ok' }>

const RELATION_LABEL: Record<string, () => string> = {
  self: m.daily_relation_self,
  partner: m.daily_relation_partner,
  family: m.daily_relation_family,
  friend: m.daily_relation_friend,
  other: m.daily_relation_other,
}

const FIELD_LABEL: Record<MissingField, () => string> = {
  gender: m.daily_panel_field_gender,
  location: m.daily_panel_field_location,
  time: m.daily_panel_field_time,
  birthDate: m.daily_panel_field_birthDate,
}

export function profileName(profile: TodayProfileOption): string {
  return profile.label ?? RELATION_LABEL[profile.relation]?.() ?? profile.relation
}

const shell = 'flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-6'
const card = 'flex flex-col gap-1 rounded-xl bg-surface-2 p-3.5'
const primaryAction =
  'inline-flex min-h-11 items-center rounded-lg bg-brand px-4.5 font-semibold text-on-brand no-underline transition-opacity hover:opacity-90 disabled:opacity-70'
const secondaryAction =
  'inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4.5 text-ink no-underline transition-colors hover:bg-surface-2'

/**
 * 工作台首页的今日面板（原型 TodayPanel.dc.html；空、加载状态见 States.dc.html）：
 * 有档案时按选中档案显示今日运势，可切换档案；没有档案时引导建立；缺少字段时提示补全。
 * 服务端按参考时区计算；水合后若浏览器本地日期不同，在本地重算（期间显示固定高度骨架）。
 */
export function TodayPanel({
  data,
  slug,
  chatAvailable,
}: {
  data: TodayPanelData | null
  slug: string
  chatAvailable: boolean
}) {
  const [panel, setPanel] = useState(data)
  const [recomputing, setRecomputing] = useState(false)
  useEffect(() => setPanel(data), [data])

  // 「今日」按用户浏览器所在时区（spec「今日面板的今日按用户本地日期」）
  useEffect(() => {
    if (data?.state !== 'ok') return
    const local = browserDate()
    const reference = parseDateKey(data.date)
    if (!reference || sameDate(local, reference)) return
    let active = true
    setRecomputing(true)
    void recompute(data, local)
      .then(
        (next) => {
          if (active) setPanel(next)
        },
        () => {
          // 重算失败时保留参考日期的内容
        },
      )
      .finally(() => {
        if (active) setRecomputing(false)
      })
    return () => {
      active = false
    }
  }, [data])

  if (!panel) return null
  const profilesHref = `/app/${slug}/profiles`
  if (recomputing) return <PanelSkeleton />
  if (panel.state === 'empty')
    return (
      <section aria-labelledby="today-empty" className={`${shell} items-center text-center`}>
        <EmptyIcon />
        <h2 id="today-empty" className="m-0 font-semibold text-ink text-lg">
          {m.daily_panel_empty_title()}
        </h2>
        <p className="m-0 text-ink-muted text-sm leading-relaxed">{m.daily_panel_empty_body()}</p>
        <a href={profilesHref} className={primaryAction}>
          {m.daily_panel_empty_cta()}
        </a>
      </section>
    )
  if (panel.state === 'missing')
    return (
      <section aria-labelledby="today-missing" className={shell}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="today-missing" className="m-0 font-semibold text-ink text-lg">
            {m.daily_panel_missing_title()}
          </h2>
          <ProfileSwitcher profiles={panel.profiles} selectedId={panel.selectedId} />
        </div>
        <p className="m-0 text-ink-muted text-sm leading-relaxed">
          {m.daily_panel_missing_body({
            fields: panel.missing
              .map((field) => FIELD_LABEL[field]())
              .join(m.daily_list_separator()),
          })}
        </p>
        <a href={profilesHref} className={`${primaryAction} self-start`}>
          {m.daily_panel_missing_cta()}
        </a>
      </section>
    )
  return <OkPanelView panel={panel} slug={slug} chatAvailable={chatAvailable} />
}

async function recompute(data: OkPanel, local: ReturnType<typeof browserDate>): Promise<OkPanel> {
  const date = dateKey(local)
  if (data.site === 'west') {
    const personal = westPersonalFacts(data.birth, local)
    const rules = await loadWestRules()
    return {
      ...data,
      date,
      day: westDayFacts(local),
      personal,
      copy: westPanelCopy(rules, personal, date),
    }
  }
  const [engine, rules] = await Promise.all([
    import('@xuanxue/bazi/daily'),
    loadEastRules(data.locale),
  ])
  const day = eastDayFacts(engine, local)
  const personal = eastPersonalFacts(engine, data.natal, local)
  return { ...data, date, day, personal, copy: eastPanelCopy(rules, day, personal) }
}

function OkPanelView({
  panel,
  slug,
  chatAvailable,
}: {
  panel: OkPanel
  slug: string
  chatAvailable: boolean
}) {
  const titleId = useId()
  const date = parseDateKey(panel.date)
  const shortDate = date ? formatShortDate(date, panel.locale) : panel.date
  const selected = panel.profiles.find((profile) => profile.id === panel.selectedId)
  const publicPath = dailyPath(panel.locale)
  return (
    <section aria-labelledby={titleId} className={shell} data-testid="today-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="m-0 font-bold font-heading text-ink text-xl">
          {panel.site === 'east'
            ? m.daily_panel_title_east({
                date: shortDate,
                ganzhi: ganzhiText(panel.locale, panel.day.stem, panel.day.branch),
              })
            : m.daily_panel_title({ date: shortDate })}
        </h2>
        <ProfileSwitcher
          profiles={panel.profiles}
          selectedId={panel.selectedId}
          master={
            panel.site === 'east' ? stemWithElement(panel.locale, panel.natal.dayMaster) : undefined
          }
        />
      </div>
      {panel.site === 'east' ? (
        <EastBody panel={panel} />
      ) : (
        <div className="flex flex-col gap-3">
          <PersonalNumbers result={panel.personal} />
          <p className="m-0 text-ink leading-relaxed">
            <strong>
              {m.daily_west_number_heading({
                value: String(panel.personal.personalDay.value),
                keyword: panel.copy.keyword,
              })}
            </strong>{' '}
            {panel.copy.tip.theme}
          </p>
          <p className="m-0 text-ink-muted leading-relaxed">
            {panel.copy.tip.advice} {panel.copy.tip.caution}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {chatAvailable && <AskAi slug={slug} profileId={selected?.id} date={panel.date} />}
        <a href={panel.toolHref} className={secondaryAction}>
          {panel.site === 'east' ? m.daily_panel_open_tool() : m.daily_panel_open_tool_west()}
        </a>
        {publicPath && (
          <a href={toolHref(publicPath, panel.locale)} className={secondaryAction}>
            {m.daily_panel_public()}
          </a>
        )}
      </div>
      <p className="m-0 text-ink-subtle text-xs">{m.daily_panel_disclaimer()}</p>
    </section>
  )
}

function EastBody({ panel }: { panel: Extract<OkPanel, { site: 'east' }> }) {
  const { day, personal, copy, background } = panel
  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex w-22 flex-none flex-col items-center justify-center rounded-xl bg-inverse py-3 font-heading text-4xl text-on-inverse leading-tight">
          <span>{STEM_HANZI[day.stem]}</span>
          <span>{BRANCH_HANZI[day.branch]}</span>
        </div>
        <dl className="m-0 grid min-w-0 flex-1 basis-72 gap-3 sm:grid-cols-3">
          <Card term={m.daily_card_stem()}>
            <span className="font-bold text-ink text-xl">{TEN_GOD_LABEL[personal.tenGod]()}</span>
          </Card>
          <Card term={m.daily_panel_card_relation()}>
            <span className="font-bold text-ink text-xl">
              {copy.relationLabels.length > 0
                ? copy.relationLabels.join(m.daily_list_separator())
                : m.daily_no_relation()}
            </span>
          </Card>
          <Card term={m.daily_panel_card_yiji()}>
            <span className="text-base text-ink">
              {copy.recommends.join(m.daily_list_separator()) || '—'} /{' '}
              {copy.avoids.join(m.daily_list_separator()) || '—'}
            </span>
          </Card>
        </dl>
      </div>
      <div className="flex flex-col gap-1.5 text-ink-muted leading-relaxed">
        <p className="m-0">
          {copy.tip.theme}
          {copy.tip.advice}
        </p>
        {copy.relationLines.map((line) => (
          <p key={line} className="m-0">
            {line}
          </p>
        ))}
        {background && (
          <p className="m-0 text-ink-subtle text-sm">
            {background.decade
              ? m.daily_panel_luck({
                  decade: ganzhiText(
                    panel.locale,
                    background.decade.stem,
                    background.decade.branch,
                  ),
                  year: ganzhiText(panel.locale, background.year.stem, background.year.branch),
                })
              : m.daily_panel_luck_year({
                  year: ganzhiText(panel.locale, background.year.stem, background.year.branch),
                })}
          </p>
        )}
      </div>
    </>
  )
}

function Card({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={card}>
      <dt className="text-ink-subtle text-sm">{term}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  )
}

/** 切换档案：改写 `?profile=`，由路由 loader 重新计算 */
function ProfileSwitcher({
  profiles,
  selectedId,
  master,
}: {
  profiles: readonly TodayProfileOption[]
  selectedId: string
  master?: string | undefined
}) {
  const navigate = useNavigate()
  const selected = profiles.find((profile) => profile.id === selectedId)
  const label = selected
    ? master
      ? m.daily_panel_master({ name: profileName(selected), master })
      : profileName(selected)
    : ''
  return (
    <Select
      value={selectedId}
      onValueChange={(value) =>
        void navigate({ to: '.', search: (prev: object) => ({ ...prev, profile: value }) })
      }
    >
      <SelectTrigger
        aria-label={m.daily_panel_switch()}
        placeholder={m.daily_panel_switch()}
        className="min-h-10 w-auto"
        valueLabel={m.daily_panel_profile({ name: label })}
      />
      <SelectContent>
        {profiles.map((profile, index) => (
          <SelectItem key={profile.id} index={index} value={profile.id}>
            {profileName(profile)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** 「把今天带去问 AI」：服务端按档案复算后签发临时上下文，再跳转到对话页 */
function AskAi({
  slug,
  profileId,
  date,
}: {
  slug: string
  profileId: string | undefined
  date: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const noteId = useId()
  const open = async () => {
    setBusy(true)
    setError(false)
    try {
      const result = await createDailyChatLink({ data: { slug, profile: profileId, date } })
      if ('href' in result) window.location.assign(result.href)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-describedby={noteId}
        className={primaryAction}
      >
        {m.daily_panel_ask_ai()}
      </button>
      <span id={noteId} className="max-w-xs text-ink-subtle text-xs">
        {error ? m.daily_panel_ask_ai_failed() : m.daily_panel_ask_ai_note()}
      </span>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <section aria-busy="true" aria-label={m.daily_panel_loading()} className={`${shell} min-h-72`}>
      <div className="h-5 w-3/5 rounded-md bg-surface-2" />
      <div className="flex gap-3">
        <div className="h-20 w-16 rounded-xl bg-surface-2" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-3.5 rounded-md bg-surface-2" />
          <div className="h-3.5 w-4/5 rounded-md bg-surface-2" />
          <div className="h-3.5 w-1/2 rounded-md bg-surface-2" />
        </div>
      </div>
      <span className="text-ink-subtle text-sm">{m.daily_panel_loading()}</span>
    </section>
  )
}

function EmptyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="text-line-strong">
      <rect
        x="8"
        y="6"
        width="24"
        height="28"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 14h12M14 20h12M14 26h7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
