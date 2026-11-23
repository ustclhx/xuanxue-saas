import type { Branch } from '@xuanxue/bazi'
import type { TaiSuiRelation } from './page.functions.ts'

/**
 * 年度太歲页的界面文字（zh-Hant，台湾、香港用语）。逐页撰写的说明在 content/tai-sui-year/zh-Hant。
 * 关系名只作传统分类，不附吉凶断语；不出现消灾方法、法會報名或商品。
 */
const STEMS: Readonly<Record<string, string>> = {
  jia: '甲',
  yi: '乙',
  bing: '丙',
  ding: '丁',
  wu: '戊',
  ji: '己',
  geng: '庚',
  xin: '辛',
  ren: '壬',
  gui: '癸',
}

const BRANCHES: Readonly<Record<Branch, { readonly hanzi: string; readonly zodiac: string }>> = {
  zi: { hanzi: '子', zodiac: '鼠' },
  chou: { hanzi: '丑', zodiac: '牛' },
  yin: { hanzi: '寅', zodiac: '虎' },
  mao: { hanzi: '卯', zodiac: '兔' },
  chen: { hanzi: '辰', zodiac: '龍' },
  si: { hanzi: '巳', zodiac: '蛇' },
  wu: { hanzi: '午', zodiac: '馬' },
  wei: { hanzi: '未', zodiac: '羊' },
  shen: { hanzi: '申', zodiac: '猴' },
  you: { hanzi: '酉', zodiac: '雞' },
  xu: { hanzi: '戌', zodiac: '狗' },
  hai: { hanzi: '亥', zodiac: '豬' },
}

/** tyme4ts Sound 序号（甲子乙丑 = 0）对应的納音 */
const NAYIN = [
  '海中金',
  '爐中火',
  '大林木',
  '路旁土',
  '劍鋒金',
  '山頭火',
  '澗下水',
  '城頭土',
  '白蠟金',
  '楊柳木',
  '泉中水',
  '屋上土',
  '霹靂火',
  '松柏木',
  '長流水',
  '沙中金',
  '山下火',
  '平地木',
  '壁上土',
  '金箔金',
  '覆燈火',
  '天河水',
  '大驛土',
  '釵釧金',
  '桑柘木',
  '大溪水',
  '沙中土',
  '天上火',
  '石榴木',
  '大海水',
] as const

const RELATION: Readonly<Record<TaiSuiRelation, string>> = {
  zhi: '值太歲',
  chong: '沖太歲',
  xing: '刑太歲',
  hai: '害太歲',
  po: '破太歲',
  sixCombine: '六合',
  triad: '三合',
}

export const TAI_SUI_COPY = {
  home: '首頁',
  almanacCrumb: '農民曆',
  crumb: (year: number) => `${year}太歲`,
  stem: (key: string) => STEMS[key] ?? '',
  branch: (key: Branch) => BRANCHES[key].hanzi,
  zodiac: (key: Branch) => BRANCHES[key].zodiac,
  nayin: (index: number) => NAYIN[index] ?? '',
  relation: (key: TaiSuiRelation) => RELATION[key],
  /** 太歲五类关系（值、沖、刑、害、破）；六合、三合只作对照 */
  isTaiSui: (key: TaiSuiRelation) => key !== 'sixCombine' && key !== 'triad',
  factsLabel: '年份資料',
  factYear: '干支',
  factNayin: '納音',
  factLichun: '立春',
  factLunarNewYear: '春節（農曆正月初一）',
  monthDay: (month: number, day: number) => `${month}月${day}日`,
  tableTitle: (year: number, ganzhi: string) => `${year}${ganzhi}年：十二生肖對照`,
  tableCaption: (year: number) => `${year}年十二生肖與太歲的關係及出生年份`,
  colZodiac: '生肖',
  colRelation: '與太歲的關係',
  colYears: '國曆出生年（立春後出生）',
  colYearsShort: '出生年',
  none: '—',
  zodiacCell: (zodiac: string, branch: string) => `屬${zodiac}（${branch}）`,
  yearsJoin: '、',
  faqTitle: '問與答',
  disclaimer: '依傳統曆法推算，僅供參考與潛意識探索，不預測未來。',
} as const
