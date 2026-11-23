import type { LandingCopy } from './types.ts'

// 东方站根路径英文落地页正文：按事实单（home）直接用英文写作，不译自其他语言页（openspec add-locales-eu-ja 5b）。
export const LANDING: LandingCopy = {
  title: 'Ganjiday: Free Chinese Astrology Birth Chart Tools',
  description:
    'Free Chinese astrology birth charts: a BaZi calculator and a Zi Wei Dou Shu chart worked out by traditional rules in your browser, with no account needed.',
  eyebrow: 'Chinese astrology, calculated in your browser',
  h1: 'Free Chinese astrology birth charts: BaZi and Zi Wei Dou Shu',
  lead: 'Enter a birth date, time and place to see your Four Pillars and your twelve palaces. Both charts follow traditional rules, run on your own device and need no sign-up. Read them for reflection, not as a forecast.',
  cta: 'Calculate my BaZi chart',
  toolsTitle: 'Four tools, one set of birth details',
  toolsIntro:
    'The two birth charts share the details you type once. The tarot tools need nothing but a question.',
  tools: {
    bazi: {
      title: 'BaZi calculator',
      summary:
        'Four Pillars of Destiny from your birth date, hour and city, with the Ten Gods, Day Master strength, favorable elements and ten-year luck pillars.',
      action: 'Open the BaZi calculator',
    },
    ziwei: {
      title: 'Zi Wei Dou Shu chart',
      summary:
        'Purple Star Astrology laid out as twelve palaces, with your Life Palace and Body Palace, the 14 main stars and the birth-year Four Transformations.',
      action: 'Draw a Zi Wei chart',
    },
    spreads: {
      title: 'Past present future tarot',
      summary:
        'Three cards that tell a short story about one situation, plus a one card pull, a pick a card draw and the ten-card Celtic Cross.',
      action: 'Choose a spread',
    },
    feelings: {
      title: 'Tarot cards as feelings',
      summary:
        'All 78 cards read from one angle: what each card says about how someone feels, whether it is a partner, a crush or an ex.',
      action: 'Browse the 78 cards',
    },
  },
  sections: [
    {
      heading: 'What a Chinese astrology birth chart actually records',
      paragraphs: [
        'A Western horoscope starts from the positions of the planets. A Chinese astrology birth chart starts from the calendar. The year, month, day and two-hour period of your birth are each written as a pair of signs: one of ten Heavenly Stems on top and one of twelve Earthly Branches underneath. Each sign carries one of the five elements, Wood, Fire, Earth, Metal or Water, in a Yin or a Yang form. Those eight signs are the raw material for every method on this site.',
        'Your zodiac animal is only one of the eight, the branch of the year. Most of the detail sits in the other seven, and especially in the stem of the day, which BaZi calls the Day Master and treats as a stand-in for you. The rest of the chart is read by how each sign supports, drains or pressures that Day Master.',
      ],
    },
    {
      heading: 'How the charts are calculated',
      paragraphs: [
        'Chinese months do not begin on the 1st. They change at the solar terms, the 24 points of the sun’s yearly path, so someone born on 3 February and someone born on 5 February can land in different years and months even though both dates are in February. The calculator places every birth against those boundaries, and the year itself changes at the Beginning of Spring rather than on 1 January or at the lunar New Year. The change to Ding Wei falls on 4 February 2027 in China. Use [BaZi 2027](bazi-2027) to compare that annual pillar with your birth chart.',
        'The hour matters just as much. Pick your birth city and the calculator applies that city’s historical time zone, including daylight saving time, before it finds your two-hour period. If you were born near the edge of an hour, you can switch on true solar time, which corrects for longitude and the equation of time. The calculation runs in your browser, on your own device, and you do not need an account.',
        'Optional full readings are a separate step. They are written by AI from your finished chart, cost credits, and are listed on the [pricing](pricing) page. The free charts stay free either way.',
      ],
    },
    {
      heading: 'BaZi or Zi Wei Dou Shu: which one to start with',
      paragraphs: [
        'The [BaZi calculator](bazi) is the better first step if you want the big picture. It weighs the five elements in your eight signs, judges whether the Day Master is strong or weak, and shows ten-year luck pillars, so it reads like a map of tendencies across a lifetime. It still works when you only know your birth date.',
        'A [Zi Wei Dou Shu chart](ziwei) sorts the same moment into twelve palaces, one for each area of life such as career, wealth, relationships and health, and places named stars inside them. It is more granular but needs an exact birth time. You can open both and compare; the points where they agree are a good place to start thinking. Both are tools for self-reflection; neither one claims to know what happens next.',
      ],
    },
  ],
  faqTitle: 'Questions about Chinese astrology charts',
  faq: [
    {
      q: 'Is there a free Chinese astrology reading with no sign-up?',
      a: 'Yes. Both birth charts are calculated in your browser and shown in full without an account. Only the optional written readings use credits, and you can see your whole chart before deciding whether you want one.',
      origin: 'local',
    },
    {
      q: 'Why does a Chinese astrology calculator ask for my time of birth?',
      a: 'The birth hour sets the fourth pillar in BaZi and decides where the Life Palace sits in Zi Wei Dou Shu. Without it BaZi can still show three pillars, but a Zi Wei chart cannot be drawn.',
      origin: 'local',
    },
    {
      q: 'Is my Chinese zodiac animal the same as my birth chart?',
      a: 'No. The animal is the Earthly Branch of your birth year, one sign out of eight. The chart adds the month, day and hour, and it is the day stem, not the animal, that most interpretations center on.',
      origin: 'adapted',
    },
    {
      q: 'Can these charts tell me what will happen?',
      a: 'They are calculated by traditional rules and describe tendencies and timing as the tradition sees them. They do not predict events. Use them for reference and reflection, alongside your own judgment.',
      origin: 'adapted',
    },
  ],
}
