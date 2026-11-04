import type { KeyValueStore } from '@xuanxue/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authCacheKey, cookieCacheVersion, kvSecondaryStorage } from './session.ts'

// 会话读取按站点校验（openspec split-site-accounts 决策 3）的单元部分：KV 命名空间与 Cookie 缓存版本。
// 三条读取路径的端到端行为见 test/site-isolation.test.ts。

function memoryKv() {
  const store = new Map<string, string>()
  const kv: KeyValueStore = {
    get: (async (key: string) => store.get(key) ?? null) as KeyValueStore['get'],
    put: async (key, value) => {
      store.set(key, value)
    },
    delete: async (key) => {
      store.delete(key)
    },
  }
  return { kv, store }
}

const session = (site: string) =>
  JSON.stringify({ session: { token: 't' }, user: { id: 'u', site } })

function warnings() {
  const lines: string[] = []
  vi.spyOn(console, 'warn').mockImplementation((line: unknown) => {
    lines.push(String(line))
  })
  return lines
}

afterEach(() => vi.restoreAllMocks())

describe('KV 二级存储按站点命名', () => {
  it('同一个键在两站写入不同的命名空间，互相读不到', async () => {
    const { kv, store } = memoryKv()
    const east = kvSecondaryStorage(kv, 'east')
    const west = kvSecondaryStorage(kv, 'west')
    await east.set('token-1', session('east'))
    expect([...store.keys()]).toEqual([authCacheKey('east', 'token-1')])
    expect(authCacheKey('east', 'token-1')).toBe('auth:east:token-1')
    expect(await west.get('token-1')).toBeNull()
    expect(await east.get('token-1')).toBe(session('east'))
    await west.delete('token-1')
    expect(await east.get('token-1')).not.toBeNull()
  })

  it('本站命名空间里出现另一站用户的会话副本时按未命中处理并记录日志', async () => {
    const lines = warnings()
    const { kv, store } = memoryKv()
    store.set('auth:west:token-2', session('east'))
    const west = kvSecondaryStorage(kv, 'west')
    expect(await west.get('token-2')).toBeNull()
    expect(await west.getAndDelete('token-2')).toBeNull()
    expect(lines.map((line) => JSON.parse(line))).toContainEqual(
      expect.objectContaining({ event: 'auth.cross_site_session', layer: 'kv', site: 'west' }),
    )
    // 不是会话副本的值（如会话列表）原样返回
    store.set('auth:west:active-sessions-u', '[{"token":"t"}]')
    expect(await west.get('active-sessions-u')).toBe('[{"token":"t"}]')
  })

  it('上线前的旧键（auth:<key>）不再被读取', async () => {
    const { kv, store } = memoryKv()
    store.set('auth:token-3', session('west'))
    expect(await kvSecondaryStorage(kv, 'west').get('token-3')).toBeNull()
  })

  it('验证值始终不读写 KV', async () => {
    const { kv, store } = memoryKv()
    const west = kvSecondaryStorage(kv, 'west')
    await west.set('verification:abc', 'v')
    expect(store.size).toBe(0)
    store.set('auth:west:verification:abc', 'v')
    expect(await west.get('verification:abc')).toBeNull()
  })
})

describe('Cookie 缓存版本按站点', () => {
  it('本站用户的版本固定；另一站用户的版本每次都不同，因此缓存永远对不上', () => {
    const lines = warnings()
    const version = cookieCacheVersion('west')
    expect(version({}, { site: 'west' })).toBe('site:west')
    expect(cookieCacheVersion('east')({}, { site: 'east' })).toBe('site:east')
    const first = version({}, { site: 'east' })
    const second = version({}, { site: 'east' })
    expect(first).not.toBe('site:west')
    expect(first).not.toBe(second)
    expect(version({}, {})).not.toBe('site:west')
    expect(lines.map((line) => JSON.parse(line).layer)).toEqual(['cookie', 'cookie', 'cookie'])
  })
})
