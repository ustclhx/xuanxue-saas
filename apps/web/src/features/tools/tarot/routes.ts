import type { SpreadId } from '@xuanxue/tarot'
import type { ToolRoute } from '../registry.ts'

/**
 * 塔罗牌阵页路由（openspec add-tarot-reading 决策 5）：西方站 `/tarot/…`，东方站 `/塔羅/…`、`/타로/…`。
 * 注册表、预渲染与站点地图都从这里读取，因此只引用类型，不引用任何运行时模块。
 */
export type TarotLocale = 'en' | 'zh-Hant' | 'ko'
export const TAROT_LOCALES: readonly TarotLocale[] = ['en', 'zh-Hant', 'ko']

/** 牌阵顺序：三张牌是主牌阵（根路径），其余为子路径；互导矩阵按此顺序排列 */
export const TAROT_SPREADS: readonly SpreadId[] = [
  'three-card',
  'daily',
  'yes-or-no',
  'celtic-cross',
]

export const TAROT_ROOTS: Readonly<Record<TarotLocale, string>> = {
  en: '/tarot',
  'zh-Hant': '/塔羅',
  ko: '/타로',
}

// 子路径段；三张牌为空，即根路径
const SLUGS: Readonly<Record<SpreadId, Readonly<Record<TarotLocale, string>>>> = {
  'three-card': { en: '', 'zh-Hant': '', ko: '' },
  daily: { en: 'daily', 'zh-Hant': '每日一張', ko: '오늘의-카드' },
  'yes-or-no': { en: 'yes-or-no', 'zh-Hant': '是非', ko: '예-아니오' },
  'celtic-cross': { en: 'celtic-cross', 'zh-Hant': '凱爾特十字', ko: '켈틱-크로스' },
}

const TITLES: Readonly<Record<SpreadId, Readonly<Record<TarotLocale, string>>>> = {
  'three-card': { en: 'Three-Card Tarot', 'zh-Hant': '三張牌塔羅', ko: '쓰리 카드 타로' },
  daily: { en: 'Card of the Day', 'zh-Hant': '每日一張塔羅', ko: '오늘의 타로 카드' },
  'yes-or-no': { en: 'Yes or No Tarot', 'zh-Hant': '是非塔羅', ko: '예/아니오 타로' },
  'celtic-cross': {
    en: 'Celtic Cross Tarot',
    'zh-Hant': '凱爾特十字塔羅',
    ko: '켈틱 크로스 타로',
  },
}

const DESCRIPTIONS: Readonly<Record<SpreadId, Readonly<Record<TarotLocale, string>>>> = {
  'three-card': {
    en: 'Free three-card tarot: shuffle, cut and reveal past, present and future cards with Rider–Waite–Smith imagery. For reflection only.',
    'zh-Hant':
      '免費三張牌塔羅：洗牌、切牌，翻開過去、現在、未來三張偉特塔羅牌，作為自我省思的參考。',
    ko: '무료 쓰리 카드 타로: 셔플하고 컷한 뒤 과거·현재·미래 세 장의 라이더–웨이트 카드를 펼쳐 보세요. 성찰용입니다.',
  },
  daily: {
    en: 'Draw one free tarot card of the day as a theme to reflect on, with upright and reversed keywords.',
    'zh-Hant': '每天免費抽一張塔羅牌，作為今日省思的主題，附正位與逆位關鍵詞。',
    ko: '매일 무료로 타로 카드 한 장을 뽑아 오늘 돌아볼 주제로 삼아 보세요. 정방향·역방향 키워드를 함께 보여 줍니다.',
  },
  'yes-or-no': {
    en: 'Free yes or no tarot: draw one card and see Yes, No or Maybe from a fixed, published card mapping.',
    'zh-Hant': '免費是非塔羅：抽一張牌，依公開的固定對照表顯示「是／否／也許」與判定依據。',
    ko: '무료 예/아니오 타로: 카드 한 장을 뽑고 공개된 고정 대응표에 따른 예·아니요·아마도와 그 근거를 확인하세요.',
  },
  'celtic-cross': {
    en: 'Free Celtic Cross tarot: a ten-card spread for exploring a situation in depth, with every position explained.',
    'zh-Hant': '免費凱爾特十字塔羅：十張牌的經典牌陣，逐一說明每個牌位，深入梳理一個處境。',
    ko: '무료 켈틱 크로스 타로: 열 장으로 상황을 깊이 살펴보는 고전 배열이며, 모든 자리의 의미를 설명합니다.',
  },
}

/** 牌阵页路径（不含语言前缀） */
export function tarotPath(spread: SpreadId, locale: TarotLocale): string {
  const slug = SLUGS[spread][locale]
  return slug ? `${TAROT_ROOTS[locale]}/${slug}` : TAROT_ROOTS[locale]
}

/** 当前语言下子路径段对应的牌阵；根路径为三张牌，其他语言的路径段不匹配 */
export function spreadForSlug(locale: TarotLocale, slug?: string): SpreadId | undefined {
  const value = slug ?? ''
  return TAROT_SPREADS.find((spread) => SLUGS[spread][locale] === value)
}

export function tarotTitle(spread: SpreadId, locale: TarotLocale): string {
  return TITLES[spread][locale]
}

export function tarotDescription(spread: SpreadId, locale: TarotLocale): string {
  return DESCRIPTIONS[spread][locale]
}

function byLocale(value: (locale: TarotLocale) => string): Record<TarotLocale, string> {
  return { en: value('en'), 'zh-Hant': value('zh-Hant'), ko: value('ko') }
}

/**
 * 每个牌阵在两站各登记一条：同一组三语路径互为 hreflang，站点地图与预渲染按所属站点的语言筛选。
 * 只有主牌阵进页头导航，其余牌阵经页内互导矩阵到达。
 */
export const TAROT_TOOL_ROUTES: readonly ToolRoute[] = TAROT_SPREADS.flatMap((spread) =>
  (['west', 'east'] as const).map((site) => ({
    id: `tarot-${spread}`,
    site,
    paths: byLocale((locale) => tarotPath(spread, locale)),
    titles: byLocale((locale) => tarotTitle(spread, locale)),
    descriptions: byLocale((locale) => tarotDescription(spread, locale)),
    ...(spread === 'three-card' ? {} : { nav: false }),
  })),
)
