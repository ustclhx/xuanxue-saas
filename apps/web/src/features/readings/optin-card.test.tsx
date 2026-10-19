import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReadingSlots } from '../tools/reading-slots.tsx'
import { ToolPage } from '../tools/tool-page.tsx'

const language = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => language.locale }
})

vi.mock('../growth/growth.functions.ts', () => ({ getGrowthFormOptions: vi.fn() }))
const optin = {
  result: { kind: 'numerology' as const, lifePath: 11 },
  share: { date: '1987-11-29' },
}
const page = (show: boolean) =>
  renderToString(
    <ToolPage
      tool="life-path"
      title="Life path"
      intro="Intro"
      form={<input />}
      result={show ? <p>CALCULATED RESULT</p> : null}
    >
      <ReadingSlots tool="life-path" optin={show ? optin : null}>
        {show && <section data-slot="reading-unlock">Unlock</section>}
      </ReadingSlots>
    </ToolPage>,
  )

describe('结果后订阅卡', () => {
  it.each([
    ['en', ['Love', 'Career', 'Money', 'Reconnection', 'Personal growth']],
    ['zh-Hant', ['愛情', '事業', '財運', '復合', '自我成長']],
    ['ko', ['연애', '직업', '재물', '재회', '자기 성장']],
  ] as const)('%s 内联卡仅在结果后、解锁前出现，并提供五个本语言主题', (locale, topics) => {
    language.locale = locale
    expect(page(false)).not.toContain('data-slot="reading-optin"')
    const html = page(true)
    expect(html.indexOf('CALCULATED RESULT')).toBeLessThan(
      html.indexOf('data-slot="reading-optin"'),
    )
    expect(html.indexOf('data-slot="reading-optin"')).toBeLessThan(
      html.indexOf('data-slot="reading-unlock"'),
    )
    for (const topic of topics) expect(html).toContain(`>${topic}</option>`)
    expect(html).toContain('type="email"')
    expect(html).not.toContain('role="dialog"')
    language.locale = 'en'
  })
})
