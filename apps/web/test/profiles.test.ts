import type { SiteId } from '@xuanxue/config'
import { newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  PROFILE_LOCK_NAMESPACE,
  type ProfileContext,
  setDefaultProfile,
  updateProfile,
} from '../src/features/profiles/service.ts'
import { workspaceContentDeletionStep } from '../src/features/readings/deletion.server.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// tasks.md 3.3 / 3.4：档案归属隔离、20 份上限（含并发）、「本人」唯一、默认档案转移、删号清除。
const db = createAdminTestDb()
const sql = db.$client
const created: string[] = []

const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}
const fields = (relation = 'family', label: string | null = null) => ({
  label,
  relation,
  birth: BIRTH,
})

async function account(site: SiteId = 'east', email = `${newId()}@profiles.example`) {
  const id = newId()
  created.push(id)
  await sql`insert into "user" (id,name,email,site) values (${id},'Profile',${email},${site})`
  await sql`insert into organization (id,name,slug,is_personal,site) values (${id},'Profile',${id},true,${site})`
  return { db, workspaceId: id, userId: id } satisfies ProfileContext
}

afterAll(async () => {
  if (created.length === 0) return
  await sql`delete from birth_profile where workspace_id in ${sql(created)}`
  await sql`delete from organization where id in ${sql(created)}`
  await sql`delete from "user" where id in ${sql(created)}`
})

describe('出生档案服务', () => {
  it('保存后字段一致；第一份自动成为默认', async () => {
    const ctx = await account()
    const profile = await createProfile(ctx, 'east', fields('self', '我'))
    expect(profile).toMatchObject({ label: '我', relation: 'self', isDefault: true, birth: BIRTH })
    expect(await getProfile(ctx, profile.id)).toEqual(profile)
    const second = await createProfile(ctx, 'east', fields())
    expect(second.isDefault).toBe(false)
    expect((await listProfiles(ctx)).map((p) => p.id)).toEqual([second.id, profile.id])
  })

  it('他人的档案按不存在处理，读写都不生效', async () => {
    const a = await account()
    const b = await account()
    const theirs = await createProfile(b, 'east', fields('partner', 'B'))
    await expect(getProfile(a, theirs.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(updateProfile(a, 'east', theirs.id, fields('friend', 'A'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(deleteProfile(a, theirs.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(setDefaultProfile(a, theirs.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // 用 B 的空间 id、A 的用户 id 也读不到（双重过滤）
    await expect(getProfile({ ...a, workspaceId: b.workspaceId }, theirs.id)).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    )
    await expect(getProfile(a, 'not-a-uuid')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await listProfiles(a)).toEqual([])
    expect(await getProfile(b, theirs.id)).toEqual(theirs)
  })

  it('第二份「本人」被拒绝，新建与修改都一样', async () => {
    const ctx = await account()
    const self = await createProfile(ctx, 'east', fields('self'))
    await expect(createProfile(ctx, 'east', fields('self'))).rejects.toMatchObject({
      code: 'PROFILE_SELF_EXISTS',
      status: 409,
    })
    const other = await createProfile(ctx, 'east', fields('partner'))
    await expect(updateProfile(ctx, 'east', other.id, fields('self'))).rejects.toMatchObject({
      code: 'PROFILE_SELF_EXISTS',
    })
    // 本人档案改自己的其他字段不受影响
    expect((await updateProfile(ctx, 'east', self.id, fields('self', '新名'))).label).toBe('新名')
  })

  /**
   * 模拟另一个并发请求：在另一条连接上取同一把锁、插入一份档案后停住，
   * 此时发起的新建必须等它提交后再计数。没有加锁时新建会立即完成并看不到未提交的行。
   */
  async function whileConcurrentInsert(
    ctx: ProfileContext,
    isDefault: boolean,
    attempt: () => Promise<unknown>,
  ) {
    const other = createAdminTestDb()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let holding = () => {}
    const held = new Promise<void>((resolve) => {
      holding = resolve
    })
    try {
      const holder = other.$client.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${PROFILE_LOCK_NAMESPACE}, hashtext(${ctx.userId}))`
        await tx`insert into birth_profile (id,workspace_id,user_id,relation,is_default,birth)
          values (${newId()},${ctx.workspaceId},${ctx.userId},'family',${isDefault},${JSON.stringify(BIRTH)}::jsonb)`
        holding()
        await gate
      })
      // 持锁事务失败时直接抛出，不必等到超时
      await Promise.race([held, holder])
      const pending = attempt().then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      )
      const early = await Promise.race([
        pending.then(() => 'settled'),
        new Promise((resolve) => setTimeout(() => resolve('blocked'), 300)),
      ])
      release()
      await holder
      return { early, result: await pending }
    } finally {
      release()
      await other.$client.end()
    }
  }

  it('第 21 份被拒绝；并发新建等待锁后再计数，不会超过上限', async () => {
    const ctx = await account()
    for (let i = 0; i < 19; i++) await createProfile(ctx, 'east', fields())
    const { early, result } = await whileConcurrentInsert(ctx, false, () =>
      createProfile(ctx, 'east', fields()),
    )
    expect(early).toBe('blocked')
    expect(result).toMatchObject({ ok: false, error: { code: 'PROFILE_LIMIT' } })
    const [count] = await sql<
      { n: number }[]
    >`select count(*)::int as n from birth_profile where user_id = ${ctx.userId}`
    expect(count?.n).toBe(20)
    await expect(createProfile(ctx, 'east', fields())).rejects.toMatchObject({
      code: 'PROFILE_LIMIT',
      status: 409,
    })
  })

  it('并发的首次新建：后到的一份等待锁，不会成为第二份默认档案', async () => {
    const ctx = await account()
    const { early, result } = await whileConcurrentInsert(ctx, true, () =>
      createProfile(ctx, 'east', fields()),
    )
    expect(early).toBe('blocked')
    expect(result).toMatchObject({ ok: true, value: { isDefault: false } })
  })

  it('设为默认后只有一份默认；删除默认档案后转给最近更新的一份', async () => {
    const ctx = await account()
    const first = await createProfile(ctx, 'east', fields('family', '1'))
    const second = await createProfile(ctx, 'east', fields('family', '2'))
    const third = await createProfile(ctx, 'east', fields('family', '3'))
    await setDefaultProfile(ctx, third.id)
    const listed = await listProfiles(ctx)
    expect(listed.filter((p) => p.isDefault).map((p) => p.id)).toEqual([third.id])
    // 切换默认不改变列表顺序
    expect(listed.map((p) => p.id)).toEqual([third.id, second.id, first.id])
    // first 最近修改过，删除默认（third）后应转给 first
    await updateProfile(ctx, 'east', first.id, fields('family', '1b'))
    await deleteProfile(ctx, third.id)
    const after = await listProfiles(ctx)
    expect(after.map((p) => p.id)).toEqual([first.id, second.id])
    expect(after.find((p) => p.isDefault)?.id).toBe(first.id)
    expect(await sql`select id from birth_profile where id = ${third.id}`).toHaveLength(0)
  })

  it('西方站档案只填日期即可保存；东方站规则拒绝同样的资料', async () => {
    const ctx = await account('west')
    const birth = { ...BIRTH, time: null, gender: null, location: null }
    const profile = await createProfile(ctx, 'west', {
      relation: 'self',
      birth,
      fullName: 'Hélène Dupont',
    })
    expect(profile).toMatchObject({ birth, fullName: 'Hélène Dupont' })
    await expect(createProfile(ctx, 'east', { relation: 'friend', birth })).rejects.toMatchObject({
      code: 'INVALID_PROFILE',
    })
  })
})

describe('删号清除出生档案', () => {
  it('删号后该用户档案为 0，另一站同邮箱账户的档案保留', async () => {
    const email = `${newId()}@profiles-deletion.example`
    const west = await account('west', email)
    const east = await account('east', email)
    for (let i = 0; i < 3; i++) {
      await createProfile(west, 'west', { relation: 'friend', birth: { ...BIRTH, gender: null } })
    }
    await createProfile(east, 'east', fields())
    await sql.begin((tx) =>
      workspaceContentDeletionStep.execute?.(
        { actorUserId: west.userId, workspaceIds: [west.workspaceId], db },
        tx,
      ),
    )
    expect(await sql`select id from birth_profile where user_id = ${west.userId}`).toHaveLength(0)
    expect(await sql`select id from birth_profile where user_id = ${east.userId}`).toHaveLength(1)
  })
})
