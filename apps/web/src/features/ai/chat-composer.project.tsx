import { useRouterState } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import { SessionChatCost } from './chat-cost.tsx'
import type { ChatSession } from './chat-session.ts'
import type { PickerModel } from './model-picker.ts'

// 项目自有：模板只创建本文件，之后不再修改（template-release 检查），template-sync 不会在这里冲突。

/** 输入区右下角预计消耗的参数：当前模型、输入框估算的 token 数与会话（对话 ID、回复状态、空间 slug 等） */
export interface ComposerEstimateProps {
  readonly model: PickerModel | undefined
  readonly inputTokens: number
  readonly session: ChatSession
}

/**
 * 替换输入区右下角的预计消耗（#373）。保持 undefined 时使用模板的 CreditEstimateText（按模型定价的最坏情况估算）。
 * 需要「每条预计 · 余额」等读取会话的文案时，导出一个组件，例如：
 *
 *   export const ProjectComposerEstimate: ComponentType<ComposerEstimateProps> | undefined = ({
 *     model, inputTokens, session,
 *   }) => <SessionChatCost model={model} inputTokens={inputTokens} session={session} />
 *
 * 组件可以使用 hooks；返回 null 时右下角不显示。外观只用 @saas/ui 组件与 token（docs/design-system.md）。
 */
// 项目：以「每条预计 · 余额」取代模板的最坏情况估算（adopt-subject-chat-readings design 决策 6，
// specs/ai-chat「预计消耗与余额提示」）：按典型回复长度估算并计入对话固定前缀，余额每轮回复结束后刷新一次。
export const ProjectComposerEstimate: ComponentType<ComposerEstimateProps> | undefined = ({
  model,
  inputTokens,
  session,
}) => {
  // 临时对象页由模板持有；在项目扩展点读取其路由令牌，正文始终由服务端 KV 解析。
  const token = useRouterState({
    select: (state): string | undefined => {
      const match = state.matches.find((match) => match.routeId === '/app/$slug/chat/context')
      return match &&
        'slug' in match.params &&
        match.params.slug === session.slug &&
        'token' in match.search &&
        typeof match.search.token === 'string'
        ? match.search.token
        : undefined
    },
  })
  return <SessionChatCost session={session} model={model} inputTokens={inputTokens} token={token} />
}
