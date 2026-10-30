import type { AnyRouteMatch } from '@tanstack/react-router'
import { brandName } from '@xuanxue/config'
import type { Locale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { TOOL_ROUTES } from '../tools/registry.ts'
import { localeOrigin, seoSiteOrigin } from './origins.ts'

export interface SeoPage {
  path: string
  title: string
  description: string
  locale: string
  alternates?: Readonly<Partial<Record<string, string>>>
  cover?: string | undefined
  date?: string | undefined
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

export function alternateLinks(
  _appUrl: string,
  path: string,
  languages: readonly string[] = locales,
  translations?: Readonly<Partial<Record<string, string>>>,
  locale = languages[0] ?? defaultLocale,
) {
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
    translatedPath && locales.some((locale) => locale === language)
      ? [
          {
            rel: 'alternate',
            hrefLang: language,
            href: absoluteUrl(localeOrigin(language), localizedPath(translatedPath, language)),
          },
        ]
      : [],
  )
  return [
    ...links,
    {
      rel: 'alternate',
      hrefLang: 'x-default',
      href: paths.en
        ? absoluteUrl(seoSiteOrigin('west'), localizedPath(paths.en, 'en'))
        : absoluteUrl(localeOrigin(locale), '/'),
    },
  ]
}

/** 由 staticPage 提供元数据的静态页；新增静态页须在每种语言下补齐文案 */
export type StaticPath = '/' | '/pricing' | '/blog' | '/docs' | '/newsletter' | '/waitlist' | '/faq'

// 按全部语言必填：缺少任一语言或页面都会在类型检查时报错，避免再次回退到英语或另一站点的描述。
// 东方站（zh-Hant / zh-Hans / ko）描述八字、紫微、塔罗等本站体系，不写 numerology。
const staticCopy: Record<Locale, Record<StaticPath, readonly [string, string]>> = {
  en: {
    '/': [
      'Free numerology and tarot tools',
      'Life Path, numerology chart, name numerology and tarot spreads, calculated by traditional rules in your browser. For entertainment and self-reflection.',
    ],
    '/pricing': [
      'Pricing: free tools and credit packs',
      'All numerology and tarot tools are free. Credit packs unlock full AI readings of your own numbers and cards.',
    ],
    '/blog': ['Blog', 'Guides to numerology, tarot and reading your own results.'],
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
    '/': [
      '八字排盤、紫微斗數與塔羅',
      '免費八字排盤、紫微斗數與塔羅工具，依傳統規則在瀏覽器中計算，僅供娛樂與自我反思。',
    ],
    '/pricing': [
      '價格方案：免費工具與積分包',
      '八字、紫微與塔羅工具全部免費；積分包用於解鎖依你命盤撰寫的 AI 完整詳批。',
    ],
    '/blog': ['部落格', '八字、紫微與塔羅的入門指南與結果解讀。'],
    '/docs': ['文件', '本站使用說明與指南。'],
    '/newsletter': ['訂閱電子報', '訂閱電子報，取得八字、紫微與塔羅的新文章與產品消息。'],
    '/waitlist': ['加入候補名單', '登記候補名單，第一時間收到產品開放通知。'],
    '/faq': [
      '常見問題：積分、退款與隱私',
      '關於免費工具、積分與退款、詳批失敗、隱私，以及八字、紫微與塔羅計算方式的常見問題。',
    ],
  },
  'zh-Hans': {
    '/': [
      '八字排盘、紫微斗数与塔罗',
      '免费八字排盘、紫微斗数与塔罗工具，依传统规则在浏览器中计算，仅供娱乐与自我反思。',
    ],
    '/pricing': [
      '价格方案：免费工具与积分包',
      '八字、紫微与塔罗工具全部免费；积分包用于解锁依你命盘撰写的 AI 完整详批。',
    ],
    '/blog': ['博客', '八字、紫微与塔罗的入门指南与结果解读。'],
    '/docs': ['文档', '本站使用说明与指南。'],
    '/newsletter': ['订阅电子报', '订阅电子报，获取八字、紫微与塔罗的新文章与产品消息。'],
    '/waitlist': ['加入候补名单', '登记候补名单，第一时间收到产品开放通知。'],
    '/faq': [
      '常见问题：积分、退款与隐私',
      '关于免费工具、积分与退款、详批失败、隐私，以及八字、紫微与塔罗计算方式的常见问题。',
    ],
  },
  ko: {
    '/': [
      '무료 만세력·사주·타로',
      '무료 만세력, 사주궁합, 타로 도구. 전통 규칙에 따라 브라우저에서 계산하며 오락과 자기 성찰용입니다.',
    ],
    '/pricing': [
      '요금 안내: 무료 도구와 크레딧 팩',
      '만세력·사주·타로 도구는 모두 무료이며, 크레딧 팩으로 내 명식에 맞춘 AI 상세 풀이를 이용할 수 있습니다.',
    ],
    '/blog': ['블로그', '사주, 만세력, 타로 입문 가이드와 결과 읽는 법.'],
    '/docs': ['문서', '사이트 이용 안내와 가이드.'],
    '/newsletter': ['뉴스레터', '뉴스레터를 구독하고 사주·타로 새 글과 제품 소식을 받아 보세요.'],
    '/waitlist': ['대기자 명단 등록', '대기자 명단에 등록하고 출시 소식을 가장 먼저 받아 보세요.'],
    '/faq': [
      '자주 묻는 질문: 크레딧, 환불, 개인정보',
      '무료 도구, 크레딧과 환불, 상세 풀이 실패, 개인정보, 사주·타로 계산 방식에 대한 자주 묻는 질문입니다.',
    ],
  },
}

/** 静态页元数据；未登记的语言或路径以路径占位，不回退到其他语言 */
export function staticPage(path: StaticPath, locale: string): SeoPage {
  const copy: Partial<Record<string, Record<StaticPath, readonly [string, string]>>> = staticCopy
  const [title, description] = copy[locale]?.[path] ?? [path, path]
  return { path, title, description, locale }
}

/** 博客标签页标题 */
export function tagPageTitle(tag: string, locale: string): string {
  if (locale === 'zh-Hant') return `標籤「${tag}」下的文章`
  if (locale === 'zh-Hans') return `标签「${tag}」下的文章`
  if (locale === 'ko') return `‘${tag}’ 태그가 달린 글`
  return `Posts tagged “${tag}”`
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

export function ogImagePath(page: Pick<SeoPage, 'path' | 'locale'>): string {
  const path = page.path.replace(/\/+$/, '') || '/'
  return `/og${localePrefix(page.locale)}${path === '/' ? '/index' : path}.png`
}

export function pageHead(page: SeoPage, appUrl: string, structuredData: readonly unknown[] = []) {
  appUrl = localeOrigin(page.locale)
  const url = absoluteUrl(appUrl, localizedPath(page.path, page.locale))
  const brand = pageBrand(page)
  const title = `${page.title} | ${brand}`
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
      ...alternateLinks(appUrl, page.path, locales, page.alternates, page.locale),
    ],
    scripts: structuredData.map((data) => ({
      type: 'application/ld+json',
      children: JSON.stringify(data).replace(/</g, '\\u003c'),
    })),
  }
}
