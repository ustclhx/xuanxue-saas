import type { SiteId } from '@xuanxue/config'
import { THEME_STORAGE_KEY } from '@xuanxue/ui'
import eastKoFonts from '../../styles/fonts/east-ko.css?url'
import eastZhHansFonts from '../../styles/fonts/east-zh-hans.css?url'
import eastZhHantFonts from '../../styles/fonts/east-zh-hant.css?url'
import westFonts from '../../styles/fonts/west.css?url'

/**
 * 两站主题（docs/design/visual-system.md）：token 在 styles/brand.css 中按 <html data-site> 切换。
 * 字体自托管（@fontsource，unicode-range 分片、font-display: swap），不请求外部字体服务；
 * 每个站点 / 语言一张独立样式表，只引入本站本语言需要的字体，CJK 正文用系统字体栈。
 */
export function siteFontHref(site: SiteId, locale: string): string {
  if (site === 'west') return westFonts
  if (locale === 'ko') return eastKoFonts
  // 简中页用 Noto Sans SC：TC 缺一部分简体字形（使用者 2026-11-19 确认）
  return locale === 'zh-Hans' ? eastZhHansFonts : eastZhHantFonts
}

/** 站点图标（public/images/favicon-<site>.*）：与页头标志一致；/favicon.ico 由同名路由按 Host 指向对应站点 */
export function siteIconLinks(site: SiteId) {
  return [
    { rel: 'icon', href: `/images/favicon-${site}.svg`, type: 'image/svg+xml' },
    { rel: 'icon', href: `/images/favicon-${site}-32.png`, sizes: '32x32', type: 'image/png' },
  ]
}

/**
 * 字体样式表不阻塞首屏（性能审计：繁中字体 CSS 约 260KB）：<head> 内脚本插入 <link>，
 * 字体到达前用 brand.css 中度量匹配的本机 fallback。换语言是整页导航，只需在首次加载时插入一次。
 * 未启用脚本时不加载站点字体，页面保持系统字体，属可接受的降级。
 *
 * 插入时机推迟到首次内容绘制（FCP）之后（redesign-home-chart-visuals 10.1 复测）：立即插入时，
 * 字体 CSS 与首屏用到的数十个 CJK 分片（简繁首页约 1.4MB）常在首帧之前下载完，
 * 与首屏 HTML、入口脚本争带宽并推迟首帧，LCP 波动到 9–17 秒。首屏 LCP 元素是系统字体正文，
 * 不依赖站点字体；标题字体在 FCP 后开始下载、按 font-display: swap 替换，度量匹配的 fallback 使替换无位移。
 * 浏览器不支持 paint 计时（或页面在后台、迟迟不绘制）时，load 事件或 3 秒后兜底插入。
 */
export function siteFontScript(site: SiteId, locale: string): string {
  const href = JSON.stringify(siteFontHref(site, locale))
  return `(function(){var d=0;function a(){if(d)return;d=1;var l=document.createElement('link');l.rel='stylesheet';l.href=${href};document.head.appendChild(l)}try{new PerformanceObserver(function(s){if(s.getEntriesByName('first-contentful-paint').length)setTimeout(a,0)}).observe({type:'paint',buffered:true})}catch(e){addEventListener('load',a)}setTimeout(a,3000)})()`
}

/** 记录「已写入过站点默认主题」的存储键：访客之后改选「跟随系统」（模板会删掉主题键）时不再写回默认值 */
export const SITE_THEME_DEFAULT_MARK = 'theme-site-default'

/**
 * 站点默认主题（openspec refresh-visual-system-warm design.md D3、OQ1）：必须排在模板 themeInitScript 之前执行。
 * 西方站的访客第一次到访、还没有保存过主题选择时，把选择写为浅色，使首帧与水合后都是浅色，不跟随系统；
 * 模板把「没有保存的选择」一律当作跟随系统（首帧脚本与水合后的 useTheme 都如此），因此用写入默认值而不是
 * 只改 <html> 类名，否则系统为深色的访客会在水合后被切回深色。只写一次：访客之后选深色或跟随系统都照常生效。
 * 存储不可用时不处理，按模板的跟随系统降级。东方站不写入，沿用模板默认（跟随系统）。
 */
export function siteThemeScript(storageKey: string = THEME_STORAGE_KEY): string {
  const key = JSON.stringify(storageKey)
  const mark = JSON.stringify(SITE_THEME_DEFAULT_MARK)
  return `(function(){try{if(document.documentElement.getAttribute('data-site')==='west'&&!localStorage.getItem(${key})&&!localStorage.getItem(${mark})){localStorage.setItem(${key},'light');localStorage.setItem(${mark},'1')}}catch(e){}})()`
}

/** 站点语言入口的自称（语言切换链接使用，不随界面语言翻译） */
export const LOCALE_AUTONYMS: Record<string, string> = {
  en: 'English',
  'zh-Hant': '繁體中文',
  'zh-Hans': '简体中文',
  ko: '한국어',
}
