import type { AnyRouteMatch } from '@tanstack/react-router'
import type { SiteId } from '@xuanxue/config'
import { templateConfig } from '../../server/template-config.ts'
import { isAppAreaPath } from '../i18n/app-area.ts'
import { localePrefix } from '../i18n/url-prefix.ts'
import { TOOL_ROUTES } from '../tools/registry.ts'
import { localeOrigin, seoSiteOrigin } from './origins.ts'

export interface SeoPage {
  path: string
  siteEntry?: SiteId
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

const staticCopy: Record<string, Record<string, readonly [string, string]>> = {
  en: {
    '/': [
      'Your AI workspace',
      'AI conversations, creation and team collaboration in one workspace.',
    ],
    '/pricing': [
      'Pricing and plans',
      'Compare subscriptions and credit packs for your AI workspace.',
    ],
    '/blog': ['Blog', 'Product updates, practical guides and creation tips.'],
    '/docs': [
      'Documentation',
      'Getting started, configuration and content guides for your workspace.',
    ],
    '/newsletter': ['Newsletter', 'Subscribe to receive the latest product news.'],
    '/waitlist': ['Join the waitlist', 'Join the waitlist to hear when the product is ready.'],
  },
  'zh-Hant': {
    '/': ['AI 工作空間', '在一個工作空間中使用 AI 對話、創作與團隊協作。'],
    '/pricing': ['定價與方案', '比較訂閱方案與積分包，選擇適合你的 AI 工作空間。'],
    '/blog': ['部落格', '閱讀產品更新、實用指南與創作技巧。'],
    '/docs': ['文件', '查閱工作空間的入門、設定與內容指南。'],
    '/newsletter': ['訂閱電子報', '訂閱電子報，取得最新產品消息。'],
    '/waitlist': ['加入候補名單', '登記候補名單，第一時間收到產品開放通知。'],
  },
  ko: {
    '/': ['AI 워크스페이스', 'AI 대화, 창작, 팀 협업을 하나의 워크스페이스에서.'],
    '/pricing': ['요금제', 'AI 워크스페이스에 맞는 구독 요금제와 크레딧 팩을 비교해 보세요.'],
    '/blog': ['블로그', '제품 소식, 실용 가이드와 창작 팁을 읽어 보세요.'],
    '/docs': ['문서', '워크스페이스 시작하기, 설정, 콘텐츠 가이드를 확인하세요.'],
    '/newsletter': ['뉴스레터', '뉴스레터를 구독하고 최신 제품 소식을 받아 보세요.'],
    '/waitlist': ['대기자 명단 등록', '대기자 명단에 등록하고 출시 소식을 가장 먼저 받아 보세요.'],
  },
}

/** 未提供文案的语言回退到英语 */
export function staticPage(path: string, locale: string): SeoPage {
  const [title, description] = (staticCopy[locale] ?? staticCopy.en)?.[path] ?? [path, path]
  return { path, title, description, locale }
}

/** 博客标签页标题 */
export function tagPageTitle(tag: string, locale: string): string {
  if (locale === 'zh-Hant') return `標籤「${tag}」下的文章`
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

export function eastEntryPage(): SeoPage {
  return {
    path: '/',
    locale: 'zh-Hant',
    siteEntry: 'east',
    title: '選擇語言 · 언어 선택',
    description: '繁體中文 · 한국어',
  }
}

export function ogImagePath(page: Pick<SeoPage, 'path' | 'locale' | 'siteEntry'>): string {
  if (page.siteEntry) return `/og/${page.siteEntry}/index.png`
  const path = page.path.replace(/\/+$/, '') || '/'
  return `/og${localePrefix(page.locale)}${path === '/' ? '/index' : path}.png`
}

export function pageHead(page: SeoPage, appUrl: string, structuredData: readonly unknown[] = []) {
  appUrl = page.siteEntry ? seoSiteOrigin(page.siteEntry) : localeOrigin(page.locale)
  const url = absoluteUrl(appUrl, page.siteEntry ? '/' : localizedPath(page.path, page.locale))
  const title = `${page.title} | ${templateConfig.app.name}`
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
      { property: 'og:site_name', content: templateConfig.app.name },
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
