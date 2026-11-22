/**
 * 黄历页面的界面文字与 TDK（只有 zh-hans，design 决策 6；结构与说明文字以设计稿
 * content-growth-phase2/AlmanacTool、AlmanacMonth 为准）。逐页撰写的说明在 content/almanac/zh-Hans。
 * 月份页标题与 H1 用「每日宜忌」，不用「吉日」（使用者 2026-11-22 确认设计稿时选定）。
 */

export const ALMANAC_COPY = {
  home: '首页',
  toolCrumb: '黄历',
  toolH1: '黄历查询',
  dateLabel: '日期（公历）',
  previousDay: '前一天',
  nextDay: '后一天',
  submit: '查询',
  hint: '按北京时间 0:00 换日。结果对所有人相同，不需要输入生日。',
  invalid: (from: number, to: number) => `这个日期不存在，或超出可查询范围（${from}–${to} 年）。`,
  errorAlert: '无法显示这一天的黄历。请检查日期后重新查询。',
  backToToday: '回到今天',
  todayTag: '今天',
  queryNote: '这是所选日期的结果。',
  loading: (date: string) => `正在计算 ${date} …`,
  resultLabel: '当日黄历',
  pillarYear: '年',
  pillarMonth: '月',
  pillarDay: '日',
  yi: '宜',
  ji: '忌',
  empty: '当日没有可显示的词条。',
  dutyLabel: '建除十二值星',
  dutyValue: (name: string) => `${name}日`,
  starLabel: '黄道黑道（十二神）',
  clashLabel: '冲煞',
  clashValue: (zodiac: string, sha: string) => `冲${zodiac} · 煞${sha}`,
  termLabel: '节气',
  copyLink: '复制当日链接',
  copied: '已复制链接',
  copyHint: '链接带有所选日期，打开后看到同一天的结果。',
  disclaimer: '依据传统历法推算，仅供参考与潜意识探索，不预测未来。健康相关问题请咨询专业医师。',
  monthLinks: (current: string, next: string) => ({
    before: '整月的逐日对照见',
    current,
    middle: '与',
    next,
    after: '，每个月份页都列出当月两个节气的交节时刻。',
  }),
  monthsTitle: '按月份查看',
  monthsIntro:
    '每个月份页列出当月每天的干支、建除、黄道黑道、冲煞与宜忌，以及当月两个节气的交节时刻。',
  monthsNav: '月份',
  faqTitle: '常见问题',
  // 月份页
  termsTitle: '本月节气与节令',
  termTile: '节气',
  termWhen: (when: string, time: string) => `${when}${time} 交节`,
  termRepeat: (duty: string) => `，当天与前一天同为${duty}日`,
  branchTile: '月建',
  branchNote: (when: string, term: string, from: string, to: string) =>
    `${when}${term}起，月柱由${from}转为${to}。`,
  lunarTile: '农历月界与节令',
  lunarNote: (when: string, name: string) => `${when}进入农历${name.replace(/初一$/, '')}。`,
  noSeasonal: '本月没有三伏、数九、入梅等节令。',
  seasonal: (items: string) => `节日与节令：${items}。`,
  daysTitle: '本月每日黄历',
  daysIntro:
    '宜最多先显示 4 项、忌最多 3 项，其余点「另 N 项」展开。词条按通书原样列出，不显示医疗、诉讼类与断语式的词条。',
  rollover: (month: number, year: number, nextYear: number) =>
    `本页显示最近一个还没有过完的 ${month} 月，现在是 ${year} 年 ${month} 月；这个月过完后（北京时间），改为显示 ${nextYear} 年 ${month} 月。`,
  rolloverFuture: (month: number, year: number) =>
    `本页显示最近一个还没有过完的 ${month} 月，即 ${year} 年 ${month} 月。`,
  columns: ['公历', '农历', '干支', '建除', '黄道黑道', '冲煞', '宜', '忌'] as const,
  starCell: (name: string, ecliptic: string) => `${name}（${ecliptic}）`,
  clashCell: (zodiac: string, sha: string) => `冲${zodiac} 煞${sha}`,
  more: (count: number) => `另 ${count} 项`,
  band: '想查表里没有的日子？',
  bandLink: '黄历查询',
  bandAfter: '可以选择任意一天，并附每一项的说明。',
  readingTitle: '怎么读本月的宜忌',
  seriesLabel: '相邻月份',
  previousMonth: '上一个月',
  nextMonth: '下一个月',
} as const

/** 宜、忌在逐日表中先显示的条数（design 决策 5），其余收进 details */
export const YI_VISIBLE = 4
export const JI_VISIBLE = 3

export const monthTitleMain = (month: number) => `${month}月黄历`

/** 月份页 H1：「11月黄历：2026年11月每日宜忌一览」 */
export const monthH1 = (year: number, month: number) =>
  `${month}月黄历：${year}年${month}月每日宜忌一览`

/** 月份页 Title（不含站名）：H1 加本月两个节气，各月两两不同 */
export const monthTitle = (year: number, month: number, terms: readonly string[]) =>
  `${monthH1(year, month)}（${terms.join('、')}）`

export const monthDescription = (year: number, month: number, terms: readonly string[]) =>
  `${year}年${month}月黄历：逐日列出公历与农历、日干支、建除值星、黄道黑道、冲煞与宜忌，并说明本月${terms.join('、')}两个节气与月建的变化。依传统历法推算，仅供参考。`
