// 多语言 SEO 验收（多语言 SEO 规范 ML-01～ML-10「六、验收」，~/workspace/xuanxue-saas-evidence/i18n-spec/）。
// 本文件归项目所有（不是模板文件）。构建后启动 vite preview（或 --base-url 指定运行中的服务），按两站 previewHost 抓取：
//   1. 各站 `/` 与各语言首页：不同 Accept-Language（含无）返回完全相同的状态与正文，且没有 Location（ML-02）；
//   2. 每个可索引页面：canonical = 自身；hreflang 含自身、只有一条 x-default、不跨域名，所列语言版本都存在且双向互指
//      （各版本声明完全相同的一组）；有英文版本时 x-default 指向英文版本（ML-04、ML-05）；
//   3. `<html lang>` = 页面语言（hreflang 中指向自身的那一条）（ML-02、ML-08）；
//   4. 公开页面响应没有语言相关的 Set-Cookie，页面中没有 `?lang=` 链接（ML-01、ML-04）；
//   5. 站点地图 URL 集合 = 可索引页面集合：站点地图里的地址都 200、可索引、canonical 指向自身；
//      hreflang 指到的页面都在站点地图中（ML-06）；
//   6. 服务端 HTML 中没有语言提示（ML-03）。
// 用法（先 pnpm --filter @xuanxue/web build）：pnpm --filter @xuanxue/web check:i18n-seo [--base-url <地址>] [--json <文件>]
// 有违规时以 1 退出。
import { mkdirSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { resolveLinkingConfig } from './check-links-graph.mjs'

/** 测试 ML-02 用的浏览器语言（含不带 Accept-Language 的爬虫） */
export const ACCEPT_LANGUAGES = [
  null,
  'en-US,en;q=0.9',
  'zh-CN,zh;q=0.9',
  'zh-TW',
  'ko-KR',
  'ja-JP',
  'es-MX',
]

/** 语言相关的 Cookie 名（Paraglide 语言 Cookie 与手动选择记录） */
export const LOCALE_COOKIES = ['PARAGLIDE_LOCALE', 'locale-preference']

function attrs(tag) {
  const result = {}
  for (const match of tag.matchAll(/([a-zA-Z-:]+)\s*=\s*"([^"]*)"/g))
    result[match[1].toLowerCase()] = match[2].replaceAll('&amp;', '&')
  return result
}

/** 从 HTML 取出验收需要的字段 */
export function parseI18nHead(html) {
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? ''
  const canonical = []
  const alternates = []
  let robots = null
  for (const match of html.matchAll(/<link\b[^>]*>/g)) {
    const a = attrs(match[0])
    if (a.rel === 'canonical') canonical.push(a.href)
    if (a.rel === 'alternate' && a.hreflang) alternates.push([a.hreflang, a.href])
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/g)) {
    const a = attrs(match[0])
    if (a.name === 'robots') robots = a.content
  }
  return {
    lang: attrs(htmlTag).lang ?? null,
    canonical,
    alternates,
    robots,
    langQueryLinks: [...html.matchAll(/<a\b[^>]*href="[^"]*[?&]lang=[^"]*"/g)].length,
    prompt: /data-locale-prompt|data-locale-suggestion-for/.test(html),
  }
}

const noindex = (page) => /noindex/i.test(page.robots ?? '') || /noindex/i.test(page.xRobots ?? '')

/**
 * 分析一个站点的抓取结果。`pages`：规范地址 → { status, location, setCookie, xRobots, ...parseI18nHead }；
 * `sitemap`：站点地图中的地址；`variants`：首页地址 → 各 Accept-Language 的 { status, location, body }。
 * 返回违规描述列表。纯函数，便于测试。
 */
export function analyzeI18nSeo({ pages, sitemap, variants = {} }) {
  const problems = []
  const listed = new Set(sitemap)
  for (const [url, responses] of Object.entries(variants)) {
    const [first, ...rest] = responses
    for (const response of responses)
      if (response.location)
        problems.push(
          `ML-02 ${url}：Accept-Language ${response.language ?? '（无）'} 返回 Location ${response.location}`,
        )
    for (const response of rest)
      if (response.status !== first.status || response.body !== first.body)
        problems.push(
          `ML-02 ${url}：Accept-Language ${response.language ?? '（无）'} 的响应与不带该头时不同`,
        )
  }
  for (const url of sitemap) {
    const page = pages[url]
    if (!page) {
      problems.push(`ML-06 站点地图地址未抓取：${url}`)
      continue
    }
    if (page.status !== 200) problems.push(`ML-06 站点地图地址返回 ${page.status}：${url}`)
    if (noindex(page)) problems.push(`ML-06 站点地图地址为 noindex：${url}`)
  }
  for (const [url, page] of Object.entries(pages)) {
    if (page.setCookie && LOCALE_COOKIES.some((name) => page.setCookie.includes(`${name}=`)))
      problems.push(`ML-04 公开页面写入语言 Cookie：${url}`)
    if (page.langQueryLinks > 0) problems.push(`ML-01 页面含 ?lang= 链接：${url}`)
    if (page.prompt) problems.push(`ML-03 服务端 HTML 含语言提示：${url}`)
    if (page.status !== 200 || noindex(page)) continue
    if (!listed.has(url)) problems.push(`ML-06 可索引页面不在站点地图：${url}`)
    if (page.canonical.length !== 1 || page.canonical[0] !== url)
      problems.push(`ML-04 canonical 不是自身：${url} → ${page.canonical.join(', ') || '（无）'}`)
    const map = Object.fromEntries(page.alternates)
    const defaults = page.alternates.filter(([lang]) => lang === 'x-default')
    if (defaults.length !== 1) problems.push(`ML-05 x-default 有 ${defaults.length} 条：${url}`)
    const self = page.alternates.find(([lang, href]) => lang !== 'x-default' && href === url)
    if (!self) problems.push(`ML-05 hreflang 不含自身：${url}`)
    else if (page.lang !== self[0])
      problems.push(`ML-02 html lang=${page.lang} 与页面语言 ${self[0]} 不一致：${url}`)
    const host = new URL(url).host
    for (const [lang, href] of page.alternates) {
      if (new URL(href).host !== host)
        problems.push(`ML-05 hreflang 跨域名：${url} → ${lang} ${href}`)
      if (lang === 'x-default') continue
      const target = pages[href]
      if (!target || target.status !== 200 || noindex(target)) {
        problems.push(`ML-05 hreflang 指向不存在或不可索引的页面：${url} → ${lang} ${href}`)
        continue
      }
      const theirs = Object.fromEntries(target.alternates)
      if (
        JSON.stringify(Object.entries(theirs).sort()) !== JSON.stringify(Object.entries(map).sort())
      )
        problems.push(`ML-05 hreflang 不互指（两页声明的语言组不同）：${url} ↔ ${href}`)
    }
    if (map.en && map['x-default'] && map['x-default'] !== map.en)
      problems.push(`ML-05 有英文版本时 x-default 应指向英文版本：${url}`)
  }
  return problems
}

function request(baseUrl, host, path, language) {
  const base = new URL(baseUrl)
  return new Promise((done, fail) => {
    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port,
        path,
        method: 'GET',
        headers: {
          host,
          accept: 'text/html',
          ...(language ? { 'accept-language': language } : {}),
        },
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () =>
          done({
            status: res.statusCode ?? 0,
            location: res.headers.location ?? null,
            setCookie: [res.headers['set-cookie'] ?? []].flat().join('\n'),
            xRobots: res.headers['x-robots-tag'] ?? null,
            body,
          }),
        )
        res.on('error', fail)
      },
    )
    req.on('error', fail)
    req.setTimeout(30000, () => req.destroy(new Error(`timeout ${host}${path}`)))
    req.end()
  })
}

// 每个响应的 CSP nonce 不同（安全头与内联脚本），比较正文前去掉
const stableBody = (body) => body.replace(/nonce="[^"]*"/g, 'nonce=""')
const locs = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll('&amp;', '&'))

async function pool(items, worker, size = 8) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) await worker(queue.shift())
    }),
  )
}

/** 抓取一个站点：站点地图、其中全部页面、hreflang 指到的页面与首页的语言变体 */
export async function crawlSite(baseUrl, host, homes) {
  const index = await request(baseUrl, host, '/sitemap.xml')
  const sitemap = []
  for (const sub of locs(index.body)) {
    const response = await request(baseUrl, host, new URL(sub).pathname)
    sitemap.push(...locs(response.body))
  }
  const pages = {}
  const fetchPage = async (url) => {
    if (pages[url]) return
    pages[url] = { pending: true }
    const target = new URL(url)
    const response = await request(baseUrl, host, `${target.pathname}${target.search}`)
    pages[url] = { ...response, ...parseI18nHead(response.body), body: undefined }
  }
  await pool(sitemap, fetchPage)
  // hreflang 指到但不在站点地图中的页面也抓取，用于判断「不存在」与「不在站点地图」
  const extra = new Set()
  for (const page of Object.values(pages))
    for (const [, href] of page.alternates ?? []) if (!pages[href]) extra.add(href)
  await pool(
    [...extra].filter((href) => new URL(href).host === new URL(sitemap[0] ?? href).host),
    fetchPage,
  )
  const variants = {}
  for (const path of homes) {
    const responses = []
    for (const language of ACCEPT_LANGUAGES) {
      const response = await request(baseUrl, host, path, language)
      responses.push({
        language,
        status: response.status,
        location: response.location,
        body: stableBody(response.body),
      })
    }
    variants[`${host}${path}`] = responses
  }
  return { sitemap, pages, variants }
}

async function main() {
  const { values } = parseArgs({
    options: { 'base-url': { type: 'string' }, json: { type: 'string' } },
  })
  const templateConfig = (
    await import(new URL('../../../template.config.ts', import.meta.url).href)
  ).default
  const { localeUrlSegment } = await import('@xuanxue/config')
  const { startPreview } = await import('./check-links.mjs')
  const linking = resolveLinkingConfig(templateConfig.seo?.linking)
  const preview = values['base-url'] ? null : await startPreview()
  const baseUrl = values['base-url'] ?? preview.baseUrl
  const report = []
  try {
    for (const site of ['west', 'east']) {
      const { locales, defaultLocale } = templateConfig.sites[site]
      const host = linking.sites.find((entry) =>
        entry.locales.some((l) => locales.includes(l)),
      )?.previewHost
      if (!host) continue
      const homes = [
        '/',
        ...locales.filter((l) => l !== defaultLocale).map((l) => `/${localeUrlSegment(l)}`),
      ]
      const crawl = await crawlSite(baseUrl, `${host}:${new URL(baseUrl).port}`, homes)
      const problems = analyzeI18nSeo(crawl)
      report.push({
        site,
        host,
        pages: Object.keys(crawl.pages).length,
        sitemap: crawl.sitemap.length,
        problems,
      })
    }
  } finally {
    preview?.stop()
  }
  for (const { site, host, pages, sitemap, problems } of report) {
    console.log(
      `== ${site}（${host}）：站点地图 ${sitemap} 个地址，抓取 ${pages} 页，违规 ${problems.length} 项`,
    )
    for (const problem of problems.slice(0, 50)) console.log(`  - ${problem}`)
    if (problems.length > 50) console.log(`  … 另有 ${problems.length - 50} 项`)
  }
  if (values.json) {
    mkdirSync(dirname(resolve(values.json)), { recursive: true })
    writeFileSync(resolve(values.json), `${JSON.stringify(report, null, 2)}\n`)
  }
  if (report.some((site) => site.problems.length > 0)) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
