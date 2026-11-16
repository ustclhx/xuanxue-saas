import { fileURLToPath } from 'node:url'
import contentCollections from '@content-collections/vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import templateConfig from '../../../template.config.ts'
import { APP_AREA_PREFIXES } from '../src/features/i18n/app-area.ts'
import { isPrerenderedPath, prerenderEntryPages } from '../src/features/marketing/prerender.ts'
import { clientTemplateConfig, marketingPerformanceOptions } from './client-template-config.ts'
import { activeLocales, i18nMessages } from './i18n-project.ts'
import { prerenderToken, siteOrigins } from './site-build.ts'

const templateConfigFile = fileURLToPath(new URL('../../../template.config.ts', import.meta.url))
const performanceOptionsFile = fileURLToPath(
  new URL('../dist/.build/marketing-performance.json', import.meta.url),
)

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
    marketingPerformanceOptions(performanceOptionsFile, marketing.performance),
    tailwindcss(),
    i18nMessages({ i18n, appAreaPrefixes: APP_AREA_PREFIXES }),
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
