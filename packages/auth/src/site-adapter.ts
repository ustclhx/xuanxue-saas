import type { SiteId } from '@xuanxue/config'
import type { BetterAuthOptions, DBAdapter, DBAdapterInstance, Where } from 'better-auth'

/**
 * 两站账户按站点独立（openspec split-site-accounts 决策 2）：包装 Better Auth 的 adapter，
 * 让 `user`、`account`、`verification` 的每次读写都自动带上当前站点。
 *
 * 为什么在 adapter 层：Better Auth 内部按邮箱 / identifier 查找的路径很多（登录、注册、找回密码、
 * OTP、magic link、OAuth 关联、改邮箱），在这里统一追加条件可以一次覆盖全部路径。
 *
 * 1.7.7 的约束（spike 1.1 在已安装源码上确认）：
 * - `transaction` 在 drizzle adapter 未开启事务时走 `createAsIsTransaction(adapter)`，
 *   把**未包装**的 factory adapter 交给回调；所以必须包装回调收到的 trx，否则注册路径会漏掉。
 * - `join` 由 factory 用内部 adapter 另发查询补齐，不经过本包装；因此对结果中的关联行再按站点过滤
 *   （例如 session → user：另一站用户的会话在数据库路径上读出 user 为空，Better Auth 视为未登录）。
 * - 出现未知的方法或属性时直接报错：升级 Better Auth 后新增的写入口不能静默绕过站点条件。
 */

/** 按站点隔离的 Better Auth 模型 */
export const SITE_SCOPED_MODELS = ['user', 'account', 'verification'] as const

/**
 * `additionalFields` 中的站点字段：adapter 的字段映射需要认得这一列；`input: false` 使客户端无法写入。
 * 1.7.7 的 parseInputData 对 `required` 且无 defaultValue 的字段在注册时报 "site is required"，
 * 所以以当前站点作为 defaultValue；真正写入的值仍由包装层的 create 覆盖。
 */
export const siteFields = (site: SiteId) =>
  ({ site: { type: 'string', required: true, input: false, defaultValue: site } }) as const

// 会改写或读取数据的方法：全部按站点追加条件
const SCOPED_METHODS = [
  'create',
  'findOne',
  'findMany',
  'count',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'consumeOne',
  'incrementOne',
  'transaction',
] as const
// 不接触行数据、原样保留的属性
const PASSTHROUGH = ['id', 'options', 'createSchema'] as const
const KNOWN = new Set<string>([...SCOPED_METHODS, ...PASSTHROUGH])

const scopedModels = new Set<string>(SITE_SCOPED_MODELS)
const isScoped = (model: string) => scopedModels.has(model)

/** 在调用方的条件之后追加 `site = 当前站点`（AND）；drizzle adapter 生成 `and(AND 组, or(OR 组))` */
function withSite(model: string, where: Where[] | undefined, site: SiteId): Where[] | undefined {
  if (!isScoped(model)) return where
  return [...(where ?? []), { field: 'site', operator: 'eq', value: site, connector: 'AND' }]
}

function assertNoSiteWrite(model: string, data: Record<string, unknown> | undefined) {
  // 账户站点在注册后不可改变（specs/user-auth「账户归属站点」）
  if (isScoped(model) && data && 'site' in data) {
    throw new Error(`site-adapter: ${model}.site is immutable`)
  }
}

/** factory 补齐的 join 结果不经过包装，这里丢弃不属于当前站点的关联行 */
function filterJoined<T>(row: T, join: Record<string, unknown> | undefined, site: SiteId): T {
  if (!row || !join) return row
  const record = row as Record<string, unknown>
  for (const model of Object.keys(join)) {
    if (!isScoped(model) || !(model in record)) continue
    const value = record[model]
    const ok = (v: unknown) => (v as { site?: unknown } | null)?.site === site
    if (Array.isArray(value)) record[model] = value.filter(ok)
    else if (value) record[model] = ok(value) ? value : null
  }
  return row
}

function wrap<
  A extends Omit<DBAdapter, 'transaction'> & { transaction?: DBAdapter['transaction'] },
>(inner: A, site: SiteId): A {
  for (const key of Object.keys(inner)) {
    if (!KNOWN.has(key)) throw new Error(`site-adapter: unknown adapter member "${key}"`)
  }
  const wrapped: Omit<DBAdapter, 'transaction'> & { transaction?: DBAdapter['transaction'] } = {
    id: inner.id,
    ...('options' in inner && { options: inner.options }),
    ...('createSchema' in inner && { createSchema: inner.createSchema }),
    create: (args) => {
      if (!isScoped(args.model)) return inner.create(args)
      // 客户端与调用方都不能指定站点：一律覆盖为当前站点
      return inner.create({ ...args, data: { ...args.data, site } })
    },
    findOne: async (args) =>
      filterJoined(
        await inner.findOne({ ...args, where: withSite(args.model, args.where, site) ?? [] }),
        args.join,
        site,
      ),
    findMany: async <T>(args: Parameters<DBAdapter['findMany']>[0]) => {
      const rows = await inner.findMany<T>({
        ...args,
        where: withSite(args.model, args.where, site),
      })
      return args.join ? rows.map((r) => filterJoined(r, args.join, site)) : rows
    },
    count: (args) => inner.count({ ...args, where: withSite(args.model, args.where, site) }),
    update: (args) => {
      assertNoSiteWrite(args.model, args.update)
      return inner.update({ ...args, where: withSite(args.model, args.where, site) ?? [] })
    },
    updateMany: (args) => {
      assertNoSiteWrite(args.model, args.update)
      return inner.updateMany({ ...args, where: withSite(args.model, args.where, site) ?? [] })
    },
    delete: (args) =>
      inner.delete({ ...args, where: withSite(args.model, args.where, site) ?? [] }),
    deleteMany: (args) =>
      inner.deleteMany({ ...args, where: withSite(args.model, args.where, site) ?? [] }),
    consumeOne: (args) =>
      inner.consumeOne({ ...args, where: withSite(args.model, args.where, site) ?? [] }),
    incrementOne: (args) => {
      assertNoSiteWrite(args.model, args.set)
      if (isScoped(args.model) && 'site' in args.increment) {
        throw new Error(`site-adapter: ${args.model}.site is immutable`)
      }
      return inner.incrementOne({ ...args, where: withSite(args.model, args.where, site) ?? [] })
    },
  }
  const { transaction } = inner
  if (transaction) {
    // 事务回调收到的 trx（包括未开启事务时的 as-is adapter）同样包装
    wrapped.transaction = (cb) => transaction((trx) => cb(wrap(trx, site)))
  }
  return wrapped as A
}

/** 把 adapter 工厂（如 `drizzleAdapter(db, ...)`）包装为按站点隔离的工厂 */
export function siteScopedAdapter(factory: DBAdapterInstance, site: SiteId): DBAdapterInstance {
  return (options: BetterAuthOptions) => wrap(factory(options), site)
}
