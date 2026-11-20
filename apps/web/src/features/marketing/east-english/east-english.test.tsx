import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Route } from '../../../routes/en.tsx'
import { sitemapLocales } from '../../seo/crawlers.ts'
import { SiteContext } from '../../site/context.tsx'
import { EAST_ENGLISH_COPY } from './content.ts'
import { eastEnglishHead, eastEnglishSitemap } from './head.ts'
import { EastEnglishPage } from './page.tsx'

// 东方站 `/en` 英文入口页（openspec product-improve-ai-content-20261030 tasks.md 4.8）。
// 守卫层的 200 / 404 见 features/site/site.test.ts；这里验证页面内容、head 与 en 子站点地图。
const html = renderToString(
  <SiteContext value="east">
    <EastEnglishPage />
  </SiteContext>,
)
const text = html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/g, ' ')
  .trim()

describe('东方站英文入口页', () => {
  it('英文说明不少于 600 词，H1 与标题不以 AI 为卖点，含合规声明', () => {
    expect(text.split(/\s+/).filter((word) => /[A-Za-z]/.test(word)).length).toBeGreaterThan(600)
    expect(html).toContain(`<h1`)
    expect(EAST_ENGLISH_COPY.heading).not.toMatch(/\bAI\b/)
    expect(EAST_ENGLISH_COPY.title).not.toMatch(/\bAI\b/)
    expect(text).not.toMatch(/\bAI\b/)
    expect(text).toContain('reference and self-reflection only')
    expect(text).toContain('do not predict the future')
    for (const system of ['Bazi', 'Zi Wei Dou Shu', 'Saju', 'Tarot']) expect(text).toContain(system)
  })

  it('正文共 5 条链接：只链接东方站的繁中、简体与韩语页面，锚文本为原文主关键词', () => {
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((match) => [
      match[1],
      match[2],
    ])
    // 设计稿 warm-refresh/EastEn.dc.html：每个体系一条 + 简体中文入口一条；语言切换在页头与页脚
    expect(links).toEqual([
      [encodeURI('/zh-hant/八字排盤'), '八字排盤'],
      ['/zh-hans', '简体中文'],
      [encodeURI('/zh-hant/紫微斗數排盤'), '紫微斗數排盤'],
      [encodeURI('/ko/만세력'), '만세력'],
      [encodeURI('/zh-hant/塔羅'), '三張牌塔羅'],
    ])
    expect(html).toContain('hrefLang="zh-Hant" lang="zh-Hant"')
    expect(html).not.toMatch(/\]\(\w+\)/)
    expect(html).not.toMatch(/arcanumber/i)
  })

  it('head：东方站 canonical，可索引，hreflang 与东方站三种语言首页互指', () => {
    const head = eastEnglishHead()
    expect(Route.options.head?.({} as never)).toEqual(head)
    expect(head.meta).toContainEqual({ title: `${EAST_ENGLISH_COPY.title} | Ganjiday` })
    expect(head.meta.some((meta) => 'name' in meta && meta.name === 'robots')).toBe(false)
    expect(head.links).toEqual([
      // 使用者 2026-11-20：东方站英文首页对外地址为 `/`（原 /en 301 过来）
      { rel: 'canonical', href: 'https://ganjiday.com/' },
      { rel: 'alternate', hrefLang: 'en', href: 'https://ganjiday.com/' },
      { rel: 'alternate', hrefLang: 'zh-Hant', href: 'https://ganjiday.com/zh-hant' },
      { rel: 'alternate', hrefLang: 'zh-Hans', href: 'https://ganjiday.com/zh-hans' },
      { rel: 'alternate', hrefLang: 'ko', href: 'https://ganjiday.com/ko' },
      // x-default 为英文首页 `/`（两站默认语言都是英语，`/` 不再跳转）
      { rel: 'alternate', hrefLang: 'x-default', href: 'https://ganjiday.com/' },
    ])
    expect(JSON.stringify(head)).not.toContain('arcanumber.com')
  })

  it('东方站索引含 en 子图，且只有入口页一条 URL', () => {
    expect(sitemapLocales('east')).toEqual(['zh-Hant', 'zh-Hans', 'ko', 'en'])
    expect(sitemapLocales('west')).toEqual(['en'])
    const xml = eastEnglishSitemap()
    expect(xml.match(/<loc>/g)).toHaveLength(1)
    expect(xml).toContain('<loc>https://ganjiday.com/</loc>')
    expect(xml).not.toContain('arcanumber.com')
  })
})
