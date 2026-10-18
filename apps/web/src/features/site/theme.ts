import type { SiteId } from '@xuanxue/config'
import eastKoFonts from '../../styles/fonts/east-ko.css?url'
import eastZhHantFonts from '../../styles/fonts/east-zh-hant.css?url'
import westFonts from '../../styles/fonts/west.css?url'

/**
 * 两站主题（docs/design/visual-system.md）：token 在 styles/site-theme.css 中按 <html data-site> 切换。
 * 字体自托管（@fontsource，unicode-range 分片、font-display: swap），不请求外部字体服务；
 * 每个站点 / 语言一张独立样式表，只引入本站本语言需要的字体，CJK 正文用系统字体栈。
 */
export function siteFontHref(site: SiteId, locale: string): string {
  if (site === 'west') return westFonts
  return locale === 'ko' ? eastKoFonts : eastZhHantFonts
}

export function siteFontLinks(site: SiteId, locale: string) {
  return [{ rel: 'stylesheet', href: siteFontHref(site, locale) }]
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
