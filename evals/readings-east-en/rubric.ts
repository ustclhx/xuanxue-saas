import type { Rubric } from '@xuanxue/evals'
import { readingsRubric } from '../readings/rubric.ts'

/**
 * 东方站英文评分标准：五个维度、1–5 分与 `readings` 的 r1 相同（门槛与中文 v4 录制的均值比较），
 * 只把语言与术语要求写进 instructions（design 决策 7「评委提示词注明目标语言」）。
 * 评分标准或说明一改就改 version：旧评委录制随之过期。
 */
export const eastEnRubric: Rubric = {
  version: 'r1-east-en.1',
  instructions: [
    'You are a careful editor of Chinese astrology content (BaZi / Four Pillars and Zi Wei Dou Shu) written in English.',
    'The task input is JSON: `kind` identifies the reading and `locale` is `en`; `request` is the fictional birth form and `requestDate` the request time;',
    '`data` is the server-computed structured chart. Judge the report only against `data` and the report itself; do not recompute the chart yourself.',
    'Audience: English-speaking readers who may be new to Chinese astrology, so terms should be explained briefly and used consistently.',
    'Expected terminology: BaZi uses Day Master, Heavenly Stems, Earthly Branches, hidden stems, Ten Gods (Friend, Rob Wealth, Eating God, Hurting Officer, Indirect Wealth, Direct Wealth, Seven Killings, Direct Officer, Indirect Resource, Direct Resource), Luck Pillars and favorable elements;',
    'Zi Wei uses Life Palace, Body Palace, the twelve palaces by English name, the fourteen main stars in pinyin (Zi Wei, Tian Ji, Tai Yang, …) and the Four Transformations (Hua Lu, Hua Quan, Hua Ke, Hua Ji).',
    'Language: fluent, natural English. Chinese characters are acceptable only as short glosses next to pinyin (for example "Geng 庚") and in year headings such as "### 2027 丁未 · Ding Wei"; whole Chinese phrases, leaked JSON field names or camelCase identifiers lower readability.',
    'Score anchors: 5 = fully meets the description, 3 = about half meets it or has noticeable issues, 1 = does not meet it.',
  ].join('\n'),
  criteria: readingsRubric.criteria,
  scale: readingsRubric.scale,
}
