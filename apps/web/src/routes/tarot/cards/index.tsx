import { createFileRoute } from '@tanstack/react-router'
import { TarotIndexPage } from '../../../features/tools/tarot/index-page.tsx'
import {
  requireMeaningLocale,
  tarotIndexHead,
} from '../../../features/tools/tarot/meaning-route.tsx'

// 牌义索引页（openspec refresh-visual-system-warm，设计稿 warm-refresh/TarotIndex.dc.html）：78 张牌的分组链接列表
export const Route = createFileRoute('/tarot/cards/')({
  beforeLoad: () => requireMeaningLocale('en'),
  head: ({ matches }) => tarotIndexHead('en', matches),
  component: () => <TarotIndexPage locale="en" />,
})
