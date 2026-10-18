import { retryDeletionCleanup } from '@xuanxue/auth'
import type { DatabaseAccess, KeyValueStore } from '@xuanxue/platform'
import { log } from '@xuanxue/shared/log'

/** 跟随心跳重试已提交的凭据失效；staging reduced profile 的周期为半小时。 */
export async function runDeletionCleanup(context: { db: DatabaseAccess; cache: KeyValueStore }) {
  const result = await retryDeletionCleanup(context.db.business(), context.cache)
  log.info('cron.deletion-cleanup', result)
  if (result.failed > 0) throw new Error('Credential cache cleanup failed; retry next heartbeat')
}
