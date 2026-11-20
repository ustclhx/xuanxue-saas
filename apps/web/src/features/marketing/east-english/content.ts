import type { EastLocale } from '../../i18n/locales.ts'

/**
 * 东方站英文入口页的正文（openspec product-improve-ai-content-20261030 tasks.md 4.8，D5）。
 *
 * 只有英文一种语言，不进 messages/<locale>/*.json（那里要求四种语言同时提供）。
 * 合规（specs/tool-pages「合规声明」与 proposal「免费层文案」）：只描述依传统规则的计算，
 * 写明仅供参考与自我探索、不预测未来；标题与 H1 不以 AI 为卖点。全文不少于 600 词（design.md 风险项）。
 */

export type { EastLocale }

export interface EnglishToolLink {
  /** 工具注册表 id（features/tools/registry.ts），链接地址从注册表取；省略时为该语言的首页 */
  readonly tool?: string
  readonly locale: EastLocale
}

export interface EnglishSection {
  readonly id: string
  readonly title: string
  /** 原文名称，如「八字 · 四柱」 */
  readonly native: string
  /** 原文名称的语言；混合中韩文时省略 */
  readonly nativeLang?: EastLocale
  readonly paragraphs: readonly string[]
  /**
   * 段落之后的一句入口（设计稿 warm-refresh/EastEn.dc.html）：`[锚文本](key)` 标出链接，锚文本是目标页的
   * 原文主关键词，括号里给英文读者一个说明。全页正文共 5 条链接，语言切换仍在页头与页脚。
   */
  readonly open: string
  readonly links: Readonly<Record<string, EnglishToolLink>>
}

export const EAST_ENGLISH_COPY = {
  title: 'Bazi, Zi Wei Dou Shu, Saju and Tarot in English',
  description:
    'An English guide to Ganjiday: free Bazi Four Pillars, Zi Wei Dou Shu, Korean Saju and tarot tools in Chinese and Korean, and which page to open first.',
  eyebrow: 'Ganjiday · 干支日 · English guide',
  heading: 'Bazi, Zi Wei and Saju birth charts, explained in English',
  lead: [
    'Ganjiday (干支日, “stem-and-branch day”) is a free set of tools for the traditional East Asian calendar arts: Bazi Four Pillars, Zi Wei Dou Shu, Korean Saju and tarot. The calculators themselves are written in Traditional Chinese, Simplified Chinese and Korean, the languages these systems are practised in.',
    'This page is a short English introduction: what each system looks at, how our charts are calculated, and which page to open first. No account or email address is needed for the free tools, and charts are calculated directly in your browser.',
  ],
  nameTitle: 'What the name means',
  name: [
    'Gānzhī (干支) are the ten Heavenly Stems and the twelve Earthly Branches. Paired in turn, they form a cycle of sixty that has labelled years, months, days and two-hour periods in China, Korea and Japan for more than two thousand years. Rì (日) means “day”: in a Bazi chart the stem of your day pillar, the day master, is the reference point from which everything else is read. The name Ganjiday joins the two.',
  ],
  sections: [
    {
      id: 'bazi',
      title: 'Bazi — the Four Pillars of Destiny',
      native: '八字 · 四柱',
      nativeLang: 'zh-Hant',
      paragraphs: [
        'Bazi, literally “eight characters”, writes the moment of birth as four pillars – year, month, day and hour – each made of one Heavenly Stem and one Earthly Branch. Those eight characters are mapped onto the five elements of wood, fire, earth, metal and water, and read through relationships such as the Ten Gods, the hidden stems inside each branch and the ten-year luck pillars.',
        'Our Bazi calculator converts your birth date and time with the 24 solar terms, so the month pillar changes at the solar term rather than on the first day of a calendar month, and it can apply true solar time for your birthplace. The result shows the four pillars, the element balance, the strength of the day master, favourable elements, luck pillars, symbolic stars (shensha) and the traditional “bone weight” score.',
      ],
      open: 'Open the chart in Traditional Chinese: [八字排盤](bazi) (Bazi chart). The same tools are available in [简体中文](hans) (Simplified Chinese).',
      links: { bazi: { tool: 'bazi', locale: 'zh-Hant' }, hans: { locale: 'zh-Hans' } },
    },
    {
      id: 'ziwei',
      title: 'Zi Wei Dou Shu — Purple Star Astrology',
      native: '紫微斗數',
      nativeLang: 'zh-Hant',
      paragraphs: [
        'Zi Wei Dou Shu arranges a chart into twelve palaces: Life, Siblings, Spouse, Children, Wealth, Health, Travel, Friends, Career, Property, Fortune and Parents. Fourteen major stars, led by the Purple Star (Zi Wei), are placed in those palaces from the lunar birth date and the hour branch, together with the four transformations (四化) of the birth year.',
        'Where Bazi weighs the balance of elements, Zi Wei Dou Shu asks which area of life each star sits in. The calculator draws the twelve-palace grid, marks the Life and Body palaces, and lists the major stars and the transformations. Because the palaces depend on the birth hour, this tool needs a birth time.',
      ],
      open: 'Open [紫微斗數排盤](ziwei) (Zi Wei chart).',
      links: { ziwei: { tool: 'ziwei', locale: 'zh-Hant' } },
    },
    {
      id: 'saju',
      title: 'Saju — the Korean Four Pillars',
      native: '사주 · 만세력',
      nativeLang: 'ko',
      paragraphs: [
        'Saju (사주, 四柱) is the Korean name for the same four-pillar system, and a manseryeok (만세력) is the perpetual calendar used to look the pillars up. Korean practice usually corrects the birth hour to true solar time, because Korea Standard Time runs about thirty minutes ahead of the sun at Seoul; the Korean tool turns this correction on by default and shows the adjusted time.',
        'Alongside the chart you will find the element distribution, strength, the useful god, major and annual luck, and symbolic stars such as 귀인 (noble helpers) and 공망 (void). The Saju compatibility tool (사주궁합) compares two charts through their day pillars and complementary elements, and gives a reference score with an itemised breakdown.',
      ],
      open: 'Open [만세력](saju) (Manseryeok Saju chart, Korean).',
      links: { saju: { tool: 'bazi', locale: 'ko' } },
    },
    {
      id: 'tarot',
      title: 'Tarot',
      native: '塔羅 · 타로',
      paragraphs: [
        'Tarot is not part of the Chinese calendar tradition, but many people use it next to a chart as a prompt for reflection. Ganjiday offers a three-card spread for past, present and future, a card of the day, a yes-or-no draw and the Celtic Cross.',
        'Every one of the 78 cards of the Rider–Waite–Smith deck has its own meaning page in Traditional Chinese, Simplified Chinese and Korean, with upright and reversed readings. Cards are shuffled and drawn in your browser.',
      ],
      open: 'Open [三張牌塔羅](tarot) (three-card tarot).',
      links: { tarot: { tool: 'tarot-three-card', locale: 'zh-Hant' } },
    },
  ] satisfies readonly EnglishSection[],
  usingTitle: 'Using the tools if you read English',
  using: [
    'The calculators only need a birth date, a birth time if you know it, and optionally a birthplace. Dates are entered in the Gregorian calendar by default, and you can switch to the lunar calendar. If you do not know your birth hour, tick the unknown-time box: the Bazi and Saju charts are still calculated from the year, month and day pillars.',
    'Your browser’s built-in translation works well on the chart pages if you would like English labels. We suggest keeping the stems and branches themselves in their original characters – 甲, 子, 午 and the rest – because they are the vocabulary every Bazi and Saju book uses, and they are easy to look up.',
  ],
  methodTitle: 'How the charts are calculated, and what they are not',
  method: [
    'Every chart on Ganjiday is computed by fixed traditional rules: the solar-term calendar, the sixty-pair stem-and-branch cycle and the star-placement tables of each school. The same birth data always produces the same chart, wherever and whenever you calculate it.',
    'The interpretations are offered for reference and self-reflection only. They do not predict the future, and they are not a substitute for medical, legal, financial or psychological advice.',
  ],
} as const
