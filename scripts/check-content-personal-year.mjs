// personal year 集合（content/personal-year）的内容校验（openspec content-growth-v2-tools 任务 27.1、27.3，决策 16）：
// 1. 用独立写出的规则复算 @xuanxue/numerology 的 personalYear（1900–2100 年 × 366 个生日），
//    并核对「化为 1–9」与一次加总全部数字的个位一致、相邻年份加 1；
// 2. 逐页核对正文与 FAQ 里出现的每个加法算式（`a + b = c`）、计算器页示例的结果，以及各数字页首段的传统主题词；
// 3. 文件齐全（en、es 各 index + 1–9）、frontmatter、固定小标题（同语言 9 页一致）、TDK 长度、篇幅下限、
//    正文内链（2–5、只指向允许的目标、每目标锚文本 ≤2 种）与禁用措辞。
// 运行：node scripts/check-content-personal-year.mjs [--report <文件>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { personalYear } from '../packages/numerology/src/numbers.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const ROOT = new URL('../apps/web/content/personal-year/', import.meta.url)
const LOCALES = ['en', 'es']
const KEYS = ['index', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const BRAND_SUFFIX = ' | Arcanumber'
const TITLE_RANGE = [40, 60]
const DESCRIPTION_RANGE = [140, 160]
const MIN_WORDS = { index: 780, number: 700 }
// es 年份数页按西语另写，多一段（与 en 结构不同，跨语言结构直译分在门槛内）
const SECTIONS = { en: { index: 5, number: 6 }, es: { index: 5, number: 7 } }
const CALCULATOR = { en: '/personal-year-number', es: '/es/ano-personal' }
const LIFE_PATH = { en: '/life-path-number', es: '/es/numero-de-vida' }
const ALLOWED_INDEX_LINKS = {
  en: ['/numerology', '/life-path-number', '/numerology-calculator', '/angel-numbers'],
  es: [
    '/es/numerologia',
    '/es/numero-de-vida',
    '/es/calculadora-numerologia',
    '/es/numeros-angelicales',
  ],
}
// 首段须出现的传统主题词（fact-sheet §2，设计稿关键词）
const THEME = {
  en: {
    1: /begin|start/i,
    2: /patien/i,
    3: /express/i,
    4: /groundwork|foundation/i,
    5: /change/i,
    6: /care|home/i,
    7: /study|reflect/i,
    8: /result/i,
    9: /complet/i,
  },
  es: {
    1: /inici|comienz/i,
    2: /pacien/i,
    3: /expres/i,
    4: /cimient/i,
    5: /cambio/i,
    6: /cuidad/i,
    7: /estudi|reflex/i,
    8: /resultad/i,
    9: /cierr/i,
  },
}
const BANNED =
  /\bAI\b|\bIA\b|entertainment|for fun|\bluck|\blucky\b|\bfate\b|\bdestiny\b|manifest|guarantee|\bwill happen\b|entretenimiento|\bsuerte\b|\bdestino\b|garantiz|\bpasar[áa]\b/i
// 决策建议（辞职、结婚、离婚、投资等）只允许出现在否定或「不」的语境里，这里粗筛命令式
const ADVICE =
  /\byou should (?:quit|marry|divorce|invest|move|leave)|\bdeber[íi]as (?:renunciar|casarte|divorciarte|invertir|mudarte)/i

const { values: args } = parseArgs({ options: { report: { type: 'string' } } })
const errors = []
const rows = []
const fail = (file, message) => errors.push(`${file}: ${message}`)

// ---------------------------------------------------------------------------
// 1. 独立规则与引擎复算
// ---------------------------------------------------------------------------

const MASTERS = new Set([11, 22, 33])
function reduceKeep(n) {
  let value = n
  while (value > 9 && !MASTERS.has(value))
    value = [...String(value)].reduce((sum, digit) => sum + Number(digit), 0)
  return value
}
const root = (n) => (n === 0 ? 0 : 1 + ((n - 1) % 9))
const independent = (month, day, year) =>
  reduceKeep(reduceKeep(month) + reduceKeep(day) + reduceKeep(year))
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
let checked = 0
for (let year = 1900; year <= 2100; year++)
  for (let month = 1; month <= 12; month++)
    for (let day = 1; day <= DAYS[month - 1]; day++) {
      const engine = personalYear({ year: 2000, month, day }, year).value
      const expected = independent(month, day, year)
      if (engine !== expected)
        fail('engine', `${year}-${month}-${day}：引擎 ${engine}，独立规则 ${expected}`)
      const digits = `${month}${day}${year}`
        .split('')
        .reduce((sum, digit) => sum + Number(digit), 0)
      if (root(engine) !== root(digits))
        fail(
          'engine',
          `${year}-${month}-${day}：化为 1–9 后 ${root(engine)} ≠ 全部数字之和的个位 ${root(digits)}`,
        )
      if (year < 2100) {
        const next = root(personalYear({ year: 2000, month, day }, year + 1).value)
        if (next !== (root(engine) % 9) + 1) fail('engine', `${year}-${month}-${day}：次年不是加 1`)
      }
      checked++
    }

// ---------------------------------------------------------------------------
// 2–3. 逐页
// ---------------------------------------------------------------------------

const wordsOf = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>|-]/g, ' ')
    .match(/[\p{L}\p{N}’']+/gu)?.length ?? 0

function checkArithmetic(file, text) {
  let count = 0
  for (const match of text.matchAll(/(\d+(?:\s*\+\s*\d+)+)\s*=\s*(\d+)/g)) {
    const sum = match[1].split('+').reduce((a, b) => a + Number(b.trim()), 0)
    if (sum !== Number(match[2])) fail(file, `算式错误「${match[0]}」，应为 ${sum}`)
    count++
  }
  return count
}

const headingSets = { en: new Map(), es: new Map() }

for (const locale of LOCALES) {
  const dir = new URL(`${locale}/`, ROOT)
  const files = readdirSync(dir).filter((name) => name.endsWith('.mdx'))
  const keys = files.map((name) => name.replace(/\.mdx$/, '')).sort()
  if (keys.join() !== [...KEYS].sort().join())
    fail(locale, `文件应为 ${KEYS.join('、')}，实为 ${keys.join('、')}`)
  for (const key of keys) {
    const file = `${locale}/${key}.mdx`
    const raw = readFileSync(new URL(file, ROOT), 'utf8')
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)
    if (!match) {
      fail(file, '缺少 frontmatter')
      continue
    }
    const data = parseDocument(match[1]).toJS()
    const body = match[2]
    const kind = key === 'index' ? 'index' : 'number'
    const n = kind === 'number' ? Number(key) : null

    for (const field of ['title', 'heading', 'description', 'lede', 'faq', 'updated'])
      if (!data[field]) fail(file, `缺少 ${field}`)
    if (kind === 'number' && data.questions?.length !== 3) fail(file, 'questions 须为 3 条')
    if (kind === 'index' && data.questions) fail(file, '计算器页不应有 questions')
    const title = `${data.title ?? ''}${BRAND_SUFFIX}`
    if (title.length < TITLE_RANGE[0] || title.length > TITLE_RANGE[1])
      fail(file, `Title 连站名 ${title.length} 字符（${TITLE_RANGE.join('–')}）`)
    const description = data.description ?? ''
    if (description.length < DESCRIPTION_RANGE[0] || description.length > DESCRIPTION_RANGE[1])
      fail(file, `Description ${description.length} 字符（${DESCRIPTION_RANGE.join('–')}）`)
    if (data.title === data.heading) fail(file, 'Title 与 H1 相同')

    const chunks = body.split(/^## /m).slice(1)
    const titles = chunks.map((chunk) => chunk.slice(0, chunk.indexOf('\n')).trim())
    if (titles.length !== SECTIONS[locale][kind])
      fail(file, `正文段 ${titles.length} 个，应为 ${SECTIONS[locale][kind]}`)
    if (kind === 'number') {
      const normalized = titles
        .map((text) => text.replace(new RegExp(`\\b${n}\\b`, 'g'), '{n}').replace(/\ban\b/g, 'a'))
        .join(' | ')
      headingSets[locale].set(normalized, [...(headingSets[locale].get(normalized) ?? []), key])
      if (!THEME[locale][n].test(chunks[0] ?? ''))
        fail(file, `首段没有出现传统主题词 ${THEME[locale][n]}`)
    }
    const words = wordsOf(chunks.map((chunk) => chunk.slice(chunk.indexOf('\n') + 1)).join('\n'))
    if (words < MIN_WORDS[kind]) fail(file, `正文 ${words} 词，少于 ${MIN_WORDS[kind]}`)

    const text = [
      data.title,
      data.heading,
      data.description,
      data.lede,
      body,
      ...(data.questions ?? []),
      ...(data.faq ?? []).flatMap(({ q, a }) => [q, a]),
    ].join('\n')
    const banned = BANNED.exec(text)
    if (banned) fail(file, `禁用措辞「${banned[0]}」`)
    const advice = ADVICE.exec(text)
    if (advice) fail(file, `决策建议「${advice[0]}」`)
    const sums = checkArithmetic(file, text)
    // 年份只允许出现在计算器页示例里
    const years = [...body.matchAll(/\b(1[89]\d\d|2[01]\d\d)\b/g)].map((m) => m[1])
    if (kind === 'number' && years.length > 0) fail(file, `数字页出现年份 ${years.join('、')}`)
    if (kind === 'index') {
      const expected = personalYear({ year: 2000, month: 7, day: 14 }, 2027)
      if (!body.includes(`2 + 3 = ${expected.value}`) || !body.includes('7 + 5 + 11 = 23'))
        fail(file, `计算示例与引擎不一致（7 月 14 日 / 2027 → ${expected.value}）`)
    }

    const links = [...body.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map(([, anchor, href]) => ({
      anchor,
      href,
    }))
    if (links.length < 2 || links.length > 5) fail(file, `正文内链 ${links.length} 条（2–5）`)
    const allowed =
      kind === 'index'
        ? ALLOWED_INDEX_LINKS[locale]
        : // 年份数页链 Life Path 计算器而非 Life Path N 页：后者已有的锚文本分布会因新增一条而 top1 超 70%
          [CALCULATOR[locale], LIFE_PATH[locale]]
    const anchors = new Map()
    for (const { anchor, href } of links) {
      if (!allowed.includes(href)) fail(file, `正文链接目标不在允许清单：${href}`)
      anchors.set(href, new Set([...(anchors.get(href) ?? []), anchor.toLowerCase()]))
    }
    for (const [href, set] of anchors)
      if (set.size > 2) fail(file, `${href} 的锚文本 ${set.size} 种（≤2）`)
    if (kind === 'number')
      for (const target of allowed) if (!anchors.has(target)) fail(file, `缺少正文链接 ${target}`)

    rows.push({
      file,
      title: data.title,
      titleLength: title.length,
      description: description.length,
      words,
      links: links.length,
      sums,
    })
  }
  if (headingSets[locale].size > 1)
    fail(
      locale,
      `9 个数字页的小标题不一致：${[...headingSets[locale]].map(([set, keys]) => `${keys.join(',')}：${set}`).join('；')}`,
    )
}

const report = [
  '# personal year 内容校验',
  '',
  `引擎复算：${checked} 个（1900–2100 年 × 全部生日），独立规则一致、化为 1–9 与全部数字之和一致、相邻年份加 1。`,
  '',
  '| 文件 | Title（连站名字符） | Description 字符 | 正文词数 | 正文内链 | 复核算式 |',
  '|---|---|---|---|---|---|',
  ...rows.map(
    (row) =>
      `| ${row.file} | ${row.title}（${row.titleLength}） | ${row.description} | ${row.words} | ${row.links} | ${row.sums} |`,
  ),
  '',
  errors.length === 0
    ? '结果：通过'
    : `结果：${errors.length} 处问题\n\n${errors.map((e) => `- ${e}`).join('\n')}`,
].join('\n')
if (args.report) writeFileSync(args.report, `${report}\n`)

if (errors.length > 0) {
  console.error(errors.join('\n'))
  console.error(`check-content-personal-year：${errors.length} 处问题`)
  process.exit(1)
}
console.log(`check-content-personal-year：${rows.length} 页通过，引擎复算 ${checked} 个`)
