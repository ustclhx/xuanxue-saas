// pnpm build 后验证实际静态页面与八字懒加载 chunk；CI 与本地使用同一检查。
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const web = new URL('../', import.meta.url).pathname
const dist = join(web, 'dist/client')
const concepts = JSON.parse(
  readFileSync(join(web, '.content-collections/generated/allConcepts.js'), 'utf8')
    .replace(/^\s*export default\s*/, '')
    .trim()
    .replace(/;$/, ''),
)
assert.equal(concepts.length, 24, 'Expected 24 concept pages')
const pathOf = (page) =>
  `/${page.locale.toLowerCase()}/${page.locale === 'ko' ? '사주' : '八字'}/${page.slug}`
const files = readdirSync(dist, { recursive: true }).filter((file) => file.endsWith('.html'))
const expected = [
  '/zh-hant',
  '/zh-hans',
  '/ko',
  '/zh-hant/紫微斗數排盤',
  '/zh-hant/命盤查詢',
  '/zh-hans/紫微斗数排盘',
  '/zh-hans/命盘查询',
  '/ko/사주궁합',
  ...concepts.map(pathOf),
]
for (const path of expected)
  assert(files.includes(`${path.slice(1)}.html`), `Missing HTML: ${path}`)
const conceptFiles = files.filter((file) => /^(zh-hant\/八字|zh-hans\/八字|ko\/사주)\//u.test(file))
assert.equal(conceptFiles.length, 24, 'Unexpected concept HTML count')

function links(html) {
  return [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key.toLowerCase(), value]),
    ),
  )
}
for (const page of concepts) {
  const html = readFileSync(join(dist, `${pathOf(page).slice(1)}.html`), 'utf8')
  assert.equal([...html.matchAll(/<title>/g)].length, 1, `Title count: ${pathOf(page)}`)
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `H1 count: ${pathOf(page)}`)
  const headLinks = links(html)
  const canonical = headLinks.find((link) => link.rel === 'canonical')
  assert.equal(decodeURI(new URL(canonical.href).pathname), pathOf(page))
  const translations = concepts.filter((other) => other.conceptKey === page.conceptKey)
  const alternatives = headLinks.filter(
    (link) => link.rel === 'alternate' && link.hreflang !== 'x-default',
  )
  assert.equal(alternatives.length, translations.length, `Unexpected hreflang: ${pathOf(page)}`)
  for (const other of translations) {
    const alternate = alternatives.find((link) => link.hreflang === other.locale)
    assert(alternate, `Missing ${other.locale} hreflang: ${pathOf(page)}`)
    assert.equal(decodeURI(new URL(alternate.href).pathname), pathOf(other))
  }
  const schemas = [
    ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs),
  ].map(([, json]) => JSON.parse(json))
  assert(
    schemas.some(
      (schema) => schema['@type'] === 'FAQPage' && schema.mainEntity.length === page.faq.length,
    ),
    `Missing FAQ: ${pathOf(page)}`,
  )
}

// 通过 sourcemap 模块来源定位实际产物，避免哈希文件名变化或仅量入口壳导致误报。
// 八字包含 tyme4ts 与共用计算模块；紫微专用 iztro 不属于八字预算。
const chunks = []
for (const file of readdirSync(join(dist, 'assets'))) {
  if (!file.endsWith('.js.map')) continue
  const map = JSON.parse(readFileSync(join(dist, 'assets', file), 'utf8'))
  const engine = map.sources.some(
    (source) =>
      /\/tyme4ts\//.test(source) ||
      (/\/packages\/bazi\/src\//.test(source) && !source.endsWith('/ziwei.ts')),
  )
  if (engine) {
    const name = file.slice(0, -4)
    chunks.push({
      file: name,
      gzipBytes: gzipSync(readFileSync(join(dist, 'assets', name))).length,
    })
  }
}
assert(chunks.length > 0, 'No bazi engine chunks found; check sourcemaps')
const gzipBytes = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0)
console.log(
  JSON.stringify(
    {
      htmlPages: files.length,
      baziToolPages: expected.length,
      conceptPages: conceptFiles.length,
      hreflang: 'passed',
      chunks,
      engineGzipBytes: gzipBytes,
      limitBytes: 90 * 1024,
    },
    null,
    2,
  ),
)
assert(gzipBytes <= 90 * 1024, `Bazi engine gzip ${gzipBytes} bytes exceeds 90 KiB`)
