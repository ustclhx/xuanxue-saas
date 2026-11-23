import type { SiteId } from '@xuanxue/config'
import {
  allCompats,
  allDocs,
  allGuides,
  allLegalPages,
  allNumerologies,
  allPosts,
  allTarotFeelings,
  allTarots,
  allWesternZodiacs,
  allYearlies,
  allZodiacPairs,
  allZodiacs,
} from 'content-collections'
import { templateConfig } from '../../server/template-config.ts'
import { compatSeoPages } from '../east-content/compat/seo-pages.ts'
import { yearlySeoPages } from '../east-content/yearly/seo-pages.ts'
import { zodiacSeoPages } from '../east-content/zodiac/seo-pages.ts'
import { zodiacPairSeoPages } from '../east-content/zodiac-pair/seo-pages.ts'
import { tarotFeelingsSeoPages } from '../east-en/seo-pages.ts'
import { siteOfLocale } from '../site/site.ts'
import { numerologySeoPages } from '../tools/numerology/routes.ts'
import { tarotLocalizedSeoPages, tarotMeaningSeoPages } from '../tools/tarot/meaning-routes.ts'
import { westernZodiacSeoPages } from '../west-content/zodiac/seo-pages.ts'
import { pageSite, type SeoPage } from './metadata.ts'
import { type PageLinks, pageLinks } from './page-links.ts'
import { publicPages } from './pages.ts'

export function getPublicPages(site?: SiteId) {
  return publicPages(
    {
      posts: allPosts,
      legal: allLegalPages,
      docs: allDocs,
      guides: allGuides,
      toolPages: [
        ...numerologySeoPages(allNumerologies),
        ...tarotMeaningSeoPages(allTarots),
        ...tarotLocalizedSeoPages(),
        // 东方站根路径英文的 as feelings 牌页（5b）
        ...tarotFeelingsSeoPages(allTarotFeelings),
        // 东方站生肖枢纽与子页（content-growth-phase2 第 4 组）
        ...zodiacSeoPages(allZodiacs),
        // 西方站星座枢纽、档案、配对总表与配对页（content-growth-v2-tools 第 20 组）
        ...westernZodiacSeoPages(allWesternZodiacs),
        // 东方站 2027 年度枢纽与年度生肖页（content-growth-v2-tools 第 8 组）
        ...yearlySeoPages(allYearlies),
        // 合盘工具页正文与关系场景页（content-growth-v2-tools 第 13 组）
        ...compatSeoPages(allCompats),
        // 东方站生肖配对总表与配对页（content-growth-v2-tools 第 16 组）
        ...zodiacPairSeoPages(allZodiacPairs),
      ],
    },
    new Date(),
    templateConfig,
    site,
  )
}

// 内链区块按请求计算：清单在同一分钟内复用，定时发布的文章最多延迟一分钟出现在区块中
let cached: { minute: number; pages: SeoPage[] } | null = null
function currentPages(): SeoPage[] {
  const minute = Math.floor(Date.now() / 60_000)
  if (cached?.minute !== minute) cached = { minute, pages: getPublicPages() }
  return cached.pages
}

/**
 * 页面的面包屑、系列、相关与同组链接（openspec seo-internal-linking 3.1–3.3），只在 server function 中调用，
 * 页面清单不进入客户端包。`fallbackParent` 用于清单之外仍可访问的页面（开发环境的草稿）。
 */
// 博客等内容页只属于语言的归属站点：排除另一站点的同语言页面（东方站根路径英文，5b）
const ownerPages = () =>
  currentPages().filter((page) => pageSite(page) === siteOfLocale(page.locale, templateConfig))

export function getPageLinks(path: string, locale: string, fallbackParent?: string): PageLinks {
  return pageLinks(ownerPages(), path, locale, templateConfig.seo.linking, fallbackParent)
}

/** 公开页面清单中的一页（不带语言前缀的 path），用于由清单生成的页面（如 hub 分页）输出 head */
export function getPublicPage(path: string, locale: string): SeoPage | undefined {
  return ownerPages().find((page) => page.path === path && page.locale === locale)
}
