import { createFileRoute } from '@tanstack/react-router'
import { resolveTarotRoute, TarotRoute, tarotHead } from '../../features/tools/tarot/route.tsx'

// 每日一张、是/否与凯尔特十字：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/타로/$spread')({
  loader: ({ params }) => ({ spread: resolveTarotRoute('ko', params.spread) }),
  head: ({ matches, params }) => tarotHead('ko', params.spread, matches),
  component: () => <TarotRoute locale="ko" spread={Route.useLoaderData().spread} />,
})
