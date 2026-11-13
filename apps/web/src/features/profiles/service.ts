import type { SiteId } from '@xuanxue/config'
import { type BirthProfileRow, birthProfile, type Database, notFound, scoped } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { and, desc, eq, ne, type SQL, sql } from 'drizzle-orm'
import {
  type BirthProfile,
  type BirthProfileInput,
  MAX_PROFILES,
  parseProfileInput,
} from './schema.ts'

/**
 * 出生档案服务（add-birth-profiles-daily-horoscope design D3）。调用方（profiles.functions.ts）
 * 已确认当前空间是用户的个人空间；这里在 `scoped(db, workspaceId)` 之上再加 `user_id` 过滤，
 * 他人的档案与不存在的档案一样返回 NOT_FOUND。
 *
 * 写操作在事务内先取该用户的 advisory 锁，再检查 20 份上限、「本人」唯一与默认档案转移：
 * 用户还没有任何档案时没有行可锁，行锁挡不住两个并发的首次新建，因此按用户 id 加事务级锁。
 * 部分唯一索引仍是最后一道保证。
 */

export interface ProfileContext {
  readonly db: Database
  readonly workspaceId: string
  readonly userId: string
}

/** advisory 锁的命名空间（两段式锁的第一段），避免与其他模块的锁号冲突 */
export const PROFILE_LOCK_NAMESPACE = 72_0611

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

export function toProfile(row: BirthProfileRow): BirthProfile {
  return {
    id: row.id,
    label: row.label,
    relation: row.relation,
    isDefault: row.isDefault,
    birth: row.birth,
    fullName: row.fullName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 用户本人的档案条件；id 来自 URL 等外部输入，非法 UUID 视为不存在，避免数据库报 22P02 */
const own = (userId: string, id?: string): SQL => {
  if (id === undefined) return eq(birthProfile.userId, userId)
  if (!UUID_RE.test(id)) throw notFound()
  // and() 只有全部参数为 undefined 时才返回 undefined
  return and(eq(birthProfile.userId, userId), eq(birthProfile.id, id)) as SQL
}

function limitReached(): AppError {
  return new AppError('PROFILE_LIMIT', `At most ${MAX_PROFILES} birth profiles`, { status: 409 })
}

function selfExists(): AppError {
  return new AppError('PROFILE_SELF_EXISTS', 'Only one profile can be marked as yourself', {
    status: 409,
    details: { issues: [{ field: 'relation', code: 'invalid' }] },
  })
}

/** postgres.js 的错误经 drizzle 包装后在 cause 中 */
function pgError(error: unknown): { code?: string; constraint_name?: string } | undefined {
  const cause = (error as { cause?: unknown }).cause ?? error
  return typeof cause === 'object' && cause !== null ? (cause as never) : undefined
}

/**
 * 失败日志字段白名单：只记录动作、档案 id、业务错误码与数据库错误码 / 约束名。
 * drizzle 的错误消息带有完整 SQL 参数（含出生资料与姓名），因此不记录 message 与 stack。
 */
export function profileFailureFields(
  action: string,
  error: unknown,
  profileId?: string,
): Record<string, string> {
  const fields: Record<string, string> = { action }
  if (profileId) fields.profileId = profileId
  if (error instanceof AppError) {
    fields.code = error.code
    return fields
  }
  const pg = pgError(error)
  fields.errorName = error instanceof Error ? error.name : typeof error
  if (typeof pg?.code === 'string') fields.dbCode = pg.code
  if (typeof pg?.constraint_name === 'string') fields.constraint = pg.constraint_name
  return fields
}

async function logged<R>(action: string, profileId: string | undefined, fn: () => Promise<R>) {
  try {
    return await fn()
  } catch (error) {
    const fields = profileFailureFields(action, error, profileId)
    // 业务错误（校验、上限、越权）属正常分支，只记 info；其余为异常
    if (error instanceof AppError && error.status < 500) log.info('profiles.rejected', fields)
    else log.error('profiles.failed', fields)
    throw error
  }
}

/**
 * 只改默认标记时保留原 updatedAt（schema 的 $onUpdate 会自动刷新它），
 * 列表与「删除默认后转给最近更新的一份」都按 updatedAt 排序，不应被默认切换打乱。
 */
const keepUpdatedAt = (set: { isDefault: boolean }) => ({
  ...set,
  updatedAt: sql`${birthProfile.updatedAt}`,
})

async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${PROFILE_LOCK_NAMESPACE}, hashtext(${userId}))`,
  )
}

async function ownRow(tx: Tx, ctx: ProfileContext, id: string): Promise<BirthProfileRow> {
  const [row] = await scoped(tx, ctx.workspaceId).select(birthProfile, {
    where: own(ctx.userId, id),
  })
  if (!row) throw notFound()
  return row
}

async function assertSelfAvailable(tx: Tx, ctx: ProfileContext, exceptId?: string) {
  const where = and(
    own(ctx.userId),
    eq(birthProfile.relation, 'self'),
    exceptId ? ne(birthProfile.id, exceptId) : undefined,
  ) as SQL
  if ((await scoped(tx, ctx.workspaceId).count(birthProfile, where)) > 0) throw selfExists()
}

/** 并发兜底：锁之外的路径（如手工数据）触发部分唯一索引时，转成同样的业务错误 */
function mapUniqueViolation(error: unknown): never {
  const pg = pgError(error)
  if (pg?.code === '23505' && pg.constraint_name === 'birth_profile_user_self_uq')
    throw selfExists()
  throw error
}

export async function listProfiles(ctx: ProfileContext): Promise<BirthProfile[]> {
  const rows = await scoped(ctx.db, ctx.workspaceId)
    .select(birthProfile, { where: own(ctx.userId) })
    .orderBy(desc(birthProfile.updatedAt), desc(birthProfile.id))
    .limit(MAX_PROFILES)
  return rows.map(toProfile)
}

export async function getProfile(ctx: ProfileContext, id: string): Promise<BirthProfile> {
  return logged('get', id, async () => {
    const [row] = await scoped(ctx.db, ctx.workspaceId).select(birthProfile, {
      where: own(ctx.userId, id),
    })
    if (!row) throw notFound()
    return toProfile(row)
  })
}

/** 新建档案：用户的第一份档案自动成为默认；`makeDefault` 时取代原默认档案。 */
export async function createProfile(
  ctx: ProfileContext,
  site: SiteId,
  raw: unknown,
  options: { makeDefault?: boolean | undefined } = {},
): Promise<BirthProfile> {
  return logged('create', undefined, async () => {
    const input: BirthProfileInput = parseProfileInput(site, raw)
    const row = await ctx.db
      .transaction(async (tx) => {
        await lockUser(tx, ctx.userId)
        const s = scoped(tx, ctx.workspaceId)
        const existing = await s.count(birthProfile, own(ctx.userId))
        if (existing >= MAX_PROFILES) throw limitReached()
        if (input.relation === 'self') await assertSelfAvailable(tx, ctx)
        const isDefault = existing === 0 || options.makeDefault === true
        if (isDefault && existing > 0) {
          await s.update(birthProfile, keepUpdatedAt({ isDefault: false }), own(ctx.userId))
        }
        const [created] = await s
          .insert(birthProfile, { ...input, userId: ctx.userId, isDefault })
          .returning()
        return created as BirthProfileRow
      })
      .catch(mapUniqueViolation)
    return toProfile(row)
  })
}

/** 修改档案：字段整体替换；默认标记不在这里修改。 */
export async function updateProfile(
  ctx: ProfileContext,
  site: SiteId,
  id: string,
  raw: unknown,
): Promise<BirthProfile> {
  return logged('update', id, async () => {
    const input = parseProfileInput(site, raw)
    const row = await ctx.db
      .transaction(async (tx) => {
        await lockUser(tx, ctx.userId)
        await ownRow(tx, ctx, id)
        if (input.relation === 'self') await assertSelfAvailable(tx, ctx, id)
        const [updated] = await scoped(tx, ctx.workspaceId)
          .update(birthProfile, { ...input, updatedAt: new Date() }, own(ctx.userId, id))
          .returning()
        return updated as BirthProfileRow
      })
      .catch(mapUniqueViolation)
    return toProfile(row)
  })
}

/** 硬删除；删除的是默认档案时，把最近更新的另一份设为默认。 */
export async function deleteProfile(ctx: ProfileContext, id: string): Promise<void> {
  await logged('delete', id, () =>
    ctx.db.transaction(async (tx) => {
      await lockUser(tx, ctx.userId)
      const s = scoped(tx, ctx.workspaceId)
      const [deleted] = await s.delete(birthProfile, own(ctx.userId, id)).returning()
      if (!deleted) throw notFound()
      if (!deleted.isDefault) return
      const [next] = await s
        .select(birthProfile, { where: own(ctx.userId), fields: { id: birthProfile.id } })
        .orderBy(desc(birthProfile.updatedAt), desc(birthProfile.id))
        .limit(1)
      if (next) {
        await s.update(birthProfile, keepUpdatedAt({ isDefault: true }), own(ctx.userId, next.id))
      }
    }),
  )
}

export async function setDefaultProfile(ctx: ProfileContext, id: string): Promise<void> {
  await logged('setDefault', id, () =>
    ctx.db.transaction(async (tx) => {
      await lockUser(tx, ctx.userId)
      await ownRow(tx, ctx, id)
      const s = scoped(tx, ctx.workspaceId)
      await s.update(
        birthProfile,
        keepUpdatedAt({ isDefault: false }),
        and(own(ctx.userId), ne(birthProfile.id, id)) as SQL,
      )
      await s.update(birthProfile, keepUpdatedAt({ isDefault: true }), own(ctx.userId, id))
    }),
  )
}
