import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { getMoonPage, type MoonPayload } from './moon.functions.ts'
import { MoonPage } from './pages.tsx'
import { isMoonLocale, MOON_YEAR_PARAM, type MoonPageId, moonPageIds } from './paths.ts'

/**
 * 西方内容分发（features/west-content/route-data.ts）的月相集合入口：本模块随月相页按需加载，
 * 不引入内容集合与 astronomy-engine（数据经 server function 读取）。
 * 月份页的 `?year=` 可能被路由解析成数字，一律转成字符串交给服务端校验。
 */
export async function load(
  route: WestContentRoute,
  search: Readonly<Record<string, unknown>>,
): Promise<WestContentPayload | null> {
  const { locale } = route
  if (!isMoonLocale(locale) || !moonPageIds(locale).includes(route.id as MoonPageId)) return null
  const raw = search[MOON_YEAR_PARAM]
  const year =
    route.id.length > 0 && raw !== undefined && raw !== null ? String(raw).slice(0, 8) : undefined
  return getMoonPage({
    data: { id: route.id as MoonPageId, locale, ...(year !== undefined && { year }) },
  })
}

export function Page({ data }: { data: WestContentData }) {
  const payload = data.content as MoonPayload
  return (
    <MoonPage
      key={`${payload.path}-${payload.kind === 'month' ? payload.view.year : ''}`}
      payload={payload}
    />
  )
}
