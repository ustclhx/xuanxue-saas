// 站内链接与 TDK 验收审计（openspec seo-fix-tdk-links design 决策 3–5；验收口径见使用者任务 task.md §3–§5）。
// 复用 check:links 的抓取与解析（check-links.mjs 的 hostRequest、check-links-graph.mjs 的 parsePage 等），
// 按 seo.linking.sites 分站抓取站点地图全部地址与语言首页，在 check:links 的规则之外再检查：
//   - 孤岛页 = 0、站内死链 = 0（与 check:links 同口径）；
//   - 每页正文内链 2–5 个（正文 = nav／action 之外的区域，按不同目标计数；hub 页与首页不设上限）；
//   - 钱页（template.config.ts seo.linking.moneyPages）正文入链来源页 ≥ 3；
//   - 同一目标页的正文锚文本：表述 ≤ 2 种，入链 ≥ 3 条时 top1 占比 ≤ 70%；
//   - 每页 Title／Description／H1 的长度（英文按字符；中文、韩文按全角宽度，半角计 0.5）与是否超出上限。
// 本文件归项目所有（不是模板文件），template-sync 不覆盖。
//
// 用法（先 `pnpm --filter @xuanxue/web build`）：
//   pnpm --filter @xuanxue/web audit:seo [--base-url <地址>] [--json <文件>] [--tdk <文件>] [--strict]
// 未传 --base-url 时自行启动 vite preview（只结束自己启动的进程组）。--strict 有违规时以 1 退出。
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { hostRequest } from './check-links.mjs'
import {
  classifyHref,
  decodeEntities,
  normalizePath,
  parsePage,
  planLinkGraphs,
  resolveLinkingConfig,
  sitemapLocations,
} from './check-links-graph.mjs'
import { fallbackDevVars } from './prerender-env.ts'

const WEB_ROOT = new URL('..', import.meta.url).pathname
const CONCURRENCY = 8

/**
 * 区域口径（docs/seo-internal-linking.md §3）：未标记区域是正文；`series`／`related`／`siblings` 是模板区块，
 * 锚文本按模板约定固定取目标主词；`nav`（页头、页脚、面包屑、语言切换）与 `action`（转化按钮）是导航与转化层。
 * - 正文内链数与锚文本统计只看正文；
 * - 钱页入链计正文与模板区块（导航层不计，首页除外）。
 */
const BODY_ZONE = 'body'
const NON_EDITORIAL_ZONES = new Set(['nav', 'action'])
export const BODY_LINKS_MIN = 2
export const BODY_LINKS_MAX = 5
export const MONEY_INLINKS_MIN = 3
export const ANCHOR_VARIANTS_MAX = 2
export const ANCHOR_TOP_SHARE_MAX = 0.7
/**
 * top1 占比在正文入链 ≥5 条时检查（design 决策 5）：≤2 种表述下，3 条入链只能是 2:1（67%），4 条必须 2:2，
 * 一条锚文本就让占比摆动 25–33 个百分点，样本太少不说明问题；3–4 条的目标页只作提示，仍须 ≤2 种表述。
 */
export const ANCHOR_SHARE_MIN_LINKS = 5
/**
 * 正文内链下限的已记录例外（不带语言前缀）：法律页与通讯页没有能自然带出站内链接的现成句子，
 * 按使用者规则「不为插链接新造句子」跳过（task.md §3，design 决策 5）；仍计入报告的「例外」一栏。
 */
export const BODY_LINKS_EXEMPT = new Map([
  ['/privacy', '法律页：只有一处现成句子（电子邮件更新 → 通讯页）'],
  ['/refund', '法律页：只有一处现成句子（免责声明）'],
  ['/disclaimer', '法律页：只有一处现成句子（服务条款）'],
  ['/newsletter', '通讯页：订阅表单页，只有隐私政策一条现成链接'],
])

/** 各语言 TDK 上限（task.md §2.7；字数只是上限参考）：英文按字符，中文、韩文按全角宽度 */
export const TDK_LIMITS = {
  latin: { title: [40, 60], description: [140, 160] },
  cjk: { title: [20, 30], description: [70, 80] },
}

const ANCHOR_DECORATION = /^[\s←→›»«‹>…:：.。!！?？]+|[\s←→›»«‹>…:：.。!！?？]+$/g
export const normalizeAnchor = (text) =>
  text.replace(ANCHOR_DECORATION, '').replace(/\s+/g, ' ').toLowerCase()

/** 页面语言是否按全角宽度计（中文、韩文、日文） */
export const isCjkLocale = (lang) => /^(zh|ko|ja)/i.test(lang ?? '')

/**
 * 显示宽度：全角字符（汉字、谚文、假名、全角标点）计 1，其他（ASCII、空格）计 0.5。
 * 中文「20–30 汉字」口径即全角字符数；韩文同样按此宽度套用中文阈值（design 决策 4）。
 */
export function cjkWidth(text) {
  let width = 0
  for (const char of text) width += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/u.test(char) ? 1 : 0.5
  return width
}

/** 文本长度：英文按字符数，CJK 语言按全角宽度 */
export function tdkLength(text, lang) {
  return isCjkLocale(lang) ? cjkWidth(text) : [...text].length
}

/** 从 HTML 取 title 与 meta description */
export function headCopy(html) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''
  let description = ''
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/\bname\s*=\s*"description"/i.test(tag)) continue
    description = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? ''
    break
  }
  const clean = (text) => decodeEntities(text).replace(/\s+/g, ' ').trim()
  return { title: clean(title), description: clean(description) }
}

/**
 * 链接审计（纯函数，便于夹具单测）。
 * - `pages`：`{ path, url, status, html? , parsed? }`，站点地图地址与语言首页；
 * - `targets`：站内链接目标的状态 `Map<path, status>`；`indexable`：站点地图路径；`homes`：语言首页；
 * - `moneyPages`：钱页（不带语言前缀）；`localePrefixes`：语言前缀首段。
 */
export function auditLinks({
  pages,
  targets,
  indexable,
  homes,
  internalHosts,
  moneyPages = [],
  localePrefixes = [],
}) {
  const violations = []
  const notes = []
  const add = (list, rule, page, message) => list.push({ rule, page, message })
  const inlinksAll = new Map()
  const inlinksBody = new Map()
  const anchors = new Map()
  const parents = new Set()
  const bodyCounts = new Map()

  for (const page of pages) {
    if (page.status >= 400 || !page.parsed) {
      add(violations, 'dead-link', page.path, `可索引页返回 ${page.status}`)
      continue
    }
    const bodyTargets = new Set()
    const seenAnchor = new Set()
    const breadcrumb = []
    for (const link of page.parsed.links) {
      const target = classifyHref(link.href, page.url, internalHosts)
      if (!target || target.kind === 'external') continue
      if (target.kind === 'invalid') {
        add(violations, 'dead-link', page.path, `无法解析的链接：${link.href}`)
        continue
      }
      const status = targets.get(target.path)
      if (status === undefined || status >= 400) {
        add(violations, 'dead-link', page.path, `死链 ${target.path}（${status ?? '无响应'}）`)
        continue
      }
      if (link.zone === 'nav' && link.region === 'nav' && indexable.has(target.path))
        breadcrumb.push(target.path)
      if (target.path === page.path || !indexable.has(target.path)) continue
      if (!inlinksAll.has(target.path)) inlinksAll.set(target.path, new Set())
      inlinksAll.get(target.path).add(page.path)
      if (NON_EDITORIAL_ZONES.has(link.zone)) continue
      if (!inlinksBody.has(target.path)) inlinksBody.set(target.path, new Set())
      inlinksBody.get(target.path).add(page.path)
      if (link.zone !== BODY_ZONE) continue
      bodyTargets.add(target.path)
      // 同一来源页对同一目标的同一表述只计一次（多个 CTA 不放大占比）
      const wording = normalizeAnchor(link.anchor)
      const key = `${target.path}\n${wording}`
      if (seenAnchor.has(key)) continue
      seenAnchor.add(key)
      if (!anchors.has(target.path)) anchors.set(target.path, new Map())
      const byWording = anchors.get(target.path)
      byWording.set(wording, [...(byWording.get(wording) ?? []), page.path])
    }
    // 面包屑最后一个可索引链接即上级；被当作上级的页面是 hub
    if (breadcrumb.length > 0) parents.add(breadcrumb.at(-1))
    bodyCounts.set(page.path, bodyTargets.size)
  }

  const checked = pages.filter((page) => page.parsed && page.status < 400).map((page) => page.path)
  const delocalize = (path) => {
    const [, first = '', ...rest] = path.split('/')
    return localePrefixes.includes(first) ? `/${rest.join('/')}`.replace(/\/$/, '') || '/' : path
  }
  const hubs = new Set([...homes, ...parents])
  for (const path of checked) {
    if (!inlinksAll.get(path)?.size)
      add(violations, 'orphan', path, '没有任何站内页面链接到该页（站点地图不计）')
    const count = bodyCounts.get(path) ?? 0
    const exempt = BODY_LINKS_EXEMPT.get(delocalize(path))
    if (count < BODY_LINKS_MIN && exempt)
      add(notes, 'body-links-exempt', path, `正文内链 ${count} 个（例外：${exempt}）`)
    else if (count < BODY_LINKS_MIN)
      add(violations, 'body-links', path, `正文内链 ${count} 个，少于 ${BODY_LINKS_MIN}`)
    else if (count > BODY_LINKS_MAX && !hubs.has(path))
      add(
        notes,
        'body-links-over',
        path,
        `正文内链 ${count} 个，超过 ${BODY_LINKS_MAX}（不再加链）`,
      )
  }

  const money = new Set(moneyPages.map((path) => normalizePath(path)))
  const moneyReport = []
  for (const path of checked) {
    if (!money.has(delocalize(path))) continue
    // 首页由每页页头 logo 链接，正文入链不适用，按全部区域计
    const sources = homes.includes(path) ? inlinksAll.get(path) : inlinksBody.get(path)
    const count = sources?.size ?? 0
    moneyReport.push({ path, inlinks: count, sources: [...(sources ?? [])].sort() })
    if (count < MONEY_INLINKS_MIN)
      add(violations, 'money-inlinks', path, `钱页正文入链 ${count} 个，少于 ${MONEY_INLINKS_MIN}`)
  }

  const anchorReport = []
  for (const [path, byWording] of [...anchors].sort(([a], [b]) => a.localeCompare(b))) {
    const total = [...byWording.values()].reduce((sum, list) => sum + list.length, 0)
    const ranked = [...byWording].sort((a, b) => b[1].length - a[1].length)
    const share = ranked[0][1].length / total
    anchorReport.push({
      path,
      total,
      wordings: ranked.map(([wording, sources]) => ({ wording, count: sources.length, sources })),
      topShare: Number(share.toFixed(3)),
    })
    const list = ranked.map(([wording, sources]) => `「${wording}」×${sources.length}`).join('、')
    if (byWording.size > ANCHOR_VARIANTS_MAX)
      add(violations, 'anchor-variants', path, `锚文本 ${byWording.size} 种：${list}`)
    if (share > ANCHOR_TOP_SHARE_MAX)
      add(
        total >= ANCHOR_SHARE_MIN_LINKS ? violations : notes,
        total >= ANCHOR_SHARE_MIN_LINKS ? 'anchor-top-share' : 'anchor-top-share-small',
        path,
        `top1 锚文本占 ${(share * 100).toFixed(0)}%（${total} 条）：${list}`,
      )
  }

  return {
    violations,
    notes,
    money: moneyReport,
    anchors: anchorReport,
    bodyLinks: Object.fromEntries([...bodyCounts].sort(([a], [b]) => a.localeCompare(b))),
    hubs: [...hubs].sort(),
  }
}

/** TDK 审计：长度与上限（只报告超出上限；字数不是改 Title 的理由，见 design 决策 4） */
export function auditTdk(pages) {
  return pages
    .filter((page) => page.html)
    .map((page) => {
      const { title, description } = headCopy(page.html)
      const lang = page.parsed?.lang ?? ''
      const limits = isCjkLocale(lang) ? TDK_LIMITS.cjk : TDK_LIMITS.latin
      const titleLength = tdkLength(title, lang)
      const descriptionLength = tdkLength(description, lang)
      return {
        path: page.path,
        lang,
        title,
        titleLength,
        titleOver: titleLength > limits.title[1],
        description,
        descriptionLength,
        descriptionOver: descriptionLength > limits.description[1],
        h1: page.parsed?.h1 ?? [],
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })
}

/** 与 check-links.mjs 相同的 preview 启动方式；只结束自己启动的进程组 */
async function startPreview() {
  if (!existsSync(resolve(WEB_ROOT, 'dist/server/index.js')))
    throw new Error('缺少构建产物 apps/web/dist，请先运行 pnpm --filter @xuanxue/web build')
  const devVars = resolve(WEB_ROOT, 'dist/server/.dev.vars')
  let wrote = false
  if (!existsSync(devVars)) {
    const source = fallbackDevVars()
    if (source !== null) {
      writeFileSync(devVars, source, { mode: 0o600 })
      wrote = true
    }
  }
  const port = await freePort()
  const child = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: WEB_ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  })
  const stop = () => {
    if (wrote) rmSync(devVars, { force: true })
    if (child.exitCode !== null) return
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      // 进程组已退出
    }
  }
  const baseUrl = `http://localhost:${port}`
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: 'manual' })
      if (response.status < 500) return { baseUrl, stop }
    } catch {
      // 尚未监听
    }
    await new Promise((done) => setTimeout(done, 300))
  }
  stop()
  throw new Error('vite preview 未能在 60 秒内就绪')
}

async function pool(items, worker) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const index = next
        next += 1
        results[index] = await worker(items[index])
      }
    }),
  )
  return results
}

/** 抓取一页，跟随至多 5 次重定向（站内主机改回 origin） */
async function fetchHtml(send, origin, internalHosts, path) {
  let url = new URL(path, origin).href
  for (let hop = 0; hop < 6; hop += 1) {
    let response
    try {
      response = await send(url)
    } catch {
      return { url, status: 599 }
    }
    const location = response.header('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.cancel()
      const next = new URL(location, url)
      url = internalHosts.has(next.host)
        ? new URL(`${next.pathname}${next.search}`, origin).href
        : next.href
      continue
    }
    if (!(response.header('content-type') ?? '').includes('text/html')) {
      await response.cancel()
      return { url, status: response.status }
    }
    return { url, status: response.status, html: await response.text() }
  }
  return { url, status: 508 }
}

async function readSitemap(send, origin, path = '/sitemap.xml', seen = new Set()) {
  if (seen.has(path)) return []
  seen.add(path)
  const response = await send(new URL(path, origin).href)
  const xml = await response.text()
  const locations = sitemapLocations(xml)
  if (!/<sitemapindex\b/.test(xml)) return locations
  const nested = await Promise.all(
    locations.map((loc) => readSitemap(send, origin, new URL(loc).pathname, seen)),
  )
  return nested.flat()
}

async function auditSite({ graph, send, moneyPages }) {
  const { origin, homes } = graph
  const locations = await readSitemap(send, origin)
  const internalHosts = new Set([new URL(origin).host])
  for (const loc of locations) internalHosts.add(new URL(loc).host)
  for (const host of graph.otherHosts) internalHosts.delete(host)
  const indexable = new Set(
    locations.map((loc) => classifyHref(loc, origin, internalHosts)?.path).filter(Boolean),
  )
  const seeds = [...new Set([...indexable, ...homes])]
  const fetched = await pool(seeds, (path) => fetchHtml(send, origin, internalHosts, path))
  const pages = seeds.map((path, index) => {
    const result = fetched[index]
    return { path, ...result, parsed: result.html ? parsePage(result.html) : undefined }
  })
  const targets = new Map(pages.map((page) => [page.path, page.status]))
  const pending = new Set()
  for (const page of pages)
    for (const link of page.parsed?.links ?? []) {
      const target = classifyHref(link.href, page.url, internalHosts)
      if (target?.kind === 'internal' && !targets.has(target.path)) pending.add(target.path)
    }
  const extra = [...pending]
  const extraResults = await pool(extra, (path) => fetchHtml(send, origin, internalHosts, path))
  extra.forEach((path, index) => {
    targets.set(path, extraResults[index].status)
  })
  return {
    links: auditLinks({
      pages,
      targets,
      indexable,
      homes,
      internalHosts,
      moneyPages,
      localePrefixes: graph.localePrefixes,
    }),
    tdk: auditTdk(pages),
  }
}

export function formatAudit(sites) {
  const lines = []
  for (const { host, links, tdk } of sites) {
    const byRule = (rule) => links.violations.filter((item) => item.rule === rule)
    lines.push(`== ${host}：${tdk.length} 页`)
    for (const rule of [
      'orphan',
      'dead-link',
      'body-links',
      'money-inlinks',
      'anchor-variants',
      'anchor-top-share',
    ]) {
      const hits = byRule(rule)
      lines.push(`  ${rule}: ${hits.length}`)
      for (const hit of hits) lines.push(`    - ${hit.page}  ${hit.message}`)
    }
    for (const rule of ['body-links-exempt', 'body-links-over', 'anchor-top-share-small']) {
      const hits = links.notes.filter((item) => item.rule === rule)
      lines.push(`  （提示）${rule}: ${hits.length}`)
      for (const hit of hits) lines.push(`    - ${hit.page}  ${hit.message}`)
    }
    lines.push('  钱页正文入链：')
    for (const item of links.money) lines.push(`    - ${item.path}  ${item.inlinks}`)
    const titleOver = tdk.filter((page) => page.titleOver)
    const descriptionOver = tdk.filter((page) => page.descriptionOver)
    lines.push(
      `  TDK：Title 超上限 ${titleOver.length}，Description 超上限 ${descriptionOver.length}`,
    )
  }
  const total = sites.reduce((sum, site) => sum + site.links.violations.length, 0)
  lines.push(`合计违规 ${total} 项`)
  return lines.join('\n')
}

async function loadLocalize(i18n) {
  try {
    const runtime = await import(new URL('../src/paraglide/runtime.js', import.meta.url).href)
    return (locale) => runtime.localizeUrl('http://localhost/', { locale }).pathname
  } catch {
    return (locale) => (locale === i18n?.defaultLocale ? '/' : `/${locale}`)
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'base-url': { type: 'string' },
      json: { type: 'string' },
      tdk: { type: 'string' },
      strict: { type: 'boolean' },
    },
  })
  const templateConfig = (
    await import(new URL('../../../template.config.ts', import.meta.url).href)
  ).default
  const config = resolveLinkingConfig(templateConfig.seo?.linking)
  const preview = values['base-url'] ? null : await startPreview()
  const baseUrl = values['base-url'] ?? preview.baseUrl
  try {
    const graphs = planLinkGraphs({
      baseUrl,
      i18n: templateConfig.i18n,
      sites: config.sites,
      localize: await loadLocalize(templateConfig.i18n),
    })
    const send = hostRequest(baseUrl, new Set(graphs.map((graph) => graph.host).filter(Boolean)))
    const sites = []
    for (const graph of graphs)
      sites.push({
        host: graph.host ?? new URL(baseUrl).host,
        ...(await auditSite({ graph, send, moneyPages: config.moneyPages })),
      })
    console.log(formatAudit(sites))
    const write = (file, data) => {
      mkdirSync(dirname(resolve(file)), { recursive: true })
      writeFileSync(resolve(file), `${JSON.stringify(data, null, 2)}\n`)
    }
    if (values.json)
      write(
        values.json,
        sites.map(({ host, links }) => ({ host, ...links })),
      )
    if (values.tdk)
      write(
        values.tdk,
        sites.map(({ host, tdk }) => ({ host, pages: tdk })),
      )
    const total = sites.reduce((sum, site) => sum + site.links.violations.length, 0)
    if (values.strict && total > 0) process.exitCode = 1
  } finally {
    preview?.stop()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
