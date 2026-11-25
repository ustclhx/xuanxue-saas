import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import contentCollections from '@content-collections/vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import type { PluginTarget } from '@xuanxue/config'
import type { Plugin } from 'vite'
import {
  generatePlugins,
  NODE_WEB_ALIASES,
  pluginMessageDirs,
  pluginRouteConfig,
  REPO_ROOT,
} from '../../../scripts/plugins/plugins.mjs'
import templateConfig from '../../../template.config.ts'
import { APP_AREA_PREFIXES } from '../src/features/i18n/app-area.ts'
import {
  LENIENT_MESSAGE_FEATURES,
  LOCALE_LENIENT_MESSAGE_FEATURES,
  parseReleasePreview,
  type ReleasePreview,
  STRICT_MESSAGE_LOCALES,
} from '../src/features/i18n/rollout.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../src/features/marketing/prerender.ts'
import { clientPureSchemas } from './client-pure-schemas.ts'
import { clientTemplateConfig } from './client-template-config.ts'
import { activeLocales, i18nMessages } from './i18n-project.ts'
import { localeSplit } from './locale-split.ts'
import { prerenderToken, siteOrigins } from './site-build.ts'
import { webAlias } from './web-alias.ts'

const templateConfigFile = fileURLToPath(new URL('../../../template.config.ts', import.meta.url))

// 解析配置时生成插件注册文件并校验 plugins 段（scripts/plugins/generate.mjs 的同一实现），配置错误即构建失败
const { plugins: enabledPlugins } = await generatePlugins({ config: templateConfig })

/**
 * 本地「模拟发布」（features/i18n/rollout.ts）：LOCALE_RELEASE_PREVIEW=east:en 时构建产物把这些语言当作已发布，
 * 只供本地验收发布后的链接图与 SEO；部署构建（CLOUDFLARE_ENV）不允许设置。
 */
function localeReleasePreview(): ReleasePreview {
  const value = process.env.LOCALE_RELEASE_PREVIEW?.trim() ?? ''
  if (!value) return []
  if (process.env.CLOUDFLARE_ENV)
    throw new Error('LOCALE_RELEASE_PREVIEW 只用于本地验收构建，不能与 CLOUDFLARE_ENV 一起使用')
  console.warn(`[rollout] 模拟发布：${value}（仅本地验收，勿部署）`)
  return parseReleasePreview(value)
}

/**
 * Node 构建把两目标共用的 plugins.gen.ts / plugins.gen.css 解析为 Node 版本，排除仅 Cloudflare 的插件。
 */
function nodePluginRegistry(): Plugin {
  const aliases = new Map(
    Object.entries(NODE_WEB_ALIASES).map(([from, to]) => [
      join(REPO_ROOT, from),
      join(REPO_ROOT, to),
    ]),
  )
  return {
    name: 'saas:node-plugin-registry',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.includes('plugins.gen.')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      const target = resolved && aliases.get(resolved.id)
      return target ?? null
    },
  }
}

/** 两目标共用内容、文案、插件路由与预渲染范围；平台插件留在各自配置中。 */
export function sitePlugins(serverEntry?: string, target: PluginTarget = 'cloudflare') {
  const { i18n, marketing } = templateConfig
  const locales = activeLocales(i18n)
  return [
    webAlias(),
    ...(target === 'node' ? [nodePluginRegistry()] : []),
    {
      name: 'saas:site-origins',
      config: () => ({
        define: {
          __SITE_ORIGINS__: JSON.stringify(siteOrigins),
          __LOCALE_RELEASE_PREVIEW__: JSON.stringify(localeReleasePreview()),
        },
      }),
    },
    clientTemplateConfig(templateConfigFile, templateConfig),
    clientPureSchemas(),
    tailwindcss(),
    i18nMessages({
      i18n,
      appAreaPrefixes: APP_AREA_PREFIXES,
      messageDirs: pluginMessageDirs(enabledPlugins, target),
      // 新语言（add-locales-eu-ja）缺键时构建失败；后台与 UI 预览文件允许回退
      strict: {
        locales: STRICT_MESSAGE_LOCALES,
        lenientFeatures: LENIENT_MESSAGE_FEATURES,
        lenientByLocale: LOCALE_LENIENT_MESSAGE_FEATURES,
      },
    }),
    // 新语言文案在客户端按语言拆分为按需字典（项目插件，add-locales-eu-ja 1.6）
    localeSplit({
      locales: locales.filter((locale) => STRICT_MESSAGE_LOCALES.includes(locale)),
      paraglideDir: fileURLToPath(new URL('../src/paraglide', import.meta.url)),
      runtimeFile: fileURLToPath(
        new URL('../src/features/i18n/split-messages.ts', import.meta.url),
      ),
    }),
    contentCollections(),
    tanstackStart({
      // 核心 src/routes 原样挂在根下，再挂载目标支持的启用插件路由目录（openspec add-plugin-system 决策 4）
      router: { virtualRouteConfig: pluginRouteConfig(REPO_ROOT, enabledPlugins, target) },
      ...(serverEntry ? { server: { entry: serverEntry } } : {}),
      pages: marketing.enabled ? prerenderEntryPages(templateConfig) : [],
      prerender: {
        enabled: marketing.enabled,
        crawlLinks: true,
        headers: { 'x-site-prerender': prerenderToken },
        autoStaticPathsDiscovery: false,
        autoSubfolderIndex: false,
        filter: (page) => {
          if (!isPrerenderedPath(page.path, locales, undefined, true)) return false
          page.prerender = {
            ...page.prerender,
            outputPath: decodeURI(page.path).replace(/\/+$/, '') || '/',
          }
          return true
        },
      },
    }),
    viteReact(),
  ]
}
