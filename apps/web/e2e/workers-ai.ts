import { readFileSync } from 'node:fs'

/**
 * 项目修正：本项目的 web Worker 不配置 Workers AI 绑定（`wrangler.jsonc` 顶层没有 `ai`），
 * 后台与提交页按运行时可用性过滤掉 workers-ai（features/ai/admin-model-provider.ts）。
 * 依赖 workers-ai 选项的用例据此跳过；配置了绑定后自动恢复运行。
 */
const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  // 去掉整行注释，避免注释里的示例被当作配置
  .replace(/^\s*\/\/.*$/gm, '')

export const workersAiConfigured = /"ai"\s*:\s*\{\s*"binding"\s*:/.test(wrangler)
