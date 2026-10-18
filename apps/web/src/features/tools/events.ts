import type { SiteId } from '@xuanxue/config'

/**
 * 工具页埋点（openspec add-dual-site-foundation 决策 5，specs/tool-pages「行为埋点」）：
 * 事件名固定为六个；载荷只按白名单构造，出生日期、姓名、邮箱等个人信息无法进入事件。
 */
export const TOOL_EVENTS = [
  'tool_submit',
  'result_view',
  'block_open',
  'tool_link_click',
  'optin_submit',
  'unlock_click',
] as const
export type ToolEvent = (typeof TOOL_EVENTS)[number]

/** 每个事件都带的上下文 */
export interface ToolEventContext {
  readonly tool: string
  readonly site: SiteId
  readonly locale: string
}

/** 事件专属字段：区块 id（block_open）、目标工具 id（tool_link_click）、订阅主题（optin_submit） */
export interface ToolEventDetail {
  readonly block?: string
  readonly target?: string
  readonly topic?: string
}

export const TOOL_EVENT_FIELDS = ['tool', 'site', 'locale', 'block', 'target', 'topic'] as const

// 标识类字段只接受短 slug；不符合时丢弃，避免把自由文本（可能含个人信息）写入事件
const SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

function slug(value: unknown): string | undefined {
  return typeof value === 'string' && SLUG.test(value) ? value : undefined
}

export function toolEventPayload(
  context: ToolEventContext,
  detail: ToolEventDetail = {},
): Record<string, string> {
  const payload: Record<string, string> = {}
  const tool = slug(context.tool)
  if (tool) payload.tool = tool
  if (context.site === 'east' || context.site === 'west') payload.site = context.site
  if (typeof context.locale === 'string' && LOCALE.test(context.locale))
    payload.locale = context.locale
  for (const key of ['block', 'target', 'topic'] as const) {
    const value = slug(detail[key])
    if (value) payload[key] = value
  }
  return payload
}
