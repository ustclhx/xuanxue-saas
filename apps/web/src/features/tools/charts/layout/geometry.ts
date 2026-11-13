// 图形布局的通用几何（design D3「layout/*.ts」）：纯函数，不计算命理、不访问浏览器 API，
// 各图形组的布局函数（四柱、十二宫、数字网格等）在此基础上把引擎结果转成坐标与文字，单元测试直接断言输出。

/** viewBox 坐标系中的矩形 */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** 图形的 viewBox 尺寸：固定宽高比，渲染宽度变化时等比缩放，不引起布局位移 */
export interface ChartSize {
  width: number
  height: number
}

export function insetBox(box: Box, inset: number | { x: number; y: number }): Box {
  const dx = typeof inset === 'number' ? inset : inset.x
  const dy = typeof inset === 'number' ? inset : inset.y
  return {
    x: box.x + dx,
    y: box.y + dy,
    width: Math.max(0, box.width - 2 * dx),
    height: Math.max(0, box.height - 2 * dy),
  }
}

export function boxCenter(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * 把矩形按行列等分为单元格（行优先），单元格之间留 gap。
 * 四柱、数字网格与十二宫外圈都可由它得到格子位置。
 */
export function gridCells(box: Box, columns: number, rows: number, gap = 0): Box[] {
  if (columns < 1 || rows < 1) return []
  const width = (box.width - gap * (columns - 1)) / columns
  const height = (box.height - gap * (rows - 1)) / rows
  const cells: Box[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({
        x: box.x + column * (width + gap),
        y: box.y + row * (height + gap),
        width,
        height,
      })
    }
  }
  return cells
}

/**
 * 图形以 `renderedWidth` 像素宽显示时，viewBox 中字号 `fontSize` 折算的实际像素。
 * 用于校验最小字号约束（如紫微盘在 358px 可用宽度下不低于 11px，design D4）。
 */
export function renderedFontPx(size: ChartSize, renderedWidth: number, fontSize: number): number {
  return (fontSize * renderedWidth) / size.width
}

/** 要在 `renderedWidth` 下达到 `minPx` 像素，viewBox 中需要的最小字号 */
export function minViewBoxFont(size: ChartSize, renderedWidth: number, minPx: number): number {
  return (minPx * size.width) / renderedWidth
}
