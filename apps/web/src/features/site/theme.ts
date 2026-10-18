import type { SiteId } from '@xuanxue/config'

/**
 * 两站主题（docs/design/visual-system.md）：token 在 styles/site-theme.css 中按 <html data-site> 切换。
 * 字体只加载本站本语言需要的一套（Google Fonts，display=swap），CJK 正文用系统字体栈。
 */
const FONT_FAMILIES: Record<string, string> = {
  'east:ko': 'family=Noto+Serif+KR:wght@500;700',
  east: 'family=Noto+Serif+TC:wght@500;700',
  west: 'family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;600',
}

export function siteFontHref(site: SiteId, locale: string): string {
  const families = FONT_FAMILIES[`${site}:${locale}`] ?? FONT_FAMILIES[site]
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

export function siteFontLinks(site: SiteId, locale: string) {
  return [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' as const },
    { rel: 'stylesheet', href: siteFontHref(site, locale) },
  ]
}

/**
 * 紧跟在 themeInitScript 之后执行：西方站没有浅色主题，始终保留 `dark` 类，
 * 让 Tailwind 的 `dark:` 变体与深色底一致。
 */
export const SITE_THEME_SCRIPT =
  "(function(){var d=document.documentElement;if(d.getAttribute('data-site')==='west')d.classList.add('dark')})()"

/** 站点语言入口的自称（语言切换链接使用，不随界面语言翻译） */
export const LOCALE_AUTONYMS: Record<string, string> = {
  en: 'English',
  'zh-Hant': '繁體中文',
  ko: '한국어',
}
