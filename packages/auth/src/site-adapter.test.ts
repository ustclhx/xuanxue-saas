import type { BetterAuthOptions, DBAdapter } from 'better-auth'
import { describe, expect, it, vi } from 'vitest'
import { siteScopedAdapter } from './site-adapter.ts'

// 包装层的形状约束（spike 1.1）：用记录调用的假 adapter 验证条件注入、事务与未知方法。

function fakeAdapter(extra: Record<string, unknown> = {}) {
  const calls: { method: string; args: unknown }[] = []
  const record =
    (method: string, result: unknown = null) =>
    async (args: unknown) => {
      calls.push({ method, args })
      return result
    }
  const adapter = {
    id: 'fake',
    create: record('create', {}),
    findOne: record('findOne'),
    findMany: record('findMany', []),
    count: record('count', 0),
    update: record('update'),
    updateMany: record('updateMany', 0),
    delete: record('delete'),
    deleteMany: record('deleteMany', 0),
    consumeOne: record('consumeOne'),
    incrementOne: record('incrementOne'),
    transaction: vi.fn(async (cb: (trx: unknown) => Promise<unknown>) => cb(trxAdapter)),
    options: {},
    ...extra,
  }
  // 事务回调收到的是另一个对象（与 1.7.7 的 createAsIsTransaction / drizzle 真事务一致）
  const trxAdapter = { ...adapter, transaction: undefined }
  delete (trxAdapter as { transaction?: unknown }).transaction
  return { adapter: adapter as unknown as DBAdapter, calls }
}

const build = (inner: DBAdapter) => siteScopedAdapter(() => inner, 'east')({} as BetterAuthOptions)
const SITE = { field: 'site', operator: 'eq', value: 'east', connector: 'AND' }

describe('siteScopedAdapter', () => {
  it('作用域模型的每个读写方法都追加 site 条件，create 写入 site', async () => {
    const { adapter, calls } = fakeAdapter()
    const a = build(adapter)
    const where = [{ field: 'email', value: 'a@example.test' }]
    await a.create({ model: 'user', data: { email: 'a@example.test', site: 'west' } })
    await a.findOne({ model: 'user', where })
    await a.findMany({ model: 'account' })
    await a.count({ model: 'verification', where })
    await a.update({ model: 'user', where, update: { name: 'x' } })
    await a.updateMany({ model: 'user', where, update: { name: 'x' } })
    await a.delete({ model: 'verification', where })
    await a.deleteMany({ model: 'verification', where })
    await a.consumeOne({ model: 'verification', where })
    await a.incrementOne({ model: 'verification', where, increment: { attempts: 1 } })
    expect(calls[0]).toEqual({
      method: 'create',
      args: { model: 'user', data: { email: 'a@example.test', site: 'east' } },
    })
    expect(calls[2]?.args).toEqual({ model: 'account', where: [SITE] })
    for (const call of calls.slice(1)) {
      if (call.method === 'findMany') continue
      expect((call.args as { where: unknown }).where).toEqual([...where, SITE])
    }
  })

  it('其他模型原样透传', async () => {
    const { adapter, calls } = fakeAdapter()
    const where = [{ field: 'token', value: 't' }]
    await build(adapter).findOne({ model: 'session', where })
    await build(adapter).create({ model: 'session', data: { token: 't' } })
    expect(calls).toEqual([
      { method: 'findOne', args: { model: 'session', where } },
      { method: 'create', args: { model: 'session', data: { token: 't' } } },
    ])
  })

  it('事务回调收到的 trx 也被包装', async () => {
    const { adapter, calls } = fakeAdapter()
    await build(adapter).transaction((trx) =>
      trx.findOne({ model: 'user', where: [{ field: 'id', value: '1' }] }),
    )
    expect(calls).toEqual([
      { method: 'findOne', args: { model: 'user', where: [{ field: 'id', value: '1' }, SITE] } },
    ])
  })

  it('join 补齐的关联行按站点过滤', async () => {
    const { adapter } = fakeAdapter({
      findOne: async () => ({ id: 's', user: { id: 'u', site: 'west' } }),
      findMany: async () => [
        { id: 'u', site: 'east', account: [{ site: 'east' }, { site: 'west' }] },
      ],
    })
    const a = build(adapter)
    expect(await a.findOne({ model: 'session', where: [], join: { user: true } })).toEqual({
      id: 's',
      user: null,
    })
    expect(await a.findMany({ model: 'user', join: { account: true } })).toEqual([
      { id: 'u', site: 'east', account: [{ site: 'east' }] },
    ])
  })

  it('修改 site 直接报错', async () => {
    const { adapter } = fakeAdapter()
    const a = build(adapter)
    await expect(() => a.update({ model: 'user', where: [], update: { site: 'west' } })).toThrow(
      /immutable/,
    )
    await expect(() =>
      a.incrementOne({ model: 'account', where: [], increment: {}, set: { site: 'west' } }),
    ).toThrow(/immutable/)
  })

  it('出现未知的 adapter 成员时拒绝构造，不透传', () => {
    const { adapter } = fakeAdapter({ upsert: async () => null })
    expect(() => build(adapter)).toThrow('site-adapter: unknown adapter member "upsert"')
  })
})
