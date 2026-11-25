// 逆行日历（content/retrograde-calendar）的内容校验（openspec content-growth-v2-tools 25.2、design 决策 15、16）：
// frontmatter、TDK 长度、篇幅、H2、正文内链与合规措辞；正文写到的逆行事实（时长、频率、占比、退行弧、
// 冲与下合）逐项用引擎复算（@xuanxue/astro/retrograde，2000–2050 年）；与 Swiss Ephemeris 夹具的偏差数字与测试一致；
// 并复核构建期停滞表的覆盖期（当天须在所列两年内、剩余 ≥13 个月），表不会悄悄过期。
// 运行：node scripts/check-content-retrograde.mjs [--report <文件>]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { apparentLongitude } from '../packages/astro/src/chart.ts'
import {
  assertRetrogradeCoverage,
  generateRetrogradeBuildData,
  planetStations,
  RETROGRADE_PLANETS,
  retrogradePeriods,
  retrogradeSigns,
} from '../packages/astro/src/retrograde.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const { parseDocument } = coreRequire('yaml')

const FILE = new URL('../apps/web/content/retrograde-calendar/en/index.mdx', import.meta.url)
const GENERATED = new URL(
  '../apps/web/.content-collections/generated/allRetrogradeData.js',
  import.meta.url,
)
const FIXTURE = new URL(
  '../packages/astro/test/fixtures/swisseph-retrograde-stations.json',
  import.meta.url,
)

const HEADINGS = [
  'What retrograde means',
  'How often each planet turns',
  'Retrograde in astrological tradition',
  'How the dates are calculated',
]
const MIN_WORDS = 600
/** 正文链接目标（决策 15）：西方站同主题页，不跨站 */
const LINK_TARGETS = new Set(['/birth-chart', '/zodiac-signs', '/moon-phase-today'])
/** 合规：不提 AI、不用「娱乐」定位、不写预测与恐吓类措辞 */
const BANNED = [
  /\bAI\b/,
  /artificial intelligence/i,
  /entertainment/i,
  /for fun\b/i,
  /horoscope/i,
  /\bluck/i,
  /\bunlucky\b/i,
  /\bchaos\b/i,
  /disaster/i,
  /\bdoom/i,
  /\bcurse/i,
  /\bbeware\b/i,
  /\bdanger/i,
  /\bavoid\b/i,
  /\bnever sign\b/i,
  /\bwill (bring|cause|make you)\b/i,
  /guarantee/i,
  /self-exploration/i,
  /!/,
]
const BRAND_SUFFIX = ' | Arcanumber'
const TITLE_LENGTH = [40, 60]
const DESCRIPTION_LENGTH = [140, 160]
const DAY = 86_400_000

const words = (text) => (text.match(/[A-Za-z0-9’'-]+/g) ?? []).length
const plain = (markdown) =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+ .*$/gm, '')
    .replace(/[*_`>]/g, '')
const fill = (text, year) =>
  String(text ?? '')
    .replaceAll('{year}', String(year))
    .replaceAll('{next}', String(year + 1))

export function checkRetrogradeCopy(source = readFileSync(FILE, 'utf8')) {
  const failures = []
  const rows = []
  const match = source.match(/^---\n([\s\S]+?)\n---\n\n([\s\S]+)$/)
  if (!match) return { failures: ['缺少 frontmatter 分隔'], rows, text: '' }
  const document = parseDocument(match[1], { uniqueKeys: true })
  if (document.errors.length)
    return { failures: [`YAML 错误：${document.errors[0].message}`], rows, text: '' }
  const data = document.toJS()
  const content = match[2]
  for (const field of ['title', 'heading', 'description', 'lede', 'faq', 'updated'])
    if (!data[field]) failures.push(`缺少 ${field}`)
  for (const field of ['title', 'heading', 'description'])
    if (!String(data[field]).includes('{year}') || !String(data[field]).includes('{next}'))
      failures.push(`${field} 应含 {year} 与 {next}（H1 与 TDK 随年份滚动，设计稿 B7）`)
  for (const year of [2026, 2027, 2028]) {
    const title = `${fill(data.title, year)}${BRAND_SUFFIX}`
    const description = fill(data.description, year)
    if (title.length < TITLE_LENGTH[0] || title.length > TITLE_LENGTH[1])
      failures.push(`Title ${title.length} 字符（${TITLE_LENGTH.join('–')}）：${title}`)
    if (description.length < DESCRIPTION_LENGTH[0] || description.length > DESCRIPTION_LENGTH[1])
      failures.push(`Description ${description.length} 字符（${DESCRIPTION_LENGTH.join('–')}）`)
  }
  if (!/^Retrograde Calendar/.test(String(data.title)))
    failures.push('Title 应以主词「Retrograde Calendar」开头')
  const faq = Array.isArray(data.faq) ? data.faq : []
  if (faq.length < 3 || faq.length > 5) failures.push(`FAQ ${faq.length} 条（3–5）`)
  if (faq.filter(({ a }) => String(a).includes('{mercury-now}')).length !== 1)
    failures.push('FAQ 须有且只有一条答案为 {mercury-now}（水星现状由页面按参考日计算）')
  const sections = content
    .split(/^## /m)
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf('\n')).trim())
  if (JSON.stringify(sections) !== JSON.stringify(HEADINGS))
    failures.push(`H2 应为 ${HEADINGS.join(' / ')}，实为 ${sections.join(' / ')}`)
  const count = words(`${data.lede ?? ''}\n${plain(content)}`)
  if (count < MIN_WORDS) failures.push(`导语与正文 ${count} 词（下限 ${MIN_WORDS}）`)
  const links = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
  const targets = new Set(links.map((link) => link[2]))
  if (targets.size < 2 || targets.size > 5) failures.push(`正文内链 ${targets.size} 个目标（2–5）`)
  for (const [, , target] of links)
    if (!LINK_TARGETS.has(target)) failures.push(`正文链接目标未登记：${target}`)
  const text = [
    data.title,
    data.description,
    data.lede,
    content,
    ...faq.flatMap(({ q, a }) => [q, a]),
  ].join('\n')
  for (const pattern of BANNED) {
    const hit = pattern.exec(text)
    if (hit) failures.push(`合规：出现「${hit[0]}」`)
  }
  // 日期一律由页面计算：正文与 FAQ 不写具体年月日
  const dated =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/.exec(
      text,
    )
  if (dated) failures.push(`正文写了具体日期「${dated[0]}」，应由页面按停滞表显示`)
  rows.push(`en/index.mdx：${count} 词，正文内链 ${targets.size}，FAQ ${faq.length}`)
  return { failures, rows, text: plain(text) }
}

/** 引擎统计 2000–2050 年的逆行期（正文的时长、频率、占比、退行弧都以此为准） */
export function retrogradeFacts(fromYear = 2000, toYear = 2051) {
  const start = Date.UTC(fromYear, 0, 1)
  const end = Date.UTC(toYear, 0, 1)
  const stats = {}
  const all = []
  for (const planet of RETROGRADE_PLANETS) {
    const periods = retrogradePeriods(planetStations(planet, start, end))
    all.push(...periods)
    const lengths = periods.map((p) => (p.endMs - p.startMs) / DAY)
    const gaps = periods.slice(1).map((p, i) => (p.startMs - periods[i].startMs) / DAY)
    const arcs = periods.map((p) => (p.startLongitude - p.endLongitude + 360) % 360)
    const starts = new Map()
    for (const p of periods) {
      const year = new Date(p.startMs).getUTCFullYear()
      starts.set(year, (starts.get(year) ?? 0) + 1)
    }
    const fullYears = Array.from({ length: toYear - fromYear - 2 }, (_, i) => fromYear + 1 + i)
    const mid = periods.map((p) => (p.startMs + p.endMs) / 2)
    const elongations = mid.map((t) => {
      const delta = Math.abs(apparentLongitude(planet, t) - apparentLongitude('sun', t)) % 360
      return delta > 180 ? 360 - delta : delta
    })
    const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length
    stats[planet] = {
      count: periods.length,
      minDays: Math.min(...lengths),
      maxDays: Math.max(...lengths),
      meanDays: mean(lengths),
      meanGapDays: mean(gaps),
      minArc: Math.min(...arcs),
      maxArc: Math.max(...arcs),
      startsPerYear: [...new Set(fullYears.map((year) => starts.get(year) ?? 0))].sort(),
      shareOfDays: mean(lengths) / mean(gaps),
      signCrossingShare:
        periods.filter((p) => retrogradeSigns(p.startLongitude, p.endLongitude).length > 1).length /
        periods.length,
      maxElongation: Math.max(...elongations),
      minElongation: Math.min(...elongations),
    }
  }
  // 至少一颗行星在逆行的日子占比（每日 UTC 正午取样）
  let days = 0
  let anyRetro = 0
  for (let t = start + DAY / 2; t < end; t += DAY) {
    days++
    if (all.some((p) => p.startMs <= t && t < p.endMs)) anyRetro++
  }
  return { stats, anyRetroShare: anyRetro / days }
}

const months = (days) => days / (365.25 / 12)

/** 正文的每条数字事实与引擎统计逐项比对 */
export function checkRetrogradeFacts(text, { stats, anyRetroShare } = retrogradeFacts()) {
  const failures = []
  const claim = (ok, message, phrase) => {
    if (phrase && !text.includes(phrase)) failures.push(`正文缺少已核对的说法「${phrase}」`)
    if (!ok) failures.push(`事实不符：${message}`)
  }
  const { mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto } = stats
  claim(
    String(mercury.startsPerYear) === '3,4',
    `水星每年开始 ${mercury.startsPerYear} 次`,
    'Three or four of its retrogrades begin in each calendar year',
  )
  claim(
    mercury.minDays >= 19.5 && mercury.maxDays <= 24.5,
    `水星逆行 ${mercury.minDays.toFixed(1)}–${mercury.maxDays.toFixed(1)} 天`,
    'between about 20 and 24 days',
  )
  claim(
    Math.abs(mercury.meanGapDays - 116) < 1,
    `水星平均间隔 ${mercury.meanGapDays.toFixed(1)} 天`,
    'roughly every 116 days',
  )
  claim(
    mercury.minArc >= 7.5 && mercury.maxArc <= 16.5,
    `水星退行弧 ${mercury.minArc.toFixed(1)}–${mercury.maxArc.toFixed(1)}°`,
    'between about 8° and 16° of the zodiac',
  )
  claim(
    Math.abs(months(venus.meanGapDays) - 19) < 0.5 && Math.abs(venus.meanDays / 7 - 6) < 0.3,
    `金星每 ${months(venus.meanGapDays).toFixed(1)} 个月、${(venus.meanDays / 7).toFixed(1)} 周`,
    'roughly once every 19 months, for about six weeks',
  )
  claim(
    Math.abs(months(mars.meanGapDays) - 26) < 0.7,
    `火星平均间隔 ${months(mars.meanGapDays).toFixed(1)} 个月`,
    'Mars turns about every two years and two months',
  )
  claim(
    Math.round(mars.minDays) === 60 && Math.round(mars.maxDays) === 81,
    `火星逆行 ${mars.minDays.toFixed(1)}–${mars.maxDays.toFixed(1)} 天`,
    'for 60 to 81 days',
  )
  claim(
    Math.abs(months(jupiter.meanDays) - 4) < 0.25 && Math.abs(months(saturn.meanDays) - 4.5) < 0.25,
    `木星 ${months(jupiter.meanDays).toFixed(2)}、土星 ${months(saturn.meanDays).toFixed(2)} 个月`,
    'Jupiter is retrograde for about four months at a time, Saturn for about four and a half',
  )
  claim(
    [uranus, neptune, pluto].every((s) => Math.abs(months(s.meanDays) - 5) < 0.5),
    '天王星至冥王星约 5 个月',
    'Uranus, Neptune and Pluto for roughly five months each',
  )
  claim(
    [jupiter, saturn, uranus, neptune, pluto].every((s) => s.meanGapDays < 400),
    '外行星约每年一次',
    'Earth laps them about once a year',
  )
  claim(
    Math.round(mercury.shareOfDays * 100) === 19 && Math.round(venus.shareOfDays * 100) === 7,
    `水星 ${(mercury.shareOfDays * 100).toFixed(1)}%、金星 ${(venus.shareOfDays * 100).toFixed(1)}%`,
    'Mercury is retrograde on about 19% of days and Venus on about 7%',
  )
  const outer = [jupiter, saturn, uranus, neptune, pluto].map((s) => s.shareOfDays * 100)
  claim(
    Math.round(Math.min(...outer)) >= 30 && Math.round(Math.max(...outer)) <= 44,
    `外行星 ${outer.map((v) => v.toFixed(1)).join('、')}%`,
    'between about 30% and 44% of days',
  )
  claim(
    anyRetroShare > 0.5,
    `至少一颗行星逆行的日子占 ${(anyRetroShare * 100).toFixed(1)}%`,
    'On most days of the year at least one planet is retrograde',
  )
  claim(
    [uranus, neptune, pluto].every((s) => s.signCrossingShare < 0.5) &&
      mercury.signCrossingShare >= 0.25,
    `跨星座占比：水星 ${(mercury.signCrossingShare * 100).toFixed(0)}%，天王星至冥王星 ${[uranus, neptune, pluto].map((s) => (s.signCrossingShare * 100).toFixed(0)).join('、')}%`,
    'they usually stay in a single sign, while Mercury often crosses back into the previous one',
  )
  // 外行星的逆行居于冲（与太阳相距约 180°），水星、金星居于下合（与太阳相距不远）
  claim(
    [mars, jupiter, saturn, uranus, neptune, pluto].every((s) => s.minElongation > 150) &&
      [mercury, venus].every((s) => s.maxElongation < 30),
    '逆行中点的距日角不符合「冲」与「下合」',
    'that happens around opposition',
  )
  return failures
}

/** 正文写的 Swiss Ephemeris 比对数字与夹具、引擎一致（同 packages/astro/test/retrograde.test.ts） */
export function checkAccuracyClaims(text) {
  const failures = []
  const reference = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const start = Date.UTC(2025, 0, 1)
  const end = Date.UTC(2029, 0, 1)
  const ours = RETROGRADE_PLANETS.flatMap((planet) => planetStations(planet, start, end))
  if (ours.length !== reference.stations.length) return ['停滞数与夹具不同']
  const minutes = {}
  let sameDate = true
  for (const [i, station] of reference.stations.entries()) {
    const engine = ours[i]
    if (engine.planet !== station.planet || engine.kind !== station.kind)
      return [`停滞顺序与夹具不符：${station.planet} ${station.kind} ${station.utc}`]
    const diff = Math.abs(engine.utcMs - Date.parse(station.utc)) / 60_000
    minutes[station.planet] = Math.max(minutes[station.planet] ?? 0, diff)
    if (new Date(engine.utcMs).toISOString().slice(0, 10) !== station.utc.slice(0, 10))
      sameDate = false
  }
  if (!sameDate || !text.includes('Each one fell on the same UTC date in both calculations'))
    failures.push('「全部同一 UTC 日期」与夹具不符')
  if (!text.includes(`all ${ours.length} stations from 2025 through 2028`))
    failures.push('比对次数或区间与夹具不符')
  // 与 packages/astro/test/retrograde.test.ts 的 MAX_MINUTES 保持一致。
  const tolerances = [
    { planets: ['Mercury', 'Venus', 'Mars'], label: 'Mercury, Venus and Mars', limit: 8 },
    { planets: ['Jupiter', 'Saturn'], label: 'Jupiter and Saturn', limit: 15 },
    { planets: ['Uranus'], label: 'Uranus', limit: 20 },
    { planets: ['Neptune', 'Pluto'], label: 'Neptune and Pluto', limit: 45 },
  ]
  for (const { planets, label, limit } of tolerances) {
    const max = Math.max(...planets.map((planet) => minutes[planet.toLowerCase()]))
    if (max > limit || !text.includes(`${limit} minutes for ${label}`))
      failures.push(`${label} 最大偏差 ${max.toFixed(2)} 分钟，正文应注明测试容差 ${limit} 分钟`)
  }
  return failures
}

/** 构建期停滞表：按今天生成的表与已生成的内容集合表都须覆盖今天所在年份、剩余 ≥13 个月 */
export function checkRetrogradeTable(today = new Date().toISOString().slice(0, 10)) {
  const failures = []
  const rows = []
  const fresh = generateRetrogradeBuildData(today)
  try {
    assertRetrogradeCoverage(fresh, today)
    rows.push(`引擎表 ${fresh.years.join('、')}（${fresh.periods.length} 段逆行期）`)
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
      assertRetrogradeCoverage(table, today)
      rows.push(`已生成表（构建日 ${table.buildDate}）列出 ${table.years.join('、')}`)
    } catch (error) {
      failures.push(`已生成的逆行表（构建日 ${table.buildDate}）需要重新生成：${error.message}`)
    }
  }
  return { failures, rows }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { report: { type: 'string' } } })
  const copy = checkRetrogradeCopy()
  const facts = retrogradeFacts()
  const failures = [
    ...copy.failures,
    ...checkRetrogradeFacts(copy.text, facts),
    ...checkAccuracyClaims(copy.text),
  ]
  const table = checkRetrogradeTable()
  failures.push(...table.failures)
  const rows = [
    ...copy.rows,
    ...Object.entries(facts.stats).map(
      ([planet, s]) =>
        `${planet}: ${s.count} 段，${s.minDays.toFixed(1)}–${s.maxDays.toFixed(1)} 天，间隔 ${s.meanGapDays.toFixed(1)} 天，占 ${(s.shareOfDays * 100).toFixed(1)}%，退行 ${s.minArc.toFixed(1)}–${s.maxArc.toFixed(1)}°，跨座 ${(s.signCrossingShare * 100).toFixed(0)}%，距日 ${s.minElongation.toFixed(0)}–${s.maxElongation.toFixed(0)}°`,
    ),
    `至少一颗逆行的日子：${(facts.anyRetroShare * 100).toFixed(1)}%`,
    ...table.rows,
  ]
  if (values.report) writeFileSync(values.report, `${rows.join('\n')}\n`)
  if (failures.length) {
    console.error(`check-content-retrograde：${failures.length} 项不通过\n${failures.join('\n')}`)
    process.exit(1)
  }
  console.log(`check-content-retrograde：通过（${rows.at(-1)}）`)
}
