import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { NUMEROLOGY_ROUTES } from '../tools/numerology/routes.ts'
import { TOOL_ROUTES } from '../tools/registry.ts'
import { TAROT_MEANING_ROUTES } from '../tools/tarot/meaning-routes.ts'
import { isPrerenderedPath, prerenderEntryPages } from './prerender.ts'

const locales = ['en', 'zh-Hant', 'ko']

describe('预渲染范围（tasks.md 3.1、3.3）', () => {
  it('首页、博客、法律页与文档在各语言下都预渲染', () => {
    for (const path of [
      '/',
      '/zh-hant',
      '/ko/',
      '/blog',
      '/blog/welcome',
      '/zh-hant/blog/tags/guide',
    ]) {
      expect(isPrerenderedPath(path, locales), path).toBe(true)
    }
    for (const path of ['/refund', '/ko/privacy', '/docs', '/zh-hant/docs/configuration']) {
      expect(isPrerenderedPath(path, locales), path).toBe(true)
    }
  })

  it('依赖数据库或会话的页面不预渲染', () => {
    for (const path of [
      '/pricing',
      '/ko/pricing',
      '/login',
      '/app',
      '/blogger',
      '/fr/blog',
      '/zh/blog',
    ]) {
      expect(isPrerenderedPath(path, locales), path).toBe(false)
    }
  })

  it('入口为各语言首页：默认语言无前缀，其他语言使用小写前缀', () => {
    // 批量内容页另由 numerology/seo.test.ts 与 tarot/meanings.test.ts 验证完整性
    const tools = TOOL_ROUTES.filter(
      (tool) => !NUMEROLOGY_ROUTES.includes(tool) && !TAROT_MEANING_ROUTES.includes(tool),
    )
    expect(prerenderEntryPages(templateConfig, tools)).toEqual([
      { path: '/_site/east' },
      { path: '/zh-hant' },
      // 东方站排盘工具（TOOL_ROUTES，openspec add-bazi-saju-chart）
      { path: '/zh-hant/紫微斗數排盤' },
      { path: '/zh-hant/命盤查詢' },
      // 塔罗牌阵（openspec add-tarot-reading）
      { path: '/zh-hant/塔羅' },
      { path: '/zh-hant/塔羅/每日一張' },
      { path: '/zh-hant/塔羅/是非' },
      { path: '/zh-hant/塔羅/凱爾特十字' },
      { path: '/zh-hant/八字/大運' },
      { path: '/zh-hant/八字/喜用神' },
      { path: '/zh-hant/八字/五行' },
      { path: '/zh-hant/八字/身強身弱' },
      { path: '/zh-hant/八字/空亡' },
      { path: '/zh-hant/八字/神煞' },
      { path: '/zh-hant/八字/八字重量' },
      { path: '/zh-hant/八字/十神' },
      { path: '/ko' },
      { path: '/ko/사주궁합' },
      { path: '/ko/타로' },
      { path: '/ko/타로/오늘의-카드' },
      { path: '/ko/타로/예-아니오' },
      { path: '/ko/타로/켈틱-크로스' },
      { path: '/ko/사주/대운' },
      { path: '/ko/사주/용신' },
      { path: '/ko/사주/오행' },
      { path: '/ko/사주/신강신약' },
      { path: '/ko/사주/공망' },
      { path: '/ko/사주/신살' },
      { path: '/ko/사주/십신' },
      { path: '/ko/사주/일주' },
      { path: '/' },
      { path: '/tarot' },
      { path: '/tarot/daily' },
      { path: '/tarot/yes-or-no' },
      { path: '/tarot/celtic-cross' },
    ])
  })
})

it('工具注册点支持异名与编码路径，并按站点注册入口', () => {
  const tools = [
    { id: 'bazi', site: 'east' as const, paths: { 'zh-Hant': '/八字排盤/', ko: '/' }, titles: {} },
  ]
  expect(prerenderEntryPages(templateConfig, tools)).toContainEqual({ path: '/zh-hant/八字排盤/' })
  expect(isPrerenderedPath('/zh-hant/%E5%85%AB%E5%AD%97%E6%8E%92%E7%9B%A4/', locales, tools)).toBe(
    true,
  )
  expect(isPrerenderedPath('/ko/八字排盤', locales, tools)).toBe(false)
  expect(isPrerenderedPath('/zh-hant/八字排盤/guide', locales, tools)).toBe(true)
  expect(isPrerenderedPath('/ko/login', locales, tools)).toBe(false)
  expect(isPrerenderedPath('/_site/east', locales)).toBe(true)
})
