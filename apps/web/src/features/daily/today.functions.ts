import { createServerFn } from '@tanstack/react-start'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { z } from 'zod'
import { getLocale } from '../../paraglide/runtime.js'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import {
  type DailyLocale,
  daysBetween,
  isDailyLocale,
  parseDateKey,
  referenceDate,
} from './date.ts'

/**
 * 今日面板的 Server Functions（design D10）：只在个人空间可用，团队空间返回 null（不显示面板）。
 * 日志只记录状态，不记录档案内容。
 */

const profileParam = z.string().max(64).optional()

/** 面板语言：东方站的应用区不会是 en；异常时回到站点默认语言 */
export function panelLocale(site: 'east' | 'west', locale: string): DailyLocale {
  if (site === 'west') return 'en'
  return isDailyLocale(locale) && locale !== 'en' ? locale : 'zh-Hant'
}

export const getTodayPanel = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .inputValidator(z.object({ slug: z.string().min(1).max(64), profile: profileParam }))
  .handler(async ({ context, data }) => {
    if (!context.workspace.isPersonal) return null
    const { site } = getWebRuntime()
    const locale = panelLocale(site, getLocale())
    const { loadTodayPanel } = await import('./today.server.ts')
    return loadTodayPanel(
      { db: context.db, workspaceId: context.workspace.id, userId: context.user.id },
      { site, locale, date: referenceDate(locale), profileId: data.profile },
    )
  })

/**
 * 「把今天带去问 AI」：服务端按档案复算当日事实（不信任客户端提交的结果），签发只含 DailyFacts 的
 * 临时上下文令牌，返回 `/app/<slug>/chat/context?token=`。日期取访客本地日期，只接受参考日期 ±1 天。
 */
export const createDailyChatLink = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .inputValidator(
    z.object({
      slug: z.string().min(1).max(64),
      profile: profileParam,
      date: z.string().max(10),
    }),
  )
  .handler(async ({ context, data }): Promise<{ href: string } | { status: 'unavailable' }> => {
    if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled)
      return { status: 'unavailable' }
    if (!context.workspace.isPersonal) return { status: 'unavailable' }
    const runtime = getWebRuntime()
    const locale = panelLocale(runtime.site, getLocale())
    const reference = referenceDate(locale)
    const requested = parseDateKey(data.date)
    const date =
      requested && Math.abs(daysBetween(reference, requested)) <= 1 ? requested : reference
    const { loadTodayPanel } = await import('./today.server.ts')
    const panel = await loadTodayPanel(
      { db: context.db, workspaceId: context.workspace.id, userId: context.user.id },
      { site: runtime.site, locale, date, profileId: data.profile },
    )
    if (panel.state !== 'ok') throw new AppError('INVALID_REQUEST', 'No profile for today')
    const { issueDailyContext } = await import('./daily-context.ts')
    const href = await issueDailyContext(
      { secret: runtime.config.BETTER_AUTH_SECRET, cache: runtime.cache },
      {
        userId: context.user.id,
        workspaceId: context.workspace.id,
        slug: context.workspace.slug,
        locale,
        panel,
      },
    )
    log.info('daily.chat_context.issued', { site: runtime.site })
    return { href }
  })
