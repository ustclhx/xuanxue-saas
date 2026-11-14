import type { BaziChart } from './chart.ts'
import {
  BRANCHES,
  type Branch,
  branchElement,
  ELEMENTS,
  type Element,
  type PillarKey,
  STEMS,
  type Stem,
  stemElement,
  type TenGod,
} from './constants.ts'
import { yearFortune } from './fortune.ts'
import { hiddenStemsOf, type Qi, tenGodOf } from './pillars.ts'
import { branchRelations, stemRelations, taiSuiOf } from './relations.ts'

/**
 * 流年窗口逐年数据（readings-prompt-v4-yearly design 决策 1）：只由已排好的命盘与公历年推算，
 * 不改 `computeChart` 输出与 ENGINE_VERSION；详批 v4 数据档与评测共用。
 * 干支以立春换年，这里的「年」指该公历年对应的流年干支（与 `yearFortune` 一致）。
 */

/** 逐年关系只列这五类（spec「八字流年窗口逐年数据」）；六害由每日运势等其他用途按需使用 */
export type AnnualRelationType = 'stemCombine' | 'sixCombine' | 'clash' | 'punish' | 'triad'

export type AnnualRelation = {
  /** 关系对象：本命四柱之一，或该年所在的大运 */
  with: PillarKey | 'decade'
  type: AnnualRelationType
}

/** 五行对日主的作用：喜用或忌神（扶抑法下五行全部归入两类之一） */
export type ElementRole = 'favorable' | 'unfavorable'

export type AnnualYear = {
  year: number
  stem: Stem
  branch: Branch
  elements: { stem: Element; branch: Element }
  stemTenGod: TenGod
  branchTenGods: { stem: Stem; qi: Qi; tenGod: TenGod }[]
  /** 所属大运序号；起运之前或十步大运之后为 null */
  decadeIndex: number | null
  /**
   * 所属大运的干支（与 decadeIndex 同源）；起运前或十步大运之后为 null。
   * 直接给出干支，避免模型按序号回查大运时张冠李戴（readings-prompt-v4 tasks 4.3 评测）
   */
  decade: { stem: Stem; branch: Branch } | null
  /** 该年是否为某步大运的起始年（窗口内换运） */
  decadeStart: boolean
  relations: AnnualRelation[]
  taiSui: 'zhi' | 'chong' | null
  favorable: { stem: ElementRole; branch: ElementRole }
}

export type AnnualOutlook = {
  startYear: number
  years: AnnualYear[]
  /** 不知道时辰：大运归属年份按未知时辰估算，逐年关系不含时柱 */
  approximate: boolean
}

export type DecadeDetail = {
  index: number
  /** 大运地支本气十神 */
  branchTenGod: TenGod
  favorable: { stem: ElementRole; branch: ElementRole }
}

const ANNUAL_BRANCH_TYPES = new Set<AnnualRelationType>(['sixCombine', 'clash', 'punish', 'triad'])

function roleOf(chart: BaziChart, element: Element): ElementRole {
  return chart.useful.favorable.includes(element) ? 'favorable' : 'unfavorable'
}

function relationsWith(
  stem: Stem,
  branch: Branch,
  target: { stem: Stem; branch: Branch },
  label: AnnualRelation['with'],
): AnnualRelation[] {
  const types = [
    ...stemRelations(stem, target.stem),
    ...branchRelations(branch, target.branch).filter((t) =>
      ANNUAL_BRANCH_TYPES.has(t as AnnualRelationType),
    ),
  ] as AnnualRelationType[]
  return types.map((type) => ({ with: label, type }))
}

/** 窗口最多 20 年：详批默认 5 年，留出余量但避免误传大数 */
const MAX_YEARS = 20

export function annualOutlook(
  chart: BaziChart,
  options: { startYear: number; years: number },
): AnnualOutlook {
  const { startYear, years } = options
  if (!Number.isInteger(startYear) || !Number.isInteger(years) || years < 1 || years > MAX_YEARS)
    throw new RangeError('Invalid annual window')
  const dayStem = STEMS.indexOf(chart.dayMaster)
  const pillars = (['year', 'month', 'day', 'hour'] as const).flatMap((key) => {
    const p = chart.pillars[key]
    return p ? [{ key, pillar: p }] : []
  })
  const result: AnnualYear[] = []
  for (let year = startYear; year < startYear + years; year++) {
    const fortune = yearFortune(year, dayStem)
    const stemIdx = STEMS.indexOf(fortune.stem)
    const branchIdx = BRANCHES.indexOf(fortune.branch)
    const decade = chart.fortune.decades.find((d) => d.startYear <= year && year <= d.endYear)
    const relations = [
      ...pillars.flatMap(({ key, pillar }) =>
        relationsWith(fortune.stem, fortune.branch, pillar, key),
      ),
      ...(decade ? relationsWith(fortune.stem, fortune.branch, decade, 'decade') : []),
    ]
    const stemEl = ELEMENTS[stemElement(stemIdx)] as Element
    const branchEl = ELEMENTS[branchElement(branchIdx)] as Element
    result.push({
      year,
      stem: fortune.stem,
      branch: fortune.branch,
      elements: { stem: stemEl, branch: branchEl },
      stemTenGod: fortune.tenGod,
      branchTenGods: hiddenStemsOf(branchIdx).map(({ stem, qi }) => ({
        stem: STEMS[stem] as Stem,
        qi,
        tenGod: tenGodOf(dayStem, stem),
      })),
      decadeIndex: decade?.index ?? null,
      decade: decade ? { stem: decade.stem, branch: decade.branch } : null,
      decadeStart: decade?.startYear === year,
      relations,
      taiSui: taiSuiOf(fortune.branch, chart.pillars.year.branch),
      favorable: { stem: roleOf(chart, stemEl), branch: roleOf(chart, branchEl) },
    })
  }
  return { startYear, years: result, approximate: !chart.hourKnown }
}

/** 大运补充：地支本气十神与干支五行喜忌（spec「大运补充数据」） */
export function decadeDetails(chart: BaziChart): DecadeDetail[] {
  const dayStem = STEMS.indexOf(chart.dayMaster)
  return chart.fortune.decades.map((d) => {
    const branchIdx = BRANCHES.indexOf(d.branch)
    const main = hiddenStemsOf(branchIdx)[0]?.stem ?? 0
    return {
      index: d.index,
      branchTenGod: tenGodOf(dayStem, main),
      favorable: {
        stem: roleOf(chart, ELEMENTS[stemElement(STEMS.indexOf(d.stem))] as Element),
        branch: roleOf(chart, ELEMENTS[branchElement(branchIdx)] as Element),
      },
    }
  })
}
