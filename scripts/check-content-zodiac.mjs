// 生肖集合（content/zodiac）的内容校验（openspec content-growth-phase2 任务 4.2、design 决策 4、11、13、14）：
// frontmatter 字段、TDK 宽度、篇幅下限、正文内链、婚配类禁用词与合规措辞，
// 以及正文中写到的干支、纳音、立春时刻与春节日期逐项用引擎复算（@xuanxue/bazi/almanac）。
// 运行：node scripts/check-content-zodiac.mjs [--report <文件>]
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { zodiacYears } from '../packages/bazi/src/almanac.ts'
import { BRANCHES } from '../packages/bazi/src/constants.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const baziRequire = createRequire(new URL('../packages/bazi/package.json', import.meta.url))
const { parseDocument } = coreRequire('yaml')
const { SixtyCycle } = baziRequire('tyme4ts')

const ROOT = new URL('../apps/web/content/zodiac/', import.meta.url)
const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'

/** 各语言的地址、篇幅与固定小标题。ko（第 5 组）补登自己的一行。 */
const LOCALES = {
  'zh-Hans': {
    prefix: '/zh-hans',
    hubPath: '/生肖',
    childSlug: (branch) => `属${'鼠牛虎兔龙蛇马羊猴鸡狗猪'[BRANCHES.indexOf(branch)]}`,
    brandSuffix: '｜干支日',
    childMin: 1500,
    hubMin: 1000,
    childHeadings: ['六合、三合、冲、刑、害', '性格与做事方式', '职业与学习主题'],
    hubHeadings: ['十二生肖总表', '立春换年与春节换年', '三合、六合与六冲'],
    // 正文只链接这些目标（东方站已存在的可索引页）
    linkTargets: [
      '/八字排盘',
      '/生肖',
      '/八字/五行',
      '/八字/大运',
      '/八字/十神',
      '/八字/喜用神',
      '/八字/身强身弱',
      '/八字/神煞',
      '/八字/空亡',
      '/八字/八字重量',
    ],
    countUnit: /\p{Script=Han}/gu,
  },
}

/** 婚配类禁用词（design「约束」）：全文为 0，不只 Title/H1/H2/FAQ/锚文本 */
export const MARRIAGE_TERMS = ['婚配', '配对', '合婚', '结婚', '婚嫁', '嫁娶吉日', '궁합']
/** 合规措辞（design 决策 14）：不提 AI、不用「娱乐」定位、不给吉日结论 */
const COMPLIANCE_TERMS = ['AI', '人工智能', '娱乐', '吉日', '大吉', '大凶', '一定会', '注定']

const ANNUAL_MIN = 120
const ANNUAL_MAX = 200

function cjkWidth(text) {
  let width = 0
  for (const char of text) width += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/u.test(char) ? 1 : 0.5
  return width
}

const ganzhiOfYear = (year) => {
  const cycle = SixtyCycle.fromIndex(year - 1924)
  return `${STEM_HANZI[cycle.getHeavenStem().getIndex()]}${BRANCH_HANZI[cycle.getEarthBranch().getIndex()]}`
}
const nayinOf = (ganzhi) => {
  const index = [...Array(60).keys()].find(
    (i) =>
      `${STEM_HANZI[SixtyCycle.fromIndex(i).getHeavenStem().getIndex()]}${BRANCH_HANZI[SixtyCycle.fromIndex(i).getEarthBranch().getIndex()]}` ===
      ganzhi,
  )
  return index === undefined ? undefined : SixtyCycle.fromIndex(index).getSound().getName()
}
const NAYIN_NAMES = new Set(
  [...Array(60).keys()].map((i) => SixtyCycle.fromIndex(i).getSound().getName()),
)

/** 1924–2043 每年的立春（北京时间）与春节 */
const YEAR_FACTS = new Map(
  BRANCHES.flatMap((branch) => zodiacYears(branch).map((row) => [row.year, row])),
)

const GZ = `[${STEM_HANZI}][${BRANCH_HANZI}]`
const NUM = '(\\d{1,2})'

/** 正文中写到的事实逐项复算；返回不一致的描述 */
export function factIssues(text) {
  const issues = []
  let checked = 0
  // 「1990 年庚午」「1990年（庚午）」
  for (const match of text.matchAll(new RegExp(`(\\d{4}) ?年[（(]?(${GZ})`, 'g'))) {
    const year = Number(match[1])
    if (year < 1924 || year > 2043) continue
    checked++
    if (ganzhiOfYear(year) !== match[2])
      issues.push(`${match[0]}：${year} 年应为 ${ganzhiOfYear(year)}`)
  }
  // 「庚午年」「庚午是路旁土」「庚午年纳音路旁土」：干支之后 8 字内出现的纳音名
  for (const match of text.matchAll(new RegExp(GZ, 'g'))) {
    const after = text.slice(match.index + 2, match.index + 13).split(/[。；，、\n]/)[0] ?? ''
    // 只取紧随其后、中间没有另一个干支的第一个纳音名
    const next = after.search(new RegExp(GZ))
    const window = next < 0 ? after : after.slice(0, next)
    const name = [...NAYIN_NAMES].find((candidate) => window.includes(candidate))
    if (!name) continue
    checked++
    if (nayinOf(match[0]) !== name)
      issues.push(`${match[0]}…${name}：${match[0]} 的纳音应为 ${nayinOf(match[0])}`)
  }
  // 「2026 年立春在 2 月 4 日 04:02」「2026 年的立春是 2 月 4 日」
  for (const match of text.matchAll(
    new RegExp(
      `(\\d{4}) ?年的?立春(?:时刻)?(?:在|是|为|落在)? ?${NUM} ?月 ?${NUM} ?日(?: ?(\\d{1,2}):(\\d{2}))?`,
      'g',
    ),
  )) {
    const row = YEAR_FACTS.get(Number(match[1]))
    if (!row) continue
    checked++
    const { month, day, hour, minute } = row.lichun
    if (Number(match[2]) !== month || Number(match[3]) !== day)
      issues.push(`${match[0]}：立春应为 ${month} 月 ${day} 日`)
    if (match[4] !== undefined && (Number(match[4]) !== hour || Number(match[5]) !== minute))
      issues.push(
        `${match[0]}：立春时刻应为 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      )
  }
  // 「2026 年春节是 2 月 17 日」「2026 年的春节在 2 月 17 日」
  for (const match of text.matchAll(
    new RegExp(`(\\d{4}) ?年的?春节(?:在|是|为|落在)? ?${NUM} ?月 ?${NUM} ?日`, 'g'),
  )) {
    const row = YEAR_FACTS.get(Number(match[1]))
    if (!row) continue
    checked++
    const { month, day } = row.lunarNewYear
    if (Number(match[2]) !== month || Number(match[3]) !== day)
      issues.push(`${match[0]}：春节应为 ${month} 月 ${day} 日`)
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
  if (!existsSync(dir)) return { failures, rows }
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
    const branch = hub ? null : file.replace(/\.mdx$/, '')
    const required = hub
      ? ['title', 'heading', 'description', 'slug', 'locale', 'lede', 'faq', 'updated']
      : [
          'title',
          'heading',
          'description',
          'slug',
          'locale',
          'branch',
          'lede',
          'years_note',
          'relations_note',
          'annual',
          'faq',
          'updated',
        ]
    const extra = Object.keys(data).filter((key) => !required.includes(key))
    const missing = required.filter((key) => data[key] === undefined)
    if (extra.length) fail(`多余字段：${extra.join('、')}`)
    if (missing.length) fail(`缺少字段：${missing.join('、')}`)
    if (data.locale !== locale) fail(`locale 应为 ${locale}`)
    if (!hub && !BRANCHES.includes(branch)) fail(`文件名应为地支 key：${branch}`)
    if (!hub && data.branch !== branch) fail('branch 与文件名不一致')
    const slug = hub ? spec.hubPath.slice(1) : spec.childSlug(branch)
    if (data.slug !== slug) fail(`slug 应为 ${slug}`)
    if (!hub && !String(data.heading ?? '').startsWith(slug)) fail(`H1 应以「${slug}」开头`)
    if (!hub && !String(data.title ?? '').startsWith(slug)) fail(`Title 应以「${slug}」开头`)

    const titleWidth = cjkWidth(`${data.title}${spec.brandSuffix}`)
    const descriptionWidth = cjkWidth(String(data.description ?? ''))
    if (titleWidth < 20 || titleWidth > 30) fail(`Title 宽度 ${titleWidth}（含站名后缀，须 20–30）`)
    if (descriptionWidth < 70 || descriptionWidth > 80)
      fail(`Description 宽度 ${descriptionWidth}（须 70–80）`)
    for (const key of ['title', 'description', 'heading']) {
      const previous = seen[key].get(data[key])
      if (previous) fail(`${key} 与 ${previous} 重复`)
      seen[key].set(data[key], file)
    }

    const faq = Array.isArray(data.faq) ? data.faq : []
    if (faq.length < 3 || faq.length > 4) fail(`FAQ 须 3–4 问，现为 ${faq.length}`)
    for (const item of faq) if (!item?.q?.trim() || !item?.a?.trim()) fail('FAQ 每项须有 q 与 a')

    const sections = bodySections(content)
    const headings = sections.map((section) => section.title)
    const fixed = hub ? spec.hubHeadings : spec.childHeadings
    if (hub) {
      const absent = fixed.filter((title) => !headings.includes(title))
      if (absent.length) fail(`缺少小标题：${absent.join('、')}`)
    } else if (JSON.stringify(headings) !== JSON.stringify(fixed))
      fail(`正文小标题须依次为：${fixed.join(' / ')}（现为 ${headings.join(' / ')}）`)

    const annual = hub ? {} : (data.annual ?? {})
    for (const [ganzhi, text] of Object.entries(annual)) {
      if (!new RegExp(`^${GZ}$`).test(ganzhi)) fail(`annual 键须为干支：${ganzhi}`)
      const count = (String(text).match(spec.countUnit) ?? []).length
      if (count < ANNUAL_MIN || count > ANNUAL_MAX)
        fail(`annual.${ganzhi} ${count} 字（须 ${ANNUAL_MIN}–${ANNUAL_MAX}）`)
    }

    // 篇幅：本页撰写的正文（导语、各段说明、正文、流年），不含 FAQ、表格与组件模板句
    const authored = [
      data.lede,
      data.years_note,
      data.relations_note,
      ...Object.values(annual),
      plain(content),
    ]
      .filter(Boolean)
      .join('\n')
    const count = (authored.match(spec.countUnit) ?? []).length
    const min = hub ? spec.hubMin : spec.childMin
    if (count < min) fail(`撰写正文 ${count} 字，少于 ${min}`)

    // 正文内链：只链接已存在的可索引页，2–5 个不同目标（枢纽页另由总表链接 12 个子页）
    const links = [...content.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
    const prefixed = (path) => `${spec.prefix}${path}`
    const allowed = new Set([
      ...spec.linkTargets.map(prefixed),
      ...BRANCHES.map((b) => prefixed(`${spec.hubPath}/${spec.childSlug(b)}`)),
    ])
    for (const href of links) {
      if (!allowed.has(href)) fail(`正文链接目标不在允许清单：${href}`)
      if (href === prefixed(`${spec.hubPath}/${slug}`)) fail(`链接到本页：${href}`)
    }
    const targets = new Set(links).size
    if (!hub && (targets < 2 || targets > 5)) fail(`正文内链 ${targets} 个不同目标（须 2–5）`)

    const everything = [
      data.title,
      data.heading,
      data.description,
      data.lede,
      data.years_note,
      data.relations_note,
      ...Object.values(annual),
      ...faq.flatMap((item) => [item.q, item.a]),
      content,
    ].join('\n')
    for (const term of MARRIAGE_TERMS) if (everything.includes(term)) fail(`婚配类禁用词：${term}`)
    for (const term of COMPLIANCE_TERMS)
      if (new RegExp(term === 'AI' ? '\\bAI\\b' : term).test(everything))
        fail(`合规禁用词：${term}`)

    const facts = factIssues(everything)
    factsChecked += facts.checked
    for (const issue of facts.issues) fail(`事实不一致：${issue}`)

    rows.push({
      file,
      title: data.title,
      titleWidth,
      description: data.description,
      descriptionWidth,
      heading: data.heading,
      chars: count,
      links: targets,
      facts: facts.checked,
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
    total += result.factsChecked ?? 0
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
    assert.fail(`生肖内容校验失败 ${failures.length} 项`)
  }
  console.log(`生肖内容校验通过（复算事实 ${total} 处）`)
}
