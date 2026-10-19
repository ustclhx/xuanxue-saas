import type { Card } from '@xuanxue/tarot'
// 注册表随主入口加载：只引用牌组清单，不引用三语牌义数据
import { CARDS } from '@xuanxue/tarot/cards'
import type { ToolRoute } from '../registry.ts'
import { TAROT_LOCALES, TAROT_ROOTS, type TarotLocale } from './routes.ts'

const SEGMENTS = { en: 'cards', 'zh-Hant': '牌義', ko: '카드' } as const

/** 牌义使用牌组已有的 ASCII slug；语言前缀由 toolHref / SEO 入口统一处理。 */
export function tarotMeaningPath(slug: string, locale: TarotLocale): string {
  return `${TAROT_ROOTS[locale]}/${SEGMENTS[locale]}/${slug}`
}

export function meaningAlternates(slug: string) {
  return Object.fromEntries(TAROT_LOCALES.map((locale) => [locale, tarotMeaningPath(slug, locale)]))
}

/** 同花色相邻序号与小牌同序号跨花色互链，大牌不混入小牌的数字对应。 */
export function relatedCards(card: Card): readonly Card[] {
  return CARDS.filter((other) =>
    other.suit === card.suit
      ? Math.abs(other.number - card.number) === 1
      : card.suit !== 'major' && other.suit !== 'major' && other.number === card.number,
  )
}

export const TAROT_MEANING_ROUTES: readonly ToolRoute[] = CARDS.flatMap((card) =>
  (['west', 'east'] as const).map((site) => ({
    id: `tarot-card-${card.id}`,
    site,
    nav: false,
    paths: meaningAlternates(card.slug),
    // 牌义页不进导航；站点地图与 head 的标题取正文 frontmatter（tarotMeaningSeoPages）
    titles: {},
  })),
)

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
