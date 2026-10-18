import { createFileRoute } from '@tanstack/react-router'
import { resolveTarotRoute, TarotRoute, tarotHead } from '../../features/tools/tarot/route.tsx'

// 三张牌（主牌阵）：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/tarot/')({
  loader: () => ({ spread: resolveTarotRoute('en') }),
  head: ({ matches }) => tarotHead('en', undefined, matches),
  component: () => <TarotRoute locale="en" spread={Route.useLoaderData().spread} />,
})
