// 本地化相似度测量（OpenSpec add-locales-eu-ja 任务 2.1；localized-content-quality spec）。
// 由 SEO 修复第 5 步的 part-b 脚本移植：按站点地图与 hreflang 配对渲染后页面，计算
//   - 同文字变体（zh-Hant → zh-Hans 等）：整页 / 段落 Dice 与整句复现；
//   - 跨语言：结构直译分与数字序列重合；
//   - 同语言程序化集合（牌义、数字页、概念页）：按位置段落的模板重复（渲染页与 MDX 源两种口径）；
//   - FAQ `origin` 统计与长度下限。
// 公式见 locale-similarity.mjs。只读构建产物与内容源文件，不访问线上站点。
//
// 用法（先 `pnpm --filter @xuanxue/web build`）：
//   node apps/web/scripts/measure-locale-similarity.mjs --site east [--opencc <目录>] [--enforce ja]
//   --site <id>        站点（template.config.ts 的 sites 键）；省略时测量全部站点
//   --base-url <地址>  测已在运行的服务（按 seo.linking.sites 的 previewHost 作 Host），不启动 preview
//   --pivot <语言>     基准语言（缺省：east 为 zh-Hans，有 en 的站点为 en，否则站点第一种语言）
//   --pairs a:b,...    额外的「语言:对照语言」对（如 ja:ko），默认每种语言只与基准语言比较
//   --opencc <目录>    含 node_modules/opencc-js 的目录（仓库不安装 opencc）；缺省时跳过 zh-Hant 变体比较
//   --out <目录>       输出目录，缺省 $EVIDENCE_DIR/locale-similarity（未设置时 test-results/evidence/）
//   --enforce <语言>   这些语言有未达门槛的页面时以 1 退出；缺省只报告。
//                      en、es 另判组件段（content-growth-phase1）：任一段平均 Dice >0.30 即失败
//                      东方站新集合另判同语言、同 H2 的正文段；数据表段与整页只报告
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { hostRequest, startPreview } from './check-links.mjs'
import {
  COMPONENT_LOCALES,
  componentSections,
  createExtractor,
  eastCollection,
  eastCollectionSections,
  entryLocale,
  evaluatePage,
  exceedsEastSectionThreshold,
  faqOriginStats,
  lengthCheck,
  literalScore,
  PROGRAMMATIC_KINDS,
  pageKind,
  pageLength,
  parseSitemap,
  renderMarkdown,
  SCRIPT_VARIANTS,
  summarizeByKind,
  THRESHOLDS,
  templateRepeat,
  templateRepeatFromDir,
  unitOf,
  variantSimilarity,
} from './locale-similarity.mjs'

const WEB_ROOT = new URL('..', import.meta.url).pathname
const REPO_ROOT = resolve(WEB_ROOT, '../..')
const CONCURRENCY = 8
const DEFAULT_PIVOT = { east: 'zh-Hans' }

/** MDX 源文件口径的模板重复：集合目录 → 参与比较的文件 */
const SOURCE_SETS = {
  tarot: () => true,
  numerology: (file) => /^life-path-\d+\.mdx$/.test(file),
  concepts: () => true,
}

export async function loadTemplateConfig() {
  const module = await import(pathToFileURL(join(REPO_ROOT, 'template.config.ts')).href)
  return module.default
}

/** opencc-js 只装在仓库外（证据目录或临时目录），按目录解析 */
async function loadOpenCC(dir) {
  if (!dir) return null
  const require = createRequire(join(resolve(dir), 'noop.js'))
  const OpenCC = await import(pathToFileURL(require.resolve('opencc-js')).href)
  const toCn = (OpenCC.default ?? OpenCC).Converter({ from: 'tw', to: 'cn' })
  return { t2s: toCn }
}

export async function readAllSitemaps(origin, send, path = '/sitemap.xml', seen = new Set()) {
  if (seen.has(path)) return []
  seen.add(path)
  const response = await send(new URL(path, origin).href)
  if (response.status !== 200) {
    await response.cancel()
    throw new Error(`站点地图 ${path} 返回 ${response.status}`)
  }
  const { index, urls } = parseSitemap(await response.text())
  const nested = await Promise.all(
    index.map((loc) => readAllSitemaps(origin, send, new URL(loc).pathname, seen)),
  )
  return [...urls, ...nested.flat()]
}

/**
 * 按站点访问 preview：以 seo.linking.sites 的 previewHost 作 Host（缺省 `<站点 id>.localhost`），
 * 返回该站点地图的全部条目与取页函数。已发布的黄历月份页由站点地图发现，取页时走 SSR。
 */
export async function siteClient(config, siteId, baseUrl) {
  const site = config.sites?.[siteId]
  if (!site) throw new Error(`未知站点：${siteId}`)
  const host =
    (config.seo?.linking?.sites ?? []).find((s) => s.locales.join(',') === site.locales.join(','))
      ?.previewHost ?? `${siteId}.localhost`
  const send = hostRequest(baseUrl, new Set([host]))
  const url = new URL(baseUrl)
  url.hostname = host
  const origin = url.origin
  const pending = pendingEntries(
    siteId,
    site.locales,
    (await import('../src/features/i18n/rollout.ts')).releaseState,
  )
  const entries = [...(await readAllSitemaps(origin, send)), ...pending]
  // 已发布语言的页面不列未发布语言（hreflang 过滤），按未发布页面自身的 hreflang 反向补上对应关系
  const byLoc = new Map(entries.map((e) => [e.loc, e]))
  for (const e of pending) {
    const own = Object.entries(e.alts).find(([, href]) => href === e.loc)?.[0]
    for (const [lang, href] of Object.entries(e.alts))
      if (lang !== 'x-default' && href !== e.loc && byLoc.get(href) && own)
        byLoc.get(href).alts = { ...byLoc.get(href).alts, [own]: e.loc }
  }
  const fetchHtml = async (path) => {
    const response = await send(new URL(path, origin).href)
    if (response.status !== 200) {
      await response.cancel()
      throw new Error(`${response.status} ${decodeURIComponent(path)}`)
    }
    return response.text()
  }
  return { site, host, entries, fetchHtml }
}

/**
 * 未发布语言（features/i18n/rollout.ts）不进站点地图，但发布前就要过门槛：从预渲染产物
 * dist/client/<语言前缀>/ 取它的页面，loc 与对应关系取自页面自身的 hreflang（自指 + 已发布语言）。
 */
export function pendingEntries(
  siteId,
  locales,
  releaseState,
  distDir = join(WEB_ROOT, 'dist/client'),
) {
  const entries = []
  for (const locale of locales.filter((l) => releaseState(siteId, l) !== 'released')) {
    const prefix = locale.toLowerCase()
    const files = []
    if (existsSync(join(distDir, `${prefix}.html`))) files.push(`${prefix}.html`)
    const walk = (dir) => {
      if (!existsSync(join(distDir, dir))) return
      for (const name of readdirSync(join(distDir, dir))) {
        const rel = `${dir}/${name}`
        if (statSync(join(distDir, rel)).isDirectory()) walk(rel)
        else if (name.endsWith('.html')) files.push(rel)
      }
    }
    walk(prefix)
    for (const file of files) {
      const html = readFileSync(join(distDir, file), 'utf8')
      if (/<meta[^>]+name="robots"[^>]+noindex/.test(html.slice(0, html.indexOf('</head>'))))
        continue
      const alts = {}
      for (const m of html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)) {
        const lang = /hreflang="([^"]+)"/i.exec(m[0])?.[1]
        const href = /href="([^"]+)"/.exec(m[0])?.[1]
        if (lang && href) alts[lang] = href.replaceAll('&amp;', '&')
      }
      if (alts[locale]) entries.push({ loc: alts[locale], alts })
    }
  }
  return entries
}

export async function pool(items, worker) {
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

/** 测量一个站点；`fetchHtml(pathname)` 返回 HTML。导出供测试以内存页面调用 */
export async function measureSite({
  siteId,
  siteLocales,
  entries,
  fetchHtml,
  pivot,
  extraPairs = [],
  converters = {},
  contentDir = join(WEB_ROOT, 'content'),
  messageOrigins = {},
  disclaimers = {},
  enforce = [],
  source = '',
}) {
  const extractor = createExtractor()
  try {
    // 每个地址只取一次
    const byLocale = new Map()
    const allPaths = new Set()
    const eastPaths = new Set()
    for (const entry of entries) {
      const locale = entryLocale(entry)
      if (!locale || !siteLocales.includes(locale)) continue
      const { pathname: path, search } = new URL(entry.loc)
      const collection = siteId === 'east' && !search ? eastCollection(path, locale) : null
      if (collection) eastPaths.add(path)
      allPaths.add(path)
      if (!byLocale.has(locale)) byLocale.set(locale, [])
      byLocale.get(locale).push({ path, alts: entry.alts, collection })
    }
    const paths = [...allPaths]
    const extracted = await pool(paths, async (path) =>
      extractor.extract(await fetchHtml(path), { eastProgrammatic: eastPaths.has(path) }),
    )
    const pages = new Map(paths.map((path, i) => [path, extracted[i]]))
    const pathOf = (href) => new URL(href).pathname
    const decode = (p) => decodeURIComponent(p)

    const locales = siteLocales.filter((l) => byLocale.has(l))
    const pairList = [
      ...locales.filter((l) => l !== pivot).map((l) => [l, pivot]),
      ...extraPairs.filter(([l, b]) => byLocale.has(l) && byLocale.has(b)),
    ]

    // 逐页记录：以对照语言的页面为行，target 语言作为 pairs 键
    const records = new Map()
    const recordFor = (basePath, baseLocale) => {
      const key = `${baseLocale}:${basePath}`
      if (!records.has(key))
        records.set(key, {
          path: decode(basePath),
          base: baseLocale,
          kind: pageKind(basePath),
          chars: pages.get(basePath).chars,
          pairs: {},
          length: {},
        })
      return records.get(key)
    }
    const pairsReport = {}
    const unpaired = {}
    for (const [locale, base] of pairList) {
      const variant = SCRIPT_VARIANTS[locale]?.of === base ? SCRIPT_VARIANTS[locale] : null
      const convert = variant?.convert ? converters[variant.convert] : (t) => t
      const type = variant ? 'variant' : 'literal'
      const pairKey =
        pairList.filter(([l]) => l === locale).length > 1 ? `${locale}~${base}` : locale
      if (variant && !convert) {
        pairsReport[pairKey] = {
          base,
          type,
          skipped: `需要 ${variant.convert} 转换（--opencc <含 opencc-js 的目录>）`,
        }
        continue
      }
      const unit = unitOf(base)
      for (const { path, alts } of byLocale.get(base)) {
        const targetHref = alts[locale]
        if (!targetHref) continue
        const targetPath = pathOf(targetHref)
        if (!pages.has(targetPath)) continue
        const rec = recordFor(path, base)
        const result = { path: decode(targetPath) }
        if (variant)
          result.variant = variantSimilarity(pages.get(path), pages.get(targetPath), {
            convert,
            unit,
          })
        else result.literal = literalScore(pages.get(path), pages.get(targetPath))
        rec.pairs[pairKey] = result
      }
      const rows = [...records.values()].filter((r) => r.pairs[pairKey])
      const failing = rows
        .map((r) => ({ path: r.path, kind: r.kind, failures: evaluatePage(r, pairKey) }))
        .filter((f) => f.failures.length)
      pairsReport[pairKey] = {
        base,
        type,
        pages: rows.length,
        byKind: summarizeByKind(rows, pairKey),
        failing,
      }
    }
    // 没有对照页的页面（如 ko 独有的사주궁합、东方站 /en）
    for (const locale of locales) {
      if (locale === pivot) continue
      unpaired[locale] = byLocale
        .get(locale)
        .filter(({ alts }) => !alts[pivot])
        .map(({ path }) => decode(path))
    }

    // 长度：每种语言每页；程序化页面与基准语言对应页比较
    const lengths = {}
    for (const locale of locales) {
      const failing = []
      let checked = 0
      for (const { path, alts } of byLocale.get(locale)) {
        const kind = pageKind(path)
        const length = pageLength(pages.get(path), locale)
        const basePath = locale !== pivot && alts[pivot] ? pathOf(alts[pivot]) : null
        const sourceLength =
          basePath && pages.has(basePath) ? pageLength(pages.get(basePath), pivot) : null
        const check = lengthCheck({ kind, locale, length, sourceLength })
        if (!check) continue
        checked += 1
        if (!check.ok) failing.push(`${decode(path)}（${check.ratio ?? length.value}）`)
        if (basePath && records.has(`${pivot}:${basePath}`))
          records.get(`${pivot}:${basePath}`).length[locale] = { ...length, check }
      }
      lengths[locale] = { checked, failing }
    }

    // 模板重复：渲染页按语言 × 集合；MDX 源按内容目录
    const rendered = {}
    for (const locale of locales) {
      rendered[locale] = {}
      for (const kind of PROGRAMMATIC_KINDS) {
        const group = byLocale
          .get(locale)
          .filter(({ path }) => pageKind(path) === kind)
          .map(({ path }) => ({ id: decode(path), sections: pages.get(path).sections }))
        if (group.length > 1)
          rendered[locale][kind] = templateRepeat(group, { unit: unitOf(locale) })
      }
    }
    // 组件段：按段标题对齐、只计组件输出（en、es）
    const components = {}
    for (const locale of locales.filter((l) => COMPONENT_LOCALES.includes(l)))
      components[locale] = componentSections(
        byLocale.get(locale).map(({ path }) => ({
          id: decode(path),
          kind: pageKind(path),
          sections: pages.get(path).sections,
        })),
        { unit: unitOf(locale), disclaimer: disclaimers[locale] },
      )
    const eastCollections = {}
    if (siteId === 'east') {
      for (const locale of locales) {
        const groups = new Map()
        for (const { path, collection } of byLocale.get(locale)) {
          if (!collection) continue
          if (!groups.has(collection)) groups.set(collection, new Set())
          groups.get(collection).add(path)
        }
        if (!groups.size) continue
        eastCollections[locale] = Object.fromEntries(
          [...groups].map(([collection, paths]) => [
            collection,
            eastCollectionSections(
              [...paths].map((path) => ({
                id: decode(path),
                sections: pages.get(path).eastSections,
              })),
              { unit: unitOf(locale) },
            ),
          ]),
        )
      }
    }
    const sourceRepeat = {}
    for (const locale of locales)
      for (const [collection, filter] of Object.entries(SOURCE_SETS)) {
        const dir = join(contentDir, collection, locale)
        try {
          const res = templateRepeatFromDir(dir, { unit: unitOf(locale), filter })
          if (res.pages > 1) sourceRepeat[`${collection}:${locale}`] = res
        } catch {
          // 该语言没有此集合
        }
      }

    const faqOrigin = {}
    for (const locale of locales)
      faqOrigin[locale] = faqOriginStats({
        contentDir,
        locale,
        messageOrigins: messageOrigins[locale] ?? null,
      })

    const report = {
      site: siteId,
      generatedAt: new Date().toISOString(),
      source,
      pivot,
      enforce,
      pageCounts: Object.fromEntries(locales.map((l) => [l, byLocale.get(l).length])),
      pairs: pairsReport,
      unpaired,
      templateRepeat: { rendered, source: sourceRepeat },
      componentSections: components,
      ...(siteId === 'east' ? { eastCollections } : {}),
      faqOrigin,
      lengths,
      pages: [...records.values()],
    }
    report.enforcedFailures = enforcedFailures(report, enforce)
    return report
  } finally {
    await extractor.close()
  }
}

/**
 * --enforce 的语言：页面门槛、模板重复、东方站集合、组件段、FAQ 来源与长度任一不达标即计入。
 * 基准语言（如西方站 en）是原文：不判 FAQ 来源与 MDX 源模板重复（en 数字页源文件末尾的
 * 「Explore the other numbers」不渲染，#247 决定不处理）。
 */
export function enforcedFailures(report, enforce) {
  const out = []
  for (const locale of enforce) {
    const isPivot = locale === report.pivot
    for (const [key, pair] of Object.entries(report.pairs))
      if (key === locale || key.startsWith(`${locale}~`))
        for (const f of pair.failing ?? []) out.push(`${key} ${f.path}: ${f.failures.join(', ')}`)
    // 模板重复按 MDX 源判定：渲染页还含组件固定输出的段（「抽一张试试」、延伸牌义列表等），由组件段单独判定
    if (!isPivot)
      for (const [key, res] of Object.entries(report.templateRepeat.source))
        if (key.endsWith(`:${locale}`))
          for (const s of res.slots)
            if (s.mean > THRESHOLDS.templateRepeat)
              out.push(`${key} #${s.index} ${s.title}: template ${s.mean}`)
    for (const s of report.componentSections?.[locale] ?? [])
      if (s.mean > THRESHOLDS.templateRepeat)
        out.push(
          `${locale} component ${s.kind} ${s.label}: ${s.mean}（最差 ${s.maxPage} ${s.max}）`,
        )
    for (const [collection, sections] of Object.entries(report.eastCollections?.[locale] ?? {}))
      for (const s of sections)
        if (exceedsEastSectionThreshold(s))
          out.push(`${locale} ${collection} ${s.title}: ${s.mean}（最差 ${s.maxPage} ${s.max}）`)
    if (!isPivot)
      for (const page of report.faqOrigin[locale]?.failing ?? [])
        out.push(`${locale} FAQ origin: ${page}`)
    for (const page of report.lengths[locale]?.failing ?? []) out.push(`${locale} length: ${page}`)
  }
  return out
}

/** 结果区合规声明（tools_disclaimer）全文：组件段截断用 */
function readDisclaimers(locales) {
  const out = {}
  for (const locale of locales) {
    try {
      out[locale] = JSON.parse(
        readFileSync(join(WEB_ROOT, 'messages', locale, 'tools.json'), 'utf8'),
      ).tools_disclaimer
    } catch {
      // 该语言没有工具文案
    }
  }
  return out
}

function readMessageOrigins(locales) {
  const out = {}
  for (const locale of locales) {
    try {
      out[locale] = JSON.parse(
        readFileSync(join(WEB_ROOT, 'i18n/faq-origin', `${locale}.json`), 'utf8'),
      )
    } catch {
      // 没有登记文件：只统计内容 frontmatter
    }
  }
  return out
}

async function main() {
  const { values } = parseArgs({
    options: {
      site: { type: 'string' },
      'base-url': { type: 'string' },
      pivot: { type: 'string' },
      pairs: { type: 'string' },
      opencc: { type: 'string' },
      out: { type: 'string' },
      enforce: { type: 'string' },
    },
  })
  const config = await loadTemplateConfig()
  const sites = Object.entries(config.sites ?? {}).filter(
    ([id]) => !values.site || id === values.site,
  )
  if (!sites.length) throw new Error(`未知站点：${values.site}`)
  const opencc = await loadOpenCC(values.opencc ?? process.env.OPENCC_DIR)
  const enforce = (values.enforce ?? '').split(',').filter(Boolean)
  const extraPairs = (values.pairs ?? '')
    .split(',')
    .filter(Boolean)
    .map((p) => p.split(':'))
  const outDir = resolve(
    values.out ??
      join(
        process.env.EVIDENCE_DIR ?? join(REPO_ROOT, 'test-results/evidence'),
        'locale-similarity',
      ),
  )
  const preview = values['base-url'] ? null : await startPreview()
  const baseUrl = values['base-url'] ?? preview.baseUrl
  let failed = 0
  try {
    for (const [siteId, site] of sites) {
      const { host, entries, fetchHtml } = await siteClient(config, siteId, baseUrl)
      const pivot =
        values.pivot ??
        DEFAULT_PIVOT[siteId] ??
        (site.locales.includes('en') ? 'en' : site.locales[0])
      const started = performance.now()
      const report = await measureSite({
        siteId,
        siteLocales: site.locales,
        entries,
        fetchHtml,
        pivot,
        extraPairs,
        converters: opencc ?? {},
        messageOrigins: readMessageOrigins(site.locales),
        disclaimers: readDisclaimers(site.locales),
        enforce,
        source: `${values['base-url'] ? baseUrl : 'vite preview（apps/web/dist）'} Host=${host}`,
      })
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, `${siteId}.json`), `${JSON.stringify(report, null, 2)}\n`)
      writeFileSync(join(outDir, `${siteId}.md`), renderMarkdown(report))
      const seconds = ((performance.now() - started) / 1000).toFixed(1)
      console.log(
        `${siteId}：${Object.entries(report.pageCounts)
          .map(([l, n]) => `${l} ${n}`)
          .join('，')} 页；${seconds} 秒 → ${join(outDir, `${siteId}.md`)}`,
      )
      for (const [key, pair] of Object.entries(report.pairs))
        console.log(
          pair.skipped
            ? `  ${key} ↔ ${pair.base}：跳过（${pair.skipped}）`
            : `  ${key} ↔ ${pair.base}：${pair.pages} 页，未达门槛 ${pair.failing.length}`,
        )
      for (const [locale, slots] of Object.entries(report.componentSections))
        for (const s of slots)
          console.log(`  组件段 ${locale} ${s.kind} ${s.label}：${s.pages} 页，平均 ${s.mean}`)
      if (report.enforcedFailures.length) {
        failed += report.enforcedFailures.length
        for (const line of report.enforcedFailures.slice(0, 40)) console.error(`  ✗ ${line}`)
      }
    }
  } finally {
    preview?.stop()
  }
  if (failed) {
    console.error(`本地化门槛未通过：${failed} 项（--enforce ${enforce.join(',')}）`)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
