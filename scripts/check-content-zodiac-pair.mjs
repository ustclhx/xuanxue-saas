// 生肖配对集合（content/zodiac-pair）的内容校验（openspec content-growth-v2-tools 任务 16.1、16.2，
// design 决策 9、14、15、16）：frontmatter、TDK 宽度、篇幅下限、固定小标题、正文内链、判定词与合规措辞，
// 以及正文中写到的地支关系、五行生克、合化、三合局与年份干支逐项用引擎复算（@xuanxue/bazi/almanac）。
// ko、en（第 17 组）各自另写，按本语言的主词、TDK 区间、篇幅单位、判定词与合规词校验，并核对正文锚文本。
// 运行：node scripts/check-content-zodiac-pair.mjs [--report <文件>]
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { zodiacPairFacts } from '../packages/bazi/src/almanac.ts'
import { BRANCHES } from '../packages/bazi/src/constants.ts'
import { factIssuesEn, koFactIssues } from './check-content-yearly.mjs'
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
    titlePrefix: (slug) => slug,
    measure: cjkWidth,
    titleRange: [20, 30],
    descriptionRange: [70, 80],
    anchors: null,
    terms: () => zhTermIssues,
    facts: (text) => {
      const years = factIssues(text)
      const pairs = pairFactIssues(text)
      return { issues: [...years.issues, ...pairs.issues], checked: years.checked + pairs.checked }
    },
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

function zhTermIssues(text) {
  const issues = []
  for (const term of VERDICT_TERMS) if (text.includes(term)) issues.push(`判定词：${term}`)
  for (const term of COMPLIANCE_TERMS)
    if (new RegExp(term === 'AI' ? '\\bAI\\b' : term).test(text))
      issues.push(`合规或贬损禁用词：${term}`)
  return issues
}

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

// ---------------------------------------------------------------------------
// ko（띠궁합）与根路径英文（Chinese zodiac compatibility），第 17 组：按本语言搜索词另写，不由 zh-Hans 翻译
// ---------------------------------------------------------------------------

const ANIMAL_KO = [
  '쥐',
  '소',
  '호랑이',
  '토끼',
  '용',
  '뱀',
  '말',
  '양',
  '원숭이',
  '닭',
  '개',
  '돼지',
]
const ANIMAL_EN = [
  'Rat',
  'Ox',
  'Tiger',
  'Rabbit',
  'Dragon',
  'Snake',
  'Horse',
  'Goat',
  'Monkey',
  'Rooster',
  'Dog',
  'Pig',
]
const koSign = (branch) => `${ANIMAL_KO[BRANCHES.indexOf(branch)]}띠`
const enSign = (branch) => ANIMAL_EN[BRANCHES.indexOf(branch)]

/** 원진（怨嗔）：韩国띠궁합常见的传统说法，引擎不计算；只允许在这六组配对页（与总表）提到 */
const WONJIN = ['zi-wei', 'chou-wu', 'yin-you', 'mao-shen', 'chen-hai', 'si-xu']

/** 合规与判定检查：`verdict`、`compliance` 为子串（`AI` 按词边界），`patterns` 为正则；返回问题列表 */
const termChecker =
  ({ verdict, compliance, patterns = [] }) =>
  (text) => {
    const issues = []
    for (const term of verdict) if (text.includes(term)) issues.push(`判定词：${term}`)
    for (const term of compliance)
      if (new RegExp(term === 'AI' ? '\\bAI\\b' : term, 'u').test(text))
        issues.push(`合规或贬损禁用词：${term}`)
    for (const [re, label] of patterns) {
      const hit = re.exec(text)
      if (hit) issues.push(`${label}：${hit[0]}`)
    }
    return issues
  }

const KO_VERDICT = [
  // apps/web/scripts/audit-verdict.mjs 的 ko 词表
  '결혼하면 안',
  '결혼해야',
  '이혼수',
  '이혼하게 됩',
  '상극이라 헤어',
  '헤어질 운명',
  '최고의 혼인 상대',
  '남편을 해치는',
  '아내를 해치는',
  // 띠궁합常见的判定写法
  '궁합이 좋',
  '궁합이 나쁘',
  '궁합이 안 좋',
  '궁합이 맞',
  '궁합이 안 맞',
  '좋은 궁합',
  '나쁜 궁합',
  '최고의 궁합',
  '최악의 궁합',
  '찰떡궁합',
  '천생연분',
  '잘 맞는 띠',
  '안 맞는 띠',
  '맞지 않는 띠',
  '상극인 띠',
  '띠 상극',
  '상극 궁합',
  '이혼',
  '헤어지게',
  '헤어질 수밖에',
  '결혼 상대로',
  '피해야 할 띠',
  '피해야 하는 띠',
]
const KO_COMPLIANCE = [
  'AI',
  '인공지능',
  '오락',
  '재미로',
  '길일',
  '길흉',
  '대길',
  '대흉',
  '반드시',
  '무조건',
  '운명',
  '액운',
  '재앙',
  '불운',
  '행운',
  '운세',
  '자기 탐색',
  '자아 탐색',
  '부적',
  '개운',
  '액막이',
  '살풀이',
  '원진살',
  '태세',
  '삼재',
  // 对生肖整体的贬损描述
  '이기적',
  '게으른',
  '게으르',
  '탐욕',
  '인색',
  '교활',
  '위선',
  '성질이 급',
  '어리석',
  '단명',
  '재수 없',
  '최악',
  '불리하',
  '불리한',
  '흉하',
  '흉한',
  '악연',
]

/** ko 事实：干支读音与汉字、「1984년 갑자(甲子)」、关系名「자오충(子午沖)」「子午沖」（第 10 组的 koFactIssues）与 원진 */
function koPairFacts(text, page) {
  const result = koFactIssues(text, { year: 2027, branch: undefined })
  const issues = [...result.issues]
  let checked = result.checked
  if (!page.hub && /원진/u.test(text)) {
    checked++
    if (!WONJIN.includes(`${page.a}-${page.b}`))
      issues.push(
        `원진：${page.a}-${page.b} 不是 원진 六组之一（子未、丑午、寅酉、卯申、辰亥、巳戌）`,
      )
  }
  return { issues, checked }
}

LOCALES.ko = {
  prefix: '/ko',
  hubPath: '/띠궁합',
  pairSlug: (a, b) => `${koSign(a)}-${koSign(b)}`,
  /** 主词「쥐띠 소띠 궁합」；同띠写「쥐띠끼리 궁합」（design 决策 13：띠궁합、쥐띠 소띠 궁합） */
  titlePrefix: (_slug, a, b) =>
    a === b ? `${koSign(a)}끼리 궁합` : `${koSign(a)} ${koSign(b)} 궁합`,
  hubPrefix: '띠궁합',
  brandSuffix: ' | 간지데이',
  measure: cjkWidth,
  titleRange: [20, 30],
  descriptionRange: [70, 80],
  pairMin: 1000,
  hubMin: 1000,
  countLabel: '字（不含空格）',
  pairHeadings: [
    '두 지지의 관계',
    '함께 지낼 때의 리듬',
    '서로에게서 배울 점',
    '맞춰 가야 할 부분',
    '사주로 두 사람 보기',
  ],
  hubHeadings: ['띠궁합 표 읽는 법', '합과 충의 유래', '사주로 두 사람 보기'],
  linkTargets: (path) =>
    /^\/ko\/띠궁합\/[가-힣]+띠-[가-힣]+띠$/u.test(path) ||
    /^\/ko\/띠\/[가-힣]+띠$/u.test(path) ||
    ['/ko/띠', '/ko/만세력', '/ko/사주궁합'].includes(path),
  anchors: (path) => {
    const pair = path.match(/^\/ko\/띠궁합\/([가-힣]+)띠-([가-힣]+)띠$/u)
    if (pair)
      return pair[1] === pair[2]
        ? [`${pair[1]}띠끼리 궁합`, `${pair[1]}띠와 ${pair[2]}띠`]
        : [`${pair[1]}띠 ${pair[2]}띠 궁합`, `${pair[1]}띠와 ${pair[2]}띠`]
    const sign = path.match(/^\/ko\/띠\/([가-힣]+)띠$/u)
    if (sign) return [`${sign[1]}띠`, `${sign[1]}띠 나이`]
    if (path === '/ko/띠') return ['띠', '열두 띠']
    if (path === '/ko/만세력') return ['무료 만세력', '만세력']
    if (path === '/ko/사주궁합') return ['사주궁합', '무료 사주궁합']
    return null
  },
  countUnit: /\S/gu,
  terms: () => termChecker({ verdict: KO_VERDICT, compliance: KO_COMPLIANCE }),
  facts: koPairFacts,
}

const EN_VERDICT = [
  [/\b(?:in)?compatible\b/i, '判定词（compatible）'],
  [
    /\b(?:best|worst|perfect|ideal|good|bad|great|poor) (?:match|pair|pairing|couple)(?:es|s)?\b/i,
    '判定词',
  ],
  [/\bsoul ?mates?\b|\bmeant to be\b|\bmatch made in heaven\b|\bmade for each other\b/i, '判定词'],
  [/\bshould(?:n't| not)? (?:marry|date|be together|avoid)\b/i, '判定词'],
  [/\b(?:must|cannot|can't) (?:marry|be together)\b/i, '判定词'],
  [/\bwill (?:divorce|break up|split up|get divorced|fight)\b/i, '判定词'],
  [/\bdivorce\b/i, '判定词（divorce）'],
  [/\bdoomed\b|\bdestined\b|\bfated\b/i, '判定词'],
  [/\bbrings? misfortune\b/i, '判定词'],
]
const EN_BANNED = [
  [/\bAI\b|artificial intelligence/, 'AI'],
  [/\bentertainment\b|\bfor fun\b/i, '娱乐定位'],
  [/\b(?:un)?lucky\b|\b(?:in)?auspicious\b|\bgood luck\b|\bbad luck\b/i, '吉凶'],
  [/\bfortunes?\b|\bhoroscopes?\b/i, '运势'],
  [/\bdestiny\b/i, '决定论'],
  [/\bdisasters?\b|\bmisfortunes?\b|\bcurses?\b/i, '灾厄'],
  [/\bremed(?:y|ies)\b|\bcures?\b|\bamulets?\b|\btalismans?\b|\blucky charms?\b/i, '化解'],
  [/\bwill happen\b|\bwill bring\b|\bguarantee/i, '预测'],
  [/self-exploration/i, '自我探索'],
  [/\bTai Sui\b/i, '太岁（不在配对页范围）'],
  [
    /\b(?:selfish|lazy|greedy|stingy|cunning|deceitful|hot-tempered|stupid|arrogant|cold-hearted)\b/i,
    '贬损描述',
  ],
  [/\b(?:worst|enemy|enemies|nemesis)\b/i, '贬损描述'],
]
function enTerms(text) {
  // 链接地址与术语表锚点「Four Pillars of Destiny calculator」不计
  const plainText = text.replace(/\]\([^)]*\)/g, ']').replace(/Four Pillars of Destiny/g, '')
  return termChecker({ verdict: [], compliance: [], patterns: [...EN_VERDICT, ...EN_BANNED] })(
    plainText,
  )
}

const capitalized = (slug) => `${slug[0].toUpperCase()}${slug.slice(1)}`

LOCALES.en = {
  prefix: '',
  hubPath: '/chinese-zodiac-compatibility',
  pairSlug: (a, b) => `${enSign(a).toLowerCase()}-and-${enSign(b).toLowerCase()}`,
  /** 主词「Rat and Ox Compatibility」（design 决策 13：chinese zodiac compatibility、rat and ox compatibility） */
  titlePrefix: (_slug, a, b) => `${enSign(a)} and ${enSign(b)} Compatibility`,
  hubPrefix: 'Chinese Zodiac Compatibility',
  brandSuffix: ' | Ganjiday',
  measure: (text) => [...text].length,
  titleRange: [40, 60],
  descriptionRange: [140, 160],
  pairMin: 800,
  hubMin: 700,
  countLabel: '词',
  pairHeadings: [
    'How the two branches relate',
    'Pace and rhythm together',
    'What each can learn from the other',
    'Where friction tends to show up',
    'Reading two full BaZi charts',
  ],
  hubHeadings: [
    'How to read the compatibility chart',
    'Where harmony and clash come from',
    'Reading two full BaZi charts',
  ],
  linkTargets: (path) =>
    /^\/chinese-zodiac-compatibility\/[a-z]+-and-[a-z]+$/.test(path) ||
    /^\/chinese-zodiac-2027\/[a-z]+$/.test(path) ||
    ['/chinese-zodiac', '/chinese-zodiac-2027', '/bazi-calculator', '/bazi-compatibility'].includes(
      path,
    ),
  anchors: (path) => {
    const pair = path.match(/^\/chinese-zodiac-compatibility\/([a-z]+)-and-([a-z]+)$/)
    if (pair) {
      const names = `${capitalized(pair[1])} and ${capitalized(pair[2])}`
      return [`${names} compatibility`, names]
    }
    const child = path.match(/^\/chinese-zodiac-2027\/([a-z]+)$/)
    if (child)
      return [`${capitalized(child[1])} in 2027`, `Year of the ${capitalized(child[1])} 2027`]
    if (path === '/chinese-zodiac-2027') return ['Year of the Goat 2027', 'Chinese zodiac 2027']
    if (path === '/chinese-zodiac') return ['Chinese zodiac', 'Chinese zodiac years']
    if (path === '/bazi-calculator')
      return ['BaZi calculator', 'Four Pillars of Destiny calculator']
    if (path === '/bazi-compatibility') return ['BaZi compatibility', 'BaZi chart compatibility']
    return null
  },
  countUnit: /\b[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu,
  terms: () => enTerms,
  facts: (text) => factIssuesEn(text, { year: 2027, branch: undefined }),
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
    const prefix = hub ? (spec.hubPrefix ?? slug) : spec.titlePrefix(slug, a, b)
    if (!String(data.heading ?? '').startsWith(prefix)) fail(`H1 应以「${prefix}」开头`)
    if (!String(data.title ?? '').startsWith(prefix)) fail(`Title 应以「${prefix}」开头`)

    const titleWidth = spec.measure(`${data.title}${spec.brandSuffix}`)
    const descriptionWidth = spec.measure(String(data.description ?? ''))
    const [titleMin, titleMax] = spec.titleRange
    const [descriptionMin, descriptionMax] = spec.descriptionRange
    if (titleWidth < titleMin || titleWidth > titleMax)
      fail(`Title 长度 ${titleWidth}（含站名后缀，须 ${titleMin}–${titleMax}）`)
    if (descriptionWidth < descriptionMin || descriptionWidth > descriptionMax)
      fail(`Description 长度 ${descriptionWidth}（须 ${descriptionMin}–${descriptionMax}）`)
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
    if (count < min) fail(`撰写正文 ${count} ${spec.countLabel ?? '字'}，少于 ${min}`)

    // 正文内链：只链接已存在的可索引页，2–5 个不同目标，不链接本页；ko、en 另核对锚文本（每个目标 ≤2 种写法）
    const linkMatches = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
    const links = linkMatches.map((m) => m[2])
    const self = `${spec.prefix}${spec.hubPath}${hub ? '' : `/${slug}`}`
    for (const [, anchor, href] of linkMatches) {
      if (!spec.linkTargets(href)) fail(`正文链接目标不在允许清单：${href}`)
      if (href === self) fail(`链接到本页：${href}`)
      const allowed = spec.anchors?.(href)
      if (allowed && !allowed.some((text) => text.toLowerCase() === anchor.toLowerCase()))
        fail(`锚文本「${anchor}」不在 ${href} 的允许写法：${allowed.join(' / ')}`)
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
    for (const issue of spec.terms()(everything, { hub, a, b })) fail(issue)

    const facts = spec.facts(everything, { hub, a, b })
    factsChecked += facts.checked
    for (const issue of facts.issues) fail(`事实不一致：${issue}`)

    rows.push({
      file,
      title: data.title,
      titleWidth,
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
