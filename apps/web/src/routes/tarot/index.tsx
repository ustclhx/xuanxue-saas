import { createFileRoute } from '@tanstack/react-router'
import { TarotRoute } from '../../features/tools/tarot/route.tsx'
import {
  resolveTarotRoute,
  sharedTarotLocale,
  tarotHead,
} from '../../features/tools/tarot/route-head.ts'

// 三张牌（主牌阵）：openspec add-tarot-reading 决策 5；`/es/tarot` 共用本路由（add-locales-eu-ja 决策 2）
export const Route = createFileRoute('/tarot/')({
  loader: () => {
    const locale = sharedTarotLocale()
    return { locale, spread: resolveTarotRoute(locale) }
  },
  head: ({ matches }) => tarotHead(sharedTarotLocale(), undefined, matches),
  component: () => {
    const { locale, spread } = Route.useLoaderData()
    return <TarotRoute locale={locale} spread={spread} />
  },
})
