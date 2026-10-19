import type { SpreadId } from '@xuanxue/tarot'
import { MarketingShell } from '../../marketing/marketing-shell.tsx'
import type { TarotLocale } from './routes.ts'
import { TarotSpreadPage } from './tarot-page.tsx'

// 牌阵页组件只由文件路由的 component 引用，随路由组件拆分加载；loader / head 用 route-head.ts，
// 避免把牌阵交互、牌义数据带进主入口。
export function TarotRoute({ locale, spread }: { locale: TarotLocale; spread: SpreadId }) {
  return (
    <MarketingShell>
      <TarotSpreadPage spread={spread} locale={locale} />
    </MarketingShell>
  )
}
