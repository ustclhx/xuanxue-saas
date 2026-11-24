import type { Rubric } from '@xuanxue/evals'
import { readingsRubric } from '../readings/rubric.ts'

/**
 * 出生星盘评分标准：五个维度与 1–5 分沿用 `readings` r1，instructions 改写为西方占星。
 * 2026-11-22 起评测不再调用模型评委（--no-judge），由新开的 Claude 子代理按本标准逐样本复核（使用者规则）。
 * 评分标准或说明一改就改 version。
 */
export const natalRubric: Rubric = {
  version: 'r1-natal.1',
  instructions: [
    'You are a careful editor of Western astrology content written in English.',
    'The task input is JSON: `kind` is `natal-full`, `locale` is `en`; `request` is the fictional birth form and `requestDate` the request time;',
    '`data` is the server-computed birth chart (tropical zodiac): big three, each point with sign, degree, house and motion, house cusps, planets by house, major aspects with orbs, and element and modality counts.',
    'When `data.birthTimeKnown` is false there are no houses, Ascendant or Midheaven, and a sign written "X or Y" means either is possible; the report must not invent them.',
    'Judge the report only against `data` and the report itself; do not recompute the chart yourself.',
    'Accuracy means every sign, degree, house, aspect, orb and count cited matches `data`, and no points outside `data` (Chiron, Lilith, asteroids, minor aspects) appear.',
    'Tone and compliance for this reading: meanings are presented as traditional astrology, never as facts; no predicted events, dates, transits or future years; no relationship verdicts; no illness, investment or legal decisions; no religious framing.',
    'Language: fluent, natural English for readers new to astrology; terms such as house, orb or retrograde are briefly explained; leaked JSON field names or camelCase identifiers lower readability.',
    'Score anchors: 5 = fully meets the description, 3 = about half meets it or has noticeable issues, 1 = does not meet it.',
  ].join('\n'),
  criteria: readingsRubric.criteria,
  scale: readingsRubric.scale,
}
