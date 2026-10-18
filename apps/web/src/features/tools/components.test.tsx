import type { SiteId } from '@xuanxue/config'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SiteContext } from '../site/context.tsx'
import { ToolContext } from './context.tsx'
import { Disclaimer } from './disclaimer.tsx'
import { ToolFaq } from './faq.tsx'
import { ChoiceGroup, SubmitButton, TextField, ToolForm } from './form.tsx'
import { toolsForLocale } from './registry.ts'
import { circledNumber, ResultBlock } from './result-block.tsx'
import { ToolLinks } from './tool-links.tsx'
import { ToolPage } from './tool-page.tsx'

const messages = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => messages.locale }
})

function render(node: ReactNode, site: SiteId = 'west') {
  return renderToString(<SiteContext value={site}>{node}</SiteContext>)
}

describe('ToolPage', () => {
  const page = (site: SiteId) =>
    render(
      <ToolPage
        tool="demo"
        title="Free BaZi Chart"
        intro={<p>Intro text</p>}
        form={
          <ToolForm label="Birth details" onSubmit={() => {}}>
            <ChoiceGroup
              legend="Calendar"
              name="calendar"
              options={[
                { value: 'solar', label: 'Solar' },
                { value: 'lunar', label: 'Lunar' },
              ]}
            />
            <TextField label="Birth year" name="year" />
            <SubmitButton>Calculate</SubmitButton>
          </ToolForm>
        }
        links={[{ href: '/a', title: 'Guide', target: 'guide' }]}
        faq={[{ question: 'Q1?', answer: 'A1' }]}
      />,
      site,
    )

  it('服务端输出 H1、表单标签、声明、内链与 FAQ（禁用脚本可抓取）', () => {
    const html = page('west')
    expect(html).toMatch(/<h1[^>]*>Free BaZi Chart<\/h1>/)
    expect(html).toContain('<form aria-label="Birth details"')
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Calendar<\/legend>/)
    expect(html).toMatch(/<label[^>]*>Birth year<input/)
    expect(html).toContain('type="submit"')
    expect(html).toContain('role="note"')
    expect(html).toContain('does not predict the future')
    expect(html).toContain('href="/a"')
    expect(html).toContain('<summary')
  })

  it('两站标题字号不同（东方站粗体衬线，西方站大号）', () => {
    expect(page('east')).toContain('sm:text-[40px]')
    expect(page('west')).toContain('sm:text-[56px]')
  })
})

describe('Disclaimer', () => {
  it.each([
    ['en', 'consult a qualified medical professional'],
    ['zh-Hant', '僅供娛樂參考，不預測未來'],
    ['ko', '미래를 예측하지 않습니다'],
  ])('%s 文案', async (locale, text) => {
    const { setLocale } = await import('../../paraglide/runtime.js')
    messages.locale = locale
    setLocale(locale as never, { reload: false })
    expect(render(<Disclaimer />)).toContain(text)
    messages.locale = 'en'
    setLocale('en', { reload: false })
  })
})

describe('ResultBlock', () => {
  const block = (site: SiteId) =>
    render(
      <ResultBlock id="pillars" index={1} title="Four pillars" description="Explanation">
        <p>Body</p>
      </ResultBlock>,
      site,
    )

  it('section + h2 + 锚点 id，默认展开且说明文字在 HTML 中', () => {
    const html = block('west')
    expect(html).toMatch(/<section id="pillars" aria-labelledby="pillars-title"/)
    expect(html).toMatch(/<h2 id="pillars-title"/)
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Explanation')
    expect(html).not.toMatch(/hidden=""/)
  })

  it('编号只在东方站显示', () => {
    expect(block('east')).toContain('①')
    expect(block('west')).not.toContain('①')
    expect(circledNumber(7)).toBe('⑦')
  })

  it('折叠时内容隐藏', () => {
    const html = render(
      <ResultBlock id="x" title="X" defaultOpen={false}>
        <p>Body</p>
      </ResultBlock>,
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(/hidden=""/)
  })
})

describe('ToolLinks / ToolFaq', () => {
  it('内链矩阵是带标题的 nav，空列表不输出', () => {
    const html = render(
      <ToolContext value={{ tool: 'demo', track: () => {} }}>
        <ToolLinks links={[{ href: '/b', title: 'B', target: 'b' }]} />
      </ToolContext>,
    )
    expect(html).toMatch(/<nav aria-labelledby=/)
    expect(html).toContain('Related reading')
    expect(render(<ToolLinks links={[]} />)).toBe('')
    expect(render(<ToolFaq items={[]} />)).toBe('')
  })
})

describe('registry', () => {
  it('按语言列出有路径与名称的工具', () => {
    const routes = [
      {
        id: 'bazi',
        site: 'east' as const,
        paths: { 'zh-Hant': '/八字排盤/', ko: '/saju/' },
        titles: { 'zh-Hant': '八字排盤' },
      },
    ]
    expect(toolsForLocale('zh-Hant', routes)).toEqual([
      { id: 'bazi', path: '/八字排盤/', title: '八字排盤' },
    ])
    expect(toolsForLocale('ko', routes)).toEqual([])
  })
})

describe('ToolForm 隐私', () => {
  it('SSR 输出 POST 表单（不以 GET 把输入放进查询串），水合前禁用提交并给出禁用脚本提示', () => {
    const html = render(
      <ToolForm label="Birth details" onSubmit={() => {}} requiresJs="JavaScript needed">
        <TextField label="Birth year" name="year" />
        <SubmitButton>Calculate</SubmitButton>
      </ToolForm>,
    )
    const form = html.match(/<form[^>]*>/)?.[0] ?? ''
    expect(form).toContain('method="post"')
    expect(form).not.toMatch(/method="get"/i)
    expect(form).not.toMatch(/action="[^"]*\?/)
    expect(html).toMatch(/<button type="submit" disabled=""/)
    expect(html).toContain('<noscript>')
    expect(html).toContain('JavaScript needed')
  })
})
