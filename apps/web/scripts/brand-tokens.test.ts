import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CHART_TOKENS } from '../src/features/tools/charts/colors.ts'
import { brandChartColors, themeProperties } from './brand-tokens.ts'

// 以视觉规范为准核对 brand.css 的解析结果（tasks 3.2）：OG 样例图形的颜色必须与页面一致
const doc = readFileSync(new URL('../../../docs/design/visual-system.md', import.meta.url), 'utf8')

/** 视觉规范「设计 token」表：token → [东方站, 西方站] */
function tokenTable() {
  const rows = new Map<string, [string, string]>()
  for (const [, token = '', east = '', west = ''] of doc.matchAll(
    /^\| `(--[\w-]+)` \| `(#[\dA-Fa-f]{6})`[^|]* \| `(#[\dA-Fa-f]{6})`[^|]* \|$/gm,
  ))
    rows.set(token, [east.toLowerCase(), west.toLowerCase()])
  return rows
}

const slotOf = (token: string) =>
  Object.entries(CHART_TOKENS).find(([, name]) => name === token)?.[0] as keyof typeof CHART_TOKENS

describe('brand.css 构建期解析', () => {
  it('东方站浅色与西方站的颜色等于视觉规范 token 表', () => {
    const table = tokenTable()
    expect(table.size).toBeGreaterThanOrEqual(11)
    const east = brandChartColors('east-light')
    const west = brandChartColors('west')
    for (const [token, [eastValue, westValue]] of table) {
      const slot = slotOf(token)
      expect(slot, token).toBeTruthy()
      expect(east[slot], `east ${token}`).toBe(eastValue)
      expect(west[slot], `west ${token}`).toBe(westValue)
    }
  })

  it('东方站深色等于视觉规范的暗色基准，未覆盖的 token 沿用浅色', () => {
    const baseline = doc.match(
      /`--bg:(#\w+)`、`--surface:(#\w+)`、`--ink:(#\w+)`、`--line:(#\w+)`[^`]*朱砂提亮为 `(#\w+)`/,
    )
    expect(baseline).toBeTruthy()
    const [, bg, surface, ink, line, accent] = (baseline ?? []).map((v) => v.toLowerCase())
    const dark = brandChartColors('east-dark')
    expect([dark.bg, dark.surface, dark.ink, dark.line, dark.accent]).toEqual([
      bg,
      surface,
      ink,
      line,
      accent,
    ])
    expect(dark.onAccent).toBe(brandChartColors('east-light').onAccent)
  })

  it('五行色两站共用，等于视觉规范', () => {
    const line = doc.match(/金 `(#\w+)`、木 `(#\w+)`、水 `(#\w+)`、火 `(#\w+)`、土 `(#\w+)`/)
    const [, metal, wood, water, fire, earth] = (line ?? []).map((v) => v.toLowerCase())
    for (const theme of ['east-light', 'east-dark', 'west'] as const) {
      const colors = brandChartColors(theme)
      expect([colors.metal, colors.wood, colors.water, colors.fire, colors.earth], theme).toEqual([
        metal,
        wood,
        water,
        fire,
        earth,
      ])
    }
  })

  it('展开 var() 引用，后出现的选择器覆盖先出现的', () => {
    const css = `:root[data-site] { --a: var(--b); --c: x; }
:root[data-site="east"], :root[data-site="west"] { --b: #111111; }
:root.dark[data-site="east"] { --b: #222222; --c: var(--missing, y); }`
    expect(themeProperties(css, 'east-light').get('--a')).toBe('#111111')
    expect(themeProperties(css, 'east-dark').get('--a')).toBe('#222222')
    expect(themeProperties(css, 'east-dark').get('--c')).toBe('y')
    expect(themeProperties(css, 'west').get('--c')).toBe('x')
  })
})
