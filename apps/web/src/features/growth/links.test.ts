import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { growthLink } from './links.ts'

const ctx = (appUrl: string) => ({ appUrl, config: templateConfig, site: 'west' as const })

describe('growthLink', () => {
  it('生产按订阅者站点取规范域名，记录无站点时取当前请求站点', () => {
    const production = ctx('https://arcanumber.com')
    expect(growthLink(production, '/api/newsletter/confirm', 'east').href).toBe(
      'https://ganjiday.com/api/newsletter/confirm',
    )
    expect(growthLink(production, '/api/newsletter/unsubscribe', null).origin).toBe(
      'https://arcanumber.com',
    )
    expect(growthLink({ ...production, site: 'east' }, '/x', 'bogus').origin).toBe(
      'https://ganjiday.com',
    )
  })

  it('预览与本地地址不跨站，保持 APP_URL', () => {
    expect(
      growthLink(ctx('https://xuanxue-web-staging.example.workers.dev'), '/x', 'east').origin,
    ).toBe('https://xuanxue-web-staging.example.workers.dev')
    expect(growthLink(ctx('http://localhost:3000'), '/x', 'east').origin).toBe(
      'http://localhost:3000',
    )
  })
})
