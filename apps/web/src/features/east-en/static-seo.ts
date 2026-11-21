import type { SeoPage } from '../seo/metadata.ts'

/**
 * 东方站根路径英文的静态页（5b，关键词地图 keyword-maps/east-en.md）：与西方站同路径页面分开的标题与描述；
 * 只有首页、定价与常见问题（东方站英文没有博客、文档、通讯与候补名单）。
 * 不放在 seo/metadata.ts：那里随各首页进入水合闭包；本模块只由服务端清单与按需加载的路由数据引用。
 */
const EAST_ENGLISH_STATIC = {
  '/': [
    'Ganjiday: Free Chinese Astrology Birth Chart Tools',
    'Free Chinese astrology birth charts in English: a BaZi Four Pillars calculator, a Zi Wei Dou Shu chart and tarot spreads, calculated by traditional rules.',
  ],
  '/pricing': [
    'Pricing: Free Charts and Reading Credits',
    'BaZi, Zi Wei Dou Shu and tarot tools are free. Credits only unlock optional full readings written from your own chart.',
  ],
  '/faq': [
    'FAQ: BaZi, Zi Wei, Credits and Privacy',
    'Answers about BaZi and Zi Wei Dou Shu calculations, unknown birth times, credits and refunds, failed readings and privacy on Ganjiday.',
  ],
} as const satisfies Readonly<Record<string, readonly [string, string]>>

export type EastEnglishStaticPath = keyof typeof EAST_ENGLISH_STATIC

export function isEastEnglishStaticPath(path: string): path is EastEnglishStaticPath {
  return path in EAST_ENGLISH_STATIC
}

/** 东方站根路径英文的静态页元数据（site: 'east'） */
export function eastEnglishStaticPage(path: EastEnglishStaticPath): SeoPage {
  const [title, description] = EAST_ENGLISH_STATIC[path]
  return { path, title, description, locale: 'en', site: 'east' }
}
