import { messageText, textModelConfig } from '@xuanxue/ai'
import { requireFreshSession } from '@xuanxue/auth'
import { brandName, SITE_IDS } from '@xuanxue/config'
import {
  type AiModel,
  aiMessage,
  aiModel,
  type Database,
  type Reading,
  reading,
  type SettingsContext,
  scoped,
} from '@xuanxue/db'
import { EMAIL_QUEUE_MESSAGE_VERSION, type EmailQueueMessage } from '@xuanxue/email/queue'
import { getEntitlements } from '@xuanxue/entitlements'
import { type Capability, type QueueProducer, requireCapability } from '@xuanxue/platform'
import { AppError, toErrorResponse } from '@xuanxue/shared'
import { getLogContext, log, setLogContext } from '@xuanxue/shared/log'
import { and, desc, eq, gt, inArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { templateConfig } from '../../server/template-config.ts'
import { resolveDefaultWorkspace } from '../../server/workspace-context.ts'
import { chatAppError, startWorkspaceChat, type WorkspaceChatDeps } from '../ai/chat.ts'
import { siteOfLocale, siteOrigin } from '../site/site.ts'
import {
  ensureHealthNotice,
  missingSections,
  type ReadingDefinition,
  readingDefinition,
  readingInputHash,
  readingMessages,
  withDisclaimer,
} from './catalog.ts'
import { checkCompliance } from './compliance.ts'
import { readingAvailable, readingConfig } from './config.ts'
import { toTraditional } from './hant.ts'

/**
 * `POST /api/readings`（add-reading-monetization design 决策 2，specs/paid-readings「计费」）：
 * 会话 → 校验与服务端复算 → 10 分钟幂等 → 复用文本对话管线（定价快照为按次固定积分）。
 * 预扣、流式生成、检查点、完成结算 / 无可见输出释放、超时兜底都由 `startWorkspaceChat` 与
 * apps/jobs 的 `ai_message` 兜底处理器完成，这里不直接写积分。
 * 生成结束后做章节与合规检查，保存报告并投递报告邮件。
 */

/** 同一用户、类型与输入在该时间内视为同一请求 */
export const READING_IDEMPOTENCY_MS = 10 * 60_000
/** 单份报告的输出上限；模型自身上限更低时取模型上限。6000 时韩语사주详批曾截断缺章（5.1 抽检） */
export const READING_MAX_OUTPUT_TOKENS = 12000

export interface ReadingDeps
  extends Omit<WorkspaceChatDeps, 'faultAccess' | 'entitlements' | 'textConfig'> {
  readonly auth: Parameters<typeof requireFreshSession>[0]['auth']
  /** 运行时设置（生产经 KV 缓存） */
  readonly settings: SettingsContext
  readonly emailQueue: Capability<Pick<QueueProducer<EmailQueueMessage>, 'send'>>
  readonly now?: () => Date
}

const requestSchema = z.object({
  kind: z.string().min(1).max(64),
  /** 原始输入；未声明的字段（如客户端计算的命盘）在复算时丢弃 */
  input: z.unknown(),
  locale: z.string().min(2).max(35),
  site: z.enum(SITE_IDS),
})

/** 已有报告时的响应体；新报告返回 UI message 流，报告 id 在 `x-reading-id` 响应头 */
export interface ExistingReadingResponse {
  readonly reading: { readonly id: string; readonly status: Reading['status'] }
}

export async function handleReadingRequest(request: Request, deps: ReadingDeps): Promise<Response> {
  try {
    return await startReading(request, deps)
  } catch (error) {
    if (!(error instanceof AppError)) log.error('readings.start_failed', { error })
    const { status, body } = toErrorResponse(chatAppError(error))
    return Response.json(body, { status })
  }
}

const notFound = () => new AppError('NOT_FOUND', 'Not found', { status: 404 })

async function startReading(request: Request, deps: ReadingDeps): Promise<Response> {
  const { db } = deps
  const { user } = await requireFreshSession({ auth: deps.auth, db, headers: request.headers })
  const parsed = requestSchema.safeParse(await request.json().catch(() => undefined))
  if (!parsed.success) throw new AppError('INVALID_REQUEST', 'Invalid reading request')
  const body = parsed.data
  if (!readingDefinition(body.kind)) throw notFound()
  const definition = readingDefinition(body.kind, body.locale)
  if (!definition || siteOfLocale(body.locale, templateConfig) !== body.site)
    throw new AppError('INVALID_REQUEST', 'Unsupported reading locale')
  const config = await readingConfig(deps.settings, definition.kind)
  if (!readingAvailable(config)) throw notFound()

  const now = deps.now?.() ?? new Date()
  const recomputed = definition.recompute(body.input, now)
  const inputHash = await readingInputHash(recomputed.input)
  // 详批保存在个人空间（specs/paid-readings「报告保存与查看」）
  const resolved = await resolveDefaultWorkspace(db, user, null)
  if (!resolved) throw notFound()
  const { workspace } = resolved
  setLogContext({ workspaceId: workspace.id, userId: user.id })
  const [model] = await db
    .select()
    .from(aiModel)
    .where(
      and(eq(aiModel.key, config.modelKey), eq(aiModel.kind, 'text'), eq(aiModel.enabled, true)),
    )
    .limit(1)
  if (!model)
    throw new AppError('READING_UNAVAILABLE', 'Reading model is not available', { status: 503 })

  // 幂等：同一键加事务锁，生成中或已完成的报告直接返回；失败的报告允许重新生成
  const claim = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`reading:${user.id}:${definition.kind}:${inputHash}`}, 0))`,
    )
    const t = scoped(tx, workspace.id)
    const [existing] = await t
      .select(reading, {
        where: and(
          eq(reading.userId, user.id),
          eq(reading.kind, definition.kind),
          eq(reading.inputHash, inputHash),
          inArray(reading.status, ['generating', 'ready']),
          gt(reading.createdAt, new Date(now.getTime() - READING_IDEMPOTENCY_MS)),
        ) as SQL,
      })
      .orderBy(desc(reading.createdAt))
      .limit(1)
    if (existing) return { existing }
    const [created] = await t
      .insert(reading, {
        userId: user.id,
        kind: definition.kind,
        inputHash,
        input: recomputed.input,
        locale: body.locale,
        engineVersion: recomputed.engineVersion,
        promptVersion: definition.prompt.version,
        modelKey: model.key,
        credits: config.credits,
      })
      .returning()
    if (!created) throw new Error('Reading insert returned no row')
    return { created }
  })
  if (claim.existing) {
    const response: ExistingReadingResponse = {
      reading: { id: claim.existing.id, status: claim.existing.status },
    }
    return Response.json(response)
  }
  const created = claim.created

  const messages = readingMessages(definition, recomputed)
  const userText = messages.find((message) => message.role === 'user')?.text ?? ''
  let started: Awaited<ReturnType<typeof startWorkspaceChat>>
  try {
    started = await startWorkspaceChat(
      {
        slug: workspace.slug,
        modelId: model.id,
        message: { role: 'user', parts: [{ type: 'text', text: userText }] },
      },
      {
        workspaceId: workspace.id,
        userId: user.id,
        prompt: messages,
        // 按次固定价格：只有完整报告才收取设置的积分。中断、出错或章节不全（如输出截断）都全额
        // 释放预扣，报告标记失败，访客可以重新生成（用户决定：优先保证完整体验）
        pricing: {
          mode: 'per_call',
          credits: config.credits,
          chargeOn: 'success',
          limits: { maxOutputTokens: maxOutputTokens(model) },
        },
        acceptOutput: (text) =>
          missingSections(toTraditional(text, body.locale), definition.prompt.sections).length ===
          0,
      },
      { ...deps, entitlements: readingEntitlements(model.key) },
    )
  } catch (error) {
    // 未开始预扣（余额不足、限流等）：撤销占位，购买积分后可以立即重试
    await scoped(db, workspace.id).deleteById(reading, created.id)
    throw error
  }
  const messageId = started.metadata.messageId
  await scoped(db, workspace.id).updateById(reading, created.id, { messageId })
  const origin = siteOrigin(body.site, new URL(request.url), templateConfig)
  deps.waitUntil(
    started.done
      .then(() =>
        finalizeReading(db, {
          workspaceId: workspace.id,
          readingId: created.id,
          definition,
          email: { to: user.email, url: `${origin}/app/${workspace.slug}/readings/${created.id}` },
          emailQueue: deps.emailQueue,
        }),
      )
      .catch((error: unknown) =>
        log.error('readings.finalize_failed', { readingId: created.id, error }),
      ),
  )
  return started.result.toUIMessageStreamResponse({
    metadata: started.metadata,
    headers: { 'x-reading-id': created.id },
  })
}

function maxOutputTokens(model: Pick<AiModel, 'paramsSchema'>): number {
  return Math.min(READING_MAX_OUTPUT_TOKENS, textModelConfig(model).maxOutputTokens)
}

/** 详批按次付费购买，不受订阅套餐的模型授权限制：在实际权益上加入后台选定的模型。 */
function readingEntitlements(modelKey: string) {
  return async (db: Database, workspaceId: string) => {
    const entitlements = await getEntitlements(db, workspaceId, {
      pastDueGraceDays: templateConfig.billing.pastDueGraceDays,
    })
    return {
      ...entitlements,
      features: { ...entitlements.features, models: [...entitlements.features.models, modelKey] },
    }
  }
}

/**
 * 按承载结算的消息同步报告：消息已结束时，有正文则补健康提示、做合规替换、加声明后保存为 ready，
 * 并投递报告邮件；无正文（积分已释放）标记 failed。消息仍在生成时不处理，由后续读取再同步。
 * 只更新 generating 的报告，重复调用不重复发信。
 */
export async function finalizeReading(
  db: Database,
  options: {
    workspaceId: string
    readingId: string
    definition: ReadingDefinition
    email?: { to: string; url: string }
    emailQueue?: ReadingDeps['emailQueue']
  },
): Promise<Reading | null> {
  const s = scoped(db, options.workspaceId)
  const row = await s.findById(reading, options.readingId)
  if (row.status !== 'generating' || !row.messageId) return null
  const [message] = await s
    .select(aiMessage, {
      where: eq(aiMessage.id, row.messageId),
      fields: { status: aiMessage.status, parts: aiMessage.parts },
    })
    .limit(1)
  if (!message || message.status === 'streaming') return null
  const text = messageText(message.parts).trim()
  let update: Pick<Reading, 'status' | 'content'>
  if (!text || message.status !== 'completed') {
    // 未完整完成的报告（含章节不全被拒收）积分已在结算时释放，不保存残缺正文
    if (text)
      log.warn('readings.sections_incomplete', {
        readingId: row.id,
        kind: row.kind,
        messageStatus: message.status,
        missing: missingSections(
          toTraditional(text, row.locale),
          options.definition.prompt.sections,
        ),
      })
    update = { status: 'failed', content: '' }
  } else {
    const { definition } = options
    const normalized = toTraditional(text, row.locale)
    const checked = checkCompliance(ensureHealthNotice(normalized, definition), row.locale)
    if (checked.violations.length > 0)
      log.warn('readings.compliance_replaced', {
        readingId: row.id,
        kind: row.kind,
        promptVersion: row.promptVersion,
        violations: checked.violations,
      })
    update = { status: 'ready', content: withDisclaimer(checked.content, definition) }
  }
  const [saved] = await s
    .update(reading, update, and(eq(reading.id, row.id), eq(reading.status, 'generating')) as SQL)
    .returning()
  if (!saved) return null
  if (saved.status === 'ready' && options.email && options.emailQueue)
    await sendReadingEmail(options.emailQueue, {
      ...options.email,
      locale: saved.locale,
      id: saved.id,
    })
  return saved
}

async function sendReadingEmail(
  queue: ReadingDeps['emailQueue'],
  email: { to: string; url: string; locale: string; id: string },
) {
  const requestId = getLogContext()?.requestId
  try {
    await requireCapability(queue, 'Email queue').send({
      v: EMAIL_QUEUE_MESSAGE_VERSION,
      to: email.to,
      locale: email.locale,
      appName: brandName(templateConfig, email.locale),
      idempotencyKey: `reading-ready:${email.id}`,
      template: 'reading-ready',
      props: { url: email.url },
      ...(requestId ? { requestId } : {}),
    })
  } catch (error) {
    // 报告已保存并可在列表中查看，邮件失败只记录
    log.error('readings.email_failed', { readingId: email.id, error })
  }
}
