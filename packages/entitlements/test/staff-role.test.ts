import { describe, expect, it } from 'vitest'
import { hasPlatformAdminRole } from '../src/index.ts'

describe('平台管理员角色判断', () => {
  it('与 admin 守卫一致：支持逗号分隔的多个角色', () => {
    expect(hasPlatformAdminRole('admin')).toBe(true)
    expect(hasPlatformAdminRole('user,admin')).toBe(true)
    expect(hasPlatformAdminRole(' admin ')).toBe(true)
    expect(hasPlatformAdminRole('user')).toBe(false)
    expect(hasPlatformAdminRole(null)).toBe(false)
  })
})
