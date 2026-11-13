import type { Pillars } from '@xuanxue/bazi'

/**
 * 虚构样例命盘：1990-05-15 10:30 台北 男（visual-system.md 与设计稿的样例）。
 * 首页样例与 OG 只渲染图形，不能为此加载排盘引擎（首页包预算），因此把引擎输出固化在这里；
 * `charts.test.tsx` 断言它与引擎计算结果一致，引擎规则变化时测试会提示更新。
 */
export const SAMPLE_BAZI_PILLARS: Pillars = {
  year: {
    stem: 'geng',
    branch: 'wu',
    tenGod: 'biJian',
    hiddenStems: [
      { stem: 'ding', qi: 'main', tenGod: 'zhengGuan' },
      { stem: 'ji', qi: 'middle', tenGod: 'zhengYin' },
    ],
  },
  month: {
    stem: 'xin',
    branch: 'si',
    tenGod: 'jieCai',
    hiddenStems: [
      { stem: 'bing', qi: 'main', tenGod: 'qiSha' },
      { stem: 'geng', qi: 'middle', tenGod: 'biJian' },
      { stem: 'wu', qi: 'residual', tenGod: 'pianYin' },
    ],
  },
  day: {
    stem: 'geng',
    branch: 'chen',
    tenGod: null,
    hiddenStems: [
      { stem: 'wu', qi: 'main', tenGod: 'pianYin' },
      { stem: 'yi', qi: 'middle', tenGod: 'zhengCai' },
      { stem: 'gui', qi: 'residual', tenGod: 'shangGuan' },
    ],
  },
  hour: {
    stem: 'xin',
    branch: 'si',
    tenGod: 'jieCai',
    hiddenStems: [
      { stem: 'bing', qi: 'main', tenGod: 'qiSha' },
      { stem: 'geng', qi: 'middle', tenGod: 'biJian' },
      { stem: 'wu', qi: 'residual', tenGod: 'pianYin' },
    ],
  },
}

/** 西方站样例：1990-05-15（May 15, 1990 → Life Path 3），与设计稿一致 */
export const SAMPLE_BIRTH_DATE = { year: 1990, month: 5, day: 15 } as const
