// 首页「样例详批」区块的静态内容（tasks 9.2、9.3）：章节大纲固化为常量，避免把详批 catalog（含全部提示词）
// 打进首页包；`home-hub.test.tsx` 断言它与 catalog 当前默认提示词的章节一致。

/** 每种语言首页展示的详批（OQ8 默认：东方站八字 / 사주，西方站 Life Path 数字命理） */
export const HUB_SAMPLE_KIND = {
  'zh-Hant': 'bazi-full',
  'zh-Hans': 'bazi-full',
  ko: 'saju-full',
  en: 'numerology-full',
} as const satisfies Record<string, string>

export type HubSampleLocale = keyof typeof HUB_SAMPLE_KIND

export const HUB_SAMPLE_SECTIONS: Record<HubSampleLocale, readonly string[]> = {
  'zh-Hant': ['總論', '性格', '事業', '財運', '感情', '健康作息提示', '未來十年大運', '建議'],
  'zh-Hans': ['总论', '性格', '事业', '财运', '感情', '健康作息提示', '未来十年大运', '建议'],
  ko: ['총론', '성격', '직업운', '재물운', '애정운', '건강·생활 습관', '향후 10년 대운', '조언'],
  en: [
    'Overview',
    'Life Path',
    'Core Numbers',
    'Personal Year',
    'Love and Relationships',
    'Career and Money',
    'Wellbeing Habits',
    'Guidance',
  ],
}

/**
 * 样例段落（product-improve-ai-content-20261030 tasks 3.2 / D11）须经使用者审定，截至 2026-11-14 尚未审定，
 * 而且 catalog 现有样例基于另一张虚构命盘，与首页样例图形不一致。审定并与样例命盘对齐后，
 * 把段落写入这里（键为语言）并在测试中核对与 catalog 一致；为空的语言不渲染段落。
 */
export const HUB_SAMPLE_PARAGRAPHS: Readonly<Partial<Record<HubSampleLocale, string>>> = {}

export function isHubSampleLocale(locale: string): locale is HubSampleLocale {
  return Object.hasOwn(HUB_SAMPLE_KIND, locale)
}
