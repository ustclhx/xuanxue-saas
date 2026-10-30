import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import {
  dbModelStore,
  listAvailableModels,
  supportsTextThinking,
  textModelConfig,
} from '@xuanxue/ai'
import type { Database } from '@xuanxue/db'
import { getEntitlements } from '@xuanxue/entitlements'
import { z } from 'zod'
import { withBilling } from '../../server/feature-gates.ts'
import { withWorkspace } from '../../server/middleware.ts'
import { getWebRuntime } from '../../server/runtime.ts'
import { templateConfig } from '../../server/template-config.ts'
import { readFaultAccess } from './fault-access.ts'

// 模型选择器的数据（tasks.md 3.2）：当前空间权益允许且已启用的模型，经 KV 缓存读取。
// 只返回选择与预计消耗所需的字段，不暴露服务商与服务商侧的模型 id。

type WorkspaceContext = { db: Database; workspace: { id: string } }

async function pickerModels(context: WorkspaceContext, kind: 'text' | 'image' | 'video') {
  const runtime = getWebRuntime()
  const entitlements = await getEntitlements(context.db, context.workspace.id, {
    pastDueGraceDays: templateConfig.billing.pastDueGraceDays,
  })
  const models = await listAvailableModels(
    {
      store: dbModelStore(context.db),
      cache: runtime.cache,
      workersAi: runtime.ai?.available === true && runtime.ai.value.workersAi.available,
      faultAccess: await readFaultAccess({
        auth: runtime.auth,
        db: context.db,
        headers: getRequest().headers,
        env: runtime.ai?.available ? runtime.ai.value.config : {},
      }),
    },
    entitlements,
    { kind },
  )
  return models.map((model) => ({
    id: model.id,
    key: model.key,
    kind: model.kind,
    pricing: model.pricing,
    supportsThinking:
      model.kind === 'text' &&
      supportsTextThinking(model.provider, textModelConfig(model).thinking),
  }))
}

export const getPickerModels = createServerFn({ method: 'GET' })
  .middleware([withBilling, withWorkspace])
  .inputValidator(
    z.object({
      slug: z.string().min(1).max(64),
      kind: z.enum(['text', 'image', 'video']).default('text'),
    }),
  )
  .handler(({ context, data }) => pickerModels(context, data.kind))

/**
 * 空间导航是否显示对话入口（specs/ai-chat「无可用模型时隐藏对话入口」）：
 * 计费或文本 AI 关闭、或当前空间没有任何可用文本模型时为 false。
 */
export const getChatAvailable = createServerFn({ method: 'GET' })
  .middleware([withWorkspace])
  .inputValidator(z.object({ slug: z.string().min(1).max(64) }))
  .handler(async ({ context }) => {
    if (!templateConfig.billing.enabled || !templateConfig.ai.text.enabled) return false
    return (await pickerModels(context, 'text')).length > 0
  })
