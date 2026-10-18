import { createContext, useContext } from 'react'
import type { ToolEvent, ToolEventDetail } from './events.ts'

/** ToolPage 提供：子组件（结果区块、内链、表单）据此上报埋点；未包裹时不上报 */
export interface ToolContextValue {
  readonly tool: string
  readonly track: (event: ToolEvent, detail?: ToolEventDetail) => void
}

export const ToolContext = createContext<ToolContextValue>({ tool: '', track: () => {} })

export function useTool(): ToolContextValue {
  return useContext(ToolContext)
}
