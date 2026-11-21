import { createFileRoute, lazyRouteComponent, notFound } from '@tanstack/react-router'
import { getLocale } from '../../paraglide/runtime.js'

// 东方站根路径英文的两段地址（openspec add-locales-eu-ja 5b，关键词地图方案 A）：
// `/tarot-spreads/<牌阵>`、`/tarot-feelings/<牌>`。只在东方站存在（西方站同路径由站点守卫 404）；
// 其他两段地址的静态首段路由（`/tarot/…`、`/blog/…` 等）优先匹配，到这里的未知地址一律 404。
// 地址解析、head 与正文在 features/east-en/route-data.ts（按需加载），不在入口包里逐页登记路由。
const Page = lazyRouteComponent(
  () => import('../../features/east-en/tarot-pages.tsx'),
  'EastEnTarotPage',
)

export const Route = createFileRoute('/$section/$item')({
  loader: async ({ params }) => {
    if (getLocale() !== 'en') throw notFound()
    const [{ eastEnTarotData }] = await Promise.all([
      import('../../features/east-en/route-data.ts'),
      Page.preload?.(),
    ])
    const data = await eastEnTarotData(`/${params.section}/${params.item}`)
    if (!data) throw notFound()
    return data
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  component: () => <Page data={Route.useLoaderData()} />,
})
