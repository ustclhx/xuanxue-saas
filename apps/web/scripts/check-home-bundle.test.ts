import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  budgetViolation,
  checkHomeBundle,
  checkHomePages,
  checkServerHomeBundle,
  checkSplitPages,
  checkToolPages,
  decodeMappings,
  entryDynamicImports,
  entryScripts,
  HOME_PAGES,
  homeHead,
  htmlScripts,
  readHomeHeadSnapshot,
  readPerformanceOptions,
  reportHomePages,
  reportToolPages,
  SHARE_CARD_MARKER,
  staticClosure,
  TOOL_PAGES,
  zodBindings,
  zodSources,
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

  it('首页静态导入 @xuanxue/ui/chat 时报错（对话代码块标记）', () => {
    // 模拟首页路由静态导入对话组件：chat 分包含代码块的 data-chat-code 属性
    const root = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': 'import{ChatMarkdown as c}from"./chat.js";',
      'assets/chat.js': 'const e=t("div",{"data-chat-code":"",className:"mb-2.5"});',
    })
    expect(checkHomeBundle(root).violations).toEqual([
      { asset: '/assets/chat.js', marker: 'data-chat-code' },
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

describe('zod 标记与首页包预算（模板 add-marketing-critical-path）', () => {
  it('客户端首页静态依赖中出现 zod schema 实现时报错；只有 jitless 配置时通过', () => {
    const ok = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': 'const c={};function config(o){Object.assign(c,o)}config({jitless:!0});',
    })
    expect(checkHomeBundle(ok).violations).toEqual([])
    rmSync(dir, { recursive: true, force: true })
    const bad = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': 'import"./schema.js";',
      'assets/schema.js': 'class ZodError extends Error{};const i={code:"invalid_type"};',
    })
    expect(checkHomeBundle(bad).violations.map((v) => v.marker)).toEqual([
      'invalid_type',
      'ZodError',
    ])
  })

  it('加载器内联脚本中的入口路径也计入首页闭包', () => {
    const root = fixture({
      'index.html':
        '<script>(function(){var css=["/assets/app.css"],js=["/assets/entry.js"]})()</script>',
      'assets/entry.js': 'import"./schema.js";',
      'assets/schema.js': 'const i={code:"invalid_type"};',
    })
    expect(checkHomeBundle(root).files.sort()).toEqual(['/assets/entry.js', '/assets/schema.js'])
  })
})

// sourcemap mappings 编码（单行；段为 [生成列, 源文件下标, 名称下标?]，源行列取 0）
function mappings(segments: [number, number, number?][]) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const vlq = (value: number) => {
    let rest = value < 0 ? (-value << 1) | 1 : value << 1
    let out = ''
    do {
      let digit = rest & 31
      rest >>>= 5
      if (rest > 0) digit |= 32
      out += chars[digit]
    } while (rest > 0)
    return out
  }
  let column = 0
  let source = 0
  let name = 0
  return segments
    .map(([at, index, nameIndex]) => {
      let out = vlq(at - column) + vlq(index - source) + vlq(0) + vlq(0)
      if (nameIndex !== undefined) {
        out += vlq(nameIndex - name)
        name = nameIndex
      }
      column = at
      source = index
      return out
    })
    .join(',')
}
const clientCode = 'import{a as e}from"./schemas.js";const s=e.object();const f=r(1);const a=2'

describe('水合闭包中的 zod（0.5.6）', () => {
  it('入口脚本：module script 与 after-paint 加载器的 js 列表', () => {
    expect(
      entryScripts(
        '<script type="module" async="" src="/assets/index-1.js"></script><script>(function(){var css=[],js=["/assets/index-2.js"];})()</script>',
      ),
    ).toEqual(['/assets/index-1.js', '/assets/index-2.js'])
  })

  it('入口立即 import() 的路由树分包含 zod 时报出，并按 sourcemap 列出引用 zod 的源文件', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/index.js"></script>',
      'assets/index.js': 'const s=async()=>{let{StartClient:e}=await import(`./client.js`)};',
      'assets/client.js': `${clientCode};const l=()=>import("./lazy.js");`,
      'assets/client.js.map': JSON.stringify({
        sources: [
          '../../../src/routes/login.tsx?tsr-shared=1',
          '../../../node_modules/x.js',
          '../../../src/a.ts',
          '../../../src/features/x.functions.ts',
        ],
        sourcesContent: [
          "import { z } from 'zod'\n",
          "import { z } from 'zod'",
          'export const a = 1',
          "import { z } from 'zod'\nimport { createServerFn } from 'x'\n",
        ],
        names: ['z.object', 'createServerFn', 'z'],
        // 生成代码：login.tsx 使用导入的 z；x.functions.ts 只留下 server function 桩（zod 用法已被摇掉）
        mappings: mappings([
          [clientCode.indexOf('e.object'), 0, 0],
          [clientCode.indexOf('r(1)'), 3, 1],
          [clientCode.indexOf('const a'), 2],
          [clientCode.length - 1, 1, 2],
        ]),
      }),
      'assets/schemas.js': 'class ZodError{};const c="invalid_type";',
      'assets/lazy.js': 'import"./schemas.js";',
    })
    expect(entryDynamicImports(root, ['/assets/index.js'])).toEqual(['/assets/client.js'])
    const result = checkHomeBundle(root)
    expect(result.files).toEqual(['/assets/index.js'])
    expect(result.hydration.sort()).toEqual([
      '/assets/client.js',
      '/assets/index.js',
      '/assets/schemas.js',
    ])
    expect(result.violations.map(({ marker }) => marker).sort()).toEqual([
      'ZodError',
      'invalid_type',
    ])
    expect(result.zodSources).toEqual(['src/routes/login.tsx'])
  })

  it('mappings 解码：多行、负增量、名称与无源段', () => {
    expect(
      decodeMappings(
        `${mappings([
          [3, 2],
          [7, 0, 4],
        ])};;A,${mappings([[1, 1, 2]])}`,
      ),
    ).toEqual([
      [2, -1],
      [0, 4],
      [1, 6],
    ])
  })

  it('zod 绑定：命名、别名、命名空间与默认导入，跳过类型导入', () => {
    expect([
      ...zodBindings(
        "import { z } from 'zod'\nimport * as v from 'zod/v4'\nimport d, { object as o, type ZodType } from 'zod'\nimport type { infer as I } from 'zod'",
      ),
    ]).toEqual(['z', 'v', 'd', 'o'])
  })

  it('sourcemap 无 names（或按名称找不到）时列出有生成代码且导入 zod 的项目源文件', () => {
    const root = fixture({
      'assets/client.js': 'import"./schemas.js";const s=1;const f=2',
      'assets/client.js.map': JSON.stringify({
        sources: ['../../../src/a.ts', '../../../src/b.ts', '../../../src/c.ts'],
        sourcesContent: ["import { z } from 'zod'", "import { z } from 'zod'", 'export {}'],
        mappings: mappings([
          [0, 0],
          [30, 2],
        ]),
      }),
    })
    expect(zodSources(root, ['/assets/client.js'], ['/assets/schemas.js'])).toEqual(['src/a.ts'])
  })

  it('路由树分包不含 zod 时通过（深层懒加载分包不计入）', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/index.js"></script>',
      'assets/index.js': 'await import("./client.js")',
      'assets/client.js': 'const l=()=>import("./lazy.js");',
      'assets/lazy.js': 'class ZodError{}',
    })
    expect(checkHomeBundle(root).violations).toEqual([])
  })
})

describe('首页包预算（add-marketing-critical-path）', () => {
  it('未设置预算不检查；未超出返回 null；超出给出实际值与预算', () => {
    expect(budgetViolation(500_000, null)).toBeNull()
    expect(budgetViolation(500_000, undefined)).toBeNull()
    expect(budgetViolation(1000, 1000)).toBeNull()
    expect(budgetViolation(1001, 1000)).toMatch(/1001 B.*预算 1000 B/)
  })

  it('读取构建写出的 marketing.performance，缺失时为 null', () => {
    const root = fixture({})
    expect(readPerformanceOptions(root)).toBeNull()
    mkdirSync(join(root, '.build'))
    writeFileSync(
      join(root, '.build/marketing-performance.json'),
      JSON.stringify({ homeScriptGzipBudget: 1234 }),
    )
    expect(readPerformanceOptions(root)).toEqual({ homeScriptGzipBudget: 1234 })
  })

  it('未设置配置预算时 zod 只警告并沿用各页预算；设置后取代各页预算且 zod 判失败', () => {
    const root = fixture({
      'index.html': '<script type="module" src="/assets/entry.js"></script>',
      'assets/entry.js': 'const i={code:"invalid_type"};',
    })
    const pages = [{ id: 'west', file: 'index.html', budget: 1_000_000 }]
    const head = { west: homeHead('') }
    const warned = reportHomePages(checkHomePages(root, pages, head))
    expect(warned.ok).toBe(true)
    expect(warned.warnings.join('\n')).toMatch(/zod schema[\s\S]*invalid_type/)
    const [strict] = checkHomePages(root, pages, head, 1)
    expect(strict?.budget).toBe(1)
    expect(strict?.overBudget).toBe(true)
    expect(strict?.violations.map((v) => v.marker)).toEqual(['invalid_type'])
    expect(reportHomePages(strict ? [strict] : []).ok).toBe(false)
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

  // 首页快照的 canonical / hreflang / robots 取自改版前 main 的预渲染输出（redesign-home-chart-visuals 2.1），
  // 首页改版必须保持一致；JSON-LD 类型按 separate-landing-homepage design.md D3 改为品牌首页的
  // Organization + WebSite，工具的 WebApplication / BreadcrumbList / FAQPage 在主工具页
  it('快照覆盖全部首页与主工具页，东方站 x-default 指向繁中页面', () => {
    const snapshot = readHomeHeadSnapshot()
    expect(Object.keys(snapshot).sort()).toEqual(
      [...HOME_PAGES, ...TOOL_PAGES].map((page) => page.id).sort(),
    )
    expect(snapshot.west?.canonical).toBe('/')
    for (const id of ['west', 'zh-hant', 'zh-hans', 'ko']) {
      expect(snapshot[id]?.jsonLd, id).toEqual(['Organization', 'WebSite'])
      expect(snapshot[id]?.robots, id).toBeNull()
    }
    for (const id of ['zh-hant', 'zh-hans', 'ko'])
      expect(snapshot[id]?.hreflang['x-default'], id).toBe('/zh-hant')
    for (const { id } of TOOL_PAGES)
      expect(snapshot[id]?.jsonLd, id).toEqual(['BreadcrumbList', 'FAQPage', 'WebApplication'])
    expect(snapshot['tool-west']?.canonical).toBe('/life-path-number')
    expect(decodeURI(snapshot['tool-ko']?.canonical ?? '')).toBe('/ko/만세력')
    expect(decodeURI(snapshot['tool-zh-hans']?.hreflang['x-default'] ?? '')).toBe(
      '/zh-hant/八字排盤',
    )
  })

  it('主工具页 head 与快照对照，缺少预渲染产物时失败', () => {
    const root = fixture({ 'tool.html': html('https://ganjiday.com') })
    const pages = [
      { id: 'tool', file: 'tool.html' },
      { id: 'missing', file: 'missing.html' },
    ]
    const results = checkToolPages(root, pages, { tool: homeHead(html('https://ganjiday.com')) })
    expect(results.map((page) => page.headDiffs)).toEqual([[], ['预渲染 HTML 不存在']])
    expect(reportToolPages(results, []).ok).toBe(false)
    expect(reportToolPages(results.slice(0, 1), []).ok).toBe(true)
  })

  it('按页面懒加载：静态闭包的 sourcemap 映射到禁止的源文件时失败', () => {
    // mappings "AAAA" 指向 sources[0]；"ACAA" 指向 sources[1]
    const page = (mappings: string) =>
      fixture({
        'ziwei.html': '<script type="module" src="/assets/entry.js"></script>',
        'assets/entry.js': 'console.log(1)',
        'assets/entry.js.map': JSON.stringify({
          sources: ['../../src/features/tools/bazi/bazi-home.tsx', '../../src/routes/$slug.tsx'],
          mappings,
        }),
      })
    const pages = [
      { file: 'ziwei.html', forbiddenSources: ['src/features/tools/bazi/bazi-home.tsx'] },
    ]
    const bad = checkSplitPages(page('AAAA'), pages)
    expect(bad).toEqual([
      { file: 'ziwei.html', unmapped: false, found: ['src/features/tools/bazi/bazi-home.tsx'] },
    ])
    expect(reportToolPages([], bad).ok).toBe(false)
    rmSync(dir, { recursive: true, force: true })
    const good = checkSplitPages(page('ACAA'), pages)
    expect(good).toEqual([{ file: 'ziwei.html', unmapped: false, found: [] }])
    expect(reportToolPages([], good).ok).toBe(true)
  })
})
