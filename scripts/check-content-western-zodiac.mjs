// 西方星座集合（content/western-zodiac）的内容校验（openspec content-growth-v2-tools 任务 20.1、决策 12、14、16）：
// 1. 用独立写出的规则复算 apps/web/src/features/west-content/zodiac/facts.ts：12 星座的元素、模式、守护星、对宫，
//    78 组配对的角距、相位、元素关系与模式关系；
// 2. 逐页核对正文写到的星座元素、模式、守护星、相隔宫数、角度与相位名；
// 3. frontmatter、固定小标题、TDK 长度、篇幅下限、正文内链（2–5、目标存在、每目标锚文本 ≤2 种、top1 ≤70%）、
//    判定词与禁用措辞。
// 运行：node scripts/check-content-western-zodiac.mjs [--report <文件>] [--only <文件名,…>]
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import {
  PAIRS,
  pairFacts,
  SIGN_KEYS,
  SIGNS,
} from '../apps/web/src/features/west-content/zodiac/facts.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const ROOT = new URL('../apps/web/content/western-zodiac/en/', import.meta.url)
const BRAND_SUFFIX = ' | Arcanumber'
const TITLE_RANGE = [40, 60]
const DESCRIPTION_RANGE = [140, 160]

// ---------------------------------------------------------------------------
// 1. 独立规则：黄道序、三方四正
// ---------------------------------------------------------------------------

const ORDER = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
]
const TRIPLICITY = {
  fire: ['aries', 'leo', 'sagittarius'],
  earth: ['taurus', 'virgo', 'capricorn'],
  air: ['gemini', 'libra', 'aquarius'],
  water: ['cancer', 'scorpio', 'pisces'],
}
const QUADRUPLICITY = {
  cardinal: ['aries', 'cancer', 'libra', 'capricorn'],
  fixed: ['taurus', 'leo', 'scorpio', 'aquarius'],
  mutable: ['gemini', 'virgo', 'sagittarius', 'pisces'],
}
// 托勒密传统守护与通行的现代守护
const RULERSHIP = {
  aries: ['mars'],
  taurus: ['venus'],
  gemini: ['mercury'],
  cancer: ['moon'],
  leo: ['sun'],
  virgo: ['mercury'],
  libra: ['venus'],
  scorpio: ['mars', 'pluto'],
  sagittarius: ['jupiter'],
  capricorn: ['saturn'],
  aquarius: ['saturn', 'uranus'],
  pisces: ['jupiter', 'neptune'],
}
const ASPECT_BY_DISTANCE = [
  'conjunction',
  'semisextile',
  'sextile',
  'square',
  'trine',
  'quincunx',
  'opposition',
]
const keyOf = (table, sign) => Object.keys(table).find((key) => table[key].includes(sign))

export function recomputeFacts() {
  const issues = []
  assert.deepEqual([...SIGN_KEYS], ORDER, '黄道序')
  for (const sign of SIGNS) {
    const i = ORDER.indexOf(sign.key)
    if (sign.index !== i) issues.push(`${sign.key} 黄道序 ${sign.index} ≠ ${i}`)
    if (sign.element !== keyOf(TRIPLICITY, sign.key))
      issues.push(`${sign.key} 元素 ${sign.element} ≠ ${keyOf(TRIPLICITY, sign.key)}`)
    if (sign.modality !== keyOf(QUADRUPLICITY, sign.key))
      issues.push(`${sign.key} 模式 ${sign.modality} ≠ ${keyOf(QUADRUPLICITY, sign.key)}`)
    const [ruler, modern] = RULERSHIP[sign.key]
    if (sign.ruler !== ruler || sign.modernRuler !== modern)
      issues.push(`${sign.key} 守护星 ${sign.ruler}/${sign.modernRuler} ≠ ${ruler}/${modern}`)
    if (sign.opposite !== ORDER[(i + 6) % 12]) issues.push(`${sign.key} 对宫 ${sign.opposite}`)
  }
  if (PAIRS.length !== 78) issues.push(`配对数 ${PAIRS.length} ≠ 78`)
  for (const [a, b] of PAIRS) {
    const f = pairFacts(a, b)
    const i = ORDER.indexOf(a)
    const j = ORDER.indexOf(b)
    if (i > j) issues.push(`${a}-${b} 不是黄道序`)
    const d = Math.min(j - i, 12 - (j - i))
    const sameElement = keyOf(TRIPLICITY, a) === keyOf(TRIPLICITY, b)
    // 火风、土水互补：两者都在阳性（火风）或都在阴性（土水）且不同元素
    const yang = (s) => ['fire', 'air'].includes(keyOf(TRIPLICITY, s))
    const relation = sameElement ? 'same' : yang(a) === yang(b) ? 'complementary' : 'other'
    const checks = [
      ['distance', f.distance, d],
      ['angle', f.angle, d * 30],
      ['aspect', f.aspect, ASPECT_BY_DISTANCE[d]],
      ['elementRelation', f.elementRelation, relation],
      ['sameModality', f.sameModality, keyOf(QUADRUPLICITY, a) === keyOf(QUADRUPLICITY, b)],
      ['samePolarity', f.samePolarity, yang(a) === yang(b)],
    ]
    for (const [field, actual, expected] of checks)
      if (actual !== expected) issues.push(`${a}-${b} ${field} ${actual} ≠ ${expected}`)
  }
  return issues
}

// ---------------------------------------------------------------------------
// 2. 正文事实
// ---------------------------------------------------------------------------

const cap = (s) => s[0].toUpperCase() + s.slice(1)
const SIGN_NAMES = ORDER.map(cap)
const SIGN_RE = SIGN_NAMES.join('|')
const PLANET_RE = 'Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto'
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']
const ASPECT_WORDS = {
  conjunction: /\bconjunctions?\b|\bsame sign\b/i,
  semisextile: /\bsemi-?sextiles?\b/i,
  sextile: /(?<!semi-?)\bsextiles?\b/i,
  square: /\bsquares?\b/i,
  trine: /\btrines?\b/i,
  quincunx: /\bquincunx(?:es)?\b|\binconjuncts?\b/i,
  opposition: /\boppositions?\b/i,
}
const signKey = (name) => name.toLowerCase()

/** 句子：按句点、问号、叹号与换行切分 */
const sentencesOf = (text) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

export function factIssues(text, pair) {
  const issues = []
  let checked = 0
  for (const sentence of sentencesOf(text)) {
    // 「Aries is a cardinal fire sign」「Leo, a fixed fire sign」「Aries is cardinal」
    for (const m of sentence.matchAll(
      new RegExp(
        `\\b(${SIGN_RE})\\b(?:'s)?(?: is| are|,)? (?:a |an |the |also )?(?:(cardinal|fixed|mutable)(?:,| and)? )?(fire|earth|air|water)? ?sign`,
        'g',
      ),
    )) {
      const sign = SIGNS.find((s) => s.key === signKey(m[1]))
      if (m[2]) {
        checked++
        if (sign.modality !== m[2]) issues.push(`「${m[0]}」：${m[1]} 是 ${sign.modality}`)
      }
      if (m[3]) {
        checked++
        if (sign.element !== m[3]) issues.push(`「${m[0]}」：${m[1]} 是 ${sign.element}`)
      }
    }
    for (const m of sentence.matchAll(
      new RegExp(`\\b(${SIGN_RE}) is (?:a |an |the )?(cardinal|fixed|mutable)\\b`, 'g'),
    )) {
      const sign = SIGNS.find((s) => s.key === signKey(m[1]))
      checked++
      if (sign.modality !== m[2]) issues.push(`「${m[0]}」：${m[1]} 是 ${sign.modality}`)
    }
    // 「the fire sign Aries」「cardinal Aries」
    for (const m of sentence.matchAll(
      new RegExp(
        `\\b(?:(cardinal|fixed|mutable) )?(fire|earth|air|water)? ?(?:sign )?(${SIGN_RE})\\b`,
        'gi',
      ),
    )) {
      if (!m[1] && !m[2]) continue
      if (!/^[A-Z]/.test(m[3])) continue
      const sign = SIGNS.find((s) => s.key === signKey(m[3]))
      if (m[1]) {
        checked++
        if (sign.modality !== m[1].toLowerCase())
          issues.push(`「${m[0]}」：${m[3]} 是 ${sign.modality}`)
      }
      if (m[2]) {
        checked++
        if (sign.element !== m[2].toLowerCase())
          issues.push(`「${m[0]}」：${m[3]} 是 ${sign.element}`)
      }
    }
    // 守护星：「Aries is ruled by Mars」「Aries, ruled by Mars」「Mars rules Aries」
    for (const m of sentence.matchAll(
      new RegExp(`\\b(${SIGN_RE})\\b(?:'s)?[^.;:]{0,30}?\\bruled by (?:the )?(${PLANET_RE})`, 'g'),
    )) {
      checked++
      if (!RULERSHIP[signKey(m[1])].includes(m[2].toLowerCase()))
        issues.push(`「${m[0]}」：${m[1]} 的守护星是 ${RULERSHIP[signKey(m[1])].join('/')}`)
    }
    for (const m of sentence.matchAll(
      new RegExp(`\\b(${PLANET_RE}) (?:also )?(?:co-)?rules (${SIGN_RE})\\b`, 'g'),
    )) {
      checked++
      if (!RULERSHIP[signKey(m[2])].includes(m[1].toLowerCase()))
        issues.push(`「${m[0]}」：${m[2]} 的守护星是 ${RULERSHIP[signKey(m[2])].join('/')}`)
    }
    if (!pair) continue
    const names = [...new Set(sentence.match(new RegExp(`\\b(?:${SIGN_RE})\\b`, 'g')) ?? [])]
    const own = new Set([cap(pair.first), cap(pair.second)])
    const onlyPair = names.every((name) => own.has(name))
    // 相隔宫数与角度：句中只出现本组星座（或不出现星座）时，须与本组一致
    for (const m of sentence.matchAll(
      /\b(zero|one|two|three|four|five|six|\d+) signs? apart\b/gi,
    )) {
      if (!onlyPair) continue
      const n = NUMBER_WORDS.indexOf(m[1].toLowerCase())
      const value = n >= 0 ? n : Number(m[1])
      checked++
      if (value !== pair.distance) issues.push(`「${m[0]}」：相隔 ${pair.distance} 宫`)
    }
    for (const m of sentence.matchAll(/\b(\d{1,3})(?:°| degrees?\b)/g)) {
      const value = Number(m[1])
      checked++
      if (value % 30 !== 0 || value > 180) issues.push(`「${m[0]}」：不是整宫相位角`)
      else if (
        onlyPair &&
        value !== pair.angle &&
        !/\b(?:unlike|rather than|instead of|not|compared with|versus|whereas|than)\b/i.test(
          sentence,
        )
      )
        issues.push(`「${m[0]}」：本组角距为 ${pair.angle}°`)
    }
    // 句中同时写到本组两个星座与相位名时，须含本组相位
    const both =
      pair.first === pair.second
        ? names.includes(cap(pair.first))
        : own.size === 2 && [...own].every((n) => names.includes(n))
    if (both && onlyPair) {
      const mentioned = Object.entries(ASPECT_WORDS)
        .filter(([, re]) => re.test(sentence))
        .map(([key]) => key)
      if (mentioned.length) {
        checked++
        if (!mentioned.includes(pair.aspect))
          issues.push(`「${sentence.slice(0, 80)}…」：本组相位为 ${pair.aspect}`)
      }
    }
  }
  return { issues, checked }
}

// ---------------------------------------------------------------------------
// 3. 页面结构、长度、链接与措辞
// ---------------------------------------------------------------------------

export const HEADINGS = {
  hub: [
    'How the twelve signs are ordered',
    'Elements and modalities',
    'Ruling planets',
    'Sun sign and full chart',
  ],
  chart: ['What the aspects mean', 'How to read the chart', 'Beyond sun signs'],
  sign: ['Season and symbol', 'Temperament', 'Work and study', 'Love and friendship'],
  pair: [
    'Element and modality',
    'The aspect between them',
    'Rhythm together',
    'What each can learn',
    'Where friction shows',
  ],
}
/** 渲染正文的词数下限（决策 16，不含表格单元与 FAQ）；撰写正文须单独达到 */
export const MIN_WORDS = { hub: 700, chart: 500, sign: 1000, pair: 600 }
const FAQ_COUNT = { hub: [3, 4], chart: [3, 4], sign: [3, 4], pair: [3, 3] }

/** 判定词与禁用措辞（决策 14、16.8）：判定、保证、娱乐定位与 AI */
const BANNED = [
  /\bshould(?: not|n't)? (?:marry|be together|date|stay together|split|break up|get married)\b/i,
  /\b(?:must|cannot|can't) (?:marry|be together)\b/i,
  /\bwill (?:divorce|get divorced|break up|split up|last forever|fail)\b/i,
  /\bdoomed\b/i,
  /\bdestined\b/i,
  /\bsoul ?mates?\b/i,
  /\b(?:perfect|best|worst|ideal) (?:match|matches|partner|pairing|couple)\b/i,
  /\bmade for each other\b/i,
  /\bmeant to be\b/i,
  /\bincompatib(?:le|ility)\b/i,
  /\btoxic\b/i,
  /\bgood match\b/i,
  /\bbad match\b/i,
  /\bguarantee/i,
  /\bentertainment\b/i,
  /\bfor fun\b/i,
  /\bAI\b/,
  /\bartificial intelligence\b/i,
  /\bpredict(?:s|ed)? (?:that|whether|your|the future of)\b/i,
  /\bcompatibility (?:score|percentage|rating)\b/i,
  /\b\d{1,3} ?%/,
]

const countWords = (text) => (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []).length

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

export function kindOf(file) {
  const key = file.replace(/\.mdx$/, '')
  if (key === 'index') return { kind: 'hub', key, path: '/zodiac-signs' }
  if (key === 'compatibility') return { kind: 'chart', key, path: '/zodiac-compatibility' }
  if (ORDER.includes(key)) return { kind: 'sign', key, path: `/zodiac-signs/${key}` }
  const [a, b, ...rest] = key.split('-and-')
  if (
    !rest.length &&
    ORDER.includes(a) &&
    ORDER.includes(b) &&
    ORDER.indexOf(a) <= ORDER.indexOf(b)
  )
    return { kind: 'pair', key, path: `/zodiac-compatibility/${key}`, pair: pairFacts(a, b) }
  return null
}

const ALL_PATHS = new Set([
  '/zodiac-signs',
  '/zodiac-compatibility',
  ...ORDER.map((sign) => `/zodiac-signs/${sign}`),
  ...PAIRS.map(([a, b]) => `/zodiac-compatibility/${a}-and-${b}`),
])
/** 正文可链接的西方站其他可索引页 */
const OTHER_TARGETS = new Set([
  '/life-path-compatibility',
  '/life-path-number',
  '/numerology',
  // 第 23 组：出生星盘（钱页入链）
  '/birth-chart',
])

export function checkContent({ only } = {}) {
  const failures = []
  const rows = []
  const anchors = new Map()
  const seen = { title: new Map(), heading: new Map(), description: new Map() }
  let factsChecked = 0
  const files = readdirSync(ROOT)
    .filter((file) => file.endsWith('.mdx'))
    .sort()
  const keys = new Set(files)
  for (const file of [
    'index.mdx',
    'compatibility.mdx',
    ...ORDER.map((s) => `${s}.mdx`),
    ...PAIRS.map(([a, b]) => `${a}-and-${b}.mdx`),
  ])
    if (!keys.has(file) && !only) failures.push(`缺少 ${file}`)
  // 枢纽页表格中组件生成的档案链接：锚文本为星座名
  for (const sign of ORDER)
    anchors.set(`/zodiac-signs/${sign}`, new Map([[sign, ['/zodiac-signs']]]))
  for (const file of files) {
    const info = kindOf(file)
    const fail = (message) => failures.push(`${file}：${message}`)
    if (!info) {
      fail('文件名不是枢纽、总表、星座或黄道序配对')
      continue
    }
    const raw = readFileSync(new URL(file, ROOT), 'utf8')
    const [, front = '', content = ''] = raw.split(/^---$/m)
    const data = parseDocument(front).toJS()
    const required = ['title', 'heading', 'description', 'lede', 'faq', 'updated']
    if (info.kind === 'sign') required.push('compat_note')
    for (const field of required) if (!data[field]) fail(`缺少 ${field}`)
    const title = `${data.title ?? ''}${BRAND_SUFFIX}`
    if (title.length < TITLE_RANGE[0] || title.length > TITLE_RANGE[1])
      fail(`Title 连站名 ${title.length} 字符（${TITLE_RANGE.join('–')}）`)
    const description = data.description ?? ''
    if (description.length < DESCRIPTION_RANGE[0] || description.length > DESCRIPTION_RANGE[1])
      fail(`Description ${description.length} 字符（${DESCRIPTION_RANGE.join('–')}）`)
    for (const field of ['title', 'heading', 'description']) {
      const value = String(data[field] ?? '').toLowerCase()
      if (seen[field].has(value)) fail(`${field} 与 ${seen[field].get(value)} 重复`)
      seen[field].set(value, file)
    }
    const faq = data.faq ?? []
    const [faqMin, faqMax] = FAQ_COUNT[info.kind]
    if (faq.length < faqMin || faq.length > faqMax)
      fail(`FAQ ${faq.length} 问（${faqMin}–${faqMax}）`)
    const sections = bodySections(content)
    const titles = sections.map((section) => section.title)
    if (JSON.stringify(titles) !== JSON.stringify(HEADINGS[info.kind]))
      fail(`小标题应为 ${HEADINGS[info.kind].join(' / ')}，现为 ${titles.join(' / ')}`)
    const written = [data.lede, data.compat_note, plain(content)].filter(Boolean).join('\n')
    const words = countWords(written)
    if (words < MIN_WORDS[info.kind]) fail(`撰写正文 ${words} 词，少于 ${MIN_WORDS[info.kind]}`)
    const everything = [
      data.title,
      data.heading,
      data.description,
      data.lede,
      data.compat_note,
      plain(content),
      ...faq.flatMap((item) => [item.q, item.a]),
    ]
      .filter(Boolean)
      .join('\n')
    for (const re of BANNED) {
      const hit = everything.match(re)
      if (hit) fail(`禁用措辞「${hit[0]}」`)
    }
    // 链接
    const links = [...content.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)]
    const targets = new Set()
    for (const [, anchor, href] of links) {
      if (!href.startsWith('/')) {
        fail(`正文链接须为站内地址：${href}`)
        continue
      }
      if (!ALL_PATHS.has(href) && !OTHER_TARGETS.has(href))
        fail(`链接目标不存在或不在白名单：${href}`)
      if (href === info.path) fail(`链接到本页：${href}`)
      targets.add(href)
      const wording = anchor.toLowerCase().trim()
      if (!anchors.has(href)) anchors.set(href, new Map())
      const byWording = anchors.get(href)
      byWording.set(wording, [...(byWording.get(wording) ?? []), file])
    }
    if (info.kind !== 'hub' && (targets.size < 2 || targets.size > 5))
      fail(`正文内链 ${targets.size} 个（2–5）`)
    // 事实
    let pair
    if (info.kind === 'pair') pair = info.pair
    const facts = factIssues(everything, pair)
    factsChecked += facts.checked
    for (const issue of facts.issues) fail(`事实不一致：${issue}`)
    if (pair) {
      const aspectSection = sections.find((s) => s.title === HEADINGS.pair[1])?.body ?? ''
      if (!ASPECT_WORDS[pair.aspect].test(aspectSection))
        fail(`「${HEADINGS.pair[1]}」段没有写出相位名（${pair.aspect}）`)
      if (!new RegExp(`\\b${pair.angle}(?:°| degrees?\\b)`).test(aspectSection))
        fail(`「${HEADINGS.pair[1]}」段没有写出角度 ${pair.angle}°`)
      const elementSection = sections.find((s) => s.title === HEADINGS.pair[0])?.body ?? ''
      for (const sign of new Set([pair.first, pair.second])) {
        const fact = SIGNS.find((s) => s.key === sign)
        if (!new RegExp(`\\b${fact.element}\\b`, 'i').test(elementSection))
          fail(`「${HEADINGS.pair[0]}」段没有写出 ${sign} 的元素 ${fact.element}`)
        if (!new RegExp(`\\b${fact.modality}\\b`, 'i').test(elementSection))
          fail(`「${HEADINGS.pair[0]}」段没有写出 ${sign} 的模式 ${fact.modality}`)
      }
    }
    rows.push({
      file,
      title,
      description: description.length,
      heading: data.heading,
      words,
      links: targets.size,
      facts: facts.checked,
    })
  }
  if (!only)
    for (const [target, byWording] of anchors) {
      const total = [...byWording.values()].reduce((sum, list) => sum + list.length, 0)
      const top = Math.max(...[...byWording.values()].map((list) => list.length))
      const list = [...byWording].map(([w, l]) => `「${w}」×${l.length}`).join('、')
      if (byWording.size > 2) failures.push(`锚文本 ${target}：${byWording.size} 种（≤2）：${list}`)
      if (total >= 5 && top / total > 0.7)
        failures.push(
          `锚文本 ${target}：top1 占 ${Math.round((top / total) * 100)}%（≤70%）：${list}`,
        )
    }
  return { failures, rows, factsChecked }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: { report: { type: 'string' }, only: { type: 'string' } },
  })
  const only = values.only ? new Set(values.only.split(',')) : undefined
  const factIssuesTable = recomputeFacts()
  const result = checkContent({ only })
  const failures = [
    ...factIssuesTable.map((issue) => `事实表：${issue}`),
    ...result.failures.filter((f) => !only || [...only].some((file) => f.startsWith(file))),
  ]
  const lines = [
    '| 文件 | Title（连站名） | Description | H1 | 撰写词数 | 正文内链 | 复算事实 |',
    '|---|---|---|---|---|---|---|',
    ...result.rows
      .filter((row) => !only || only.has(row.file))
      .map(
        (row) =>
          `| ${row.file} | ${row.title}（${row.title.length}） | ${row.description} | ${row.heading} | ${row.words} | ${row.links} | ${row.facts} |`,
      ),
    '',
    `事实表：12 星座、78 组配对逐项复算；正文复算事实 ${result.factsChecked} 处；失败 ${failures.length}`,
  ]
  if (values.report)
    writeFileSync(
      values.report,
      `${lines.join('\n')}\n${failures.map((f) => `- ${f}`).join('\n')}\n`,
    )
  if (failures.length) {
    console.error(failures.map((failure) => `  - ${failure}`).join('\n'))
    assert.fail(`西方星座内容校验失败 ${failures.length} 项`)
  }
  console.log(`西方星座内容校验通过（12 星座、78 组配对复算；正文事实 ${result.factsChecked} 处）`)
}
