import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withWorkspace } from '../../server/middleware.ts'

// /app 只做重定向（specs/workspace-tenancy「统一的空间 URL」）：
// 活跃空间（仍是成员时）→ 个人空间（缺失时补建）；未登录由 withSession 重定向到 /login。
// `?returnTo=` 是公开页面的购买入口：进入当前空间的计费页，支付后回到该页（决策 4）。
// `?buy=` 是定价页的积分包 key：进入计费页后直接跳转支付页；未登录时登录后回到这里继续。
const getDefaultWorkspaceSlug = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .handler(({ context }) => context.workspace.slug)

export const Route = createFileRoute('/app/')({
  validateSearch: z.object({
    returnTo: z.string().max(1024).optional(),
    buy: z
      .string()
      .regex(/^[a-z0-9_-]{1,64}$/)
      .optional(),
  }),
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo, buy: search.buy }),
  loader: async ({ deps }) => {
    const slug = await getDefaultWorkspaceSlug({ data: {} }).catch((error: unknown) => {
      // 会话中间件跳转登录时不带回跳地址；购买入口需要登录后继续结账
      if (deps.buy && isRedirect(error)) {
        const search = new URLSearchParams({ buy: deps.buy })
        if (deps.returnTo) search.set('returnTo', deps.returnTo)
        throw redirect({ to: '/login', search: { redirect: `/app?${search}` } })
      }
      throw error
    })
    if (deps.returnTo || deps.buy)
      throw redirect({
        to: '/app/$slug/billing',
        params: { slug },
        search: {
          ...(deps.returnTo ? { returnTo: deps.returnTo } : {}),
          ...(deps.buy ? { buy: deps.buy } : {}),
        },
      })
    throw redirect({ to: '/app/$slug', params: { slug } })
  },
})
