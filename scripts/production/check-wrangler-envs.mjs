import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * add-cloud-production-neon 2.1：web / jobs 的 env.production 与 env.staging 绑定名集合一致，
 * production 不含任何 staging 资源 ID 或名称，且不设 PAYMENT_MODE（Q9 前关闭支付）与 AI_FAULT_INJECTION（生产禁止）。
 */
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const FORBIDDEN_PRODUCTION_VARS = ['PAYMENT_MODE', 'AI_FAULT_INJECTION']
const PRODUCTION_ORIGINS = ['https://ganjiday.com', 'https://arcanumber.com']

/** 去掉 JSONC 注释与尾逗号；字符串内的 `//`（如 URL）保持不变 */
export function parseJsonc(text) {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inString) {
      out += char
      if (char === '\\') {
        out += text[i + 1]
        i += 1
      } else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
      out += char
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      out += '\n'
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1
    } else out += char
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

export function bindingNames(env = {}) {
  const names = [
    ...(env.ai ? [`ai:${env.ai.binding}`] : []),
    ...(env.r2_buckets ?? []).map((item) => `r2:${item.binding}`),
    ...(env.kv_namespaces ?? []).map((item) => `kv:${item.binding}`),
    ...(env.hyperdrive ?? []).map((item) => `hyperdrive:${item.binding}`),
    ...(env.workflows ?? []).map((item) => `workflow:${item.binding}`),
    ...(env.queues?.producers ?? []).map((item) => `queue-producer:${item.binding}`),
    ...(env.queues?.consumers ?? []).map((_item, index) => `queue-consumer:${index}`),
    ...(env.ratelimits ?? []).map((item) => `ratelimit:${item.name}`),
  ]
  return names.sort()
}

/** 收集 env 中所有字符串值，用于查找 staging 资源泄漏 */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) strings(item, out)
  else if (value && typeof value === 'object')
    for (const item of Object.values(value)) strings(item, out)
  return out
}

export function checkEnvs(app, config) {
  const problems = []
  const staging = config.env?.staging
  const production = config.env?.production
  if (!staging || !production) return [`${app}: env.staging and env.production are both required`]
  const a = bindingNames(staging)
  const b = bindingNames(production)
  for (const name of a.filter((item) => !b.includes(item)))
    problems.push(`${app}: production is missing binding ${name}`)
  for (const name of b.filter((item) => !a.includes(item)))
    problems.push(`${app}: production has extra binding ${name}`)
  const stagingIds = new Set(strings(staging).filter((value) => /^[a-f0-9]{32}$/.test(value)))
  // 账号 ID 在两个环境中合法相同（R2 / Gateway 账号）
  for (const value of strings(staging.vars ?? {})) stagingIds.delete(value)
  for (const value of strings(production)) {
    if (stagingIds.has(value))
      problems.push(`${app}: production reuses staging resource id ${value}`)
    if (/-staging$|workers\.dev/.test(value))
      problems.push(`${app}: production references staging value ${value}`)
  }
  for (const key of FORBIDDEN_PRODUCTION_VARS)
    if (production.vars && key in production.vars)
      problems.push(`${app}: production must not set ${key}`)

  // 绑定集合相同并不能发现模板资源名；生产必须使用本项目已预配的资源。
  if (production.name !== `xuanxue-${app}-production`)
    problems.push(`${app}: unexpected production Worker name`)
  if (production.workers_dev !== false || production.preview_urls !== false)
    problems.push(`${app}: production workers.dev and preview URLs must be disabled`)
  for (const bucket of production.r2_buckets ?? [])
    if (bucket.bucket_name !== 'xuanxue-files-production')
      problems.push(`${app}: unexpected production R2 bucket ${bucket.bucket_name}`)
  const queueNames = {
    EMAIL_QUEUE: 'xuanxue-email-production',
    EVENTS_QUEUE: 'xuanxue-events-production',
  }
  for (const producer of production.queues?.producers ?? [])
    if (producer.queue !== queueNames[producer.binding])
      problems.push(`${app}: unexpected production queue for ${producer.binding}`)
  for (const consumer of production.queues?.consumers ?? [])
    if (!Object.values(queueNames).includes(consumer.queue))
      problems.push(`${app}: unexpected production consumer queue ${consumer.queue}`)
  const stagingRatelimits = new Set((staging.ratelimits ?? []).map((item) => item.namespace_id))
  for (const limit of production.ratelimits ?? [])
    if (stagingRatelimits.has(limit.namespace_id))
      problems.push(`${app}: production reuses staging ratelimit namespace ${limit.name}`)

  if (app === 'web') {
    if (production.vars?.APP_URL !== PRODUCTION_ORIGINS[1])
      problems.push('web: production APP_URL must be the western origin')
    if (production.vars?.R2_FILES_BUCKET !== 'xuanxue-files-production')
      problems.push('web: production R2_FILES_BUCKET must match the FILES bucket')
    const expectedDomains = PRODUCTION_ORIGINS.map((origin) => new URL(origin).hostname)
    const routes = production.routes ?? []
    if (
      routes.length !== expectedDomains.length ||
      expectedDomains.some(
        (domain) =>
          !routes.some((route) => route.pattern === domain && route.custom_domain === true),
      )
    )
      problems.push('web: production routes must bind both production custom domains')
  }
  return problems
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = ['web', 'jobs'].flatMap((app) =>
    checkEnvs(
      app,
      parseJsonc(readFileSync(resolve(repoRoot, `apps/${app}/wrangler.jsonc`), 'utf8')),
    ),
  )
  for (const line of problems) console.error(line)
  process.exitCode = problems.length ? 1 : 0
}
