// 月相集合（content/moon）的内容校验（openspec content-growth-v2-tools 任务 19.1、design 决策 11、15、16）：
// frontmatter 字段、TDK 长度、篇幅下限、正文内链与锚文本、合规措辞，
// 正文中写到的满月名与月相日期逐项用引擎复算（@xuanxue/astro/moon），并复核构建期月相表的剩余覆盖期。
// 运行：node scripts/check-content-moon.mjs [--report <文件>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import {
  assertMoonCoverage,
  fullMoonNames,
  generateMoonBuildData,
  moonQuarterEvents,
} from '../packages/astro/src/moon.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const ROOT = new URL('../apps/web/content/moon/', import.meta.url)
const GENERATED = new URL(
  '../apps/web/.content-collections/generated/allMoonData.js',
  import.meta.url,
)
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]
const MAIN = ['today', 'full-moon', 'full-moon-calendar', 'moon-calendar']
const MONTH_TITLE = MONTHS.map((slug) => slug[0].toUpperCase() + slug.slice(1))

/** 各页 H2（决策 16 组内相似度按 H2 对齐：月份页两段标题一致） */
const HEADINGS = {
  month: ['Where the name comes from', 'Viewing tips'],
  today: ['The eight phases', 'How the phase is calculated', 'Reading the Moon in the sky'],
  'full-moon': [
    'What counts as a full moon',
    'Supermoons and blue moons',
    'Watching a full moon rise',
  ],
  'full-moon-calendar': [
    'How to read the table',
    'Where the traditional names come from',
    'Two full moons in one month',
  ],
  'moon-calendar': [
    'How to use the moon calendar',
    'Phases through the month',
    'Planning a night of moon watching',
  ],
}
/** 撰写文案的篇幅下限（导语 + 正文，按词，不含 FAQ）；渲染后另有组件文字，整页门槛见决策 16 */
const MIN_WORDS = { month: 400, main: 680 }
/** 正文只链接月相各页（决策 15：满月页 ↔ 年度满月表 ↔ 当月月历），不跨站 */
const LINK_TARGETS = new Set([
  '/moon-phase-today',
  '/full-moon',
  '/full-moon-calendar',
  '/moon-calendar',
  ...MONTHS.map((slug) => `/moon-calendar/${slug}`),
])
/** 合规（决策 11、16）：不写健康、生育、手术、情绪与运气暗示，不提 AI、不用「娱乐」定位 */
const BANNED = [
  /\bAI\b/,
  /artificial intelligence/i,
  /entertainment/i,
  /for fun\b/i,
  /fertil/i,
  /pregnan/i,
  /menstru/i,
  /surger/i,
  /\bhealth/i,
  /\bsleep/i,
  /\bmood/i,
  /\bemotion/i,
  /\bluck/i,
  /manifest/i,
  /horoscope/i,
  /\bwill (bring|cause|make you)\b/i,
  /lucky|unlucky/i,
  /!/,
]
const TITLE_LENGTH = [40, 60]
const DESCRIPTION_LENGTH = [140, 160]

const toTitle = (key) =>
  key
    .split('-')
    .map((word) => (word === 'hunters' ? "Hunter's" : word[0].toUpperCase() + word.slice(1)))
    .join(' ')

function plain(markdown) {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+ .*$/gm, '')
    .replace(/[*_`>]/g, '')
}
const words = (text) => (text.match(/[A-Za-z0-9’'-]+/g) ?? []).length

/** 正文写到的「<月> <日>, <年>」与相邻的满月 / 新月，用引擎复算（±1 天，UTC 与当地日期之差） */
export function dateIssues(text) {
  const issues = []
  let checked = 0
  const pattern = new RegExp(
    `(full moon|new moon)[^.]{0,40}?\\b(${MONTH_TITLE.join('|')}) (\\d{1,2}), (\\d{4})`,
    'gi',
  )
  for (const match of text.matchAll(pattern)) {
    const phase = match[1].toLowerCase().replace(' ', '-')
    const month = MONTH_TITLE.indexOf(match[2]) + 1
    const day = Number(match[3])
    const year = Number(match[4])
    const target = Date.UTC(year, month - 1, day)
    const events = moonQuarterEvents(`${year - 1}-12-01`, `${year + 1}-02-01`)
    checked++
    const hit = events.some(
      (event) =>
        event.phase === phase && Math.abs(event.utcMs - target - 43_200_000) <= 36 * 3_600_000,
    )
    if (!hit) issues.push(`${match[0]}：引擎在该日前后一天内没有${phase}`)
  }
  return { issues, checked }
}

export function checkMoonContent(dir = new URL('en/', ROOT)) {
  const failures = []
  const rows = []
  const anchors = new Map()
  if (!existsSync(dir)) return { failures: ['缺少 content/moon/en'], rows, anchors }
  const files = readdirSync(dir).filter((file) => file.endsWith('.mdx'))
  const names = fullMoonNames()
  for (const key of [...MAIN, ...MONTHS])
    if (!files.includes(`${key}.mdx`)) failures.push(`en: 缺少 ${key}.mdx`)
  let factsChecked = 0
  for (const file of files.sort()) {
    const fail = (message) => failures.push(`en/${file}: ${message}`)
    const key = file.replace(/\.mdx$/, '')
    const month = MONTHS.indexOf(key) + 1
    if (month === 0 && !MAIN.includes(key)) {
      fail('未登记的页面')
      continue
    }
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
    for (const field of ['title', 'heading', 'description', 'lede', 'faq', 'updated'])
      if (!data[field]) fail(`缺少 ${field}`)
    if (month) {
      // 满月名与引擎一致（月份 → 传统月名）
      const expected = toTitle(names[month])
      if (data.month !== month) fail(`month 应为 ${month}`)
      if (data.moon_name !== expected) fail(`moon_name 应为 ${expected}（引擎 ${names[month]}）`)
      factsChecked++
      if (data.heading !== `${MONTH_TITLE[month - 1]} {year} Moon Calendar`)
        fail(`heading 应为「${MONTH_TITLE[month - 1]} {year} Moon Calendar」`)
      if (!String(data.title).startsWith(`${MONTH_TITLE[month - 1]} {year} Moon Calendar`))
        fail('title 应以「<月> {year} Moon Calendar」开头')
      // 文中出现的其他月名必须是本月的（防止串月）
      for (const [other, name] of Object.entries(names)) {
        if (Number(other) === month) continue
        const title = toTitle(name)
        if (new RegExp(`\\bthe ${title}\\b`).test(content) && !/Harvest|Hunter/.test(title))
          rows.push(`提示 en/${file}: 提到 ${title}`)
      }
    } else if (data.month !== undefined || data.moon_name !== undefined) {
      fail('主页面不写 month / moon_name')
    }
    for (const year of [2026, 2027, 2028]) {
      const title = String(data.title ?? '').replaceAll('{year}', String(year))
      const description = String(data.description ?? '').replaceAll('{year}', String(year))
      if (title.length < TITLE_LENGTH[0] || title.length > TITLE_LENGTH[1])
        fail(`Title ${title.length} 字符（${TITLE_LENGTH.join('–')}）：${title}`)
      if (description.length < DESCRIPTION_LENGTH[0] || description.length > DESCRIPTION_LENGTH[1])
        fail(`Description ${description.length} 字符（${DESCRIPTION_LENGTH.join('–')}）`)
      if (!String(data.title).includes('{year}')) break
    }
    const faq = Array.isArray(data.faq) ? data.faq : []
    if (faq.length < 3 || faq.length > 4) fail(`FAQ ${faq.length} 条（3–4）`)
    const sections = content
      .split(/^## /m)
      .slice(1)
      .map((chunk) => chunk.slice(0, chunk.indexOf('\n')).trim())
    const expectedHeadings = HEADINGS[month ? 'month' : key]
    if (JSON.stringify(sections) !== JSON.stringify(expectedHeadings))
      fail(`H2 应为 ${expectedHeadings.join(' / ')}，实为 ${sections.join(' / ')}`)
    const count = words(`${data.lede ?? ''}\n${plain(content)}`)
    const min = month ? MIN_WORDS.month : MIN_WORDS.main
    if (count < min) fail(`导语与正文 ${count} 词（下限 ${min}）`)
    const links = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
    const targets = new Set(links.map((link) => link[2]))
    if (targets.size < 2 || targets.size > 5) fail(`正文内链 ${targets.size} 个目标（2–5）`)
    for (const [, anchor, target] of links) {
      if (!LINK_TARGETS.has(target)) fail(`正文链接目标不在月相页内：${target}`)
      if (target === `/moon-calendar/${key}`) fail('正文链接指向本页')
      if (!anchors.has(target)) anchors.set(target, new Map())
      const byAnchor = anchors.get(target)
      const normalized = anchor.toLowerCase()
      byAnchor.set(normalized, (byAnchor.get(normalized) ?? 0) + 1)
    }
    const text = [
      data.title,
      data.description,
      data.lede,
      content,
      ...faq.flatMap(({ q, a }) => [q, a]),
    ].join('\n')
    for (const pattern of BANNED) {
      const hit = pattern.exec(text)
      if (hit) fail(`合规：出现「${hit[0]}」`)
    }
    const facts = dateIssues(plain(text))
    factsChecked += facts.checked
    for (const issue of facts.issues) fail(issue)
    rows.push(`en/${file}: ${count} 词，正文内链 ${targets.size}，FAQ ${faq.length}`)
  }
  // 每目标锚文本 ≤2 种（决策 15）；入链 ≥5 时 top1 ≤70%（月份页按奇偶月轮换两种锚文本）
  for (const [target, byAnchor] of anchors) {
    const total = [...byAnchor.values()].reduce((sum, n) => sum + n, 0)
    const top = Math.max(...byAnchor.values())
    if (byAnchor.size > 2) failures.push(`${target}: 锚文本 ${byAnchor.size} 种（≤2）`)
    if (total >= 5 && top / total > 0.7)
      failures.push(`${target}: top1 锚文本占 ${Math.round((top / total) * 100)}%（≤70%）`)
    rows.push(`锚文本 ${target}: ${[...byAnchor].map(([a, n]) => `${a}×${n}`).join('，')}`)
  }
  rows.push(`引擎复算：满月名 12 项与正文日期 ${factsChecked - 12} 项`)
  return { failures, rows, anchors }
}

/** 构建期月相表：引擎按今天生成的表覆盖 ≥13 个月；已生成的内容集合表剩余覆盖期不足时报错 */
export function checkMoonTable(today = new Date().toISOString().slice(0, 10)) {
  const failures = []
  const rows = []
  const fresh = generateMoonBuildData(today)
  try {
    assertMoonCoverage(fresh.endDate, today)
    rows.push(`引擎表 ${fresh.startDate}–${fresh.endDate}（${fresh.days.length} 天）`)
  } catch (error) {
    failures.push(String(error))
  }
  if (existsSync(GENERATED)) {
    const source = readFileSync(GENERATED, 'utf8')
    const [table] = JSON.parse(
      source
        .replace(/^[\s\S]*?export default\s*/, '')
        .trim()
        .replace(/;$/, ''),
    )
    try {
      assertMoonCoverage(table.endDate, today)
      rows.push(`已生成表（构建日 ${table.buildDate}）覆盖至 ${table.endDate}`)
    } catch (error) {
      failures.push(`已生成的月相表（构建日 ${table.buildDate}）需要重新生成：${error.message}`)
    }
  }
  return { failures, rows }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { report: { type: 'string' } } })
  const content = checkMoonContent()
  const table = checkMoonTable()
  const failures = [...content.failures, ...table.failures]
  const rows = [...content.rows, ...table.rows]
  if (values.report) writeFileSync(values.report, `${rows.join('\n')}\n`)
  if (failures.length) {
    console.error(`check-content-moon：${failures.length} 项不通过\n${failures.join('\n')}`)
    process.exit(1)
  }
  console.log(`check-content-moon：通过（${rows.at(-1)}）`)
}
