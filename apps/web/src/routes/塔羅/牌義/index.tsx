import { createFileRoute } from '@tanstack/react-router'
import { TarotIndexPage } from '../../../features/tools/tarot/index-page.tsx'
import {
  requireMeaningLocale,
  tarotIndexHead,
} from '../../../features/tools/tarot/meaning-route.tsx'

// 牌義索引頁（openspec refresh-visual-system-warm，设计稿 warm-refresh/TarotIndexEast.dc.html）：78 张牌的分组链接列表
export const Route = createFileRoute('/塔羅/牌義/')({
  beforeLoad: () => requireMeaningLocale('zh-Hant'),
  head: ({ matches }) => tarotIndexHead('zh-Hant', matches),
  component: () => <TarotIndexPage locale="zh-Hant" />,
})
