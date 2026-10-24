import { describe, expect, it } from 'vitest'
import { signInDestination } from '../auth/auth-client.ts'
import { safeReturnPath } from './return-path.ts'

const locales = ['en', 'zh-Hant', 'ko']

describe('登录与支付后的回跳地址（specs/multi-site「账号与付费跨站可用」）', () => {
  it('接受本站页面的相对路径与简单查询串', () => {
    for (const path of ['/', '/ko/', '/zh-hant/bazi', '/ko/manseryeok?checkout=success', '/app'])
      expect(safeReturnPath(path, locales)).toBe(path)
  })

  it('拒绝其他 Host、协议相对地址、反斜杠与片段', () => {
    for (const path of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/ko/#r=abc',
      '/ko/?next=https://evil.example',
      'ko/',
      '',
      undefined,
      `/${'a'.repeat(1100)}`,
    ])
      expect(safeReturnPath(path, locales)).toBeUndefined()
  })

  it('认证页、接口与内部路径不作为回跳目标，带语言前缀时同样排除', () => {
    for (const path of [
      '/login',
      '/ko/login',
      '/zh-hant/register',
      '/api/auth/sign-out',
      '/_serverFn/x',
    ])
      expect(safeReturnPath(path, locales)).toBeUndefined()
  })

  it('登录页 redirect：保留账号页与邀请规则，新增本站页面，其余回到当前语言的首页', () => {
    const search = (redirect: string) => `?redirect=${encodeURIComponent(redirect)}`
    const home = '/ko'
    expect(signInDestination(search('/account'), home)).toBe('/account')
    expect(signInDestination(search('/ko/manseryeok'), home)).toBe('/ko/manseryeok')
    expect(signInDestination(search('/app?returnTo=%2Fko%2F'), home)).toBe('/app?returnTo=%2Fko%2F')
    expect(signInDestination(search('/accept-invitation?id=nope'), home)).toBe('/ko')
    expect(signInDestination(search('//evil.example'), home)).toBe('/ko')
    expect(signInDestination('', home)).toBe('/ko')
    expect(signInDestination('')).toBe('/')
  })
})
