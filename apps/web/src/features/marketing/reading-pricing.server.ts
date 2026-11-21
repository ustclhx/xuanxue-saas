import type { SiteId } from '@xuanxue/config'
import { READING_KINDS } from '@xuanxue/db'
import { templateConfig } from '../../server/template-config.ts'
import { loadReadingAvailability, type ReadingAvailabilityDeps } from '../readings/availability.ts'
import { readingDefinition, readingEvalPassed } from '../readings/catalog.ts'

/**
 * 公开定价只承诺本站、本语言目录中已开放且可生成的详批（与结果页解锁卡同一判定）。
 * 返回空列表表示本站详批尚未开放：定价页与计费页据此暂停出售积分包。
 */
export async function siteReadingPricing(
  site: SiteId,
  locale: string,
  deps: ReadingAvailabilityDeps,
) {
  if (!templateConfig.sites[site].locales.some((value) => value === locale)) return []
  const readings = []
  for (const kind of READING_KINDS) {
    // 未通过评测门槛的组合不在定价页承诺（与解锁卡同一判定）
    if (!readingDefinition(kind, locale) || !readingEvalPassed(kind, locale)) continue
    const status = await loadReadingAvailability(deps, kind)
    if (status.available) readings.push({ kind, credits: status.config.credits })
  }
  return readings
}
