import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { eastContentRouteOf } from '../../features/east-content/routes.ts'
import { getLocale } from '../../paraglide/runtime.js'

// 东方站根路径英文的两段地址（openspec add-locales-eu-ja 5b，关键词地图方案 A）：
// `/tarot-spreads/<牌阵>`、`/tarot-feelings/<牌>`。只在东方站存在（西方站同路径由站点守卫 404）；
// 其他两段地址的静态首段路由（`/tarot/…`、`/blog/…` 等）优先匹配，到这里的未知地址一律 404。
// 地址解析、head 与正文在 features/east-en/route-data.ts（按需加载），不在入口包里逐页登记路由。
const EastEnTarotPage = lazyRouteComponent(
  () => import('../../features/east-en/tarot-pages.tsx'),
  'EastEnTarotPage',
)
const EastContentPage = lazyRouteComponent(
  () => import('../../features/east-content/route-data.ts'),
  'EastContentPage',
)

export const Route = createFileRoute('/$section/$item')({
  loader: async ({ params }) => {
    const locale = getLocale()
    const path = `/${params.section}/${params.item}`
    if (locale !== 'en') {
      const route = eastContentRouteOf(locale, path)
      if (!route) throw notFound()
      const [{ loadEastContent }] = await Promise.all([
        import('../../features/east-content/route-data.ts'),
        EastContentPage.preload?.(),
      ])
      return { eastContent: await loadEastContent(route) }
    }
    const [{ eastEnTarotData }] = await Promise.all([
      import('../../features/east-en/route-data.ts'),
      EastEnTarotPage.preload?.(),
    ])
    const tarot = await eastEnTarotData(path)
    if (!tarot) throw notFound()
    return { tarot }
  },
  head: ({ loaderData }) => loaderData?.eastContent?.head ?? loaderData?.tarot?.head ?? {},
  component: () => {
    const { eastContent, tarot } = Route.useLoaderData()
    return eastContent ? <EastContentPage data={eastContent} /> : <EastEnTarotPage data={tarot} />
  },
})
