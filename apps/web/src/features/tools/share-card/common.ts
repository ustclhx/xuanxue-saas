import { type SiteId, siteBrandName } from '@xuanxue/config'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { templateConfig } from '../../../server/template-config.ts'
import type { ShareCardModel, ShareCardTool } from './model.ts'

// 各结果的分享图模型共用部分（tasks 7.2）：站名、规范域名、页脚与声明。
// 每种结果的整理函数放在各自的 sources-*.ts，避免西方站首页为此引入八字 / 紫微的文案与标签。

export type ShareCardCommon = Pick<
  ShareCardModel,
  'site' | 'domain' | 'cta' | 'privacy' | 'disclaimer' | 'fileName' | 'tool'
>

export function shareCardCommon(site: SiteId, tool: ShareCardTool): ShareCardCommon {
  const domain = templateConfig.sites[site].hosts[0] ?? ''
  return {
    tool,
    site,
    domain,
    cta: site === 'east' ? m.share_card_cta_east({ domain }) : m.share_card_cta_west({ domain }),
    privacy: {
      withBirth: m.share_card_privacy_with_birth(),
      withoutBirth: m.share_card_privacy_without_birth(),
    },
    disclaimer: m.share_card_disclaimer(),
    // 文件名只含站点与工具，不含任何输入
    fileName: `${domain.split('.')[0] || site}-${tool}`,
  }
}

export function shareCardBrand(site: SiteId): string {
  return siteBrandName(templateConfig, site, getLocale())
}
