import type { SiteId } from '@xuanxue/config'
import type { ReadingKind } from '@xuanxue/db'
import { templateConfig } from '../../server/template-config.ts'
import { siteOfLocale } from '../site/site.ts'

/**
 * 详批「类型 × 语言」的所属站点（add-locales-eu-ja design 决策 7）。
 * 只含常量与纯函数，不导入 catalog（解锁卡在客户端使用，不能把全部提示词打进页面包）。
 *
 * 同一种语言可以属于两个站点（东方站根路径英文与西方站都用 `en`），不能再按语言推断站点。
 * 只在一个站点提供的详批按类型固定站点；塔罗两站都有，按报告语言的归属站点（西方站 `en`，东方站其余语言）。
 * 是否已通过评测门槛另由 catalog.ts 的 `READING_EVAL_PENDING` / `readingEvalPassed` 判定。
 */

const KIND_SITE: Readonly<Partial<Record<ReadingKind, SiteId>>> = {
  'bazi-full': 'east',
  'saju-full': 'east',
  'ziwei-full': 'east',
  'saju-compat': 'east',
  'numerology-full': 'west',
}

/** 报告所属站点：`POST /api/readings` 的 `site` 必须与之相同；未知语言返回 undefined */
export function readingSite(kind: string, locale: string): SiteId | undefined {
  const fixed = Object.hasOwn(KIND_SITE, kind) ? KIND_SITE[kind as ReadingKind] : undefined
  return fixed ?? siteOfLocale(locale, templateConfig)
}
