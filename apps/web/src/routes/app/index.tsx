import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withWorkspace } from '../../server/middleware.ts'

// /app 只做重定向（specs/workspace-tenancy「统一的空间 URL」）：
// 活跃空间（仍是成员时）→ 个人空间（缺失时补建）；未登录由 withSession 重定向到 /login。
// `?returnTo=` 是公开页面的购买入口：进入当前空间的计费页，支付后回到该页（决策 4）。
const getDefaultWorkspaceSlug = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .handler(({ context }) => context.workspace.slug)

export const Route = createFileRoute('/app/')({
  validateSearch: z.object({ returnTo: z.string().max(1024).optional() }),
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
  loader: async ({ deps }) => {
    const slug = await getDefaultWorkspaceSlug({ data: {} })
    if (deps.returnTo)
      throw redirect({
        to: '/app/$slug/billing',
        params: { slug },
        search: { returnTo: deps.returnTo },
      })
    throw redirect({ to: '/app/$slug', params: { slug } })
  },
})
