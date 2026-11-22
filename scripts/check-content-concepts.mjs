// 内容预写批次独立校验：不注册集合或路由，不修改其他 worker 的 check-content.mjs。
// 运行：node --experimental-strip-types scripts/check-content-concepts.mjs
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exampleDateFor, SAMPLE_FROM_YEAR } from '../apps/web/src/features/tools/numerology/calc.ts'
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
  'zh-Hans': {
    大运: 'luck',
    喜用神: 'useful-god',
    五行: 'elements',
    身强身弱: 'strength',
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
  luck: ['大運', '大运', '대운'],
  'useful-god': ['喜用神', '용신'],
  elements: ['五行', '오행'],
  strength: ['身強身弱', '身强身弱', '신강신약'],
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
const internalIds = new RegExp(
  `\\b(?:${[...new Set([...Object.keys(conceptKeys), ...Object.values(conceptBlocks.ko)])].join('|')})\\b`,
)
const totals = { 'zh-Hant': [], 'zh-Hans': [], ko: [], en: [] }
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
      ...(isConcept && locale === 'zh-Hans' ? ['aliases'] : []),
      // 数字页组件段（content-growth-phase1），内容在文末单独校验
      ...(slug.startsWith('life-path-') ? ['sample_note', 'neighbors'] : []),
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
  const prose = content.split(/^## (?:延伸閱讀|延伸阅读|함께 읽기|Explore the other numbers)$/m)[0]
  const plain = visibleText(processor.parse(prose))
  let count
  if (isConcept) {
    assert.equal(data.conceptKey, filename, 'conceptKey must match the shared ASCII filename')
    assert.equal(data.block, conceptBlocks[locale][slug])
    assert.ok(data.title.includes(slug), 'concept title keyword')
    assert.ok(!internalIds.test(content), 'body must not expose internal concept or block IDs')
    const heading =
      locale === 'ko'
        ? '만세력 결과에서 보는 법'
        : locale === 'zh-Hans'
          ? '在排盘结果中怎么看'
          : '在排盤結果中怎麼看'
    assert.ok(content.includes(`## ${heading}\n`), 'result-reading section')
    const languagePrefix = locale.toLowerCase()
    const languagePath = `${languagePrefix}/${locale === 'ko' ? '사주' : '八字'}`
    for (const other of Object.keys(conceptBlocks[locale]).filter((value) => value !== slug)) {
      assert.ok(links.includes(`/${languagePath}/${other}/`), `missing sibling link: ${other}`)
    }
    // 语言首页是品牌落地页（openspec separate-landing-homepage D5）：排盘入口链接到主工具页，不链接语言首页
    const toolSlug = { 'zh-Hant': '八字排盤', 'zh-Hans': '八字排盘', ko: '만세력' }[locale]
    assert.ok(links.includes(`/${languagePrefix}/${toolSlug}`), 'main tool page link')
    assert.ok(
      !links.some(
        (link) => link.replace(/[#?].*$/, '').replace(/\/$/, '') === `/${languagePrefix}`,
      ),
      'must not link the language home page as the chart tool',
    )
    if (locale === 'zh-Hans') {
      assert.ok(Array.isArray(data.aliases), 'simplified concepts require aliases')
      assert.ok(
        data.aliases.every((alias) => typeof alias === 'string' && alias.trim() === alias && alias),
        'aliases must be nonempty, trimmed strings',
      )
      assert.equal(new Set(data.aliases).size, data.aliases.length, 'duplicate aliases')
      assert.ok(!data.aliases.includes(slug), 'canonical slug must not be an alias')
      const traditionalSlug = Object.keys(conceptBlocks['zh-Hant']).find(
        (value) => conceptFilename(value) === filename,
      )
      assert.deepEqual(
        data.aliases,
        traditionalSlug === slug ? [] : [traditionalSlug],
        'aliases must cover the corresponding traditional slug',
      )
      assert.ok(
        !content.includes('/zh-hant/'),
        'simplified body must not link to traditional pages',
      )
      assert.ok(
        links.filter((link) => link.startsWith('/')).every((link) => link.startsWith('/zh-hans/')),
        'simplified internal links must stay in the same locale',
      )
      assert.ok(
        !/国历|栏位|区块|纪录|机率|透过|群组|顺位|考量|语汇|品质|转职|证照|画面|标示|(?:急|接|沿)著|[運強體盤]/u.test(
          `${data.title}\n${data.description}\n${JSON.stringify(data.faq)}\n${content}`,
        ),
        'simplified copy must use simplified characters and terms',
      )
    }
    if (locale !== 'ko') {
      count = (plain.match(/\p{Script=Han}/gu) ?? []).length
      assert.ok(count >= 1200, `Chinese body: ${count} Han characters, expected >= 1200`)
      assert.ok(
        locale === 'zh-Hans'
          ? content.includes('人工审定') &&
              content.includes('仅供参考') &&
              content.includes('不预测未来')
          : content.includes('人工審定') &&
              content.includes('僅供參考') &&
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
          content.includes('자기 탐색') &&
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
    // 西方站首页是品牌落地页（openspec separate-landing-homepage D5）：计算器在 /life-path-number，内容不得以 `/` 作为计算器链接
    assert.ok(links.includes('/life-path-number'), 'Life Path calculator link')
    assert.ok(
      !links.some((link) => link.replace(/[#?].*$/, '') === '/'),
      'must not link `/` as the calculator',
    )
    assert.ok(
      content.includes('reviewed by a person') &&
        content.includes('for reference and self-reflection') &&
        content.includes('does not predict the future'),
    )
    count = (plain.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length
    assert.ok(count >= 900 && count <= 1300, `English prose: ${count} words, expected 900–1300`)
    checkExamples(tree, number)
    if (number !== null) {
      // 锚文本可以包住「… compatibility matrix」（openspec seo-fix-tdk-links 决策 5），链接收尾 `](…)` 在 matrix 之后
      const pairs = content.match(
        /matrix(?:\]\([^)]*\))? labels (\d+) with (\d+) as (high|medium|challenging) and (\d+) with (\d+) as (high|medium|challenging)/,
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
  // 计算器汇总页与入门页有独立正文结构，不属于这批含计算样例的长文（入门页在文末单独校验）。
  const files = (await readdir(directory))
    .filter(
      (file) =>
        file.endsWith('.mdx') &&
        !(
          collection === 'numerology' &&
          (file === 'life-path-number.mdx' || file === 'numerology.mdx')
        ),
    )
    .sort()
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
// 数字页组件段（openspec content-growth-phase1 决策 1、4）：en、es 每个数字页的 `sample_note` 与 `neighbors`。
// 样例说明里的算式必须与页面样例日期 exampleDateFor(n, 起始年) 的引擎步骤逐条一致（顺序相同、不多不少）；
// `neighbors` 的方括号锚文本与页面链接一一对应：顺序同 copy.ts 的 neighborNumbers()，文字同现有锚文本。
const WORDS = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu
const NEIGHBOR_ANCHOR = { en: 'Life Path Number', es: 'Número de vida' }
let componentPages = 0
/** 与 apps/web/src/features/tools/numerology/copy.ts 的 neighborNumbers() 相同（该文件引用文案运行时，脚本不能直接导入） */
function neighborLinks(value) {
  if (value > 9) {
    const masters = [11, 22, 33].filter((master) => master !== value)
    return [...masters, (value / 11) * 2]
  }
  return [((value + 7) % 9) + 1, (value % 9) + 1]
}
for (const locale of ['en', 'es']) {
  for (const value of LIFE_PATH_VALUES) {
    const name = `numerology/${locale}/life-path-${value}.mdx`
    try {
      const source = await readFile(new URL(name, root), 'utf8')
      const data = parseDocument(source.match(/^---\n([\s\S]+?)\n---\n/)[1]).toJS()
      assert.ok(typeof data.sample_note === 'string', 'sample_note required')
      assert.ok(typeof data.neighbors === 'string', 'neighbors required')
      const noteWords = data.sample_note.match(WORDS)?.length ?? 0
      assert.ok(
        noteWords >= 100 && noteWords <= 130,
        `sample_note: ${noteWords} words, expected 100–130`,
      )
      const neighborWords = data.neighbors.match(WORDS)?.length ?? 0
      assert.ok(
        neighborWords >= 45 && neighborWords <= 80,
        `neighbors: ${neighborWords} words, expected 45–80`,
      )
      const date = exampleDateFor(value, SAMPLE_FROM_YEAR[locale])
      assert.deepEqual(
        data.sample_note.match(/\d+(?: \+ \d+)+ = \d+/g) ?? [],
        lifePath(date).steps.map(equation),
        `sample_note steps must match the engine for ${date.year}-${date.month}-${date.day}`,
      )
      assert.deepEqual(
        [...data.neighbors.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]),
        neighborLinks(value).map((other) => `${NEIGHBOR_ANCHOR[locale]} ${other}`),
        'neighbors anchors must match neighborNumbers() and the existing anchor text',
      )
      componentPages++
    } catch (error) {
      failures.push(`${name}: ${error.message}`)
    }
  }
}
console.log(`Engine-verified component notes: ${componentPages} life path pages (en, es)`)

// 数字命理入门页（openspec content-growth-phase1 决策 7）：en `/numerology`、es `/es/numerologia`。
// 正文（FAQ 之前）≥1,000 词、FAQ 3–4 问且与 frontmatter 逐字相同、正文链接 2–5 个计算器、合规表述、不提 AI；
// 唯一的日期算例逐行与引擎一致，两种语言的算例日期不同。
const INTRO = {
  en: {
    faq: 'FAQ',
    labels: ['Birth date', 'Month', 'Day', 'Year', 'Total', 'Life path'],
    calculators: [
      '/life-path-number',
      '/numerology-calculator',
      '/name-numerology',
      '/life-path-compatibility',
    ],
    phrases: [
      'calculated with traditional methods',
      'for reference and self-reflection',
      'does not predict the future',
      'consult a medical professional',
    ],
  },
  es: {
    faq: 'Preguntas frecuentes',
    labels: ['Fecha de nacimiento', 'Mes', 'Día', 'Año', 'Total', 'Número de vida'],
    calculators: [
      '/es/numero-de-vida',
      '/es/calculadora-numerologia',
      '/es/numerologia-del-nombre',
      '/es/compatibilidad-numerologica',
    ],
    phrases: [
      'métodos tradicionales',
      'solo como referencia',
      'no predice el futuro',
      'profesional médico',
    ],
  },
}
const introDates = []
for (const [locale, spec] of Object.entries(INTRO)) {
  const name = `numerology/${locale}/numerology.mdx`
  try {
    const source = await readFile(new URL(name, root), 'utf8')
    const match = source.match(/^---\n([\s\S]+?)\n---\n\n([\s\S]+)$/)
    assert.ok(match, 'frontmatter delimiters')
    const document = parseDocument(match[1], { uniqueKeys: true })
    assert.equal(document.errors.length, 0, 'valid YAML with unique keys')
    const data = document.toJS()
    const content = match[2]
    assert.equal(data.slug, 'numerology')
    assert.equal(data.locale, locale)
    assert.equal(data.number, null)
    assert.ok(
      Array.isArray(data.faq) && data.faq.length >= 3 && data.faq.length <= 4,
      '3–4 FAQ items',
    )
    for (const item of data.faq)
      assert.ok(
        content.includes(`### ${item.q}\n\n${item.a}`),
        'visible FAQ must match frontmatter',
      )
    const [prose, faq] = content.split(new RegExp(`^## ${spec.faq}\\s*$`, 'm'))
    assert.ok(faq !== undefined, `missing ## ${spec.faq}`)
    assert.ok(
      !/\b(?:AI|IA)\b/.test(`${data.title}\n${data.description}\n${content}`),
      'must not mention AI',
    )
    const processor = createProcessor()
    const tree = processor.parse(prose)
    const links = []
    const codes = []
    walk(tree, (node) => {
      assert.ok(!node.type.startsWith('mdx') && node.type !== 'html', 'Markdown only')
      if (node.type === 'heading') assert.ok(node.depth === 2 || node.depth === 3, 'H2/H3 only')
      if (node.type === 'link') links.push(node.url)
      if (node.type === 'code') codes.push(node.value)
    })
    await processor.process(content)
    const words = visibleText(tree).match(WORDS)?.length ?? 0
    assert.ok(words >= 1000, `prose: ${words} words, expected >= 1000`)
    assert.ok(links.length >= 2 && links.length <= 5, `body links: ${links.length}, expected 2–5`)
    assert.ok(
      links.every((link) => spec.calculators.includes(link)),
      `body links must target calculators: ${links}`,
    )
    const plain = visibleText(processor.parse(content)).toLowerCase()
    for (const phrase of spec.phrases)
      assert.ok(plain.includes(phrase), `missing compliance phrase: ${phrase}`)
    const dates = codes.filter((code) => code.startsWith(`${spec.labels[0]}: `))
    assert.equal(dates.length, 1, 'exactly one engine-checked date example')
    const iso = dates[0].match(new RegExp(`^${spec.labels[0]}: (\\d{4})-(\\d{2})-(\\d{2})$`, 'm'))
    assert.ok(iso, 'valid date example label')
    const [year, month, day] = iso.slice(1).map(Number)
    const result = lifePath({ year, month, day })
    const part = (value) => reduceNumber(value).steps.map(equation).join('; ') || String(value)
    const total = result.steps
      .filter((step) => step.phase === 'total')
      .map(equation)
      .join('; ')
    const [dateLabel, monthLabel, dayLabel, yearLabel, totalLabel, resultLabel] = spec.labels
    assert.equal(
      dates[0],
      [
        `${dateLabel}: ${iso.slice(1).join('-')}`,
        `${monthLabel}: ${part(month)}`,
        `${dayLabel}: ${part(day)}`,
        `${yearLabel}: ${part(year)}`,
        `${totalLabel}: ${total || result.value}`,
        `${resultLabel}: ${result.value}`,
      ].join('\n'),
      'date steps must match the engine',
    )
    introDates.push(iso.slice(1).join('-'))
    dateExamples++
    console.log(
      `OK ${name} (${words} words, ${links.length} body links, life path ${result.value})`,
    )
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
  }
}
if (new Set(introDates).size !== introDates.length)
  failures.push('numerology intro pages: en and es must use different example dates')
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
    `PASS: ${Object.values(totals).reduce((sum, counts) => sum + counts.length, 0)} pages; schema, aliases, visible FAQ, locale links, hidden internal IDs, length, Markdown-only MDX, and calculation examples`,
  )
  console.log(
    'Not covered: route integration, canonical/hreflang/JSON-LD, browser anchors, factual/editorial review, deployment',
  )
}
