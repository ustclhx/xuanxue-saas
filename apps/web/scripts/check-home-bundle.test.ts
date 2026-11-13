import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  checkHomeBundle,
  checkHomePages,
  checkServerHomeBundle,
  HOME_PAGES,
  homeHead,
  htmlScripts,
  readHomeHeadSnapshot,
  reportHomePages,
  SHARE_CARD_MARKER,
  staticClosure,
} from './check-home-bundle.mjs'

let dir = ''

function fixture(files: Record<string, string>) {
  dir = mkdtempSync(join(tmpdir(), 'home-bundle-'))
  mkdirSync(join(dir, 'assets'))
  mkdirSync(join(dir, '.vite'))
  for (const [path, content] of Object.entries(files)) writeFileSync(join(dir, path), content)
  return dir
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = ''
})

describe('首页包检查', () => {
  it('沿静态 import 求闭包，不跟随动态 import()', () => {
    const root = fixture({
      'index.html':
        '<link rel="modulepreload" href="/assets/entry.js"><script>import("/assets/boot.js")</script>',
      'assets/entry.js': 'import{a as b}from"./route.js";import"./side.js";export*from"./re.js";',
      'assets/route.js': 'const l=()=>import("./lazy.js");',
      'assets/side.js': '',
      'assets/re.js': '',
      'assets/boot.js': '',
      'assets/lazy.js': 'const x="user-content-";',
    })
    expect(htmlScripts('<script src="/assets/a.js"></script>')).toEqual(['/assets/a.js'])
    expect(staticClosure(root, ['/assets/entry.js']).sort()).toEqual([
      '/assets/entry.js',
      '/assets/re.js',
      '/assets/route.js',
      '/assets/side.js',
    ])
    expect(checkHomeBundle(root).violations).toEqual([])
  })

  it('静态依赖中出现 Markdown 代码时报错', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': 'import"./reader.js";',
      'assets/reader.js': 'const p="user-content-";',
    })
    expect(checkHomeBundle(root).violations).toEqual([
      { asset: '/assets/reader.js', marker: 'user-content-' },
    ])
  })

  it('客户端首页静态依赖中出现分享卡片渲染器时报错', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': 'import"./og.js";',
      'assets/og.js': 'throw new Error("cf-workers-og: WebAssembly is not available")',
    })
    expect(checkHomeBundle(root).violations).toEqual([
      { asset: '/assets/og.js', marker: 'cf-workers-og' },
    ])
  })

  it('逐页检查东西两站首页：禁止标记（含分享图模块）与 gzip 预算', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/west.js"></script>',
      'zh-hant.html': '<script type="module" src="/assets/east.js"></script>',
      'assets/west.js': 'import"./shared.js";',
      'assets/east.js': `import"./shared.js";const c="${SHARE_CARD_MARKER}";`,
      'assets/shared.js': 'export const x=1;',
    })
    const head = homeHead('')
    const pages = [
      { id: 'west', file: 'index.html', budget: 1_000 },
      { id: 'zh-hant', file: 'zh-hant.html', budget: 1 },
    ]
    const [west, east] = checkHomePages(root, pages, { west: head, 'zh-hant': head })
    expect(west?.violations).toEqual([])
    expect(west?.overBudget).toBe(false)
    expect(east?.violations).toEqual([{ asset: '/assets/east.js', marker: SHARE_CARD_MARKER }])
    expect(east?.overBudget).toBe(true)
    const { ok, lines } = reportHomePages([west, east].filter((page) => page !== undefined))
    expect(ok).toBe(false)
    expect(lines.join('\n')).toMatch(/zh-hant.*\n.*xuanxue-share-card[\s\S]*超出预算/)
  })

  it('覆盖西方站与东方站三种语言首页，预算为正数', () => {
    expect(HOME_PAGES.map((page) => page.file)).toEqual([
      'index.html',
      'zh-hant.html',
      'zh-hans.html',
      'ko.html',
    ])
    for (const page of HOME_PAGES) expect(page.budget).toBeGreaterThan(0)
  })
})

describe('服务端首页闭包（模板 add-og-images 5.5）', () => {
  const manifest = JSON.stringify({
    'virtual:cloudflare/worker-entry': { file: 'index.js', isEntry: true },
    'src/routes/index.tsx?tsr-split=component': { file: 'assets/home.js' },
    'src/server/cloudflare/share-card-renderer.ts': { file: 'assets/renderer.js' },
  })
  const renderer =
    'import{initWasm as i}from"@resvg/resvg-wasm";import y from"./yoga.wasm";import f from"./inter-latin-400-normal.woff-x.bin";'

  it('渲染器只经动态 import() 加载时通过', () => {
    const root = fixture({
      '.vite/manifest.json': manifest,
      'index.js': 'import{a}from"./assets/router.js";const r=()=>import("./assets/renderer.js");',
      'assets/router.js': '',
      'assets/home.js': 'import"./ui.js";',
      'assets/ui.js': '',
      'assets/renderer.js': renderer,
    })
    const result = checkServerHomeBundle(root)
    expect(result.routeEntries).toEqual(['/assets/home.js'])
    expect(result.files.sort()).toEqual([
      '/assets/home.js',
      '/assets/router.js',
      '/assets/ui.js',
      '/index.js',
    ])
    expect(result.violations).toEqual([])
  })

  it('注释中提到渲染器不算违规（服务端产物保留源码注释）', () => {
    const root = fixture({
      '.vite/manifest.json': manifest,
      'index.js':
        '/**\n* 首页闭包不含 satori / resvg / 字体。\n*/\n// cf-workers-og 只在分享卡片路由加载\nconst r=()=>import("./assets/renderer.js");',
      'assets/home.js': '',
      'assets/renderer.js': renderer,
    })
    expect(checkServerHomeBundle(root).violations).toEqual([])
  })

  it('首页路由静态导入渲染器时检查失败', () => {
    const root = fixture({
      '.vite/manifest.json': manifest,
      'index.js': 'const r=()=>import("./assets/home.js");',
      'assets/home.js': 'import{render}from"./renderer.js";',
      'assets/renderer.js': renderer,
    })
    const markers = checkServerHomeBundle(root).violations.map((v) => v.marker)
    expect(markers).toEqual(
      expect.arrayContaining([
        'resvg',
        'initWasm',
        './yoga.wasm',
        './inter-latin-400-normal.woff-x.bin',
      ]),
    )
  })

  it('Worker 入口静态导入渲染器时检查失败', () => {
    const root = fixture({
      '.vite/manifest.json': manifest,
      'index.js': 'import"./assets/renderer.js";',
      'assets/home.js': '',
      'assets/renderer.js': renderer,
    })
    expect(checkServerHomeBundle(root).violations.length).toBeGreaterThan(0)
  })

  it('命令行缺少服务端产物时失败，不静默通过', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': '',
    })
    const script = new URL('./check-home-bundle.mjs', import.meta.url).pathname
    const result = spawnSync(process.execPath, [script, root, join(root, 'missing-server')], {
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('找不到服务端产物')
  })
})

describe('首页 head 对照', () => {
  const html = (origin: string) =>
    `<html><head><link rel="canonical" href="${origin}/zh-hant"/>` +
    `<link rel="alternate" hrefLang="zh-Hant" href="${origin}/zh-hant"/>` +
    `<link rel="alternate" hrefLang="x-default" href="${origin}/zh-hant"/>` +
    `<link rel="alternate" hrefLang="ko" href="${origin}/ko"/>` +
    '<meta name="robots" content="index, follow"/></head><body>' +
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>' +
    '<script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["FAQPage"]}]}</script>' +
    '</body></html>'

  it('提取 canonical、hreflang、x-default、robots 与 JSON-LD 类型，地址与构建时的域名无关', () => {
    const summary = homeHead(html('https://ganjiday.com'))
    expect(summary).toEqual({
      canonical: '/zh-hant',
      hreflang: { ko: '/ko', 'x-default': '/zh-hant', 'zh-Hant': '/zh-hant' },
      robots: 'index, follow',
      jsonLd: ['FAQPage', 'Organization', 'WebSite'],
    })
    expect(homeHead(html('https://xuanxue-east.example'))).toEqual(summary)
  })

  it('head 与快照不一致时报告字段', () => {
    const root = fixture({ 'index.html': html('https://ganjiday.com') })
    const expected = { ...homeHead(html('https://ganjiday.com')), robots: null }
    const [page] = checkHomePages(root, [{ id: 'west', file: 'index.html', budget: 1 }], {
      west: expected,
    })
    expect(page?.headDiffs).toEqual(['robots: 期望 null，实际 "index, follow"'])
  })

  // 快照取自改版前 main 的预渲染输出（redesign-home-chart-visuals 2.1）；首页改版必须保持一致
  it('快照覆盖全部首页，东方站 x-default 指向繁中首页', () => {
    const snapshot = readHomeHeadSnapshot()
    expect(Object.keys(snapshot).sort()).toEqual(HOME_PAGES.map((page) => page.id).sort())
    expect(snapshot.west?.canonical).toBe('/')
    expect(snapshot.west?.jsonLd).toEqual(['FAQPage', 'Organization', 'WebSite'])
    for (const id of ['zh-hant', 'zh-hans', 'ko'])
      expect(snapshot[id]?.hreflang['x-default'], id).toBe('/zh-hant')
  })
})
