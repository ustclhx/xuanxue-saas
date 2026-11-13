import { type BirthInput, computeChart, dailyRelations, dayPillarOf } from '@xuanxue/bazi'
import type { SiteId } from '@xuanxue/config'
import { profileFor } from '../profiles/prefill.ts'
import type { BirthProfile } from '../profiles/schema.ts'
import { listProfiles, type ProfileContext } from '../profiles/service.ts'
import { defaultBirthValues, toShareInput } from '../tools/bazi/birth-form-state.ts'
import { encodeShareInput, SHARE_PARAM } from '../tools/share.ts'
import { toolHref } from '../tools/tool-href.ts'
import { type CivilDate, type DailyLocale, dateKey } from './date.ts'
import {
  eastDayFacts,
  eastPersonalFacts,
  type LuckBackground,
  type NatalSummary,
  westDayFacts,
  westPersonalFacts,
} from './facts.ts'
import {
  eastPanelCopy,
  loadEastRules,
  loadWestRules,
  type MissingField,
  type TodayPanelData,
  type TodayProfileOption,
  westPanelCopy,
} from './today.ts'

/**
 * 今日面板的服务端计算（design D10）：只在个人空间调用；一次索引查询取出该用户的档案（≤ 20 行），
 * 选中 `?profile=` 指定的档案，没有或不属于当前用户时按不存在处理、改用默认档案。
 * 出生资料只在服务端用于计算，返回给页面的是推导结果与工具链接（`#r=` 片段不含姓名）。
 */

const engine = { dayPillarOf, dailyRelations }

function option(profile: BirthProfile): TodayProfileOption {
  return {
    id: profile.id,
    label: profile.label,
    relation: profile.relation,
    isDefault: profile.isDefault,
  }
}

/** 东方站：档案 → 引擎输入；性别或出生地缺失时返回 null（面板提示补全） */
export function eastBirthInput(profile: BirthProfile): BirthInput | null {
  const { birth } = profile
  if (birth.gender === null || birth.location === null) return null
  return { ...birth, gender: birth.gender, location: birth.location } as BirthInput
}

export function natalOf(input: BirthInput, referenceYear: number) {
  const chart = computeChart(input, { referenceYear })
  const natal: NatalSummary = {
    dayMaster: chart.dayMaster,
    branches: {
      year: chart.pillars.year.branch,
      month: chart.pillars.month.branch,
      day: chart.pillars.day.branch,
      ...(chart.pillars.hour ? { hour: chart.pillars.hour.branch } : {}),
    },
  }
  const decade = chart.fortune.decades.find(
    (item) => item.startYear <= referenceYear && referenceYear <= item.endYear,
  )
  const background: LuckBackground = {
    decade: decade ? { stem: decade.stem, branch: decade.branch, tenGod: decade.tenGod } : null,
    year: {
      stem: chart.currentYear.stem,
      branch: chart.currentYear.branch,
      tenGod: chart.currentYear.tenGod,
    },
  }
  return { natal, background }
}

/** 选中的档案：指定 id（属于当前用户）→ 默认档案 → 最近更新的一份 */
export function selectProfile(
  profiles: readonly BirthProfile[],
  requested: string | undefined,
): BirthProfile | undefined {
  return (
    (requested ? profiles.find((profile) => profile.id === requested) : undefined) ??
    profiles.find((profile) => profile.isDefault) ??
    profiles[0]
  )
}

export async function computeTodayPanel(
  profiles: readonly BirthProfile[],
  input: { site: SiteId; locale: DailyLocale; date: CivilDate; profileId?: string | undefined },
): Promise<TodayPanelData> {
  const date = dateKey(input.date)
  const selected = selectProfile(profiles, input.profileId)
  if (!selected) return { state: 'empty', date }
  const options = profiles.map(option)
  if (input.site === 'east') {
    const prefill = profileFor('bazi', selected)
    const birthInput = eastBirthInput(selected)
    if (!birthInput || prefill.missing.length > 0)
      return {
        state: 'missing',
        date,
        profiles: options,
        selectedId: selected.id,
        missing: prefill.missing as MissingField[],
      }
    const { natal, background } = natalOf(birthInput, input.date.year)
    const day = eastDayFacts(engine, input.date)
    const personal = eastPersonalFacts(engine, natal, input.date)
    const rules = await loadEastRules(input.locale)
    const values = { ...defaultBirthValues(input.locale), ...prefill.values }
    return {
      state: 'ok',
      site: 'east',
      locale: input.locale,
      date,
      profiles: options,
      selectedId: selected.id,
      natal,
      day,
      personal,
      background,
      copy: eastPanelCopy(rules, day, personal),
      toolHref: `${toolHref('/', input.locale)}#${SHARE_PARAM}=${encodeShareInput(toShareInput(values))}`,
    }
  }
  const prefill = profileFor('numerology', selected)
  const birthDate = prefill.values.birthDate
  if (!birthDate)
    return {
      state: 'missing',
      date,
      profiles: options,
      selectedId: selected.id,
      missing: prefill.missing,
    }
  const birth = { year: selected.birth.year, month: selected.birth.month, day: selected.birth.day }
  const personal = westPersonalFacts(birth, input.date)
  const rules = await loadWestRules()
  return {
    state: 'ok',
    site: 'west',
    locale: input.locale,
    date,
    profiles: options,
    selectedId: selected.id,
    birth,
    day: westDayFacts(input.date),
    personal,
    copy: westPanelCopy(rules, personal, date),
    // 数字命理工具只读取日期；姓名不进分享片段
    toolHref: `${toolHref('/numerology-calculator', input.locale)}#${SHARE_PARAM}=${encodeShareInput({ date: birthDate })}`,
  }
}

/** 读取当前用户的档案（一次查询）并计算面板 */
export async function loadTodayPanel(
  ctx: ProfileContext,
  input: { site: SiteId; locale: DailyLocale; date: CivilDate; profileId?: string | undefined },
): Promise<TodayPanelData> {
  return computeTodayPanel(await listProfiles(ctx), input)
}
