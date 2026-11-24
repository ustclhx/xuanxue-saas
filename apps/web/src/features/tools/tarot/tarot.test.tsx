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

  it('hreflang 只在同站内互指（D5）：西方站英语与西语互指，东方站各语言与东方站英文牌阵页互指', () => {
    for (const spread of TAROT_SPREADS)
      for (const locale of ['en', 'zh-Hant', 'ko'] as const) {
        const links = alternateLinks('', tarotPath(spread, locale), undefined, undefined, locale)
        const href = (lang: string) => links.find((link) => link.hrefLang === lang)?.href
        const en = `https://arcanumber.com${encodeURI(tarotPath(spread, 'en'))}`
        if (locale === 'en') {
          expect(href('en')).toBe(en)
          expect(href('es')).toBe(`https://arcanumber.com/es${encodeURI(tarotPath(spread, 'es'))}`)
          expect(href('zh-Hant')).toBeUndefined()
          expect(href('x-default')).toBe(en)
          continue
        }
        // 东方站页面的 en 是东方站根路径英文牌阵页（2026-11-21 发布），不是西方站页面
        expect(href('en')).toBe(`https://ganjiday.com${tarotPath(spread, 'en', 'east')}`)
        expect(href('zh-Hant')).toBe(
          `https://ganjiday.com/zh-hant${encodeURI(tarotPath(spread, 'zh-Hant'))}`,
        )
        expect(href('ko')).toBe(`https://ganjiday.com/ko${encodeURI(tarotPath(spread, 'ko'))}`)
        // x-default 为同一牌阵的东方站英文版本，不是会跳转的根路径
        expect(href('x-default')).toBe(href('en'))
        expect(links.every((link) => link.href.startsWith('https://ganjiday.com/'))).toBe(true)
      }
  })

  it('站点地图与预渲染按所属站点收录 12 个牌阵页与牌义索引页', () => {
    const west = publicPages(noContent, new Date(), templateConfig, 'west')
    const east = publicPages(noContent, new Date(), templateConfig, 'east')
    const tarot = (pages: typeof west) =>
      pages.filter((page) => /^\/(tarot|塔羅|타로)(?:\/[^/]+)?$/.test(page.path)).map((p) => p.path)
    // 4 个牌阵页加 1 个牌义索引页（/tarot/cards）；西班牙语共用 `/tarot` 路径段（/tarot/cartas 等），
    // 公开页面清单含未发布语言（站点地图另按发布状态过滤）；东方站这里只数繁中与韩语。
    // 西方站另有 3 个 en 主题牌阵页（content-growth-v2-tools 第 28 组）
    expect(tarot(west)).toHaveLength(13)
    expect(tarot(west)).toEqual(
      expect.arrayContaining(['/tarot/love', '/tarot/career', '/tarot/full-moon']),
    )
    expect(tarot(west)).toContain('/tarot/cartas')
    expect(tarot(east)).toHaveLength(10)
    expect(tarot(west)).toContain('/tarot/cards')
    expect(tarot(east)).toContain('/塔羅/牌義')
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

  it('服务端输出 H1、收起的问句模板、正文内的牌阵与牌义索引链接、不能问的问题、牌位说明与 FAQ', () => {
    const html = render('three-card')
    expect(html).toMatch(/<h1[^>]*>Free Tarot Reading: Three-Card Spread<\/h1>/)
    // 问句模板收在 <details> 里（默认收起），页面上只有「洗牌」一个主按钮
    const templates = html.slice(html.indexOf('<details'), html.indexOf('</details>'))
    expect(templates).not.toContain('<details open')
    expect(templates.match(/<button type="button"/g)).toHaveLength(6)
    expect(html.match(/<button[^>]*bg-primary/g)).toHaveLength(1)
    // 正文内链：导语 1 条（牌义索引）+「其他牌阵」3 条，都是服务端输出的 <a>，锚文本为目标页主关键词
    const main = html.slice(html.indexOf('<h1'))
    const links = [...main.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(
      ([, href, text]) => [href, text],
    )
    expect(links).toEqual([
      ['/tarot/cards', 'tarot card meanings'],
      ['/tarot/daily', 'tarot card of the day'],
      ['/tarot/yes-or-no', 'yes or no tarot'],
      ['/tarot/celtic-cross', 'Celtic Cross tarot'],
    ])
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
