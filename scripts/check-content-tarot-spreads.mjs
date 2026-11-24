// 主题牌阵集合（content/tarot-spreads）的内容校验（openspec content-growth-v2-tools 任务 28.1、28.2，决策 14、16）：
// 1. 牌位数与 @xuanxue/tarot 的 TOPIC_SPREAD_SIZES 一致；
// 2. 正文、牌位说明与 FAQ 中引用的牌义必须与站内牌库（packages/tarot/src/data/en.ts）一致：
//    牌名后的括号「(a, b)」、「keywords (are) a and b」、「stands for / speak(s) of / points to a and|or b」
//    中的每个词都须是该牌的正位关键词或逆位主题；Major / Minor Arcana 的张数与牌库一致；
// 3. frontmatter、TDK 长度、篇幅下限（牌位说明与正文合计 ≥800 词，不含首屏导语与 FAQ）、正文内链（2–5 个不同目标）、
//    Title / H1 不以 free tarot reading 开头、判定词与禁用措辞。
// 运行：node scripts/check-content-tarot-spreads.mjs [--report <文件>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { CARD_MEANINGS, CARDS, TOPIC_SPREAD_SIZES } from '../packages/tarot/src/index.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const ROOT = new URL('../apps/web/content/tarot-spreads/en/', import.meta.url)
const BRAND_SUFFIX = ' | Arcanumber'
const TITLE_RANGE = [40, 60]
const DESCRIPTION_RANGE = [140, 160]
const MIN_WORDS = 800
const BODY_LINKS = [2, 5]
// 决策 14 的 en 判定词（与 apps/web/scripts/audit-verdict.mjs 同表）与本集合的禁用措辞
const VERDICT =
  /should marry|should not marry|must not marry|cannot marry|will divorce|will get divorced|doomed|destined to break up|best marriage match|brings misfortune/i
const BANNED =
  /\bAI\b|artificial intelligence|entertainment|for fun|horoscope|\blucky?\b|soulmate|\bdestined\b|will (?:come back|return to you|leave you)|they (?:secretly )?feel/i

const { values } = parseArgs({ options: { report: { type: 'string' } } })

// ---------------------------------------------------------------------------
// 牌库：牌名 → 正位关键词与逆位主题（逆位短义为「Consider how a, b may shape your perspective.」）
// ---------------------------------------------------------------------------
const CARD_TERMS = new Map(
  CARDS.map((card) => {
    const meaning = CARD_MEANINGS.en[card.id]
    const reversed = /^Consider how (.*) may shape your perspective\.$/.exec(meaning.reversed)
    if (!reversed) throw new Error(`逆位短义格式变化：${card.id}`)
    const terms = [...meaning.keywords, ...reversed[1].split(', ')].map((t) => t.toLowerCase())
    return [meaning.name, new Set(terms)]
  }),
)
// 长牌名优先匹配（「Queen of Cups」不被「Cups」之类截断；「The Moon」区分大小写，避免误认天文句中的 the Moon）
const NAMES = [...CARD_TERMS.keys()].sort((a, b) => b.length - a.length)
const NAME_RE = new RegExp(`\\b(${NAMES.map((n) => n.replace(/ /g, '\\s+')).join('|')})\\b`, 'g')
const MAJOR = CARDS.filter((card) => card.suit === 'major').length
const MINOR = CARDS.length - MAJOR

const words = (text) => text.match(/[A-Za-z’'-]+/g) ?? []
const plain = (markdown) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')

/** 列表「a, b」「a and b」「a or b」拆成词组 */
const splitList = (text) =>
  text
    .split(/,\s*|\s+(?:and|or)\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

/** 引用牌义的三种写法，返回被引用的词组 */
function citedTerms(segment) {
  const out = []
  const paren = /^[\s,]*\(([^)]+)\)/.exec(segment)
  if (paren) out.push(...splitList(paren[1]))
  for (const match of segment.matchAll(/keywords (?:are )?([a-z ,]+?)(?:[.;,)]|$| is | appears)/g))
    out.push(...splitList(match[1]))
  for (const match of segment.matchAll(
    /(?:stands for|speaks? of|points to) ([a-z ]+?(?: (?:and|or) [a-z ]+?)?)(?=[.;,]|$| which| in )/g,
  ))
    out.push(...splitList(match[1]))
  return out
}

/** 逐句找牌名，牌名到下一个牌名或句末之间为该牌的引用段 */
function checkCards(file, text, fail, cited) {
  for (const sentence of plain(text).split(/(?<=[.!?])\s+(?=[A-Z"“])/)) {
    const hits = [...sentence.matchAll(NAME_RE)]
    hits.forEach((hit, index) => {
      const name = hit[1].replace(/\s+/g, ' ')
      const end = hits[index + 1]?.index ?? sentence.length
      const segment = sentence.slice(hit.index + hit[0].length, end)
      const allowed = CARD_TERMS.get(name)
      const terms = citedTerms(segment)
      for (const term of terms)
        if (!allowed.has(term)) fail(`${file}：${name} 引用了牌库之外的词「${term}」：${sentence}`)
      cited.push({ file, card: name, terms, sentence })
    })
  }
}

const files = readdirSync(ROOT)
  .filter((f) => f.endsWith('.mdx'))
  .sort()
const failures = []
const report = []
const cited = []
const fail = (message) => failures.push(message)

if (
  files.join(',') !==
  Object.keys(TOPIC_SPREAD_SIZES)
    .map((k) => `${k}.mdx`)
    .sort()
    .join(',')
)
  fail(`牌阵文件与 TOPIC_SPREAD_SIZES 不一致：${files.join(', ')}`)

for (const file of files) {
  const key = file.replace(/\.mdx$/, '')
  const source = readFileSync(new URL(file, ROOT), 'utf8')
  const [, front = '', body = ''] = source.split(/^---$/m)
  const data = parseDocument(front).toJS()
  for (const field of ['title', 'heading', 'description', 'lede', 'positions', 'templates', 'faq'])
    if (!data[field]) fail(`${file}：缺少 ${field}`)
  if (data.positions?.length !== TOPIC_SPREAD_SIZES[key])
    fail(`${file}：牌位 ${data.positions?.length} 个，牌库为 ${TOPIC_SPREAD_SIZES[key]} 张`)
  const title = `${data.title}${BRAND_SUFFIX}`
  if (title.length < TITLE_RANGE[0] || title.length > TITLE_RANGE[1])
    fail(`${file}：Title 连站名 ${title.length} 字符（${TITLE_RANGE.join('–')}）`)
  if (
    data.description.length < DESCRIPTION_RANGE[0] ||
    data.description.length > DESCRIPTION_RANGE[1]
  )
    fail(`${file}：Description ${data.description.length} 字符（${DESCRIPTION_RANGE.join('–')}）`)
  for (const field of ['title', 'heading'])
    if (/^\s*free tarot reading/i.test(data[field]))
      fail(`${file}：${field} 以 free tarot reading 开头`)

  const positionsText = data.positions.map((p) => `${p.name}. ${p.meaning}`).join('\n')
  const faqText = data.faq.map(({ q, a }) => `${q}\n${a}`).join('\n')
  const all = [data.title, data.heading, data.description, data.lede, positionsText, body, faqText]
    .concat(data.templates)
    .join('\n')
  for (const [label, pattern] of [
    ['判定词', VERDICT],
    ['禁用措辞', BANNED],
  ]) {
    const hit = pattern.exec(plain(all))
    if (hit) fail(`${file}：${label}「${hit[0]}」`)
  }

  checkCards(file, [data.lede, positionsText, body, faqText].join('\n\n'), fail, cited)
  for (const [count, label] of [
    [MAJOR, 'Major Arcana'],
    [MINOR, 'Minor Arcana'],
  ])
    for (const match of plain(all).matchAll(new RegExp(`(\\d+) cards of the ${label}`, 'g')))
      if (Number(match[1]) !== count) fail(`${file}：${label} 写作 ${match[1]} 张，牌库为 ${count}`)

  const length = words(plain([positionsText, body].join('\n'))).length
  if (length < MIN_WORDS) fail(`${file}：篇幅 ${length} 词，下限 ${MIN_WORDS}`)
  const links = [...body.matchAll(/\[([^\]]+)\]\((\/[^)]*)\)/g)].map(([, anchor, href]) => ({
    anchor,
    href,
  }))
  const targets = new Set(links.map((link) => link.href))
  if (targets.size < BODY_LINKS[0] || targets.size > BODY_LINKS[1])
    fail(`${file}：正文内链 ${targets.size} 个目标（${BODY_LINKS.join('–')}）`)
  report.push({
    file,
    titleLength: title.length,
    descriptionLength: data.description.length,
    words: length,
    links,
  })
}

const summary = {
  pages: report,
  citations: cited,
  failures,
}
if (values.report) writeFileSync(values.report, `${JSON.stringify(summary, null, 2)}\n`)
for (const page of report)
  console.log(
    `${page.file}：Title ${page.titleLength}、Description ${page.descriptionLength}、${page.words} 词、内链 ${new Set(page.links.map((l) => l.href)).size} 个`,
  )
console.log(
  `牌义引用 ${cited.length} 处，其中带关键词 ${cited.filter((c) => c.terms.length).length} 处`,
)
if (failures.length) {
  for (const message of failures) console.error(`✗ ${message}`)
  process.exitCode = 1
} else console.log('主题牌阵内容校验通过')
