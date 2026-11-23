import { zodiacPairFacts, zodiacPairTable, zodiacYearFacts } from '@xuanxue/bazi/almanac'
import { Solar } from 'lunar-javascript'
import { expect, it } from 'vitest'
import { BRANCHES, STEMS } from '../src/constants.ts'

const BRANCH_NAMES = [...'子丑寅卯辰巳午未申酉戌亥']
const STEM_NAMES = [...'甲乙丙丁戊己庚辛壬癸']
const ELEMENT_KEYS = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' } as const
const GENERATES = ['木火', '火土', '土金', '金水', '水木']
const OVERCOMES = ['木土', '土水', '水火', '火金', '金木']
const BREAKS = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'].map((pair) =>
  [...pair].sort().join(''),
)

function pairKey(a: string, b: string) {
  return [a, b].sort().join('')
}

function lunarReference() {
  const start = Solar.fromYmd(2027, 1, 1)
  const pairs = new Map<string, Set<string>>()
  const elements = new Map<string, string>()
  for (let day = 0; day < 365; day++) {
    const lunar = start.next(day).getLunar()
    const a: string = lunar.getMonthZhi()
    const b: string = lunar.getDayZhi()
    elements.set(b, lunar.getEightChar().getDayWuXing()[1])
    const key = pairKey(a, b)
    const relations = pairs.get(key) ?? new Set<string>()
    pairs.set(key, relations)
    const gods: string[] = [...lunar.getDayJiShen(), ...lunar.getDayXiongSha()]
    if (gods.includes('六合')) relations.add('sixCombine')
    if (gods.includes('三合')) relations.add('triad')
    if (lunar.getDayChong() === a) relations.add('clash')
    // 月刑有方向，取两种月支/日支顺序的并集供无序配对使用。
    if (gods.includes('月刑')) relations.add('punish')
    if (gods.includes('月害')) relations.add('harm')
  }
  // lunar-javascript 的「月破」指月支与日支相冲。生肖六破另用传统配对表核对。
  for (const pair of BREAKS) pairs.get(pair)?.add('break')
  return { pairs, elements }
}

function referenceDirection(a: string, b: string) {
  if (a === b) return 'same'
  if (GENERATES.includes(a + b)) return 'aGeneratesB'
  if (GENERATES.includes(b + a)) return 'bGeneratesA'
  return OVERCOMES.includes(a + b) ? 'aOvercomesB' : 'bOvercomesA'
}

it('78 组含同支配对与历书六合、三合、冲刑害、传统六破及五行方向一致', () => {
  const { pairs, elements } = lunarReference()
  const table = zodiacPairTable()
  expect(table.map(({ branches }) => branches)).toEqual(
    BRANCHES.flatMap((a, i) => BRANCHES.slice(i).map((b) => [a, b])),
  )
  expect(table).toHaveLength(78)
  expect(pairs.size).toBe(78)
  for (const row of table) {
    const [a, b] = row.branches
    const aName = BRANCH_NAMES[BRANCHES.indexOf(a)] as string
    const bName = BRANCH_NAMES[BRANCHES.indexOf(b)] as string
    const pair = pairKey(aName, bName)
    const aElement = elements.get(aName) as keyof typeof ELEMENT_KEYS
    const bElement = elements.get(bName) as keyof typeof ELEMENT_KEYS
    expect(new Set(row.relations), pair).toEqual(pairs.get(pair))
    expect(row.elements, pair).toEqual([ELEMENT_KEYS[aElement], ELEMENT_KEYS[bElement]])
    expect(row.elementRelation, pair).toBe(referenceDirection(aElement, bElement))
    expect(zodiacPairFacts(b, a), pair).toEqual({
      branches: [b, a],
      relations: row.relations,
      elements: [ELEMENT_KEYS[bElement], ELEMENT_KEYS[aElement]],
      elementRelation: referenceDirection(bElement, aElement),
    })
  }
})

it('2027 丁未年逐支核对，并保留同时发生的太岁关系', () => {
  const { pairs } = lunarReference()
  const lunar = Solar.fromYmd(2027, 2, 20).getLunar()
  const { year, cycleIndex, stem, branch, rows } = zodiacYearFacts(2027)
  expect({ year, cycleIndex, stem, branch }).toEqual({
    year: 2027,
    cycleIndex: 43,
    stem: 'ding',
    branch: 'wei',
  })
  expect(STEM_NAMES[STEMS.indexOf(stem)]).toBe(lunar.getYearGan())
  expect(BRANCH_NAMES[BRANCHES.indexOf(branch)]).toBe(lunar.getYearZhi())
  expect(rows.map((row) => row.branch)).toEqual(BRANCHES)
  for (const [i, row] of rows.entries()) {
    const name = BRANCH_NAMES[i] as string
    expect(new Set(row.relations), name).toEqual(pairs.get(pairKey(name, lunar.getYearZhi())))
  }
  expect(rows.map(({ taiSui }) => taiSui)).toEqual([
    ['hai'],
    ['chong', 'xing'],
    [],
    [],
    [],
    [],
    [],
    ['zhi'],
    [],
    [],
    ['xing', 'po'],
    [],
  ])
})
