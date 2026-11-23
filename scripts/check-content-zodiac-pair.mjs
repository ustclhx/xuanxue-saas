// 生肖配对集合（content/zodiac-pair）的内容校验（openspec content-growth-v2-tools 任务 16.1、16.2，
// design 决策 9、14、15、16）：frontmatter、TDK 宽度、篇幅下限、固定小标题、正文内链、判定词与合规措辞，
// 以及正文中写到的地支关系、五行生克、合化、三合局与年份干支逐项用引擎复算（@xuanxue/bazi/almanac）。
// ko、en（第 17 组）在 LOCALES 补登自己的一行。
// 运行：node scripts/check-content-zodiac-pair.mjs [--report <文件>]
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { zodiacPairFacts } from '../packages/bazi/src/almanac.ts'
import { BRANCHES } from '../packages/bazi/src/constants.ts'
import { factIssues } from './check-content-zodiac.mjs'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const ROOT = new URL('../apps/web/content/zodiac-pair/', import.meta.url)
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const ELEMENT_HANZI = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' }
const ANIMAL_ZH = '鼠牛虎兔龙蛇马羊猴鸡狗猪'

/** 各语言的地址、篇幅与固定小标题（design 决策 9、16） */
export const LOCALES = {
  'zh-Hans': {
    prefix: '/zh-hans',
    hubPath: '/生肖配对',
    pairSlug: (a, b) => `属${ANIMAL_ZH[BRANCHES.indexOf(a)]}和属${ANIMAL_ZH[BRANCHES.indexOf(b)]}`,
    brandSuffix: '｜干支日',
    pairMin: 800,
    hubMin: 800,
    pairHeadings: ['两支关系', '相处的节奏', '彼此能学的', '需要磨合的地方', '用八字看两个人'],
    hubHeadings: ['这张表怎样读', '合与冲从哪里来', '用八字看两个人'],
    // 正文链接目标：配对页（本集合）、生肖子页、生肖枢纽与八字排盘
    linkTargets: (path) =>
      /^\/zh-hans\/生肖配对\/属.和属.$/u.test(path) ||
      /^\/zh-hans\/生肖\/属.$/u.test(path) ||
      path === '/zh-hans/生肖' ||
      path === '/zh-hans/八字排盘',
    countUnit: /\p{Script=Han}/gu,
  },
}

/** 判定词（与 apps/web/scripts/audit-verdict.mjs 的 zh 词表一致，另加简体常见变体） */
const VERDICT_TERMS = [
  '宜结婚',
  '不宜结婚',
  '不能结婚',
  '能不能结婚',
  '会离婚',
  '必离',
  '克夫',
  '克妻',
  '注定分手',
  '必然分手',
  '最佳婚配',
  '不能在一起',
  '不能嫁',
  '不能娶',
  '合不合',
  '配不配',
  '最配',
  '绝配',
  '般配',
  '天生一对',
  '天作之合',
  '不适合在一起',
  '合不来',
]
/** 合规措辞（design 决策 16 第 8 条）与贬损性描述（spec「配对页不给判定」） */
const COMPLIANCE_TERMS = [
  'AI',
  '人工智能',
  '娱乐',
  '吉日',
  '大吉',
  '大凶',
  '一定会',
  '注定',
  '必然',
  '自我探索',
  '婚配',
  '自私',
  '懒惰',
  '贪婪',
  '小气',
  '冷漠',
  '狡猾',
  '虚伪',
  '暴躁',
  '愚笨',
  '短命',
  '倒霉',
  '晦气',
  '最差',
  '最好的',
  '不利',
  '凶',
  '克星',
]

/** 六合的合化五行（午未两说并存，按土或火都接受） */
const SIX_TRANSFORM = {
  子丑: ['土'],
  寅亥: ['木'],
  卯戌: ['火'],
  辰酉: ['金'],
  巳申: ['水'],
  午未: ['土', '火'],
}
const TRIAD_ELEMENT = ['水', '金', '火', '木']

function cjkWidth(text) {
  let width = 0
  for (const char of text) width += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/u.test(char) ? 1 : 0.5
  return width
}

const branchOf = (glyph) => BRANCHES[BRANCH_HANZI.indexOf(glyph)]
const sortedGlyphs = (x, y) =>
  BRANCH_HANZI.indexOf(x) <= BRANCH_HANZI.indexOf(y) ? `${x}${y}` : `${y}${x}`

const G = `[${BRANCH_HANZI}]`
const E = '[木火土金水]'
const RELATION_WORDS = [
  ['六合', 'sixCombine'],
  ['相合', 'sixCombine'],
  ['六冲', 'clash'],
  ['相冲', 'clash'],
  ['冲', 'clash'],
  ['相刑', 'punish'],
  ['刑', 'punish'],
  ['相害', 'harm'],
  ['六害', 'harm'],
  ['害', 'harm'],
  ['相破', 'break'],
  ['破', 'break'],
]

/** 正文中写到的地支关系、五行生克、合化与三合局逐项用引擎复算 */
export function pairFactIssues(text) {
  const issues = []
  let checked = 0
  const relationOf = (x, y) => zodiacPairFacts(branchOf(x), branchOf(y)).relations
  // 「子午冲」「子丑六合」「丑未相刑」「子与午相冲」「子和午六合」
  const words = RELATION_WORDS.map(([word]) => word).join('|')
  for (const match of text.matchAll(
    new RegExp(`(?<![${BRANCH_HANZI}])(${G})(?:与|和|、)?(${G})(${words})`, 'gu'),
  )) {
    const [, x, y, word] = match
    if (x === y && word !== '刑' && word !== '相刑') continue
    // 「辰戌丑未」等四支并列不是关系陈述
    if (new RegExp(`${G}$`).test(text.slice(Math.max(0, match.index - 1), match.index))) continue
    const type = RELATION_WORDS.find(([candidate]) => candidate === word)?.[1]
    checked++
    if (!relationOf(x, y).includes(type))
      issues.push(`${match[0]}：引擎记 ${x}${y} 为 ${relationOf(x, y).join('、') || '无关系'}`)
  }
  // 「丑土克子水」「子水生寅木」
  for (const match of text.matchAll(new RegExp(`(${G})(${E})(生|克)(${G})(${E})`, 'gu'))) {
    const [, x, ex, verb, y, ey] = match
    const facts = zodiacPairFacts(branchOf(x), branchOf(y))
    checked++
    if (ELEMENT_HANZI[facts.elements[0]] !== ex || ELEMENT_HANZI[facts.elements[1]] !== ey) {
      issues.push(
        `${match[0]}：地支五行为 ${x}${ELEMENT_HANZI[facts.elements[0]]}、${y}${ELEMENT_HANZI[facts.elements[1]]}`,
      )
      continue
    }
    const expected = verb === '生' ? 'aGeneratesB' : 'aOvercomesB'
    if (facts.elementRelation !== expected) issues.push(`${match[0]}：五行方向与引擎不符`)
  }
  // 「子丑合化土」「子丑合土」（「申子辰合水局」是三合，不在此列）
  for (const match of text.matchAll(new RegExp(`(?<!${G})(${G})(${G})合化?(${E})(?!局)`, 'gu'))) {
    const key = sortedGlyphs(match[1], match[2])
    checked++
    if (!SIX_TRANSFORM[key]?.includes(match[3])) issues.push(`${match[0]}：不是传统的六合合化`)
  }
  // 「申子辰水局」「申子辰三合水局」
  for (const match of text.matchAll(new RegExp(`(${G})(${G})(${G})(?:三合)?(${E})局`, 'gu'))) {
    const indexes = [match[1], match[2], match[3]].map((glyph) => BRANCH_HANZI.indexOf(glyph))
    const group = indexes[0] % 4
    checked++
    if (
      new Set(indexes).size !== 3 ||
      !indexes.every((index) => index % 4 === group) ||
      TRIAD_ELEMENT[group] !== match[4]
    )
      issues.push(`${match[0]}：不是三合局`)
  }
  return { issues, checked }
}

function plain(markdown) {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+ .*$/gm, '')
    .replace(/[*_`>]/g, '')
}

function bodySections(content) {
  return content
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const nl = chunk.indexOf('\n')
      return { title: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1) }
    })
}

export function checkLocale(locale, dir = new URL(`${locale}/`, ROOT)) {
  const spec = LOCALES[locale]
  const failures = []
  const rows = []
  if (!existsSync(dir)) return { failures, rows, factsChecked: 0 }
  const files = readdirSync(dir).filter((file) => file.endsWith('.mdx'))
  const seen = { title: new Map(), description: new Map(), heading: new Map() }
  let factsChecked = 0
  for (const file of files.sort()) {
    const fail = (message) => failures.push(`${locale}/${file}: ${message}`)
    const source = readFileSync(new URL(file, dir), 'utf8')
    const match = source.match(/^---\n([\s\S]+?)\n---\n\n([\s\S]+)$/)
    if (!match) {
      fail('缺少 frontmatter 分隔')
      continue
    }
    const document = parseDocument(match[1], { uniqueKeys: true })
    if (document.errors.length) {
      fail(`YAML 错误：${document.errors[0].message}`)
      continue
    }
    const data = document.toJS()
    const content = match[2]
    const hub = file === 'index.mdx'
    const key = file.replace(/\.mdx$/, '')
    const [a, b] = hub ? [] : key.split('-')
    const required = hub
      ? ['title', 'heading', 'description', 'slug', 'locale', 'lede', 'faq', 'updated']
      : [
          'title',
          'heading',
          'description',
          'slug',
          'locale',
          'pair',
          'lede',
          'relations_note',
          'faq',
          'updated',
        ]
    const extra = Object.keys(data).filter((field) => !required.includes(field))
    const missing = required.filter((field) => data[field] === undefined)
    if (extra.length) fail(`多余字段：${extra.join('、')}`)
    if (missing.length) fail(`缺少字段：${missing.join('、')}`)
    if (data.locale !== locale) fail(`locale 应为 ${locale}`)
    if (!hub) {
      if (
        !BRANCHES.includes(a) ||
        !BRANCHES.includes(b) ||
        BRANCHES.indexOf(a) > BRANCHES.indexOf(b)
      )
        fail(`文件名应为按地支顺序的配对 key：${key}`)
      if (data.pair !== key) fail('pair 与文件名不一致')
    }
    const slug = hub ? spec.hubPath.slice(1) : spec.pairSlug(a, b)
    if (data.slug !== slug) fail(`slug 应为 ${slug}`)
    if (!String(data.heading ?? '').startsWith(slug)) fail(`H1 应以「${slug}」开头`)
    if (!String(data.title ?? '').startsWith(slug)) fail(`Title 应以「${slug}」开头`)

    const titleWidth = cjkWidth(`${data.title}${spec.brandSuffix}`)
    const descriptionWidth = cjkWidth(String(data.description ?? ''))
    if (titleWidth < 20 || titleWidth > 30) fail(`Title 宽度 ${titleWidth}（含站名后缀，须 20–30）`)
    if (descriptionWidth < 70 || descriptionWidth > 80)
      fail(`Description 宽度 ${descriptionWidth}（须 70–80）`)
    for (const field of ['title', 'description', 'heading']) {
      const previous = seen[field].get(data[field])
      if (previous) fail(`${field} 与 ${previous} 重复`)
      seen[field].set(data[field], file)
    }

    const faq = Array.isArray(data.faq) ? data.faq : []
    if (faq.length < 3 || faq.length > 4) fail(`FAQ 须 3–4 问，现为 ${faq.length}`)
    for (const item of faq) if (!item?.q?.trim() || !item?.a?.trim()) fail('FAQ 每项须有 q 与 a')

    const headings = bodySections(content).map((section) => section.title)
    const fixed = hub ? spec.hubHeadings : spec.pairHeadings
    if (JSON.stringify(headings) !== JSON.stringify(fixed))
      fail(`正文小标题须依次为：${fixed.join(' / ')}（现为 ${headings.join(' / ')}）`)

    // 篇幅：本页撰写的正文（导语、关系说明、正文），不含 FAQ、表格与组件模板句
    const authored = [data.lede, data.relations_note, plain(content)].filter(Boolean).join('\n')
    const count = (authored.match(spec.countUnit) ?? []).length
    const min = hub ? spec.hubMin : spec.pairMin
    if (count < min) fail(`撰写正文 ${count} 字，少于 ${min}`)

    // 正文内链：只链接已存在的可索引页，2–5 个不同目标，不链接本页
    const links = [...content.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
    const self = `${spec.prefix}${spec.hubPath}${hub ? '' : `/${slug}`}`
    for (const href of links) {
      if (!spec.linkTargets(href)) fail(`正文链接目标不在允许清单：${href}`)
      if (href === self) fail(`链接到本页：${href}`)
    }
    const targets = new Set(links).size
    if (targets < 2 || targets > 5) fail(`正文内链 ${targets} 个不同目标（须 2–5）`)

    const everything = [
      data.title,
      data.heading,
      data.description,
      data.lede,
      data.relations_note,
      ...faq.flatMap((item) => [item.q, item.a]),
      content.replace(/\]\([^)]*\)/g, ']'),
    ].join('\n')
    for (const term of VERDICT_TERMS) if (everything.includes(term)) fail(`判定词：${term}`)
    for (const term of COMPLIANCE_TERMS)
      if (new RegExp(term === 'AI' ? '\\bAI\\b' : term).test(everything))
        fail(`合规或贬损禁用词：${term}`)

    const years = factIssues(everything)
    const pairs = pairFactIssues(everything)
    factsChecked += years.checked + pairs.checked
    for (const issue of [...years.issues, ...pairs.issues]) fail(`事实不一致：${issue}`)

    rows.push({
      file,
      title: data.title,
      titleWidth,
      descriptionWidth,
      heading: data.heading,
      chars: count,
      links: targets,
      facts: years.checked + pairs.checked,
    })
  }
  return { failures, rows, factsChecked }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { report: { type: 'string' } } })
  const failures = []
  const lines = [
    '| 语言 | 文件 | Title（宽） | Description 宽 | H1 | 撰写字数 | 正文内链 | 复算事实 |',
    '|---|---|---|---|---|---|---|---|',
  ]
  let total = 0
  for (const locale of Object.keys(LOCALES)) {
    const result = checkLocale(locale)
    failures.push(...result.failures)
    total += result.factsChecked
    for (const row of result.rows)
      lines.push(
        `| ${locale} | ${row.file} | ${row.title}（${row.titleWidth}） | ${row.descriptionWidth} | ${row.heading} | ${row.chars} | ${row.links} | ${row.facts} |`,
      )
  }
  lines.push('', `复算事实合计：${total} 处；失败：${failures.length}`)
  if (values.report)
    writeFileSync(
      values.report,
      `${lines.join('\n')}\n${failures.map((f) => `- ${f}`).join('\n')}\n`,
    )
  if (failures.length) {
    console.error(failures.map((failure) => `  - ${failure}`).join('\n'))
    assert.fail(`生肖配对内容校验失败 ${failures.length} 项`)
  }
  console.log(`生肖配对内容校验通过（复算事实 ${total} 处）`)
}
