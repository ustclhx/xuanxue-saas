import { describe, expect, it } from 'vitest'
import { boxCenter, gridCells, insetBox, minViewBoxFont, renderedFontPx } from './geometry.ts'

describe('图形几何', () => {
  it('按行优先等分单元格并留间距', () => {
    const cells = gridCells({ x: 10, y: 0, width: 130, height: 50 }, 4, 1, 10)
    expect(cells.map((cell) => [cell.x, cell.width])).toEqual([
      [10, 25],
      [45, 25],
      [80, 25],
      [115, 25],
    ])
    expect(gridCells({ x: 0, y: 0, width: 40, height: 40 }, 2, 2)[3]).toEqual({
      x: 20,
      y: 20,
      width: 20,
      height: 20,
    })
    expect(gridCells({ x: 0, y: 0, width: 1, height: 1 }, 0, 1)).toEqual([])
  })

  it('内缩与中心点', () => {
    const box = insetBox({ x: 0, y: 0, width: 100, height: 60 }, { x: 10, y: 5 })
    expect(box).toEqual({ x: 10, y: 5, width: 80, height: 50 })
    expect(boxCenter(box)).toEqual({ x: 50, y: 30 })
    expect(insetBox({ x: 0, y: 0, width: 4, height: 4 }, 3).width).toBe(0)
  })

  it('字号折算：viewBox 宽 716、显示宽 358 时 22 号字为 11px', () => {
    const size = { width: 716, height: 716 }
    expect(renderedFontPx(size, 358, 22)).toBe(11)
    expect(minViewBoxFont(size, 358, 11)).toBe(22)
  })
})
