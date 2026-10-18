import { createFileRoute } from '@tanstack/react-router'
import { resolveTarotRoute, TarotRoute, tarotHead } from '../../features/tools/tarot/route.tsx'

// 三张牌（主牌阵）：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/타로/')({
  loader: () => ({ spread: resolveTarotRoute('ko') }),
  head: ({ matches }) => tarotHead('ko', undefined, matches),
  component: () => <TarotRoute locale="ko" spread={Route.useLoaderData().spread} />,
})
