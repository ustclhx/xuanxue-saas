import type { EMAIL_LOCALES } from '@xuanxue/email/queue'
import type { Locale as TarotPackageLocale } from '@xuanxue/tarot'
import type { Locale } from '../../paraglide/runtime.js'

/**
 * 项目语言类型的唯一来源（openspec add-locales-eu-ja tasks 1.3）。本文件归项目所有，template-sync 不覆盖。
 *
 * - `AppLocale` 是 Paraglide 按 template.config.ts `i18n.locales` 生成的语言联合：在配置中加一种语言后，
 *   所有 `Record<AppLocale, …>`（塔罗路径、合规规则、静态页文案等）在类型检查时报出缺少的登记。
 * - 站点语言：西方站按 `WEST_LOCALES` 显式登记，东方站为其余语言；与 template.config.ts 的 `sites` 一致
 *   由 locales.test.ts 检查。新的西方站语言（es 等）须加进 `WEST_LOCALES`，否则东方站的
 *   `Record<EastLocale, …>`（八字组件等）会要求为它登记。
 * - 只在部分东方站语言提供的功能（每日运势、八字概念页、命盘查询）用显式子集（`EastV1Locale` 等），
 *   新语言默认不进入，需要时显式加入。
 * - packages 不能依赖 apps：各包自己的语言列表保持显式，下方 `Covers` 在类型检查时要求它们覆盖全部配置语言。
 *
 * 只含类型与字面量常量，不引用运行时模块，客户端、服务端与构建脚本都可引用。
 */
export type AppLocale = Locale

/** 西方站语言（template.config.ts `sites.west.locales`） */
export const WEST_LOCALES = ['en'] as const
export type WestLocale = (typeof WEST_LOCALES)[number]

/** 东方站语言（template.config.ts `sites.east.locales`）：配置中西方站以外的语言 */
export type EastLocale = Exclude<AppLocale, WestLocale>

/** 只在 v1 东方站语言提供的功能：每日运势、八字概念页（第一期 ja 不做，design 决策 4） */
export type EastV1Locale = Extract<EastLocale, 'zh-Hant' | 'zh-Hans' | 'ko'>

/** `List` 覆盖 `Expected` 中的每种语言时为 true，否则给出缺少的语言 */
export type Covers<List extends string, Expected extends string> = [
  Exclude<Expected, List>,
] extends [never]
  ? true
  : { readonly missing: Exclude<Expected, List> }

/** 类型断言：`T` 不为 true 时在此处报错 */
export type Assert<T extends true> = T

// 包内的显式语言列表必须覆盖全部配置语言（加语言时在类型检查阶段报错，而不是运行时回退）
export type _TarotPackageCoversConfig = Assert<Covers<TarotPackageLocale, AppLocale>>
export type _EmailCoversConfig = Assert<Covers<(typeof EMAIL_LOCALES)[number], AppLocale>>
