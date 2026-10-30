import { describe, expect, it, vi } from 'vitest'
import { prerenderRequest, staticPageResponse } from './static-pages.ts'

describe('双站静态 HTML 分流', () => {
  it('只有构建期令牌能将语言页面映射到所属站点请求', () => {
    const request = new Request('http://localhost/ko/blog', {
      headers: { 'x-site-prerender': 'local-build' },
    })
    expect(prerenderRequest(request)).toBeNull()
    expect(prerenderRequest(request, 'other')).toBeNull()
    expect(prerenderRequest(request, 'local-build')?.url).toBe('http://ganjiday.com/ko/blog')
    // 东方站英文入口页的语言归西方站，页面按东方站预渲染（D5）
    const english = new Request('http://localhost/en', {
      headers: { 'x-site-prerender': 'local-build' },
    })
    expect(prerenderRequest(english, 'local-build')?.url).toBe('http://ganjiday.com/en')
  })

  it('两站根路径取各自的 index.html，内部资源地址不出现在响应 URL', async () => {
    const fetchAsset = vi.fn(async (_request: Request) => new Response('<h1>entry</h1>'))
    await staticPageResponse(new Request('https://arcanumber.com/'), fetchAsset)
    expect(fetchAsset.mock.calls[0]?.[0].url).toBe('https://arcanumber.com/index.html')
    await staticPageResponse(new Request('https://ganjiday.com/ko/?r=shared'), fetchAsset)
    expect(fetchAsset.mock.calls[1]?.[0].url).toBe('https://ganjiday.com/ko.html')
  })

  it('预览 Host、私有路径与缺失产物继续 SSR，分享查询带 noindex', async () => {
    const fetchAsset = vi.fn(async () => new Response('html'))
    expect(
      await staticPageResponse(new Request('https://preview.workers.dev/ko/'), fetchAsset),
    ).toBeNull()
    expect(
      await staticPageResponse(new Request('https://arcanumber.com/app'), fetchAsset),
    ).toBeNull()
    expect(fetchAsset).not.toHaveBeenCalled()
    expect(
      await staticPageResponse(
        new Request('https://arcanumber.com/blog/missing'),
        async () => new Response(null, { status: 404 }),
      ),
    ).toBeNull()
    const shared = await staticPageResponse(
      new Request('https://arcanumber.com/?r=shared'),
      fetchAsset,
    )
    expect(shared?.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})
