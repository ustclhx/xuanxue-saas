import { brandName, siteBrandName, type TemplateConfig } from '@xuanxue/config'
import { CARD_MEANINGS, CARDS, type Locale as TarotLocale } from '@xuanxue/tarot'
import { templateConfig } from '../../server/template-config.ts'
import { ALMANAC_TOOL_PATHS, isAlmanacLocale } from '../east-content/almanac/paths.ts'
import type { AppLocale } from '../i18n/locales.ts'
import {
  isNumerologyLocale,
  LIFE_PATH_TOOL_PATH,
  numerologyPath,
} from '../tools/numerology/routes.ts'
import { mainToolPath, TOOL_ROUTES, type ToolRoute } from '../tools/registry.ts'
import { tarotIndexPath } from '../tools/tarot/meaning-routes.ts'
import { MOON_PATHS } from '../west-content/moon/paths.ts'
import { isPersonalYearLocale, PERSONAL_YEAR_PATHS } from '../west-content/personal-year/paths.ts'
import { TAROT_TOPIC_SPREADS } from '../west-content/tarot-spreads/paths.ts'
import type { SeoPage, StaticPath } from './metadata.ts'

/**
 * 项目自有公开页面的注册入口（模板 0.7.3 openspec seo-internal-linking design 决策 1）。
 * 模板首次交付后本文件归项目所有，template-sync 不再覆盖。
 *
 * 本项目的工具页、数字页、牌义页与命理概念页已经由工具注册表（features/tools/registry.ts）与内容集合
 * （numerology、tarot）进入公开页面清单（pages.ts 的 publicPages），这里不再重复返回这些页面，
 * 只用 `projectPageLinking` 为它们补上层级（parent）与主词（titleMain）：
 *
 * | 页面 | parent | titleMain |
 * |---|---|---|
 * | 静态页（定价、常见问题、通讯、博客列表等） | 首页 `/` | 频道名（STATIC_MAIN）；首页为站名 |
 * | 工具页、牌阵页、每日页、Life Path、牌义索引页 | 首页 `/` | 注册表的导航名；没有导航名时见下表 |
 * | 牌义页（`/tarot/cards/<slug>` 等四语） | 该语言的牌义索引页 | 该语言的牌名 |
 * | Life Path 数字页（`/life-path-number/<n>`） | `/life-path-number` | `Life Path <n>` |
 * | 命理概念页（`/八字/十神` 等） | 该语言的主工具页（八字排盤 / 八字排盘 / 만세력） | 概念名 |
 * | 黄历月份页（`/黄历/1月` 等） | 黄历工具页 `/黄历` | 「1月黄历」 |
 *
 * parent 与页面上已有的面包屑一致（牌义页：首页 › 牌义索引 › 牌名；数字页：首页 › Life Path › n）。
 * 构建时 linking.ts 校验：可索引页必须有主词，除首页外必须有 parent，且 parent 指向同语言中存在的可索引页面。
 * 新增程序化页面时，若不经工具注册表进入清单，就在 `projectPages` 中返回完整条目。
 */
export function projectPages(_context: {
  /** 当前生成的语言 */
  locale: string
  defaultLocale: string
  now: Date
  config: TemplateConfig
}): SeoPage[] {
  return []
}

/**
 * 静态页的主词与面包屑短变体（模板 0.7.3 seo-internal-linking：主词是面包屑和内链区块的锚文本，取频道名而不是 SEO 标题）。
 * 首页主词为该语言的站名，短变体与页头、面包屑的「首页」文案一致。
 */
// 按全部配置语言必填（openspec add-locales-eu-ja tasks 1.3）：加语言时类型检查要求登记该语言的频道名
const STATIC_MAIN: Readonly<Record<AppLocale, Record<StaticPath, readonly [string, string?]>>> = {
  en: {
    '/': ['', 'Home'],
    '/pricing': ['Pricing'],
    '/blog': ['Blog'],
    '/guides': ['Guides'],
    '/docs': ['Documentation', 'Docs'],
    '/newsletter': ['Newsletter'],
    '/waitlist': ['Waitlist'],
    '/faq': ['FAQ'],
  },
  'zh-Hant': {
    '/': ['', '首頁'],
    '/pricing': ['價格方案'],
    '/blog': ['部落格'],
    '/guides': ['指南'],
    '/docs': ['文件'],
    '/newsletter': ['電子報'],
    '/waitlist': ['候補名單'],
    '/faq': ['常見問題'],
  },
  'zh-Hans': {
    '/': ['', '首页'],
    '/pricing': ['价格方案'],
    '/blog': ['博客'],
    '/guides': ['指南'],
    '/docs': ['文档'],
    '/newsletter': ['电子报'],
    '/waitlist': ['候补名单'],
    '/faq': ['常见问题'],
  },
  ko: {
    '/': ['', '홈'],
    '/pricing': ['요금 안내'],
    '/blog': ['블로그'],
    '/guides': ['가이드'],
    '/docs': ['문서'],
    '/newsletter': ['뉴스레터'],
    '/waitlist': ['대기자 명단'],
    '/faq': ['자주 묻는 질문'],
  },
  // 主词取术语表 anchors（apps/web/i18n/glossary/es.json）
  es: {
    '/': ['', 'Inicio'],
    '/pricing': ['Precios'],
    '/blog': ['Blog'],
    '/guides': ['Guías'],
    '/docs': ['Ayuda'],
    '/newsletter': ['Boletín'],
    '/waitlist': ['Lista de espera'],
    '/faq': ['Preguntas frecuentes'],
  },
  ja: {
    '/': ['', 'ホーム'],
    '/pricing': ['料金プラン'],
    '/blog': ['ブログ'],
    '/guides': ['ガイド'],
    '/docs': ['ドキュメント'],
    '/newsletter': ['ニュースレター'],
    '/waitlist': ['ウェイティングリスト'],
    '/faq': ['よくある質問'],
  },
}

/** 注册表中没有导航名的页面的主词（西方站；西班牙语取术语表 anchors 的主词） */
const WEST_MAIN: Readonly<Record<string, string>> = {
  '/numerology-chart': 'Numerology Chart',
  '/name-numerology': 'Name Numerology',
  '/soul-urge-number': 'Soul Urge Number',
  '/destiny-number': 'Destiny Number',
  '/carta-numerologica': 'Carta numerológica',
  '/numerologia-del-nombre': 'Numerología del nombre',
  '/numero-del-alma': 'Número del alma',
  '/numero-del-destino': 'Número del destino',
}

/** Life Path 数字页的主词（面包屑与内链锚文本），西班牙语取术语表「número de vida {n}」 */
const LIFE_PATH_MAIN: Readonly<Record<string, (n: string) => string>> = {
  en: (n) => `Life Path ${n}`,
  es: (n) => `Número de vida ${n}`,
}

/** 牌义索引页的主词，与页面面包屑（tarot_index_crumb）一致 */
const TAROT_INDEX_MAIN: Readonly<Record<TarotLocale, string>> = {
  en: 'Tarot Card Meanings',
  'zh-Hant': '塔羅牌義',
  'zh-Hans': '塔罗牌义',
  ko: '타로 카드 의미',
  es: 'Significado de las cartas del tarot',
  ja: 'タロットカードの意味',
}

// 按「语言 + 路径」查注册表条目；跨站工具（牌阵、牌义）在两站各登记一条，共用同一组路径，取第一条即可
const routeIndex = new Map<string, ToolRoute>()
for (const route of TOOL_ROUTES)
  for (const [locale, path] of Object.entries(route.paths))
    if (path && !routeIndex.has(`${locale} ${path}`)) routeIndex.set(`${locale} ${path}`, route)

const cardById = new Map(CARDS.map((card) => [card.id, card]))
const isTarotLocale = (locale: string): locale is TarotLocale => locale in CARD_MEANINGS

/** 项目页面的层级与主词；页面已声明的字段优先，内容集合页面原样返回 */
export function projectPageLinking(page: SeoPage): SeoPage {
  const route = routeIndex.get(`${page.locale} ${page.path}`)
  if (!route) return staticPageLinking(page)
  const linking = routeLinking(route, page)
  return {
    ...page,
    titleMain: page.titleMain ?? linking.titleMain,
    ...(page.path !== '/' && { parent: page.parent ?? linking.parent }),
  }
}

function routeLinking(route: ToolRoute, page: SeoPage): { titleMain: string; parent: string } {
  const { locale } = page
  const navTitle = route.titles[locale] || undefined
  // 东方站根路径英文（5b）：as feelings 牌页的主词为「<牌名> as feelings」，上级为 as feelings 索引页
  const eastEnglish = page.site === 'east' && locale === 'en'
  if (route.id === 'tarot-card-index' && isTarotLocale(locale))
    return {
      titleMain: eastEnglish ? (navTitle ?? page.title) : TAROT_INDEX_MAIN[locale],
      parent: '/',
    }
  if (route.id.startsWith('tarot-card-') && isTarotLocale(locale)) {
    const id = route.id.slice('tarot-card-'.length)
    const name = cardById.has(id) ? CARD_MEANINGS[locale][id]?.name : undefined
    return {
      titleMain: name ? (eastEnglish ? `${name} as feelings` : name) : page.title,
      parent: tarotIndexPath(locale, eastEnglish ? 'east' : undefined),
    }
  }
  const lifePath = /^life-path-(\d+)$/.exec(route.id)?.[1]
  if (lifePath)
    return {
      titleMain: (LIFE_PATH_MAIN[locale] ?? LIFE_PATH_MAIN.en ?? String)(lifePath),
      parent: isNumerologyLocale(locale)
        ? numerologyPath('life-path', locale)
        : LIFE_PATH_TOOL_PATH,
    }
  // 黄历月份页（content-growth-phase2 第 6 组）：面包屑「首页 › 黄历 › N月」，上级为黄历工具页
  // zh-hant 農民曆月份页（content-growth-v2-tools 第 18 组）上级为 `/農民曆`
  if (route.id.startsWith('almanac-month-'))
    return {
      titleMain: navTitle ?? page.title,
      parent: ALMANAC_TOOL_PATHS[isAlmanacLocale(locale) ? locale : 'zh-Hans'],
    }
  // 月相月份页（content-growth-v2-tools 第 19 组）：面包屑「Home › Moon Calendar › January Moon Calendar」
  if (route.id.startsWith('moon-calendar-'))
    return { titleMain: navTitle ?? page.title, parent: MOON_PATHS['moon-calendar'] }
  // 主题牌阵页（content-growth-v2-tools 第 28 组）：面包屑「Home › Free Tarot Reading › Love Tarot Spread」，
  // 上级为塔罗入口页（设计稿 Spread 的三级面包屑）
  if ((TAROT_TOPIC_SPREADS as readonly string[]).some((id) => route.id === `tarot-${id}`))
    return { titleMain: navTitle ?? page.title, parent: '/tarot' }
  // personal year 年份数页（content-growth-v2-tools 第 27 组）：面包屑「Home › Personal Year Calculator › Personal Year 5」
  if (/^personal-year-[1-9]$/.test(route.id) && isPersonalYearLocale(locale))
    return { titleMain: navTitle ?? page.title, parent: PERSONAL_YEAR_PATHS[locale] }
  if (route.id.startsWith('bazi-concept-'))
    return { titleMain: navTitle ?? page.title, parent: mainToolPath(locale) ?? '/' }
  return { titleMain: navTitle ?? WEST_MAIN[page.path] ?? page.title, parent: '/' }
}

/** 静态页（metadata.ts staticPage，首页、定价、常见问题等）：上级是首页，主词取频道名，首页主词为站名 */
function staticPageLinking(page: SeoPage): SeoPage {
  const entry = (
    STATIC_MAIN as Partial<Record<string, Record<StaticPath, readonly [string, string?]>>>
  )[page.locale]?.[page.path as StaticPath]
  if (!entry || page.titleMain !== undefined) return page
  const [main, anchorShort] = entry
  // 首页主词为站名：按页面所属站点（东方站根路径英文为 Ganjiday，不是 en 归属站点的品牌）
  const titleMain =
    page.path === '/'
      ? page.site
        ? siteBrandName(templateConfig, page.site, page.locale)
        : brandName(templateConfig, page.locale)
      : main
  return {
    ...page,
    titleMain,
    ...(anchorShort !== undefined && anchorShort !== titleMain && { anchorShort }),
    ...(page.path !== '/' && { parent: '/' }),
  }
}
