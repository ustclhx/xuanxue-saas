import { createFileRoute } from '@tanstack/react-router'
import { TarotIndexPage } from '../../../features/tools/tarot/index-page.tsx'
import {
  requireMeaningLocale,
  tarotIndexHead,
} from '../../../features/tools/tarot/meaning-route.tsx'

// 카드 의미 색인（openspec refresh-visual-system-warm，设计稿 warm-refresh/TarotIndexEast.dc.html）：78 张牌的分组链接列表
export const Route = createFileRoute('/타로/카드/')({
  beforeLoad: () => requireMeaningLocale('ko'),
  head: ({ matches }) => tarotIndexHead('ko', matches),
  component: () => <TarotIndexPage locale="ko" />,
})
