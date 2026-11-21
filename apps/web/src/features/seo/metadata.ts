import type { AnyRouteMatch } from '@tanstack/react-router'
import { brandName, type SiteId, siteBrandName } from '@xuanxue/config'
import type { Locale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import type { AuthPagePath } from '../i18n/auth-locale.ts'
import { isLocaleReleased } from '../i18n/rollout.ts'
import { localeText } from '../i18n/split-messages.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { EAST_ENGLISH_LOCALE, EAST_ENGLISH_URL, siteOfLocale } from '../site/site.ts'
import { TOOL_ROUTES } from '../tools/registry.ts'
import { homePageCopy } from './home-copy.ts'
import { localeOrigin, seoSiteOrigin } from './origins.ts'

/**
 * 公开页面清单的一项（openspec seo-internal-linking design 决策 1）。地址类字段（`path`、`parent`、
 * `group`、`related`）都是不带语言前缀的 path，按本页的 `locale` 解析。
 */
export interface SeoPage {
  path: string
  title: string
  description: string
  locale: string
  cover?: string | undefined
  date?: string | undefined
  /** 上级页面；除首页外每个可索引页面都必须声明，且指向存在的可索引页面 */
  parent?: string | undefined
  /** 主词：模板内链区块与面包屑的锚文本；内容集合默认取 title */
  titleMain?: string | undefined
  /** 锚文本的短变体（只允许一个） */
  anchorShort?: string | undefined
  /** 同级分组的地址（该分组的列表页），同组页面互为同级 */
  group?: string | undefined
  /** 相关页地址 */
  related?: readonly string[] | undefined
  /** 默认 true；false 时输出 noindex、不进站点地图，也不能作为 parent／group／related 的目标 */
  indexable?: boolean | undefined
  /** `'money'` 表示钱页，链接图检查统计其站内入链 */
  priority?: 'money' | undefined
  /** 内容的真实语言；与 `locale` 不同表示缺少译文、以该语言内容回退显示的页面 */
  sourceLocale?: string | undefined
  /**
   * 各语言版本的地址（语言 → 不带语言前缀的 path），用于各语言路径不同的页面（本地化 slug，
   * openspec multilingual-seo 决策 4）。声明后 hreflang 与语言切换器只用这些地址（自身总在其中）；
   * 每个语言版本都要出现在清单中并声明同一组地址，构建期校验（linking.ts）。未声明时按同路径加前缀关联。
   * 项目：可以列出另一站点的语言（工具路由的 `paths`），hreflang 只取同站点的版本（alternateLinks）。
   */
  alternates?: Readonly<Record<string, string>> | undefined
}

/** 页面声明的完整语言版本组（含自身）；未声明 `alternates` 时返回 undefined */
export function pageAlternates(
  page: Pick<SeoPage, 'path' | 'locale' | 'alternates'>,
): Record<string, string> | undefined {
  return page.alternates ? { ...page.alternates, [page.locale]: page.path } : undefined
}

/**
 * 两种语言是否由同一站点（同一 origin）服务：按 `seo.linking.sites` 分组，未列入任何分组的语言同属一个隐含站点；
 * 未配置分组（模板默认）时全部语言同站。
 */
export function sameSiteLocales(
  a: string,
  b: string,
  sites: readonly { readonly locales: readonly string[] }[] = templateConfig.seo.linking.sites,
): boolean {
  const site = (locale: string) => sites.findIndex((entry) => entry.locales.includes(locale))
  return site(a) === site(b)
}

/**
 * 回退页的原语言：内容语言与页面语言不同、且原语言由同一站点服务时返回原语言。原语言在另一站点时返回
 * undefined——按普通页面处理（自指 canonical、进站点地图），不输出跨站 canonical。
 */
export function fallbackSourceLocale(
  page: Pick<SeoPage, 'locale' | 'sourceLocale'>,
  sites?: readonly { readonly locales: readonly string[] }[],
): string | undefined {
  const { locale, sourceLocale } = page
  return sourceLocale !== undefined &&
    sourceLocale !== locale &&
    sameSiteLocales(locale, sourceLocale, sites)
    ? sourceLocale
    : undefined
}

/** 缺少译文、以同站点其他语言内容回退显示的页面：canonical 指向原语言，不进站点地图 */
export function isFallbackPage(page: Pick<SeoPage, 'locale' | 'sourceLocale'>): boolean {
  return fallbackSourceLocale(page) !== undefined
}

/** 进入站点地图的页面：可索引且不是回退页 */
export function indexedPages<T extends SeoPage>(pages: readonly T[]): T[] {
  return pages.filter((page) => page.indexable !== false && !isFallbackPage(page))
}

const { defaultLocale, enabled } = templateConfig.i18n
const locales = enabled ? templateConfig.i18n.locales : [defaultLocale]
export function localizedPath(path: string, locale: string): string {
  const clean = path.replace(/\/+$/, '') || '/'
  return !enabled || locale === defaultLocale
    ? clean
    : `${localePrefix(locale)}${clean === '/' ? '' : clean}`
}

export function absoluteUrl(appUrl: string, path: string): string {
  return new URL(path, appUrl).href
}

/**
 * hreflang（specs/seo「多语言关联」）：两站分开经营（D5），只声明同一站点内的语言版本（含页面自身）。
 * x-default 指向同一页面在站点默认语言下的版本——西方站为英语，东方站没有无前缀默认语言，取站点第一个语言
 * （繁体中文）；该版本不存在时按站点语言顺序取第一个存在的版本。不再指向会跳转的东方站根路径
 * （openspec fix-seo-canonical-indexing design.md 决策 5）。页面 head 与站点地图共用本函数。
 * 东方站各语言首页另与东方站英文入口页 `/en` 互指。
 * 项目改动（openspec add-locales-eu-ja 决策 5）：未发布语言（features/i18n/rollout.ts）不出现在其他页面的
 * hreflang 中；页面自身语言保留（未发布语言页面只在预览主机可访问且整体 noindex）。
 * `translations`：页面声明的各语言地址（`pageAlternates()`，模板 0.8.0 本地化 slug），未声明时按同路径关联。
 */
export function alternateLinks(
  _appUrl: string,
  path: string,
  languages: readonly string[] = locales,
  translations?: Readonly<Partial<Record<string, string>>>,
  locale = languages[0] ?? defaultLocale,
) {
  const site = siteOfLocale(locale, templateConfig) ?? 'west'
  const sameSite = (language: string) =>
    siteOfLocale(language, templateConfig) === site &&
    (language === locale || isLocaleReleased(language, templateConfig, site))
  const tool = TOOL_ROUTES.find((route) => route.paths[locale] === path)
  // 同一路径在其他语言下是另一个工具（如西方站首页 / 为 Life Path 计算器）时内容不同，不互指
  const paths =
    translations ??
    tool?.paths ??
    Object.fromEntries(
      languages
        .filter((l) => l === locale || !TOOL_ROUTES.some((route) => route.paths[l] === path))
        .map((l) => [l, path]),
    )
  const links = Object.entries(paths).flatMap(([language, translatedPath]) =>
    translatedPath && locales.some((locale) => locale === language) && sameSite(language)
      ? [
          {
            rel: 'alternate',
            hrefLang: language,
            href: absoluteUrl(localeOrigin(language), localizedPath(translatedPath, language)),
          },
        ]
      : [],
  )
  const origin = seoSiteOrigin(site)
  if (site === 'east' && path === '/' && enabled)
    links.push({
      rel: 'alternate',
      hrefLang: EAST_ENGLISH_LOCALE,
      href: absoluteUrl(origin, EAST_ENGLISH_URL),
    })
  const { defaultLocale: siteDefault, locales: siteLocales } = templateConfig.sites[site]
  // 两站的默认语言都是英语（使用者 2026-11-20）：东方站有英文版本（目前只有首页 `/`）时 x-default 指向它，
  // 没有英文版本的页面仍取东方站第一个语言（繁体中文）
  const fallback = [siteDefault ?? (site === 'east' ? EAST_ENGLISH_LOCALE : null), ...siteLocales]
    .map((language) => links.find((link) => link.hrefLang === language))
    .find((link) => link !== undefined)
  return fallback
    ? [...links, { rel: 'alternate', hrefLang: 'x-default', href: fallback.href }]
    : links
}

/** 由 staticPage 提供元数据的静态页；新增静态页须在每种语言下补齐文案 */
export type StaticPath =
  | '/'
  | '/pricing'
  | '/blog'
  | '/docs'
  | '/newsletter'
  | '/waitlist'
  | '/faq'
  | '/guides'

// 按全部语言必填：缺少任一语言或页面都会在类型检查时报错，避免再次回退到英语或另一站点的描述。
// 东方站（zh-Hant / zh-Hans / ko）描述八字、紫微、塔罗等本站体系，不写 numerology。
// 新语言（v1 之后）的条目在客户端构建中移出首页脚本、按语言加载（localeText，add-locales-eu-ja 决策 11）。
const staticCopy: Record<Locale, Record<StaticPath, readonly [string, string]>> = localeText({
  en: {
    '/': homePageCopy('en'),
    '/pricing': [
      'Pricing: free tools and credit packs',
      'All numerology and tarot tools are free. Credit packs unlock full AI readings of your own numbers and cards.',
    ],
    '/blog': ['Blog', 'Guides to numerology, tarot and reading your own results.'],
    '/guides': ['Guides', 'Short answers to common questions.'],
    '/docs': ['Documentation', 'Help and guides for using Arcanumber.'],
    '/newsletter': [
      'Newsletter',
      'Subscribe for new numerology and tarot guides and product updates.',
    ],
    '/waitlist': ['Join the waitlist', 'Join the waitlist to hear when the product is ready.'],
    '/faq': [
      'FAQ: credits, refunds and privacy',
      'Answers about free tools, credits and refunds, failed readings, privacy and how numerology and tarot results are calculated.',
    ],
  },
  'zh-Hant': {
    '/': homePageCopy('zh-Hant'),
    '/pricing': [
      '價格方案：免費工具與積分包',
      '八字、紫微與塔羅工具全部免費；積分包用於解鎖依你命盤撰寫的 AI 完整詳批。',
    ],
    '/blog': ['部落格', '八字、紫微與塔羅的入門指南與結果解讀。'],
    '/guides': ['指南', '常見問題的簡明解答。'],
    '/docs': ['文件', '本站使用說明與指南。'],
    '/newsletter': ['訂閱電子報', '訂閱電子報，取得八字、紫微與塔羅的新文章與產品消息。'],
    '/waitlist': ['加入候補名單', '登記候補名單，第一時間收到產品開放通知。'],
    '/faq': [
      '常見問題：積分、退款與隱私',
      '關於免費工具、積分與退款、詳批失敗、隱私，以及八字、紫微與塔羅計算方式的常見問題。',
    ],
  },
  'zh-Hans': {
    '/': homePageCopy('zh-Hans'),
    '/pricing': [
      '价格方案：免费工具与积分包',
      '八字、紫微与塔罗工具全部免费；积分包用于解锁依你命盘撰写的 AI 完整详批。',
    ],
    '/blog': ['博客', '八字、紫微与塔罗的入门指南与结果解读。'],
    '/guides': ['指南', '常见问题的简明答案。'],
    '/docs': ['文档', '本站使用说明与指南。'],
    '/newsletter': ['订阅电子报', '订阅电子报，获取八字、紫微与塔罗的新文章与产品消息。'],
    '/waitlist': ['加入候补名单', '登记候补名单，第一时间收到产品开放通知。'],
    '/faq': [
      '常见问题：积分、退款与隐私',
      '关于免费工具、积分与退款、详批失败、隐私，以及八字、紫微与塔罗计算方式的常见问题。',
    ],
  },
  ko: {
    '/': homePageCopy('ko'),
    '/pricing': [
      '요금 안내: 무료 도구와 크레딧 팩',
      '만세력·사주·타로 도구는 모두 무료이며, 크레딧 팩으로 내 명식에 맞춘 AI 상세 풀이를 이용할 수 있습니다.',
    ],
    '/blog': ['블로그', '사주, 만세력, 타로 입문 가이드와 결과 읽는 법.'],
    '/guides': ['가이드', '자주 묻는 질문에 대한 짧은 답변입니다.'],
    '/docs': ['문서', '사이트 이용 안내와 가이드.'],
    '/newsletter': ['뉴스레터', '뉴스레터를 구독하고 사주·타로 새 글과 제품 소식을 받아 보세요.'],
    '/waitlist': ['대기자 명단 등록', '대기자 명단에 등록하고 출시 소식을 가장 먼저 받아 보세요.'],
    '/faq': [
      '자주 묻는 질문: 크레딧, 환불, 개인정보',
      '무료 도구, 크레딧과 환불, 상세 풀이 실패, 개인정보, 사주·타로 계산 방식에 대한 자주 묻는 질문입니다.',
    ],
  },
  // 西班牙语（西方站，关键词地图 es §16–17）：定价与常见问题为导航性页面
  es: {
    '/': homePageCopy('es'),
    '/pricing': [
      'Precios: herramientas gratis y créditos',
      'Todas las herramientas de numerología y tarot son gratis. Los créditos sirven para desbloquear lecturas completas con IA de tus propios números y cartas.',
    ],
    '/blog': ['Blog', 'Guías de numerología y tarot para entender tus propios resultados.'],
    '/guides': ['Guías', 'Respuestas breves a preguntas frecuentes.'],
    '/docs': ['Ayuda', 'Ayuda y guías para usar Arcanumber.'],
    '/newsletter': [
      'Boletín',
      'Suscríbete para recibir nuevas guías de numerología y tarot y novedades del sitio.',
    ],
    '/waitlist': ['Lista de espera', 'Anótate en la lista de espera para saber cuándo abrimos.'],
    '/faq': [
      'Preguntas frecuentes: créditos y privacidad',
      'Respuestas sobre herramientas gratis, créditos y reembolsos, lecturas fallidas, privacidad y cómo se calculan la numerología y el tarot.',
    ],
  },
  // 关键词地图 ja.md §10–11：FAQ 与定价沿用模板路径 /ja/faq、/ja/pricing
  ja: {
    '/': homePageCopy('ja'),
    '/pricing': [
      '料金プラン｜無料ツールと鑑定クレジット',
      '四柱推命・紫微斗数・タロットの各ツールは無料です。命式や命盤にもとづくAIの詳しい鑑定は、クレジットパックで利用できます。',
    ],
    // ja 第一期没有博客、指南与文档页（未翻译的页面 404），只登记短标题
    '/blog': ['ブログ', 'ブログ'],
    '/guides': ['ガイド', 'ガイド'],
    '/docs': ['ドキュメント', 'ドキュメント'],
    '/newsletter': [
      'ニュースレター',
      '四柱推命・紫微斗数・タロットの新しい記事とお知らせをメールでお届けします。',
    ],
    '/waitlist': ['ウェイティングリスト', 'ウェイティングリスト'],
    '/faq': [
      'よくある質問｜命式の見方・料金・データの扱い',
      '無料ツールとクレジット、返金、鑑定に失敗したとき、個人データの扱い、四柱推命・紫微斗数・タロットの計算方法についてまとめました。',
    ],
  },
})

/** 静态页元数据；未登记的语言或路径以路径占位，不回退到其他语言 */
export function staticPage(path: StaticPath, locale: string): SeoPage {
  const copy: Partial<Record<string, Record<StaticPath, readonly [string, string]>>> = staticCopy
  const entry = copy[locale]
  // 首页文案在调用时取自 home-copy：新语言的首页文案在客户端水合前才写回（localeText），不能用模块求值时的副本
  const [title, description] = (path === '/' && entry ? homePageCopy(locale) : entry?.[path]) ?? [
    path,
    path,
  ]
  // 层级与主词（模板 0.7.3）由 pages.project.ts 的 projectPageLinking 在服务端清单中补上，
  // 本函数也用于客户端路由 head，不带主词表以免增加首页脚本体积
  return { path, title, description, locale }
}

/** 博客标签页标题 */
export function tagPageTitle(tag: string, locale: string): string {
  if (locale === 'zh-Hant') return `標籤「${tag}」下的文章`
  if (locale === 'zh-Hans') return `标签「${tag}」下的文章`
  if (locale === 'ko') return `‘${tag}’ 태그가 달린 글`
  return `Posts tagged “${tag}”`
}

/** 认证页的 robots 指令：响应头（server.ts）与页面 meta 共用 */
export const AUTH_ROBOTS = 'noindex, nofollow'

/**
 * 认证页 head（specs/seo「认证页不进索引」）：robots noindex，canonical 为当前语言、不带查询参数的地址，
 * `?redirect=` 等变体都声明同一个 canonical（openspec fix-seo-canonical-indexing design.md 决策 6）。
 */
export function authPageHead(path: AuthPagePath, locale: string, title?: string) {
  return {
    meta: [
      ...(title === undefined ? [] : [{ title: titleWithSite(title, locale) }]),
      { name: 'robots', content: AUTH_ROBOTS },
    ],
    links: [
      { rel: 'canonical', href: absoluteUrl(localeOrigin(locale), localizedPath(path, locale)) },
    ],
  }
}

export function privateMeta(path: string) {
  return isAppAreaPath(path) ? [{ name: 'robots', content: 'noindex, nofollow' }] : []
}

/** URL 由根 loader 读取运行时 APP_URL，下发客户端后也用于路由切换。 */
export function originFromMatches(
  matches: readonly Pick<AnyRouteMatch, 'loaderData' | 'routeId'>[],
): string {
  const root = matches.find((match) => match.routeId === '__root__')
  if (!root) throw new Error('Root SEO origin is unavailable')
  return (root.loaderData as { appUrl: string }).appUrl
}

/** 页面所属站点在该语言下的品牌名 */
export function pageBrand(page: Pick<SeoPage, 'locale'>): string {
  return brandName(templateConfig, page.locale)
}

// 中文标题用全角竖线、两侧不加空格；其余语言用半角竖线加空格
const TITLE_SEPARATORS: Readonly<Partial<Record<string, string>>> = {
  'zh-Hant': '｜',
  'zh-Hans': '｜',
  // 关键词地图 ja.md（使用者 2026-11-20 批准）：日语标题同样用全角竖线
  ja: '｜',
}

/**
 * 页面标题带站名（openspec separate-landing-homepage design.md D3a，specs/seo「页面标题带站名」）：
 * 内页为「<页面标题><分隔符><站名>」，站名取该语言的显示名（繁简中文「干支日」、韩语「간지데이」、英语 Arcanumber）。
 * 标题已含站名时原样返回：首页标题站名在前，不再追加；同一标题中站名不出现两次。
 * 公开页的语言只属于一个站点，按语言即可确定站名；应用区、账户页与后台没有语言前缀，
 * 语言可能来自另一站点留下的 Cookie，须传入当前站点，语言不属于本站时改用本站第一个语言。
 */
export function titleWithSite(title: string, locale: string, site?: SiteId): string {
  const own: readonly string[] = site ? templateConfig.sites[site].locales : []
  const language = site && !own.includes(locale) ? (own[0] ?? locale) : locale
  const brand = site
    ? siteBrandName(templateConfig, site, language)
    : brandName(templateConfig, language)
  if (title.includes(brand)) return title
  return `${title}${TITLE_SEPARATORS[language] ?? ' | '}${brand}`
}

export function ogImagePath(page: Pick<SeoPage, 'path' | 'locale'>): string {
  const path = page.path.replace(/\/+$/, '') || '/'
  return `/og${localePrefix(page.locale)}${path === '/' ? '/index' : path}.png`
}

/**
 * `languages`：该页真实存在译文的语言，省略时为全部启用语言；hreflang 仍按 alternateLinks 的站点规则生成，
 * 省略时与模板 0.7.3 之前的输出相同。
 * 回退页（`sourceLocale` 与 `locale` 不同且同站点，模板 0.7.4 fallbackSourceLocale）的 canonical 与 og:url
 * 指向原语言地址；原语言在另一站点（东方站显示英文条目）时 canonical 指向本页，不跨站。
 * 页面声明了 `alternates` 时 hreflang 改用声明的地址（模板 0.8.0）；`'hide'` 模式下回退页不发布，构建期校验拒绝。
 */
export function pageHead(
  page: SeoPage,
  appUrl: string,
  structuredData: readonly unknown[] = [],
  languages: readonly string[] = locales,
) {
  appUrl = localeOrigin(page.locale)
  const source = fallbackSourceLocale(page) ?? page.locale
  const url = absoluteUrl(localeOrigin(source), localizedPath(page.path, source))
  const brand = pageBrand(page)
  const title = titleWithSite(page.title, page.locale)
  const image = page.cover
    ? absoluteUrl(appUrl, page.cover)
    : absoluteUrl(appUrl, ogImagePath(page))
  return {
    meta: [
      { title },
      { name: 'description', content: page.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: page.description },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: brand },
      { property: 'og:type', content: page.date ? 'article' : 'website' },
      { property: 'og:locale', content: page.locale },
      { property: 'og:image', content: image },
      { property: 'og:image:alt', content: title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: page.description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: title },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...alternateLinks(appUrl, page.path, languages, pageAlternates(page), page.locale),
    ],
    scripts: structuredData.map((data) => ({
      type: 'application/ld+json',
      children: JSON.stringify(data).replace(/</g, '\\u003c'),
    })),
  }
}
