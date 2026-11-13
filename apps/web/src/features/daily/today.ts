import type { BirthDate } from '@xuanxue/numerology'
import {
  dailyNumber,
  personalTip,
  relationLabel,
  relationLines,
  tabooNames,
  tenGodTip,
} from './copy.ts'
import type { DailyLocale } from './date.ts'
import type {
  EastDayFacts,
  EastPersonalFacts,
  LuckBackground,
  NatalSummary,
  WestDayFacts,
  WestPersonalFacts,
} from './facts.ts'
import type { DailyTip, EastRules, WestRules } from './rules/types.ts'

/**
 * 今日面板的数据形状（add-birth-profiles-daily-horoscope design D10）：服务端 loader 与浏览器
 * 本地重算共用。只含推导结果与按语言选好的规则文案；出生资料只保留重算所需的最小部分
 * （东方站为日主与四支，西方站为出生日期）。
 */

export type TodayProfileOption = {
  readonly id: string
  readonly label: string | null
  readonly relation: string
  readonly isDefault: boolean
}

export type MissingField = 'gender' | 'location' | 'time' | 'birthDate'

export interface EastPanelCopy {
  readonly tip: DailyTip
  readonly keyword: string
  readonly relationLabels: readonly string[]
  readonly relationLines: readonly string[]
  readonly recommends: readonly string[]
  readonly avoids: readonly string[]
}

export interface WestPanelCopy {
  readonly tip: DailyTip
  readonly keyword: string
}

export type TodayPanelData =
  | { readonly state: 'empty'; readonly date: string }
  | {
      readonly state: 'missing'
      readonly date: string
      readonly profiles: readonly TodayProfileOption[]
      readonly selectedId: string
      readonly missing: readonly MissingField[]
    }
  | {
      readonly state: 'ok'
      readonly site: 'east'
      readonly locale: DailyLocale
      readonly date: string
      readonly profiles: readonly TodayProfileOption[]
      readonly selectedId: string
      readonly natal: NatalSummary
      readonly day: EastDayFacts
      readonly personal: EastPersonalFacts
      readonly background: LuckBackground | null
      readonly copy: EastPanelCopy
      /** 「用此档案打开工具」：工具页地址 + `#r=` 片段（不含姓名） */
      readonly toolHref: string
    }
  | {
      readonly state: 'ok'
      readonly site: 'west'
      readonly locale: DailyLocale
      readonly date: string
      readonly profiles: readonly TodayProfileOption[]
      readonly selectedId: string
      readonly birth: BirthDate
      readonly day: WestDayFacts
      readonly personal: WestPersonalFacts
      readonly copy: WestPanelCopy
      readonly toolHref: string
    }

/** 东方站面板文案：十神提示、地支关系与当日宜忌（面板只列前几项） */
export function eastPanelCopy(
  rules: EastRules,
  day: EastDayFacts,
  personal: EastPersonalFacts,
): EastPanelCopy {
  return {
    tip: tenGodTip(rules, personal.tenGod, day.date),
    keyword: rules.tenGodKeyword[personal.tenGod],
    relationLabels: personal.relations.map((relation) =>
      relationLabel(rules, day.branch, relation),
    ),
    relationLines: relationLines(rules, personal.relations, day.date),
    recommends: tabooNames(rules, day.recommends, 3),
    avoids: tabooNames(rules, day.avoids, 2),
  }
}

export function westPanelCopy(
  rules: WestRules,
  personal: WestPersonalFacts,
  date: string,
): WestPanelCopy {
  const value = personal.personalDay.value
  return { tip: personalTip(rules, value, date), keyword: rules.number[dailyNumber(value)].keyword }
}

/** 规则文案表按语言按需加载（面板只需要当前语言的一份） */
export async function loadEastRules(locale: string): Promise<EastRules> {
  if (locale === 'zh-Hans') return (await import('./rules/zh-Hans.ts')).ZH_HANS_RULES
  if (locale === 'ko') return (await import('./rules/ko.ts')).KO_RULES
  return (await import('./rules/zh-Hant.ts')).ZH_HANT_RULES
}

export async function loadWestRules(): Promise<WestRules> {
  return (await import('./rules/en.ts')).EN_RULES
}
