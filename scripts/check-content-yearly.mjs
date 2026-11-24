// 年度生肖集合（content/yearly）的内容校验（openspec content-growth-v2-tools 任务 8.1、design 决策 6、13、15、16）：
// frontmatter 字段、TDK 宽度、篇幅下限、固定小标题、正文内链与锚文本、合规措辞（不写月份吉凶、不给断语），
// 以及正文与 frontmatter 中写到的干支、纳音、立春与春节日期、地支关系名、太岁关系逐项用引擎复算
// （@xuanxue/bazi/almanac 的 zodiacYearFacts、zodiacPairFacts、zodiacYears、zodiacBoundaries）。
// 第 9、10、11 组在 LOCALES 中补登自己的一行（关系名与太岁写法按该语言另加解析；zh-Hant 先逐字归一到简体写法再复算）。
// en（第 11 组）另校验 `/chinese-zodiac` 生肖枢纽（content/zodiac/en/index.mdx）。
// 运行：node scripts/check-content-yearly.mjs [--report <文件>]
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import {
  lunarNewYearAt,
  zodiacBoundaries,
  zodiacPairFacts,
  zodiacYearFacts,
} from '../packages/bazi/src/almanac.ts'
import { BRANCHES } from '../packages/bazi/src/constants.ts'

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url))
const coreRequire = createRequire(webRequire.resolve('@content-collections/core/package.json'))
const baziRequire = createRequire(new URL('../packages/bazi/package.json', import.meta.url))
const { parseDocument } = coreRequire('yaml')
const { SixtyCycle } = baziRequire('tyme4ts')

const ROOT = new URL('../apps/web/content/yearly/', import.meta.url)
const STEM_HANZI = '甲乙丙丁戊己庚辛壬癸'
const BRANCH_HANZI = '子丑寅卯辰巳午未申酉戌亥'
const ANIMAL_HANS = '鼠牛虎兔龙蛇马羊猴鸡狗猪'
const ANIMAL_HANT = '鼠牛虎兔龍蛇馬羊猴雞狗豬'
const FOCUS = ['work', 'relationships', 'self']
const STEM_HANGUL = '갑을병정무기경신임계'
const BRANCH_HANGUL = '자축인묘진사오미신유술해'
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
const NAYIN_KO = [
  '해중금',
  '노중화',
  '대림목',
  '노방토',
  '검봉금',
  '산두화',
  '간하수',
  '성두토',
  '백랍금',
  '양류목',
  '천중수',
  '옥상토',
  '벽력화',
  '송백목',
  '장류수',
  '사중금',
  '산하화',
  '평지목',
  '벽상토',
  '금박금',
  '복등화',
  '천하수',
  '대역토',
  '차천금',
  '상자목',
  '대계수',
  '사중토',
  '천상화',
  '석류목',
  '대해수',
]

/**
 * 各语言的地址、篇幅、固定小标题与允许的正文链接。
 * `yearlyTool` 是个人年度工具的预定地址（第 7 组）：工具未登记时页面把链接还原为文字（page.functions.ts），
 * 这里仍按正文内链计数。
 */
const LOCALES = {
  'zh-Hans': {
    prefix: '/zh-hans',
    hubPath: (year) => `/${year}生肖运势`,
    childSlug: (branch) => `属${ANIMAL_HANS[BRANCHES.indexOf(branch)]}`,
    /** Title 与 H1 以「2027属X」开头（关键词归属：年份前置，与生肖子页的「属X」区分） */
    childPrefix: (year, branch) => `${year}属${ANIMAL_HANS[BRANCHES.indexOf(branch)]}`,
    hubPrefix: (year) => `${year}生肖运势`,
    brandSuffix: '｜干支日',
    childMin: 1200,
    hubMin: 800,
    childHeadings: (year) => [`与${ganzhiOfYear(year)}年的地支关系`, `用完整八字看 ${year}`],
    hubHeadings: (year) => [
      `${year} ${ganzhiOfYear(year)}年的干支与纳音`,
      `十二生肖与${ganzhiOfYear(year)}年的关系`,
      '立春与春节两个起点',
      '年支之外的流年',
    ],
    focusRange: [120, 320],
    yearsNote: [60, 220],
    relationsNote: [50, 200],
    yearlyTool: (year) => `/${year}流年`,
    // 东方站已存在的可索引页（生肖子页另按地支生成）
    linkTargets: ['/八字排盘', '/生肖', '/八字/大运', '/八字/十神', '/八字/五行'],
    zodiacChild: (branch) => `/生肖/属${ANIMAL_HANS[BRANCHES.indexOf(branch)]}`,
    /** 关键词归属（决策 13）：每个目标最多两种锚文本 */
    anchors: (path, year) => {
      const hub = `/${year}生肖运势`
      const child = path.match(new RegExp(`^${hub}/属(.)$`))
      if (child) return [`${year}属${child[1]}`, `属${child[1]}${year}年`]
      const zodiac = path.match(/^\/生肖\/属(.)$/)
      if (zodiac) return [`属${zodiac[1]}`, `生肖${zodiac[1]}`]
      if (path === `/${year}流年`) return [`${year}流年`, `${year}年八字流年`]
      if (path === '/生肖') return ['十二生肖', '生肖']
      if (path === '/八字排盘') return ['八字排盘', '免费八字排盘']
      return null
    },
    countUnit: /\p{Script=Han}/gu,
  },
  // 第 9 组：zh-Hant 按台湾、香港用语另写；东方站 zh-Hant 没有第 2 阶段生肖子页，改链 2027 太歲与農民曆
  'zh-Hant': {
    prefix: '/zh-hant',
    hubPath: (year) => `/${year}生肖運勢`,
    childSlug: (branch) => `屬${ANIMAL_HANT[BRANCHES.indexOf(branch)]}`,
    childPrefix: (year, branch) => `${year}屬${ANIMAL_HANT[BRANCHES.indexOf(branch)]}`,
    hubPrefix: (year) => `${year}生肖運勢`,
    brandSuffix: '｜干支日',
    childMin: 1200,
    hubMin: 800,
    childHeadings: (year) => [`對照${ganzhiOfYear(year)}年的地支`, `從整張命盤看 ${year}`],
    hubHeadings: (year) => [
      `${year}年的干支：${ganzhiOfYear(year)}與納音`,
      `十二生肖對照${ganzhiOfYear(year)}年`,
      '換年：立春還是農曆新年',
      '生肖以外的流年線索',
    ],
    focusRange: [120, 320],
    yearsNote: [60, 220],
    relationsNote: [50, 200],
    yearlyTool: (year) => `/${year}流年`,
    linkTargets: (year) => [
      '/八字排盤',
      '/八字/大運',
      '/八字/十神',
      '/八字/五行',
      `/${year}太歲`,
      '/農民曆',
    ],
    // 东方站 zh-Hant 未建生肖子页（spec：生肖页「存在时」才链接）
    zodiacChild: null,
    anchors: (path, year) => {
      const hub = `/${year}生肖運勢`
      const child = path.match(new RegExp(`^${hub}/屬(.)$`))
      if (child) return [`${year}屬${child[1]}`, `${year}年屬${child[1]}`]
      // 正文不写「運勢」（只作 Title、H1 主词），枢纽锚文本用「2027年十二生肖」
      if (path === hub) return [`${year}年十二生肖`]
      if (path === `/${year}流年`) return [`${year}流年`, `${year}年八字流年`]
      if (path === `/${year}太歲`) return [`${year}太歲`, `${year}犯太歲`]
      if (path === '/八字排盤') return ['八字排盤', '免費八字排盤']
      if (path === '/農民曆') return ['農民曆']
      if (path === '/八字/大運') return ['大運']
      if (path === '/八字/十神') return ['十神']
      if (path === '/八字/五行') return ['五行']
      return null
    },
    countUnit: /\p{Script=Han}/gu,
    // 复算与合规词按简体写法匹配：只换校验用到的字（不是正文转换）
    normalize: (text) => text.replace(HANT_CHARS, (char) => HANT_TO_HANS[char]),
    extraTerms: ['人工智慧', '倒楣'],
  },
  // 第 10 组：ko 按韩语主词另写（합쇼체）；篇幅按不含空格的字符计（决策 16）；
  // 不以「띠별 운세」为 Title、H1、H2 或锚文本目标，流年段写「올해 흐름」（yearly-outlook-pages「ko 年度页的用词」）
  ko: {
    prefix: '/ko',
    hubPath: (year) => `/${year}년-띠`,
    childSlug: (branch) => `${ANIMAL_KO[BRANCHES.indexOf(branch)]}띠`,
    /** Title 与 H1 以「쥐띠 2027」开头（与生肖子页「쥐띠 …」区分：띠后紧接年份） */
    childPrefix: (year, branch) => `${ANIMAL_KO[BRANCHES.indexOf(branch)]}띠 ${year}`,
    hubPrefix: (year) => `${year}년 띠`,
    brandSuffix: ' | 간지데이',
    childMin: 1600,
    hubMin: 1000,
    childHeadings: (year) => [
      `${ganzhiHangulOfYear(year)}년 세운과의 지지 관계`,
      '사주 전체로 읽는 올해 흐름',
    ],
    hubHeadings: (year) => [
      `${year} ${ganzhiHangulOfYear(year)}년의 간지와 납음`,
      `열두 띠와 ${ganzhiHangulOfYear(year)}년의 관계`,
      '입춘과 설날, 두 가지 기준',
      '연지 너머의 올해 흐름',
    ],
    focusRange: [170, 450],
    yearsNote: [80, 300],
    relationsNote: [70, 280],
    yearlyTool: (year) => `/${year}-신년-사주`,
    linkTargets: [
      '/만세력',
      '/띠',
      '/토정비결',
      '/사주/대운',
      '/사주/십신',
      '/사주/오행',
      '/사주/신강신약',
      '/사주/용신',
      '/띠궁합',
    ],
    zodiacChild: (branch) => `/띠/${ANIMAL_KO[BRANCHES.indexOf(branch)]}띠`,
    anchors: (path, year) => {
      const hub = `/${year}년-띠`
      const child = path.match(new RegExp(`^${hub}/(.+)띠$`))
      if (child) return [`${child[1]}띠 ${year}`, `${year}년 ${child[1]}띠`]
      const zodiac = path.match(/^\/띠\/(.+)띠$/)
      if (zodiac) return [`${zodiac[1]}띠`, `${zodiac[1]}띠 나이`]
      if (path === `/${year}-신년-사주`)
        return [`${year} 신년 사주`, `${year} ${ganzhiHangulOfYear(year)}년 사주`]
      if (path === '/띠') return ['띠', '열두 띠']
      if (path === '/만세력') return ['무료 만세력', '만세력']
      if (path === '/토정비결') return [`토정비결 ${year}`, '토정비결']
      // 第 17 组：띠궁합总表（ko 年度枢纽的一条正文入链）
      if (path === '/띠궁합') return ['띠궁합', '띠궁합 표']
      return null
    },
    countUnit: /\S/gu,
    facts: (text, page) => koFactIssues(text, page),
    compliance: [
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
      '액운',
      '재앙',
      '횡재',
      '부적',
      '개운',
      '액막이',
      '대박',
      '불운',
      '행운',
      '운세',
      '자기 탐색',
      '자아 탐색',
    ],
    monthFortune:
      /(?:\d{1,2}|정|동|섣)월(?:의|에는|에|엔)? ?(?:운세|운이|운은|길하|흉하|조심|재물|금전운|애정운)/u,
    verdict: ['결혼하면 안', '이혼수', '상극이라 헤어'],
  },
}

/** 繁体校验用的逐字对照（关系名、太岁、生肖、纳音、否定词与合规词用到的字） */
const HANT_TO_HANS = Object.fromEntries(
  [
    ...'沖冲歲岁節节屬属龍龙馬马雞鸡豬猪與与沒没並并無无納纳爐炉劍剑鋒锋頭头澗涧蠟蜡楊杨靂雳長长燈灯驛驿釵钗釧钏運运勢势娛娱樂乐災灾轉转開开護护財财會会離离結结剋克順顺為为對对',
  ].flatMap((char, i, chars) => (i % 2 === 0 ? [[char, chars[i + 1]]] : [])),
)
const HANT_CHARS = new RegExp(`[${Object.keys(HANT_TO_HANS).join('')}]`, 'g')

/**
 * 合规措辞（design 决策 5、16）：不提 AI、不用「娱乐」、不给吉日与吉凶结论，不写化解、转运一类说法；
 * 三个主题段不写月份吉凶（「三月运势」「五月宜」等）。「运势」只允许出现在 Title、H1 与 slug（主词）。
 */
const COMPLIANCE_TERMS = [
  'AI',
  '人工智能',
  '娱乐',
  '吉日',
  '吉凶',
  '大吉',
  '大凶',
  '一定会',
  '注定',
  '必有',
  '灾',
  '血光',
  '破财',
  '化解',
  '转运',
  '开运',
  '好运',
  '厄运',
  '走运',
  '倒霉',
  '护身符',
  '佩戴',
  '自我探索',
]
const MONTH_FORTUNE =
  /(?:正月|[一二三四五六七八九十]{1,2}月|\d{1,2} ?月)(?:份)?(?:的)?(?:运势|运程|吉|凶|宜|忌|旺|顺|不顺|不利|有利|财运|桃花)/u
/** 判定词（design 决策 14 的 zh 词表子集；关系类审计由 apps/web/scripts/audit-verdict.mjs 负责全站） */
const VERDICT_TERMS = [
  '宜结婚',
  '不宜结婚',
  '不能结婚',
  '会离婚',
  '必离',
  '克夫',
  '克妻',
  '注定分手',
  '最佳婚配',
]

function cjkWidth(text) {
  let width = 0
  for (const char of text) width += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿︰-﹏＀-￯　-〿]/u.test(char) ? 1 : 0.5
  return width
}

const cycleOf = (year) => SixtyCycle.fromIndex((((year - 1924) % 60) + 60) % 60)
function ganzhiOfYear(year) {
  const cycle = cycleOf(year)
  return `${STEM_HANZI[cycle.getHeavenStem().getIndex()]}${BRANCH_HANZI[cycle.getEarthBranch().getIndex()]}`
}
const NAYIN_OF = new Map(
  [...Array(60).keys()].map((i) => {
    const cycle = SixtyCycle.fromIndex(i)
    return [
      `${STEM_HANZI[cycle.getHeavenStem().getIndex()]}${BRANCH_HANZI[cycle.getEarthBranch().getIndex()]}`,
      cycle.getSound().getName(),
    ]
  }),
)
const NAYIN_NAMES = new Set(NAYIN_OF.values())

const lichunOf = (year) => {
  const boundary = zodiacBoundaries().find((entry) => entry.year === year)
  if (!boundary) return null
  const local = new Date(boundary.lichunEpochMs + 480 * 60_000)
  return {
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  }
}
const newYearOf = (year) =>
  zodiacBoundaries().find((entry) => entry.year === year)?.lunarNewYear ?? null

const branchOfGlyph = (glyph) => BRANCHES[BRANCH_HANZI.indexOf(glyph)]
const branchOfAnimal = (animal) => BRANCHES[ANIMAL_HANS.indexOf(animal)]

/** 「子未相害」「午未六合」「丑未相冲」：关系名到引擎 key */
const PAIR_RELATION = {
  六合: 'sixCombine',
  相合: 'sixCombine',
  三合: 'triad',
  相冲: 'clash',
  冲: 'clash',
  相刑: 'punish',
  相害: 'harm',
  害: 'harm',
  相破: 'break',
  破: 'break',
}
const TAI_SUI = { 值: 'zhi', 冲: 'chong', 刑: 'xing', 害: 'hai', 破: 'po' }
const BZ = `[${BRANCH_HANZI}]`
const GZ = `[${STEM_HANZI}][${BRANCH_HANZI}]`
const NUM = '(\\d{1,2})'

/** 正文中写到的事实逐项复算；返回不一致的描述 */
export function factIssues(text, { year, branch }) {
  const issues = []
  let checked = 0
  const yearRows = zodiacYearFacts(year).rows
  // 「1990 年庚午」「2027 年（丁未）」
  for (const match of text.matchAll(new RegExp(`(\\d{4}) ?年[（(]?(${GZ})`, 'g'))) {
    const y = Number(match[1])
    if (y < 1924 || y > 2043) continue
    checked++
    if (ganzhiOfYear(y) !== match[2]) issues.push(`${match[0]}：${y} 年应为 ${ganzhiOfYear(y)}`)
  }
  // 干支之后 10 字内、中间没有另一个干支的第一个纳音名
  for (const match of text.matchAll(new RegExp(GZ, 'g'))) {
    const after = text.slice(match.index + 2, match.index + 13).split(/[。；，、\n]/)[0] ?? ''
    const next = after.search(new RegExp(GZ))
    const window = next < 0 ? after : after.slice(0, next)
    const name = [...NAYIN_NAMES].find((candidate) => window.includes(candidate))
    if (!name) continue
    checked++
    if (NAYIN_OF.get(match[0]) !== name)
      issues.push(`${match[0]}…${name}：${match[0]} 的纳音应为 ${NAYIN_OF.get(match[0])}`)
  }
  // 「2027 年立春在 2 月 4 日 09:46」「2027 年的立春是 2 月 4 日」
  for (const match of text.matchAll(
    new RegExp(
      `(\\d{4}) ?年的?立春(?:交节)?(?:时刻)?(?:在|是|为|落在)? ?${NUM} ?月 ?${NUM} ?日(?: ?(\\d{1,2}):(\\d{2}))?`,
      'g',
    ),
  )) {
    const row = lichunOf(Number(match[1]))
    if (!row) continue
    checked++
    if (Number(match[2]) !== row.month || Number(match[3]) !== row.day)
      issues.push(`${match[0]}：立春应为 ${row.month} 月 ${row.day} 日`)
    if (
      match[4] !== undefined &&
      (Number(match[4]) !== row.hour || Number(match[5]) !== row.minute)
    )
      issues.push(
        `${match[0]}：立春时刻应为 ${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`,
      )
  }
  // 「2027 年春节是 2 月 6 日」
  for (const match of text.matchAll(
    new RegExp(`(\\d{4}) ?年的?春节(?:在|是|为|落在)? ?${NUM} ?月 ?${NUM} ?日`, 'g'),
  )) {
    const row = newYearOf(Number(match[1]))
    if (!row) continue
    checked++
    if (Number(match[2]) !== row.month || Number(match[3]) !== row.day)
      issues.push(`${match[0]}：春节应为 ${row.month} 月 ${row.day} 日`)
  }
  // 地支关系名：「午未六合」「子未相害」「丑未相冲」「戌未相刑又相破」
  for (const match of text.matchAll(
    new RegExp(
      `(${BZ})(${BZ})((?:六合|相合|三合|相冲|相刑|相害|相破)(?:[又、与和及]?(?:六合|相合|三合|相冲|相刑|相害|相破|冲|刑|害|破))*)`,
      'g',
    ),
  )) {
    const a = branchOfGlyph(match[1])
    const b = branchOfGlyph(match[2])
    const relations = zodiacPairFacts(a, b).relations
    for (const name of match[3].match(/六合|相合|三合|相冲|相刑|相害|相破|冲|刑|害|破/g) ?? []) {
      checked++
      if (!relations.includes(PAIR_RELATION[name]))
        issues.push(
          `${match[0]}：${match[1]}${match[2]}没有「${name}」（引擎：${relations.join('、') || '无'}）`,
        )
    }
  }
  // 太岁：「属羊值太岁」「属牛……冲太岁」；没有写明生肖时按本页生肖核对（枢纽页必须写明）
  for (const match of text.matchAll(
    /(?:属([鼠牛虎兔龙蛇马羊猴鸡狗猪])[^。；\n属]{0,24}?)?([值冲刑害破])太岁/gu,
  )) {
    // 否定与泛指（「而不是值太岁」「不在值、冲……之列」「犯太岁是指……」）不核对
    const before = text.slice(
      Math.max(0, match.index + match[0].length - 12),
      match.index + match[0].length - 3,
    )
    if (/不|没有|并非|无|或[「“]?$/.test(before)) continue
    const target = match[1] ? branchOfAnimal(match[1]) : branch
    if (!target) continue
    // 同一句中先写了别的干支年（「丙午年……值太岁」）时，按那一年（目标年前后 6 年内）核对
    const sentence =
      text
        .slice(0, match.index + match[0].length)
        .split(/[。；\n]/)
        .at(-1) ?? ''
    const named = [...sentence.matchAll(new RegExp(`(${GZ})年`, 'g'))].at(-1)?.[1]
    const at =
      named && named !== ganzhiOfYear(year)
        ? [...Array(13).keys()].map((i) => year - 6 + i).find((y) => ganzhiOfYear(y) === named)
        : year
    if (at === undefined) continue
    const row = (at === year ? yearRows : zodiacYearFacts(at).rows).find(
      (entry) => entry.branch === target,
    )
    checked++
    if (!row?.taiSui.includes(TAI_SUI[match[2]]))
      issues.push(
        `${match[0]}：${target} 在 ${at} 年的太岁关系为 ${row?.taiSui.join('、') || '无'}`,
      )
  }
  return { issues, checked }
}

function ganzhiHangulOfYear(year) {
  const cycle = cycleOf(year)
  return `${STEM_HANGUL[cycle.getHeavenStem().getIndex()]}${BRANCH_HANGUL[cycle.getEarthBranch().getIndex()]}`
}
/** 干支（汉字）→ ko 纳音名：六十甲子两组共用一个纳音 */
const NAYIN_KO_OF = new Map(
  [...Array(60).keys()].map((i) => {
    const cycle = SixtyCycle.fromIndex(i)
    return [
      `${STEM_HANZI[cycle.getHeavenStem().getIndex()]}${BRANCH_HANZI[cycle.getEarthBranch().getIndex()]}`,
      NAYIN_KO[Math.floor(i / 2)],
    ]
  }),
)
const ANIMAL_KO_RE = ANIMAL_KO.join('|')
const branchOfAnimalKo = (animal) => BRANCHES[ANIMAL_KO.indexOf(animal)]
const KO_PAIR_RELATION = {
  六合: 'sixCombine',
  三合: 'triad',
  沖: 'clash',
  冲: 'clash',
  刑: 'punish',
  害: 'harm',
  破: 'break',
  육합: 'sixCombine',
  삼합: 'triad',
  충: 'clash',
  형: 'punish',
  해: 'harm',
  파: 'break',
}
const KO_TAI_SUI = { 치: 'zhi', 충: 'chong', 형: 'xing', 해: 'hai', 파: 'po' }
/** 삼재：本人三合局 → 들·눌·날三年的地支（申子辰→寅卯辰、巳酉丑→亥子丑、寅午戌→申酉戌、亥卯未→巳午未） */
const SAMJAE = [
  ['yin', 'mao', 'chen'],
  ['hai', 'zi', 'chou'],
  ['shen', 'you', 'xu'],
  ['si', 'wu', 'wei'],
]
const SAMJAE_STEP = { 들: 0, 눌: 1, 날: 2 }

/** 句子范围：上一个句号、问号或换行之后，到下一个之前 */
function sentenceAround(text, index) {
  const start =
    Math.max(
      text.lastIndexOf('.', index),
      text.lastIndexOf('?', index),
      text.lastIndexOf('\n', index),
    ) + 1
  const rest = text.slice(index).search(/[.?\n]/)
  return {
    start,
    before: text.slice(start, index),
    sentence: text.slice(start, rest < 0 ? undefined : index + rest),
  }
}

/**
 * ko 正文的事实复算（第 10 组）：干支写成「정미(丁未)」（读音与汉字须一致），关系名写成「축미충(丑未沖)」
 * 或汉字「丑未沖」；立春按韩国标准时、설날按 UTC+9 的合朔日、「중국 춘절」按北京时间；
 * 太岁写「소띠 … 충태세」，未写띠时按同句前面最后出现的띠、再按本页띠核对；삼재按三合局核对。
 */
export function koFactIssues(text, { year, branch }) {
  const issues = []
  let checked = 0
  const STEM_RE = `[${STEM_HANGUL}]`
  const BRANCH_RE = `[${BRANCH_HANGUL}]`
  for (const match of text.matchAll(new RegExp(`(${STEM_RE})(${BRANCH_RE})\\((${GZ})\\)`, 'g'))) {
    checked++
    const hanja = `${STEM_HANZI[STEM_HANGUL.indexOf(match[1])]}${BRANCH_HANZI[BRANCH_HANGUL.indexOf(match[2])]}`
    if (hanja !== match[3]) issues.push(`${match[0]}：读音与汉字不一致`)
  }
  // 「1990년 경오(庚午)」「1990년생 경오(庚午)」
  for (const match of text.matchAll(
    new RegExp(`(\\d{4})년(?:생)?(?:은|의|인|에)? ?${STEM_RE}${BRANCH_RE}\\((${GZ})\\)`, 'g'),
  )) {
    const y = Number(match[1])
    if (y < 1924 || y > 2043) continue
    checked++
    if (ganzhiOfYear(y) !== match[2]) issues.push(`${match[0]}：${y} 应为 ${ganzhiOfYear(y)}`)
  }
  // 干支之后 16 字内、中间没有另一个干支的第一个纳音名
  for (const match of text.matchAll(new RegExp(GZ, 'g'))) {
    const end =
      match.index + match[0].length + (text[match.index + match[0].length] === ')' ? 1 : 0)
    const window =
      (text.slice(end, end + 16).split(/[.,\n]/)[0] ?? '').split(new RegExp(GZ))[0] ?? ''
    const name = NAYIN_KO.find((candidate) => window.includes(candidate))
    if (!name) continue
    checked++
    if (NAYIN_KO_OF.get(match[0]) !== name)
      issues.push(`${match[0]}…${name}：${match[0]} 的纳音应为 ${NAYIN_KO_OF.get(match[0])}`)
  }
  // 「2027년 입춘은 2월 4일 10:46」（韩国标准时）
  for (const match of text.matchAll(
    /(\d{4})년(?:의)? 입춘(?:은|이)?(?: 절입(?: 시각)?(?:은|이)?)? ?(\d{1,2})월 ?(\d{1,2})일(?: ?(\d{1,2}):(\d{2}))?/g,
  )) {
    const boundary = zodiacBoundaries().find((entry) => entry.year === Number(match[1]))
    if (!boundary) continue
    const local = new Date(boundary.lichunEpochMs + 540 * 60_000)
    checked++
    if (Number(match[2]) !== local.getUTCMonth() + 1 || Number(match[3]) !== local.getUTCDate())
      issues.push(`${match[0]}：입춘应为 ${local.getUTCMonth() + 1}월 ${local.getUTCDate()}일`)
    if (
      match[4] !== undefined &&
      (Number(match[4]) !== local.getUTCHours() || Number(match[5]) !== local.getUTCMinutes())
    )
      issues.push(`${match[0]}：입춘时刻应为 ${local.getUTCHours()}:${local.getUTCMinutes()}`)
  }
  // 「2027년 설날은 2월 7일」（UTC+9）与「2027년 중국 춘절은 2월 6일」（北京时间）
  for (const match of text.matchAll(
    /(\d{4})년(?:의)? (설날|중국 춘절)(?:은|이)? ?(\d{1,2})월 ?(\d{1,2})일/g,
  )) {
    const y = Number(match[1])
    if (y < 1924 || y > 2043) continue
    const date = match[2] === '설날' ? lunarNewYearAt(y, { utcOffsetMinutes: 540 }) : newYearOf(y)
    if (!date) continue
    checked++
    if (Number(match[3]) !== date.month || Number(match[4]) !== date.day)
      issues.push(`${match[0]}：应为 ${date.month}월 ${date.day}일`)
  }
  // 关系名：「丑未沖」「축미충(丑未沖)」
  const relationIssue = (a, b, name, whole) => {
    checked++
    const relations = zodiacPairFacts(a, b).relations
    if (!relations.includes(KO_PAIR_RELATION[name]))
      issues.push(`${whole}：引擎为 ${relations.join('、') || '无'}`)
  }
  for (const match of text.matchAll(new RegExp(`(${BZ})(${BZ})(六合|三合|沖|冲|刑|害|破)`, 'g')))
    relationIssue(branchOfGlyph(match[1]), branchOfGlyph(match[2]), match[3], match[0])
  for (const match of text.matchAll(
    new RegExp(`(${BRANCH_RE})(${BRANCH_RE})(육합|삼합|충|형|해|파)\\(`, 'g'),
  ))
    relationIssue(
      BRANCHES[BRANCH_HANGUL.indexOf(match[1])],
      BRANCHES[BRANCH_HANGUL.indexOf(match[2])],
      match[3],
      match[0],
    )
  // 太岁
  const yearRows = zodiacYearFacts(year).rows
  for (const match of text.matchAll(/(치|충|형|해|파)태세/gu)) {
    const { before, sentence } = sentenceAround(text, match.index)
    // 泛指的列举（同句写出三种以上太岁名）与否定（「충태세가 아닙니다」）不核对
    if (new Set(sentence.match(/[치충형해파]태세/g)).size >= 3) continue
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 12)
    if (/^[가-힣]{0,3} ?(?:아니|않|없)/.test(after)) continue
    const named = [...before.matchAll(new RegExp(`(${ANIMAL_KO_RE})띠`, 'g'))].at(-1)?.[1]
    const target = named ? branchOfAnimalKo(named) : branch
    if (!target) continue
    checked++
    const row = yearRows.find((entry) => entry.branch === target)
    if (!row?.taiSui.includes(KO_TAI_SUI[match[1]]))
      issues.push(
        `${named ?? ''}…${match[0]}：${target} 在 ${year} 年的太岁关系为 ${row?.taiSui.join('、') || '无'}`,
      )
  }
  // 삼재：「돼지띠·토끼띠·양띠는 날삼재」；没有写띠时按本页띠
  const yearBranch = branchOfGlyph(ganzhiOfYear(year)[1])
  for (const match of text.matchAll(/(들|눌|날)삼재/gu)) {
    const { before, sentence } = sentenceAround(text, match.index)
    // 泛指的列举（同句写出两种以上삼재名）与否定不核对
    if (new Set(sentence.match(/[들눌날]삼재/g)).size >= 2) continue
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 12)
    if (/^[가-힣]{0,3} ?(?:아니|않|없)/.test(after)) continue
    const animals = [...before.matchAll(new RegExp(`(${ANIMAL_KO_RE})띠`, 'g'))].map((m) => m[1])
    const targets = animals.length ? animals.map(branchOfAnimalKo) : branch ? [branch] : []
    for (const target of targets) {
      checked++
      if (SAMJAE[BRANCHES.indexOf(target) % 4][SAMJAE_STEP[match[1]]] !== yearBranch)
        issues.push(`${target}…${match[0]}：${year} 年不是该띠的${match[0]}`)
    }
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

// ---------------------------------------------------------------------------
// 东方站根路径英文（第 11 组）：`/chinese-zodiac-2027` 枢纽与 12 页，以及 `/chinese-zodiac` 生肖枢纽
// ---------------------------------------------------------------------------

const STEM_PINYIN = ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui']
const BRANCH_PINYIN = [
  'Zi',
  'Chou',
  'Yin',
  'Mao',
  'Chen',
  'Si',
  'Wu',
  'Wei',
  'Shen',
  'You',
  'Xu',
  'Hai',
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
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
/** 纳音英文名（messages/en/yearly.json 的 yearly_nayin_*，按纳音序号） */
const NAYIN_EN = JSON.parse(
  readFileSync(new URL('../apps/web/messages/en/yearly.json', import.meta.url), 'utf8'),
)
const NAYIN_EN_NAMES = [...Array(30).keys()].map((i) => NAYIN_EN[`yearly_nayin_${i}`])
const pinyinOfYear = (year) => {
  const cycle = cycleOf(year)
  return `${STEM_PINYIN[cycle.getHeavenStem().getIndex()]} ${BRANCH_PINYIN[cycle.getEarthBranch().getIndex()]}`
}
/** 「Ding Wei」→ 引擎纳音英文名 */
const NAYIN_EN_OF = new Map(
  [...Array(60).keys()].map((i) => {
    const cycle = SixtyCycle.fromIndex(i)
    const index = Math.floor(i / 2)
    return [
      `${STEM_PINYIN[cycle.getHeavenStem().getIndex()]} ${BRANCH_PINYIN[cycle.getEarthBranch().getIndex()]}`,
      NAYIN_EN_NAMES[index],
    ]
  }),
)
const SP = `(?:${STEM_PINYIN.join('|')})`
const BP = `(?:${BRANCH_PINYIN.join('|')})`
const AN = `(?:${ANIMAL_EN.join('|')})`
const branchOfName = (name) => {
  const byPinyin = BRANCH_PINYIN.indexOf(name)
  if (byPinyin >= 0) return BRANCHES[byPinyin]
  const byAnimal = ANIMAL_EN.indexOf(name)
  return byAnimal >= 0 ? BRANCHES[byAnimal] : undefined
}
const EN_RELATION = {
  'six harmony': 'sixCombine',
  'three harmony': 'triad',
  clash: 'clash',
  punishment: 'punish',
  harm: 'harm',
  break: 'break',
}
const EN_TAI_SUI = { meet: 'zhi', clash: 'chong', punish: 'xing', harm: 'hai', break: 'po' }

/** 英文正文中写到的事实逐项复算（写法约定见第 11 组撰写说明） */
export function factIssuesEn(text, { year, branch }) {
  const issues = []
  let checked = 0
  const yearRows = zodiacYearFacts(year).rows
  const verifyYear = (y, pillar, raw) => {
    if (y < 1924 || y > 2043) return
    checked++
    if (pinyinOfYear(y) !== pillar) issues.push(`${raw}：${y} 年应为 ${pinyinOfYear(y)}`)
  }
  // 「1991 (Xin Wei)」「1991 Xin Wei」
  for (const m of text.matchAll(new RegExp(`\\b(\\d{4}),? \\(?(${SP} ${BP})\\b`, 'g')))
    verifyYear(Number(m[1]), m[2], m[0])
  // 「Xin Wei (1991)」「Xin Wei (辛未, 1991)」
  for (const m of text.matchAll(
    new RegExp(`\\b(${SP} ${BP}) \\((?:[${STEM_HANZI}][${BRANCH_HANZI}], ?)?(\\d{4})\\)`, 'g'),
  ))
    verifyYear(Number(m[2]), m[1], m[0])
  // 拼音与汉字对应：「Ding Wei (丁未)」
  for (const m of text.matchAll(
    new RegExp(`\\b(${SP}) (${BP}) \\(([${STEM_HANZI}])([${BRANCH_HANZI}])`, 'g'),
  )) {
    checked++
    if (
      STEM_PINYIN.indexOf(m[1]) !== STEM_HANZI.indexOf(m[3]) ||
      BRANCH_PINYIN.indexOf(m[2]) !== BRANCH_HANZI.indexOf(m[4])
    )
      issues.push(`${m[0]}：拼音与汉字不一致`)
  }
  // 纳音：干支之后、同一句内、没有另一个干支之前的第一个纳音名
  for (const m of text.matchAll(new RegExp(`\\b${SP} ${BP}\\b`, 'g'))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 90).split(/[.;\n]/)[0]
    const next = after.search(new RegExp(`\\b${SP} ${BP}\\b`))
    const window = next < 0 ? after : after.slice(0, next)
    const name = NAYIN_EN_NAMES.filter((candidate) => window.includes(candidate)).sort(
      (a, b) => window.indexOf(a) - window.indexOf(b),
    )[0]
    if (!name || !NAYIN_EN_OF.has(m[0])) continue
    checked++
    if (NAYIN_EN_OF.get(m[0]) !== name)
      issues.push(`${m[0]}…${name}：${m[0]} 的纳音应为 ${NAYIN_EN_OF.get(m[0])}`)
  }
  // 日期：关键词（Li Chun / Beginning of Spring / Chinese New Year / Lunar New Year）之后 40 字符内的「February 4, 2027」
  for (const m of text.matchAll(
    new RegExp(
      `\\b(${MONTHS_EN.join('|')}) (\\d{1,2}),? (\\d{4})(?:,? at (\\d{1,2}):(\\d{2}))?`,
      'g',
    ),
  )) {
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    const keyword = [
      ...before.matchAll(/Li Chun|Beginning of Spring|Chinese New Year|Lunar New Year/g),
    ].at(-1)?.[0]
    if (!keyword) continue
    const y = Number(m[3])
    const month = MONTHS_EN.indexOf(m[1]) + 1
    const day = Number(m[2])
    if (keyword === 'Li Chun' || keyword === 'Beginning of Spring') {
      const row = lichunOf(y)
      if (!row) continue
      checked++
      if (month !== row.month || day !== row.day)
        issues.push(`${m[0]}：${y} 年 Li Chun 应为 ${MONTHS_EN[row.month - 1]} ${row.day}`)
      if (m[4] !== undefined && (Number(m[4]) !== row.hour || Number(m[5]) !== row.minute))
        issues.push(
          `${m[0]}：Li Chun 时刻应为 ${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`,
        )
    } else {
      const row = newYearOf(y)
      if (!row) continue
      checked++
      if (month !== row.month || day !== row.day)
        issues.push(`${m[0]}：${y} 年 Chinese New Year 应为 ${MONTHS_EN[row.month - 1]} ${row.day}`)
    }
  }
  // 地支关系：「Chou–Wei clash」「Ox–Goat clash」「Wu (午)–Wei (未) six harmony」
  const NAME = `(${BP}|${AN})(?: \\([${BRANCH_HANZI}]\\))?`
  for (const m of text.matchAll(
    new RegExp(
      `\\b${NAME}[–-]${NAME} (six harmony|three harmony|clash|punishment|harm|break)\\b`,
      'g',
    ),
  )) {
    const a = branchOfName(m[1])
    const b = branchOfName(m[2])
    if (!a || !b) continue
    checked++
    const relations = zodiacPairFacts(a, b).relations
    if (!relations.includes(EN_RELATION[m[3]]))
      issues.push(`${m[0]}：${m[1]}–${m[2]} 没有 ${m[3]}（引擎：${relations.join('、') || '无'}）`)
  }
  // 太岁：「the Ox is clashing with Tai Sui」「Goat … meeting Tai Sui」；没有写明生肖时按本页生肖核对
  for (const m of text.matchAll(
    new RegExp(
      `(?:\\b(${AN})\\b[^.;\\n]{0,48}?)?\\b(meet|clash|punish|harm|break)(?:s|es|ing)?(?: with)? Tai Sui`,
      'g',
    ),
  )) {
    const before = text.slice(Math.max(0, m.index + m[0].length - 40), m.index + m[0].length)
    if (/\b(?:not|no|nor|never|without|neither|none)\b/i.test(before)) continue
    // 泛指（「what meeting Tai Sui means」「labels such as clashing with Tai Sui」）不核对：须写明生肖或位于生肖页
    if (!m[1] && !branch) continue
    const target = m[1] ? branchOfName(m[1]) : branch
    const row = yearRows.find((entry) => entry.branch === target)
    checked++
    if (!row?.taiSui.includes(EN_TAI_SUI[m[2]]))
      issues.push(`${m[0]}：${target} 在 ${year} 年的太岁关系为 ${row?.taiSui.join('、') || '无'}`)
  }
  return { issues, checked }
}

/** en 合规与判定词（决策 14、16；与 i18n/glossary/en-east.json 的禁用写法互补） */
const EN_BANNED = [
  [/\bAI\b|artificial intelligence/, 'AI'],
  [/\bentertainment\b|\bfor fun\b/i, '娱乐定位'],
  [/\b(?:un)?lucky\b|\b(?:in)?auspicious\b|\bgood luck\b|\bbad luck\b/i, '吉凶'],
  [/\bfortunes?\b|\bhoroscopes?\b/i, '运势'],
  [/\bdestin(?:y|ed)\b(?! calculator)|\bdoomed\b|\bfated\b/i, '决定论'],
  [/\bdisasters?\b|\bmisfortunes?\b|\bcurses?\b/i, '灾厄'],
  [/\bremed(?:y|ies)\b|\bcures?\b|\bamulets?\b|\btalismans?\b|\blucky charms?\b/i, '化解'],
  [/\bwill happen\b|\bwill bring\b|\bguarantee/i, '预测'],
  [/self-exploration/i, '自我探索'],
]
const EN_VERDICT = [
  /\bshould(?:n't| not) marry\b/i,
  /\bwill divorce\b/i,
  /\b(?:best|worst|perfect) match(?:es)?\b/i,
  /\bincompatible\b/i,
  /\bnot meant to be\b/i,
]
function complianceEn(text) {
  // 链接地址与锚文本「Four Pillars of Destiny calculator」（术语表锚点）不计
  const plainText = text.replace(/\]\([^)]*\)/g, ']').replace(/Four Pillars of Destiny/g, '')
  const issues = []
  for (const [re, label] of EN_BANNED) {
    const hit = re.exec(plainText)
    if (hit) issues.push(`合规禁用词（${label}）：${hit[0]}`)
  }
  for (const re of EN_VERDICT) {
    const hit = re.exec(plainText)
    if (hit) issues.push(`判定词：${hit[0]}`)
  }
  return issues
}

const ANIMAL_SLUG_EN = ANIMAL_EN.map((name) => name.toLowerCase())
const wordCount = /\b[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu

LOCALES.en = {
  prefix: '',
  hubPath: (year) => `/chinese-zodiac-${year}`,
  childSlug: (branch) => ANIMAL_SLUG_EN[BRANCHES.indexOf(branch)],
  /** Title 与 H1 以「Rat 2027」开头（关键词归属：年份紧跟生肖，与 `/chinese-zodiac` 区分） */
  childPrefix: (year, branch) => `${ANIMAL_EN[BRANCHES.indexOf(branch)]} ${year}`,
  hubPrefix: (year) => `Chinese Zodiac ${year}`,
  brandSuffix: ' | Ganjiday',
  tdkWidth: (text) => text.length,
  titleRange: [40, 60],
  descriptionRange: [140, 160],
  childMin: 900,
  hubMin: 700,
  childHeadings: (year) => [
    `Branch relations with the ${pinyinOfYear(year)} year`,
    `Reading ${year} with your full BaZi chart`,
  ],
  hubHeadings: (year) => [
    `${year} ${pinyinOfYear(year)}: stem, branch and Na Yin`,
    `The 12 animals and the ${pinyinOfYear(year)} year`,
    'Two start dates: Li Chun and Chinese New Year',
    'Beyond the year branch',
  ],
  focusRange: [80, 200],
  yearsNote: [40, 140],
  relationsNote: [30, 120],
  yearlyTool: (year) => `/bazi-${year}`,
  linkTargets: ['/bazi-calculator', '/bazi-compatibility', '/chinese-zodiac'],
  // 没有 en 生肖子页：「本生肖子页」一项由生肖枢纽承担（yearly-outlook-pages「生肖页（存在时）」）
  zodiacChild: () => '/chinese-zodiac',
  anchors: (path, year) => {
    const child = path.match(new RegExp(`^/chinese-zodiac-${year}/([a-z]+)$`))
    if (child) {
      const name = ANIMAL_EN[ANIMAL_SLUG_EN.indexOf(child[1])]
      return [`${name} in ${year}`, `Year of the ${name} ${year}`]
    }
    if (path === `/chinese-zodiac-${year}`)
      return [`Year of the Goat ${year}`, `Chinese zodiac ${year}`]
    if (path === '/chinese-zodiac') return ['Chinese zodiac', 'Chinese zodiac years']
    if (path === `/bazi-${year}`) return [`BaZi ${year}`, `${year} BaZi calculator`]
    if (path === '/bazi-calculator')
      return ['BaZi calculator', 'Four Pillars of Destiny calculator']
    if (path === '/bazi-compatibility') return ['BaZi compatibility', 'BaZi chart compatibility']
    // 第 17 组：生肖配对总表（`/chinese-zodiac` 枢纽的一条正文入链）
    if (path === '/chinese-zodiac-compatibility')
      return ['Chinese zodiac compatibility', 'Chinese zodiac pairings']
    return null
  },
  countUnit: wordCount,
  facts: factIssuesEn,
  compliance: complianceEn,
  monthFortune: /\b(?:best|worst|lucky|unlucky|good|bad) months?\b/i,
}

/**
 * `/chinese-zodiac`（集合 zodiac 的 en 枢纽，第 11 组）：TDK、篇幅（导语与正文 ≥700 词）、固定小标题、
 * 正文内链与锚文本、合规与事实复算。12 个 en 生肖子页本期不做，只校验枢纽。
 */
const ZODIAC_EN_HUB = new URL('../apps/web/content/zodiac/en/index.mdx', import.meta.url)
const ZODIAC_EN_HEADINGS = [
  'The 12 Chinese zodiac animals',
  'Li Chun or Chinese New Year: when the animal changes',
  'Three harmony, six harmony and clash',
  'Your animal is one branch of a BaZi chart',
]
export function checkZodiacHubEn(file = ZODIAC_EN_HUB) {
  const failures = []
  if (!existsSync(file)) return { failures, row: null, factsChecked: 0 }
  const fail = (message) => failures.push(`zodiac/en/index.mdx: ${message}`)
  const source = readFileSync(file, 'utf8')
  const match = source.match(/^---\n([\s\S]+?)\n---\n\n([\s\S]+)$/)
  if (!match) {
    fail('缺少 frontmatter 分隔')
    return { failures, row: null, factsChecked: 0 }
  }
  const data = parseDocument(match[1], { uniqueKeys: true }).toJS()
  const content = match[2]
  const spec = LOCALES.en
  if (data.slug !== 'chinese-zodiac') fail('slug 应为 chinese-zodiac')
  if (data.locale !== 'en') fail('locale 应为 en')
  for (const key of ['title', 'heading']) {
    const value = String(data[key] ?? '')
    if (!value.startsWith('Chinese Zodiac')) fail(`${key} 应以「Chinese Zodiac」开头`)
    // 关键词归属：年份页以「Chinese Zodiac 2027」开头，枢纽不抢年份主词
    if (/^Chinese Zodiac \d{4}/.test(value)) fail(`${key} 不以年份开头（年份主词归年度枢纽）`)
  }
  const titleLength = `${data.title}${spec.brandSuffix}`.length
  const descriptionLength = String(data.description ?? '').length
  if (titleLength < 40 || titleLength > 60)
    fail(`Title 长度 ${titleLength}（含站名后缀，须 40–60）`)
  if (descriptionLength < 140 || descriptionLength > 160)
    fail(`Description 长度 ${descriptionLength}（须 140–160）`)
  const faq = Array.isArray(data.faq) ? data.faq : []
  if (faq.length < 3 || faq.length > 4) fail(`FAQ 须 3–4 问，现为 ${faq.length}`)
  const headings = bodySections(content).map((section) => section.title)
  for (const [index, heading] of ZODIAC_EN_HEADINGS.entries())
    if (headings[index] !== heading) fail(`第 ${index + 1} 个小标题须为「${heading}」`)
  const words = ([data.lede, plain(content)].join('\n').match(wordCount) ?? []).length
  if (words < 700) fail(`撰写正文 ${words} 词，少于 700`)
  const links = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({
    anchor: m[1],
    href: m[2],
  }))
  const targets = new Set(links.map((link) => link.href))
  if (targets.size < 2 || targets.size > 5) fail(`正文内链 ${targets.size} 个不同目标（须 2–5）`)
  for (const required of ['/chinese-zodiac-2027', '/bazi-calculator'])
    if (!targets.has(required)) fail(`缺少 ${required} 链接`)
  for (const { anchor, href } of links) {
    if (href === '/chinese-zodiac') fail('链接到本页')
    const expected = spec.anchors(href, 2027)
    if (!expected) fail(`正文链接目标不在允许清单：${href}`)
    else if (!expected.includes(anchor))
      fail(`锚文本「${anchor}」不在 ${href} 的约定锚文本（${expected.join('、')}）中`)
  }
  const everything = [
    data.title,
    data.heading,
    data.description,
    data.lede,
    ...faq.flatMap((item) => [item.q, item.a]),
    content,
  ].join('\n')
  for (const issue of complianceEn(everything)) fail(issue)
  const facts = factIssuesEn(everything, { year: 2027, branch: null })
  for (const issue of facts.issues) fail(`事实不一致：${issue}`)
  return {
    failures,
    row: { title: data.title, titleLength, descriptionLength, words, links: targets.size },
    factsChecked: facts.checked,
  }
}

export function checkLocale(locale, root = ROOT) {
  const spec = LOCALES[locale]
  const failures = []
  const rows = []
  let factsChecked = 0
  const dir = new URL(`${locale}/`, root)
  if (!existsSync(dir)) return { failures, rows, factsChecked }
  /** 目标 → 锚文本 → 次数（整个集合） */
  const anchors = new Map()
  const seen = { title: new Map(), description: new Map(), heading: new Map() }
  for (const yearDir of readdirSync(dir).sort()) {
    const year = Number(yearDir)
    const files = readdirSync(new URL(`${yearDir}/`, dir)).filter((file) => file.endsWith('.mdx'))
    for (const file of files.sort()) {
      const fail = (message) => failures.push(`${locale}/${yearDir}/${file}: ${message}`)
      const source = readFileSync(new URL(`${yearDir}/${file}`, dir), 'utf8')
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
        ? ['title', 'heading', 'description', 'slug', 'locale', 'year', 'lede', 'faq', 'updated']
        : [
            'title',
            'heading',
            'description',
            'slug',
            'locale',
            'year',
            'branch',
            'lede',
            'relations_note',
            'focus',
            'years_note',
            'faq',
            'updated',
          ]
      const extra = Object.keys(data).filter((key) => !required.includes(key))
      const missing = required.filter((key) => data[key] === undefined)
      if (extra.length) fail(`多余字段：${extra.join('、')}`)
      if (missing.length) fail(`缺少字段：${missing.join('、')}`)
      if (data.locale !== locale) fail(`locale 应为 ${locale}`)
      if (data.year !== year) fail(`year 应为 ${year}`)
      if (!hub && !BRANCHES.includes(branch)) fail(`文件名应为地支 key：${branch}`)
      if (!hub && data.branch !== branch) fail('branch 与文件名不一致')
      const slug = hub ? spec.hubPath(year).slice(1) : spec.childSlug(branch)
      if (data.slug !== slug) fail(`slug 应为 ${slug}`)
      const prefix = hub ? spec.hubPrefix(year) : spec.childPrefix(year, branch)
      if (!String(data.heading ?? '').startsWith(prefix)) fail(`H1 应以「${prefix}」开头`)
      if (!String(data.title ?? '').startsWith(prefix)) fail(`Title 应以「${prefix}」开头`)

      const measure = spec.tdkWidth ?? cjkWidth
      const [titleMin, titleMax] = spec.titleRange ?? [20, 30]
      const [descriptionMin, descriptionMax] = spec.descriptionRange ?? [70, 80]
      const titleWidth = measure(`${data.title}${spec.brandSuffix}`)
      const descriptionWidth = measure(String(data.description ?? ''))
      if (titleWidth < titleMin || titleWidth > titleMax)
        fail(`Title 宽度 ${titleWidth}（含站名后缀，须 ${titleMin}–${titleMax}）`)
      if (descriptionWidth < descriptionMin || descriptionWidth > descriptionMax)
        fail(`Description 宽度 ${descriptionWidth}（须 ${descriptionMin}–${descriptionMax}）`)
      for (const key of ['title', 'description', 'heading']) {
        const previous = seen[key].get(data[key])
        if (previous) fail(`${key} 与 ${previous} 重复`)
        seen[key].set(data[key], file)
      }

      const faq = Array.isArray(data.faq) ? data.faq : []
      if (faq.length < 3 || faq.length > 4) fail(`FAQ 须 3–4 问，现为 ${faq.length}`)
      for (const item of faq) if (!item?.q?.trim() || !item?.a?.trim()) fail('FAQ 每项须有 q 与 a')

      const focus = hub ? [] : Array.isArray(data.focus) ? data.focus : []
      if (!hub) {
        if (focus.map((item) => item?.theme).join() !== FOCUS.join())
          fail(`focus 须依次为 ${FOCUS.join('、')}`)
        for (const item of focus) {
          const count = (String(item?.text ?? '').match(spec.countUnit) ?? []).length
          const [low, high] = spec.focusRange
          if (count < low || count > high)
            fail(`focus.${item?.theme} ${count} 字（须 ${low}–${high}）`)
        }
        for (const [key, [low, high]] of [
          ['years_note', spec.yearsNote],
          ['relations_note', spec.relationsNote],
        ]) {
          const count = (String(data[key] ?? '').match(spec.countUnit) ?? []).length
          if (count < low || count > high) fail(`${key} ${count} 字（须 ${low}–${high}）`)
        }
      }

      const sections = bodySections(content)
      const headings = sections.map((section) => section.title)
      const fixed = hub ? spec.hubHeadings(year) : spec.childHeadings(year)
      if (JSON.stringify(headings) !== JSON.stringify(fixed))
        fail(`正文小标题须依次为：${fixed.join(' / ')}（现为 ${headings.join(' / ')}）`)

      // 篇幅：本页撰写的正文（导语、关系与年份导语、主题段、正文），不含 FAQ、表格与组件模板句
      const authored = [
        data.lede,
        data.relations_note,
        data.years_note,
        ...focus.map((item) => item?.text),
        plain(content),
      ]
        .filter(Boolean)
        .join('\n')
      const count = (authored.match(spec.countUnit) ?? []).length
      const min = hub ? spec.hubMin : spec.childMin
      if (count < min) fail(`撰写正文 ${count} 字，少于 ${min}`)

      // 正文内链：只链接允许清单中的地址；子页 2–5 个不同目标
      const prefixed = (path) => `${spec.prefix}${path}`
      const linkTargets =
        typeof spec.linkTargets === 'function' ? spec.linkTargets(year) : spec.linkTargets
      const allowed = new Set([
        ...linkTargets.map(prefixed),
        prefixed(spec.yearlyTool(year)),
        prefixed(spec.hubPath(year)),
        ...BRANCHES.map((b) => prefixed(`${spec.hubPath(year)}/${spec.childSlug(b)}`)),
        ...(spec.zodiacChild ? BRANCHES.map((b) => prefixed(spec.zodiacChild(b))) : []),
      ])
      const self = prefixed(hub ? spec.hubPath(year) : `${spec.hubPath(year)}/${slug}`)
      const links = [...content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({
        anchor: m[1],
        href: m[2],
      }))
      for (const { anchor, href } of links) {
        if (!allowed.has(href)) fail(`正文链接目标不在允许清单：${href}`)
        if (href === self) fail(`链接到本页：${href}`)
        const path = href.slice(spec.prefix.length)
        const expected = spec.anchors(path, year)
        if (expected && !expected.includes(anchor))
          fail(`锚文本「${anchor}」不在 ${path} 的约定锚文本（${expected.join('、')}）中`)
        if (!anchors.has(path)) anchors.set(path, new Map())
        anchors.get(path).set(anchor, (anchors.get(path).get(anchor) ?? 0) + 1)
      }
      const targets = new Set(links.map((link) => link.href)).size
      if (!hub && (targets < 2 || targets > 5)) fail(`正文内链 ${targets} 个不同目标（须 2–5）`)
      if (!hub) {
        // 决策 15：链接个人年度工具、本生肖子页，以及六合或冲对象的年度页（1 条）
        const hrefs = new Set(links.map((link) => link.href))
        if (!hrefs.has(prefixed(spec.yearlyTool(year)))) fail('缺少个人年度工具链接')
        if (spec.zodiacChild && !hrefs.has(prefixed(spec.zodiacChild(branch))))
          fail('缺少本生肖子页链接')
        const partners = BRANCHES.filter(
          (other) =>
            other !== branch &&
            zodiacPairFacts(branch, other).relations.some(
              (r) => r === 'sixCombine' || r === 'clash',
            ),
        ).map((other) => prefixed(`${spec.hubPath(year)}/${spec.childSlug(other)}`))
        const yearlyLinks = [...hrefs].filter((href) =>
          href.startsWith(prefixed(`${spec.hubPath(year)}/`)),
        )
        if (yearlyLinks.length !== 1 || !partners.includes(yearlyLinks[0]))
          fail(`年度页之间只链接六合或冲对象的 1 页（${partners.join('、')}）`)
      }

      const raw = [
        data.description,
        data.lede,
        data.relations_note,
        data.years_note,
        ...focus.map((item) => item?.text),
        ...faq.flatMap((item) => [item.q, item.a]),
        content,
      ].join('\n')
      const normalize = spec.normalize ?? ((text) => text)
      const everything = normalize(raw)
      if (typeof spec.compliance === 'function') {
        // 拼音文字按词与正则核对（en 合规与判定词表）
        for (const issue of spec.compliance(everything)) fail(issue)
      } else {
        // 中日韩按词表核对：ko 用自己的合规与判定词表，zh-Hant 归一到简体后另加繁体用词
        for (const term of spec.compliance ?? [...COMPLIANCE_TERMS, ...(spec.extraTerms ?? [])])
          if (new RegExp(term === 'AI' ? '\\bAI\\b' : term).test(everything))
            fail(`合规禁用词：${term}`)
        for (const term of spec.verdict ?? VERDICT_TERMS)
          if (everything.includes(term)) fail(`判定词：${term}`)
      }
      // ko：Title、H1、H2 与锚文本也不含「운세」（含「띠별 운세」；正文由上面的禁用词覆盖）
      if (locale === 'ko')
        for (const text of [data.title, data.heading, ...headings, ...links.map((l) => l.anchor)])
          if (/운세/.test(String(text))) fail(`Title/H1/H2/锚文本含「운세」：${text}`)
      if ((locale === 'zh-Hans' || locale === 'zh-Hant') && /运势|运程/.test(everything)) {
        // 「运势」只作主词出现在 Title、H1 与地址中
        const plainText = everything.replace(/\]\([^)]*\)/g, ']')
        if (/运势|运程/.test(plainText)) fail('正文不用「运势」「运程」（只作 Title、H1 主词）')
      }
      const month = (spec.monthFortune ?? MONTH_FORTUNE).exec(everything)
      if (month) fail(`月份吉凶写法：${month[0]}`)

      const facts = (spec.facts ?? factIssues)(
        normalize([data.title, data.heading, raw].join('\n')),
        {
          year,
          branch,
        },
      )
      factsChecked += facts.checked
      for (const issue of facts.issues) fail(`事实不一致：${issue}`)

      rows.push({
        file: `${yearDir}/${file}`,
        title: data.title,
        titleWidth,
        descriptionWidth,
        heading: data.heading,
        chars: count,
        links: targets,
        facts: facts.checked,
      })
    }
  }
  for (const [path, counts] of anchors)
    if (counts.size > 2)
      failures.push(`${locale}: ${path} 的锚文本超过 2 种：${[...counts.keys()].join('、')}`)
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
  const zodiacHub = checkZodiacHubEn()
  failures.push(...zodiacHub.failures)
  total += zodiacHub.factsChecked
  if (zodiacHub.row)
    lines.push(
      `| en | zodiac/en/index.mdx | ${zodiacHub.row.title}（${zodiacHub.row.titleLength}） | ${zodiacHub.row.descriptionLength} | — | ${zodiacHub.row.words} | ${zodiacHub.row.links} | ${zodiacHub.factsChecked} |`,
    )
  lines.push('', `复算事实合计：${total} 处；失败：${failures.length}`)
  if (values.report)
    writeFileSync(
      values.report,
      `${lines.join('\n')}\n${failures.map((f) => `- ${f}`).join('\n')}\n`,
    )
  if (failures.length) {
    console.error(failures.map((failure) => `  - ${failure}`).join('\n'))
    assert.fail(`年度生肖内容校验失败 ${failures.length} 项`)
  }
  console.log(`年度生肖内容校验通过（复算事实 ${total} 处）`)
}
