import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { brandChartColors } from '../../../../scripts/brand-tokens.ts'
import { templateConfig } from '../../../server/template-config.ts'
import { collectText } from '../../share-cards/renderer.ts'
import { LIFE_PATH_NUMBERS, lifePathPath, NUMEROLOGY_TOOLS } from '../../tools/numerology/routes.ts'
import { shareUrl } from '../../tools/share.ts'
import { localizedPath, ogImagePath, pageHead } from '../metadata.ts'
import { findPublicPage, publicPages } from '../pages.ts'
import { type OgSampleChart, ogSampleChart } from './pages.ts'
import { ogSampleElement } from './render.tsx'
import { splitChartText } from './svg-text.ts'

const content = { posts: [], legal: [], docs: [] }
const config = { ...templateConfig, marketing: { ...templateConfig.marketing, enabled: true } }
// 构建期另由内容集合补入西方站数字命理页面（工具内页与 12 个数字页），这里按注册表补齐用于对照
const numerologyPages = [
  ...Object.values(NUMEROLOGY_TOOLS).map((tool) => ({
    path: tool.path,
    locale: 'en',
    title: tool.title,
    description: tool.description,
  })),
  ...LIFE_PATH_NUMBERS.map((value) => ({
    path: lifePathPath(value),
    locale: 'en',
    title: `Life Path ${value}`,
    description: `Life Path ${value}`,
  })),
]
const pages = publicPages({ ...content, toolPages: numerologyPages }, new Date(), config)

/**
 * 登记页面：主工具页（东方站八字排盤 / 만세력、西方站 Life Path）、紫微、命盤查詢与数字图表页。
 * 样例图随注册表挂到工具页，语言首页沿用默认分享图（separate-landing-homepage OQ8）。
 */
const REGISTERED: Record<string, OgSampleChart> = {
  'zh-Hant /八字排盤': 'pillars',
  'zh-Hans /八字排盘': 'pillars',
  'ko /만세력': 'pillars',
  'zh-Hant /命盤查詢': 'pillars',
  'zh-Hans /命盘查询': 'pillars',
  'zh-Hant /紫微斗數排盤': 'ziwei',
  'zh-Hans /紫微斗数排盘': 'ziwei',
  'en /life-path-number': 'life-path',
  'en /numerology-chart': 'digit-grid',
}

const ogImage = (head: ReturnType<typeof pageHead>) =>
  head.meta.find((item) => 'property' in item && item.property === 'og:image')?.content

describe('样例 OG 模板只用于登记页面（tasks 8.2）', () => {
  it('公开页面中使用样例模板的恰好是登记的首页与工具页', () => {
    const used = Object.fromEntries(
      pages.flatMap((page) => {
        const chart = ogSampleChart(page)
        return chart ? [[`${page.locale} ${page.path}`, chart]] : []
      }),
    )
    expect(used).toEqual(REGISTERED)
    // 其他页面（定价、FAQ、塔罗、合婚、数字命理其他页与数字页）沿用默认版式
    for (const [locale, path] of [
      ['en', '/'],
      ['zh-Hant', '/'],
      ['ko', '/'],
      ['en', '/pricing'],
      ['en', '/faq'],
      ['en', '/numerology-calculator'],
      ['en', '/life-path-number/3'],
      ['ko', '/사주궁합'],
      ['zh-Hant', '/faq'],
      ['zh-Hant', '/numerology-chart'],
    ] as const)
      expect(ogSampleChart({ locale, path }), `${locale} ${path}`).toBeUndefined()
  })

  it('百分号编码与末尾斜杠的路径按同一页面识别', () => {
    expect(ogSampleChart({ locale: 'zh-Hant', path: encodeURI('/紫微斗數排盤') })).toBe('ziwei')
    expect(ogSampleChart({ locale: 'en', path: '/numerology-chart/' })).toBe('digit-grid')
  })
})

describe('带 #r= 的分享链接与工具页使用同一张分享图（tasks 8.2）', () => {
  const origin = 'https://seo.example'
  for (const key of Object.keys(REGISTERED)) {
    it(key, () => {
      const [locale = '', path = ''] = key.split(' ')
      const page = pages.find((entry) => entry.locale === locale && entry.path === path)
      if (!page) throw new Error(`缺少公开页面 ${key}`)
      const pageUrl = new URL(localizedPath(page.path, page.locale), origin).href
      const link = new URL(
        shareUrl(pageUrl, { date: '1990-05-15', time: '10:30', gender: 'male', name: '王小明' }),
      )
      expect(link.hash).toMatch(/^#r=/)
      // 片段不随请求发送：服务端（预渲染与 SSR）只按路径找到同一页面，生成同一份 head
      const requested = findPublicPage(pages, decodeURIComponent(link.pathname))
      expect(requested).toBe(page)
      const toolImage = ogImage(pageHead(page, origin))
      expect(ogImage(pageHead(requested ?? page, origin))).toBe(toolImage)
      // 预览图就是构建期为该页面生成的样例模板 PNG，地址不含访客输入
      expect(decodeURIComponent(new URL(toolImage ?? '').pathname)).toBe(ogImagePath(page))
      expect(toolImage).not.toMatch(/r=|1990|%E7%8E%8B/)
    })
  }
})

describe('样例 OG 模板内容（tasks 8.1）', () => {
  const site = { brand: { name: '干支日' }, host: 'ganjiday.com' }
  const render = (chart: OgSampleChart, locale: 'zh-Hant' | 'ko' | 'en') => {
    const colors = brandChartColors(locale === 'en' ? 'west-light' : 'east-light')
    const element = ogSampleElement({
      chart,
      locale,
      title: '標題',
      meta: '干支日 · 標語',
      ...site,
      colors,
    })
    return { colors, text: collectText(element), markup: renderToStaticMarkup(element) }
  }

  it('含标题、站名、域名、当前语言的「示例」角标与样例图形', () => {
    const { text, markup, colors } = render('pillars', 'zh-Hant')
    for (const part of ['標題', '干支日', 'ganjiday.com', '示例', '庚', '辰', '日主']) {
      expect(text).toContain(part)
    }
    expect(markup).toContain('data:image/svg+xml;base64,')
    // 颜色来自 brand.css 解析（东方站浅色）
    expect(markup).toContain(`background:${colors.bg}`)
    expect(render('pillars', 'ko').text).toContain('예시')
    expect(render('life-path', 'en').text).toContain('Sample')
  })

  it('嵌入的 SVG 只有线框与色块，文字全部由外层排版（D6 回退）', () => {
    for (const [chart, locale] of [
      ['pillars', 'zh-Hant'],
      ['ziwei', 'zh-Hant'],
      ['life-path', 'en'],
      ['digit-grid', 'en'],
    ] as const) {
      const { markup } = render(chart, locale)
      const uri = markup.match(/data:image\/svg\+xml;base64,([^"]+)/)?.[1] ?? ''
      const svg = new TextDecoder().decode(Uint8Array.from(atob(uri), (c) => c.charCodeAt(0)))
      expect(svg, chart).toMatch(/^<svg /)
      expect(svg, chart).not.toMatch(/<text|<title|var\(--/)
    }
  })

  it('紫微样例图形的宫名与生命灵数结果都在外层文字中', () => {
    expect(render('ziwei', 'zh-Hant').text).toContain('命宮')
    expect(render('life-path', 'en').text).toContain('3')
  })
})

describe('图形标记拆分', () => {
  const markup =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100" role="img" class="chart-frame" style="aspect-ratio:200 / 100">' +
    '<title id="t">標題</title><rect x="0" y="0" width="10" height="10" style="fill:#000"/>' +
    '<text x="100" y="40" text-anchor="middle" style="fill:#111;font-size:20px;font-weight:600">A &amp; B</text>' +
    '<text x="10" y="80" style="fill:#222;font-size:16px">05 → <tspan style="fill:#333;font-weight:600">5</tspan></text>' +
    '<text x="50" y="50" style="fill:#444;font-size:10px"><tspan x="50" dy="4">需要</tspan><tspan x="50" dy="14">時辰</tspan></text>' +
    '</svg>'

  it('文字移出 SVG 并保留坐标、对齐、颜色与分段', () => {
    const split = splitChartText(markup)
    expect(split.size).toEqual({ width: 200, height: 100 })
    expect(split.shapes).not.toMatch(/<text|<title|class=|role=|style="aspect/)
    expect(split.shapes).toContain('<rect')
    expect(split.texts).toEqual([
      {
        x: 100,
        y: 40,
        anchor: 'middle',
        size: 20,
        color: '#111',
        weight: 600,
        runs: [{ text: 'A & B' }],
      },
      {
        x: 10,
        y: 80,
        anchor: 'start',
        size: 16,
        color: '#222',
        weight: undefined,
        runs: [
          { text: '05 → ' },
          { text: '5', color: '#333', weight: 600, size: undefined, dx: undefined },
        ],
      },
      expect.objectContaining({ x: 50, y: 54, runs: [expect.objectContaining({ text: '需要' })] }),
      expect.objectContaining({ x: 50, y: 68, runs: [expect.objectContaining({ text: '時辰' })] }),
    ])
  })
})
