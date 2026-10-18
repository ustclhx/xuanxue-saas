import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { templateConfig } from '../../server/template-config.ts'
import { type ResolvedSite, resolveSite } from './site.ts'

/** 根 loader 使用：按请求 Host 识别站点，SSR 据此在 <html> 上输出 data-site */
export const getCurrentSite = createServerFn({ method: 'GET' }).handler(
  (): ResolvedSite => resolveSite(new URL(getRequest().url).host, templateConfig),
)
