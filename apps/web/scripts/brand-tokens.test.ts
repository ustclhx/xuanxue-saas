import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SITE_THEMES } from '../src/features/share-cards/share-cards.sites.ts'
import { CHART_TOKENS } from '../src/features/tools/charts/colors.ts'
import {
  BRAND_THEMES,
  type BrandTheme,
  brandChartColors,
  contrastRatio,
  readBrandCss,
  themeProperties,
} from './brand-tokens.ts'

// 以视觉规范为准核对 brand.css 的解析结果（redesign-home-chart-visuals 3.2、refresh-visual-system-warm 3.2）：
// OG 样例图形、分享卡与页面的颜色只有 brand.css 一个来源，四套主题的对比度在这里守住。
const doc = readFileSync(new URL('../../../docs/design/visual-system.md', import.meta.url), 'utf8')
const css = readBrandCss()
const HEX = '`(#[\\dA-Fa-f]{6})`'

/** 视觉规范「两站共用的 token」表：token → [浅色, 深色] */
function sharedTable() {
  const rows = new Map<string, [string, string]>()
  for (const [, token = '', light = '', dark = ''] of doc.matchAll(
    new RegExp(`^\\| \`(--[\\w-]+)\` \\| ${HEX} \\| ${HEX} \\|$`, 'gm'),
  ))
    rows.set(token, [light.toLowerCase(), dark.toLowerCase()])
  return rows
}

/** 视觉规范「按站点不同的 token」表：token → 四套主题的值 */
function siteTable() {
  const rows = new Map<string, Record<BrandTheme, string>>()
  for (const [, token = '', ...values] of doc.matchAll(
    new RegExp(`^\\| \`(--[\\w-]+)\` \\| ${HEX} \\| ${HEX} \\| ${HEX} \\| ${HEX} \\|$`, 'gm'),
  )) {
    const [eastLight = '', eastDark = '', westLight = '', westDark = ''] = values.map((value) =>
      value.toLowerCase(),
    )
    rows.set(token, {
      'east-light': eastLight,
      'east-dark': eastDark,
      'west-light': westLight,
      'west-dark': westDark,
    })
  }
  return rows
}

const token = (theme: BrandTheme, name: string) => {
  const value = themeProperties(css, theme).get(name)
  if (!value) throw new Error(`brand.css 在 ${theme} 主题下缺少 ${name}`)
  return value
}

describe('brand.css 构建期解析', () => {
  it('四套主题的共用 token 等于视觉规范表', () => {
    const table = sharedTable()
    expect(table.size).toBeGreaterThanOrEqual(22)
    for (const theme of BRAND_THEMES)
      for (const [name, [light, dark]] of table)
        expect(token(theme, name), `${theme} ${name}`).toBe(theme.endsWith('dark') ? dark : light)
  })

  it('按站点不同的 token 等于视觉规范表', () => {
    const table = siteTable()
    expect([...table.keys()]).toEqual(['--accent', '--illus'])
    for (const theme of BRAND_THEMES)
      for (const [name, values] of table)
        expect(token(theme, name), `${theme} ${name}`).toBe(values[theme])
  })

  it('图形颜色槽在四套主题下都能解析为颜色', () => {
    for (const theme of BRAND_THEMES) {
      const colors = brandChartColors(theme)
      for (const [slot, name] of Object.entries(CHART_TOKENS))
        expect(colors[slot as keyof typeof CHART_TOKENS], `${theme} ${name}`).toMatch(
          /^#[\da-f]{6}$/,
        )
    }
  })

  it('展开 var() 引用，后出现的选择器覆盖先出现的', () => {
    const sample = `:root[data-site] { --a: var(--b); --c: x; }
:root[data-site="east"], :root[data-site="west"] { --b: #111111; }
:root.dark[data-site] { --c: z; }
:root.dark[data-site="east"] { --b: #222222; --c: var(--missing, y); }`
    expect(themeProperties(sample, 'east-light').get('--a')).toBe('#111111')
    expect(themeProperties(sample, 'east-dark').get('--a')).toBe('#222222')
    expect(themeProperties(sample, 'east-dark').get('--c')).toBe('y')
    expect(themeProperties(sample, 'west-light').get('--c')).toBe('x')
    expect(themeProperties(sample, 'west-dark').get('--c')).toBe('z')
  })
})

describe('四套主题的对比度（WCAG 2.1 AA）', () => {
  const grounds = ['--bg', '--surface', '--surface-2']

  it.each(BRAND_THEMES)('%s：文字在三种底上不低于 4.5:1', (theme) => {
    for (const text of ['--ink', '--ink-muted', '--ink-subtle', '--accent-ink', '--danger'])
      for (const ground of grounds)
        expect(
          contrastRatio(token(theme, text), token(theme, ground)),
          `${text} on ${ground}`,
        ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(BRAND_THEMES)('%s：按钮与反色块上的文字不低于 4.5:1', (theme) => {
    for (const [text, fill] of [
      ['--primary-foreground', '--primary'],
      ['--on-accent', '--accent'],
      ['--on-inverse', '--inverse'],
      ['--on-danger', '--danger'],
    ] as const)
      expect(
        contrastRatio(token(theme, text), token(theme, fill)),
        `${text} on ${fill}`,
      ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(BRAND_THEMES)('%s：输入框线、强调色与焦点环不低于 3:1', (theme) => {
    for (const mark of ['--field-border', '--accent', '--focus-ring'])
      for (const ground of grounds)
        expect(
          contrastRatio(token(theme, mark), token(theme, ground)),
          `${mark} on ${ground}`,
        ).toBeGreaterThanOrEqual(3)
  })

  it.each(BRAND_THEMES)('%s：焦点环与主按钮之间隔着页面底色，页面底与主按钮不低于 3:1', (theme) => {
    // 焦点环与主按钮同为文字色，靠外移后露出的页面底色分开（design.md D14「焦点环」）
    expect(token(theme, '--focus-ring')).toBe(token(theme, '--ink'))
    expect(contrastRatio(token(theme, '--bg'), token(theme, '--primary'))).toBeGreaterThanOrEqual(3)
  })

  it.each(BRAND_THEMES)('%s：五行色在三种底上不低于 3:1', (theme) => {
    for (const element of ['--wx-wood', '--wx-fire', '--wx-earth', '--wx-metal', '--wx-water'])
      for (const ground of grounds)
        expect(
          contrastRatio(token(theme, element), token(theme, ground)),
          `${element} on ${ground}`,
        ).toBeGreaterThanOrEqual(3)
  })

  it('对比度函数：黑白为 21:1，同色为 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#16181b', '#16181b')).toBe(1)
  })
})

describe('分享卡配色与 brand.css 一致（各站默认主题：浅色）', () => {
  it.each([
    ['east', 'east-light'],
    ['west', 'west-light'],
  ] as const)('%s', (site, theme) => {
    const card = SITE_THEMES[site]
    expect(card.background).toBe(token(theme, '--bg'))
    expect(card.foreground).toBe(token(theme, '--ink'))
    expect(card.muted).toBe(token(theme, '--surface-2'))
    expect(card.secondary).toBe(token(theme, '--surface-2'))
    expect(card.mutedForeground).toBe(token(theme, '--ink-subtle'))
    expect(card.primary).toBe(token(theme, '--primary'))
    expect(card.primaryText).toBe(token(theme, '--accent-ink'))
    expect(card.primaryForeground).toBe(token(theme, '--primary-foreground'))
    expect(card.brandAccent).toBe(token(theme, '--accent'))
    expect(card.border).toBe(token(theme, '--line'))
  })
})
