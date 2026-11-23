import type { Branch, Element } from '@xuanxue/bazi'

/**
 * 生肖配对页与服务端共用的纯常量（不依赖引擎）：页面组件只从这里取运行时值，
 * 引擎计算留在 data.ts，由 page.functions.ts 在服务端调用，客户端不加载 tyme4ts（design 决策 4）。
 */

/** 总表格子的标记（设计稿 ZodiacGrid：三合、六合为合类，六冲、相害为冲类；相刑、相破只在配对页列出） */
export type PairMark = 'same' | 'sixCombine' | 'triad' | 'clash' | 'harm' | 'none'

export const ORDER: readonly Branch[] = [
  'zi',
  'chou',
  'yin',
  'mao',
  'chen',
  'si',
  'wu',
  'wei',
  'shen',
  'you',
  'xu',
  'hai',
]

/** 三合局组号 = 地支序号 mod 4：申子辰=0、巳酉丑=1、寅午戌=2、亥卯未=3 */
export const triadGroupOf = (branch: Branch) => ORDER.indexOf(branch) % 4

/** 三合局的成员（按生、旺、墓）与五行 */
export const TRIAD_GROUPS: readonly { branches: readonly Branch[]; element: Element }[] = [
  { branches: ['shen', 'zi', 'chen'], element: 'water' },
  { branches: ['si', 'you', 'chou'], element: 'metal' },
  { branches: ['yin', 'wu', 'xu'], element: 'fire' },
  { branches: ['hai', 'mao', 'wei'], element: 'wood' },
]
