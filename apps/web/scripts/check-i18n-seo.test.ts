import { describe, expect, it } from 'vitest'
import {
  analyzeI18nSeo,
  type I18nPage,
  type I18nVariant,
  parseI18nHead,
} from './check-i18n-seo.mjs'

const E = 'https://ganjiday.com'
const group = [
  ['en', `${E}/`],
  ['zh-Hant', `${E}/zh-hant`],
  ['x-default', `${E}/`],
] as const

function page(
  url: string,
  lang: string,
  alternates: readonly (readonly [string, string])[] = group,
) {
  return {
    status: 200,
    location: null,
    setCookie: '',
    xRobots: null,
    lang,
    canonical: [url],
    alternates: alternates.map(([l, h]) => [l, h] as [string, string]),
    robots: null,
    langQueryLinks: 0,
    prompt: false,
  }
}

const ok = (): {
  sitemap: string[]
  pages: Record<string, I18nPage>
  variants: Record<string, I18nVariant[]>
} => ({
  sitemap: [`${E}/`, `${E}/zh-hant`],
  pages: { [`${E}/`]: page(`${E}/`, 'en'), [`${E}/zh-hant`]: page(`${E}/zh-hant`, 'zh-Hant') },
  variants: {
    'east.localhost/': [
      { language: null, status: 200, location: null, body: 'a' },
      { language: 'ko-KR', status: 200, location: null, body: 'a' },
    ],
  },
})

describe('多语言 SEO 验收（ML 规范「六、验收」）', () => {
  it('符合规范的站点没有违规', () => {
    expect(analyzeI18nSeo(ok())).toEqual([])
  })

  it('按 Accept-Language 跳转或返回不同内容（ML-02）', () => {
    const input = ok()
    input.variants['east.localhost/'] = [
      { language: null, status: 301, location: '/zh-hant', body: '' },
      { language: 'ko-KR', status: 302, location: '/ko', body: '' },
    ]
    const problems = analyzeI18nSeo(input)
    expect(problems.filter((p) => p.startsWith('ML-02')).length).toBe(3)
  })

  it('canonical 不指向自身、x-default 重复、html lang 不一致、不互指、跨域名（ML-04、ML-05）', () => {
    const input = ok()
    const hant = input.pages[`${E}/zh-hant`]
    if (!hant) throw new Error('fixture')
    hant.canonical = [`${E}/`]
    hant.lang = 'en'
    hant.alternates = [
      ...hant.alternates,
      ['x-default', `${E}/zh-hant`],
      ['ko', 'https://arcanumber.com/ko'],
    ]
    const problems = analyzeI18nSeo(input).join('\n')
    expect(problems).toContain('ML-04 canonical 不是自身')
    expect(problems).toContain('ML-05 x-default 有 2 条')
    expect(problems).toContain('ML-02 html lang=en 与页面语言 zh-Hant 不一致')
    expect(problems).toContain('ML-05 hreflang 跨域名')
    expect(problems).toContain('ML-05 hreflang 不互指')
  })

  it('hreflang 指向不存在的页面、站点地图与可索引页面不一致、语言 Cookie、服务端提示（ML-03～ML-06）', () => {
    const input = ok()
    input.pages[`${E}/ko`] = { ...page(`${E}/ko`, 'ko'), status: 404 }
    const home = input.pages[`${E}/`]
    if (!home) throw new Error('fixture')
    home.alternates = [...home.alternates, ['ko', `${E}/ko`]]
    home.setCookie = 'PARAGLIDE_LOCALE=en; Path=/'
    home.prompt = true
    input.pages[`${E}/pricing`] = page(`${E}/pricing`, 'en', [
      ['en', `${E}/pricing`],
      ['x-default', `${E}/pricing`],
    ])
    input.sitemap.push(`${E}/missing`)
    const problems = analyzeI18nSeo(input).join('\n')
    expect(problems).toContain(`ML-05 hreflang 指向不存在或不可索引的页面：${E}/ → ko ${E}/ko`)
    expect(problems).toContain(`ML-06 可索引页面不在站点地图：${E}/pricing`)
    expect(problems).toContain(`ML-06 站点地图地址未抓取：${E}/missing`)
    expect(problems).toContain('ML-04 公开页面写入语言 Cookie')
    expect(problems).toContain('ML-03 服务端 HTML 含语言提示')
  })

  it('解析 html lang、canonical、hreflang、robots 与 ?lang= 链接', () => {
    const head = parseI18nHead(
      '<html lang="zh-Hant" data-site="east"><head><link rel="canonical" href="https://ganjiday.com/zh-hant"/>' +
        '<link rel="alternate" hrefLang="en" href="https://ganjiday.com/"/><meta name="robots" content="noindex"/>' +
        '</head><body><a href="/x?lang=ko">x</a></body></html>',
    )
    expect(head).toEqual({
      lang: 'zh-Hant',
      canonical: ['https://ganjiday.com/zh-hant'],
      alternates: [['en', 'https://ganjiday.com/']],
      robots: 'noindex',
      langQueryLinks: 1,
      prompt: false,
    })
  })
})
