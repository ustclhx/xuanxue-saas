import { dbSettingStore } from '@xuanxue/db'
import { getWebRuntime } from '../../server/runtime.ts'
import { getAiHttpDeps } from '../ai/runtime.ts'
import type { ReadingDeps } from './generate.ts'

/** 路由只组装业务依赖：文本管线沿用 AI 依赖，设置经 KV 缓存读取。 */
export function getReadingHttpDeps(): ReadingDeps {
  const runtime = getWebRuntime()
  return {
    ...getAiHttpDeps(),
    settings: { store: dbSettingStore(runtime.db), cache: runtime.cache },
    emailQueue: runtime.emailQueue,
  }
}
