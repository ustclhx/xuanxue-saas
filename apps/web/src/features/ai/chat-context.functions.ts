import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { z } from 'zod'
import { getLocale } from '../../paraglide/runtime.js'
import { withBilling } from '../../server/feature-gates.ts'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { resolveDefaultWorkspace } from '../../server/workspace-context.ts'
import { readRequestSession } from '../i18n/session.server.ts'
import { readingDefinition } from '../readings/catalog.ts'
import { safeReturnPath } from '../site/return-path.ts'

/** 结果页「用这个结果问 AI」的结果：未登录时由页面跳转登录，成功时跳到对话页 */
export type ChatContextLink =
  | { readonly status: 'login' }
  | { readonly status: 'ok'; readonly href: string }
  | { readonly status: 'unavailable' }

/**
 * 结果页提交原始输入：服务端按详批注册表复算（与付费详批同一份校验与摘要，不含出生信息），
 * 经模板临时上下文令牌（`chart-result`，30 分钟，绑定当前用户与个人空间）进入
 * `/app/<slug>/chat/context?token=`（adopt-subject-chat-readings design 决策 2）。返回的地址只带令牌。
 */
export const createChatContextLink = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      kind: z.string().min(1).max(64),
      locale: z.string().min(2).max(35),
      input: z.unknown(),
      returnTo: z.string().max(1024),
    }),
  )
  .handler(async ({ data }): Promise<ChatContextLink> => {
    if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled)
      return { status: 'unavailable' }
    // 结果语言（塔罗牌名）跟随页面；该语言没有对应详批时取默认语言，复算口径相同
    const definition = readingDefinition(data.kind, data.locale) ?? readingDefinition(data.kind)
    const returnTo = safeReturnPath(data.returnTo, templateConfig.i18n.locales)
    if (!definition || !returnTo || returnTo.includes('?'))
      throw new AppError('INVALID_REQUEST', 'Invalid chat context request')
    const runtime = getWebRuntime()
    let user: { id: string }
    try {
      ;({ user } = await readRequestSession({
        auth: runtime.auth,
        db: runtime.db,
        headers: getRequest().headers,
      }))
    } catch (error) {
      if (error instanceof AppError && (error.status === 401 || error.status === 403))
        return { status: 'login' }
      throw error
    }
    const recomputed = definition.recompute(data.input, new Date())
    const resolved = await resolveDefaultWorkspace(runtime.db, user, null, runtime.site)
    if (!resolved) return { status: 'unavailable' }
    const { issueChartResultContext, chartResultChatHref } = await import(
      '../readings/chart-result-context.ts'
    )
    const { token } = await issueChartResultContext(
      { secret: runtime.config.BETTER_AUTH_SECRET, cache: runtime.cache },
      {
        userId: user.id,
        workspaceId: resolved.workspace.id,
        kind: definition.kind,
        // 复算结果只含 JSON 值；经一次序列化固定为可存储的形态
        result: JSON.parse(JSON.stringify(recomputed.result)),
        locale: data.locale,
        returnTo,
      },
    )
    log.info('ai.chat_context.issued', { kind: definition.kind })
    return { status: 'ok', href: chartResultChatHref(resolved.workspace.slug, token) }
  })

/**
 * 旧链接 `chat?context=<token>` 的换发（design 决策 7）：有效时返回新令牌（由路由重定向到临时上下文页），
 * 过期或无效时返回对应状态。**本 change 发布后的下一次发布删除**（tasks.md 8.1）。
 */
export const upgradeLegacyChatContextLink = createServerFn({ method: 'GET' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(
    z.strictObject({ slug: z.string().min(1).max(64), token: z.string().min(1).max(1024) }),
  )
  .handler(async ({ context, data }) => {
    const runtime = getWebRuntime()
    const { upgradeLegacyChatContext } = await import('./legacy-chat-context.ts')
    const upgraded = await upgradeLegacyChatContext(
      { secret: runtime.config.BETTER_AUTH_SECRET, cache: runtime.cache },
      {
        userId: context.user.id,
        workspaceId: context.workspace.id,
        token: data.token,
        locale: getLocale(),
      },
    )
    log.info('ai.chat_context.upgraded', { status: upgraded.status })
    return upgraded
  })
