import {
  BRANCHES,
  type Branch,
  branchElement,
  branchIndex,
  ELEMENTS,
  type Element,
  mod,
  STEMS,
  type Stem,
} from './constants.ts'
import { type BranchRelationType, branchRelations } from './relations.ts'

type ZodiacRelation = BranchRelationType | 'break'
type ZodiacTaiSui = 'zhi' | 'chong' | 'xing' | 'hai' | 'po'
type ElementRelation = 'same' | 'aGeneratesB' | 'bGeneratesA' | 'aOvercomesB' | 'bOvercomesA'

export type ZodiacPairFacts = {
  branches: [Branch, Branch]
  relations: ZodiacRelation[]
  elements: [Element, Element]
  elementRelation: ElementRelation
}

export type ZodiacYearFacts = {
  year: number
  cycleIndex: number
  stem: Stem
  branch: Branch
  rows: { branch: Branch; relations: ZodiacRelation[]; taiSui: ZodiacTaiSui[] }[]
}

const BREAK_PARTNER: Record<Branch, Branch> = {
  zi: 'you',
  chou: 'chen',
  yin: 'hai',
  mao: 'wu',
  chen: 'chou',
  si: 'shen',
  wu: 'mao',
  wei: 'xu',
  shen: 'si',
  you: 'zi',
  xu: 'wei',
  hai: 'yin',
}

function zodiacRelations(a: Branch, b: Branch): ZodiacRelation[] {
  const relations: ZodiacRelation[] = branchRelations(a, b)
  if (BREAK_PARTNER[a] === b) relations.push('break')
  return relations
}

// 五行按木火土金水排列，下一位为所生，隔一位为所克。方向按调用时的两支顺序输出。
const ELEMENT_RELATIONS: readonly ElementRelation[] = [
  'same',
  'aGeneratesB',
  'aOvercomesB',
  'bOvercomesA',
  'bGeneratesA',
]

export function zodiacPairFacts(a: Branch, b: Branch): ZodiacPairFacts {
  const aElement = branchElement(branchIndex(a))
  const bElement = branchElement(branchIndex(b))
  return {
    branches: [a, b],
    relations: zodiacRelations(a, b),
    elements: [ELEMENTS[aElement] as Element, ELEMENTS[bElement] as Element],
    elementRelation: ELEMENT_RELATIONS[
      mod(bElement - aElement, ELEMENTS.length)
    ] as ElementRelation,
  }
}

/** 按地支顺序列出 12 组同支与 66 组不同支，供总表共用。 */
export function zodiacPairTable(): ZodiacPairFacts[] {
  return BRANCHES.flatMap((a, index) => BRANCHES.slice(index).map((b) => zodiacPairFacts(a, b)))
}

const TAI_SUI_BY_RELATION: Partial<Record<ZodiacRelation, ZodiacTaiSui>> = {
  clash: 'chong',
  punish: 'xing',
  harm: 'hai',
  break: 'po',
}

export function zodiacYearFacts(year: number): ZodiacYearFacts {
  if (!Number.isSafeInteger(year) || year < 1) throw new RangeError('Invalid zodiac year')
  const cycleIndex = mod(year - 1924, 60) // 1924 为甲子年，与 zodiacYears 的起点一致。
  const branch = BRANCHES[cycleIndex % BRANCHES.length] as Branch
  return {
    year,
    cycleIndex,
    stem: STEMS[cycleIndex % STEMS.length] as Stem,
    branch,
    rows: BRANCHES.map((natalBranch) => {
      const relations = zodiacRelations(natalBranch, branch)
      const taiSui: ZodiacTaiSui[] = natalBranch === branch ? ['zhi'] : []
      // 同支可以同时值与自刑；不同支也可能同时落入数种关系。
      for (const relation of relations) {
        const key = TAI_SUI_BY_RELATION[relation]
        if (key) taiSui.push(key)
      }
      return { branch: natalBranch, relations, taiSui }
    }),
  }
}
