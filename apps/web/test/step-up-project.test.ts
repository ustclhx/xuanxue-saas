import { user } from '@xuanxue/db'
import { newId } from '@xuanxue/shared'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  stepUpBrandName,
  stepUpEmailBrand,
  stepUpVerificationColumns,
} from '../src/features/admin/step-up/step-up.project.ts'
import { createAdminTestDb } from './admin-test-resources.ts'

// 项目扩展点（模板 0.10.1 step-up.project.ts）：两站账户隔离下，verification 行带账户站点，
// 验证码邮件按请求 Host 用本站品牌，品牌名按收件人语言本地化。

const db = createAdminTestDb()
const id = newId()
const defaults = { appName: 'Arcanumber', appUrl: 'https://arcanumber.com' }

afterAll(async () => {
  await db.delete(user).where(eq(user.id, id))
  await db.$client.end()
})

describe('step-up 项目扩展点', () => {
  it('verification 附加列取管理员账户所在站点；找不到用户时不追加', async () => {
    await db.insert(user).values({
      id,
      site: 'east',
      name: 'East admin',
      email: `${id}@step-up-project.example`,
      role: 'admin',
    })
    const request = new Request('https://ganjiday.com/admin')
    expect(await stepUpVerificationColumns(id, { db, request })).toEqual({ site: 'east' })
    expect(await stepUpVerificationColumns(newId(), { db, request })).toEqual({})
  })

  it('邮件品牌按请求 Host 选站点，并按收件人语言本地化', () => {
    const east = stepUpEmailBrand(defaults, {
      db,
      request: new Request('https://ganjiday.com/admin'),
    })
    expect(east).toEqual({ appName: 'Ganjiday', appUrl: defaults.appUrl })
    expect(stepUpBrandName(east, 'east', 'zh-Hant')).toBe('干支日')
    expect(stepUpBrandName(east, 'east', null)).toBe('Ganjiday')
    const west = stepUpEmailBrand(defaults, {
      db,
      request: new Request('https://arcanumber.com/admin'),
    })
    expect(stepUpBrandName(west, 'west', 'en')).toBe('Arcanumber')
  })
})
