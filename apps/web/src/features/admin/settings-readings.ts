import {
  aiModel,
  type Database,
  dbSettingStore,
  getSetting,
  READING_KINDS,
  type ReadingKind,
  type SettingKey,
  setting,
  settingDefaults,
} from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { AdminActionScope } from './action.ts'

/** 详批的三项运行时设置（add-reading-monetization tasks.md 1.2） */
const FIELDS = ['enabled', 'credits', 'modelKey'] as const
type Field = (typeof FIELDS)[number]
const keyOf = <F extends Field>(kind: ReadingKind, field: F) => `readings.${kind}.${field}` as const

export const READING_SETTING_KEYS = READING_KINDS.flatMap((kind) =>
  FIELDS.map((field) => keyOf(kind, field)),
) satisfies SettingKey[]

const readingSettingInput = z.object({
  kind: z.enum(READING_KINDS),
  enabled: z.boolean(),
  credits: z.number().int().min(1).max(100_000),
  /** 空字符串表示未选定模型，该详批在前台不可用 */
  modelKey: z.string().trim().max(200),
})

export const readingSettingsInput = z.object({
  readings: z
    .array(readingSettingInput)
    .min(1)
    .max(READING_KINDS.length)
    .refine((rows) => new Set(rows.map((row) => row.kind)).size === rows.length),
})

export type ReadingSettingsInput = z.infer<typeof readingSettingsInput>

/** 后台表单直接读事实来源，并列出可选的已启用文本模型。 */
export async function readReadingSettings(db: Database) {
  const ctx = { store: dbSettingStore(db) }
  const readings = await Promise.all(
    READING_KINDS.map(async (kind) => ({
      kind,
      enabled: await getSetting(ctx, keyOf(kind, 'enabled')),
      credits: await getSetting(ctx, keyOf(kind, 'credits')),
      modelKey: await getSetting(ctx, keyOf(kind, 'modelKey')),
    })),
  )
  const models = await db
    .select({ key: aiModel.key, provider: aiModel.provider })
    .from(aiModel)
    .where(and(eq(aiModel.kind, 'text'), eq(aiModel.enabled, true)))
    .orderBy(asc(aiModel.sort), asc(aiModel.key))
  return { readings, models }
}

/** 每种详批一条审计，记录三项的新旧值；与写入同事务，锁覆盖缺失行。 */
export async function writeReadingSettings(
  { tx, audit }: AdminActionScope,
  input: ReadingSettingsInput,
) {
  const modelKeys = [...new Set(input.readings.map((row) => row.modelKey).filter(Boolean))]
  if (modelKeys.length > 0) {
    const found = await tx
      .select({ key: aiModel.key })
      .from(aiModel)
      .where(and(inArray(aiModel.key, modelKeys), eq(aiModel.kind, 'text')))
    if (found.length !== modelKeys.length)
      throw new AppError('INVALID_REQUEST', 'Unknown text model', { status: 400 })
  }
  for (const row of input.readings) {
    const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {}
    for (const field of FIELDS) {
      const key = keyOf(row.kind, field)
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`setting:${key}`}, 0))`)
      const [before] = await tx
        .select({ value: setting.value })
        .from(setting)
        .where(eq(setting.key, key))
        .for('update')
      const value = row[field]
      await tx
        .insert(setting)
        .values({ key, value })
        .onConflictDoUpdate({ target: setting.key, set: { value, updatedAt: new Date() } })
      changes[key] = { oldValue: before?.value ?? settingDefaults[key], newValue: value }
    }
    await audit({
      action: 'setting.updated',
      targetType: 'setting',
      targetId: `readings.${row.kind}`,
      meta: { kind: row.kind, changes },
    })
  }
}

/** 只在事务提交后删除；前台经 KV 读取，最多 60 秒后生效。 */
export async function invalidateReadingSettings(cache: { delete(key: string): Promise<void> }) {
  await Promise.all(READING_SETTING_KEYS.map((key) => cache.delete(`setting:${key}`)))
}
