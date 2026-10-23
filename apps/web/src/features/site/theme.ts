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

/** 站点图标（public/images/favicon-<site>.*）：与页头标志一致；/favicon.ico 由同名路由按 Host 指向对应站点 */
export function siteIconLinks(site: SiteId) {
  return [
    { rel: 'icon', href: `/images/favicon-${site}.svg`, type: 'image/svg+xml' },
    { rel: 'icon', href: `/images/favicon-${site}-32.png`, sizes: '32x32', type: 'image/png' },
  ]
}

/**
 * 字体样式表不阻塞首屏（性能审计：繁中字体 CSS 约 260KB）：<head> 内同步执行的脚本插入 <link>，
 * 浏览器不会因脚本插入的样式表推迟渲染；字体到达前用 site-theme.css 中度量匹配的本机 fallback。
 * 换语言是整页导航（页头语言链接与语言选择），因此只需在首次加载时插入一次。
 * 未启用脚本时不加载站点字体，页面保持系统字体，属可接受的降级。
 */
export function siteFontScript(site: SiteId, locale: string): string {
  const href = JSON.stringify(siteFontHref(site, locale))
  return `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href=${href};document.head.appendChild(l)})()`
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
  'zh-Hans': '简体中文',
  ko: '한국어',
}
