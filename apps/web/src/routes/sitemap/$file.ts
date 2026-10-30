import { createFileRoute } from '@tanstack/react-router'
import { eastEnglishSitemap } from '../../features/marketing/east-english/head.ts'
import { sitemap, sitemapLocales } from '../../features/seo/crawlers.ts'
import { seoSiteOrigin } from '../../features/seo/origins.ts'
import { getPublicPages } from '../../features/seo/pages.server.ts'
import { EAST_ENGLISH_LOCALE, resolveSite } from '../../features/site/site.ts'
import { templateConfig } from '../../server/template-config.ts'

export const Route = createFileRoute('/sitemap/$file')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const site = resolveSite(new URL(request.url).host, templateConfig)
        const locale = sitemapLocales(site.id).find((l) => `${l.toLowerCase()}.xml` === params.file)
        if (!locale) return new Response('Not Found', { status: 404 })
        const headers = {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 'public, max-age=300',
        }
        // 东方站 en 子图只有英文入口页（D5），en 的其他页面属于西方站
        if (site.id === 'east' && locale === EAST_ENGLISH_LOCALE)
          return new Response(eastEnglishSitemap(), { headers })
        return new Response(sitemap(getPublicPages(), seoSiteOrigin(site.id), locale), { headers })
      },
    },
  },
})
