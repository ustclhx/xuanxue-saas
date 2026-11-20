import { fileURLToPath } from 'node:url'
import contentCollections from '@content-collections/vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import templateConfig from '../../../template.config.ts'
import { APP_AREA_PREFIXES } from '../src/features/i18n/app-area.ts'
import {
  LENIENT_MESSAGE_FEATURES,
  LOCALE_LENIENT_MESSAGE_FEATURES,
  STRICT_MESSAGE_LOCALES,
} from '../src/features/i18n/rollout.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../src/features/marketing/prerender.ts'
import { clientPureSchemas } from './client-pure-schemas.ts'
import { clientTemplateConfig } from './client-template-config.ts'
import { activeLocales, i18nMessages } from './i18n-project.ts'
import { localeSplit } from './locale-split.ts'
import { prerenderToken, siteOrigins } from './site-build.ts'

const templateConfigFile = fileURLToPath(new URL('../../../template.config.ts', import.meta.url))

/** 两目标共用内容、文案与预渲染范围；平台插件留在各自配置中。 */
export function sitePlugins(serverEntry?: string) {
  const { i18n, marketing } = templateConfig
  const locales = activeLocales(i18n)
  return [
    {
      name: 'saas:site-origins',
      config: () => ({ define: { __SITE_ORIGINS__: JSON.stringify(siteOrigins) } }),
    },
    clientTemplateConfig(templateConfigFile, templateConfig),
    clientPureSchemas(),
    tailwindcss(),
    i18nMessages({
      i18n,
      appAreaPrefixes: APP_AREA_PREFIXES,
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
      ...(serverEntry ? { server: { entry: serverEntry } } : {}),
      pages: marketing.enabled ? prerenderEntryPages(templateConfig) : [],
      prerender: {
        enabled: marketing.enabled,
        crawlLinks: true,
        headers: { 'x-site-prerender': prerenderToken },
        autoStaticPathsDiscovery: false,
        autoSubfolderIndex: false,
        filter: (page) => {
          if (!isPrerenderedPath(page.path, locales)) return false
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
