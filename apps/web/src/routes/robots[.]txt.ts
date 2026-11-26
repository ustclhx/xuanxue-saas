import { createFileRoute } from '@tanstack/react-router'
import { robots } from '../features/seo/crawlers.ts'
import { seoSiteOrigin } from '../features/seo/origins.ts'
import { resolveSite } from '../features/site/site.ts'
import webPlugins from '../plugins.gen.ts'
import { templateConfig } from '../server/template-config.ts'

const pluginSitemaps = webPlugins.flatMap(({ entry }) => entry.sitemaps ?? [])

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const site = resolveSite(new URL(request.url).host, templateConfig)
        // 插件站点地图按本站 origin 列出（模板 0.11.0）；停用的插件不在 plugins.gen.ts 中，不会出现
        return new Response(robots(seoSiteOrigin(site.id), site.known, pluginSitemaps), {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
