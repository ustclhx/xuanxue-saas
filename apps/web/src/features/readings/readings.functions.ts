import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { messageText } from '@xuanxue/ai'
import { createPaymentRuntime } from '@xuanxue/billing'
import { getCreditBalance } from '@xuanxue/credits'
import {
  aiMessage,
  dbSettingStore,
  READING_KINDS,
  type Reading,
  reading,
  scoped,
} from '@xuanxue/db'
import { AppError } from '@xuanxue/shared'
import { log } from '@xuanxue/shared/log'
import { and, desc, eq, lt, ne, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { resolveDefaultWorkspace } from '../../server/workspace-context.ts'
import { customerCatalog } from '../billing/customer-data.ts'
import { readRequestSession } from '../i18n/session.server.ts'
import { safeReturnPath } from '../site/return-path.ts'
import { readingDefinition } from './catalog.ts'
import { readingAvailable, readingConfig } from './config.ts'
import { deleteReadingWithContent } from './delete.ts'
import { finalizeReading } from './generate.ts'
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
  /** 美元最小单位（美分） */
  readonly amount: number
}

export interface ReadingOffer {
  readonly available: boolean
  readonly credits: number
  /** 报告章节目录（本语言） */
  readonly sections: readonly string[]
  readonly packs: readonly ReadingPack[]
  /** 未登录为 null；详批保存在个人空间，余额也取个人空间 */
  readonly viewer: { readonly slug: string; readonly balance: number } | null
}

const UNAVAILABLE: ReadingOffer = {
  available: false,
  credits: 0,
  sections: [],
  packs: [],
  viewer: null,
}

async function viewerOf(): Promise<ReadingOffer['viewer']> {
  const { db, auth } = getWebRuntime()
  let user: { id: string }
  try {
    ;({ user } = await readRequestSession({ auth, db, headers: getRequest().headers }))
  } catch (error) {
    if (error instanceof AppError && (error.status === 401 || error.status === 403)) return null
    throw error
  }
  const resolved = await resolveDefaultWorkspace(db, user, null)
  if (!resolved) return null
  const balance = await getCreditBalance(db, resolved.workspace.id)
  return { slug: resolved.workspace.slug, balance: balance.available }
}

/** 积分包：可购买的美元一次性价格，按积分从少到多 */
async function readingPacks(): Promise<ReadingPack[]> {
  const runtime = getWebRuntime()
  const payments = createPaymentRuntime(runtime.config, templateConfig.billing.providers, {
    cache: runtime.cache,
    db: runtime.db,
  })
  const catalog = await customerCatalog(runtime.db, payments.readiness)
  return catalog.plans
    .filter((plan) => plan.type === 'credit_pack' && plan.credits > 0)
    .flatMap((plan) => {
      const price = catalog.prices.find(
        (item) => item.planId === plan.id && item.available && item.interval === null,
      )
      return price
        ? [
            {
              planPriceId: price.id,
              provider: price.provider,
              credits: plan.credits,
              amount: price.amount,
            },
          ]
        : []
    })
    .sort((a, b) => a.credits - b.credits)
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
      const runtime = getWebRuntime()
      const config = await readingConfig(
        { store: dbSettingStore(runtime.db), cache: runtime.cache },
        definition.kind,
      )
      if (!readingAvailable(config)) return UNAVAILABLE
      const [packs, viewer] = await Promise.all([readingPacks(), viewerOf()])
      // 支付未开通（没有可购买的积分包）且余额不够时不显示解锁入口，避免走到无法付款的一步
      if (packs.length === 0 && (viewer?.balance ?? 0) < config.credits) return UNAVAILABLE
      return {
        available: true,
        credits: config.credits,
        sections: definition.prompt.sections,
        packs,
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

/** 定价页：本语言可解锁的详批与积分；读取失败时返回空列表，定价页照常显示积分包 */
export const getReadingPricing = createServerFn({ method: 'GET' })
  .validator(z.object({ locale: z.string().min(2).max(35) }))
  .handler(async ({ data }): Promise<ReadingPricing> => {
    if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled) return { readings: [] }
    try {
      const runtime = getWebRuntime()
      const deps = { store: dbSettingStore(runtime.db), cache: runtime.cache }
      const readings = []
      for (const kind of READING_KINDS) {
        if (!readingDefinition(kind, data.locale)) continue
        const config = await readingConfig(deps, kind)
        if (readingAvailable(config)) readings.push({ kind, credits: config.credits })
      }
      return { readings }
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
      const definition = readingDefinition(row.kind, row.locale)
      const synced = definition
        ? await finalizeReading(context.db, {
            workspaceId: context.workspace.id,
            readingId: row.id,
            definition,
          })
        : null
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
