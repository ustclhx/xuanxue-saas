// 首页包检查（openspec add-ui-design-system tasks 8.4 评审 B1；redesign-home-chart-visuals tasks 2.2、2.3）：
// 对西方站首页与东方站各语言首页的预渲染 HTML，从其引用的脚本出发沿静态 import（不含动态 import()）求闭包，
// 确认其中没有长文阅读器、Markdown 解析与分享图模块代码，并检查每页 gzip 总量不超过预算；
// 同时把各首页 head 中的 canonical、hreflang、robots 与 JSON-LD 类型与 home-head-snapshot.json 对照，
// 首页改版（枢纽区块、命盘图形）不得改变这些搜索相关元数据。
// 只看 HTML 直接列出的文件不够：路由文件中未被拆分的部分（如 validateSearch）会让入口静态导入重的分包。
// 用法：node scripts/check-home-bundle.mjs [dist/client]；`pnpm build` 在预渲染后自动执行。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

/**
 * 分享图模块的特征字符串。分享图按需 import()，不应进入首页静态闭包；
 * `features/tools/share-card/` 须在源码中保留这一字面量（如卡片根元素的 data 属性值），压缩后仍可被检出。
 */
export const SHARE_CARD_MARKER = 'xuanxue-share-card'

/** 首页不应出现的代码特征：mdast-util-to-hast 的 id 前缀、GFM 脚注区属性、阅读器自身的标记、分享图模块 */
export const FORBIDDEN_MARKERS = [
  'user-content-',
  'data-footnotes',
  'reader-mobile-toc',
  SHARE_CARD_MARKER,
]

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

// 压缩后的静态导入 / 再导出：`import{a}from"./x.js"`、`import"./x.js"`、`export*from"./x.js"`；
// `import("./x.js")` 的引号前是括号，不匹配
const STATIC_IMPORT = /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["']([^"']+\.js)["']/g
const HTML_SCRIPT = /["'](\/assets\/[^"']+\.js)["']/g

/** 首页 HTML 中出现的全部本站脚本（script src、modulepreload 与内联引导脚本里的路径） */
export function htmlScripts(html) {
  return [...new Set([...html.matchAll(HTML_SCRIPT)].map((match) => match[1]))]
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

/** 单个首页 HTML 的静态闭包、gzip 总量与禁止标记 */
export function checkHomePage(clientDir, file = 'index.html') {
  const html = readFileSync(join(clientDir, file), 'utf8')
  const files = staticClosure(clientDir, htmlScripts(html))
  const violations = []
  let gzipBytes = 0
  for (const asset of files) {
    const code = readFileSync(join(clientDir, asset))
    gzipBytes += gzipSync(code, { level: 9 }).length
    const text = code.toString('utf8')
    for (const marker of FORBIDDEN_MARKERS) {
      if (text.includes(marker)) violations.push({ asset, marker })
    }
  }
  return { files, gzipBytes, violations }
}

/** 只检查西方站首页（保留原接口） */
export function checkHomeBundle(clientDir) {
  return checkHomePage(clientDir, 'index.html')
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

/** 检查全部首页：包闭包、禁止标记、gzip 预算与 head 对照；`pages` / `snapshot` 供测试注入 */
export function checkHomePages(clientDir, pages = HOME_PAGES, snapshot = readHomeHeadSnapshot()) {
  return pages.map(({ id, file, budget }) => {
    const result = checkHomePage(clientDir, file)
    const head = homeHead(readFileSync(join(clientDir, file), 'utf8'))
    return {
      id,
      file,
      budget,
      ...result,
      overBudget: result.gzipBytes > budget,
      head,
      headDiffs: diffHomeHead(head, snapshot[id]),
    }
  })
}

/** 把检查结果整理为输出行；有任何问题时 ok 为 false */
export function reportHomePages(results) {
  const lines = []
  let ok = true
  for (const page of results) {
    const label = `${page.id}（${page.file}）`
    const problems = [
      ...page.violations.map(
        ({ asset, marker }) =>
          `静态依赖 ${asset} 含 "${marker}"（阅读器 / Markdown / 分享图代码只应懒加载）`,
      ),
      ...(page.overBudget ? [`gzip 合计 ${page.gzipBytes} B 超出预算 ${page.budget} B`] : []),
      ...page.headDiffs.map((diff) => `head 与 home-head-snapshot.json 不一致：${diff}`),
    ]
    if (problems.length > 0) {
      ok = false
      lines.push(`首页包检查失败：${label}`, ...problems.map((problem) => `  - ${problem}`))
    } else {
      lines.push(
        `首页包检查通过：${label} ${page.files.length} 个脚本，gzip 合计 ${page.gzipBytes} B / 预算 ${page.budget} B，head 与快照一致`,
      )
    }
  }
  return { ok, lines }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const dirArg = args.find((arg) => !arg.startsWith('--'))
  const clientDir = resolve(dirArg ?? join(dirname(process.argv[1]), '../dist/client'))
  if (args.includes('--write-head-snapshot')) {
    // 仅在有意修改首页元数据、并在 PR 中说明后使用；写入后运行 biome format 统一格式
    const snapshot = Object.fromEntries(
      HOME_PAGES.map(({ id, file }) => [id, homeHead(readFileSync(join(clientDir, file), 'utf8'))]),
    )
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
    console.log(`已写入 ${SNAPSHOT_PATH}`)
  } else {
    const { ok, lines } = reportHomePages(checkHomePages(clientDir))
    for (const line of lines) (ok ? console.log : console.error)(line)
    if (!ok) process.exitCode = 1
  }
}
