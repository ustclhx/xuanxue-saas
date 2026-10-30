import { createFileRoute } from '@tanstack/react-router'
import { llmsTxt } from '../features/seo/crawlers.ts'
import { resolveSite } from '../features/site/site.ts'
import { templateConfig } from '../server/template-config.ts'

// 每个站点各自的 llms.txt；未知 Host（预览地址）与 robots 一致不对外提供
export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const site = resolveSite(new URL(request.url).host, templateConfig)
        const body = llmsTxt(site.id, site.known)
        if (body === null) return new Response('Not found', { status: 404 })
        return new Response(body, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
