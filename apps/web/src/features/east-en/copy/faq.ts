import type { FaqPageCopy } from './types.ts'

// 东方站英文 FAQ 页的「计算方法」一组：按事实单直接用英文写作，积分、隐私、账号组沿用两站共用文案
// （openspec add-locales-eu-ja 5b）。
export const FAQ_PAGE: FaqPageCopy = {
  h1: 'Frequently asked questions',
  intro:
    'How the charts and tarot tools on Ganjiday are calculated, what they can and cannot tell you, and how credits, privacy and your account work.',
  methodsTitle: 'Charts, tarot and accuracy',
  methods: [
    {
      q: 'Purple Star Astrology vs BaZi: what is the difference?',
      a: 'Both start from your birth date and hour. BaZi turns them into four pillars and reads the balance of the five elements around your Day Master. Purple Star Astrology places 14 main stars in twelve palaces, one for each area of life. Our [BaZi calculator](bazi) works without a birth time; the [Zi Wei Dou Shu chart](ziwei) needs one.',
      origin: 'local',
    },
    {
      q: 'How accurate is a BaZi chart?',
      a: 'The calculation is exact in the sense that it follows traditional rules: solar terms for months, the Beginning of Spring for the year, and your birth city’s time zone history for the hour. How you interpret the chart is a matter of tradition and judgment. We present charts for reference and self-reflection; they do not predict events.',
      origin: 'local',
    },
    {
      q: 'Does the BaZi calculator use my birth location?',
      a: 'Yes. Your birth city sets the time zone and removes any daylight saving time from that date. You can also turn on true solar time, which corrects the hour for longitude. The free chart is calculated in your browser, on your own device.',
      origin: 'local',
    },
    {
      q: 'How is the tarot draw done?',
      a: 'Cards are shuffled and drawn at random in your browser, and each card is set upright or reversed on its own. Answers in the [pick a card tarot](pick-a-card) spread come from a fixed yes, no or maybe for every card and orientation, so nothing is adjusted after you draw.',
      origin: 'adapted',
    },
    {
      q: 'Where do the optional written readings come from?',
      a: 'If you ask for a full reading, it is written by AI from your finished chart or cards and uses credits. The charts and draws themselves are free and do not need an account. Readings are meant for reflection, not as advice or a forecast.',
      origin: 'adapted',
    },
  ],
}
