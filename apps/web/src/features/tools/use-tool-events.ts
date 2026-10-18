import { useCallback } from 'react'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { captureProductEvent } from '../analytics/client.ts'
import { useSiteId } from '../site/context.tsx'
import { type ToolEvent, type ToolEventDetail, toolEventPayload } from './events.ts'

/** 工具页埋点：返回 track(event, detail)，自动附带工具标识、站点与语言 */
export function useToolEvents(tool: string) {
  const site = useSiteId()
  return useCallback(
    (event: ToolEvent, detail?: ToolEventDetail) =>
      captureProductEvent(
        templateConfig,
        event,
        toolEventPayload({ tool, site, locale: getLocale() }, detail),
      ),
    [tool, site],
  )
}
