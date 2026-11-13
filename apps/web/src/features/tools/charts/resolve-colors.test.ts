import { describe, expect, it } from 'vitest'
import { CHART_COLOR_SLOTS, TOKEN_COLORS } from './colors.ts'
import { inlineTokenColors, resolveChartColors } from './resolve-colors.ts'

// 模拟浏览器在当前主题下对 token 的求值
const theme: Record<string, string> = {
  'var(--surface)': 'rgb(255, 253, 248)',
  'var(--surface-2)': 'rgb(236, 229, 214)',
  'var(--ink)': 'rgb(31, 28, 24)',
}
const probe = (value: string) => theme[value] ?? `resolved(${value})`

describe('浏览器端颜色解析', () => {
  it('逐个颜色槽求值，覆盖值也经过求值', () => {
    const resolved = resolveChartColors(probe, { accent: 'var(--ink)' })
    expect(Object.keys(resolved)).toEqual(CHART_COLOR_SLOTS)
    expect(resolved.surface).toBe('rgb(255, 253, 248)')
    expect(resolved.accent).toBe('rgb(31, 28, 24)')
    expect(resolved.line).toBe('resolved(var(--line))')
  })

  it('把标记中的 token 替换为实际颜色，--surface 与 --surface-2 不互相误替换，字体变量保留', () => {
    const resolved = resolveChartColors(probe)
    const markup = `<rect style="fill:${TOKEN_COLORS.surface}"/><rect style="fill:${TOKEN_COLORS.surface2}"/><text style="fill:${TOKEN_COLORS.ink};font-family:var(--site-font-body)">庚</text>`
    expect(inlineTokenColors(markup, resolved)).toBe(
      '<rect style="fill:rgb(255, 253, 248)"/><rect style="fill:rgb(236, 229, 214)"/><text style="fill:rgb(31, 28, 24);font-family:var(--site-font-body)">庚</text>',
    )
  })
})
