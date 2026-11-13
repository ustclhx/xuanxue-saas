import type { BirthDate, NumberResult } from '@xuanxue/numerology'
import { m } from '../../../paraglide/messages.js'
import { getLocale } from '../../../paraglide/runtime.js'
import { formatBirthDate } from '../numerology/calc.ts'
import { asLifePath, NUMBER_SUMMARY, NUMBER_THEME } from '../numerology/copy.ts'
import { shareCardBrand, shareCardCommon } from './common.ts'
import type { ShareCardModel } from './model.ts'

// 生命灵数（西方站）的分享图模型：大号数字 + 主题词 + 现有摘要（「分享图」画布西方站版式）。

/** 主题词在结果文字中为小写（如 expression），作标题时首字母大写 */
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(getLocale()) + text.slice(1)
}

export function lifePathShareCard(result: NumberResult, date: BirthDate): ShareCardModel {
  const value = asLifePath(result.value)
  return {
    ...shareCardCommon('west', 'life-path'),
    title: shareCardBrand('west'),
    eyebrow: m.share_card_eyebrow_life_path(),
    body: { kind: 'life-path', value, master: result.master ? m.numerology_master() : null },
    headline: capitalize(NUMBER_THEME[value]()),
    line: NUMBER_SUMMARY[value](),
    birth: formatBirthDate(date),
  }
}
