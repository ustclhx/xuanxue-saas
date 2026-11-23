import { createFileRoute, lazyRouteComponent, notFound, redirect } from '@tanstack/react-router'
import { eastContentRouteOf } from '../../features/east-content/routes.ts'
import { eastEnContentRouteOf } from '../../features/east-en/paths.ts'
import { reversedPairPath } from '../../features/routing/pair-path.ts'
import { siteOfLocale } from '../../features/site/site.ts'
import { toolHref } from '../../features/tools/tool-href.ts'
import { westContentRouteOf } from '../../features/west-content/routes.ts'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'

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
const WestContentPage = lazyRouteComponent(
  () => import('../../features/west-content/route-data.ts'),
  'WestContentPage',
)

export const Route = createFileRoute('/$section/$item')({
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps = {}, location, parentMatchPromise }) => {
    const locale = getLocale()
    const path = `/${params.section}/${params.item}`
    const site =
      locale === 'en'
        ? (await parentMatchPromise).loaderData?.site.id
        : siteOfLocale(locale, templateConfig)
    if (!site) throw notFound()

    const canonical = reversedPairPath(site, locale, path)
    const contentPath = canonical ?? path
    const redirectToPair = (path: string): never => {
      const hash = location.hash ? `#${encodeURI(location.hash)}` : ''
      throw redirect({
        href: `${toolHref(path, locale)}${location.searchStr}${hash}`,
        statusCode: 301,
      })
    }

    if (site === 'west') {
      const route = westContentRouteOf(locale, contentPath)
      if (!route) throw notFound()
      if (canonical) redirectToPair(canonical)
      const [{ loadWestContent }] = await Promise.all([
        import('../../features/west-content/route-data.ts'),
        WestContentPage.preload?.(),
      ])
      return { westContent: await loadWestContent(route, deps) }
    }

    const route =
      locale === 'en' ? eastEnContentRouteOf(contentPath) : eastContentRouteOf(locale, contentPath)
    if (route) {
      if (canonical) redirectToPair(canonical)
      const [{ loadEastContent }] = await Promise.all([
        import('../../features/east-content/route-data.ts'),
        EastContentPage.preload?.(),
      ])
      return {
        eastContent: await loadEastContent(route, 'date' in deps ? deps.date : undefined, deps),
      }
    }
    if (
      locale !== 'en' ||
      (params.section !== 'tarot-spreads' && params.section !== 'tarot-feelings')
    )
      throw notFound()
    const [{ eastEnTarotData }] = await Promise.all([
      import('../../features/east-en/route-data.ts'),
      EastEnTarotPage.preload?.(),
    ])
    const tarot = await eastEnTarotData(path)
    if (!tarot) throw notFound()
    return { tarot }
  },
  head: ({ loaderData }) =>
    loaderData?.eastContent?.head ?? loaderData?.westContent?.head ?? loaderData?.tarot?.head ?? {},
  component: () => {
    const { eastContent, westContent, tarot } = Route.useLoaderData()
    if (eastContent) return <EastContentPage data={eastContent} />
    if (westContent) return <WestContentPage data={westContent} />
    return <EastEnTarotPage data={tarot} />
  },
})
