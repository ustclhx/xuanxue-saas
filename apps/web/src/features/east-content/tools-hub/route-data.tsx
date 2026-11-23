import { toolsHubHead } from '../../tools/hub/head.ts'
import { ToolsHubPage } from '../../tools/hub/page.tsx'
import type { EastContentData, EastContentPayload } from '../route-data.ts'
import type { EastContentRoute } from '../routes.ts'

/**
 * 东方站「全部工具」枢纽页（content-growth-v2-tools 第 6 组）：zh-Hant、zh-Hans、ko、ja 与根路径英文 `/tools`。
 * 页面内容全部来自工具注册表，loader 只生成 head；本模块随枢纽页按需加载。
 */
export async function load(route: EastContentRoute): Promise<EastContentPayload | null> {
  const head = toolsHubHead('east', route.locale)
  return head && { head, content: null }
}

export function Page({ data }: { data: EastContentData }) {
  return <ToolsHubPage site="east" locale={data.route.locale} />
}
