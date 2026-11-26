// 项目自有：模板只创建本文件，之后不再修改（template-release 检查），template-sync 不会在这里冲突。
// Worker 入口（server.ts）在「预渲染静态资源先发」之前调用 gateProjectRequest，环境校验失败时同样先调用。
// 返回值：
//   - Response：直接作为响应返回（模板按静态响应补安全头，HTML 按内联脚本哈希补 CSP），不再查静态资源与运行时；
//   - Request：只用于查找静态资源的改写请求；未命中时动态流程仍使用原始请求；
//   - undefined：不处理，沿用模板流程（按原始地址查 ASSETS）。
// 钩子运行在环境校验与运行时（数据库、认证）之前，只能使用 env 中的静态绑定（如 ASSETS），不要查库。
//
// 本项目（两站、多语言）在这里执行站点闸门中早于静态页的部分（features/site/gate.ts siteGateDecision）：
//   - 地址规范化（HTTPS、结尾斜杠、语言前缀大小写）、默认语言前缀 301、东方站无前缀公开页 301、
//     旧首页查询跳转：返回跳转响应；
//   - 已登记站点放行的地址：/favicon.ico 返回本站图标，预渲染页按 Host 读取本站的 HTML（staticPageResponse）；
//   - 其余请求（非本站语言前缀的 404、未登记 Host、构建期预渲染、内部 `/_site`、动态页面、开发环境）
//     一律不查静态资源，交给动态流程：本站风格的 404 由 TanStack Start 渲染（gateSiteRequest 改写到 404 路径）。
// GET/HEAD 不能返回 undefined：wrangler 的 html_handling 为 none，按原始地址查 ASSETS 会让 `/zh-hans/x.html`、`/en.html`
// 这类文件绕过站点判定直接返回（跨站泄露另一站的页面）。

import { responseRobotsTag } from '../features/seo/robots-header.ts'
import type { SiteGateResult } from '../features/site/gate.ts'
import { siteGateDecision, withSiteNoindex } from '../features/site/gate.ts'
import {
  prerenderRequest,
  siteFaviconResponse,
  staticPageResponse,
} from '../features/site/static-pages.ts'
import type { ProjectGateContext, ProjectGateResult } from './cloudflare/assets.ts'
import { templateConfig } from './template-config.ts'

/**
 * 命中的预渲染静态资源是否先于环境校验返回（public-site-availability）。
 * 站点闸门的跳转与按 Host 读取的预渲染页都在本钩子内完成，与 0.9.0 行为一致，保持 true：
 * 环境校验失败时公开预渲染页与站点跳转照常返回，动态请求返回 500。
 */
export const staticFirst: boolean = true

/** 不对应任何构建产物的查找地址：让模板的静态资源查找必然未命中，请求交给动态流程。 */
const NO_STATIC_ASSET_PATH = '/_project-gate/no-static-asset'

/**
 * 不查静态资源。模板只对 GET/HEAD 且非 WebSocket 升级的请求查 ASSETS，其余请求返回 undefined 即可，
 * 也避免复制带请求体的请求；GET/HEAD 改写到不存在的地址。
 */
function noStaticAsset(request: Request): Request | undefined {
  if (!['GET', 'HEAD'].includes(request.method)) return undefined
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') return undefined
  return new Request(new URL(NO_STATIC_ASSET_PATH, request.url), request)
}

function withRobots(request: Request, response: Response): Response {
  const robots = responseRobotsTag(request.url)
  if (!robots) return response
  const result = new Response(response.body, response)
  result.headers.set('x-robots-tag', robots)
  return result
}

export async function gateProjectRequest(
  request: Request,
  { env }: ProjectGateContext,
): Promise<ProjectGateResult> {
  // 构建期预渲染请求（本地 preview 的随机令牌）与内部 `/_site` 路径由动态流程处理（server.ts）
  if (prerenderRequest(request, env.SITE_PRERENDER_TOKEN)) return noStaticAsset(request)
  if (/^\/_site(?:\/|$)/.test(new URL(request.url).pathname)) return noStaticAsset(request)
  const decision: SiteGateResult = siteGateDecision(request, templateConfig)
  if (decision.kind === 'redirect') return withRobots(request, decision.response)
  // 非本站语言前缀的 404 需要 SSR 渲染本站风格的页面；开发环境与缺少 ASSETS 时不读预渲染文件
  if (decision.kind !== 'pass' || import.meta.env.DEV || !env.ASSETS) return noStaticAsset(request)
  const fetchAsset = (asset: Request) => env.ASSETS.fetch(asset)
  const asset =
    (await siteFaviconResponse(request, fetchAsset)) ??
    (await staticPageResponse(request, fetchAsset))
  if (!asset) return noStaticAsset(request)
  return withRobots(request, decision.noindex ? withSiteNoindex(asset) : asset)
}
