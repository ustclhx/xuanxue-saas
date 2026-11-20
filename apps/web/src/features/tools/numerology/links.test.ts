import { describe, expect, it } from 'vitest'
import { neighborNumbers, relatedNumerologyLinks } from './copy.ts'
import { LIFE_PATH_NUMBERS, NUMEROLOGY_TOOLS, type NumerologyToolId } from './routes.ts'

// 内链规则（openspec refresh-visual-system-warm，设计稿 warm-refresh/Proposals79.dc.html C、D 表）：
// 数字页在句子里链接 2–3 个相邻数字，工具内页页尾只列 3–4 个相关工具。
describe('数字命理内链', () => {
  it('1–9 首尾相接取前后各一个，大师数取另外两个大师数与根数', () => {
    expect(neighborNumbers(1)).toEqual({ pair: [9, 2] })
    expect(neighborNumbers(7)).toEqual({ pair: [6, 8] })
    expect(neighborNumbers(9)).toEqual({ pair: [8, 1] })
    expect(neighborNumbers(11)).toEqual({ pair: [22, 33], root: 2 })
    expect(neighborNumbers(22)).toEqual({ pair: [11, 33], root: 4 })
    expect(neighborNumbers(33)).toEqual({ pair: [11, 22], root: 6 })
    for (const value of LIFE_PATH_NUMBERS) {
      const { pair, root } = neighborNumbers(value)
      const linked = [...pair, ...(root ? [root] : [])]
      expect(linked).not.toContain(value)
      expect(new Set(linked).size).toBe(linked.length)
      for (const other of linked) expect(LIFE_PATH_NUMBERS).toContain(other)
    }
  })

  it('工具内页只列 3–4 个相关工具，不链接自己', () => {
    for (const id of Object.keys(NUMEROLOGY_TOOLS) as NumerologyToolId[]) {
      const links = relatedNumerologyLinks(id)
      expect(links.length).toBeGreaterThanOrEqual(3)
      expect(links.length).toBeLessThanOrEqual(4)
      expect(links.map((link) => link.target)).not.toContain(id)
      expect(new Set(links.map((link) => link.href)).size).toBe(links.length)
    }
  })
})
