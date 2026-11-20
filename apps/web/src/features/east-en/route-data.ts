import { CARD_MEANINGS, type SpreadId } from '@xuanxue/tarot'
import { absoluteUrl, pageBrand, pageHead, type SeoPage } from '../seo/metadata.ts'
import { localeOrigin } from '../seo/origins.ts'
import {
  breadcrumbData,
  organizationData,
  webApplicationData,
  websiteData,
} from '../seo/structured-data.ts'
import { EAST_EN_TOOL_PATHS } from '../tools/bazi/eastern-routes.ts'
import { faqPageData } from '../tools/numerology/seo.ts'
import { spreadForSlug, tarotAlternates, tarotNavTitle, tarotPath } from '../tools/tarot/routes.ts'
import { eastEnFaqData } from './article.tsx'
import { FAQ_PAGE } from './copy/faq.ts'
import { LANDING } from './copy/landing.ts'
import { FEELINGS_INDEX, SPREADS } from './copy/tarot.ts'
import { BAZI, ZIWEI } from './copy/tools.ts'
import type { Faq } from './copy/types.ts'
import { getTarotFeelings, type TarotFeelingsPage } from './feelings.functions.ts'
import { tarotFeelingsIndexSeo, tarotFeelingsSeoPages } from './seo-pages.ts'
import { eastEnglishStaticPage } from './static-seo.ts'

/**
 * 东方站根路径英文页面的 head 数据（5b）。路由的 loader / head 进入客户端入口（各首页的水合闭包），
 * 因此路由只在 loader 中按需 `import()` 本模块，把 SEO 页面与结构化数据作为 loader 数据下发，
 * 东方站英文文案不进入其他页面的包。
 */
export interface EastEnHead {
  readonly page: SeoPage
  readonly structuredData: readonly unknown[]
}

/** loader 下发的完整 head（pageHead 只依赖页面自身的站点与语言，不依赖请求的 origin） */
export function toHead(head: EastEnHead) {
  return pageHead(head.page, '', head.structuredData)
}

const SITE = 'east' as const
const HOME = { name: 'Home', path: '/' }

const faq = (items: readonly Faq[]) => faqPageData(eastEnFaqData(items))

/** 东方站英文牌阵页的 SEO 标题与描述（关键词地图方案 A：past present future、one card pull、pick a card、Celtic Cross positions） */
const SPREAD_SEO: Readonly<Record<SpreadId, readonly [string, string]>> = {
  'three-card': [
    'Past, Present, Future Tarot Spread (Free)',
    'Free past, present, future tarot spread: shuffle, cut and turn three Rider–Waite–Smith cards, then read how they connect. For reflection, not prediction.',
  ],
  daily: [
    'One Card Tarot Pull: Draw a Card for Today',
    'Draw one tarot card for today and keep it as a question to carry through the day. A free one card pull with upright and reversed notes.',
  ],
  'yes-or-no': [
    'Pick a Card Tarot for Yes-or-No Questions',
    'Pick a card tarot for a yes-or-no question: one card, a published fixed mapping to Yes, No or Maybe, and the reasoning behind it.',
  ],
  'celtic-cross': [
    'Celtic Cross Spread: 10 Positions Explained',
    'The Celtic Cross spread laid out position by position: what each of the ten places asks, the order to read them, and a free ten-card draw.',
  ],
}

export function eastEnToolHead(id: 'bazi' | 'ziwei'): EastEnHead {
  const copy = id === 'bazi' ? BAZI : ZIWEI
  const path = EAST_EN_TOOL_PATHS[id]
  const alternates =
    id === 'bazi'
      ? { 'zh-Hant': '/八字排盤', 'zh-Hans': '/八字排盘', ko: '/만세력', en: path }
      : { 'zh-Hant': '/紫微斗數排盤', 'zh-Hans': '/紫微斗数排盘', en: path }
  const page: SeoPage = {
    path,
    locale: 'en',
    site: SITE,
    title: copy.title,
    description: copy.description,
    alternates,
  }
  return {
    page,
    structuredData: [
      webApplicationData(page, copy.nav),
      breadcrumbData([HOME, { name: copy.nav, path }], 'en', SITE),
      faq(copy.faq),
    ],
  }
}

/** `/tarot-spreads/<子路径>` 对应的牌阵（三张牌在根路径，不经子路径） */
export function eastEnSpreadOf(slug: string): SpreadId | undefined {
  const spread = spreadForSlug('en', slug, SITE)
  return spread === 'three-card' ? undefined : spread
}

export function eastEnSpreadHead(spread: SpreadId): EastEnHead {
  const path = tarotPath(spread, 'en', SITE)
  const page: SeoPage = {
    path,
    locale: 'en',
    site: SITE,
    title: SPREAD_SEO[spread][0],
    description: SPREAD_SEO[spread][1],
    alternates: tarotAlternates(spread, SITE),
  }
  return {
    page,
    structuredData: [
      breadcrumbData([HOME, { name: tarotNavTitle(spread, 'en', SITE), path }], 'en', SITE),
      faq(SPREADS[spread].faq),
    ],
  }
}

export function eastEnFeelingsIndexHead(): EastEnHead {
  const page: SeoPage = tarotFeelingsIndexSeo(FEELINGS_INDEX.description)
  return {
    page,
    structuredData: [
      breadcrumbData([HOME, { name: FEELINGS_INDEX.nav, path: page.path }], 'en', SITE),
    ],
  }
}

export function eastEnFeelingsCardHead(content: {
  slug: string
  cardId: string
  title: string
  description: string
  faq: readonly Faq[]
}): EastEnHead {
  const name = CARD_MEANINGS.en[content.cardId]?.name ?? content.slug
  const [page] = tarotFeelingsSeoPages([content])
  if (!page) throw new Error(`Missing tarot feelings page ${content.slug}`)
  return {
    page,
    structuredData: [
      breadcrumbData(
        [
          HOME,
          { name: FEELINGS_INDEX.nav, path: '/tarot-feelings' },
          { name: `${name} as feelings`, path: page.path },
        ],
        'en',
        SITE,
      ),
      faq(content.faq),
    ],
  }
}

/** 东方站英文 FAQ 页的计算方法问答（纯文本，可见答案的链接由页面按原文渲染）与 head */
export function eastEnFaqPage() {
  return {
    page: eastEnglishStaticPage('/faq'),
    h1: FAQ_PAGE.h1,
    intro: FAQ_PAGE.intro,
    methods: {
      title: FAQ_PAGE.methodsTitle,
      items: FAQ_PAGE.methods.map((item) => ({ question: item.q, answer: item.a })),
    },
  }
}

/** 东方站英文落地页的 head：品牌首页的 Organization 与 WebSite、FAQ（旧分享片段的跳转脚本由首页路由加上） */
export function eastEnLandingHead() {
  const page = eastEnglishStaticPage('/')
  const origin = localeOrigin('en', SITE)
  const brand = pageBrand(page)
  const head = pageHead(page, '', [
    organizationData(origin, brand),
    websiteData(origin, brand, absoluteUrl(origin, '/')),
    faq(LANDING.faq),
  ])
  return head
}

/** 东方站英文定价页的 head（页面数据仍由定价路由读取） */
export function eastEnPricingPage(): SeoPage {
  return eastEnglishStaticPage('/pricing')
}

export type EastEnTarotData =
  | { readonly kind: 'spread'; readonly spread: SpreadId; readonly head: ReturnType<typeof toHead> }
  | { readonly kind: 'index'; readonly head: ReturnType<typeof toHead> }
  | {
      readonly kind: 'card'
      readonly content: TarotFeelingsPage
      readonly head: ReturnType<typeof toHead>
    }

/**
 * 东方站根路径英文的塔罗页面（`/tarot-spreads[/…]`、`/tarot-feelings[/…]`）的路由数据：路由只登记通配的
 * `/$slug` 与 `/$section/$item`，地址解析、head 与正文都在本模块（按需加载），不在入口包里逐页登记路由。
 * 不是东方站英文塔罗页面时返回 null（路由返回 404）。
 */
export async function eastEnTarotData(path: string): Promise<EastEnTarotData | null> {
  const [, section = '', item] = path.split('/')
  if (section === 'tarot-spreads') {
    const spread = item === undefined ? 'three-card' : eastEnSpreadOf(item)
    return spread ? { kind: 'spread', spread, head: toHead(eastEnSpreadHead(spread)) } : null
  }
  if (section !== 'tarot-feelings') return null
  if (item === undefined) return { kind: 'index', head: toHead(eastEnFeelingsIndexHead()) }
  const content = await getTarotFeelings({ data: { slug: item } }).catch(() => null)
  return content ? { kind: 'card', content, head: toHead(eastEnFeelingsCardHead(content)) } : null
}
