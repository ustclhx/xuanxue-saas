// Worker 入口（wrangler.jsonc 的 main）。
// 在交给 TanStack Start 处理之前校验环境变量与绑定，缺失或非法时任何请求都返回 500。
// 先按 Host 识别东方站 / 西方站并校验语言前缀归属：不属于本站的语言返回 404，缺前缀时跳转（features/site/gate.ts）。
// /admin/** 的请求先经角色守卫，非 admin 与不存在的页面得到相同的 404（features/admin/gate.ts）。
// 之后由 Paraglide 按 URL 前缀 / Cookie 确定本次请求的语言（features/i18n/routing.ts）。
// 每个请求先建立日志上下文（新生成的 UUIDv7 请求 ID，附 Cloudflare 的 cf-ray 便于对照平台日志），
// 结束时输出一行 `http.request`（@xuanxue/shared/log）。

import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { type AuthEmail, parseAuthEnv, type SendAuthEmail } from '@xuanxue/auth'
import { brandName, loadEnv } from '@xuanxue/config'
import type { Database } from '@xuanxue/db'
import type { KeyValueStore, RequestMetadata } from '@xuanxue/platform'
import {
  createCloudflareBackgroundTasks,
  createCloudflareDatabase,
  createCloudflareKv,
  createCloudflareQueue,
  createCloudflareRateLimiter,
  createCloudflareRequestMetadata,
  createCloudflareWorkflow,
} from '@xuanxue/platform/cloudflare'
import { AppError } from '@xuanxue/shared'
import { log, withLogContext } from '@xuanxue/shared/log'
import { getFileDownload } from '@xuanxue/storage'
import { createCloudflareStorage } from '@xuanxue/storage/cloudflare'
import { APIError } from 'better-auth/api'
import { gateAdminRequest } from './features/admin/gate.ts'
import { handleAuthRequest } from './features/admin/impersonation-http.ts'
import {
  gatePublicApiRequest,
  isPublicApiPath,
  normalizePublicApiNotFound,
} from './features/api-keys/gate.ts'
import { createBillingDeletionSteps } from './features/billing/deletion.server.ts'
import { assertSignupAdmission } from './features/growth/service.ts'
import { authLocaleRedirect } from './features/i18n/auth-locale.ts'
import { eastHomeRedirect } from './features/i18n/east-home.ts'
import { gateLocaleRequest } from './features/i18n/gate.ts'
import { localizeRequest } from './features/i18n/request.server.ts'
import { workspaceContentDeletionStep } from './features/readings/deletion.server.ts'
import { gateSiteRequest } from './features/site/gate.ts'
import { siteHosts } from './features/site/site.ts'
import { prerenderRequest, staticPageResponse } from './features/site/static-pages.ts'
import { withSecurityNonce } from './security-context.server.ts'
import { withSecurityHeaders, withStaticSecurityHeaders } from './security-headers.ts'
import { createWebAuth } from './server/auth.ts'
import { createQueueAuthEmailSender, userLocaleByEmail } from './server/auth-email.ts'
import { checkEnv, webEnvSchema } from './server/cloudflare/env.ts'
import { captureServerError, instrumentWeb, sentryEnabled } from './server/cloudflare/sentry.ts'
import { getWebRuntime, type WebRuntime, withWebRuntime } from './server/runtime.ts'
import { SENTRY_TEST_PATH, sentryTest } from './server/sentry-test.ts'
import { templateConfig } from './server/template-config.ts'

// Router 的 loader 错误已经转换为 SSR 匹配状态，不会再从 fetch 抛出。
const startHandler = createStartHandler((context) => {
  for (const match of context.router.stores.matches.get()) {
    if (match.status === 'error') captureServerError(match.error)
  }
  return defaultStreamHandler(context)
})

const worker = instrumentWeb({
  fetch(incoming, env) {
    const buildRequest = prerenderRequest(incoming, env.SITE_PRERENDER_TOKEN)
    const path = decodeURI(new URL(incoming.url).pathname)
    if (!buildRequest && /^\/_site(?:\/|$)/.test(path))
      return Promise.resolve(new Response('Not Found', { status: 404 }))
    const request = buildRequest ?? incoming
    const invalid = checkEnv(env)
    if (invalid) return Promise.resolve(invalid)
    if (new URL(request.url).pathname === SENTRY_TEST_PATH)
      return sentryTest(request, getWebRuntime())
    return logged(request, () =>
      gateSiteRequest(
        request,
        templateConfig,
        // 不属于本站的语言前缀已被改写到 404 路径，后续一律使用守卫传入的请求
        async (request) =>
          // 东方站根路径先于静态语言选择页跳到语言首页；构建期预渲染请求不跳转
          (buildRequest ? null : eastHomeRedirect(request, templateConfig)) ??
          (!import.meta.env.DEV && !buildRequest && env.ASSETS
            ? await staticPageResponse(request, async (asset) =>
                withStaticSecurityHeaders(
                  await env.ASSETS.fetch(asset),
                  staticSecurity(request, env),
                ),
              )
            : null) ??
          gatePublicApiRequest(request, templateConfig) ??
          authLocaleRedirect(request, templateConfig) ??
          (await localized(gateLocaleRequest(await gateAdminRequest(request, getWebRuntime())))),
      ),
    )
  },
} satisfies ExportedHandler<Cloudflare.Env>)

export default {
  fetch(request, env, ctx) {
    // 不信任入站的 x-request-id：可被客户端伪造，且会混入他人的检索结果
    const requestMeta = createCloudflareRequestMetadata(request)
    const context = { requestId: requestMeta.requestId, cfRay: requestMeta.cfRay }
    const nonce = crypto.randomUUID()
    const security = { ...staticSecurity(request, env), nonce }
    return withSecurityNonce(nonce, () =>
      withLogContext(context, async () => {
        try {
          // 不在站点守卫之前直接返回 ASSETS：run_worker_first 覆盖的预渲染 HTML（含 /tarot 工具页）
          // 必须先经过 gateSiteRequest 与东方站跳转；预渲染页由 staticPageResponse 读取并按脚本哈希补头。
          const invalid = checkEnv(env)
          const response =
            invalid ??
            (await withWebRuntime(createCloudflareWebRuntime(env, requestMeta, ctx), () =>
              worker.fetch(request, env, ctx),
            ))
          // 重定向与静态响应的 headers 可能只读，复制后再附请求 ID。
          const headers = withSecurityHeaders(response.headers, security)
          headers.set('x-request-id', context.requestId)
          if (new URL(request.url).searchParams.has('r'))
            headers.set('x-robots-tag', 'noindex, nofollow')
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          })
        } catch (error) {
          // 包装器已经捕获异常；返回无敏感细节的响应与请求 ID，便于管理员验收定位。
          log.error('http.unhandled', { error })
          if (error instanceof AppError)
            return Response.json(error.toJSON(), {
              status: error.status,
              headers: withSecurityHeaders({ 'x-request-id': context.requestId }, security),
            })
          return new Response('Internal Server Error', {
            status: 500,
            headers: withSecurityHeaders({ 'x-request-id': context.requestId }, security),
          })
        }
      }),
    )
  },
} satisfies ExportedHandler<Cloudflare.Env>

// 构建生成的静态 HTML 不带本次请求的 nonce，由 withStaticSecurityHeaders 按内联脚本哈希授权。
function staticSecurity(request: Request, env: Cloudflare.Env) {
  return {
    https: new URL(request.url).protocol === 'https:',
    r2AccountId: env.R2_ACCOUNT_ID,
    sentryDsn: env.SENTRY_DSN,
  }
}

// 只记录方法与路径：查询串可能带令牌（魔法链接、重置密码等）
async function logged(request: Request, handle: () => Promise<Response>): Promise<Response> {
  const started = Date.now()
  const { method } = request
  const path = new URL(request.url).pathname
  try {
    const handled = await handle()
    const response = isPublicApiPath(path) ? await normalizePublicApiNotFound(handled) : handled
    log.info('http.request', {
      method,
      path,
      status: response.status,
      durationMs: Date.now() - started,
    })
    return response
  } catch (error) {
    log.error('http.request', {
      method,
      path,
      status: error instanceof AppError ? error.status : 500,
      durationMs: Date.now() - started,
      error,
    })
    throw error
  }
}

// 交给 TanStack Start 的仍是原始地址，语言前缀由路由器的 rewrite 去掉（与 SSR 后的客户端一致）
function localized(request: Request): Promise<Response> {
  return localizeRequest(request, getWebRuntime(), () => startHandler(request))
}

/** CF bindings 仅在入口装配；getter 保证公开页降级时不提前创建认证/数据库资源。 */
function createCloudflareWebRuntime(
  env: Cloudflare.Env,
  requestMeta: RequestMetadata,
  ctx: ExecutionContext,
): WebRuntime {
  const config = {
    ...parseAuthEnv(env, templateConfig),
    TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY,
    PAYMENT_MODE: env.PAYMENT_MODE,
    SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT,
    AI_FAULT_INJECTION: env.AI_FAULT_INJECTION,
    ...(env.STRIPE_SECRET_KEY === undefined ? {} : { STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY }),
    ...(env.STRIPE_WEBHOOK_SECRET === undefined
      ? {}
      : { STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET }),
    ...(env.PAYPAL_CLIENT_ID === undefined ? {} : { PAYPAL_CLIENT_ID: env.PAYPAL_CLIENT_ID }),
    ...(env.PAYPAL_CLIENT_SECRET === undefined
      ? {}
      : { PAYPAL_CLIENT_SECRET: env.PAYPAL_CLIENT_SECRET }),
    ...(env.PAYPAL_WEBHOOK_ID === undefined ? {} : { PAYPAL_WEBHOOK_ID: env.PAYPAL_WEBHOOK_ID }),
  }
  const databases = createCloudflareDatabase(env)
  const files = createCloudflareStorage(env)
  const cache = createCloudflareKv(env.CACHE)
  const rateLimiter = createCloudflareRateLimiter(env)
  const queue = createCloudflareQueue(env.EMAIL_QUEUE)
  const workersAi = env.AI
  const createAuth = (db: Database, authCache: KeyValueStore = cache) => {
    const queued = createQueueAuthEmailSender({
      queue,
      appName: (locale) => brandName(templateConfig, locale),
      appUrl: config.APP_URL,
      resolveLocale: userLocaleByEmail(db),
    })
    // 本地调试行为与旧接线一致；生产队列消息不写入日志。
    const sendEmail: SendAuthEmail = import.meta.env.DEV
      ? async (email: AuthEmail) => {
          console.log('[dev] auth email', email)
          await queued(email)
        }
      : queued
    return createWebAuth(config, db, {
      cache: authCache,
      rateLimiter,
      clientIp: requestMeta.clientIp,
      hosts: siteHosts(templateConfig, config.APP_URL),
      sendEmail,
      deletionSteps: [
        ...createBillingDeletionSteps(config, db, cache),
        workspaceContentDeletionStep,
      ],
      beforeUserCreate: async (user, headers) => {
        try {
          await assertSignupAdmission(
            {
              db,
              config: templateConfig,
              secret: config.BETTER_AUTH_SECRET,
            },
            user.email,
            headers,
          )
        } catch (error) {
          if (error instanceof AppError)
            throw APIError.from('FORBIDDEN', { code: error.code, message: error.message })
          throw error
        }
      },
    })
  }
  let auth: ReturnType<typeof createAuth> | undefined
  const textConfig = loadEnv(env, webEnvSchema)
  const runtime: WebRuntime = {
    config,
    cache,
    rateLimiter,
    requestMeta,
    observability: { enabled: sentryEnabled(env), captureError: captureServerError },
    files: { available: true, value: files },
    emailQueue: { available: true, value: queue },
    eventsQueue: env.EVENTS_QUEUE
      ? { available: true, value: createCloudflareQueue(env.EVENTS_QUEUE) }
      : { available: false },
    ai: {
      available: true,
      value: {
        config: {
          AI_FAULT_INJECTION: env.AI_FAULT_INJECTION,
          SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT,
          AI_TEXT_EGRESS: textConfig.AI_TEXT_EGRESS ?? 'gateway',
          OPENAI_BASE_URL: textConfig.OPENAI_BASE_URL,
          AI_GATEWAY_ACCOUNT_ID: env.AI_GATEWAY_ACCOUNT_ID,
          AI_GATEWAY_ID: env.AI_GATEWAY_ID,
          AI_GATEWAY_TOKEN: env.AI_GATEWAY_TOKEN,
          OPENAI_API_KEY: env.OPENAI_API_KEY,
          ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
          GOOGLE_API_KEY: env.GOOGLE_API_KEY,
          DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
          ...(env.FAL_KEY === undefined ? {} : { FAL_KEY: env.FAL_KEY }),
          ...(env.MEDIA_WEBHOOK_SECRET === undefined
            ? {}
            : { MEDIA_WEBHOOK_SECRET: env.MEDIA_WEBHOOK_SECRET }),
        },
        workersAi: workersAi
          ? { available: true, value: { run: (model, params) => workersAi.run(model, params) } }
          : { available: false },
        background: createCloudflareBackgroundTasks(ctx),
        workflow: env.AI_MEDIA_WORKFLOW
          ? { available: true, value: createCloudflareWorkflow(env.AI_MEDIA_WORKFLOW) }
          : { available: false },
        downloadFile: {
          available: true,
          value: (input) => getFileDownload(databases.business(), files, input),
        },
      },
    },
    get db() {
      return databases.business()
    },
    get publicDb() {
      return databases.public()
    },
    get auth() {
      auth ??= createAuth(databases.business())
      return auth
    },
    createAuth,
    handleAuthRequest: (request) => handleAuthRequest(request, runtime),
  }
  return runtime
}
