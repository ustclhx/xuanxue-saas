import type { SiteId } from '@xuanxue/config'
import { newId } from '@xuanxue/shared'
import { afterAll, describe, expect, it } from 'vitest'
import { factsOfPanel } from '../src/features/daily/daily-context.ts'
import { dailyContext } from '../src/features/daily/subject.ts'
import { loadTodayPanel } from '../src/features/daily/today.server.ts'
import { createProfile, type ProfileContext } from '../src/features/profiles/service.ts'
import { readShareFragment } from '../src/features/tools/share.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// add-birth-profiles-daily-horoscope tasks 8.1–8.3：今日面板的档案选择、越权、状态与派生上下文
const db = createAdminTestDb()
const sql = db.$client
const created: string[] = []
const DATE = { year: 2026, month: 11, day: 13 }

const BIRTH = {
  calendar: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  time: { hour: 10, minute: 30 },
  gender: 'male',
  location: { city: 'taipei' },
}

async function account(site: SiteId) {
  const id = newId()
  created.push(id)
  await sql`insert into "user" (id,name,email,site) values (${id},'Daily',${`${id}@daily.example`},${site})`
  await sql`insert into organization (id,name,slug,is_personal,site) values (${id},'Daily',${id},true,${site})`
  return { db, workspaceId: id, userId: id } satisfies ProfileContext
}

afterAll(async () => {
  if (created.length === 0) return
  await sql`delete from birth_profile where workspace_id in ${sql(created)}`
  await sql`delete from organization where id in ${sql(created)}`
  await sql`delete from "user" where id in ${sql(created)}`
})

const east = (ctx: ProfileContext, profileId?: string) =>
  loadTodayPanel(ctx, { site: 'east', locale: 'zh-Hant', date: DATE, profileId })

describe('今日面板', () => {
  it('没有档案时为空态', async () => {
    const ctx = await account('east')
    expect(await east(ctx)).toEqual({ state: 'empty', date: '2026-11-13' })
  })

  it('默认档案的今日十神与地支关系；工具链接片段不含姓名', async () => {
    const ctx = await account('east')
    const mine = await createProfile(ctx, 'east', { label: '我', relation: 'self', birth: BIRTH })
    const panel = await east(ctx)
    if (panel.state !== 'ok' || panel.site !== 'east') throw new Error('expected ok')
    expect(panel.selectedId).toBe(mine.id)
    expect(panel.personal.dayMaster).toBe(panel.natal.dayMaster)
    expect(panel.copy.tip.theme.length).toBeGreaterThan(0)
    const shared = readShareFragment(new URL(panel.toolHref, 'https://ganjiday.com').hash)
    expect(shared).toMatchObject({ year: '1990', month: '5', day: '15' })
    expect(Object.keys(shared ?? {}).some((key) => /name/i.test(key))).toBe(false)
  })

  it('?profile= 为他人的档案时按不存在处理，回到自己的默认档案', async () => {
    const a = await account('east')
    const b = await account('east')
    const own = await createProfile(a, 'east', { label: 'A', relation: 'self', birth: BIRTH })
    const theirs = await createProfile(b, 'east', {
      label: 'B',
      relation: 'self',
      birth: { ...BIRTH, year: 1985 },
    })
    const panel = await east(a, theirs.id)
    expect(panel.state).toBe('ok')
    if (panel.state !== 'ok') return
    expect(panel.selectedId).toBe(own.id)
    expect(panel.profiles.map((profile) => profile.id)).toEqual([own.id])
    // 非法 id 同样回到默认档案
    expect((await east(a, 'not-a-uuid')).state).toBe('ok')
  })

  it('可切换到其他档案；缺少性别的档案提示补全', async () => {
    const ctx = await account('east')
    await createProfile(ctx, 'east', { label: '我', relation: 'self', birth: BIRTH })
    // 西方站规则允许没有性别与出生地的档案；直接写入同一空间模拟缺字段
    const partial = await createProfile(ctx, 'west', {
      label: '家人',
      relation: 'family',
      birth: { ...BIRTH, gender: null, location: null },
    })
    const panel = await east(ctx, partial.id)
    expect(panel).toMatchObject({ state: 'missing', selectedId: partial.id })
    if (panel.state === 'missing') expect(panel.missing).toEqual(['gender', 'location'])
  })

  it('西方站：个人年、月、日；链接片段不含全名', async () => {
    const ctx = await account('west')
    await createProfile(ctx, 'west', {
      label: null,
      relation: 'self',
      birth: { ...BIRTH, gender: null, location: null, time: null },
      fullName: 'Jane Example',
    })
    const panel = await loadTodayPanel(ctx, { site: 'west', locale: 'en', date: DATE })
    if (panel.state !== 'ok' || panel.site !== 'west') throw new Error('expected ok')
    expect(panel.personal.personalDay.value).toBe(9)
    expect(panel.toolHref).toMatch(/^\/numerology-calculator#r=/)
    const shared = readShareFragment(new URL(panel.toolHref, 'https://arcanumber.com').hash)
    expect(shared).toEqual({ date: '1990-05-15' })
  })

  it('问 AI 的上下文只含派生事实，不含出生日期、出生地或姓名', async () => {
    const ctx = await account('east')
    await createProfile(ctx, 'east', {
      label: '王小明',
      relation: 'self',
      birth: { ...BIRTH, location: { utcOffsetMinutes: 480, longitude: 121.5 } },
    })
    const panel = await east(ctx)
    if (panel.state !== 'ok') throw new Error('expected ok')
    // 说明文字会提到「不含出生日期」，只检查结构化数据与说明中的具体值
    const context = dailyContext(factsOfPanel(panel))
    const text = JSON.stringify(context.data)
    expect(context.text).not.toContain('1990')
    for (const forbidden of ['1990', '王小明', 'taipei', '121.5', 'utcOffset', 'birth'])
      expect(text).not.toContain(forbidden)
    const west = await account('west')
    await createProfile(west, 'west', {
      label: null,
      relation: 'self',
      birth: { ...BIRTH, gender: null, location: null },
      fullName: 'Jane Example',
    })
    const westPanel = await loadTodayPanel(west, { site: 'west', locale: 'en', date: DATE })
    if (westPanel.state !== 'ok') throw new Error('expected ok')
    const westText = JSON.stringify(dailyContext(factsOfPanel(westPanel)).data)
    for (const forbidden of ['1990', 'Jane', '"birth"']) expect(westText).not.toContain(forbidden)
  })
})
