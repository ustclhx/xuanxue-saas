import { getTodayPanel } from './today.functions.ts'
import type { TodayPanelData } from './today.ts'

/**
 * 模板文件 `routes/app/$slug/index.tsx` 的挂载点（design D10）：那里只引入这三个导出，
 * 面板主体与数据都在项目文件，降低 template-sync 的冲突面。
 */
export { TodayPanel } from './today-panel.tsx'

/** `?profile=<id>`：只接受短字符串，其余丢弃 */
export function todayPanelSearch(search: Record<string, unknown>): { profile?: string } {
  const profile = search.profile
  return typeof profile === 'string' && profile.length > 0 && profile.length <= 64
    ? { profile }
    : {}
}

/**
 * 读取失败时不显示面板，不影响空间首页其余部分。loader 也在浏览器中运行（且随路由树进入公共包），
 * 因此不引入服务端日志模块；服务端错误已由 server function 的请求日志记录。
 */
export async function todayPanelLoader(
  slug: string,
  profile: string | undefined,
): Promise<TodayPanelData | null> {
  try {
    return await getTodayPanel({ data: { slug, profile } })
  } catch {
    return null
  }
}
