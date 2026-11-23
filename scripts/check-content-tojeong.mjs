// ko 토정비결（content/tojeong/ko）的内容校验（openspec content-growth-v2-tools 任务 15.1、design 决策 8、16）：
// - 144 个괘 번호（상괘 1–8 × 중괘 1–6 × 하괘 1–3）齐全，没有多余条目，各条目放在对应상괘的文件里；
// - 每段总论不含空格 250–400 字，3 个主题短句齐全，标题互不重复；
// - 合规：합쇼체（不出现해요체、반말结尾）、禁用词（띠별 운세、자기 탐색、判定词等）；
// - 工具页正文 ≥2,000 字并含「계산 방법」与流派差异段；正文中的算例用引擎复算（@xuanxue/bazi/tojeong）。
// 运行：node scripts/check-content-tojeong.mjs [--report <文件>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { tojeongGwae } from '../packages/bazi/src/tojeong.ts'

const ROOT = new URL('../apps/web/content/tojeong/ko/', import.meta.url)
const SUMMARY_RANGE = [250, 400]
const THEME_RANGE = [20, 120]
const THEME_KEYS = ['work', 'people', 'self']
const BODY_MIN = 2000
const BANNED = [
  '띠별 운세',
  '자기 탐색',
  '신년운세',
  '오락',
  '재미로',
  '길일',
  '대길',
  '대흉',
  '횡재',
  '손재수',
  '재물운',
  '액운',
  '운명',
  '투자',
  '주식',
  '부동산',
  '수술',
  '질병',
  // 关系判定词（apps/web/scripts/audit-verdict.mjs 的 ko 表）
  '결혼하면 안',
  '결혼해야',
  '이혼수',
  '이혼하게 됩',
  '상극이라 헤어',
  '헤어질 운명',
]
/** 不预测具体月日：解读中不出现月份、季节与时段 */
const TIMING =
  /(?:^|[^0-9])(?:1[0-2]|[1-9])월|정월|동짓달|섣달|(?<![가-힣])(?:봄|여름|가을|겨울)|상반기|하반기|연초|연말/u
/** 합쇼체：句末不出现해요체与반말 */
const INFORMAL = /(?:요|죠|네|다|야|지|어|아)[.!?]?$/u
const FORMAL = /(?:니다|니까|십시오|습니까|ㅂ시다|읍시다)[.!?]?$/u

const nonSpace = (text) => text.replace(/\s/g, '').length
const sentences = (text) =>
  text
    .split(/(?<=[.!?])\s+/u)
    .map((item) => item.trim())
    .filter(Boolean)

export function expectedGwae() {
  const numbers = []
  for (let sang = 1; sang <= 8; sang++)
    for (let jung = 1; jung <= 6; jung++)
      for (let ha = 1; ha <= 3; ha++) numbers.push(String(sang * 100 + jung * 10 + ha))
  return numbers
}

export function checkEntries(files) {
  const errors = []
  const seen = new Map()
  const titles = new Map()
  for (const [name, entries] of Object.entries(files)) {
    const sang = Number(name.replace(/\.json$/, ''))
    for (const [key, entry] of Object.entries(entries)) {
      if (Math.floor(Number(key) / 100) !== sang) errors.push(`${key}: 不在 ${name}`)
      if (seen.has(key)) errors.push(`${key}: 重复（${seen.get(key)} 与 ${name}）`)
      seen.set(key, name)
      const summary = entry?.summary ?? ''
      const length = nonSpace(summary)
      if (length < SUMMARY_RANGE[0] || length > SUMMARY_RANGE[1])
        errors.push(`${key}: 总论 ${length} 字，应在 ${SUMMARY_RANGE.join('–')}`)
      const title = entry?.title?.trim() ?? ''
      if (!title) errors.push(`${key}: 缺少标题`)
      else if (titles.has(title))
        errors.push(`${key}: 标题与 ${titles.get(title)} 重复「${title}」`)
      titles.set(title, key)
      const texts = [summary]
      for (const theme of THEME_KEYS) {
        const text = entry?.themes?.[theme] ?? ''
        const themeLength = nonSpace(text)
        if (themeLength < THEME_RANGE[0] || themeLength > THEME_RANGE[1])
          errors.push(`${key}: 主题 ${theme} ${themeLength} 字，应在 ${THEME_RANGE.join('–')}`)
        texts.push(text)
      }
      for (const text of [title, ...texts]) {
        const word = BANNED.find((item) => text.includes(item))
        if (word) errors.push(`${key}: 含禁用词「${word}」`)
        const timing = TIMING.exec(text)
        if (timing) errors.push(`${key}: 含具体时段「${timing[0].trim()}」`)
      }
      for (const text of texts)
        for (const sentence of sentences(text))
          if (!FORMAL.test(sentence) && INFORMAL.test(sentence))
            errors.push(`${key}: 非합쇼체句末「${sentence.slice(-12)}」`)
    }
  }
  const expected = expectedGwae()
  const missing = expected.filter((key) => !seen.has(key))
  const extra = [...seen.keys()].filter((key) => !expected.includes(key))
  if (missing.length) errors.push(`缺少괘 번호：${missing.join(', ')}`)
  if (extra.length) errors.push(`多余괘 번호：${extra.join(', ')}`)
  return { errors, count: seen.size }
}

/** 工具页正文：长度、必备小节、禁用词，以及算例「양력 Y년 M월 D일 … N번」用引擎复算 */
export function checkToolPage(source) {
  const errors = []
  const body = source.replace(/^---[\s\S]*?---/, '')
  const plain = body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*|>-]/g, '')
  const length = nonSpace(plain)
  if (length < BODY_MIN) errors.push(`工具页正文 ${length} 字，少于 ${BODY_MIN}`)
  for (const heading of ['## 계산 방법', '## 유파와 사이트마다 결과가 다른 이유'])
    if (!body.includes(heading)) errors.push(`工具页缺少小节「${heading}」`)
  const word = BANNED.find((item) => source.includes(item))
  if (word) errors.push(`工具页含禁用词「${word}」`)
  const example =
    /양력 (\d{4})년 (\d{1,2})월 (\d{1,2})일에 태어나신[\s\S]*?(\d{4})년 괘는 (\d{3})번/u.exec(body)
  if (!example) errors.push('工具页缺少可复算的算例')
  else {
    const [, year, month, day, target, gwae] = example.map(Number)
    const result = tojeongGwae({ birth: { year, month, day }, calendar: 'solar' }, target)
    if (result.gwae !== gwae) errors.push(`算例괘 번호 ${gwae} 与引擎 ${result.gwae} 不符`)
    const lunar = `음력 ${result.birthLunar.year}년 ${result.birthLunar.month}월 ${result.birthLunar.day}일생`
    const facts = [
      lunar,
      `세는 나이는 ${result.countingAge}세`,
      `태세수는 정(丁) 6과 미(未) 8을 더한 ${result.taeseNumber}`,
      `월건수가 ${result.wolgeonNumber}`,
      `일진수는 ${result.iljinNumber}`,
      `${result.monthDays === 30 ? '30일까지 있는 큰달' : '29일까지 있는 작은달'}`,
    ]
    for (const fact of facts)
      if (!body.includes(fact)) errors.push(`算例与引擎不符：缺少「${fact}」`)
  }
  return { errors, length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { report: { type: 'string' } } })
  const gwaeDir = new URL('gwae/', ROOT)
  const files = Object.fromEntries(
    readdirSync(gwaeDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => [name, JSON.parse(readFileSync(new URL(name, gwaeDir), 'utf8'))]),
  )
  const entries = checkEntries(files)
  const page = checkToolPage(readFileSync(new URL('index.mdx', ROOT), 'utf8'))
  const errors = [...entries.errors, ...page.errors]
  const lengths = Object.values(files)
    .flatMap((file) => Object.values(file))
    .map((entry) => nonSpace(entry.summary))
  const report = [
    `괘 条目：${entries.count}/144`,
    `总论字数（不含空格）：最少 ${Math.min(...lengths)}，最多 ${Math.max(...lengths)}`,
    `工具页正文字数（不含空格）：${page.length}`,
    errors.length ? `问题 ${errors.length} 项：\n${errors.join('\n')}` : '问题 0 项',
  ].join('\n')
  if (values.report) writeFileSync(values.report, `${report}\n`)
  console.log(report)
  if (errors.length) process.exit(1)
}
