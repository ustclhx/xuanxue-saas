import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { AppError } from '@xuanxue/shared'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { userWorkspaces } from '../../server/workspace-data.ts'
import { readRequestSession } from '../i18n/session.server.ts'

/**
 * 页头账户菜单使用的当前访客信息（specs/workspace-tenancy「空间入口」）。
 * 未登录返回 `signedIn: false`；个人空间排在最前；多租户关闭时只保留个人空间。
 * 只读取会话与成员关系，不改变会话中的活跃空间。
 */
export const getViewerSpaces = createServerFn({ method: 'GET' }).handler(async () => {
  const runtime = getWebRuntime()
  try {
    const { user } = await readRequestSession({
      auth: runtime.auth,
      db: runtime.db,
      headers: getRequest().headers,
    })
    const spaces = (await userWorkspaces(runtime.db, user.id))
      .filter((space) => templateConfig.tenancy.multiTenant || space.isPersonal)
      .sort((a, b) => Number(b.isPersonal) - Number(a.isPersonal))
    return { signedIn: true as const, name: user.name, spaces }
  } catch (error) {
    if (error instanceof AppError && [401, 403].includes(error.status))
      return { signedIn: false as const, name: '', spaces: [] }
    throw error
  }
})
