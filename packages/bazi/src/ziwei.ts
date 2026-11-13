/**
 * 紫微斗数基础命盘：封装 iztro，与八字共用 BirthInput 与时间换算。
 * 单独入口 `@xuanxue/bazi/ziwei`，避免八字页面加载 iztro。
 */
import { astro } from 'iztro'
import { kot } from 'iztro/lib/i18n/index.js'
import { BRANCHES, type Branch, STEMS, type Stem } from './constants.ts'
import { assertValidInput, type BirthInput } from './input.ts'
import { type DateTimeParts, resolveBirthTime } from './time.ts'
import { ENGINE_VERSION } from './version.ts'

export const PALACES = [
  'soul',
  'siblings',
  'spouse',
  'children',
  'wealth',
  'health',
  'surface',
  'friends',
  'career',
  'property',
  'spirit',
  'parents',
] as const
export type PalaceKey = (typeof PALACES)[number]

export const MAJOR_STARS = [
  'ziwei',
  'tianji',
  'taiyang',
  'wuqu',
  'tiantong',
  'lianzhen',
  'tianfu',
  'taiyin',
  'tanlang',
  'jumen',
  'tianxiang',
  'tianliang',
  'qisha',
  'pojun',
] as const
export type MajorStar = (typeof MAJOR_STARS)[number]

export const MUTAGENS = ['lu', 'quan', 'ke', 'ji'] as const
export type Mutagen = (typeof MUTAGENS)[number]

export type ZiweiPalace = {
  key: PalaceKey
  stem: Stem
  branch: Branch
  isBodyPalace: boolean
  majorStars: { star: MajorStar; brightness: string | null; mutagen: Mutagen | null }[]
}

export type ZiweiChart =
  | {
      status: 'ok'
      engineVersion: string
      /** 实际用于排盘的时间与时辰序号（0 早子 … 12 晚子）。 */
      used: DateTimeParts
      timeIndex: number
      /** 五行局，如 fire6th。 */
      fiveElementsClass: string
      soulPalaceBranch: Branch
      bodyPalaceBranch: Branch
      palaces: ZiweiPalace[]
      /** 生年四化（含辅星，如文昌化科）。 */
      mutagens: { star: string; mutagen: Mutagen; palace: PalaceKey }[]
    }
  | { status: 'requiresHour'; engineVersion: string }

const strip = (key: string, suffix: string) => {
  if (!key.endsWith(suffix)) throw new Error(`Unexpected iztro key ${key}`)
  return key.slice(0, -suffix.length)
}

function oneOf<T extends string>(list: readonly T[], value: string): T {
  if (!(list as readonly string[]).includes(value)) throw new Error(`Unexpected iztro key ${value}`)
  return value as T
}

const MUTAGEN_KEYS: Record<string, Mutagen> = {
  sihuaLu: 'lu',
  sihuaQuan: 'quan',
  sihuaKe: 'ke',
  sihuaJi: 'ji',
}

/** 时辰序号：0 点为早子（0），23 点为晚子（12），其余每两小时一位。 */
export function ziweiTimeIndex(hour: number): number {
  if (hour === 23) return 12
  return Math.floor((hour + 1) / 2)
}

type Astrolabe = ReturnType<typeof astro.bySolar>

/** 排盘输入换算为 iztro 星盘；不知道时辰返回 null（紫微必须有时辰）。 */
function buildAstrolabe(
  input: BirthInput,
): { chart: Astrolabe; used: DateTimeParts; timeIndex: number } | null {
  assertValidInput(input)
  if (input.time === null) return null
  const used = resolveBirthTime(input).used
  const timeIndex = ziweiTimeIndex(used.hour)
  const chart = astro.bySolar(
    `${used.year}-${used.month}-${used.day}`,
    timeIndex,
    input.gender === 'male' ? '男' : '女',
    true,
    'zh-CN',
  )
  return { chart, used, timeIndex }
}

const palaceKeyOf = (name: string) => oneOf(PALACES, strip(kot<string>(name), 'Palace'))
const starKeyOf = (name: string) => kot<string>(name).replace(/(Maj|Min)$/, '')

export function computeZiwei(input: BirthInput): ZiweiChart {
  const built = buildAstrolabe(input)
  if (!built) return { status: 'requiresHour', engineVersion: ENGINE_VERSION }
  const { chart, used, timeIndex } = built
  const mutagens: { star: string; mutagen: Mutagen; palace: PalaceKey }[] = []
  const palaces = chart.palaces.map((p): ZiweiPalace => {
    const key = palaceKeyOf(p.name)
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.mutagen) {
        const mutagen = MUTAGEN_KEYS[kot<string>(s.mutagen)]
        if (mutagen === undefined) throw new Error(`Unexpected iztro mutagen ${s.mutagen}`)
        mutagens.push({ star: starKeyOf(s.name), mutagen, palace: key })
      }
    }
    return {
      key,
      stem: oneOf(STEMS, strip(kot<string>(p.heavenlyStem), 'Heavenly')),
      branch: oneOf(BRANCHES, strip(kot<string>(p.earthlyBranch), 'Earthly')),
      isBodyPalace: p.isBodyPalace,
      majorStars: p.majorStars
        .filter((s) => s.type === 'major')
        .map((s) => ({
          star: oneOf(MAJOR_STARS, strip(kot<string>(s.name), 'Maj')),
          brightness: s.brightness ? kot<string>(s.brightness) : null,
          mutagen: s.mutagen ? (MUTAGEN_KEYS[kot<string>(s.mutagen)] ?? null) : null,
        })),
    }
  })
  return {
    status: 'ok',
    engineVersion: ENGINE_VERSION,
    used,
    timeIndex,
    fiveElementsClass: kot<string>(chart.fiveElementsClass),
    soulPalaceBranch: oneOf(
      BRANCHES,
      strip(kot<string>(chart.earthlyBranchOfSoulPalace), 'Earthly'),
    ),
    bodyPalaceBranch: oneOf(
      BRANCHES,
      strip(kot<string>(chart.earthlyBranchOfBodyPalace), 'Earthly'),
    ),
    palaces,
    mutagens,
  }
}

/** 六吉星与六煞星（spec「紫微大限与流年数据」）；key 与 iztro 去掉 Min 后缀的名称一致 */
export const LUCKY_STARS = ['zuofu', 'youbi', 'wenchang', 'wenqu', 'tiankui', 'tianyue'] as const
export const UNLUCKY_STARS = [
  'qingyang',
  'tuoluo',
  'huoxing',
  'lingxing',
  'dikong',
  'dijie',
] as const
export type AuxiliaryStar = (typeof LUCKY_STARS)[number] | (typeof UNLUCKY_STARS)[number]

export type ZiweiDecade = {
  /** 大限所在的本命宫位 */
  palace: PalaceKey
  stem: Stem
  branch: Branch
  /** 大限起止虚岁 */
  ageRange: [number, number]
}

export type ZiweiYear = {
  year: number
  /** 流年干支 */
  stem: Stem
  branch: Branch
  /** 该年虚岁 */
  nominalAge: number
  /** 流年命宫落在的本命宫位 */
  soulPalace: PalaceKey
  /** 该年所在大限的本命宫位 */
  decadePalace: PalaceKey
  /** 流年四化（按该年天干），palace 为星曜所在的本命宫位 */
  mutagens: { star: string; mutagen: Mutagen; palace: PalaceKey }[]
}

export type ZiweiHoroscope =
  | {
      status: 'ok'
      engineVersion: string
      /** 十二宫大限，按起始年龄排序 */
      decades: ZiweiDecade[]
      /** 窗口首年所在的大限与下一步大限 */
      currentDecade: ZiweiDecade | null
      nextDecade: ZiweiDecade | null
      years: ZiweiYear[]
      auxiliaryStars: { star: AuxiliaryStar; kind: 'lucky' | 'unlucky'; palace: PalaceKey }[]
    }
  | { status: 'requiresHour'; engineVersion: string }

const stemKeyOf = (name: string) => oneOf(STEMS, strip(kot<string>(name), 'Heavenly'))
const branchKeyOf = (name: string) => oneOf(BRANCHES, strip(kot<string>(name), 'Earthly'))

/**
 * 紫微运限（readings-prompt-v4-yearly design 决策 1）：大限年龄区间、当前与下一步大限、
 * 窗口内逐年流年命宫与流年四化、六吉六煞落宫。流年取各年 7 月 1 日计算，避开农历年初边界；
 * 不改 `computeZiwei` 的输出。
 */
export function ziweiHoroscope(
  input: BirthInput,
  options: { startYear: number; years: number },
): ZiweiHoroscope {
  const { startYear, years } = options
  if (!Number.isInteger(startYear) || !Number.isInteger(years) || years < 1 || years > 20)
    throw new RangeError('Invalid horoscope window')
  const built = buildAstrolabe(input)
  if (!built) return { status: 'requiresHour', engineVersion: ENGINE_VERSION }
  const { chart } = built
  const palaceKeys = chart.palaces.map((p) => palaceKeyOf(p.name))
  // 星曜（含辅星）所在的本命宫位，用于标出流年四化落宫
  const starPalace = new Map<string, PalaceKey>()
  chart.palaces.forEach((p, i) => {
    for (const star of [...p.majorStars, ...p.minorStars])
      starPalace.set(starKeyOf(star.name), palaceKeys[i] as PalaceKey)
  })
  const decadeOf = (index: number): ZiweiDecade => {
    const p = chart.palaces[index]
    if (!p) throw new Error(`Unexpected iztro palace index ${index}`)
    return {
      palace: palaceKeys[index] as PalaceKey,
      stem: stemKeyOf(p.decadal.heavenlyStem),
      branch: branchKeyOf(p.decadal.earthlyBranch),
      ageRange: [p.decadal.range[0], p.decadal.range[1]],
    }
  }
  const decades = chart.palaces
    .map((_, i) => decadeOf(i))
    .sort((a, b) => a.ageRange[0] - b.ageRange[0])
  const result: ZiweiYear[] = []
  for (let year = startYear; year < startYear + years; year++) {
    const h = chart.horoscope(`${year}-07-01`)
    result.push({
      year,
      stem: stemKeyOf(h.yearly.heavenlyStem),
      branch: branchKeyOf(h.yearly.earthlyBranch),
      nominalAge: h.age.nominalAge,
      soulPalace: palaceKeys[h.yearly.index] as PalaceKey,
      decadePalace: palaceKeys[h.decadal.index] as PalaceKey,
      mutagens: h.yearly.mutagen.map((name, i) => {
        const star = starKeyOf(name)
        const palace = starPalace.get(star)
        if (!palace) throw new Error(`Unexpected iztro mutagen star ${name}`)
        return { star, mutagen: MUTAGENS[i] as Mutagen, palace }
      }),
    })
  }
  const firstAge = result[0]?.nominalAge ?? 0
  const current = decades.findIndex((d) => d.ageRange[0] <= firstAge && firstAge <= d.ageRange[1])
  const auxiliaryStars: { star: AuxiliaryStar; kind: 'lucky' | 'unlucky'; palace: PalaceKey }[] = []
  for (const [star, palace] of starPalace) {
    if ((LUCKY_STARS as readonly string[]).includes(star))
      auxiliaryStars.push({ star: star as AuxiliaryStar, kind: 'lucky', palace })
    else if ((UNLUCKY_STARS as readonly string[]).includes(star))
      auxiliaryStars.push({ star: star as AuxiliaryStar, kind: 'unlucky', palace })
  }
  const order = [...LUCKY_STARS, ...UNLUCKY_STARS] as readonly string[]
  auxiliaryStars.sort((a, b) => order.indexOf(a.star) - order.indexOf(b.star))
  return {
    status: 'ok',
    engineVersion: ENGINE_VERSION,
    decades,
    currentDecade: current === -1 ? null : (decades[current] ?? null),
    nextDecade: current === -1 ? null : (decades[current + 1] ?? null),
    years: result,
    auxiliaryStars,
  }
}
