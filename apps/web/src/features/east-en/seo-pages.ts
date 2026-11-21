import {
  EAST_EN_FEELINGS_ROOT,
  meaningAlternates,
  tarotIndexPath,
  tarotMeaningPath,
} from '../tools/tarot/meaning-routes.ts'
import { TAROT_LOCALES } from '../tools/tarot/routes.ts'

// 东方站根路径英文 as feelings 牌页的 SEO 条目（5b）：只由服务端页面清单、分享图构建与按需加载的路由数据引用，
// 不放在注册表引用的 meaning-routes.ts（那里随入口包加载）

/** 东方站根路径英文的 as feelings 牌页（content/tarot-feelings/en）：属于东方站，hreflang 指向东方站各语言牌义页 */
export function tarotFeelingsSeoPages(
  content: readonly { slug: string; title: string; description: string }[],
) {
  return content.map((page) => ({
    path: tarotMeaningPath(page.slug, 'en', 'east'),
    title: page.title,
    description: page.description,
    locale: 'en' as const,
    site: 'east' as const,
    alternates: meaningAlternates(page.slug, 'east'),
  }))
}

/** 东方站英文牌页索引的 head */
export function tarotFeelingsIndexSeo(description: string) {
  return {
    path: EAST_EN_FEELINGS_ROOT,
    locale: 'en' as const,
    site: 'east' as const,
    title: 'Tarot Cards as Feelings: All 78 Cards',
    description,
    alternates: Object.fromEntries(TAROT_LOCALES.map((l) => [l, tarotIndexPath(l, 'east')])),
  }
}
