// 令牌页的列表读取（项目扩展，从 api-tokens.functions.ts 拆出）：路由 loader 位于每个页面的入口包，
// 单独成模块，创建与吊销的 Server Function 及其输入 schema 只随令牌页分包加载（首页包预算）。
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@web/features/admin/admin.functions.ts'
import { getWebRuntime } from '@web/server/runtime.ts'
import { templateConfig } from '@web/server/template-config.ts'
import { adminMcpConfigSchema } from '../config.ts'
import { tokenTerms } from './api-tokens.ts'
import { listAdminApiTokens } from './tokens.ts'

function maxTokenDays() {
  return adminMcpConfigSchema.parse(templateConfig.plugins['admin-mcp'] ?? {}).maxTokenDays
}

export const getAdminApiTokens = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async ({ context }) => {
    const tokens = await listAdminApiTokens(context.db, context.admin.id)
    return {
      tokens,
      endpoint: new URL('/api/admin/mcp', getWebRuntime().config.APP_URL).toString(),
      terms: tokenTerms(maxTokenDays()),
      // 相对时间以服务端时间为准，SSR 与水合输出一致
      now: new Date(),
    }
  })
