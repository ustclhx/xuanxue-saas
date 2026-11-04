import type { SiteId } from '@xuanxue/config'
import type { KeyValueStore } from '@xuanxue/platform'
import { log } from '@xuanxue/shared/log'
import type { BetterAuthOptions, SecondaryStorage } from 'better-auth'

/**
 * 会话三层读取（design.md 决策 3，docs/04-auth-and-tenancy.md §1「Workers 适配要点」）：
 * 1. `session.cookieCache`：签名 Cookie 中缓存会话，maxAge 内不读 KV 也不查库；
 * 2. `secondaryStorage`（KV `CACHE`）：Cookie 缓存过期后先读 KV；
 * 3. 数据库 `session` 表（`storeSessionInDatabase`）：吊销与审计的事实来源，KV 未命中时回退查库。
 *
 * 吊销需经 Better Auth（退出登录、撤销会话、封禁、改密码等），它同时删除 KV 副本与数据库行；
 * 旧会话最迟在「cookieCache maxAge + KV 传播约 60 秒」后失效。敏感操作用 `requireFreshSession` 直接查库。
 *
 * 两站账户独立（openspec split-site-accounts 决策 2、3）：Cookie 缓存与 KV 都不经过 site-adapter，
 * 因此三层各自校验会话所属用户的站点，不一致时按未登录处理并记录 `auth.cross_site_session`：
 * - Cookie 缓存：`cookieCache.version` 按站点取值，另一站签发的缓存版本对不上，Better Auth 丢弃后改读 KV / 数据库；
 * - KV：键带站点命名空间 `auth:<site>:`，另一站写入的会话副本在本站根本读不到；读出的会话再核对一次 user.site；
 * - 数据库：Better Auth 经 site-adapter 读取（关联的 user 被剔除即未登录），应用侧经 `checkSessionInDatabase` 核对。
 */

/** 会话所属用户与当前站点不一致时记录的事件；只记录站点，不记录用户或会话标识 */
export const CROSS_SITE_SESSION_EVENT = 'auth.cross_site_session'

export function logCrossSiteSession(
  layer: 'cookie' | 'kv' | 'database',
  site: SiteId,
  userSite: unknown,
) {
  log.warn(CROSS_SITE_SESSION_EVENT, {
    layer,
    site,
    userSite: typeof userSite === 'string' ? userSite : null,
  })
}

/** Cookie 缓存时长（秒）：5 分钟 */
export const SESSION_COOKIE_CACHE_MAX_AGE = 5 * 60

const VERIFICATION_PREFIX = 'verification:'

/**
 * Better Auth 键在 KV 中的实际键名：`auth:<site>:<key>`。站点命名空间让一站的会话副本无法在另一站读出；
 * 上线前写入的旧键（`auth:<key>`）不再被读取，读会话时未命中 KV 回退数据库，之后按新键重建，旧键随 TTL 过期。
 * 删号清理（deletion.ts）与后台模拟登录（apps/web）直接操作 KV 时也必须经过这里。
 */
export function authCacheKey(site: SiteId, key: string): string {
  return `auth:${site}:${key}`
}

/** KV 中会话副本（`{ session, user }`）的用户站点；不是会话副本时返回 undefined */
function cachedUserSite(value: string): unknown {
  try {
    const parsed = JSON.parse(value) as { session?: unknown; user?: { site?: unknown } } | null
    return parsed && typeof parsed === 'object' && parsed.session && parsed.user
      ? (parsed.user.site ?? null)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * 把 KV 适配为 Better Auth 的 `secondaryStorage`；键统一加 `auth:<site>:` 前缀，与 CACHE 中的其他用途和另一站区分。
 * KV 没有原子操作：`getAndDelete` 只在验证值不写库时用于一次性消费（这里写库，由数据库原子消费），
 * `increment` 只在内置限流存 secondaryStorage 时使用（这里改为内存），二者都不会被调用。
 *
 * 验证值（`verification:` 键）一律不读写 KV，只以数据库为准：
 * - Better Auth 1.7.7 的 findVerificationValue 先读 KV，KV 不经过 adapter，按站点隔离（site-adapter.ts）
 *   会被绕过——东方站发起的 OAuth state 能在西方站回调中命中（spike 1.1 实测）；
 * - deletionPlugin 的 init 想用同样的方式关闭验证值 KV，但 runPluginInit 以 `defu(options, 插件 options)`
 *   合并，已有的 secondaryStorage 优先，插件的覆盖不生效（better-auth dist/context/helpers.mjs）。
 */
export function kvSecondaryStorage(kv: KeyValueStore, site: SiteId): SecondaryStorage {
  const skip = (key: string) => key.startsWith(VERIFICATION_PREFIX)
  const name = (key: string) => authCacheKey(site, key)
  const read = async (key: string) => {
    const value = await kv.get(name(key))
    if (value === null) return null
    // 命名空间已隔离两站；会话副本再核对一次用户站点，防止本站误写了另一站用户的副本
    const userSite = cachedUserSite(value)
    if (userSite !== undefined && userSite !== site) {
      logCrossSiteSession('kv', site, userSite)
      return null
    }
    return value
  }
  return {
    get: (key) => (skip(key) ? Promise.resolve(null) : read(key)),
    getAndDelete: async (key) => {
      if (skip(key)) return null
      const value = await read(key)
      if (value !== null) await kv.delete(name(key))
      return value
    },
    increment: () => {
      throw new Error('KV secondaryStorage does not support atomic increment')
    },
    set: async (key, value, ttl) => {
      if (skip(key)) return
      await kv.put(
        name(key),
        value,
        ttl === undefined ? {} : { expirationTtl: Math.max(Math.ceil(ttl), 1) },
      )
    },
    delete: (key) => (skip(key) ? Promise.resolve() : kv.delete(name(key))),
  }
}

/**
 * Cookie 缓存的版本号：写入时按会话用户的站点取值，读取时按当前站点比对。
 * Better Auth 1.7.7 在版本不一致时丢弃缓存并改读 KV / 数据库（dist/api/routes/session.mjs），
 * 所以另一站签发的缓存 Cookie（同一密钥签名）在本站不会被直接采信。
 */
export function cookieCacheVersion(site: SiteId) {
  return (_session: unknown, user: Record<string, unknown>) => {
    if (user.site === site) return `site:${site}`
    logCrossSiteSession('cookie', site, user.site)
    // 每次取不同的值：即使本站误写了另一站用户的缓存，读取时也不会与写入时的版本相同
    return `cross-site:${crypto.randomUUID()}`
  }
}

/** `createAuth` 中与会话存储相关的选项；没有 KV 绑定时只用 Cookie 缓存 + 数据库。 */
export function sessionStorageOptions(kv: KeyValueStore | undefined, site: SiteId) {
  return {
    session: {
      cookieCache: {
        enabled: true,
        maxAge: SESSION_COOKIE_CACHE_MAX_AGE,
        version: cookieCacheVersion(site),
      },
      storeSessionInDatabase: true,
    },
    ...(kv && { secondaryStorage: kvSecondaryStorage(kv, site) }),
    // 有 secondaryStorage 时 Better Auth 默认只把验证码 / 验证链接写入 KV；KV 跨节点最终一致，
    // 在另一个节点校验时可能读不到，因此同时写库，KV 未命中时回退查库
    verification: { storeInDatabase: true },
    // Better Auth 自带限流在有 secondaryStorage 时默认存 KV：每个请求都写同一个键，
    // 会触发 KV「同一键每秒最多写 1 次」的限制，且计数最终一致。认证入口的限流由 RL_AUTH 负责
    // （protection.ts），这里改用 isolate 内存，只作为同一 isolate 内的额外削峰
    rateLimit: { storage: 'memory' },
  } satisfies Partial<BetterAuthOptions>
}
