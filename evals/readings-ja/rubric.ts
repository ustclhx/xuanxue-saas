import type { Rubric } from '@xuanxue/evals'
import { readingsRubric } from '../readings/rubric.ts'

/**
 * 日语评分标准：与 readings 套件 `r1` 同样五个维度、锚点与权重（design 决策 7「评委用同一套 rubric」），
 * 只在说明中加上塔罗与日语（目标语言）的要求。说明一改就改 version，旧评委录制随之过期。
 */
export const readingsJaRubric: Rubric = {
  ...readingsRubric,
  version: 'r1-ja.1',
  instructions: [
    readingsRubric.instructions ?? '',
    'This suite also covers tarot spreads (`kind` = tarot-spread): `data.cards` lists each position, card, upright or reversed and the reference meaning; judge accuracy against those cards and positions.',
    'Target language: every report in this suite has `locale` = ja and must be natural Japanese in the polite です・ます style, using Japanese kanji forms (no Simplified Chinese characters, no Chinese sentences).',
    'Terminology must follow the Japanese schools: for BaZi (四柱推命) 命式, 通変星 (never 十神), 蔵干, 十二運星, 天中殺, 身強・身弱, 大運, 印綬 and 偏官; for Zi Wei 命盤, 命宮, 身宮, 四化; for tarot 正位置／逆位置 and ワンド・カップ・ソード・ペンタクル. Chinese-only terms or Chinese card names lower readability.',
    'The report starts and ends with the same fixed Japanese disclaimer added by the system; do not count it as repetition.',
  ].join('\n'),
}
