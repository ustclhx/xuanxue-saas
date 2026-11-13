import { type BirthInput, type InputField, type InputIssueCode, validateInput } from '@xuanxue/bazi'
import type { SiteId } from '@xuanxue/config'
import type { BirthProfileBirth, BirthProfileRelation } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { z } from 'zod'

/**
 * 出生档案的输入校验（add-birth-profiles-daily-horoscope design D2）。
 * 档案、详批 `reading.input` 与工具表单共用 `birthInputSchema` 的形状；日期是否存在、闰月、
 * 经度等语义检查仍交给引擎的 `validateInput`，与排盘规则保持一致。
 */

const int = z.number().int()

const locationSchema = z.union([
  z.object({ city: z.string().max(64) }),
  z.object({ utcOffsetMinutes: int, longitude: z.number().optional() }),
])

/** `@xuanxue/bazi` 的 BirthInput 形状；详批（readings/catalog.ts）与档案共用。 */
export const birthInputSchema = z.object({
  calendar: z.enum(['solar', 'lunar']),
  year: int,
  month: int,
  day: int,
  isLeapMonth: z.boolean().optional(),
  time: z.object({ hour: int, minute: int }).nullable(),
  gender: z.enum(['male', 'female']),
  location: locationSchema,
  trueSolarTime: z.boolean().optional(),
})

/** 档案里的出生资料：西方站只填日期，因此性别与出生地可以为 null。 */
export const profileBirthSchema = birthInputSchema.extend({
  gender: z.enum(['male', 'female']).nullable(),
  location: locationSchema.nullable(),
})

/**
 * 与 `@xuanxue/db` 的 BIRTH_PROFILE_RELATIONS 相同（schema.test.ts 断言一致）；
 * 本文件也给浏览器端表单使用，只从 db 包引入类型，避免把数据库客户端打进页面。
 */
export const PROFILE_RELATIONS = [
  'self',
  'partner',
  'family',
  'friend',
  'other',
] as const satisfies readonly BirthProfileRelation[]

export const MAX_PROFILES = 20
export const PROFILE_LABEL_MAX = 40
export const PROFILE_FULL_NAME_MAX = 120

/** 字段级错误：页面按 field + code 渲染本语言提示；不含字段的值。 */
export type ProfileField = InputField | 'label' | 'relation' | 'fullName'
export type ProfileIssueCode = InputIssueCode | 'too_long' | 'invalid'
export type ProfileIssue = { field: ProfileField; code: ProfileIssueCode }

/** 规范化后的档案字段（创建与修改共用，修改为整体替换）。 */
export interface BirthProfileInput {
  readonly label: string | null
  readonly relation: BirthProfileRelation
  readonly birth: BirthProfileBirth
  readonly fullName: string | null
}

/** 返回给页面的档案。 */
export interface BirthProfile extends BirthProfileInput {
  readonly id: string
  readonly isDefault: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

/** 空字符串视为未填写 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: 'too_long' })
    .nullish()
    .transform((value) => (value ? value : null))

const fieldsSchema = z.object({
  label: optionalText(PROFILE_LABEL_MAX),
  relation: z.enum(PROFILE_RELATIONS),
  birth: profileBirthSchema,
  fullName: optionalText(PROFILE_FULL_NAME_MAX),
})

const SUBSTITUTE_LOCATION: BirthInput['location'] = { city: 'taipei' }

/**
 * 引擎语义校验。性别、出生地为空时用占位值通过引擎，再丢弃这两个字段上的问题；
 * 是否必填由站点规则单独判断。
 */
function engineIssues(birth: BirthProfileBirth): ProfileIssue[] {
  const input = {
    ...birth,
    gender: birth.gender ?? 'male',
    location: birth.location ?? SUBSTITUTE_LOCATION,
  } as BirthInput
  return validateInput(input).filter(
    (issue) =>
      !(issue.field === 'gender' && birth.gender === null) &&
      !(issue.field === 'location' && birth.location === null),
  )
}

/** 站点必填规则：东方站要求性别与出生地；西方站只要求公历日期。 */
function siteIssues(site: SiteId, birth: BirthProfileBirth): ProfileIssue[] {
  const issues: ProfileIssue[] = []
  if (site === 'east') {
    if (birth.gender === null) issues.push({ field: 'gender', code: 'required' })
    if (birth.location === null) issues.push({ field: 'location', code: 'required' })
  } else if (birth.calendar !== 'solar') {
    // 西方站没有农历输入，数字命理只用公历日期
    issues.push({ field: 'calendar', code: 'invalid' })
  }
  return issues
}

const ISSUE_FIELDS = new Set<string>([
  'calendar',
  'year',
  'month',
  'day',
  'leapMonth',
  'time',
  'gender',
  'location',
  'trueSolarTime',
  'label',
  'relation',
  'fullName',
])

/** zod 的错误路径换成字段名，例如 `birth.location.city` → `location`、`birth.isLeapMonth` → `leapMonth`。 */
function zodIssues(error: z.ZodError): ProfileIssue[] {
  return error.issues.map((issue) => {
    const [first, second] = issue.path.map(String)
    const name = first === 'birth' ? (second === 'isLeapMonth' ? 'leapMonth' : second) : first
    const field = (ISSUE_FIELDS.has(name ?? '') ? name : 'calendar') as ProfileField
    return { field, code: issue.message === 'too_long' ? 'too_long' : 'invalid' }
  })
}

/**
 * 校验并规范化档案字段。成功时：东方站的 `fullName` 一律清空（只有西方站姓名数字使用）；
 * 没有出生地时去掉真太阳时偏好，避免保存无法生效的设置。
 */
export function validateProfileInput(
  site: SiteId,
  raw: unknown,
): { ok: true; value: BirthProfileInput } | { ok: false; issues: ProfileIssue[] } {
  const parsed = fieldsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) }
  const { birth: parsedBirth, ...rest } = parsed.data
  const { trueSolarTime, isLeapMonth, ...birthRest } = parsedBirth
  const birth: BirthProfileBirth = {
    ...birthRest,
    ...(parsedBirth.calendar === 'lunar' ? { isLeapMonth: isLeapMonth === true } : {}),
    ...(parsedBirth.location !== null && trueSolarTime !== undefined ? { trueSolarTime } : {}),
  }
  if (parsedBirth.calendar === 'solar' && isLeapMonth === true) {
    return { ok: false, issues: [{ field: 'leapMonth', code: 'leap_month_not_exist' }] }
  }
  const issues = [...siteIssues(site, birth), ...engineIssues(birth)]
  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    value: { ...rest, birth, fullName: site === 'west' ? rest.fullName : null },
  }
}

/** 服务端入口：非法输入抛 400，details 只含字段与错误码，不回显输入值。 */
export function parseProfileInput(site: SiteId, raw: unknown): BirthProfileInput {
  const result = validateProfileInput(site, raw)
  if (!result.ok) {
    throw new AppError('INVALID_PROFILE', 'Invalid birth profile', {
      status: 400,
      details: { issues: result.issues },
    })
  }
  return result.value
}

/**
 * server function 的入参形状校验：只检查结构与长度上限，语义与站点规则由 `parseProfileInput` 判断。
 * 出生资料对象原样透传，避免 zod 在这里先报出不带字段名的错误。
 */
export const profileFieldsInput = z.object({
  label: z.string().max(200).nullish(),
  relation: z.string().max(16),
  birth: z.record(z.string(), z.unknown()),
  fullName: z.string().max(500).nullish(),
})
