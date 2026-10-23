import { createFileRoute } from '@tanstack/react-router'
import { TarotRoute } from '../../features/tools/tarot/route.tsx'
import { resolveTarotRoute, tarotHead } from '../../features/tools/tarot/route-head.ts'

// 三张牌（主牌阵）：openspec add-tarot-reading 决策 5
export const Route = createFileRoute('/塔罗/')({
  loader: () => ({ spread: resolveTarotRoute('zh-Hans') }),
  head: ({ matches }) => tarotHead('zh-Hans', undefined, matches),
  component: () => <TarotRoute locale="zh-Hans" spread={Route.useLoaderData().spread} />,
})
