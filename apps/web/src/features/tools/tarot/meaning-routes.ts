// 注册表随主入口加载：只引用牌组清单，不引用三语牌义数据
import { CARDS } from '@xuanxue/tarot/cards'
import type { ToolRoute } from '../registry.ts'
import { TAROT_LOCALES, TAROT_ROOTS, type TarotLocale } from './routes.ts'

const SEGMENTS = { en: 'cards', 'zh-Hant': '牌義', 'zh-Hans': '牌义', ko: '카드' } as const

/**
 * 东方站根路径英文的 78 张牌页（openspec add-locales-eu-ja 5b，关键词地图方案 A）：「<牌名> as feelings」，
 * 与西方站英文牌义页分主词；路径 `/tarot-feelings/<牌 slug>`，内容源 content/tarot-feelings/en。
 */
export const EAST_EN_FEELINGS_ROOT = '/tarot-feelings'
type TarotSite = 'east' | 'west'
const eastEnglish = (locale: TarotLocale, site?: TarotSite) => site === 'east' && locale === 'en'

/** 牌义使用牌组已有的 ASCII slug；语言前缀由 toolHref / SEO 入口统一处理。`site` 只影响 en */
export function tarotMeaningPath(slug: string, locale: TarotLocale, site?: TarotSite): string {
  if (eastEnglish(locale, site)) return `${EAST_EN_FEELINGS_ROOT}/${slug}`
  return `${TAROT_ROOTS[locale]}/${SEGMENTS[locale]}/${slug}`
}

/** 牌页在本站各语言下的地址（hreflang）；东方站页面的 en 指向 as feelings 牌页 */
export function meaningAlternates(slug: string, site?: TarotSite) {
  return Object.fromEntries(
    TAROT_LOCALES.map((locale) => [locale, tarotMeaningPath(slug, locale, site)]),
  )
}

/** 牌义索引页（78 张牌的分组列表）：牌义页路径去掉牌的 slug，如 `/tarot/cards`、`/塔罗/牌义` */
export function tarotIndexPath(locale: TarotLocale, site?: TarotSite): string {
  if (eastEnglish(locale, site)) return EAST_EN_FEELINGS_ROOT
  return `${TAROT_ROOTS[locale]}/${SEGMENTS[locale]}`
}

const INDEX_TITLES: Readonly<Record<TarotLocale, string>> = {
  en: 'Tarot Card Meanings: All 78 Cards',
  'zh-Hant': '塔羅牌義：78 張牌全覽',
  'zh-Hans': '塔罗牌义：78 张牌全览',
  ko: '타로 카드 의미: 78장 전체 보기',
}

const INDEX_DESCRIPTIONS: Readonly<Record<TarotLocale, string>> = {
  en: 'All 78 tarot card meanings in one list: the 22 Major Arcana and the suits of Wands, Cups, Swords and Pentacles, each with upright and reversed meanings.',
  'zh-Hant':
    '78 張塔羅牌義一次看完：22 張大阿爾克那，以及權杖、聖杯、寶劍、錢幣四個牌組，每張牌都有正位與逆位解析。',
  'zh-Hans':
    '78 张塔罗牌义一次看完：22 张大阿尔卡那，以及权杖、圣杯、宝剑、钱币四个牌组，每张牌都有正位与逆位解析。',
  ko: '타로 카드 78장의 의미를 한곳에서: 메이저 아르카나 22장과 완드·컵·소드·펜타클 수트, 카드마다 정방향과 역방향 해석을 담았습니다.',
}

/** 牌义索引页的 head：四语路径互为 hreflang（按站点筛选），写法与牌阵页相同 */
export function tarotIndexSeo(locale: TarotLocale, site?: TarotSite) {
  return {
    path: tarotIndexPath(locale),
    locale,
    title: INDEX_TITLES[locale],
    description: INDEX_DESCRIPTIONS[locale],
    alternates: Object.fromEntries(TAROT_LOCALES.map((l) => [l, tarotIndexPath(l, site)])),
  }
}

const EAST_EN_INDEX_NAV = 'Tarot Cards as Feelings'

export const TAROT_MEANING_ROUTES: readonly ToolRoute[] = [
  // 牌义索引页：两站各登记一条，进预渲染与站点地图（带标题与描述），不进页头导航。
  // id 以 `tarot-card-` 开头，与牌义页同属参考内容（llms.txt 不列为核心工具）。
  ...(['west', 'east'] as const).map((site) => ({
    id: 'tarot-card-index',
    site,
    nav: false,
    paths: Object.fromEntries(
      TAROT_LOCALES.map((locale) => [locale, tarotIndexPath(locale, site)]),
    ),
    titles: site === 'east' ? { ...INDEX_TITLES, en: EAST_EN_INDEX_NAV } : INDEX_TITLES,
    descriptions: INDEX_DESCRIPTIONS,
  })),
  ...CARDS.flatMap((card) =>
    (['west', 'east'] as const).map((site) => ({
      id: `tarot-card-${card.id}`,
      site,
      nav: false,
      paths: meaningAlternates(card.slug, site),
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
export function tarotMeaningSeoPages(content: readonly TarotMeaningContent[], site?: TarotSite) {
  return content.map((page) => ({
    path: tarotMeaningPath(page.slug, page.locale),
    title: page.title,
    description: page.description,
    locale: page.locale,
    alternates: meaningAlternates(page.slug, site ?? (page.locale === 'en' ? 'west' : 'east')),
  }))
}
