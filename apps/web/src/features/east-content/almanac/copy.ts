import { ALMANAC_LOCALE, type AlmanacLocale } from './paths.ts'

/**
 * 黄历页面的界面文字与 TDK（结构与说明文字以设计稿 content-growth-phase2/AlmanacTool、AlmanacMonth 为准）。
 * 逐页撰写的说明在 content/almanac/<locale>。月份页标题与 H1 用「每日宜忌」，不用「吉日」
 * （使用者 2026-11-22 确认设计稿时选定）。
 * zh-Hant 農民曆（content-growth-v2-tools 第 18 组）按台湾、香港用语另写，不是简体的字形转换；
 * 多一行胎神占方，沖煞写成「沖猴(戊申) 煞北」。
 */
export interface AlmanacCopy {
  readonly home: string
  readonly toolCrumb: string
  readonly toolH1: string
  readonly dateLabel: string
  readonly previousDay: string
  readonly nextDay: string
  readonly submit: string
  readonly hint: string
  readonly invalid: (from: number, to: number) => string
  readonly errorAlert: string
  readonly backToToday: string
  readonly todayTag: string
  readonly queryNote: string
  readonly loading: (date: string) => string
  readonly readable: (year: number, month: number, day: number) => string
  readonly resultLabel: string
  readonly resultTitle: (pillar: string) => string
  readonly pillarYear: string
  readonly pillarMonth: string
  readonly pillarDay: string
  readonly yi: string
  readonly ji: string
  readonly empty: string
  readonly separator: string
  readonly dutyLabel: string
  readonly dutyValue: (name: string) => string
  readonly starLabel: string
  readonly clashLabel: string
  readonly clashValue: (zodiac: string, pillar: string, sha: string) => string
  /** 胎神行：只有 zh-Hant 显示（null 时不渲染） */
  readonly fetusLabel: string | null
  readonly fetusNote: string
  readonly termLabel: string
  readonly copyLink: string
  readonly copied: string
  readonly copyHint: string
  readonly disclaimer: string
  readonly monthLinks: (
    current: string,
    next: string,
  ) => { before: string; current: string; middle: string; next: string; after: string }
  readonly monthsTitle: string
  readonly monthsIntro: string
  readonly monthsNav: string
  readonly monthLabel: (month: number) => string
  readonly faqTitle: string
  // 月份页
  readonly termsTitle: string
  readonly termTile: string
  readonly termWhen: (when: string, time: string) => string
  readonly termRepeat: (duty: string) => string
  readonly branchTile: string
  readonly branchNote: (when: string, term: string, from: string, to: string) => string
  readonly lunarTile: string
  readonly lunarNote: (when: string, name: string) => string
  readonly noSeasonal: string
  readonly seasonal: (items: string) => string
  readonly seasonalJoin: string
  readonly daysTitle: string
  readonly daysIntro: string
  readonly rollover: (month: number, year: number, nextYear: number) => string
  readonly rolloverFuture: (month: number, year: number) => string
  readonly columns: readonly string[]
  /** 农历是否单独一列（繁中并入日期列） */
  readonly lunarColumn: boolean
  readonly dayCell: (month: number, day: number, weekday: string, lunar: string) => string
  /** 逐日表宜、忌先显示的条数，其余收进 details */
  readonly yiVisible: number
  readonly jiVisible: number
  readonly starCell: (name: string, ecliptic: string) => string
  readonly clashCell: (zodiac: string, pillar: string, sha: string) => string
  readonly more: (count: number) => string
  readonly band: string
  readonly bandLink: string
  readonly bandAfter: string
  readonly readingTitle: string
  readonly seriesLabel: string
  readonly previousMonth: string
  readonly nextMonth: string
  readonly monthTitleMain: (month: number) => string
  readonly monthH1: (year: number, month: number) => string
  readonly monthTitle: (year: number, month: number, terms: readonly string[]) => string
  readonly monthDescription: (year: number, month: number, terms: readonly string[]) => string
}

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
  readable: (year: number, month: number, day: number) => `${year} 年 ${month} 月 ${day} 日`,
  resultLabel: '当日黄历',
  resultTitle: (pillar: string) => `${pillar}日`,
  pillarYear: '年',
  pillarMonth: '月',
  pillarDay: '日',
  yi: '宜',
  ji: '忌',
  empty: '本栏没有可显示的词条。',
  separator: '、',
  dutyLabel: '建除十二值星',
  dutyValue: (name: string) => `${name}日`,
  starLabel: '黄道黑道（十二神）',
  clashLabel: '冲煞',
  clashValue: (zodiac: string, _pillar: string, sha: string) => `冲${zodiac} · 煞${sha}`,
  fetusLabel: null,
  fetusNote: '',
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
  monthLabel: (month: number) => `${month}月`,
  faqTitle: '常见问题',
  // 月份页
  termsTitle: '本月节气与节令',
  termTile: '节气',
  termWhen: (when: string, time: string) => `${when} ${time}交节（北京时间）`,
  termRepeat: (duty: string) => `。当天的值星与前一天相同，都是“${duty}”。`,
  branchTile: '月建',
  branchNote: (when: string, term: string, from: string, to: string) =>
    `${when}起，表中月柱由${from}转为${to}。${term ? `对应节气：${term}。` : ''}`,
  lunarTile: '农历月界与节令',
  lunarNote: (when: string, name: string) => `${when}进入农历${name.replace(/初一$/, '')}。`,
  noSeasonal: '本月没有已收录的节日或节令起始标记。',
  seasonal: (items: string) => `节日与节令：${items}。`,
  seasonalJoin: '；',
  daysTitle: '本月每日黄历',
  daysIntro:
    '宜先显示前 4 项，忌先显示前 3 项，点击「另 N 项」展开其余词条。词条按通书原样列出，不显示医疗、诉讼类与概括整日宜忌的词条。',
  rollover: (month: number, year: number, nextYear: number) =>
    `本页显示 ${year} 年 ${month} 月。到下月 1 日 0:00（北京时间）更新为 ${nextYear} 年 ${month} 月。`,
  rolloverFuture: (month: number, year: number) => `本页显示 ${year} 年 ${month} 月。`,
  columns: ['公历', '农历', '干支', '建除', '黄道黑道', '冲煞', '宜', '忌'],
  lunarColumn: true,
  dayCell: (month: number, day: number, weekday: string, _lunar: string) =>
    `${month}月${day}日 ${weekday}`,
  yiVisible: 4,
  jiVisible: 3,
  starCell: (name: string, ecliptic: string) => `${name}（${ecliptic}）`,
  clashCell: (zodiac: string, _pillar: string, sha: string) => `冲${zodiac} 煞${sha}`,
  more: (count: number) => `另 ${count} 项`,
  band: '想查其他日期？',
  bandLink: '黄历查询',
  bandAfter: '可按公历日期查询，并查看各栏的说明。',
  readingTitle: '怎么读本月的宜忌',
  seriesLabel: '相邻月份',
  previousMonth: '上一个月',
  nextMonth: '下一个月',
  monthTitleMain: (month: number) => `${month}月黄历`,
  /** 月份页 H1：「11月黄历：2026年11月每日宜忌一览」 */
  monthH1: (year: number, month: number) => `${month}月黄历：${year}年${month}月每日宜忌一览`,
  /** 月份页 Title（不含站名）：H1 加本月两个节气，各月两两不同 */
  monthTitle: (year: number, month: number, terms: readonly string[]) =>
    `${month}月黄历：${year}年${month}月每日宜忌一览（${terms.join('、')}）`,
  monthDescription: (year: number, month: number, terms: readonly string[]) =>
    `${year}年${month}月黄历：逐日列出公历与农历、日干支、建除值星、黄道黑道、冲煞与宜忌，并说明本月${terms.join('、')}两个节气与月建的变化。依传统历法推算，仅供参考。`,
} as const satisfies AlmanacCopy

/** 農民曆（zh-Hant）：台湾、香港的农民历用语，国历为公历 */
const ZH_HANT_COPY: AlmanacCopy = {
  home: '首頁',
  toolCrumb: '農民曆',
  toolH1: '農民曆查詢',
  dateLabel: '國曆日期',
  previousDay: '上一日',
  nextDay: '下一日',
  submit: '查看',
  hint: '以 UTC+8（台灣、香港時間）午夜 12 點換日；同一天人人看到的內容一樣，不必輸入生辰。',
  invalid: (from: number, to: number) => `查無此日，或不在 ${from} 至 ${to} 年的可查範圍內。`,
  errorAlert: '這一天的農民曆暫時顯示不出來，請確認日期後再查一次。',
  backToToday: '看今天',
  todayTag: '今日',
  queryNote: '目前顯示的是你選的日子。',
  loading: (date: string) => `${date} 計算中…`,
  readable: (year: number, month: number, day: number) => `${year}/${month}/${day}`,
  resultLabel: '本日農民曆',
  resultTitle: (pillar: string) => `${pillar}日`,
  pillarYear: '年柱',
  pillarMonth: '月柱',
  pillarDay: '日柱',
  yi: '宜',
  ji: '忌',
  empty: '這一欄今日沒有列出項目。',
  separator: ' ',
  dutyLabel: '十二建星',
  dutyValue: (name: string) => `${name}日`,
  starLabel: '十二神（黃道／黑道）',
  clashLabel: '沖煞',
  clashValue: (zodiac: string, pillar: string, sha: string) => `沖${zodiac}(${pillar}) 煞${sha}`,
  fetusLabel: '胎神占方',
  fetusNote:
    '胎神是民俗中守護胎兒的神祇，按日柱的天干、地支輪流落在門、灶、床等位置與方位，舊時用來提醒家中動土、搬移家具時留意。此處照錄傳統排法，僅供認識民俗。',
  termLabel: '節氣',
  copyLink: '複製這一天的連結',
  copied: '連結已複製',
  copyHint: '連結裡帶著日期，分享出去，對方打開看到的也是這一天。',
  disclaimer: '依傳統曆法推算，僅供參考與潛意識探索，不預測未來；身體不適請洽詢醫師。',
  monthLinks: (current: string, next: string) => ({
    before: '想一次看完整個月，可以翻',
    current,
    middle: '或',
    next,
    after: '，月份頁另附當月兩個節氣的交節時間。',
  }),
  monthsTitle: '十二個月的農民曆',
  monthsIntro: '點選月份，逐日對照日柱、建星、十二神、沖煞、胎神與宜忌，並附當月節氣交節的時間。',
  monthsNav: '選擇月份',
  monthLabel: (month: number) => `${month}月`,
  faqTitle: '問與答',
  // 月份頁
  termsTitle: '本月節氣與月令',
  termTile: '交節',
  termWhen: (when: string, time: string) => `${when} ${time}（UTC+8）`,
  termRepeat: (duty: string) => `；交節日與前一日同為「${duty}」。`,
  branchTile: '月令更替',
  branchNote: (when: string, term: string, from: string, to: string) =>
    `${term ? `${term}當天` : when}換月，月柱從${from}改為${to}。`,
  lunarTile: '農曆初一與節日',
  lunarNote: (when: string, name: string) => `${name.replace(/初一$/, '')}從${when}開始。`,
  noSeasonal: '本月沒有收錄的節日或節令。',
  seasonal: (items: string) => `節日、節令：${items}。`,
  seasonalJoin: '，',
  daysTitle: '逐日宜忌對照',
  daysIntro:
    '宜先列五項、忌先列四項，按「還有 N 項」可看全部；項目依通書原有次序排列，求醫、訴訟一類與總括一整天的字眼不列出。',
  rollover: (month: number, year: number, nextYear: number) =>
    `目前是 ${year} 年 ${month} 月；下個月 1 日零時（UTC+8）起改為 ${nextYear} 年 ${month} 月。`,
  rolloverFuture: (month: number, year: number) => `目前是 ${year} 年 ${month} 月。`,
  columns: ['國曆・農曆', '日柱', '建星', '十二神', '沖煞', '胎神', '宜', '忌'],
  lunarColumn: false,
  dayCell: (month: number, day: number, weekday: string, lunar: string) =>
    `${month}/${day} ${weekday}・${lunar}`,
  yiVisible: 5,
  jiVisible: 4,
  starCell: (name: string, ecliptic: string) => `${name}・${ecliptic}`,
  clashCell: (zodiac: string, pillar: string, sha: string) => `沖${zodiac}(${pillar})煞${sha}`,
  more: (count: number) => `還有 ${count} 項`,
  band: '要查別的日子？',
  bandLink: '農民曆查詢',
  bandAfter: '輸入國曆日期即可，各欄也附有說明。',
  readingTitle: '這個月怎麼讀',
  seriesLabel: '前後月份',
  previousMonth: '上個月',
  nextMonth: '下個月',
  monthTitleMain: (month: number) => `${month}月農民曆`,
  /** 月份頁 H1：「11月農民曆：2026年11月每日宜忌」 */
  monthH1: (year: number, month: number) => `${month}月農民曆：${year}年${month}月每日宜忌`,
  monthTitle: (year: number, month: number, terms: readonly string[]) =>
    `${month}月農民曆｜${year}年${month}月每日宜忌與${terms.join('、')}`,
  monthDescription: (year: number, month: number, terms: readonly string[]) =>
    `${year}年${month}月農民曆，逐日對照國曆、農曆、日柱、建星、沖煞、胎神占方與宜忌，附${terms.join('、')}交節時間與月令更替說明。依傳統曆法推算，僅供參考。`,
}

export function almanacCopy(locale: AlmanacLocale = ALMANAC_LOCALE): AlmanacCopy {
  return locale === 'zh-Hant' ? ZH_HANT_COPY : ALMANAC_COPY
}

/** 宜、忌在逐日表中先显示的条数（design 决策 5），其余收进 details；繁中见 ZH_HANT_COPY */
export const YI_VISIBLE = ALMANAC_COPY.yiVisible
export const JI_VISIBLE = ALMANAC_COPY.jiVisible

export const monthTitleMain = (month: number, locale: AlmanacLocale = ALMANAC_LOCALE) =>
  almanacCopy(locale).monthTitleMain(month)

/** 月份页 H1：「11月黄历：2026年11月每日宜忌一览」 */
export const monthH1 = (year: number, month: number, locale: AlmanacLocale = ALMANAC_LOCALE) =>
  almanacCopy(locale).monthH1(year, month)

/** 月份页 Title（不含站名）：H1 加本月两个节气，各月两两不同 */
export const monthTitle = (
  year: number,
  month: number,
  terms: readonly string[],
  locale: AlmanacLocale = ALMANAC_LOCALE,
) => almanacCopy(locale).monthTitle(year, month, terms)

export const monthDescription = (
  year: number,
  month: number,
  terms: readonly string[],
  locale: AlmanacLocale = ALMANAC_LOCALE,
) => almanacCopy(locale).monthDescription(year, month, terms)
