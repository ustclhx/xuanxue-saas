import { createFileRoute } from '@tanstack/react-router'
import { referenceDate } from '../features/daily/date.ts'
import { EastDailyPage, loadEastDaily } from '../features/daily/east-page.tsx'
import { eastDailyHead, requireDailyLocale } from '../features/daily/head.ts'
import { KO_RULES } from '../features/daily/rules/ko.ts'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'

// 公开每日运势页（add-birth-profiles-daily-horoscope design D7、D9）：SSR，不预渲染；
// loader 只按参考日期计算，不访问数据库与会话，匿名请求由 server.ts 的每日页缓存按参考日缓存。
const LOCALE = 'ko'

export const Route = createFileRoute('/오늘의-운세')({
  beforeLoad: () => requireDailyLocale(LOCALE),
  loader: () => loadEastDaily(referenceDate(LOCALE)),
  head: ({ loaderData, matches }) => (loaderData ? eastDailyHead(LOCALE, loaderData, matches) : {}),
  component: DailyRoute,
})

function DailyRoute() {
  const data = Route.useLoaderData()
  return (
    <MarketingShell>
      <EastDailyPage locale={LOCALE} rules={KO_RULES} data={data} />
    </MarketingShell>
  )
}
