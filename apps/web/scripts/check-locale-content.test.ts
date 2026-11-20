import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkLocaleContent, japaneseTextIssue } from './check-locale-content.mjs'

const sites = {
  east: { locales: ['zh-Hant', 'zh-Hans', 'ko', 'ja'] },
  west: { locales: ['en', 'es'] },
}
let root: string

function write(path: string, body: string) {
  const file = join(root, 'content', path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body)
}

const ja = (title: string) =>
  `---\ntitle: ${title}\ndescription: 太陽のカードの意味を正位置と逆位置で解説します。\n---\n\n太陽は明るさと成功を表すカードです。正位置では物事が順調に進みます。\n`

function writeJaLegal() {
  for (const page of ['privacy', 'terms']) write(`legal/east/ja/${page}.mdx`, ja('プライバシー'))
  write('legal/shared/ja/operator.mdx', ja('運営者'))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'xuanxue-locale-content-'))
  for (const card of ['the-sun', 'the-moon']) write(`tarot/en/${card}.mdx`, 'en')
  for (const slug of ['life-path-1', 'destiny-number']) write(`numerology/en/${slug}.mdx`, 'en')
  for (const page of ['privacy', 'terms']) {
    write(`legal/west/en/${page}.mdx`, 'en')
    write(`legal/east/zh-Hant/${page}.mdx`, '繁中')
  }
  write('legal/shared/en/operator.mdx', 'en')
  write('legal/shared/zh-Hant/operator.mdx', '繁中')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('新语言内容完整性（tasks 1.5）', () => {
  it('没有已配置的新语言时不检查', () => {
    expect(checkLocaleContent({ root, locales: [], sites })).toEqual([])
  })

  it('缺条目时列出语言、集合与条目；数字命理只要求西方站语言', () => {
    write('tarot/es/the-sun.mdx', 'es')
    write('tarot/ja/the-sun.mdx', ja('太陽'))
    const problems = checkLocaleContent({ root, locales: ['es', 'ja'], sites })
    expect(problems).toContain(`es: 缺少 tarot 条目 the-moon（${join(root, 'content/tarot/es')}）`)
    expect(problems.some((p) => p.startsWith('es: 缺少 numerology 条目 life-path-1'))).toBe(true)
    expect(problems.some((p) => p.startsWith('es: 缺少 legal 条目 privacy'))).toBe(true)
    expect(problems.some((p) => p.startsWith('es: 缺少 legal/shared 条目 operator'))).toBe(true)
    expect(problems.some((p) => p.startsWith('ja: 缺少 numerology'))).toBe(false)
    // 东方站法律页以繁中为原文
    expect(problems.some((p) => p.startsWith('ja: 缺少 legal 条目 terms'))).toBe(true)
  })

  it('条目齐全且 ja 正文为日文时通过', () => {
    for (const card of ['the-sun', 'the-moon']) write(`tarot/ja/${card}.mdx`, ja('太陽'))
    writeJaLegal()
    expect(checkLocaleContent({ root, locales: ['ja'], sites })).toEqual([])
  })

  it('ja 以英文或中文正文回退时失败', () => {
    writeJaLegal()
    write(
      'tarot/ja/the-sun.mdx',
      '---\ntitle: The Sun\n---\n\nThe Sun is a card of joy and success.\n',
    )
    write(
      'tarot/ja/the-moon.mdx',
      '---\ntitle: 月亮\n---\n\n月亮牌代表不安與直覺，正位時提醒你留意情緒。\n',
    )
    const problems = checkLocaleContent({ root, locales: ['ja'], sites })
    expect(problems.some((p) => p.includes('the-sun.mdx 正文不含假名'))).toBe(true)
    expect(problems.some((p) => p.includes('the-moon.mdx 正文不含假名'))).toBe(true)
  })
})

describe('日文正文检测', () => {
  it('日文通过；英文、中文与拉丁字母过多的混排失败', () => {
    expect(japaneseTextIssue(ja('太陽'))).toBeNull()
    expect(japaneseTextIssue('Love and career readings for the Sun card.')).toBe('正文不含假名')
    expect(japaneseTextIssue('太陽牌象徵成功與喜悅，正位時一切順利。')).toBe('正文不含假名')
    expect(
      japaneseTextIssue('The Sun card means joy, success and vitality in every reading の'),
    ).toMatch(/拉丁字母比例/)
    // 链接地址、标签与代码中的拉丁字母不计
    expect(
      japaneseTextIssue(
        '[太陽のカード](/ja/タロット/カード/the-sun)は<strong>成功</strong>を表します。',
      ),
    ).toBeNull()
  })
})
