import { createFileRoute } from '@tanstack/react-router'
import { TarotRoute } from '../../features/tools/tarot/route.tsx'
import { resolveTarotRoute, tarotHead } from '../../features/tools/tarot/route-head.ts'

// 每日一张、是/否与凯尔特十字：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/塔羅/$spread')({
  loader: ({ params }) => ({ spread: resolveTarotRoute('zh-Hant', params.spread) }),
  head: ({ matches, params }) => tarotHead('zh-Hant', params.spread, matches),
  component: () => <TarotRoute locale="zh-Hant" spread={Route.useLoaderData().spread} />,
})
