import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'
import { TarotRoute } from '../../features/tools/tarot/route.tsx'
import {
  resolveTarotRoute,
  sharedTarotLocale,
  tarotHead,
} from '../../features/tools/tarot/route-head.ts'
import { westContentRouteOf } from '../../features/west-content/routes.ts'
import { getLocale } from '../../paraglide/runtime.js'

// 主题牌阵页（content-growth-v2-tools 第 28 组，`/tarot/love` 等，只有 en）属于西方内容集合：
// 本文件路由先于 `/$section/$item` 匹配，因此在这里转交西方内容分发，正文与 head 按需加载。
const WestContentPage = lazyRouteComponent(
  () => import('../../features/west-content/route-data.ts'),
  'WestContentPage',
)

// 每日一张、是/否与凯尔特十字：openspec add-tarot-reading 决策 5；西班牙语子路径（carta-del-dia 等）共用本路由
export const Route = createFileRoute('/tarot/$spread')({
  loader: async ({ params, parentMatchPromise }) => {
    const locale = sharedTarotLocale()
    const topic = westContentRouteOf(getLocale(), `/tarot/${params.spread}`)
    if (topic && (await parentMatchPromise).loaderData?.site.id === 'west') {
      const [{ loadWestContent }] = await Promise.all([
        import('../../features/west-content/route-data.ts'),
        WestContentPage.preload?.(),
      ])
      return { westContent: await loadWestContent(topic) }
    }
    return { locale, spread: resolveTarotRoute(locale, params.spread) }
  },
  head: ({ loaderData, matches, params }) =>
    loaderData?.westContent?.head ?? tarotHead(sharedTarotLocale(), params.spread, matches),
  component: () => {
    const data = Route.useLoaderData()
    if ('westContent' in data) return <WestContentPage data={data.westContent} />
    return <TarotRoute locale={data.locale} spread={data.spread} />
  },
})
