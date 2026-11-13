import { newId } from '@xuanxue/shared'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth.ts'
import { organization } from './tenancy.ts'

/** 档案关系（add-birth-profiles-daily-horoscope design D1）；表单与 check 约束共用。 */
export const BIRTH_PROFILE_RELATIONS = ['self', 'partner', 'family', 'friend', 'other'] as const
export type BirthProfileRelation = (typeof BIRTH_PROFILE_RELATIONS)[number]

/**
 * 档案中的出生资料：与 `@xuanxue/bazi` 的 BirthInput 同形，但西方站档案只填日期，
 * 因此 gender、location 可以为 null。db 不依赖引擎包，这里按结构单独声明，由 web 的 zod schema 校验。
 */
export type BirthProfileBirth = {
  calendar: 'solar' | 'lunar'
  year: number
  month: number
  day: number
  isLeapMonth?: boolean
  time: { hour: number; minute: number } | null
  gender: 'male' | 'female' | null
  location: { city: string } | { utcOffsetMinutes: number; longitude?: number | undefined } | null
  trueSolarTime?: boolean
}

/**
 * 出生档案：用户在个人空间保存的本人或他人出生资料，属于敏感个人信息。
 * 只在用户主动操作时读取；删除档案为硬删除，删号或删空间时由 web 的空间内容删除步骤清除。
 * 每人最多一份默认档案、一份「本人」档案，由部分唯一索引在并发下保证；20 份上限在事务内检查。
 */
export const birthProfile = pgTable(
  'birth_profile',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    /** 显示名，可空 */
    label: text('label'),
    relation: text('relation', { enum: BIRTH_PROFILE_RELATIONS }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    birth: jsonb('birth').$type<BirthProfileBirth>().notNull(),
    /** 出生全名，仅西方站姓名数字使用 */
    fullName: text('full_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('birth_profile_workspace_user_updated_idx').on(
      t.workspaceId,
      t.userId,
      t.updatedAt.desc(),
    ),
    uniqueIndex('birth_profile_user_default_uq').on(t.userId).where(sql`${t.isDefault}`),
    uniqueIndex('birth_profile_user_self_uq').on(t.userId).where(sql`${t.relation} = 'self'`),
    check(
      'birth_profile_relation_valid',
      sql`${t.relation} in ('self', 'partner', 'family', 'friend', 'other')`,
    ),
    check('birth_profile_label_length', sql`char_length(${t.label}) <= 40`),
    check('birth_profile_full_name_length', sql`char_length(${t.fullName}) <= 120`),
  ],
)

export type BirthProfileRow = typeof birthProfile.$inferSelect
export type NewBirthProfileRow = typeof birthProfile.$inferInsert
