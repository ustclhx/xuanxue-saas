import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { getZodiacPairPage, type ZodiacPairPageData } from './page.functions.ts'
import { ZodiacPairHubPage, ZodiacPairPage } from './pages.tsx'
import { isZodiacPairLocale } from './paths.ts'

/** 东方内容分发（features/east-content/route-data.ts）的生肖配对集合入口：本模块随配对页按需加载 */
export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  if (!isZodiacPairLocale(route.locale)) return null
  return getZodiacPairPage({ data: { locale: route.locale, id: route.id } })
}

export function Page({ data }: { data: EastContentData }) {
  const content = data.content as ZodiacPairPageData
  return content.kind === 'hub' ? (
    <ZodiacPairHubPage page={content} />
  ) : (
    <ZodiacPairPage page={content} />
  )
}
