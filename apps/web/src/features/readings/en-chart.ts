import type { annualChartSummary, ziweiAnnualSummary } from './catalog.ts'

/**
 * 东方站英文详批 v5 的用户消息数据（add-locales-eu-ja 5b.3）：把 `annual` 数据档的稳定 key
 * 换成英文标签（十神、干支、宫位、星曜、四化与关系），模型照抄而不是自己翻译。
 *
 * 为什么：readings-east-en@v2 真实评测的准确度扣分几乎都来自「查表翻译」——
 * 十神（pianYin 写成 Direct Wealth）、藏干位置（middle 写成 main）、相似星曜（文昌 / 文曲）、
 * 宫位 key 交叉引用（auxiliaryStars 的 palace 与 palaces 的 key）、按年龄推大限换限年份。
 * 这里只做确定性的改写与归并（每宫列出落宫的辅星、每年列出流年命宫的主星、大限给出公历年），
 * 不新增任何推算结论；复算结果（`reading.input`、engineVersion、guard 与评测检查）不变。
 * 只有登记了 `formatChart` 的提示词版本使用，v4 及其他语言的消息一字不变。
 */

type BaziAnnual = ReturnType<typeof annualChartSummary>
type ZiweiAnnual = ReturnType<typeof ziweiAnnualSummary>

const STEM: Readonly<Record<string, string>> = {
  jia: 'Jia 甲 (Yang Wood)',
  yi: 'Yi 乙 (Yin Wood)',
  bing: 'Bing 丙 (Yang Fire)',
  ding: 'Ding 丁 (Yin Fire)',
  wu: 'Wu 戊 (Yang Earth)',
  ji: 'Ji 己 (Yin Earth)',
  geng: 'Geng 庚 (Yang Metal)',
  xin: 'Xin 辛 (Yin Metal)',
  ren: 'Ren 壬 (Yang Water)',
  gui: 'Gui 癸 (Yin Water)',
}
const STEM_PINYIN: Readonly<Record<string, readonly [string, string]>> = {
  jia: ['Jia', '甲'],
  yi: ['Yi', '乙'],
  bing: ['Bing', '丙'],
  ding: ['Ding', '丁'],
  wu: ['Wu', '戊'],
  ji: ['Ji', '己'],
  geng: ['Geng', '庚'],
  xin: ['Xin', '辛'],
  ren: ['Ren', '壬'],
  gui: ['Gui', '癸'],
}
const BRANCH_PINYIN: Readonly<Record<string, readonly [string, string, string]>> = {
  zi: ['Zi', '子', 'Rat'],
  chou: ['Chou', '丑', 'Ox'],
  yin: ['Yin', '寅', 'Tiger'],
  mao: ['Mao', '卯', 'Rabbit'],
  chen: ['Chen', '辰', 'Dragon'],
  si: ['Si', '巳', 'Snake'],
  wu: ['Wu', '午', 'Horse'],
  wei: ['Wei', '未', 'Goat'],
  shen: ['Shen', '申', 'Monkey'],
  you: ['You', '酉', 'Rooster'],
  xu: ['Xu', '戌', 'Dog'],
  hai: ['Hai', '亥', 'Pig'],
}

const stemName = (stem: string) => STEM_PINYIN[stem]?.[0] ?? stem
const branchName = (branch: string) => BRANCH_PINYIN[branch]?.[0] ?? branch
const stemLabel = (stem: string) => STEM[stem] ?? stem
/** 「You 酉」 */
const branchLabelShort = (branch: string) => {
  const b = BRANCH_PINYIN[branch]
  return b ? `${b[0]} ${b[1]}` : branch
}
const branchLabel = (branch: string) => {
  const b = BRANCH_PINYIN[branch]
  return b ? `${b[0]} ${b[1]} (${b[2]})` : branch
}
/** 「Bing Wu 丙午」 */
export function ganzhiLabel(stem: string, branch: string): string {
  const s = STEM_PINYIN[stem]
  const b = BRANCH_PINYIN[branch]
  if (!s || !b) return `${stem} ${branch}`
  return `${s[0]} ${b[0]} ${s[1]}${b[1]}`
}
/** 逐年小节标题（不含 `### `）：「2026 丙午 · Bing Wu」，与提示词规定的格式一致 */
export function yearHeading(year: number, stem: string, branch: string): string {
  const s = STEM_PINYIN[stem]
  const b = BRANCH_PINYIN[branch]
  if (!s || !b) return `${year} ${stem} ${branch}`
  return `${year} ${s[1]}${b[1]} · ${s[0]} ${b[0]}`
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// ───────────────────────────── 八字 ─────────────────────────────

const TEN_GOD: Readonly<Record<string, string>> = {
  biJian: 'Friend',
  jieCai: 'Rob Wealth',
  shiShen: 'Eating God',
  shangGuan: 'Hurting Officer',
  pianCai: 'Indirect Wealth',
  zhengCai: 'Direct Wealth',
  qiSha: 'Seven Killings',
  zhengGuan: 'Direct Officer',
  pianYin: 'Indirect Resource',
  zhengYin: 'Direct Resource',
}
const tenGod = (key: string | null | undefined) => (key ? (TEN_GOD[key] ?? key) : 'none')

const QI: Readonly<Record<string, string>> = {
  main: 'main qi',
  middle: 'middle qi',
  residual: 'residual qi',
}

const PILLAR: Readonly<Record<string, string>> = {
  year: 'year pillar',
  month: 'month pillar',
  day: 'day pillar',
  hour: 'hour pillar',
}

const SHENSHA: Readonly<Record<string, string>> = {
  kongWang: 'Void (Kong Wang)',
  taoHua: 'Peach Blossom',
  tianYiGuiRen: 'Nobleman (Tian Yi Gui Ren)',
  yiMa: 'Travelling Horse',
  huaGai: 'Canopy (Hua Gai)',
  wenChang: 'Scholar (Wen Chang)',
  yangRen: 'Goat Blade (Yang Ren)',
  luShen: 'Prosperity Star (Lu Shen)',
}
const BASIS: Readonly<Record<string, string>> = {
  dayPillar: 'the day pillar',
  yearPillar: 'the year pillar',
  dayStem: 'the day stem',
  yearStem: 'the year stem',
  dayBranch: 'the day branch',
  yearBranch: 'the year branch',
}

const RELATION: Readonly<Record<string, string>> = {
  sixCombine: 'forms a six harmony (Liu He) with',
  triad: 'forms a three-harmony link (full or half triad) with',
  clash: 'clashes with',
  punish: 'forms a punishment with',
}

const hiddenStemLabels = (list: readonly { stem: string; qi: string; tenGod: string }[]) =>
  list.map((h) => `${QI[h.qi] ?? h.qi}: ${stemLabel(h.stem)}, Ten God ${tenGod(h.tenGod)}`)

const listNames = (items: readonly string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/** 并列时全部列出（如两种五行同为最低） */
const extremes = (
  elements: readonly { element: string; percent: number }[],
  percent: number | undefined,
) => listNames(elements.filter((e) => e.percent === percent).map((e) => capital(e.element)))

export function baziEnChart(result: Record<string, unknown>) {
  const chart = result as unknown as BaziAnnual
  const { pillars, fortune, annual } = chart
  const approximate = Boolean(fortune.approximate)

  const pillarEntry = (key: 'year' | 'month' | 'day' | 'hour') => {
    const p = pillars[key]
    if (!p)
      return {
        Pillar: capital(PILLAR[key] ?? key),
        Status: 'unknown: the birth hour was not given, so there is no hour pillar',
      }
    return {
      Pillar: capital(PILLAR[key] ?? key),
      'Stem-branch': ganzhiLabel(p.stem, p.branch),
      Stem: stemLabel(p.stem),
      'Stem Ten God': key === 'day' ? 'none: this stem is the Day Master itself' : tenGod(p.tenGod),
      Branch: branchLabel(p.branch),
      'Hidden stems in the branch': hiddenStemLabels(p.hiddenStems),
    }
  }

  const decades = fortune.decades
  const luckEntry = (d: (typeof decades)[number]) => ({
    'Luck Pillar': ganzhiLabel(d.stem, d.branch),
    Years: `${d.startYear}–${d.endYear}${approximate ? ' (approximate)' : ''}`,
    'East Asian ages': `${d.startAge}–${d.endAge ?? '?'}`,
    Stem: `${stemLabel(d.stem)}: Ten God ${tenGod(d.tenGod)}, ${d.favorable?.stem ?? 'unrated'}`,
    Branch: `${branchLabel(d.branch)}: Ten God of its main hidden stem ${tenGod(d.branchTenGod)}, ${d.favorable?.branch ?? 'unrated'}`,
  })
  const currentIndex = chart.currentYear.decadeIndex
  const current = currentIndex === null ? undefined : decades.find((d) => d.index === currentIndex)
  const next =
    currentIndex === null ? decades[0] : decades.find((d) => d.index === currentIndex + 1)

  const natalStem = (key: string) => pillars[key as 'year' | 'month' | 'day' | 'hour']?.stem
  const natalBranch = (key: string) => pillars[key as 'year' | 'month' | 'day' | 'hour']?.branch

  const sortedElements = [...chart.strength.elements].sort((a, b) => b.percent - a.percent)

  return {
    'Chart type': 'BaZi (Four Pillars)',
    Gender: chart.gender,
    'Birth hour known': chart.hourKnown ? 'yes' : 'no: there is no hour pillar',
    'Day Master': `${stemLabel(chart.dayMaster)}, the stem of the day pillar`,
    'Day Master strength': chart.strength.verdict,
    'Share of supporting elements': `${chart.strength.supportPercent}%`,
    'Element balance (strongest first)': sortedElements.map(
      (e) => `${capital(e.element)} ${e.percent}% (count ${e.count})`,
    ),
    'Strongest element': extremes(sortedElements, sortedElements[0]?.percent),
    'Weakest element (scarce, not absent unless 0%)': extremes(
      sortedElements,
      sortedElements[sortedElements.length - 1]?.percent,
    ),
    'Favorable elements': chart.useful.favorable.map(capital),
    'Unfavorable elements': chart.useful.unfavorable.map(capital),
    'Natal pillars': (['year', 'month', 'day', 'hour'] as const).map(pillarEntry),
    'Luck Pillar timing': approximate
      ? 'approximate, because the birth hour is unknown'
      : 'exact to the year',
    'Luck Pillars': decades.map(luckEntry),
    'Current Luck Pillar': current
      ? luckEntry(current)
      : 'none: the first Luck Pillar has not begun yet',
    'Next Luck Pillar': next ? luckEntry(next) : 'none',
    'Symbolic stars touching the natal pillars': chart.shensha.map(
      (s) =>
        `${SHENSHA[s.key] ?? s.key}: found from ${BASIS[s.basis] ?? s.basis}; its branches are ${listNames(
          s.targets.map(branchName),
        )}; it touches the ${listNames(s.pillars.map((p) => PILLAR[p] ?? p))}`,
    ),
    'Year by year': annual.years.map((y, i) => {
      const previous = annual.years[i - 1]?.decade ?? null
      const relations = y.relations.map((r) => {
        if (r.type === 'stemCombine') {
          const target = r.with === 'decade' ? y.decade?.stem : (natalStem(r.with) ?? undefined)
          const where =
            r.with === 'decade'
              ? `the stem ${target ? stemName(target) : ''} of the Luck Pillar ${y.decade ? ganzhiLabel(y.decade.stem, y.decade.branch) : ''}`
              : `your ${PILLAR[r.with] ?? r.with} stem ${target ? stemName(target) : ''}`
          return `Stem combination: the year stem ${stemName(y.stem)} combines with ${where}`
        }
        const target = r.with === 'decade' ? y.decade?.branch : (natalBranch(r.with) ?? undefined)
        const where =
          r.with === 'decade'
            ? `the branch ${target ? branchName(target) : ''} of the Luck Pillar ${y.decade ? ganzhiLabel(y.decade.stem, y.decade.branch) : ''}`
            : `your ${PILLAR[r.with] ?? r.with} branch ${target ? branchName(target) : ''}`
        return `Branch relation: the year branch ${branchName(y.branch)} ${RELATION[r.type] ?? r.type} ${where}`
      })
      return {
        Heading: yearHeading(y.year, y.stem, y.branch),
        'Annual pillar': ganzhiLabel(y.stem, y.branch),
        'Year stem': `${stemLabel(y.stem)}: Ten God ${tenGod(y.stemTenGod)}; its element ${capital(y.elements.stem)} is ${y.favorable.stem}`,
        'Year branch': `${branchLabel(y.branch)}: its element ${capital(y.elements.branch)} is ${y.favorable.branch}`,
        'Hidden stems in the year branch': hiddenStemLabels(y.branchTenGods),
        'Luck Pillar this year': y.decade
          ? `${ganzhiLabel(y.decade.stem, y.decade.branch)}${annual.approximate ? ' (approximate)' : ''}`
          : 'none: before the first Luck Pillar',
        'New Luck Pillar begins this year': y.decadeStart
          ? `yes: ${y.decade ? ganzhiLabel(y.decade.stem, y.decade.branch) : ''} begins${
              previous ? `, taking over from ${ganzhiLabel(previous.stem, previous.branch)}` : ''
            }${annual.approximate ? ' (approximate, birth hour unknown)' : ''}`
          : 'no',
        Relations: relations.length > 0 ? relations : ['none listed'],
        'Tai Sui':
          y.taiSui === 'zhi'
            ? 'the year branch is the same as your year-pillar branch (a Tai Sui year: more change and adjustment)'
            : y.taiSui === 'chong'
              ? 'the year branch clashes with your year-pillar branch (clashing Tai Sui: more change and adjustment)'
              : 'none',
      }
    }),
    ...(annual.approximate
      ? {
          'Note on the yearly data':
            'the birth hour is unknown, so the yearly relations leave out the hour pillar and Luck Pillar years are estimates',
        }
      : {}),
  }
}

// ───────────────────────────── 紫微 ─────────────────────────────

/** 十二宫，按传统顺序（命、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母） */
const PALACE: Readonly<Record<string, string>> = {
  soul: 'Life Palace',
  siblings: 'Siblings Palace',
  spouse: 'Spouse Palace',
  children: 'Children Palace',
  wealth: 'Wealth Palace',
  health: 'Health Palace',
  surface: 'Travel Palace',
  friends: 'Friends Palace',
  career: 'Career Palace',
  property: 'Property Palace',
  spirit: 'Spirit Palace',
  parents: 'Parents Palace',
}
const PALACE_ORDER = Object.keys(PALACE)
const palaceName = (key: string) => PALACE[key] ?? key

const STAR: Readonly<Record<string, string>> = {
  ziwei: 'Zi Wei',
  tianji: 'Tian Ji',
  taiyang: 'Tai Yang',
  wuqu: 'Wu Qu',
  tiantong: 'Tian Tong',
  lianzhen: 'Lian Zhen',
  tianfu: 'Tian Fu',
  taiyin: 'Tai Yin',
  tanlang: 'Tan Lang',
  jumen: 'Ju Men',
  tianxiang: 'Tian Xiang',
  tianliang: 'Tian Liang',
  qisha: 'Qi Sha',
  pojun: 'Po Jun',
  zuofu: 'Zuo Fu',
  youbi: 'You Bi',
  wenchang: 'Wen Chang',
  wenqu: 'Wen Qu',
  tiankui: 'Tian Kui',
  tianyue: 'Tian Yue',
  qingyang: 'Qing Yang',
  tuoluo: 'Tuo Luo',
  huoxing: 'Huo Xing',
  lingxing: 'Ling Xing',
  dikong: 'Di Kong',
  dijie: 'Di Jie',
}
const starName = (key: string) => STAR[key] ?? key

const MUTAGEN: Readonly<Record<string, string>> = {
  lu: 'Hua Lu (prosperity)',
  quan: 'Hua Quan (power)',
  ke: 'Hua Ke (recognition)',
  ji: 'Hua Ji (obstacle, needs extra care)',
}
const mutagenName = (key: string) => MUTAGEN[key] ?? key

const BRIGHTNESS: Readonly<Record<string, string>> = {
  miao: 'brilliant',
  wang: 'bright',
  de: 'steady',
  li: 'fair',
  ping: 'neutral',
  bu: 'dim',
  xian: 'fallen',
}

const BUREAU: Readonly<Record<string, string>> = {
  water2nd: 'Water 2',
  wood3rd: 'Wood 3',
  metal4th: 'Metal 4',
  earth5th: 'Earth 5',
  fire6th: 'Fire 6',
}

export function ziweiEnChart(result: Record<string, unknown>) {
  const chart = result as unknown as ZiweiAnnual
  const byKey = new Map<string, (typeof chart.palaces)[number]>(
    chart.palaces.map((p) => [p.key, p]),
  )
  const { horoscope } = chart
  // 虚岁 1 岁所在的年（农历出生年）：任一流年的 year − nominalAge + 1
  const first = horoscope.years[0]
  const birthYear = first ? first.year - first.nominalAge + 1 : null
  const decadeYears = (ages: readonly [number, number]) =>
    birthYear === null ? '' : ` (about ${birthYear + ages[0] - 1}–${birthYear + ages[1] - 1})`
  const decadeOf = (palace: string) => horoscope.decades.find((d) => d.palace === palace)

  const starWithBrightness = (s: { star: string; brightness: string | null }) =>
    s.brightness
      ? `${starName(s.star)} (${BRIGHTNESS[s.brightness] ?? s.brightness})`
      : `${starName(s.star)} (no brightness given)`

  const birthMutagen = new Map(chart.mutagens.map((m) => [m.star, m.mutagen]))
  const auxIn = (palace: string) =>
    chart.auxiliaryStars
      .filter((a) => a.palace === palace)
      .map((a) => {
        const m = birthMutagen.get(a.star)
        return `${starName(a.star)} (${a.kind === 'lucky' ? 'auspicious' : 'challenging'})${
          m ? ` with birth-year ${mutagenName(m)}` : ''
        }`
      })

  const mainStarsOf = (key: string): string => {
    const p = byKey.get(key)
    if (!p) return 'unknown'
    if (p.majorStars.length > 0) return listNames(p.majorStars.map(starWithBrightness))
    const borrowed = 'borrowedStars' in p ? (p.borrowedStars ?? []) : []
    return `none (empty palace); it borrows ${listNames(borrowed.map(starWithBrightness))} from the opposite ${palaceName(p.opposite)}`
  }

  const palaces = PALACE_ORDER.map((key) => byKey.get(key))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => {
      const borrowed = 'borrowedStars' in p ? p.borrowedStars : undefined
      const aux = auxIn(p.key)
      const decade = decadeOf(p.key)
      return {
        Palace: palaceName(p.key),
        'Stem-branch': ganzhiLabel(p.stem, p.branch),
        ...(p.isBodyPalace ? { 'Body Palace': 'yes, the Body Palace sits here' } : {}),
        'Main stars':
          p.majorStars.length > 0
            ? p.majorStars.map(
                (s) =>
                  `${starWithBrightness(s)}${s.mutagen ? ` with birth-year ${mutagenName(s.mutagen)}` : ''}`,
              )
            : 'none: this is an empty palace',
        ...(borrowed
          ? {
              [`Borrowed main stars (from the opposite ${palaceName(p.opposite)})`]:
                borrowed.map(starWithBrightness),
            }
          : {}),
        'Supporting stars in this palace': aux.length > 0 ? aux : 'none',
        'Opposite palace': `${palaceName(p.opposite)}: ${mainStarsOf(p.opposite)}`,
        ...(decade
          ? {
              'Major Period here': `East Asian ages ${decade.ageRange[0]}–${decade.ageRange[1]}${decadeYears(decade.ageRange)}`,
            }
          : {}),
      }
    })

  const bodyPalace = chart.palaces.find((p) => p.isBodyPalace)
  const decadeEntry = (d: (typeof horoscope.decades)[number]) => ({
    Palace: palaceName(d.palace),
    'Stem-branch': ganzhiLabel(d.stem, d.branch),
    'East Asian ages': `${d.ageRange[0]}–${d.ageRange[1]}${decadeYears(d.ageRange)}`,
    'Main stars of this palace': mainStarsOf(d.palace),
  })

  return {
    'Chart type': 'Zi Wei Dou Shu (Purple Star Astrology)',
    'Five Element Bureau': BUREAU[chart.fiveElementsClass] ?? chart.fiveElementsClass,
    'Life Palace': `in the ${branchLabelShort(chart.soulPalaceBranch)} branch`,
    'Body Palace': bodyPalace
      ? bodyPalace.key === 'soul'
        ? 'in the same palace as the Life Palace'
        : `in the ${palaceName(bodyPalace.key)}`
      : `in the ${branchLabelShort(chart.bodyPalaceBranch)} branch`,
    'Twelve palaces': palaces,
    'Birth-year Four Transformations': chart.mutagens.map(
      (m) => `${mutagenName(m.mutagen)}: ${starName(m.star)}, in the ${palaceName(m.palace)}`,
    ),
    'Six auspicious stars': chart.auxiliaryStars
      .filter((a) => a.kind === 'lucky')
      .map((a) => `${starName(a.star)}: in the ${palaceName(a.palace)}`),
    'Six challenging stars': chart.auxiliaryStars
      .filter((a) => a.kind === 'unlucky')
      .map((a) => `${starName(a.star)}: in the ${palaceName(a.palace)}`),
    'Major Periods (Da Xian), in order': horoscope.decades.map(decadeEntry),
    'Current Major Period': horoscope.currentDecade
      ? decadeEntry(horoscope.currentDecade)
      : 'none: the first Major Period has not begun yet',
    'Next Major Period': horoscope.nextDecade ? decadeEntry(horoscope.nextDecade) : 'none',
    'Year by year': horoscope.years.map((y) => {
      const decade = decadeOf(y.decadePalace)
      const begins = decade !== undefined && decade.ageRange[0] === y.nominalAge
      return {
        Heading: yearHeading(y.year, y.stem, y.branch),
        'Annual pillar': ganzhiLabel(y.stem, y.branch),
        'East Asian age': y.nominalAge,
        'Annual Life Palace': `${palaceName(y.soulPalace)}: ${mainStarsOf(y.soulPalace)}`,
        'Major Period this year': `${palaceName(y.decadePalace)}${
          decade ? ` (ages ${decade.ageRange[0]}–${decade.ageRange[1]})` : ''
        }`,
        'New Major Period begins this year': begins ? 'yes' : 'no',
        'Four Transformations this year': y.mutagens.map(
          (m) =>
            `${mutagenName(m.mutagen)}: ${starName(m.star)}, which sits in the natal ${palaceName(m.palace)}`,
        ),
      }
    }),
  }
}
