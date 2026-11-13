import { AppError } from '@xuanxue/shared'
import { describe, expect, it } from 'vitest'
import { profileFailureFields } from './service.ts'

// tasks.md 3.5：档案写入失败时的日志字段白名单，不含出生资料与姓名。
const ALLOWED = new Set(['action', 'profileId', 'code', 'errorName', 'dbCode', 'constraint'])

describe('profileFailureFields', () => {
  it('drizzle 包装的数据库错误：只记录错误名、错误码与约束名，不带 SQL 参数', () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint_name: 'birth_profile_user_self_uq',
      detail: 'Key (user_id)=(…) already exists.',
    })
    const error = Object.assign(
      new Error(
        'Failed query: insert into "birth_profile" … params: {"year":1990,"month":5},Hélène Dupont',
      ),
      { name: 'DrizzleQueryError', cause },
    )
    const fields = profileFailureFields('create', error)
    expect(fields).toEqual({
      action: 'create',
      errorName: 'DrizzleQueryError',
      dbCode: '23505',
      constraint: 'birth_profile_user_self_uq',
    })
    for (const key of Object.keys(fields)) expect(ALLOWED.has(key)).toBe(true)
    const text = JSON.stringify(fields)
    for (const secret of ['1990', 'Hélène', 'params', 'Failed query']) {
      expect(text).not.toContain(secret)
    }
  })

  it('业务错误只记录错误码与档案 id', () => {
    const error = new AppError('INVALID_PROFILE', 'Invalid birth profile', {
      status: 400,
      details: { issues: [{ field: 'gender', code: 'required' }] },
    })
    const fields = profileFailureFields('update', error, '0190a000-0000-7000-8000-000000000001')
    expect(fields).toEqual({
      action: 'update',
      profileId: '0190a000-0000-7000-8000-000000000001',
      code: 'INVALID_PROFILE',
    })
    for (const key of Object.keys(fields)) expect(ALLOWED.has(key)).toBe(true)
  })
})
