// 首页包检查（openspec add-ui-design-system tasks 8.4 评审 B1；redesign-home-chart-visuals tasks 2.2、2.3）：
// 对西方站首页与东方站各语言首页的预渲染 HTML，从其引用的脚本出发沿静态 import（不含动态 import()）求闭包，
// 确认其中没有长文阅读器、Markdown 解析与分享图模块代码，并检查每页 gzip 总量不超过预算；
// 同时把各首页 head 中的 canonical、hreflang、robots 与 JSON-LD 类型与 home-head-snapshot.json 对照，
// 首页改版（枢纽区块、命盘图形）不得改变这些搜索相关元数据。
// 只看 HTML 直接列出的文件不够：路由文件中未被拆分的部分（如 validateSearch）会让入口静态导入重的分包。
// 模板 add-og-images 5.5：服务端（Worker 入口与首页路由分包）与客户端首页闭包都不得出现分享卡片渲染器、
// satori、resvg 与字体；渲染器只能经动态 import() 在分享卡片路由中加载。
// 模板 add-marketing-critical-path：客户端首页闭包不得含 zod schema 实现（模板配置在客户端是构建期 JSON），
// 模板配置 marketing.performance.homeScriptGzipBudget 为数字时，以它作为各首页的 gzip 预算。
// 模板 0.5.6：zod 检查改看「水合闭包」——静态闭包加上水合入口直接 import() 的分包（TanStack Start 入口立即动态加载
// StartClient 与整棵路由树，水合必然下载）；发现 zod 时按 sourcemap 列出引用 zod 的源文件，便于定位
// （0.5.8 起只列生成代码实际使用 zod 绑定的文件）。
// openspec separate-landing-homepage tasks 2.1、2.3：工具迁到关键词 URL 后，四个主工具页的 head 也与快照对照
// （TOOL_PAGES）；紫微页的静态闭包不得含八字 / 만세력主页组件（SPLIT_PAGES，按 sourcemap 的源文件判断）。
// openspec separate-landing-homepage tasks 4.1：四个语言首页是品牌落地页，静态闭包不得含工具代码
// （LANDING_FORBIDDEN_SOURCES：排盘引擎、数字命理与塔罗计算、出生表单、工具页组件；同样按 sourcemap 判断）。
// 用法：node scripts/check-home-bundle.mjs [dist/client] [dist/server]；`pnpm build` 在预渲染后自动执行。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

/**
 * 分享图模块的特征字符串。分享图按需 import()，不应进入首页静态闭包；
 * `features/tools/share-card/` 须在源码中保留这一字面量（如卡片根元素的 data 属性值），压缩后仍可被检出。
 */
export const SHARE_CARD_MARKER = 'xuanxue-share-card'

/**
 * 首页不应出现的代码特征：mdast-util-to-hast 的 id 前缀、GFM 脚注区属性、阅读器自身的标记、分享图模块、
 * 对话 Markdown 代码块的标记（`@xuanxue/ui/chat`，模板 add-ai-chat-components 3.4）
 */
export const FORBIDDEN_MARKERS = [
  'user-content-',
  'data-footnotes',
  'reader-mobile-toc',
  SHARE_CARD_MARKER,
  'data-chat-code',
]

/**
 * zod schema 实现的特征（issue 码与错误类名）；只设置 jitless 的 `config` 不含这些字符串。
 * 首页依赖在客户端运行时解析 schema 时会带入整套实现（约 125KB），应改为服务端校验或按需加载。
 */
export const ZOD_MARKERS = ['invalid_type', 'ZodError']

/**
 * 模板分享卡片渲染器的代码特征：cf-workers-og、satori、resvg 的 WASM 初始化与 CJK 字体文件名。
 * NotoSansKR-Regular 为项目的韩文字体（模板 0.4.1 字体扩展点接入后由渲染器加载），同样不得进入首页闭包。
 */
export const RENDERER_MARKERS = [
  'cf-workers-og',
  'satori',
  'resvg',
  'initWasm',
  'NotoSansSC-Regular',
  'NotoSansKR-Regular',
]

// 静态导入的 WASM、Data 模块与字体文件（渲染器随包的部分）
const BINARY_IMPORT =
  /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["']([^"']+\.(?:wasm|bin|woff2?|otf|ttf))["']/g

/**
 * 需要检查的首页：西方站 `/` 与东方站三种语言首页（预渲染输出 `zh-hant.html` 等）。
 * `budget` 为静态脚本闭包 gzip（level 9）总量上限，单位字节：
 * = 首页改版前 main（abb49674，2026-11-13 本地 `pnpm --filter @xuanxue/web build`）实测值 × 1.12，向上取整。
 * 2026-11-14 由 ×1.10 放宽到 ×1.12：roadmap 第二波（首页枢纽区块、样例命盘图、页头每日运势入口）合计约 +10.2%；
 * 首页 LCP 基线本就偏慢（5.7–11.6s），体积与 LCP 优化另立任务，不再靠放宽预算。
 * 提高预算须在 PR 中说明原因与新实测值。
 */
export const HOME_PAGES = [
  { id: 'west', file: 'index.html', budget: 375701 }, // 实测 335447 B
  { id: 'zh-hant', file: 'zh-hant.html', budget: 375701 }, // 实测 335447 B
  { id: 'zh-hans', file: 'zh-hans.html', budget: 375701 }, // 实测 335447 B
  { id: 'ko', file: 'ko.html', budget: 375701 }, // 实测 335447 B
]

/** 主工具页（迁移前在语言首页）：只对照 head 快照，不计入首页脚本预算 */
export const TOOL_PAGES = [
  { id: 'tool-west', file: 'life-path-number.html' },
  { id: 'tool-zh-hant', file: 'zh-hant/八字排盤.html' },
  { id: 'tool-zh-hans', file: 'zh-hans/八字排盘.html' },
  { id: 'tool-ko', file: 'ko/만세력.html' },
]

/**
 * 落地页不得含的工具代码（design.md D5、D7）：按 sourcemap 的源文件路径判断，以 `/` 结尾的是目录。
 * 八字引擎（含历法库的调用方）、数字命理与塔罗计算、出生表单、工具页组件与图形布局都只在工具页加载；
 * 首页的今日条用 features/daily/public-day.ts 的整数算术，样例为固化数据。
 */
export const LANDING_FORBIDDEN_SOURCES = [
  'packages/bazi/src/',
  'packages/numerology/src/',
  'packages/tarot/src/',
  'src/features/tools/form.tsx',
  'src/features/tools/bazi/birth-fields.tsx',
  'src/features/tools/bazi/bazi-home.tsx',
  'src/features/tools/bazi/manseryeok-home.tsx',
  'src/features/tools/numerology/home.tsx',
  'src/features/tools/numerology/calc.ts',
  'src/features/tools/numerology/life-path-calculator.tsx',
  'src/features/tools/numerology/full-calculator.tsx',
  'src/features/tools/charts/layout/',
  'src/features/readings/unlock-card.tsx',
]

/**
 * 按页面拆分的检查：列出的页面静态闭包中不得出现这些源文件的代码。
 * 同一路由（routes/$slug.tsx）按页面懒加载，紫微页因此不下载八字 / 만세력主页组件；
 * 四个语言首页不下载任何工具代码。
 */
export const SPLIT_PAGES = [
  ...HOME_PAGES.map(({ file }) => ({ file, forbiddenSources: LANDING_FORBIDDEN_SOURCES })),
  {
    file: 'zh-hant/紫微斗數排盤.html',
    forbiddenSources: [
      'src/features/tools/bazi/bazi-home.tsx',
      'src/features/tools/bazi/manseryeok-home.tsx',
    ],
  },
]

// 压缩后的静态导入 / 再导出：`import{a}from"./x.js"`、`import"./x.js"`、`export*from"./x.js"`；
// `import("./x.js")` 的引号前是括号，不匹配
const STATIC_IMPORT = /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["']([^"']+\.js)["']/g
const HTML_SCRIPT = /["'](\/assets\/[^"']+\.js)["']/g

/** 首页 HTML 中出现的全部本站脚本（script src、modulepreload 与内联引导脚本里的路径） */
export function htmlScripts(html) {
  return [...new Set([...html.matchAll(HTML_SCRIPT)].map((match) => match[1]))]
}

// 水合入口：`<script type="module" src>`，或 after-paint 加载器中的 `js=[...]`
const ENTRY_SCRIPT = /<script\b[^>]*\btype="module"[^>]*\bsrc="(\/assets\/[^"]+\.js)"/g
const LOADER_SCRIPTS = /\bjs=(\[[^\]]*\])/
// 动态 import：引号或反引号包住的相对路径，不含插值
const DYNAMIC_IMPORT = /\bimport\(\s*["'`]([^"'`$]+\.js)["'`]\s*\)/g

/** 首页 HTML 的水合入口脚本 */
export function entryScripts(html) {
  const entries = [...html.matchAll(ENTRY_SCRIPT)].map((match) => match[1])
  const loader = html.match(LOADER_SCRIPTS)?.[1]
  if (loader) entries.push(...JSON.parse(loader))
  return [...new Set(entries)]
}

/** 入口文件自身（不递归）中的动态 import 目标，以 `/assets/...` 表示 */
export function entryDynamicImports(clientDir, entries) {
  const targets = new Set()
  for (const asset of entries) {
    const file = join(clientDir, asset)
    if (!existsSync(file)) continue
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(DYNAMIC_IMPORT))
      targets.add(
        specifier.startsWith('/') ? specifier : posix.join(posix.dirname(asset), specifier),
      )
  }
  return [...targets]
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 解码 sourcemap mappings，返回带源文件的段 [源文件下标, 名称下标或 -1]（不区分生成行） */
export function decodeMappings(mappings) {
  const segments = []
  let source = 0
  let name = 0
  for (const line of mappings.split(';'))
    for (const segment of line.split(',')) {
      if (!segment) continue
      const fields = []
      let value = 0
      let shift = 0
      for (const char of segment) {
        const digit = BASE64.indexOf(char)
        value += (digit & 31) << shift
        if (digit & 32) shift += 5
        else {
          fields.push(value & 1 ? -(value >>> 1) : value >>> 1)
          value = 0
          shift = 0
        }
      }
      if (fields.length < 4) continue
      source += fields[1]
      if (fields.length >= 5) name += fields[4]
      segments.push([source, fields.length >= 5 ? name : -1])
    }
  return segments
}

// 源码中的 zod 值导入：`import { z } from 'zod'`、`import * as z from 'zod/v4'`、`import z, { object as o } from 'zod'`
const ZOD_IMPORT = /\bimport\s+(?!type\b)([\w$*{}\s,]+?)\s*from\s*["']zod(?:\/[^"']*)?["']/g

/** 源码中 zod 导入的本地绑定名（跳过 `type` 导入） */
export function zodBindings(sourceCode) {
  const names = new Set()
  for (const [, clause] of sourceCode.matchAll(ZOD_IMPORT))
    for (const part of clause.replace(/[{}]/g, ',').split(',')) {
      const words = part.trim().split(/\s+/)
      if (words[0] === 'type') continue
      const name = words.at(-1)
      if (name && /^[\w$]+$/.test(name)) names.add(name)
    }
  return names
}

/**
 * 实际把 zod 带进首页的源文件：offending 分包及静态导入它的分包中，生成代码映射回项目源文件、
 * 且映射的原名是该文件 zod 导入绑定（`z`、`z.object` 等）的位置。只出现在 sources 中而 zod 用法已被
 * 摇掉（如 server function 的 .validator() 在客户端被移除）的模块不计入。sourcemap 无 names、或按名称
 * 一个也没找到时，退回为列出有生成代码且导入 zod 的项目源文件（宁可多列，不让提示为空）。
 */
export function zodSources(clientDir, files, offending) {
  const sources = new Set()
  const mapped = new Set()
  const clean = (source) => source.replace(/^(?:\.\.\/)+/, '').replace(/\?.*$/, '')
  for (const asset of files) {
    const code = readFileSync(join(clientDir, asset), 'utf8')
    const imports = [...code.matchAll(STATIC_IMPORT)].map(([, specifier]) =>
      posix.join(posix.dirname(asset), specifier),
    )
    if (!offending.some((target) => target === asset || imports.includes(target))) continue
    const mapFile = join(clientDir, `${asset}.map`)
    if (!existsSync(mapFile)) continue
    let map
    try {
      map = JSON.parse(readFileSync(mapFile, 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(map.sources) || typeof map.mappings !== 'string') continue
    const bindings = map.sources.map((source, index) =>
      source.includes('node_modules') ? new Set() : zodBindings(map.sourcesContent?.[index] ?? ''),
    )
    for (const [index, name] of decodeMappings(map.mappings)) {
      const names = bindings[index]
      if (!names || names.size === 0) continue
      mapped.add(clean(map.sources[index]))
      const original = Array.isArray(map.names) ? map.names[name] : undefined
      if (typeof original === 'string' && names.has(original.split('.')[0]))
        sources.add(clean(map.sources[index]))
    }
  }
  return [...(sources.size > 0 ? sources : mapped)].sort()
}

/** 从入口脚本（以 `/assets/...` 表示）出发的静态 import 闭包 */
export function staticClosure(clientDir, entries) {
  const seen = new Set()
  const queue = [...entries]
  while (queue.length > 0) {
    const asset = queue.shift()
    if (seen.has(asset)) continue
    const file = join(clientDir, asset)
    if (!existsSync(file)) continue
    seen.add(asset)
    const code = readFileSync(file, 'utf8')
    for (const [, specifier] of code.matchAll(STATIC_IMPORT)) {
      if (/^[a-z]+:/i.test(specifier)) continue
      const next = specifier.startsWith('/')
        ? specifier
        : posix.join(posix.dirname(asset), specifier)
      if (!seen.has(next)) queue.push(next)
    }
  }
  return [...seen]
}

/**
 * 去掉块注释与独占一行的行注释：项目的服务端产物不压缩、保留源码注释，
 * 注释里提到渲染器（如「首页闭包不含 satori / resvg」）不代表静态依赖。
 */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function scan(dir, files, markers) {
  const violations = []
  let gzipBytes = 0
  for (const asset of files) {
    const code = readFileSync(join(dir, asset))
    gzipBytes += gzipSync(code, { level: 9 }).length
    const text = stripComments(code.toString('utf8'))
    for (const marker of markers) {
      if (text.includes(marker)) violations.push({ asset, marker })
    }
    for (const [, specifier] of text.matchAll(BINARY_IMPORT)) {
      violations.push({ asset, marker: specifier })
    }
  }
  return { gzipBytes, violations }
}

/**
 * 单个首页 HTML 的静态闭包、gzip 总量与禁止标记（含分享卡片渲染器与字体）；
 * zod 标记按水合闭包检查（模板 0.5.6），gzip 预算仍按静态闭包计算。
 */
export function checkHomePage(clientDir, file = 'index.html') {
  const html = readFileSync(join(clientDir, file), 'utf8')
  const scripts = htmlScripts(html)
  const files = staticClosure(clientDir, scripts)
  // 水合闭包：静态闭包加上水合入口立即 import() 的分包（路由树等），只用于 zod 检查与信息输出
  const boot = entryDynamicImports(clientDir, entryScripts(html))
  const hydration = staticClosure(clientDir, [...scripts, ...boot])
  const zod = scan(clientDir, hydration, ZOD_MARKERS)
  const main = scan(clientDir, files, [...FORBIDDEN_MARKERS, ...RENDERER_MARKERS])
  return {
    files,
    hydration,
    hydrationGzipBytes: zod.gzipBytes,
    zodSources: zod.violations.length
      ? zodSources(
          clientDir,
          hydration,
          zod.violations.map(({ asset }) => asset),
        )
      : [],
    gzipBytes: main.gzipBytes,
    violations: [...main.violations, ...zod.violations],
  }
}

/** 预算检查：budget 为 null 时不检查；返回超出时的说明，未超出返回 null */
export function budgetViolation(gzipBytes, budget) {
  if (budget === null || budget === undefined) return null
  return gzipBytes > budget
    ? `首页客户端脚本 gzip 合计 ${gzipBytes} B，超出预算 ${budget} B（template.config.ts marketing.performance.homeScriptGzipBudget）`
    : null
}

/** 构建时写出的 marketing.performance（dist/.build/marketing-performance.json），缺失时为 null */
export function readPerformanceOptions(distDir) {
  const file = join(distDir, '.build/marketing-performance.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

/** 只检查西方站首页（保留原接口） */
export function checkHomeBundle(clientDir) {
  return checkHomePage(clientDir, 'index.html')
}

/**
 * 服务端首页闭包：Worker 入口 index.js 加上首页路由（src/routes/index.tsx 的各拆分分包）的静态 import 闭包，
 * 分包位置取自 Vite manifest（dist/server/.vite/manifest.json）。两站各语言首页共用这一路由。
 */
export function checkServerHomeBundle(serverDir) {
  const manifestPath = join(serverDir, '.vite/manifest.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const routeEntries = Object.entries(manifest)
    .filter(([source]) => /^src\/routes\/index\.tsx(?:\?|$)/.test(source))
    .map(([, chunk]) => `/${chunk.file}`)
  const files = staticClosure(serverDir, ['/index.js', ...routeEntries])
  return { files, routeEntries, ...scan(serverDir, files, RENDERER_MARKERS) }
}

/** 服务端首页闭包的输出行；缺少服务端产物或首页分包时失败，避免静默跳过 */
export function reportServerHomeBundle(serverDir) {
  if (!existsSync(join(serverDir, 'index.js')))
    return { ok: false, lines: [`首页包检查失败：找不到服务端产物 ${join(serverDir, 'index.js')}`] }
  const server = checkServerHomeBundle(serverDir)
  if (server.routeEntries.length === 0)
    return {
      ok: false,
      lines: ['首页包检查失败：服务端 manifest 中找不到首页路由分包（src/routes/index.tsx）'],
    }
  if (server.violations.length > 0)
    return {
      ok: false,
      lines: [
        '首页包检查失败：服务端首页闭包中出现了只应懒加载的分享卡片渲染器与字体',
        ...server.violations.map(({ asset, marker }) => `  - 服务端 ${asset} 含 "${marker}"`),
      ],
    }
  return { ok: true, lines: [`服务端首页闭包检查通过：${server.files.length} 个模块`] }
}

// HTML 属性解析：React 输出 `hrefLang`，按小写键读取
function attrs(tag) {
  const out = {}
  for (const [, name, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g))
    out[name.toLowerCase()] = value
  return out
}

// 同源地址只保留路径（含查询），使快照不随构建时的 EAST_URL / WEST_URL 变化；跨源地址保留完整 URL
function relative(href, origin) {
  try {
    const url = new URL(href)
    return url.origin === origin ? `${url.pathname}${url.search}` : url.href
  } catch {
    return href
  }
}

function jsonLdTypes(json) {
  const types = []
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (node['@type']) types.push(...[node['@type']].flat())
    if (node['@graph']) visit(node['@graph'])
  }
  try {
    visit(JSON.parse(json))
  } catch {
    types.push('<invalid JSON-LD>')
  }
  return types
}

/**
 * 从预渲染 HTML 提取搜索相关的 head 摘要：canonical、hreflang（含 x-default）、robots 与 JSON-LD 顶层类型。
 * JSON-LD 由 head scripts 输出在 `</head>` 之后，因此扫描整份 HTML。
 */
export function homeHead(html) {
  const end = html.indexOf('</head>')
  const head = end === -1 ? html : html.slice(0, end)
  let canonical = null
  const hreflang = {}
  let robots = null
  for (const [tag] of head.matchAll(/<(?:link|meta)\b[^>]*>/g)) {
    const a = attrs(tag)
    if (tag.startsWith('<link') && a.rel === 'canonical') canonical = a.href
    if (tag.startsWith('<link') && a.rel === 'alternate' && a.hreflang)
      hreflang[a.hreflang] = a.href
    if (tag.startsWith('<meta') && a.name === 'robots') robots = a.content
  }
  const origin = canonical ? new URL(canonical).origin : ''
  const jsonLd = [
    ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ].flatMap(([, json]) => jsonLdTypes(json))
  return {
    canonical: canonical && relative(canonical, origin),
    hreflang: Object.fromEntries(
      Object.entries(hreflang)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([lang, href]) => [lang, relative(href, origin)]),
    ),
    robots,
    jsonLd: jsonLd.sort(),
  }
}

/** 与快照逐字段比较，返回不一致的字段说明 */
export function diffHomeHead(actual, expected) {
  const diffs = []
  for (const key of ['canonical', 'hreflang', 'robots', 'jsonLd']) {
    const a = JSON.stringify(actual[key])
    const e = JSON.stringify(expected?.[key])
    if (a !== e) diffs.push(`${key}: 期望 ${e}，实际 ${a}`)
  }
  return diffs
}

const SNAPSHOT_PATH = join(dirname(fileURLToPath(import.meta.url)), 'home-head-snapshot.json')

export function readHomeHeadSnapshot() {
  return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
}

/**
 * 检查全部首页：包闭包、禁止标记、gzip 预算与 head 对照；`pages` / `snapshot` 供测试注入。
 * `configBudget`（模板配置 homeScriptGzipBudget）为数字时取代各页预算，且 zod 标记判为违规；
 * 为 null 时沿用 HOME_PAGES 的预算，zod 标记只作警告（同模板：未接受首页包约束的项目不因此构建失败）。
 */
export function checkHomePages(
  clientDir,
  pages = HOME_PAGES,
  snapshot = readHomeHeadSnapshot(),
  configBudget = null,
) {
  return pages.map(({ id, file, budget: pageBudget }) => {
    const { violations: all, ...result } = checkHomePage(clientDir, file)
    const head = homeHead(readFileSync(join(clientDir, file), 'utf8'))
    const budget = configBudget ?? pageBudget
    const zod = all.filter(({ marker }) => ZOD_MARKERS.includes(marker))
    return {
      id,
      file,
      budget,
      ...result,
      violations: configBudget === null ? all.filter((item) => !zod.includes(item)) : all,
      zodWarnings: configBudget === null ? zod : [],
      overBudget: budgetViolation(result.gzipBytes, budget) !== null,
      head,
      headDiffs: diffHomeHead(head, snapshot[id]),
    }
  })
}

/** 主工具页 head 与快照对照；预渲染产物缺失也算失败 */
export function checkToolPages(clientDir, pages = TOOL_PAGES, snapshot = readHomeHeadSnapshot()) {
  return pages.map(({ id, file }) => {
    const path = join(clientDir, file)
    if (!existsSync(path)) return { id, file, headDiffs: ['预渲染 HTML 不存在'] }
    return { id, file, headDiffs: diffHomeHead(homeHead(readFileSync(path, 'utf8')), snapshot[id]) }
  })
}

/** 页面静态闭包中有生成代码的项目源文件（按 sourcemap 的 mappings，不含只列在 sources 中而被摇掉的模块） */
export function closureSources(clientDir, file) {
  const html = readFileSync(join(clientDir, file), 'utf8')
  const sources = new Set()
  for (const asset of staticClosure(clientDir, htmlScripts(html))) {
    const mapFile = join(clientDir, `${asset}.map`)
    if (!existsSync(mapFile)) continue
    const map = JSON.parse(readFileSync(mapFile, 'utf8'))
    if (!Array.isArray(map.sources) || typeof map.mappings !== 'string') continue
    for (const [index] of decodeMappings(map.mappings)) {
      const source = map.sources[index]
      if (typeof source === 'string' && !source.includes('node_modules'))
        sources.add(source.replace(/^(?:\.\.\/)+/, '').replace(/\?.*$/, ''))
    }
  }
  return [...sources].sort()
}

/** 按页面懒加载的检查：返回闭包中出现的禁止源文件 */
export function checkSplitPages(clientDir, pages = SPLIT_PAGES) {
  return pages.map(({ file, forbiddenSources }) => {
    const sources = closureSources(clientDir, file)
    return {
      file,
      // 没有任何源文件说明缺少 sourcemap，检查无从谈起，按失败处理
      unmapped: sources.length === 0,
      // 条目是源文件路径的结尾，或以 `/` 结尾的目录
      found: forbiddenSources.filter((item) =>
        sources.some((source) =>
          item.endsWith('/') ? source.includes(item) : source.endsWith(item),
        ),
      ),
    }
  })
}

/** 主工具页与懒加载检查的输出行 */
export function reportToolPages(tools, splits) {
  const lines = []
  let ok = true
  for (const page of tools) {
    if (page.headDiffs.length > 0) {
      ok = false
      lines.push(
        `工具页 head 检查失败：${page.id}（${page.file}）`,
        ...page.headDiffs.map((diff) => `  - head 与 home-head-snapshot.json 不一致：${diff}`),
      )
    } else lines.push(`工具页 head 检查通过：${page.id}（${page.file}）与快照一致`)
  }
  for (const page of splits) {
    if (page.unmapped || page.found.length > 0) {
      ok = false
      lines.push(
        `页面懒加载检查失败：${page.file}`,
        ...(page.unmapped ? ['  - 静态闭包没有 sourcemap，无法判断'] : []),
        ...page.found.map((source) => `  - 静态闭包含 ${source}（应按页面懒加载）`),
      )
    } else lines.push(`页面懒加载检查通过：${page.file} 的静态闭包不含其他页面的组件与工具代码`)
  }
  return { ok, lines }
}

/** 把检查结果整理为输出行；有任何问题时 ok 为 false */
export function reportHomePages(results) {
  const lines = []
  const warnings = []
  let ok = true
  for (const page of results) {
    const label = `${page.id}（${page.file}）`
    if (page.zodWarnings.length > 0)
      warnings.push(
        `首页包检查警告：${label} 首页水合闭包（静态依赖与入口立即加载的路由树）中有 zod schema 实现（设置 homeScriptGzipBudget 后此项判为失败）`,
        ...page.zodWarnings.map(({ asset, marker }) => `  - 客户端 ${asset} 含 "${marker}"`),
      )
    if (page.zodSources.length > 0)
      warnings.push(
        '  引用 zod 的源文件（按 sourcemap 映射到使用 zod 绑定的代码）：路由 validateSearch 改用 features/routing/search.ts，' +
          'server function 的 schema 写在 .validator() 调用内或只在服务端模块定义，模块顶层 schema 用 /* @__PURE__ */ 标注',
        ...page.zodSources.map((source) => `    · ${source}`),
      )
    const problems = [
      ...page.violations.map(
        ({ asset, marker }) =>
          `静态依赖 ${asset} 含 "${marker}"（阅读器 / 对话 / Markdown / 分享图与分享卡片渲染器 / zod schema 只应懒加载）`,
      ),
      ...(page.overBudget ? [`gzip 合计 ${page.gzipBytes} B 超出预算 ${page.budget} B`] : []),
      ...page.headDiffs.map((diff) => `head 与 home-head-snapshot.json 不一致：${diff}`),
    ]
    if (problems.length > 0) {
      ok = false
      lines.push(`首页包检查失败：${label}`, ...problems.map((problem) => `  - ${problem}`))
    } else {
      lines.push(
        `首页包检查通过：${label} ${page.files.length} 个脚本，gzip 合计 ${page.gzipBytes} B / 预算 ${page.budget} B，head 与快照一致` +
          `；水合闭包 ${page.hydration.length} 个脚本，gzip 合计 ${page.hydrationGzipBytes} B`,
      )
    }
  }
  return { ok, lines, warnings }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const [clientArg, serverArg] = args.filter((arg) => !arg.startsWith('--'))
  const clientDir = resolve(clientArg ?? join(dirname(process.argv[1]), '../dist/client'))
  const serverDir = resolve(serverArg ?? join(clientDir, '../server'))
  if (args.includes('--write-head-snapshot')) {
    // 仅在有意修改首页元数据、并在 PR 中说明后使用；写入后运行 biome format 统一格式
    const snapshot = Object.fromEntries(
      [...HOME_PAGES, ...TOOL_PAGES].map(({ id, file }) => [
        id,
        homeHead(readFileSync(join(clientDir, file), 'utf8')),
      ]),
    )
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
    console.log(`已写入 ${SNAPSHOT_PATH}`)
  } else {
    // 唯一调用方是 `pnpm build`（Cloudflare 构建，必有 dist/server）；一侧产物缺失时另一侧照常报告
    const client = () => {
      try {
        const budget = readPerformanceOptions(join(clientDir, '..'))?.homeScriptGzipBudget ?? null
        return reportHomePages(
          checkHomePages(clientDir, HOME_PAGES, readHomeHeadSnapshot(), budget),
        )
      } catch (error) {
        return {
          ok: false,
          lines: [`首页包检查失败：${error instanceof Error ? error.message : error}`],
        }
      }
    }
    const tools = () => {
      try {
        return reportToolPages(checkToolPages(clientDir), checkSplitPages(clientDir))
      } catch (error) {
        return {
          ok: false,
          lines: [`工具页检查失败：${error instanceof Error ? error.message : error}`],
        }
      }
    }
    for (const { ok, lines, warnings = [] } of [
      reportServerHomeBundle(serverDir),
      client(),
      tools(),
    ]) {
      for (const line of warnings) console.warn(line)
      for (const line of lines) (ok ? console.log : console.error)(line)
      if (!ok) process.exitCode = 1
    }
  }
}
