import { createFileRoute } from '@tanstack/react-router'
import { sitemapIndex } from '../features/seo/crawlers.ts'
import { resolveSite } from '../features/site/site.ts'
import { templateConfig } from '../server/template-config.ts'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(sitemapIndex(resolveSite(new URL(request.url).host, templateConfig).id), {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        }),
    },
  },
})
