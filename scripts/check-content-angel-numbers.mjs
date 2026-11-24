// angel numbers 集合（content/angel-numbers）的内容校验（openspec content-growth-v2-tools 任务 26.1、26.3，决策 16、20）：
// 1. 用独立写出的约简规则复算 apps/web/src/features/west-content/angel-numbers/numbers.ts：各位之和、约简步骤、
//    根数（11、22、33 保留）与排列模式；
// 2. 正文与 frontmatter 中写到的算式（a + b = n）、「reduces to / adds up to / root」「se reduce a / suma / raíz」
//    逐项按所指数字复算；写到的时刻（hh:mm）必须是有效时刻；
// 3. 已发布集合：内容文件与 paths.ts 的 ANGEL_NUMBERS 一一对应；frontmatter、固定小标题、TDK 长度、篇幅下限、
//    FAQ（es 逐条 origin: local）、正文内链（2–5、目标存在、生命灵数页须为本数字的某位或根数、每目标锚文本 ≤2 种、
//    top1 ≤70%）、预言与决策措辞、AI 与娱乐定位。
// 运行：node scripts/check-content-angel-numbers.mjs [--report <文件>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { angelFacts } from '../apps/web/src/features/west-content/angel-numbers/numbers.ts'
import { ANGEL_NUMBERS } from '../apps/web/src/features/west-content/angel-numbers/paths.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const CONTENT = new URL('../apps/web/content/', import.meta.url)
const LOCALES = ['en', 'es']
const BRAND_SUFFIX = ' | Arcanumber'
const TITLE_RANGE = [40, 60]
const DESCRIPTION_RANGE = [140, 160]

// ---------------------------------------------------------------------------
// 1. 独立规则
// ---------------------------------------------------------------------------

const MASTERS = new Set([11, 22, 33])
const digitSum = (n) => [...String(n)].reduce((s, d) => s + Number(d), 0)

/** 逐步约简：返回所有中间结果（含各位之和）与根数 */
export function reduceChain(number) {
  const chain = [digitSum(number)]
  let value = chain[0]
  while (value > 9 && !MASTERS.has(value)) {
    value = digitSum(value)
    chain.push(value)
  }
  return { sum: chain[0], chain, root: value }
}

function patternOf(s) {
  const d = [...s].map(Number)
  const n = d.length
  if (d.every((x) => x === d[0])) return 'repeat'
  if (d.every((x, i) => i === 0 || x === d[i - 1] + 1)) return 'ascending'
  if (n === 4 && d[0] === d[2] && d[1] === d[3]) return 'alternate'
  if (n === 4 && d[0] === d[1] && d[2] === d[3]) return 'pairs'
  if (d.every((x, i) => x === d[n - 1 - i])) return 'mirror'
  if (n === 3 && d[1] === d[2]) return 'lead'
  return null
}

export function recomputeFacts() {
  const issues = []
  for (const locale of LOCALES)
    for (const number of ANGEL_NUMBERS[locale]) {
      const f = angelFacts(number)
      const r = reduceChain(number)
      const chain = [f.sum, ...f.steps.map((s) => s.result)]
      if (f.sum !== r.sum) issues.push(`${number} 各位之和 ${f.sum} ≠ ${r.sum}`)
      if (f.root !== r.root) issues.push(`${number} 根数 ${f.root} ≠ ${r.root}`)
      if (chain.join() !== r.chain.join()) issues.push(`${number} 约简步骤 ${chain} ≠ ${r.chain}`)
      if (f.master !== MASTERS.has(r.root)) issues.push(`${number} 大师数标记`)
      if (f.pattern !== patternOf(number)) issues.push(`${number} 模式 ${f.pattern}`)
      for (const step of f.steps)
        if (step.operands.reduce((a, b) => a + b, 0) !== step.result)
          issues.push(`${number} 步骤算式 ${step.operands.join('+')}≠${step.result}`)
    }
  return issues
}

// ---------------------------------------------------------------------------
// 2. 正文中的算式、根数与时刻
// ---------------------------------------------------------------------------

const sentencesOf = (text) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

/** 句中出现的 3–4 位序列（不含时刻与年份） */
const sequencesIn = (sentence) =>
  [...sentence.matchAll(/(?<![\d:])(\d{3,4})(?![\d:])/g)]
    .map((m) => m[1])
    .filter(
      (s) =>
        !/^(1[5-9]|20)\d\d$/.test(s) ||
        ANGEL_NUMBERS.en.includes(s) ||
        ANGEL_NUMBERS.es.includes(s),
    )

const ROOT_PHRASES = [
  // en：「1111 reduces to 4」「reduces to 4」「its root is 4」「a root of 4」「root number 4」
  /(?:(\d{3,4})\s+)?(?:which\s+|that\s+|then\s+|and\s+|also\s+|both\s+|each\s+)?(?:reduces?|reducing|boils? down|comes? down|collapses?|settles?|lands?)\s+(?:down\s+)?(?:on|to)\s+(?:a\s+|the\s+)?(?:single\s+)?(?:root\s+(?:of\s+)?)?(\d{1,2})\b/gi,
  /(?:(\d{3,4})(?:['’]s)?\s+)?(?:root|root number)\s+(?:is|of|number|becomes)\s+(?:a\s+)?(\d{1,2})\b/gi,
  // es：「se reduce a 6」「su raíz es 6」「raíz 6」「se queda en 6」
  /(?:(?:el\s+)?(\d{3,4})\s+)?(?:se\s+)?(?:reduce|reducen|queda|quedan|resume)\s+(?:en|a)\s+(?:un\s+|el\s+)?(\d{1,2})\b/gi,
  /(?:(?:del\s+|el\s+)?(\d{3,4})\s+)?(?:su\s+|la\s+|una\s+)?raíz\s+(?:es\s+(?:el\s+)?|del?\s+|en\s+el\s+)?(\d{1,2})\b/gi,
]
const SUM_PHRASES = [
  /(?:(\d{3,4})\s+)?(?:adds?|add)\s+up\s+to\s+(\d{1,2})\b/gi,
  /(?:(?:el\s+)?(\d{3,4})\s+)?(?:suma|suman)\s+(\d{1,2})\b/gi,
]

export function factIssues(text, own) {
  const issues = []
  let checked = 0
  for (const sentence of sentencesOf(text)) {
    // 算式：a + b (+ c …) = n
    for (const m of sentence.matchAll(/(\d+(?:\s*\+\s*\d+)+)\s*=\s*(\d+)/g)) {
      checked++
      const total = m[1].split('+').reduce((s, x) => s + Number(x.trim()), 0)
      if (total !== Number(m[2])) issues.push(`算式「${m[0]}」应为 ${total}`)
    }
    // 时刻
    for (const m of sentence.matchAll(/(?<![\d.])(\d{1,2}):(\d{2})(?!\d)/g)) {
      checked++
      // 「33:33 does not exist」一类说明无效时刻的否定句不算
      if ((Number(m[1]) > 23 || Number(m[2]) > 59) && !NEGATED.test(sentence))
        issues.push(`时刻「${m[0]}」无效`)
    }
    const seqs = new Set(sequencesIn(sentence))
    const subjectOf = (explicit) => {
      if (explicit) return explicit
      // 没有写主语：句中只有本页数字（或没有其他序列）时按本页核对
      const others = [...seqs].filter((s) => s !== own)
      return others.length === 0 ? own : null
    }
    for (const re of ROOT_PHRASES)
      for (const m of sentence.matchAll(re)) {
        const subject = subjectOf(m[1])
        if (!subject) continue
        const value = Number(m[2])
        const r = reduceChain(subject)
        checked++
        if (r.root !== value && !(value === r.sum && /\b(?:sum|total)\b|suma|total/i.test(m[0])))
          issues.push(`「${m[0]}」：${subject} 的根数为 ${r.root}`)
      }
    for (const re of SUM_PHRASES)
      for (const m of sentence.matchAll(re)) {
        const subject = subjectOf(m[1])
        if (!subject) continue
        const value = Number(m[2])
        const r = reduceChain(subject)
        checked++
        if (!r.chain.includes(value))
          issues.push(`「${m[0]}」：${subject} 的和为 ${r.chain.join(' → ')}`)
      }
  }
  return { issues, checked }
}

// ---------------------------------------------------------------------------
// 3. 结构、长度、链接与措辞
// ---------------------------------------------------------------------------

export const HEADINGS = {
  en: ['Meaning in numerology', 'In relationships', 'At work', 'When it keeps appearing'],
  es: [
    'Lectura numerológica',
    'En tus relaciones',
    'En el trabajo y los estudios',
    'Lo que no significa',
    'Horas espejo y otros lugares donde aparece',
  ],
}
const MIN_WORDS = { hub: 450, number: 600 }
// es 数字页另写第 5 段与第 4 问（按本语言主词另写，结构不逐段对应 en；跨语言结构直译分门槛 0.6）
const FAQ_COUNT = { en: { hub: [3, 4], number: [3, 3] }, es: { hub: [3, 4], number: [4, 4] } }

/** 任何位置都不允许：AI、娱乐定位、保证、百分比、决策指令 */
const BANNED = [
  /\bguarantee/i,
  /\bentertainment\b/i,
  /\bfor fun\b/i,
  /\bAI\b/,
  /\bartificial intelligence\b/i,
  /\balgorithm/i,
  /\b\d{1,3} ?%/,
  /\b(?:you should|you must) (?:invest|quit|leave|break up|marry|buy|sell|apply)\b/i,
  /\bentretenimiento\b/i,
  /\bIA\b/,
  /\binteligencia artificial\b/i,
  /\bgarantiza/i,
  /\b(?:deberías|debes) (?:invertir|renunciar|dejar|romper|casarte|comprar|vender)\b/i,
]
/**
 * 预言与「讯息」措辞：按句检查；问句与带否定的句子（「No. … does not predict what will happen」）不算，
 * 正文用来澄清误解时允许出现。
 */
const PREDICTIVE = [
  /\bwill (?:happen|come|arrive|bring|change your)\b/i,
  /\bis (?:coming|on (?:its|the) way|about to)\b/i,
  /\babout to (?:happen|change|arrive|begin)\b/i,
  /\b(?:a|the) sign that\b/i,
  /\b(?:angels?|guides?|universe|spirit) (?:is|are) (?:telling|sending|asking|guiding|trying)\b/i,
  /\byour angels\b/i,
  /\bthe universe (?:wants|is)\b/i,
  /\bmanifest(?:ing|ation)?\b/i,
  /\bportal\b/i,
  /\bdestin(?:y|ed)\b/i,
  /\bva(?:n)? a (?:pasar|ocurrir|llegar)\b/i,
  /\bse (?:acerca|avecina)\b/i,
  /\bes una señal de que\b/i,
  /\btus ángeles\b/i,
  /\bel universo (?:quiere|te (?:dice|envía|manda))\b/i,
  /\bmanifestar\b/i,
  /\bdestino (?:escrito|marcado)\b/i,
]
const NEGATED =
  /\b(?:not|no|none|nothing|never|nor|rather than|instead of|doesn['’]t|don['’]t|isn['’]t|aren['’]t|won['’]t|cannot|can['’]t|without|nunca|ni|sin|tampoco)\b|n['’]t\b/i
const isQuestion = (sentence) => /\?\s*$/.test(sentence) || sentence.startsWith('¿')

const countWords = (text) => (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []).length
const plain = (markdown) =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+ .*$/gm, '')
    .replace(/[*_`>]/g, '')

function bodySections(content) {
  return content
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const nl = chunk.indexOf('\n')
      return { title: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1) }
    })
}

const LIFE_PATH = { en: '/life-path-number', es: '/es/numero-de-vida' }
const HUB = { en: '/angel-numbers', es: '/es/numeros-angelicales' }
const LIFE_PATH_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]
/** 正文可链接的其他可索引页（生命灵数计算器、数字命理入门） */
const OTHER_TARGETS = {
  // 个人年数计算器（第 27 组）：枢纽正文链向它
  en: new Set([
    '/life-path-number',
    '/numerology',
    '/numerology-calculator',
    '/personal-year-number',
  ]),
  es: new Set([
    '/es/numero-de-vida',
    '/es/numerologia',
    '/es/calculadora-numerologia',
    '/es/ano-personal',
  ]),
}

/** 站上其他内容对生命灵数页与入门页已使用的锚文本（与本集合合并统计每目标的表述数） */
function existingAnchors() {
  const anchors = new Map()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
      if (entry.isDirectory()) {
        if (entry.name !== 'angel-numbers') walk(url)
        continue
      }
      if (!entry.name.endsWith('.mdx')) continue
      const text = readFileSync(url, 'utf8')
      // 数字命理页 frontmatter 的 neighbors 写成不带地址的 [Life Path Number 6]，由组件渲染为指向数字页的链接
      for (const m of text.matchAll(/\[(life path number|número de vida) (\d+)\](?!\()/gi)) {
        const target = `${m[1].toLowerCase() === 'life path number' ? LIFE_PATH.en : LIFE_PATH.es}/${m[2]}`
        if (!anchors.has(target)) anchors.set(target, new Map())
        const wording = `${m[1]} ${m[2]}`.toLowerCase()
        const byWording = anchors.get(target)
        byWording.set(wording, (byWording.get(wording) ?? 0) + 1)
      }
      for (const m of text.matchAll(/\[([^\]]+)\]\((\/[^)\s]*)\)/g)) {
        const target = m[2]
        if (
          ![...Object.values(LIFE_PATH)].some((p) => target.startsWith(p)) &&
          !OTHER_TARGETS.en.has(target) &&
          !OTHER_TARGETS.es.has(target)
        )
          continue
        if (!anchors.has(target)) anchors.set(target, new Map())
        const wording = m[1].trim().toLowerCase()
        const byWording = anchors.get(target)
        byWording.set(wording, (byWording.get(wording) ?? 0) + 1)
      }
    }
  }
  walk(CONTENT)
  return anchors
}

export function checkContent() {
  const failures = []
  const rows = []
  const anchors = new Map()
  let factsChecked = 0
  for (const locale of LOCALES) {
    const dir = new URL(`angel-numbers/${locale}/`, CONTENT)
    const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'))
    const keys = files.map((f) => f.replace(/\.mdx$/, ''))
    const expected = ['index', ...ANGEL_NUMBERS[locale]]
    for (const key of expected)
      if (!keys.includes(key)) failures.push(`${locale}/${key}.mdx 缺失（paths.ts 已登记）`)
    for (const key of keys)
      if (!expected.includes(key)) failures.push(`${locale}/${key}.mdx 未在 paths.ts 登记`)
    const seen = { title: new Map(), heading: new Map(), description: new Map() }
    for (const file of files.sort()) {
      const key = file.replace(/\.mdx$/, '')
      const kind = key === 'index' ? 'hub' : 'number'
      const fail = (message) => failures.push(`${locale}/${file}：${message}`)
      const raw = readFileSync(new URL(file, dir), 'utf8')
      const [, front = '', content = ''] = raw.split(/^---$/m)
      const data = parseDocument(front).toJS()
      const required = ['title', 'heading', 'description', 'lede', 'faq', 'updated']
      if (kind === 'number') required.push('theme', 'question')
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
      if (kind === 'number') {
        const lead = locale === 'en' ? `angel number ${key}` : `número angelical ${key}`
        if (!String(data.title).toLowerCase().startsWith(lead)) fail(`title 应以「${lead}」开头`)
        if (!String(data.heading).toLowerCase().startsWith(lead))
          fail(`heading 应以「${lead}」开头`)
        if (!String(data.description).includes(key)) fail('description 未写本数字')
      }
      const faq = data.faq ?? []
      const [faqMin, faqMax] = FAQ_COUNT[locale][kind]
      if (faq.length < faqMin || faq.length > faqMax)
        fail(`FAQ ${faq.length} 条（${faqMin}–${faqMax}）`)
      if (locale === 'es' && faq.some((item) => item.origin !== 'local'))
        fail('es FAQ 须逐条标 origin: local（按本语言另写）')
      const sections = bodySections(content)
      if (kind === 'number') {
        const titles = sections.map((s) => s.title)
        if (titles.join('|') !== HEADINGS[locale].join('|'))
          fail(`小标题应为 ${HEADINGS[locale].join(' / ')}，实为 ${titles.join(' / ')}`)
      }
      const words = countWords(plain(content.replace(/^## .*$/gm, '')))
      if (words < MIN_WORDS[kind]) fail(`正文 ${words} 词，少于 ${MIN_WORDS[kind]}`)
      // 链接
      const links = [...content.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({
        anchor: m[1].trim(),
        target: m[2],
      }))
      const targets = links.map((l) => l.target)
      if (links.length < 2 || links.length > 5) fail(`正文内链 ${links.length} 条（2–5）`)
      if (new Set(targets).size !== targets.length) fail('同一目标链接了两次')
      const facts = kind === 'number' ? angelFacts(key) : null
      for (const { anchor, target } of links) {
        const lp = new RegExp(`^${LIFE_PATH[locale]}/(\\d+)$`).exec(target)
        const angel = new RegExp(`^${HUB[locale]}/(\\d+)$`).exec(target)
        if (lp) {
          const value = Number(lp[1])
          if (!LIFE_PATH_VALUES.includes(value)) fail(`死链 ${target}`)
          else if (facts && !facts.distinct.includes(value) && facts.root !== value)
            fail(`${target} 不是 ${key} 的某位或根数`)
        } else if (angel) {
          if (!ANGEL_NUMBERS[locale].includes(angel[1]))
            fail(`未发布的 angel number 链接 ${target}`)
          if (angel[1] === key) fail('链接到自身')
        } else if (target !== HUB[locale] && !OTHER_TARGETS[locale].has(target)) {
          fail(`不允许的链接目标 ${target}`)
        }
        if (!anchors.has(target)) anchors.set(target, new Map())
        const wording = anchor.toLowerCase()
        const byWording = anchors.get(target)
        byWording.set(wording, [...(byWording.get(wording) ?? []), `${locale}/${key}`])
      }
      // 措辞
      const prose = [
        data.title,
        data.heading,
        data.description,
        data.lede,
        data.question,
        plain(content),
      ]
        .concat(faq.flatMap(({ q, a }) => [q, a]))
        .filter(Boolean)
        .join('\n')
      for (const re of BANNED) {
        const m = re.exec(prose)
        if (m) fail(`禁用措辞「${m[0]}」`)
      }
      // 「双生火焰」「灵魂伴侣」只允许出现在随后给出否定说明的段落（FAQ 澄清流行说法）
      for (const paragraph of prose.split(/\n+/)) {
        const m = /\b(?:twin flames?|soul ?mates?|almas? gemelas?|llamas? gemelas?)\b/i.exec(
          paragraph,
        )
        if (m && !(isQuestion(paragraph) || NEGATED.test(paragraph)))
          fail(`关系判定措辞「${m[0]}」：${paragraph.slice(0, 90)}`)
      }
      for (const sentence of sentencesOf(prose)) {
        if (isQuestion(sentence) || NEGATED.test(sentence)) continue
        for (const re of PREDICTIVE) {
          const m = re.exec(sentence)
          if (m) fail(`预言措辞「${m[0]}」：${sentence.slice(0, 90)}`)
        }
      }
      // 事实复算
      const result = factIssues(prose, kind === 'number' ? key : null)
      factsChecked += result.checked
      for (const issue of result.issues) fail(issue)
      rows.push({ page: `${locale}/${key}`, words, links: links.length, facts: result.checked })
    }
  }
  // 每目标锚文本：本集合 + 站上其他内容
  const existing = existingAnchors()
  const anchorReport = []
  for (const [target, byWording] of anchors) {
    const merged = new Map([...byWording].map(([w, list]) => [w, list.length]))
    for (const [w, n] of existing.get(target) ?? []) merged.set(w, (merged.get(w) ?? 0) + n)
    const total = [...merged.values()].reduce((a, b) => a + b, 0)
    const share = Math.max(...merged.values()) / total
    const before = [...(existing.get(target) ?? new Map()).values()]
    const beforeShare = before.length ? Math.max(...before) / before.reduce((a, b) => a + b, 0) : 0
    anchorReport.push({ target, total, share, beforeShare, wordings: Object.fromEntries(merged) })
    if (merged.size > 2)
      failures.push(`${target} 锚文本 ${merged.size} 种：${[...merged.keys()].join('、')}`)
    // 站上原有内容已超过 70% 时，本集合不得让占比更高
    if (total >= 5 && share > 0.7 && share > beforeShare)
      failures.push(`${target} top1 锚文本占 ${Math.round(share * 100)}%（${total} 条）`)
  }
  return { failures, rows, anchors: anchorReport, factsChecked }
}

const isMain = import.meta.url === new URL(process.argv[1], 'file://').href
if (isMain) {
  const { values } = parseArgs({ options: { report: { type: 'string' } } })
  const factIssuesList = recomputeFacts()
  const { failures, rows, anchors, factsChecked } = checkContent()
  const all = [...factIssuesList.map((x) => `事实表：${x}`), ...failures]
  if (values.report)
    writeFileSync(
      values.report,
      JSON.stringify({ failures: all, rows, anchors, factsChecked }, null, 2),
    )
  if (all.length) {
    console.error(`angel numbers 内容校验未通过（${all.length} 项）：`)
    for (const line of all) console.error(`  ✗ ${line}`)
    process.exit(1)
  }
  console.log(
    `angel numbers 内容校验通过：${rows.length} 页，复算 ${factsChecked} 处算式、根数与时刻`,
  )
}
