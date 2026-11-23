import { toolsHubHead } from '../../tools/hub/head.ts'
import { ToolsHubPage } from '../../tools/hub/page.tsx'
import type { WestContentData, WestContentPayload } from '../route-data.ts'
import type { WestContentRoute } from '../routes.ts'

/**
 * 西方站「All tools」枢纽页（content-growth-v2-tools 第 6 组）：en `/tools`、es `/es/herramientas`。
 * 页面内容全部来自工具注册表，loader 只生成 head；本模块随枢纽页按需加载。
 */
export async function load(route: WestContentRoute): Promise<WestContentPayload | null> {
  const head = toolsHubHead('west', route.locale)
  return head && { head, content: null }
}

export function Page({ data }: { data: WestContentData }) {
  return <ToolsHubPage site="west" locale={data.route.locale} />
}
