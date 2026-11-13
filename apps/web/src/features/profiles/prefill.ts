import type { BirthProfileBirth } from '@xuanxue/db'
import {
  type BirthFormValues,
  defaultBirthValues,
  OTHER_PLACE,
} from '../tools/bazi/birth-form-state.ts'

/**
 * 档案 → 工具表单的预填（add-birth-profiles-daily-horoscope design D2「档案按站点补全字段」）。
 * 与 schema.ts 分开：工具页只需要这个纯函数，不必把引擎校验打进首屏包。
 * 只填入档案里已有的字段；工具需要而档案没有的字段列入 `missing`，由表单提示补全，不猜测默认值。
 */

/** 需要出生资料的工具：八字类（八字、命盘查询、만세력、궁합）、紫微（必须有时辰）、数字命理。 */
export type ProfileTool = 'bazi' | 'ziwei' | 'numerology'

export type BirthPrefillField = 'gender' | 'location' | 'time'
export type NumerologyPrefillField = 'birthDate'

export interface BirthPrefill {
  readonly values: Partial<BirthFormValues>
  readonly missing: BirthPrefillField[]
}
export interface NumerologyPrefill {
  readonly values: { readonly birthDate?: string; readonly name?: string }
  readonly missing: NumerologyPrefillField[]
}

type ProfileSource = { readonly birth: BirthProfileBirth; readonly fullName: string | null }

const pad = (value: number, length: number) => String(value).padStart(length, '0')

function birthValues(birth: BirthProfileBirth): Partial<BirthFormValues> {
  const values: Record<string, string | boolean> = {
    calendar: birth.calendar,
    leap: birth.calendar === 'lunar' && birth.isLeapMonth === true,
    year: String(birth.year),
    month: String(birth.month),
    day: String(birth.day),
    time: birth.time ? `${pad(birth.time.hour, 2)}:${pad(birth.time.minute, 2)}` : '',
    unknownTime: birth.time === null,
  }
  if (birth.gender) values.gender = birth.gender
  if (birth.location) {
    if ('city' in birth.location) {
      values.place = birth.location.city
    } else {
      values.place = OTHER_PLACE
      values.utcOffset = String(birth.location.utcOffsetMinutes)
      values.longitude =
        birth.location.longitude === undefined ? '' : String(birth.location.longitude)
    }
    values.trueSolar = birth.trueSolarTime === true
  }
  return values as Partial<BirthFormValues>
}

export function profileFor(tool: 'bazi' | 'ziwei', profile: ProfileSource): BirthPrefill
export function profileFor(tool: 'numerology', profile: ProfileSource): NumerologyPrefill
export function profileFor(
  tool: ProfileTool,
  profile: ProfileSource,
): BirthPrefill | NumerologyPrefill {
  const { birth } = profile
  if (tool === 'numerology') {
    // 数字命理只用公历日期；农历档案（东方站）不换算，提示补填公历日期
    const birthDate =
      birth.calendar === 'solar'
        ? `${pad(birth.year, 4)}-${pad(birth.month, 2)}-${pad(birth.day, 2)}`
        : undefined
    return {
      values: {
        ...(birthDate ? { birthDate } : {}),
        ...(profile.fullName ? { name: profile.fullName } : {}),
      },
      missing: birthDate ? [] : ['birthDate'],
    }
  }
  const missing: BirthPrefillField[] = []
  if (birth.gender === null) missing.push('gender')
  if (birth.location === null) missing.push('location')
  if (tool === 'ziwei' && birth.time === null) missing.push('time')
  return { values: birthValues(birth), missing }
}

/** 档案 → 东方站完整表单值（档案页「排盘」链接、编辑表单与详批预填共用）；缺失字段沿用默认值 */
export function formValuesOf(profile: ProfileSource | undefined, locale: string): BirthFormValues {
  const defaults = defaultBirthValues(locale)
  return profile ? { ...defaults, ...profileFor('bazi', profile).values } : defaults
}
