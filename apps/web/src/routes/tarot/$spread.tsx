import { createFileRoute } from '@tanstack/react-router'
import { resolveTarotRoute, TarotRoute, tarotHead } from '../../features/tools/tarot/route.tsx'

// 每日一张、是/否与凯尔特十字：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/tarot/$spread')({
  loader: ({ params }) => ({ spread: resolveTarotRoute('en', params.spread) }),
  head: ({ matches, params }) => tarotHead('en', params.spread, matches),
  component: () => <TarotRoute locale="en" spread={Route.useLoaderData().spread} />,
})
