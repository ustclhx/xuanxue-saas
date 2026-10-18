import { createFileRoute } from '@tanstack/react-router'
import { sitemap } from '../../features/seo/crawlers.ts'
import { seoSiteOrigin } from '../../features/seo/origins.ts'
import { getPublicPages } from '../../features/seo/pages.server.ts'
import { resolveSite } from '../../features/site/site.ts'
import { templateConfig } from '../../server/template-config.ts'

export const Route = createFileRoute('/sitemap/$file')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const site = resolveSite(new URL(request.url).host, templateConfig)
        const locale = templateConfig.sites[site.id].locales.find(
          (l) => `${l.toLowerCase()}.xml` === params.file,
        )
        if (
          !locale ||
          (!templateConfig.i18n.enabled && locale !== templateConfig.i18n.defaultLocale)
        )
          return new Response('Not Found', { status: 404 })
        return new Response(sitemap(getPublicPages(), seoSiteOrigin(site.id), locale), {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
