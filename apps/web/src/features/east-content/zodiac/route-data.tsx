import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'
import { getZodiacPage, type ZodiacPageData } from './page.functions.ts'
import { ZodiacChildPage, ZodiacHubPage } from './pages.tsx'

/** 东方内容分发（features/east-content/route-data.ts）的生肖集合入口：本模块随生肖页按需加载 */
export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  if (route.locale !== 'zh-Hans') return null
  return getZodiacPage({
    data: {
      locale: route.locale,
      id: route.id as Parameters<typeof getZodiacPage>[0]['data']['id'],
    },
  })
}

export function Page({ data }: { data: EastContentData }) {
  const content = data.content as ZodiacPageData
  return content.kind === 'hub' ? (
    <ZodiacHubPage page={content} />
  ) : (
    <ZodiacChildPage page={content} />
  )
}
