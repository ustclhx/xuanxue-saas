import { gzipSync } from 'node:zlib'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StemWheel } from './east/stem-wheel.tsx'
import { NumberWheel } from './west/number-wheel.tsx'

// refresh-visual-system-warm D8：内联 SVG、颜色只经 token、对读屏隐藏、单个母题 gzip ≤ 4KB
describe.each([
  ['东方站天干轮', StemWheel, ['fill-mark', 'fill-on-mark']],
  ['西方站数字轮', NumberWheel, ['stroke-mark']],
] as const)('%s', (_name, Illustration, accents) => {
  const html = renderToStaticMarkup(<Illustration className="w-80" />)

  it('装饰图对读屏隐藏，宽高比固定', () => {
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/)
    expect(html).toContain('viewBox="0 0 280 280"')
    expect(html).toContain('aspect-square')
    expect(html).toContain('w-80')
  })

  it('颜色只来自 currentColor 与 token 工具类，没有颜色字面量与外部资源', () => {
    expect(html).toContain('text-illus')
    for (const accent of accents) expect(html).toContain(accent)
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i)
    expect(html).not.toMatch(/href=|url\(|<image/)
  })

  it('SSR 输出 gzip 后不超过 4KB', () => {
    expect(gzipSync(html).byteLength).toBeLessThanOrEqual(4096)
  })
})
