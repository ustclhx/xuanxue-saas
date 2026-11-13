import type { CityId } from '@xuanxue/bazi'
import type { BirthProfileBirth, BirthProfileRelation } from '@xuanxue/db'
import { m } from '../../paraglide/messages.js'
import { formatUtcOffset } from '../tools/bazi/birth-form-state.ts'
import { CITY_LABEL, issueMessage } from '../tools/bazi/labels.ts'
import type { ProfileFailureCode } from './profiles.functions.ts'
import type { ProfileIssue } from './schema.ts'

/**
 * 档案页与工具页共用的展示文案：关系、显示名、出生摘要与错误提示。
 * 只引用文案与类型（@xuanxue/db 仅取类型），不把引擎或数据库代码带进页面。
 */

export const MAX_PROFILES = 20

export const RELATION_LABEL: Record<BirthProfileRelation, () => string> = {
  self: m.profiles_relation_self,
  partner: m.profiles_relation_partner,
  family: m.profiles_relation_family,
  friend: m.profiles_relation_friend,
  other: m.profiles_relation_other,
}

/** 没有填显示名时用关系代替（如「本人」） */
export function profileName(profile: {
  readonly label: string | null
  readonly relation: BirthProfileRelation
}): string {
  return profile.label ?? RELATION_LABEL[profile.relation]()
}

const pad = (value: number) => String(value).padStart(2, '0')

/** 列表与选择器里的出生日期：国历 `1990-05-15`，农历加前缀与闰月标记 */
export function birthDateText(birth: BirthProfileBirth): string {
  if (birth.calendar === 'solar') return `${birth.year}-${pad(birth.month)}-${pad(birth.day)}`
  const leap = birth.isLeapMonth ? m.profiles_leap_prefix() : ''
  return `${m.profiles_lunar_prefix()} ${birth.year}-${leap}${pad(birth.month)}-${pad(birth.day)}`
}

/** 列表的「出生」列：日期、时间（或时辰不详）与出生地；西方站只有日期 */
export function birthSummary(birth: BirthProfileBirth): string {
  const parts = [birthDateText(birth)]
  if (birth.time) parts.push(`${pad(birth.time.hour)}:${pad(birth.time.minute)}`)
  else if (birth.gender !== null || birth.location !== null) parts.push(m.profiles_time_unknown())
  if (birth.location) {
    parts.push(
      'city' in birth.location
        ? (CITY_LABEL[birth.location.city as CityId]?.() ?? '')
        : formatUtcOffset(birth.location.utcOffsetMinutes),
    )
  }
  return parts.filter(Boolean).join(' ')
}

/** 字段级错误：引擎规则沿用排盘页的文案，档案自有的长度与选项错误另配 */
export function profileIssueMessage(issue: ProfileIssue): string {
  if (issue.code === 'too_long') return m.profiles_issue_too_long()
  if (issue.code === 'invalid') return m.profiles_issue_invalid()
  return issueMessage(issue as Parameters<typeof issueMessage>[0])
}

/** 整体错误（表单顶部或操作结果）：上限、「本人」重复、不存在与其他失败 */
export function profileFailureMessage(code: ProfileFailureCode | 'UNKNOWN'): string {
  switch (code) {
    case 'PROFILE_LIMIT':
      return m.profiles_limit_body({ max: MAX_PROFILES })
    case 'PROFILE_SELF_EXISTS':
      return m.profiles_self_exists()
    case 'NOT_FOUND':
      return m.profiles_not_found()
    default:
      return m.profiles_error_generic()
  }
}
