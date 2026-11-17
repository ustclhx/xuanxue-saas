import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PageWidth, Prose, Section, SectionStack } from '../src/project/index.ts'

// 项目区块容器（openspec refresh-visual-system-warm 4.2）：结构与可访问名称；间距与宽度由类名决定
describe('Section / Prose', () => {
  it('带标题的区块以 h2 命名，标题与说明限宽', () => {
    const html = renderToString(
      <Section id="tools" title="從一個工具開始" intro="同一份出生資料">
        <p>content</p>
      </Section>,
    )
    expect(html).toMatch(/<section[^>]*id="tools"[^>]*aria-labelledby="tools-title"/)
    expect(html).toMatch(/<h2[^>]*id="tools-title"[^>]*>從一個工具開始<\/h2>/)
    expect(html).toContain('max-w-180')
    expect(html).toContain('<p>content</p>')
    // 素色区块不给内容加底色
    expect(html).not.toContain('bg-surface-2')
  })

  it('没有标题时不输出 aria-labelledby，可由调用方给 aria-label', () => {
    const html = renderToString(
      <Section aria-label="定價">
        <p>x</p>
      </Section>,
    )
    expect(html).not.toContain('aria-labelledby')
    expect(html).toContain('aria-label="定價"')
    expect(html).not.toContain('<h2')
  })

  it('色带区块把内容放进 surface-2 圆角条', () => {
    const html = renderToString(
      <Section tone="band">
        <p>line</p>
      </Section>,
    )
    expect(html).toMatch(/<div class="[^"]*rounded-object[^"]*bg-surface-2[^"]*">\s*<p>line<\/p>/)
  })

  it('Prose 限宽 720px；PageWidth 与 SectionStack 透传 className', () => {
    expect(renderToString(<Prose>t</Prose>)).toContain('max-w-180')
    expect(renderToString(<PageWidth className="x-test">t</PageWidth>)).toMatch(
      /max-w-280[^"]*x-test/,
    )
    expect(renderToString(<SectionStack className="x-test">t</SectionStack>)).toMatch(
      /gap-16[^"]*x-test/,
    )
  })
})
