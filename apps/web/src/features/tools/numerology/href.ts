import { getLocale } from '../../../paraglide/runtime.js'
import { toolHref } from '../tool-href.ts'
import {
  isNumerologyLocale,
  localizedLifePathPath,
  type NumerologyLocale,
  type NumerologyPageId,
  numerologyPath,
} from './routes.ts'

/**
 * 数字命理组件的站内地址（openspec add-locales-eu-ja 决策 2）：按当前语言取本地化路径与语言前缀。
 * 英语为西方站默认语言、不带前缀，地址与迁移前逐字相同；routes.ts 只放纯数据，运行时取语言放在这里。
 */
export function numerologyLocale(): NumerologyLocale {
  const locale = getLocale()
  return isNumerologyLocale(locale) ? locale : 'en'
}

export function numerologyHref(
  id: NumerologyPageId,
  locale: NumerologyLocale = numerologyLocale(),
): string {
  return toolHref(numerologyPath(id, locale), locale)
}

export function lifePathHref(value: number, locale: NumerologyLocale = numerologyLocale()): string {
  return toolHref(localizedLifePathPath(value, locale), locale)
}
