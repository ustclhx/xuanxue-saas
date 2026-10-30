// 内容预写批次独立校验：不注册集合或路由，不修改其他 worker 的 check-content.mjs。
// 运行：node --experimental-strip-types scripts/check-content-concepts.mjs
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  COMPATIBILITY_MATRIX,
  LIFE_PATH_VALUES,
  lifePath,
  nameNumbers,
  reduceNumber,
} from '../packages/numerology/src/index.ts'

// 复用现有内容管线的 YAML 与 MDX 解析器，不增加根依赖或手写 YAML 解析器。
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const contentRequire = createRequire(webRequire.resolve('@content-collections/mdx/package.json'))
const bundlerRequire = createRequire(contentRequire.resolve('mdx-bundler'))
const mdxRequire = createRequire(bundlerRequire.resolve('@mdx-js/esbuild'))
const { parseDocument } = coreRequire('yaml')
const { createProcessor } = await import(pathToFileURL(mdxRequire.resolve('@mdx-js/mdx')).href)
const root = new URL('../apps/web/content/', import.meta.url)
const conceptBlocks = {
  'zh-Hant': {
    大運: 'luck',
    喜用神: 'useful-god',
    五行: 'elements',
    身強身弱: 'strength',
    空亡: 'shensha',
    神煞: 'shensha',
    八字重量: 'weight',
    十神: 'ten-gods',
  },
  ko: {
    대운: 'luck',
    용신: 'useful-god',
    오행: 'elements',
    신강신약: 'strength',
    공망: 'shensha',
    신살: 'shensha',
    일주: 'pillars',
    십신: 'ten-gods',
  },
}
// 跨语言共用 ASCII 文件标识，原语言 slug 继续用于 URL 与展示。
const conceptKeys = {
  luck: ['大運', '대운'],
  'useful-god': ['喜用神', '용신'],
  elements: ['五行', '오행'],
  strength: ['身強身弱', '신강신약'],
  void: ['空亡', '공망'],
  shensha: ['神煞', '신살'],
  weight: ['八字重量'],
  'day-pillar': ['일주'],
  'ten-gods': ['十神', '십신'],
}

function conceptFilename(slug) {
  const key = Object.entries(conceptKeys).find(([, slugs]) => slugs.includes(slug))?.[0]
  assert.ok(key && /^[a-z]+(?:-[a-z]+)*$/.test(key), `missing ASCII concept key: ${slug}`)
  return key
}

const titles = new Set()
const descriptions = new Set()
const totals = { 'zh-Hant': [], ko: [], en: [] }
let dateExamples = 0
let nameExamples = 0
let compatibilityExamples = 0
const failures = []

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function visibleText(tree) {
  const parts = []
  walk(tree, (node) => {
    // 代码算式、链接地址与 frontmatter 不计入最低篇幅。
    if (node.type === 'text' || node.type === 'inlineCode') parts.push(node.value)
  })
  return parts.join(' ')
}

function equation(step) {
  return `${step.operands.join(' + ')} = ${step.result}`
}

function checkExamples(tree, number) {
  const codes = []
  walk(tree, (node) => {
    if (node.type === 'code') codes.push(node.value)
  })
  const dateCodes = codes.filter((code) => code.startsWith('Birth date: '))
  assert.equal(dateCodes.length, 1, 'exactly one engine-checked date example required')
  for (const code of dateCodes) {
    const iso = code.match(/^Birth date: (\d{4})-(\d{2})-(\d{2})$/m)
    assert.ok(iso, 'valid date example label')
    const [year, month, day] = iso.slice(1).map(Number)
    const result = lifePath({ year, month, day })
    const expected = [`Birth date: ${iso.slice(1).join('-')}`]
    for (const [label, value] of [
      ['Month', month],
      ['Day', day],
      ['Year', year],
    ]) {
      const reduced = reduceNumber(value)
      expected.push(`${label}: ${reduced.steps.map(equation).join('; ') || value}`)
    }
    expected.push(
      `Total: ${result.steps
        .filter((step) => step.phase === 'total')
        .map(equation)
        .join('; ')}`,
    )
    expected.push(`Life path: ${result.value}`)
    assert.equal(
      code,
      expected.join('\n'),
      'date steps must match the engine, not only final value',
    )
    if (number !== null)
      assert.equal(result.value, number, 'example must demonstrate this page number')
    dateExamples++
  }
  for (const code of codes.filter((value) => value.startsWith('Name: '))) {
    const name = code.match(/^Name: (.+)$/m)?.[1]
    const result = nameNumbers(name)
    assert.ok(code.includes(`Normalized: ${result.normalized}\n`), 'name normalization')
    if (code.includes('Soul urge:')) {
      assert.ok(code.endsWith(`Soul urge: ${result.soulUrge.value}`), 'soul urge must match engine')
      assert.equal(name, 'Maya Chen')
      assert.ok(
        code.includes('Vowels: A + A + E\nValues: 1 + 1 + 5 = 7'),
        'vowel selection including Y',
      )
    } else {
      assert.ok(
        code.endsWith(`Expression: ${result.expression.value}`),
        'expression must match engine',
      )
      assert.equal(name, 'Hélène Dupont')
      assert.ok(code.includes('HELENE: 8 + 5 + 3 + 5 + 5 + 5 = 31'))
      assert.ok(code.includes('DUPONT: 4 + 3 + 7 + 6 + 5 + 2 = 27'))
      assert.ok(
        code.includes(
          `All letters: 31 + 27 = 58; ${result.expression.steps.map(equation).join('; ')}`,
        ),
      )
    }
    nameExamples++
  }
  if (number === null) assert.equal(codes.filter((value) => value.startsWith('Name: ')).length, 1)
}

async function checkFile(collection, locale, slug) {
  const isConcept = collection === 'concepts'
  const filename = isConcept ? conceptFilename(slug) : slug
  const file = new URL(`${collection}/${locale}/${filename}.mdx`, root)
  const source = await readFile(file, 'utf8')
  const match = source.match(/^---\n([\s\S]+?)\n---\n\n([\s\S]+)$/)
  assert.ok(match, 'frontmatter delimiters')
  const document = parseDocument(match[1], { uniqueKeys: true })
  assert.equal(document.errors.length, 0, 'valid YAML with unique keys')
  const data = document.toJS()
  const content = match[2]
  assert.deepEqual(
    Object.keys(data).sort(),
    [
      'title',
      'description',
      'slug',
      'locale',
      'faq',
      'updated',
      ...(isConcept ? ['block', 'conceptKey'] : ['number']),
    ].sort(),
  )
  for (const field of ['title', 'description', 'slug', 'locale', 'updated']) {
    assert.ok(
      typeof data[field] === 'string' && data[field].trim(),
      `${field} must be a nonempty string`,
    )
  }
  assert.equal(data.slug, slug)
  assert.equal(data.locale, locale)
  assert.equal(data.updated, '2026-10-19')
  assert.ok([...data.description].length <= 160, 'description exceeds 160 characters')
  assert.ok(!titles.has(data.title), 'duplicate title')
  assert.ok(!descriptions.has(data.description), 'duplicate description')
  titles.add(data.title)
  descriptions.add(data.description)
  assert.ok(!/\bAI\b/i.test(data.title), 'AI must not lead the title')
  assert.ok(
    Array.isArray(data.faq) && data.faq.length >= 3 && data.faq.length <= 5,
    '3–5 FAQ items',
  )
  const questions = new Set()
  for (const item of data.faq) {
    assert.deepEqual(Object.keys(item).sort(), ['a', 'q'])
    assert.ok(typeof item.q === 'string' && item.q.trim())
    assert.ok(typeof item.a === 'string' && item.a.trim())
    assert.ok(!questions.has(item.q), 'duplicate FAQ question')
    questions.add(item.q)
    assert.ok(content.includes(`### ${item.q}\n\n${item.a}`), 'visible FAQ must match frontmatter')
  }
  const processor = createProcessor()
  const tree = processor.parse(content)
  const links = []
  walk(tree, (node) => {
    assert.ok(
      !node.type.startsWith('mdx') && node.type !== 'html',
      'no JSX, expressions, HTML, imports or exports',
    )
    if (node.type === 'heading')
      assert.ok(
        node.depth === 2 || node.depth === 3,
        'body headings must be H2/H3; title supplies future H1',
      )
    if (node.type === 'link') links.push(node.url)
  })
  // 完整跑 MDX 编译管线；只解析源码，不执行生成的 JavaScript。
  await processor.process(content)
  const prose = content.split(/^## (?:延伸閱讀|함께 읽기|Explore the other numbers)$/m)[0]
  const plain = visibleText(processor.parse(prose))
  let count
  if (isConcept) {
    assert.equal(data.conceptKey, filename, 'conceptKey must match the shared ASCII filename')
    assert.equal(data.block, conceptBlocks[locale][slug])
    assert.ok(data.title.includes(slug), 'concept title keyword')
    const heading = locale === 'ko' ? '만세력 결과에서 보는 법' : '在排盤結果中怎麼看'
    assert.ok(content.includes(`## ${heading}\n`), 'result-reading section')
    assert.ok(content.includes(`\`${data.block}\``), 'document result block identifier')
    const languagePath = locale === 'ko' ? 'ko/사주' : 'zh-hant/八字'
    for (const other of Object.keys(conceptBlocks[locale]).filter((value) => value !== slug)) {
      assert.ok(links.includes(`/${languagePath}/${other}/`), `missing sibling link: ${other}`)
    }
    assert.ok(links.includes(locale === 'ko' ? '/ko/' : '/zh-hant/'), 'home link')
    if (locale === 'zh-Hant') {
      count = (plain.match(/\p{Script=Han}/gu) ?? []).length
      assert.ok(count >= 1200, `Chinese body: ${count} Han characters, expected >= 1200`)
      assert.ok(
        content.includes('人工審定') &&
          content.includes('僅供娛樂') &&
          content.includes('不預測未來'),
      )
    } else {
      count = [...plain.replace(/\s/g, '')].length
      assert.ok(count >= 2000, `Korean body: ${count} non-space characters, expected >= 2000`)
      assert.ok(
        (plain.match(/\p{Script=Hangul}/gu) ?? []).length >= 1500,
        'Korean language coverage',
      )
      assert.ok(
        content.includes('사람이 검토') &&
          content.includes('오락용') &&
          content.includes('미래를 예측하지 않습니다'),
      )
    }
  } else {
    const number = slug.startsWith('life-path-') ? Number(slug.slice(10)) : null
    assert.equal(data.number, number, 'hub number must be null; life-path number must be numeric')
    assert.ok(
      data.title.includes(
        number === null
          ? slug === 'soul-urge-number'
            ? 'Soul Urge Number'
            : 'Destiny Number'
          : `Life Path Number ${number}`,
      ),
    )
    for (const heading of [
      'Personality',
      'Love',
      'Career',
      'Compatibility',
      'Calculation example',
      'FAQ',
    ]) {
      assert.ok(new RegExp(`^## ${heading}(?::|$)`, 'm').test(content), `missing ${heading}`)
    }
    for (const other of LIFE_PATH_VALUES.filter((value) => value !== number)) {
      assert.ok(links.includes(`/life-path-number/${other}/`), `missing life path link: ${other}`)
    }
    assert.ok(links.includes('/'), 'calculator home link')
    assert.ok(
      content.includes('reviewed by a person') &&
        content.includes('for entertainment') &&
        content.includes('does not predict the future'),
    )
    count = (plain.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length
    assert.ok(count >= 900 && count <= 1300, `English prose: ${count} words, expected 900–1300`)
    checkExamples(tree, number)
    if (number !== null) {
      const pairs = content.match(
        /matrix labels (\d+) with (\d+) as (high|medium|challenging) and (\d+) with (\d+) as (high|medium|challenging)/,
      )
      assert.ok(pairs, 'two explicit compatibility examples required')
      for (const offset of [1, 4]) {
        const left = Number(pairs[offset])
        const right = Number(pairs[offset + 1])
        assert.equal(left, number)
        assert.equal(
          pairs[offset + 2],
          COMPATIBILITY_MATRIX[LIFE_PATH_VALUES.indexOf(left)]?.[LIFE_PATH_VALUES.indexOf(right)],
          'compatibility prose must match the editorial engine matrix',
        )
        compatibilityExamples++
      }
    }
  }
  totals[locale].push(count)
  console.log(`OK ${collection}/${locale}/${filename}.mdx (${count})`)
}

for (const [collection, locale, slugs] of [
  ...Object.entries(conceptBlocks).map(([locale, blocks]) => [
    'concepts',
    locale,
    Object.keys(blocks),
  ]),
  [
    'numerology',
    'en',
    [
      ...LIFE_PATH_VALUES.map((value) => `life-path-${value}`),
      'soul-urge-number',
      'destiny-number',
    ],
  ],
]) {
  const directory = new URL(`${collection}/${locale}/`, root)
  const files = (await readdir(directory)).filter((file) => file.endsWith('.mdx')).sort()
  assert.deepEqual(
    files,
    slugs.map((slug) => `${collection === 'concepts' ? conceptFilename(slug) : slug}.mdx`).sort(),
    `unexpected inventory: ${fileURLToPath(directory)}`,
  )
  for (const slug of slugs) {
    try {
      await checkFile(collection, locale, slug)
    } catch (error) {
      const filename = collection === 'concepts' ? conceptFilename(slug) : slug
      failures.push(`${collection}/${locale}/${filename}.mdx: ${error.message}`)
    }
  }
}
for (const [locale, counts] of Object.entries(totals)) {
  console.log(
    `${locale}: ${counts.length} pages, prose length ${Math.min(...counts)}–${Math.max(...counts)}`,
  )
}
console.log(`Engine-verified examples: ${dateExamples} dates, ${nameExamples} names`)
console.log(`Engine-verified compatibility labels: ${compatibilityExamples}`)
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    'PASS: 30 pages; schema, visible FAQ, links, length, Markdown-only MDX, and calculation examples',
  )
  console.log(
    'Not covered: route integration, canonical/hreflang/JSON-LD, browser anchors, factual/editorial review, deployment',
  )
}
