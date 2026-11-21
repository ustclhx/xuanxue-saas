import type { SiteId } from '@xuanxue/config'
import {
  allDocs,
  allGuides,
  allLegalPages,
  allNumerologies,
  allPosts,
  allTarots,
} from 'content-collections'
import { templateConfig } from '../../server/template-config.ts'
// 新语言页面的 SEO 文案（按语言拆分，服务端静态登记）
import '../i18n/page-copy.server.ts'
import { numerologySeoPages } from '../tools/numerology/routes.ts'
import { tarotLocalizedSeoPages, tarotMeaningSeoPages } from '../tools/tarot/meaning-routes.ts'
import type { SeoPage } from './metadata.ts'
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
export function getPageLinks(path: string, locale: string, fallbackParent?: string): PageLinks {
  return pageLinks(currentPages(), path, locale, templateConfig.seo.linking, fallbackParent)
}

/** 公开页面清单中的一页（不带语言前缀的 path），用于由清单生成的页面（如 hub 分页）输出 head */
export function getPublicPage(path: string, locale: string): SeoPage | undefined {
  return currentPages().find((page) => page.path === path && page.locale === locale)
}
