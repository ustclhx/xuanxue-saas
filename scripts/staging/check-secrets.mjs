import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import templateConfig from '../../template.config.ts'

const execFileAsync = promisify(execFile)
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const providerSecrets = {
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
}
const optionalSecrets = ['RESEND_API_KEY', 'AI_GATEWAY_TOKEN', 'SENTRY_DSN']
// 缺少时仅文件签名入口返回 503，不阻断认证、营销页和不需要 S3 的清理 Cron。
const storageSecrets = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']

export function getSecretRequirements(config) {
  const paymentSecrets = config.billing.enabled
    ? config.billing.providers.flatMap((provider) => providerSecrets[provider])
    : []
  return {
    web: {
      required: [
        'BETTER_AUTH_SECRET',
        ...(config.auth.turnstile ? ['TURNSTILE_SECRET_KEY'] : []),
        ...config.auth.oauth.flatMap((provider) => [
          `${provider.toUpperCase()}_CLIENT_ID`,
          `${provider.toUpperCase()}_CLIENT_SECRET`,
        ]),
        ...paymentSecrets,
      ],
      optional: [...optionalSecrets, ...storageSecrets],
    },
    jobs: { required: paymentSecrets, optional: optionalSecrets },
  }
}

export const secretRequirements = getSecretRequirements(templateConfig)

async function listSecrets(worker, environment) {
  const { stdout } = await execFileAsync(
    'pnpm',
    [
      '--filter',
      `@xuanxue/${worker}`,
      'exec',
      'wrangler',
      'secret',
      'list',
      '--env',
      environment,
      '--format',
      'json',
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      timeout: 60_000,
    },
  )
  return JSON.parse(stdout)
}

export async function checkSecrets({
  environment = 'staging',
  config = templateConfig,
  list = listSecrets,
  write = console.log,
  error = console.error,
} = {}) {
  let exitCode = 0
  for (const [worker, requirements] of Object.entries(getSecretRequirements(config))) {
    let names
    try {
      const secrets = await list(worker, environment)
      if (!Array.isArray(secrets) || secrets.some((secret) => typeof secret?.name !== 'string')) {
        throw new Error('Invalid secret list')
      }
      names = new Set(secrets.map((secret) => secret.name))
    } catch {
      // Wrangler 的错误可能携带认证或网络信息，只报告固定的失败提示。
      error(`${worker}: secret list failed`)
      exitCode = 1
      continue
    }
    for (const category of ['required', 'optional']) {
      for (const name of requirements[category]) {
        if (names.has(name)) continue
        write(`${worker} ${category}: ${name}`)
        if (category === 'required') exitCode = 1
      }
    }
  }
  return exitCode
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await checkSecrets()
}
