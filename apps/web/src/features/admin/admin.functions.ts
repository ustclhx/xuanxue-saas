import { notFound } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getWebRuntime } from '../../server/runtime.ts'
import { isAdminNotFound, requireAdmin } from './guard.ts'

/**
 * `/admin` 下所有 server function 都必须挂这个中间件（路由的 `beforeLoad` 只管页面，
 * server function 可以被直接调用）。不满足条件时抛出路由的 notFound，页面与直接调用都得到 404。
 * 写操作再经 action.server.ts 的 adminAction 包装（add-admin-console tasks.md 1.1）。
 */
export const adminMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const runtime = getWebRuntime()
  const { db, auth } = runtime
  const headers = getRequest().headers
  const admin = await requireAdmin({ auth, db, headers }).catch(rethrowNotFound)
  // IP 只使用入口完成信任校验后的请求元数据；site 为按 Host 解析的当前站点（split-site-accounts 决策 7），
  // 列表默认筛选与写操作的站点校验都以它为准，客户端不能指定。
  return next({
    context: { admin: admin.user, db, ip: runtime.requestMeta.clientIp, site: runtime.site },
  })
})

function rethrowNotFound(error: unknown): never {
  if (isAdminNotFound(error)) throw notFound()
  throw error
}

/** 后台布局使用的当前管理员信息 */
export const getAdminViewer = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(({ context }) => ({
    id: context.admin.id,
    name: context.admin.name,
    email: context.admin.email,
    site: context.site,
  }))
