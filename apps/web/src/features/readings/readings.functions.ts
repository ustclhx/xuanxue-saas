import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { messageText } from '@xuanxue/ai'
import { createPaymentRuntime } from '@xuanxue/billing'
import { getCreditBalance } from '@xuanxue/credits'
import { aiMessage, dbSettingStore, type Reading, reading, scoped, subscription } from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { and, desc, eq, inArray, lt, ne, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { resolveDefaultWorkspace } from '../../server/workspace-context.ts'
import { isPlatformAdmin } from '../admin/guard.ts'
import { customerCatalog } from '../billing/customer-data.ts'
import { readRequestSession } from '../i18n/session.server.ts'
import { displayPrices } from '../marketing/pricing-data.ts'
import { siteReadingPricing } from '../marketing/reading-pricing.server.ts'
import { safeReturnPath } from '../site/return-path.ts'
import { resolveSite } from '../site/site.ts'
import {
  loadReadingAvailability,
  type ReadingAvailabilityDeps,
  textChatAvailable,
} from './availability.ts'
import { readingDefinition, resolveReadingDefinition } from './catalog.ts'
import { deleteReadingWithContent } from './delete.ts'
import { finalizeRecordedReading } from './generate.ts'
import { SAMPLES_APPROVED } from './samples.ts'
import { signUnlockToken, unlockPayloadSchema, verifyUnlockToken } from './unlock.ts'

/**
 * 前台详批的 Server Functions：结果页解锁卡的报价与意图令牌（tasks.md 3.1），
 * 应用区报告列表、阅读与删除（tasks.md 3.2）。报告只在成员所在空间内按 id 查询，
 * 非成员与不存在的报告同样返回 404。
 */

const kindInput = z.object({ kind: z.string().min(1).max(64) })

export interface ReadingPack {
  readonly planPriceId: string
  readonly provider: string
  readonly credits: number
  /** 结算币种的最小单位 */
  readonly amount: number
  readonly currency: string
}

/** 积分不足时一并提供的月付订阅档位（enable-subscriptions-daily-credits 4.3） */
export interface ReadingPlan extends ReadingPack {
  readonly key: string
  readonly name: string
}

export interface ReadingOffer {
  readonly available: boolean
  /**
   * 本语言有这种详批但尚未对访客开放（开关关闭、未选模型、模型停用或 Provider 未配置，
   * 见 availability.ts）：结果页明确说明尚未开放。读取失败时为 false
   */
  readonly comingSoon: boolean
  /** 「用这个结果问 AI」可用（至少一个文本模型的 Provider 已配置） */
  readonly chatAvailable: boolean
  readonly credits: number
  /** 报告章节目录（本语言） */
  readonly sections: readonly string[]
  /** 本语言的样例段落（虚构命盘，人工撰写）；不可用时为空字符串 */
  readonly sample: string
  readonly packs: readonly ReadingPack[]
  /** 可购买的月付订阅（只在有订阅价格的平台上，即 Stripe）；个人空间已有续费中的订阅时为空 */
  readonly plans: readonly ReadingPlan[]
  /** 未登录为 null；详批保存在个人空间，余额也取个人空间 */
  readonly viewer: {
    readonly slug: string
    readonly balance: number
    /** 个人空间已有续费中的订阅：换档走账单页，解锁卡不再提供订阅 */
    readonly subscribed: boolean
  } | null
}

const UNAVAILABLE: ReadingOffer = {
  available: false,
  comingSoon: false,
  chatAvailable: false,
  credits: 0,
  sections: [],
  sample: '',
  packs: [],
  plans: [],
  viewer: null,
}

/**
 * 公开页面判定详批可用性的依赖：设置经 KV 缓存，`ai_model` 走允许短暂陈旧的连接
 * （docs/01 §5「模型列表」），无访客时不额外唤醒数据库。
 */
function publicAvailabilityDeps(): ReadingAvailabilityDeps {
  const runtime = getWebRuntime()
  return {
    settings: { store: dbSettingStore(runtime.db), cache: runtime.cache },
    db: runtime.publicDb,
    aiEnv: runtime.ai?.available ? runtime.ai.value.config : null,
  }
}

/** 平台管理员可在 `enabled` 关闭时实测详批；未登录或读取失败一律视为非管理员。 */
async function viewerIsPlatformAdmin(): Promise<boolean> {
  const { db, auth } = getWebRuntime()
  try {
    const { user } = await readRequestSession({ auth, db, headers: getRequest().headers })
    return isPlatformAdmin(user.role)
  } catch {
    return false
  }
}

async function viewerOf(): Promise<ReadingOffer['viewer']> {
  const { db, auth, site } = getWebRuntime()
  let user: { id: string }
  try {
    ;({ user } = await readRequestSession({ auth, db, headers: getRequest().headers }))
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 403)) return null
    throw error
  }
  const resolved = await resolveDefaultWorkspace(db, user, null, site)
  if (!resolved) return null
  const [balance, renewing] = await Promise.all([
    getCreditBalance(db, resolved.workspace.id),
    scoped(db, resolved.workspace.id).select(subscription, {
      fields: { id: subscription.id },
      where: sql`${inArray(subscription.status, ['trialing', 'active', 'past_due', 'paused'])}
        and ${subscription.cancelAtPeriodEnd} = false`,
    }),
  ])
  return {
    slug: resolved.workspace.slug,
    balance: balance.available,
    subscribed: renewing.length > 0,
  }
}

/**
 * 积分包与月付订阅：每个可用付款方式下按界面语言选出的可购买价格（与结账同一选价规则，见 pricing-data.ts），
 * 按积分从少到多。订阅只有有订阅价格的平台才会出现（PayPal 没有订阅价格行，design D3）。
 */
async function readingPurchases(
  locale: string,
): Promise<{ packs: ReadingPack[]; plans: ReadingPlan[] }> {
  const runtime = getWebRuntime()
  const payments = createPaymentRuntime(runtime.config, templateConfig.billing.providers, {
    cache: runtime.cache,
    db: runtime.db,
  })
  const catalog = await customerCatalog(runtime.db, payments.readiness)
  // 每个可用付款方式各一项，按积分数、再按 template.config 的付款方式顺序排列，解锁卡据此提供切换
  const order: readonly string[] = templateConfig.billing.providers
  const offers = (type: 'credit_pack' | 'subscription') => {
    const interval = type === 'subscription' ? 'month' : null
    const available = catalog.prices.filter((item) => item.available && item.interval === interval)
    return catalog.plans
      .filter((plan) => plan.type === type && plan.credits > 0)
      .flatMap((plan) =>
        order.flatMap((provider) =>
          displayPrices(
            available.filter((item) => item.planId === plan.id),
            locale,
            provider,
          ).map((price) => ({
            key: plan.key,
            name: plan.name,
            planPriceId: price.id,
            provider: price.provider,
            credits: plan.credits,
            amount: price.amount,
            currency: price.currency,
          })),
        ),
      )
      .sort(
        (a, b) => a.credits - b.credits || order.indexOf(a.provider) - order.indexOf(b.provider),
      )
  }
  return {
    packs: offers('credit_pack').map(({ key: _key, name: _name, ...pack }) => pack),
    plans: offers('subscription'),
  }
}

/**
 * 解锁卡的报价：开关、积分、章节、积分包与当前访客的余额。公开页面调用，
 * 任何读取失败都降级为不显示解锁入口，不影响免费结果。
 */
export const getReadingOffer = createServerFn({ method: 'GET' })
  .validator(kindInput.extend({ locale: z.string().min(2).max(35) }))
  .handler(async ({ data }): Promise<ReadingOffer> => {
    if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled) return UNAVAILABLE
    const definition = readingDefinition(data.kind, data.locale)
    if (!definition) return UNAVAILABLE
    try {
      const deps = publicAvailabilityDeps()
      const adminPreview = await viewerIsPlatformAdmin()
      const [status, chatAvailable] = await Promise.all([
        loadReadingAvailability(deps, definition.kind, { adminPreview }),
        textChatAvailable(deps.db, deps.aiEnv),
      ])
      if (!status.available) return { ...UNAVAILABLE, comingSoon: true, chatAvailable }
      const [{ packs, plans }, viewer] = await Promise.all([
        readingPurchases(data.locale),
        viewerOf(),
      ])
      return {
        available: true,
        comingSoon: false,
        chatAvailable,
        credits: status.config.credits,
        // 章节目录随运行时设置选定的提示词版本变化
        sections: (
          resolveReadingDefinition(definition.kind, data.locale, status.config.promptVersion) ??
          definition
        ).prompt.sections,
        // 样例段落经使用者审定（D11）前不渲染
        sample: SAMPLES_APPROVED ? definition.sample : '',
        packs,
        // 已有续费中的订阅时换档走账单页（模板换档与币种约束），解锁卡只提供积分包
        plans: viewer?.subscribed ? [] : plans,
        viewer,
      }
    } catch (error) {
      log.warn('readings.offer_failed', { kind: data.kind, error })
      return UNAVAILABLE
    }
  })

export interface ReadingPricing {
  /** 本语言可解锁的详批类型与所需积分（只含已开启的类型） */
  readonly readings: readonly { readonly kind: string; readonly credits: number }[]
}

/** 定价页：本站、本语言可解锁的详批与积分；读取失败时返回空列表，定价页照常显示积分包 */
export const getReadingPricing = createServerFn({ method: 'GET' })
  .validator(z.object({ locale: z.string().min(2).max(35) }))
  .handler(async ({ data }): Promise<ReadingPricing> => {
    if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled) return { readings: [] }
    try {
      const site = resolveSite(new URL(getRequest().url).host, templateConfig).id
      return { readings: await siteReadingPricing(site, data.locale, publicAvailabilityDeps()) }
    } catch (error) {
      log.warn('readings.pricing_failed', { error })
      return { readings: [] }
    }
  })

/** 签发意图令牌；`returnTo` 只接受本站结果页路径 */
export const createReadingUnlock = createServerFn({ method: 'POST' })
  .validator(unlockPayloadSchema.pick({ kind: true, share: true, returnTo: true }))
  .handler(async ({ data }) => {
    const returnTo = safeReturnPath(data.returnTo, templateConfig.i18n.locales)
    if (!readingDefinition(data.kind) || !returnTo || returnTo.includes('?'))
      throw new AppError('INVALID_REQUEST', 'Invalid unlock request')
    const secret = getWebRuntime().config.BETTER_AUTH_SECRET
    return { token: await signUnlockToken(secret, { ...data, returnTo }) }
  })

/** 回到结果页时验签；无效或过期返回 null，页面不自动生成 */
export const openReadingUnlock = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().min(1).max(1024) }))
  .handler(async ({ data }) => {
    const payload = await verifyUnlockToken(getWebRuntime().config.BETTER_AUTH_SECRET, data.token)
    return payload && readingDefinition(payload.kind) ? payload : null
  })

export interface ReadingListItem {
  readonly id: string
  readonly kind: Reading['kind']
  readonly status: Reading['status']
  readonly locale: string
  readonly createdAt: string
}

const PAGE_SIZE = 20

export const listReadings = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .validator(z.object({ slug: z.string().min(1).max(64), cursor: z.uuid().optional() }))
  .handler(async ({ context, data }) => {
    const rows = await scoped(context.db, context.workspace.id)
      .select(reading, {
        fields: {
          id: reading.id,
          kind: reading.kind,
          status: reading.status,
          locale: reading.locale,
          createdAt: reading.createdAt,
        },
        // 失败的生成没有正文，不进列表
        where: and(
          ne(reading.status, 'failed'),
          data.cursor ? lt(reading.id, data.cursor) : undefined,
        ) as SQL,
      })
      .orderBy(desc(reading.id))
      .limit(PAGE_SIZE + 1)
    const items: ReadingListItem[] = rows
      .slice(0, PAGE_SIZE)
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
    return {
      items,
      nextCursor: rows.length > PAGE_SIZE ? (items.at(-1)?.id ?? null) : null,
    }
  })

export interface ReadingView {
  readonly id: string
  readonly kind: Reading['kind']
  readonly status: Reading['status']
  readonly locale: string
  readonly createdAt: string
  /** ready 为保存的正文；generating 为目前已生成的部分 */
  readonly content: string
}

const readingInput = z.object({ slug: z.string().min(1).max(64), id: z.uuid() })

/**
 * 读取一份报告。生成中的报告返回承载消息已写入的部分正文；消息已结束而报告仍是 generating
 * （生成请求的后台同步未完成）时在这里补做同步，报告不会卡在生成中。
 */
export const getReading = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .validator(readingInput)
  .handler(async ({ context, data }): Promise<ReadingView> => {
    const s = scoped(context.db, context.workspace.id)
    const [found] = await s.select(reading, { where: eq(reading.id, data.id) as SQL }).limit(1)
    if (!found) throw notFound()
    let row: Reading = found
    let content = row.content
    if (row.status === 'generating') {
      // 按报告记录的提示词版本收尾，生成中切换版本不影响章节检查
      const synced = await finalizeRecordedReading(context.db, context.workspace.id, row)
      if (synced) {
        row = synced
        content = synced.content
      } else if (row.messageId) {
        const [message] = await s
          .select(aiMessage, {
            where: eq(aiMessage.id, row.messageId) as SQL,
            fields: { parts: aiMessage.parts },
          })
          .limit(1)
        content = message ? messageText(message.parts) : ''
      }
    }
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      locale: row.locale,
      createdAt: row.createdAt.toISOString(),
      content,
    }
  })

/** 删除自己空间的报告；生成中的报告不能删除（结算仍在进行） */
export const deleteReading = createServerFn({ method: 'POST' })
  .middleware([withWorkspace])
  .validator(readingInput)
  .handler(async ({ context, data }) => {
    if (context.workspaceReadOnly)
      throw new AppError('WORKSPACE_READ_ONLY', 'Workspace is read-only', { status: 403 })
    const deleted = await deleteReadingWithContent(context.db, context.workspace.id, data.id)
    if (!deleted) throw new AppError('NOT_FOUND', 'Not found', { status: 404 })
    return { ok: true as const }
  })
