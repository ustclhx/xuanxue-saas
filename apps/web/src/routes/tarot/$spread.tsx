import { createFileRoute } from '@tanstack/react-router'
import { TarotRoute } from '../../features/tools/tarot/route.tsx'
import {
  resolveTarotRoute,
  sharedTarotLocale,
  tarotHead,
} from '../../features/tools/tarot/route-head.ts'

// 每日一张、是/否与凯尔特十字：openspec add-tarot-reading 决策 5；西班牙语子路径（carta-del-dia 等）共用本路由
export const Route = createFileRoute('/tarot/$spread')({
  loader: ({ params }) => {
    const locale = sharedTarotLocale()
    return { locale, spread: resolveTarotRoute(locale, params.spread) }
  },
  head: ({ matches, params }) => tarotHead(sharedTarotLocale(), params.spread, matches),
  component: () => {
    const { locale, spread } = Route.useLoaderData()
    return <TarotRoute locale={locale} spread={spread} />
  },
})
