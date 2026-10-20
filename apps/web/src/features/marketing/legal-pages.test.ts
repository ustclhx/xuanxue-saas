import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEGAL_SLUGS, SUPPORT_EMAIL_TOKEN } from './legal-tokens.ts'

// 内容集合遇到 MDX 错误只记录并跳过文档，构建不会失败：读取 typecheck / build-content 实际生成的集合，
// 确认四个法律页都生成了
const allLegalPages = JSON.parse(
  readFileSync(
    new URL('../../../.content-collections/generated/allLegalPages.js', import.meta.url),
    'utf8',
  )
    .replace(/^\s*export default\s*/, '')
    .trim()
    .replace(/;$/, ''),
) as { slug: string; locale: string; html: string }[]

describe('法律页内容', () => {
  it('英文四页全部生成，联系邮箱保留为按站点替换的标记', () => {
    const english = allLegalPages.filter((page) => page.locale === 'en')
    expect(english.map((page) => page.slug).sort()).toEqual([...LEGAL_SLUGS].sort())
    for (const slug of ['privacy', 'terms', 'refund'])
      expect(english.find((page) => page.slug === slug)?.html).toContain(SUPPORT_EMAIL_TOKEN)
    expect(allLegalPages.every((page) => page.locale === 'en')).toBe(true)
  })
})
