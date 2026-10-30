import type { SiteId } from '@xuanxue/config'
import { READING_KINDS, type SettingsContext } from '@xuanxue/db'
import { templateConfig } from '../../server/template-config.ts'
import { readingDefinition } from '../readings/catalog.ts'
import { readingAvailable, readingConfig } from '../readings/config.ts'

/** 公开定价只承诺本站、本语言目录中已开放且可生成的详批。 */
export async function siteReadingPricing(site: SiteId, locale: string, ctx: SettingsContext) {
  if (!templateConfig.sites[site].locales.some((value) => value === locale)) return []
  const readings = []
  for (const kind of READING_KINDS) {
    if (!readingDefinition(kind, locale)) continue
    const config = await readingConfig(ctx, kind)
    if (readingAvailable(config)) readings.push({ kind, credits: config.credits })
  }
  return readings
}
