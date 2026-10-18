import { readdir, readFile } from 'node:fs/promises'

const directory = new URL('../apps/web/content/tarot/en/', import.meta.url)
const groups = { major: 22, wands: 14, cups: 14, swords: 14, pentacles: 14 }
const expected = new Map(
  Object.entries(groups).flatMap(([suit, count]) =>
    Array.from({ length: count }, (_, index) => {
      const number = suit === 'major' ? index : index + 1
      return [`${suit}-${String(number).padStart(2, '0')}.mdx`, suit]
    }),
  ),
)
const errors = []
const titles = new Set()
const slugs = new Set()
const counts = []

// 本批内容使用双引号 YAML 标量与 q/a 列表；明确拒绝其他语法，避免引入解析依赖或执行 MDX。
function parseFrontmatter(source) {
  const fields = {}
  let faq
  for (const line of source.split('\n')) {
    if (!line.trim()) continue
    if (line === 'faq:') {
      if (faq) throw new Error('duplicate faq field')
      faq = []
      fields.faq = faq
      continue
    }
    const question = /^ {2}- q: (".*")$/.exec(line)
    const answer = /^ {4}a: (".*")$/.exec(line)
    if (question && faq) {
      faq.push({ q: JSON.parse(question[1]) })
    } else if (answer && faq?.length) {
      const item = faq.at(-1)
      if ('a' in item) throw new Error('duplicate FAQ answer')
      item.a = JSON.parse(answer[1])
    } else {
      const field = /^([a-zA-Z]+): (".*")$/.exec(line)
      if (!field) throw new Error('expected quoted YAML scalar or FAQ q/a item')
      if (Object.hasOwn(fields, field[1])) throw new Error(`duplicate ${field[1]} field`)
      fields[field[1]] = JSON.parse(field[2])
    }
  }
  return fields
}

function wordCount(body) {
  // 统计可见正文和标题，排除 frontmatter、链接目标与 Markdown 标点；连字符词计为一个词。
  const visible = body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return visible.match(/[A-Za-z0-9]+(?:['’−-][A-Za-z0-9]+)*/g)?.length ?? 0
}

const files = (await readdir(directory)).filter((name) => name.endsWith('.mdx')).sort()
for (const name of expected.keys()) {
  if (!files.includes(name)) errors.push(`${name}: missing file`)
}
for (const name of files) {
  const suit = expected.get(name)
  if (!suit) {
    errors.push(`${name}: unexpected card file`)
    continue
  }
  const check = (condition, message) => {
    if (!condition) errors.push(`${name}: ${message}`)
  }
  const source = await readFile(new URL(name, directory), 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source)
  if (!match) {
    errors.push(`${name}: missing frontmatter delimiters`)
    continue
  }
  let fields
  try {
    fields = parseFrontmatter(match[1].replaceAll('\r', ''))
  } catch (error) {
    errors.push(`${name}: ${error.message}`)
    continue
  }
  for (const key of ['title', 'description', 'slug', 'locale', 'cardId', 'arcana', 'updated']) {
    check(typeof fields[key] === 'string' && fields[key].trim().length > 0, `missing ${key}`)
  }
  check(fields.cardId === name.slice(0, -4), 'cardId must match filename')
  check(fields.locale === 'en', 'locale must be en')
  check(fields.updated === '2026-10-19', 'updated must be 2026-10-19')
  check(fields.arcana === (suit === 'major' ? 'major' : 'minor'), 'incorrect arcana')
  check(suit === 'major' ? !Object.hasOwn(fields, 'suit') : fields.suit === suit, 'incorrect suit')
  check(Array.from(fields.description ?? '').length <= 160, 'description exceeds 160 characters')
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug ?? ''), 'invalid slug')
  check(!titles.has(fields.title?.toLowerCase()), 'duplicate title')
  check(!slugs.has(fields.slug), 'duplicate slug')
  check(/Tarot Card Meaning/i.test(fields.title ?? ''), 'title must contain the main keyword')
  check(!/\bAI\b/i.test(fields.title ?? ''), 'title must not promote AI')
  titles.add(fields.title?.toLowerCase())
  slugs.add(fields.slug)
  const body = match[2]
  const faq = fields.faq
  check(Array.isArray(faq) && faq.length >= 3 && faq.length <= 5, 'faq must contain 3–5 items')
  for (const item of faq ?? []) {
    check(typeof item.q === 'string' && item.q.trim().length > 0, 'FAQ question is required')
    check(typeof item.a === 'string' && item.a.trim().length > 0, 'FAQ answer is required')
    check(body.includes(`### ${item.q}\n\n${item.a}`), 'FAQ must match its visible body entry')
  }
  for (const heading of [
    'Overview and symbolism',
    'Keywords',
    'Upright meaning',
    'Reversed meaning',
    'Love',
    'Career',
    'Advice',
    'Yes or No',
    'Related spreads',
    'FAQ',
  ]) {
    check(body.includes(`## ${heading}\n`), `missing ${heading} section`)
  }
  check(
    !/^(?:import|export)\s|<\/?[A-Za-z]|^# /m.test(body),
    'body must use Markdown only, without H1',
  )
  check(
    body.includes(
      'AI-assisted interpretation is for entertainment only and does not predict the future',
    ),
    'missing entertainment disclosure',
  )
  const count = wordCount(body)
  counts.push(count)
  check(count >= 600 && count <= 900, `body has ${count} words; expected 600–900`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  console.error(`Content check failed: ${errors.length} issue(s).`)
  process.exitCode = 1
} else {
  console.log(
    `Content check passed: ${files.length}/78 English tarot articles; body words ${Math.min(...counts)}–${Math.max(...counts)}; total ${counts.reduce((sum, count) => sum + count, 0)}.`,
  )
  console.log(
    'Frontmatter, unique titles/slugs, descriptions, FAQ, sections, and disclosure passed.',
  )
}
