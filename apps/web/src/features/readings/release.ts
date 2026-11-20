import type { SiteId } from '@xuanxue/config'
import type { ReadingKind } from '@xuanxue/db'
import { templateConfig } from '../../server/template-config.ts'
import { siteOfLocale } from '../site/site.ts'

/**
 * 详批「类型 × 语言」的出售范围（add-locales-eu-ja design 决策 7，paid-readings「未通过评测的组合」）。
 * 只含常量与纯函数，不导入 catalog（解锁卡在客户端使用，不能把全部提示词打进页面包）。
 *
 * 1. 所属站点：同一种语言可以属于两个站点（东方站根路径英文与西方站都用 `en`），不能再按语言推断站点。
 *    只在一个站点提供的详批按类型固定站点；塔罗两站都有，按报告语言的归属站点（西方站 `en`，东方站其余语言）。
 * 2. 待评测组合：提示词已注册、但真实评测尚未通过门槛的组合。解锁卡、定价与 `POST /api/readings`
 *    都视为未开放（不显示「即将开放」，直接隐藏解锁入口）；评测与后台版本选择不受影响。
 *    评测通过后从列表中删除该组合即开放，无需改动其他代码。
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

/**
 * 等待真实评测的组合（`<kind>.<locale>`）。东方站英文八字与紫微：提示词与离线评测已就绪，
 * 真实评测待使用者批准预算（evals/readings-east-en/README.md）。
 */
export const READINGS_AWAITING_EVALUATION: readonly string[] = ['bazi-full.en', 'ziwei-full.en']

/** 组合是否已通过评测门槛（不在待评测列表中） */
export function readingReleased(
  kind: string,
  locale: string,
  awaiting: readonly string[] = READINGS_AWAITING_EVALUATION,
): boolean {
  return !awaiting.includes(`${kind}.${locale}`)
}

/** 某站点能否出售该组合：已通过评测且属于该站点（是否已注册由 catalog 判定） */
export function readingOffered(
  kind: string,
  locale: string,
  site: SiteId,
  awaiting: readonly string[] = READINGS_AWAITING_EVALUATION,
): boolean {
  return readingReleased(kind, locale, awaiting) && readingSite(kind, locale) === site
}
