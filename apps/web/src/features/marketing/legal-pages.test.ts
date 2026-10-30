import { readFileSync } from 'node:fs'
import { SITE_IDS } from '@xuanxue/config'
import { describe, expect, it } from 'vitest'
import { templateConfig } from '../../server/template-config.ts'
import { findLegalPage } from './content.ts'
import { LEGAL_SLUGS, SUPPORT_EMAIL_TOKEN } from './legal-tokens.ts'

// 内容集合遇到 MDX 错误只记录并跳过文档，构建不会失败：读取 typecheck / build-content 实际生成的集合，
// 确认每个站点每种语言的四个法律页都生成了
function generated<T>(name: string): T[] {
  return JSON.parse(
    readFileSync(
      new URL(`../../../.content-collections/generated/${name}.js`, import.meta.url),
      'utf8',
    )
      .replace(/^\s*export default\s*/, '')
      .trim()
      .replace(/;$/, ''),
  ) as T[]
}

const allLegalPages = generated<{ site: string; slug: string; locale: string; html: string }>(
  'allLegalPages',
)
const allLegalShareds = generated<{ _meta: { path: string }; content: string }>('allLegalShareds')

function page(site: string, locale: string, slug: string) {
  const found = findLegalPage(allLegalPages, { site, locale, slug, defaultLocale: 'en' })
  if (!found || found.locale !== locale) throw new Error(`Missing ${site}/${locale}/${slug}`)
  return found
}

/** 去掉标签与实体后的纯文本，用于和共享段落的源文本比对 */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
}

describe('法律页内容（按站点）', () => {
  it('每个站点的每种语言都有四页原文，联系邮箱保留为按站点替换的标记', () => {
    for (const site of SITE_IDS)
      for (const locale of templateConfig.sites[site].locales) {
        for (const slug of LEGAL_SLUGS) expect(page(site, locale, slug).site).toBe(site)
        for (const slug of ['privacy', 'terms', 'refund'])
          expect(page(site, locale, slug).html).toContain(SUPPORT_EMAIL_TOKEN)
      }
    const expected = SITE_IDS.flatMap((site) => templateConfig.sites[site].locales).length
    expect(allLegalPages).toHaveLength(expected * LEGAL_SLUGS.length)
  })

  it('西方站只描述数字命理与塔罗，东方站描述八字与紫微', () => {
    for (const slug of LEGAL_SLUGS)
      expect(page('west', 'en', slug).html).not.toMatch(/Bazi|Saju|Ziwei/)
    expect(page('west', 'en', 'privacy').html).toContain('numerology and tarot')
    expect(page('east', 'zh-Hant', 'privacy').html).toMatch(/八字.*紫微/)
    expect(page('east', 'zh-Hans', 'privacy').html).toMatch(/八字.*紫微/)
    expect(page('east', 'ko', 'privacy').html).toMatch(/사주.*자미두수/)
  })

  it('隐私、条款与退款页都含两站共用的运营主体段落（同一来源）', () => {
    for (const site of SITE_IDS)
      for (const locale of templateConfig.sites[site].locales) {
        const shared = allLegalShareds.find((entry) => entry._meta.path.startsWith(`${locale}/`))
        if (!shared) throw new Error(`Missing shared operator notice for ${locale}`)
        // 段落中的联系邮箱在构建期换成按站点替换的标记，其余文字与源文件一致
        const source = shared.content.replace('{{supportEmail}}', SUPPORT_EMAIL_TOKEN)
        const expected = text(source.replace(/\*\*/g, '')).trim()
        for (const slug of ['privacy', 'terms', 'refund'])
          expect(text(page(site, locale, slug).html)).toContain(expected)
      }
    expect(text(page('west', 'en', 'privacy').html)).toMatch(
      /Ganjiday \(ganjiday\.com\) and Arcanumber \(arcanumber\.com\) are two sites operated by the same/,
    )
  })

  it('站点缺少某种语言时回退到同站点默认语言，不借用另一站点的正文', () => {
    const lookup = (site: string, locale: string) =>
      findLegalPage(allLegalPages, { site, locale, slug: 'privacy', defaultLocale: 'en' })
    expect(lookup('west', 'fr')?.site).toBe('west')
    expect(lookup('east', 'ja')).toBeUndefined()
  })
})
