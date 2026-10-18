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

export function computeZiwei(input: BirthInput): ZiweiChart {
  assertValidInput(input)
  if (input.time === null) return { status: 'requiresHour', engineVersion: ENGINE_VERSION }
  const used = resolveBirthTime(input).used
  const timeIndex = ziweiTimeIndex(used.hour)
  const chart = astro.bySolar(
    `${used.year}-${used.month}-${used.day}`,
    timeIndex,
    input.gender === 'male' ? '男' : '女',
    true,
    'zh-CN',
  )
  const mutagens: { star: string; mutagen: Mutagen; palace: PalaceKey }[] = []
  const palaces = chart.palaces.map((p): ZiweiPalace => {
    const key = oneOf(PALACES, strip(kot<string>(p.name), 'Palace'))
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.mutagen) {
        const mutagen = MUTAGEN_KEYS[kot<string>(s.mutagen)]
        if (mutagen === undefined) throw new Error(`Unexpected iztro mutagen ${s.mutagen}`)
        mutagens.push({ star: kot<string>(s.name).replace(/(Maj|Min)$/, ''), mutagen, palace: key })
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
