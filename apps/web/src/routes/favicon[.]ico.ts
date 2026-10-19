import { createFileRoute } from '@tanstack/react-router'
import { resolveSite } from '../features/site/site.ts'
import { templateConfig } from '../server/template-config.ts'

// 两站共用一个 Worker 与静态资源目录：/favicon.ico 按请求 Host 重定向到本站图标（public/images/favicon-<site>.ico）
export const Route = createFileRoute('/favicon.ico')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const site = resolveSite(new URL(request.url).host, templateConfig)
        return new Response(null, {
          status: 302,
          headers: {
            location: `/images/favicon-${site.id}.ico`,
            'cache-control': 'public, max-age=86400',
          },
        })
      },
    },
  },
})
