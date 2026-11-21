// 注册表随主入口加载：只引用牌组清单，不引用三语牌义数据
import { CARDS } from '@xuanxue/tarot/cards'
import { localeText } from '../../i18n/split-messages.ts'
import type { ToolRoute } from '../registry.ts'
import {
  TAROT_LOCALES,
  TAROT_ROOTS,
  TAROT_SPREADS,
  type TarotLocale,
  tarotDescription,
  tarotPath,
  tarotSeoTitle,
  tarotTitle,
} from './routes.ts'

const SEGMENTS = {
  en: 'cards',
  'zh-Hant': '牌義',
  'zh-Hans': '牌义',
  ko: '카드',
  es: 'cartas',
  // 关键词地图 ja.md §8：日本用户搜索「タロット 意味」，路径段用「意味」
  ja: '意味',
} as const

/** 牌义使用牌组已有的 ASCII slug；语言前缀由 toolHref / SEO 入口统一处理。 */
export function tarotMeaningPath(slug: string, locale: TarotLocale): string {
  return `${TAROT_ROOTS[locale]}/${SEGMENTS[locale]}/${slug}`
}

export function meaningAlternates(slug: string) {
  return Object.fromEntries(TAROT_LOCALES.map((locale) => [locale, tarotMeaningPath(slug, locale)]))
}

/** 牌义索引页（78 张牌的分组列表）：牌义页路径去掉牌的 slug，如 `/tarot/cards`、`/塔罗/牌义` */
export function tarotIndexPath(locale: TarotLocale): string {
  return `${TAROT_ROOTS[locale]}/${SEGMENTS[locale]}`
}

// 新语言的条目在客户端构建中移出首页脚本、按语言加载（localeText，add-locales-eu-ja 决策 11）
const INDEX_TITLES: Readonly<Record<TarotLocale, string>> = localeText({
  en: 'Tarot Card Meanings: All 78 Cards',
  'zh-Hant': '塔羅牌義：78 張牌全覽',
  'zh-Hans': '塔罗牌义：78 张牌全览',
  ko: '타로 카드 의미: 78장 전체 보기',
  es: 'Significado de las cartas del tarot (78)',
  ja: 'タロットカードの意味一覧（78枚）',
})

const INDEX_DESCRIPTIONS: Readonly<Record<TarotLocale, string>> = localeText({
  en: 'All 78 tarot card meanings in one list: the 22 Major Arcana and the suits of Wands, Cups, Swords and Pentacles, each with upright and reversed meanings.',
  'zh-Hant':
    '78 張塔羅牌義一次看完：22 張大阿爾克那，以及權杖、聖杯、寶劍、錢幣四個牌組，每張牌都有正位與逆位解析。',
  'zh-Hans':
    '78 张塔罗牌义一次看完：22 张大阿尔卡那，以及权杖、圣杯、宝剑、钱币四个牌组，每张牌都有正位与逆位解析。',
  ko: '타로 카드 78장의 의미를 한곳에서: 메이저 아르카나 22장과 완드·컵·소드·펜타클 수트, 카드마다 정방향과 역방향 해석을 담았습니다.',
  es: 'El significado de las 78 cartas del tarot: los 22 Arcanos Mayores y los palos de Bastos, Copas, Espadas y Oros, al derecho e invertidas.',
  ja: 'タロットカード78枚の意味を一覧で。大アルカナ22枚とワンド・カップ・ソード・ペンタクルの小アルカナを、正位置・逆位置・相手の気持ちまで解説します。',
})

const INDEX_NAV: Readonly<Record<TarotLocale, string>> = {
  en: 'Tarot Card Meanings: All 78 Cards',
  'zh-Hant': '塔羅牌義：78 張牌全覽',
  'zh-Hans': '塔罗牌义：78 张牌全览',
  ko: '타로 카드 의미: 78장 전체 보기',
  es: 'Significado de las cartas del tarot',
  // ja 与 Title 相同（沿用 main 的注册表行为）
  ja: 'タロットカードの意味一覧（78枚）',
}

/** 牌义索引页的 head：四语路径互为 hreflang（按站点筛选），写法与牌阵页相同 */
export function tarotIndexSeo(locale: TarotLocale) {
  return {
    path: tarotIndexPath(locale),
    locale,
    title: INDEX_TITLES[locale],
    description: INDEX_DESCRIPTIONS[locale],
    alternates: Object.fromEntries(TAROT_LOCALES.map((l) => [l, tarotIndexPath(l)])),
  }
}

export const TAROT_MEANING_ROUTES: readonly ToolRoute[] = [
  // 牌义索引页：两站各登记一条，进预渲染与站点地图（带标题与描述），不进页头导航。
  // id 以 `tarot-card-` 开头，与牌义页同属参考内容（llms.txt 不列为核心工具）。
  ...(['west', 'east'] as const).map((site) => ({
    id: 'tarot-card-index',
    site,
    nav: false,
    paths: Object.fromEntries(TAROT_LOCALES.map((locale) => [locale, tarotIndexPath(locale)])),
    // 注册表的导航名与主词不包 localeText（其他语言页面也要用）：新语言用主词（与面包屑 tarot_index_crumb 一致）
    titles: INDEX_NAV,
    descriptions: INDEX_DESCRIPTIONS,
  })),
  ...CARDS.flatMap((card) =>
    (['west', 'east'] as const).map((site) => ({
      id: `tarot-card-${card.id}`,
      site,
      nav: false,
      paths: meaningAlternates(card.slug),
      // 牌义页不进导航；站点地图与 head 的标题取正文 frontmatter（tarotMeaningSeoPages）
      titles: {},
    })),
  ),
]

export interface TarotMeaningContent {
  slug: string
  locale: TarotLocale
  title: string
  description: string
}

/** 地图、OG 与页面 head 同用正文 frontmatter，避免导航名覆盖文章 Title。 */
export function tarotMeaningSeoPages(content: readonly TarotMeaningContent[]) {
  return content.map((page) => ({
    path: tarotMeaningPath(page.slug, page.locale),
    title: page.title,
    description: page.description,
    locale: page.locale,
    alternates: meaningAlternates(page.slug),
  }))
}

/**
 * 新语言的牌阵页与牌义索引页清单条目（Title 与导航名不同）：服务端 pages.server.ts 与分享图脚本用它覆盖注册表条目。
 * 只含 Title 与导航名不同的语言（v1 语言由注册表原样提供）。
 */
export function tarotLocalizedSeoPages() {
  return TAROT_LOCALES.filter(
    (locale) => tarotSeoTitle('three-card', locale) !== tarotTitle('three-card', locale),
  ).flatMap((locale) => [
    ...TAROT_SPREADS.map((spread) => ({
      path: tarotPath(spread, locale),
      locale,
      title: tarotSeoTitle(spread, locale),
      description: tarotDescription(spread, locale),
      alternates: Object.fromEntries(TAROT_LOCALES.map((l) => [l, tarotPath(spread, l)])),
    })),
    tarotIndexSeo(locale),
  ])
}
