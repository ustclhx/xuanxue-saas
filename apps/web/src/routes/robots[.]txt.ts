import { createFileRoute } from '@tanstack/react-router'
import { robots } from '../features/seo/crawlers.ts'
import { seoSiteOrigin } from '../features/seo/origins.ts'
import { resolveSite } from '../features/site/site.ts'
import { templateConfig } from '../server/template-config.ts'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const site = resolveSite(new URL(request.url).host, templateConfig)
        return new Response(robots(seoSiteOrigin(site.id), site.known), {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
