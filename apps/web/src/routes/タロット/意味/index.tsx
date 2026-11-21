import { createFileRoute } from '@tanstack/react-router'
import { TarotIndexPage } from '../../../features/tools/tarot/index-page.tsx'
import {
  requireMeaningLocale,
  tarotIndexHead,
} from '../../../features/tools/tarot/meaning-route.tsx'

// タロットカードの意味一覧（ja）（openspec refresh-visual-system-warm，设计稿 warm-refresh/TarotIndexEast.dc.html）：78 张牌的分组链接列表
export const Route = createFileRoute('/タロット/意味/')({
  beforeLoad: () => requireMeaningLocale('ja'),
  head: ({ matches }) => tarotIndexHead('ja', matches),
  component: () => <TarotIndexPage locale="ja" />,
})
