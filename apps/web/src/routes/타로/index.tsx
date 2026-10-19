import { createFileRoute } from '@tanstack/react-router'
import { TarotRoute } from '../../features/tools/tarot/route.tsx'
import { resolveTarotRoute, tarotHead } from '../../features/tools/tarot/route-head.ts'

// 三张牌（主牌阵）：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/타로/')({
  loader: () => ({ spread: resolveTarotRoute('ko') }),
  head: ({ matches }) => tarotHead('ko', undefined, matches),
  component: () => <TarotRoute locale="ko" spread={Route.useLoaderData().spread} />,
})
