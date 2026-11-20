import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getLocale } from '../../paraglide/runtime.js'
import { templateConfig } from '../../server/template-config.ts'
import { type ResolvedSite, resolveSite } from './site.ts'

/** 根 loader 使用：按请求 Host 识别站点，SSR 据此在 <html> 上输出 data-site */
export const getCurrentSite = createServerFn({ method: 'GET' }).handler(
  (): ResolvedSite => resolveSite(new URL(getRequest().url).host, templateConfig),
)

/**
 * 东方站根路径英文（openspec add-locales-eu-ja 5b）的路由数据模块；不是东方站英文请求时为 null：英语在两站共用同一组无前缀地址
 * （`/`、`/faq`、`/pricing`），顶层路由的 loader 据此按需加载东方站英文的文案。站点取根 loader 已识别的结果
 * （`parentMatchPromise` 为根路由的匹配），不再读请求或地址栏。
 */
export async function eastEnglishRouteData(root: Promise<{ readonly loaderData?: unknown }>) {
  if (getLocale() !== 'en') return null
  const site = ((await root).loaderData as { site?: ResolvedSite } | undefined)?.site?.id
  return site === 'east' ? import('../east-en/route-data.ts') : null
}
