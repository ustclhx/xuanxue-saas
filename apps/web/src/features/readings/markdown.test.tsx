import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from './markdown.tsx'

describe('Markdown 渲染', () => {
  it('HTML 与链接按文本输出，只生成白名单元素', () => {
    const html = renderToStaticMarkup(
      <Markdown source={'## 標題\n\n**粗** *斜* <script>alert(1)</script> [a](javascript:x)'} />,
    )
    expect(html).toContain('<strong>粗</strong>')
    expect(html).toContain('<em>斜</em>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('<script')
    expect(html).toMatch(/<h2 id="s1-標題"/)
  })
})
