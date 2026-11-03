import type { KeyValueStore } from '@xuanxue/platform'
import type { BetterAuthOptions, SecondaryStorage } from 'better-auth'

/**
 * 会话三层读取（design.md 决策 3，docs/04-auth-and-tenancy.md §1「Workers 适配要点」）：
 * 1. `session.cookieCache`：签名 Cookie 中缓存会话，maxAge 内不读 KV 也不查库；
 * 2. `secondaryStorage`（KV `CACHE`）：Cookie 缓存过期后先读 KV；
 * 3. 数据库 `session` 表（`storeSessionInDatabase`）：吊销与审计的事实来源，KV 未命中时回退查库。
 *
 * 吊销需经 Better Auth（退出登录、撤销会话、封禁、改密码等），它同时删除 KV 副本与数据库行；
 * 旧会话最迟在「cookieCache maxAge + KV 传播约 60 秒」后失效。敏感操作用 `requireFreshSession` 直接查库。
 */

/** Cookie 缓存时长（秒）：5 分钟 */
export const SESSION_COOKIE_CACHE_MAX_AGE = 5 * 60

const KEY_PREFIX = 'auth:'
const VERIFICATION_PREFIX = 'verification:'

/**
 * 把 KV 适配为 Better Auth 的 `secondaryStorage`；键统一加 `auth:` 前缀，与 CACHE 中的其他用途区分。
 * KV 没有原子操作：`getAndDelete` 只在验证值不写库时用于一次性消费（这里写库，由数据库原子消费），
 * `increment` 只在内置限流存 secondaryStorage 时使用（这里改为内存），二者都不会被调用。
 *
 * 验证值（`verification:` 键）一律不读写 KV，只以数据库为准：
 * - Better Auth 1.7.7 的 findVerificationValue 先读 KV，KV 不经过 adapter，按站点隔离（site-adapter.ts）
 *   会被绕过——东方站发起的 OAuth state 能在西方站回调中命中（spike 1.1 实测）；
 * - deletionPlugin 的 init 想用同样的方式关闭验证值 KV，但 runPluginInit 以 `defu(options, 插件 options)`
 *   合并，已有的 secondaryStorage 优先，插件的覆盖不生效（better-auth dist/context/helpers.mjs）。
 */
export function kvSecondaryStorage(kv: KeyValueStore): SecondaryStorage {
  const skip = (key: string) => key.startsWith(VERIFICATION_PREFIX)
  return {
    get: (key) => (skip(key) ? Promise.resolve(null) : kv.get(KEY_PREFIX + key)),
    getAndDelete: async (key) => {
      if (skip(key)) return null
      const value = await kv.get(KEY_PREFIX + key)
      if (value !== null) await kv.delete(KEY_PREFIX + key)
      return value
    },
    increment: () => {
      throw new Error('KV secondaryStorage does not support atomic increment')
    },
    set: async (key, value, ttl) => {
      if (skip(key)) return
      await kv.put(
        KEY_PREFIX + key,
        value,
        ttl === undefined ? {} : { expirationTtl: Math.max(Math.ceil(ttl), 1) },
      )
    },
    delete: (key) => (skip(key) ? Promise.resolve() : kv.delete(KEY_PREFIX + key)),
  }
}

/** `createAuth` 中与会话存储相关的选项；没有 KV 绑定时只用 Cookie 缓存 + 数据库。 */
export function sessionStorageOptions(kv: KeyValueStore | undefined) {
  return {
    session: {
      cookieCache: { enabled: true, maxAge: SESSION_COOKIE_CACHE_MAX_AGE },
      storeSessionInDatabase: true,
    },
    ...(kv && { secondaryStorage: kvSecondaryStorage(kv) }),
    // 有 secondaryStorage 时 Better Auth 默认只把验证码 / 验证链接写入 KV；KV 跨节点最终一致，
    // 在另一个节点校验时可能读不到，因此同时写库，KV 未命中时回退查库
    verification: { storeInDatabase: true },
    // Better Auth 自带限流在有 secondaryStorage 时默认存 KV：每个请求都写同一个键，
    // 会触发 KV「同一键每秒最多写 1 次」的限制，且计数最终一致。认证入口的限流由 RL_AUTH 负责
    // （protection.ts），这里改用 isolate 内存，只作为同一 isolate 内的额外削峰
    rateLimit: { storage: 'memory' },
  } satisfies Partial<BetterAuthOptions>
}
