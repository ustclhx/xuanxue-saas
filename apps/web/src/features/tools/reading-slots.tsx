import type { ReactNode } from 'react'
import { ReadingOptinCard } from '../readings/optin-card.tsx'
import type { ReadingOptinData } from '../readings/optin-schema.ts'

export interface ReadingSlotsProps {
  readonly tool: string
  /** 未计算或不支持订阅的工具省略 / 传 null；调用方仅在结果完成后传入。 */
  readonly optin?: ReadingOptinData | null
  /** 付费解锁卡片，由 readings-ui 提供；始终排列在订阅之后。 */
  readonly children?: ReactNode
}

export function ReadingSlots({ tool, optin, children }: ReadingSlotsProps) {
  return (
    <>
      {optin && <ReadingOptinCard tool={tool} data={optin} />}
      {children}
    </>
  )
}
