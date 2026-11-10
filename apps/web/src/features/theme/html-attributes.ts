import { templateConfig } from '../../server/template-config.ts'
import { resolveSite } from '../site/site.ts'
import type { HtmlAttributesContext, ProjectHtmlAttributes } from './html-attributes.types.ts'

/**
 * 项目自有扩展点：模板创建后不再修改此文件，生成器原样复制。
 * 两站按请求 Host 识别（features/site/site.ts），在 <html> 上输出 data-site="east|west"，
 * brand.css 以 :root[data-site] 切换两站 token。与根 loader 的 getCurrentSite 使用同一识别规则。
 * 保持同步且无副作用；只在服务端首屏计算，客户端导航不重算（同一 Worker 内站点不随路由变化）。
 */
export function getProjectHtmlAttributes(context: HtmlAttributesContext): ProjectHtmlAttributes {
  return { 'data-site': resolveSite(context.host, templateConfig).id }
}
