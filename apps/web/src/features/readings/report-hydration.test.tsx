// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalDateTime } from '../shared/local-date-time.tsx'
import { SiteContext } from '../site/context.tsx'
import { ReadingsListPage } from './report-page.tsx'

// 报告时间的水合一致性：Workers 服务端恒为 UTC，浏览器在访问者时区（如 Asia/Taipei）。
// 首屏若按运行时默认时区格式化，SSR 与水合文本不同，React 抛 #418（group8 验收疑似缺陷 #1）。

vi.mock('../../paraglide/runtime.js', async (original) => {
  const actual = await original<typeof import('../../paraglide/runtime.js')>()
  return { ...actual, getLocale: () => 'en' }
})
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
}))
vi.mock('./readings.functions.ts', () => ({
  deleteReading: vi.fn(),
  getReading: vi.fn(),
  listReadings: vi.fn(),
}))

const CREATED = '2026-11-19T06:20:00.000Z'
const originalTz = process.env.TZ
let root: Root | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = undefined
  process.env.TZ = originalTz
  vi.unstubAllGlobals()
})

/** 以 UTC 服务端渲染，再切到 Asia/Taipei 水合，收集 React 的可恢复错误（#418 即走这里） */
async function ssrThenHydrate(node: ReactNode) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  process.env.TZ = 'UTC'
  const html = renderToString(node)
  container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  const errors: unknown[] = []
  process.env.TZ = 'Asia/Taipei'
  await act(async () => {
    root = hydrateRoot(container as HTMLDivElement, node, {
      onRecoverableError: (error) => errors.push(error),
    })
  })
  return { html, errors, container }
}

describe('报告时间水合', () => {
  it('报告列表：UTC 服务端与 Asia/Taipei 浏览器水合无差异，水合后显示本地时间', async () => {
    const { html, errors, container } = await ssrThenHydrate(
      <SiteContext.Provider value="west">
        <ReadingsListPage
          slug="me"
          initial={{
            items: [
              {
                id: 'r1',
                kind: 'numerology-full',
                status: 'ready',
                locale: 'en',
                createdAt: CREATED,
              },
            ],
            nextCursor: null,
          }}
          unlockable
        />
      </SiteContext.Provider>,
    )
    expect(errors).toEqual([])
    expect(html).toContain('Nov 19, 2026, 6:20 AM UTC')
    const time = container.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe(CREATED)
    expect(time?.textContent).toBe('Nov 19, 2026, 2:20 PM')
  })

  it('LocalDateTime：自定义格式同样先 UTC 后本地', async () => {
    const { errors, container } = await ssrThenHydrate(
      <LocalDateTime value={CREATED} options={{ timeStyle: 'short' }} />,
    )
    expect(errors).toEqual([])
    expect(container.textContent).toBe('2:20 PM')
  })
})
