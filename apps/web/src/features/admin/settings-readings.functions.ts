import { createServerFn } from '@tanstack/react-start'
import { log } from '@xuanxue/shared/log'
import { getWebRuntime } from '../../server/runtime.ts'
import { withAdminAction } from './action.server.ts'
import { adminMiddleware } from './admin.functions.ts'
import {
  invalidateReadingSettings,
  readingSettingsInput,
  readReadingSettings,
  writeReadingSettings,
} from './settings-readings.ts'

export const getReadingSettings = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(({ context }) => readReadingSettings(context.db))

export const saveReadingSettings = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(readingSettingsInput)
  .handler(async ({ context, data }) => {
    await withAdminAction(context, 'setting.readings.update', (scope) =>
      writeReadingSettings(scope, data),
    )
    try {
      await invalidateReadingSettings(getWebRuntime().cache)
    } catch (error) {
      log.error('admin.reading_settings_cache_invalidation_failed', {
        error,
        actorUserId: context.admin.id,
      })
      return { ok: false as const }
    }
    return { ok: true as const }
  })
