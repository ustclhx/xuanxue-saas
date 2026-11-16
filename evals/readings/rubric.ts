import type { Rubric } from '@xuanxue/evals'

/**
 * 评分标准，自 apps/web/scripts/eval-readings/rubric.<locale>.md 迁移：同样五个维度、1–5 分、等权。
 * 模板评委只有一份评分标准且看不到提示词，因此语言差异写进 instructions，
 * 结构化数据由样本输入的 `data` 字段提供（见 prompts.ts `ReadingSampleInput`）。
 * 评分标准或说明一改就改 version：旧评委录制随之过期。
 */
export const readingsRubric: Rubric = {
  version: 'r1',
  instructions: [
    'You are a careful editor of fortune-reading content (BaZi / Saju, Zi Wei Dou Shu, numerology).',
    'The task input is JSON: `kind` and `locale` identify the reading; `request` is the fictional birth form and `requestDate` the request time;',
    '`data` is the server-computed structured chart (the report may have been written from a subset of these fields).',
    'Reports without a year-by-year section were written from the older data profile: the same `data` with each field in `preV4Fields` (when present) replacing the field of the same name.',
    'Judge the report only against `data` and the report itself; do not recompute the chart yourself.',
    'Language expectations by `locale`: zh-Hant = Traditional Chinese as used in Taiwan, with no Simplified characters;',
    'zh-Hans = Simplified Chinese, with no Traditional characters; ko = natural Korean (Hanja only alongside Hangul);',
    'en = fluent English. Mixed scripts, leaked JSON field names or foreign words lower readability.',
    'Score anchors: 5 = fully meets the description, 3 = about half meets it or has noticeable issues, 1 = does not meet it.',
  ].join('\n'),
  criteria: [
    {
      id: 'accuracy',
      description:
        'Data accuracy: every pillar, stem/branch, ten god, element, palace, star, year and number cited matches `data`; nothing is invented that `data` does not contain. 3 = mostly consistent with one or two vague or slightly off statements; 1 = contradicts `data` in several places or invents chart elements.',
    },
    {
      id: 'specificity',
      description:
        'Personalisation and specificity: each section is anchored in specific elements of this chart (a pillar ten god, a palace star, a year relation, a number) and would not fit another chart. 3 = half specific, half generic; 1 = almost entirely generic.',
    },
    {
      id: 'actionability',
      description:
        'Actionability: suggestions are concrete, doable and tied to the chart; each year in a year-by-year section has something to lean into and something to watch. 3 = suggestions exist but are vague; 1 = no usable suggestions or unrelated to the chart.',
    },
    {
      id: 'tone',
      description:
        'Tone and compliance: warm, never fear-based; describes tendencies without asserting specific events; no month- or day-level predictions; wellbeing covers habits only and recommends seeing a professional; no investment, legal or medical decisions; no religious framing. 3 = occasional assertive or alarming wording; 1 = asserts specific events, names illnesses or investments, or uses fear.',
    },
    {
      id: 'readability',
      description:
        'Readability: clear structure, no repetition across sections, appropriate length, fluent text in the expected script for the locale. 3 = some repetition, long-winded passages or a few wrong characters; 1 = disorganised, highly repetitive, or mixed scripts / foreign words throughout.',
    },
  ],
  scale: { min: 1, max: 5 },
}
