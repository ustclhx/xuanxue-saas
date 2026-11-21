import type { LocationRewrite } from '@tanstack/react-router'
import { deLocalizeUrl, localizeUrl } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import {
  EAST_ENGLISH_LOCALE,
  EAST_ENGLISH_PATH,
  EAST_ENGLISH_URL,
  isEastEnglishHome,
} from '../site/site.ts'
import { isAppAreaPath } from './app-area.ts'
import { releaseState } from './rollout.ts'
import { hasForeignPrefix } from './site-locale.ts'

/**
 * 语言路由（tasks.md 1.1，design.md 决策 3）：默认语言无前缀，其他配置语言 `/<小写语言 id>/...`
 * （url-prefix.ts；`zh-Hant` → `/zh-hant/`）。
 *
 * - 语言识别与 URL 映射由 Paraglide 负责（src/server.ts 的 `paraglideMiddleware` 与这里的 rewrite）；
 *   前缀为语言 id 的小写形式（locale-url.ts）；站点默认语言前缀与大小写不同的前缀由站点守卫在进入 Paraglide 前
 *   301 到唯一地址，语言前缀的站点归属见 features/site/gate.ts。
 * - 未配置的前缀（如 `/fr/pricing`）不会被去掉，路由器找不到对应页面而返回 404。
 * - 应用区不加语言前缀：带前缀访问由 gate.ts 改写到 404，生成链接时也不给应用区加前缀。
 */

/**
 * 路由器的 URL 改写：进入时去掉语言前缀，生成链接时按当前语言加前缀（应用区除外）。
 * 已登记站点上外站语言前缀的地址（西方站 `/zh-hans/...`）两个方向都原样保留，客户端与服务端一样按 404 处理。
 */
export const localeRewrite = {
  input: ({ url }) => {
    // 东方站 `/` 是英文首页：东方站英文（5b）发布前路由到英文入口页的路由 `/en`（site.ts EAST_ENGLISH_URL，
    // 使用者 2026-11-20）；发布后为英文落地页（路由 `/`，按站点渲染，features/east-en）
    if (
      templateConfig.i18n.enabled &&
      isEastEnglishHome(url, templateConfig) &&
      releaseState('east', EAST_ENGLISH_LOCALE) !== 'released'
    ) {
      const result = new URL(url.href)
      result.pathname = EAST_ENGLISH_PATH
      return result
    }
    return templateConfig.i18n.enabled && !hasForeignPrefix(url, templateConfig)
      ? deLocalizeUrl(url)
      : url
  },
  output: ({ url }) => {
    if (templateConfig.i18n.enabled && url.pathname === EAST_ENGLISH_PATH) {
      const home = new URL(url.href)
      home.pathname = EAST_ENGLISH_URL
      if (isEastEnglishHome(home, templateConfig)) return home
    }
    return !templateConfig.i18n.enabled ||
      isAppAreaPath(url.pathname) ||
      hasForeignPrefix(url, templateConfig)
      ? url
      : localizeUrl(url)
  },
} satisfies LocationRewrite
