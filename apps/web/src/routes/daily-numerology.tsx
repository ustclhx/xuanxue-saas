import { createFileRoute } from '@tanstack/react-router'
import { referenceDate } from '../features/daily/date.ts'
import { requireDailyLocale, westDailyHead } from '../features/daily/head.ts'
import { EN_RULES } from '../features/daily/rules/en.ts'
import { loadWestDaily, WestDailyPage } from '../features/daily/west-page.tsx'
import { MarketingShell } from '../features/marketing/marketing-shell.tsx'

// 西方站每日数字页（add-birth-profiles-daily-horoscope design D7、D9）：SSR，不预渲染；
// 参考时区 America/New_York，loader 只按日期计算，不访问数据库与会话。
export const Route = createFileRoute('/daily-numerology')({
  beforeLoad: () => requireDailyLocale('en'),
  loader: () => loadWestDaily(referenceDate('en')),
  head: ({ loaderData, matches }) => (loaderData ? westDailyHead(loaderData, matches) : {}),
  component: DailyRoute,
})

function DailyRoute() {
  const data = Route.useLoaderData()
  return (
    <MarketingShell>
      <WestDailyPage rules={EN_RULES} data={data} />
    </MarketingShell>
  )
}
