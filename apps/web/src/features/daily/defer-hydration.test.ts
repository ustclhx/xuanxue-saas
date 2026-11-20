import { describe, expect, it } from 'vitest'
import { deferHydration, deferHydrationHtml } from './defer-hydration.ts'

const SSR =
  '<!DOCTYPE html><html><head><link rel="stylesheet" href="/assets/app.css" nonce="n1"/>' +
  '<link rel="modulepreload" href="/assets/index.js" nonce="n1"/><link rel="modulepreload" href="/assets/page.js" nonce="n1"/>' +
  '<script src="https://static.cloudflareinsights.com/beacon.min.js" defer=""></script></head>' +
  '<body><main><a href="/x">x</a></main><script nonce="n1" data-tsr-stream-part="">$_TSR=1</script>' +
  '<script type="module" async="" src="/assets/index.js" nonce="n1"></script></body></html>'

describe('每日页水合推迟到首帧后', () => {
  it('去掉 modulepreload 与水合入口，加载器沿用 nonce 并插入入口，正文与样式表不变', () => {
    const out = deferHydrationHtml(SSR)
    expect(out).not.toContain('modulepreload')
    expect(out).not.toContain('<script type="module"')
    expect(out).toContain('<link rel="stylesheet" href="/assets/app.css" nonce="n1"/>')
    expect(out).toContain('<main><a href="/x">x</a></main>')
    expect(out).toContain('$_TSR=1</script>')
    expect(out).toContain('beacon.min.js')
    expect(out).toMatch(/<script nonce="n1">\(function\(\)\{[^<]*"\/assets\/index\.js"[^<]*<\/script><\/body>/)
  })

  it('没有本站水合入口时原样返回', () => {
    const html = '<html><body><link rel="modulepreload" href="/assets/a.js"/></body></html>'
    expect(deferHydrationHtml(html)).toBe(html)
  })

  it('只改写 200 的 HTML 响应', async () => {
    const redirect = new Response(null, { status: 302, headers: { location: '/' } })
    expect(await deferHydration(redirect)).toBe(redirect)
    const page = await deferHydration(
      new Response(SSR, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-a': '1' } }),
    )
    expect(page.headers.get('x-a')).toBe('1')
    expect(await page.text()).not.toContain('modulepreload')
  })
})
