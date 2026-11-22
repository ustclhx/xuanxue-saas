import type { Branch, Element } from '@xuanxue/bazi'

/**
 * 地支关系的固定口诀（客户端可用）：只引用引擎的类型，生肖页组件从这里取，不把 tyme4ts 带进客户端包
 * （check-bazi-build 的引擎预算）。服务端计算见 data.ts。
 */
/** 三合局按传统顺序（生、旺、墓）：申子辰水、巳酉丑金、寅午戌火、亥卯未木；序号为 triadOf 的组号 */
export const TRIADS: readonly {
  readonly branches: readonly Branch[]
  readonly element: Element
}[] = [
  { branches: ['shen', 'zi', 'chen'], element: 'water' },
  { branches: ['si', 'you', 'chou'], element: 'metal' },
  { branches: ['yin', 'wu', 'xu'], element: 'fire' },
  { branches: ['hai', 'mao', 'wei'], element: 'wood' },
]

/** 相刑的组：子卯、寅巳申、丑戌未（辰午酉亥为自刑） */
export const PUNISH_GROUPS: readonly (readonly Branch[])[] = [
  ['zi', 'mao'],
  ['yin', 'si', 'shen'],
  ['chou', 'xu', 'wei'],
]

export const SIX_COMBINE_PAIRS: readonly (readonly [Branch, Branch])[] = [
  ['zi', 'chou'],
  ['yin', 'hai'],
  ['mao', 'xu'],
  ['chen', 'you'],
  ['si', 'shen'],
  ['wu', 'wei'],
]

export const CLASH_PAIRS: readonly (readonly [Branch, Branch])[] = [
  ['zi', 'wu'],
  ['chou', 'wei'],
  ['yin', 'shen'],
  ['mao', 'you'],
  ['chen', 'xu'],
  ['si', 'hai'],
]
