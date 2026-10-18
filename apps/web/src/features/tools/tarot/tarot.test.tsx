import { CARDS, encodeReading } from '@xuanxue/tarot'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../../server/template-config.ts'
import { prerenderEntryPages } from '../../marketing/prerender.ts'
import { alternateLinks } from '../../seo/metadata.ts'
import { publicPages } from '../../seo/pages.ts'
import { SiteContext } from '../../site/context.tsx'
import { toolsForLocale } from '../registry.ts'
import { encodeShareInput } from '../share.ts'
import { spreadForSlug, TAROT_SPREADS, TAROT_TOOL_ROUTES, tarotPath } from './routes.ts'
import { sharedReading, TarotSpreadPage } from './tarot-page.tsx'

const noContent = { posts: [], legal: [], docs: [] }

describe('塔罗路由', () => {
  it('三语路径与子路径只在本语言匹配', () => {
    expect(tarotPath('three-card', 'en')).toBe('/tarot')
    expect(tarotPath('celtic-cross', 'zh-Hant')).toBe('/塔羅/凱爾特十字')
    expect(tarotPath('yes-or-no', 'ko')).toBe('/타로/예-아니오')
    expect(spreadForSlug('en')).toBe('three-card')
    expect(spreadForSlug('ko', '오늘의-카드')).toBe('daily')
    expect(spreadForSlug('en', '每日一張')).toBeUndefined()
    expect(spreadForSlug('zh-Hant', 'daily')).toBeUndefined()
  })

  it('每个牌阵在两站各登记一条，页头只出现主牌阵一次', () => {
    expect(TAROT_TOOL_ROUTES).toHaveLength(TAROT_SPREADS.length * 2)
    for (const locale of ['en', 'zh-Hant', 'ko'])
      expect(toolsForLocale(locale, TAROT_TOOL_ROUTES).map((tool) => tool.id)).toEqual([
        'tarot-three-card',
      ])
  })

  it('三语 hreflang 跨站互指，x-default 指向西方站英语页', () => {
    for (const spread of TAROT_SPREADS)
      for (const locale of ['en', 'zh-Hant', 'ko'] as const) {
        const links = alternateLinks('', tarotPath(spread, locale), undefined, undefined, locale)
        const href = (lang: string) => links.find((link) => link.hrefLang === lang)?.href
        expect(href('en')).toBe(`https://xuanxue-west.example${encodeURI(tarotPath(spread, 'en'))}`)
        expect(href('zh-Hant')).toBe(
          `https://xuanxue-east.example/zh-hant${encodeURI(tarotPath(spread, 'zh-Hant'))}`,
        )
        expect(href('ko')).toBe(
          `https://xuanxue-east.example/ko${encodeURI(tarotPath(spread, 'ko'))}`,
        )
        expect(href('x-default')).toBe(href('en'))
      }
  })

  it('站点地图与预渲染按所属站点收录 12 个牌阵页', () => {
    const west = publicPages(noContent, new Date(), templateConfig, 'west')
    const east = publicPages(noContent, new Date(), templateConfig, 'east')
    const tarot = (pages: typeof west) =>
      pages.filter((page) => /^\/(tarot|塔羅|타로)/.test(page.path)).map((p) => p.path)
    expect(tarot(west)).toHaveLength(4)
    expect(tarot(east)).toHaveLength(8)
    expect(tarot(east)).toContain('/타로/켈틱-크로스')
    const entries = prerenderEntryPages(templateConfig).map((entry) => entry.path)
    expect(entries).toEqual(
      expect.arrayContaining(['/tarot', '/tarot/daily', '/zh-hant/塔羅/是非', '/ko/타로']),
    )
  })
})

describe('分享结果', () => {
  const reading = {
    spread: 'three-card' as const,
    cards: [
      { cardId: 'major-17', reversed: false },
      { cardId: 'cups-03', reversed: true },
      { cardId: 'major-19', reversed: false },
    ],
  }
  const hash = (value: string) => `#r=${encodeShareInput({ reading: value })}`

  it('同一牌阵的分享片段还原同一组牌', () => {
    expect(sharedReading(hash(encodeReading(reading)), 'three-card')).toEqual(reading)
  })

  it('牌阵不一致、重复牌或截断时视为无效，没有片段时为空', () => {
    expect(sharedReading(hash(encodeReading(reading)), 'daily')).toBe('invalid')
    expect(sharedReading(hash('three-card:major-17,major-17,cups-03'), 'three-card')).toBe(
      'invalid',
    )
    expect(sharedReading('#r=@@', 'three-card')).toBe('invalid')
    expect(sharedReading('', 'three-card')).toBeNull()
  })
})

describe('TarotSpreadPage', () => {
  const render = (spread: (typeof TAROT_SPREADS)[number]) =>
    renderToString(
      <SiteContext value="west">
        <TarotSpreadPage spread={spread} locale="en" />
      </SiteContext>,
    )

  it('服务端输出 H1、问句模板、互导矩阵、不能问的问题、牌位说明与 FAQ', () => {
    const html = render('three-card')
    expect(html).toMatch(/<h1[^>]*>Free Three-Card Tarot<\/h1>/)
    expect(html.match(/<button type="button"[^>]*rounded-full/g)).toHaveLength(6)
    expect(html).toContain('href="/tarot/daily"')
    expect(html).toContain('href="/tarot/yes-or-no"')
    expect(html).toContain('href="/tarot/celtic-cross"')
    expect(html).not.toContain('href="/tarot"')
    expect(html).toContain('What not to ask')
    expect(html).toContain('Health or medical questions')
    expect(html).toContain('Experiences that shaped the question.')
    expect(html).toContain('<details')
    expect(html).toContain('type="submit"')
  })

  it('首屏只有内联牌背，不加载牌面图片', () => {
    for (const spread of TAROT_SPREADS) {
      const html = render(spread)
      expect(html).not.toContain('<img')
      expect(html).toContain('<svg viewBox="0 0 44 44"')
    }
    expect(CARDS.every((card) => card.image.small.startsWith('/tarot/'))).toBe(true)
  })

  it('凯尔特十字铺出 10 个牌位', () => {
    expect(render('celtic-cross').match(/data-testid="tarot-slot"/g)).toHaveLength(10)
  })
})
