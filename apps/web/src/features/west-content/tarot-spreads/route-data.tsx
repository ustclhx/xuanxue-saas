import type { TopicSpreadId } from '@xuanxue/tarot'
import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'
import { getTarotSpreadPage, type TarotSpreadPayload } from './page.functions.ts'
import { TarotSpreadRoute } from './page.tsx'
import { TAROT_SPREAD_LOCALE, TAROT_TOPIC_SPREADS } from './paths.ts'

/**
 * 西方内容分发（features/west-content/route-data.ts）的主题牌阵集合入口：本模块随牌阵页按需加载，
 * 内容集合与月相表经 server function 读取。`/tarot/…` 由塔罗文件路由（routes/tarot/$spread.tsx）转交到这里。
 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  if (
    route.locale !== TAROT_SPREAD_LOCALE ||
    !(TAROT_TOPIC_SPREADS as readonly string[]).includes(route.id)
  )
    return null
  return getTarotSpreadPage({ data: { id: route.id as TopicSpreadId } })
}

export function Page({ data }: { data: WestContentData }) {
  const payload = data.content as TarotSpreadPayload
  return <TarotSpreadRoute key={payload.id} payload={payload} />
}
